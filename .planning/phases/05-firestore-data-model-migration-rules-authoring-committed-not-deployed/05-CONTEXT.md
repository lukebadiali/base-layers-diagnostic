# Phase 5: Firestore Data Model Migration + Rules Authoring (Committed, Not Deployed) - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate production Firestore data from the monolithic `orgs/{id}` document shape to the subcollection-based shape defined in `.planning/research/ARCHITECTURE.md` §4 (`orgs/{orgId}/{responses,comments,actions,documents,messages,readStates}/{itemId}`); fold the H7 fix in by relocating last-read markers into `orgs/{orgId}/readStates/{userId}` so all unread comparators are server-clock-vs-server-clock; rewrite `src/data/cloud-sync.js` to close H8 (last-writer-wins parent-doc overwrite eliminated by per-subcollection writes); rewrite the 6 pass-through wrappers in `src/data/*` from Phase 4 D-09 (`responses`, `comments`, `actions`, `documents`, `messages`) so their bodies hit subcollections — the API surface stays stable per Phase 4's contract; ship a new `src/data/read-states.js` wrapper following the same Promise CRUD + `subscribe*` shape (Phase 4 D-10); author `firestore.rules` + `storage.rules` with helper-rich predicate library and strict mutation whitelisting; ship a table-driven `@firebase/rules-unit-testing` v5 suite covering every role × collection × op cell + the explicit tenant-jump test (RULES-04); execute the production migration during Phase 5 with per-doc idempotency markers + a manual `gcloud firestore export` taken immediately before as the rollback substrate; rules + storage rules are **committed but NOT deployed to production** — deploy gate is held for Phase 6 in lockstep with the Auth + claims cutover.

**Explicitly NOT in this phase** (owned elsewhere):

- Production deploy of `firestore.rules` + `storage.rules` → Phase 6 (RULES-07) in lockstep with Auth + claims cutover
- Firebase Auth migration (Email/Password + claims + MFA + Anonymous Auth disable) → Phase 6 (AUTH-01..15)
- `users/{firebaseUid}` re-keying + legacy `appUserId → firebaseUid` backfill → Phase 6 (AUTH-15 bootstrap + uses the inline legacy fields preserved in Phase 5)
- `auditLog/`, `softDeleted/`, `rateLimits/` Cloud Function writers → Phase 7 (FN-01..09); Phase 5 ships the rules-side `allow read, write: if false` deny-blocks only
- Rate-limit `request.time` predicate against `rateLimits/{uid}/buckets/{windowStart}` → Phase 7 (FN-09); Phase 5 ships `allow write: if false` only
- App Check enforcement → Phase 7 (FN-07/08); Phase 4's `firebase/check.js` no-op stub stays in place
- Soft-delete restore + GDPR export/erase + backup automation → Phase 8
- Sentry + audit-event wiring → Phase 9
- CSP enforcement (drop `'unsafe-inline'`) → Phase 10

</domain>

<decisions>
## Implementation Decisions

### Migration Execution Model

- **D-01:** **One-shot Node script using firebase-admin SDK, run locally.** Lives at `scripts/migrate-subcollections/run.js` (path subject to planner refinement). Not a Cloud Function — single human-supervised invocation, no scheduling, no callable surface, no App Check requirement, no Cloud Function quota concerns. Admin SDK bypasses Firestore Rules so the script can run before/after rules are tightened without rules-side accommodation. Audit-narrative line: "Migration is a one-shot Admin-SDK script run by an internal operator with the production database export taken immediately before the run."
- **D-02:** **Per-doc idempotency markers under `migrations/{stepId}/items/{docId}`.** Every migration step writes a marker doc before processing each source doc; re-runs check the marker first and skip already-completed work. `{stepId}` is per-collection (one stepId per nested-map → subcollection migration: `responses`, `comments`, `actions`, `documents`, `messages`, plus `readStates-init` for the new collection). Granularity is per-source-document, not per-batch — a partial run leaves a coherent partial state and the next run resumes exactly where the previous one stopped. Closes Pitfall 10 ("ID migration without idempotency — re-run = duplicate or destroy").
- **D-03:** **Inline legacy fields on every doc that references a user — `legacyAppUserId`, `legacyAuthorId` (whichever applied), preserved alongside the new shape.** Every migrated doc carries the original app-internal `userId`/`authorId` value verbatim so Phase 6's bootstrap migration (AUTH-15) can backfill the `legacyAppUserId → firebaseUid` mapping in-place rather than via a sidecar collection. Closes Pitfall 5 ("Anonymous-auth UID vs app-internal userId mapping during auth migration"). Phase 6 deletes these fields once the backfill completes (cleanup-ledger row queued for Phase 6).
- **D-04:** **Manual `gcloud firestore export` taken immediately before the production migration runs — the safety net.** Operator runs `gcloud firestore export gs://bedeveloped-base-layers-backups/pre-phase5-migration/{ISO-timestamp}/` before invoking the migration script. Rollback procedure: `gcloud firestore import` of that export. The export is the cutover-rollback substrate; per-doc idempotency markers (D-02) handle partial-run recovery. Pre-empts Phase 8 BACKUP-01's automated daily export — Phase 8 documents the cadence; Phase 5 uses a one-off manual export bound to this specific cutover. Closes Pitfall 10's "never re-key without a backup" requirement.

