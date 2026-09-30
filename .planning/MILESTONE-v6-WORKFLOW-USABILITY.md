# Milestone v6 — Workflow & Usability Pass

**Proposed:** 2026-09-30
**Status:** Phases A-H executed 2026-09-30 on `feat/workflow-usability-v6`. One
deliberate carve-out (PLAT-04, folder GDPR coverage) and two CI-gated
verifications (`npm run test:rules`, `cd functions && npm test`) — see the
phase outcomes and the deployment order below.
**Source:** Nine-item change request (Actions, Documents, Diagnostic rounds)
**Predecessor:** v5.0 Hardening Pass (Phase 12 of 13 in flight)
**Mode:** yolo, parallelisation enabled (per `.planning/config.json`)

**Core value:** The portal stops being a data-entry chore. Consultants can correct history, organise client documents, and enter and triage actions at the speed they actually work — without widening the client-facing write surface further than the compliance narrative can carry.

---

## Decisions taken (do not relitigate)

| # | Decision | Chosen |
|---|---|---|
| D1 | Client edit rights on actions | Title, description, owner, pillar. **Due date stays staff-only.** No client create, no client delete, `internal` flag immutable to clients. |
| D2 | Document folders | **Nested tree.** Folders are metadata only — Storage object paths never change. |
| D3 | Process | New GSD milestone with phases, REQ-IDs and success criteria. |
| D4 | Refactor | Complete the pending Phase 4 D-02 re-homing for `renderActions` + `renderDocuments` **first**, then build features in the new modules. |
| D5 | REQ-ID prefix | The Documents requirements use **`FILE-`**, not `DOC-`. Renamed mid-execution: the hardening milestone already owns `DOC-01`..`DOC-10` for *documentation* controls, and both sets are indexed by the same `docs/CONTROL_MATRIX.md`. A reader hitting `DOC-04` in that matrix would have had no way to tell "Control matrix populated" from "Deleting a non-empty folder is refused". Commits before this decision still say `DOC-0N` for the Documents items. |

---

## Requirements

### Actions (ACT)

- **ACT-01**: Actions are grouped into Overdue, Current, Completed — in that order — on the Actions tab.
- **ACT-02**: An action with no due date sorts into Current, never Overdue.
- **ACT-03**: The Actions tab filters by pillar (including Unassigned), by owner (including Unassigned), and by due date.
- **ACT-04**: Clicking an action row expands it to show the full action text and every field; clicking a control inside the row does not toggle the expansion.
- **ACT-05**: The pillar of an existing action can be changed from the expanded row.
- **ACT-06**: An internal user can edit every field of any action after entry.
- **ACT-07**: A client user can edit title, description, owner and pillar on any non-internal action in their org, and cannot edit due date, cannot create, cannot delete, and cannot change the `internal` flag.
- **ACT-08**: Every edit records `lastEditedBy` + `lastEditedAt`, shown in the expanded row.
- **ACT-09**: Paste Multiple has a review step listing each parsed item with its own pillar selector before anything is written.
- **ACT-10**: In the review step an item can be re-worded, removed, or have a pillar applied to every row at once.

### Documents (FILE)

- **FILE-01**: Internal users can create folders inside an org's document area, nested to a bounded depth.
- **FILE-02**: Documents belong to a folder or to the root; the flat list is replaced by folder-scoped navigation with a breadcrumb.
- **FILE-03**: A document can be moved between folders without the Storage object being rewritten.
- **FILE-04**: Folders can be renamed and deleted; deleting a folder that still holds anything is refused with a message saying so.
- **FILE-05**: The document list sorts by date added (default, newest first), by name, or by uploader; the choice persists for the user.
- **FILE-06**: Folders are soft-deleted with the same 30-day restore window as documents.

### Diagnostic (DIA)

- **DIA-01**: An internal user can change scores in any round of an org's diagnostic, not only the current one.
- **DIA-02**: Every diagnostic screen states which round is on view, and says plainly when that round is a historic one.
- **DIA-03**: A write to a historic round lands in that round's response document and leaves the current round untouched.

