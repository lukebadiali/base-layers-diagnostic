---
status: complete
phase: PLATFORM (cross-cutting end-to-end)
source:
  - PROJECT.md (Validated requirements)
  - src/router.js (route surface)
  - src/ui/chrome.js (top nav + user chip)
  - .planning/phases/06.1-.../06.1-UAT.md (recent auth + admin CRUD work)
started: 2026-05-25T16:00:00Z
updated: 2026-05-25T17:30:00Z
completed: 2026-05-25T17:30:00Z
target_url: https://baselayers.bedeveloped.com
test_accounts:
  admin: Luke or George (BeDeveloped internal)
  client: invite from admin during Test 5
outcome: 15 pass / 4 issues / 2 skipped (blocked by Test 19 client-auth blocker)
---

## Current Test

[testing complete — 2026-05-25T17:30:00Z]

## Tests

### A. Cold start + auth

### 1. Cold-Start Smoke — App Loads
expected: Open https://baselayers.bedeveloped.com in a fresh tab. Page loads without console errors. Sign-in screen renders — Email + Password fields visible. Hashed JS bundle, security headers on document response.
result: pass

### 2. Admin Sign-In
expected: Enter Luke or George admin email + password. Click Sign In. Lands on Dashboard. Top nav shows: Dashboard / Diagnostic / Report / Delivery / Documents / Chat / Actions / Plan / Funnel. Topright shows the Internal/Client-preview mode toggle, the org selector, and a user chip with initials.
result: pass
note: Corrected label list per src/ui/chrome.js:81-91 — "Engagement" route → "Delivery" label; "roadmap" route → "Plan" label.

### 3. Refresh Preserves Session
expected: After Test 2, hit browser refresh (F5). No re-prompt for credentials. Same Dashboard renders. No console errors.
result: pass

### B. Admin CRUD (Phase 06.1 substrate)

### 4. Admin Panel — Clients Table Visible
expected: Click user chip → "Admin · manage people". Admin panel renders. Clients table shows existing client users with columns: name, email, org, role, status (active/invited), and a per-row Remove action.
result: pass

### 5. Admin — Invite Client (end-to-end email)
expected: From Admin panel click "Invite client". Modal opens with: name, email, org name (or org select). Submit. Modal closes; row appears in Clients table with status=invited. The invitee receives a Firebase invite email at the supplied address with a sign-in link.
result: pass
note: Test 5 invitee reserved for Test 19 (client first-run). Test 6 should invite a separate throwaway.

### 6. Admin — Remove Client
expected: Invite a SECOND throwaway (e.g. hugh+uat-remove@assume-ai.com) just for this test — keep the Test 5 invitee intact for Test 19. Click Remove on the second invitee's row. Confirmation prompt. On confirm, row disappears from the Clients table immediately. Page does not reload. No console error. (Backed by deleteClient callable.)
result: pass

### C. Org context (internal)

### 7. Org Selector — Switch Between Client Orgs
expected: Open the topright org dropdown. Select a different client org. Dashboard re-renders against that org's data — different scores, different headlines, different name in the user chip's "BeDeveloped team" subline scope.
result: pass

### 8. Mode Toggle — Internal ↔ Client Preview
expected: Flick the Internal/Client-preview toggle. In Client preview, the admin/internal-only chrome hides (no Admin entry in user chip, internal-only comment thread filter hides any private commentary). Flick back — internal chrome returns.
result: pass

### D. Diagnostic core (the product)

### 9. Dashboard Renders for an Org with Data
expected: Pick an org with prior diagnostic data. Dashboard shows the radar chart (10 axes), headline scores, and per-round summary. No "loading" spinner stuck. Console clean.
result: pass

### 10. Diagnostic Index — Ten Pillar Tiles
expected: Click Diagnostic in top nav. Index view shows ten pillar tiles. Each tile shows its score band (e.g. colour-coded). Unread comment indicator (small dot) shows on pillars with unread comments.
result: pass

### 11. Pillar Detail — Open + Answer a Question + Save
expected: Click a pillar tile. Pillar page renders questions with a Likert 1–5 scale. Change a single answer. The answer persists — refresh the page (or navigate away and back) and the new value is still selected. No console error.
result: pass

