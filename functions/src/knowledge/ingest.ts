// Ingest pipeline: .docx -> parse -> describe -> chunk -> embed -> store.

import type { Firestore } from "firebase-admin/firestore";
import type { Describer } from "./describer";
import { readDocx } from "./docx";
import type { Embedder } from "./embedder";
import { bedevelopedLeads, FormError, parseSessionForm, sameClient } from "./form";
import { buildChunks } from "./chunker";
import { replaceRecord } from "./store";
import { BEDEVELOPED_STAFF, type PillarKey, type UploadMeta } from "./types";

export interface IngestDeps {
  db: Firestore;
  describer: Describer;
  embedder: Embedder;
  staff?: string[];
  /** George's term library, once supplied: returns matching associated terms for a text. */
  matchTerms?: (text: string) => string[];
}

export interface IngestResult {
  orgId: string;
  pillar: PillarKey;
  sessionDate: string;
  chunks: number;
  replacedChunks: number;
}

export async function ingestSessionForm(deps: IngestDeps, file: Buffer, meta: UploadMeta): Promise<IngestResult> {
  const form = parseSessionForm(readDocx(file));
  if (!sameClient(form.client, meta.clientName)) {
    throw new FormError(`Form is for "${form.client}" but was uploaded to "${meta.clientName}". Upload stopped.`);
  }
  const leads = bedevelopedLeads(form.attendees, deps.staff ?? BEDEVELOPED_STAFF);
  const { description, provider } = await deps.describer.describe(form);
  const chunks = buildChunks(form, description, leads);
  const vectors = await deps.embedder.embed(chunks.map((c) => c.text));
  const associatedTerms = deps.matchTerms ? [...new Set(chunks.flatMap((c) => deps.matchTerms!(c.text)))] : [];

  const { written, deleted } = await replaceRecord(deps.db, {
    meta,
    form,
    description,
    leads,
    associatedTerms,
    chunks,
    vectors,
    embeddingModel: deps.embedder.model,
    describerModel: deps.describer.model,
    describerProvider: provider,
  });
  return { orgId: meta.orgId, pillar: form.pillar, sessionDate: form.sessionDate, chunks: written, replacedChunks: deleted };
}
