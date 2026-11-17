// Runs the Client Knowledge Agent evaluation end to end against the Firestore
// emulator with the real models:
//   1. builds the .docx forms from eval/data/specs (tools/fill_form.py + Luke's template)
//   2. uploads all 100 forms, then the 5 later v2 forms, through handleIngest (staff path)
//   3. asks every case in eval/data/cases.json through handleAsk as that client
//   4. grades each answer with Claude Haiku 5.5 against the form it came from,
//      plus a deterministic check that no other client's name appears
//   5. writes eval/out/report.json and eval/out/report.md
// Skipped unless KNOWLEDGE_EVAL=1.
//
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-knowledge-eval KNOWLEDGE_EVAL=1 \
//   OPENAI_API_KEY=... OPENROUTER_API_KEY=... ANTHROPIC_API_KEY=... \
//   npx vitest run test/knowledge/eval/run.eval.test.ts

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod/v4";
import { describe, expect, it } from "vitest";
import { openrouterAnswerer } from "../../../src/knowledge/answer";
import { openrouterDescriber } from "../../../src/knowledge/describer";
import { openaiEmbedder } from "../../../src/knowledge/embedder";
import { handleAsk, handleIngest, type HandlerDeps } from "../../../src/knowledge/handlers";
import { orgCoverage } from "../../../src/knowledge/store";
import { EVAL_CLIENTS, PILLAR_NAMES, V2_FORMS } from "./clients";
import type { EvalCase } from "./generate.eval.test";

const RUN = process.env.KNOWLEDGE_EVAL === "1";
const GRADER = "claude-haiku-5-5";
const HERE = __dirname;
const SPECS = join(HERE, "data", "specs");
const OUT = join(HERE, "out");
const FORMS = join(OUT, "forms");
const TEMPLATE = join(HERE, "..", "fixtures", "pillar-1-template.docx");
const FILLER = join(HERE, "..", "tools", "fill_form.py");
const orgId = (client: string) => `eval-${client}`;

const Grade = z.object({
  verdict: z.enum(["correct", "partial", "incorrect", "declined"]),
  missingFacts: z.array(z.string()),
  presentsOldPositionAsCurrent: z.boolean(),
  unsupportedClaims: z.array(z.string()),
  note: z.string(),
});
type Grade = z.infer<typeof Grade>;

interface Result extends EvalCase {
  answer: string;
  answered: boolean;
  hitCount: number;
  latencyMs: number;
  provider: string;
  error?: string;
  grade?: Grade;
  leakedClients: string[];
  pass: boolean;
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

function formSource(client: string, pillar: string | null, v2: boolean): string {
  if (!pillar) return "(no form: this question is not covered by any session)";
  const read = (f: string) => readFileSync(join(SPECS, f), "utf8");
  const v1 = read(`${client}__p${pillar}.content.json`);
  return v2 ? `EARLIER form (superseded):\n${v1}\n\nCURRENT form:\n${read(`${client}__p${pillar}__v2.content.json`)}` : v1;
}

function graderPrompt(c: EvalCase, answer: string, source: string): string {
  return [
    "You grade an AI assistant's answer to a client's question about their consulting sessions. Be strict and literal.",
    `Question: ${c.question}`,
    `Expected facts (a correct answer contains each, paraphrase is fine): ${c.expectedFacts.length ? JSON.stringify(c.expectedFacts) : "(none: the question is not covered, so the right answer says it has not been covered)"}`,
    `Old positions that must NOT be presented as current (mentioning them as earlier or replaced is fine): ${JSON.stringify(c.forbiddenFacts)}`,
    `Source form(s) the answer should be based on:\n${source}`,
    `Answer to grade:\n${answer}`,
    "verdict: correct = every expected fact present and nothing contradicts the source; partial = some expected facts present, none contradicted; incorrect = expected facts missing or contradicted, or an old position given as current; declined = the answer says the topic is not covered.",
    "missingFacts: expected facts not in the answer. unsupportedClaims: specific claims (names, numbers, decisions) in the answer that are not in the source form(s). note: one sentence.",
  ].join("\n\n");
}

describe.skipIf(!RUN)("knowledge eval: run", () => {
  it("uploads 105 forms, asks every case and grades the answers", async () => {
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
        results.push({ ...c, answer: r.answer, answered: r.answered, hitCount: r.hitCount, latencyMs: Date.now() - t0, provider: r.provider, leakedClients: [], pass: false });
      } catch (e) {
        results.push({ ...c, answer: "", answered: false, hitCount: 0, latencyMs: Date.now() - t0, provider: "", error: e instanceof Error ? e.message : String(e), leakedClients: [], pass: false });
      }
    });

    // 5. Grade.
    const anthropic = new Anthropic();
    const v2Pairs = new Set(V2_FORMS.map((v) => `${v.client}__${v.pillar}`));
    await pool(results, 6, async (r) => {
      const others = EVAL_CLIENTS.filter((c) => c.id !== r.client);
      r.leakedClients = others.filter((c) => r.answer.includes(c.name.split(" ")[0])).map((c) => c.name);
      if (r.error) return;
      const source = formSource(r.client, r.pillar, r.pillar !== null && v2Pairs.has(`${r.client}__${r.pillar}`));
      for (let attempt = 1; attempt <= 3 && !r.grade; attempt++) {
        const res = await anthropic.messages.parse({
          model: GRADER,
          max_tokens: 4000,
          messages: [{ role: "user", content: graderPrompt(r, r.answer, source) }],
          output_config: { format: zodOutputFormat(Grade) },
        });
        if (res.stop_reason !== "refusal" && res.parsed_output) r.grade = res.parsed_output;
      }
      const g = r.grade;
      if (!g) return;
      r.pass =
        r.leakedClients.length === 0 &&
        (r.kind === "out_of_scope"
          ? g.verdict === "declined" && !r.answered
          : g.verdict === "correct" && !g.presentsOldPositionAsCurrent);
    });

    // 6. Report.
    results.sort((a, b) => a.id.localeCompare(b.id));
    const rate = (rs: Result[]) => (rs.length ? Math.round((100 * rs.filter((r) => r.pass).length) / rs.length) : 0);
    const kinds = ["fact", "who", "latest", "out_of_scope"] as const;
    const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] ?? 0;
    const ingestMs = ingestLog.filter((l) => l.ok).map((l) => l.ms);
    const askMs = results.filter((r) => !r.error).map((r) => r.latencyMs);
    const summary = {
      cases: results.length,
      passRate: rate(results),
      byKind: Object.fromEntries(kinds.map((k) => [k, { n: results.filter((r) => r.kind === k).length, pass: rate(results.filter((r) => r.kind === k)) }])),
      byPillar: Object.fromEntries(
        Object.keys(PILLAR_NAMES).map((p) => [p, { n: results.filter((r) => r.pillar === p).length, pass: rate(results.filter((r) => r.pillar === p)) }]),
      ),
      verdicts: Object.fromEntries(["correct", "partial", "incorrect", "declined"].map((v) => [v, results.filter((r) => r.grade?.verdict === v).length])),
      ungraded: results.filter((r) => !r.grade).length,
      errors: results.filter((r) => r.error).length,
      leaks: results.filter((r) => r.leakedClients.length).length,
      unsupportedClaims: results.filter((r) => r.grade?.unsupportedClaims.length).length,
      oldPositionAsCurrent: results.filter((r) => r.grade?.presentsOldPositionAsCurrent).length,
      answeredFlagWrongOnCovered: results.filter((r) => r.kind !== "out_of_scope" && !r.answered).length,
      answeredFlagWrongOnOutOfScope: results.filter((r) => r.kind === "out_of_scope" && r.answered).length,
      uploads: { total: ingestLog.length, failed: ingestLog.filter((l) => !l.ok).length, p50ms: pct(ingestMs, 50), p90ms: pct(ingestMs, 90), maxMs: Math.max(0, ...ingestMs) },
      asks: { p50ms: pct(askMs, 50), p90ms: pct(askMs, 90), maxMs: Math.max(0, ...askMs) },
      coverage,
    };
    writeFileSync(join(OUT, "report.json"), JSON.stringify({ summary, ingestLog, results }, null, 2));

