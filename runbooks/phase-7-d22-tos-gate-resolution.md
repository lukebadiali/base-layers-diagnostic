# Phase 7 Wave 5 — D-22 ToS Gate Resolution Log

> Verification log for Wave 5 Task 1 (operator-paced checkpoint). Determines
> whether Wave 5 ships Branch A (full — D-22 resolved) or Branch B (degraded
> — D-22 carry-forward).

## Wave 5 Branch Decision: **B (substrate-honest fallback)**

Per Phase 6 cleanup-ledger sub-wave 6.1 row "D-22 ToS gate" — the
`firebaseauth.googleapis.com` API ToS acceptance has NOT been performed by the
operator (`business@bedeveloped.com`) between Phase 6 close (2026-05-09) and
Wave 5 start (2026-05-09). The gcp-sa-firebaseauth SA is therefore not
auto-provisioned on the project.

This is consistent with the Phase 6 substrate-honest closure pattern: D-22
was deferred at Phase 6 close as a known carry-forward row with explicit
closure path (operator Console click + ToS acceptance). Wave 5 selects
Branch B per Pitfall 19 (compliance-honest reporting — claim only what was
rehearsed / shipped).

## Verification commands (operator-paced)

The following verification commands are documented for the operator to run
when ready to resolve D-22. They were NOT run during Wave 5 (gcloud Python
runtime mismatch in worktree environment + operator deferral).

```bash
# 1. Check if firebaseauth.googleapis.com API is enabled
gcloud services list --project=bedeveloped-base-layers \
  --filter="config.name:firebaseauth.googleapis.com" \
  --format="value(config.name)"
# Expected if resolved: "firebaseauth.googleapis.com"
# Expected if NOT resolved (current state at Wave 5): empty output

# 2. Check if gcp-sa-firebaseauth SA was auto-provisioned
gcloud iam service-accounts list --project=bedeveloped-base-layers \
  --filter="email:firebaseauth" --format="value(email)"
# Expected if resolved: "service-<projectNumber>@gcp-sa-firebaseauth.iam.gserviceaccount.com"
# Expected if NOT resolved (current state at Wave 5): empty output
```

## Wave 5 Verification Result (recorded)

```
verification_run_at: 2026-05-09T (Wave 5 execution window)
verification_runner: Claude (Wave 5 parallel executor in worktree)
gcloud_available_in_worktree: NO (Python runtime not accessible to gcloud
                                   from PowerShell in this Windows worktree;
                                   "Python was not found" stderr returned)

# Last-known operator state (from Phase 6 sub-wave 6.1 carry-forward ledger):
d22_resolution_status: NOT_RESOLVED
firebaseauth_api_enabled: false (per Phase 6 cleanup-ledger row "D-22 ToS gate")
gcp_sa_firebaseauth_email: NONE
invoker_binding_restored_for_services: []
idp_blocking_triggers_restored: false (per Phase 6 D-23 workaround;
                                       blockingFunctions.triggers={} preserved)

branch_decision: B
rationale: |
  D-22 ToS gate still operator-deferred per Phase 6 cleanup-ledger sub-wave 6.1.
  No operator action recorded between Phase 6 close (2026-05-09) and Wave 5
  start. Substrate-honest fallback (Branch B) selected: ship Tasks 2 + 3 + 4
  (BLOCKER-FIX 1 wiring, BigQuery sink, cspReportSink redeploy substrate),
  defer Task 5 (minInstances:1 restoration + cold-start p99 measurement) to
  sub-wave 7.1 carry-forward.
```

## Branch B substrate ships in Wave 5

The following Wave 5 deliverables proceed in Branch B (D-22-independent):

1. **Task 2 — BLOCKER-FIX 1 setClaims wiring** in `src/firebase/auth.js:updatePassword`
2. **Task 2 — `src/cloud/claims-admin.js` clientReqId addition** (Wave 1 schema requirement)
3. **Task 3 — BigQuery sink + 7y retention** (`scripts/enable-bigquery-audit-sink/run.js` + runbook)
4. **Task 4 — cspReportSink redeploy substrate** (serviceAccount pin + selective-deploy guidance)

## Branch B substrate-honest deferral

The following Wave 5 deliverables are DEFERRED to sub-wave 7.1 carry-forward
(see `runbooks/phase-7-cleanup-ledger.md` once produced):

1. **Task 5 — minInstances:1 restoration** on `beforeUserCreated` + `beforeUserSignedIn`
2. **Task 5 — cold-start p99 measurement** (FN-06 evidence)
3. **gcp-sa-firebaseauth invoker binding** rebind on the 4 Cloud Run services
4. **IdP `blockingFunctions.triggers`** re-PATCH (preserved URLs in `06-PREFLIGHT.md ## Cutover Log`)

## Resolution path (when operator ready)

When the operator is ready to resolve D-22, they:

1. Visit https://console.cloud.google.com/apis/library/firebaseauth.googleapis.com?project=bedeveloped-base-layers
2. Click "Enable" → Accept ToS (requires `business@bedeveloped.com` Workspace admin role)
3. Wait ~30s for `gcp-sa-firebaseauth` SA auto-provisioning
4. Re-run the verification commands above; expect both to return populated
5. Rebind SA to `roles/run.invoker` on the 4 Cloud Run services:
   ```bash
   for svc in beforeusercreatedhandler beforeusersignedinhandler setclaims cspreportsink; do
     gcloud run services add-iam-policy-binding $svc --region=europe-west2 \
       --project=bedeveloped-base-layers \
       --member="serviceAccount:service-76749944951@gcp-sa-firebaseauth.iam.gserviceaccount.com" \
       --role="roles/run.invoker"
   done
   ```
6. Re-PATCH IdP `blockingFunctions.triggers` to restore the 4 verified URLs
   preserved in `06-PREFLIGHT.md ## Cutover Log`
7. Land sub-wave 7.1 — Task 5 restoration commits (`functions/src/auth/before*.ts`
   minInstances:1 + selective deploy + cold-start p99 measurement)

## Citations

- Phase 6 cleanup-ledger sub-wave 6.1 row "D-22 ToS gate" — original carry-forward
- 06-PREFLIGHT.md `## Cutover Log: Substrate Gaps` — D-22 cascade evidence
- 07-RESEARCH.md Pattern 9 — D-22 + minInstances coupling
- Pitfall 12 — auth-blocking 7s deadline; minInstances:1 buys headroom
- Pitfall 19 — compliance-honest reporting (substrate-honest fallback)
