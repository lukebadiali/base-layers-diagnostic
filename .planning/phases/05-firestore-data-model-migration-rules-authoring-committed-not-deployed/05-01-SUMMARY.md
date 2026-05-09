---
phase: 05-firestore-data-model-migration-rules-authoring-committed-not-deployed
plan: 01
subsystem: security-rules
tags: [rules, firestore, storage, emulator, ci, tdd, predicate-library, tenant-isolation, audit-log, soft-delete, mass-assignment]
requires:
  - "Phase 4 src/ui/upload.js MAX_BYTES + ALLOWED_MIME_TYPES (storage.rules validMime mirrors)"
  - "Phase 1 .github/workflows/ci.yml SHA-pinning convention"
  - "@firebase/rules-unit-testing@5.0.0 (already in devDependencies)"
  - "firebase-tools@15.16.0 (already in devDependencies)"
provides:
  - "firestore.rules at repo root with predicate library + 13 collection match blocks per D-17"
  - "storage.rules at repo root with isAuthed/inOrg/validSize/validMime + path-scoped + global deny-all fallback"
  - "tests/rules/{setup,firestore,storage,tenant-jump,soft-delete-predicate,server-only-deny-all}.test.js — 176-cell matrix"
  - "vitest.rules.config.js — Node-environment vitest config separated from happy-dom default"
  - "npm run test:rules — firebase emulators:exec wrapper for the rules suite"
  - "CI test-rules job (SHA-pinned setup-java v4.8.0) gating the build pipeline"
  - "firestore.indexes.json — empty initial body required by firebase.json firestore declaration"
affects:
  - "Phase 6 will deploy these rules in lockstep with the Auth + custom-claims cutover (RULES-07)"
  - "Phase 7 FN-09 replaces the rateLimits deny-all rule with a request.time predicate"
  - "Phase 7 FN-01..06 + FN-08 own the auditLog/softDeleted server-side write surface (current rules deny client writes)"
  - "Phase 8 extends notDeleted(r) coverage to comments + messages subcollections (TODO-skipped scaffolds in soft-delete-predicate.test.js)"
  - "Phase 5 Wave 3 wrappers (responses/comments/actions/documents/messages/readStates) test against this rules surface in the emulator"
tech-stack:
  added:
    - "@firebase/rules-unit-testing v5 initializeTestEnvironment API (already installed; first use)"
    - "actions/setup-java@c1e323688fd81a25caa38c78aa6df2d33d3e20d9 # v4.8.0 (SHA-pinned per TOOL-09)"
  patterns:
    - "RESEARCH.md Pattern 4 — initializeTestEnvironment + per-file projectIdSuffix isolation"
    - "RESEARCH.md Pattern 5 — ROLES table + asUser/asStorageUser custom-claim helpers"
    - "RESEARCH.md Pattern 6 — predicate library at top of firestore.rules (D-14)"
    - "RESEARCH.md Pattern 7 — storage.rules MIME allowlist mirroring src/ui/upload.js"
    - "RESEARCH.md Pattern 8 — firebase.json additive declarations (rules + emulator port pins)"
    - "RESEARCH.md Pattern 10 — CI test-rules job with setup-java + emulators:exec"
    - "Conventional Commits — feat(05-01) for rules + ci(05-01) for CI workflow"
key-files:
  created:
    - "firestore.rules — 159 lines; predicate library + 13 collection match blocks (orgs parent + 6 subcollections + users + internalAllowlist + auditLog + softDeleted + rateLimits + roadmaps + funnels + funnelComments)"
    - "storage.rules — 44 lines; isAuthed/inOrg/validSize/validMime + path-scoped match + global deny-all fallback"
    - "firestore.indexes.json — empty initial body"
    - "vitest.rules.config.js — separate Node-env Vitest config (singleFork true)"
    - "tests/rules/setup.js — RulesTestEnvironment factory + ROLES + asUser/asStorageUser; per-file projectIdSuffix parameter for isolation"
    - "tests/rules/firestore.test.js — 71-cell role x collection x op matrix"
    - "tests/rules/storage.test.js — 14-cell tenant + size + MIME + delete + catch-all matrix"
    - "tests/rules/tenant-jump.test.js — 28-cell RULES-04 dedicated cross-tenant suite (7 paths x 4 ops)"
    - "tests/rules/soft-delete-predicate.test.js — 3-cell notDeleted(r) suite + Phase 8 scaffold rows"
    - "tests/rules/server-only-deny-all.test.js — 60-cell auditLog/softDeleted/rateLimits deny-all suite"
  modified:
    - "firebase.json — additive firestore + storage rules path declarations + firestore (8080) + storage (9199) emulator port pins; existing hosting + functions blocks unchanged"
    - "package.json — added test:rules script (firebase emulators:exec wrapper)"
    - "package-lock.json — regenerated (no version churn)"
    - ".github/workflows/ci.yml — new test-rules job (SHA-pinned setup-java v4.8.0); build.needs extended with test-rules"
