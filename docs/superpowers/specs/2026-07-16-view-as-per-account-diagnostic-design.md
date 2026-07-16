# View-As + Per-Account Rounds & Progress Radar — Design

**Date:** 2026-07-16
**Status:** Approved (brainstorming) — pending spec review
**Author:** Claude + Hugh

## Problem

Reported while testing the platform:

1. **Diagnostic scores are team numbers, not individual.** `pillarScoreForRound`
   (`src/domain/scoring.js:23`) averages across *every* respondent in a round
   (`Object.values(byUser)`), returning a single team mean. There is no
   per-individual code path — the function takes no `userId`. The per-individual
   data exists (`orgs/{orgId}/responses/{roundId__userId__pillarId}`, hydrated
   into `org.responses[roundId][userId][pillarId]`); the scorer just collapses
   over it.
2. **Admins can pick an org but not a person.** The topbar org select
   (`src/ui/chrome.js:255`) sets `state.orgId`, but there is no account selector,
   so an admin cannot look at one individual's diagnostic.
3. **The radar overlays only current-vs-previous round, org-aggregated**
   (`drawRadar`, `src/main.js:1767`).

## Goal

Admins select an org, then select an **account** inside that org and "enter" it.
While entered, the diagnostic renders **that individual's** scores (out of 100,
averaged over only their own answers). Admins can select any **round** for that
account and **edit** its answers. Progress is shown as a radar that **overlays
all of that account's completed rounds**, each a distinct colour.

## Locked decisions (from brainstorming)

- **Saved sets = existing org rounds** (`org.rounds`, `newRound()` at
  `src/main.js:396`). Each account's answers within a round is their snapshot for
  that date. No new per-account snapshot concept.
- **View-as depth:** full render-as-account for the **diagnostic**; the only
  *writes* performed as the account are diagnostic answers. **Chat and documents
  stay org-level** — the admin posts to the organisation channel **as
  BeDeveloped/admin**, never as the account. Entering an account changes the
  diagnostic surface only.
- **Editing older rounds:** the admin can select an older round for the entered
  account and edit its stored answers directly.
- **Attribution:** cross-account answer edits are **audit-logged as the admin**,
  regardless of the UI rendering as the account. (Compliance-hardening milestone.)
- **Radar:** overlay **all** of the entered account's completed rounds, each a
  distinct colour, legend = round label + date, click-to-toggle (Chart.js native).
  Per-pillar tiles keep the latest-vs-previous delta, per account.
- **Defaults:** selecting an org **auto-enters the first account**; the viewed
  round defaults to the **latest**.
- **Admin-only.** Clients never see the account dropdown; their `accountId` is
  implicitly themselves — so the per-individual scoring fix also gives each client
  their own score with no extra UI.
- **No auth/identity swap.** Two lightweight view parameters
  (`state.accountId`, `state.viewRoundId`) drive everything; the admin stays
  authenticated as themselves.

## Architecture

Two new view-state fields, read everywhere the diagnostic is scored or rendered:

- `state.accountId` — userId of the entered account (admin), or self (client).
- `state.viewRoundId` — the round being viewed/edited for that account; defaults
  to `org.currentRoundId`. **Never mutates the org-shared `currentRoundId`.**

A helper resolves the effective account for any user:

```
viewedAccountId(user, org) =
  isClientView(user) ? user.id : (state.accountId ?? firstAccountOf(org))
```

### Components

1. **Account selector** (`src/ui/chrome.js`, beside org select ~`:255`).
   Admin-only `<select>` listing the org's client accounts
   (`users` where `role === "client"` and `orgId === org.id`). `change` sets
   `state.accountId`, resets `state.viewRoundId` to latest, re-renders. Switching
   org auto-selects the first account.

2. **Per-individual scoring** (`src/domain/scoring.js`).
   `pillarScoreForRound(org, roundId, pillarId, DATA, questionMeta, userId)`
   reads `byUser[userId]` only, instead of iterating `Object.values(byUser)`.
   `pillarScore` gains the same `userId`. `completion.js orgSummary`,
   `topConstraints`, banding copy, tiles, pillar detail, report, and radar all
   pass the viewed account. Unanswered pillars → `null` → "—".
   Banding copy shifts from "Your team scored…" to "You scored…".

3. **Round selector + editing** (extend `renderRoundBar`, `src/main.js:1687`).
   Dropdown of the entered account's rounds sets `state.viewRoundId` (default
   latest). The diagnostic form renders the account's answers for
   `state.viewRoundId` and stays editable. `setResponse` (`src/main.js:2175`)
   writes to `(viewedAccountId, state.viewRoundId)` rather than hardcoded
   `user.id` / `currentRoundId`. Each cross-account edit emits an audit entry.

4. **Progress radar** (`drawRadar`, `src/main.js:1767`).
   Build one dataset per completed round for the entered account
   (`pillarScoreForRound(org, round.id, pillar, …, accountId)`), each with a
   distinct colour from a fixed palette, legend label = `round.label` + date,
   Chart.js legend `onClick` toggles visibility. Tiles: latest-round score with
   up/down delta versus the account's previous round.

### Data flow

```
Firestore orgs/{orgId}/responses/{roundId__userId__pillarId}
  → live listener hydrates org.responses[roundId][userId][pillarId]   (unchanged)
  → viewedAccountId(user, org) picks the userId
  → pillarScoreForRound(..., userId) scores that individual
  → tiles / pillar detail / report / radar / overall-health render it
Edit: form → setResponse(accountId, viewRoundId, pillarId, idx)
  → writes response doc + audit-log entry (admin attribution)
```

## Security rules

Response docs currently allow a user to write only their **own** `userId`.
Add a predicate: an **internal** user may write a response doc whose `userId`
belongs to a client of the same org. Clients remain self-only. Covered by a new
`tests/rules/*.test.js` cell (admin can write another user's response; client
cannot).

## Audit

Cross-account answer edits write an audit-log entry: actor = admin uid, subject =
account userId, org, round, pillar, question index. Reuse the existing audit-log
writer from the hardening milestone.

## Testing

- **Unit (`scoring.js`):** a round with two users' answers → `pillarScoreForRound`
  with `userId=A` returns A's own mean, not the team mean. Failing test written
  first (reproduces the reported bug).
- **Unit (radar builder):** N completed rounds → N datasets with correct
  per-round per-pillar values and distinct colours.
- **Unit (write path):** `setResponse` targets `(accountId, viewRoundId)`.
- **Rules:** internal writes another user's response (allowed); client writes
  another user's response (denied).
- **Regression:** a client viewing their own diagnostic is unchanged; the org
  round bar / current-round behaviour for shared org state is unchanged.

## Out of scope (YAGNI)

- Full impersonation of chat/documents (explicitly excluded — chat is org-level).
- Per-account snapshot cadence independent of org rounds.
- A multi-select "compare these two rounds" picker (overlay-all + legend toggle
  replaces it).
- Any auth/session identity swap.

## Related work (separate, smaller workstream — not this spec)

- **Bug #1 — auth splash flash:** flip `state.authResolved` only once `fbUser`
  resolves (`src/main.js:4085` vs `:4156`); stop the 2.5s safety-net timeout
  (`:4291`) from falling through to the homepage+login.
- **Bug #3 — chat count:** scope the chat-adjacent count to the currently open
  org (`unreadChatTotal`, `src/domain/unread.js:84`), keep the notification bell
  global across all orgs, and exclude `deletedAt` docs from the live count
  listeners (`src/main.js:734`, `:3664`, `:4901`).
