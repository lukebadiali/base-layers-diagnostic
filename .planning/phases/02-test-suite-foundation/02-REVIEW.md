---
phase: 02-test-suite-foundation
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - src/auth/state-machine.js
  - src/data/cloud-sync.js
  - src/data/migration.js
  - src/domain/banding.js
  - src/domain/completion.js
  - src/domain/scoring.js
  - src/domain/unread.js
  - src/util/hash.js
  - src/util/ids.js
  - tests/auth/state-machine.test.js
  - tests/crypto-parity.test.js
  - tests/data/cloud-sync.test.js
  - tests/data/migration.test.js
  - tests/domain/banding.test.js
  - tests/domain/completion.test.js
  - tests/domain/scoring.test.js
  - tests/domain/unread.test.js
  - tests/fixtures/_generators/hash-passwords.js
  - tests/mocks/chartjs.js
  - tests/mocks/firebase.js
  - tests/setup.js
  - tests/setup.test.js
  - tests/util/hash.test.js
  - tests/util/ids.test.js
  - tests/views/dashboard.test.js
  - tests/views/diagnostic.test.js
  - tests/views/report.test.js
  - vite.config.js
  - eslint.config.js
  - .github/workflows/ci.yml
  - app.js
  - tsconfig.json
  - index.html
findings:
  critical: 0
  warning: 0
  info: 9
  total: 9
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-06T00:00:00Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found (info-only — no blocking issues)

## Summary

Phase 2 lands the tests-first regression baseline for the Phase 4 modular split. Eight leaf modules were extracted from `app.js` under D-05 byte-identical rules (verbatim source preserved; only the call surface — Pattern E wrappers — changed). Each extracted module ships with a focused test file, plus three view-level snapshot tests pin the pre-Phase-4 rendered HTML. Coverage thresholds are wired (100% for `src/domain/**` + `src/util/**`, 95% for `src/auth/**`, 90% for `src/data/**`), and a deliberate exclusion of `app.js` from coverage is documented at `vite.config.js:51-52` with cite to D-15.

**No bugs introduced by extraction.** I diffed every extracted module against the corresponding `app.js` origin range and the bodies are character-for-character preserved. The Pattern E wrappers in `app.js:250-291` reference closure variables (e.g. `state`, `commentsFor`, `cloudFetchAllOrgs`) that are declared *later* in the IIFE; this is safe because arrow-function bodies resolve names at call time, not at declaration time, and the comment at `app.js:261-262` calls this out explicitly. I confirmed every referenced name is in scope at the IIFE's runtime initialization point.

**No new security issues.** The two known weak-crypto surfaces (`src/util/hash.js` unsalted SHA-256, `src/auth/state-machine.js` plaintext-comparator path) are pre-existing and explicitly destined for Phase 6 (AUTH-14) deletion. Per the review-scope direction in the spawn prompt, these are flagged INFO not WARNING. The Phase 2 work also actively hardens the test-credential boundary — `eslint.config.js:132-148` adds a hard `no-restricted-imports` error blocking `src/**` and `app.js` from importing `tests/fixtures/auth-passwords.js`, which is a real defence-in-depth win for T-2-03.

**Test quality is high.** The boundary tables in `tests/domain/banding.test.js` are exhaustive at the 50/51 and 75/76 transitions; `tests/data/migration.test.js` includes a load-bearing idempotency assertion (line 125) plus a UID-determinism canary (line 20) that catches `tests/setup.js` drift before any extraction wave can mask it via shared mocks; `tests/crypto-parity.test.js` proves happy-dom's `crypto.subtle.digest` matches Node's `createHash` (Pre-flight 3). The view snapshot tests use `toMatchFileSnapshot` (D-08) with the proper `vi.resetModules()` + dynamic-import dance to re-run the IIFE against a fresh `state`, which is the right approach for an IIFE-bound app.

The 9 info-level items below are pre-existing latent issues that travelled across the byte-identical extraction. They are explicitly out-of-scope for Phase 2 (D-05 forbids behavioural changes) and most are already logged in `runbooks/phase-4-cleanup-ledger.md` for Phase 4 cleanup. I'm reporting them so reviewers don't have to re-discover them, not because Phase 2 should fix them.

## Info

### IN-01: `cloudOrgs.map((o) => o.id)` will crash on null array entries (pre-existing, byte-identical)

