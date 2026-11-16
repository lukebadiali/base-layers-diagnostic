// Request handlers for the Client Knowledge Agent callables. Kept free of the
// functions runtime so they test against the in-memory Firestore fake; the
// onCall wrappers in callables.ts only supply the caller, secrets and deps.
//
// Access model (Drive "Baselayers Agent" + 27 Oct call):
//   - Upload, upload log and archive: BeDeveloped staff (admin / internal);
//     archive and restore are admin only.
//   - Ask: staff for any client; a client only for their own org, and only
//     once clientAccess is switched on. It is off until the agent is ready.
//   - Caller identity and org come from the verified ID token, never the payload.

import { HttpsError } from "firebase-functions/v2/https";
import type { Firestore } from "firebase-admin/firestore";
import { z } from "zod";
import { validateInput } from "../util/zod-helpers.js";
import type { Answerer } from "./answer";
import { askKnowledge, type AskResult } from "./ask";
import type { Describer } from "./describer";
import type { Embedder } from "./embedder";
import { FormError } from "./form";
import { ingestSessionForm, type IngestResult } from "./ingest";
import { finishUpload, listUploads, logQuery, startUpload, type UploadRow } from "./logs";
import { orgCoverage, setOrgKnowledgeStatus, type OrgCoverage } from "./store";
import type { PillarKey } from "./types";

export interface Caller {
  uid: string;
  role: string;
  orgId?: string;
}

export interface HandlerDeps {
  db: Firestore;
  embedder: Embedder;
  describer: Describer;
  answerer: Answerer;
  /** Clients may ask their own agent. Off until the agent is released to clients. */
  clientAccess: boolean;
  now?: () => Date;
}

const STAFF = new Set(["admin", "internal"]);

/**
 * Release switch for clients: knowledgeConfig/access { clientAccess: true }.
 * Server-only (no rules match), so only an admin with project access can flip
 * it, and releasing the agent to clients needs no redeploy. Missing = off.
 */
export const CONFIG_COLLECTION = "knowledgeConfig";
export async function readClientAccess(db: Firestore): Promise<boolean> {
  const snap = await db.collection(CONFIG_COLLECTION).doc("access").get();
  return snap.exists && snap.get("clientAccess") === true;
}
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PILLARS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "review"] as const;

function requireStaff(caller: Caller | null): Caller {
  if (!caller?.uid) throw new HttpsError("unauthenticated", "Sign in required");
  if (!STAFF.has(caller.role)) throw new HttpsError("permission-denied", "BeDeveloped staff only");
  return caller;
}

async function clientNameFor(db: Firestore, orgId: string): Promise<string> {
  const snap = await db.collection("orgs").doc(orgId).get();
  const name = snap.exists ? (snap.get("name") as unknown) : undefined;
  if (typeof name !== "string" || !name.trim()) throw new HttpsError("not-found", "Organisation not found");
  return name;
}

// ── Ingest ────────────────────────────────────────────────────────────────

const IngestInput = z.object({
  orgId: z.string().min(1).max(128),
  fileName: z
    .string()
    .min(1)
    .max(200)
    .refine((n) => n.toLowerCase().endsWith(".docx"), "must be a .docx file"),
  fileBase64: z.string().min(1),
});

export async function handleIngest(
  deps: HandlerDeps,
  caller: Caller | null,
  data: unknown,
): Promise<IngestResult & { uploadId: string }> {
  const who = requireStaff(caller);
  const input = validateInput(IngestInput, data ?? {});
  const file = Buffer.from(input.fileBase64, "base64");
  if (file.length === 0 || file.length > MAX_UPLOAD_BYTES) {
    throw new HttpsError("invalid-argument", "File must be a .docx under 5 MB");
  }
  // .docx is a zip; anything else is rejected before it reaches the parser.
  if (file[0] !== 0x50 || file[1] !== 0x4b) throw new HttpsError("invalid-argument", "File is not a .docx document");

  const clientName = await clientNameFor(deps.db, input.orgId);
  // An archived client stays archived as a whole: a new upload would bring one
  // pillar back while the rest stayed off. Restore first, then upload.
  if ((await orgCoverage(deps.db, input.orgId)).status === "archived") {
    throw new HttpsError("failed-precondition", `${clientName}'s knowledge is archived. Restore it before uploading.`);
  }
  const startedAt = (deps.now?.() ?? new Date()).toISOString();
  const uploadId = await startUpload(deps.db, {
    orgId: input.orgId,
    clientName,
    fileName: input.fileName,
    uploadedBy: who.uid,
    startedAt,
  });

  try {
    const result = await ingestSessionForm(deps, file, {
      orgId: input.orgId,
      clientName,
      documentType: "session_form",
      uploadedBy: who.uid,
      uploadedAt: startedAt,
      sourceFileName: input.fileName,
    });
    await finishUpload(deps.db, uploadId, {
      status: "succeeded",
      pillar: result.pillar,
      sessionDate: result.sessionDate,
      chunks: result.chunks,
      replacedChunks: result.replacedChunks,
    });
    return { ...result, uploadId };
  } catch (err) {
    const userFacing = err instanceof FormError;
    const message = userFacing ? err.message : "Processing failed. Try again, or contact AssumeAI if it keeps failing.";
    await finishUpload(deps.db, uploadId, { status: "failed", error: err instanceof Error ? err.message : String(err) });
    throw new HttpsError(userFacing ? "invalid-argument" : "internal", message);
  }
}

