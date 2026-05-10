---
phase: 07-cloud-functions-app-check-trusted-server-layer
verified: 2026-05-10T00:00:00Z
status: human_needed
score: 6/6 substrate truths verified; 5 operator-execution gates queued (per Pitfall 19 substrate-honest)
overrides_applied: 0
re_verification: null
substrate_branch: B
substrate_branch_rationale: |
  Wave 5 selected Branch B because the D-22 ToS gate (firebaseauth.googleapis.com)
  remained operator-deferred at Phase 7 close. Wave 6 honoured Branch B by
  documenting FN-06 minInstances:1 + cold-start p99 ≤ 4s as a sub-wave 7.1
  carry-forward in runbooks/phase-7-cleanup-ledger.md, REQUIREMENTS.md row,
  SECURITY.md § Cloud Functions Workspace, and SECURITY.md Phase 7 Audit Index
  rows 14 + 16. Per Pitfall 19, this is substrate-honest carry-forward, not
  hidden gap. All 17 Phase 7 requirement IDs (FN-01..09, AUDIT-01..04, AUDIT-06,
  AUDIT-07, TEST-09, DOC-10) are accounted for at the substrate level.
human_verification:
  - test: "App Check Stage A — register reCAPTCHA Enterprise site key + App Check provider in Firebase Console"
    expected: "Site key created in GCP Console; App Check provider registered for Web app `1:76749944951:web:9d0db9603ecaa7cc5fee72`; debug token generated and pasted into operator's local `.env.local` (gitignored)"
    why_human: "Firebase Console + GCP Console UI navigation; secret key handling; cannot run non-interactively. Substrate (`src/firebase/check.js` body fill + `.env.example` + `vite.config.js` build guard) shipped Wave 3 commit `3bc2c6f`."
    closes_substrate: "07-HUMAN-UAT.md Test 1; FN-07 Console-side enrolment"
  - test: "App Check Stage B — 70% quota alert in GCP Console"
    expected: "Assessments quota alert at 70% of 10k assessments/month; notification channel = `business@bedeveloped.com`"
    why_human: "GCP Console bell-icon → Create alert flow; no programmatic equivalent fits this app's narrow IaC scope."
    closes_substrate: "07-HUMAN-UAT.md Test 2; FN-08 quota guardrail"
  - test: "App Check Stage C — 7-day production soak start + daily verified-vs-unverified ratio ≥95%"
    expected: "Day-1 + Days 2-7 + Day-7 gate passed; runbook `runbooks/phase-7-app-check-enforcement.md` Stage C daily ratio log filled; `soak_passed: YES`"
    why_human: "Firebase Console dashboard inspection over 7+ consecutive days; calendar-pacing — no automation can compress the window."
    closes_roadmap_sc: "Phase 7 SC#2 (the 7-day soak gate)"
  - test: "App Check Stage D — Storage enforcement (Day 8+)"
    expected: "Cloud Storage for Firebase enforcement flipped to Enforced; upload smoke test 200 from baselayers.bedeveloped.com (incognito + signed-in); failed-auth smoke (debug token cleared) returns 401/403"
    why_human: "Firebase Console toggle + browser smoke from real client session — lowest-blast-radius enforcement (Storage = uploads only)."
    closes_substrate: "07-HUMAN-UAT.md Test 4"
  - test: "App Check Stage E — Firestore enforcement collection-by-collection (Day 9+)"
    expected: "Per-collection enforcement flipped in verbatim order auditLog → internalAllowlist → softDeleted → messages → comments → documents → responses → actions; ≥1h between collections; per-collection read+write smoke + no-token denial smoke"
    why_human: "Highest-blast-radius service; Firebase Console UI + browser smoke; per-collection rollback flexibility is the load-bearing design choice."
    closes_substrate: "07-HUMAN-UAT.md Test 5"
  - test: "App Check Stage F — Cloud Functions enforcement (Day 14+)"
    expected: "All 4 callables (setClaims, auditWrite, softDelete, gdprExportUser) declare enforceAppCheck:true; Cloud Functions enforcement flipped; per-callable smoke from real client session returns 200; no-token callable smoke returns unauthenticated HttpsError"
    why_human: "Firebase Console toggle + per-callable smoke; final stage closing App Check rollout end-to-end."
    closes_substrate: "07-HUMAN-UAT.md Test 6"
    closes_roadmap_sc: "Phase 7 SC#2 (full per-service enforcement landed)"
  - test: "BigQuery audit sink bootstrap script run + T+1h verification"
    expected: "Operator runs `gcloud auth application-default login` then `node scripts/enable-bigquery-audit-sink/run.js --project=bedeveloped-base-layers`; script exits 0; dataset created in europe-west2 with default_table_expiration=220752000s (7 years); sink `audit-logs-bq` created with --use-partitioned-tables; sink writer SA bound to roles/bigquery.dataEditor. At T+1h, `SELECT COUNT(*) FROM cloudaudit_googleapis_com_data_access_*` returns row_count > 0."
    why_human: "Operator ADC + project IAM admin role; gcloud projects set-iam-policy + bq mk + gcloud logging sinks create. Substrate (script + runbook) ships Wave 5 commit `0950d94`."
    closes_substrate: "AUDIT-03 + AUDIT-06 (Pitfall 17 closure); 07-HUMAN-UAT.md Test 7"
    closes_roadmap_sc: "Phase 7 SC#4 (BigQuery sink + 7y retention live)"
  - test: "Admin dataViewer bindings on BigQuery dataset"
    expected: "For each internalAllowlist `role:admin` email, run `gcloud projects add-iam-policy-binding bedeveloped-base-layers --member=user:<email> --role=roles/bigquery.dataViewer`; runbook updated with bound emails + timestamps + total count"
    why_human: "Operator-paced Firestore inspection + per-email IAM binding; mirrors scripts/provision-function-sas shell-out-only pattern."
    closes_substrate: "07-HUMAN-UAT.md Test 8; T-07-05-02 mitigation"
  - test: "D-22 ToS gate resolution + sub-wave 7.1 minInstances:1 + cold-start p99 ≤ 4s"
    expected: "Operator visits https://console.cloud.google.com/apis/library/firebaseauth.googleapis.com?project=bedeveloped-base-layers; clicks Enable; accepts ToS as business@bedeveloped.com Workspace admin; ~30s wait for `gcp-sa-firebaseauth` auto-provisioning; rebind SA to roles/run.invoker on 4 Cloud Run services; re-PATCH IdP `blockingFunctions.triggers` to restore the 4 URLs in 06-PREFLIGHT.md cutover log. After D-22 resolves, sub-wave 7.1 lands `minInstances:1` + cpu:1 + memory:256MiB + serviceAccount:auth-blocking-sa@ on `beforeUserCreated` + `beforeUserSignedIn`; selective deploy; record cold-start p99 ≤ 4s baseline in `runbooks/phase-7-cold-start-baseline.md`."
    why_human: "Workspace admin role on business@bedeveloped.com required; ToS acceptance click is not programmatically scriptable; gcloud SDK ADC + project IAM admin needed for SA invoker rebinding."
    closes_substrate: "07-HUMAN-UAT.md Test 9 + sub-wave 7.1 row 1 + 2 (D-22 + FN-06)"
    closes_roadmap_sc: "Phase 7 SC#6 (deferred from Wave 5 to sub-wave 7.1 per Branch B)"