**File:** `src/data/cloud-sync.js:29`
**Issue:** `new Set(cloudOrgs.map((o) => o.id))` dereferences `o.id` without a null/undefined guard. If `cloudFetchAllOrgs` ever returns an array containing a `null` or `undefined` entry, the map throws before the defensive `o && o.id` check on line 37 fires. The test file at `tests/data/cloud-sync.test.js:143-149` explicitly acknowledges this asymmetry ("line 29's map ... dereferences without a null guard, so passing `null` would crash before the line 37 ... defensive check fires").
**Fix:** Already logged for Phase 4 / Phase 5 hardening in the cleanup ledger (per the test comment). Phase 2 must not change this — it's the H8 regression baseline. For Phase 5+ subcollection migration:
```js
const cloudOrgIds = new Set(cloudOrgs.filter((o) => o && o.id).map((o) => o.id));
```

### IN-02: `findUser(legacyId)` result asserted non-null without check (pre-existing, byte-identical)

**File:** `src/data/migration.js:87-89`
**Issue:**
```js
const leg = findUser(legacyId);
leg.orgId = v1Orgs[0].id;
```
If `upsertUser` silently failed (or a future `findUser` impl misbehaves) `leg` would be `null` and the property assignment would throw `TypeError: Cannot set properties of null`. Byte-identical to `app.js`. The control flow makes this practically unreachable today (the `upsertUser` two lines above is synchronous and writes to in-memory `users[]`) but a defensive null-check is cheap.
**Fix:** Phase 4 only:
```js
const leg = findUser(legacyId);
if (leg) {
  leg.orgId = v1Orgs[0].id;
  upsertUser(leg);
}
```

### IN-03: Unsalted SHA-256 password hashing (pre-existing, Phase 6 deletion target)

**File:** `src/util/hash.js:12-25`
**Issue:** `hashString` uses unsalted SHA-256 — vulnerable to rainbow-table lookup if a hash ever leaks. The header comment is correctly explicit ("NOT secure — just to avoid plaintext storage"). Per the spawn-prompt direction, this is INFO not WARNING because `src/util/hash.js` is the Phase 6 (AUTH-14) deletion target — it will be replaced by Firebase Auth + custom claims, at which point the comparator path goes away entirely.
**Fix:** No fix in Phase 2. Phase 6 deletes this module wholesale.

### IN-04: Plaintext-comparator auth path with hardcoded internal hash (pre-existing, Phase 6 deletion target)

**File:** `src/auth/state-machine.js:14-41` (and `app.js:448` `INTERNAL_PASSWORD_HASH`)
**Issue:** The three `verifyXxx` functions perform SHA-256 of a user-supplied password and compare against a stored hash without rate-limiting, account lockout, or constant-time comparison (`===` is short-circuit). The hash on `app.js:448` is hardcoded in source — a build-time secret. Per the spawn prompt, INFO not WARNING because the entire module is the explicit Phase 6 (AUTH-14) deletion baseline.
**Fix:** No fix in Phase 2. Phase 6 deletes this module wholesale and switches to Firebase Auth + custom claims (admin / org-client / user roles via `getCustomClaims`). The regression test file `tests/auth/state-machine.test.js` is also flagged for deletion alongside the production code (see file header lines 4-14).

### IN-05: `Math.random`-based UID has insufficient entropy + collision risk (pre-existing, Phase 4 cleanup target)

**File:** `src/util/ids.js:6-8`
**Issue:** `uid = (p) => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)` produces ~7 chars of base-36 random + 4 chars of timestamp suffix = roughly 36^7 ≈ 7.8×10^10 keyspace per millisecond. Collision risk is non-negligible at scale; the per-line `eslint-disable no-restricted-syntax` already flags this for Phase 4 replacement with `crypto.randomUUID()`. Note the eslint rule on `eslint.config.js:97-104` actively forbids `Math.random` everywhere except this one carve-out — which is a healthy guardrail.
**Fix:** Phase 4 cleanup ledger entry already exists. Replace with `crypto.randomUUID().slice(0, 11)` or similar. Phase 2 must not touch (D-05).

### IN-06: H7 clock-skew entanglement in unread comparators (pre-existing, Phase 5 fix target)

**File:** `src/domain/unread.js:17-19, 56-60`
**Issue:** `unreadCountForPillar` compares `c.createdAt` (server-clock — Firestore `serverTimestamp` when synced from cloud) against `last` (client-clock — written by `markPillarRead` calling `iso()` which uses local `Date.now()`). A client with a 5-minute clock skew will undercount or overcount unreads. The file header at lines 4-5 explicitly documents this as the H7 entanglement, and the test file at `tests/domain/unread.test.js:4-16` correctly pins the broken-by-design behaviour as the regression baseline for Phase 5 (DATA-07) cutover.
**Fix:** No fix in Phase 2 — pinning broken behaviour IS the goal. Phase 5 (DATA-07) moves last-read markers into Firestore `readStates` so both sides of the comparator are server-clock.

