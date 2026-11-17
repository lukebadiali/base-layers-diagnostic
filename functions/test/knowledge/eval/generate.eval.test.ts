// Generates the evaluation set: 10 fictional clients x 10 pillars of Session
// Capture Form content, plus later "v2" forms for five client/pillar pairs,
// and the test questions with the facts a correct answer must contain.
//
// Content per form lives in eval/data/specs/<client>__p<N>[__v2].content.json.
// It was written by Claude (sub-agents in a Claude Code session, on Hugh's
// allowance, 17 Nov 2026); DeepSeek stays the agent under test. When every
// content file exists this script calls no model: it only assembles the cell
// specs and cases.json. A missing file is generated with Claude Haiku 5.5 via
// the API, which needs ANTHROPIC_API_KEY. Skipped unless KNOWLEDGE_EVAL_GENERATE=1.
//
//   cd functions && KNOWLEDGE_EVAL_GENERATE=1 ANTHROPIC_API_KEY=... npx vitest run test/knowledge/eval/generate.eval.test.ts

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { describe, expect, it } from "vitest";
import { EVAL_CLIENTS, PILLAR_NAMES, PILLARS, V2_FORMS, leadFor, topicAreas, type EvalClient } from "./clients";

const RUN = process.env.KNOWLEDGE_EVAL_GENERATE === "1";
const MODEL = "claude-haiku-5-5";
const DATA = join(__dirname, "data");
const SPECS = join(DATA, "specs");

const Agreed = z.enum(["Yes", "No", "Pending"]);
const TestQ = z.object({
  question: z.string(),
  expectedFacts: z.array(z.string()),
});
const FormContent = z.object({
  sessionName: z.string(),
  summary: z.string(),
  discussion: z.array(z.object({ topic: z.string(), keyPoints: z.string() })),
  recommendations: z.array(z.object({ area: z.string(), recommendation: z.string(), agreed: Agreed })),
  actions: z.array(z.object({ action: z.string(), owner: z.string() })),
  nextFocus: z.string(),
  nextPreparation: z.string(),
  tests: z.array(TestQ),
});
type FormContent = z.infer<typeof FormContent>;
const V2Content = FormContent.extend({
  changeTests: z.array(TestQ.extend({ forbiddenFacts: z.array(z.string()) })),
});
type V2Content = z.infer<typeof V2Content>;

export interface EvalCase {
  id: string;
  client: string;
  pillar: string | null;
  kind: "fact" | "who" | "latest" | "out_of_scope";
  question: string;
  expectedFacts: string[];
  forbiddenFacts: string[];
}

function ukDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Pillar N for client i is held in week N of that client's programme. */
export function sessionDate(clientIndex: number, pillar: string, v2 = false): Date {
  const start = addDays(new Date(Date.UTC(2026, 6, 6)), clientIndex * 3); // from 6 Jul 2026
  return addDays(start, (Number(pillar) - 1) * 7 + (v2 ? 84 : 0));
}

export function rules(client: EvalClient, pillar: string, lead: string): string {
  const areas = topicAreas(pillar as never);
  return [
    `You write realistic, fictional consulting session notes for testing software. The consultancy is BeDeveloped (B2B growth advisers). The client is ${client.name}: ${client.profile}`,
    `This session is Pillar ${pillar}: ${PILLAR_NAMES[pillar as keyof typeof PILLAR_NAMES]}. It was led by ${lead} of BeDeveloped with ${client.people.join(" and ")}.`,
    "Write British English, the way a consultant fills in a form: plain, specific, short.",
    "- sessionName: like 'Week 4 - Buyer personas'.",
    "- summary: 2 to 4 sentences.",
    "- discussion: 2 to 4 rows. keyPoints says what was discussed, including what the client said and any concerns.",
    `- recommendations: 3 to 5 rows, each in a DIFFERENT area chosen from exactly: ${areas.join("; ")}. Make each concrete with at least one specific detail (a number, a named segment, a channel, a price point, a date, a role). agreed is Yes, No or Pending, and use at least one Pending or No.`,
    "- actions: 1 or 2 short actions with an owner.",
    "- nextFocus and nextPreparation: one sentence each.",
    "- tests: exactly 3 questions the client might ask an assistant later, in the client's voice ('What did we agree about...?', 'What was the recommendation on...?', 'Is ... agreed yet?'). Each answerable ONLY from this form. expectedFacts: 1 to 3 short phrases (2 to 6 words, copied or closely paraphrased from the form) that a correct answer must contain. Cover different rows; at least one question must be about an agreed status (Pending/No).",
    "Invent all names and details; do not mention real companies.",
  ].join("\n");
}

