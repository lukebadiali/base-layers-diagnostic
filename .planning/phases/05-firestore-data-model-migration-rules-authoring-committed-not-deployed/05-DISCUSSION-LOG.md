# Phase 5: Firestore Data Model Migration + Rules Authoring (Committed, Not Deployed) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 05-firestore-data-model-migration-rules-authoring-committed-not-deployed
**Areas discussed:** Migration execution model, Staging clone strategy, Wave shape & sequencing, Rules architecture + test fixture pattern + scope

> **Note:** Area 1 (Migration execution model) was answered in a prior session (2026-05-07); decisions persisted in `05-DISCUSS-CHECKPOINT.json`. Areas 2–4 answered in this session (2026-05-08) after resuming from checkpoint.

---

## Migration Execution Model

| Option | Description | Selected |
|--------|-------------|----------|
| Local Node script (admin SDK) | One-shot, human-supervised, bypasses Rules; lives at `scripts/migrate-subcollections/run.js`. | ✓ |
| Cloud Function callable in `functions/` | Triggered via gcloud; runs in Cloud Function quota; needs App Check exemption during the run. | |
| Cloud Function `onSchedule` | Self-firing on a cron; least operator control. | |

**User's choice:** Local Node script (admin SDK)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-doc markers in `migrations/{stepId}/items/{docId}` | One marker per source doc; re-runs check the marker first. | ✓ |
| Per-step markers | One marker per migration step (collection); coarser granularity. | |
| In-memory (no markers) | Re-runs would duplicate or destroy. | |

**User's choice:** Per-doc markers in `migrations/{stepId}/items/{docId}`

| Option | Description | Selected |
|--------|-------------|----------|
| Inline legacy fields on every doc that references a user | `legacyAppUserId` / `legacyAuthorId` preserved verbatim alongside new shape. | ✓ |
| Sidecar map collection `legacyIdMap/{appUserId}` | Separate collection mapping app-internal id → forthcoming Firebase UID. | |
| Don't preserve | Phase 6 has nothing to backfill against. | |

**User's choice:** Inline legacy fields on every doc that references a user

| Option | Description | Selected |
|--------|-------------|----------|
| Manual `gcloud firestore export` immediately before prod migration | Operator-run; export written to a backup bucket; rollback is `gcloud firestore import`. | ✓ |
| Pull Phase 8 BACKUP-01 forward | Implement automated daily exports now instead of in Phase 8. | |
| Rely on Firestore PITR only | 7-day rolling recovery window; no human-driven snapshot. | |

**User's choice:** Manual `gcloud firestore export` immediately before prod migration

**Notes:** Closes Pitfall 10 ("never re-key without a backup"). The export becomes evidence in `SECURITY.md` audit index.

---

## Staging Clone Strategy

> User pushed back on the initial framing — "why would we do it separate, doesn't make a lot of sense for me." The original options (separate Firebase project / multi-database / emulator-only) were reframed after a discussion of why the textbook "use a staging Firebase project" recommendation didn't apply to THIS project's context (no live users, idempotent migration, pre-migration export as rollback, emulator covers rules tests).

| Option | Description | Selected |
|--------|-------------|----------|
| Separate Firebase project | Pitfall 1's textbook recommendation; permanent staging project with duplicate IAM, OIDC pool, App Check site keys. | |
| Same project, named DB (multi-database) | Cheaper than separate project but same Auth users + IAM. | |
| Local emulator only | Cheapest for dev iteration; no real-region behaviour. | |
| **No staging at all — run directly against production** (user-clarified) | Pre-migration `gcloud firestore export` + per-doc idempotency markers are the rollback substrate; emulator covers rules tests. | ✓ |

**User's choice:** No staging at all — run directly against production

**Notes:** User's clarifying message: "lets just run what we need to on the actual database." Justification captured in CONTEXT.md D-05: project is between client engagements with no live writes; migration is a one-shot script; emulator covers rules-unit-tests; the export-as-rollback already locked in (D-04) is the same recovery mechanism a staging project would provide. Audit-narrative line in SECURITY.md will explicitly capture the rationale so a future reviewer doesn't conclude "they skipped the staging step."

| Option | Description | Selected |
|--------|-------------|----------|
| `--dry-run` flag in the script | Walks every doc, computes target shape, logs `would write` without writing; produces an inspection log auditors can read. | ✓ |
| Local emulator-restored fixture | Pull a small representative export, import into firestore-emulator, run script iteratively. | |
| Just run iteratively against prod — idempotency markers are enough | Trust the per-doc markers + export rollback; first run does the migration, subsequent runs are no-ops. | |

**User's choice:** `--dry-run` flag in the script

**Notes:** Dry-run output committed alongside the migration runbook becomes evidence the dry-run was performed.

---

## Wave Shape & Sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| 6 waves: rules-first, then migration, then `data/*` rewrites, then H7/H8, then prod-cutover runbook, then cleanup | Mirrors Phase 4's 6-wave shape; one coherent boundary per wave; matches Phase 1 D-25 atomic-commit pattern. | ✓ |
| 5 waves: migration-first, then rules, then `data/*`, then H7/H8 + cutover, then cleanup | Rules written against actually-migrated shape but app broken between Wave 2 and Wave 4. | |
| 4 waves: rules + migration parallel, then `data/*`, then H7/H8 + cutover | Faster but fat first wave strains atomic-commit pattern. | |

