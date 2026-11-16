// Live smoke test: real DeepSeek describer (OpenRouter, US providers), real OpenAI
// embeddings, real Firestore vector search. Skipped unless KNOWLEDGE_LIVE=1. Writes under a throwaway orgId and
// deletes everything it wrote afterwards.
//
//   Emulator:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 KNOWLEDGE_LIVE=1 OPENAI_API_KEY=... OPENROUTER_API_KEY=... npx vitest run test/knowledge/live.smoke.test.ts
//   Project:   (vector indexes deployed, ADC logged in) GCLOUD_PROJECT=bedeveloped-base-layers KNOWLEDGE_LIVE=1 OPENAI_API_KEY=... OPENROUTER_API_KEY=... npx vitest run test/knowledge/live.smoke.test.ts
//   Optional:  KNOWLEDGE_DESCRIBER_MODEL=<OpenRouter model id> to override the DeepSeek default.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { openrouterDescriber } from "../../src/knowledge/describer";
import { openaiEmbedder } from "../../src/knowledge/embedder";
import { ingestSessionForm } from "../../src/knowledge/ingest";
import { searchKnowledge } from "../../src/knowledge/retrieve";
import { CHUNKS_COLLECTION, RECORDS_COLLECTION } from "../../src/knowledge/types";

const live = process.env.KNOWLEDGE_LIVE === "1";
const ORG = `rag-smoke-${Date.now()}`;
const OTHER = `${ORG}-other`;

describe.skipIf(!live)("knowledge RAG live smoke", () => {
  const app = getApps()[0] ?? initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-knowledge" });
  const db = getFirestore(app);
  const deps = {
    db,
    describer: openrouterDescriber(
      { apiKey: process.env.OPENROUTER_API_KEY ?? "" },
      { model: process.env.KNOWLEDGE_DESCRIBER_MODEL || undefined },
    ),
    embedder: openaiEmbedder({ apiKey: process.env.OPENAI_API_KEY ?? "" }),
  };
  const fixture = (n: string) => readFileSync(join(__dirname, "fixtures", n));
  const meta = (orgId: string, clientName: string, f: string) => ({
    orgId,
    clientName,
    documentType: "session_form" as const,
    uploadedBy: "smoke-test",
    uploadedAt: new Date().toISOString(),
    sourceFileName: f,
  });

  afterAll(async () => {
    for (const col of [CHUNKS_COLLECTION, RECORDS_COLLECTION]) {
      for (const org of [ORG, OTHER]) {
        const snap = await db.collection(col).where("orgId", "==", org).get();
        await Promise.all(snap.docs.map((d) => d.ref.delete()));
      }
    }
  });

  it("ingests, overwrites and retrieves with real models", async () => {
    await ingestSessionForm(deps, fixture("northwind-p1-v1.docx"), meta(ORG, "Northwind Analytics", "v1"));
    await ingestSessionForm(deps, fixture("northwind-p2.docx"), meta(ORG, "Northwind Analytics", "p2"));
    await ingestSessionForm(deps, fixture("bluefin-p1.docx"), meta(OTHER, "Bluefin Legal", "bf"));
    const r = await ingestSessionForm(deps, fixture("northwind-p1-v2.docx"), meta(ORG, "Northwind Analytics", "v2"));
    expect(r.replacedChunks).toBeGreaterThan(0);

    const rec = (await db.collection(RECORDS_COLLECTION).doc(`${ORG}__1`).get()).data()!;
    console.log(`Describer: ${rec.describerModel} via ${rec.describerProvider}`);
    expect(rec.describerProvider).not.toBe("");
    console.log("Describer tags for Pillar 1 v2:", JSON.stringify(
      { mainPoints: rec.mainPoints, keyDecisions: rec.keyDecisions, jobTitles: rec.jobTitles, positionChanges: rec.positionChanges, openQuestions: rec.openQuestions },
      null,
      2,
    ));

    const questions = [
      "Who is our ideal customer now?",
      "What value proposition conversation did I have with George?",
      "What did we say about pricing?",
      "Which law firms should we target?",
    ];
    for (const q of questions) {
      const hits = await searchKnowledge(db, deps.embedder, { orgId: ORG, query: q, limit: 3 });
      console.log(`\nQ: ${q}\n` + hits.map((h) => `  ${h.distance.toFixed(3)} [P${h.pillar} ${h.kind}] ${h.text.split("\n\n").slice(1).join(" ").slice(0, 140)}`).join("\n"));
      expect(hits.every((h) => !h.text.includes("Bluefin"))).toBe(true);
      expect(hits.every((h) => h.sessionDate !== "2026-10-14")).toBe(true);
    }
  }, 180_000);
});
