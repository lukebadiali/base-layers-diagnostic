---
phase: 05
slug: firestore-data-model-migration-rules-authoring-committed-not-deployed
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-08
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (existing, environment: `happy-dom`) + Vitest 3.x (new, environment: `node`) for rules suite |
| **Config file** | `vitest.config.js` (existing unit/snapshot suite) + `vitest.rules.config.js` (new — Wave 1 installs) |
| **Quick run command** | `npm test` (unit + snapshots, ~few seconds) |
| **Full suite command** | `npm test && npm run test:rules` (boots Firestore + Storage emulators via `firebase emulators:exec`) |
| **Estimated runtime** | ~30–90 seconds full (emulator startup ~10–20s + matrix iteration) |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (quick — pure unit + snapshot)
- **After every rules-touching task commit (Wave 1, Wave 6 cells, any `firestore.rules` / `storage.rules` edit):** Run `npm run test:rules` (boots emulators + executes the rules matrix)
- **After every plan wave:** Run `npm test && npm run test:rules`
- **Before `/gsd-verify-work`:** Full suite must be green; pre/post migration assertion harness output committed; dry-run log committed
- **Max feedback latency:** ~90 seconds (full)

---

## Per-Task Verification Map

> Granular task IDs (`05-NN-MM`) are filled in by the planner. The map below enumerates the verification axes Phase 5 must cover; the planner binds each axis to the concrete plan/task that creates the substrate.

