# Pre-merge UAT — `fix/additional-fixes`

Manual verification checklist for the fixes stacked on this branch. Work
through every item and mark it PASS before merging to `main`. Items here are
the things automated tests **cannot** confirm (live Firebase auth flows, real
client accounts, UI routing) — the unit/integration suites are green already.

Status legend: ☐ untested · ✅ pass · ❌ fail (note the issue inline)

---

## 0. Prerequisite — DO THIS FIRST (before any testing)

**Lower the Firebase Identity Platform password policy.** The company passphrase
doubles as the client's first sign-in password, so the platform minimum must
match the new code floor (6) — otherwise 6-char passphrases brick clients at
first sign-in with `auth/password-does-not-meet-requirements`. This is a console
change (no working gcloud/firebase auth in the dev env to script it).

- [ ] ☐ Firebase console → project **`bedeveloped-base-layers`** →
      **Authentication → Settings → Password policy**:
  - set **Minimum length = 6**
  - turn **off** any "require non-compromised / leaked password" enforcement
    (a 6-char passphrase will otherwise be rejected as compromised)
  - keep enforcement **mode = Enforce**
- [ ] ☐ Confirm the change saved (the policy panel shows min length 6).

Until this is done, section 2 below (and any client invited under a 6-char
passphrase) will fail.

---

## 1. MFA required for client sign-ins
**Commit:** `f755001` feat(auth): require MFA enrolment for client sign-ins
**Why manual:** the enrol gate lives in `render()`'s IIFE ladder, which has no
test harness; only the `mfaEnrolmentRequiredForRole` predicate is unit-tested.

- [ ] ☐ Sign in as a **client with no enrolled factor** → lands on the
      "Enrol two-factor authentication" screen (not the dashboard).
- [ ] ☐ From that screen, the **only** escape is **Sign out** (no skip / no
      way into the app without enrolling).
- [ ] ☐ Complete TOTP enrolment (scan QR, enter 6-digit code) → reaches the
      app dashboard.
- [ ] ☐ Sign out and back in → Firebase **challenges** for the TOTP code.
- [ ] ☐ Forgot-2FA recovery still works for a client (email-link → un-enrol →
      re-enrol).
- [ ] ☐ Regression: an **internal/admin** user with MFA already enrolled signs
      in unaffected (straight to app, no re-enrol prompt).

---

## 2. Company passphrase minimum lowered 12 → 6
**Commit:** `aa5795f` feat(auth): lower org passphrase floor 12 to 6
**Requires section 0 done first** — the platform password policy must already be
lowered to 6, or the sign-in checks below will fail.

- [ ] ☐ Settings → Set passphrase accepts a **6-char** passphrase (rejects 5).
- [ ] ☐ Invite a client under a 6-char passphrase → that client can **actually
      sign in** with it (not bricked with "password does not meet requirements").
- [ ] ☐ Regression: internal/admin users with existing ≥6-char passwords still
      sign in.

## 3. Create + delete internal members from the admin page
**Commits:** `764ecac` feat(functions): inviteInternal + deleteInternal · `8727d55` feat(admin): add + remove internal members
**Why manual:** the callables are unit-tested but the live Admin-SDK path
(createUser, setCustomUserClaims, /users mirror) and the admin UI only run
end-to-end against real Firebase.

> **Deploy gap found 2026-06-08 (blocks live test — NOT a code defect).** The
> `inviteInternal` / `deleteInternal` callables **and** their `firebase.json`
> hosting rewrites were committed (764ecac) but never deployed. The functions are
> now deployed to prod manually, but the **hosting rewrites are still not live**
> (deployed hosting predates them), so `baselayers.bedeveloped.com/inviteInternal`
> falls through to the SPA catch-all (`** → /index.html`) and the browser reports
> a CORS error. Verified via `OPTIONS`: `getDocumentSignedUrl` → 204 + ACAO (hits
> the function); `inviteInternal` → 200 `text/html` (SPA). **Resolves on the
> merge/CI hosting deploy.** A local hosting deploy is blocked (prod build needs
> `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`, absent from `.env.local`). **Re-test §3
> after hosting deploys.**

Create:
- [ ] ☐ Admin → Admin page → Internal team → **"+ Add internal member"** opens a
      modal with Name, Email, and a **Role selector (Internal / Admin)**.
- [ ] ☐ Submit → success modal shows a **temporary password** (shown once) with
      a working **Copy** button.
- [ ] ☐ New member appears in the **Internal team** list immediately.
- [ ] ☐ New member signs in with email + temp password → forced to set their own
      password (firstRun) → **forced MFA enrol** → reaches the app.
- [ ] ☐ Create with **Admin** role → the new account has admin privileges.
- [ ] ☐ Adding an **email that already exists** → clean "account already exists"
      error, no account changed.

Delete:
- [ ] ☐ Internal team **Remove** on another member → they are gone from the list
      AND can no longer sign in (Firebase Auth user actually deleted, not just
      local cache).
