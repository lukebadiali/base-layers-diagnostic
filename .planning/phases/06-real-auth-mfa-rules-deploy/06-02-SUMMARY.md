---
phase: 06-real-auth-mfa-rules-deploy
plan: 02
plan_id: 06-02
subsystem: auth-cloud-functions
tags: [auth, cloud-functions, claims, blocking-triggers, callable, vitest, tdd]
requires:
  - 06-01 (Wave 1 preflight: Identity Platform + Firestore region + firebase.json declarations + functions/src/auth/.keep scaffold)
  - functions/ workspace (Phase 3 — firebase-admin@13.8.0 + firebase-functions@7.2.5 + 2nd-gen + europe-west2 substrate)
  - functions/src/csp/{cspReportSink,normalise,filter,dedup}.ts (Phase 3 — pattern source for region/logger + sibling pure-helper test seam)
provides:
  - functions/src/auth/claim-builder.ts (pure transform AllowlistEntry|null -> CustomClaims; the unit-test seam)
  - functions/src/auth/beforeUserCreated.ts (beforeUserCreatedHandler — reads internalAllowlist, sets claims in first ID token)
  - functions/src/auth/beforeUserSignedIn.ts (beforeUserSignedInHandler — structured Cloud Logging audit entry)
  - functions/src/auth/setClaims.ts (setClaims onCall — admin-only role/orgId mutation + poke marker)
  - functions/test/auth/claim-builder.test.ts (6 Vitest unit tests across 3 describe blocks)
  - functions/src/index.ts re-exports for all 3 new handlers alongside existing cspReportSink
affects:
  - Wave 5 (06-05) cutover — these handlers are what the cutover runbook deploys; AUTH-03/05/06/07 substrate now lands
  - Wave 4 (06-04) bootstrap — internalAllowlist seeder docs are read by beforeUserCreated; claim shape is contract-locked
  - Phase 7 (FN-01..09) — auditLog/ writer back-fills sign-in events from Cloud Logging entries this wave emits; setClaims gets enforceAppCheck:true + Zod validation
  - Phase 7 (TEST-09) — firebase-functions-test integration coverage layered on top of these handlers (Phase 6 ships unit-test seam only)
tech-stack:
  added:
    - firebase-functions/v2/identity (beforeUserCreated, beforeUserSignedIn) — auth-blocking triggers, 7s deadline
    - firebase-functions/v2/https (onCall, HttpsError) — callable substrate
    - firebase-admin/auth (getAuth().setCustomUserClaims) — claim mutation API
    - firebase-admin/firestore (FieldValue.serverTimestamp) — poke marker timestamp
  patterns:
    - sibling pure-logic helper as Vitest test seam (mirror of functions/src/csp/{normalise,filter}.ts)
    - "ESM .js import path even for .ts source" — required by functions/tsconfig.json + vitest.config.ts
    - "if (!getApps().length) initializeApp()" — Admin SDK double-init guard for emulator + cold-start re-imports
    - region: "europe-west2" + minInstances:1 on auth-blocking handlers (D-09 + Pitfall 12)
    - "callable re-reads claims from request.auth.token, never trusts caller payload"
    - poke pattern users/{uid}/_pokes/{Date.now()} (ARCHITECTURE.md §7 Flow C — forces ID-token refresh on listener path)
    - structured logger.info("auth.user.created", {...}) — Cloud Logging jsonPayload, queryable by field; no console.* (ESLint no-console=error)
key-files:
  created:
    - functions/src/auth/claim-builder.ts (29 lines — pure transform, zero firebase-* imports)
    - functions/src/auth/beforeUserCreated.ts (40 lines — auth-blocking, reads allowlist, returns customClaims)
    - functions/src/auth/beforeUserSignedIn.ts (25 lines — observation-only structured log)
    - functions/src/auth/setClaims.ts (54 lines — admin gate + setCustomUserClaims + poke write)
    - functions/test/auth/claim-builder.test.ts (31 lines — 6 tests across 3 describe blocks)
  modified:
    - functions/src/index.ts (4 re-exports total: cspReportSink + 3 new auth handlers; header comment updated for Phase 6)
