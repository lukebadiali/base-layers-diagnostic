# Phase 7 Cleanup Ledger

> Phase 7 Wave 6 (07-06) deliverable. Closes the 4 Phase 6 forward-tracking rows (auditLog writer FN-01/AUDIT-01..04; rateLimits predicate FN-09; setClaims hardening FN-03+FN-07; firebase-functions-test integration coverage TEST-09) + a subset of the Phase 6 sub-wave 6.1 carry-forward rows (BLOCKER-FIX 1 setClaims-after-password-update wiring; cspReportSink redeploy follow-through; D-22 ToS gate — substrate-honest under Branch B). Queues forward-tracking rows for Phase 8 / 9 / 10 / 11 / 12. Mirrors `runbooks/phase-6-cleanup-ledger.md` Pattern H shape.
>
> Substrate-honest (Pitfall 19): the Wave 5 Branch B selection (D-22 still operator-deferred at Phase 7 close) means Task 5 of Wave 5 (`minInstances:1` restoration + cold-start p99 ≤ 4s baseline on auth-blocking handlers) is queued in **Phase 7 sub-wave 7.1** below — not silently skipped. Closure path is bounded: operator Console click + ToS acceptance unblocks the SA + invoker + IdP rebinding sequence, after which sub-wave 7.1 lands the deferred substrate.

## Phase 7 — closed (zero-out at phase close)

These rows tracked work Phase 7 was supposed to close. All resolved during Waves 1-6 at the substrate level. Operator-paced ratification rows (App Check Console enrolment, BigQuery sink T+1h verification, etc.) are queued in `07-HUMAN-UAT.md` per the deferred-operator-execution pattern Phase 3 / 5 / 6 established.

