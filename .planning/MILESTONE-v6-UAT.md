---
status: not started
milestone: v6 (Workflow & Usability)
branch: feat/workflow-usability-v6
base: 449bbc0 (main at time of branch)
source:
  - .planning/MILESTONE-v6-WORKFLOW-USABILITY.md (what was built and why)
  - git log 449bbc0..HEAD (eleven commits)
target: local emulator suite — NOT production
test_accounts: created by the seed step; none pre-exist
outcome: (fill in)
---

# Milestone v6 — UAT checklist

Every behaviour changed on `feat/workflow-usability-v6`, as something a person
or an agent can actually check. Work top to bottom: §0 decides whether §4 is
reachable at all.

**Do not point this at production.** The app talks to a real Firebase project by
default and the changes here write to `orgs/*/actions`, `orgs/*/documents` and a
new `orgs/*/folders`. §1 pins everything at the local emulator suite.

---

## §0 — Gates. Resolve these first; they decide what is testable

Three things on this machine currently block parts of this checklist. Each has a
decision attached. Do not start §1 until you know which way each one went.

### G1 — No Java runtime → no emulators, no rules tests

`java -version` fails. The Firebase emulator suite is a Java application, so
without it there is **no Firestore emulator**, which means:

- `npm run test:rules` cannot run (23 of the new tests are in there — the entire
  security-rules matrix for the widened client write surface and the folder tree).
- The browser flow in §4 has nothing safe to talk to.

**Decision:** install a JDK (`brew install --cask temurin` or any JDK 11+), or
accept that §4 and §3.2 are skipped and rely on CI for the rules suite.

### G2 — Node 20.20.2 is below the engine floor (`>=22`)

Two consequences:

- The `functions` workspace will not install at all — `npm ci` and `npm install`
  both fail with `Cannot read properties of null (reading 'edgesOut')`. So
  `cd functions && npm test` cannot run, and neither can any Admin-SDK seeding
  script under `scripts/` (they depend on `firebase-admin` from that workspace).
- Root installs need `--engine-strict=false`.

**Decision:** `nvm install 22 && nvm use 22`, then reinstall. Without it, §2 must
seed through the emulator REST APIs instead of the Admin SDK (plain `fetch`,
no dependency), and `functions` tests are CI-only.

### G3 — MFA is mandatory for every role. Can the emulator satisfy it?

This is the one that can stop §4 dead, so check it early.

`src/main.js` gates every signed-in user: if `mfaEnrolmentRequiredForRole(role)`
and the user has no enrolled factors, the app renders the TOTP enrolment screen
and returns — **before** the topbar, before any route. `admin`, `internal` and
`client` all require it (`src/auth/role-predicates.js`). There is no dev bypass
and you should not add one.

So the agent must either enrol TOTP or never see the Actions tab.

**Probe it (5 minutes, do this before anything else):** bring up the Auth
emulator, create a user, sign in through the UI, and see whether the enrolment
screen can be completed. The app builds a spec-conformant `otpauth://` URI via
`src/firebase/totp-uri.js`, so the shared secret is extractable from the DOM and
a code can be computed headlessly with `oathtool --totp -b <secret>` or a small
Node script.

**Three outcomes:**

| Outcome | Then |
|---|---|
| Emulator accepts TOTP enrolment | Best case. §4 runs fully headless. |
| Emulator rejects TOTP | Use a **separate Firebase dev project** with Identity Platform MFA on, and a real authenticator. Slower, needs a human for the first enrolment per account, but the session persists. Do NOT use the production project. |
| Neither is available | §4 is not runnable. Fall back to §3.3 — the view-level tests already drive the real render path with a Firebase double, and cover most of the same assertions. Say so in the outcome rather than reporting §4 as passed. |

---

## §1 — Bring-up

```sh
git checkout feat/workflow-usability-v6
npm ci --engine-strict=false          # drop the flag once G2 is resolved
```

`.env.local` — set the emulator flag. **Check the existing file first; it holds
real config you should not clobber.**

```sh
VITE_USE_EMULATORS=1
```

