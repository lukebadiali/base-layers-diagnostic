// Retrieval: Firestore KNN (findNearest) over one client's current chunks.
// The orgId filter is applied inside the vector query, so another client's
// chunks are never candidates.
//
// The nearest candidates are then re-ranked with a small keyword bonus. On the
// 17 Nov eval, Pillar 1 rows ("£3m to £15m revenue", "tickets of £15m to
// £40m", "10-week completion commitment") ranked 14th-18th: later sessions
// restate the same strategy in near-identical vectors, so the row that holds
// the agreed figure lost on embedding alone. The question's rarer words
// (revenue, ticket, completion) pick it out again.

import type { Firestore } from "firebase-admin/firestore";
import type { Embedder } from "./embedder";
import { CHUNKS_COLLECTION, type ChunkKind, type PillarKey } from "./types";

export interface SearchHit {
  id: string;
  orgId: string;
  distance: number;
  kind: ChunkKind;
  pillar: PillarKey;
  sessionDate: string;
  sessionName: string;
  text: string;
  topicArea?: string;
  agreedStatus?: string;
}

export interface SearchOptions {
  orgId: string;
  query: string;
  pillar?: PillarKey;
  limit?: number;
}

/** Candidates fetched per hit returned, for the keyword re-rank to choose from. */
const CANDIDATE_FACTOR = 3;
/** Cosine-distance credit for a chunk holding all of the question's terms (IDF-weighted). */
export const KEYWORD_WEIGHT = 0.1;
const STOP = new Set(
  ("a an the and or of to for in on at by with we our us you your did do does is are was were be been what which who " +
    "whom how when where why that this these those it its from as any yet agree agreed decide decided there have has had " +
    "about should will can").split(" "),
);

/** Lower-case word set, stop words out, a plural "s" dropped (tickets ~ ticket). */
export function keywordTerms(s: string): Set<string> {
  const words = s.toLowerCase().match(/[a-z0-9£%][a-z0-9£%.-]*[a-z0-9%]|[a-z0-9]/g) ?? [];
  return new Set(words.filter((w) => !STOP.has(w)).map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)));
}

/**
 * Re-orders candidates by distance minus KEYWORD_WEIGHT x the IDF-weighted
 * share of question terms in the chunk body. IDF is over the candidates, so a
 * word every candidate shares (the client's own jargon) counts for little.
 * The context line is skipped: it names the client and session, not content.
 */
export function rerankByKeywords<T extends { distance: number; text: string }>(query: string, hits: T[]): T[] {
  const q = [...keywordTerms(query)];
  if (!q.length || hits.length < 2) return hits;
  const bodies = hits.map((h) => keywordTerms(h.text.slice(h.text.indexOf("\n") + 1)));
  const idf = q.map((t) => Math.log((hits.length + 1) / (1 + bodies.filter((b) => b.has(t)).length)));
  const total = idf.reduce((a, b) => a + b, 0);
  if (total <= 0) return hits;
  const score = (i: number) => hits[i].distance - (KEYWORD_WEIGHT * q.reduce((a, t, k) => a + (bodies[i].has(t) ? idf[k] : 0), 0)) / total;
  return hits
    .map((h, i) => ({ h, s: score(i) }))
    .sort((a, b) => a.s - b.s)
    .map((x) => x.h);
}

/**
 * Fail closed. The orgId filter is inside the vector query, so this should
 * never fire; if a chunk for any other client ever comes back (an index or
 * query bug), the question is refused rather than answered from it.
 */
export function assertOneClient(orgId: string, hits: Array<{ orgId: string }>): void {
  if (hits.some((h) => h.orgId !== orgId)) {
    throw new Error("Retrieval returned another client's material; refusing to answer.");
  }
}

export async function searchKnowledge(db: Firestore, embedder: Embedder, opts: SearchOptions): Promise<SearchHit[]> {
  if (!opts.orgId) throw new Error("orgId is required");
  const [queryVector] = await embedder.embed([opts.query]);
  let q = db.collection(CHUNKS_COLLECTION).where("orgId", "==", opts.orgId).where("status", "==", "current");
  if (opts.pillar) q = q.where("pillar", "==", opts.pillar);
  const limit = Math.min(opts.limit ?? 8, 50);
  const snap = await q
    .findNearest({
      vectorField: "embedding",
      queryVector,
      limit: Math.min(limit * CANDIDATE_FACTOR, 50),
      distanceMeasure: "COSINE",
      distanceResultField: "distance",
    })
    .get();
  const hits: SearchHit[] = snap.docs.map((d) => ({
    id: d.id,
    orgId: d.get("orgId") as string,
    distance: d.get("distance") as number,
    kind: d.get("kind") as ChunkKind,
    pillar: d.get("pillar") as PillarKey,
    sessionDate: d.get("sessionDate") as string,
    sessionName: d.get("sessionName") as string,
    text: d.get("text") as string,
    topicArea: d.get("topicArea") as string | undefined,
    agreedStatus: d.get("agreedStatus") as string | undefined,
  }));
  assertOneClient(opts.orgId, hits);
  return rerankByKeywords(opts.query, hits).slice(0, limit);
}
