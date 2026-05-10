---
phase: 09-observability-audit-event-wiring
plan: 01
subsystem: observability
tags: [obs-01, obs-02, obs-03, obs-08, audit-05, doc-10, pitfall-3, pitfall-7, pitfall-18]
requires:
  - phase-04-modular-split (src/observability/{sentry,audit-events}.js stub seams)
  - phase-07-cloud-functions (functions/src/util/sentry.ts substrate; src/cloud/audit.js writeAuditEvent)
provides:
  - shared PII_KEYS dictionary parity-tested across browser .js and node .ts
  - Sentry browser init substrate (initSentryBrowser + setUser + captureError + addBreadcrumb)
  - emitAuditEvent proxy seam (Wave 3 AUDIT-05 wires call sites)
  - Sentry boot wiring in src/main.js (Pitfall 3 — AFTER claims hydration)
  - operator runbook for Sentry org / project / DSN / quota alert bootstrap
affects:
  - src/main.js (1 import + 1 boot block in fbOnAuthStateChanged callback)
  - functions/src/util/sentry.ts (beforeSend extended; redaction contract changed delete -> "<redacted>")
  - functions/test/util/sentry.unit.test.ts (3 test assertions updated to new contract; 2 new tests added)
tech-stack:
  added:
    - "@sentry/browser@10.52.0 (bumped from 10.51.0)"
    - "@sentry/vite-plugin@5.2.1 (devDep — Wave 2 will use)"
  patterns:
    - empty-DSN no-op kill-switch (mirrors Phase 7 FN-07 reCAPTCHA placeholder pattern)
    - shared dictionary + parity test as drift contract (Pitfall 7)
    - best-effort emitAuditEvent (try/catch -> null on failure; never block originating op)
    - fingerprint rate-limit before scrubPii (drops -> zero scrub cost)
key-files:
  created:
    - src/observability/pii-scrubber.js
    - functions/src/util/pii-scrubber.ts
    - tests/observability/pii-scrubber.test.js
    - tests/observability/sentry-init.test.js
    - functions/test/util/pii-scrubber-parity.test.ts
    - runbooks/phase-9-sentry-bootstrap.md
    - .planning/phases/09-observability-audit-event-wiring/deferred-items.md
  modified:
    - package.json (bumped @sentry/browser; added @sentry/vite-plugin)
    - package-lock.json (lockfile sync)
    - src/observability/sentry.js (Phase 4 D-11 stub body filled)
    - src/observability/audit-events.js (Phase 4 D-11 stub body filled)
    - functions/src/util/sentry.ts (Phase 7 beforeSend extended to use shared PII_KEYS + redaction-string contract)
    - functions/test/util/sentry.unit.test.ts (assertion contract updated; 2 new tests)
    - src/main.js (Sentry boot wiring inside fbOnAuthStateChanged)
  deleted:
    - tests/observability/sentry.test.js (Phase 4 D-11 stub smoke test — superseded by sentry-init.test.js)
decisions:
  - "Versions strict-pinned (no caret) per existing supply-chain pinning convention"
  - "@ts-nocheck on test files using vi.mock factory rest-args patterns (matches tests/main.test.js convention)"
  - "Redaction contract changed from `delete extra[k]` (Phase 7) to `extra[k] = '<redacted>'` (Phase 9) so SRE can still see the slot WAS populated without leaking value — applies to extras + contexts; headers continue to use `delete`"
  - "Phase 4 stub smoke tests (tests/observability/sentry.test.js + audit-events.test.js Phase 4 D-11 versions) removed/replaced rather than kept as parallel coverage"
  - "Boot wiring imported once near firebase/auth.js block (no prior observability imports in main.js); init+setUser placed AFTER claims hydration but BEFORE render (Pitfall 3)"
metrics:
  duration_seconds: 2947
  duration_human: "~49 minutes"
  tasks_completed: 4
  files_created: 7
  files_modified: 8
  files_deleted: 1
  tests_added: 22  # 7 pii-scrubber + 9 sentry-init + 6 audit-events; functions: 1 parity + 2 new sentry-scrub + 1 contract-updated
  tests_passing_root_observability: "22/22"
  tests_passing_functions: "237/237"
  completed_date: "2026-05-10"