decisions:
  - TDD cadence honoured per Phase 5 D-10: RED commit (e45b85e — failing test, module-not-found) precedes GREEN commit (fe621e3 — pure-logic implementation passes 6/6 tests)
  - claim-builder.ts is import-free of firebase-functions/firebase-admin (purity invariant — verified by 0-occurrence grep); this is what makes it Vitest-runnable without firebase-functions-test (deferred to Phase 7 TEST-09)
  - All 3 handlers pinned to europe-west2 (D-09 — co-located with cspReportSink + Firestore database; UK data-residency for PRIVACY.md Phase 11)
  - minInstances:1 on both blocking triggers (D-09 + Pitfall 12); setClaims callable does NOT carry minInstances (admin-initiated, latency-insensitive)
  - Plan-internal deviation accepted at authoring time: deferred Zod input validation + enforceAppCheck:true to Phase 7 (FN-03 / FN-07); minimal manual gates (typeof data.uid === "string" + admin claim check) are Phase 6's floor; cleanup-ledger row queued in Wave 6 per plan
  - functions/src/auth/.keep placeholder left in place (Wave 1 scaffold; Wave 6 cleanup may sweep — plan does not direct removal in this wave)
metrics:
  duration_minutes: ~7 (00:50 -> 00:57 UTC)
  completed_date: 2026-05-09
  tasks_completed: 2
  commits: 3 (RED + GREEN + Task-2 handlers)
  test_files_added: 1
  source_files_added: 4
  source_files_modified: 1
  tests_passing: 37/37 (6 new + 31 pre-existing csp)
threat_register_addressed:
  - T-06-02-01 (caller claims role/orgId in setClaims body): mitigated — request.auth.token.role === "admin" gate at handler entry; data.role/data.orgId scoped to target only
  - T-06-02-02 (non-admin invokes setClaims): mitigated — HttpsError("permission-denied") thrown
  - T-06-02-03 (case-mismatch allowlist bypass): mitigated — event.data.email.toLowerCase() before doc lookup
  - T-06-02-04 (cold-start exceeds 7s): mitigated — minInstances:1 on both blocking triggers
  - T-06-02-05 (malformed allowlist doc): mitigated — buildClaims AllowlistEntry|null signature; null path falls through to {role:"client", orgId:null}; explicit {role, orgId} projection drops unrelated fields
  - T-06-02-06 (no auditable record for sign-in): accepted (D-21 — Phase 6 Cloud Logging only; Pitfall 17 mitigation deferred to Phase 7)
  - T-06-02-07 (logger.info dumps PII): accepted — fields are bounded set (uid, email, provider, mfa-count); SECURITY.md §Authentication & Sessions documents the field set in Wave 6
  - T-06-02-08 (Admin SDK double-init): mitigated — if (!getApps().length) initializeApp() guard at module top
  - T-06-02-09 (Phase 7 inherits setClaims without enforceAppCheck): accepted — admin-only via caller-claim gate; cleanup-ledger row tracks Phase 7 hardening
---

# Phase 6 Plan 02: Auth Blocking + Callable Cloud Functions Summary

