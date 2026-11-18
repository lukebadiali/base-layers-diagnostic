// Upload log and question log for the Client Knowledge Agent. Both are
// server-only collections (no firestore.rules match, so client SDK access is
// denied) and are read back through the knowledgeUploads callable.
//
//   knowledgeUploads/{auto}  one row per upload attempt: processing -> succeeded | failed
//                            (27 Oct call: admins see what was added and whether it processed)
//   knowledgeQueries/{auto}  one row per question asked
//                            (requirement 11: what clients ask, for weekly usage reports)

import { FieldValue, type Firestore, type Query } from "firebase-admin/firestore";
import type { PillarKey } from "./types";

export const UPLOADS_COLLECTION = "knowledgeUploads";
export const QUERIES_COLLECTION = "knowledgeQueries";

export type UploadStatus = "processing" | "succeeded" | "failed";

export interface UploadRow {
  id: string;
  orgId: string;
  clientName: string;
  fileName: string;
  uploadedBy: string;
  status: UploadStatus;
  startedAt: string;
  finishedAt?: string;
  pillar?: PillarKey;
  sessionDate?: string;
  chunks?: number;
  replacedChunks?: number;
  error?: string;
}

export async function startUpload(
  db: Firestore,
  row: { orgId: string; clientName: string; fileName: string; uploadedBy: string; startedAt: string },
): Promise<string> {
  const ref = db.collection(UPLOADS_COLLECTION).doc();
  await ref.set({ ...row, status: "processing" satisfies UploadStatus });
  return ref.id;
}

export async function finishUpload(
  db: Firestore,
  id: string,
  outcome:
    | { status: "succeeded"; pillar: PillarKey; sessionDate: string; chunks: number; replacedChunks: number }
    | { status: "failed"; error: string },
): Promise<void> {
  await db
    .collection(UPLOADS_COLLECTION)
    .doc(id)
    .update({ ...outcome, finishedAt: new Date().toISOString() });
}

export async function listUploads(db: Firestore, opts: { orgId?: string; limit?: number }): Promise<UploadRow[]> {
  let q = db.collection(UPLOADS_COLLECTION) as Query;
  if (opts.orgId) q = q.where("orgId", "==", opts.orgId);
  const snap = await q
    .orderBy("startedAt", "desc")
    .limit(Math.min(opts.limit ?? 50, 200))
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UploadRow, "id">) }));
}

export interface QueryLogEntry {
  orgId: string;
  uid: string;
  role: string;
  question: string;
  pillar: PillarKey | null;
  answered: boolean;
  hitCount: number;
  model: string;
  provider: string;
  latencyMs: number;
  error?: string;
}

export async function logQuery(db: Firestore, entry: QueryLogEntry): Promise<void> {
  await db
    .collection(QUERIES_COLLECTION)
    .doc()
    .set({ ...entry, askedAt: new Date().toISOString(), createdAt: FieldValue.serverTimestamp() });
}