`firebase.json` has an `emulators` block for hosting / functions / firestore /
storage / ui, but **no `auth` entry**, while `src/firebase/app.js` connects the
Auth emulator on `localhost:9099`. If the CLI will not start Auth, add:

```json
"auth": { "port": 9099 }
```

Then, in two terminals:

```sh
firebase emulators:start --only auth,firestore,storage    # emulator UI on :4000
npm run dev                                                # Vite on :5173
```

- [ ] Emulator UI reachable at `http://localhost:4000`
- [ ] App loads at the Vite URL with **no console errors**
- [ ] Network tab shows requests going to `localhost:8080` / `:9099`, **not** to
      `firestore.googleapis.com`. If they go to Google, `VITE_USE_EMULATORS` did
      not take — stop and fix it before signing in.

---

## §2 — Seed

Two users and one org. Custom claims are what the whole app keys off, and
`beforeUserCreated` (the Cloud Function that normally sets them) is not running,
so **set them directly**.

- [ ] Internal user — claims `{ role: "internal", orgId: "<org id>" }`
- [ ] Client user — claims `{ role: "client", orgId: "<same org id>" }`
- [ ] Both have `email_verified: true` (the router gates on it)
- [ ] An org document at `orgs/{orgId}` with `deletedAt: null`
- [ ] At least 6 actions under `orgs/{orgId}/actions`, deliberately spread:
      one overdue, one due within 7 days, one with **no due date**, one already
      done, one with **no pillar**, one marked `internal: true`
- [ ] Every action carries `deletedAt: null` — the listeners filter on it
- [ ] At least 3 documents under `orgs/{orgId}/documents` with different
      uploaders, names and `createdAt` values, all with `folderId: null` and
      `deletedAt: null`
- [ ] **One document with NO `deletedAt` field at all** — this is the pre-v6
      shape, and §4.22 depends on it existing

With G2 resolved, seed via `firebase-admin` against the emulator hosts. Without
it, use the emulator REST APIs — both Auth and Firestore expose unauthenticated
HTTP endpoints when `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST`
are set, so a plain `fetch` script on Node 20 is enough and needs no dependency.

---

## §3 — Automated verification (no browser)

### 3.1 — Runs here today

- [ ] `npx tsc --noEmit` — clean
- [ ] `npx eslint src/ tests/ scripts/` — clean
- [ ] `npx vitest run` — **960 passed, 7 skipped, 116 files**
- [ ] `git status --short tests/__snapshots__` is **empty**. The re-homing in
      commit `424a76a` was a pure move; a moved snapshot means it was not.
- [ ] `npx prettier --check` on the files this branch touched. Note: ~35 files
      fail `format:check` on `main` already, so check the changed set, not the repo.

### 3.2 — Blocked by G1 (Java)

- [ ] `npm run test:rules` — the security-rules matrix. **This is the highest-value
      unrun suite on the branch.** It covers: the per-field client allow/deny
      matrix on actions, that a client cannot add a field the record does not
      have, folder tenancy and internal-only writes, `storagePath` immutability,
      and the constrained-list-query cases.
- [x] **Already answered, 2026-09-30.** The suite ran in CI on PR #97: 325 of 327
      passed, and the two failures were the pair asserting that an unconstrained
      list over a collection holding a tombstone is refused. It is not —
      the emulator permits it. The suspected pre-existing production bug is
      therefore **unconfirmed** and the claim has been withdrawn from
      `SECURITY.md` and the milestone plan. The tests now assert what the
      constrained query actually returns, which is the app's real contract.

### 3.3 — Blocked by G2 (Node 22)

- [ ] `cd functions && npm test` — covers `folder` joining `SOFT_DELETABLE_TYPES`
      and the six new audit-event literals. Unrun anywhere but CI so far.

---

## §4 — Browser matrix

Signed in as **internal** unless a test says otherwise. Record pass / fail /
blocked against each. `(R)` marks a regression check on pre-existing behaviour
rather than a new feature.

### A. Actions — grouping