**One-liner:** Land the 4-file `functions/src/auth/` mini-module — pure-logic `claim-builder.ts` (Vitest test seam), `beforeUserCreated` blocking trigger that wires `internalAllowlist/{email}` → custom claims (Pitfall 6 mitigation #3, claims in first ID token), `beforeUserSignedIn` structured-log observer, and `setClaims` admin-only callable with poke pattern — all in `europe-west2` with `minInstances:1` on the blocking triggers, behind a tests-first cadence (RED commit precedes GREEN commit per Phase 5 D-10).

## What landed

**4 new TypeScript source files** in `functions/src/auth/` (mirroring the existing `functions/src/csp/` Pattern A layout):

1. **`claim-builder.ts`** (29 lines, pure-logic test seam) — `buildClaims(allowlistEntry: AllowlistEntry | null): CustomClaims`. Null falls through to `{role: "client", orgId: null}` (Pitfall 6 + ARCHITECTURE.md §7 Flow B). Explicit `{role, orgId}` projection drops unrelated fields (`addedBy` etc.). Zero `firebase-functions/*` or `firebase-admin/*` imports — the purity invariant is what makes Vitest unit-testing feasible without `firebase-functions-test` (deferred to Phase 7 TEST-09).

2. **`beforeUserCreated.ts`** (40 lines, auth-blocking trigger) — reads `internalAllowlist/{email.toLowerCase()}` via single doc-by-id (never list-walk per Pitfall 12 7s deadline), passes the doc data through `buildClaims`, returns `{customClaims}` so claims land in the user's first ID token. `region: "europe-west2"` + `minInstances: 1`. Admin SDK init guarded by `if (!getApps().length)`. Structured `logger.info("auth.user.created", {uid, email, role, orgId})` for Cloud Logging audit substrate.

3. **`beforeUserSignedIn.ts`** (25 lines, observation-only auth-blocking trigger) — structured `logger.info("auth.user.signin", {uid, email, provider, mfa})`. Zero Firestore writes (D-21 + Pitfall 17 — Phase 7 FN-01 wires the Firestore-side `auditLog/` writer + back-fills from these Cloud Logging entries). `region: "europe-west2"` + `minInstances: 1`.

4. **`setClaims.ts`** (54 lines, admin-only HTTPS callable) — `request.auth.token.role === "admin"` gate at handler entry (throws `HttpsError("permission-denied")` otherwise). Manual `typeof data.uid === "string"` validation gate (Zod deferred to Phase 7 FN-03 per D-10 / cleanup-ledger row queued for Wave 6). Calls `getAuth().setCustomUserClaims(uid, {role, orgId})`, then writes the `users/{uid}/_pokes/{Date.now()}` marker per ARCHITECTURE.md §7 Flow C — forces target-session listener to refresh ID token via `getIdToken(true)` so post-creation claim mutations propagate without a manual refresh. `region: "europe-west2"` (no `minInstances` — admin-initiated, latency-insensitive).

**1 new test file**:
5. **`functions/test/auth/claim-builder.test.ts`** (31 lines, 6 Vitest tests across 3 describe blocks) — covers the 4 allowlisted-entry cases (admin/internal/client/admin-with-orgId), the null fallthrough, and the unrelated-fields drop. ESM `.js` import path matches the existing `functions/test/csp/` convention.

**1 modified file**:
6. **`functions/src/index.ts`** — adds 3 new `export { … } from "./auth/*.js"` lines alongside the existing `cspReportSink` re-export. Compiled `functions/lib/index.js` confirms all 4 exports are present (verified via grep at line 3 of the .js artefact).

## TDD gate compliance

Per Phase 5 D-10 + Phase 6 D-01 Wave 2 (tests-first cadence), Task 1 lands as two atomic commits:

| Gate | Commit | Status |
|------|--------|--------|
| RED — `test/auth/claim-builder.test.ts` lands; module-not-found on `src/auth/claim-builder.js` | `e45b85e` | failing test verified before implementation |
| GREEN — `src/auth/claim-builder.ts` lands; 6/6 tests pass | `fe621e3` | typecheck + lint clean; full suite 37/37 |

REFACTOR gate — not exercised; the implementation is minimal-and-correct on first land (3 lines of logic + interface declarations). No cleanup needed.

## Verification results

| Check | Command | Result |
|-------|---------|--------|
| Vitest (claim-builder only) | `cd functions && npx vitest run claim-builder` | 6/6 pass (249ms) |
| Vitest (full suite) | `cd functions && npm test` | 4 files, 37/37 pass (421ms) — 6 new + 31 pre-existing csp |
| TypeScript typecheck | `cd functions && npm run typecheck` | clean (0 errors) |
| TypeScript build | `cd functions && npm run build` | clean; `lib/auth/{beforeUserCreated,beforeUserSignedIn,setClaims,claim-builder}.js` + `.js.map` all emitted |
| ESLint | `cd functions && npm run lint` | clean (`--max-warnings=0` honoured; no-console rule respected — all logging via `logger`) |
| `region: "europe-west2"` grep | `grep -E "region.*europe-west2" functions/src/auth/*.ts` | 3 matches (one per handler) |
| `minInstances: 1` grep | `grep -E "minInstances.*1" functions/src/auth/*.ts` | 2 matches (beforeUserCreated + beforeUserSignedIn — setClaims correctly absent) |
| index.js exports | `grep -E "exports\\.(cspReportSink\|beforeUserCreatedHandler\|beforeUserSignedInHandler\|setClaims)" functions/lib/index.js` | 4 exports on the same chained-assignment line |
| `claim-builder.ts` purity | `grep "firebase-(functions\|admin)" functions/src/auth/claim-builder.ts` | 0 matches (purity invariant verified) |

## Deviations from Plan

**None — plan executed as written.** All 6 done-criteria of Task 1 + all 11 done-criteria of Task 2 met. No Rule 1/2/3 auto-fixes required. No Rule 4 architectural escalations.

**One environment fix-up (not a deviation):** The worktree shipped without `functions/node_modules/`, so `npm run typecheck` and `npm run lint` failed initially with "Cannot find module 'firebase-functions/v2/https'" + "Cannot find module '@typescript-eslint/parser'". Resolved by running `cd functions && npm ci` once (395 packages installed in 9s). This is parallel-executor worktree boilerplate, not a code deviation.

## No deployment occurred

Wave 2 is source-code authoring only. **Zero `firebase deploy` invocations were made** in this wave. The plan's Wave 5 (06-05) owns the operator-supervised cutover deploy under the runbook gate ordering documented in `06-CONTEXT.md` D-11 (functions FIRST → admin bootstrap + sign-in + claims-verify → rules deploy + Anonymous Auth disable). Build-artefact verification (`functions/lib/auth/*.js` emitted; `lib/index.js` re-exports all 4 handlers) is the local Wave 2 substitute for production deployment confirmation; production-side absence verification (`firebase functions:list` showing handlers absent until cutover) defers to Wave 5 Step 2 (operator-supervised, where firebase-tools auth is available — the worktree is autonomous and cannot reliably authenticate firebase-tools to call against production).

## Authentication gates

None — this wave is fully autonomous. All steps executed without operator intervention.

## Known stubs

None. All 4 source files have full bodies; the test file covers 6/6 documented cases; the index re-exports are wired through to compiled output. The `functions/src/auth/.keep` Wave 1 placeholder remains in place — its purpose has been satisfied by Wave 2's population of the directory, but the plan does not direct its removal in this wave (cleanup may be folded into Wave 6 if desired). Not a stub — a no-op breadcrumb.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| _(none)_ | — | All security-relevant surface introduced (auth-blocking triggers, admin callable) is fully covered by `06-02-PLAN.md`'s `<threat_model>` register T-06-02-01 through T-06-02-09. No new surface emerged during execution. |

## Commits

| # | Hash    | Type    | Subject                                                                  |
|---|---------|---------|--------------------------------------------------------------------------|
| 1 | e45b85e | test    | add failing tests for buildClaims (RED)                                  |
| 2 | fe621e3 | feat    | implement buildClaims pure transform (GREEN)                             |
| 3 | d124b5e | feat    | add auth-blocking + callable handlers (europe-west2)                     |

## Self-Check

| Claim | Verification | Result |
|-------|--------------|--------|
| `functions/src/auth/claim-builder.ts` exists | file present (29 lines) | FOUND |
| `functions/src/auth/beforeUserCreated.ts` exists | file present (40 lines) | FOUND |
| `functions/src/auth/beforeUserSignedIn.ts` exists | file present (25 lines) | FOUND |
| `functions/src/auth/setClaims.ts` exists | file present (54 lines) | FOUND |
| `functions/test/auth/claim-builder.test.ts` exists | file present (31 lines) | FOUND |
| `functions/src/index.ts` modified with 3 re-exports | grep matches all 4 export lines | FOUND |
| Commit e45b85e (RED) in git log | `git log --oneline` | FOUND |
| Commit fe621e3 (GREEN) in git log | `git log --oneline` | FOUND |
| Commit d124b5e (handlers) in git log | `git log --oneline` | FOUND |

## Self-Check: PASSED