- [ ] ☐ Your **own** row shows "you" (no Remove) — and if forced, the server
      refuses self-deletion (lock-out guard).
- [ ] ☐ Only **admins** see/act on Add + Remove (internal-role staff cannot mint
      or remove members).

---

## 4. Diagnostic → Delivery framework — checklist removed, stage 4 renamed
**Change:** `renderEngagement` + `data/pillars.js` / `public/data/pillars.js` — drop the
per-stage checklist (and its progress bar + "X/Y complete" meta); rename stage 4
**BeDeveloped → Develop**.
**Why manual:** the rendered DOM is covered by the `tests/views/diagnostic.test.js`
snapshot (no checklist, name "Develop"), but the live browser render + the
stage-card click interaction + the client read-only view are not.

- [ ] ☐ Diagnostic tab → **Delivery framework** shows exactly **four** stage cards:
      **Diagnose · Design · Deploy · Develop** (stage 4 reads "Develop", **not**
      "BeDeveloped").
- [ ] ☐ There is **no checklist** below the cards, and **no progress bar / "X/Y
      complete"** text on any card.
- [ ] ☐ (Internal view) Clicking a stage card highlights it as the active stage and
      **persists** (reload → same stage highlighted).
- [ ] ☐ (Client view) The cards render **read-only** — clicking does nothing.

---

## 5. Documents → private upload removed (org-shared only)
**Change:** `renderDocuments` — removed the "Private (only I can see it)" checkbox
and the client-side `visibility` / `allowedUserIds` filter. Every uploaded document
is now visible to everyone in the org.
**Why manual:** the Documents view runs against live Firebase Storage + Firestore
(no snapshot harness — it renders "Connecting to shared storage…" without FB).
**Security note (no server change needed):** "private" was only ever a client-side
filter — `storage.rules` grants read to any org member (`allow read: if inOrg`) and
`getDocumentSignedUrl` authorises on org membership only, never on `visibility`/
`allowedUserIds`. Removing it makes the UI honest; it does not widen real access.

- [ ] ☐ Documents tab → upload toolbar shows **only** "+ Upload file" — **no
      "Private" checkbox**.
- [ ] ☐ Upload a file → it appears in **Files** for everyone in the org, with **no
      "· private"** tag on any row.
- [ ] ☐ Sign in as a **client** in that org → sees all the org's documents; download
      works; staff-only delete still soft-deletes.
- [ ] ☐ Sanity-check the target Firestore for any **pre-existing `visibility:
      "private"` docs** — they will now be listed to all org members (acceptable
      while between engagements; flag if any must stay hidden).

**Document download 500 — RESOLVED 2026-06-08 (separate pre-existing infra bug, not this branch).**
`getDocumentSignedUrl` ran as the default compute SA (no `signBlob`), signed a
non-existent `-uploads` bucket, and forced no download. Fixes (code): pinned
`storage-reader-sa`, pointed signing at the real bucket
`bedeveloped-base-layers.firebasestorage.app`, added `Content-Disposition: attachment`.
**Prod IAM applied (the Phase-8 SAs had never been created):** created
`storage-reader-sa` + `gdpr-reader-sa`; granted each `serviceAccountTokenCreator` on
itself; `storage-reader-sa` → `objectViewer` on the bucket; `gdpr-reader-sa` →
`datastore.viewer` + `objectAdmin` (backups); `serviceAccountUser` (actAs) to the
deployer + `github-actions-deployer`. **Open follow-ups:** redeploy `gdprExportUser`
(same SA fix, code already done) and fix `gdprEraseUser`'s ghost-bucket constant.

---

## Known pre-existing flakes (NOT introduced by this branch)
Surfaced while verifying — present on `main`, unrelated to these fixes. The
plain test suite (`npm test`) is fully green (646 pass); these only appear under
`npm run test:coverage` (what CI runs) and may intermittently fail it:
- **View snapshot timeouts:** `tests/views/{dashboard,diagnostic,report}.test.js`
  render large views (~4s each); under v8 coverage instrumentation they can
  exceed the test timeout on a slow/loaded machine. Pass reliably without
  coverage.
- **`src/data/**` branch threshold (90%) flaps:** `src/data/rate-limit.js` keys
  a branch on `Date.now()` minute-windows, so branch coverage is time-dependent
  and occasionally dips below 90%.
Worth a separate hardening pass (raise snapshot timeouts; inject a clock into
rate-limit) but out of scope for these features.

## Upcoming fixes
_Add new items here as they land on the branch._

### Fractional role (DESIGNED — NOT YET BUILT · not a merge gate)
A restricted **Fractional** option for the Add-internal-member modal. Agreed design:
store as `role: "internal"` + a `fractional: true` flag; on the front end, grey out
(disable, non-clickable) every nav tab except **Documents · Actions · Plan**, plus a
route guard so a persisted/bookmarked route can't render a greyed view. **UI
convenience only — explicitly NOT a server-side access control** (Firestore/Storage
rules unchanged; the account retains internal-level data access). Parked pending a
go-ahead to build. **Do not test in this pass — it does not exist yet.**
