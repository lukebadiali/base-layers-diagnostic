// Phase 8 Wave 1 (BACKUP-05 / FN-03 / FN-04 / FN-07 / Pitfall G):
// getDocumentSignedUrl — replaces unbounded getDownloadURL() with V4 signed
// URL TTL <= 1h (BACKUP-05). Pattern A standard callable shape.
//
//   - enforceAppCheck: true                         (FN-07)
//   - serviceAccount: "storage-reader-sa"           (FN-04 — see runbook below)
//   - secrets: [SENTRY_DSN]                         (FN-05)
//   - withSentry handler wrapper                    (Pitfall 18 PII scrub)
//   - validateInput(SignedUrlInput, request.data)   (Zod)
//
// Pitfall 17: caller's effective orgId comes from request.auth.token.orgId
// (custom claim), NEVER from request.data. Internal/admin role bypasses
// the orgId match.
//
// SA provisioning (operator step — runbooks/phase-8-backup-setup.md §5):
//   gcloud iam service-accounts create storage-reader-sa --display-name="Phase 8 Storage signed URL issuer"
//   gcloud storage buckets add-iam-policy-binding gs://bedeveloped-base-layers-uploads \
//     --member="serviceAccount:storage-reader-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
//     --role="roles/storage.objectViewer"
//   gcloud iam service-accounts add-iam-policy-binding storage-reader-sa@<...>.iam.gserviceaccount.com \
//     --member="serviceAccount:storage-reader-sa@<...>.iam.gserviceaccount.com" \
//     --role="roles/iam.serviceAccountTokenCreator"
// The serviceAccountTokenCreator self-binding is required for V4 signing
// (Cloud Function uses metadata-server-issued ADC; V4 signing needs
// the SA to be able to sign-as-itself).

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { z } from "zod";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");

const UPLOADS_BUCKET = "bedeveloped-base-layers-uploads";
const SIGNED_URL_TTL_MS = 60 * 60 * 1000; // BACKUP-05 — exactly 1 hour

const SignedUrlInput = z.object({
  orgId: z.string().min(1).max(128),
  docId: z.string().min(1).max(128),
  filename: z.string().min(1).max(256),
});

export const getDocumentSignedUrl = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,
    serviceAccount: "storage-reader-sa",
    secrets: [SENTRY_DSN],
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withSentry(async (request: CallableRequest<unknown>) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const data = validateInput(SignedUrlInput, request.data ?? {});

    // Pitfall 17: re-read role + orgId from verified ID token, never from payload.
    const token = (request.auth.token ?? {}) as Record<string, unknown>;
    const role = typeof token.role === "string" ? token.role : null;
    const callerOrgId = typeof token.orgId === "string" ? token.orgId : null;
    const isInternal = role === "internal" || role === "admin";

    if (!isInternal && callerOrgId !== data.orgId) {
      throw new HttpsError("permission-denied", "Not in org");
    }

    const path = `orgs/${data.orgId}/documents/${data.docId}/${data.filename}`;
    const file = getStorage().bucket(UPLOADS_BUCKET).file(path);

    const expiresAt = Date.now() + SIGNED_URL_TTL_MS;
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: expiresAt,
    });

    logger.info("storage.signed_url.issued", {
      actorUid: request.auth.uid,
      orgId: data.orgId,
      docId: data.docId,
      ttlMs: SIGNED_URL_TTL_MS,
      // NOTE: url is intentionally NOT logged (T-08-02-07)
    });

    return { url, expiresAt };
  }),
);
