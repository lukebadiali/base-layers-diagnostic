// Runs the Client Knowledge Agent evaluation end to end against the Firestore
// emulator with the real models:
//   1. builds the .docx forms from eval/data/specs (tools/fill_form.py + Luke's template)
//   2. uploads all 100 forms, then the 5 later v2 forms, through handleIngest (staff path)
//   3. asks every case in eval/data/cases.json through handleAsk as that client
//   4. saves eval/out/results.json; grading and the report are report.eval.test.ts
// Skipped unless KNOWLEDGE_EVAL=1. KNOWLEDGE_EVAL_REUSE=1 skips building and
// uploading (the forms are already in the emulator) and re-asks every case,
// keeping the upload timings from the previous results.json.
// Opt-in filters for diagnosis runs (unset = the full run):
//   KNOWLEDGE_EVAL_CLIENTS=fernhill,calder  only these clients' forms and cases
//   KNOWLEDGE_EVAL_ONLY=-p1-                regex on case id
//   KNOWLEDGE_EVAL_OUT=results.x.json       results file in out/ (default results.json)
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-knowledge-eval KNOWLEDGE_EVAL=1 \
//   OPENAI_API_KEY=... OPENROUTER_API_KEY=... ANTHROPIC_API_KEY=... \
//   npx vitest run test/knowledge/eval/run.eval.test.ts

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { openrouterAnswerer } from "../../../src/knowledge/answer";
import { openrouterDescriber } from "../../../src/knowledge/describer";
import { openaiEmbedder } from "../../../src/knowledge/embedder";
import { handleAsk, handleIngest, type HandlerDeps } from "../../../src/knowledge/handlers";
import { RETRIEVE_LIMIT } from "../../../src/knowledge/ask";
import { searchKnowledge } from "../../../src/knowledge/retrieve";
import { orgCoverage } from "../../../src/knowledge/store";
import { EVAL_CLIENTS } from "./clients";
import type { EvalCase } from "./generate.eval.test";

