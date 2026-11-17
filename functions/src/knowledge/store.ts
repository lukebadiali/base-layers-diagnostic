// Firestore vector store for the Client Knowledge Agent.
//
// One Firestore database, separated by orgId (Drive "Baselayers Agent"
// requirement: no per-client databases). Both collections are server-only;
// firestore.rules has no match for them, so client SDK access is denied.
//
//   knowledgeRecords/{orgId}__{pillar}  one per client per pillar: all 36 tags
//   knowledgeChunks/{auto}              embedded chunks + filterable tags
//
// Writing a record replaces the previous one for that client and pillar in a
// single transaction: old chunks deleted, new chunks and record written.

import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  CHUNKS_COLLECTION,
  RECORDS_COLLECTION,
  type Chunk,
  type Description,
  type KnowledgeStatus,
  type ParsedForm,
  type PillarKey,
  type UploadMeta,
} from "./types";

/** The 36 signed-off tags, by the field name each is stored under. */
export const TAG_FIELDS = {
  // Admin at upload / system
  client: "client",
  documentType: "documentType",
  uploadedBy: "uploadedBy",
  uploadDate: "uploadedAt",
  status: "status",
  // Read from the form
  pillar: "pillar",
  sessionDate: "sessionDate",
  sessionName: "sessionName",
  attendees: "attendees",
  bedevelopedLead: "bedevelopedLeads",
  capturedBy: "capturedBy",
  sessionSummary: "sessionSummary",
  discussionTopic: "discussionTopic",
  keyPoint: "keyPoint",
  clientView: "clientView",
  challengeRaised: "challengeRaised",
  topicArea: "topicArea",
  recommendation: "recommendation",
  agreedStatus: "agreedStatus",
  nextSessionDate: "nextSessionDate",
  nextSessionFocus: "nextSessionFocus",
  preparationNeeded: "preparationNeeded",
  // AI, from the text
  jobTitles: "jobTitles",
  targetOrganisations: "targetOrganisations",
  competitors: "competitors",
  positionChange: "positionChanges",
  proofPoints: "proofPoints",
  associatedTerms: "associatedTerms",
  // AI overview
  mainPoints: "mainPoints",
  keyTakeaways: "keyTakeaways",
  commonThemes: "commonThemes",
  keyDecisions: "keyDecisions",
  pillarKeyPoints: "pillarKeyPoints",
  topicAreaKeyPoints: "topicAreaKeyPoints",
  openQuestions: "openQuestions",
  clientContext: "clientContext",
} as const;

export function recordId(orgId: string, pillar: PillarKey): string {
  return `${orgId}__${pillar}`;
}

export interface RecordInput {
  meta: UploadMeta;
  form: ParsedForm;
  description: Description;
  leads: string[];
  associatedTerms: string[];
  chunks: Chunk[];
  vectors: number[][];
  embeddingModel: string;
  describerModel: string;
  describerProvider?: string;
}

/** Document-level tags, shared by the record and each of its chunks. */
function documentTags(input: RecordInput) {
  const { meta, form, description: d } = input;
  return {
    orgId: meta.orgId,
    client: form.client,
    documentType: meta.documentType,
    uploadedBy: meta.uploadedBy,
    uploadedAt: meta.uploadedAt,
    status: "current" as KnowledgeStatus,
    pillar: form.pillar,
    pillarName: form.pillarName,
    sessionDate: form.sessionDate,
    sessionName: form.sessionName,
    attendees: form.attendees,
    bedevelopedLeads: input.leads,
    capturedBy: form.capturedBy,
    sessionSummary: form.summary,
    jobTitles: d.jobTitles,
    targetOrganisations: d.targetOrganisations,
    competitors: d.competitors,
    positionChanges: d.positionChanges,
    proofPoints: d.proofPoints,
    associatedTerms: input.associatedTerms,
    mainPoints: d.mainPoints,
    keyTakeaways: d.keyTakeaways,
    commonThemes: d.commonThemes,
    keyDecisions: d.keyDecisions,
    pillarKeyPoints: d.pillarKeyPoints,
    openQuestions: d.openQuestions,
    clientContext: d.clientContext,
  };
}

