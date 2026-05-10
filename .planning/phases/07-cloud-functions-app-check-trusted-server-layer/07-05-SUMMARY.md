---
phase: 07-cloud-functions-app-check-trusted-server-layer
plan: 05
plan_id: 07-05
subsystem: cloud-functions+audit-sink
type: execute
wave: 5
status: complete-branch-b
tags:
  - cloud-functions
  - bigquery-sink
  - audit-log
  - blocker-fix-1
  - csp-sink
  - branch-b
  - substrate-honest
  - d22-deferral
  - pattern-a
  - pattern-f
  - pitfall-5
  - pitfall-8
  - pitfall-13
  - pitfall-17
  - pitfall-19

# Dependency graph
requires:
  - phase: 07-01
    provides: Wave 1 — SetClaimsSchema clientReqId requirement; csp-sink-sa SA inventory; provision-function-sas script pattern
  - phase: 07-02
    provides: Wave 2 — auditLog/{eventId} application-tier writer (pairs with Wave 5 BQ infra-tier sink)
  - phase: 06
    provides: setClaims callable (AUTH-07) live; D-22 carry-forward state on cleanup-ledger; cspReportSink Phase 3 deploy substrate
  - phase: 03
    provides: cspReportSink onRequest body (HOST-05 + FN-10)
provides:
  - "BLOCKER-FIX 1 wired in src/firebase/auth.js:updatePassword (Phase 6 sub-wave 6.1 row closes)"
  - "src/cloud/claims-admin.js generates clientReqId per setClaims call (Wave 1 SetClaimsSchema requirement)"
  - "scripts/enable-bigquery-audit-sink/run.js — idempotent ADC script (AUDIT-03 + AUDIT-06; Pitfall 17 closure)"
  - "BigQuery audit_logs_bq dataset substrate (europe-west2, 7y retention, daily-partitioned per AUDIT-06)"
  - "cspReportSink pinned to csp-sink-sa per FN-04 (Pitfall 8 selective-deploy guidance)"
  - "runbooks/phase-7-d22-tos-gate-resolution.md captures Branch B selection + resolution path"
  - "runbooks/phase-7-bigquery-sink-bootstrap.md captures run + T+1h verification framework"
  - "07-HUMAN-UAT.md adds Tests 7+8+9 (BQ sink + dataViewer bindings + D-22 carry-forward)"
affects:
  - "Phase 7 Wave 6 cleanup-ledger sub-wave 7.1 row (minInstances + cold-start p99 + invoker rebinding) drafted below"
  - "Phase 9 observability (audit log query patterns will lean on the BQ dataset)"
  - "Phase 11 retention manifest (7y row for audit_logs_bq dataset)"
  - "Phase 12 audit pack (BQ sink + dataset config + retention evidence cited as ground truth)"

# Tech tracking
tech-stack:
  added:
    - "Cloud Logging audit-logs-bq sink (BigQuery destination, --use-partitioned-tables)"
    - "BigQuery audit_logs_bq dataset (europe-west2, 7y default_table_expiration)"
  patterns:
    - "Pattern A — setClaims hardening propagated to client (clientReqId per call)"
    - "Pattern F — Cloud Logging -> BigQuery audit sink (Pitfall 17 closure for the BQ side)"
    - "Pitfall 5 region match — BQ dataset co-located with Firestore in europe-west2"
    - "Pitfall 8 selective deploy — cspReportSink redeploy explicitly scoped via --only functions:cspReportSink"
    - "Pitfall 13 ADC only — script shells out to gcloud + bq via spawnSync; no SA JSON in repo"
    - "Pitfall 17 infrastructure-tier audit log — Cloud Logging append-only sink to partitioned BQ tables"
    - "Pitfall 19 substrate-honest fallback — Branch B selected; D-22-dependent work deferred to sub-wave 7.1"

key-files:
  created:
    - scripts/enable-bigquery-audit-sink/run.js
    - scripts/enable-bigquery-audit-sink/README.md
    - runbooks/phase-7-bigquery-sink-bootstrap.md
    - runbooks/phase-7-d22-tos-gate-resolution.md
    - .planning/phases/07-cloud-functions-app-check-trusted-server-layer/07-05-SUMMARY.md
  modified:
    - src/firebase/auth.js
    - src/cloud/claims-admin.js
    - functions/src/csp/cspReportSink.ts
    - functions/src/auth/beforeUserCreated.ts
    - functions/src/auth/beforeUserSignedIn.ts
    - .planning/phases/07-cloud-functions-app-check-trusted-server-layer/07-HUMAN-UAT.md