commits:
  - hash: 4a0aafc
    type: feat
    summary: "install @sentry deps + shared PII_KEYS scrubber + parity test"
  - hash: 9a924f3
    type: feat
    summary: "fill src/observability/sentry.js with init + capture + setUser + fingerprint rate-limit"
  - hash: d6a34f5
    type: feat
    summary: "fill audit-events.js + extend functions sentry.ts to use shared PII_KEYS"
  - hash: de2a2cc
    type: feat
    summary: "wire Sentry boot in src/main.js + author phase-9-sentry-bootstrap operator runbook"
---

# Phase 9 Plan 01: Sentry init substrate + shared PII scrubber + audit-events proxy seam

**One-liner:** Land the @sentry/browser init substrate with EU-region DSN contract + shared PII_KEYS dictionary parity-tested across browser/node + emitAuditEvent proxy seam + Sentry boot wired in src/main.js + operator runbook for Sentry org/project/quota-alert bootstrap.

## Outcome

Phase 9 Wave 1 substrate landed. Phase 4 D-11 stubs at `src/observability/{sentry,audit-events}.js` both have non-empty bodies; the cleanup-ledger row tracking these is ready to close at the Phase 9 close-gate. Browser + node Sentry SDKs share one PII_KEYS dictionary (10 keys: `email`, `name`, `displayName`, `ip`, `phone`, `address`, `body`, `message`, `chatBody`, `commentBody`) — parity test reads the JS source via fs and asserts string-equality with the TS const tuple, gating drift in CI. `emitAuditEvent(type, target, payload?)` is a best-effort proxy that returns null on failure (never blocks the originating op). Sentry browser init wired in `src/main.js` after claims hydration (Pitfall 3); empty `VITE_SENTRY_DSN` coalesces to silent no-op (kill-switch + local dev safe).

## Requirements addressed

| Requirement | Status | Evidence |
|-------------|--------|----------|
| OBS-01 (Sentry browser init + node init dictionary consolidation) | ✅ Substrate landed | `src/observability/sentry.js` initSentryBrowser body; `functions/src/util/sentry.ts` beforeSend uses shared PII_KEYS |
| OBS-02 (EU residency) | ✅ Substrate landed | `runbooks/phase-9-sentry-bootstrap.md` Step 2 mandates EU-region project create; DSN format `*.ingest.de.sentry.io` is the contract anchor |
| OBS-03 (PII scrubber + fingerprint rate-limit) | ✅ Code-tested | scrubPii applies to extras + each contexts bag + request.data/body strings; fingerprintRateLimit drops 11+ events per fingerprint per 60s (Test 6 in sentry-init.test.js) |
| OBS-08 (Sentry quota alert) | ✅ Substrate runbook | Runbook Step 6 documents Settings -> Subscription -> Quota Alerts at 70 percent; operator-paced (executed in Wave 5 deploy session, NOT today) |
| DOC-10 (incremental — Wave 1 increment) | ✅ Runbook authored | `runbooks/phase-9-sentry-bootstrap.md` is the first Phase 9 documentation increment; final SECURITY.md § Observability lands in Plan 09-06 |

## Final implementation choices

### Test framework decisions

- **Vitest 4.x** (root + functions/), aligning with existing project convention.
- **`@ts-nocheck`** on test files using `vi.mock` factory patterns with rest-args spread/passthrough — matches the existing `tests/main.test.js` convention. Production source modules retain `@ts-check` discipline; only test files relax to avoid fighting strict checkJs over `vi.fn` rest-arg ergonomics.
- **Spy + import order pattern** (Phase 9): declare spies + `vi.mock` BEFORE `import` of the module under test, so the mock factory closes over the spy bindings cleanly. Used in both `sentry-init.test.js` and `audit-events.test.js`.

### Mock strategy

- **Sentry browser SDK** mocked at the module boundary in `tests/observability/sentry-init.test.js`. Spies cover `init`, `setUser`, `captureException`, `addBreadcrumb`, `withScope`, and the three integration factories (`breadcrumbsIntegration`, `globalHandlersIntegration`, `linkedErrorsIntegration`). The 9 tests assert call-count + first-arg shape; the actual @sentry/browser transport never fires.
- **`src/cloud/audit.js`** mocked in `tests/observability/audit-events.test.js`. The `writeAuditEvent` spy can be configured per-test with `mockResolvedValueOnce` for the success path or `mockRejectedValueOnce` for the best-effort failure path (Test 2).
- **Date.now()** swap in fingerprint-rate-limit window-reset test — manual swap with try/finally restore (no `vi.useFakeTimers` because the existing tests/setup.js already configures fake timers in a way that the `Date.now()` advance pattern fights).