### Platform (PLAT)

- **PLAT-01**: `renderActions`, `renderActionRow`, `openActionModal`, `openBulkActionModal` and `renderDocuments` live in `src/views/*`, not in `src/main.js`.
- **PLAT-02**: Grouping, filtering, sorting and folder-tree logic are pure functions in `src/domain/*` with no DOM and no Firebase import (lint-enforced).
- **PLAT-03**: The widened client write surface is reflected in `SECURITY.md`, `docs/CONTROL_MATRIX.md` and the rules-emulator matrix.
- **PLAT-04**: GDPR export and erase cover the new `folders` collection and the new action fields. **PARTIAL** — action fields are covered by construction; folders are not. See Phase H outcome.

---

## Phases

### Phase A — Re-homing and pure helpers (no behaviour change)

**Goal:** The code about to double in size is out of the 6,032-line IIFE and the new logic is unit-testable without booting the app.

**Work**
- Move `renderActions` / `renderActionRow` / `pillarSelectEl` / `pillarIdFromSelect` / `openActionModal` / `openBulkActionModal` into `src/views/actions.js` behind the existing Pattern D DI factory (`createActionsView`).
- Move `renderDocuments` + `formatBytes` into `src/views/documents.js` the same way.
- New pure modules, all `@ts-check`, no DOM, no Firebase:
  - `src/domain/action-grouping.js` — `groupActions(actions, todayIso)` → `{ overdue, current, completed }`.
  - `src/domain/action-filters.js` — `filterActions(actions, { pillarId, owner, due })` + `ownerOptions(actions)`.
  - `src/domain/document-sort.js` — `sortDocuments(docs, key)` for `added` | `name` | `uploader`.
  - `src/domain/folder-tree.js` — `buildTree`, `pathTo`, `descendantIds`, `canMove` (cycle + depth guard).
- No user-visible change. Existing snapshot baselines must not move.

**Success criteria**
1. `npm test` green; `tests/__snapshots__/views/*.html` byte-identical.
2. `src/main.js` no longer defines the moved functions and is materially shorter.
3. `npm run lint` and `npm run typecheck` pass, with the `domain/*` no-Firebase-import rule intact.
4. Each new domain module has its own test file with boundary cases.

**Outcome (executed 2026-09-30).** All four met. `src/main.js` 6,033 -> 5,506 lines
(527 removed); suite 781 -> 890 tests across 113 files; snapshot baselines
unmoved; `tsc --noEmit` clean, so both re-homed views carry full `@ts-check`
per the house convention rather than inheriting main.js's `@ts-nocheck`.

**Depends on:** nothing.

---

### Phase B — Action model and rules widening

**Goal:** The data model and security rules support per-field client editing before any UI offers it.

**Work**
- Action document gains `description` (optional string), `lastEditedBy`, `lastEditedAt`. `pillarId` stays nullable.
- `firestore.rules`, actions block — client branch changes from
  `mutableOnly(["done","completedAt","completedBy","updatedAt"])` to
  `mutableOnly(["done","completedAt","completedBy","title","description","owner","pillarId","lastEditedBy","lastEditedAt","updatedAt"])`,
  keeping `internal == false`, `notDeleted`, and adding `immutable("due")`, `immutable("internal")`, `immutable("createdBy")`, `immutable("createdAt")`, `immutable("orgId")` on the client branch.
- Staff branch unchanged except the new fields are writable.
- `updateAction` stamps `lastEditedBy` / `lastEditedAt` on every patch.
- Audit event on client-originated action edits (`data.action.clientEdit`) **deferred to Phase H**: `AUDIT_EVENTS` in `src/observability/audit-events.js` mirrors a Zod enum in `functions/src/audit/auditEventSchema.ts`, so a new event name is a Cloud Functions change and a functions deploy, not a client one. It belongs with the CONTROL_MATRIX row it supports. The durable evidence — `lastEditedBy` / `lastEditedAt` on the document, enforced server-side — lands here.