**User's choice:** 6 waves: rules-first, then migration, then `data/*` rewrites, then H7/H8, then prod-cutover runbook, then cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 5 runs the prod migration; Phase 6 only deploys rules + Auth | Data shape change in Phase 5; trust-boundary change in Phase 6 — clean separation; mitigates Pitfall 20 bundled-cutover risk. | ✓ |
| Phase 5 stops at "migration script ready and dry-run-verified"; Phase 6 runs the prod migration alongside rules + Auth cutover | One big cutover but Phase 6 already carries Auth + rules-deploy weight. | |
| Phase 5 runs migration on staging only — production migration runs in Phase 6 | Eliminated by the staging decision (D-05) — listed for completeness. | |

**User's choice:** Phase 5 runs the prod migration; Phase 6 only deploys rules + Auth

| Option | Description | Selected |
|--------|-------------|----------|
| Strict tests-first inside each wave | Red-then-green per wave; matches Phase 2 D-15 + Phase 4 contract; strongest audit narrative. | ✓ |
| Tests + implementation in same commit per wave | Faster iteration; weaker test-as-spec discipline. | |
| Implementation first, tests written after each wave settles | Build-then-verify; weakest narrative; conflicts with Phase 2 / Phase 4 precedent. | |

**User's choice:** Strict tests-first inside each wave

**Notes:** Wave 4's terminal commit pair (H7 commit + H8 commit) is the most rigorous tests-first beat — Phase 2 TEST-06 breaks by design and is replaced in the same commit.

---

## Rules Architecture + Test Fixture Pattern + Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Helper-rich library at top of `firestore.rules` | `isAuthed()`, `role()`, `orgId()`, `isInternal()`, `isAdmin()`, `inOrg()`, `notDeleted()`, `isOwnAuthor()`, `immutable(field)`, `mutableOnly(fields)` — match blocks read as English. | ✓ |
| Thin — inline the predicate logic in each match block | Verbose; ~20 sites repeat the auth check; brittle to predicate changes. | |
| Hybrid — helpers for cross-cutting predicates only | Middle ground; less convention to memorise. | |

**User's choice:** Helper-rich library at top of `firestore.rules`

| Option | Description | Selected |
|--------|-------------|----------|
| Strict whitelist on every update path via `mutableOnly([...])` | Plus `immutable(field)` on identity fields; closes Pitfall 3; tenant-jump test is one-line. | ✓ |
| Identity-field immutability only | Cheaper; weaker; allows arbitrary-field injection. | |
| Strict whitelist on parent-org and user docs only | Pragmatic middle ground; partial coverage. | |

**User's choice:** Strict whitelist on every update path via `mutableOnly([...])`

| Option | Description | Selected |
|--------|-------------|----------|
| Table-driven role × collection × op matrix at `tests/rules/firestore.test.js` | Vitest iterates; `RulesTestEnvironment` seeds; complete coverage by construction; tenant-jump = one row. | ✓ |
| Explicit per-collection test files | Easier to read single-collection rules; more boilerplate; tenant-jump duplicated. | |
| Hybrid — table-driven matrix + dedicated cross-cutting test files | Matrix for the grid; dedicated files for invariants spanning collections. | (extension included via D-16) |

**User's choice:** Table-driven role × collection × op matrix (with hybrid extension folded in per D-16 — dedicated `tenant-jump.test.js`, `soft-delete-predicate.test.js`, `server-only-deny-all.test.js` for cross-cutting invariants)

| Option | Description | Selected |
|--------|-------------|----------|
| Subcollections + deny-blocks; rate-limit ships `allow read, write: if false`; Phase 7 adds `request.time` predicate | Phase 5 covers all collections in scope; rate-limit predicate body deferred to Phase 7's FN-09 (its writers). | ✓ |
| Full rules including rate-limit predicate now | Predicate without writers is dead code; tests speculative until FN-09 lands. | |
| Subcollections only; defer all server-only collection rules to phases that own them | Production rules file fragmented across 4 phases; awkward "partially committed not deployed" framing. | |

**User's choice:** Subcollections + deny-blocks; rate-limit ships `allow read, write: if false`; Phase 7 adds `request.time` predicate

---

## Claude's Discretion

- Migration script repo path (`scripts/migrate-subcollections/run.js` vs `scripts/migrations/{stepId}/run.js` vs `tools/migrate.js`) — planner picks the convention matching existing repo conventions
- Per-collection migration step ordering within Wave 5 — Pitfall 10 leaves-first ordering; planner sequences within Wave 5
- Rules predicate naming subtleties (`isMember(o)` vs `inOrg(o)` vs `inTenant(o)`)
- Test matrix runner format — Vitest `describe.each([...rows])` vs custom matrix iterator
- Storage rules MIME allowlist constant location — duplicate from `ui/upload.js` or hardcode (rules can't `import`); cleanup-ledger row queued either way

## Deferred Ideas

- Nightly rules tests against a real Firebase project (Pitfall 4 prevention) — out of scope for Phase 5 (rules not deployed); cleanup-ledger row queued for Phase 6
- Sidecar `legacyIdMap/{appUserId}` collection — rejected in favour of inline fields (D-03); revisit if Phase 6 backfill discovers a reason
- Pre-deploying rules to a separate Firebase project for nightly integration testing — rejected with the staging decision (D-05); cleanup-ledger row queued for Phase 6
- Migrating `funnelComments` to subcollection of `orgs/{orgId}/*` — ARCHITECTURE.md §4 leaves it top-level "for now"; v2 sweep
- Pre-emptively writing the rate-limit `request.time` predicate in Phase 5 — Phase 7 FN-09 owns this