    const failures = results.filter((r) => !r.pass);
    const md = [
      `# Client Knowledge Agent evaluation`,
      ``,
      `${summary.cases} questions over 10 fictional clients x 10 pillars (+5 later forms). Pass rate **${summary.passRate}%**.`,
      ``,
      `| Kind | Questions | Pass |`,
      `|---|---|---|`,
      ...kinds.map((k) => `| ${k} | ${summary.byKind[k].n} | ${summary.byKind[k].pass}% |`),
      ``,
      `| Pillar | Questions | Pass |`,
      `|---|---|---|`,
      ...Object.entries(summary.byPillar).map(([p, v]) => `| ${p}. ${PILLAR_NAMES[p as keyof typeof PILLAR_NAMES]} | ${v.n} | ${v.pass}% |`),
      ``,
      `Verdicts: ${JSON.stringify(summary.verdicts)}; ungraded ${summary.ungraded}; errors ${summary.errors}.`,
      `Cross-client leaks: ${summary.leaks}. Answers with unsupported claims: ${summary.unsupportedClaims}. Old position given as current: ${summary.oldPositionAsCurrent}.`,
      `Answered flag wrong: ${summary.answeredFlagWrongOnCovered} covered questions marked unanswered; ${summary.answeredFlagWrongOnOutOfScope} out-of-scope questions marked answered.`,
      `Uploads: ${summary.uploads.total} (${summary.uploads.failed} failed), p50 ${Math.round(summary.uploads.p50ms / 1000)}s, p90 ${Math.round(summary.uploads.p90ms / 1000)}s, max ${Math.round(summary.uploads.maxMs / 1000)}s.`,
      `Questions: p50 ${(summary.asks.p50ms / 1000).toFixed(1)}s, p90 ${(summary.asks.p90ms / 1000).toFixed(1)}s.`,
      `Live pillars per client: ${JSON.stringify(summary.coverage)}.`,
      ``,
      `## Failures (${failures.length})`,
      ``,
      ...failures.map(
        (r) =>
          `### ${r.id} (${r.kind})\n**Q:** ${r.question}\n\n**Expected:** ${r.expectedFacts.join("; ") || "(decline)"}${r.forbiddenFacts.length ? `\n\n**Must not be current:** ${r.forbiddenFacts.join("; ")}` : ""}\n\n**Answer:** ${r.error ? `ERROR ${r.error}` : r.answer}\n\n**Grade:** ${r.grade ? `${r.grade.verdict}. ${r.grade.note}${r.grade.missingFacts.length ? ` Missing: ${r.grade.missingFacts.join("; ")}.` : ""}${r.grade.unsupportedClaims.length ? ` Unsupported: ${r.grade.unsupportedClaims.join("; ")}.` : ""}` : "ungraded"}${r.leakedClients.length ? ` LEAK: ${r.leakedClients.join(", ")}` : ""}\n`,
      ),
    ].join("\n");
    writeFileSync(join(OUT, "report.md"), md);
    console.log(JSON.stringify(summary, null, 2));
    expect(summary.uploads.failed).toBe(0);
  }, 7_200_000);
});