1. Actions tab shows exactly three group headers, in the order **Overdue,
   Current, Completed**, each with a count.
2. The action with a past due date is under Overdue. The one due within 7 days
   is under Current.
3. **The action with no due date is under Current, not Overdue.** This is the
   one most likely to regress and the one that matters most after a bulk paste.
4. The completed action is under Completed even though its due date has passed.
5. Within Current, the soonest due date is first and undated work is last.
6. A group with nothing in it still renders its header and a one-line empty state.
7. Tick an action's checkbox → it moves to Completed and the counts update.

### B. Actions — filters

8. Pillar / Owner / Due selects are present above the groups.
9. The Owner select lists only owners actually present, plus "No owner" only if
   something is genuinely unowned.
10. Filtering by pillar narrows every group at once.
11. **Filter by Due → Overdue: the Completed group empties.** Filters run before
    grouping; a populated Completed under an Overdue filter is a bug.
12. Two filters together compose with AND.
13. The banner switches to `showing N of M` once filtered.
14. "Clear filters" appears only when filtered, and restores the full list.
15. Set a filter, then tick a checkbox → **the filter survives the re-render.**

### C. Actions — expand and edit

16. Click a row → it expands. Click again → it collapses.
17. **Click the checkbox → the action completes and the row does NOT expand.**
18. The chevron is a real focusable button: reach it with Tab, activate with
    Enter and with Space, and confirm `aria-expanded` flips.
19. The expanded panel shows **exactly four fields: Action, Pillar, Owner, Due.**
    No "Notes" field — if one appears, the removed `description` field came back.
20. Edit the title in the panel, click away, reload → it persisted.
21. Change the pillar in the panel → it persists and the collapsed row updates.
22. "Open pillar" in the panel navigates to that pillar's detail page.
23. Delete from the panel → confirm dialogue → the action goes.

### D. Actions — as a client

Sign out; sign in as the **client**.

24. Title, Owner and Pillar in the panel are editable and persist.
25. **Due is disabled**, with a visible explanation.
26. No "+ New action", no "Paste multiple", no "Delete action".
27. The `internal: true` action from §2 is **not visible at all**.
28. Completion checkbox still works.
29. `(R)` Open the browser console. No permission-denied errors on any of the
    above — the rules and the UI should agree. A silent write failure is the
    most likely form this bug takes.

### E. Paste multiple

Back as internal.

30. "Paste multiple" opens on the paste step. Paste 3 lines, one containing a
    comma. The count reads "3 actions" — the comma did not split its line.
31. "Review" advances to a row per item, each with its own pillar select,
    defaulting to blank.
32. Set a different pillar on each of two rows, leave the third blank →
    "Add all" → all three created with exactly those pillars.
33. "Set every pillar to" applies to all rows; changing one row afterwards keeps
    its own value.
34. Remove a row → that action is never created.
35. Remove the middle row, then edit what is now the second row → the edit lands
    on the right item.
36. Edit a row, go Back, return to Review → **the edit survived.**
37. Go Back, change the pasted text, Review → rows re-parsed from the new text.
38. Paste 201 lines → Review is refused with a message, on the paste step, before
    any triage.
39. `(R)` Freshly pasted actions all land under **Current** — none in Overdue.

### F. Documents — folders

40. Documents tab shows a breadcrumb reading "Documents".
41. "+ New folder" creates a folder at the current level; it appears immediately
    without a reload.
42. Open the folder → breadcrumb extends; the root's files are not shown.
43. Upload a file while inside the folder → it lands **in that folder**, not at
    the root.
44. Go back via the breadcrumb → the file is not at the root.
45. Nest a folder inside a folder; breadcrumb shows all three levels.
46. Rename a folder → persists.
47. Move a **file** between folders → it moves. Check Firestore in the emulator
    UI: **`storagePath` is byte-identical before and after.** Only `folderId`
    changed.
48. Move a **folder** to another folder → its contents move with it.
49. Open the move picker for a folder that has children: **its own name and its
    own children are disabled, and say why.**