**Success criteria**
1. Rules-emulator matrix covers client × each writable field × allow, and client × `due` / `internal` / `createdBy` / `createdAt` / `orgId` / `deletedAt` × deny.
2. A client attempting to set `due` is denied even when the rest of the patch is legal.
3. A client attempting to edit an `internal: true` action is denied.
4. A client cannot stamp `lastEditedBy` with anyone's uid but their own.
5. `npm run test:rules` green.

**Outcome (executed 2026-09-30).** Rules widened, 23 emulator cases added
(`tests/rules/actions.test.js` 181 -> 351 lines), model fields and the
`updateAction` stamp landed. **SC#5 is verified in CI only** — the Firestore
emulator needs a Java runtime and there is none on this machine, so
`npm run test:rules` cannot run locally. CI installs Java 21 and runs it
(`.github/workflows/ci.yml`), which is the gate before this branch merges.

**Depends on:** nothing. **Deploy order: rules ship and are verified in production before the Phase C client build is released.** Widening is backward compatible, so this ordering carries no lockout risk — the reverse does.

---

### Phase C — Actions UI

**Goal:** Grouping, filtering, expansion and in-place editing on the Actions tab.

**Work**
- Replace the open/completed split with Overdue → Current → Completed, each a collapsible section with a count. Empty groups render a one-line empty state rather than vanishing, so the three-group shape is always legible.
- Filter bar above the groups: pillar select (All / each pillar / Unassigned), owner select (All / each distinct owner / Unassigned), due select (All / Overdue / Next 7 days / This month / No due date). Filters compose; a "Clear filters" control appears once any is set; the header count reads `showing N of M`.
- Row becomes a two-part control: a collapsed summary row (checkbox, truncated title, pillar name, owner, due, chevron) and an expanded detail panel (full title textarea, description textarea, pillar select, owner input, due input, and a metadata footer — created by/at, last edited by/at, completed by/at).
- Expansion toggles on row click and on Enter/Space, with `aria-expanded` and a `role="button"` region; `stopPropagation` on every interactive descendant so a checkbox click does not expand.
- Client view: title, description, owner, pillar editable; due input rendered `disabled` with a title explaining it is set by BeDeveloped; delete absent.
- `.action-row` grid gains a chevron column; the expanded panel is a sibling row spanning the grid.

**Success criteria**
1. An action with `due` in the past and `done: false` renders under Overdue; the same action with no `due` renders under Current; `done: true` renders under Completed regardless of `due`.
2. Selecting a pillar filter and an owner filter together shows only actions matching both.
3. Clicking the completion checkbox toggles completion and does **not** expand the row.
4. Booted as a client, the due input is disabled and the title, description, owner and pillar inputs are not.
5. Editing the pillar on an existing action persists to `orgs/{orgId}/actions/{id}` and re-groups the row without a full reload.

**Outcome (executed 2026-09-30).** All five met; 26 view tests added across
`actions-groups-filters.test.js` (new) and `actions-client-toggle.test.js`
(rewritten to the new row contract). Two decisions worth recording:

- **The collapsed row is read-only.** It used to carry inline inputs for title,
  owner and due. Once the row became a click target, an input inside it would
  have to swallow the click the row wants, leaving a row that sometimes expands
  and sometimes does not depending on which pixel is hit. All editing moved into
  the panel; the collapsed row keeps only the completion checkbox.
- **The disclosure is a real `<button>`, and the row is not one.** `role="button"`
  on the row would have been invalid ARIA, because the row contains a checkbox and
  interactive content inside a button is not reliably exposed. A screen-reader user
  could have lost the ability to complete an action — the one thing every user of
  this page can do. The row click is a convenience layered on top of the button.

**Depends on:** Phase A, Phase B.

---

### Phase D — Paste Multiple review step

