// Ask pipeline: question -> retrieve from one client's current knowledge ->
// short answer. Retrieval is filtered by orgId inside the vector query
// (retrieve.ts), so another client's material is never a candidate.

import type { Firestore } from "firebase-admin/firestore";
import type { AnswerFormat, Answerer } from "./answer";
import type { Embedder } from "./embedder";
import { rerankByKeywords, searchKnowledge, type SearchHit } from "./retrieve";
import { coveredPillars, orgsWithKnowledge } from "./store";
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
  /** Cross-client staff questions only: which client this session belongs to. */
  clientName?: string;
  pillar: PillarKey;
  sessionName: string;
  sessionDate: string;
}

export interface AskResult {
  answer: string;
  /** False when nothing was retrieved, or the model found the excerpts did not answer the question. */
  answered: boolean;
  hitCount: number;
  model: string;
  provider: string;
  sources?: AskSource[];
}

/** 8 let overview chunks crowd out specific rows (eval, 17 Nov 2026). */
export const RETRIEVE_LIMIT = 12;
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

  const { answer, answered, provider } = await deps.answerer.answer({
    question,
    clientName: input.clientName,
    hits,
    coveredPillars: covered,
    format: input.format ?? "bullets",
  });

  const result: AskResult = { answer, answered, hitCount: hits.length, model: deps.answerer.model, provider };
  if (input.includeSources && answered) {
    const seen = new Map<string, AskSource>();
    for (const h of hits) {
      const key = `${h.pillar}|${h.sessionDate}|${h.sessionName}`;
      if (!seen.has(key)) seen.set(key, { pillar: h.pillar, sessionName: h.sessionName, sessionDate: h.sessionDate });
    }
    result.sources = [...seen.values()];
  }
  return result;
}

/** Per client, then overall, for staff questions across every client. */
export const CROSS_CLIENT_PER_CLIENT = 6;
export const CROSS_CLIENT_LIMIT = 16;

export interface AskAllInput {
  question: string;
  format?: AnswerFormat;
}

/**
 * BeDeveloped staff only (the handler checks the role): one question across
 * every client with live knowledge. Each client is searched on its own, with
 * the same orgId filter and fail-closed check as a single-client question, and
 * every hit is labelled with that client's name from the orgs collection. The
 * model never decides which client material belongs to.
 */
export async function askAcrossClients(deps: AskDeps, input: AskAllInput): Promise<AskResult> {
  const question = input.question.trim();
  if (!question) throw new Error("question is required");
  const orgIds = await orgsWithKnowledge(deps.db);
  if (!orgIds.length) return { answer: NOTHING_YET, answered: false, hitCount: 0, model: "", provider: "" };

  const perClient = await Promise.all(
    orgIds.map(async (orgId): Promise<SearchHit[]> => {
      const org = await deps.db.collection("orgs").doc(orgId).get();
      const name = org.exists ? (org.get("name") as unknown) : undefined;
      // A deleted org's knowledge is archived by knowledgeOnOrgDelete; until that
      // runs, skip it rather than answer under an unknown name.
      if (typeof name !== "string" || !name.trim()) return [];
      const hits = await searchKnowledge(deps.db, deps.embedder, {
        orgId,
        query: question,
        limit: CROSS_CLIENT_PER_CLIENT,
      });
      return hits.map((h) => ({ ...h, clientName: name }));
    }),
  );
  const hits = rerankByKeywords(question, perClient.flat()).slice(0, CROSS_CLIENT_LIMIT);
  if (!hits.length) return { answer: NOTHING_YET, answered: false, hitCount: 0, model: "", provider: "" };

  const { answer, answered, provider } = await deps.answerer.answer({
    question,
    clientName: "all clients",
    hits,
    coveredPillars: [],
    format: input.format ?? "bullets",
    scope: "all",
  });
  const result: AskResult = { answer, answered, hitCount: hits.length, model: deps.answerer.model, provider };
  if (answered) {
    const seen = new Map<string, AskSource>();
    for (const h of hits) {
      const key = `${h.clientName}|${h.pillar}|${h.sessionDate}|${h.sessionName}`;
      if (!seen.has(key)) {
        seen.set(key, {
          clientName: h.clientName,
          pillar: h.pillar,
          sessionName: h.sessionName,
          sessionDate: h.sessionDate,
        });
      }
    }
    result.sources = [...seen.values()];
  }
  return result;
}