### Redaction contract change (Phase 7 -> Phase 9)

Phase 7 used `delete extra[key]` for PII scrubbing on `event.extra`. Phase 9 changed to `extra[key] = "<redacted>"` for two reasons:
1. SRE can see "this PII slot WAS populated" without seeing the value — useful for incident triage ("the user had an email address; the path that captured it is now scrubbed").
2. The shared PII_KEYS dictionary applies to BOTH `event.extra` and EACH `event.contexts.<bag>` — preserving keys + redacting values is more uniform across the two surfaces than `delete` (which would silently drop entries from `event.contexts` bags that the operator might still want to audit).

Headers (`authorization`, `Authorization`, `cookie`, `Cookie`) continue to use `delete` because the threat model is "header value MUST NOT survive in any form" — Phase 7's contract.

This change required updating Test 3 in `functions/test/util/sentry.unit.test.ts` (3 assertions changed from `.toBeUndefined()` to `.toBe("<redacted>")`).

### Boot site choice (src/main.js)

The plan specified "after claims hydration, before render." Reading lines 4171-4241 confirmed the canonical insertion point is between the claims try/catch (line 4192) and the `enrolledFactors` hydration (line 4197). I placed the Sentry boot block IMMEDIATELY after the claims try/catch — earliest point at which `claims.role` is bound — so the `sentrySetUser({ id: fbUser.uid, role: claims.role || "internal" })` call has the verified role. This leaves the existing render path untouched.

The import line was added near `./firebase/auth.js` import block (line 67-68) since the observability boot is logically paired with auth state changes. No prior observability/cloud imports existed in main.js — this is the first.

## File paths created / modified

### Created (7)

- **`src/observability/pii-scrubber.js`** — shared PII_KEYS frozen-array dictionary + `scrubPii(event)` helper. Browser SDK imports this directly.
- **`functions/src/util/pii-scrubber.ts`** — byte-equivalent TS twin (Pattern C purity: imports from nothing).
- **`tests/observability/pii-scrubber.test.js`** — 7 tests across PII_KEYS contract + scrubPii behaviours (extras, contexts, request.data/body, null/undefined, frozen).
- **`tests/observability/sentry-init.test.js`** — 9 tests across initSentryBrowser (empty-DSN no-op, idempotent, init config), setUser (id+role only), captureError (withScope+captureException), addBreadcrumb (passthrough), fingerprintRateLimit (drop @ 11 + window reset).
- **`functions/test/util/pii-scrubber-parity.test.ts`** — 1 drift-guard test reading the JS source via fs and asserting sorted-equality with the TS const tuple. The test IS the contract.
- **`runbooks/phase-9-sentry-bootstrap.md`** — 7-section operator runbook (pre-conditions, 6 steps, verification, cutover-log template, rollback, forward-tracking).
- **`.planning/phases/09-observability-audit-event-wiring/deferred-items.md`** — pre-existing out-of-scope failures discovered during Plan 09-01 execution; honest disclosure for the verifier.

### Modified (8)

- **`package.json`** — `@sentry/browser`: 10.51.0 -> 10.52.0; +`@sentry/vite-plugin@5.2.1` devDep. Strict-pinned (no caret).
- **`package-lock.json`** — lockfile sync after install.
- **`src/observability/sentry.js`** — Phase 4 D-11 stub body filled. New exports: `initSentryBrowser`, `setUser`, `_resetForTest`, `_fingerprintRateLimitForTest`. Existing exports `captureError` + `addBreadcrumb` body-filled. Banner updated to Phase 9 OBS-01/02/03 attribution.
- **`src/observability/audit-events.js`** — Phase 4 D-11 stub body filled. AUDIT_EVENTS frozen object (25 entries: AUTH_*, IAM_*, COMPLIANCE_*, DATA_* per AUDIT-05 inventory) + best-effort `emitAuditEvent(type, target, payload?)` proxy.
- **`functions/src/util/sentry.ts`** — `beforeSend` extended to use shared `PII_KEYS` from `./pii-scrubber.js`. Apply scrub to extras AND each contexts bag. Add request.data/body string clip. Redaction contract: `delete` -> `"<redacted>"` assignment for PII keys (headers continue to use `delete`). `_scrubEventForTest()` updated to mirror beforeSend.
- **`functions/test/util/sentry.unit.test.ts`** — Test 3 assertions updated from `.toBeUndefined()` to `.toBe("<redacted>")`. Two new tests added for contexts.<bag> scrubbing + request.body/data clipping.
- **`src/main.js`** — 1 new import line (`initSentryBrowser` + `setUser as sentrySetUser`) + 1 boot block (initSentryBrowser + sentrySetUser) inside the fbOnAuthStateChanged callback after claims hydration (Pitfall 3 mitigation).