decisions:
  - "ID: D-14 closure — isAuthed() includes both email_verified == true AND sign_in_provider != 'anonymous' (Pitfall 2 closure verified by 6 anonymous-role deny cells in firestore.test.js)"
  - "ID: D-15 closure — every allow update path uses mutableOnly([...]) + immutable(field); mass-assignment cell asserts client_orgA cannot inject role:admin into an existing actions doc (verified)"
  - "ID: D-16 closure — 5 ROLES x ~16 paths x 4 ops cells iterate via describe.each in firestore.test.js; cells are paste-ready static data, not dynamic table generation"
  - "ID: D-17 closure — every collection enumerated in the plan's <interfaces> block is covered by a match block in firestore.rules (parent + 6 subcollections + 7 top-level collections)"
  - "ID: AUDIT-07 / Pitfall 17 closure — auditLog/{eventId} rule is allow read: if isAdmin(); internal CANNOT read own audit records; verified by tests/rules/firestore.test.js cell 'internal read auditLog/e1 -> deny' AND tests/rules/server-only-deny-all.test.js admin-can-read-but-not-write contract"
  - "ID: Pitfall 1 closure — every subcollection has its OWN match block (rules NOT cascading); documents/{docId}, messages/{msgId}, etc. each carry their own predicates"
  - "ID: RULES-06 closure — zero firebase deploy --only firestore:rules invocations in enforcement files (yml/json/js); .md mentions are explicit FORBIDDING statements, not invocations"
  - "ID: setup-java pinned to v4.8.0 (SHA c1e323688fd81a25caa38c78aa6df2d33d3e20d9) — resolved via gh api repos/actions/setup-java/git/refs/tags; latest stable v4 release at execution time"
  - "ID: per-file projectIdSuffix isolation — Rule 1 deviation closing the singleFork true cross-file clearFirestore interference (see Deviations section)"
metrics:
  duration: "~50 minutes (Wave 1 atomic-commit pattern)"
  tasks-completed: 3
  commits: 2
  test-files: 5
  test-cells: 176
  test-pass-rate: "100% (176/176 green)"
  rules-files: 2
  predicate-functions: 9
  collection-match-blocks: 13
  completed-date: "2026-05-08"
---

# Phase 5 Plan 01: Wave 1 Foundation — firestore.rules + storage.rules + rules-unit-testing matrix Summary

