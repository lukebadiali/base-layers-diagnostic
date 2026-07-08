# Design: Staff notification bell — chat + document activity across orgs

Date: 2026-07-06
Status: implementing (user directive: complete all Baselab-Next-Steps-Scope.md items)
Branch: `feat/notification-bell` (stacked on `feat/scope-ux-polish` / PR #81)
Scope source: `Baselab-Next-Steps-Scope.md` item 7 (call with Luke, 2 Jul 2026):
"a notification bell in the portal that surfaces new chat messages and
document updates, ideally showing which client the activity relates to.
(Chosen over email notifications for simplicity; the team will keep the
portal open.)"

## Decisions (taken autonomously; veto at review)

1. **Staff-only.** The ask is team-facing ("which client", "the team will
   keep the portal open"). Clients keep their existing in-view badges.
2. **Read-markers stay in localStorage, derived from surface visits — the
   bell has no seen-state of its own.** The existing chat unread marker is
   already per-browser localStorage (`baselayers:chatLastRead:{userId}`,
   written when the Chat view renders — src/main.js:632-637, NOT the dead
   Firestore `setChatRead` in src/data/read-states.js). The bell counts
   "activity since you last visited that org's chat / documents page";
   clicking a row navigates there, the view marks it read, the badge
   decrements naturally. Documents gain a parallel marker
   (`baselayers:docsLastSeen:{userId}` → `{[orgId]: iso}`), written when
   the Documents view renders. No Firestore rules changes needed (staff
   already have blanket read via `isInternal()` in `inOrg()`;
   readStates' `mutableOnly` whitelist stays untouched). Limitation
   (accepted, matches existing chat behavior): markers are per-browser.
3. **Fix the dead staff chat substrate as part of this feature.**
   `startChatSubscription` (src/main.js:663-689) targets
   `user.orgId || state.activeOrgId`; `state.activeOrgId` does not exist
   (state.js defines only `state.orgId`), so for staff the guard returns
   early and `state.chatMessages` is always empty — today's topbar chat badge
   and tab-title badge are dead for staff. The bell replaces this
   single-org subscription with per-org listeners (below); the old
   function is deleted.

## Architecture

### Data layer (main.js IIFE, post-auth, ALL users)

`startActivitySubscriptions(user)` — called from the signed-in
`onAuthStateChanged` path for every user; torn down on sign-out. Staff
subscribe per org meta in `loadOrgMetas()` (kept fresh by `_subscribeOrgs`;
resync listeners when the org-id set changes); clients subscribe to their
single `user.orgId`. Running it for clients keeps their working chat nav
badge alive once `state.chatMessages` is deleted (see below).

- `onSnapshot(query(orgs/{orgId}/messages, orderBy("createdAt","desc"),
  limit(30)))` → `state.activity.messages[orgId]` = docs **stamped with
  orgId client-side** (message docs deliberately don't carry orgId —
  main.js:3525). The window.FB firestore shim exposes query/orderBy/limit
  (src/firebase/db.js:80-85).
- Same for `orgs/{orgId}/documents` → `state.activity.documents[orgId]`.

Unsubscribe handles keyed by `type:orgId` in a closure-scoped map (NOT in
render functions — the existing per-render Documents onSnapshot leak is a
known concern, don't repeat it). Each snapshot calls `render()`.

### unreadChatTotal repoint (revives four dead consumers)

The existing wrapper (main.js:510-525) reads `state.chatMessages`, which
is empty for staff (the `state.activeOrgId` bug). Repoint it to
`Object.values(state.activity.messages).flat()` — the orgId stamp is
exactly what `_unreadChatTotal`'s staff branch needs. This revives, with
no signature changes: the chat nav badge (chrome.js:100), the staff
dashboard unread-client-chat banner (main.js:1318), the tab-title badge
(main.js:703), and keeps the client path working. The 30-doc cap makes
these counts floor at 30 per org — acceptable.

### Domain (pure, new file src/domain/activity.js)

```
activitySummary(orgMetas, activity, markers, selfUid, nowFloorMs?) →
  { total, orgs: [{ orgId, orgName, chatCount, docCount, latestMs }] }
```

- chatCount: messages in `activity.messages[orgId]` with
  `createdAt.toMillis() > markers.chatLastRead[orgId]` and
  `authorId !== selfUid`.
- docCount: same over documents with `uploaderId !== selfUid` and marker
  `markers.docsLastSeen[orgId]`.
- Missing marker = epoch 0 (everything counts) — first-run floods are
  acceptable for a 3-person team; visiting the surfaces clears them.
- Orgs with zero activity omitted; sorted by `latestMs` desc.
- `createdAt` duck-typed via `toMillis()` (serverTimestamp shape), null
  `createdAt` (pending server write) counts as now.
- JSDoc-typed, no Firebase imports (domain purity is lint-enforced).

### UI (src/ui/chrome.js)

Bell button in `topright`, BEFORE the mode toggle, staff only (inside the
existing `!isClient` gate). New deps entry `activitySummary: () => summary`
(main.js wires the domain call with live state/markers — chrome stays
DI-pure like the existing unread deps).

- `.bell-btn` (`aria-label="Activity notifications"`, `aria-expanded`)
  with a minimal inline SVG bell glyph (16×16, stroke currentColor — the
  no-emojis-in-source convention rules out the Unicode bell).
- `.count-badge` overlay when `summary.total > 0` (reuse
  `.nav-btn .count-badge` styling vocabulary; cap display at "30+").
- Click toggles `.bell-panel` dropdown (absolute, right-aligned under the
  topbar; closes on outside click / Escape; only one instance). Each org
  row: org name + "N new message(s)" and/or "N new document(s)" as
  separate lines; clicking the chat line → `state.orgId = orgId`,
  route "chat", render; document line → route "documents". Panel empty
  state: "No new activity."
- Keyboard: button is a real `<button>`; panel rows are `<button>`s.

### Tab title

`updateTabTitleBadge` (main.js:700-706) switches from the broken
`unreadChatTotal(user)` to `activitySummary().total` for staff.

### Deletions

- `startChatSubscription` + all `state.chatMessages` writes/reads (its
  consumers move to the activity store via the unreadChatTotal repoint;
  the Chat view is unaffected — it runs its own independent listener).

## Out of scope

Email notifications; client-facing bell; per-account (Firestore) markers;
message/document previews in the panel; mark-all-read affordance (visiting
the surface IS the read action); rules changes.

## Testing

- src/domain/activity.js unit tests: counts, self-exclusion, marker
  boundaries (>= vs >), missing markers, null createdAt, sort order,
  zero-activity omission, cap-at-30 display handled in UI not domain.
- chrome tests: bell hidden for clients; badge count rendering; panel
  open/close; row click navigation callbacks (DI-stubbed).
- View-level: docsLastSeen marker written when Documents renders (extend
  existing pattern tests if any; else assert via localStorage in a boot
  test).
- No rules tests (no rules changes).
- Local gate: lint, typecheck (no new errors), affected files in
  isolation; documented full-suite flake stands.