**Goal:** A pasted batch is triaged before it is written, one pillar per item.

**Work**
- Modal becomes two steps in one dialog. Step 1 is today's textarea, count and clipboard button. "Review" advances; "Back" returns with the text intact.
- Step 2 renders one row per parsed item: an editable text input, a pillar select defaulting to blank, and a remove control. Above the list: an "Apply to all" pillar select, the item count, and the internal-only checkbox for the whole batch.
- `addManyActions(createdBy, pillarId, titles, opts)` becomes `addManyActions(createdBy, items, opts)` where `items` is `[{ title, pillarId }]`. Single-pillar behaviour is expressed by the caller, not by the function.
- `MAX_BULK_ITEMS` enforcement moves to the step-1 → step-2 transition so the user is stopped before they start triaging 400 rows.

**Success criteria**
1. Pasting three lines and assigning three different pillars creates three actions with those pillars.
2. Removing a row in review means that action is not created.
3. "Apply to all" sets every row's pillar, and a row changed afterwards keeps its own value.
4. Back → Review round-trips without losing edits made in review.
5. `tests/domain/bulk-parse.test.js` is unchanged — the delimiter rule is not touched.

**Outcome (executed 2026-09-30).** All five met; `actions-bulk-paste.test.js`
rewritten to the two-step flow, 12 -> 22 cases. `tests/domain/bulk-parse.test.js`
is untouched, as required. One design note: the step swap happens inside a host
element rather than by calling `modal()` twice, because a second `modal()` call
leaves the first call's backdrop listener attached to `#modalRoot`.

**Depends on:** Phase A.

---

### Phase E — Folder model and rules

**Goal:** A nested folder tree exists in Firestore with rules and soft-delete, before any UI depends on it.

**Work**
- New subcollection `orgs/{orgId}/folders/{folderId}`: `{ id, orgId, name, parentId (null = root), createdBy, createdAt, updatedAt, deletedAt }`.
- Documents gain `folderId` (null = root). **Storage paths are untouched** — `orgs/{orgId}/documents/{docId}/{name}` stays as it is, so moving a file is a one-field Firestore write and never an object copy.
- `firestore.rules`:
  - `folders`: read `inOrg && notDeleted`; create/update internal-only with `immutable("orgId")`, `immutable("createdAt")`, `immutable("createdBy")`; delete denied (soft-delete callable only).
  - `documents`: `allow update` changes from `if false` to internal-only `mutableOnly(["folderId","updatedAt"])`. This is the only widening on documents.
- Depth cap of 5 and cycle prevention enforced in `domain/folder-tree.js` and at the write site. Rules cannot express reachability, so this is a client-and-callable guard; record the residual risk explicitly in `THREAT_MODEL.md` rather than implying rules enforce it.
- Soft-delete: add `"folder"` to `SOFT_DELETABLE_TYPES` and `resolveDocPath` in `functions/src/lifecycle/resolveDocRef.ts`; the exhaustive switch will fail the TypeScript build until every consumer is updated, which is the intended forcing function. Restore and scheduled purge follow.
- Delete of a non-empty folder is refused — checked client-side for the message, and in the callable for the guarantee.
- **Verify first:** the documents listener at `src/main.js:3805` queries the whole collection with no `where("deletedAt","==",null)`, while the read rule requires `notDeleted(resource.data)`. Firestore rules are not filters. Confirm against the emulator whether a soft-deleted document breaks the whole listener; if it does, that is a live bug in the current build and it is fixed here, with an index if the compound query needs one.

**Success criteria**
1. Rules-emulator cells: internal can create/rename a folder; a client cannot; neither can hard-delete; a client in another org cannot read.
2. A document update that changes only `folderId` succeeds for internal and is denied for a client.
3. A document update that changes `filename` or `storagePath` is denied for everyone.
4. `canMove` rejects a move into a folder's own descendant and a move that would exceed depth 5, with tests.
5. `cd functions && npm test` green with `"folder"` handled in every lifecycle path.
6. Soft-deleting a folder hides it from the live listener and restores intact within the window.

