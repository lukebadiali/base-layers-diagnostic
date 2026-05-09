---
phase: 04-modular-split-quick-wins
plan: 03
subsystem: data
tags: [data, cloud, observability, eslint, firebase, firestore, storage]

# Dependency graph
requires:
  - phase: 02-test-suite-foundation
    provides: src/data/cloud-sync.js (Pattern D DI Promise wrapper analog); src/data/migration.js (single-DI surface analog); tests/data/cloud-sync.test.js (in-memory store + DI deps factory pattern); tests/mocks/firebase.js (forward-compat factory designed to retarget); snapshot baselines at tests/__snapshots__/views/{dashboard,diagnostic,report}.html (rendered-DOM contract)
  - phase: 04-modular-split-quick-wins
    plan: 01
    provides: src/firebase/db.js (the adapter the Wave 3 lint rule guards against direct SDK imports for); src/firebase/storage.js (Storage instance + uploadBytesResumable); ESLint argsIgnorePattern '^_' for forward-import aliases in app.js; eslint.config.js Wave 1 firebase/* group skeleton
  - phase: 04-modular-split-quick-wins
    plan: 02
    provides: src/ui/upload.js (D-15 trust boundary — validateUpload + ALLOWED_MIME_TYPES + MAX_BYTES — runs BEFORE data/documents.js); src/util/ids.js uid (consumed by data/documents.js + data/messages.js for doc/message id minting); ESLint Wave 2 domain/* boundary skeleton

provides:
  - 12 src/data/*.js per-collection wrappers (6 full owners + 6 Phase-5-rewrite-target pass-throughs) with `// @ts-check` + JSDoc Promise-CRUD + subscribe* per D-10
  - 5 src/cloud/*.js documented no-op stub seams (audit, soft-delete, gdpr, claims-admin, retry) — Phase 6/7/8 fill bodies WITHOUT changing the import surface
  - 2 src/observability/*.js documented no-op stub seams (sentry, audit-events) — Phase 7/9 fill bodies; AUDIT_EVENTS exported as Object.freeze({}) so accidental writes fail
  - 19 paired test files (12 tests/data + 5 tests/cloud + 2 tests/observability) — tests/data/*.test.js retargets vi.mock to src/firebase/db.js path
  - tests/mocks/firebase.js extended with `db` sentinel + addDoc + query-aware getDocs/onSnapshot + subscribeDoc wrapper (matches the firebase/db.js exported surface)
  - eslint.config.js Wave 3 D-04 flip — src/data/**/*.js block forbids direct firebase/firestore|storage|auth|app-check|functions imports (rule dormant-but-active; verified by temporary breach)
  - 13 forward-tracking cleanup-ledger rows (6 Phase-5 pass-through closures + 5 Phase-6/7/8 cloud/* + 2 Phase-7/9 observability/*) added to runbooks/phase-4-cleanup-ledger.md
  - app.js IIFE thinned by zero lines (D-12 faithful extraction — see Deviation #1) but file-scope imports for 6 full-owner data wrappers added (aliased _* until Wave 4 wires consumers)

affects: [04-04, 04-05, 04-06, 05-firestore-data-model-migration-rules-authoring, 06-real-auth-mfa-rules-deploy, 07-cloud-functions-app-check, 08-data-lifecycle-soft-delete-gdpr-backups, 09-observability-audit-event-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-collection data/* wrappers with Promise CRUD + subscribe* — every Firestore touch goes through src/data/*, which goes through src/firebase/db.js, which goes through the SDK (audit-narrative anchor for T-4-3-1)"
    - "D-09 pass-through pattern — 6 of 12 data/* wrappers delegate to data/orgs.js's nested-map shape; Phase 5 (DATA-01..06) replaces the bodies with subcollection access in lockstep without changing the API surface (views/* never re-extract their consumption pattern)"
    - "D-11 documented no-op stub seam pattern extended to cloud/* + observability/* — every directory in ARCHITECTURE.md §2 now exists with documented Phase-X-fillers; downstream phases drop bodies WITHOUT changing the import surface, the directory shape, or the lint config"
    - "D-15 trust boundary discipline applied to data/documents.js — saveDocument receives sanitisedName from validateUpload (Wave 2 helper); data tier does NOT re-validate. Single allowlist (ALLOWED_MIME_TYPES exported from src/ui/upload.js) consumed by Phase 5 storage.rules + Phase 7 callable validation + Phase 4 client-side validateUpload."
    - "Single-source-of-truth allowlist (D-15) — ALLOWED_MIME_TYPES exported from src/ui/upload.js; data/documents.js trusts the contract; Phase 5 storage.rules + Phase 7 callable validation reference the same constant — defence in depth, single canonical allowlist"
    - "AUDIT_EVENTS frozen-object (Object.freeze) substrate — Phase 7 (AUDIT-02) populates the table; consumers reference AUDIT_EVENTS.* via keyof typeof so the swap is type-safe"

key-files:
  created:
    - src/data/orgs.js
    - src/data/users.js
    - src/data/roadmaps.js
    - src/data/funnels.js
    - src/data/funnel-comments.js
    - src/data/allowlist.js
    - src/data/responses.js
    - src/data/comments.js
    - src/data/actions.js
    - src/data/documents.js
    - src/data/messages.js
    - src/data/audit-events.js
    - src/cloud/audit.js
    - src/cloud/soft-delete.js
    - src/cloud/gdpr.js
    - src/cloud/claims-admin.js
    - src/cloud/retry.js
    - src/observability/sentry.js
    - src/observability/audit-events.js
    - tests/data/orgs.test.js
    - tests/data/users.test.js
    - tests/data/roadmaps.test.js
    - tests/data/funnels.test.js
    - tests/data/funnel-comments.test.js
    - tests/data/allowlist.test.js
    - tests/data/responses.test.js
    - tests/data/comments.test.js
    - tests/data/actions.test.js
    - tests/data/documents.test.js
    - tests/data/messages.test.js
    - tests/data/audit-events.test.js
    - tests/cloud/audit.test.js
    - tests/cloud/soft-delete.test.js
    - tests/cloud/gdpr.test.js
    - tests/cloud/claims-admin.test.js
    - tests/cloud/retry.test.js
    - tests/observability/sentry.test.js
    - tests/observability/audit-events.test.js
  modified:
    - app.js (added 6 file-scope imports for full-owner data/* wrappers — aliased _* per Wave 1 argsIgnorePattern; IIFE bodies preserved per D-12 + deviation #1)
    - tests/mocks/firebase.js (extended factory: `db` sentinel + addDoc + query-aware getDocs/onSnapshot + subscribeDoc wrapper)
    - eslint.config.js (Wave 3 D-04 flip — src/data/**/*.js block forbids direct firebase/firestore|storage|auth|app-check|functions imports)
    - runbooks/phase-4-cleanup-ledger.md (+13 forward-tracking rows; Wave 3 timeline entries; out-of-band soft-fail row Wave 3 checkbox)
  deleted: []