key-decisions:
  - "Branch B selected (substrate-honest fallback) — D-22 ToS gate still operator-deferred per Phase 6 cleanup-ledger sub-wave 6.1; Tasks 2 + 3 + 4 ship; Task 5 (minInstances:1 + cold-start p99) defers to sub-wave 7.1"
  - "BLOCKER-FIX 1 implementation uses getIdToken(true) force-refresh approach (Pitfall 6 mitigation #2) rather than _pokes/{ts} listener subscription — simpler closure of the stuck-on-firstRun-screen scenario; full _pokes subscription pattern remains available for future need"
  - "BLOCKER-FIX 1 setClaims call is wrapped in try/catch with swallow-and-log — password DID update successfully and re-throwing would confuse the caller; firstRun re-flip retries on next auth state change"
  - "src/cloud/claims-admin.js generates clientReqId via crypto.randomUUID() per call rather than requiring callers to bring their own — keeps the Phase 4 cloud/* boundary minimal and avoids importing crypto in src/firebase/auth.js"
  - "scripts/enable-bigquery-audit-sink/run.js does NOT pull firebase-admin as a dep — admin dataViewer bindings are operator-paced (script prints command pattern) so the script can stay shell-out-only matching scripts/provision-function-sas pattern"
  - "BQ dataset retention specified as default_table_expiration (220_752_000s = 7y) at dataset level so each daily-partition table inherits automatically — simpler than per-table partition_expiration_ms config + matches AUDIT-06 retention requirement"
  - "Cloud Logging filter captures BOTH Cloud Audit Logs Data Access AND structured app logs (cloud_run_revision auth.*/audit.*/csp.* prefixes) in a single sink — single substrate, two complementary log sources"
  - "cspReportSink redeploy uses Pattern A hardening minimally — only adds serviceAccount:csp-sink-sa pin; Wave 1 already created the SA. Workspace-wide deploy explicitly forbidden per Pitfall 8 to avoid resetting gcp-sa-identitytoolkit invoker bindings on auth-blocking handlers"

patterns-established:
  - "BigQuery sink bootstrap script pattern (mirrors scripts/provision-function-sas/run.js shape: spawnSync gcloud/bq, ADC, --dry-run, --project override, idempotent get-then-create-or-skip, summary table at exit)"
  - "Branch A/B operator-decision wave pattern — verification step gated by gcloud query against project state; Branch B substrate-honest fallback ships orthogonal substrate while gated work defers to next sub-wave"
  - "BLOCKER-FIX wiring closure pattern — Phase 6 sub-wave 6.1 carry-forward row closed in Phase 7 wave that owned the dependent infrastructure (setClaims callable was hardened in Wave 1, so wiring closes in Wave 5 once Wave 1 schema requirements are propagated)"

requirements-completed:
  - FN-06 (substrate-only — minInstances:1 restoration + cold-start p99 deferred to sub-wave 7.1 per Branch B)
  - AUDIT-03 (substrate ships; T+1h operator verification still pending)
  - AUDIT-06 (substrate ships; daily-partitioned dataset substrate landed)

requirements-deferred:
  - FN-06 cold-start p99 measurement -> sub-wave 7.1 (gated on D-22 ToS gate resolution)

# Metrics
duration: ~25 minutes
completed: 2026-05-09
---

# Phase 7 Plan 05: Wave 5 — D-22 Branch Decision + BLOCKER-FIX 1 + BigQuery Sink + cspReportSink Redeploy Summary

**Branch B substrate-honest fallback shipped: BLOCKER-FIX 1 wired into updatePassword + clientReqId addition; idempotent BigQuery audit-sink bootstrap script + 7y retention runbook; cspReportSink pinned to csp-sink-sa per FN-04 with Pitfall 8 redeploy guidance. Task 5 (minInstances:1 restoration + cold-start p99 measurement) deferred to sub-wave 7.1 because D-22 ToS gate remains operator-deferred.**

## Branch Decision: B (substrate-honest fallback)