50. Delete a folder that holds a file → **refused**, and the message names what
    is in the way.
51. Delete an empty folder → confirm dialogue → it goes.
52. Nest to five levels, then try a sixth → refused with the depth message.

### G. Documents — sorting

53. Sort defaults to "Date added (newest first)".
54. Switch to Name → A-Z. Switch to Uploader → A-Z by uploader.
55. Reload the page → **the sort choice persisted.**
56. Folders stay above files and stay name-sorted under every sort key.

### H. Documents — as a client

57. No "+ New folder"; no Rename / Move / Delete on folder rows.
58. Can still navigate into folders and download.
59. Can delete their own upload, but not someone else's.

### I. Documents — the deletedAt filter

60. **The pre-v6 document seeded in §2 (no `deletedAt` field) does not appear.**
    This is expected and is exactly why the backfill script exists. If it *does*
    appear, the listener is not constrained and §3.2's premise is wrong.
61. Run `node scripts/backfill-document-folder-fields/run.js --dry-run` against
    the emulator → it reports that document as needing a patch.
62. Run it for real → reload → **the document now appears.**
63. Soft-delete a document → it disappears from the list, and the rest of the
    list **still renders** (one tombstone must not break the whole query).

### J. Diagnostic — historic rounds

64. Diagnostic tab shows a round selector. Nothing is marked historic.
65. Select an older round → an amber panel appears saying "Editing a historic
    round", plus "Back to current".
66. Click into a pillar → **the round context is still shown on the pillar page.**
    Before v6 it was not, which is the whole point of this phase.
67. Score a question → a confirmation dialogue appears first.
68. Confirm → in the emulator UI, the score landed in
    `responses/{historicRoundId}__{pillarId}` and the **current round's document
    is unchanged**.
69. Score a second question in the same round → **no second dialogue.**
70. "Back to current" → the historic marking clears.
71. The dashboard score did not move while the historic round was being edited.
72. As a **client**: no round selector, no editable scoring.

### K. Regression sweep

73. `(R)` Dashboard, Report, Chat, Plan and Funnel tabs all render without
    console errors. The re-homing touched `main.js` heavily.
74. `(R)` Pillar detail page: the side "Actions" panel still lists that pillar's
    actions and "+ Add" still works.
75. `(R)` Report tab: unassigned actions still appear under an "Unassigned"
    heading rather than vanishing.
76. `(R)` Upload a file at the root → still works, still validates (try an
    oversized or wrong-type file and confirm the rejection message).
77. `(R)` Download a file → signed URL opens.
78. `(R)` Resize to phone width (~400px). Action rows collapse to the two-line
    card; the filter bar stacks; the documents list drops uploader and date.
79. `(R)` Check the console once more across the whole session. **Any
    `permission-denied` is a finding**, not noise — it means rules and UI disagree.

---

## §5 — Cannot be verified here, in any configuration

State these in the outcome rather than leaving them looking covered.

- **Production deploy order.** Rules → backfill script → functions → client. The
  backfill must run before the client ships or every pre-v6 file vanishes from
  the documents list. Only exercisable against a real project.
- **Cloud Functions behaviour for `folder`** — soft-delete, restore, scheduled
  purge, and the six new audit-event literals. CI (`cd functions && npm test`)
  is the gate.
- **GDPR export coverage for folders** — deliberately not built. See
  `.planning/MILESTONE-v6-WORKFLOW-USABILITY.md` Phase H.
- **Action content edits are unattributed.** Nothing records that a client
  reworded an action. That is a consequence of the no-new-fields decision, not a
  bug to find here. `THREAT_MODEL.md` § Residual risks R2.

---

## §6 — Reporting

For each numbered test: `pass`, `fail`, or `blocked: <gate>`. On a failure,
capture the exact console error, the Firestore document as the emulator UI shows
it, and the steps that produced it.

Update the frontmatter `outcome:` with the tally when done. Do **not** mark a
test passed because a related test passed, and do not mark §4 passed if G3 was
never resolved — record it as blocked. A checklist that reports unrun tests as
green is worse than no checklist.
