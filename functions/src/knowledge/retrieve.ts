// Retrieval: Firestore KNN (findNearest) over one client's current chunks.
// The orgId filter is applied inside the vector query, so another client's
// chunks are never candidates.

import type { Firestore } from "firebase-admin/firestore";
import type { Embedder } from "./embedder";
import { CHUNKS_COLLECTION, type ChunkKind, type PillarKey } from "./types";

export interface SearchHit {
  id: string;
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

export async function searchKnowledge(db: Firestore, embedder: Embedder, opts: SearchOptions): Promise<SearchHit[]> {
  if (!opts.orgId) throw new Error("orgId is required");
  const [queryVector] = await embedder.embed([opts.query]);
  let q = db.collection(CHUNKS_COLLECTION).where("orgId", "==", opts.orgId).where("status", "==", "current");
  if (opts.pillar) q = q.where("pillar", "==", opts.pillar);
  const snap = await q
    .findNearest({
      vectorField: "embedding",
      queryVector,
      limit: Math.min(opts.limit ?? 8, 50),
      distanceMeasure: "COSINE",
      distanceResultField: "distance",
    })
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    distance: d.get("distance") as number,
    kind: d.get("kind") as ChunkKind,
    pillar: d.get("pillar") as PillarKey,
    sessionDate: d.get("sessionDate") as string,
    sessionName: d.get("sessionName") as string,
    text: d.get("text") as string,
    topicArea: d.get("topicArea") as string | undefined,
    agreedStatus: d.get("agreedStatus") as string | undefined,
  }));
}