const RUN = process.env.KNOWLEDGE_EVAL === "1";
const HERE = __dirname;
const SPECS = join(HERE, "data", "specs");
const OUT = join(HERE, "out");
const FORMS = join(OUT, "forms");
const TEMPLATE = join(HERE, "..", "fixtures", "pillar-1-template.docx");
const FILLER = join(HERE, "..", "tools", "fill_form.py");
const orgId = (client: string) => `eval-${client}`;
const ONLY_CLIENTS = (process.env.KNOWLEDGE_EVAL_CLIENTS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const ONLY_CASES = process.env.KNOWLEDGE_EVAL_ONLY ? new RegExp(process.env.KNOWLEDGE_EVAL_ONLY) : null;
const OUT_FILE = process.env.KNOWLEDGE_EVAL_OUT || "results.json";
const wantClient = (client: string) => !ONLY_CLIENTS.length || ONLY_CLIENTS.includes(client);

/** What retrieval handed the answerer, so a miss can be traced to the chunks that won. */
export interface RetrievedChunk {
  id: string;
  kind: string;
  pillar: string;
  sessionDate: string;
  topicArea?: string;
  distance: number;
  textHead: string;
}

export interface Result extends EvalCase {
  answer: string;
  answered: boolean;
  hitCount: number;
  latencyMs: number;
  provider: string;
  retrieved?: RetrievedChunk[];
  error?: string;
}

async function pool<T>(items: T[], size: number, fn: (t: T, i: number) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

describe.skipIf(!RUN)("knowledge eval: run", () => {
  it("uploads 105 forms and asks every case", async () => {
    const cases = (JSON.parse(readFileSync(join(HERE, "data", "cases.json"), "utf8")) as EvalCase[]).filter(
      (c) => wantClient(c.client) && (!ONLY_CASES || ONLY_CASES.test(c.id)),
    );
    const clients = EVAL_CLIENTS.filter((c) => wantClient(c.id));
    mkdirSync(FORMS, { recursive: true });

    const reuse = process.env.KNOWLEDGE_EVAL_REUSE === "1";
    // 1. Build the forms.
    const allSpecs = readdirSync(SPECS).filter((f) => f.endsWith(".json") && !f.endsWith(".content.json"));
    const specs = allSpecs.filter((f) => wantClient(f.split("__")[0]));
    for (const f of reuse ? [] : specs) {
      execFileSync("python3", ["-I", FILLER, TEMPLATE, join(SPECS, f), join(FORMS, f.replace(/\.json$/, ".docx"))]);
    }
    expect(allSpecs).toHaveLength(105);

    const app = getApps()[0] ?? initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-knowledge-eval" });
    const db = getFirestore(app);
    const deps: HandlerDeps = {
      db,
      describer: openrouterDescriber({ apiKey: process.env.OPENROUTER_API_KEY ?? "" }),
      embedder: openaiEmbedder({ apiKey: process.env.OPENAI_API_KEY ?? "" }),
      answerer: openrouterAnswerer({ apiKey: process.env.OPENROUTER_API_KEY ?? "" }),
      clientAccess: true,
    };
    if (!reuse) for (const c of clients) await db.collection("orgs").doc(orgId(c.id)).set({ name: c.name });

    // 2. Upload: all v1 forms, then the later v2 forms on top.
    const admin = { uid: "eval-admin", role: "admin" };
    const ingestLog: Array<{ file: string; ms: number; ok: boolean; error?: string; chunks?: number }> = reuse
      ? JSON.parse(readFileSync(join(OUT, OUT_FILE), "utf8")).ingestLog
      : [];
    const upload = async (file: string) => {
      const client = file.split("__")[0];
      const t0 = Date.now();
      try {
        const fileBase64 = readFileSync(join(FORMS, file)).toString("base64");
        const r = await handleIngest(deps, admin, { orgId: orgId(client), fileName: file, fileBase64 });
        ingestLog.push({ file, ms: Date.now() - t0, ok: true, chunks: r.chunks });
      } catch (e) {
        ingestLog.push({ file, ms: Date.now() - t0, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    };
    const docx = readdirSync(FORMS).filter((f) => f.endsWith(".docx") && wantClient(f.split("__")[0]));
    if (!reuse) {
      await pool(docx.filter((f) => !f.includes("__v2")), 4, (f) => upload(f));
      await pool(docx.filter((f) => f.includes("__v2")), 4, (f) => upload(f));
    }

    // 3. Coverage: every client has all 10 pillars live.
    const coverage: Record<string, number> = {};
    for (const c of clients) coverage[c.id] = (await orgCoverage(db, orgId(c.id))).pillars.filter((p) => p.status === "current").length;

    // 4. Ask every case as that client.
    const results: Result[] = [];
    await pool(cases, 6, async (c) => {
      const caller = { uid: `eval-client-${c.client}`, role: "client", orgId: orgId(c.client) };
      const t0 = Date.now();
      try {
        const r = await handleAsk(deps, caller, { question: c.question });
        const latencyMs = Date.now() - t0;
        // Same query and limit as askKnowledge, outside the timing; production return shapes stay as they are.
        const hits = await searchKnowledge(db, deps.embedder, { orgId: orgId(c.client), query: c.question, limit: RETRIEVE_LIMIT });
        const retrieved = hits.map((h) => ({
          id: h.id,
          kind: h.kind,
          pillar: h.pillar,
          sessionDate: h.sessionDate,
          topicArea: h.topicArea,
          distance: Number(h.distance.toFixed(4)),
          textHead: h.text.split("\n").slice(1).join(" ").trim().slice(0, 120),
        }));
        results.push({ ...c, answer: r.answer, answered: r.answered, hitCount: r.hitCount, latencyMs, provider: r.provider, retrieved });
      } catch (e) {
        results.push({ ...c, answer: "", answered: false, hitCount: 0, latencyMs: Date.now() - t0, provider: "", error: e instanceof Error ? e.message : String(e) });
      }
    });

    // 5. Save raw results for grading (report.eval.test.ts).
    writeFileSync(join(OUT, OUT_FILE), JSON.stringify({ ingestLog, coverage, results }, null, 2));
    console.log(`${results.length} answers saved; ${ingestLog.filter((l) => !l.ok).length} uploads failed`);
    expect(ingestLog.filter((l) => !l.ok)).toEqual([]);
  }, 7_200_000);
});
