# Design: Client read-only diagnostics + static delivery-stage cards

Date: 2026-07-02
Status: awaiting user approval
Branch: `feat/client-readonly-diagnostic`

## Problem

1. Client logins can currently score the diagnostic (Likert buttons write to
   Firestore, and `firestore.rules` permits it). Product decision: clients
   should only **view** what has previously been done — no scoring, no
   mutating buttons — on the Diagnostic surfaces.
2. The four "Delivery framework" stage cards at the bottom of the Diagnostic
   page are click-to-highlight for staff (`setEngagementStage` sets
   `org.engagement.currentStageId`, which is read nowhere else). The
   highlight is decorative dead weight. Remove selectability for **all**
   roles — they become four static info cards.

## Scope

In scope: Diagnostic index (`renderDiagnosticIndex`), pillar detail
(`renderPillar` / `renderQuestion`), delivery-framework section
(`renderEngagement`), `firestore.rules` responses subcollection, associated
CSS and tests.

Out of scope: chat/comments, documents, roadmap, report content, any data
migration (existing `engagement.currentStageId` values and client-authored
responses stay in place — responses remain readable history).

## Design

### A. Client view-only diagnostic

All gating uses the existing `isClientView(user)` predicate (true for
`client` role and staff "client preview" mode, so previews mirror the client
experience exactly).

1. **Likert buttons** (`renderQuestion`): when client view, render the scale
   with no `onclick`, `disabled` attribute, and a `read-only` class on the
   likert container. Previously-saved answers keep the `sel` highlight so
   prior work is visible. CSS suppresses hover/cursor affordances under
   `.likert.read-only`.
2. **Diagnostic index copy** (client only):
   - Subtext: "View your responses here. If anything is empty, please
     contact Luke or George to complete it." (replaces "Score each pillar
     honestly…"; wording per the 2 Jul scope call — helper text covering
     the empty case).
   - Remove the "Your progress" completion banner.
   - Pillar tile tag: "team score N/100" (drops "X/Y of your answers ·").
3. **Pillar page** (client only):
   - Hide the "Complete" button (top "← Back to diagnostic" remains).
   - Hide the Actions panel "+ Add" button (list stays visible, already
     filtered to non-internal actions).
   - Section heading "Your responses" → "Diagnostic questions".
   - Team-responses panel, score block, and side panels unchanged.
4. **No staff behaviour changes** — staff scoring path (`setResponse` →
   `cloudPushResponse`) is untouched.

### B. Static delivery-stage cards (all roles)

- `renderEngagement`: render four plain `stage-card` divs — no `onclick`, no
  `active` class, no `read-only` variant.
- Delete `setEngagementStage()`.
- Delete the dead `stage` binding in `renderReport` (already
  eslint-disable-flagged as unused).
- CSS: remove `.stage-card.active`, `.stage-card.read-only` (+ its hover
  rule), and the brand-border hover on `.stage-card`; remove any pointer
  cursor so the cards read as non-interactive.
- Data shape untouched: `engagement.currentStageId` remains in org docs,
  seeds and fixtures; it is simply never read or written by the UI.

### C. Firestore rules (defense in depth)

`/orgs/{orgId}/responses/{respId}`:

- `create`: `inOrg(orgId)` → `isInternal()` (keep
  `request.resource.data.userId == request.auth.uid`).
- `update`: `inOrg(orgId)` → `isInternal()` (keep immutability +
  `mutableOnly` constraints).
- `read` / `delete`: unchanged (`inOrg` / `false`).

Rationale: UI-only gating leaves the write path open to any client with dev
tools — inconsistent with the Full Hardening Pass milestone. CI deploys
rules on merge to main.

Decision taken on recommendation while user was away — flagged for veto at
spec review.

## Error handling

No new error paths: client mutation affordances are removed rather than
rejected at runtime. If a stale client session still fires a write (e.g. a
tab open across the deploy), Firestore rejects with `permission-denied` and
the write drops silently (cloud-sync logs to console only — nothing
user-visible). Acceptable: no live client users, and the dropped write is
one product has decided clients must not make.

## Testing

- **View snapshots**: update diagnostic index (client + staff), pillar and
  report snapshots for the DOM changes. (Full-suite flake on these is
  pre-existing — see project memory.)
- **Unit**: client pillar page exposes no score `onclick` handlers and
  clicking a likert button does not call `setResponse`; staff path still
  writes; stage cards have no click handler for any role.
- **Rules tests**: client `create`/`update` on responses denied; internal
  and admin allowed; client `read` still allowed.
- Local gate before push: typecheck + lint + vitest (pre-commit hook only
  covers eslint/prettier).

## Alternatives considered

- **Blanket `pointer-events: none` wrapper** over the diagnostic subtree for
  clients — less code, but kills legitimate navigation clicks and leaves
  mutating buttons visible. Rejected.
- **Forked client render functions** — clean separation but duplicates
  render code while the modular split (Phase 4) is still in flight.
  Rejected.
- **Per-site gating with rules tightening** — matches existing gating
  patterns (`isClient` already gates export, internal panels, action
  filters). **Chosen.**
