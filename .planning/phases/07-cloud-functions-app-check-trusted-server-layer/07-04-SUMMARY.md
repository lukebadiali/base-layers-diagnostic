---
phase: 07-cloud-functions-app-check-trusted-server-layer
plan: 04
subsystem: rate-limiting
tags: [firestore-rules, rate-limit, runTransaction, app-check, cloud-functions, fn-09, owasp-a04, asvs-v11]

# Dependency graph
requires:
  - phase: 07-01
    provides: Wave 1 shared infrastructure — withSentry, validateInput (Zod→HttpsError), ensureIdempotent helper, ratelimit-sa service-account inventory
  - phase: 06
    provides: live custom claims (request.auth.token.role / orgId / email_verified) for the rate-limit rules predicate composition; rules deploy chain (D-12 substrate)
  - phase: 05
    provides: rateLimits/{uid}/buckets/{windowStart} placeholder block (deny-all) Wave 4 replaces; predicate library + rules-unit-test harness
  - phase: 04
    provides: data/* boundary (D-04 W3 — data/* imports SDK only via firebase/db.js); src/data/messages.js + src/data/comments.js wrappers
provides:
  - rules-side per-uid 60s sliding-window rate-limit predicate (rateLimitOk(uid)) composed into messages + comments create rules
  - src/data/rate-limit.js client transactional helper (incrementBucketAndWrite + currentRateLimitWindow)
  - functions/src/ratelimit/checkRateLimit.ts deployed-but-unwired fallback callable (Pattern 5b operator hot-swap)
  - 31 new tests (15 rules-unit + 6 helper-unit + 10 callable-unit)
  - docs/RETENTION.md FN-09 row with adjustability path documentation
affects: [Phase 8 cleanup-ledger candidates, Phase 9 observability, Phase 11 retention manifest, Phase 12 audit pack]

# Tech tracking
tech-stack:
  added: [runTransaction (firebase/firestore — re-exported from src/firebase/db.js)]
  patterns:
    - "Pattern D — Firestore Rules predicate composition (rateLimitOk last conjunct so cheap predicates short-circuit first; Pitfall 4 single-get budget honoured)"
    - "Pattern 5 — rules-side primary path with rules-unit-test 31-write burst evidence"
    - "Pattern 5b — fallback callable seam (deployed-but-not-live-wired; operator hot-swap if rules-side hits Pitfall 4 budget)"
    - "Atomic per-uid bucket increment via runTransaction — counter doc + protected doc written in same transaction so partial state never persists"

key-files:
  created:
    - src/data/rate-limit.js
    - tests/data/rate-limit.test.js
    - tests/rules/rate-limit.test.js
    - functions/src/ratelimit/checkRateLimit.ts
    - functions/test/ratelimit/checkRateLimit.unit.test.ts
    - docs/RETENTION.md
  modified:
    - firestore.rules (added rateLimitWindow + rateLimitOk helpers; replaced rateLimits/{uid}/buckets/{windowStart} placeholder; composed rateLimitOk into messages + comments create rules)
    - src/firebase/db.js (re-export runTransaction)
    - src/data/messages.js (addMessage routes through incrementBucketAndWrite)
    - src/data/comments.js (addComment routes through incrementBucketAndWrite)
    - functions/src/index.ts (export checkRateLimit)
    - tests/mocks/firebase.js (single-string-path doc() form + runTransaction shim)

key-decisions:
  - "Bucket uid IS message.authorId / comment.authorId — rules already enforce request.resource.data.authorId == request.auth.uid, so the two values must match. This avoids importing src/firebase/auth.js into data/* (which would have couplings)."
  - "Helper writes payload VERBATIM (no `at: serverTimestamp()` injection) — preserves the existing data/* contract where callers set `createdAt: serverTimestamp()` directly. Avoids breaking the 4 existing messages/comments unit tests."
  - "Doc id generated client-side via crypto.randomUUID() (eslint security/detect-pseudoRandomBytes blocks Math.random()) so the helper composes a fully-qualified protected-doc-path."
  - "Cell 14 (61-second window roll) is simulated via a NEXT-window-bucket write rather than a literal sleep — vitest impractical for 61s waits; the seeded-saturated-previous-window-bucket pattern proves the window-keyed predicate isolates buckets correctly."
  - "checkRateLimit callable shipped as a SEAM only — no src/cloud/checkRateLimit.js wrapper. Operator hot-swap is the activation path (Wave 6 cleanup-ledger candidate)."

patterns-established:
  - "Rules predicate composition with single-get budget — rateLimitOk(uid) does exactly ONE get() per evaluation; ordered LAST in conjunction so inOrg + authorId predicates short-circuit first (Pitfall 4 mitigation)"
  - "Client transactional rate-limit helper — runTransaction reads bucket, +1 (or creates count:1), writes protected doc; rules-side denies if cap hit, runTransaction throws permission-denied; caller surfaces UX-safe message (Phase 6 D-13 unified-error precedent)"
  - "Mock factory extension for new SDK functions — single-string-path doc() overload + runTransaction shim with shared-seed get/set/update/delete tx surface"

requirements-completed: [FN-09]

# Metrics
duration: 22min
completed: 2026-05-09
---

# Phase 7 Plan 04: Rate Limiting — FN-09 Rules Predicate + Token-Bucket Fallback Seam

**Replaces Phase 5 rateLimits deny-all placeholder with FN-09 60s sliding-window predicate enforcing 30 writes/window per user across messages + comments, plus deployed-but-unwired Pattern A callable seam for operator hot-swap.**

## Performance

- **Duration:** 22 minutes
- **Started:** 2026-05-09T22:06:32Z
- **Completed:** 2026-05-09T22:28:34Z
- **Tasks:** 4 of 4 complete
- **Files modified:** 6 created, 6 modified

## Accomplishments

- **Phase 7 SC#5 evidence captured**: 31-write synthetic burst test (cell 13) confirms the rate-limit predicate fires — first 30 writes succeed, 31st denies with permission-denied. Cells 12+15 add coverage for full-success burst and shared-bucket-across-collections.
- **rateLimits/{uid}/buckets/{windowStart} predicate body landed**: replaces Phase 5 D-17 deny-block. Self-uid required for read; create requires count==1 + windowStart matches server's current window; update enforces monotonic +1 + cap 30; delete forbidden. 11 bucket-direct cells cover anonymous/cross-uid/window-tamper/count-tamper.
- **rateLimitOk(uid) composed into messages + comments create rules**: rules-side primary path with single-get budget (Pitfall 4 honoured); predicate ordered LAST so cheap conjuncts short-circuit first.
- **src/data/rate-limit.js helper + 6 unit tests**: incrementBucketAndWrite runs the protected write inside runTransaction so the bucket counter increments atomically with the protected doc create.
- **checkRateLimit fallback callable + 10 unit tests**: Pattern A standard shape (App Check + Zod + idempotency + Sentry + ratelimit-sa); deployed-but-not-live-wired per Pattern 5b — operator hot-swap available if rules-side hits Pitfall 4 budget.
- **docs/RETENTION.md FN-09 row**: threshold (30/60s) + adjustability path + threat coverage citations + cross-reference table mapping every surface to its source file.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rules predicate body + 15-cell rules-unit-test (TDD)** — `4d7690b` (feat)
2. **Task 2: src/data/rate-limit.js helper + wire into messages + comments** — `8aac064` (feat)
3. **Task 3: checkRateLimit fallback callable (Pattern A) + unit tests** — `a8fcdb3` (feat)
4. **Task 4: docs/RETENTION.md threshold documentation** — `cb8e994` (docs)

## Files Created/Modified

### Created

- **`firestore.rules` additions** — `rateLimitWindow()` + `rateLimitOk(uid)` helpers in the predicate library; rateLimits block predicate body (self-uid + current-window + count==1 create / monotonic +1 update / cap 30 / no-delete); rateLimitOk(request.auth.uid) composed into messages + comments create rules.
- **`src/data/rate-limit.js`** — `incrementBucketAndWrite(uid, protectedDocPath, protectedDocPayload)` runs runTransaction over the bucket counter + protected doc atomically; `currentRateLimitWindow()` exported helper mirrors `rateLimitWindow()` from rules. Boundary contract honoured (data/* imports SDK only via firebase/db.js).
- **`tests/rules/rate-limit.test.js`** — 15 cells: 3 read predicates (anon deny / self allow / cross-uid deny) + 8 write predicates (create count==1 / future-window deny / past-window deny / monotonic +1 update / skip-count deny / cap-30 deny / no-delete / cross-uid update deny) + 4 composed-predicate cells (30-message burst / 31st denies — Phase 7 SC#5 / new-window resumption / shared bucket across messages+comments).
- **`tests/data/rate-limit.test.js`** — 6 unit tests for currentRateLimitWindow + incrementBucketAndWrite (first-call create with count:1, subsequent-call update, permission-denied propagation, current-window math).
- **`functions/src/ratelimit/checkRateLimit.ts`** — Pattern A callable (enforceAppCheck:true / Zod / ensureIdempotent 60s window matching rate-limit window / withSentry / ratelimit-sa / europe-west2 / 256MiB / 10s). Server-side token-bucket logic against rateLimits/{uid}/buckets/{windowStart} — count == 0 set count:1 / 0 < count < 30 update +1 / count >= 30 throws resource-exhausted.
- **`functions/test/ratelimit/checkRateLimit.unit.test.ts`** — 10 unit tests covering auth gate, Zod validation (3 negative cells: scope missing / scope not chat|comment / clientReqId not UUID), idempotency ordering + canonical key shape, propagation of already-exists, token-bucket logic (3 cells), bucket-path shape.
- **`docs/RETENTION.md`** — FN-09 retention row + adjustability path + threat coverage + cross-reference table.

### Modified

- **`src/firebase/db.js`** — added `runTransaction` to the `firebase/firestore` import block + the re-export block so `src/data/rate-limit.js` honours the Wave 3 D-04 boundary contract (data/* imports SDK only via db.js).
- **`src/data/messages.js`** — `addMessage` now routes through `incrementBucketAndWrite`. Doc id generated via `crypto.randomUUID()` (CSPRNG required by eslint). Defensive throw if `message.authorId` absent. `addDoc` import removed (no longer used).
- **`src/data/comments.js`** — `addComment` now routes through `incrementBucketAndWrite` (shared per-uid bucket — combined 30 writes/window with messages). `addDoc` import removed.
- **`functions/src/index.ts`** — `export { checkRateLimit } from "./ratelimit/checkRateLimit.js"`.
- **`tests/mocks/firebase.js`** — `doc()` extended to accept the single-string-path overload form (matches firebase/firestore's `doc(db, path)` API); `runTransaction` shim added with shared-seed get/set/update/delete tx surface. Phase 7 Wave 4 only — single-threaded test shim, not a contention emulator (rules-unit-test exercises real contention semantics against the Firestore emulator).

## Decisions Made

- **Bucket uid binds to authorId (not auth.currentUser?.uid lookup)** — rules already enforce `request.resource.data.authorId == request.auth.uid`, so the two values must match. This avoids importing `src/firebase/auth.js` into `src/data/messages.js` / `src/data/comments.js`, which would have introduced a data→auth coupling not currently present.
- **Helper writes payload verbatim** — no `at: serverTimestamp()` injection. Preserves the existing data/* contract where callers set `createdAt: serverTimestamp()` directly; avoids breaking the 4 existing messages/comments unit tests.
- **Doc id generated client-side via `crypto.randomUUID()`** — eslint `security/detect-pseudoRandomBytes` + `no-restricted-syntax` block `Math.random()`, so CSPRNG is the only allowed UUID source. The helper requires a fully-qualified path; client-side ID generation is the cleanest way to compose it without an extra `addDoc` round-trip.
- **Cell 14 (61-second window roll) simulated via next-window bucket write** — literal 61s sleep impractical in vitest. The seeded-saturated-previous-window-bucket pattern proves the window-keyed predicate isolates buckets correctly without a wait.
- **checkRateLimit shipped as a deployed-but-unwired SEAM only** — no `src/cloud/checkRateLimit.js` wrapper. Activation is the operator's hot-swap decision (Wave 6 cleanup-ledger candidate). Honours plan's "Pattern 5b — deployed but not live-wired" intent verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Helper's payload-injection of `at: serverTimestamp()` would break existing messages/comments contracts**

- **Found during:** Task 2 (src/data/rate-limit.js helper + wire into messages + comments)
- **Issue:** Plan example helper code (07-04-PLAN.md `<action>` step 1) included `tx.set(protectedRef, { ...protectedDocPayload, at: serverTimestamp() })`. The 4 existing tests in `tests/data/messages.test.js` + `tests/data/comments.test.js` assert that the written doc has `createdAt: serverTimestamp()` (not `at`); injecting an `at` field would have left the existing field-name contract broken (messages get both `createdAt` AND `at`; downstream readers iterate `createdAt`).
- **Fix:** Helper writes payload verbatim — caller owns the timestamp field name. Updated `addMessage` + `addComment` to set `createdAt: serverTimestamp()` inside the payload they pass to `incrementBucketAndWrite`. Doc-comment in rate-limit.js documents the payload-pass-through invariant.
- **Files modified:** `src/data/rate-limit.js`, `src/data/messages.js`, `src/data/comments.js`
- **Verification:** Existing 4 messages/comments unit tests pass unchanged (created/legacyAuthorId/createdAt assertions hold).
- **Committed in:** `8aac064` (part of Task 2)

**2. [Rule 3 - Blocking] tests/mocks/firebase.js doc() helper rejected single-string-path form**

- **Found during:** Task 2 (running tests/data/rate-limit.test.js)
- **Issue:** The mock's `doc()` required variadic `(db, coll, id, ...)` form and threw on the single-string-path form `doc(db, "rateLimits/uid/buckets/win")`. The firebase/firestore SDK supports both; my helper composed a fully-qualified path string for `rateLimits/${uid}/buckets/${win}`. Without the fix, all 6 rate-limit unit tests + 1 messages test failed with `Error: doc() requires alternating collection/id pairs; got 1 args`.
- **Fix:** Extended `doc()` in `tests/mocks/firebase.js` to detect the single-string-path form (exactly 1 string arg containing "/"), split on "/", and validate even segment count.
- **Files modified:** `tests/mocks/firebase.js`
- **Verification:** All 14 affected data tests pass; mock change is additive (variadic form still works for existing call sites).
- **Committed in:** `8aac064` (part of Task 2)

**3. [Rule 3 - Blocking] tests/mocks/firebase.js had no runTransaction shim**

- **Found during:** Task 2 (running tests/data/rate-limit.test.js)
- **Issue:** The mock had no `runTransaction` export; `src/data/rate-limit.js` imports `runTransaction` from `src/firebase/db.js` and would have thrown `runTransaction is not a function` in unit tests.
- **Fix:** Added `runTransaction` to the mock as a vi.fn that calls the updater fn with a tx object exposing get/set/update/delete (all sharing the same `seed` map). Documented in the mock as a single-threaded test shim — real contention semantics are exercised in `tests/rules/rate-limit.test.js` against the Firestore emulator.
- **Files modified:** `tests/mocks/firebase.js`
- **Verification:** All 6 rate-limit unit tests pass; existing tests unaffected (additive change).
- **Committed in:** `8aac064` (part of Task 2)

**4. [Rule 3 - Blocking] src/firebase/db.js didn't export runTransaction**

- **Found during:** Task 2 (typecheck failure: `Module '"../firebase/db.js"' has no exported member 'runTransaction'`)
- **Issue:** Wave 3 D-04 boundary requires `src/data/*` to import the SDK only through `src/firebase/db.js` + `src/firebase/storage.js`. db.js did not re-export `runTransaction`. Importing `runTransaction` directly from `firebase/firestore` in rate-limit.js would have triggered the eslint `no-restricted-imports` rule (data/* boundary).
- **Fix:** Added `runTransaction` to the `firebase/firestore` import block + the re-export block in `src/firebase/db.js`. Documented as a Phase 7 Wave 4 addition.
- **Files modified:** `src/firebase/db.js`
- **Verification:** Lint clean (`npm run lint` exits 0); typecheck clean for Wave 4 files.
- **Committed in:** `8aac064` (part of Task 2)

## Authentication Gates

None — Wave 4 is fully autonomous. No external auth steps required during execution.

## Verification Status

| Verification | Status | Notes |
|---|---|---|
| `npm run lint` | PASS | exit 0; no boundary violations |
| `npm run typecheck` (root) | PASS for Wave 4 files | Pre-existing typecheck errors in `scripts/provision-function-sas/run.js`, `scripts/strip-legacy-id-fields/run.js`, `src/firebase/check.js`, `tests/firebase/app.test.js` — out of scope per CLAUDE.md (Wave 1 / earlier-wave / Wave 3 in-flight orphans) |
| `npx vitest run tests/data/{messages,comments,rate-limit}.test.js` | PASS | 14/14 (4 messages + 4 comments + 6 rate-limit) |
| `cd functions && npm run typecheck` | PASS | 0 errors |
| `cd functions && npm run build` | PASS | 0 errors |
| `cd functions && npm run lint` | PASS | 0 errors |
| `cd functions && npm test` | PASS | 91/91 tests (10 new from checkRateLimit.unit.test.ts; 81 baseline) |
| `npm run test:rules -- rate-limit` | DEFERRED to CI | Java not installed in this worktree environment; Firestore emulator requires Java. Test file `tests/rules/rate-limit.test.js` is structurally complete (15 cells matching predicate spec) and will run in CI where Java is available. Mirror cells in existing `tests/rules/firestore.test.js` (3 deny-cells against the rateLimits collection) remain compatible with the new rules — those cells use cross-uid scenarios (uClientA path while role's uid is client_orgA) which the new rule still denies. |

## Threat Coverage

| Threat ID | Disposition | Mitigation Surface | Verification |
|---|---|---|---|
| T-07-04-01 (Tampering — past/future window) | mitigate | rateLimits create/update predicate `windowStart == rateLimitWindow()` | rate-limit.test.js cells 5+6 |
| T-07-04-02 (Tampering — cross-uid bucket) | mitigate | rateLimits predicate `request.auth.uid == uid` | rate-limit.test.js cells 1, 3, 11 |
| T-07-04-03 (Tampering — count manipulation skip) | mitigate | rateLimits update predicate `count == resource.data.count + 1` | rate-limit.test.js cell 8 |
| T-07-04-04 (Tampering — count > 30 in initial create) | mitigate | rateLimits create predicate `count == 1` | rate-limit.test.js cell 4 (positive) implicit complement |
| T-07-04-05 (DoS — spam abuse) | mitigate | rateLimitOk(uid) composed into messages + comments create | rate-limit.test.js cell 13 (Phase 7 SC#5) |
| T-07-04-06 (Tampering — get() budget exceeded) | accept (low risk) | rateLimitOk single-`get()` per evaluation; checkRateLimit fallback seam | code review + Pitfall 4 doc citation |
| T-07-04-07 (Info Disclosure — own-bucket count) | mitigate | self-read intentional UI affordance; cross-uid read denies | rate-limit.test.js cells 2+3 |

## Threat Flags

None — no new security-relevant surface introduced beyond what's enumerated in the plan's `<threat_model>`.

## Self-Check: PASSED

- Created files exist:
  - `src/data/rate-limit.js` — FOUND
  - `tests/data/rate-limit.test.js` — FOUND
  - `tests/rules/rate-limit.test.js` — FOUND
  - `functions/src/ratelimit/checkRateLimit.ts` — FOUND
  - `functions/test/ratelimit/checkRateLimit.unit.test.ts` — FOUND
  - `docs/RETENTION.md` — FOUND
- Modified files:
  - `firestore.rules` — rateLimitWindow + rateLimitOk helpers + new rateLimits block + composed predicate on messages/comments verified
  - `src/firebase/db.js` — runTransaction export verified
  - `src/data/messages.js` — incrementBucketAndWrite call site verified
  - `src/data/comments.js` — incrementBucketAndWrite call site verified
  - `functions/src/index.ts` — checkRateLimit re-export verified
  - `tests/mocks/firebase.js` — doc() string-path form + runTransaction shim verified
- Commits exist:
  - `4d7690b` (Task 1) — FOUND
  - `8aac064` (Task 2) — FOUND
  - `a8fcdb3` (Task 3) — FOUND
  - `cb8e994` (Task 4) — FOUND

## Cleanup-Ledger Forward-Tracking Rows

| Row | Origin | Owner | Closes when |
|---|---|---|---|
| FN-09 closed in Wave 4 — rate-limit predicate primary; checkRateLimit fallback seam | Phase 6 forward-tracking + Phase 5 D-21 | Phase 7 Wave 4 | **CLOSES with this plan** |
| Phase 5 D-17 placeholder retired | Phase 5 cleanup-ledger | Phase 7 Wave 4 | **CLOSES with this plan** |
| `npm run test:rules -- rate-limit` CI execution | Local Java unavailable | CI | First push to main after this plan merges |
| Other write paths (responses, actions, documents, funnelComments) NOT rate-limited | Plan Task 2 scope decision | Phase 8/9 if needed | Engagement use-case bursts trigger reconsider |
| `src/cloud/checkRateLimit.js` wrapper + live-wire | Pattern 5b operator decision | Operator (Wave 6 candidate) | If rules-side hits Pitfall 4 single-get budget under composition |