| Row | Originated in | Closure event | Closure evidence |
|-----|---------------|---------------|------------------|
| auditWrite callable + Pattern A hardening shipped (FN-03 + FN-07) | Phase 6 forward-tracking row | Phase 7 Wave 1 + Wave 2 | `functions/src/audit/auditWrite.ts` deployed (Wave 2 commit `1d09959`); `functions/test/audit/auditWrite.unit.test.ts` (12 tests) + `functions/test/integration/auditWrite.integration.test.ts` (4 tests, Wave 6 commit `3944530`) green |
| auditLog/{eventId} predicate (AUDIT-01 + AUDIT-07) | Phase 5 placeholder + Phase 6 forward-tracking | Phase 7 Wave 2 | `tests/rules/auditLog.test.js` 8 cells (1-4 write-deny, 5 admin-read-allow, 6-8 deny inc. cell 7 audited-self deny — AUDIT-07); commit `5dd6c45` |
| rateLimits predicate replaces deny-block (FN-09) | Phase 5 D-17 + Phase 6 forward-tracking | Phase 7 Wave 4 | `firestore.rules` `rateLimitOk(uid)` predicate composed on messages + comments create rules; `tests/rules/rate-limit.test.js` 15 cells (cell 13 = 31-write SC#5 burst); Wave 4 commit `4d7690b` |
| Firestore-trigger audit mirrors (AUDIT-02..04) | Phase 6 forward-tracking | Phase 7 Wave 2 | `onOrgDelete`, `onUserDelete` (v1 fallback — v2 has no onUserDeleted in firebase-functions 7.2.5), `onDocumentDelete` deployed (commit `9c1dd47`); 60s primary-event dedup query in each; integration coverage Wave 6 (`onOrgDelete.integration.test.ts` + `onUserDelete.integration.test.ts` + `onDocumentDelete.integration.test.ts` — 6 tests) |
| Cloud Logging → BigQuery 7y sink substrate (AUDIT-03 + AUDIT-06) | New in Phase 7 | Phase 7 Wave 5 | `scripts/enable-bigquery-audit-sink/run.js` (Pattern F + ADC + spawn gcloud / bq); `runbooks/phase-7-bigquery-sink-bootstrap.md` documents the run + T+1h verification framework (commit `0950d94`). T+1h `bq query COUNT(*) > 0` is operator-paced (07-HUMAN-UAT.md Test 7); admin dataViewer bindings operator-paced (Test 8) |
| App Check enrolment + Stages A+B+C substrate (FN-07 + FN-08) | New in Phase 7 | Phase 7 Wave 3 | `src/firebase/check.js` body-filled (commit `3bc2c6f`); `runbooks/phase-7-app-check-rollout.md` (Stages A-F operator runbook, 405 lines); `runbooks/phase-7-app-check-enforcement.md` (160 lines, Stage C 7-day soak start ledger). Stages D-F per-service enforcement queued in `07-HUMAN-UAT.md` Tests 4 / 5 / 6 (operator-paced; intentional deferred-operator-execution pattern mirroring Phase 3 / 5 / 6) |
| firebase-functions-test integration coverage (TEST-09) | Phase 6 forward-tracking | Phase 7 Wave 6 | `functions/test/integration/*.integration.test.ts` — 8 files / 20 tests; coverage spans auditWrite + 3 mirror triggers + setClaims + beforeUserCreated + beforeUserSignedIn + checkRateLimit; `cd functions && npm test` exits 0 (133/133 — 113 baseline + 20 new); Wave 6 commit `3944530` |
| BLOCKER-FIX 1 setClaims wiring after password update | Phase 6 sub-wave 6.1 | Phase 7 Wave 5 | `src/firebase/auth.js:updatePassword` reads `getIdTokenResult().claims`; if `firstRun: true`, invokes `setClaims({uid, role, orgId})` then `getIdToken(true)` force-refresh; `src/cloud/claims-admin.js` generates `crypto.randomUUID()` clientReqId per call (Wave 1 SetClaimsSchema requirement); commit `21d23d6` |
| cspReportSink redeploy + invoker binding preservation | Phase 6 sub-wave 6.1 | Phase 7 Wave 5 | `functions/src/csp/cspReportSink.ts` pinned to `csp-sink-sa` (FN-04); Pitfall 8 selective-deploy guidance documented in file header (`firebase deploy --only functions:cspReportSink`); `allUsers` invoker binding intentional + documented (browsers POST CSP reports without auth; abuse defence is content-type allowlist + 64 KiB body cap); commit `dbe3d2e` |
| src/cloud/audit.js + src/cloud/retry.js + src/cloud/checkRateLimit.js body fills | Phase 4 D-11 stub seam | Phase 7 Wave 6 | `audit.js` wires the auditWrite callable through `src/firebase/functions.js` with crypto.randomUUID() clientReqId per call + withRetry exponential backoff; `retry.js` body-filled (CSPRNG-sourced jitter; non-retryable HttpsError codes propagate immediately); `checkRateLimit.js` NEW (Pattern 5b activation seam; deployed-but-unwired); commit `3e0bc9f` |
| SECURITY.md DOC-10 — 5 Phase 7 sections + Pattern G 15-row Phase 7 Audit Index | Phase 7 close-gate | Phase 7 Wave 6 | `SECURITY.md` § Cloud Functions Workspace + § App Check + § Audit Log Infrastructure + § Rate Limiting + § Phase 7 Audit Index (16 data rows — 15 mandatory + 1 D-22 closure status); commit `a832c96` |

## App Check Enforcement Verification Gate

Per Pattern 3 / Pitfall 8: assert App Check rollout substrate landed at Phase 7 Wave 3 (Stages A-C) with operator-paced Stages D-F queued. Wave 6 close gate accepts **PASS-PARTIAL** for Phase 7 close when:

- Stages A (enrolment) + B (quota alert) + C (7-day soak) substrate shipped AND
- Stages D (Storage) + E (Firestore collection-by-collection) + F (Cloud Functions) queued in `07-HUMAN-UAT.md` Tests 4 / 5 / 6

Full **PASS** requires the operator to flip Stages D-F per their schedule (Day 8+ to Day 14+ window in `runbooks/phase-7-app-check-rollout.md` Stage Table). Phase 8 onwards do NOT block on Stages D-F — they ratchet as the operator paces them.

```
gate_check_date: 2026-05-10
phase_7_app_check_substrate_a_b_c: SHIPPED (commits 3bc2c6f + 8771e1f)
phase_7_app_check_stages_d_e_f: QUEUED to 07-HUMAN-UAT.md Tests 4 / 5 / 6
phase_7_app_check_runbook_evidence_pack: runbooks/phase-7-app-check-enforcement.md (160 lines, per-stage YAML evidence sections)
gate_result: PASS-PARTIAL (Stages A+B+C substrate green; Stages D-F operator-paced ratification per 07-HUMAN-UAT.md)
```

## Phase 7 sub-wave 7.1 — carry-forward (substrate-honest)

These rows are NOT closed at Phase 7 close. They track substrate gaps where the load-bearing predecessor (D-22 ToS gate) remains operator-deferred. Documented openly per Pitfall 19 ("claim only what was rehearsed / shipped").

| Row | Reason | Closure path |
|-----|--------|--------------|
| **D-22 ToS gate resolution (`firebaseauth.googleapis.com`)** | Phase 6 sub-wave 6.1 carry-forward; Wave 5 Branch B selected. The IdP signs blocking-handler invocations as `service-<projectNumber>@gcp-sa-firebaseauth` SA which doesn't exist on the project (API ToS-gated). Workaround D-23 PATCHed `blockingFunctions.triggers={}` so signInWithPassword no longer invokes the broken Cloud Run path. Verification log: `runbooks/phase-7-d22-tos-gate-resolution.md` Branch B section. | Sub-wave 7.1 — operator visits `https://console.cloud.google.com/apis/library/firebaseauth.googleapis.com?project=bedeveloped-base-layers`, clicks Enable, accepts ToS as `business@bedeveloped.com` Workspace admin (07-HUMAN-UAT.md Test 9). Auto-provisions `gcp-sa-firebaseauth` SA. Operator then rebinds the SA to `roles/run.invoker` on the 4 Cloud Run services + re-PATCHes IdP `blockingFunctions.triggers` to restore the 4 verified URLs preserved in `06-PREFLIGHT.md ## Cutover Log`. |
| **`minInstances:1` restoration + cold-start p99 ≤ 4s baseline (FN-06)** | Wave 5 Branch B path: D-22 unresolved → `gcp-sa-firebaseauth` SA invocation chain dead → restoring `minInstances:1` would warm a Cloud Run service that the IdP cannot invoke. Documentation pin in `functions/src/auth/{beforeUserCreated,beforeUserSignedIn}.ts` + Wave 5 commit `fece260`. | Sub-wave 7.1 — once D-22 resolves (row above), land `minInstances:1 + cpu:1 + memory:256MiB + serviceAccount:auth-blocking-sa@` on the two auth-blocking handlers; selective deploy `firebase deploy --only functions:beforeUserCreatedHandler,functions:beforeUserSignedInHandler`; record cold-start p99 ≤ 4s baseline in new `runbooks/phase-7-cold-start-baseline.md` evidence section. |
| **App Check Stages D / E / F per-service enforcement** | Operator-paced ratification (intentional, mirroring Phase 3 / 5 / 6 deferred-operator-execution pattern; Phase 8 onwards do NOT block on this). | `07-HUMAN-UAT.md` Tests 4 / 5 / 6 — operator paces flip per `runbooks/phase-7-app-check-rollout.md` Stage Table (Day 8+ Storage; Day 9+ Firestore collection-by-collection; Day 14+ Cloud Functions). Each stage has runbook + verification protocol + rollback path documented. |
| **BigQuery audit sink T+1h ingest verification + admin dataViewer bindings (AUDIT-03 + AUDIT-06)** | Operator-paced — Wave 5 substrate ships (script + runbook + 7y retention config); the actual `gcloud auth application-default login` + `node scripts/enable-bigquery-audit-sink/run.js --project=bedeveloped-base-layers` + T+1h `bq query COUNT(*) > 0` is operator-execution. Admin dataViewer per-email binding is also operator-paced (script intentionally avoids pulling firebase-admin to mirror `scripts/provision-function-sas` shell-out-only convention). | `07-HUMAN-UAT.md` Tests 7 (sink bootstrap + verification) + 8 (admin dataViewer bindings). Closure when both Tests `result: PASS`. |
| **Pre-Wave-6 root `npm run typecheck` errors (14 errors, all confirmed pre-existing on base f3c2905)** | Logged in `.planning/phases/07-cloud-functions-app-check-trusted-server-layer/deferred-items.md` Wave 6 section. None caused by Wave 6 changes; comparative-diagnostic verified. Sources: `scripts/provision-function-sas/run.js` (5 implicit-any), `scripts/strip-legacy-id-fields/run.js` (2 — implicit-any + Firestore dotted-key index-signature mismatch), `src/firebase/check.js` (4 — `import.meta.env` lacks `vite/client` reference type), `tests/firebase/app.test.js` (1 — FirebaseApp interface partial-shape). | Sub-wave 7.1 typecheck-cleanup row — close inline OR queue forward to Phase 11 DOC closure. None block Wave 6 close. |
| **D-22 ToS gate `gcp-sa-firebaseauth` invoker bindings on cspreportsink + setclaims + auditwrite + checkratelimit** | Pitfall 8 — workspace-wide deploy would reset manual invoker bindings; selective-deploy guidance shipped. Operator selective redeploy of cspReportSink (Wave 5 substrate) is operator-paced (`gcloud run services describe cspreportsink --region=europe-west2 --format="value(spec.template.spec.serviceAccountName)"` expected `csp-sink-sa@bedeveloped-base-layers.iam.gserviceaccount.com`). | Sub-wave 7.1 — operator runs `firebase deploy --only functions:cspReportSink` + post-deploy SA + invoker binding verification + curl 204 smoke per file header. |

## Phase 8 — forward-tracking (queued)

| Row | Reason | Phase | Owner |
|-----|--------|-------|-------|
| `softDelete` + `restoreSoftDeleted` callables wired through `src/cloud/soft-delete.js` | Phase 4 stub seam — `src/cloud/soft-delete.js` body fill paired with `functions/src/lifecycle/{softDelete,restoreSoftDeleted}.ts` | Phase 8 | LIFE-01..06 |
| `gdprExportUser` + `gdprEraseUser` callables wired through `src/cloud/gdpr.js` | Phase 4 stub seam — body fill + GDPR Art 15 / Art 17 cascade implementation | Phase 8 | GDPR-01 / GDPR-02 / GDPR-03 |
| Pre-migration export bucket lifecycle policy | Phase 5 D-21 carry-forward (Storage soft-delete + lifecycle policy) | Phase 8 | BACKUP-02 / BACKUP-04 |
| Phase 8 GDPR-erase summary-event pattern (Pitfall 7 mitigation) | Mirror-trigger stampede risk on bulk delete cascades — Phase 8 GDPR erase emits a single summary audit event rather than per-doc events | Phase 8 | GDPR-02 |

## Phase 9 — forward-tracking (queued)

| Row | Reason | Phase | Owner |
|-----|--------|-------|-------|
| `auditWrite` view-side wiring (sign-in / sign-out / role change / delete / export / MFA enrol / password change) | Phase 6 D-21 + Phase 7 Wave 2 makes the writer available + Phase 7 Wave 6 fills the `src/cloud/audit.js` wrapper | Phase 9 | AUDIT-05 |
| Sentry browser SDK init + PII scrubber (shared DSN with Phase 7 server side) | Phase 9 OBS-01..04 — paired with Phase 7's `withSentry()` server wrap | Phase 9 | OBS-01 / OBS-02 / OBS-03 / OBS-04 |
| `_pokes/{ts}` client subscription pattern (full Pitfall 6 closure) | Phase 6 sub-wave 6.1 fallback to Phase 9 — alternative to `getIdToken(true)` force-refresh on the BLOCKER-FIX 1 path | Phase 9 | (substrate stability — optional alternative path) |

## Phase 10 — forward-tracking (queued)

| Row | Reason | Phase | Owner |
|-----|--------|-------|-------|
| Drop temporary CSP allowlist for Firebase Auth popup origin | **CLOSED 2026-05-10 — Plan 10-02** (commit `523e47e`): firebase.json CSP-RO directive value tightened — `frame-src` changed from `https://bedeveloped-base-layers.firebaseapp.com` to `'self'`. Verified by `tests/firebase-config.test.js` Phase 10 schema assertion `frame-src is 'self' (no firebaseapp.com popup origin)` (Plan 10-02 commit `24f8a7c`) + `grep signInWithPopup src/` returns 0 hits. App uses email-link sign-in (Phase 6 D-09). Future federated OAuth-popup sign-in (AUTH-V2-* v2) would need re-extension — forward-tracked to `runbooks/phase-10-cleanup-ledger.md` F3. | CLOSED (Phase 10 — Plan 10-02 commit `523e47e`) | HOST-07 |

## Phase 11 — forward-tracking (queued)

| Row | Reason | Phase | Owner |
|-----|--------|-------|-------|
| `PRIVACY.md` documents BigQuery audit dataset region (europe-west2) + retention (7y) + sub-processor entry | Phase 7 Wave 5 BigQuery sink lands; `PRIVACY.md` is Phase 11 owner | Phase 11 | DOC-02 |
| Customise Firebase password-reset email sender domain to `noreply@bedeveloped.com` | Phase 6 forward-tracking | Phase 11 | DOC-04 |

## Phase 12 — forward-tracking (queued)

| Row | Reason | Phase | Owner |
|-----|--------|-------|-------|
| `SECURITY_AUDIT.md` walkthrough — Phase 7 trusted-server boundary + audit log + rate limit + App Check sections | Phase 7 introduces the controls; Phase 12 produces the audit-walkthrough report | Phase 12 | WALK-02 / WALK-03 |
| 6 stray pre-Phase-4 root-collection docs deletion scripts archive | Phase 5 D-21 carry-forward | Phase 12 | (audit-walkthrough close) |

## Phase 7 — Cleanup Ledger Status

```
ledger_close_date: 2026-05-10
phase_7_active_rows: 0
phase_7_closed_rows: 11 (Branch B substrate-honest)
phase_7_sub_wave_7_1_carry_forward_rows: 6 (D-22, FN-06 minInstances, App Check D/E/F, BQ T+1h, typecheck-cleanup, cspReportSink invoker rebind)
forward_tracking_rows_queued: 10 (4 Phase 8 + 3 Phase 9 + 1 Phase 10 + 2 Phase 11 + 2 Phase 12 — phase-tagged)
gate_status: PASS-PARTIAL (Branch B — D-22 + FN-06 substrate-honestly carried; SC#1-6 substrate complete; operator-paced ratification queued in 07-HUMAN-UAT.md)
```

`phase_7_active_rows: 0` indicates no row that originated as Phase 7's responsibility remains open without a documented closure path. The 6 sub-wave 7.1 rows are open BUT explicitly bounded — each names its closure phase / sub-wave and the load-bearing predecessor (D-22 ToS gate is the load-bearing predecessor for the first 2 rows; the other 4 are operator-paced ratification). Substrate-honest per Pitfall 19.

The Branch B vs Branch A split: Branch A would have closed 13 rows (D-22 + FN-06 inline) and queued 4 sub-wave 7.1 rows; Branch B closes 11 + queues 6. Either branch closes all 17 Phase 7 requirement IDs (FN-01..09 + AUDIT-01..04 + AUDIT-06..07 + TEST-09 + DOC-10) at the substrate level — the difference is whether `minInstances:1` is live at phase close (Branch A) or queued (Branch B).

## Citations

- 07-PATTERNS.md Pattern H (paste-ready structural target — `phase_7_active_rows: 0` zero-out gate)
- 07-RESEARCH.md Wave structure recommendation (6-wave gating; integration coverage Wave 6)
- Pitfall 19 (compliance theatre — claim only what was rehearsed / shipped; substrate-honest disclosure of Branch B carry-forward)
- 07-CONTEXT.md SC#1-6 (Phase 7 success criteria authoritative list; close-gate evidence)
- `runbooks/phase-6-cleanup-ledger.md` — precedent + the 4 forward-tracking rows closed by Phase 7
- `runbooks/phase-7-d22-tos-gate-resolution.md` — Branch B verification log + resolution path (closure path for sub-wave 7.1 rows 1-2)
- `07-05-SUMMARY.md` — Wave 5 Branch B selection rationale + drafted sub-wave 7.1 carry-forward row
- `07-HUMAN-UAT.md` Tests 1-9 — operator-paced ratification queue (Stages A-F + BigQuery sink + dataViewer + D-22 ToS gate)
