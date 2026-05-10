// Phase 6 (AUTH-03 / AUTH-06 / AUTH-07 / D-10): auth blocking + callable
// handlers added alongside the existing cspReportSink (Phase 3 HOST-05 / FN-10).
// Phase 7 Wave 1 hardened setClaims to Pattern A (App Check + Zod + idempotency
// + Sentry + per-function SA). Wave 2 adds the auditWrite callable + three
// Firestore-trigger mirror writers (FN-01 / AUDIT-01 / AUDIT-04).
// Wave 4 (FN-09 / 07-04): checkRateLimit fallback callable exported.
// Deployed-but-not-live-wired (Pattern 5b) — primary rate-limit path is the
// firestore.rules `rateLimitOk(uid)` predicate composed on messages + comments
// create rules. This callable is the operator hot-swap seam if the rules-side
// hits Pitfall 4 single-`get()` budget under composition.
export { cspReportSink } from "./csp/cspReportSink.js";
export { beforeUserCreatedHandler } from "./auth/beforeUserCreated.js";
export { beforeUserSignedInHandler } from "./auth/beforeUserSignedIn.js";
export { setClaims } from "./auth/setClaims.js";
export { auditWrite } from "./audit/auditWrite.js";
export { onOrgDelete } from "./audit/triggers/onOrgDelete.js";
export { onUserDelete } from "./audit/triggers/onUserDelete.js";
export { onDocumentDelete } from "./audit/triggers/onDocumentDelete.js";
export { checkRateLimit } from "./ratelimit/checkRateLimit.js";
// Phase 8 Wave 1 (08-02): backup substrate Cloud Functions.
export { scheduledFirestoreExport } from "./backup/scheduledFirestoreExport.js";
export { getDocumentSignedUrl } from "./backup/getDocumentSignedUrl.js";
// Phase 8 Wave 2 (08-03): soft-delete lifecycle Cloud Functions.
export { softDelete } from "./lifecycle/softDelete.js";
export { restoreSoftDeleted } from "./lifecycle/restoreSoftDeleted.js";
export { scheduledPurge } from "./lifecycle/scheduledPurge.js";
export { permanentlyDeleteSoftDeleted } from "./lifecycle/permanentlyDeleteSoftDeleted.js";
// Phase 8 Wave 3-4 (08-04, 08-05): GDPR Art. 15 export + Art. 17 erasure.
export { gdprExportUser } from "./gdpr/gdprExportUser.js";
export { gdprEraseUser } from "./gdpr/gdprEraseUser.js";
// Phase 9 Wave 5 (OBS-05 / FN-01): authAnomalyAlert Firestore-trigger Slack
// dispatcher. Reads auditLog/{eventId} creates and applies 4 anomaly rules
// (auth-fail burst, MFA disenrol [DORMANT], role escalation, unusual-hour
// GDPR export). Runs as audit-alert-sa in europe-west2.
export { authAnomalyAlert } from "./observability/authAnomalyAlert.js";
