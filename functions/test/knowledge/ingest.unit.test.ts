// End-to-end ingest and retrieval against the in-memory Firestore fake:
// overwrite per client per pillar, client isolation, archive, and the 36 tags.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { FormError } from "../../src/knowledge/form";
import { ingestSessionForm } from "../../src/knowledge/ingest";
import { assertOneClient, keywordTerms, rerankByKeywords, searchKnowledge } from "../../src/knowledge/retrieve";
import { coveredPillars, recordId, setOrgKnowledgeStatus, TAG_FIELDS } from "../../src/knowledge/store";
import { CHUNKS_COLLECTION, RECORDS_COLLECTION, type UploadMeta } from "../../src/knowledge/types";
import { FakeFirestore, hashingEmbedder, stubDescriber } from "./fakes";

const fixture = (n: string) => readFileSync(join(__dirname, "fixtures", n));
const meta = (orgId: string, clientName: string, file: string): UploadMeta => ({
  orgId,
  clientName,
  documentType: "session_form",
  uploadedBy: "admin-uid",
  uploadedAt: "2026-11-12T10:00:00.000Z",
  sourceFileName: file,
});

let fake: FakeFirestore;
let deps: Parameters<typeof ingestSessionForm>[0];
const chunksFor = (orgId: string) => [...fake.col(CHUNKS_COLLECTION).values()].filter((c) => c.orgId === orgId);

beforeEach(() => {
  fake = new FakeFirestore();
  deps = { db: fake.asFirestore(), describer: stubDescriber(), embedder: hashingEmbedder() };
});

async function ingest(orgId: string, client: string, file: string) {
  return ingestSessionForm(deps, fixture(file), meta(orgId, client, file));
}

describe("ingestSessionForm", () => {
  it("stores one record and its embedded chunks", async () => {
    const r = await ingest("org-nw", "Northwind Analytics", "northwind-p1-v1.docx");
    expect(r).toMatchObject({ orgId: "org-nw", pillar: "1", sessionDate: "2026-10-14", replacedChunks: 0 });
    // session + overview + 2 discussion + 3 recommendations + next session
    expect(r.chunks).toBe(8);
    expect(chunksFor("org-nw")).toHaveLength(8);
    const rec = fake.col(RECORDS_COLLECTION).get(recordId("org-nw", "1"))!;
    expect(rec.bedevelopedLeads).toEqual(["Luke Badiali"]);
    expect(rec.embeddingModel).toBe("test-hashing");
    expect(rec.describerProvider).toBe("test-provider");
  });

  it("a new upload for the same client and pillar replaces the old one", async () => {
    await ingest("org-nw", "Northwind Analytics", "northwind-p1-v1.docx");
    const r = await ingest("org-nw", "Northwind Analytics", "northwind-p1-v2.docx");
    expect(r.replacedChunks).toBe(8);
    const chunks = chunksFor("org-nw");
    expect(chunks.every((c) => c.sessionDate === "2026-11-11")).toBe(true);
    expect(chunks.some((c) => String(c.text).includes("logistics and freight firms"))).toBe(false);
    expect(fake.col(RECORDS_COLLECTION).size).toBe(1);
  });

  it("a different pillar for the same client is kept alongside", async () => {
    await ingest("org-nw", "Northwind Analytics", "northwind-p1-v1.docx");
    await ingest("org-nw", "Northwind Analytics", "northwind-p2.docx");
    expect(new Set(chunksFor("org-nw").map((c) => c.pillar))).toEqual(new Set(["1", "2"]));
    expect((await coveredPillars(fake.asFirestore(), "org-nw")).sort()).toEqual(["1", "2"]);
  });

  it("stops the upload when the form's Client does not match the chosen client", async () => {
    await expect(ingest("org-nw", "Northwind Analytics", "bluefin-p1.docx")).rejects.toThrow(FormError);
    expect(fake.col(CHUNKS_COLLECTION).size).toBe(0);
  });

  it("does not embed or store anything when the describer fails", async () => {
    deps.describer = { model: "x", describe: async () => Promise.reject(new Error("model down")) };
    await expect(ingest("org-nw", "Northwind Analytics", "northwind-p1-v1.docx")).rejects.toThrow("model down");
    expect(fake.col(CHUNKS_COLLECTION).size).toBe(0);
  });

  it("stores all 36 signed-off tags on the record or its chunks", async () => {
    await ingest("org-nw", "Northwind Analytics", "northwind-p1-v1.docx");
    expect(Object.keys(TAG_FIELDS)).toHaveLength(36);
    expect(Object.keys(TAG_FIELDS).some((k) => /action/i.test(k))).toBe(false);
    const rec = fake.col(RECORDS_COLLECTION).get(recordId("org-nw", "1"))!;
    const fields = new Set([
      ...Object.keys(rec),
      ...chunksFor("org-nw").flatMap((c) => Object.keys(c)),
      ...((rec.discussion as object[]) ?? []).flatMap((d) => Object.keys(d)),
    ]);
    const missing = Object.values(TAG_FIELDS).filter((f) => !fields.has(f));
    expect(missing).toEqual([]);
  });
});