key-decisions:
  - "**[Rule 1/3 deviation] D-12 faithful-extraction overrode the plan's literal 'DELETE the IIFE-resident loadOrg/loadUsers/cloudPushOrg/etc.' instruction.** The plan task-step 9 instructed deleting the IIFE bodies and renaming 64 sync localStorage call sites to async Firestore call sites. That contradicts (a) the plan's own must_haves.truths 'Phase 2 snapshot baselines produce zero diff', (b) D-12 'faithful extraction — wrap, don't refactor', (c) threat_model T-4-3-3 (Phase 4 IS pure-refactor), and (d) the broader Phase 5 vs Phase 4 boundary (Phase 5 owns the localStorage→Firestore semantic cutover). Preferred interpretation: file-scope imports land NOW; IIFE keeps its localStorage-fronted helpers verbatim; Wave 4 view extraction (per D-20) is where the actual call-site flips happen. Same _$$/_notify forward-aliasing pattern from Wave 2."
  - "ESLint Wave 3 src/data/**/*.js block uses bare-specifier patterns (firebase/firestore etc.) rather than relative-path patterns (**/firebase/* etc.). data/* never imports via relative path 'firebase/firestore'; the bare specifier is the canonical SDK reach. Verified rule fires on a temporary `import ... from 'firebase/firestore'` in src/data/orgs.js with the configured message."
  - "tests/mocks/firebase.js extension — added a `db` sentinel + addDoc + query-aware getDocs/onSnapshot + subscribeDoc wrapper. The Phase 2 D-11 forward-compat note pre-authorised this extension. Backward-compatible: existing tests/data/cloud-sync.test.js + tests/data/migration.test.js use DI-injected dependencies and do NOT depend on the module-mock surface, so they continue to pass unchanged."
  - "addFunnelComment uses Firestore auto-id (addDoc) rather than caller-supplied id — per ARCHITECTURE.md §4 funnelComments/{commentId} is a flat collection with system-generated ids. Test verifies `result.id` is truthy + the body is queryable by orgId."
  - "data/documents.js delegates to data/orgs.js's nested-map AND uploads via firebase/storage.js — both pass-through (Phase 5 DATA-01 rewrites metadata path) AND Storage seam (Phase 7 wires the secure-upload callable). The two trust-boundary stances are decoupled: client validates declared+actual MIME (via ui/upload.js); server enforces (Phase 5 storage.rules + Phase 7 callable). Single allowlist constant exported from src/ui/upload.js."

patterns-established:
  - "Per-wave per-files-scoped ESLint config blocks (D-04) — Wave 3 added the third in the chain (Wave 1 firebase/* group + Wave 2 domain/* + Wave 3 data/*). The src/data/**/*.js block uses bare-specifier patterns (firebase/firestore etc.) rather than relative-path patterns — data/* never reaches the SDK via relative path. Boundary verification done via temporary breach + revert."
  - "TDD RED→GREEN split for the 12 wrappers (RED for full owners, GREEN for full owners; RED for pass-throughs, GREEN for pass-throughs) — each commit closes one D-* requirement set. The cloud/* + observability/* stubs landed in a single chore-style commit (Task 3) since the smoke tests + implementations + ESLint flip + ledger rows form one coherent boundary closure."
  - "Forward-import aliasing (`_getOrg`, `_getUser`, etc. in app.js) — the file-scope imports land NOW so the Wave 4 view extractions are pure rewires (no new module discovery). The `^_` argsIgnorePattern (Wave 1) absorbs the unused-by-design contract WITHOUT new eslint-disable rows (Phase 4 D-17 ledger zero-out direction). Same pattern as Wave 2's `_$$`, `_notify`, `_validateUpload`, `_ALLOWED_MIME_TYPES`, `_MAX_BYTES`."

requirements-completed: [CODE-01, CODE-02]

# Metrics
duration: 25min
completed: 2026-05-07
---

# Phase 4 Plan 03: data/* + cloud/* + observability/* + Wave 3 ESLint Flip Summary

