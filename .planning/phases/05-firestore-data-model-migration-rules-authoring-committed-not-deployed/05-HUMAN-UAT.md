---
status: partial
phase: 05-firestore-data-model-migration-rules-authoring-committed-not-deployed
source: [05-VERIFICATION.md]
started: 2026-05-08T17:40:00Z
updated: 2026-05-08T17:40:00Z
---

## Current Test

[awaiting human sign-off]

## Tests

### 1. Firebase Console RULES-06 out-of-band confirmation
expected: Open Firebase Console (https://console.firebase.google.com/project/bedeveloped-base-layers/firestore/rules) and confirm the **Rules** tab shows the **Firebase default rules** (or "no rules deployed" / a permissive default-mode policy expiring on a future date), NOT the Phase 5 ruleset (which would have the `isAuthed()` predicate library, 13 collection match blocks, and the `email_verified == true` check). The repo-side `git grep "firebase deploy --only firestore:rules"` over enforcement file types returns empty — this is the symmetric out-of-band confirmation.
result: [pending]

### 2. Live SC#4 server-clock unread comparator browser session
expected: Once Phase 6 ships and the first real org is created (post-Auth cutover), exercise the unread-count badge with a deliberate ±5-minute client clock skew (e.g. via DevTools "Override clock" or system time change) and confirm the badge count does not change. This validates Wave 4's H7 closure end-to-end against live data. **Currently degenerate against the empty database** — moot until users + orgs exist post-Phase-6.
result: [deferred to Phase 6]

### 3. Operator sign-off on cutover_outcome=success
expected: Operator (Hugh) reads `.planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-PREFLIGHT.md` end-to-end and confirms (a) the cutover was executed as documented (export → dry-run → real run → verify), (b) the empty-database condition + 6-doc stray-cleanup deviation are accepted, and (c) the audit narrative in SECURITY.md § Firestore Data Model + § Phase 5 Audit Index is honest and complete.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0
deferred: 1

## Gaps