### IN-07: H8 last-writer-wins overwrites concurrent edits (pre-existing, Phase 5 fix target)

**File:** `src/data/cloud-sync.js:36-38, 51-55`
**Issue:** When the same org or user exists in both cloud and localStorage, the cloud version wins unconditionally. Two consultants editing the same org from different machines will silently lose one set of edits. File header at lines 5-6 documents this as the H8 / Pitfall 20 entanglement; `tests/data/cloud-sync.test.js:76-87` pins the cloud-wins behaviour as the regression baseline.
**Fix:** No fix in Phase 2 — pinning IS the goal. Phase 5+ subcollection migration replaces this whole-document overwrite with field-level merges + Firestore transactions.

### IN-08: `topConstraints` name is inverted vs. its sort direction (pre-existing, not Phase 2 scope)

**File:** `app.js:295-302` (not a Phase 2 extraction — flagging because it touches scoring/banding context)
**Issue:** `topConstraints` sorts ascending by score (`a.s - b.s`) and slices the first `n`, which returns the *lowest-scoring* pillars. The name "top" is ambiguous — these are the top *constraints* (i.e., worst pillars, biggest blockers), not the top scores. Reading the function in isolation is briefly confusing. Pre-existing — not introduced in Phase 2.
**Fix:** Phase 4 rename to `worstPillars` or add a JSDoc comment when the function gets extracted. No action in Phase 2.

### IN-09: `answeredCount` will throw on unknown pillarId (pre-existing, byte-identical, dead code)

**File:** `src/domain/scoring.js:79-89`
**Issue:** `answeredCount` calls `DATA.pillars.find((p) => p.id === pillarId)` and immediately reads `.diagnostics.length` on the result. If the pillarId is unknown, `find` returns `undefined` and the next line throws. The byte-identical comment at line 81-82 acknowledges this ("original throws on unknown pillarId"). The function is also flagged as dead code in `app.js:253` and the file header at lines 9-10 — there's no known caller. The test at `tests/domain/scoring.test.js:153-178` only covers the happy path (does not drive an unknown-pillarId test, which would correctly throw).
**Fix:** Phase 4 cleanup ledger already lists this as "remove dead code or wire up call site". If kept, add `if (!pillar) return { done: 0, total: 0 };` guard. No action in Phase 2.

---

## Notes on areas explicitly NOT flagged

These were considered and deliberately left off the list:

- **Pattern E wrapper TDZ risk** (`app.js:266-271, 282-285` reference `state`, `commentsFor`, `cloudFetchAllOrgs` etc. before they're declared). Closures resolve at call time, IIFE finishes initialisation before any wrapper is invoked. No TDZ. The comment at `app.js:261-262` correctly documents this.
- **`hashString` fallback path returns a 32-bit hash** (`src/util/hash.js:21-23`). This is the byte-identical defensive branch from `app.js:493-495`. Test at `tests/util/hash.test.js:37-53` covers it. Functionally fine for fallback.
- **`tests/setup.js` mocks `Math.random` to 0.5 globally** — this is intentional D-09 determinism, and the canary in `tests/data/migration.test.js:20-27` actively guards against drift in this mock.
- **Snapshot tests dynamic-import `app.js` and `vi.resetModules()`** — non-trivial pattern but it's the documented Vitest 4 path for re-running IIFEs against fresh closures. Tests pass and the comment at `dashboard.test.js:43-46` calls out the rationale.
- **`tsconfig.json` excludes `tests/crypto-parity.test.js`** (line 24) — this file imports from `node:crypto` which conflicts with the dom lib `crypto` global. Excluding it from typecheck while keeping it in the test run is the correct narrow-scope fix.
- **`index.html` loads Chart.js from a CDN** (line 15) — known and tracked for Phase 4 npm-import migration; the `eslint.config.js:67` `Chart: "readonly"` global declaration is the intentional bridge until then.
- **CI workflow does not gate on coverage results** — coverage is run (`ci.yml:62`) and HTML is uploaded as artefact (`ci.yml:64-69`), but the thresholds in `vite.config.js:53-57` are what would fail the test step if violated. No additional gating needed.

---

_Reviewed: 2026-05-06T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
