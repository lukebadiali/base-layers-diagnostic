# Pre-merge UAT — `fix/additional-fixes`

Manual verification checklist for the fixes stacked on this branch. Work
through every item and mark it PASS before merging to `main`. Items here are
the things automated tests **cannot** confirm (live Firebase auth flows, real
client accounts, UI routing) — the unit/integration suites are green already.

Status legend: ☐ untested · ✅ pass · ❌ fail (note the issue inline)

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

## Upcoming fixes
_Add new items here as they land on the branch._
