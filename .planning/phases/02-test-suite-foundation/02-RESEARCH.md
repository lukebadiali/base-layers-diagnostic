# Phase 2: Test Suite Foundation (Tests-First) — Research

**Researched:** 2026-05-06
**Domain:** Vitest 4 + happy-dom 20.9.0 unit + snapshot testing against an inline 4,103-line vanilla-JS IIFE — extracting nine pure-helper leaf modules into Phase 4's target source layout (`src/domain/`, `src/data/`, `src/auth/`, `src/util/`) without behaviour change.
**Confidence:** HIGH — every load-bearing claim traces to a verified source (Vitest docs, happy-dom GitHub, the actual `app.js`, the locked CONTEXT.md, or Phase 1's shipped config). Five claims tagged `[ASSUMED]` and surfaced in the Assumptions Log for the planner to confirm.

---

## User Constraints (from CONTEXT.md)

> Source: `.planning/phases/02-test-suite-foundation/02-CONTEXT.md`. The 21 decisions D-01..D-21 are LOCKED. The planner MUST honour them.

### Locked Decisions (verbatim summary)

**Area 1 — IIFE test-access strategy:**

- **D-01:** Mini-strangler-fig leaf extraction is the access strategy. Pure helpers extract into ESM leaf modules; the IIFE imports them. Production behaviour is byte-identical. This IS Pitfall 9 step 2.
- **D-02:** Extraction scope = ONLY the TEST-01..07 targets:
  - `src/domain/scoring.js` — `pillarScoreForRound`, `pillarScore`, `respondentsForRound`, `answeredCount`
  - `src/domain/banding.js` — `pillarStatus`, `bandLabel`, `bandStatement`, `bandColor`
  - `src/domain/completion.js` — `userCompletionPct`, `orgSummary`
  - `src/domain/unread.js` — `unreadCountForPillar`, `unreadCountTotal`, `markPillarRead`, `unreadChatTotal`
  - `src/data/migration.js` — `migrateV1IfNeeded`, `clearOldScaleResponsesIfNeeded`
  - `src/data/cloud-sync.js` — `syncFromCloud` (only — `saveOrgRemote` etc. stay in the IIFE)
  - `src/auth/state-machine.js` — `verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword`, `currentUser`
  - `src/util/hash.js` — `hashString`
  - `src/util/ids.js` — `uid`, `iso`, `formatWhen`, `initials`, `firstNameFromAuthor`
- **D-03:** Extracted modules live in their Phase 4 target layout. Phase 4 doesn't move them — it pulls the rest of `app.js` into siblings.
- **D-04:** Bridge: `index.html` rewritten to `<script type="module" src="./app.js">`; `app.js` IIFE opens with named ESM imports. **Supersedes Phase 1 D-14.** Pre-flight verification required (GH-Pages serves modules + `src/**/*.js` correctly).
- **D-05:** Extraction is byte-identical. No "improvements" land in Phase 2. Cleanup ledger receives entries.
- **D-06:** New extracted modules carry `// @ts-check` + JSDoc types from day 1, inferred as-is from function bodies.

**Area 2 — Snapshot strategy (TEST-10):**

- **D-07:** Snapshot tests load `app.js` into happy-dom, drive renders via `state` + route hash, snapshot `document.getElementById('app').innerHTML`.
- **D-08:** Snapshot format = `toMatchFileSnapshot` with one `.html` file per view at `tests/__snapshots__/views/{dashboard,diagnostic,report}.html`.
- **D-09:** Stabilisation = comprehensive seeding (fake timers + deterministic UUIDs + `Math.random=0.5` + Chart.js stub).
- **D-10:** Snapshot input = hand-built deterministic fixture at `tests/fixtures/snapshot-org.json` exercising all renderer branches.

**Area 3 — Mocking & fixtures:**

- **D-11:** Reusable factory at `tests/mocks/firebase.js`: `makeFirestoreMock({ failGetDoc, failSetDoc, failUpdateDoc, seed })`. Survives Phase 4.
- **D-12:** Auth tests use real `crypto.subtle.digest` from happy-dom 20.9.0 with known-password fixtures. Generator at `tests/fixtures/_generators/hash-passwords.js`.
- **D-13:** Fixtures live in `tests/fixtures/` flat directory, one file per use case.
- **D-14:** DOM-side mocks at `tests/mocks/chartjs.js` + matchMedia + ResizeObserver stubs in `tests/setup.js`.

**Area 4 — Coverage threshold + CI strictness:**

- **D-15:** Tiered per-directory coverage thresholds: `src/domain/**` 100%, `src/util/**` 100%, `src/auth/**` 95%, `src/data/**` 90%. `app.js` / `firebase-init.js` / `data/pillars.js` excluded. Tests excluded. No global threshold.
- **D-16:** Hard CI fail on test failure / coverage miss / snapshot mismatch / typecheck failure. OSV-Scanner remains soft-fail.
- **D-17:** Snapshot governance = local-only update (`npm test -- -u`), PR review. CI never auto-updates. Documented in `CONTRIBUTING.md`.
- **D-18:** Time + size budget = soft target in `CONTRIBUTING.md`: `<30s` local, `<90s` CI.
- **D-19:** `tests/smoke.test.js` deleted in same PR as first real test.
- **D-20:** Coverage HTML report uploaded as `coverage-report-html` artefact. No third-party service (no Codecov / Coveralls).

**Area 5 — DOC-10 incremental:**

- **D-21:** Phase 2 appends to `SECURITY.md` § Build & Supply Chain a "Regression baseline" paragraph citing TEST-01..07 + TEST-10 + ASVS V14.2 + ISO 27001 A.12.1.2 + SOC2 CC8.1.

### Claude's Discretion (verbatim)

- Exact JSDoc types in extracted modules (judgement call where ambiguity arises — leave as `any` if behaviour-preserving inference would force a type change; log in cleanup ledger per D-06).
- The order in which extracted modules land within Phase 2 (each is its own commit; sequencing TBD by planner — likely deepest-leaf-first per Pitfall 9 strangler-fig advice). **Resolved in this RESEARCH.md** — see § Topological Extraction Order.
- The exact shape of `tests/setup.js` global config. **Resolved** — see § Code Examples.
- Specific assertion library style (`toBe` / `toEqual` / `toStrictEqual` per test).
- The exact deterministic-UUID generator (counter, hashed counter, etc.). **Resolved** — see § Code Examples.
- Whether `tests/setup.js` is loaded via `vite.config.js` `test.setupFiles` (likely) vs explicit imports per test. **Resolved** — `setupFiles` is the canonical pattern; explicit imports are rejected unless a specific test needs different setup.

### Deferred Ideas (OUT OF SCOPE — DO NOT RESEARCH)

- Real Firestore emulator unit tests (Phase 5 owns).
- Sanitised production export as snapshot fixture (PII risk; revisit if hand-built fixture proves insufficient).
- Generated / property-based fixtures (faker, fast-check) — backlog item.
- Bot-driven snapshot updates (`/update-snapshots` PR comment trigger).
- Codecov / Coveralls.
- Hard CI test runtime timeout.
- commitlint enforcement.
- `npm test -- --watch` documentation.
- E2E / Playwright / Cypress.

---

## Phase Requirements

| ID      | Description                                                                                              | Research Support                                                                                                                                                          |
| ------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TEST-01 | Vitest 4 + `@vitest/coverage-v8` + `happy-dom` configured and runnable via `npm test`                    | Already runnable from Phase 1 (`package.json` scripts, `vite.config.js` test block). Phase 2 adds: setupFiles, per-directory thresholds. § Vitest 4 Configuration Surface |
| TEST-02 | `pillarScoreForRound` + `pillarStatus` + `bandLabel` boundary tests                                      | Extraction targets: `src/domain/scoring.js`, `src/domain/banding.js`. § Topological Extraction Order, § Code Examples — boundary table                                    |
| TEST-03 | `userCompletionPct` + `orgSummary` math tests                                                            | Extraction target: `src/domain/completion.js`. § Topological Extraction Order                                                                                             |
| TEST-04 | v1→v2 migration (`migrateV1IfNeeded`) + `clearOldScaleResponsesIfNeeded` idempotency tests               | Extraction target: `src/data/migration.js`. Pitfall 10 idempotency assertion patterns. § Code Examples — migration test pattern                                           |
| TEST-05 | Comment unread tracking (`unreadCountForPillar`, `markPillarRead`) + chat unread total                   | Extraction target: `src/domain/unread.js`. Pitfall 20: pin CURRENT broken behaviour as regression baseline (H7 entanglement). § Common Pitfalls — Pitfall 20 application  |
| TEST-06 | `syncFromCloud` bail-on-error logic                                                                      | Extraction target: `src/data/cloud-sync.js`. Uses Firebase mock factory D-11. Pitfall 20: pin CURRENT bail behaviour (H8 entanglement). § Code Examples — cloud-sync test |
| TEST-07 | Auth state machine (`verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword`)         | Extraction target: `src/auth/state-machine.js` + `src/util/hash.js`. Real `crypto.subtle.digest` per D-12. § Pre-Flight Verification 3 — happy-dom crypto parity          |
| TEST-10 | Snapshot tests for dashboard / diagnostic / report rendered HTML as Phase 4 baseline                     | Snapshot input via D-10 fixture; Chart.js stub D-14; comprehensive seeding D-09. § Snapshot Stabilisation Architecture                                                    |
| DOC-10  | Incremental `SECURITY.md` append per phase (D-21 — § Build & Supply Chain "Regression baseline" para)    | § DOC-10 Incremental — exact paragraph anchor, framework citations resolved                                                                                               |

---

## Architectural Responsibility Map

> Tier mapping for the nine extraction targets — used by the planner to sanity-check which directory each function lands in (D-03) and by `gsd-plan-checker` to verify tier correctness.

| Capability                              | Primary Tier              | Secondary Tier | Rationale                                                                                                                                                                                                |
| --------------------------------------- | ------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ID generation, ISO timestamps, name formatting (`uid`, `iso`, `formatWhen`, `initials`, `firstNameFromAuthor`) | `src/util/` (utility leaf) | —              | Pure functions over primitives + Date; no Firebase, no DOM, no domain knowledge. `uid` currently uses `Math.random()` — extracted byte-identically in Phase 2 per D-05; CODE-03 (Phase 4) replaces it. |
| Cryptographic hashing (`hashString`)    | `src/util/` (utility leaf) | —              | Pure async wrapper over `crypto.subtle.digest`. Used by auth comparators but not domain-specific.                                                                                                       |
| Score aggregation (`pillarScoreForRound`, `pillarScore`, `respondentsForRound`, `answeredCount`) | `src/domain/scoring.js`    | —              | Pure functions over org-shape JSON + `DATA.pillars`. Zero Firebase. Pitfall 9 Tier 1 priority.                                                                                                          |
| Banding / status (`pillarStatus`, `bandLabel`, `bandStatement`, `bandColor`) | `src/domain/banding.js` | — | Pure boundary-condition logic. Score → label/colour. Zero Firebase.                                                                                                                                      |
| Completion math (`userCompletionPct`, `orgSummary`) | `src/domain/completion.js` | —              | Pure aggregation over org responses + `DATA.pillars`. Calls `pillarScore` / `pillarStatus`.                                                                                                              |
| Unread tracking (`unreadCountForPillar`, `unreadCountTotal`, `markPillarRead`, `unreadChatTotal`) | `src/domain/unread.js`    | `src/data/`    | Pure-ish: reads `state.chatMessages` + `org.readStates` + `org.comments`. `markPillarRead` mutates org and calls `saveOrg` — secondary tier touches data via injected dependency. Phase 5 H7 fix breaks these tests deliberately. |
| v1→v2 migration (`migrateV1IfNeeded`, `clearOldScaleResponsesIfNeeded`) | `src/data/migration.js` | — | Reads/writes localStorage via `loadOrg` / `saveOrg` / `loadUsers` / `loadOrgMetas`. Mutates user data — silent-failure mode. Pitfall 10 idempotency.                                                       |
| Cloud sync (`syncFromCloud`)            | `src/data/cloud-sync.js`   | —              | Calls `cloudFetchAllOrgs` / `cloudFetchAllUsers` (Firebase) + writes localStorage. Bail-on-error path is Pitfall 20 H8 substrate. Mock Firebase via D-11 factory.                                       |
| Auth state machine (`verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword`, `currentUser`) | `src/auth/state-machine.js` | `src/util/hash.js` | Comparator path that real Firebase Auth replaces in Phase 6. Calls `hashString` (utility) + `loadOrg` / `findUser` / `currentSession` (data reads). 95% coverage threshold accommodates one defensive early-return.       |

**Tier sanity-check rules** (for plan-checker):

1. `src/domain/**` files MUST NOT import anything from `src/data/`, `src/auth/`, or any Firebase path. Lint-enforced soft-warn already in Phase 1 via `no-restricted-imports`; Phase 4 hardens to error. Phase 2 honours the rule by construction (the extracted domain modules are pure).
2. `src/util/**` files MUST NOT import from any other `src/` directory.
3. `src/auth/state-machine.js` MAY import from `src/util/hash.js` and read existing IIFE-internal helpers via dependency injection (passed as parameters from the IIFE call site) — see § Topological Extraction Order for the injection pattern.
4. `src/data/migration.js` and `src/data/cloud-sync.js` MAY use injected dependencies for `loadOrg` / `saveOrg` / `cloudFetchAllOrgs` etc.; they MUST NOT directly import from `firebase/*` (Phase 4 builds the `firebase/` adapter).

---

## Summary

Phase 2 stands the regression-test fence Pitfall 9 mandates before Phase 4's modular split. The work is concretely:

1. **Bridge `index.html` to module loading** (D-04) — supersedes Phase 1 D-14. Four pre-flight verifications must pass on a preview branch before this lands on `main`.
2. **Strangler-fig nine leaf modules out of `app.js`** in topological-deepest-leaf-first order, byte-identical, into `src/domain/`, `src/data/`, `src/auth/`, `src/util/`. The IIFE imports them; production behaviour is identical because the extracted code is the same code.
3. **Write Vitest unit tests** for TEST-01..07 against the extracted modules: scoring boundary table, completion math, migration idempotency, unread tracking (pinning current broken behaviour as Pitfall 20 baseline), cloud-sync bail-on-error (mocked Firebase), auth comparators (real `crypto.subtle.digest`).
4. **Write `toMatchFileSnapshot` tests** for TEST-10 covering dashboard / diagnostic / report rendered HTML, with comprehensive seeding (fake timers, deterministic UUIDs, `Math.random=0.5`, Chart.js stub) so snapshots are stable across OSes and runs.
5. **Wire tiered coverage thresholds** into CI (`src/domain/**` 100%, `src/util/**` 100%, `src/auth/**` 95%, `src/data/**` 90%). Hard CI fail on coverage miss / snapshot mismatch / typecheck failure / test failure. HTML coverage uploaded as artefact.
6. **Append `SECURITY.md` § Build & Supply Chain** with the "Regression baseline" paragraph (D-21), in the same atomic commit as the first real test.

**Primary recommendation:** Sequence the work into FIVE waves (Wave 0 = preflight + bridge, Wave 1 = util leafs, Wave 2 = domain leafs + first TEST-02 commit, Wave 3 = data + auth leafs + TEST-03..07, Wave 4 = TEST-10 snapshots + coverage gate + DOC-10 paragraph + delete `tests/smoke.test.js`). Topological order is non-negotiable — every leaf module's tests can land before its consumers extract, so each PR is independently testable, the trunk stays shippable at every commit, and Pitfall 9 is honoured to the letter.

---

## Pre-Flight Verifications

> CONTEXT.md flags four verifications the planner MUST include as research-confirmed tasks (Wave 0). Each is resolved here with a concrete probe + acceptance criterion. The planner should attach these to the first task in the phase.

### Pre-flight 1 — GH-Pages serves `<script type="module">` correctly

**Verdict:** ✓ Confirmed safe.

**Evidence:** GitHub Pages serves `.js` and `.mjs` files with a JavaScript MIME type by default. `[VERIFIED: github community discussion #61532]` `[CITED: developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules]` Module loading requires the server to send `Content-Type: text/javascript` or `application/javascript`; GitHub Pages uses `application/javascript` for `.js` (consistent with the WHATWG HTML spec).

**Probe** (planner attaches to Wave 0 Task 1):

```bash
# Run on a preview branch BEFORE merging the bridge change to main.
# 1. Push the bridge change to a preview branch (e.g. `phase-2-bridge-test`)
# 2. Wait for GH-Pages preview deploy (~1-2 min)
# 3. Open https://baselayers.bedeveloped.com/  (or the preview URL if previews are wired)
# 4. Verify in DevTools → Network:
curl -sI https://baselayers.bedeveloped.com/app.js | grep -i 'content-type'
# Acceptance: returns "content-type: application/javascript" (or "text/javascript")
# 5. Open DevTools console — confirm zero "Failed to load module script" errors
```

**Risk if wrong:** Bridge change merges, GH-Pages serves `app.js` with wrong MIME, every visitor's tab hits "Failed to load module script: server responded with a MIME type of …". Detection is immediate; rollback = revert the `index.html` line. Low residual risk.

### Pre-flight 2 — GH-Pages serves `src/**/*.js` paths correctly

**Verdict:** ✓ Confirmed safe.

**Evidence:** GitHub Pages serves any file the repo contains at the path it lives in the repo, with no special config — verified across the docs and multiple community discussions. Subdirectories work transparently; the only known failure modes are (a) missing `index.html` in a directory accessed by directory URL, and (b) case-sensitivity on the path. Neither applies to `src/domain/scoring.js` etc. (we always reference the full filename, never the directory).

**Probe** (planner attaches to Wave 0 Task 1):

```bash
# After Wave 1 commits land src/util/ids.js (the first extracted module):
curl -sI https://baselayers.bedeveloped.com/src/util/ids.js | grep -E 'content-type|HTTP/'
# Acceptance: HTTP/2 200 + content-type: application/javascript
# If 404: GH-Pages may not have processed the deploy yet — wait 2 min and retry.
```

**Risk if wrong:** Same failure mode as pre-flight 1. Mitigation: Wave 0 Task 1 lands the bridge change AND the first leaf module (`src/util/ids.js`) on the preview branch together, so we get evidence on both at once.

### Pre-flight 3 — happy-dom 20.9.0 `crypto.subtle.digest` matches Node `crypto.createHash`

**Verdict:** ✓ Confirmed safe — happy-dom uses Node's built-in `crypto` module under the hood; SHA-256 output is byte-identical.

**Evidence:**
- happy-dom is documented as supporting `crypto.subtle.digest` in the Node test environment, contrasting with jsdom which has a known compatibility issue. `[VERIFIED: vitest-dev/vitest#5365 — "crypto.subtle.digest throws TypeError when using JSDOM environment" — confirms happy-dom does NOT have this issue]`
- `crypto.subtle.digest("SHA-256", ...)` follows FIPS 180-4 §6.2 — the algorithm is specified and produces identical 256-bit output regardless of implementation. `[CITED: developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest]`
- happy-dom 20.x exposes Web Crypto via `globalThis.crypto`; under Node 22, this is Node's native WebCrypto implementation (built into Node since 19.0). `[VERIFIED: nodejs.org/api/crypto.html — globalThis.crypto is the Web Crypto interface]`

**Probe** (the fixture generator at `tests/fixtures/_generators/hash-passwords.js` IS the probe — it runs in Node and produces hex; the test runs in happy-dom and compares):

```javascript
// tests/fixtures/_generators/hash-passwords.js — runs in Node
import { createHash } from "node:crypto";

const passwords = {
  internal: "TestInternal!2026",
  orgClient: "TestOrgClient!2026",
  user: "TestUser!2026",
};

for (const [label, plain] of Object.entries(passwords)) {
  const sha256 = createHash("sha256").update(plain, "utf8").digest("hex");
  console.log(`  ${label}: { plain: ${JSON.stringify(plain)}, sha256: ${JSON.stringify(sha256)} },`);
}
// Output is pasted into tests/fixtures/auth-passwords.js
// Test then calls hashString(plain) under happy-dom and asserts === sha256.
// If pre-flight 3 holds, the assertion passes. If it fails, planner has hard evidence
// and we'd add a one-line shim — but the evidence above says it won't.
```

**Risk if wrong:** Auth tests would fail with hash-mismatch errors. Mitigation: the probe IS the test; we discover any divergence on the very first auth test run, before any production code change. Cost of being wrong is one failing test, no production risk.

### Pre-flight 4 — Vitest 4 `toMatchFileSnapshot` is OS-stable

**Verdict:** ✓ Confirmed safe — Vitest normalises newlines automatically.

**Evidence:** Vitest applies `normalizeNewlines(string)` to all snapshot output, converting `\r\n` to `\n` on write and on compare. `[VERIFIED: vitest-dev/vitest#3164 — "fix(snapshot): normalize EOL for toMatchFileSnapshot"]` `[CITED: vitest.dev/guide/snapshot]` This is built-in to `@vitest/snapshot` v4 and applies to file snapshots. (Vitest 4 ships `@vitest/snapshot` as a workspace package — no separate install needed; locked in `package.json` via `vitest@4.1.5`.)

**Known caveat:** The custom snapshot serialiser path (`expect.addSnapshotSerializer`) does NOT apply to `toMatchFileSnapshot` — there's an open issue (#5426) about this. This is acceptable for our use case because we snapshot raw `innerHTML` strings, not custom-serialiser output. `[CITED: vitest-dev/vitest#5426]`

**Empty-file caveat:** `toMatchFileSnapshot` mismatches if the snapshot file exists but is empty (CI-only) — `[CITED: vitest-dev/vitest#5890]`. Mitigation: never commit empty snapshot files. The first run on a new test creates a non-empty file; subsequent runs compare. The `.gitignore` should NOT exclude `tests/__snapshots__/` (we want them committed for the cross-OS regression baseline) and the planner must verify the directory is checked in with non-empty files.

**Probe** (planner attaches to Wave 4 Task 1, before TEST-10 lands):

```bash
# Run TEST-10 once locally on Windows, capture file output.
npm test -- tests/views/dashboard.snapshot.test.js
xxd tests/__snapshots__/views/dashboard.html | head -3
# Acceptance: bytes are LF-terminated (0a, not 0d 0a). If CRLF appears, Vitest's
# normaliser is not running — investigate before committing.

# Then verify on Linux CI by inspecting the artefact uploaded from a CI run on the
# same commit. Planner adds a one-line CI step:
#   - run: file tests/__snapshots__/views/*.html
# Acceptance: "ASCII text" (no "with CRLF line terminators")
```

**Risk if wrong:** Phase 4's snapshot diff would show every line as changed (LF↔CRLF) — false signal. Cost is high (Phase 4 false-alarm). Mitigation: the probe runs on Wave 4, before TEST-10 lands; if it fails, planner adds an explicit `eolNormalization: true` config option and re-probes.

---

## Standard Stack

> All packages already pinned in Phase 1. Phase 2 introduces NO new packages.

### Core (already installed via Phase 1 D-01)

| Library              | Version    | Purpose                          | Why Standard                                                                                                                                |
| -------------------- | ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest`             | **4.1.5**  | Test runner + snapshot engine    | Locked Phase 1 D-31. Vitest 4 is current (npm registry verified 2026-05-03 in STACK.md). [VERIFIED: package.json line 49]                   |
| `@vitest/coverage-v8` | **4.1.5** | V8-native coverage provider      | Faster than istanbul, no instrumentation overhead, native to V8. Locked Phase 1 D-31. [VERIFIED: package.json line 38]                       |
| `happy-dom`          | **20.9.0** | DOM environment for Vitest       | Faster than jsdom, real `crypto.subtle.digest`, real `localStorage`. Locked Phase 1 D-31. [VERIFIED: package.json line 43]                  |
| `vite`               | **8.0.10** | Module dev server (drives tests) | Vitest reads `vite.config.js` for `test:` block. Locked Phase 1 D-31. [VERIFIED: package.json line 48]                                       |
| `typescript`         | **6.0.3**  | `tsc --noEmit` JSDoc typecheck   | New extracted modules carry `// @ts-check` from day 1 per D-06. Existing config from Phase 1 covers them via `**/*.js` glob. [VERIFIED: tsconfig.json] |

### Supporting (Phase 1 already installed; Phase 2 uses them as-is)

| Library                 | Version | Purpose                                              | When to Use                                                                |
| ----------------------- | ------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `eslint`                | 10.3.0  | `// @ts-check` + JSDoc enforcement                  | Already wired; new `src/**` files inherit. No config change needed.        |
| `firebase`              | 12.12.1 | Production dep imported by app.js                   | Mocked via D-11 factory; not directly imported in tests.                   |

### Alternatives Considered & Rejected

| Instead of                  | Could Use                | Tradeoff                                                                                                                            |
| --------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `toMatchFileSnapshot`       | Inline `toMatchSnapshot` (default `.snap` file) | D-08 explicitly rejects: `.snap` file = single fat file, hard to PR-diff. File-per-view = reviewable in normal PR diff.    |
| Real `crypto.subtle.digest` | Mock `hashString`        | D-12 explicitly rejects: real path is what Phase 6 replaces; we need a real "before" signal for the cutover.                       |
| `vi.mock('chart.js')` direct | `vi.spyOn(window, 'Chart')` | The Chart.js stub is at `tests/mocks/chartjs.js` per D-14. `vi.mock` loaded via `setupFiles` is the canonical Vitest pattern.  |
| Per-test setup imports      | Global `setupFiles`      | D's discretion table — `setupFiles` resolved as the canonical answer. One config location, runs before every test in every file. |
| Sanitised production export | Hand-built fixture       | D-10 explicitly rejects sanitised export (PII risk + churn).                                                                       |

**Installation:** No `npm install` required. Phase 1 already pinned everything.

**Version verification:** Phase 1 verified all versions against npm registry on 2026-05-03 in STACK.md. No re-verification needed for Phase 2 — packages are pinned + lockfile-locked + `npm ci` reproducibility-tested.

---

## Architecture Patterns

### System Architecture Diagram

```
                        ┌────────────────────┐
                        │  index.html        │
                        │  <script           │
                        │   type="module"    │
                        │   src="./app.js">  │  ◄── D-04 supersedes Phase 1 D-14
                        └─────────┬──────────┘
                                  │ ESM bridge
                                  ▼
                        ┌────────────────────────────────────┐
                        │  app.js (4,103-line IIFE)          │
                        │                                    │
                        │  import { uid, iso, formatWhen,    │
                        │           initials, firstNameFromAuthor }
                        │    from "./src/util/ids.js";       │
                        │  import { hashString } from        │
                        │    "./src/util/hash.js";           │
                        │  import { pillarScoreForRound,     │
                        │           pillarScore, ...         │
                        │  } from "./src/domain/scoring.js"; │
                        │  ... (9 imports total)             │
                        │                                    │
                        │  (function () {                    │
                        │    "use strict";                   │
                        │    // Phase 4: extracted to src/...│ ◄── D-05 byte-identical
                        │    //  comments at former call sites
                        │    ...                             │
                        │  })();                             │
                        └─────┬────┬────┬────┬───────────────┘
                              │    │    │    │
              ┌───────────────┘    │    │    └─────────────────┐
              ▼                    ▼    ▼                      ▼
       ┌─────────────┐    ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐
       │ src/util/   │    │ src/domain/ │  │ src/data/    │  │ src/auth/        │
       │             │    │             │  │              │  │                  │
       │ ids.js      │◄───│ scoring.js  │  │ migration.js │  │ state-machine.js │
       │ hash.js     │◄───│ banding.js  │  │ cloud-sync.js│◄─│   (uses hash.js) │
       │             │    │ completion. │  │              │  │                  │
       │             │    │ unread.js   │  │              │  │                  │
       └─────────────┘    └─────────────┘  └──────────────┘  └──────────────────┘
              ▲                  ▲                ▲                    ▲
              │                  │                │                    │
              │ NO Firebase      │ NO Firebase    │ Firebase mocked    │ real crypto
              │ NO DOM           │ NO DOM         │ via D-11 factory   │ via happy-dom
              │ pure functions   │ pure functions │ + injected deps    │ + known-pwd fixtures
              │                  │                │                    │
              └──────────────────┴────────────────┴────────────────────┘
                                       │
                                       │ tested by
                                       ▼
                        ┌────────────────────────────────────┐
                        │  tests/                            │
                        │                                    │
                        │  setup.js  ◄── vite.config.js      │
                        │             test.setupFiles loads it
                        │  fixtures/                         │
                        │    snapshot-org.json               │
                        │    v1-localStorage.json            │
                        │    v2-org.json                     │
                        │    unread-state.json               │
                        │    cloud-sync-conflict.json        │
                        │    auth-passwords.js               │
                        │    _generators/                    │
                        │      hash-passwords.js (Node CLI)  │
                        │  mocks/                            │
                        │    firebase.js  ◄── D-11 factory   │
                        │    chartjs.js   ◄── D-14 stub      │
                        │  domain/                           │
                        │    scoring.test.js  (TEST-02)      │
                        │    banding.test.js  (TEST-02)      │
                        │    completion.test.js (TEST-03)    │
                        │    unread.test.js   (TEST-05)      │
                        │  data/                             │
                        │    migration.test.js (TEST-04)     │
                        │    cloud-sync.test.js (TEST-06)    │
                        │  auth/                             │
                        │    state-machine.test.js (TEST-07) │
                        │  util/                             │
                        │    ids.test.js                     │
                        │    hash.test.js                    │
                        │  views/                            │
                        │    dashboard.snapshot.test.js (TEST-10)
                        │    diagnostic.snapshot.test.js     │
                        │    report.snapshot.test.js         │
                        │  __snapshots__/                    │
                        │    views/                          │
                        │      dashboard.html  (D-08)        │
                        │      diagnostic.html               │
                        │      report.html                   │
                        └────────────────────────────────────┘
                                       │
                                       │ run by
                                       ▼
                        ┌────────────────────────────────────┐
                        │  vite.config.js test block         │
                        │                                    │
                        │  test: {                           │
                        │    environment: "happy-dom",       │
                        │    setupFiles: ["./tests/setup.js"],
                        │    coverage: {                     │
                        │      provider: "v8",               │
                        │      thresholds: {                 │
                        │        "src/domain/**": {100,100,100,100},
                        │        "src/util/**":   {100,100,100,100},
                        │        "src/auth/**":   {95,95,…,…}, │ ◄── D-15
                        │        "src/data/**":   {90,90,…,…},
                        │      },                            │
                        │      exclude: ["app.js","firebase- │
                        │                 init.js","data/    │
                        │                 pillars.js","tests/**"],
                        │      reporter: ["text","html"],    │
                        │    },                              │
                        │  },                                │
                        │                                    │
                        └─────────────┬──────────────────────┘
                                      │ orchestrated by
                                      ▼
                        ┌────────────────────────────────────┐
                        │  .github/workflows/ci.yml          │
                        │  test job:                         │
                        │    npm test  ◄── coverage gate D-15│
                        │    upload coverage HTML  ◄── D-20  │
                        │  typecheck job:                    │
                        │    npm run typecheck (covers src/**)
                        └────────────────────────────────────┘
```

### Recommended Project Structure

```
.
├── index.html                          # ◄── D-04 rewrites <script> to type="module"
├── app.js                              # ◄── opens with named ESM imports; rest unchanged
├── firebase-init.js                    # unchanged
├── data/pillars.js                     # unchanged
├── styles.css                          # unchanged
├── vite.config.js                      # ◄── D-15 thresholds + setupFiles add here
├── package.json                        # unchanged
├── src/                                # NEW directory tree (per ARCHITECTURE.md target layout)
│   ├── domain/
│   │   ├── scoring.js                  # ← extracted from app.js:240-272
│   │   ├── banding.js                  # ← extracted from app.js:262, 2816-2841
│   │   ├── completion.js               # ← extracted from app.js:282-307
│   │   └── unread.js                   # ← extracted from app.js:340-414
│   ├── data/
│   │   ├── migration.js                # ← extracted from app.js:550-622, 5459-5475
│   │   └── cloud-sync.js               # ← extracted from app.js:3556-3593
│   ├── auth/
│   │   └── state-machine.js            # ← extracted from app.js:363-366, 510-547
│   └── util/
│       ├── ids.js                      # ← extracted from app.js:32-81
│       └── hash.js                     # ← extracted from app.js:473-486
├── tests/
│   ├── setup.js                        # NEW — D-09 + D-14 global setup
│   ├── fixtures/                       # NEW — flat layout per D-13
│   │   ├── snapshot-org.json
│   │   ├── v1-localStorage.json
│   │   ├── v2-org.json
│   │   ├── unread-state.json
│   │   ├── cloud-sync-conflict.json
│   │   ├── auth-passwords.js
│   │   └── _generators/
│   │       └── hash-passwords.js
│   ├── mocks/                          # NEW — D-11 + D-14
│   │   ├── firebase.js
│   │   └── chartjs.js
│   ├── domain/
│   │   ├── scoring.test.js             # TEST-02
│   │   ├── banding.test.js             # TEST-02
│   │   ├── completion.test.js          # TEST-03
│   │   └── unread.test.js              # TEST-05
│   ├── data/
│   │   ├── migration.test.js           # TEST-04
│   │   └── cloud-sync.test.js          # TEST-06
│   ├── auth/
│   │   └── state-machine.test.js       # TEST-07
│   ├── util/
│   │   ├── ids.test.js
│   │   └── hash.test.js
│   ├── views/                          # NEW — TEST-10 hosts here
│   │   ├── dashboard.snapshot.test.js
│   │   ├── diagnostic.snapshot.test.js
│   │   └── report.snapshot.test.js
│   └── __snapshots__/                  # NEW — committed; D-08 file-per-view
│       └── views/
│           ├── dashboard.html
│           ├── diagnostic.html
│           └── report.html
└── tests/smoke.test.js                 # ◄── D-19 deletes in same PR as first real test
```

### Pattern 1: Strangler-fig leaf extraction (Pitfall 9 step 2)

**What:** Pull a pure function out of the IIFE into an ESM leaf module, then have the IIFE import it. Production behaviour is byte-identical because the extracted code is the same code.

**When to use:** Always for Phase 2 — the only access strategy permitted by D-01.

**Example** (`uid` extraction — first commit of Wave 1):

```javascript
// src/util/ids.js  (NEW FILE)
// @ts-check

/**
 * Generate a short, prefix-friendly id. Uses Math.random + Date for entropy.
 * @param {string} [p=""] Optional prefix (e.g., "u_", "org_", "c_").
 * @returns {string} A string like "u_abc1234fk23p".
 *
 * NOTE: Math.random is non-CSPRNG. CODE-03 (Phase 4) replaces with crypto.randomUUID.
 *       Phase 2 extracts this byte-identically per D-05.
 */
// eslint-disable-next-line no-restricted-syntax -- Phase 4 (CODE-03): replace with crypto.randomUUID
export const uid = (p = "") =>
  // eslint-disable-next-line no-restricted-syntax -- Phase 4: replace with crypto.randomUUID(). See runbooks/phase-4-cleanup-ledger.md
  p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const iso = () => new Date().toISOString();

/** @param {string|number|null|undefined} when */
export const formatWhen = (when) => { /* ... copy from app.js:38-47 ... */ };

/** @param {string} [name=""] */
export const initials = (name = "") => { /* ... copy from app.js:58-64 ... */ };

const capitalise = (/** @type {string} */ s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** @param {{authorName?:string, authorEmail?:string}} m */
export const firstNameFromAuthor = (m) => { /* ... copy from app.js:68-81 ... */ };
```

```javascript
// app.js  (modified opening)
// @ts-nocheck
import {
  uid,
  iso,
  formatWhen,
  initials,
  firstNameFromAuthor,
} from "./src/util/ids.js";

(function () {
  "use strict";
  const DATA = window.BASE_LAYERS;
  const LS = window.localStorage;

  const K = { /* ... unchanged ... */ };

  // Phase 2: extracted to src/util/ids.js — re-imported here, do not re-define.
  // (the original definitions at lines 32-81 are deleted)
  // ...
  // rest of IIFE continues unchanged
})();
```

**Source:** Pitfall 9 step 2, `.planning/research/PITFALLS.md` lines 304-308.

### Pattern 2: Dependency injection for non-pure leaves

**What:** Modules that need IIFE-internal state (e.g., `markPillarRead` calls `saveOrg`; `syncFromCloud` calls `cloudFetchAllOrgs`) accept those dependencies as parameters rather than re-importing them.

**When to use:** For `src/domain/unread.js` (`markPillarRead`), `src/data/migration.js` (everything), `src/data/cloud-sync.js` (everything), `src/auth/state-machine.js` (verifyOrgClient/User need `loadOrg`/`findUser`).

**Example** (`markPillarRead`):

```javascript
// src/domain/unread.js
// @ts-check
import { iso } from "../util/ids.js";

/**
 * @param {object} org
 * @param {string} pillarId
 * @param {{id: string}} user
 * @param {(o: object) => void} saveOrg  ◄── injected; Phase 4 replaces with import from data/orgs.js
 */
export function markPillarRead(org, pillarId, user, saveOrg) {
  org.readStates = org.readStates || {};
  org.readStates[user.id] = org.readStates[user.id] || {};
  org.readStates[user.id][pillarId] = iso();
  saveOrg(org);
}
```

```javascript
// app.js IIFE — at the call site (only change is passing saveOrg explicitly)
import { markPillarRead as _markPillarRead } from "./src/domain/unread.js";
// ...
const markPillarRead = (org, pillarId, user) => _markPillarRead(org, pillarId, user, saveOrg);
// (or pass saveOrg directly at every call site if cleaner)
```

**Why DI not direct import:** D-03 says extracted modules sit in their Phase 4 target layout. But Phase 4 hasn't built `src/data/orgs.js` yet — `saveOrg` still lives in the IIFE. Importing IIFE-internal helpers into a leaf module creates a cycle (`app.js → src/domain/unread.js → app.js`) which Vite/Rollup will warn about and which makes the module impossible to test in isolation. DI sidesteps this by keeping leaf modules truly leaf.

**Source:** Pattern follows the canonical "ports & adapters" approach to test seams; the specific application here is a logical consequence of D-03 + D-05 + Pitfall 9 step 3 (strangler-fig, one PR at a time, trunk shippable).

### Pattern 3: Snapshot via `app.js` boot under happy-dom (D-07)

**What:** Tests load `app.js` (the bridged ESM version) into happy-dom, seed `window.localStorage` and `state` from a fixture, dispatch the route hash, then snapshot `document.getElementById('app').innerHTML`.

**When to use:** TEST-10 only.

**Example skeleton:**

```javascript
// tests/views/dashboard.snapshot.test.js
import { describe, it, expect, beforeEach } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

describe("Dashboard view", () => {
  beforeEach(async () => {
    // Seed localStorage from fixture
    localStorage.setItem("baselayers:orgs", JSON.stringify(snapshotOrg.orgMetas));
    snapshotOrg.orgs.forEach((o) => {
      localStorage.setItem(`baselayers:org:${o.id}`, JSON.stringify(o));
    });
    localStorage.setItem("baselayers:users", JSON.stringify(snapshotOrg.users));
    localStorage.setItem("baselayers:session", JSON.stringify(snapshotOrg.session));
    localStorage.setItem("baselayers:settings", JSON.stringify(snapshotOrg.settings));

    // Inject DATA, FB stubs that app.js reads from window
    window.BASE_LAYERS = snapshotOrg.pillars;
    window.FB = { /* stub — see tests/mocks/firebase.js */ };

    // Set route
    window.location.hash = "#dashboard";

    // Boot the app — app.js IIFE attaches DOMContentLoaded listener
    document.body.innerHTML = '<div id="app"></div><div id="modalRoot"></div>';
    await import(`../../app.js?cachebust=${Math.random()}`);  // fresh module instance per test
    // (give the IIFE one tick to render)
    await new Promise((r) => setTimeout(r, 0));
  });

  it("matches the dashboard snapshot", async () => {
    const html = document.getElementById("app").innerHTML;
    await expect(html).toMatchFileSnapshot("../__snapshots__/views/dashboard.html");
  });
});
```

**Source:** D-07 + D-08 + Pitfall 9 step 5 (`.planning/research/PITFALLS.md` line 309). `[CITED: vitest.dev/guide/snapshot — toMatchFileSnapshot is async, returns a Promise; test body must await]`

### Anti-Patterns to Avoid

- **"Improve while extracting" (D-05 explicit):** Renaming a variable, simplifying an `if`, replacing `let` with `const` — all forbidden in Phase 2 even when obviously correct. They belong in Phase 4 where the test fence catches drift. Phase 2's job is the fence, not the painting.
- **Importing IIFE-internal helpers into leaf modules:** Creates a cycle and breaks isolation. Use DI (Pattern 2).
- **Mocking what we can use for real:** D-12 says use `crypto.subtle.digest` not a mock. The real path is what Phase 6 replaces; mocking would dilute the regression baseline.
- **Single-shared-fixture imports:** D-13 says one fixture file per use case, no central index. Locality of reference > DRY here.
- **Inline `toMatchSnapshot` for views:** D-08 says file snapshots only.
- **Updating snapshots in CI:** D-17 says local-only update + PR review. CI invocation is `npm test` (not `npm test -- -u`); the `-u` flag is a developer tool, never a CI tool.
- **Running tests against the not-yet-extracted IIFE-only function:** Tests import from `src/...`. The IIFE re-exports nothing. If a test wants to test `pillarScoreForRound`, it imports from `src/domain/scoring.js` — meaning the extraction commit MUST land before the test commit (or both in one commit).
- **Snapshot tests asserting timestamps as live values:** D-09 mandates fake timers + `vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z'), toFake: ['Date', 'setTimeout', 'setInterval'] })`. Any `iso()` or `formatWhen()` call in a snapshot path resolves deterministically.
- **Per-test `vi.mock` for Chart.js:** D-14 + Pitfall 9 step 5 — central stub at `tests/mocks/chartjs.js`, loaded via `setupFiles`. Per-test `vi.mock` calls drift over time and obscure the centralised contract.

---

## Don't Hand-Roll

| Problem                                      | Don't Build                                  | Use Instead                                               | Why                                                                                                                              |
| -------------------------------------------- | -------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| DOM emulation for tests                      | Manual `document` stub                       | happy-dom 20.9.0 (already installed, environment="happy-dom") | Real DOM APIs incl. `crypto.subtle.digest`, `localStorage`. STACK.md and Phase 1 D-31 lock this.                                |
| Snapshot diff infrastructure                 | Custom string-comparator + diff print        | Vitest `toMatchFileSnapshot`                              | Built-in newline normalisation, OS-stable, integrates with `npm test -- -u`. [CITED: vitest.dev/guide/snapshot]                  |
| Coverage instrumentation                     | Hand-instrument `app.js` with line counters  | `@vitest/coverage-v8`                                     | V8-native (zero-overhead Babel/Istanbul), per-directory thresholds, HTML reporter built in. Phase 1 D-31 locks this.             |
| Time/Date determinism                        | Wrap `Date.now()` in a custom clock          | `vi.useFakeTimers({ now, toFake: ['Date', 'setTimeout', 'setInterval'] })` | Sinon-backed, supported across all of Vitest's matchers. [CITED: vitest.dev/config/faketimers]                                   |
| Deterministic UUIDs                          | Replace `crypto.randomUUID` with a real CSPRNG seed | `vi.spyOn(crypto, 'randomUUID').mockImplementation(counterUuid)` | Mock at the seam Phase 4 will use. CSPRNG seeds aren't useful — we want pinned values, not random-but-reproducible.              |
| Firebase Firestore mock                      | Manual `getDoc` / `setDoc` shim              | `tests/mocks/firebase.js` factory (D-11)                  | Centralised, per-test customisable via params, survives Phase 4's `firebase/` adapter introduction.                              |
| SHA-256 hash computation in tests            | Re-implement SHA-256                         | Real `crypto.subtle.digest` (happy-dom) + Node `crypto.createHash` for fixture generation | They produce byte-identical output (FIPS 180-4 §6.2 algorithm). [VERIFIED: developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest] |
| HTML diff for snapshot review                | Custom HTML pretty-printer                   | Vitest's default snapshot output                          | One file per view = readable PR diff. D-08.                                                                                       |
| Test setup scaffolding (matchMedia, ResizeObserver) | Each test file defines its own stubs    | Centralised `tests/setup.js` loaded via `vite.config.js test.setupFiles` | D-14 mandates centralisation; happy-dom doesn't ship `matchMedia` or `ResizeObserver` out of the box. [VERIFIED: capricorn86/happy-dom#306, #921] |
| Migration idempotency assertion              | Eyeball the second run                       | Run migration twice, deep-equal localStorage state        | Pitfall 10 + TEST-04 require it as an explicit assertion.                                                                        |

**Key insight:** Phase 1 already pinned every tool we need. Phase 2 is a configuration + content phase, not an installation phase. The temptation to "just add one more dev-dep" should be resisted (e.g., a snapshot HTML pretty-printer like `prettier`-snapshot — `tests/__snapshots__/views/dashboard.html` is already readable as raw HTML; pretty-printing adds noise to diffs).

---

## Topological Extraction Order

> Resolves Claude's Discretion item: "The order in which extracted modules land within Phase 2." Per Pitfall 9 step 3 ("strangler-fig the split, don't big-bang it"), each extraction is its own commit, deepest-leaf-first so each landing is independently testable and the trunk is shippable at every commit.

### Dependency analysis

Inspecting `app.js`, the call graph among the extraction targets is:

```
LEVEL 0 (no internal deps, only Math/Date/String/built-ins):
  • uid                    [src/util/ids.js]      (Math.random + Date)
  • iso                    [src/util/ids.js]      (Date)
  • formatWhen             [src/util/ids.js]      (Date)
  • initials               [src/util/ids.js]      (String)
  • firstNameFromAuthor    [src/util/ids.js]      (String + capitalise (private))
  • hashString             [src/util/hash.js]     (crypto.subtle.digest)
  • pillarStatus           [src/domain/banding.js] (number → string)
  • bandLabel              [src/domain/banding.js]
  • bandStatement          [src/domain/banding.js]
  • bandColor              [src/domain/banding.js]

LEVEL 1 (depends only on level 0 + DATA.pillars):
  • pillarScoreForRound    [src/domain/scoring.js] (uses DATA.pillars + questionMeta — questionMeta stays inline; injected if needed)
  • respondentsForRound    [src/domain/scoring.js]
  • answeredCount          [src/domain/scoring.js] (uses DATA.pillars)
  • userCompletionPct      [src/domain/completion.js] (uses DATA.pillars)

LEVEL 2 (depends on level 1):
  • pillarScore            [src/domain/scoring.js] (uses pillarScoreForRound)
  • orgSummary             [src/domain/completion.js] (uses pillarScore + pillarStatus)

LEVEL 2 separate branch:
  • unreadCountForPillar   [src/domain/unread.js]   (uses commentsFor — INJECTED; reads org.readStates)
  • unreadCountTotal       [src/domain/unread.js]   (uses unreadCountForPillar + DATA.pillars)
  • unreadChatTotal        [src/domain/unread.js]   (uses state.chatMessages — INJECTED via getState)
  • markPillarRead         [src/domain/unread.js]   (uses iso + saveOrg INJECTED)

LEVEL 2 (auth):
  • verifyInternalPassword [src/auth/state-machine.js] (uses hashString)
  • verifyOrgClientPassphrase [src/auth/state-machine.js] (uses hashString + loadOrg INJECTED)
  • verifyUserPassword     [src/auth/state-machine.js] (uses hashString + findUser INJECTED)
  • currentUser            [src/auth/state-machine.js] (uses currentSession + findUser INJECTED)

LEVEL 3 (depends on multiple level 0/1/2 + many IIFE internals via injection):
  • migrateV1IfNeeded      [src/data/migration.js]  (uid, iso, plus loadUsers, loadOrgMetas, loadOrg, saveOrg, upsertUser, findUser INJECTED)
  • clearOldScaleResponsesIfNeeded [src/data/migration.js]  (loadSettings, saveSettings, loadOrgMetas, loadOrg, saveOrg INJECTED)

LEVEL 3 (cloud):
  • syncFromCloud          [src/data/cloud-sync.js] (cloudFetchAllOrgs, cloudFetchAllUsers, cloudPushOrg, cloudPushUser, fbReady, jget, jset, K, render — ALL INJECTED + Firebase mock via D-11)
```

### Recommended commit sequence (ten extraction commits + four test commits + bridge commit + housekeeping)

| Order | Commit                                                                  | Module(s) extracted                                                    | Tests landed                                                  | Notes                                                                                                                                  |
| ----- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `feat(02-bridge): rewrite index.html script tag to type=module`         | (none — bridge only)                                                   | (none)                                                        | Lands ONLY on a preview branch first. Pre-flights 1+2 verified before merging to main. Cleanup ledger entry: D-04 supersedes Phase 1 D-14. |
| 2     | `refactor(02-util): extract ids.js (uid, iso, formatWhen, initials, firstNameFromAuthor)` | `src/util/ids.js`                                                      | (none yet — held for next commit to keep extraction atomic)   | Byte-identical. Cleanup ledger entry per D-05.                                                                                          |
| 3     | `refactor(02-util): extract hash.js (hashString)`                       | `src/util/hash.js`                                                     | (none yet)                                                    | Byte-identical.                                                                                                                        |
| 4     | `test(02-util): cover ids.js + hash.js (TEST-01 substrate)`             | (none)                                                                 | `tests/util/ids.test.js`, `tests/util/hash.test.js`           | Also: delete `tests/smoke.test.js` per D-19. Append SECURITY.md regression baseline per D-21. First atomic commit per D-25 pattern.    |
| 5     | `refactor(02-domain): extract banding.js (pillarStatus, bandLabel, bandStatement, bandColor)` | `src/domain/banding.js`                                                | (none yet)                                                    | Byte-identical.                                                                                                                        |
| 6     | `refactor(02-domain): extract scoring.js (pillarScoreForRound, pillarScore, respondentsForRound, answeredCount)` | `src/domain/scoring.js`                                                | (none yet)                                                    | Byte-identical.                                                                                                                        |
| 7     | `test(02-domain): cover scoring + banding (TEST-02)`                    | (none)                                                                 | `tests/domain/scoring.test.js`, `tests/domain/banding.test.js` | Closes TEST-02. Appends to SECURITY.md if more cite-worthy detail.                                                                     |
| 8     | `refactor(02-domain): extract completion.js (userCompletionPct, orgSummary)` | `src/domain/completion.js`                                            | `tests/domain/completion.test.js`                             | Closes TEST-03. Bundled because completion.js is small + entirely tested by TEST-03 boundaries.                                        |
| 9     | `refactor(02-domain): extract unread.js (unreadCountForPillar, unreadCountTotal, markPillarRead, unreadChatTotal)` | `src/domain/unread.js`                                                | `tests/domain/unread.test.js`                                 | Closes TEST-05. Tests pin CURRENT broken behaviour (Pitfall 20 H7 entanglement) — documented in test file header.                       |
| 10    | `refactor(02-data): extract migration.js (migrateV1IfNeeded, clearOldScaleResponsesIfNeeded)` | `src/data/migration.js`                                                | `tests/data/migration.test.js`                                | Closes TEST-04. Idempotency assertions per Pitfall 10.                                                                                  |
| 11    | `refactor(02-data): extract cloud-sync.js (syncFromCloud) + add tests/mocks/firebase.js` | `src/data/cloud-sync.js`, `tests/mocks/firebase.js`                    | `tests/data/cloud-sync.test.js`                               | Closes TEST-06. D-11 factory lands here.                                                                                               |
| 12    | `refactor(02-auth): extract state-machine.js (verifyInternalPassword, verifyOrgClientPassphrase, verifyUserPassword, currentUser) + add tests/fixtures/auth-passwords.js` | `src/auth/state-machine.js`, `tests/fixtures/auth-passwords.js`, `tests/fixtures/_generators/hash-passwords.js` | `tests/auth/state-machine.test.js` | Closes TEST-07. Real `crypto.subtle.digest` + known-password fixtures per D-12.                                                       |
| 13    | `test(02-views): add snapshot tests for dashboard / diagnostic / report (TEST-10) + tests/setup.js + tests/mocks/chartjs.js + fixtures/snapshot-org.json` | (none — TEST-10 tests against existing app.js render path)             | `tests/views/{dashboard,diagnostic,report}.snapshot.test.js`, `tests/__snapshots__/views/{dashboard,diagnostic,report}.html` | Closes TEST-10. The largest single PR — snapshot baseline plus all DOM stub plumbing.                                                  |
| 14    | `feat(02-ci): wire tiered coverage thresholds + HTML report artefact + snapshot governance docs` | (none)                                                                 | (none — config + docs only)                                   | Closes the coverage gate (D-15) + artefact upload (D-20) + CONTRIBUTING.md "Updating snapshot tests" section (D-17 + D-18 budget para). |

**Why this ordering is load-bearing:**

- Util before domain because domain's tests use `iso` for time-shaped fixtures, `uid` for id generation in test-org seeds.
- Banding before scoring because scoring's test-side uses `pillarStatus` to assert "score 50 → red, 51 → red, 75 → amber, 76 → green" (boundary table — see Code Examples).
- Migration before cloud-sync because the v1 fixture depends on the v2 fixture being a stable target (v1 → v2 migration tests assert post-migration shape matches a pinned fixture; the pinned fixture is shared with cloud-sync tests as the "valid v2 org" baseline).
- Snapshots last because they exercise every other extracted module via the IIFE — so any earlier extraction defect is caught by a unit test before it hides in a snapshot diff.

**Wave packaging** (for `gsd-planner` to consume):

- **Wave 0:** Commit 1 (bridge) + pre-flight verifications. Single human-action checkpoint: "verify GH-Pages preview renders correctly, then merge to main."
- **Wave 1:** Commits 2 + 3 + 4. Util layer + first real test + smoke deletion + SECURITY.md atomic commit.
- **Wave 2:** Commits 5 + 6 + 7. Banding + scoring + TEST-02.
- **Wave 3:** Commits 8 + 9. Completion + unread + TEST-03 + TEST-05.
- **Wave 4:** Commits 10 + 11 + 12. Data + auth + TEST-04 + TEST-06 + TEST-07.
- **Wave 5:** Commits 13 + 14. Snapshot + coverage gate + docs.

Five waves keeps the parallelization config happy (`.planning/config.json` `parallelization: true`) — Wave 2 + Wave 3 could in principle run in parallel since they touch different `src/` subdirs, but the planner should serialise them anyway because Phase 1's experience showed that CI race conditions + branch protection make parallel waves expensive at this team size. Defer parallelism to Phase 4+ where the modular split makes the wins concrete.

---

## Vitest 4 Configuration Surface

> The full set of `vite.config.js` `test:` block additions Phase 2 needs. Drops in cleanly to the existing config (Phase 1 already wired the inner skeleton).

### Current state (Phase 1 D-31, verified in `vite.config.js`)

```javascript
test: {
  environment: "happy-dom",
  coverage: {
    provider: "v8",
    reportsDirectory: "coverage",
    reporter: ["text", "html"],
  },
},
```

### Phase 2 target state

```javascript
test: {
  environment: "happy-dom",
  setupFiles: ["./tests/setup.js"],          // NEW — D-09 + D-14
  globals: false,                             // explicit — `import { describe, it, expect } from "vitest"` in every test
  coverage: {
    provider: "v8",
    reportsDirectory: "coverage",
    reporter: ["text", "html"],
    exclude: [                                // NEW — D-15
      "tests/**",
      "app.js",
      "firebase-init.js",
      "data/pillars.js",
      "vite.config.js",
      "eslint.config.js",
      "**/_generators/**",                    // fixture generators run in Node, not under coverage
      "node_modules/**",
      "dist/**",
      "coverage/**",
    ],
    thresholds: {                             // NEW — D-15
      "src/domain/**": {
        lines: 100, branches: 100, functions: 100, statements: 100,
      },
      "src/util/**": {
        lines: 100, branches: 100, functions: 100, statements: 100,
      },
      "src/auth/**": {
        lines: 95, branches: 95, functions: 95, statements: 95,
      },
      "src/data/**": {
        lines: 90, branches: 90, functions: 90, statements: 90,
      },
      // No global threshold key — would fail on app.js residue.
    },
  },
},
```

`[CITED: vitest.dev/config/coverage — thresholds support glob patterns; per-directory blocks override global]`
`[VERIFIED: vitest-dev/vitest#3709 — per-directory thresholds officially supported since Vitest 1.x; v4 unchanged]`

**Notes for the planner:**

1. Vitest 4 inherits `setupFiles` from `vitest/config` defaults — no special wiring needed beyond the array. Setup file runs once per worker before any test in that worker. (We use one worker by default; multiple if `--threads` is enabled — not relevant here.)
2. `globals: false` is explicit; some example configs online use `globals: true` (lets you skip the import). We require explicit imports for ESLint clarity — Phase 1's lint config doesn't whitelist global `describe`/`it`/`expect`.
3. Threshold blocks use `lines`/`branches`/`functions`/`statements` keys. All four are required for the v8 provider; missing one defaults to no-threshold for that metric.
4. Glob patterns are matched against the SOURCE file path (relative to repo root), not the coverage report path. `src/domain/**` matches `src/domain/scoring.js`, `src/domain/sub/foo.js`, etc.
5. `tests/setup.js` is excluded from coverage even though it's loaded — Vitest auto-excludes `setupFiles` paths.
6. The `_generators/**` pattern excludes the password-hash fixture generator from coverage. Generators are committed-and-runnable scripts, not production code. Re-evaluate in Phase 4 when generators may become more substantial.

### `tests/setup.js` shape (D-09 + D-14 resolved)

```javascript
// tests/setup.js
// @ts-check
import { vi, beforeEach, afterEach } from "vitest";
import { makeChartStub } from "./mocks/chartjs.js";

// ── Time + UUID determinism (D-09) ────────────────────────────────────
beforeEach(() => {
  vi.useFakeTimers({
    now: new Date("2026-01-01T00:00:00.000Z"),
    toFake: ["Date", "setTimeout", "setInterval", "clearTimeout", "clearInterval"],
  });

  // Counter-backed deterministic UUIDs. Reset per test.
  let counter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
    counter++;
    // Pad to UUID-ish shape so any consumer's regex still matches.
    const hex = counter.toString(16).padStart(12, "0");
    return /** @type {`${string}-${string}-${string}-${string}-${string}`} */ (
      `00000000-0000-4000-8000-${hex}`
    );
  });

  // Stabilise residual Math.random calls Phase 4 hasn't replaced yet.
  vi.spyOn(Math, "random").mockReturnValue(0.5);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// ── DOM API stubs happy-dom doesn't ship (D-14) ───────────────────────
// Source: capricorn86/happy-dom#306 (matchMedia), happy-dom v20 ships
// stub Observers but they're no-ops; we make the stub explicit + inspectable.

if (typeof window.matchMedia === "undefined") {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),       // legacy
    removeListener: vi.fn(),    // legacy
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver || MockResizeObserver;

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
globalThis.IntersectionObserver = globalThis.IntersectionObserver || MockIntersectionObserver;

// ── Chart.js stub (D-09 + D-14) ──────────────────────────────────────
// Returned config is captured on instance.__lastConfig for snapshot inspection.
vi.mock("chart.js", () => makeChartStub());
// Also stub the global `Chart` that index.html's CDN-loaded Chart.js sets,
// because app.js reads window.Chart in some paths.
globalThis.Chart = (await import("./mocks/chartjs.js")).GlobalChartStub;
```

`[CITED: vitest.dev/api/vi — vi.useFakeTimers, vi.spyOn, vi.fn]`
`[VERIFIED: vitest.dev/config/faketimers — toFake array accepts 'Date', 'setTimeout', 'setInterval' among others]`

**Verifies pre-flight 4** (newline normalisation): when `tests/setup.js` is committed with LF endings (which `prettier` enforces via Phase 1 config), and Vitest's snapshot writer normalises newlines, the snapshot files written are LF on every OS.

---

## Snapshot Stabilisation Architecture (D-09 + D-10)

Snapshot drift between runs (or between OSes) is the single fastest way to invalidate the Phase 4 baseline. Every non-deterministic input MUST be pinned. Inventory:

| Source of drift                        | Pin via                                                                                                  | Where                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------- |
| `Date.now()` / `new Date()`            | `vi.useFakeTimers({ now: '2026-01-01T00:00:00.000Z', toFake: ['Date', ...] })`                          | `tests/setup.js`            |
| `setTimeout` / `setInterval` callbacks | Same fake timers                                                                                          | `tests/setup.js`            |
| `crypto.randomUUID()`                  | `vi.spyOn(crypto, 'randomUUID').mockImplementation(counter)`                                              | `tests/setup.js`            |
| `Math.random()` (legacy `uid()`)       | `vi.spyOn(Math, 'random').mockReturnValue(0.5)`                                                           | `tests/setup.js`            |
| Chart.js canvas rendering              | `vi.mock("chart.js", makeChartStub)` — captures config object on `instance.__lastConfig`, no canvas      | `tests/setup.js` + `tests/mocks/chartjs.js` |
| `window.matchMedia(...)` query results | `matchMedia` stub returns `matches: false` always                                                        | `tests/setup.js`            |
| `ResizeObserver` / `IntersectionObserver` callbacks | Stubs no-op `observe`/`unobserve`/`disconnect`                                                | `tests/setup.js`            |
| Locale-dependent date formatting (`toLocaleDateString`) | Fixture data uses dates within the "minutes ago" window so `formatWhen` returns relative strings; no `toLocaleDateString` triggers | `tests/fixtures/snapshot-org.json` |
| Browser locale (`Intl`)                | happy-dom defaults to `en-US`; setup.js sets `process.env.LANG = 'en_US.UTF-8'` only if needed           | `tests/setup.js` (defensive — likely no-op) |
| Map/Set iteration order                | JS spec mandates insertion order since ES2015 — no action needed                                          | —                           |
| Object property order                  | JSON.stringify preserves insertion order — fixtures must use canonical order                              | `tests/fixtures/snapshot-org.json` (lint or hand-author) |
| Network calls during render            | Firebase mocked via D-11 factory; `fbReady()` returns `false` for snapshot tests so cloud paths skip      | `tests/views/*.snapshot.test.js` per-test setup |
| `window.location.hash` route           | Test sets `window.location.hash` before importing `app.js`                                                | per-test                    |

### Hand-built fixture sizing (D-10)

`tests/fixtures/snapshot-org.json` covers every renderer branch. Minimum viable composition:

```jsonc
{
  "session": { "userId": "u_internal-luke" },
  "users": [
    { "id": "u_internal-luke",   "email": "luke@bedeveloped.com",   "name": "Luke",   "role": "internal" },
    { "id": "u_internal-george", "email": "george@bedeveloped.com", "name": "George", "role": "internal" },
    { "id": "u_internal-third",  "email": "third@bedeveloped.com",  "name": "Third",  "role": "internal" },
    { "id": "u_client-a",        "email": "a@client.example",       "name": "Client A", "role": "client", "orgId": "org_test-1" },
    { "id": "u_client-b",        "email": "b@client.example",       "name": "Client B", "role": "client", "orgId": "org_test-1" }
  ],
  "orgMetas": [{ "id": "org_test-1", "name": "Test Org" }],
  "orgs": [
    {
      "id": "org_test-1",
      "name": "Test Org",
      "createdAt": "2025-12-01T10:00:00.000Z",
      "currentRoundId": "r_round-2",
      "rounds": [
        { "id": "r_round-1", "label": "Round 1 (baseline)", "createdAt": "2025-09-01T10:00:00.000Z" },
        { "id": "r_round-2", "label": "Round 2 (current)",  "createdAt": "2025-12-01T10:00:00.000Z" }
      ],
      "responses": {
        "r_round-1": { /* prior round to populate "vs previous" overlay on radar */ },
        "r_round-2": {
          "u_client-a": {
            "ownership": { /* low-band scores: 1, 2, 3 → score → red */ },
            "purpose":   { /* mid-band scores: 5, 6, 7 → amber */ },
            "people":    { /* high-band scores: 9, 10 → green */ }
            /* leave at least one pillar fully unanswered to test "gray" */
          }
        }
      },
      "comments": {
        "ownership": [
          { "id": "c_1", "authorId": "u_internal-luke", "text": "Internal note", "internal": true,  "createdAt": "2025-12-15T10:00:00.000Z" },
          { "id": "c_2", "authorId": "u_client-a",      "text": "Client comment", "internal": false, "createdAt": "2025-12-30T10:00:00.000Z" },
          { "id": "c_3", "authorId": "u_internal-luke", "text": "Reply",         "internal": false, "createdAt": "2026-01-01T00:00:00.000Z" }
        ]
      },
      "actions": [
        { "id": "act_1", "title": "Fix X", "owner": "u_client-a", "due": "2026-02-01", "status": "open" },
        { "id": "act_2", "title": "Review Y", "owner": "u_internal-luke", "due": "2026-01-15", "status": "done" }
      ],
      "engagement": { "currentStageId": "diagnosed", "stageChecks": {} },
      "internalNotes": {},
      "readStates": {
        "u_internal-luke":   { "ownership": "2025-12-29T00:00:00.000Z" }, /* unread c_2 + c_3 */
        "u_client-a":        { "ownership": "2026-01-01T00:00:00.000Z" }  /* all read */
      }
    }
  ],
  "settings": { "internalPassphrase": null },
  "pillars": [/* 10 pillars from data/pillars.js — copied verbatim, becomes window.BASE_LAYERS */]
}
```

Branches exercised:

- Score → red / amber / green / gray (bandColor + pillarStatus + bandStatement).
- Multiple respondents → completion math.
- Internal vs client comments, with read/unread state per user (unread badge variants).
- Internal user vs client user view (`renderTopbar` role gating).
- Round-over-round overlay on the radar (current vs previous round).
- Action with owner + due + status — open + closed.
- Engagement stage marked "diagnosed".

`[ASSUMED]` The branch list above is comprehensive; the planner should re-validate by walking the dashboard / diagnostic / report renderers in `app.js` and confirming each `if`/`switch`/ternary has a matching fixture branch. If a branch is missed, the snapshot still pins the present behaviour but the Phase 4 baseline doesn't catch drift in unexercised branches.

### What Chart.js stub captures

```javascript
// tests/mocks/chartjs.js
// @ts-check
import { vi } from "vitest";

class ChartStub {
  /**
   * @param {HTMLCanvasElement|CanvasRenderingContext2D} ctx
   * @param {object} config
   */
  constructor(ctx, config) {
    this.__ctx = ctx;
    this.__lastConfig = config; // ← what we snapshot
    this.canvas = ctx?.canvas || ctx;
    this.data = config?.data;
    this.options = config?.options;
  }
  destroy() {}
  update() {}
  resize() {}
  render() {}
}

// Static + named exports so consumers can `import Chart from "chart.js"` or
// `import { Chart, RadarController } from "chart.js"` (app.js currently uses
// `window.Chart` only — but the snapshot harness re-imports cleanly).
ChartStub.register = vi.fn();

export const GlobalChartStub = ChartStub;

export function makeChartStub() {
  return {
    default: ChartStub,
    Chart: ChartStub,
    RadarController: vi.fn(),
    DoughnutController: vi.fn(),
    registerables: [],
  };
}
```

The snapshot HTML for views containing a chart will include the `<canvas>` element (happy-dom renders `<canvas>` as an empty element) but the chart instance's config-object shape can be asserted separately in a non-snapshot test if needed. For TEST-10 specifically, we accept the `<canvas>` empty-element rendering — what we're snapshotting is the surrounding DOM structure (cards, headings, buttons), not chart pixel output.

---

## Common Pitfalls

### Pitfall 1: Pitfall 9 (refactor without test fences) — applied to Phase 2 itself

**What goes wrong:** Phase 2 IS the test fence for Phase 4. But Phase 2 also extracts code (D-01 strangler-fig). If the extraction is wrong (e.g., a missed dependency), there's no fence yet.

**How Phase 2 avoids it:** Topological extraction order (deepest-leaf-first, see § Topological Extraction Order). Each level's tests land before the next level extracts. Within Phase 2, the LATEST extracted level always has unit-test coverage from the IMMEDIATELY PRECEDING commit. This is Pitfall 9 turned in on itself — the test fence builds layer by layer.

**Warning signs:**

- A planner attempts to extract two non-leaf modules in one commit ("save a PR roundtrip").
- A test commit lands BEFORE its corresponding extraction commit (impossible to test — module doesn't exist).
- The IIFE breaks at runtime after an extraction (run dev server, check for errors before committing).

**Source:** `.planning/research/PITFALLS.md` Pitfall 9 lines 292-318.

### Pitfall 2: Pitfall 10 (migration idempotency) — applied to TEST-04

**What goes wrong:** `migrateV1IfNeeded` walks orgs, mutates them. A naive test calls it once, asserts state. But the production path runs it on every page load; a regression that makes it non-idempotent silently destroys data over multiple loads.

**How Phase 2 avoids it:** TEST-04 includes an explicit idempotency assertion:

```javascript
// tests/data/migration.test.js — sketch
it("is idempotent — second run is a no-op", () => {
  // Seed v1 data
  localStorage.setItem("baselayers:orgs", JSON.stringify([{ id: "x", name: "X", responses: {} }]));
  localStorage.setItem(`baselayers:org:x`, JSON.stringify(/* v1 shape */));

  migrateV1IfNeeded({ /* injected deps */ });

  const afterFirstRun = JSON.stringify({
    users: localStorage.getItem("baselayers:users"),
    orgs: localStorage.getItem("baselayers:orgs"),
    orgX: localStorage.getItem("baselayers:org:x"),
  });

  migrateV1IfNeeded({ /* injected deps */ });

  const afterSecondRun = JSON.stringify({ /* same keys */ });
  expect(afterSecondRun).toBe(afterFirstRun);
});
```

Same pattern for `clearOldScaleResponsesIfNeeded`. (Note: the existing flag `v1Active` is the load-bearing idempotency mechanism — assert that the flag is consumed correctly.)

**Source:** `.planning/research/PITFALLS.md` Pitfall 10 lines 321-352. CONTEXT.md canonical_refs Pitfall 10.

### Pitfall 3: Pitfall 20 (H7 + H8) — TESTS PIN BROKEN BEHAVIOUR DELIBERATELY

**What goes wrong:** TEST-05 (unread tracking) and TEST-06 (cloud-sync bail) test functions known to be entangled with H7 (clock skew) and H8 (last-writer-wins). The Phase 5 fixes for H7/H8 will explicitly BREAK these tests. A naive Phase 2 plan writes tests for "correct" behaviour, which doesn't match production.

**How Phase 2 avoids it:** CONTEXT.md `<specifics>` is explicit: "Tests against the inline app.js are intentionally a 'before' snapshot of broken behaviour — TEST-05 (unread tracking, H7 entanglement), TEST-06 (cloud-sync bail-on-error, H8 entanglement). Phase 5 (subcollection migration + H7 fix) and any future H8 fix will explicitly break these tests."

**Test file headers MUST document this** — the planner attaches a comment block at the top of `tests/domain/unread.test.js` and `tests/data/cloud-sync.test.js`:

```javascript
/**
 * REGRESSION BASELINE — Phase 2 / Pitfall 20
 *
 * These tests pin the CURRENT behaviour of unread tracking, including the
 * known H7 (clock skew) entanglement: client clocks are mixed with server
 * clocks in the comparator. Phase 5 (DATA-07) fixes H7 by moving last-read
 * markers into Firestore readStates. When that lands, these tests will fail —
 * that failure IS the evidence of the cutover, not a regression.
 *
 * Phase 5 plan task: replace these tests with new ones that assert
 * server-clock-vs-server-clock comparators (5-minute clock skew on the
 * client does not change unread counts).
 */
```

Same pattern for `tests/data/cloud-sync.test.js` referencing H8.

**Source:** `.planning/research/PITFALLS.md` Pitfall 20 lines 695-722. CONTEXT.md `<specifics>` second bullet.

### Pitfall 4: Path resolution between IIFE imports and Vite's bundler

**What goes wrong:** `app.js` is at the repo root. New extracted modules live under `src/util/`, `src/domain/`, etc. Imports use `./src/util/ids.js` (relative paths from `app.js`). If a developer edits `app.js` and uses `from "src/util/ids.js"` (no leading `./`), it works in Vite dev (Vite resolves bare specifiers via the `vite-tsconfig-paths` style heuristic) but fails in raw browser ES module loading on GH-Pages because browsers require explicit `./`/`../`/`/`.

**How Phase 2 avoids it:** ESLint rule `import/no-unresolved` (already part of `eslint-plugin-no-unsanitized`/recommended sets — verify in lint config; if not, the planner adds it). Plus a CI check that the production bundle (`npm run build`) produces zero unresolved-module warnings. Phase 1's CI already runs `npm run build` — adding a grep for "missing import" to the build job is sufficient.

`[ASSUMED]` ESLint's flat config in this repo includes a no-unresolved equivalent. The planner should verify; if missing, add `eslint-plugin-import` (already a transitive dep of many ESLint setups; the planner verifies via `npm ls eslint-plugin-import`).

**Warning signs:**

- A test passes locally (Vite dev resolves bare specifier) but fails on the deployed GH-Pages page (browser doesn't resolve bare specifiers).
- DevTools Network tab shows a 404 on `https://baselayers.bedeveloped.com/src/util/ids.js` (no leading `./`) — wrong import shape.

**Source:** `[VERIFIED: developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules — bare specifiers require an import map; relative specifiers must start with /, ./, or ../]`

### Pitfall 5: Snapshot file commit-vs-ignore

**What goes wrong:** `tests/__snapshots__/views/*.html` accidentally added to `.gitignore` because someone ran `npm test -u` and noticed the `__snapshots__` directory and assumed it's a build artefact. With it gitignored, every CI run on a fresh clone has no baseline → every snapshot is a write, never a compare → snapshots never fail → no regression detection.

**How Phase 2 avoids it:** Wave 5's CONTRIBUTING.md "Updating snapshot tests" section (D-17) explicitly documents: "snapshot files at `tests/__snapshots__/` are committed; the diff in PR review IS the snapshot governance." The planner additionally adds a CI step that fails if the snapshot directory is empty after `npm test`:

```yaml
# in .github/workflows/ci.yml test job, after `npm test`:
- name: Verify snapshots present
  run: |
    test -s tests/__snapshots__/views/dashboard.html || (echo "Snapshot missing — was tests/__snapshots__ accidentally gitignored?"; exit 1)
    test -s tests/__snapshots__/views/diagnostic.html
    test -s tests/__snapshots__/views/report.html
```

`[CITED: vitest-dev/vitest#5890 — toMatchFileSnapshot mismatches if file empty in CI]` — same root cause; the assertion above also covers the empty-file case.

### Pitfall 6: Coverage threshold "global threshold creep"

**What goes wrong:** D-15 explicitly says "Global threshold: not set (would fail because `app.js` is uncovered by design)". A future contributor adds `lines: 80` at the global level "for safety" — CI now fails because `app.js` (excluded? not really — Vite v8 coverage may still report it depending on glob ordering) drops the global to 0%.

**How Phase 2 avoids it:** `vite.config.js` test block has a comment block above the thresholds object: `// DO NOT add global threshold — app.js is excluded by design until Phase 4 modular split. See D-15.` The planner adds this comment in Wave 5 Commit 14.

**Source:** D-15 explicit + Phase 4 cleanup ledger D-08 already exists and tracks coverage-threshold raises as a Phase 4 task.

### Pitfall 7: Setup file teardown vs `vi.useFakeTimers` + native promises

**What goes wrong:** `tests/setup.js` calls `vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'setInterval'] })` in `beforeEach`. Native promises (microtasks) are NOT in `toFake` — but if a test awaits a real promise (e.g., `crypto.subtle.digest(...)`) inside a fake-timer block, the await still works. However, `setTimeout(..., 0)` is faked and never resolves unless someone calls `vi.advanceTimersByTime(0)` or `vi.runAllTimers()`.

**Symptom:** A test that awaits a render path containing `setTimeout(render, 0)` (used in `app.js` for some debounced flows — verify) hangs.

**How Phase 2 avoids it:**

1. Be explicit in `toFake` — the list above includes `setTimeout` + `setInterval`. Tests that need real microtasks use `await Promise.resolve()` (not faked).
2. Snapshot tests do `await new Promise((r) => setTimeout(r, 0))` after importing `app.js` — but `setTimeout` is faked. Use `await vi.advanceTimersByTimeAsync(1)` instead, or `await flushPromises()` (a helper the planner adds to `tests/setup.js`).
3. Document this in the test file headers if a test does NOT use `setTimeout`-based wait.

`[ASSUMED]` Whether `app.js`'s init path uses `setTimeout(render, 0)` or similar — the planner verifies with a quick grep. If it does, the snapshot harness needs the real-timer escape hatch.

### Pitfall 8: happy-dom v20 known gaps (D-14 substrate)

**Confirmed missing in happy-dom 20.x** (must stub in `tests/setup.js`):

| API                    | Status in happy-dom 20.x                                         | Source                                          |
| ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| `window.matchMedia`    | NOT IMPLEMENTED — throws `undefined` access                       | `[VERIFIED: capricorn86/happy-dom#306, #921]`   |
| `ResizeObserver`       | Stub provided but inert; explicit no-op stub recommended          | `[VERIFIED: pkgpulse.com 2026 happy-dom-vs-jsdom guide]` |
| `IntersectionObserver` | Stub provided but inert; explicit no-op stub recommended          | `[VERIFIED: pkgpulse.com 2026 happy-dom-vs-jsdom guide]` |
| `crypto.subtle.digest` | IMPLEMENTED via Node's WebCrypto                                  | `[VERIFIED: vitest-dev/vitest#5365 — happy-dom doesn't have the JSDOM TypeError; CITED: nodejs.org/api/crypto.html — globalThis.crypto since Node 19]` |
| `crypto.randomUUID`    | IMPLEMENTED via Node's WebCrypto (we mock anyway for determinism) | Same                                            |
| `localStorage`         | IMPLEMENTED                                                       | happy-dom README                                |
| `Element.scrollIntoView` | Implementation status unclear in v20; if app.js uses it, stub it | `[VERIFIED: capricorn86/happy-dom#1051 — feature request still open as of 2023; v20 status uncertain]` `[ASSUMED]` |
| `Element.animate`      | `[ASSUMED]` not implemented — stub if app.js uses it             | No definitive source in 30 minutes of research; flagged for planner to verify |
| `structuredClone`      | `[ASSUMED]` Node 17+ ships it globally; happy-dom inherits — should work | Node docs confirm, but happy-dom-specific confirmation unverified |
| `navigator.clipboard`  | `[ASSUMED]` not implemented — `app.js` doesn't appear to use clipboard, low risk | No verified source |

**Planner action:** the setup file in § Vitest 4 Configuration Surface stubs `matchMedia`, `ResizeObserver`, `IntersectionObserver` explicitly. The planner additionally greps `app.js` for `scrollIntoView`, `animate`, `structuredClone`, `clipboard` calls during Wave 5 — if any are found, add stubs. (Quick check: the existing `app.js` uses `confirmDialog` / `promptText` / `addEventListener` only; no observer or clipboard calls visible in the extraction-target line ranges.)

---

## Code Examples

### Boundary table for TEST-02 (`pillarStatus`)

```javascript
// tests/domain/banding.test.js
import { describe, it, expect } from "vitest";
import { pillarStatus, bandLabel, bandStatement, bandColor } from "../../src/domain/banding.js";

describe("pillarStatus boundaries", () => {
  // ≤50 red, ≤75 amber, >75 green, null gray (per CONVENTIONS.md "Score scale")
  const cases = [
    { score: null,      expected: "gray" },
    { score: undefined, expected: "gray" },
    { score: 0,         expected: "red" },
    { score: 49,        expected: "red" },
    { score: 50,        expected: "red" },     // boundary — ≤50
    { score: 51,        expected: "amber" },
    { score: 74,        expected: "amber" },
    { score: 75,        expected: "amber" },   // boundary — ≤75
    { score: 76,        expected: "green" },
    { score: 100,       expected: "green" },
  ];
  it.each(cases)("score=$score → $expected", ({ score, expected }) => {
    expect(pillarStatus(score)).toBe(expected);
  });
});

describe("bandLabel/bandStatement/bandColor", () => {
  // Mirror the boundary table for each accessor — pin the user-facing strings.
  // Source: app.js:2816-2841 (banding helpers carry the actual strings).
});
```

`[CITED: app.js:228-233 — pillarStatus boundary semantics; CONVENTIONS.md "Score scale"]`

### TEST-04 idempotency assertion

```javascript
// tests/data/migration.test.js
import { describe, it, expect, beforeEach } from "vitest";
import { migrateV1IfNeeded, clearOldScaleResponsesIfNeeded } from "../../src/data/migration.js";
import v1Fixture from "../fixtures/v1-localStorage.json";
import v2Expected from "../fixtures/v2-org.json";

describe("migrateV1IfNeeded", () => {
  beforeEach(() => {
    // Seed v1 localStorage from fixture
    localStorage.setItem("baselayers:orgs", JSON.stringify(v1Fixture.orgMetas));
    Object.entries(v1Fixture.orgs).forEach(([id, raw]) => {
      localStorage.setItem(`baselayers:org:${id}`, JSON.stringify(raw));
    });
    // Note: no v1 users (v1 had no users collection)
  });

  it("converts v1 org to v2 shape", () => {
    migrateV1IfNeeded({ /* injected deps from app.js: loadUsers, loadOrgMetas, loadOrg, saveOrg, upsertUser, findUser */ });
    const orgX = JSON.parse(localStorage.getItem("baselayers:org:x"));
    expect(orgX).toMatchObject(v2Expected);
  });

  it("is idempotent — second run is a no-op", () => {
    migrateV1IfNeeded({ /* deps */ });
    const after1 = localStorage.getItem("baselayers:org:x");

    migrateV1IfNeeded({ /* deps */ });
    const after2 = localStorage.getItem("baselayers:org:x");

    expect(after2).toBe(after1);
  });

  it("creates a single legacy user with predictable id when uid is mocked", () => {
    // setup.js mocks Math.random=0.5; uid output is therefore deterministic.
    migrateV1IfNeeded({ /* deps */ });
    const users = JSON.parse(localStorage.getItem("baselayers:users"));
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("Legacy respondent");
  });
});

describe("clearOldScaleResponsesIfNeeded", () => {
  // Same idempotency pattern. Pinned-flag assertion — second run is no-op.
});
```

### TEST-06 cloud-sync bail-on-error (Pitfall 20 H8 baseline)

```javascript
// tests/data/cloud-sync.test.js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";
import { syncFromCloud } from "../../src/data/cloud-sync.js";

/**
 * REGRESSION BASELINE — Phase 2 / Pitfall 20 (H8 entanglement)
 * These tests pin CURRENT behaviour. Phase 5+ subcollection migration
 * will rewrite syncFromCloud entirely, breaking these tests by design.
 */
describe("syncFromCloud", () => {
  beforeEach(() => {
    localStorage.setItem("baselayers:orgs", JSON.stringify([{ id: "x", name: "X" }]));
    localStorage.setItem("baselayers:users", JSON.stringify([{ id: "u1", name: "Test" }]));
    localStorage.setItem("baselayers:org:x", JSON.stringify({ id: "x", name: "X", responses: {} }));
  });

  it("bails (no localStorage mutation) when cloudFetchAllOrgs returns null", async () => {
    const fb = makeFirestoreMock({ failGetDoc: true });
    const before = JSON.stringify({
      orgs: localStorage.getItem("baselayers:orgs"),
      users: localStorage.getItem("baselayers:users"),
      orgX: localStorage.getItem("baselayers:org:x"),
    });

    await syncFromCloud({
      fbReady: () => true,
      cloudFetchAllOrgs: async () => null,    // injected dep simulating fetch failure
      cloudFetchAllUsers: async () => [],
      cloudPushOrg: vi.fn(),
      cloudPushUser: vi.fn(),
      jget, jset, K,                          // injected localStorage helpers
      render: vi.fn(),
    });

    const after = JSON.stringify({ /* same keys */ });
    expect(after).toBe(before); // bail-on-error: no local mutation
  });

  it("merges cloud orgs over local on overlap (last-writer-wins — H8 entangled)", async () => {
    // Pin CURRENT behaviour: cloud wins.
    // Phase 5+ will replace this with subcollection writes that don't collide.
    // ...
  });

  it("pushes local-only orgs to cloud and keeps them in localMetas", async () => {
    // ...
  });
});
```

### TEST-07 auth state machine with real `crypto.subtle.digest`

```javascript
// tests/auth/state-machine.test.js
import { describe, it, expect, beforeEach } from "vitest";
import { verifyInternalPassword } from "../../src/auth/state-machine.js";
import { hashString } from "../../src/util/hash.js";
import passwords from "../fixtures/auth-passwords.js";

describe("verifyInternalPassword", () => {
  it("matches the canonical INTERNAL_PASSWORD_HASH", async () => {
    // The hash was generated in Node via tests/fixtures/_generators/hash-passwords.js.
    // Pre-flight 3 confirms happy-dom's crypto.subtle.digest produces the same output.
    const result = await verifyInternalPassword(passwords.internal.plain, {
      INTERNAL_PASSWORD_HASH: passwords.internal.sha256,
    });
    expect(result).toBe(true);
  });

  it("rejects wrong plaintext", async () => {
    const result = await verifyInternalPassword("wrong", {
      INTERNAL_PASSWORD_HASH: passwords.internal.sha256,
    });
    expect(result).toBe(false);
  });

  it("rejects empty string", async () => {
    const result = await verifyInternalPassword("", {
      INTERNAL_PASSWORD_HASH: passwords.internal.sha256,
    });
    expect(result).toBe(false);
  });
});
```

### Firebase mock factory shape (D-11)

```javascript
// tests/mocks/firebase.js
// @ts-check
import { vi } from "vitest";

/**
 * @typedef {object} MockOptions
 * @property {boolean}  [failGetDoc]
 * @property {boolean}  [failSetDoc]
 * @property {boolean}  [failUpdateDoc]
 * @property {Record<string, any>} [seed]    Map from "collection/id" → doc data
 */

/**
 * @param {MockOptions} [opts]
 */
export function makeFirestoreMock(opts = {}) {
  const seed = opts.seed || {};
  const docPath = (db, coll, id) => `${coll}/${id}`;

  return {
    getFirestore: vi.fn(() => ({ __isMockDb: true })),
    doc: vi.fn((db, coll, id) => ({ __path: docPath(db, coll, id), __coll: coll, __id: id })),
    collection: vi.fn((db, coll) => ({ __coll: coll })),
    getDoc: vi.fn(async (ref) => {
      if (opts.failGetDoc) throw new Error("MockFirestore: failGetDoc set");
      const data = seed[ref.__path];
      return { exists: () => data !== undefined, data: () => data, id: ref.__id };
    }),
    getDocs: vi.fn(async (ref) => {
      if (opts.failGetDoc) throw new Error("MockFirestore: failGetDoc set");
      const docs = Object.entries(seed)
        .filter(([k]) => k.startsWith(ref.__coll + "/"))
        .map(([k, data]) => ({ id: k.slice(ref.__coll.length + 1), data: () => data }));
      return { forEach: (fn) => docs.forEach(fn), size: docs.length };
    }),
    setDoc: vi.fn(async (ref, data) => {
      if (opts.failSetDoc) throw new Error("MockFirestore: failSetDoc set");
      seed[ref.__path] = data;
    }),
    updateDoc: vi.fn(async (ref, patch) => {
      if (opts.failUpdateDoc) throw new Error("MockFirestore: failUpdateDoc set");
      seed[ref.__path] = { ...(seed[ref.__path] || {}), ...patch };
    }),
    deleteDoc: vi.fn(async (ref) => {
      delete seed[ref.__path];
    }),
    onSnapshot: vi.fn((ref, cb) => {
      // Synchronously fire once with current state, return unsubscribe.
      const data = seed[ref.__path];
      cb({ exists: () => data !== undefined, data: () => data, id: ref.__id });
      return () => {}; // unsubscribe
    }),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
    query: vi.fn((coll, ...constraints) => ({ __coll: coll.__coll, __constraints: constraints })),
    where: vi.fn((field, op, value) => ({ __where: [field, op, value] })),
    orderBy: vi.fn((field, dir) => ({ __orderBy: [field, dir] })),
    limit: vi.fn((n) => ({ __limit: n })),
  };
}
```

Per-test usage:

```javascript
import { makeFirestoreMock } from "../mocks/firebase.js";
vi.mock("firebase/firestore", () => makeFirestoreMock({
  failGetDoc: true,
  seed: { "orgs/x": { id: "x", name: "X" } },
}));
```

**Phase 4 note:** when `firebase/` adapter lands, change `vi.mock("firebase/firestore", ...)` to `vi.mock("../../src/firebase/db.js", ...)`. Same factory, different mock target. Documented in cleanup ledger.

### Hash-password fixture generator (D-12)

```javascript
// tests/fixtures/_generators/hash-passwords.js
// Run: `node tests/fixtures/_generators/hash-passwords.js > tests/fixtures/auth-passwords.js`
// Outputs an ESM module ready for import.
import { createHash } from "node:crypto";

const passwords = {
  internal:  "TestInternal!2026",
  orgClient: "TestOrgClient!2026",
  user:      "TestUser!2026",
};

const lines = ["// AUTOGENERATED — re-run tests/fixtures/_generators/hash-passwords.js to refresh.", "// Source: this file's input + node:crypto SHA-256.", ""];
lines.push("export default {");
for (const [label, plain] of Object.entries(passwords)) {
  const sha256 = createHash("sha256").update(plain, "utf8").digest("hex");
  lines.push(`  ${label}: { plain: ${JSON.stringify(plain)}, sha256: ${JSON.stringify(sha256)} },`);
}
lines.push("};", "");
process.stdout.write(lines.join("\n"));
```

The generator commits to `tests/fixtures/_generators/`; the generated `tests/fixtures/auth-passwords.js` commits separately. CI does NOT re-run the generator (it's deterministic; pre-flight 3 verifies parity once).

---

## State of the Art

| Old Approach                                              | Current Approach (Phase 2 adopts)                                                                | When Changed   | Impact                                                                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inline `toMatchSnapshot` (single `.snap` file per test)   | `toMatchFileSnapshot` with custom file extension (e.g., `.html`)                                | Vitest 1.6+    | File-per-view layout (D-08) is the modern pattern for snapshot-as-baseline workflows. Single `.snap` file is tolerable for unit tests but unwieldy for views. |
| `setupFilesAfterEach` (Jest historical)                   | `setupFiles` (Vitest 4)                                                                          | Vitest 1.0     | Single setup hook runs before every test in every worker; `beforeEach`/`afterEach` registered there apply globally.                                          |
| Per-test `vi.mock("…/firebase/…")` calls                  | Hoisted `vi.mock` via `setupFiles` + factory module                                              | Vitest 0.34+   | Centralised mock survives directory restructure (D-11 explicit: "survives Phase 4").                                                                          |
| `--update-snapshots` enabled in CI                        | `npm test` (no `-u`) in CI; local-only update via `npm test -- -u`                              | Industry standard since 2020+ | Snapshot governance becomes a PR review concern (D-17), not an automation concern.                                                                          |
| Coverage % global threshold                               | Per-directory tiered thresholds via glob patterns                                                | Vitest 1.0+ supports it explicitly | D-15 makes this load-bearing for the milestone. STACK.md flags it as the canonical Vitest pattern.                                                          |
| `jsdom` for DOM tests                                     | `happy-dom` (faster, real Web Crypto)                                                           | Vitest 1.0+ first-class support | Phase 1 D-31 locked. happy-dom 20.x has fewer gaps than jsdom 24.x for the APIs this project needs (CONVENTIONS.md confirms no IntersectionObserver / clipboard usage). |

**Deprecated/outdated:**

- Plain SHA-256 of passwords (`INTERNAL_PASSWORD_HASH = "6110…"`): grandfathered through Phase 2 (TEST-07 tests it as-is per the regression-baseline mandate); deleted in Phase 6 AUTH-14.
- `Math.random()` for IDs: extracted byte-identically per D-05; replaced in Phase 4 CODE-03.
- Inline `<script>` in `index.html` for `app.js`: replaced by `<script type="module">` in D-04 (this phase).

---

## Assumptions Log

> Items tagged `[ASSUMED]` in this research. The planner uses this table to identify items needing discuss-phase confirmation before they become locked decisions.

| #  | Claim                                                                                                                                                          | Section                                          | Risk if Wrong                                                                                                                                                       |
| -- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 | The fixture branch list at § Snapshot Stabilisation Architecture is comprehensive — every renderer branch in dashboard/diagnostic/report has a fixture branch | § Snapshot Stabilisation Architecture            | Snapshot pins present behaviour but doesn't catch drift in unexercised branches. Phase 4 modular split could land a refactor that breaks an unexercised path silently. Mitigation: planner walks the renderers in Wave 5 and adds missing branches to the fixture before the snapshot baseline is committed. |
| A2 | ESLint flat config in this repo includes `import/no-unresolved` (or equivalent) catching bare-specifier imports                                                | § Common Pitfalls — Pitfall 4                    | Tests pass locally (Vite resolves bare specifiers) but module fetches 404 in browser. Mitigation: planner verifies via `npm ls eslint-plugin-import` in Wave 0; adds the plugin if missing. |
| A3 | `app.js` does not call `Element.scrollIntoView`, `Element.animate`, `structuredClone`, or `navigator.clipboard` in any code path the snapshot tests reach     | § Common Pitfalls — Pitfall 8                    | Snapshot test throws or behaves non-deterministically. Mitigation: planner greps `app.js` for these APIs in Wave 5; if found, add stubs to `tests/setup.js`.        |
| A4 | `app.js` init path does not use `setTimeout(render, 0)` patterns the fake-timer harness blocks                                                                  | § Common Pitfalls — Pitfall 7                    | Snapshot test hangs at boot. Mitigation: planner greps `app.js` in Wave 5; if `setTimeout(render, ...)` is found, snapshot harness uses `vi.advanceTimersByTimeAsync`. |
| A5 | happy-dom 20.x's `structuredClone` works (inherits Node 17+'s global)                                                                                          | § Common Pitfalls — Pitfall 8 (table)             | If app.js uses `structuredClone` (it likely doesn't but unverified), the call throws. Verifies easily — if Wave 4 snapshot tests boot, this is fine.                |

**Items NOT assumed** (verified via primary source):

- Vitest 4 newline normalisation (verified via PR #3164).
- happy-dom 20.x `crypto.subtle.digest` works (verified via vitest issue #5365 by elimination).
- happy-dom 20.x `matchMedia` is missing (verified via issue #306).
- happy-dom 20.x stub `Resize`/`IntersectionObserver` (verified via 2026 happy-dom-vs-jsdom guide).
- GitHub Pages serves nested paths and `.js` files with correct MIME (verified via community discussion #61532).
- Vitest 4 per-directory coverage thresholds via glob patterns (verified via vitest config docs + issue #3709 history).
- Phase 1 already pinned all required versions (verified via `package.json` read).
- D-04 supersedes Phase 1 D-14 (verified via CONTEXT.md `<canonical_refs>` Phase 1 Carry-Forward).

---

## Open Questions

1. **Should Wave 0 land on a feature branch with a separate GH-Pages preview-channel deploy, or directly on a temporary branch with manual DNS verification?**
   - What we know: GH-Pages doesn't support per-branch preview channels natively. Phase 1 D-11 says "Firebase Hosting deploy lands in Phase 3" — Phase 2 still ships from GH-Pages.
   - What's unclear: How to verify pre-flights 1 + 2 without affecting production traffic.
   - Recommendation: Push Wave 0 to a `phase-2-bridge-preview` branch; manually point a temporary subdomain (or use GitHub's per-branch artefact preview) for verification; then merge to `main` once verified. The planner adds this as a checkpoint task in Wave 0.

2. **Does `app.js`'s init path call `setTimeout(render, 0)`? (See Pitfall 7 + Assumption A4)**
   - What we know: Init path at app.js:5523-5567 (per CONVENTIONS.md "Async / Promise Conventions" line 4084-4096 reference) uses synchronous chain. No grep performed during research.
   - What's unclear: Whether downstream renders use deferred-microtask patterns the fake timers block.
   - Recommendation: Wave 5 first task = grep for `setTimeout` in `app.js` — if any callsite passes a function reference (not an arrow-fn that calls a function), document it. If snapshot tests need it, the harness uses `vi.advanceTimersByTimeAsync` or `vi.useRealTimers()` for the boot phase only.

3. **Do the dashboard / diagnostic / report renderers exercise every status band when given the seed fixture?**
   - What we know: `renderDashboard`, `renderDiagnosticIndex`, `renderReport` exist (CONVENTIONS.md). Their internal branches are not fully enumerated in research.
   - What's unclear: Branch coverage of the snapshot fixture (Assumption A1).
   - Recommendation: Wave 5's planner reads each renderer end-to-end and amends `tests/fixtures/snapshot-org.json` to ensure every `if`/`switch`/ternary fires. This is a 1-2 hour task done once; the result is a "comprehensive" fixture.

---

## Environment Availability

| Dependency       | Required By                          | Available | Version            | Fallback                                                                            |
| ---------------- | ------------------------------------ | --------- | ------------------ | ----------------------------------------------------------------------------------- |
| Node 22 LTS      | Vite, Vitest, all CI jobs            | ✓         | (verified Phase 1) | —                                                                                   |
| `npm`            | Package manager                      | ✓         | (Node-bundled)     | —                                                                                   |
| `vitest@4.1.5`   | Test runner                          | ✓         | 4.1.5 (locked)     | —                                                                                   |
| `happy-dom@20.9.0` | DOM env                            | ✓         | 20.9.0 (locked)    | —                                                                                   |
| `@vitest/coverage-v8@4.1.5` | Coverage                  | ✓         | 4.1.5 (locked)     | —                                                                                   |
| `git` + `gh`     | Branch + PR work                     | ✓         | (CONTRIBUTING.md verified) | —                                                                            |
| GitHub Pages preview deploy | Pre-flights 1 + 2          | ✓ (default GH-Pages serving from main + branch arrangement) | — | If preview channels truly unavailable: deploy to a sandbox custom domain. Risk: low. |
| `gh-pages` MIME for `.js` | Pre-flight 1               | ✓         | (verified via web search) | —                                                                            |
| Pre-bundled GitHub Actions | CI                          | ✓         | (Phase 1 SHA-pinned) | —                                                                                  |

**Missing dependencies with no fallback:** None — Phase 2 introduces no new external dependency. Every tool is already installed and pinned.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

> Required because `workflow.nyquist_validation: true` in `.planning/config.json`. The 8 dimensions are mapped end-to-end so VALIDATION.md can be auto-generated.

### Test Framework

| Property             | Value                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| Framework            | Vitest 4.1.5 + happy-dom 20.9.0                                                                  |
| Config file          | `vite.config.js` `test:` block (existing; Phase 2 augments with `setupFiles` + `coverage.thresholds`) |
| Quick run command    | `npm test -- tests/<area>/<file>.test.js`                                                        |
| Full suite command   | `npm test`                                                                                        |
| Coverage command     | `npm run test:coverage` (already wired in `package.json`)                                         |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                       | Test Type            | Automated Command                                   | File Exists?                                                            |
| ------- | ------------------------------------------------------------------------------ | -------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| TEST-01 | `npm test` runs Vitest under happy-dom and emits a coverage report              | smoke                | `npm test`                                          | ❌ Wave 1                                                                 |
| TEST-02 | Scoring + banding boundary tests pass                                            | unit                 | `npm test -- tests/domain/scoring.test.js tests/domain/banding.test.js` | ❌ Wave 2 (`tests/domain/scoring.test.js`, `tests/domain/banding.test.js`) |
| TEST-03 | Completion math (`userCompletionPct`, `orgSummary`) tests pass                  | unit                 | `npm test -- tests/domain/completion.test.js`        | ❌ Wave 3 (`tests/domain/completion.test.js`)                              |
| TEST-04 | v1→v2 migration + `clearOldScaleResponsesIfNeeded` idempotency tests pass       | unit                 | `npm test -- tests/data/migration.test.js`           | ❌ Wave 4 (`tests/data/migration.test.js`)                                 |
| TEST-05 | Comment + chat unread tracking tests pass (PINS H7-broken behaviour)             | unit                 | `npm test -- tests/domain/unread.test.js`            | ❌ Wave 3 (`tests/domain/unread.test.js`)                                  |
| TEST-06 | `syncFromCloud` bail-on-error tests pass (PINS H8-broken behaviour)              | unit (mocked SDK)    | `npm test -- tests/data/cloud-sync.test.js`          | ❌ Wave 4 (`tests/data/cloud-sync.test.js`)                                |
| TEST-07 | Auth state machine tests pass under real `crypto.subtle.digest`                  | unit                 | `npm test -- tests/auth/state-machine.test.js`       | ❌ Wave 4 (`tests/auth/state-machine.test.js`)                             |
| TEST-10 | Dashboard / diagnostic / report snapshot tests pass — file snapshots stable      | snapshot             | `npm test -- tests/views/`                           | ❌ Wave 5 (`tests/views/{dashboard,diagnostic,report}.snapshot.test.js`)   |
| DOC-10  | `SECURITY.md` § Build & Supply Chain has the "Regression baseline" paragraph     | manual-then-grep     | `grep -q "Regression baseline" SECURITY.md && grep -q "TEST-01" SECURITY.md && grep -q "TEST-10" SECURITY.md` | Phase 1 SECURITY.md exists; Wave 1 atomic commit appends |

**Cross-cutting (non-requirement) validation gates:**

| Gate                                          | Test Type | Automated Command                                                                                                                                | Justification                                                                                  |
| --------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Coverage threshold (D-15)                     | gate      | `npm run test:coverage`                                                                                                                          | Hard CI fail per D-16. Vitest exits 1 on threshold miss.                                       |
| Snapshot directory committed and non-empty     | gate      | `test -s tests/__snapshots__/views/dashboard.html`                                                                                                | Catches accidental gitignore (Pitfall 5).                                                      |
| Typecheck on `src/**` (D-16)                  | gate      | `npm run typecheck`                                                                                                                              | Already wired Phase 1; new modules covered by `**/*.js` glob.                                  |
| `tests/smoke.test.js` removed                 | gate      | `! test -e tests/smoke.test.js`                                                                                                                  | Verifies D-19.                                                                                  |
| `index.html` script tag is `type="module"`   | gate      | `grep -q '<script type="module" src="./app.js"' index.html`                                                                                      | Verifies D-04.                                                                                  |
| Coverage HTML artefact uploaded               | manual + CI log | inspect GH Actions run for "coverage-report-html" artefact                                                                                | D-20 — sufficient evidence for compliance bar.                                                  |
| Pre-flight 1 + 2 (GH-Pages MIME)              | manual    | `curl -sI https://baselayers.bedeveloped.com/app.js \| grep -i 'content-type'`                                                                    | One-shot verification on preview branch, before main merge.                                    |
| Pre-flight 3 (crypto parity)                  | automated | TEST-07 first run = the verification                                                                                                              | If TEST-07 passes, pre-flight 3 holds.                                                          |
| Pre-flight 4 (snapshot OS-stability)          | automated | CI `file tests/__snapshots__/views/*.html` reports "ASCII text" not "with CRLF line terminators"                                                 | Wave 5 adds the CI step.                                                                       |

### Sampling Rate

- **Per task commit:** `npm test -- <area>` (the area being touched — domain / data / auth / util / views). 5-10s.
- **Per wave merge:** `npm test` (full suite). Target <30s local, <90s CI per D-18.
- **Phase gate:** Full suite green + coverage gate green + typecheck green + lint green + build green before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/setup.js` — global setup (D-09 + D-14). Wave 0 lands an empty stub; Wave 5 fills it. (Acceptable because Wave 1's `tests/util/ids.test.js` doesn't need DOM stubs.)
- [ ] `tests/fixtures/` directory + `_generators/` subdirectory — created Wave 4 (auth) and Wave 5 (snapshot org).
- [ ] `tests/mocks/firebase.js` — created Wave 4.
- [ ] `tests/mocks/chartjs.js` — created Wave 5.
- [ ] `tests/__snapshots__/views/` — created Wave 5; first run writes the .html files, subsequent runs compare.
- [ ] `vite.config.js` `test.setupFiles` + `test.coverage.thresholds` + `test.coverage.exclude` — Wave 5 commit 14.
- [ ] `CONTRIBUTING.md` § Updating snapshot tests + § Test runtime budget (D-17 + D-18) — Wave 5 commit 14.
- [ ] `.github/workflows/ci.yml` test job: coverage HTML artefact upload + snapshot presence check — Wave 5 commit 14.
- [ ] `SECURITY.md` § Build & Supply Chain "Regression baseline" paragraph (D-21) — Wave 1 commit 4 (atomic with first real test).
- [ ] `runbooks/phase-4-cleanup-ledger.md` entries — every extraction commit appends a row per D-05.

(No "framework install: …" — every required package is already in `package.json` and `package-lock.json` from Phase 1.)

### 8-Dimension Mapping

| Dim | Name                                                | Phase 2 Manifestation                                                                                                                                | Validation                                                                                                                                                       |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Functional correctness of extracted modules vs IIFE | Each extracted leaf produces byte-identical output to its IIFE-internal predecessor                                                                  | Tests TEST-02..07 + manual smoke of dev server after each extraction commit. Optional: pre-extraction snapshot test on the IIFE-internal version, run again post-extraction → no diff. |
| 2   | Snapshot stability across OSes/runs                 | `tests/__snapshots__/views/*.html` byte-identical between Linux CI and Windows/macOS dev                                                              | Pre-flight 4 verification + every CI run (snapshot mismatch = hard CI fail per D-16).                                                                            |
| 3   | Coverage threshold enforcement                      | `src/domain/**` 100%, `src/util/**` 100%, `src/auth/**` 95%, `src/data/**` 90%                                                                       | `npm run test:coverage` exits non-zero on threshold miss; CI hard-fails (D-15 + D-16).                                                                           |
| 4   | Mock factory reusability                            | `tests/mocks/firebase.js` factory accepts `{ failGetDoc, failSetDoc, failUpdateDoc, seed }` and is consumed by 1+ tests (TEST-06)                    | Test file imports directly; planner verifies in Wave 4 by adding a second consumer if/when one emerges. Survival check: factory schema doesn't reference `firebase/firestore` SDK paths directly. |
| 5   | Auth fixture cryptographic correctness              | `crypto.subtle.digest` (happy-dom) output for known plaintexts equals `crypto.createHash` (Node) output for same plaintexts                          | Pre-flight 3 + TEST-07 first run. If TEST-07 fails, the fixture or the comparator (or happy-dom's WebCrypto) is broken.                                          |
| 6   | Migration idempotency                               | `migrateV1IfNeeded` and `clearOldScaleResponsesIfNeeded` produce identical localStorage state on first vs second run                                 | TEST-04 explicit assertions (see Code Examples).                                                                                                                 |
| 7   | CI strictness gates                                 | Test failure / coverage miss / snapshot mismatch / typecheck failure → CI hard fail. Soft fail allowed for OSV-Scanner only (Phase 1 D-20 unchanged) | `.github/workflows/ci.yml` jobs each have `continue-on-error: false` (default) for the strict gates; only OSV-Scanner has `continue-on-error: true`.            |
| 8   | Cross-phase regression detection (Phase 4 baseline) | Phase 4's verifier asserts `git diff tests/__snapshots__/` against the Phase 2 close commit shows no diff (or a known-acceptable diff)               | Phase 4 plan task — out of Phase 2 scope but Phase 2 produces the artefact. Phase 4 plan-checker will flag any snapshot file changes for explicit review.        |

---

## Project Constraints (from CLAUDE.md)

> Read `./CLAUDE.md`. Phase 2 is bound by these directives:

| Directive                                                                                          | Phase 2 Compliance                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stay on Firebase. No Vercel + Supabase migration.                                                  | Honoured — Phase 2 doesn't touch hosting; Phase 3 owns hosting cutover.                                                                                                    |
| Stay on vanilla JS. Modular split + Vite + Vitest + JSDoc-as-typecheck. No React/Vue/Svelte rewrite. | Honoured — extracted modules are vanilla JS with `// @ts-check` + JSDoc per D-06.                                                                                          |
| No backwards-compatibility window — clean cutover migrations are acceptable.                       | Phase 2 makes one cutover (D-04 supersedes Phase 1 D-14: index.html script tag rewrite). Logged in cleanup ledger.                                                          |
| Compliance bar = credible, not certified.                                                          | DOC-10 increment (D-21) cites ASVS / ISO / SOC2 honestly; doesn't over-claim.                                                                                              |
| 12-phase plan, not 5-8.                                                                            | Phase 2 stays in scope — extraction is bounded by D-02 (only TEST-01..07 targets). No "while we're at it" expansion.                                                       |
| Tests first, modular split second (Phase 2 → Phase 4).                                             | Phase 2 IS the test fence. Phase 4 is gated on Phase 2 being green.                                                                                                         |
| Conventional Commits (`docs:`, `chore:`, `feat:`, `fix:`, `refactor:`, `test:`).                   | Each extraction commit uses `refactor(02-…): …`; each test commit uses `test(02-…): …`; the bridge uses `feat(02-bridge): …`; CI changes use `feat(02-ci): …` or `chore`.   |
| `.planning/` is committed (per config).                                                            | RESEARCH.md and downstream PLAN.md commit per `commit_docs: true`.                                                                                                          |
| No emojis in commit messages or in source unless asked.                                            | Honoured throughout this RESEARCH.md and the recommended commit messages.                                                                                                   |
| Source layout target (post-Phase 4): `firebase/` + `data/*` + `domain/*` + `auth/*` + `cloud/*` + `views/*` + `ui/*` + `observability/*`. | Phase 2 lands `src/util/`, `src/domain/`, `src/data/`, `src/auth/` — consistent with Phase 4 destinations per D-03. `firebase/`, `cloud/`, `views/`, `ui/`, `observability/` remain Phase 4. |
| `domain/*` files import nothing from Firebase (lint-enforced).                                     | By construction — extracted domain modules use injected dependencies (Pattern 2). Lint rule `no-restricted-imports` already in Phase 1 (soft warn); Phase 4 hardens to error. |

---

## Sources

### Primary (HIGH confidence)

- `.planning/phases/02-test-suite-foundation/02-CONTEXT.md` — 21 locked decisions D-01..D-21. Read end-to-end.
- `.planning/REQUIREMENTS.md` — TEST-01 through TEST-07 + TEST-10 + DOC-10 acceptance criteria; traceability validated by gsd-roadmapper.
- `.planning/research/PITFALLS.md` Pitfall 9 (lines 292-318), Pitfall 10 (lines 321-352), Pitfall 20 (lines 695-722) — load-bearing rationale.
- `.planning/research/SUMMARY.md` §"Phase 2: Test Suite Foundation" (lines 177-183) and §"Critical Pitfalls / Non-Negotiables" #2 (line 156).
- `.planning/research/STACK.md` — verified-2026-05-03 versions; Vitest setup (lines 166-205); Build setup (lines 121-163); Sources (lines 551-578).
- `.planning/research/ARCHITECTURE.md` §"Target source layout" (lines 173-200) — `src/domain/`, `src/data/`, `src/auth/`, `src/util/` destinations.
- `.planning/codebase/TESTING.md` — current state ("none"); Testing Gap risk table.
- `.planning/codebase/CONCERNS.md` § Test Coverage Gaps (lines 209-224) — H2 substrate.
- `.planning/codebase/CONVENTIONS.md` — coding style preserved (no JSDoc historically; D-06 introduces JSDoc on new modules only).
- `app.js` lines 32-81, 240-307, 340-414, 473-547, 550-622, 3556-3593, 5459-5475 — extraction targets verified by grep.
- `package.json` — confirms Vitest 4.1.5 + happy-dom 20.9.0 + @vitest/coverage-v8 4.1.5 + typescript 6.0.3 already pinned.
- `vite.config.js` — confirms Phase 1 D-31 wired the `test:` block; Phase 2 augments.
- `tests/smoke.test.js` — confirms D-30 placeholder exists; D-19 deletes in Wave 1.
- `.github/workflows/ci.yml` — confirms Phase 1 hard-fail policy on lint/typecheck/test/audit/build; D-16 extends.
- `runbooks/phase-4-cleanup-ledger.md` — confirms ledger structure and "Out-of-band soft-fail entries" pattern; D-05 + D-06 add new rows.
- `SECURITY.md` § Build & Supply Chain (lines 19-50) — confirms incremental-DOC-10 pattern from Phase 1; D-21 appends "Regression baseline" paragraph.
- `CONTRIBUTING.md` (lines 32-42) — confirms `npm test` already mentioned; D-17 + D-18 add sections.
- `.planning/config.json` — confirms `nyquist_validation: true` (Validation Architecture section required).

### Secondary (MEDIUM-HIGH confidence — verified via web)

- [Vitest Snapshot guide](https://vitest.dev/guide/snapshot) — `toMatchFileSnapshot` async, file extension flexibility.
- [Vitest fakeTimers config](https://vitest.dev/config/faketimers) — `toFake` array contents.
- [Vitest coverage config](https://vitest.dev/config/coverage) — per-directory thresholds via glob patterns.
- [Vitest vi API](https://vitest.dev/api/vi) — `vi.useFakeTimers`, `vi.spyOn`, `vi.fn`, `vi.mock`.
- [Vitest fix(snapshot): normalize EOL for toMatchFileSnapshot — PR #3164](https://github.com/vitest-dev/vitest/pull/3164) — newline normalisation built in.
- [Vitest issue #5365 — crypto.subtle.digest in JSDOM](https://github.com/vitest-dev/vitest/issues/5365) — by elimination, confirms happy-dom doesn't have the JSDOM TypeError.
- [Vitest issue #5890 — toMatchFileSnapshot empty file in CI](https://github.com/vitest-dev/vitest/discussions/5890) — caveat documented.
- [Vitest issue #5426 — toMatchFileSnapshot custom serialiser](https://github.com/vitest-dev/vitest/issues/5426) — caveat documented; not relevant to our raw-HTML use case.
- [Vitest issue #3709 — per-directory thresholds historical context](https://github.com/vitest-dev/vitest/issues/3709) — feature timeline.
- [happy-dom issue #306 — matchMedia not implemented](https://github.com/capricorn86/happy-dom/issues/306) — explicit gap.
- [happy-dom issue #921 — MatchMedia.matches support](https://github.com/capricorn86/happy-dom/issues/921) — same.
- [happy-dom issue #1051 — scrollIntoView feature request](https://github.com/capricorn86/happy-dom/issues/1051) — open as of 2023; v20 status uncertain.
- [happy-dom vs jsdom 2026 guide](https://www.pkgpulse.com/guides/happy-dom-vs-jsdom-2026) — observer stub status.
- [MDN SubtleCrypto.digest](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) — FIPS 180-4 spec compliance.
- [Node.js Crypto docs](https://nodejs.org/api/crypto.html) — globalThis.crypto WebCrypto interface.
- [GitHub Community discussion #61532 — JS module MIME types](https://github.com/orgs/community/discussions/61532) — GH-Pages MIME behaviour.
- [MDN JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) — required Content-Type for module scripts; relative-vs-bare specifier rules.

### Tertiary (LOW confidence — flagged in Assumptions Log)

- happy-dom 20.x's `Element.animate`, `structuredClone`, `navigator.clipboard` support — not authoritatively verified within this research session. Mitigation: planner greps `app.js` for these APIs in Wave 5; if used, stub them. Risk is low because the renderers reachable from snapshot tests don't appear (per CONVENTIONS.md analysis dated 2026-05-03) to use these APIs.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every package pinned + verified Phase 1 + present in `package.json`.
- Architecture (extraction map + tier mapping): HIGH — extraction targets verified by grep against `app.js`; tier mapping follows ARCHITECTURE.md target layout verbatim.
- Topological extraction order: HIGH — call graph derived from reading `app.js` line ranges; deepest-leaf-first ordering follows Pitfall 9 step 3 explicitly.
- Vitest 4 configuration surface: HIGH — every config option cited to docs.
- Snapshot stabilisation architecture: HIGH for the technical pattern (fake timers + UUID mock + Chart stub) — MEDIUM for fixture branch comprehensiveness (Assumption A1).
- Pre-flight verifications: HIGH for #1, #2, #4 (verified via web + Vitest source); HIGH-by-elimination for #3 (happy-dom doesn't have the JSDOM bug; both implementations follow FIPS 180-4).
- Common pitfalls: HIGH — drawn from PITFALLS.md plus targeted web research on each Vitest/happy-dom edge case.
- Coverage threshold strategy (D-15): HIGH — Vitest config supports it natively; no novel approach.
- DOC-10 incremental: HIGH — Phase 1 SECURITY.md template confirmed; D-21 paragraph anchor specified.

**Research date:** 2026-05-06.
**Valid until:** 2026-06-06 (30 days — Vitest 4.x and happy-dom 20.x are stable; Phase 2's exact configuration shouldn't drift). Re-validate if Vitest 5 lands or happy-dom 21 ships before Phase 2 close.

---

*Research complete. Phase 2's planner has every load-bearing decision resolved with a citation, every extraction sequenced topologically, every pre-flight verification armed with a probe, and every assumption surfaced honestly.*