**One-liner:** Helper-rich Firestore + Storage security rules (predicate library D-14 verbatim; 13 collection match blocks; mutation whitelist D-15) shipped alongside a 176-cell @firebase/rules-unit-testing v5 matrix that runs against local emulators in CI on every PR — with rules COMMITTED but NOT DEPLOYED (RULES-06 / Sequencing Non-Negotiable #2).

## What Shipped

### Rules surface

- **`firestore.rules`** (159 lines) — predicate library at top of `/databases/{database}/documents` block:
  - `isAuthed()` (Pitfall 2 closure: requires `email_verified == true` AND `sign_in_provider != "anonymous"`)
  - `role()` / `orgId()` / `isInternal()` / `isAdmin()` / `inOrg(o)` (custom-claims-driven)
  - `notDeleted(r)` / `isOwnAuthor(r)` (document-shape predicates)
  - `immutable(field)` / `mutableOnly(fields)` (mass-assignment guards — D-15 / Pitfall 3)
  - 13 collection match blocks per D-17 (parent + 6 subcollections + 7 top-level)
  - `auditLog/{eventId}` rule: `allow read: if isAdmin()` (AUDIT-07 / Pitfall 17 — internal CANNOT read own audit records)
  - `rateLimits/{uid}/buckets/{windowStart}` rule: `allow read, write: if false` (Phase 7 FN-09 replaces)

- **`storage.rules`** (44 lines) — `validSize() <= 25 MiB` + `validMime()` allowlist mirroring `src/ui/upload.js` `MAX_BYTES` + `ALLOWED_MIME_TYPES` exactly; path-scoped `match /orgs/{orgId}/documents/{docId}/{filename}`; global `match /{allPaths=**} { allow read, write: if false }` defense-in-depth fallback.

### Test scaffolding

- **`tests/rules/setup.js`** — shared RulesTestEnvironment factory + ROLES table (5 roles per D-16) + `asUser` / `asStorageUser` helpers. `initRulesEnv(service, projectIdSuffix)` accepts a per-file projectIdSuffix to namespace emulator state across test files (deviation Rule 1 — see below).

- **`tests/rules/firestore.test.js`** — 71-cell `describe.each` matrix iterating `role x collection x op` with explicit allow/deny per cell. Includes:
  - Pitfall 2 closure cells (anonymous denied on every read)
  - Tenant isolation cells (client_orgB denied reading orgA)
  - Mass-assignment cell (client_orgA cannot inject `role: admin` into an existing actions doc — D-15 / Pitfall 3 closure)
  - Cross-user readState cell (client_orgA denied reading u_other_user's readState)
  - internalOnly comment visibility cell (client denied; internal/admin allowed)
  - AUDIT-07 cell (internal denied auditLog read; admin allowed)
  - Server-only write cells (admin denied writing auditLog/softDeleted via client rules)

- **`tests/rules/storage.test.js`** — 14-cell matrix covering tenant scope, 26 MiB validSize deny, application/zip validMime deny, cross-tenant upload deny, delete-role-gate, catch-all deny-all fallback. Closes H6 server-side (RULES-05).

- **`tests/rules/tenant-jump.test.js`** — RULES-04 dedicated suite. 7 paths x 4 ops = 28 cells; every cell asserts `client_orgA writing/reading orgs/orgB/*` denies.

- **`tests/rules/soft-delete-predicate.test.js`** — `notDeleted(r)` cross-cutting suite. Phase 5 only `orgs/{orgId}` parent uses it; Phase 8 scaffold rows are TODO-skipped placeholders for comments + messages.

- **`tests/rules/server-only-deny-all.test.js`** — 60-cell suite asserting auditLog/softDeleted/rateLimits deny every client role on every op; admin reads of auditLog + softDeleted allow; rateLimits deny-all even for admin (Phase 5; FN-09 replaces in Phase 7); nobody writes via client rules.

### Tooling + CI

- **`vitest.rules.config.js`** — separate Vitest config (`environment: node`, `include: ['tests/rules/**/*.test.js']`, `singleFork: true`) so the rules suite doesn't collide with the happy-dom default in `vite.config.js`.

- **`package.json`** — `test:rules` script invokes `firebase emulators:exec --only firestore,storage --project demo-project-rules "vitest run --config vitest.rules.config.js"`. `@firebase/rules-unit-testing@5.0.0` + `firebase-tools@15.16.0` already in devDeps (no version churn).

- **`firebase.json`** — additive `firestore` + `storage` rules path declarations; `firestore: 8080` + `storage: 9199` emulator port pins. Existing `hosting` + `functions` blocks unchanged.

- **`firestore.indexes.json`** — empty initial body (`{ "indexes": [], "fieldOverrides": [] }`); required by `firebase.json` firestore declaration.

- **`.github/workflows/ci.yml`** — new `test-rules` job (SHA-pinned `actions/setup-java@c1e323688fd81a25caa38c78aa6df2d33d3e20d9 # v4.8.0`, `distribution: temurin`, `java-version: '17'`). `build.needs` extended with `test-rules` so `build` (and downstream `deploy` + `preview`) gate on the rules matrix being green.

## Verification Evidence

### `npm run test:rules` (local, against PyCharm-bundled JBR 21.0.7 — JRE 11+ requirement met)

```
Test Files  5 passed (5)
     Tests  176 passed (176)
  Start at  10:43:00
  Duration  12.23s
```

All 176 cells green. Per-file breakdown:
- `firestore.test.js` — 71/71
- `storage.test.js` — 14/14
- `tenant-jump.test.js` — 28/28 (7 paths x 4 ops)
- `soft-delete-predicate.test.js` — 3/3 (Phase 8 rows TODO-skipped)
- `server-only-deny-all.test.js` — 60/60 (3 paths x 4 client roles x 4 ops + admin reads + admin write denials)

### RULES-06 verification (zero deploy invocations)

```bash
$ git grep -l "firebase deploy --only firestore:rules" -- '*.yml' '*.json' '*.js'
(empty — exit 1)
```

The `.md` matches in the working tree are explicit FORBIDDING statements in `.planning/phases/05/*.md` + `.planning/research/*.md` documenting the gate, not invocations.

### Pitfall 6 verification (no v4 API)

```bash
$ grep -c "initializeAdminApp\|initializeTestApp" tests/rules/setup.js
0
$ grep -c "initializeTestEnvironment" tests/rules/setup.js
3
```

### Predicate library verification (D-14)

```bash
$ grep -c "function isAuthed()" firestore.rules                 # 1
$ grep -c "sign_in_provider.*anonymous" firestore.rules          # 1 (Pitfall 2)
$ grep -c "email_verified" firestore.rules                       # 1
$ grep -c "function mutableOnly" firestore.rules                 # 1 (D-15)
$ grep -c "function immutable" firestore.rules                   # 1
$ grep -c "function notDeleted" firestore.rules                  # 1
```

### Storage MIME allowlist mirror verification (RULES-05)

```bash
$ grep -c "25 \* 1024 \* 1024" storage.rules                     # 1 (matches src/ui/upload.js MAX_BYTES)
$ grep -cE "application/pdf|image/jpeg|image/png|spreadsheetml|text/plain" storage.rules  # 5
```

All 6 MIME types from `src/ui/upload.js ALLOWED_MIME_TYPES` are present (the wordprocessingml + spreadsheetml share the `spreadsheetml|wordprocessingml` regex shorthand for grep counts; the file has both regex matchers).

### CI test-rules job verification (Task 3)

```bash
$ grep -c "test-rules:" .github/workflows/ci.yml                              # 1
$ grep -c "actions/setup-java@[0-9a-f]\{40\}" .github/workflows/ci.yml         # 1 (40-char SHA)
$ grep -c "actions/setup-java@v" .github/workflows/ci.yml                      # 0 (no tag refs)
$ grep -E "needs:.*test-rules" .github/workflows/ci.yml                        # build job depends on test-rules
$ node -e "const y = require('js-yaml'); y.load(require('fs').readFileSync('.github/workflows/ci.yml'))"
# (no error - valid YAML)
```

### setup-java SHA resolution (TOOL-09)

The 40-char SHA `c1e323688fd81a25caa38c78aa6df2d33d3e20d9` corresponds to `actions/setup-java@v4.8.0`, resolved at execution time via:

```bash
$ gh api repos/actions/setup-java/git/refs/tags --paginate
# v4.8.0 -> "sha": "c1e323688fd81a25caa38c78aa6df2d33d3e20d9", "type": "commit"
```

This is the latest stable v4 release at execution time (v5 also exists but the plan specifies v4 line). Annotation comment in ci.yml: `# v4.8.0`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Per-file projectIdSuffix isolation in tests/rules/setup.js**

- **Found during:** Task 2 STEP 3 (running `npm run test:rules`).
- **Issue:** Initial implementation of `initRulesEnv` used a single hardcoded `projectId: "demo-project-rules"` shared across all 5 test files. With `vitest.rules.config.js`'s `singleFork: true`, all test files share one Node process, but each file's `beforeAll` creates its own `RulesTestEnvironment`. The underlying Firestore emulator is shared, and `RulesTestEnvironment.clearFirestore()` deletes ALL data for the projectId. When test files ran together, one file's `beforeEach` clearFirestore would race with another file's seeding, leaving subsequent reads to find non-existent docs and trip the rules engine's "Null value error" on `notDeleted(resource.data)`.
- **Symptom:** 4 deterministic failures in `firestore.test.js` (all the cells where `inOrg(orgId)` returned true and the rule then evaluated `notDeleted(resource.data)` against a wiped doc). `firestore.test.js` passed 71/71 when run in isolation; failed 4/71 in the full 5-file suite.
- **Diagnostic:** A standalone `diag-rules.mjs` script exercising the same setup/seed/read flow against the emulator passed cleanly, confirming the rules + seed mechanics were correct in isolation. Running `firestore.test.js` alone passed 71/71. Running the full suite produced the deterministic 4-failure pattern. This pinpointed cross-file interference as the root cause.
- **Fix:** Added a `projectIdSuffix` parameter to `initRulesEnv(service, projectIdSuffix)` so each test file gets a unique projectId namespace:
  - `firestore.test.js` → `demo-rules-fs-matrix`
  - `storage.test.js` → `demo-rules-storage-matrix`
  - `tenant-jump.test.js` → `demo-rules-tenant-jump`
  - `soft-delete-predicate.test.js` → `demo-rules-soft-delete`
  - `server-only-deny-all.test.js` → `demo-rules-server-only`
- **Files modified:** `tests/rules/setup.js` (added projectIdSuffix parameter); 5 `tests/rules/*.test.js` files (passed unique suffixes to `initRulesEnv`).
- **Commit:** `4fe36b9` (folded into the atomic Wave 1 commit per D-25).

**2. [Note - Acceptance criterion grep semantics]**

- **Found during:** Verification of acceptance criteria.
- **Issue:** Plan Task 2 acceptance criterion `grep -c "allow write: if false" firestore.rules returns at least 3` returns 2 in the actual rule file. The plan's intent was to verify 3 server-only collections deny writes; my rule file expresses this as 2 `allow write: if false` (auditLog + softDeleted) plus 1 `allow read, write: if false` (rateLimits). All 3 server-only collections do deny writes; the literal grep count is 2 only because rateLimits combines `read, write` per the plan's `<interfaces>` block specification (lines 800-803).
- **Outcome:** The rule semantics are correct — 3 collections deny writes server-side. The `<interfaces>` form for rateLimits was specified verbatim by the plan (`allow read, write: if false`). No rule change needed.
- **Files modified:** None. Documented for audit-trail clarity.

### Authentication Gates

None. Local emulator execution required Java JRE 11+, which was not on the host's PATH but was available via PyCharm's bundled JBR 21.0.7 at `/c/Program Files/JetBrains/PyCharm 2025.2/jbr/bin/java.exe`. CI uses `actions/setup-java@v4.8.0` with `temurin` distribution / `java-version: 17` so this is not a concern in CI; documented for local-developer reproducibility.

## Threats Status

| Threat ID  | Disposition before | Disposition after | Evidence |
|------------|---------------------|--------------------|----------|
| T-5-03     | mitigate            | **mitigated**      | `isAuthed()` requires `email_verified == true` AND `sign_in_provider != "anonymous"`; 6 anonymous-role deny cells in firestore.test.js + 1 in storage.test.js |
| T-5-04     | mitigate            | **mitigated**      | `inOrg(orgId)` predicate; tests/rules/tenant-jump.test.js asserts 28 deny cells across 7 paths x 4 ops |
| T-5-05     | mitigate            | **mitigated**      | `mutableOnly([...])` + `immutable(...)` on every update path; mass-assignment cell asserts client_orgA cannot inject `role:admin` into an existing actions doc |
| T-5-06     | mitigate            | **mitigated**      | `auditLog/{eventId}` rule `allow read: if isAdmin(); allow write: if false`; tests/rules/server-only-deny-all.test.js asserts internal denied auditLog read (AUDIT-07 pinned) and no client role writes |
| T-5-07     | mitigate            | **mitigated**      | `validSize() <= 25 MiB` + `validMime()` allowlist mirroring src/ui/upload.js; tests/rules/storage.test.js asserts 26 MiB + application/zip + cross-tenant denials |
| T-5-08     | mitigate            | **mitigated**      | `notDeleted(r)` enforced on `orgs/{orgId}` read; tests/rules/soft-delete-predicate.test.js asserts deletedAt-bearing docs deny reads (Phase 8 extends scaffold rows) |
| T-5-09     | mitigate            | **mitigated**      | Wave 1 lands rules + tests but `firebase deploy --only firestore:rules` is NOT invoked; verified via `git grep -l` on enforcement files (yml/json/js) returning empty |
| T-5-rules-emulator-drift | accept | **accepted (carryover row queued)** | Phase 6 cleanup-ledger row queued: "once rules deploy to prod, schedule a nightly CI job that runs the rules-unit-test suite against the real Firestore project" |

## Known Stubs

None. The rules surface is feature-complete for Phase 5 scope. The `rateLimits` deny-all is INTENTIONAL per D-17 (FN-09 in Phase 7 replaces with a `request.time` predicate); not a stub but a documented forward-pointer.

## Threat Flags

None. The rules surface introduces no new trust boundaries beyond what `<threat_model>` enumerates.

## TDD Gate Compliance

This is a `type: execute` plan (not `type: tdd`), but Tasks 1 + 2 follow a RED → GREEN cycle within the atomic Wave 1 boundary per D-10 strict tests-first:

- Task 1 wrote 5 test files before the rules existed (RED state — `readFileSync('firestore.rules')` would error). The plan's STEP 11 acknowledged this is the expected RED state.
- Task 2 wrote `firestore.rules` + `storage.rules` to make the matrix green (GREEN state).
- Tasks 1 + 2 were folded into a single atomic commit (`4fe36b9`) per Phase 1 D-25 atomic-commit pattern + this plan's STEP 5 ("Stage Task 1 + Task 2 outputs together; commit in one atomic boundary").
- The single-commit boundary means the RED state is not observable in git history — but it WAS the local execution state. This is a documented Wave 1 atomic-commit pattern, not a TDD violation.

Task 3 (CI test-rules job) is a separate atomic commit (`089e006`) per the plan's instruction that Task 3 is its own commit.

## Self-Check: PASSED

**Files created (verified via `test -f`):**
- FOUND: firestore.rules
- FOUND: storage.rules
- FOUND: firestore.indexes.json
- FOUND: vitest.rules.config.js
- FOUND: tests/rules/setup.js
- FOUND: tests/rules/firestore.test.js
- FOUND: tests/rules/storage.test.js
- FOUND: tests/rules/tenant-jump.test.js
- FOUND: tests/rules/soft-delete-predicate.test.js
- FOUND: tests/rules/server-only-deny-all.test.js

**Files modified (verified via `git log -p`):**
- FOUND: firebase.json (firestore + storage rules + emulator ports added)
- FOUND: package.json (test:rules script added)
- FOUND: package-lock.json (regenerated)
- FOUND: .github/workflows/ci.yml (test-rules job added; build.needs extended)

**Commits (verified via `git log --oneline`):**
- FOUND: `4fe36b9 feat(05-01): wave 1 firestore.rules + storage.rules + rules-unit-testing matrix`
- FOUND: `089e006 ci(05-01): add test-rules job with SHA-pinned setup-java`

**Acceptance criteria (verified):**
- npm run test:rules exits 0 with full matrix green (5 test files / 176 tests passed)
- RULES-06 verification: `git grep -l "firebase deploy --only firestore:rules" -- '*.yml' '*.json' '*.js'` returns empty
- Pitfall 6: zero `initializeAdminApp|initializeTestApp` references in tests/rules/
- D-14 predicate library: 9 helper functions present and verified
- D-15 mutation whitelist: every allow update path uses mutableOnly + immutable as applicable
- D-17 collection scope: 13 collection match blocks (orgs parent + 6 subcollections + users + internalAllowlist + auditLog + softDeleted + rateLimits + roadmaps + funnels + funnelComments)
- AUDIT-07 / Pitfall 17: auditLog rule allow read: if isAdmin() (NOT isInternal); verified by tests/rules/firestore.test.js cell 'internal read auditLog/e1 -> deny'
- TOOL-09 SHA-pinning: actions/setup-java@c1e323688fd81a25caa38c78aa6df2d33d3e20d9 # v4.8.0 (40-char hex SHA + comment)
- YAML validity: js-yaml load passes; jobs.test-rules + jobs.build.needs include test-rules

## Hand-off

Wave 2 (`05-02-PLAN.md`) ships the migration script body + `--dry-run` flag + per-doc idempotency markers + pre/post doc-count assertion harness. Wave 2 tests against the rules surface this wave landed (the migration script uses firebase-admin SDK which bypasses rules — but the post-migration verification step exercises the new shape against the rules). Wave 3 rewrites the 6 data/* wrappers to use subcollections; Wave 3 tests inherit this rules surface as the contract.

The CI `test-rules` job runs on every PR going forward — any rule regression breaks the build before merge. The `build` job's extended `needs` list ensures rules-green is a hard gate for the deploy + preview channels.

RULES-06 / Sequencing Non-Negotiable #2 remains held: `firebase deploy --only firestore:rules` will be invoked in **Phase 6 only**, in lockstep with the Auth + custom-claims cutover.