### Staging Clone Strategy

- **D-05:** **No separate staging Firebase project; no multi-database clone.** Migration runs directly against production Firestore. The pre-migration `gcloud firestore export` (D-04) plus the per-doc idempotency markers (D-02) are the rollback + partial-run-recovery substrate. Justification: (a) project is between client engagements with no live writes, (b) migration is a one-shot script not a long-lived service, (c) `@firebase/rules-unit-testing` runs against the local emulator without needing a real staging project, (d) operational cost of a permanent staging project (duplicate IAM, OIDC pool, App Check site keys, billing) does not buy meaningful additional safety beyond what the export gives. Deviates from `.planning/research/PITFALLS.md` Pitfall 1's "use a staging Firebase project" recommendation — explicit deviation with the audit-narrative line: "Migration is idempotent (per-doc markers) and bracketed by a manual `gcloud firestore export` taken immediately before the run; rollback is `gcloud firestore import` of that export. Rules unit-tested against the local emulator before the script runs."
- **D-06:** **Migration script supports a `--dry-run` flag.** Iteration loop during development: invoke with `--dry-run`, script walks every source doc, computes the target shape, logs `would write <target-path>` with payload sizes — no side effects, no marker writes, no Firestore writes. Production cutover invocation drops `--dry-run`. The dry-run output is the inspection log auditors can read post-cutover. Implementation note: `--dry-run` short-circuits at the write site, not at the read site — read paths execute fully so the dry-run also exercises the per-doc shape transformation.
- **D-07:** **Rules + storage rules are emulator-tested only during Phase 5; never deployed to staging or production in this phase.** Honours RULES-06 ("committed and unit-tested in Phase 5 but deployed to production only in Phase 6") and the milestone's Sequencing Non-Negotiable #2. CI runs the rules-unit-test suite against `firestore-emulator` + `storage-emulator` on every PR. No `firebase deploy --only firestore:rules` in any Phase 5 wave. Phase 6 owns the production deploy in lockstep with the Auth + claims cutover.

### Wave Shape & Sequencing

