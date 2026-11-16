// Ask pipeline: question -> retrieve from one client's current knowledge ->
// short answer. Retrieval is filtered by orgId inside the vector query
// (retrieve.ts), so another client's material is never a candidate.

import type { Firestore } from "firebase-admin/firestore";
import type { AnswerFormat, Answerer } from "./answer";
import type { Embedder } from "./embedder";
import { searchKnowledge } from "./retrieve";
import { coveredPillars } from "./store";
import type { PillarKey } from "./types";

export interface AskDeps {
  db: Firestore;
  embedder: Embedder;
  answerer: Answerer;
}

export interface AskInput {
  orgId: string;
  clientName: string;
  question: string;
  pillar?: PillarKey;
  format?: AnswerFormat;
  /** Staff only: return which sessions the answer drew on. Clients do not get sources (27 Oct call). */
  includeSources?: boolean;
}

export interface AskSource {
  pillar: PillarKey;
  sessionName: string;
  sessionDate: string;
}

export interface AskResult {
  answer: string;
  /** False when nothing was retrieved and no model was called. */
  answered: boolean;
  hitCount: number;
  model: string;
  provider: string;
  sources?: AskSource[];
}

export const RETRIEVE_LIMIT = 8;
export const NOTHING_YET =
  "There's no delivered material for this yet. Your BeDeveloped account manager can help in the meantime.";

export async function askKnowledge(deps: AskDeps, input: AskInput): Promise<AskResult> {
  const question = input.question.trim();
  if (!question) throw new Error("question is required");

  const covered = await coveredPillars(deps.db, input.orgId);
  const pillarMissing = input.pillar !== undefined && !covered.includes(input.pillar);
  if (!covered.length || pillarMissing) {
    return { answer: NOTHING_YET, answered: false, hitCount: 0, model: "", provider: "" };
  }

  const hits = await searchKnowledge(deps.db, deps.embedder, {
    orgId: input.orgId,
    query: question,
    pillar: input.pillar,
    limit: RETRIEVE_LIMIT,
  });
  if (!hits.length) {
    return { answer: NOTHING_YET, answered: false, hitCount: 0, model: "", provider: "" };
  }

  const { answer, provider } = await deps.answerer.answer({
    question,
    clientName: input.clientName,
    hits,
    coveredPillars: covered,
    format: input.format ?? "bullets",
  });

  const result: AskResult = { answer, answered: true, hitCount: hits.length, model: deps.answerer.model, provider };
  if (input.includeSources) {
    const seen = new Map<string, AskSource>();
    for (const h of hits) {
      const key = `${h.pillar}|${h.sessionDate}|${h.sessionName}`;
      if (!seen.has(key)) seen.set(key, { pillar: h.pillar, sessionName: h.sessionName, sessionDate: h.sessionDate });
    }
    result.sources = [...seen.values()];
  }
  return result;
}