export async function replaceRecord(db: Firestore, input: RecordInput): Promise<{ written: number; deleted: number }> {
  const { meta, form, description: d, chunks, vectors } = input;
  if (chunks.length !== vectors.length) throw new Error("Chunk and vector counts differ");
  if (chunks.length > 400) throw new Error(`Too many chunks for one transaction (${chunks.length})`);

  const docTags = documentTags(input);
  const chunksCol = db.collection(CHUNKS_COLLECTION);
  const recordRef = db.collection(RECORDS_COLLECTION).doc(recordId(meta.orgId, form.pillar));

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(chunksCol.where("orgId", "==", meta.orgId).where("pillar", "==", form.pillar));
    existing.docs.forEach((doc) => tx.delete(doc.ref));

    chunks.forEach((c, i) => {
      tx.set(chunksCol.doc(), {
        ...docTags,
        ...c.tags,
        kind: c.kind,
        text: c.text,
        embedding: FieldValue.vector(vectors[i]),
      });
    });

    tx.set(recordRef, {
      ...docTags,
      topicAreaKeyPoints: d.topicAreaKeyPoints,
      discussion: form.discussion.map((row, i) => {
        const x = d.discussion.find((e) => e.index === i);
        return {
          discussionTopic: row.topic,
          keyPoint: row.keyPoints,
          clientView: x?.clientViews ?? [],
          challengeRaised: x?.challengesRaised ?? [],
          topicArea: x?.topicArea ?? "Other",
        };
      }),
      recommendations: chunks
        .filter((c) => c.kind === "recommendation")
        .map((c) => ({ topicArea: c.tags.topicArea, recommendation: c.tags.recommendation, agreedStatus: c.tags.agreedStatus })),
      nextSessionDate: form.nextSession.date,
      nextSessionFocus: form.nextSession.focus,
      preparationNeeded: form.nextSession.preparation,
      sourceFileName: meta.sourceFileName,
      chunkCount: chunks.length,
      embeddingModel: input.embeddingModel,
      describerModel: input.describerModel,
      describerProvider: input.describerProvider ?? "",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { written: chunks.length, deleted: existing.size };
  });
}

/**
 * Archive or restore everything held for a client (a client leaving Base
 * Layers loses access; restorable if they return). Retrieval only reads
 * status "current".
 */
export async function setOrgKnowledgeStatus(db: Firestore, orgId: string, status: KnowledgeStatus): Promise<number> {
  const refs = [
    ...(await db.collection(RECORDS_COLLECTION).where("orgId", "==", orgId).get()).docs,
    ...(await db.collection(CHUNKS_COLLECTION).where("orgId", "==", orgId).get()).docs,
  ].map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const batch = db.batch();
    refs.slice(i, i + 400).forEach((r) => batch.update(r, { status }));
    await batch.commit();
  }
  return refs.length;
}

/** Pillars with current knowledge for a client, so the agent can say a pillar is not covered yet. */
/** Every org with live (not archived) knowledge, for staff questions across all clients. */
export async function orgsWithKnowledge(db: Firestore): Promise<string[]> {
  const snap = await db.collection(RECORDS_COLLECTION).where("status", "==", "current").get();
  return [...new Set(snap.docs.map((d) => d.get("orgId") as string))].sort();
}

export async function coveredPillars(db: Firestore, orgId: string): Promise<PillarKey[]> {
  const snap = await db
    .collection(RECORDS_COLLECTION)
    .where("orgId", "==", orgId)
    .where("status", "==", "current")
    .get();
  return snap.docs.map((d) => d.get("pillar") as PillarKey);
}

export interface PillarCoverage {
  pillar: PillarKey;
  pillarName: string;
  status: KnowledgeStatus;
  sessionDate: string;
  sessionName: string;
  sourceFileName: string;
  uploadedAt: string;
  chunkCount: number;
}

export interface OrgCoverage {
  /** "none" when nothing has ever been uploaded; "archived" when every record is archived. */
  status: KnowledgeStatus | "none";
  pillars: PillarCoverage[];
}

const PILLAR_ORDER: PillarKey[] = ["review", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

/** What the agent holds for one client, one row per pillar record, in pillar order. */
export async function orgCoverage(db: Firestore, orgId: string): Promise<OrgCoverage> {
  const snap = await db.collection(RECORDS_COLLECTION).where("orgId", "==", orgId).get();
  const pillars = snap.docs
    .map((d) => ({
      pillar: d.get("pillar") as PillarKey,
      pillarName: (d.get("pillarName") as string) ?? "",
      status: d.get("status") as KnowledgeStatus,
      sessionDate: (d.get("sessionDate") as string) ?? "",
      sessionName: (d.get("sessionName") as string) ?? "",
      sourceFileName: (d.get("sourceFileName") as string) ?? "",
      uploadedAt: (d.get("uploadedAt") as string) ?? "",
      chunkCount: (d.get("chunkCount") as number) ?? 0,
    }))
    .sort((a, b) => PILLAR_ORDER.indexOf(a.pillar) - PILLAR_ORDER.indexOf(b.pillar));
  const status = !pillars.length ? "none" : pillars.some((p) => p.status === "current") ? "current" : "archived";
  return { status, pillars };
}