### Deleted (1)

- **`tests/observability/sentry.test.js`** — Phase 4 D-11 stub smoke test (4 tests asserting "function exists; no-op safe"). Superseded by `tests/observability/sentry-init.test.js` (9 behaviour tests). Single-source-of-truth for Sentry browser-side coverage.

## Test counts

| File | Tests | Status |
|------|-------|--------|
| `tests/observability/pii-scrubber.test.js` | 7 | ✅ all pass |
| `tests/observability/sentry-init.test.js` | 9 | ✅ all pass |
| `tests/observability/audit-events.test.js` | 6 | ✅ all pass |
| `functions/test/util/pii-scrubber-parity.test.ts` | 1 | ✅ pass |
| `functions/test/util/sentry.unit.test.ts` | 6 (was 4) | ✅ all pass; 3 assertions updated; 2 new added |

Root observability: **22/22 green**. Functions full suite: **237/237 green** (was 233 pre-Plan-09-01; +4 net new across pii-scrubber-parity + 2 new sentry-scrub + 1 changed-contract retained).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Strip `^` carets from package.json sentry deps**

- **Found during:** Task 1
- **Issue:** `npm install` adds `^` prefix to versions by default. The existing `@sentry/browser` pin was `10.51.0` (no caret) per the project's TOOL-01 supply-chain pinning convention; the new install + bump kept the caret which would diverge.
- **Fix:** Manually edited package.json to strip the carets; ran `npm install --package-lock-only` to sync the lockfile.
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** `4a0aafc`

**2. [Rule 1 — Bug] Update Phase 7 sentry test assertions for new redaction contract**

- **Found during:** Task 3
- **Issue:** `functions/test/util/sentry.unit.test.ts` Test 3 used `.toBeUndefined()` because Phase 7 used `delete extra[k]`. Phase 9 plan explicitly calls out updating these assertions to `.toBe("<redacted>")`.
- **Fix:** Updated 3 assertions; added 2 new tests (contexts bag scrubbing + request.body/data clipping) to cover the new behaviour.
- **Files modified:** `functions/test/util/sentry.unit.test.ts`
- **Commit:** `d6a34f5`

**3. [Rule 1 — Bug] Delete obsolete Phase 4 stub smoke tests**

- **Found during:** Task 2 + Task 3
- **Issue:** Pre-existing `tests/observability/sentry.test.js` (Phase 4 D-11 stub smoke) tested `captureError` / `addBreadcrumb` as "function exists; no-throw on no-op". After Phase 9 body fill, these are real Sentry calls — the old smoke tests were now redundant duplicate coverage. Same shape for `tests/observability/audit-events.test.js`.
- **Fix:** Deleted the sentry stub test file; replaced the audit-events stub test file with the new behaviour test file under the same path.
- **Files affected:** `tests/observability/sentry.test.js` (deleted), `tests/observability/audit-events.test.js` (rewritten in place)
- **Commits:** `9a924f3` (sentry deletion), `d6a34f5` (audit-events rewrite)

### No Rule 4 (architectural) decisions required.

### Authentication gates: NONE

This plan was code-only. No production deploy step. No auth gates encountered.

## Pre-existing issues NOT fixed (out of scope per scope-boundary rule)

Documented in `.planning/phases/09-observability-audit-event-wiring/deferred-items.md`. Verified pre-existing via `git stash` reproduction in each case. Summary:

- **6 ESLint errors in functions/** — Phase 8 inheritance (`scheduledFirestoreExport.ts`, `gdprEraseUser.ts`, `gdprExportUser.ts`, `scheduledPurge.ts`). Phase 8 cleanup-ledger should address.
- **~16 root tsc errors** — `src/views/admin.js` (Phase 8 LIFE-06 admin UI) + `tests/data/soft-deleted.test.js` (Phase 8 plan 03). Phase 8 cleanup-ledger should address.
- **5 functions tsc errors in node_modules** — firebase-admin@13.9.0 + @google-cloud/firestore@8.5.0 dedup conflict. Dependency-tier; Phase 10/11 cleanup.
- **3 view-snapshot test flakes** — Phase 4 sub-wave 4.1 IIFE-body migration debt; hookTimeout exceeds 10s on Windows. Recommended Plan 09-06 add `hookTimeout: 30000` for views/* tests.

Plan 09-01 Task 4 verify command (`npm run lint && npm run typecheck && npm test -- --run tests/observability/`) returns exit-1 ONLY because of these pre-existing failures. The Plan 09-01 deliverables themselves all pass:
- `npm run lint` (root): exit 0.
- `npm test -- --run tests/observability/`: 22/22 green.
- All Plan 09-01 grep-based done-criteria verified.

## Forward-tracking ledger rows

Queued for downstream plans:

| Row | Owner | Closure Path |
|-----|-------|--------------|
| Phase 4 D-11 stub closure for `src/observability/sentry.js` | Plan 09-06 cleanup-ledger zero-out | Wave 6 verifies stub body landed; closes the row |
| Phase 4 D-11 stub closure for `src/observability/audit-events.js` | Plan 09-06 cleanup-ledger zero-out | Wave 6 verifies stub body landed; closes the row |
| Operator-set 70 percent quota alert (OBS-08) | Wave 5 close-gate | Operator runs `runbooks/phase-9-sentry-bootstrap.md` Step 6; Plan 09-05 verifies via screenshot evidence |
| Sentry quota free-tier sufficiency revisit | Phase-end / next engagement | Tracked in STATE.md outstanding-todos; revisit after Wave 5 baseline |
| Plan 09-06 add `hookTimeout: 30000` for views/ snapshot tests | Plan 09-06 cleanup task | Out-of-scope for Plan 09-01; document in deferred-items.md |
| Phase 8 ESLint + tsc backlog (functions + admin.js) | Phase 8 cleanup-ledger OR Phase 10/11 dependency cleanup | Out-of-scope for Plan 09-01 |
| `tests/observability/sentry.test.js` deletion | Closed in this plan | Already deleted (commit `9a924f3`) — no carry-forward |

## Next plan: 09-02 (Wave 2 — `@sentry/vite-plugin` source-map upload + CI env wiring)

Plan 09-02 tasks (per VALIDATION.md):
1. `vite.config.js` plugin registration (conditional on `SENTRY_AUTH_TOKEN`) + post-build .map deletion gate (OBS-04 / Pitfall 6).
2. `.github/workflows/ci.yml` env wiring across build + deploy + preview jobs.

Dependencies: Plan 09-02 needs the operator to have completed Steps 1-5 of `runbooks/phase-9-sentry-bootstrap.md` (DSN + auth token + GitHub Actions secrets). Wave 2 plan execution can land the code + test substrate without the operator action; the source-map upload is a no-op until the secrets are populated.

## Self-Check: PASSED

**Files claimed created — all exist:**
- `src/observability/pii-scrubber.js` — FOUND
- `functions/src/util/pii-scrubber.ts` — FOUND
- `tests/observability/pii-scrubber.test.js` — FOUND
- `tests/observability/sentry-init.test.js` — FOUND
- `functions/test/util/pii-scrubber-parity.test.ts` — FOUND
- `runbooks/phase-9-sentry-bootstrap.md` — FOUND
- `.planning/phases/09-observability-audit-event-wiring/deferred-items.md` — FOUND
- `.planning/phases/09-observability-audit-event-wiring/09-01-SUMMARY.md` — FOUND (this file)

**Commits claimed — all exist:**
- `4a0aafc` — FOUND
- `9a924f3` — FOUND
- `d6a34f5` — FOUND
- `de2a2cc` — FOUND

**Files claimed deleted — confirmed absent:**
- `tests/observability/sentry.test.js` — confirmed absent (`git show 9a924f3 --stat | grep "sentry.test.js"` shows the deletion).