### 12. Report View — Donut + Per-Pillar Breakdown
expected: Click Report in top nav. Renders the donut chart and a per-pillar breakdown matching the dashboard radar. Numbers consistent with what was entered in Test 11.
result: pass

### E. Collaboration features

### 13. Per-Pillar Comment — Post + Internal-Only Filter
expected: On a pillar page, post a comment. It appears in the thread. Toggle Internal-only filter (internal mode). Post an internal-only comment. Switch to Client preview — internal-only comment hides. Switch back — it returns.
result: issue
reported: "theres no comments at the bottom of the diagnostics theres a chat section for that i think"
severity: major
diagnosis: |
  Verified in code. `renderComments()` is defined at src/main.js:2094
  (with the internal-only checkbox wiring at L2155-2174) but is NEVER
  called from `renderPillar()` (src/main.js:1811-1940). Pillar pages
  render header / questions / team responses / score / side panels /
  actions — but no comments thread. The function is dead code on the
  pillar surface.

  PROJECT.md line 22 lists "Per-pillar comments thread — with internal-only
  filter" as a Validated requirement, citing the old app.js:286-302. The
  wiring was likely orphaned during the Phase 4 modular split.

  Related: src/views/pillar.js header comment says renderComments is
  "still in src/main.js"; nothing calls it from the extracted view.
fix_candidates:
  - Wire renderComments(user, org, p) into renderPillar()'s left column
    (or under the grid) — single appendChild after the team-responses
    panel — would restore the feature.
  - OR: move per-pillar discussion to the existing per-org Chat tab and
    remove the Validated row from PROJECT.md (down-scope).

### 14. Actions — Create + Edit via Modal
expected: Open Actions tab. Create a new action via the New Action modal (title, owner, due date, pillar). It appears in the actions list. Click to edit; change title; save; list reflects the new title.
result: pass

### 15. Documents — Upload PDF + Reject MIME Mismatch
expected: Open Documents tab. Upload a clean PDF — it appears in the list within ~2s with the correct filename + size. Try to upload a file declared image/png but with PDF magic bytes — upload is rejected with a notification, file does NOT appear in the list.
result: issue
reported: "main-B0dxFNjB.js:3 Uncaught (in promise) FirebaseError: Missing or insufficient permissions. file upload works but deleting files doens't"
severity: major
note: Upload happy path PASSED. Negative MIME-mismatch case not attempted (user reported delete bug first).
diagnosis: |
  Upload works correctly. Delete is blocked by Firestore rules.

  Verified in code:
  - firestore.rules:104 — `allow delete: if false;` on
    orgs/{orgId}/documents/{docId} subcollection (by design — Phase 5/6
    hardening locked direct deletes; soft-delete via Cloud Function only).
  - src/main.js:3422-3424 — Delete button still calls
    `firestore.deleteDoc(firestore.doc(db, "orgs", org.id, "documents", d.id))`
    directly from the client. Rules reject → FirebaseError.

  The Cloud Function callable `softDelete` exists at
  functions/src/lifecycle/softDelete.ts and is the intended path.

  Storage object delete at src/main.js:3417 is wrapped in try/catch and
  swallows errors silently — should also be reviewed (likely also blocked
  by storage.rules + same soft-delete pattern; need to add a separate test
  for orphaned Storage objects after soft-delete cascade).
