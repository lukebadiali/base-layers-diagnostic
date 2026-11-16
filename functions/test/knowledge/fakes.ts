// Test doubles for the knowledge module: an in-memory Firestore covering the
// calls store.ts and retrieve.ts make (including findNearest with cosine
// distance), a lexical hashing embedder, and a deterministic describer.

import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { Describer } from "../../src/knowledge/describer";
import type { Embedder } from "../../src/knowledge/embedder";
import { EMBEDDING_DIMENSIONS, type Description, type ParsedForm } from "../../src/knowledge/types";

type Data = Record<string, unknown>;
type Filter = { field: string; value: unknown };

function toArray(v: unknown): number[] {
  if (v && typeof (v as { toArray?: unknown }).toArray === "function") return (v as { toArray(): number[] }).toArray();
  throw new Error("not a vector");
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export class FakeFirestore {
  readonly collections = new Map<string, Map<string, Data>>();
  private nextId = 0;

  col(name: string): Map<string, Data> {
    let c = this.collections.get(name);
    if (!c) this.collections.set(name, (c = new Map()));
    return c;
  }

  docRef(collection: string, id: string) {
    return {
      id,
      _collection: collection,
      get: async () => this.snapshot(collection, id),
      set: async (data: Data) => void this.col(collection).set(id, { ...data }),
      update: async (data: Data) => {
        const cur = this.col(collection).get(id);
        if (!cur) throw new Error(`No document to update: ${collection}/${id}`);
        this.col(collection).set(id, { ...cur, ...data });
      },
    };
  }

  snapshot(collection: string, id: string, extra: Data = {}) {
    const data = this.col(collection).get(id);
    const merged = data ? { ...data, ...extra } : undefined;
    return {
      id,
      exists: !!data,
      ref: this.docRef(collection, id),
      data: () => merged,
      get: (f: string) => merged?.[f],
    };
  }

  query(collection: string, filters: Filter[] = [], order?: { field: string; dir: "asc" | "desc" }, max?: number) {
    const run = () => {
      let rows = [...this.col(collection).entries()].filter(([, d]) => filters.every((f) => d[f.field] === f.value));
      if (order) {
        const sign = order.dir === "desc" ? -1 : 1;
        rows = rows.sort(([, a], [, b]) => (String(a[order.field]) < String(b[order.field]) ? -sign : String(a[order.field]) > String(b[order.field]) ? sign : 0));
      }
      if (max !== undefined) rows = rows.slice(0, max);
      return rows.map(([id]) => this.snapshot(collection, id));
    };
    return {
      _collection: collection,
      where: (field: string, _op: string, value: unknown) =>
        this.query(collection, [...filters, { field, value }], order, max),
      orderBy: (field: string, dir: "asc" | "desc" = "asc") => this.query(collection, filters, { field, dir }, max),
      limit: (n: number) => this.query(collection, filters, order, n),
      get: async () => {
        const docs = run();
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
      findNearest: (o: { vectorField: string; queryVector: number[]; limit: number; distanceResultField: string }) => ({
        get: async () => {
          const docs = run()
            .map((s) => ({ s, d: cosineDistance(toArray(s.data()![o.vectorField]), o.queryVector) }))
            .sort((x, y) => x.d - y.d)
            .slice(0, o.limit)
            .map(({ s, d }) => this.snapshot(collection, s.id, { [o.distanceResultField]: d }));
          return { docs, size: docs.length, empty: docs.length === 0 };
        },
      }),
    };
  }

  collection(name: string) {
    return {
      ...this.query(name),
      doc: (id?: string) => this.docRef(name, id ?? `auto${++this.nextId}`),
    };
  }

  async runTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const ops: Array<() => void> = [];
    const tx = {
      get: (q: { get(): Promise<unknown> }) => q.get(),
      set: (ref: { _collection: string; id: string }, data: Data) => ops.push(() => this.col(ref._collection).set(ref.id, data)),
      delete: (ref: { _collection: string; id: string }) => ops.push(() => this.col(ref._collection).delete(ref.id)),
    };
    const out = await fn(tx);
    ops.forEach((op) => op());
    return out;
  }

  batch() {
    const ops: Array<() => void> = [];
    return {
      update: (ref: { _collection: string; id: string }, data: Data) =>
        ops.push(() => this.col(ref._collection).set(ref.id, { ...this.col(ref._collection).get(ref.id), ...data })),
      commit: async () => ops.forEach((op) => op()),
    };
  }

  asFirestore(): Firestore {
    return this as unknown as Firestore;
  }
}

/** Bag-of-words hashing embedder: texts sharing words land close together. */
export function hashingEmbedder(): Embedder & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    model: "test-hashing",
    dimensions: EMBEDDING_DIMENSIONS,
    calls,
    async embed(texts) {
      calls.push(texts);
      return texts.map((t) => {
        const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
        for (const w of t.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []) {
          v[createHash("sha1").update(w).digest().readUInt32BE(0) % EMBEDDING_DIMENSIONS] += 1;
        }
        return v;
      });
    },
  };
}

export function stubDescriber(overrides: Partial<Description> = {}): Describer & { seen: ParsedForm[] } {
  const seen: ParsedForm[] = [];
  return {
    model: "test-stub",
    seen,
    async describe(form) {
      seen.push(form);
      const description: Description = {
        jobTitles: [],
        targetOrganisations: [],
        competitors: [],
        positionChanges: [],
        proofPoints: [],
        mainPoints: [form.summary],
        keyTakeaways: [],
        commonThemes: [],
        keyDecisions: [],
        pillarKeyPoints: [],
        topicAreaKeyPoints: [],
        openQuestions: [],
        clientContext: "",
        discussion: form.discussion.map((_, index) => ({ index, clientViews: [], challengesRaised: [], topicArea: "Other" })),
        recommendationAreas: [],
        ...overrides,
      };
      return { description, provider: "test-provider" };
    },
  };
}