**Depends on:** Phase A.

---

### Phase F — Documents UI

**Goal:** Folder navigation and sorting replace the flat list.

**Work**
- Breadcrumb from root to current folder. Folder rows render above file rows; a folder row shows its name and child counts. Internal users get "+ New folder", rename, move and delete; clients get navigation and download only.
- Upload targets the current folder — the new document is written with `folderId` set to it.
- Move: a picker listing the tree with illegal targets disabled, for both documents and folders.
- Sort control: Date added (default, newest first) / Name (A–Z) / Uploader (A–Z), persisted per user in `localStorage`. Folders always sort by name and always sit above files.
- Empty folder renders "Nothing in this folder yet", with the upload affordance still present.

**Success criteria**
1. Creating a folder, uploading into it and navigating back to root shows the file only inside the folder.
2. Moving a document between folders changes only `folderId` — `storagePath` is byte-identical before and after.
3. Each sort key orders the file list correctly, and the choice survives a reload.
4. Deleting a folder holding a document is refused with a message naming what is inside.
5. A client cannot see the create, rename, move or delete controls, and the rules deny them independently.

**Outcome (executed 2026-09-30).** All five met; 24 view tests added — the first
behavioural coverage the Documents tab has ever had. Every earlier view test
booted with `FB.ready = false`, which short-circuits `renderDocuments` at its
"Connecting to shared storage…" branch, so the entire body was untested. A
`window.FB` double (`tests/mocks/window-fb.js`) unlocks it.

Three things the double had to get right, each found the hard way:

- **The first snapshot must be asynchronous.** `main.js` calls
  `ensureActivitySubscriptions()` from inside `render()`, and that subscription's
  callback calls `render()` again. A synchronous first emission re-enters `render()`
  mid-build and the DOM ends up with two of everything — two `<main>`s, every
  assertion quietly seeing doubles. Real Firestore emits asynchronously; so does
  the double.
- **The double must be installed after `import("../../src/main.js")`.** Both
  `src/firebase/db.js` and `src/firebase/storage.js` overwrite
  `window.FB.{db,firestore,storage,storageOps}` at module load, so a double set
  beforehand is silently replaced and the view talks to a Firestore that never
  answers.
- **`window.FB.currentUser` has to survive the auth callback**, which assigns null
  when Firebase reports no user — always, in a test. It is a property with a setter
  that accepts a user and ignores a null.

**Depends on:** Phase A, Phase E.

---

### Phase G — Historic round score editing

**Goal:** Editing a past round is possible, obvious, and cannot be done by accident.

**Finding from the current code.** This is largely already wired. `renderDiagnosticIndex` gives internal users a round selector that sets `state.viewRoundId`; `activeRoundId()` honours it; `renderQuestion` disables the likert buttons for clients only; `setResponse` writes to `activeRoundId()`; and the `responses` rules allow an internal update on any round. What is missing is not capability but signalling — once a user clicks into a pillar, nothing on the page says which round they are scoring, so a historic edit looks identical to a current one.

**Work**
- Round context strip on the pillar page: the round label and date, plus an explicit historic state ("Editing Round 2 — a historic round") with a control to return to the current round.
- Move the round selector into a shared component used by both the diagnostic index and the pillar page.
- Confirm-on-first-edit when the round on view is not the current round, per session rather than per click.
- Dashboard, report and radar continue to key off `org.currentRoundId`, unaffected by `viewRoundId`.
- Verify the existing `setRoute` guard that clears `viewRoundId` outside `diagnostic` / `pillar:*` still holds once the strip is added.

**Success criteria**
1. Selecting a historic round and scoring a question writes to that round's `responses/{roundId}__{pillarId}` document and leaves the current round's document unchanged.
2. The pillar page names the round on view in every state, and marks it historic when it is not the current one.
3. The dashboard score is unchanged while a historic round is being edited.
4. A client sees no round selector and no editable controls, as now.

