// Phase 6 (AUTH-03 / AUTH-06 / AUTH-07 / D-10): auth blocking + callable
// handlers added alongside the existing cspReportSink (Phase 3 HOST-05 / FN-10).
// Phase 7 expands this file with App Check enforcement, Zod validation,
// per-function service accounts, and Firestore-side auditLog/ writers.
//
// Phase 7 Wave 4 (FN-09 / 07-04): checkRateLimit fallback callable exported.
// Deployed-but-not-live-wired (Pattern 5b) — primary rate-limit path is the
// firestore.rules `rateLimitOk(uid)` predicate composed on messages + comments
// create rules. This callable is the operator hot-swap seam if the rules-side
// hits Pitfall 4 single-`get()` budget under composition.
export { cspReportSink } from "./csp/cspReportSink.js";
export { beforeUserCreatedHandler } from "./auth/beforeUserCreated.js";
export { beforeUserSignedInHandler } from "./auth/beforeUserSignedIn.js";
export { setClaims } from "./auth/setClaims.js";
export { checkRateLimit } from "./ratelimit/checkRateLimit.js";
