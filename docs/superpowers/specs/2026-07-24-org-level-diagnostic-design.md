# Org-level diagnostic + client action completion — design

Date: 2026-07-24
Status: approved (Hugh, 2026-07-24)
Branch: `feat/org-level-diagnostic`

## Problem

The diagnostic currently keeps one answer sheet per client account per round
(`responses[roundId][accountId][pillarId][idx]`), with a navbar scope picker that
selects org → account. The business wants one shared diagnostic per organisation:
a single set of scores per round, the same sheet no matter which account is
selected. Separately, clients cannot complete actions on the Action plan — the
toggle UI renders for them, but the Firestore write is denied because actions
live inside the org document, whose update rule is internal-only.

## Decisions (from brainstorm)

- One diagnostic sheet per organisation per round. Scoring stays internal-only;
  clients keep a view-only diagnostic.
- Rounds are kept and stay fully independent: a new round starts blank; a
  round's score derives purely from the numbers pressed in that round.
  Historical displays (radar overlays, prev-round deltas) remain display-only.
- Scope picker keeps its current two-level structure (orgs → client accounts).
  Clicking an org row OR an account row selects that org and navigates to its
  dashboard. The diagnostic shows the org sheet regardless of selection.
- Existing per-account response data: clean wipe. New response docs use new IDs;
  old docs are never read again. A purge script is follow-up housekeeping
  (pattern: `scripts/purge-ghost-account`). No live users; this is agreed.
- Action plan: both clients and internal users can toggle an action done/undone
  by clicking its checkbox. Internal keeps full edit; clients may change ONLY
  completion fields, and only on non-internal actions. Existing actions are
  migrated, not wiped.

## Data model

### Responses (org-level)

- Local/org-doc mirror: `org.responses[roundId][pillarId][idx] = { score, ... }`
  — the account dimension is removed.
- Firestore: one doc per (round, pillar) at
  `orgs/{orgId}/responses/{roundId}__{pillarId}` with shape
  `{ orgId, roundId, pillarId, values: [], updatedAt }`. No `userId` subject
  field. Old three-part IDs (`roundId__userId__pillarId`) are ignored by
  rehydration (docs carrying a `userId` field are skipped) — that is the wipe.
- Rules (`firestore.rules` responses block): reads unchanged (`inOrg`); create
  requires `isInternal()` and `orgId` match; update requires `isInternal()`,
  `immutable("orgId")`, `mutableOnly(["values", "updatedAt"])`. All `userId`
  clauses are dropped.
- `viewedAccountId` / `firstAccountId` disappear from response paths.
  `accountsForOrg` and `state.accountId` remain (picker still lists accounts).
- Domain helpers (`domain/scoring.js` pillarScore/pillarScoreForRound,
  `domain/completion.js` answerSummaryForPillar) lose their account parameter.
- The pillar-page "Team responses" panel is deleted — there are no
  per-respondent answers anymore, and under the new keying it would misrender.

### Actions (subcollection)

- Move from the org doc's `actions` array to `orgs/{orgId}/actions/{actionId}`
  docs: `{ orgId, pillarId, title, owner, due, done, internal, createdAt,
  createdBy, completedAt, completedBy }` — matching the Phase 5 subcollection
  pattern used by responses and comments.
- Rules: read `inOrg(orgId)` and (internal, or `resource.data.internal == false`
  with the client list query constrained to `internal == false`, mirroring the
  comments `internalOnly` pattern). Create/delete internal-only. Update:
  internal (with `immutable("orgId")`, `immutable("createdAt")`), OR in-org
  client restricted to `mutableOnly(["done", "completedAt", "completedBy"])`
  on actions where `resource.data.internal != true`.
- Migration: one-shot, in-app. When an internal user loads an org whose doc
  still has an `actions` array, push each entry as a subcollection doc, then
  clear the array on the org doc (internal org-doc update is allowed). Guarded
  so it runs once. Acceptable because org count is small and only internal
  users trigger it.
- Local mirror: `org.actions` stays as the in-memory/localStorage shape,
  rehydrated from the subcollection (same approach as comments), so views need
  no structural change.

## UI behaviour

- Scope picker (`src/ui/chrome.js`): org row label click → select org, close
  panel, `setRoute("dashboard")`. The chevron still opens the account flyout;
  account click → select org + account, close panel, `setRoute("dashboard")`.
  Structure/CSS otherwise unchanged.
- Diagnostic index/pillar pages: unchanged visually except the Team responses
  panel is gone. Likert stays disabled for client views; `sel` highlight,
  pillar scores, and answered counts all read the org sheet.
- Dashboard/report: answered counts and scores are org-level; radar round
  overlays show the org's rounds.
- Action plan: checkbox toggle now enabled and persisted for clients as well
  as internal. Pillar-page side panel action lists stay display-only.

## Out of scope

- Purging orphaned per-account response docs from Firestore (follow-up script).
- Any change to chat, documents, engagement, auth, or the client-preview mode.
- Cloud Functions changes (none needed; CI does not deploy functions anyway).

## Testing

- Reshape `tests/fixtures/snapshot-org.json` responses to the org-level keying;
  update view snapshots (dashboard, diagnostic, report).
- Update `diagnostic-new-org.test.js` (regression from #92) and
  `diagnostic-client-readonly.test.js` to the new keying.
- New tests: same sheet regardless of selected account; new round starts blank
  and prior round data is untouched; client action toggle persists;
  `chrome.test.js` — org and account clicks navigate to dashboard.
- Rules emulator tests (`test:rules`, needs Java/scoop Temurin): new-shape
  response writes internal-only; client action `done` toggle allowed; client
  title edit denied; client toggle on internal action denied; client create
  denied.

## Sequencing note

Rules changes ship in the same PR as the code (CI deploys hosting+rules
together on merge). The new response/action doc shapes are written by the new
code only, so rules and code must land atomically — a normal squash merge.