**Outcome (executed 2026-09-30).** All four met; 10 view tests added. The
finding above held — no capability was added, only signalling. Three decisions:

- The picker is now one shared `renderRoundPicker`, used by the diagnostic index
  and the pillar page, so the two cannot drift.
- The unpinned case renders byte-identically to the pre-v6 markup (bare text node,
  no trailing space in the class), so the committed diagnostic snapshot is unmoved
  and still fences the common path.
- `+ New` stays available while viewing history rather than being swapped for
  `Back to current`. Removing it would have been a quiet regression in what the
  screen can do.

**Depends on:** nothing. Runs in parallel with A–F.

---

### Phase H — Evidence pack and documentation

**Goal:** The compliance narrative still matches the code.

**Work**
- `SECURITY.md` and `docs/CONTROL_MATRIX.md`: new rows for the widened client action write surface and the documents `folderId` update, each with a code link, test link and framework citation.
- `THREAT_MODEL.md`: folder cycle and depth enforcement is client-and-callable, not rules-level. State it.
- `docs/RETENTION.md`: folders join the 30-day soft-delete window.
- GDPR export and erase extended to `folders` and the new action fields.
- `.planning/codebase/*` refreshed after the re-homing.
- `PLATFORM-UAT.md` entries for the five user-facing flows.

**Success criteria**
1. Every new or widened rule has a matching CONTROL_MATRIX row and a passing test cited from it.
2. `gdprExportUser` output includes folders; `gdprEraseUser` tombstones them.
3. The docs shape tests (`tests/*-shape.test.js`, `tests/*-paths-exist.test.js`) pass against the updated documents.

**Outcome (executed 2026-09-30).** SC#1 and SC#3 met. **SC#2 is NOT done** — see
below.

Landed:

- `SECURITY.md` § Milestone v6, opening with an explicit instruction to read it
  before any earlier statement about what a client may write, because several
  earlier sections describe the pre-v6 build and are now wrong about it.
- Six `docs/CONTROL_MATRIX.md` rows (ACT-07, ACT-08, FILE-01, FILE-03, FILE-06,
  PLAT-02), each with a code path and a passing test. Rows for purely
  presentational work were deliberately left out: a matrix that lists everything
  stops being an index of controls.
- `THREAT_MODEL.md` § Residual risks, a section the document did not previously
  have. R1 is the folder cycle and depth gap; R2 is `completedBy` not being
  checked against the writer's uid. Both are accepted, not mitigated, and say so.
- `docs/RETENTION.md` § Document folders.
- `tests/control-matrix-paths-exist.test.js` regex extended for the ACT / FILE /
  DIA / PLAT prefixes, so the new rows are actually swept rather than ignored.

**Not done: PLAT-04, GDPR coverage for the `folders` collection.** The new action
fields ARE covered — `gdprExportUser` exports whole action documents, so
`description` and `lastEditedBy` come along by construction. Folders do not.
Adding them means changing `QueryResults`, `UserBundle`, `assembleUserBundle`,
`gdprExportUser` and `eraseCascade`, and bumping `BUNDLE_SCHEMA_VERSION` — which
changes the shape of an export format that has its own unit tests.

It is not done because it cannot be verified here. The `functions` workspace will
not install on this machine (npm fails resolving its lockfile on the local Node,
which is below the engine floor), so not one functions test can be run. Shipping
an unverified export-schema change into a compliance artefact is worse than
shipping the gap with the gap written down. It wants its own change, with CI
green, and is the first follow-up after this branch merges.

**Depends on:** B, C, E, F.

---

## Dependency graph

```
A (re-homing) ──┬─> C (actions UI)      ──┐
                ├─> D (paste review)      │
                └─> E (folder model) ──> F (documents UI) ──┐
B (action rules) ──> C                                      ├─> H (evidence)
G (historic rounds) ── independent ─────────────────────────┘
```

