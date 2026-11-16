// src/cloud/knowledge.js
// @ts-check
// Client Knowledge Agent callables (functions/src/knowledge/callables.ts).
// Staff-only in this release: the panel that uses these is hidden behind
// VITE_KNOWLEDGE_ADMIN and the server keeps clients out until
// knowledgeConfig/access { clientAccess: true } is set.
import { functions, httpsCallable } from "../firebase/functions.js";

const ingestCallable = httpsCallable(functions, "knowledgeIngest", { timeout: 130_000 });
const askCallable = httpsCallable(functions, "knowledgeAsk", { timeout: 70_000 });
const uploadsCallable = httpsCallable(functions, "knowledgeUploads");

/**
 * @typedef {{ id: string, orgId: string, clientName: string, fileName: string, uploadedBy: string,
 *   status: "processing" | "succeeded" | "failed", startedAt: string, finishedAt?: string,
 *   pillar?: string, sessionDate?: string, chunks?: number, replacedChunks?: number, error?: string }} UploadRow
 * @typedef {{ pillar: string, sessionName: string, sessionDate: string }} AskSource
 * @typedef {{ answer: string, answered: boolean, hitCount: number, model: string, provider: string,
 *   sources?: AskSource[] }} AskResult
 */

/**
 * @param {{ orgId: string, fileName: string, fileBase64: string }} input
 * @returns {Promise<{ uploadId: string, pillar: string, sessionDate: string, chunks: number, replacedChunks: number }>}
 */
export async function knowledgeIngest(input) {
  const res = await ingestCallable(input);
  return /** @type {*} */ (res.data);
}

/**
 * @param {{ orgId: string, question: string, pillar?: string, format?: "bullets" | "short" }} input
 * @returns {Promise<AskResult>}
 */
export async function knowledgeAsk(input) {
  const res = await askCallable(input);
  return /** @type {AskResult} */ (res.data);
}

/**
 * @param {{ orgId?: string, limit?: number }} input
 * @returns {Promise<UploadRow[]>}
 */
export async function knowledgeUploads(input) {
  const res = await uploadsCallable(input);
  return /** @type {{ uploads: UploadRow[] }} */ (res.data).uploads;
}