async function generate<T>(client: Anthropic, schema: z.ZodType<T>, system: string, user: string): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(schema as never) },
    });
    if (res.stop_reason === "refusal") throw new Error(`Refused: ${JSON.stringify(res.stop_details)}`);
    if (res.parsed_output) return res.parsed_output as T;
  }
  throw new Error("No parsable output after 3 attempts");
}

/** Cell map for tools/fill_form.py. Recommendation rows are re-labelled with this pillar's areas. */
export function toSpec(client: EvalClient, pillar: string, lead: string, date: Date, c: FormContent): Record<string, unknown> {
  const areas = topicAreas(pillar as never);
  const name = PILLAR_NAMES[pillar as keyof typeof PILLAR_NAMES];
  const spec: Record<string, unknown> = {
    __replace__: { "Strategy, ICP & Market Positioning": name, "Pillar 1 ": `Pillar ${pillar} ` },
    "0,0,1": `Pillar ${pillar}: ${name}`,
    "0,1,1": client.name,
    "0,2,1": ukDate(date),
    "0,3,1": c.sessionName,
    "0,4,1": [`${lead} (BeDeveloped)`, ...client.people].join("\n"),
    "0,5,1": lead,
    "1,0,1": c.summary,
    "5,0,1": ukDate(addDays(date, 7)),
    "5,1,1": c.nextFocus,
    "5,2,1": c.nextPreparation,
  };
  c.discussion.slice(0, 4).forEach((d, i) => {
    spec[`2,${i + 1},0`] = d.topic;
    spec[`2,${i + 1},1`] = d.keyPoints;
  });
  // Rows 1-8 of the recommendations table: this pillar's areas (up to 8), blanks after.
  const labels = [...areas.slice(0, 7), areas[7] ?? "Other"];
  labels.forEach((label, i) => (spec[`3,${i + 1},0`] = i < areas.length || i === 7 ? label : ""));
  for (const r of c.recommendations) {
    const row = labels.findIndex((l) => l.toLowerCase() === r.area.trim().toLowerCase());
    const target = row >= 0 ? row : 7; // unknown area -> the last row
    spec[`3,${target + 1},1`] = r.recommendation;
    spec[`3,${target + 1},2`] = r.agreed;
  }
  c.actions.slice(0, 5).forEach((a, i) => {
    spec[`4,${i + 1},0`] = a.action;
    spec[`4,${i + 1},1`] = a.owner;
    spec[`4,${i + 1},2`] = ukDate(addDays(date, 10));
  });
  return spec;
}

