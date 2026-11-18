// Grades and reports an evaluation run. Reads eval/out/results.json (from
// run.eval.test.ts) and eval/out/grades.json, a map of case id -> Grade.
// Grades come from Claude: sub-agents in a Claude Code session (Hugh's
// allowance, 17 Nov 2026; see GRADING.md), or, for any id missing from grades.json when
// ANTHROPIC_API_KEY is set, Claude Haiku 5.5 via the API. A deterministic check
// that no other client's name appears runs regardless. Writes report.json and
// report.md. Skipped unless KNOWLEDGE_EVAL_REPORT=1.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { describe, expect, it } from "vitest";
import { EVAL_CLIENTS, PILLAR_NAMES, V2_FORMS } from "./clients";
import type { EvalCase } from "./generate.eval.test";
import type { Result } from "./run.eval.test";

const RUN = process.env.KNOWLEDGE_EVAL_REPORT === "1";
const HERE = __dirname;
const SPECS = join(HERE, "data", "specs");
const OUT = join(HERE, "out");

export const Grade = z.object({
  verdict: z.enum(["correct", "partial", "incorrect", "declined"]),
  missingFacts: z.array(z.string()),
  presentsOldPositionAsCurrent: z.boolean(),
  unsupportedClaims: z.array(z.string()),
  note: z.string(),
});
export type Grade = z.infer<typeof Grade>;

/** The form a question was written from: the v2 form for "latest" cases, else v1. Null when not covered. */
export function primaryForm(c: Pick<EvalCase, "client" | "pillar" | "kind">, v2: boolean): string | null {
  if (!c.pillar) return null;
  return `${c.client}__p${c.pillar}${c.kind === "latest" && v2 ? "__v2" : ""}`;
}

const ymd = (d: string) => d.split("/").reverse().join("-");