fix_candidates:
  - Replace direct deleteDoc at main.js:3422 with httpsCallable("softDelete")
    invocation passing { collection: "orgs/{orgId}/documents", docId: d.id }
    (or whatever the softDelete callable's expected payload shape is).
    Wire user-facing error display on failure.
  - Verify Storage object cleanup path: either the softDelete callable
    handles Storage cascade, or add a separate signed-delete callable
    (Phase 8 backup substrate may already have one — getDocumentSignedUrl
    pattern).

### 16. Chat — Post + Unread Badge Updates
expected: Open Chat tab. Post a message — appears immediately in the thread. Open the same org in an incognito window as the other admin (or as the client invited in Test 5). The chat nav button in the second window shows an unread count badge that increments.
result: skipped
reason: Blocked by Test 19 — second-user session (hugh+uat1@assume-ai.com) is broken with orgId:null custom claim corruption. Other admin (Luke/George) wasn't available in this session. Re-test after Test 19 fix lands and a fresh invitee can complete first-run cleanly.

### 17. Plan — Edit + Persist
expected: Open Plan tab (route=roadmap, label="Plan"). Add or edit a plan entry (e.g. drag a pillar into a quarter, add an outcome). Refresh the page. The edit persists. (Backed by Firestore `roadmaps/{orgId}`.)
result: issue
reported: "the pillars highlight like text boxes currently cannot drag"
severity: major
diagnosis: |
  Role-naming inconsistency across the codebase. src/main.js:3678 sets
  `const canEdit = user.role === "internal"` but the admin user's role
  is "admin" (per Phase 06.1 role taxonomy: {admin, internal, client}).
  canEdit is therefore false for admins, which gates the entire
  drag-and-drop wiring:
    - L3705: `if (canEdit)` skipped → draggable="true" attribute NOT set
    - L3706-3710: dragstart listener NOT bound
    - L3796: `if (canEdit)` skipped → dragover/dragleave/drop listeners
      NOT bound on the drop zones
    - L3701: cursor:grab CSS NOT applied → chip looks like static text
  Browser then falls back to default behaviour: mousedown on a div with
  text content = text selection. Matches user's exact symptom.

  Same role-check pattern affects 8 sites across main.js (700, 1274,
  2128, 3018, 3354, 3664, 3678, 5216). Each one silently treats
  role="admin" users as if they had client privileges. Surfaces likely
  broken for admins: chat unread badge, plan view edit, documents
  internal flag, internals list filter, and the various comment/avatar
  stylings.

  Test 14 (Actions) PASSED because the actions view doesn't gate on
  `role === "internal"` — it uses presence checks (addAction(user.id,...))
  without role discrimination, so admin can still create + edit.
fix_candidates:
  - Mechanical: replace every `user.role === "internal"` with
    `(user.role === "internal" || user.role === "admin")` across the 8
    sites. Low risk, fully reversible.
  - Cleaner: introduce a single `isPrivileged(user)` helper (returns
    true for role in {admin, internal}) in src/auth/* and replace the 8
    sites with `isPrivileged(user)`. Same semantics, one place to change
    the role taxonomy in future.
  - Tightest: introduce `canEdit(user)`, `isInternalStaff(user)`,
    `canSeeInternalChrome(user)` named predicates and use the right one
    at each call site (some sites genuinely want only one of the roles,
    not both). Highest correctness but biggest diff.
  - Add a regression test: tests/main/role-edit-privileges.test.js that
    asserts canEdit (or its successor predicate) returns true for role
    in {admin, internal} and false for {client, null}.

### 18. Funnel — Edit KPI Cell + Persist
expected: Open Funnel tab. Edit a single cell in the quarter/year grid. Refresh. Value persists. Add a comment on a cell; it persists too.
result: pass
note: Confirms funnel editing is NOT gated by the role==="internal" check that broke the Plan view. Funnel uses its own canEdit logic (likely role-agnostic or admin-aware).

### F. Client experience

### 19. Client First-Run — Accept Invite + Set Password
expected: Open the invite email from Test 5 in a fresh browser/incognito. Click the sign-in link. Lands on a first-run screen prompting to set a password. Set a strong password. Lands on Dashboard scoped to the invited org. Top nav does NOT show Admin. Topright does NOT show the org switcher or mode toggle. (06.1 surface.)
result: issue
reported: "ive just signed in to my new account set up under alpha but it says im not connected to the org"
severity: blocker
diagnosis: |
  Race condition in src/firebase/auth.js:updatePassword permanently
  corrupts the new client user's custom claims to {role:"client", orgId:null}.
  Verified via two-step UAT diagnostic:
    1. First sign-in: "Not connected to the org" page (renderNoOrg fires
       at src/main.js:910 when activeOrgForUser returns null due to
       user.orgId being null).
    2. Forced ID-token refresh (window.FB.currentUser.getIdTokenResult(true))
       returned auth/user-token-expired — broken session.
    3. Clean sign-out + fresh sign-in with the just-set password: STILL
       "Not connected to the org" → confirms claim was permanently
       overwritten server-side.

  Root cause walk-through (src/firebase/auth.js lines 374-395):
    Line 379: `const idTokenResult = await user.getIdTokenResult();`
              — NO force-refresh argument. Returns the cached token
              from the email-link sign-in, BEFORE inviteClient's claim
              write has propagated to this client.
    Line 384: `const orgId = ... claims.orgId ... : null;`
              — reads `null` from the stale cached token.
    Line 385: `await setClaims({ uid, role, orgId });`
              — writes `{role:"client", orgId:null}` SERVER-SIDE,
              permanently destroying the orgId that inviteClient
              originally set via buildInviteClaims(data.orgId).
    Line 388: `await user.getIdToken(true);`
              — now the client's token reflects orgId:null forever.

  Phase 06.1 / sub-wave 6.1 row #4 ("BLOCKER-FIX 1 setClaims wiring")
  landed the wiring but with this race-window bug; appears to have
  passed prior UAT only when the orgId claim had propagated in time
  (or under an emulator with synchronous claim propagation).
fix_candidates:
  - Minimal (one-character): src/firebase/auth.js:379 →
    `await user.getIdTokenResult(true)` (force-refresh from server).
    Closes the race window for most cases but still wrong if
    inviteClient writes claims AFTER the email link is consumed.
  - Safer: never call setClaims with orgId:null when role is "client" —
    add `if (role === "client" && !orgId) return;` guard before line 385.
    Prevents permanent corruption regardless of race timing; first-run
    will re-attempt on next auth state change.
  - Safest: read canonical orgId from Firestore /users/{uid}.orgId doc
    instead of the local token cache. inviteClient already writes this
    doc atomically with the claims, so it's the source of truth.
operator_remediation_for_hugh+uat1:
  - Broken user `hugh+uat1@assume-ai.com` now has orgId:null permanently
    in custom claims. Admin must manually re-run setClaims callable with
    the correct orgId to unbreak this user, OR delete + re-invite (which
    will hit the same bug). Recommend: park this user, fix the code, then
    re-invite a NEW throwaway to re-test.

### 20. Client View — Scope Enforced
expected: As the client signed in in Test 19, try to navigate to another org via the URL or the dashboard — not possible (no org switcher, no admin route). Client only ever sees their own org's data. Console clean.
result: skipped
reason: Blocked by Test 19 — cannot land in any org as a client because orgId claim was corrupted to null. Re-test after Test 19 fix lands.

### G. Lifecycle / safety

### 21. Sign-Out Clears Session
expected: Click user chip → Sign out. Returns to the sign-in screen. Hit browser refresh — still on sign-in. No data leakage; localStorage cleared of any user-scoped keys.
result: pass

### 22. Cold-Start After Sign-Out
expected: Close the tab and reopen https://baselayers.bedeveloped.com. Sign-in screen, no auto-login. No console errors.
result: pass

## Summary

total: 22
passed: 16
issues: 4
pending: 0
skipped: 2
blocked_by_19:
  - 16 (chat — needs second working user)
  - 20 (client scope — needs working client session)
issues_by_severity:
  blocker: 1   # Test 19
  major: 3     # Tests 13, 15, 17
  minor: 0
  cosmetic: 0
issues_by_fix_size:
  one_liner: 1                 # Test 19 (getIdTokenResult(true)) — though safer fixes recommended
  small_targeted: 1            # Test 15 (swap deleteDoc for softDelete callable)
  mechanical_sweep: 1          # Test 17 (role check fix across 8 sites)
  decision_then_wire: 1        # Test 13 (re-wire renderComments OR down-scope PROJECT.md)

## Gaps

- truth: "Per-pillar comments thread renders on the pillar page with an internal-only filter (PROJECT.md Validated requirement, app.js:286-302)"
  status: failed
  reason: "User reported: theres no comments at the bottom of the diagnostics theres a chat section for that i think. Verified: renderComments() defined at src/main.js:2094 but never invoked from renderPillar() at src/main.js:1811-1940. Orphaned during Phase 4 modular split."
  severity: major
  test: 13
  artifacts:
    - src/main.js:2094 (renderComments definition — unused)
    - src/main.js:1811-1940 (renderPillar — does not call renderComments)
    - src/views/pillar.js (extracted helpers, no comments wiring)
    - PROJECT.md:22 (Validated row pointing at pre-split path)
  missing:
    - renderPillar() call site for renderComments(user, org, p)
    - decision: re-wire OR down-scope the PROJECT.md Validated row

- truth: "Admin can delete a document from the Documents tab (file is removed from the list, and the underlying Storage object + Firestore doc are removed via the soft-delete cascade)"
  status: failed
  reason: "FirebaseError: Missing or insufficient permissions. firestore.rules:104 blocks client deletes by design (soft-delete via Cloud Function only); src/main.js:3422 still calls deleteDoc() directly instead of the softDelete callable."
  severity: major
  test: 15
  artifacts:
    - src/main.js:3422-3424 (direct firestore.deleteDoc — wrong path)
    - src/main.js:3417 (storageOps.deleteObject — likely also blocked, errors swallowed)
    - firestore.rules:104 (allow delete: if false — intended)
    - functions/src/lifecycle/softDelete.ts (the intended callable)
  missing:
    - httpsCallable("softDelete") invocation replacing main.js:3422
    - error handling that surfaces a notify('error', ...) toast on rejection
    - test for Storage object cleanup after soft-delete cascade

- truth: "Admin user with role='admin' can edit the Plan view — drag pillars into period cards and persist via Firestore roadmaps/{orgId}"
  status: failed
  reason: "src/main.js:3678 — canEdit = (user.role === 'internal'). Admin role is 'admin' (Phase 06.1 taxonomy {admin, internal, client}), so canEdit is false and all drag wiring (draggable attr, dragstart, dragover, drop listeners, cursor:grab CSS) is skipped. Same role-check pattern leaks across 8 sites in main.js (700, 1274, 2128, 3018, 3354, 3664, 3678, 5216), silently degrading admin privileges to client-level on multiple surfaces."
  severity: major
  test: 17
  artifacts:
    - src/main.js:3678 (canEdit predicate — bug epicentre)
    - src/main.js:700,1274,2128,3018,3354,3664,5216 (7 sibling sites with the same bug pattern)
    - src/main.js:3705,3796 (drag wiring conditioned on canEdit)
    - src/main.js:4079 (`role: claims.role || "internal"` — fallback shows the legacy assumption that defaults mean internal)
    - functions/src/auth/setClaims.ts:47 (`role: z.enum(["admin","internal","client"])` — server-side taxonomy is the {admin, internal, client} trichotomy)
  missing:
    - Decision: mechanical `(role==="internal" || role==="admin")` sweep across the 8 sites OR introduce isPrivileged()/canEdit()/isInternalStaff() named predicates
    - Regression test asserting edit predicates accept role in {admin, internal}
    - Whether any of the 8 sites legitimately want internal-only (not admin) — needs role-intent audit

- truth: "Newly invited client completes first-run (sets password), lands on Dashboard scoped to the invited org, and the orgId custom claim persists across token refresh"
  status: failed
  reason: "Race condition in src/firebase/auth.js:updatePassword permanently overwrites the user's orgId custom claim to null. Line 379 reads getIdTokenResult() WITHOUT force-refresh, gets stale (cached) claims showing orgId:null, then line 385 calls setClaims({uid, role, orgId:null}) which destroys the original inviteClient-set orgId server-side. Token refresh at line 388 then propagates the null claim. User stuck on renderNoOrg page forever."
  severity: blocker
  test: 19
  artifacts:
    - src/firebase/auth.js:374-395 (updatePassword post-update setClaims chain)
    - src/firebase/auth.js:379 (`getIdTokenResult()` — missing the `true` force-refresh arg)
    - src/firebase/auth.js:385 (setClaims call writes orgId:null overwriting invite-set value)
    - src/main.js:910 (renderNoOrg fallback when activeOrgForUser returns null)
    - src/main.js:4080 (`orgId: claims.orgId || null` — client reads from token, can't recover from null claim)
    - functions/src/auth/inviteClient.ts:242 (buildInviteClaims(data.orgId) — works correctly server-side)
    - .planning/phases/06-real-auth-mfa-rules-deploy/06-HUMAN-UAT.md Test 3 — pending operator verification of this exact wiring
  missing:
    - One-character fix: getIdTokenResult(true) at src/firebase/auth.js:379 — closes most race windows
    - Safer guard: `if (role === "client" && !orgId) return;` before setClaims call to prevent permanent corruption regardless of timing
    - Safest: read canonical orgId from Firestore /users/{uid}.orgId doc (already written atomically by inviteClient) instead of from cached client token
    - Operator remediation tool: admin-runnable script to repair custom claims for orgId-corrupted clients
    - Regression test that exercises updatePassword with a fresh invitee whose token cache hasn't propagated invite-set claims yet