describe("searchKnowledge", () => {
  beforeEach(async () => {
    await ingest("org-nw", "Northwind Analytics", "northwind-p1-v1.docx");
    await ingest("org-nw", "Northwind Analytics", "northwind-p2.docx");
    await ingest("org-bf", "Bluefin Legal", "bluefin-p1.docx");
  });

  it("finds the most relevant chunk for a question", async () => {
    const hits = await searchKnowledge(fake.asFirestore(), deps.embedder, {
      orgId: "org-nw",
      query: "What value proposition did we agree about spoiled cold-chain loads?",
      limit: 3,
    });
    expect(hits[0].pillar).toBe("2");
    expect(hits[0].text).toMatch(/spoiled cold-chain loads/);
    expect(hits[0].distance).toBeLessThan(hits[hits.length - 1].distance + 1e-9);
  });

  it("never returns another client's chunks", async () => {
    const hits = await searchKnowledge(fake.asFirestore(), deps.embedder, {
      orgId: "org-nw",
      query: "UK law firms fee earners COO practice technology",
      limit: 50,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => !h.text.includes("Bluefin"))).toBe(true);
  });

  it("can be limited to one pillar", async () => {
    const hits = await searchKnowledge(fake.asFirestore(), deps.embedder, { orgId: "org-nw", query: "ICP", pillar: "1" });
    expect(hits.every((h) => h.pillar === "1")).toBe(true);
  });

  it("returns at most the limit, though it fetches more candidates to re-rank", async () => {
    const all = await searchKnowledge(fake.asFirestore(), deps.embedder, { orgId: "org-nw", query: "ICP", limit: 50 });
    const hits = await searchKnowledge(fake.asFirestore(), deps.embedder, { orgId: "org-nw", query: "ICP", limit: 3 });
    expect(all.length).toBeGreaterThan(3);
    expect(hits).toHaveLength(3);
  });

  it("returns nothing once a client's knowledge is archived, and everything again when restored", async () => {
    const db = fake.asFirestore();
    await setOrgKnowledgeStatus(db, "org-nw", "archived");
    expect(await searchKnowledge(db, deps.embedder, { orgId: "org-nw", query: "ICP" })).toEqual([]);
    expect(await coveredPillars(db, "org-nw")).toEqual([]);
    await setOrgKnowledgeStatus(db, "org-nw", "current");
    expect((await searchKnowledge(db, deps.embedder, { orgId: "org-nw", query: "ICP" })).length).toBeGreaterThan(0);
  });
});

describe("assertOneClient", () => {
  it("passes one client's hits and refuses any mix", () => {
    expect(() => assertOneClient("org-nw", [{ orgId: "org-nw" }, { orgId: "org-nw" }])).not.toThrow();
    expect(() => assertOneClient("org-nw", [{ orgId: "org-nw" }, { orgId: "org-bf" }])).toThrow(/another client/);
  });
});

describe("rerankByKeywords", () => {
  const ctx = "Client: Fernhill | Pillar 1 | Date: 2026-07-09";
  const hit = (distance: number, body: string) => ({ distance, text: `${ctx}\n\n${body}` });

  it("lifts the row holding the question's rarer words above a nearer same-topic row", () => {
    const hits = [
      hit(0.5, "Model deployment pace under three revenue scenarios for the fund."),
      hit(0.52, "Track cost per completed deal including abort costs."),
      hit(0.51, "Target founder-led businesses with £3m to £15m revenue, growing 30% or more."),
    ];
    const out = rerankByKeywords("What revenue range did we agree for target companies?", hits);
    expect(out[0].text).toMatch(/£3m to £15m/);
    expect(out).toHaveLength(3);
  });

  it("leaves the order alone when no candidate shares a word with the question", () => {
    const hits = [hit(0.4, "Alpha."), hit(0.5, "Beta."), hit(0.6, "Gamma.")];
    expect(rerankByKeywords("What did we agree?", hits)).toEqual(hits);
    expect(rerankByKeywords("pipeline coverage", hits)).toEqual(hits);
  });

  it("ignores the context line, so the client or session name earns no bonus", () => {
    const hits = [hit(0.4, "Alpha."), { distance: 0.45, text: "Client: Fernhill | Session: Week 1\n\nBeta." }];
    expect(rerankByKeywords("Fernhill week", hits)).toEqual(hits);
  });
});

describe("keywordTerms", () => {
  it("drops stop words and a plural s, keeps figures", () => {
    expect([...keywordTerms("What ticket sizes did we agree for target LPs at £15m?")]).toEqual(["ticket", "size", "target", "lps", "£15m"]);
  });
});