**12 src/data/* per-collection wrappers (6 full owners + 6 Phase-5-rewrite-target pass-throughs) + 5 src/cloud/* + 2 src/observability/* documented no-op stub seams + Wave 3 ESLint flip blocks data/* from importing the SDK directly + 13 forward-tracking ledger rows; ARCHITECTURE.md §2 directory tree fully landed; D-12 faithful extraction means app.js IIFE bodies remain intact (snapshot baselines zero-diff).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-07T12:25Z
- **Completed:** 2026-05-07T12:50Z
- **Tasks:** 3 (TDD RED+GREEN for Tasks 1+2 + chore-style for Task 3 = 5 commits)
- **Files modified:** 42 (38 created + 4 modified)

## Accomplishments

- **6 full-owner data/* wrappers** (orgs/users/roadmaps/funnels/funnel-comments/allowlist) — each `// @ts-check` with JSDoc-typed Promise CRUD + subscribe* per D-10. orgs/users/roadmaps/funnels mirror the same get/list/save/delete/subscribe shape against their respective top-level collections; funnel-comments uses addDoc auto-id + where("orgId", "==", val) scoping; allowlist is read-only (no write surface — admin writes go through Phase 7 callable per T-4-3-6 mitigation).
- **6 pass-through data/* wrappers** (responses/comments/actions/documents/messages/audit-events) — preserve the IIFE's nested-map shapes verbatim per D-12. responses preserves the 4-deep `org.responses[roundId][userId][pillarId][idx]` shape; comments preserves `org.comments[pillarId]` arrays; actions preserves `org.actions[actionId]` flat map; documents adds Storage upload via firebase/storage.js (D-15 trust boundary at ui/upload.js); messages adds onSnapshot live subscription; audit-events delegates to cloud/audit.js. Phase 5 (DATA-01..06) replaces ALL 6 bodies with subcollection access in lockstep — the API surface stays stable.
- **5 src/cloud/* documented no-op stubs** (audit/soft-delete/gdpr/claims-admin/retry) — each `// @ts-check` + JSDoc-typed signatures + "Phase X body lands here" comment template. cloud/audit.js → Phase 7 (FN-04/AUDIT-01); cloud/soft-delete.js → Phase 8 (LIFE-04); cloud/gdpr.js → Phase 8 (GDPR-01/02); cloud/claims-admin.js → Phase 6 (AUTH-07); cloud/retry.js → Phase 7 (FN-09).
- **2 src/observability/* documented no-op stubs** (sentry/audit-events) — sentry.js → Phase 9 (OBS-01); audit-events.js → Phase 7 (AUDIT-02 constants table) + Phase 9 (AUDIT-05 view wiring). AUDIT_EVENTS exported as Object.freeze({}) so accidental writes fail.
- **tests/mocks/firebase.js retargeted** — factory extended with `db` sentinel, addDoc, query-aware getDocs/onSnapshot (where("field", "==", val) filtering), and subscribeDoc wrapper. The Phase 2 D-11 forward-compat note pre-authorised the extension. All 19 new test files mock `'../../src/firebase/db.js'` per the Wave 3+ retarget. Existing tests/data/cloud-sync.test.js + tests/data/migration.test.js use DI-injected deps and continue to pass unchanged.
- **19 paired test files** (12 tests/data + 5 tests/cloud + 2 tests/observability) — 60 new tests total (32 full-owner CRUD + 23 pass-through + 7 cloud/observability smoke + 2 audit-events frozen-object + 4 retry/sentry no-op variants). Per D-21 cloud/* + observability/* are EXCLUDED from coverage thresholds in Phase 4; the smoke tests satisfy the Pattern Map "test-file pairing" rule.
- **eslint.config.js Wave 3 D-04 flip** — `src/data/**/*.js` block forbids direct `firebase/firestore | firebase/storage | firebase/auth | firebase/app-check | firebase/functions` imports. Rule dormant-but-active: src/data/* uses only src/firebase/db.js + src/firebase/storage.js today. Verified rule fires by temporarily importing `firebase/firestore` into src/data/orgs.js → expected single error with the configured message → reverted. Combined with Wave 1 (firebase/* group → only src/firebase/**) + Wave 2 (domain/* → no firebase/*) + Wave 3 (this), 3 of the 4 ARCHITECTURE.md §2.4 boundaries are now lint-enforced. Wave 4 closes views/* → no firebase/* (Plan 04-04).
- **13 forward-tracking cleanup-ledger rows** added to runbooks/phase-4-cleanup-ledger.md "Phase 4 — forward-tracking rows" section: 5 Phase-5 pass-through closures (responses/comments/actions/documents/messages → DATA-01) + 5 Phase-6/7/8 cloud/* (audit/retry → Phase 7; soft-delete/gdpr → Phase 8; claims-admin → Phase 6) + 2 Phase-7/9 observability/* (sentry → Phase 9; audit-events → Phase 7 + Phase 9). Wave 3 timeline entries also added to the Phase 2 close-out section. The out-of-band soft-fail no-restricted-imports row gains the `[x] Wave 3 data/*` checkbox.
- All **334 tests pass** (257 baseline + 32 full-owner + 23 pass-through + 22 cloud/observability smoke); typecheck clean; lint clean; build clean (firebase chunk: 382.87 kB); Phase 2 snapshot baselines (dashboard/diagnostic/report) zero diff.

## Task Commits

Each task was committed atomically (TDD RED→GREEN for the 12 wrapper tasks; single-commit for the cloud/observability stub seam set):

1. **Task 1 RED: failing tests for 6 full-owner data/* wrappers** — `22baed6` (test)
2. **Task 1 GREEN: 6 full-owner wrappers + retargeted firebase mock + app.js file-scope imports** — `1485236` (feat)
3. **Task 2 RED: failing tests for 6 pass-through data/* wrappers** — `78f6c96` (test)
4. **Task 2 GREEN: 6 pass-throughs + cloud/audit.js seam (needed by audit-events.js) + 6 ledger rows** — `272e955` (feat)
5. **Task 3: 4 remaining cloud/* + 2 observability/* stubs + Wave 3 ESLint flip + 7 ledger rows** — `bfa216e` (feat)

**Plan metadata:** orchestrator commits SUMMARY.md after this agent returns.

## The 12 data/* Module Shapes

### Full owners (6) — own their full read/write logic against top-level collections

| Module                          | Collection                  | Exports                                                                         |
| ------------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `src/data/orgs.js`              | `orgs/{orgId}`              | `getOrg`, `listOrgs`, `saveOrg` (with serverTimestamp updatedAt), `deleteOrg`, `subscribeOrgs` |
| `src/data/users.js`             | `users/{userId}`            | `getUser`, `listUsers`, `saveUser`, `deleteUser`, `subscribeUsers`              |
| `src/data/roadmaps.js`          | `roadmaps/{orgId}`          | `getRoadmap`, `listRoadmaps`, `saveRoadmap`, `deleteRoadmap`, `subscribeRoadmaps` |
| `src/data/funnels.js`           | `funnels/{orgId}`           | `getFunnel`, `listFunnels`, `saveFunnel`, `deleteFunnel`, `subscribeFunnels`    |
| `src/data/funnel-comments.js`   | `funnelComments/{commentId}` (flat + orgId field) | `listFunnelComments(orgId)`, `addFunnelComment(orgId, comment)` (auto-id), `deleteFunnelComment(commentId)`, `subscribeFunnelComments(orgId, cb)` |
| `src/data/allowlist.js`         | `internalAllowlist/{lowercasedEmail}` (read-only) | `getAllowlistEntry(email)`, `listAllowlist()` — NO write helpers (T-4-3-6) |

### Pass-throughs (6) — Phase-5-rewrite-target wrappers delegating to data/orgs.js's nested-map shape

| Module                          | Current shape                                              | Phase 5 target                                                       | Exports                                                            |
| ------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/data/responses.js`         | `org.responses[roundId][userId][pillarId][idx]` (4-deep)   | `orgs/{orgId}/responses/{respId}` subcollection                       | `listResponses`, `saveResponse`, `deleteResponse`                  |
| `src/data/comments.js`          | `org.comments[pillarId][...]`                              | `orgs/{orgId}/comments/{cmtId}` subcollection                         | `listComments`, `addComment`, `deleteComment`                      |
| `src/data/actions.js`           | `org.actions[actionId]` flat map                           | `orgs/{orgId}/actions/{actId}` subcollection                          | `listActions`, `saveAction`, `deleteAction`                        |
| `src/data/documents.js`         | `org.documents[docId]` map + Storage upload                | `orgs/{orgId}/documents/{docId}` subcollection + RULES-04            | `listDocuments`, `saveDocument(orgId, file, sanitisedName, meta?)`, `deleteDocument` |
| `src/data/messages.js`          | `org.messages[msgId]` map + onSnapshot                     | `orgs/{orgId}/messages/{msgId}` subcollection + `readStates/{userId}` | `listMessages`, `addMessage`, `subscribeMessages`                  |
| `src/data/audit-events.js`      | pass-through to `cloud/audit.js` (Phase 7 stub)            | Phase 7 wires `auditWrite` callable                                   | `recordAuditEvent`                                                 |

The API surface for all 12 wrappers stays stable across Phase 4 → Phase 5 cutover. views/* (Wave 4) write their consumption pattern ONCE; Phase 5 replaces ONLY the bodies.

## The 7 Stub Module Shapes (cloud/* + observability/*)

| Module                              | Exports                                  | Closure phase             | Body lands when                                                                       |
| ----------------------------------- | ---------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| `src/cloud/audit.js`                | `writeAuditEvent`                        | Phase 7 (FN-04/AUDIT-01)  | `httpsCallable("auditWrite")` wired through `src/firebase/functions.js`               |
| `src/cloud/soft-delete.js`          | `softDelete`, `restoreSoftDeleted`       | Phase 8 (LIFE-04)         | `httpsCallable("softDelete")` + `httpsCallable("restoreSoftDeleted")`                 |
| `src/cloud/gdpr.js`                 | `exportUser`, `eraseUser`                | Phase 8 (GDPR-01/02)      | `httpsCallable("gdprExportUser")` + `httpsCallable("gdprEraseUser")`                  |
| `src/cloud/claims-admin.js`         | `setClaims`                              | Phase 6 (AUTH-07)         | `httpsCallable("setClaims")`                                                          |
| `src/cloud/retry.js`                | `withRetry<T>(fn, opts?)`                | Phase 7 (FN-09)           | exponential-backoff + 429-aware retry helper                                          |
| `src/observability/sentry.js`       | `captureError`, `addBreadcrumb`          | Phase 9 (OBS-01)          | `@sentry/browser` init + `captureException` + `addBreadcrumb`                         |
| `src/observability/audit-events.js` | `AUDIT_EVENTS` (frozen), `emitAuditEvent` | Phase 7 + Phase 9         | Phase 7 (AUDIT-02) populates the table; Phase 9 (AUDIT-05) wires emit calls in views/* |

All stubs ship `// @ts-check` + JSDoc + a "Phase X body lands here" comment template (mirrors src/firebase/check.js Wave 1 pattern). Phase 6/7/8/9 swap bodies WITHOUT changing the import surface — the cathedral's interior walls before the windows.

## The Retargeted vi.mock Path in tests/data/*.test.js

All 12 new tests/data/*.test.js files mock the adapter, not the SDK:

```js
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: { "orgs/o1": { id: "o1", name: "Acme" } },
}));

const { getOrg, ... } = await import("../../src/data/orgs.js");
```

The `await import(...)` (top-level await) defers the production module load until after `vi.mock` registration — required for Vitest 4.x hoisting semantics with the `db` sentinel pattern.

The Phase 2 D-11 forward-compat note in `tests/mocks/firebase.js` pre-authorised the retarget: "when src/firebase/db.js lands, change vi.mock target from 'firebase/firestore' to '../../src/firebase/db.js' — same factory." Wave 3 lands the retarget for all new tests; the existing tests/data/cloud-sync.test.js + tests/data/migration.test.js use DI-injected dependencies and don't need the module-mock surface, so they continue to pass unchanged.

## The Wave 3 ESLint Flip Diff

Added to `eslint.config.js` after the Wave 2 `src/domain/**/*.js` block:

```js
{
  files: ["src/data/**/*.js"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "firebase/firestore",
              "firebase/storage",
              "firebase/auth",
              "firebase/app-check",
              "firebase/functions",
            ],
            message:
              "data/* must access SDK only through src/firebase/db.js + src/firebase/storage.js (Wave 3 D-04).",
          },
        ],
      },
    ],
  },
},
```

**Verification of rule firing:** Temporarily added `import { db as _testDb } from "firebase/firestore";` to `src/data/orgs.js` → ran `npm run lint` → 1 expected error with the configured message → reverted the import.

**State of the four-boundary D-04 plan:**

| Boundary                                                  | Wave | Status                       |
| --------------------------------------------------------- | ---- | ---------------------------- |
| `firebase/*` SDK group → only `src/firebase/**`          | 1    | DONE (Plan 04-01)            |
| `domain/*` → no `firebase/*`                              | 2    | DONE (Plan 04-02)            |
| `data/*` → only `src/firebase/db.js` + `src/firebase/storage.js` | 3    | **DONE (this plan)**         |
| `views/*` → no `firebase/*`                               | 4    | Pending (Plan 04-04)         |

## The 13 Forward-Tracking Ledger Rows Added

The `Phase 4 — forward-tracking rows (Phase 5 / Phase 7 / Phase 8 / Phase 9 closures)` section (new) now contains 13 rows. Each row tracks the downstream phase that fills the body:

| Module                               | Closure phase     |
| ------------------------------------ | ----------------- |
| `src/data/responses.js` — pass-through body | Phase 5 (DATA-01) |
| `src/data/comments.js` — pass-through body  | Phase 5 (DATA-01) |
| `src/data/actions.js` — pass-through body   | Phase 5 (DATA-01) |
| `src/data/documents.js` — pass-through body + Storage Rules | Phase 5 (DATA-01 + RULES-04) |
| `src/data/messages.js` — pass-through body + readStates     | Phase 5 (DATA-01) |
| `src/data/audit-events.js` — wire to real auditWrite        | Phase 7 (FN-04/AUDIT-01) |
| `src/cloud/audit.js` — httpsCallable("auditWrite")          | Phase 7 (FN-04/AUDIT-01) |
| `src/cloud/soft-delete.js` — httpsCallable softDelete + restore | Phase 8 (LIFE-04) |
| `src/cloud/gdpr.js` — httpsCallable gdprExportUser + Erase  | Phase 8 (GDPR-01/02) |
| `src/cloud/claims-admin.js` — httpsCallable setClaims       | Phase 6 (AUTH-07) |
| `src/cloud/retry.js` — exponential-backoff + 429-aware retry | Phase 7 (FN-09) |
| `src/observability/sentry.js` — @sentry/browser init        | Phase 9 (OBS-01) |
| `src/observability/audit-events.js` — populate AUDIT_EVENTS + wire emit calls | Phase 7 (AUDIT-02) + Phase 9 (AUDIT-05) |

Plus the out-of-band soft-fail row `no-restricted-imports per-wave hardening` gains the `[x] Wave 3 data/* → only src/firebase/db.js + src/firebase/storage.js` checkbox; the row remains open until Wave 4 closes views/*.

## Full ARCHITECTURE.md §2 Directory Tree State

After Wave 3, every directory in ARCHITECTURE.md §2 exists:

```
src/
├── auth/        ← Phase 2 (state-machine.js — Phase 6 deletes)
├── cloud/       ← Wave 3 (5 stubs; Phase 6/7/8 fill bodies)
│   ├── audit.js
│   ├── claims-admin.js
│   ├── gdpr.js
│   ├── retry.js
│   └── soft-delete.js
├── data/        ← Wave 3 + Phase 2 (12 wrappers + cloud-sync + migration)
│   ├── actions.js                ← Wave 3 pass-through
│   ├── allowlist.js              ← Wave 3 full owner (read-only)
│   ├── audit-events.js           ← Wave 3 pass-through to cloud/audit.js
│   ├── cloud-sync.js             ← Phase 2 (Phase 5 rewrites)
│   ├── comments.js               ← Wave 3 pass-through
│   ├── documents.js              ← Wave 3 pass-through + Storage
│   ├── funnel-comments.js        ← Wave 3 full owner (flat + orgId field)
│   ├── funnels.js                ← Wave 3 full owner
│   ├── messages.js               ← Wave 3 pass-through + onSnapshot
│   ├── migration.js              ← Phase 2
│   ├── orgs.js                   ← Wave 3 full owner
│   ├── responses.js              ← Wave 3 pass-through
│   ├── roadmaps.js               ← Wave 3 full owner
│   └── users.js                  ← Wave 3 full owner
├── domain/      ← Phase 2 (banding/scoring/completion/unread)
├── firebase/    ← Wave 1 (app/auth/db/storage/functions/check)
├── observability/ ← Wave 3 (2 stubs; Phase 7/9 fill bodies)
│   ├── audit-events.js           ← Wave 3 (constants table — frozen)
│   └── sentry.js                 ← Wave 3 (Sentry init slot)
├── ui/          ← Wave 2 (dom/modal/toast/format/chrome/upload)
└── util/        ← Phase 2 (ids/hash)
```

Pending: `src/views/`, `src/state.js`, `src/router.js`, `src/main.js` — Waves 4 + 5 land them.

## app.js Line Count Diff

| Stage                                | Lines | Δ       |
| ------------------------------------ | ----- | ------- |
| Wave 3 entry                         | 4996  | —       |
| After Task 1 GREEN (6 imports added) | 5044  | +48     |
| Wave 3 close                         | 5044  | **+48** |

The IIFE bodies were preserved per the deviation (D-12 faithful extraction). Wave 4 is the wave that thins the IIFE meaningfully — each view extraction removes ~100-300 lines + the IIFE-resident render functions. The +48 lines this wave are the file-scope imports for the 6 full-owner data wrappers (5 multi-line imports + 1 single + a comment block).

## Snapshot Baseline Zero-Diff Verification

```
$ git diff --stat tests/__snapshots__/views/
(empty)
```

`tests/__snapshots__/views/{dashboard,diagnostic,report}.html` are byte-identical to the Phase 2 D-08 baselines. Wave 3 added file-scope imports + new module files but did NOT change any IIFE behaviour — the snapshot baselines remain the rendered-DOM contract through Wave 4.

## Decisions Made

- **D-12 faithful extraction overrode the plan's literal "DELETE the IIFE-resident loadOrg/loadUsers/cloudPushOrg/etc."** instruction (see Deviations below). file-scope imports landed; IIFE bodies preserved. Wave 4 view extractions are where the actual sync→async call-site flips happen.
- **tests/mocks/firebase.js extended with `db` sentinel + addDoc + query-aware getDocs/onSnapshot + subscribeDoc wrapper** — Phase 2 D-11 forward-compat note pre-authorised. Backward-compatible: existing DI-based tests pass unchanged.
- **addFunnelComment uses Firestore auto-id** rather than caller-supplied id — per ARCHITECTURE.md §4 funnelComments is a flat collection with system-generated ids.
- **data/documents.js is BOTH pass-through AND Storage seam** — pass-through to data/orgs.js's metadata map (Phase 5 DATA-01 rewrites) AND uploads via firebase/storage.js. The two trust-boundary stances are decoupled: client validates declared+actual MIME (via ui/upload.js); server enforces (Phase 5 storage.rules + Phase 7 callable). Single allowlist constant.
- **cloud/audit.js landed in Task 2 (not Task 3)** — src/data/audit-events.js imports from cloud/audit.js so Vite needs the module to exist at module-load time. Test mocks it, but the import statement still resolves through the bundler. Pragmatic out-of-task seam landing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Bug + Blocking] D-12 faithful-extraction overrode the plan's literal "DELETE the IIFE-resident definitions + 1:1 rename" instruction**

- **Found during:** Task 1 action step 9 review (before any edit lands)
- **Issue:** The plan's task-step 9 instructed deleting the IIFE bodies of `loadOrg / loadOrgMetas / loadUsers / findUser / upsertUser / loadRoadmaps / loadFunnels / loadFunnelComments / loadAllowlist / cloudFetchAllOrgs / cloudFetchAllUsers / cloudPushOrg / cloudPushUser` and renaming 64 sync localStorage call sites to async Firestore call sites. This contradicts:
  - (a) The plan's own `must_haves.truths` line "Phase 2 snapshot baselines produce zero diff" — sync→async cutover would break the IIFE's render dispatch flow, which uses synchronous reads.
  - (b) D-12 "faithful extraction — wrap, don't refactor" — the plan's own Wave 3 design principle.
  - (c) Threat model T-4-3-3 ("Phase 4 IS pure-refactor per ROADMAP — backend behaviour unchanged"). Cutting localStorage as the sync source of truth IS a behaviour change.
  - (d) The Phase 5 vs Phase 4 boundary: Phase 5 (DATA-01..06) explicitly owns the localStorage→Firestore semantic cutover.
  - (e) The plan's `must_haves.truths` line "app.js IIFE imports the 6 full-owner data wrappers; the 6 pass-through wrappers are imported by Wave 4 views as they extract" — IMPORTS, not RENAMES.
- **Fix:** Added file-scope imports for the 6 full-owner data wrappers, aliased `_*` to satisfy the `^_` argsIgnorePattern (matches the Wave 2 `_$$/_notify/_validateUpload/_ALLOWED_MIME_TYPES/_MAX_BYTES` pattern). The IIFE-resident `loadOrg / loadUsers / cloudPushOrg / cloudPushUser` etc. helpers remain INTACT. Wave 4 view extraction (per D-20) is where the actual call-site flips happen.
- **Files modified:** app.js (added imports only; IIFE bodies preserved)
- **Verification:** snapshot baselines (dashboard/diagnostic/report) zero diff; 334/334 tests pass; lint + typecheck clean
- **Committed in:** 1485236 (Task 1 GREEN)
- **Acceptance-criterion impact:** The plan's `grep -c "loadOrg|loadUsers|loadRoadmaps|loadFunnels|loadAllowlist" app.js returns 0` criterion is NOT met (the IIFE-resident helpers remain) — but meeting it would violate the plan's own threat-model + must_haves snapshot-baseline rule. The acceptance criterion is internally inconsistent with the rest of the plan.

**2. [Rule 3 - Blocking] tests/mocks/firebase.js extended with `db` sentinel + addDoc + query-aware getDocs/onSnapshot + subscribeDoc wrapper**

- **Found during:** Task 1 GREEN — running RED tests against initial src/data/orgs.js
- **Issue:** The Phase 2 mock factory exposed `getFirestore` only, not `db` directly. src/data/orgs.js imports `db` (the adapter's exported sentinel: `const db = getFirestore(app)`). The mock returned `getFirestore` but did not provide `db` at the module surface. Vitest error: `No "db" export is defined on the "../../src/firebase/db.js" mock.`
- **Fix:** Extended the factory to expose `db: { __isMockDb: true }` directly. Also extended:
  - `addDoc` (Firestore auto-id; needed by funnel-comments.js)
  - Query-aware `getDocs` + `onSnapshot` — when ref carries `__constraints` from a query() composition with where("field", "==", val), filter the rows
  - `subscribeDoc` wrapper matching the firebase/db.js exported helper
- **Files modified:** tests/mocks/firebase.js
- **Verification:** All 19 new tests pass; existing tests/data/cloud-sync.test.js + tests/data/migration.test.js continue to pass (they use DI-injected dependencies and don't depend on the module-mock surface)
- **Committed in:** 1485236 (Task 1 GREEN)
- **Authorised by:** Phase 2 D-11 forward-compat note in the existing tests/mocks/firebase.js header — pre-authorised this extension.

**3. [Rule 1 - Bug] addFunnelComment test corrected: id is auto-generated, not caller-supplied**

- **Found during:** Task 1 GREEN — first test run
- **Issue:** Test asserted `cs.find(c => c.id === "c3")` after `addFunnelComment("o1", { id: "c3", body: "Q2 KPI shift" })` — but Firestore semantics for addDoc mint the id server-side; the caller-supplied id is overwritten. The mock honoured Firestore semantics correctly; the test expectation was wrong.
- **Fix:** Changed test to capture the returned `{ id }` and verify by body field instead. Documented Firestore auto-id semantics in the test name.
- **Files modified:** tests/data/funnel-comments.test.js
- **Verification:** All 5 funnel-comments tests pass
- **Committed in:** 1485236 (Task 1 GREEN — test fix landed atomically with the production module)

**4. [Rule 3 - Blocking] cloud/audit.js landed in Task 2 (not Task 3) — required by data/audit-events.js**

- **Found during:** Task 2 GREEN — running tests for tests/data/audit-events.test.js
- **Issue:** src/data/audit-events.js imports `writeAuditEvent` from `../cloud/audit.js`. Vite needs the module to exist at module-load time even though the test mocks it. Task 3 was the planned home for cloud/audit.js, but Task 2 needs it.
- **Fix:** Landed src/cloud/audit.js as part of Task 2 GREEN (with the same documented no-op stub pattern Task 3 will use for the other 4 cloud/* modules). Task 3 lands the remaining 4 cloud/* + 2 observability/* + the ESLint flip + the 7 forward-tracking rows.
- **Files modified:** src/cloud/audit.js
- **Verification:** Task 2 GREEN passes (23 tests / 8 files); Task 3 lands the remaining 6 stubs separately
- **Committed in:** 272e955 (Task 2 GREEN)
- **Note:** Pragmatic seam landing — the Pattern Map analog for cloud/audit.js (src/firebase/check.js no-op stub) is identical for all 5 cloud/* + 2 observability/* stubs, so spreading them across Task 2 + Task 3 doesn't change the shape of any commit.

---

**Total deviations:** 4 auto-fixed (1 Rule 1/3 plan-internal-inconsistency override; 1 Rule 3 mock-factory extension that the Phase 2 D-11 note pre-authorised; 1 Rule 1 test-fixture bug from Firestore auto-id semantics; 1 Rule 3 cross-task seam landing)
**Impact on plan:** All auto-fixes were necessary for correctness, blocking-issue resolution, or strict snapshot-baseline-preservation discipline. The Rule 1/3 deviation (#1) is the largest — it overrides a plan acceptance criterion that internally conflicts with the rest of the plan's design. No scope creep — every fix maps to a specified D-* decision (D-12 / D-15 / D-09 / Phase 2 D-11 forward-compat).

## Issues Encountered

- **Plan task-step 9 internal inconsistency** — see Deviation #1. The plan's literal "DELETE the IIFE-resident loadOrg/loadUsers/etc. + 1:1 rename" instruction conflicts with its own must_haves.truths + threat_model + D-12 + Phase 5 boundary. Resolved by following D-12 + must_haves.truths + threat_model + Phase 5 boundary; documented as the dominant Phase 4 deviation.
- **Vitest 4.x hoisting + `db` sentinel** — the production module imports `db` synchronously at module-load time. Using `await import(...)` (top-level await) for the production module under test (after vi.mock registration) was the cleanest fix.
- **Cross-task seam landing for cloud/audit.js** — see Deviation #4. Task 2's data/audit-events.js requires it; landed it in Task 2 GREEN.

## User Setup Required

None — no external service configuration required for this wave. The Vite build automatically bundles the new src/data/*, src/cloud/*, and src/observability/* modules into `dist/assets/main-*.js`. No new dependencies. CSP-RO unchanged; no new origins introduced.

## Next Phase Readiness

- **Wave 4 (04-04) ready:** `src/data/*` per-collection wrappers exist and are importable from views/*. The Wave 3 ESLint flip (data/* → only firebase/db.js + firebase/storage.js) is dormant-but-active. Wave 4's view extractions wire the actual call sites: each view replaces its IIFE-closure references to `loadOrg(id)` / `cloudPushOrg(o)` etc. with the imported `getOrg(id)` / `saveOrg(o)` async equivalents (the actual sync→async cutover Phase 4 task-step 9 alluded to). The forward-import aliases (`_getOrg`, `_getUser`, etc. — alongside Wave 2's `_notify`, `_validateUpload`, `_$$`) shed their underscore prefixes as Wave 4 wires consumers.
- **Wave 5 (04-05) ready:** `state.js` + `router.js` + `main.js` extract LAST per D-02 (after all 12 views). The data/* + cloud/* + observability/* substrate doesn't change shape; the IIFE-resident closure bindings shift to direct imports as state.js + router.js + main.js stand up.
- **Wave 6 (04-06) ready:** `vite.config.js` per-directory coverage thresholds extension (D-21) — `src/data/**` raises to 95% (was 90%); `src/cloud/**` + `src/observability/**` excluded; `src/firebase/**` excluded. This wave already aligns with those thresholds (cloud/+observability/ smoke tests exist for Pattern Map "test-file pairing" rule, not coverage).
- **Phase 5 (DATA-01..06) ready:** The 6 pass-through data/* wrappers (responses/comments/actions/documents/messages) have stable Promise CRUD APIs that views/* can rely on. Phase 5 replaces the bodies with subcollection access in lockstep — views/* never re-extract their consumption pattern. Cleanup-ledger forward-tracking rows close at Phase 5.
- **Phase 6 (AUTH-07) ready:** `src/cloud/claims-admin.js` exists with `setClaims` signature; Phase 6 fills with `httpsCallable("setClaims")`.
- **Phase 7 (FN-04 / FN-09 / AUDIT-01 / AUDIT-02) ready:** `src/cloud/audit.js` + `src/cloud/retry.js` + `src/observability/audit-events.js` exist with the right signatures; Phase 7 fills bodies. `src/data/audit-events.js` is wired through cloud/audit.js so views/*'s `recordAuditEvent` calls land at the real callable Phase 7 (no view re-extraction).
- **Phase 8 (LIFE-04 / GDPR-01/02) ready:** `src/cloud/soft-delete.js` + `src/cloud/gdpr.js` exist; Phase 8 fills bodies with httpsCallable wiring.
- **Phase 9 (OBS-01 / AUDIT-05) ready:** `src/observability/sentry.js` + `src/observability/audit-events.js` exist; Phase 9 fills bodies with @sentry/browser init + view-side emitAuditEvent calls.

## Self-Check: PASSED

Verified:
- All 38 created files exist (12 src/data/ + 5 src/cloud/ + 2 src/observability/ + 12 tests/data/ + 5 tests/cloud/ + 2 tests/observability/)
- All 5 commits present in git log: `22baed6`, `1485236`, `78f6c96`, `272e955`, `bfa216e`
- `grep -c "from.*\\.\\./firebase/db\\.js"` on the 6 full-owner data/* modules returns 6 (one each)
- `grep -c "subscribe"` on the 5 subscribe*-emitting full-owner data/* modules returns at least 5
- `grep -c 'from "./orgs.js"'` on the 5 pass-throughs delegating to orgs.js returns 5
- `grep -c 'from "../cloud/audit.js"'` on src/data/audit-events.js returns 1
- `grep -c "Object.isFrozen(AUDIT_EVENTS)"` on tests/observability/audit-events.test.js returns 1
- `grep -c 'files: \["src/data/\*\*/\*.js"\]'` on eslint.config.js returns 1 (Wave 3 entry added)
- `grep -c "data/\* must access SDK only through"` on eslint.config.js returns 1
- `grep -c "Phase 5 (DATA-01) replaces"` on runbooks/phase-4-cleanup-ledger.md returns 5
- `grep -c "Phase 7 (FN-04 / AUDIT-01)"` on runbooks/phase-4-cleanup-ledger.md returns 2 (cloud/audit.js + data/audit-events.js)
- `grep -cE "Phase 8 \(LIFE-04\)|Phase 8 \(GDPR-01/02\)"` returns 2
- `grep -c "Phase 9 (OBS-01)"` returns 1
- `grep -c "Wave 3 data/"` on runbooks/phase-4-cleanup-ledger.md returns 1 (out-of-band soft-fail checkbox)
- `git diff --stat tests/__snapshots__/views/` is empty (snapshot baselines unchanged)
- 334 / 334 tests pass; typecheck clean; lint clean; build clean (firebase chunk: 382.87 kB; main chunk: 93.98 kB gzip 27.99 kB)
- Wave 3 ESLint rule firing verified by temporary breach + revert
- ARCHITECTURE.md §2 directory tree fully landed (src/{firebase, data, domain, auth, cloud, observability, ui, util} all populated)

---
*Phase: 04-modular-split-quick-wins*
*Plan: 03*
*Completed: 2026-05-07*
