---
status: partial
phase: 03-hosting-cutover-baseline-security-headers
source: [03-VERIFICATION.md]
started: 2026-05-06T22:30:00Z
updated: 2026-05-06T22:30:00Z
---

## Current Test

[awaiting operator execution — three deferred items below]

## Tests

### 1. Wave 1 (03-01) Task 2 — operator response to PENDING-USER block

expected: Operator pastes the seven gcloud/Console/registrar values into 03-PREFLIGHT.md per 03-01-SUMMARY.md §Checkpoint Status Block A-D — Firestore locationId, Firebase Hosting Console enabled, OIDC pool ACTIVE, OIDC SA roles, GitHub OIDC repo secrets present, registrar identity, approval.

result: [pending]

why_human: Requires interactive `gcloud auth login` + `firebase login` + Firebase Console UI inspection + GitHub repo settings inspection + registrar UI login. None can run non-interactively.

### 2. Wave 4 (03-05) Task 3 — production cutover (CNAME flip + GH-Pages disable + same-session smoke)

expected: Operator executes runbooks/hosting-cutover.md §Cutover Steps 1-10; fills 03-PREFLIGHT.md `## Cutover Log` fields (cutover_date, cutover_complete, ssl_provisioned_at, cutover_observed_headers, securityheaders_rating ≥A, synthetic_csp_e2e_seen_in_cloud_logging, post_cutover_smoke_blockedUri); verifies all 9 security headers on the live custom domain via `curl -I`; runs synthetic CSP report POST against the deployed function in BOTH wire formats and confirms Cloud Logging entries.

result: [pending]

why_human: GitHub Settings → Pages UI mutation, Firebase Console custom-domain TXT/A handshake, registrar A/AAAA changes, securityheaders.com manual rating, end-to-end CSP report from a live browser — none have programmatic equivalents.

closes_roadmap_sc: SC-1, SC-5

### 3. Wave 6 (03-06) Task 3 — apply branch protection rule in GitHub UI

expected: After first green deploy run on main and first green PR preview run register the names in GitHub's check registry (`gh api .../check-runs --jq '.check_runs[].name'` returns "Deploy to Firebase Hosting" AND "Deploy PR Preview Channel"), operator either runs the `gh api PUT` payload in runbooks/branch-protection-bootstrap.md §Command or applies via GitHub UI per §Apply via GitHub UI; backfills first-green-run dates in the runbook's PENDING-USER markers.

result: [pending]

why_human: Requires repo-admin gh CLI session OR interactive GitHub Settings → Branches UI; Pitfall A precondition is that this can only run AFTER the cutover lands the first green deploy.

depends_on: Test 2 (cutover) must land first green deploy before this can be applied.

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