// ── Ask ───────────────────────────────────────────────────────────────────

const AskInput = z.object({
  orgId: z.string().min(1).max(128).optional(),
  question: z.string().trim().min(1).max(500),
  pillar: z.enum(PILLARS).optional(),
  format: z.enum(["bullets", "short"]).optional(),
});

export async function handleAsk(deps: HandlerDeps, caller: Caller | null, data: unknown): Promise<AskResult> {
  if (!caller?.uid) throw new HttpsError("unauthenticated", "Sign in required");
  const input = validateInput(AskInput, data ?? {});
  const staff = STAFF.has(caller.role);

  let orgId: string;
  if (staff) {
    if (!input.orgId) throw new HttpsError("invalid-argument", "orgId is required");
    orgId = input.orgId;
  } else if (caller.role === "client") {
    if (!deps.clientAccess) throw new HttpsError("failed-precondition", "The knowledge agent is not available yet");
    if (!caller.orgId) throw new HttpsError("permission-denied", "No organisation on this account");
    if (input.orgId && input.orgId !== caller.orgId) throw new HttpsError("permission-denied", "Not your organisation");
    orgId = caller.orgId;
  } else {
    throw new HttpsError("permission-denied", "Not permitted");
  }

  const clientName = await clientNameFor(deps.db, orgId);
  const started = Date.now();
  const pillar = (input.pillar ?? null) as PillarKey | null;
  const base = { orgId, uid: caller.uid, role: caller.role, question: input.question, pillar };
  try {
    const result = await askKnowledge(deps, {
      orgId,
      clientName,
      question: input.question,
      pillar: pillar ?? undefined,
      format: input.format,
      includeSources: staff,
    });
    await logQuery(deps.db, {
      ...base,
      answered: result.answered,
      hitCount: result.hitCount,
      model: result.model,
      provider: result.provider,
      latencyMs: Date.now() - started,
    });
    return result;
  } catch (err) {
    await logQuery(deps.db, {
      ...base,
      answered: false,
      hitCount: 0,
      model: deps.answerer.model,
      provider: "",
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message.slice(0, 500) : String(err),
    });
    throw new HttpsError("internal", "The agent couldn't answer just now. Try again in a moment.");
  }
}

// ── Upload log ────────────────────────────────────────────────────────────

const UploadsInput = z.object({
  orgId: z.string().min(1).max(128).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

export async function handleUploads(
  deps: Pick<HandlerDeps, "db">,
  caller: Caller | null,
  data: unknown,
): Promise<{ uploads: UploadRow[] }> {
  requireStaff(caller);
  const input = validateInput(UploadsInput, data ?? {});
  return { uploads: await listUploads(deps.db, input) };
}

// ── Archive / restore ─────────────────────────────────────────────────────

const StatusInput = z.object({
  orgId: z.string().min(1).max(128),
  status: z.enum(["current", "archived"]),
});

export async function handleSetStatus(
  deps: Pick<HandlerDeps, "db">,
  caller: Caller | null,
  data: unknown,
): Promise<{ updated: number }> {
  const who = requireStaff(caller);
  if (who.role !== "admin") throw new HttpsError("permission-denied", "Admin only");
  const input = validateInput(StatusInput, data ?? {});
  return { updated: await setOrgKnowledgeStatus(deps.db, input.orgId, input.status) };
}

// ── Coverage ("what the agent knows") ─────────────────────────────────────

const CoverageInput = z.object({ orgId: z.string().min(1).max(128) });

export async function handleCoverage(
  deps: Pick<HandlerDeps, "db">,
  caller: Caller | null,
  data: unknown,
): Promise<OrgCoverage> {
  requireStaff(caller);
  const input = validateInput(CoverageInput, data ?? {});
  return orgCoverage(deps.db, input.orgId);
}
