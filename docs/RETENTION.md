# Retention & Threshold Policies

This document captures retention windows, throttling thresholds, and other
operational policies whose values are operator-tunable. Phase 11 (DOC-10)
owns the comprehensive retention manifest; earlier phases append the rows
they own as they land.

## Rate Limiting (FN-09) — Phase 7 Wave 4

**Threshold**: 30 writes per 60-second sliding window per user, combined
across `orgs/{orgId}/messages` and `orgs/{orgId}/comments` collections.

**Bucket retention**: `rateLimits/{uid}/buckets/{windowStart}` docs persist
beyond the window for observability + audit. Operator may run a scheduled
cleanup function in Phase 8+ to age out buckets older than 7 days. Phase 7
does NOT auto-purge. Bucket docs are tiny (`{ uid: string, count: number }`)
so storage cost is negligible.

**Adjustability**:

- **Without redeploy**: NO — the threshold is hardcoded in `firestore.rules`
  `rateLimitOk(uid)` predicate (`bucket.count < 30`) and in the
  `rateLimits/{uid}/buckets/{windowStart}` `update` predicate
  (`request.resource.data.count <= 30`). To change, edit both predicates and
  redeploy `firestore:rules` via the CI deploy chain (Phase 6 D-12 substrate)
  or manual `firebase deploy --only firestore:rules`.
- **Operator hot-swap**: The `checkRateLimit` callable
  (`functions/src/ratelimit/checkRateLimit.ts`) is deployed but NOT live-wired
  in Phase 7 (Pattern 5b — fallback seam). To activate, ship
  `src/cloud/checkRateLimit.js` wrapper + replace `incrementBucketAndWrite`
  with the callable in `src/data/messages.js` + `src/data/comments.js`.
  Threshold then becomes runtime-tunable via env var or secret without a
  rules-redeploy. Operator decision (Wave 6 cleanup-ledger candidate).

**Pitfall avoidance**: Threshold (30/60s) is conservative-but-non-disruptive
for a chat-style SaaS use case (Open Question #3 in
`.planning/phases/07-cloud-functions-app-check-trusted-server-layer/07-RESEARCH.md`).
Revisit at engagement re-start if BeDeveloped consultancy use-case has bursts
(e.g., paste-from-clipboard of multiple comment items).

**Threat coverage**: OWASP A04:2021 (Insecure Design — rate limiting) +
ASVS V11.1 (Business Logic abuse-resistance) + STRIDE Denial of Service
mitigation per `07-04-PLAN.md` `<threat_model>` row T-07-04-05.

**Test coverage**: `tests/rules/rate-limit.test.js` — 15 cells:
bucket-direct (anonymous deny, self-read allow, cross-uid deny, current-window
create with count==1, future/past window deny, monotonic +1 update, count<=30
cap, no-delete, cross-uid update deny) + composed-predicate (30-message burst,
31st denies — Phase 7 SC#5 evidence, new-window resumption, shared bucket
across messages+comments).

**Implementation cross-reference**:

| Surface | File | Path |
|---------|------|------|
| Rules predicate (primary) | `firestore.rules` | `rateLimitOk(uid)` + `rateLimits/{uid}/buckets/{windowStart}` block |
| Client transactional helper | `src/data/rate-limit.js` | `incrementBucketAndWrite` |
| Wired callers | `src/data/messages.js`, `src/data/comments.js` | `addMessage` / `addComment` |
| Fallback callable (seam) | `functions/src/ratelimit/checkRateLimit.ts` | `checkRateLimit` (deployed, not wired) |
| Rules-unit-test | `tests/rules/rate-limit.test.js` | 15 cells |
| Helper unit-test | `tests/data/rate-limit.test.js` | 6 cells |
| Callable unit-test | `functions/test/ratelimit/checkRateLimit.unit.test.ts` | 10 cells |
