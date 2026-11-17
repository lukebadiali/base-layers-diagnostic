// Runs the Client Knowledge Agent evaluation end to end against the Firestore
// emulator with the real models:
//   1. builds the .docx forms from eval/data/specs (tools/fill_form.py + Luke's template)
//   2. uploads all 100 forms, then the 5 later v2 forms, through handleIngest (staff path)
//   3. asks every case in eval/data/cases.json through handleAsk as that client
//   4. saves eval/out/results.json; grading and the report are report.eval.test.ts
// Skipped unless KNOWLEDGE_EVAL=1.
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

export interface Result extends EvalCase {
  answer: string;
  answered: boolean;
  hitCount: number;
  latencyMs: number;
  provider: string;
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
    const cases = JSON.parse(readFileSync(join(HERE, "data", "cases.json"), "utf8")) as EvalCase[];
    mkdirSync(FORMS, { recursive: true });

    // 1. Build the forms.
    const specs = readdirSync(SPECS).filter((f) => f.endsWith(".json") && !f.endsWith(".content.json"));
    for (const f of specs) {
      execFileSync("python3", ["-I", FILLER, TEMPLATE, join(SPECS, f), join(FORMS, f.replace(/\.json$/, ".docx"))]);
    }
    expect(specs).toHaveLength(105);

    const app = getApps()[0] ?? initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-knowledge-eval" });
    const db = getFirestore(app);
    const deps: HandlerDeps = {
      db,
      describer: openrouterDescriber({ apiKey: process.env.OPENROUTER_API_KEY ?? "" }),
      embedder: openaiEmbedder({ apiKey: process.env.OPENAI_API_KEY ?? "" }),
      answerer: openrouterAnswerer({ apiKey: process.env.OPENROUTER_API_KEY ?? "" }),
      clientAccess: true,
    };
    for (const c of EVAL_CLIENTS) await db.collection("orgs").doc(orgId(c.id)).set({ name: c.name });

    // 2. Upload: all v1 forms, then the later v2 forms on top.
    const admin = { uid: "eval-admin", role: "admin" };
    const ingestLog: Array<{ file: string; ms: number; ok: boolean; error?: string; chunks?: number }> = [];
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
    const docx = readdirSync(FORMS).filter((f) => f.endsWith(".docx"));
    await pool(docx.filter((f) => !f.includes("__v2")), 4, (f) => upload(f));
    await pool(docx.filter((f) => f.includes("__v2")), 4, (f) => upload(f));

    // 3. Coverage: every client has all 10 pillars live.
    const coverage: Record<string, number> = {};
    for (const c of EVAL_CLIENTS) coverage[c.id] = (await orgCoverage(db, orgId(c.id))).pillars.filter((p) => p.status === "current").length;

    // 4. Ask every case as that client.
    const results: Result[] = [];
    await pool(cases, 6, async (c) => {
      const caller = { uid: `eval-client-${c.client}`, role: "client", orgId: orgId(c.client) };
      const t0 = Date.now();
      try {
        const r = await handleAsk(deps, caller, { question: c.question });
        results.push({ ...c, answer: r.answer, answered: r.answered, hitCount: r.hitCount, latencyMs: Date.now() - t0, provider: r.provider });
      } catch (e) {
        results.push({ ...c, answer: "", answered: false, hitCount: 0, latencyMs: Date.now() - t0, provider: "", error: e instanceof Error ? e.message : String(e) });
      }
    });

    // 5. Save raw results for grading (report.eval.test.ts).
    writeFileSync(join(OUT, "results.json"), JSON.stringify({ ingestLog, coverage, results }, null, 2));
    console.log(`${results.length} answers saved; ${ingestLog.filter((l) => !l.ok).length} uploads failed`);
    expect(ingestLog.filter((l) => !l.ok)).toEqual([]);
  }, 7_200_000);
});
