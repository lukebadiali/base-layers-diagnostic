// Client Knowledge Agent: callable endpoints and the archive trigger.
//
//   knowledgeIngest      staff upload a Session Capture Form (.docx, base64) for a client
//   knowledgeAsk         ask a client's agent (staff: any client; client: own org, once enabled)
//   knowledgeUploads     staff read the upload log
//   knowledgeSetStatus   admin archive / restore a client's knowledge
//   knowledgeCoverage    staff read what the agent holds for a client, per pillar
//   knowledgeOnOrgDelete archive (not delete) a client's knowledge when its org is deleted
//
// Secrets OPENAI_API_KEY (embeddings) and OPENROUTER_API_KEY (describer and
// answerer) must exist in Secret Manager before these deploy.
// Clients stay out until knowledgeConfig/access { clientAccess: true } is set
// (handlers.ts readClientAccess); missing means off.

import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { withSentry } from "../util/sentry.js";
import { openrouterAnswerer } from "./answer";
import { openrouterDescriber } from "./describer";
import { openaiEmbedder } from "./embedder";
import {
  handleAsk,
  handleCoverage,
  handleIngest,
  handleSetStatus,
  handleUploads,
  readClientAccess,
  type Caller,
  type HandlerDeps,
} from "./handlers";
import { setOrgKnowledgeStatus } from "./store";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const OPENROUTER_API_KEY = defineSecret("OPENROUTER_API_KEY");

const REGION = "europe-west2";

function callerOf(request: CallableRequest<unknown>): Caller | null {
  if (!request.auth?.uid) return null;
  const t = (request.auth.token ?? {}) as Record<string, unknown>;
  return {
    uid: request.auth.uid,
    role: typeof t.role === "string" ? t.role : "",
    orgId: typeof t.orgId === "string" ? t.orgId : undefined,
  };
}

function deps(clientAccess = false): HandlerDeps {
  return {
    db: getFirestore(),
    embedder: openaiEmbedder({ apiKey: OPENAI_API_KEY.value() }),
    describer: openrouterDescriber({ apiKey: OPENROUTER_API_KEY.value() }),
    answerer: openrouterAnswerer({ apiKey: OPENROUTER_API_KEY.value() }),
    clientAccess,
  };
}

export const knowledgeIngest = onCall(
  {
    region: REGION,
    secrets: [SENTRY_DSN, OPENAI_API_KEY, OPENROUTER_API_KEY],
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  withSentry(async (request: CallableRequest<unknown>) => handleIngest(deps(), callerOf(request), request.data)),
);

export const knowledgeAsk = onCall(
  {
    region: REGION,
    secrets: [SENTRY_DSN, OPENAI_API_KEY, OPENROUTER_API_KEY],
    memory: "256MiB",
    timeoutSeconds: 60,
  },
  withSentry(async (request: CallableRequest<unknown>) =>
    handleAsk(deps(await readClientAccess(getFirestore())), callerOf(request), request.data),
  ),
);

export const knowledgeUploads = onCall(
  { region: REGION, secrets: [SENTRY_DSN], memory: "256MiB", timeoutSeconds: 30 },
  withSentry(async (request: CallableRequest<unknown>) =>
    handleUploads({ db: getFirestore() }, callerOf(request), request.data),
  ),
);

export const knowledgeSetStatus = onCall(
  { region: REGION, secrets: [SENTRY_DSN], memory: "256MiB", timeoutSeconds: 60 },
  withSentry(async (request: CallableRequest<unknown>) =>
    handleSetStatus({ db: getFirestore() }, callerOf(request), request.data),
  ),
);

export const knowledgeCoverage = onCall(
  { region: REGION, secrets: [SENTRY_DSN], memory: "256MiB", timeoutSeconds: 30 },
  withSentry(async (request: CallableRequest<unknown>) =>
    handleCoverage({ db: getFirestore() }, callerOf(request), request.data),
  ),
);

/** A deleted org loses its agent, but the knowledge is archived, not deleted, so it can come back (27 Oct call). */
export const knowledgeOnOrgDelete = onDocumentDeleted({ document: "orgs/{orgId}", region: REGION }, async (event) => {
  const orgId = event.params.orgId;
  const updated = await setOrgKnowledgeStatus(getFirestore(), orgId, "archived");
  logger.info("knowledge.org.archived", { orgId, updated });
});