- **D-08:** **6-wave shape, rules-first.** Wave 1: `firestore.rules` + `storage.rules` authored + predicate library (D-13) + first slice of the table-driven rules-unit-test matrix (D-15) — the foundation everything else tests against. Wave 2: migration script body + `--dry-run` flag (D-06) + per-doc idempotency markers (D-02) + pre/post doc-count + field-presence assertion harness (DATA-06). Wave 3: `src/data/*` body rewrites — the 6 Phase 4 D-09 pass-throughs (`responses`, `comments`, `actions`, `documents`, `messages`) swap to subcollection access; new `src/data/read-states.js` wrapper ships (D-12). Wave 4: H7 fix (server-clock `readStates`, DATA-07) + H8 fix (`src/data/cloud-sync.js` rewrite — the Phase 2 TEST-06 baseline breaks here by design, replaced by per-subcollection listeners). Wave 5: pre-cutover runbook (`runbooks/phase5-subcollection-migration.md`) + dry-run rehearsal log + production migration execution (the actual one-shot run — manual export → script invocation → verification harness → commit-the-run). Wave 6: cleanup ledger zero-out + SECURITY.md DOC-10 increment for Phase 5 + RULES-06 "committed-not-deployed" verification gate (assert `firebase.json` is unchanged on the rules-deploy axis; assert no `firebase deploy --only firestore:rules` ran in this phase). Mirrors Phase 4's 6-wave shape; one coherent boundary per wave; matches Phase 1 D-25 atomic-commit pattern.
- **D-09:** **Phase 5 runs the production migration; Phase 6 only deploys rules + Auth.** The subcollection migration is a data-shape change with no access-semantics implications — the existing Anonymous Auth + transitional rules + `data/*` wrappers continue to work after the migration runs (the wrappers are rewritten in Wave 3 to read/write subcollections, the rules deploy is held). Audit-narrative: "data model migrated independently of trust-boundary cutover." Phase 6's load-bearing Auth + rules-deploy + claims wiring is not bundled with this data migration — mitigates Pitfall 20's "bundled cutover" failure mode.
- **D-10:** **Strict tests-first inside each wave.** Wave 1 ships the rules-unit-test cells BEFORE the rules they cover (red-then-green; matrix grows wave-by-wave as more collections are added). Wave 2 ships the pre/post assertion harness BEFORE the migration script body. Wave 3 ships per-wrapper integration tests against the emulator BEFORE each `data/*` body rewrite (existing Phase 2 unit tests for the wrapper API surface stay green throughout — they're the contract from views/*). Wave 4 ships H7 + H8 unit tests BEFORE the cloud-sync + readStates rewrite — Phase 2's TEST-05 (H7 baseline) and TEST-06 (H8 baseline) are the regression baselines; the Wave 4 fix breaks TEST-06 by design and lands new green tests in the same commit. Mirrors Phase 2 D-15 + Phase 4 "snapshot baseline as the contract."

### data/* Body Rewrites + cloud-sync Fate

- **D-11:** **6 Phase 4 D-09 pass-through wrappers swap to subcollection access; API surface stays stable.** `src/data/responses.js`, `src/data/comments.js`, `src/data/actions.js`, `src/data/documents.js`, `src/data/messages.js`, plus existing `src/data/read-states.js` (added Wave 3) — each one's exported Promise CRUD + `subscribe*` API matches Phase 4 D-10 verbatim; only the internal implementation changes from "read/write `orgs/{orgId}.{collection}[…]` nested-map via `data/orgs.js`" to "read/write `orgs/{orgId}/{collection}/{itemId}` subcollection via `firebase/db.js`'s collection helpers." Cleanup-ledger rows from Phase 4 ("Phase 5 replaces body with subcollection access; data/*.js API stable") close as each wrapper lands. `views/*` is untouched in Phase 5 — the API contract held.
- **D-12:** **`src/data/read-states.js` is a new wrapper, follows the same shape as other data/*.** Exports `getReadState(orgId, userId): Promise<ReadState>`, `setPillarRead(orgId, userId, pillarId): Promise<void>`, `setChatRead(orgId, userId): Promise<void>`, `subscribeReadState(orgId, userId, { onChange, onError }): () => void`. Backed by `orgs/{orgId}/readStates/{userId}` with `{ pillarReads: { pillarId: serverTimestamp }, chatLastRead: serverTimestamp }` shape per ARCHITECTURE.md §4. All writes use `serverTimestamp()` — no client-clock values cross the data tier. The H7 fix (DATA-07) is the unread-comparator rewrite in `src/domain/unread.js` to read these server-time markers instead of the localStorage/client-time values.
- **D-13:** **`src/data/cloud-sync.js` is rewritten in Wave 4, not deleted.** Current body does last-writer-wins parent-doc overwrite (Phase 2 TEST-06 baseline) — H8. Rewritten body: removes the parent-doc sync entirely; each `data/*` wrapper registers its own `onSnapshot` listener for its subcollection; cloud-sync.js retains a thin "init org-metadata listener + dispatcher" role that just hydrates the small `orgs/{orgId}` parent doc (name, currentRoundId, etc.) and signals downstream wrappers to attach their per-subcollection listeners. Phase 2 TEST-06 breaks by design in the same Wave 4 commit; new TEST-06-style assertions cover the new dispatcher contract. Cleanup-ledger row "Phase 5 (H8 fix) rewrites cloud-sync.js" closes here.

### Rules Architecture + Test Fixture Pattern

- **D-14:** **Helper-rich predicate library at the top of `firestore.rules`.** Defines:
  - `function isAuthed() { return request.auth != null && request.auth.token.email_verified == true && request.auth.token.firebase.sign_in_provider != "anonymous"; }` — closes Pitfall 2's "anonymous-token holder satisfies request.auth != null trivially"
  - `function role() { return request.auth.token.role; }`
  - `function orgId() { return request.auth.token.orgId; }`
  - `function isInternal() { return isAuthed() && role() in ["internal", "admin"]; }`
  - `function isAdmin() { return isAuthed() && role() == "admin"; }`
  - `function inOrg(o) { return isAuthed() && (isInternal() || orgId() == o); }`
  - `function notDeleted(r) { return !("deletedAt" in r) || r.deletedAt == null; }`
  - `function isOwnAuthor(r) { return r.authorId == request.auth.uid; }`
  - `function immutable(field) { return request.resource.data[field] == resource.data[field]; }`
  - `function mutableOnly(fields) { return request.resource.data.diff(resource.data).affectedKeys().hasOnly(fields); }`
  Storage rules get a parallel mini-library: `isAuthed()`, `inOrg(o)`, `validSize()` (≤25 MB per CODE-09), `validMime()` (allowlist matching `ui/upload.js`'s set per Phase 4 D-16). Each match block reads as English. Audit-narrative: "Rules read top-to-bottom: authorisation predicates declared once, applied uniformly."
- **D-15:** **Strict mutation whitelist on every `allow update` path via `mutableOnly([...])` plus identity-field immutability via `immutable("orgId")`, `immutable("createdAt")`, `immutable("authorId")` (where applicable).** Every update rule names exactly which fields the role can change — attempting to change a non-whitelisted field denies. Closes Pitfall 3 ("`resource.data` vs `request.resource.data` confusion"). Tenant-jump (RULES-04) is a one-line test: a client with `orgId == A` attempting to write any doc under `orgs/B/*` is denied by `inOrg(orgId)`. Field-injection is blocked by `mutableOnly`. Maintenance trade-off (every new field requires a rules edit) is acceptable — the per-feature audit narrative is worth the friction.
- **D-16:** **Table-driven role × collection × op test matrix at `tests/rules/firestore.test.js` + parallel `tests/rules/storage.test.js`.** Roles: `anonymous`, `client_orgA`, `client_orgB`, `internal`, `admin`. Collections (Firestore): `orgs/{orgId}` parent doc, `orgs/{orgId}/responses/{respId}`, `orgs/{orgId}/comments/{cmtId}`, `orgs/{orgId}/actions/{actId}`, `orgs/{orgId}/documents/{docId}`, `orgs/{orgId}/messages/{msgId}`, `orgs/{orgId}/readStates/{userId}`, `users/{uid}`, `internalAllowlist/{email}`, `auditLog/{eventId}`, `softDeleted/{type}/items/{id}`, `rateLimits/{uid}/buckets/{windowStart}`, `roadmaps/{orgId}`, `funnels/{orgId}`, `funnelComments/{id}`. Ops: `read`, `create`, `update`, `delete`. Expected: `allow` or `deny` per cell. Vitest iterates the matrix; `RulesTestEnvironment` from `@firebase/rules-unit-testing` v5 seeds fixtures via `withSecurityRulesDisabled`. Custom claims are set on the test user via the framework's `authenticatedContext({ uid, ...claims })`. Tenant-jump (RULES-04) is one matrix row: `(client_orgA, orgs/orgB/*, write, deny)`. New collections add rows; the matrix is the truth-table. Storage matrix: roles × paths (`orgs/{orgId}/documents/{docId}/{filename}` and others) × `read`/`write` with size + MIME mock objects. **Hybrid extension:** dedicated test files for cross-cutting invariants — `tests/rules/tenant-jump.test.js` (every collection enumerated under a tenant-jump scenario), `tests/rules/soft-delete-predicate.test.js` (every collection's `notDeleted()` predicate behaviour), `tests/rules/server-only-deny-all.test.js` (every server-only collection asserts `deny` for every client role on every op).
- **D-17:** **Phase 5 rules scope: subcollections + RULES-03 server-only deny-blocks; rate-limit ships `allow read, write: if false`; Phase 7 adds the `request.time` predicate.** Phase 5 covers:
  - `orgs/{orgId}` parent doc
  - 6 subcollections under `orgs/{orgId}/*`
  - `users/{uid}`
  - `internalAllowlist/{email}` — admin-only read + write
  - `auditLog/{eventId}` — `allow read: if isAdmin(); allow write: if false;` (Pitfall 17 — audited user cannot read or delete own records; rules-test pins this)
  - `softDeleted/{type}/items/{id}` — `allow read: if isAdmin(); allow write: if false;`
  - `rateLimits/{uid}/buckets/{windowStart}` — `allow read, write: if false;` (Phase 7 FN-09 replaces the body with the `request.time` predicate without changing surrounding structure)
  - `roadmaps/{orgId}`, `funnels/{orgId}`, `funnelComments/{id}` — keep current top-level shape per ARCHITECTURE.md §4 table
  - `storage.rules`: `match /orgs/{orgId}/documents/{docId}/{filename}` with size + MIME + path-scope checks (RULES-05; closes H6 server-side; matches `ui/upload.js` allowlist per Phase 4 D-16)
  Phase 5's `firestore.rules` file is feature-complete except for the rate-limit predicate body — RULES-06's "committed and unit-tested" contract holds for everything in scope.

### Cross-Cutting (carry-forward + derived)

- **D-18:** **DATA-07 (H7 fix) folds into D-12.** Server-clock `readStates` markers replace localStorage last-read state. `src/domain/unread.js` is rewritten in Wave 4 to read `orgs/{orgId}/readStates/{userId}.pillarReads[pillarId]` and `.chatLastRead` server-timestamps and compare against per-comment / per-message `serverTimestamp()` write times. The "5-minute client-clock skew test does not change unread counts" success criterion (ROADMAP Phase 5 SC #4) is a Wave 4 test target.
- **D-19:** **TEST-08 (rules-unit-test suite) is the Wave 1 + Wave 6 deliverable.** Wave 1 ships the matrix scaffolding + the rules predicate library + rules for the first collections covered (`orgs/{orgId}` parent + 1-2 subcollections to validate the matrix shape). Each subsequent wave that touches a new collection adds the corresponding rules + matrix rows. Wave 6 verifies the matrix has 100% role × collection × op coverage for every collection in scope.
- **D-20:** **DOC-10 (incremental SECURITY.md update) is the Wave 6 deliverable.** Adds `§Firestore Data Model` (subcollection layout + migration narrative + idempotency-marker explanation), `§Firestore Security Rules — Authored, Not Yet Deployed` (predicate library + scope + RULES-06 commit-not-deploy framing + table-driven test approach), `§Storage Rules` (size/MIME/path-scope summary + ui/upload.js allowlist single-source-of-truth), `§Phase 5 Audit Index` (framework citation table per Phase 3 D-15 / Phase 4 D-25 pattern). Commit-SHA backfill at phase close per Phase 3 precedent.
- **D-21:** **Cleanup-ledger row closures.** Phase 4 queued 6 rows ("Phase 5 (DATA-01) replaces body with subcollection access; data/*.js API stable" × 5 + "Phase 5 (H8 fix) rewrites cloud-sync.js"). All 6 close in Phase 5. New rows queued: "Phase 6 (AUTH-15) deletes inline `legacyAppUserId`/`legacyAuthorId` fields after backfill," "Phase 7 (FN-09) replaces `rateLimits/` deny-block with `request.time` predicate," "Phase 7 (FN-01..09) adds Cloud Function writers for `auditLog/`, `softDeleted/`," "Phase 6 (RULES-07) deploys `firestore.rules` + `storage.rules` to production."

### Claude's Discretion

- **Migration script repo path** (`scripts/migrate-subcollections/run.js` vs `scripts/migrations/{stepId}/run.js` vs `tools/migrate.js`) — planner picks the convention that matches existing repo conventions; the per-doc marker collection path (`migrations/{stepId}/items/{docId}`) is locked.
- **Per-collection migration step ordering within Wave 5** — Pitfall 10 step ordering applies (deepest leaves first); planner sequences within Wave 5 (likely: `responses` → `comments` → `actions` → `documents` → `messages` → `readStates`-init).
- **Rules predicate naming subtleties** (`isMember(o)` vs `inOrg(o)` vs `inTenant(o)`) — D-14's recommended names stand unless lint/audit narrative dictates otherwise.
- **Test matrix runner format** — vitest `describe.each([...rows])` vs custom matrix iterator; planner picks based on debuggability.
- **Storage rules MIME allowlist constant location** — mirror `ui/upload.js`'s exported constant or hardcode the same set in `storage.rules` (rules can't `import`); both are valid — planner picks; cleanup-ledger row queued either way to flag drift if `ui/upload.js`'s allowlist ever changes.

### Folded Todos

- **Bootstrap-migration data integrity unknown until staging dry-run** (from `.planning/STATE.md` "Outstanding Todos / Open Questions for Future Phases") — reframed by D-05's "no staging" decision. The `--dry-run` flag (D-06) plus the pre/post assertion harness (DATA-06) are the new substrate for this concern. The "staging dry-run procedure" originally expected to be a Phase 5 deliverable becomes a "production dry-run procedure" deliverable: the runbook (Wave 5) documents how to invoke the script with `--dry-run` against production, what the expected output looks like, and the go/no-go gate before invoking the real migration.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project + milestone context

- `.planning/PROJECT.md` — Locked decisions (Firebase, vanilla JS, no backwards-compat, credible-not-certified compliance bar)
- `.planning/ROADMAP.md` §"Granularity Rationale" #2 + #3 — Rules committed early but deployed only after Auth; subcollection migration before rules deployment
- `.planning/ROADMAP.md` §"Phase 5" — Goal + dependency + 6 success criteria
- `.planning/REQUIREMENTS.md` — DATA-01..07, RULES-01..06, TEST-08, DOC-10 row in Traceability table (RULES-07 explicitly Phase 6)
- `.planning/STATE.md` §"Sequencing Non-Negotiables" — four load-bearing constraints
- `CLAUDE.md` — Source layout target + sequencing non-negotiables + conventions

### Architecture (load-bearing)

- `.planning/research/ARCHITECTURE.md` §4 (Firestore data model) — Target subcollection layout + per-resource subcollection-vs-top-level decision table + draft rules sketch + backup/export interaction
- `.planning/research/ARCHITECTURE.md` §2 (Module boundaries) — `firebase/` adapter shape Phase 5 reads through; `data/*` wrapper API surface contract
- `.planning/research/ARCHITECTURE.md` §8 dep-note 1 — Subcollection migration before Rules deployment

### Pitfalls (load-bearing)

- `.planning/research/PITFALLS.md` §Pitfall 1 (locking yourself out on first rules deploy) — D-07's "emulator-only test substrate" + RULES-06's "committed not deployed" both pre-empt this; explicitly deviates from "use a staging Firebase project" recommendation per D-05's audit-narrative line
- `.planning/research/PITFALLS.md` §Pitfall 2 (`request.auth != null` is not access control) — D-14's `isAuthed()` predicate combines `email_verified` + `sign_in_provider != "anonymous"` + presence
- `.planning/research/PITFALLS.md` §Pitfall 3 (`resource.data` vs `request.resource.data`) — D-15's strict mutation whitelist via `mutableOnly([...])` + identity-field `immutable(field)`
- `.planning/research/PITFALLS.md` §Pitfall 4 (rule traps — billing, depth, emulator drift) — D-14's claims-only predicates avoid `get()` lookups; cleanup-ledger row queued to nightly-test rules against a real Firebase project once Phase 6 deploys (out of scope for Phase 5)
- `.planning/research/PITFALLS.md` §Pitfall 5 (anonymous UID vs app-internal userId) — D-03's inline legacy fields are the substrate Phase 6 backfills against
- `.planning/research/PITFALLS.md` §Pitfall 10 (ID migration without idempotency) — D-02's per-doc markers + D-04's pre-migration export close this; D-06's `--dry-run` adds the pre-flight inspection log
- `.planning/research/PITFALLS.md` §Pitfall 17 (audit log written from client) — D-17's `auditLog/{eventId}` rules `allow write: if false` for clients; rules-test pins the audited-user-cannot-read-own constraint
- `.planning/research/PITFALLS.md` §Pitfall 20 (H7 + H8 entanglement) — D-08's Wave 4 + D-12 + D-13 split H7 (server-clock `readStates`) from H8 (cloud-sync rewrite); both fix in Phase 5 but in separate atomic commits within Wave 4; D-09 keeps the data migration out of Phase 6's bundled cutover

### Codebase context

- `.planning/codebase/CONCERNS.md` §H7 (clock skew on unread tracking) — closed by D-12 + D-18 in Wave 4
- `.planning/codebase/CONCERNS.md` §H8 (last-writer-wins cloud sync) — closed by D-13 in Wave 4
- `.planning/codebase/CONCERNS.md` §C3 (no Firestore Rules) — partially closed by Phase 5 (committed); fully closed by Phase 6 (deployed via RULES-07)
- `.planning/codebase/CONCERNS.md` §H6 (file upload validation) — storage.rules path scope + size + MIME closes server-side; client-side already closed by Phase 4 CODE-09 + D-15/D-16

### Phase 4 carry-forward (Phase 5 builds on this)

- `.planning/phases/04-modular-split-quick-wins/04-CONTEXT.md` D-09 — 6 pass-through wrappers' API surface contract (Phase 5 D-11 honours verbatim)
- `.planning/phases/04-modular-split-quick-wins/04-CONTEXT.md` D-10 — Promise CRUD + `subscribe*` wrapper API shape (Phase 5 D-12's `read-states.js` follows)
- `.planning/phases/04-modular-split-quick-wins/04-CONTEXT.md` D-12 — Faithful extraction (Phase 5 ends faithful-extraction discipline; this IS the rewrite phase)
- `.planning/phases/04-modular-split-quick-wins/04-CONTEXT.md` D-15 + D-16 — `ui/upload.js` allowlist single-source-of-truth (Phase 5 D-14's storage.rules MIME predicate references this)

### Phase 2 carry-forward (regression baselines that Phase 5 breaks by design)

- `.planning/phases/02-test-suite-foundation/02-CONTEXT.md` D-08 — Snapshot baseline contract; Phase 5 keeps views/* snapshot stable (data/* API surface unchanged per D-11)
- `tests/data/cloud-sync.test.js` (Phase 2 TEST-06) — H8 baseline; Phase 5 D-13 breaks this by design + replaces with new tests in same Wave 4 commit
- `tests/domain/unread.test.js` (Phase 2 TEST-05) — H7 baseline; Phase 5 D-18 rewrites the comparator; tests rewritten in same Wave 4 commit

### Stack reference

- `.planning/research/STACK.md` — `@firebase/rules-unit-testing@5.x` + `firebase-admin@13.x` + `firebase-tools` (emulator) exact pins
- `firebase-tools` Firestore + Storage emulator docs (CI usage pattern)
- `@firebase/rules-unit-testing` v5 API — `RulesTestEnvironment.withSecurityRulesDisabled` + `authenticatedContext({ uid, ...claims })`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/firebase/db.js`** (Phase 4 Wave 1) — Sole Firestore SDK import surface. `data/*` body rewrites in Wave 3 use its `collection`, `doc`, `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `query`, `where`, `onSnapshot`, `serverTimestamp` exports. No new firebase/db.js work needed in Phase 5 — the substrate is complete.
- **`src/data/orgs.js`** (Phase 4 Wave 3) — Stable wrapper; the 6 pass-throughs currently delegate to it for the nested-map reads/writes. Phase 5 Wave 3 unwires those delegations — each pass-through gets its own subcollection logic; `data/orgs.js` stays in place but its responsibility shrinks to the parent doc only.
- **`src/data/cloud-sync.js`** (Phase 2 D-04 + Phase 4 Wave 3 faithful extraction) — Current body is the H8-baseline parent-doc syncer. Phase 5 Wave 4 rewrites the body; existing tests at `tests/data/cloud-sync.test.js` are the regression baseline that Phase 5 deliberately breaks + replaces.
- **`src/domain/unread.js`** (Phase 2 D-04) — Pure domain function. Phase 5 Wave 4 rewrites the comparator to read server-time `readStates`. Existing tests at `tests/domain/unread.test.js` are the H7 baseline + need a 5-minute clock-skew test added (Phase 5 SC #4).
- **`src/ui/upload.js`** (Phase 4 D-15/D-16) — Exports the canonical MIME allowlist + `validateUpload`. `storage.rules` MIME predicate references the same allowlist (D-14 storage rules); cleanup-ledger row tracks drift if it ever changes.
- **`tests/mocks/firebase.js`** (Phase 2 D-11) — Reusable factory; Phase 4 Wave 3 already re-targeted to `firebase/db.js`. Phase 5 reuses for `data/*` body rewrite tests; rules-unit-test suite uses `@firebase/rules-unit-testing` directly (different substrate).
- **`firebase.json`** (Phase 3 Wave 2) — Already declares hosting headers + CSP-RO; Phase 5 adds the `firestore` + `storage` `rules` paths declarations (committed but the production deploy is held until Phase 6's deploy-job runs).
- **`functions/`** workspace (Phase 3 Wave 2) — Already exists with `cspReportSink`. Phase 5 doesn't touch `functions/` — the migration runs as a Node script, not a Cloud Function. Phase 7 is when `functions/` grows.

### Established Patterns

- **Per-feature submodule pattern** in `firebase/` (Phase 4 D-05) — Phase 5 follows; no new firebase/ files.
- **Promise CRUD + `subscribe*` wrapper API** (Phase 4 D-10) — `data/read-states.js` follows verbatim.
- **Atomic-commit-per-coherent-boundary pattern** (Phase 1 D-25) — Each Phase 5 wave's commits close one coherent boundary (one collection's rules, one wrapper's body rewrite, one fix).
- **Snapshot baseline as the rendered-DOM contract** (Phase 2 D-08) — `views/*` is untouched in Phase 5; snapshot diff at zero is a phase-close gate.
- **Per-directory coverage thresholds** (Phase 4 D-21) — `data/**` at 95%, `domain/**` at 100% — Phase 5 maintains; new `data/read-states.js` lands at 95%; rewritten `data/cloud-sync.js` + `domain/unread.js` lands at threshold.
- **ESLint domain/* boundary** (Phase 4 ESLint Wave 4) — `domain/*` files import nothing Firebase. `domain/unread.js`'s rewrite reads server-time markers via injected accessor (the `data/read-states.js` wrapper passes the server-time value in); `domain/unread.js` itself stays Firebase-free.
- **Cleanup-ledger zero-out gate at phase close** (Phase 4 D-17 / Wave 6) — Phase 5 closes 6 carryover rows + queues 4 new rows for Phase 6/7.

### Integration Points

- **`firestore.rules` + `storage.rules`** — New files at repo root (firebase-tools convention). Wave 1.
- **`firebase.json`** — Add `firestore.rules` + `firestore.indexes.json` (likely empty initially) + `storage.rules` declarations. Phase 3 already declares `hosting`, `functions`. Wave 1.
- **`vitest.config.js`** — Add `tests/rules/**` test glob; CI command is unchanged. Wave 1.
- **`package.json`** — Add `@firebase/rules-unit-testing` v5 + `firebase-tools` (already a devDep) + a script like `npm run test:rules` that boots the emulators. Wave 1.
- **`.github/workflows/ci.yml`** — Add a `test:rules` step (or fold into the existing `test` step) that boots the Firestore + Storage emulators before running rules tests. Wave 1.
- **`scripts/migrate-subcollections/`** — New directory housing the migration script + dry-run output schema. Wave 2.
- **`runbooks/phase5-subcollection-migration.md`** — New runbook covering the production cutover sequence (export → dry-run → real run → verification). Wave 5.
- **`SECURITY.md`** — 4 new sections + Phase 5 audit index. Wave 6.

### Creative Options Enabled by Existing Architecture

- **Helper-rich predicate library at top of `firestore.rules`** is enabled because Firestore rules support function definitions; the language itself permits this composition pattern.
- **Table-driven rules-unit-test matrix** is enabled by Vitest's `describe.each` / `it.each` + `RulesTestEnvironment`'s ability to construct `authenticatedContext` with arbitrary claims.
- **`--dry-run` flag with no Firestore writes** is enabled because firebase-admin allows write-path interception via a flag-checked branch — no special infrastructure required.
- **Storage rules referencing the same MIME allowlist as `ui/upload.js`** is constrained by the rules language not supporting `import` — the allowlist is duplicated; cleanup-ledger row tracks drift.

</code_context>

<specifics>
## Specific Ideas

- **The "we run on prod" decision (D-05) is operator-level confidence, not a generic recommendation.** It works for THIS project because (a) no live users, (b) idempotent migration, (c) pre-migration export as rollback, (d) emulator covers rules tests. It would NOT work for a project with live users or a non-idempotent migration. The audit-narrative line in `SECURITY.md` (Wave 6) MUST capture this rationale explicitly so a future reviewer doesn't conclude "they skipped the staging step."
- **Rules read top-to-bottom as English** is the audit-narrative aesthetic. A reviewer should be able to glance at `firestore.rules` and trace each `allow` predicate back to a named helper at the top of the file. No nested ternaries, no inline `request.auth != null && resource.data.x == request.auth.token.y && ...` chains in match blocks. The helper-rich pattern (D-14) is the substrate.
- **The `--dry-run` flag is the audit-friendly substitute for staging.** Operators run `--dry-run` immediately before the real run; the dry-run output (logged to a file) is committed alongside the migration runbook as evidence the dry-run was performed. This is cheaper than a staging project and produces a stronger audit artefact (a literal log of "what we were about to do" vs "we ran it on staging and it worked").
- **The H7 + H8 fixes split into separate Wave 4 commits.** Pitfall 20 explicitly calls out the bundled-fix risk. Wave 4's terminal commit pair is: commit A "H7 fix: server-clock readStates" (rewrites `domain/unread.js` + adds `data/read-states.js` consumers); commit B "H8 fix: per-subcollection listeners replace parent-doc sync" (rewrites `data/cloud-sync.js` + the wrapper subscribe* implementations). Both land in Wave 4 but as discrete reviewable commits with discrete tests.

</specifics>

<deferred>
## Deferred Ideas

- **Nightly rules tests against a real Firebase project** (Pitfall 4 prevention — emulator/prod drift) — not feasible in Phase 5 because rules aren't deployed anywhere. Cleanup-ledger row queued for Phase 6 ("once rules deploy to prod, schedule a nightly CI job that runs the rules-unit-test suite against the real Firestore project, comparing emulator results to production-rules-engine results").
- **Sidecar `legacyIdMap/{appUserId}` collection** — considered as an alternative to D-03's inline legacy fields; rejected because the inline approach is simpler and Phase 6's backfill is a single-pass walk vs a join. If Phase 6 implementation discovers a reason to prefer the sidecar (e.g., legacy IDs collide across collections), revisit then.
- **Pre-deploying rules to a separate Firebase project for nightly integration testing** — considered as a "rules deployed to staging only" pattern; rejected for Phase 5 because the staging project itself was rejected (D-05). Cleanup-ledger row queued for Phase 6.
- **Migrating `funnelComments` to subcollection of `orgs/{orgId}/*`** — ARCHITECTURE.md §4 explicitly leaves it as a top-level collection with `orgId` field "for now"; a later sweep can move it. Out of scope for Phase 5; cleanup-ledger row queued for a future v2 milestone (no specific phase allocated yet).
- **Pre-emptively writing the rate-limit `request.time` predicate in Phase 5** — considered; rejected because the writers (`auditWrite`, `setClaims`, etc.) don't exist until Phase 7. Predicate without writers is dead code; tests for it would be speculative. Phase 7 FN-09 owns this.
- **Reviewed Todos (not folded)** — none new beyond what's already routed in `.planning/STATE.md` "Outstanding Todos / Open Questions for Future Phases" (Firestore region verification → Phase 6/11; Sentry free-tier → Phase 9; reCAPTCHA quota → Phase 7; bootstrap migration data integrity → reframed by D-05's no-staging decision; MFA recovery feasibility → Phase 6; AUDIT translation → Phase 12).

</deferred>

---

*Phase: 05-firestore-data-model-migration-rules-authoring-committed-not-deployed*
*Context gathered: 2026-05-08*