| Verification Axis | Plan (planner-assigned) | Wave | Requirement(s) | Threat / Pitfall Ref | Secure Behavior | Test Type | Automated Command | Status |
|---|---|---|---|---|---|---|---|---|
| `@firebase/rules-unit-testing` v5 + emulator boot wired into CI | 01 | 1 | TEST-08 | Pitfall 1, Pitfall 4 | Rules tests run on every PR; emulator drift caught early | infra | `npm run test:rules -- --reporter=verbose` (CI) | ⬜ pending |
| Helper-rich predicate library compiled & emulator-loaded | 01 | 1 | RULES-01, RULES-02 | Pitfall 2 | `isAuthed()` denies anonymous + non-email-verified | rules-unit | `npm run test:rules -- predicates` | ⬜ pending |
| Strict mutation whitelist via `mutableOnly([...])` + `immutable(field)` | 01 | 1 | RULES-01, RULES-02 | Pitfall 3 | Field injection denied; identity-field changes denied | rules-unit | `npm run test:rules -- mutation-whitelist` | ⬜ pending |
| Tenant-jump matrix row (RULES-04) — every collection enumerated | 01 | 1 | RULES-04 | Pitfall 2, Pitfall 17 | `client_orgA` writing under `orgs/orgB/*` denied for every collection × op | rules-unit | `npm run test:rules -- tenant-jump` | ⬜ pending |
| Server-only deny-all blocks (`auditLog`, `softDeleted`, `rateLimits`) | 01–02 | 1 | RULES-03 | Pitfall 17 | All client roles × all ops denied; admin can read `auditLog`+`softDeleted`; nobody can write client-side | rules-unit | `npm run test:rules -- server-only-deny-all` | ⬜ pending |
| Storage rules size + MIME + path-scope (RULES-05) | 01 | 1 | RULES-05 | H6 server-side | Oversized + wrong-MIME + cross-tenant path uploads denied | rules-unit | `npm run test:rules -- storage` | ⬜ pending |
| Soft-delete predicate (`notDeleted(r)`) parallel matrix | 01 | 1 | RULES-01, RULES-02 | Pitfall 17 | Reads of soft-deleted docs denied for non-admin | rules-unit | `npm run test:rules -- soft-delete-predicate` | ⬜ pending |
| Per-doc idempotency markers under `migrations/{stepId}/items/{docId}` | 02 | 2 | DATA-01, DATA-02 | Pitfall 10 | Re-run skips already-completed source docs; partial-run resumes deterministically | unit (script) | `npm run test:migrate -- idempotency` | ⬜ pending |
| Migration `--dry-run` flag — write-site short-circuit | 02 | 2 | DATA-01, DATA-02 | Pitfall 10 | Dry-run produces inspection log; zero Firestore writes; zero marker writes | unit (script) | `npm run test:migrate -- dry-run` | ⬜ pending |
| Pre/post migration assertion harness — doc-count + field-presence | 02 | 2 | DATA-06 | Pitfall 10 | Zero data loss; every source doc accounted for in target subcollection | unit (script) | `npm run test:migrate -- assertions` | ⬜ pending |
| Inline `legacyAppUserId` / `legacyAuthorId` written on every user-referencing doc | 02 | 2 | DATA-03 | Pitfall 5 | Every migrated doc with author/user reference has the legacy field set | unit (script) | `npm run test:migrate -- legacy-fields` | ⬜ pending |
| `data/responses.js` body rewritten — subcollection access; API stable | 03 | 3 | DATA-01, DATA-04 | regression | Phase 4 D-09 contract held; existing `views/*` integration tests green | integration | `npm test -- src/data/responses` | ⬜ pending |
| `data/comments.js` body rewritten — subcollection access; API stable | 03 | 3 | DATA-01, DATA-04 | regression | Phase 4 D-09 contract held | integration | `npm test -- src/data/comments` | ⬜ pending |
| `data/actions.js` body rewritten — subcollection access; API stable | 03 | 3 | DATA-01, DATA-04 | regression | Phase 4 D-09 contract held | integration | `npm test -- src/data/actions` | ⬜ pending |
| `data/documents.js` body rewritten — subcollection access; API stable | 03 | 3 | DATA-01, DATA-04 | regression | Phase 4 D-09 contract held | integration | `npm test -- src/data/documents` | ⬜ pending |
| `data/messages.js` body rewritten — subcollection access; API stable | 03 | 3 | DATA-01, DATA-04 | regression | Phase 4 D-09 contract held | integration | `npm test -- src/data/messages` | ⬜ pending |
| New `data/read-states.js` wrapper — Promise CRUD + `subscribeReadState` | 03 | 3 | DATA-04, DATA-07 | — | Server-time `pillarReads`/`chatLastRead` written via `serverTimestamp()`; subscribe semantics match Phase 4 D-10 | integration | `npm test -- src/data/read-states` | ⬜ pending |
| H7 fix — `domain/unread.js` reads server-time `readStates` | 04 | 4 | DATA-07 | H7 / Pitfall 20 | 5-minute client-clock-skew test does NOT change unread counts (ROADMAP SC #4) | unit | `npm test -- src/domain/unread` | ⬜ pending |
| H8 fix — `data/cloud-sync.js` rewritten; per-subcollection listeners | 04 | 4 | DATA-04 | H8 / Pitfall 20 | Phase 2 TEST-06 baseline replaced; new dispatcher contract pinned by tests | integration | `npm test -- src/data/cloud-sync` | ⬜ pending |
| Snapshot stability — `views/*` rendered HTML unchanged across migration | 04 | 4 | TEST-10 carry-forward | regression | Zero diff vs Phase 2 D-08 snapshots | snapshot | `npm test -- snapshot` | ⬜ pending |
| Pre-migration `gcloud firestore export` — runbook documents the command + bucket | 05 | 5 | DATA-01, DATA-02 | Pitfall 10 | Operator can locate the export and run `gcloud firestore import` for rollback | runbook (manual) | (see Manual-Only) | ⬜ pending |
| Production migration executed; per-doc markers + post-assertions green | 05 | 5 | DATA-01, DATA-06 | Pitfall 10, Pitfall 20 | Pre/post counts match; no orphan source docs; no duplicate target docs | unit (script) + manual run | `node scripts/migrate-subcollections/run.js --verify` | ⬜ pending |
| RULES-06 deploy-gate enforcement — `firebase.json` rules path declared but no deploy command in any wave | 06 | 6 | RULES-06 | Sequencing #2 | Grep for `firebase deploy --only firestore:rules` returns zero hits across this phase's commits | grep / CI assertion | `git log --grep="firebase deploy" -p phase-05..HEAD` returns empty | ⬜ pending |
| `SECURITY.md` DOC-10 increment — 4 new sections + Phase 5 audit index | 06 | 6 | DOC-10 | — | Sections present; commit-SHA backfill at phase close | doc grep | `grep "Firestore Data Model\|Firestore Security Rules\|Storage Rules\|Phase 5 Audit Index" SECURITY.md` returns 4 hits | ⬜ pending |
| Cleanup-ledger zero-out — 6 Phase 4 carryover rows close; 4 new rows queued | 06 | 6 | — | — | Ledger has zero open rows for Phase 5; 4 new rows tagged Phase 6/7 | doc grep | `grep -c "Phase 5" .planning/cleanup-ledger.md` matches expected | ⬜ pending |
| Per-directory coverage thresholds maintained (Phase 4 D-21) | 06 | 6 | TEST-08 carry-forward | — | `data/**` ≥ 95%, `domain/**` = 100% | coverage | `npm run test:coverage` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Phase 5 has no dedicated Wave 0; Wave 1 doubles as the test-substrate-first wave per CONTEXT.md D-10. The following infra must land in **Wave 1** before any rules cell or migration step is implemented:

- [ ] `vitest.rules.config.js` — separate config, `environment: 'node'` (cannot share with happy-dom unit suite)
- [ ] `tests/rules/setup.js` — `RulesTestEnvironment` factory + fixture seeders via `withSecurityRulesDisabled`
- [ ] `tests/rules/firestore.test.js` — table-driven matrix scaffolding (role × collection × op)
- [ ] `tests/rules/storage.test.js` — parallel matrix for storage paths × roles × ops
- [ ] `tests/rules/tenant-jump.test.js` — cross-cutting tenant-jump suite (every collection)
- [ ] `tests/rules/soft-delete-predicate.test.js` — `notDeleted()` predicate cross-cutting suite
- [ ] `tests/rules/server-only-deny-all.test.js` — `auditLog` / `softDeleted` / `rateLimits` deny-all assertions
- [ ] `package.json` — add `@firebase/rules-unit-testing@^5` + ensure `firebase-tools` devDep present + add `npm run test:rules` script invoking `firebase emulators:exec --only firestore,storage "vitest --config vitest.rules.config.js"`
- [ ] `firebase.json` — add `firestore` (rules path + indexes path) and `storage` (rules path) declarations + emulator port pins (firestore 8080, storage 9199); deploy command stays untouched
- [ ] `.github/workflows/ci.yml` — `actions/setup-java` step (SHA-pinned per TOOL-09) + `npm run test:rules` step

Wave 2 prerequisite (before migration script body):

- [ ] `firebase-admin@^13` added as devDependency
- [ ] `tests/scripts/migrate-subcollections/` — assertion harness (DATA-06) + idempotency-marker test fixtures + dry-run output schema

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|---|---|---|---|
| Pre-migration `gcloud firestore export` | DATA-01, DATA-02 | One-shot human-supervised invocation; cannot run in CI without prod credentials | Wave 5 runbook: operator runs `gcloud firestore export gs://bedeveloped-base-layers-backups/pre-phase5-migration/<ISO-timestamp>/`; verifies `gsutil ls` of the export path returns ≥ 1 metadata file; commits the runbook entry with the timestamp + bucket URI |
| Production migration cutover (the actual one-shot run) | DATA-01..06 | Single human-supervised invocation against production Firestore; not safe for CI | Wave 5 runbook: dry-run first, eyeball log, then drop `--dry-run`; capture pre/post assertion harness output; commit log file alongside the runbook |
| Backup bucket existence + IAM | DATA-04 | Cannot be probed from CI without service account; operator-only | Wave 5 runbook prelude: `gsutil ls gs://bedeveloped-base-layers-backups/` confirms bucket exists; IAM grants `roles/datastore.importExportAdmin` to the operator's principal |
| `gcloud firestore import` rollback rehearsal | DATA-04 | Costly to run pointlessly; verified by procedure-readiness, not literal restore | Runbook documents the command verbatim; rollback gate is "if pre/post assertion harness fails, operator runs documented import" — the procedure is the artefact |
| 5-minute client-clock skew test | DATA-07 | UI-level scenario; not strictly manual (covered by `domain/unread` unit test with mocked clock) but human-verify the unread counter in-browser as a smoke check | Wave 4 UAT entry: open dashboard, set system clock +5 min, post a comment as another user, verify unread badge unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0/Wave 1 dependencies tagged
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (the migration runbook's manual steps are bracketed by the assertion harness — sampling continuity preserved)
- [ ] Wave 1 covers all MISSING references for rules infra
- [ ] Wave 2 covers all MISSING references for migration script infra
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s for full suite
- [ ] `nyquist_compliant: true` set in frontmatter once planner fills task IDs

**Approval:** pending