A and B and G start together. C waits on A and B. E waits on A. F waits on E. H closes the milestone.

---

## Deployment order (non-negotiable)

1. **`firestore.rules`** — widening is backward compatible, so rules go first.
   The reverse gives clients a UI whose saves are rejected.
2. **`scripts/backfill-document-folder-fields/run.js`** — before the client, or
   every file uploaded before v6 disappears from the documents list. Dry-run
   first; it is idempotent.
3. **Cloud Functions** — `folder` in `SOFT_DELETABLE_TYPES` and the six new audit
   event literals. Without this, deleting a folder fails at the callable and the
   server rejects the folder audit events.
4. **The client.**

Steps 1-3 are all backward compatible with the currently deployed client, so
they can go out ahead of it in one window or three.

## Risks and call-outs

1. **This widens client write access during a hardening milestone.** The evidence pack currently claims clients can change only completion fields on actions. That claim becomes false the moment Phase B deploys. Phase H is not optional tidying — without it the pack misrepresents the system to the prospect that prompted the hardening work in the first place.

2. **Rules deploy must lead the client.** Ship and verify the widened rules in production, then release the UI that uses them. The reverse gives clients a UI whose saves are rejected.

3. **Nested folders have no server-side cycle guard.** Firestore rules cannot walk a parent chain. Depth and cycle prevention live in the client and in the delete callable. This is a correctness-and-UX guard, not a security boundary, and the threat model should say so rather than leave a reader to assume otherwise.

4. **A possible live bug sits in the documents listener.** The query is unconstrained while the read rule tests `notDeleted`. If Firestore rejects the query rather than filtering it, one soft-deleted file currently breaks the whole document list for that org. Verify this in Phase E before building on top of it.

5. **Per-row pillars on paste reverse an explicit out-of-scope line** in `base-layers-scope-change-paste-multiple.md` §4, which recorded "assigning different pillars per row on paste" as out of scope. That document also flagged that no price was named and that silence reads as free. Item 7 is new billable scope, not a defect fix.

6. **Bulk entry plus filters plus grouping will surface volume.** The August scope note predicted action counts rising sharply once paste landed. Grouping and filtering are the mitigation, but the Actions tab renders every action into the DOM on every `render()`. Watch it at a few hundred actions; virtualisation is out of scope but the threshold is worth knowing.

7. **`format:check` already fails on `main`.** Thirty-five tracked files fail
   `prettier --check` before this milestone touches anything — `src/views/chat.js`,
   `src/views/funnel.js`, `src/domain/completion.js` and others. Every file this
   milestone writes is formatted, but a green `format:check` is not available as a
   gate until that drift is cleared separately. Do not read the red as a regression
   from this work, and do not bury a feature commit under a repo-wide reformat.

8. **Local Node is below the engine floor.** `npm ci` needs `--engine-strict=false`, and build and format checks fail on clean `main` for unrelated reasons. Do not read those as regressions from this work.

---

## Open questions

1. **"Description" on an action** — item 9's answer named title *and description* as the wording tier, but actions carry only `title` today. This plan adds an optional `description` field surfaced in the expanded row. Confirm that is what was meant, rather than "description" being another word for the full title text shown on expand.
2. **Non-empty folder delete** — this plan refuses it. The alternative is cascading the soft-delete to everything inside, which is recoverable but much easier to do by accident. Confirm refusal is right.
3. **Should client edits be visible as such?** `lastEditedBy` is stored either way. The question is whether the row should say "edited by [client name]" to internal users, so a consultant can see when a client has rewritten an action.
4. **Due-date filter buckets** — Overdue / Next 7 days / This month / No due date is proposed. Confirm those are the cuts BeDeveloped actually works to.
5. **Can clients create folders?** Assumed internal-only, per "created as needed by internal users".
6. **Is this build chargeable?** The August document flagged that the question went unanswered and that precedent was being set. It is still unanswered, and this scope is several times the size of that one.
