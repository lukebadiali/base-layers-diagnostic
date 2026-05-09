---
status: resolved
phase: 05-firestore-data-model-migration-rules-authoring-committed-not-deployed
source: [05-VERIFICATION.md]
started: 2026-05-08T17:40:00Z
updated: 2026-05-08T18:18:00Z
---

## Current Test

[all resolved or deferred]

## Tests

### 1. Firebase Console RULES-06 out-of-band confirmation
expected: Console shows pre-Phase-5 rules (NOT the 159-line Phase 5 ruleset).
result: PASSED 2026-05-08 — operator screenshot of Firebase Console → Cloud Firestore → Rules tab confirms most recent deployed revision is **Apr 27, 2026** (predates Phase 5 work which began 2026-05-08). Deployed rules are the old ~13-line flat-root-collection shape (`/documents/{docId}`, `/messages/{msgId}`, `/funnels/...`, `/funnelComments/...`) with simple `if request.auth != null` predicates — NOT the Phase 5 isAuthed() + 13-match-block + email_verified ruleset. RULES-06 holds symmetrically: repo-side grep + production-side Console both confirm rules-not-deployed. Screenshot evidence held by operator.

### 2. Live SC#4 server-clock unread comparator browser session
expected: Once Phase 6 ships and the first real org is created (post-Auth cutover), exercise the unread-count badge with a deliberate ±5-minute client clock skew (e.g. via DevTools "Override clock" or system time change) and confirm the badge count does not change. This validates Wave 4's H7 closure end-to-end against live data. **Currently degenerate against the empty database** — moot until users + orgs exist post-Phase-6.
result: [deferred to Phase 6]

### 3. Operator sign-off on cutover_outcome=success
expected: Operator reads 05-PREFLIGHT.md end-to-end and confirms cutover narrative + empty-DB condition + 6-doc stray-cleanup deviation are accepted.
result: PASSED 2026-05-08 — operator walked through the cutover live with the orchestrator (export → dry-run → stray-cleanup deviation → real-run → verify → PREFLIGHT fill → SECURITY.md narrative); approved as part of phase-close sign-off. Empty-database no-op outcome accepted as expected baseline (PROJECT.md "between client engagements"). Audit narrative accepted as honest.

## Summary

total: 3
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0
deferred: 1

## Gaps