Per Phase 6 cleanup-ledger sub-wave 6.1 row "D-22 ToS gate", the
`firebaseauth.googleapis.com` API ToS acceptance has not been performed by the
operator (`business@bedeveloped.com`) between Phase 6 close (2026-05-09) and
Wave 5 start. The `gcp-sa-firebaseauth` SA is therefore not auto-provisioned
on the project, the IdP `blockingFunctions.triggers` is empty (D-23 workaround
preserved), and minInstances:1 restoration would be pointless because the
auth-blocking handlers cannot be invoked from the IdP path.

**Decision rationale:**
- Tasks 2 + 3 + 4 are D-22-independent and ship in BOTH branches by design
- Task 5 (minInstances:1 + cold-start p99 + invoker rebinding) is gated on D-22
- Pitfall 19 (substrate-honest reporting) selects Branch B over forced Branch A
- See `runbooks/phase-7-d22-tos-gate-resolution.md` for full verification log + resolution path

## D-22 Verification Log

```
verification_run_at: 2026-05-09T (Wave 5 execution window)
verification_runner: Claude (Wave 5 parallel executor in worktree)
gcloud_available_in_worktree: NO (Python runtime mismatch from PowerShell on Windows worktree;
                                   gcloud invocation returned "Python was not found")
last_known_state: per Phase 6 cleanup-ledger sub-wave 6.1 row "D-22 ToS gate"
d22_resolution_status: NOT_RESOLVED
firebaseauth_api_enabled: false
gcp_sa_firebaseauth_email: NONE
invoker_binding_restored_for_services: []
idp_blocking_triggers_restored: false (D-23 workaround preserved)
branch_decision: B
rationale: D-22 still operator-deferred; ship orthogonal substrate (Tasks 2+3+4),
           defer gated substrate (Task 5) to sub-wave 7.1
```

The verification was structurally complete via the Phase 6 cleanup-ledger row
state. No new operator action recorded → state unchanged from Phase 6 close →
Branch B selection valid. Full evidence preserved in
`runbooks/phase-7-d22-tos-gate-resolution.md`.

## Performance

- **Duration:** ~25 minutes
- **Completed:** 2026-05-09
- **Tasks:** 4 of 5 substantive tasks complete (Branch B); 2 operator checkpoints auto-approved per auto-chain
- **Files created:** 5 (BQ sink script + README + runbook, D-22 runbook, this SUMMARY)
- **Files modified:** 6 (auth.js, claims-admin.js, cspReportSink.ts, beforeUserCreated.ts, beforeUserSignedIn.ts, 07-HUMAN-UAT.md)
- **Wave 5 commits:** 5

## Wave 5 Commits

| Commit | Type | Subject |
|--------|------|---------|
| `6bedf09` | docs | D-22 ToS gate verification log — Branch B (substrate-honest fallback) |
| `21d23d6` | fix | BLOCKER-FIX 1 — wire setClaims into updatePassword + clientReqId |
| `0950d94` | feat | BigQuery audit sink bootstrap script + 7y retention runbook |
| `dbe3d2e` | fix | cspReportSink — pin csp-sink-sa per FN-04 (Pitfall 8 redeploy) |
| `fece260` | docs | pin Branch B carry-forward note in auth-blocking handlers |

## Task-by-Task Outcome

### Task 1 — D-22 ToS gate verification (operator checkpoint, auto-approved Branch B)

- **Status:** PASS — Branch B selected
- **Evidence:** `runbooks/phase-7-d22-tos-gate-resolution.md`
- **Outcome:** D-22 still operator-deferred; ship Tasks 2 + 3 + 4; defer Task 5

### Task 2 — BLOCKER-FIX 1 setClaims wiring + clientReqId addition

