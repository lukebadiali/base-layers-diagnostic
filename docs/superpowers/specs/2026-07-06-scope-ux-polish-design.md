# Design: Scope-call UX polish — stale auth toast, pending spinners, Client label

Date: 2026-07-06
Status: implementing (user directive: complete all Baselab-Next-Steps-Scope.md items)
Branch: `feat/scope-ux-polish` (stacked on `feat/client-readonly-diagnostic`, PR #80)
Scope source: `Baselab-Next-Steps-Scope.md` items 1, 2, 6 (call with Luke, 2 Jul 2026)

## Item 1 — Authenticator "invalid" error after login

**Root cause (investigated):** error toasts are sticky by design
(`AUTO_DISMISS_MS.error = null`, src/ui/toast.js) and `#toastRoot` hangs off
`document.body`, outside the `#app` re-render. A wrong/expired TOTP code on
the MFA challenge fires `notify("error", "Invalid verification code")`
(src/views/auth.js:360 via `MfaCodeInvalidError`); when the user retries
successfully, sign-in completes and the app renders — with the stale sticky
toast still pinned at the top. Matches the report exactly ("invalid message
at the top of the screen after logging in via the Authenticator app").
TOTP codes rotate every 30s, so an innocent expired-code failure before a
successful retry is a common path. Same latent bug exists for
wrong-password-then-retry.

**Fix:** new `dismissAllToasts()` export in src/ui/toast.js (clears
`#toastRoot`). Called at the single signed-in chokepoint: the non-null
branch of the `fbOnAuthStateChanged` callback in src/main.js (~3980),
before hydration. This fires after `resolveSignIn` (MFA path) and after
plain password sign-in, covering both retry paths.

**Deliberately NOT in the signed-out branch:** the 30-day session-expiry
path raises "Your session has expired — please sign in again" immediately
before `signOut()` re-fires the callback with null — dismissing there would
wipe that message. In-app error toasts stay sticky (D-14) since
`onAuthStateChanged` fires on auth transitions, not token refresh.

## Item 2 — Loading spinners

Vocabulary: existing `pendingButton` helper (src/ui/pending-button.js,
PR #78) — `.is-loading` spinner + disabled + label swap.

**2a. Modal-driven actions (diagnostic/pillar action buttons).** The
surfaces' mutating buttons funnel through `promptText` / `confirmDialog`
(src/ui/modal.js): the pillar Actions "+ Add", org create, and the
confirmDialog-gated deletes whose Cloud Function calls can cold-start for
seconds with zero feedback (modal closes instantly today even if the work
fails). Change both helpers to support async callbacks, backwards
compatible:

- If `onSubmit`/`onOk` returns a thenable: `pendingButton(ok, "Saving…")`
  (confirmDialog: `"Working…"`) starts, Cancel disabled, modal closes on
  resolve; on reject `stop()` + `notify("error", err.message)`, modal stays
  open.
- Sync callbacks (return undefined): behave exactly as today — close
  immediately. No call-site changes required in this phase; call sites can
  adopt async returns incrementally.

**2b. MFA setup QR generation.** `renderMfaEnrol` (src/views/auth.js:233)
renders an `<img>` with no `src` while `startMfaEnrolFlow` (src/main.js:1017)
does a Firebase round-trip + dynamic ~80KB `qrcode` import + `toDataURL` —
a broken-image gap. When `deps.qrcodeDataUrl` is empty, render a
`.qr-code-loading` placeholder (same box size as `.qr-code`, spinner +
"Generating QR code…") instead of the empty img; the existing `render()` on
completion swaps in the real QR. Add matching CSS reusing the `.is-loading`
spinner keyframes.

## Item 6 — Rename "Client Preview" → "Client"

src/ui/chrome.js:147: mode-toggle label text `"Client preview"` → `"Client"`
(the `"Internal"` branch is unchanged). Verified the toggle is already
staff-only: it renders inside `if (!isClient)` (chrome.js:139), and role
`client` can never reach `state.mode` handling (`effectiveRole` returns
"client" before consulting `state.mode`, src/main.js:803-804). The scope's
"confirm clients cannot see or toggle it" is satisfied by existing code; a
test asserts the gate.

## Out of scope

Items 3/4/5 (shipped in PR #80); item 7 notification bell (own spec/plan
next); any change to the D-14 sticky-error contract inside the app.

## Testing

- toast: unit tests for `dismissAllToasts` (clears error + info toasts;
  safe when no container exists).
- modal: async `promptText` onSubmit — pending state during a controlled
  promise, close on resolve, stays-open + error toast on reject; sync
  callback regression (closes immediately). Same for `confirmDialog`.
- auth wiring: boot-level test that a pre-existing error toast is removed
  when the signed-in render happens (drive `fbOnAuthStateChanged` via the
  existing view-test boot pattern if feasible; otherwise unit-test the
  chokepoint's dismiss call is reachable — implementer judgement, no
  Firebase emulator required).
- chrome: label test — mode=external shows "Client"; mode toggle absent for
  client role (existing coverage may already assert this — extend, don't
  duplicate).
- Local gate: typecheck + lint + affected vitest files in isolation
  (documented full-suite flake stands).