---

# Phase 7: Cloud Functions + App Check (Trusted-Server Layer) Verification Report

**Phase Goal:** A trusted-server boundary exists with audit logging, rate limiting, secret management, and App Check perimeter — the substrate every later phase depends on.
**Verified:** 2026-05-10
**Status:** human_needed (PASS-PARTIAL Branch B — substrate complete; 9 operator-execution gates queued per Pitfall 19)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| #  | Truth (ROADMAP SC)                                                                                                                                                                       | Status                              | Evidence                                                                                                                                                                                                                                                                                                                                                                                              |
| -- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1  | functions/ workspace builds + tests + deploys cleanly; every callable enforces App Check, Zod-validates, idempotency-marks, Sentry-captures, runs as own minimal-IAM SA                  | VERIFIED (substrate)                | `functions/src/auth/setClaims.ts:47-48`, `functions/src/audit/auditWrite.ts:44-45`, `functions/src/ratelimit/checkRateLimit.ts:44-45` all declare enforceAppCheck:true + serviceAccount:<sa-name>; `functions/src/util/{idempotency,zod-helpers,sentry}.ts` shared helpers (242 lines total); 6 SAs scripted via `scripts/provision-function-sas/run.js` (311 lines); functions tests 133/133 pass     |
| 2  | App Check enrolled with reCAPTCHA Enterprise; per-env site keys; debug tokens in `.env.local` only; ≥7-day soak in unenforced; enforcement flipped per service Storage→Firestore→Functions; 70% quota alert | PARTIAL (substrate landed; 6 operator gates) | `src/firebase/check.js` body-filled (52 LOC, ReCaptchaEnterpriseProvider); `.env.example` documents site-key + debug-token; `vite.config.js` production fail-closed guard; `runbooks/phase-7-app-check-rollout.md` (405 lines, Stages A-F). Stages A-C operator-paced (07-HUMAN-UAT.md Tests 1-3); Stages D-F operator-paced (Tests 4-6).                                                              |
| 3  | auditLog/{eventId} rejects all client writes; only auditWrite Cloud Function (Admin SDK) writes; audited user CANNOT read own audit records                                              | VERIFIED                            | `firestore.rules:131-` `match /auditLog/{eventId}` `allow read: if isAdmin(); allow write: if false`; `tests/rules/auditLog.test.js` 8 cells (4 write-deny + 3 read-deny + 1 admin-allow; cell 7 = AUDIT-07 audited-self read deny); `functions/src/audit/auditWrite.ts:84` calls `writeAuditEvent` via Admin SDK only                                                                                |
| 4  | Cloud Logging Data Access logs sunk to BigQuery `audit_logs_bq` 7y retention; mirror Firestore-trigger writers (onOrgDelete, onUserDelete, onDocumentDelete) fire end-to-end             | PARTIAL (substrate landed; T+1h gate operator-paced) | `scripts/enable-bigquery-audit-sink/run.js` (idempotent ADC; 7y default_table_expiration); `functions/src/audit/triggers/{onOrgDelete,onUserDelete,onDocumentDelete}.ts` (275 LOC total) deployed with audit-mirror-sa SA pin + 60s primary-event dedup; integration tests 6/6 pass per trigger. T+1h `bq query COUNT(*) > 0` operator gate (07-HUMAN-UAT.md Test 7).                                  |
| 5  | Rate limiting on chat/comment writes is enforced (rules predicate primary; callable fallback); 31-write synthetic burst confirms                                                         | VERIFIED                            | `firestore.rules:32-42` rateLimitWindow + rateLimitOk(uid) helpers; lines 72, 101 compose rateLimitOk into messages + comments create rules; `tests/rules/rate-limit.test.js` 15 cells incl. cell 13 (31st-message denies — Phase 7 SC#5 burst); `src/data/rate-limit.js` runTransaction helper; `functions/src/ratelimit/checkRateLimit.ts` deployed-but-unwired Pattern 5b fallback seam       |
| 6  | Auth-blocking functions have minInstances:1; cold-start observed p99 ≤ 4s; secrets via defineSecret() exclusively                                                                        | PARTIAL (defineSecret VERIFIED; minInstances + cold-start carried to sub-wave 7.1 per Branch B) | defineSecret VERIFIED: `grep -rn "process\.env\." functions/src/` returns ONLY `functions/src/util/sentry.ts` (controlled init). minInstances:1 + cold-start p99: NOT shipped — Wave 5 selected Branch B because D-22 ToS gate left auth-blocking handlers uninvokeable. Carry-forward documented in `runbooks/phase-7-cleanup-ledger.md` sub-wave 7.1 (commit `fece260` doc pin) per Pitfall 19. |

**Score:** 6/6 truths VERIFIED at substrate level (4 fully + 2 PARTIAL with substrate-honest carry-forward). 9 operator-execution gates queued in 07-HUMAN-UAT.md.

### Required Artifacts (PLAN must_haves cross-reference)

| Artifact                                                       | Expected (PLAN must_haves)                                       | Status     | Details                                                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `functions/src/util/idempotency.ts`                            | ensureIdempotent helper with sharded marker doc                  | VERIFIED   | 106 LOC; sharded by `key.slice(0,2).padEnd(2,"0")` per Pitfall 6; 8 unit tests (idempotency.unit.test.ts)     |
| `functions/src/util/zod-helpers.ts`                            | validateInput<S>(schema, input) → HttpsError                     | VERIFIED   | 34 LOC; uses Zod 4 `issues` API; 4 unit tests                                                                  |
| `functions/src/util/sentry.ts`                                 | withSentry(handler) + PII-scrubbing beforeSend (Pitfall 18)      | VERIFIED   | 102 LOC; `sendDefaultPii: false`; PII scrubber strips authorization/cookie/email/name/ip; 7 unit tests       |
| `functions/src/audit/auditEventSchema.ts`                      | auditEventInput Zod schema + 25-entry enum + 3 mirror values     | VERIFIED   | 71 LOC; AuditEventInput type exported; 8 unit tests                                                            |
| `functions/src/audit/auditLogger.ts`                           | Pure buildAuditEventDoc + Admin-SDK writeAuditEvent              | VERIFIED   | 116 LOC; pure layer firebase-admin-free per Pattern C; lazy import preserves purity; 6 unit tests              |
| `functions/src/auth/setClaims.ts` (hardened)                   | Pattern A: enforceAppCheck + Zod + idempotency + Sentry + SA     | VERIFIED   | 85 LOC; lines 47-48 confirm enforceAppCheck:true + serviceAccount:claims-admin-sa; line 53 withSentry; line 58 validateInput; line 61 ensureIdempotent; poke-pattern preserved |
| `functions/src/audit/auditWrite.ts`                            | Pattern A callable; audit-writer-sa; Admin SDK writeAuditEvent   | VERIFIED   | 110 LOC; Pitfall 17 actor sourced from request.auth.token only; 12 wiring unit tests + 4 integration tests   |
| `functions/src/audit/triggers/onOrgDelete.ts`                  | v2 onDocumentDeleted on orgs/{orgId}; 60s dedup; mirror enum     | VERIFIED   | 86 LOC; serviceAccount:audit-mirror-sa; queries `data.org.softDelete` within 60s before mirror write          |
| `functions/src/audit/triggers/onUserDelete.ts`                 | Auth-event trigger on user delete; mirror writer                 | VERIFIED   | 106 LOC; v1 fallback (`auth.user().onDelete()`) because firebase-functions 7.2.5 v2/identity has no onUserDeleted; SA pinned to `audit-mirror-sa@` (v1 validation requires @ shorthand) |
| `functions/src/audit/triggers/onDocumentDelete.ts`             | v2 onDocumentDeleted on orgs/{orgId}/documents/{docId}; mirror   | VERIFIED   | 83 LOC; 60s dedup against `data.document.delete`; serviceAccount:audit-mirror-sa                              |
| `functions/src/ratelimit/checkRateLimit.ts`                    | Pattern A fallback callable (Pattern 5b deployed-but-unwired)    | VERIFIED   | 93 LOC; Pattern A shape; ratelimit-sa SA; bound to 60s window matching rules predicate; 10 unit + 2 integration tests |
| `functions/src/csp/cspReportSink.ts` (rebound)                 | csp-sink-sa SA pin (FN-04); Pitfall 8 selective-deploy guidance  | VERIFIED   | 124 LOC; line 52 confirms `serviceAccount: "csp-sink-sa"`; header comment documents Pitfall 8                 |
| `scripts/provision-function-sas/run.js`                        | 6-SA idempotent ADC script (Pattern E)                           | VERIFIED   | 311 LOC; node --check passes; --dry-run + --project + --help flags; mirrors seed-internal-allowlist pattern    |
| `scripts/enable-bigquery-audit-sink/run.js`                    | Idempotent ADC script for BQ sink + 7y retention (Pattern F)     | VERIFIED   | Built; node --check passes; europe-west2 dataset + --use-partitioned-tables sink + dataEditor binding         |
| `src/firebase/check.js` (body-filled)                          | initAppCheck with ReCaptchaEnterpriseProvider; PROD fail-closed  | VERIFIED   | 56 LOC; line 22 imports initializeAppCheck + ReCaptchaEnterpriseProvider; SITE_KEY from import.meta.env; DEV/PROD branches |
| `src/firebase/auth.js` (BLOCKER-FIX 1)                         | updatePassword wires setClaims + getIdToken(true) post-success   | VERIFIED   | Lines 14-20 + 90-96 document the wiring; setClaims imported from cloud/claims-admin.js                        |
| `src/cloud/audit.js` (body-filled)                             | writeAuditEvent wraps httpsCallable("auditWrite") + retry        | VERIFIED   | Body filled; clientReqId via crypto.randomUUID() per call; withRetry({retries:3, baseMs:250})                 |
| `src/cloud/retry.js` (body-filled)                             | Exponential backoff + 8 non-retryable HttpsError code passthrough | VERIFIED   | Body filled; CSPRNG jitter (Math.random forbidden by ESLint); 8 non-retryable codes propagate immediately     |
| `src/cloud/checkRateLimit.js` (NEW)                            | Pattern 5b activation seam                                       | VERIFIED   | New file; activation path documented inline (operator hot-swap)                                                |
| `src/cloud/claims-admin.js` (clientReqId addition)             | crypto.randomUUID() per setClaims call                           | VERIFIED   | Wave 5 commit `21d23d6`; clientReqId generated per call (Wave 1 SetClaimsSchema requirement)                  |
| `tests/rules/auditLog.test.js`                                 | 8 cells: 4 write-deny + 3 read-deny + 1 admin-allow              | VERIFIED   | 128 LOC; cells discovered via vitest list; cell 7 = AUDIT-07 (internal user reading own row denies)           |
| `tests/rules/rate-limit.test.js`                               | 15 cells incl. 31-write SC#5 burst (cell 13)                     | VERIFIED   | 391 LOC; 11 bucket-direct + 4 composed-predicate cells; cell 13 = 31st-message-denies                          |
| `functions/test/integration/*.integration.test.ts` (8 files)   | TEST-09 firebase-functions-test 3.5.0 coverage                   | VERIFIED   | 8 files for auditWrite + 3 mirrors + setClaims + 2 auth-blocking + checkRateLimit; 20 tests; 133/133 pass     |
| `functions/test/_mocks/admin-sdk.ts`                           | Shared in-memory Admin SDK mock (Pattern 11 offline mode)        | VERIFIED   | 211 LOC; getFirestoreMock/getAuthMock/FieldValueMock + adminMockState helpers                                  |
| `runbooks/phase-7-app-check-rollout.md`                        | Operator runbook for Stages A-F                                  | VERIFIED   | 405 LOC; per-stage Console URLs + verification protocol + rollback paths                                       |
| `runbooks/phase-7-app-check-enforcement.md`                    | Evidence-pack runbook                                            | VERIFIED   | 160 LOC; per-stage YAML evidence sections + Wave 6 close gate (PASS-PARTIAL acceptance)                       |
| `runbooks/phase-7-bigquery-sink-bootstrap.md`                  | BQ sink run + T+1h verification framework                        | VERIFIED   | Documented; Wave 5 commit `0950d94`                                                                           |
| `runbooks/phase-7-d22-tos-gate-resolution.md`                  | Branch B verification log + resolution path                      | VERIFIED   | Wave 5 commit `6bedf09`; Branch B selection rationale + closure path for sub-wave 7.1                         |
| `runbooks/phase-7-cleanup-ledger.md` (Pattern H)               | phase_7_active_rows: 0; sub-wave 7.1 carry-forward; Phase 8-12 forward-tracking | VERIFIED   | `phase_7_active_rows: 0`; gate_status: PASS-PARTIAL Branch B; 11 closed rows + 6 sub-wave 7.1 + 10 forward-tracking |
| `SECURITY.md` (5 new sections + Phase 7 Audit Index)           | Pattern G 16-row audit index (15 mandatory + 1 D-22 status)      | VERIFIED   | `grep -c "^## § " SECURITY.md` = 23 (was 18; 5 new); awk extract Phase 7 Audit Index → 18 table rows = 1 header + 1 separator + 16 data rows |
| `07-HUMAN-UAT.md`                                              | 9 operator-execution items                                       | VERIFIED   | Tests 1-9 cover Stages A-F + BQ sink + dataViewer + D-22 carry-forward                                         |

### Key Link Verification (Wiring)

| From                                          | To                                              | Via                                                                                | Status   | Details                                                                                                  |
| --------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `functions/src/auth/setClaims.ts`             | `functions/src/util/idempotency.ts`             | `ensureIdempotent(...)` line 61                                                    | WIRED    | Import line 31 + call line 61 verified via grep                                                          |
| `functions/src/auth/setClaims.ts`             | `functions/src/util/zod-helpers.ts`             | `validateInput(SetClaimsSchema, request.data)` line 58                             | WIRED    | Import line 30 + call line 58 verified                                                                    |
| `functions/src/auth/setClaims.ts`             | `functions/src/util/sentry.ts`                  | `withSentry(handler)` line 53                                                      | WIRED    | Import line 29 + wrap line 53 verified                                                                    |
| `functions/src/audit/auditWrite.ts`           | `functions/src/audit/auditLogger.ts`            | `writeAuditEvent(...)` Admin SDK write to `auditLog/${eventId}`                    | WIRED    | Pure-layer firebase-admin-free; Admin-SDK layer lazy-imported                                            |
| `functions/src/audit/auditWrite.ts`           | `functions/src/util/idempotency.ts`             | `ensureIdempotent('${actorUid}:${type}:${target.id}:${clientReqId}', 'auditWrite', 300)` line 58 | WIRED    | Verified                                                                                                  |
| `functions/src/audit/triggers/onOrgDelete.ts` | `auditLog/{eventId}`                            | `writeAuditEvent` with type=`data.org.delete.mirror` after 60s primary-event dedup | WIRED    | grep `data.org.delete.mirror` returns line 53; 60s dedup query verified                                   |
| `functions/src/ratelimit/checkRateLimit.ts`   | `functions/src/util/{sentry,zod-helpers,idempotency}.ts` | Pattern A overlay applied                                                          | WIRED    | Lines 25-27 imports; Pattern A shape applied                                                              |
| `firestore.rules`                             | `rateLimits/{uid}/buckets/{windowStart}` predicate | `rateLimitWindow()` + `rateLimitOk(uid)` composed into messages + comments create  | WIRED    | Lines 32, 40-42 helpers; lines 72, 101 composition; line 148 collection predicate                        |
| `firestore.rules` `match /auditLog/{eventId}` | Server-only access                              | `allow read: if isAdmin(); allow write: if false`                                  | WIRED    | Line 132; pinned by tests/rules/auditLog.test.js cells 1-4 (write deny) + cell 7 (audited-self read deny) |
| `src/firebase/auth.js#updatePassword`         | `src/cloud/claims-admin.js#setClaims`           | After `fbUpdatePassword` resolves, claim re-flip + `getIdToken(true)`              | WIRED    | Lines 14-20 + 90-96 (BLOCKER-FIX 1, Wave 5 commit `21d23d6`); try/catch best-effort swallow              |
| `src/cloud/claims-admin.js`                   | `setClaims` callable                            | `httpsCallable(functions, 'setClaims')` with `clientReqId: crypto.randomUUID()`    | WIRED    | Wave 5 added clientReqId per Wave 1 SetClaimsSchema requirement                                          |
| `src/cloud/audit.js#writeAuditEvent`          | `auditWrite` callable                           | `httpsCallable(functions, 'auditWrite')` + `withRetry({retries:3, baseMs:250})`    | WIRED    | Body-filled Wave 6 commit `3e0bc9f`; crypto.randomUUID() clientReqId per call                            |

### Data-Flow Trace (Level 4)

| Artifact                                  | Data Variable / Flow                              | Source                                                                                              | Produces Real Data                  | Status   |
| ----------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- | -------- |
| `auditWrite` callable response            | `{ ok: true, eventId }`                           | `crypto.randomUUID()` + Admin SDK Firestore set on `auditLog/${eventId}`                            | YES                                 | FLOWING  |
| `onOrgDelete` mirror trigger output       | `auditLog/{mirrorEventId}` doc                    | Eventarc Firestore deletion event + 60s dedup query against `auditLog`                              | YES (when no primary within 60s)    | FLOWING  |
| `firestore.rules#rateLimitOk(uid)`        | bucket count read                                 | Single `get()` against `rateLimits/{uid}/buckets/{currentWindow}`                                    | YES (count from prior writes)       | FLOWING  |
| `src/cloud/audit.js#writeAuditEvent`      | callable response forwarded to caller              | `httpsCallable("auditWrite")` HTTPS call with retry                                                  | YES (when callable deployed)        | FLOWING (operator-paced live verification deferred to Wave 5+ deploy cycle) |
| `src/firebase/check.js#initAppCheck`      | App Check token attached to subsequent SDK calls  | reCAPTCHA Enterprise provider via `import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`               | YES once Stage A operator enrols    | FLOWING (substrate; live emit gated on operator Console enrolment Test 1)   |
| `scripts/enable-bigquery-audit-sink`      | BigQuery dataset + sink + auditConfigs            | `gcloud projects set-iam-policy` + `bq mk` + `gcloud logging sinks create`                          | YES once operator runs script        | FLOWING (script ships substrate; live ingest gated on Test 7 T+1h verification) |

### Behavioural Spot-Checks

| Behaviour                                                           | Command                                                                                                          | Result                                                                                  | Status |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| functions/ workspace tests pass                                     | `cd functions && npm test`                                                                                       | 133/133 pass (113 baseline + 20 TEST-09 integration)                                    | PASS   |
| Root tests pass                                                     | `npm test` (root)                                                                                                | 571/571 pass                                                                            | PASS   |
| functions/ typecheck                                                | `cd functions && npm run typecheck`                                                                              | exits 0                                                                                  | PASS   |
| functions/ lint                                                     | `cd functions && npm run lint`                                                                                   | exits 0                                                                                  | PASS   |
| Phase 7 file inventory                                              | listing of `functions/src/{audit,audit/triggers,auth,util,ratelimit,csp}/` + `functions/test/integration/`         | 12 source files + 8 integration test files + shared mock all present                    | PASS   |
| Pattern A standardisation                                           | `grep -rn "enforceAppCheck:" functions/src/`                                                                     | 4 hits: setClaims.ts:47, auditWrite.ts:44, checkRateLimit.ts:44, cspReportSink (allUsers public per browser CSP semantics — no enforceAppCheck) | PASS   |
| Per-function SA inventory                                           | grep `serviceAccount` in functions/src                                                                           | 6 distinct SA names found: claims-admin-sa, audit-writer-sa, audit-mirror-sa(@), ratelimit-sa, csp-sink-sa, auth-blocking-sa(documented for sub-wave 7.1) | PASS   |
| `defineSecret` exclusivity (FN-05)                                  | `grep -rn "process\.env\." functions/src/`                                                                       | Only `functions/src/util/sentry.ts` reads SENTRY_DSN (controlled init)                  | PASS   |
| auditLog rules contract                                             | `grep -nE "auditLog/" firestore.rules`                                                                           | Line 132 `match /auditLog/{eventId}`; `allow read: if isAdmin(); allow write: if false` | PASS   |
| rateLimitOk composed into messages + comments                       | `grep -n "rateLimitOk" firestore.rules`                                                                          | Line 40 helper; line 72 messages create; line 101 comments create                        | PASS   |
| SECURITY.md 5 new Phase 7 sections                                  | `grep -c "^## § " SECURITY.md`                                                                                   | 23 (was 18 pre-Phase-7; 5 new: Cloud Functions Workspace, App Check, Audit Log Infrastructure, Rate Limiting, Phase 7 Audit Index) | PASS   |
| Phase 7 Audit Index row count                                       | `awk '/§ Phase 7 Audit Index/,/^---$/' SECURITY.md \| grep -cE '^\\|'`                                          | 18 (1 header + 1 separator + 16 data rows = 15 mandatory + 1 D-22 closure status)        | PASS   |
| Cleanup-ledger zero-out gate                                        | `grep -E "phase_7_active_rows: 0\|gate_status:" runbooks/phase-7-cleanup-ledger.md`                              | `phase_7_active_rows: 0` and `gate_status: PASS-PARTIAL (Branch B)` confirmed           | PASS   |
| Sub-wave 7.1 carry-forward queued                                   | `grep -E "sub-wave 7\\.1" runbooks/phase-7-cleanup-ledger.md`                                                    | 6 carry-forward rows queued: D-22, FN-06 minInstances, App Check D/E/F, BQ T+1h, typecheck-cleanup, cspReportSink invoker rebind | PASS   |

### Requirements Coverage

| Requirement | Source Plan(s)        | Description                                                    | Status                | Evidence                                                                                                                                                |
| ----------- | --------------------- | -------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FN-01       | 07-01, 07-02          | functions/ workspace exists; TS; Node 22; 2nd-gen exclusive    | SATISFIED             | functions/ workspace shipped; firebase-functions 7.2.5 2nd-gen; v1 namespace fallback for `auth.user().onDelete()` only (firebase-functions 7.2.5 v2/identity has no onUserDeleted) |
| FN-02       | 07-01                 | firebase-admin@13.x + firebase-functions@7.x in functions/     | SATISFIED             | functions/package.json: firebase-admin 13.9.0; firebase-functions 7.2.5                                                                                |
| FN-03       | 07-01, 07-02, 07-04   | App Check + Zod + idempotency + Sentry on every callable       | SATISFIED             | Pattern A applied to setClaims (Wave 1) + auditWrite (Wave 2) + checkRateLimit (Wave 4); 4 callables grep enforceAppCheck:true                          |
| FN-04       | 07-01, 07-02, 07-04, 07-05 | Each function runs as own minimal-IAM SA                       | SATISFIED (substrate) | 6 SAs scripted in scripts/provision-function-sas/run.js; per-function `serviceAccount:` declared on every callable + trigger; cspReportSink rebound Wave 5 |
| FN-05       | 07-01                 | Secrets via defineSecret(), never env vars                     | SATISFIED             | `defineSecret("SENTRY_DSN")` in setClaims, auditWrite, checkRateLimit; grep `process.env.` only in functions/src/util/sentry.ts (controlled init)        |
| FN-06       | 07-05 (Branch B)      | Auth-blocking minInstances:1; cold-start p99 ≤ 4s              | PARTIAL (sub-wave 7.1) | Documentation pin landed in beforeUserCreated.ts + beforeUserSignedIn.ts (commit `fece260`); `minInstances:1` + p99 measurement queued in runbooks/phase-7-cleanup-ledger.md sub-wave 7.1 because D-22 ToS gate left auth-blocking handlers uninvokeable. **Branch B substrate-honest disclosure per Pitfall 19.** |
| FN-07       | 07-01, 07-03          | App Check enrolled with reCAPTCHA Enterprise; per-env keys     | SATISFIED (substrate; Console enrolment operator-paced) | enforceAppCheck:true on every Phase 7 callable; src/firebase/check.js body-filled; .env.example documents env var names; vite.config.js production guard. Console-side enrolment Test 1 in 07-HUMAN-UAT.md |
| FN-08       | 07-03                 | App Check rolled out in stages Storage→Firestore→Functions     | SATISFIED (substrate) | Stages A-C substrate landed; Stages D-F per-service enforcement queued in 07-HUMAN-UAT.md Tests 4-6                                                     |
| FN-09       | 07-04                 | Rate limiting on chat/comment writes                           | SATISFIED             | Primary path: firestore.rules rateLimitOk(uid) predicate; fallback: checkRateLimit callable Pattern 5b; 31-write SC#5 burst test cell 13 confirms      |
| AUDIT-01    | 07-02                 | auditLog/{eventId} server-only writes via auditWrite callable  | SATISFIED             | functions/src/audit/auditWrite.ts deployed; rules `allow write: if false` pinned by tests/rules/auditLog.test.js cells 1-4; integration test 4 cells   |
| AUDIT-02    | 07-01                 | Audit-event schema with server-set fields (Pitfall 17)         | SATISFIED             | functions/src/audit/auditEventSchema.ts (25-entry enum + 3 mirror values); functions/src/audit/auditLogger.ts buildAuditEventDoc overlays server fields |
| AUDIT-03    | 07-05                 | BigQuery sink to audit_logs_bq with 7y retention               | SATISFIED (substrate; T+1h gate operator-paced) | scripts/enable-bigquery-audit-sink/run.js (idempotent ADC, Pattern F); runbooks/phase-7-bigquery-sink-bootstrap.md; T+1h `bq query COUNT(*) > 0` Test 7 in HUMAN-UAT |
| AUDIT-04    | 07-02                 | Mirror Firestore/Auth-trigger audit writers                    | SATISFIED             | 3 mirror triggers deployed (onOrgDelete v2, onUserDelete v1, onDocumentDelete v2); 60s primary-event dedup; 10 wiring tests + 6 integration tests       |
| AUDIT-06    | 07-05, 07-06          | Audit log retention (12mo online + 7y archival)                | SATISFIED             | scripts/enable-bigquery-audit-sink configures `default_table_expiration_ms: 220_752_000_000` (7y); SECURITY.md § Audit Log Infrastructure pins policy   |
| AUDIT-07    | 07-02                 | Audited user CANNOT read own audit records                     | SATISFIED             | tests/rules/auditLog.test.js cell 7 (internal user reading auditLog row where actor.uid == own uid → DENY); pinned by rules `allow read: if isAdmin()` |
| TEST-09     | 07-06                 | firebase-functions-test integration suite                       | SATISFIED             | 8 integration test files at functions/test/integration/*.integration.test.ts; 20 tests covering auditWrite (4) + 3 mirrors (6) + setClaims (4) + 2 auth-blocking (4) + checkRateLimit (2); 133/133 functions tests pass |
| DOC-10      | 07-06                 | Phase 7 increment to SECURITY.md                                | SATISFIED             | 5 new sections appended (commit `a832c96`): Cloud Functions Workspace + App Check + Audit Log Infrastructure + Rate Limiting + Phase 7 Audit Index (16 data rows, Pattern G); REQUIREMENTS.md DOC-10 row updated with Phase 7 Wave 6 increment |

**No orphaned requirements** — all 17 phase REQ-IDs (FN-01..09 + AUDIT-01..04 + AUDIT-06..07 + TEST-09 + DOC-10) accounted for across 6 plans.

### Anti-Patterns Found

| File                                                         | Line       | Pattern                              | Severity | Impact                                                                                                                       |
| ------------------------------------------------------------ | ---------- | ------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| (none — Phase 7 introduces no blocker anti-patterns)         | —          | —                                    | —        | —                                                                                                                            |
| `functions/src/auth/{beforeUserCreated,beforeUserSignedIn}.ts` | (header comment) | Documentation pin: `minInstances:1` deferred per Branch B | INFO    | Carry-forward to sub-wave 7.1 — substrate-honest disclosure per Pitfall 19; not a blocker because the auth-blocking handlers are uninvokeable until D-22 resolves |
| `src/firebase/check.js`                                      | (4 typecheck issues) | Pre-existing typecheck noise (`import.meta.env` lacks vite/client reference type) | INFO | Logged in deferred-items.md; pre-existing on base commit f3c2905; not introduced by Phase 7 — out-of-scope per scope-boundary rule |

### Human Verification Required

See `human_verification` frontmatter section above for the structured list. 9 operator-execution gates queued in 07-HUMAN-UAT.md:

1. **Stage A** — reCAPTCHA Enterprise site key + App Check provider registration in Firebase Console (Test 1)
2. **Stage B** — 70% quota alert config in GCP Console (Test 2)
3. **Stage C** — 7-day production soak start + daily ≥95% verified-ratio gate (Test 3)
4. **Stage D** — App Check enforcement on Storage (Test 4)
5. **Stage E** — App Check enforcement on Firestore (collection-by-collection in verbatim order auditLog → internalAllowlist → softDeleted → messages → comments → documents → responses → actions) (Test 5)
6. **Stage F** — App Check enforcement on Cloud Functions (Test 6)
7. **BigQuery sink bootstrap script run + T+1h verification** — operator runs `gcloud auth application-default login` then `node scripts/enable-bigquery-audit-sink/run.js` then `bq query COUNT(*) > 0` (Test 7)
8. **Admin dataViewer bindings on BigQuery dataset** — per-email IAM binding for internalAllowlist `role:admin` users (Test 8)
9. **D-22 ToS gate resolution + sub-wave 7.1 minInstances:1 + cold-start p99 ≤ 4s** — operator clicks Enable on firebaseauth.googleapis.com + accepts ToS as Workspace admin; rebinds `gcp-sa-firebaseauth` SA + re-PATCHes IdP `blockingFunctions.triggers`; sub-wave 7.1 lands minInstances:1 deploy + cold-start p99 baseline (Test 9; closes SC#6 fully)

### Gaps Summary

**No goal-blocking gaps detected at the substrate level.** Phase 7 ships a complete, substrate-honest trusted-server boundary:

- All 17 phase REQ-IDs accounted for; 14 fully SATISFIED, 3 SATISFIED-substrate (FN-04, AUDIT-03, FN-08 — operator-paced ratification queued); FN-06 PARTIAL with explicit Branch B carry-forward to sub-wave 7.1 per Pitfall 19.
- Pattern A standard callable shape applied to all 4 hardened callables (setClaims, auditWrite, checkRateLimit; cspReportSink intentionally allUsers per browser CSP semantics).
- Pattern C purity contract honoured — pure-logic helpers (idempotency / zod-helpers / sentry / auditEventSchema / auditLogger pure layer) are firebase-admin-free.
- Pattern D rules-unit-tests pin AUDIT-01 client-write deny matrix (4 cells), AUDIT-07 audited-self read deny (cell 7), and FN-09 rate-limit predicate including Phase 7 SC#5 31-write burst (cell 13).
- Pattern E one-shot ADC scripts shipped (provision-function-sas + enable-bigquery-audit-sink).
- Pattern G SECURITY.md Phase 7 Audit Index has 16 data rows (15 mandatory + 1 D-22 closure status) — each row a 4-tuple control / code path / test / framework citation per Pitfall 19.
- Pattern H `runbooks/phase-7-cleanup-ledger.md` zero-out gate active (`phase_7_active_rows: 0`); 11 closed rows + 6 sub-wave 7.1 carry-forward + 10 forward-tracking across Phase 8/9/10/11/12.
- 133/133 functions tests + 571/571 root tests + 0 lint + 0 typecheck errors in functions/.
- Pitfall 8 selective-deploy compliance: zero workspace-wide `firebase deploy --only functions` invocations recorded across Phase 7 SHA range `4410375..25700b3`.

**Status `human_needed` is the correct verification outcome** because the 9 operator-execution gates above are calendar-paced or require Console-UI / Workspace admin / gcloud ADC permissions Claude cannot execute non-interactively. Substrate is complete; live ratification is the operator's path. Mirrors the Phase 3 + Phase 5 + Phase 6 deferred-operator-execution precedent.

---

_Verified: 2026-05-10_
_Verifier: Claude (gsd-verifier)_