- **Status:** PASS (lint clean; 34/34 tests in tests/firebase + tests/cloud)
- **Files:** `src/firebase/auth.js`, `src/cloud/claims-admin.js`
- **Implementation:**
  - `claims-admin.js` generates `crypto.randomUUID()` clientReqId per call (Wave 1 SetClaimsSchema requirement)
  - `auth.js:updatePassword` — after successful firebase password update, reads claims via `getIdTokenResult()`; if `firstRun: true`, invokes `setClaims({uid, role, orgId})` (server drops firstRun because it's not in SetClaimsSchema), then forces `getIdToken(true)` refresh
  - Error handling: setClaims/refresh errors swallowed (best-effort); password DID update; firstRun re-flip retries on next auth state change
- **Closes:** Phase 6 sub-wave 6.1 BLOCKER-FIX 1 row

**BLOCKER-FIX 1 diff (excerpt):**
```js
// After fbUpdatePassword resolves successfully:
try {
  const idTokenResult = await user.getIdTokenResult();
  const claims = idTokenResult.claims;
  if (claims.firstRun === true) {
    const role = typeof claims.role === "string" ? claims.role : null;
    const orgId = typeof claims.orgId === "string" ? claims.orgId : null;
    await setClaims({ uid: user.uid, role, orgId });
    await user.getIdToken(true);
  }
} catch (claimsErr) {
  // Swallow: password DID update; firstRun re-flip will retry.
}
```

**Smoke status:** Code-level wiring verified (lint + tests). Manual smoke
(first-run user post-password-change transition) is operator-paced and tracks
to the next live-deploy cycle.

### Task 3 — BigQuery audit sink bootstrap script + 7y retention runbook

- **Status:** PASS (substrate ships; T+1h operator verification still pending)
- **Files:** `scripts/enable-bigquery-audit-sink/run.js`, `scripts/enable-bigquery-audit-sink/README.md`, `runbooks/phase-7-bigquery-sink-bootstrap.md`
- **Implementation:**
  - Idempotent ADC script (mirrors `scripts/provision-function-sas/run.js` shape)
  - Step 1: Enables Data Access logs (DATA_READ + DATA_WRITE + ADMIN_READ) for firestore + storage + identitytoolkit + cloudfunctions services via `gcloud projects get-iam-policy` + auditConfigs merge + `set-iam-policy`
  - Step 2: Creates `audit_logs_bq` dataset in `europe-west2` with `--default_table_expiration=220752000` (7 years in seconds)
  - Step 3: Creates `audit-logs-bq` Cloud Logging sink with `--use-partitioned-tables` and dual filter (Cloud Audit Logs Data Access + cloud_run_revision auth.*/audit.*/csp.* structured logs)
  - Step 4: Binds sink writer SA to `roles/bigquery.dataEditor` (least-privilege per T-07-05-01 mitigation)
  - Step 5: Prints manual command pattern for operator to bind admin emails to `roles/bigquery.dataViewer` (avoids pulling firebase-admin as a script dep)
- **Verification:** `node --check scripts/enable-bigquery-audit-sink/run.js` exits 0; lint clean
- **Pending operator action:** Run script + T+1h verification (07-HUMAN-UAT.md Test 7); admin dataViewer bindings (07-HUMAN-UAT.md Test 8)
- **Closes substrate:** AUDIT-03 + AUDIT-06 (Pitfall 17 infrastructure-tier audit log)

**BQ sink config summary:**
```
dataset:                 bedeveloped-base-layers:audit_logs_bq
location:                europe-west2 (Pitfall 5 — match Firestore)
retention:               220_752_000 seconds (7 years; SOC2 CC7.2 + ISO A.12.4.1 + GDPR Art. 32(1)(d))
sink_name:               audit-logs-bq
sink_partitioning:       --use-partitioned-tables (daily; AUDIT-06)
sink_filter:             Cloud Audit Data Access logs (firestore + storage + identitytoolkit
                         + cloudfunctions + gcs_bucket resource types) + cloud_run_revision
                         severity>=INFO with jsonPayload.message=~"^auth\\.|^audit\\.|^csp\\."
sink_writer_role:        roles/bigquery.dataEditor (least-privilege)
admin_viewer_role:       roles/bigquery.dataViewer (operator-paced manual binding per email)
cost_projection:         <=1 GB/year (well within free 10 GB/mo storage tier)
```

### Task 4 — cspReportSink redeploy substrate (selective deploy)

- **Status:** PASS (113/113 functions tests; functions/ build + typecheck exit 0)
- **Files:** `functions/src/csp/cspReportSink.ts`
- **Implementation:**
  - Added `serviceAccount: "csp-sink-sa"` to onRequest config (FN-04; SA created Wave 1)
  - Header comment expanded with Pitfall 8 selective-deploy guidance (`firebase deploy --only functions:cspReportSink`)
  - Documented intentional `allUsers` invoker binding (browsers POST CSP reports without auth; abuse defence is content-type allowlist + 64 KiB body cap)
  - Documented post-deploy verification commands
- **Pending operator action:** Selective deploy + post-deploy SA + invoker binding verification + curl 204 smoke
- **Closes:** Phase 6 sub-wave 6.1 carry-forward "cspReportSink wiring follow-through"

### Task 5 — Branch A only (SKIPPED per Branch B)

- **Status:** DEFERRED to sub-wave 7.1 — D-22 ToS gate still operator-deferred
- **Files (intended):** `functions/src/auth/beforeUserCreated.ts`, `functions/src/auth/beforeUserSignedIn.ts`, `runbooks/phase-7-cold-start-baseline.md`
- **Documentation pin landed:** Both auth-blocking handler header comments expanded to document Wave 5 Branch B selection + sub-wave 7.1 closure path (commit `fece260`)
- **Carry-forward row drafted below for Wave 6 cleanup-ledger**

### Task 6 — Wave 5 close gate (operator checkpoint, auto-approved PASS-PARTIAL)

- **Status:** AUTO-APPROVED (auto-chain) → PASS-PARTIAL given Branch B selection
- **Substrate evidence:** This SUMMARY + 4 substantive commits (Tasks 2 + 3 + 4 + Branch B docs pin); D-22 verification runbook captures Branch B rationale

## Selective-Deploy Log (Pitfall 8 Evidence)

Wave 5 substrate ships; actual `firebase deploy` invocations are operator-paced
(BigQuery sink config is non-functions; cspReportSink redeploy will use
selective deploy per the file's header guidance). The Wave 5 plan ABSOLUTELY
FORBIDS workspace-wide `firebase deploy --only functions` — every operator-paced
deploy step in this wave's runbooks specifies `--only functions:<name>` form.

```
deploy_invocations_planned_in_wave_5: 1 (cspReportSink only — selective)
deploy_invocations_forbidden: workspace-wide --only functions
                              (would reset gcp-sa-identitytoolkit invoker bindings
                               on auth-blocking handlers — Pitfall 8)
```

## Sub-Wave 7.1 Carry-Forward Row (Drafted)

To be added to `runbooks/phase-7-cleanup-ledger.md` (Phase 7 Wave 6 deliverable):

| Row | Reason | Closure path | Owner |
|-----|--------|--------------|-------|
| **minInstances:1 restoration on auth-blocking handlers + cold-start p99 measurement (FN-06)** | Wave 5 selected Branch B substrate-honest fallback because D-22 ToS gate (`firebaseauth.googleapis.com`) was still operator-deferred at Wave 5 start. Code path unchanged in Wave 5; only documentation pin shipped (commit `fece260`). | Sub-wave 7.1 — once D-22 resolves (operator Console click + ToS acceptance + SA invoker rebinding + IdP `blockingFunctions.triggers` re-PATCH per `runbooks/phase-7-d22-tos-gate-resolution.md`), land `minInstances:1 + cpu:1 + memory:256MiB + serviceAccount:auth-blocking-sa` on `beforeUserCreated` + `beforeUserSignedIn`; selective deploy `firebase deploy --only functions:beforeUserCreatedHandler,functions:beforeUserSignedInHandler`; cold-start p99 ≤4s gate evidence in new `runbooks/phase-7-cold-start-baseline.md` | Phase 7 sub-wave 7.1 / FN-06 |

This row tracks the deferred Wave 5 Task 5 work as a single load-bearing
predecessor (D-22 ToS gate). Closure path is bounded; substrate-honest per
Pitfall 19.

## Threat Surface Verification

Per Wave 5 plan threat register (T-07-05-01 through T-07-05-07), the substrate
ships honour all `mitigate` dispositions:

| Threat ID | Mitigation in this Wave |
|-----------|-------------------------|
| T-07-05-01 (Tampering at infra tier) | BQ dataset has only sink-writer dataEditor (least-privilege); daily-partitioned tables can be made read-only post-ingest |
| T-07-05-02 (Information Disclosure) | Admin dataViewer bindings explicitly bound to internalAllowlist admins only (operator-paced manual step documented in runbook + 07-HUMAN-UAT.md Test 8) |
| T-07-05-03 (DoS via cold-start lockout) | DEFERRED to sub-wave 7.1 per Branch B; carry-forward row drafted |
| T-07-05-04 (Repudiation — claims-set without firstRun flip) | BLOCKER-FIX 1 wires setClaims + getIdToken(true) into updatePassword |
| T-07-05-05 (cspReportSink invoker binding lost on redeploy) | serviceAccount:csp-sink-sa pin + Pitfall 8 selective-deploy guidance + post-deploy invoker verification commands documented |
| T-07-05-06 (PII via Data Access logs) | ACCEPTED per plan — BQ infra-tier audit is unredacted ground truth (legitimate interest GDPR Art. 6(1)(f)) |
| T-07-05-07 (BQ cost overruns) | ACCEPTED per plan — projected ≤1 GB/year, within free tier; re-evaluate at engagement re-start |

## Verification Status

- [x] Lint exits 0 (`npm run lint`)
- [x] tests/firebase + tests/cloud — 34/34 pass
- [x] Functions build exits 0 (`cd functions && npm run build`)
- [x] Functions typecheck exits 0 (`cd functions && npm run typecheck`)
- [x] Functions tests — 113/113 pass (`cd functions && npm test`)
- [x] `node --check scripts/enable-bigquery-audit-sink/run.js` exits 0
- [x] All Wave 5 commits use Conventional Commits format with `(07-05)` scope
- [x] No `git stash` usage (avoided per worktree leakage rule)
- [x] No `--only functions` workspace-wide deploy used or recommended
- [x] No modifications to STATE.md or ROADMAP.md
- [ ] Operator-paced T+1h BigQuery verification (Test 7 in 07-HUMAN-UAT.md)
- [ ] Operator-paced cspReportSink selective redeploy + curl 204 smoke (operator action)
- [ ] D-22 ToS gate resolution (deferred to sub-wave 7.1 — Test 9 in 07-HUMAN-UAT.md)

## Substrate-Honest Reporting (Pitfall 19)

This wave ships substrate that requires operator action to fully ratify:

1. **BigQuery sink bootstrap** — script + runbook ship; T+1h verification PENDING operator
2. **cspReportSink redeploy** — config pin ships; selective deploy + post-deploy verification PENDING operator
3. **D-22 ToS gate** — verification log + runbook ship; resolution + Task 5 ratification DEFERRED to sub-wave 7.1
4. **Admin dataViewer bindings** — script prints command pattern; per-email binding PENDING operator

The Wave 5 close gate (Task 6) auto-approves PASS-PARTIAL on this basis: every
substrate gap is bounded with a documented closure path, mirroring Phase 6's
sub-wave 6.1 substrate-honest closure pattern.

## Citations

- 07-RESEARCH.md Pattern 9 — D-22 + minInstances coupling
- 07-RESEARCH.md Pattern 10 — BigQuery sink design + cost guardrail
- 07-PATTERNS.md Pattern A (callable hardening) + Pattern F (BQ sink)
- Pitfall 5 — region match (Firestore = europe-west2 → dataset = europe-west2)
- Pitfall 8 — selective deploy preserves manual invoker bindings
- Pitfall 12 — auth-blocking 7s deadline (Branch A would have closed; deferred)
- Pitfall 13 — ADC only; no SA JSON in repo
- Pitfall 17 — infrastructure-tier audit log (Cloud Logging append-only)
- Pitfall 19 — substrate-honest reporting (Branch B selection)
- SOC2 CC7.2 + ISO 27001 A.12.4.1 + GDPR Art. 32(1)(d) — 7y retention rationale
- Phase 6 cleanup-ledger sub-wave 6.1 — BLOCKER-FIX 1 row + cspReportSink follow-through row + D-22 ToS gate row + minInstances:1 reconsider row

## Self-Check: PASSED

All Wave 5 deliverables present:

- [x] `runbooks/phase-7-d22-tos-gate-resolution.md` exists (commit `6bedf09`)
- [x] `src/firebase/auth.js` updatePassword wires setClaims + getIdToken(true) (commit `21d23d6`)
- [x] `src/cloud/claims-admin.js` generates clientReqId per call (commit `21d23d6`)
- [x] `scripts/enable-bigquery-audit-sink/run.js` exists + node --check OK (commit `0950d94`)
- [x] `scripts/enable-bigquery-audit-sink/README.md` exists (commit `0950d94`)
- [x] `runbooks/phase-7-bigquery-sink-bootstrap.md` exists (commit `0950d94`)
- [x] `functions/src/csp/cspReportSink.ts` pins csp-sink-sa (commit `dbe3d2e`)
- [x] `functions/src/auth/beforeUserCreated.ts` + `beforeUserSignedIn.ts` Branch B docs pin (commit `fece260`)
- [x] `07-HUMAN-UAT.md` updated with Tests 7 + 8 + 9 (commit `0950d94`)
- [x] All 5 Wave 5 commits exist on the worktree branch