async function pool<T>(items: T[], size: number, fn: (t: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

describe.skipIf(!RUN)("knowledge eval: generate test forms", () => {
  it("writes 100 forms, 5 v2 forms and the test cases", async () => {
    let anthropicClient: Anthropic | undefined;
    const anthropic = () => (anthropicClient ??= new Anthropic());
    mkdirSync(SPECS, { recursive: true });
    const cases: EvalCase[] = [];
    const jobs = EVAL_CLIENTS.flatMap((c, ci) => PILLARS.map((p) => ({ c, ci, p })));
    const v1: Record<string, FormContent> = {};

    await pool(jobs, 6, async ({ c, ci, p }) => {
      const file = join(SPECS, `${c.id}__p${p}.json`);
      const cache = join(SPECS, `${c.id}__p${p}.content.json`);
      const lead = leadFor(ci, p);
      const content = existsSync(cache)
        ? FormContent.parse(JSON.parse(readFileSync(cache, "utf8")))
        : await generate(anthropic(), FormContent, rules(c, p, lead), "Write the form content now.");
      writeFileSync(cache, JSON.stringify(content, null, 2));
      writeFileSync(file, JSON.stringify(toSpec(c, p, lead, sessionDate(ci, p), content), null, 2));
      v1[`${c.id}__${p}`] = content;
      process.stdout.write(".");
    });

    for (const [ci, c] of EVAL_CLIENTS.entries()) {
      for (const p of PILLARS) {
        const content = v1[`${c.id}__${p}`];
        content.tests.slice(0, 3).forEach((t, i) =>
          cases.push({ id: `${c.id}-p${p}-q${i + 1}`, client: c.id, pillar: p, kind: "fact", question: t.question, expectedFacts: t.expectedFacts, forbiddenFacts: [] }),
        );
      }
      // "Who" questions on two pillars per client: the answer is the session lead.
      for (const p of ["3", "6"] as const) {
        cases.push({
          id: `${c.id}-p${p}-who`,
          client: c.id,
          pillar: p,
          kind: "who",
          question: `Who at BeDeveloped ran our ${PILLAR_NAMES[p].split(" &")[0].toLowerCase()} session?`,
          expectedFacts: [leadFor(ci, p)],
          forbiddenFacts: [],
        });
      }
      // Two questions nothing in any form covers.
      cases.push(
        { id: `${c.id}-oos-1`, client: c.id, pillar: null, kind: "out_of_scope", question: "What should our TikTok advertising budget be next year?", expectedFacts: [], forbiddenFacts: [] },
        { id: `${c.id}-oos-2`, client: c.id, pillar: null, kind: "out_of_scope", question: "What did we decide about moving to a four-day working week?", expectedFacts: [], forbiddenFacts: [] },
      );
    }

    // v2 forms: a later session that changes earlier recommendations.
    for (const { client: id, pillar: p } of V2_FORMS) {
      const ci = EVAL_CLIENTS.findIndex((c) => c.id === id);
      const c = EVAL_CLIENTS[ci];
      const lead = leadFor(ci, p);
      const cache = join(SPECS, `${id}__p${p}__v2.content.json`);
      const content = existsSync(cache)
        ? V2Content.parse(JSON.parse(readFileSync(cache, "utf8")))
        : await generate(
            anthropic(),
            V2Content,
            rules(c, p, lead) +
              "\n\nThis is a LATER follow-up session, 12 weeks after the one below. Change the recommendation in 2 areas to a clearly different position (say what replaced what), keep the others broadly the same. changeTests: exactly 2 questions about the changed positions; expectedFacts are the NEW position, forbiddenFacts are 1 to 2 short phrases from the OLD position that must not be presented as current.",
            `Earlier session form:\n${JSON.stringify(v1[`${id}__${p}`])}`,
          );
      writeFileSync(cache, JSON.stringify(content, null, 2));
      writeFileSync(join(SPECS, `${id}__p${p}__v2.json`), JSON.stringify(toSpec(c, p, lead, sessionDate(ci, p, true), content), null, 2));
      content.changeTests.slice(0, 2).forEach((t, i) =>
        cases.push({ id: `${id}-p${p}-latest${i + 1}`, client: id, pillar: p, kind: "latest", question: t.question, expectedFacts: t.expectedFacts, forbiddenFacts: t.forbiddenFacts }),
      );
    }

    writeFileSync(join(DATA, "cases.json"), JSON.stringify(cases, null, 2));
    console.log(`\n${Object.keys(v1).length} forms, ${V2_FORMS.length} v2 forms, ${cases.length} cases`);
    expect(Object.keys(v1)).toHaveLength(100);
  }, 1_800_000);
});
