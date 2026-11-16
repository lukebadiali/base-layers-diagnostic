// Embeddings: OpenAI text-embedding-3-small, 1536 dimensions (Hugh's pick,
// 12 Nov 2026). Firestore vector fields allow up to 2048.

import { openaiPost, type OpenAIConfig } from "./openai";
import { EMBEDDING_DIMENSIONS } from "./types";

export interface Embedder {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH = 100;

export function openaiEmbedder(cfg: OpenAIConfig, model = DEFAULT_EMBEDDING_MODEL): Embedder {
  return {
    model,
    dimensions: EMBEDDING_DIMENSIONS,
    async embed(texts) {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += BATCH) {
        const input = texts.slice(i, i + BATCH);
        const res = await openaiPost<{ data: Array<{ index: number; embedding: number[] }> }>(cfg, "/embeddings", {
          model,
          input,
          dimensions: EMBEDDING_DIMENSIONS,
        });
        const sorted = [...res.data].sort((a, b) => a.index - b.index);
        if (sorted.length !== input.length) throw new Error("OpenAI returned the wrong number of embeddings");
        for (const d of sorted) {
          if (d.embedding.length !== EMBEDDING_DIMENSIONS) throw new Error(`Embedding has ${d.embedding.length} dimensions`);
          out.push(d.embedding);
        }
      }
      return out;
    },
  };
}
