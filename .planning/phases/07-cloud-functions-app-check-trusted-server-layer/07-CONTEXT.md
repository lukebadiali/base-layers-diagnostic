# Phase 7: Cloud Functions + App Check (Trusted-Server Layer) - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via `workflow.skip_discuss`)

<domain>
## Phase Boundary

A trusted-server boundary exists with audit logging, rate limiting, secret management, and App Check perimeter — the substrate every later phase depends on.

**Depends on:** Phase 6 (custom claims live so Functions can re-verify caller identity from ID token)

**Requirements:** FN-01, FN-02, FN-03, FN-04, FN-05, FN-06, FN-07, FN-08, FN-09, AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-06, AUDIT-07, TEST-09, DOC-10 (incremental)

**Success Criteria:**

1. The `functions/` workspace builds + tests + deploys cleanly; every callable enforces App Check (`enforceAppCheck: true`), validates input via Zod, writes an idempotency marker doc with a 5-minute window, captures errors to Sentry node, and runs as its own minimal-IAM service account.
2. App Check is enrolled with reCAPTCHA Enterprise; per-environment site keys exist; debug tokens live only in `.env.local`; the App Check dashboard has soaked ≥7 days in unenforced mode and enforcement has been turned on per service in the order Storage → Firestore (collection-by-collection) → Cloud Functions; quota alert at 70% of free tier is configured.
3. `auditLog/{eventId}` Firestore collection rejects all client writes (rules `allow write: if false`); only the `auditWrite` Cloud Function (Admin SDK) writes; an audited user cannot read their own audit records (rules-unit-test pins this).
4. Cloud Logging Data Access logs are sunk to BigQuery dataset `audit_logs_bq` with 7-year retention; mirror Firestore-trigger audit writers (`onOrgDelete`, `onUserDelete`, `onDocumentDelete`) fire end-to-end on the corresponding Firestore changes.
5. Rate limiting on chat / comment writes is enforced (preferred: Firestore Rules `request.time` predicate against `rateLimits/{uid}/buckets/{windowStart}`; fallback: callable Function token-bucket); a synthetic burst test confirms the limit fires.
6. Auth-blocking functions have `minInstances: 1`; cold-start observed p99 ≤ 4s; secrets accessed exclusively via `defineSecret()`.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting (`workflow.skip_discuss: true`). Use ROADMAP phase goal, success criteria, codebase conventions, prior phase patterns (Pattern E one-shot scripts; Pattern G per-phase audit index; Pattern H cleanup-ledger close-and-queue), and `.planning/research/PITFALLS.md` to guide decisions.

### Phase 6 substrate that Phase 7 builds on (load-bearing)

- Cloud Functions workspace exists (`functions/` with TS + Node 22 + Gen 2 — established in Phase 3 cspReportSink + Phase 6 auth functions)
- 3 auth Cloud Functions deployed in `europe-west2`: `beforeUserCreatedHandler`, `beforeUserSignedInHandler`, `setClaims`
- Custom claims live: `request.auth.token.role` ∈ {admin, member}, `orgId`, `email_verified`
- `internalAllowlist/{lowercaseEmail}` collection used by `beforeUserCreated`
- AUTH-09 SUPERSEDED by email-link recovery (no recovery codes)

### Phase 6 substrate gaps that Phase 7 must close (per `runbooks/phase-6-cleanup-ledger.md` forward-tracking rows)

- **D-22 ToS gate** (firebaseauth.googleapis.com API enable + ToS acceptance) — operator action; Phase 7 must resolve via either (a) ToS acceptance, (b) callable claims-setter pattern, or (c) 1st-gen blocking functions migration. Until resolved, future user creation cannot auto-claim via `beforeUserCreated`.
- **TOTP wiring** (`enrollTotp` + `unenrollAllMfa` + `qrcodeDataUrl` in `src/firebase/auth.js`) — sub-wave 6.1; Phase 7 may or may not own the wiring depending on whether sub-wave 6.1 lands first.
- **MFA gate restoration** (D-27/D-28: `false &&` short-circuits at `src/main.js:808` and `src/router.js`; IdP `mfa.state` re-enable) — sub-wave 6.1; Phase 7 should not re-introduce regressions.
- **BLOCKER-FIX 1** (`setClaims` after password update) — sub-wave 6.1.
- **cspReportSink redeploy** — Phase 3 follow-through.
- **AUDIT-01..04** mirror Firestore-trigger audit writers — Phase 7 owns FN-01 + AUDIT-01..04 wiring.
- **FN-09** rate-limit predicate + auditLog writers — Phase 7 owns.

### Pitfalls anchored to Phase 7

- **Pitfall 4** (Admin SDK code in `src/`) — Phase 7 must keep all Admin SDK use under `functions/` and `scripts/` only, never in Vite bundle.
- **Pitfall 12** (cold start lockout from blocking handlers) — `minInstances: 1` mandated for blocking handlers per success criterion 6; reconsider Phase 6 D-4 cost decision (currently no minInstances).
- **Pitfall 13** (service-account JSON in source) — `defineSecret()` for all secrets; ADC for scripts.
- **Pitfall 17** (`auditLog` writer not Admin-SDK-only) — rules `allow write: if false`; only Admin SDK writes; pinned by rules-unit-test.
- **Pitfall 19** (compliance theatre) — every audit-event control must have code link + test link + framework citation in SECURITY.md Phase 7 Audit Index.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Key reference points:

- `functions/src/csp/cspReportSink.ts` (Phase 3) — Pattern for Cloud Function shape; rawBody fallback; content-type allowlist; 64 KB body cap; structured `logger.warn`
- `functions/src/auth/{beforeUserCreated,beforeUserSignedIn,setClaims}.ts` (Phase 6) — auth Cloud Functions pattern; minimal-IAM service accounts (`gcp-sa-identitytoolkit` invoker)
- `functions/src/auth/claim-builder.ts` (Phase 6) — pure-logic Vitest unit test target; firebase-functions-test v3 deferred to Phase 7 / TEST-09
- `firestore.rules` (Phase 5/6) — claims-based predicates; `auditLog/` collection write predicate to be added in Phase 7
- `src/cloud/*` (Phase 4) — empty stub seams for Phase 7 callable wiring (`auditWrite`, `setClaims`, etc.)
- `src/observability/*` (Phase 4) — empty stub seams for Phase 9
- `runbooks/phase-6-cleanup-ledger.md` — forward-tracking rows owned by Phase 7

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP success criteria and the cleanup-ledger forward-tracking rows above. Refer to:

- ROADMAP.md `### Phase 7` section (success criteria, requirements list)
- `.planning/research/STACK.md` for verified 2026 versions (firebase-admin, firebase-functions, App Check, etc.)
- `.planning/research/ARCHITECTURE.md` for Cloud Functions enumeration + dependency graph
- `.planning/research/PITFALLS.md` Pitfalls 4, 12, 13, 17, 19
- `.planning/research/FEATURES.md` table-stakes vs differentiating

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped. Plan-phase decides wave shape and granularity.

</deferred>