/** All of a client's forms in date order, each labelled by pillar, session and date, with the attendees line. Mirrors build_grade_batches.py. */
export function formSource(client: string, primary: string | null): string {
  const forms = readdirSync(SPECS)
    .filter((f) => f.startsWith(`${client}__p`) && f.endsWith(".content.json"))
    .map((f) => {
      const stem = f.slice(0, -".content.json".length);
      const spec = JSON.parse(readFileSync(join(SPECS, `${stem}.json`), "utf8")) as Record<string, unknown>;
      const s = (k: string) => (typeof spec[k] === "string" ? (spec[k] as string) : "");
      const label = `${s("0,0,1")}; ${s("0,3,1")}; ${s("0,2,1")}${stem.endsWith("__v2") ? "; later form (v2)" : ""}`;
      const head = `Session date: ${s("0,2,1")}\nAttendees: ${s("0,4,1").replace(/\n/g, "; ")}`;
      return { key: `${ymd(s("0,2,1"))} ${stem}`, text: `=== FORM ${stem} (${label})${stem === primary ? " [PRIMARY]" : ""} ===\n${head}\n${readFileSync(join(SPECS, f), "utf8")}` };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  return [`Primary form: ${primary ?? "(none: this question is not covered by any session)"}`, ...forms.map((f) => f.text)].join("\n\n");
}

export const GRADING_RULES = [
  "You grade an AI assistant's answer to a client's question about their consulting sessions. Be strict and literal.",
  "You are given ALL of this client's session forms, in date order, each labelled by pillar, session and date. The expected facts come from the PRIMARY form, the one the question was written from. Use the other forms to check claims and later changes.",
  "Later sessions: if the answer gives a different position from a LATER-dated form on the same topic and correctly presents it as the current one, count that expected fact as satisfied. Ideally the answer notes the change; when the question asks for a figure that changed, omitting the earlier figure makes it partial, not incorrect. Giving an EARLIER position as current when a later form changed it is wrong.",
  "verdict: correct = every expected fact present (paraphrase fine, or superseded by a later form as above) and nothing contradicts the forms; partial = some expected facts present, none contradicted; incorrect = expected facts missing or contradicted, or an old or superseded position given as current; declined = the answer says the topic is not covered.",
  "presentsOldPositionAsCurrent: true if any 'old position', or any position a later form changed, is given as the current position (mentioning it as earlier or replaced is fine).",
  "missingFacts: expected facts not in the answer and not superseded by a later form the answer uses. unsupportedClaims: specific claims (names, numbers, decisions) that appear in NONE of the client's forms; the session date and attendees lines count as source. Prefix an agreed-status error (an item called agreed, not agreed, pending or rejected when the form says otherwise) with 'STATUS: '. Saying a NOT AGREED item was not agreed or rejected is correct, not an error. note: one sentence.",
].join("\n");

function graderPrompt(c: EvalCase, answer: string, source: string): string {
  return [
    GRADING_RULES,
    `Question: ${c.question}`,
    `Expected facts: ${c.expectedFacts.length ? JSON.stringify(c.expectedFacts) : "(none: not covered, so the right answer says it has not been covered)"}`,
    `Old positions: ${JSON.stringify(c.forbiddenFacts)}`,
    `Client's forms:\n${source}`,
    `Answer to grade:\n${answer}`,
  ].join("\n\n");
}

interface Graded extends Result {
  grade?: Grade;
  superseded?: boolean;
  leakedClients: string[];
  pass: boolean;
}

describe.skipIf(!RUN)("knowledge eval: grade and report", () => {
  it("writes report.md", async () => {
    const raw = JSON.parse(readFileSync(join(OUT, "results.json"), "utf8")) as {
      ingestLog: Array<{ file: string; ms: number; ok: boolean; error?: string }>;
      coverage: Record<string, number>;
      results: Result[];
    };
    const gradesFile = join(OUT, "grades.json");
    const grades: Record<string, Grade> = existsSync(gradesFile) ? JSON.parse(readFileSync(gradesFile, "utf8")) : {};
    const v2Pairs = new Set(V2_FORMS.map((v) => `${v.client}__${v.pillar}`));
    let api: Anthropic | undefined;

    const results: Graded[] = [];
    for (const r of raw.results) {
      const others = EVAL_CLIENTS.filter((c) => c.id !== r.client);
      const g: Graded = { ...r, leakedClients: others.filter((c) => r.answer.includes(c.name.split(" ")[0])).map((c) => c.name), pass: false };
      if (grades[r.id]) g.grade = Grade.parse(grades[r.id]);
      else if (!r.error && process.env.ANTHROPIC_API_KEY) {
        api ??= new Anthropic();
        const res = await api.messages.parse({
          model: "claude-haiku-5-5",
          max_tokens: 4000,
          messages: [{ role: "user", content: graderPrompt(r, r.answer, formSource(r.client, primaryForm(r, v2Pairs.has(`${r.client}__${r.pillar}`)))) }],
          output_config: { format: zodOutputFormat(Grade) },
        });
        if (res.stop_reason !== "refusal" && res.parsed_output) g.grade = res.parsed_output;
      }
      // A fact question on a pillar that later got a v2 form asks about the
      // superseded form; the agent rightly answers with the current one. Those
      // are reported, not scored (the "latest" cases test that behaviour).
      g.superseded = g.kind === "fact" && g.pillar !== null && v2Pairs.has(`${g.client}__${g.pillar}`);
      g.pass =
        !!g.grade &&
        g.leakedClients.length === 0 &&
        (g.kind === "out_of_scope"
          ? g.grade.verdict === "declined" && !g.answered
          : g.grade.verdict === "correct" && !g.grade.presentsOldPositionAsCurrent);
      results.push(g);
    }

    results.sort((a, b) => a.id.localeCompare(b.id));
    const all = results;
    const scored = results.filter((r) => !r.superseded);
    const rate = (rs: Graded[]) => (rs.length ? Math.round((100 * rs.filter((r) => r.pass).length) / rs.length) : 0);
    const kinds = ["fact", "who", "latest", "out_of_scope"] as const;
    const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] ?? 0;
    const ingestMs = raw.ingestLog.filter((l) => l.ok).map((l) => l.ms);
    const askMs = all.filter((r) => !r.error).map((r) => r.latencyMs);
    const summary = {
      cases: scored.length,
      excludedSuperseded: all.length - scored.length,
      passRate: rate(scored),
      byKind: Object.fromEntries(kinds.map((k) => [k, { n: scored.filter((r) => r.kind === k).length, pass: rate(scored.filter((r) => r.kind === k)) }])),
      byPillar: Object.fromEntries(
        Object.keys(PILLAR_NAMES).map((p) => [p, { n: scored.filter((r) => r.pillar === p).length, pass: rate(scored.filter((r) => r.pillar === p)) }]),
      ),
      byClient: Object.fromEntries(EVAL_CLIENTS.map((c) => [c.name, rate(scored.filter((r) => r.client === c.id))])),
      verdicts: Object.fromEntries(["correct", "partial", "incorrect", "declined"].map((v) => [v, scored.filter((r) => r.grade?.verdict === v).length])),
      ungraded: scored.filter((r) => !r.grade).length,
      errors: scored.filter((r) => r.error).length,
      leaks: scored.filter((r) => r.leakedClients.length).length,
      unsupportedClaims: scored.filter((r) => r.grade?.unsupportedClaims.length).length,
      oldPositionAsCurrent: scored.filter((r) => r.grade?.presentsOldPositionAsCurrent).length,
      answeredFlagWrongOnCovered: scored.filter((r) => r.kind !== "out_of_scope" && !r.answered).length,
      answeredFlagWrongOnOutOfScope: scored.filter((r) => r.kind === "out_of_scope" && r.answered).length,
      uploads: { total: raw.ingestLog.length, failed: raw.ingestLog.filter((l) => !l.ok).length, p50ms: pct(ingestMs, 50), p90ms: pct(ingestMs, 90), maxMs: Math.max(0, ...ingestMs) },
      asks: { p50ms: pct(askMs, 50), p90ms: pct(askMs, 90), maxMs: Math.max(0, ...askMs) },
      coverage: raw.coverage,
    };
    writeFileSync(join(OUT, "report.json"), JSON.stringify({ summary, results: all }, null, 2));

    const failures = scored.filter((r) => !r.pass);
    const md = [
      `# Client Knowledge Agent evaluation`,
      ``,
      `${summary.cases} scored questions over 10 fictional PE and consultancy clients x 10 pillars (+5 later forms); ${summary.excludedSuperseded} fact questions about superseded forms reported but not scored. Pass rate **${summary.passRate}%**.`,
      ``,
      `| Kind | Questions | Pass |`,
      `|---|---|---|`,
      ...kinds.map((k) => `| ${k} | ${summary.byKind[k].n} | ${summary.byKind[k].pass}% |`),
      ``,
      `| Pillar | Questions | Pass |`,
      `|---|---|---|`,
      ...Object.entries(summary.byPillar).map(([p, v]) => `| ${p}. ${PILLAR_NAMES[p as keyof typeof PILLAR_NAMES]} | ${v.n} | ${v.pass}% |`),
      ``,
      `By client: ${Object.entries(summary.byClient).map(([n, v]) => `${n} ${v}%`).join("; ")}.`,
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
    expect(summary.ungraded).toBe(0);
  }, 3_600_000);
});
