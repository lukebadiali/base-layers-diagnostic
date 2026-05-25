---
phase: 06.1
phase_name: client-auth-completion-firebase-auth-inviteclient-callable
status: closing
phase_06.1_active_rows: 0
closed_at: 2026-05-22
last_updated: 2026-05-22
---

# Phase 06.1 Cleanup Ledger — Client Auth Completion (Firebase Auth + inviteClient callable)

**Authored:** 2026-05-22 (Wave 3 close).
**Status:** zero-out gate active. Phase 06.1 closes HANDOFF.md follow-up #9 (Phase 6 verification gap); no in-phase active rows remain.

This ledger applies the Phase 4 / 5 / 6 / 7 / 8 / 9 / 10 / 11 close pattern: the zero-out gate `phase_06.1_active_rows: 0` is the binary close criterion. The ledger maps each in-phase row to its closure event + commit SHA, then enumerates the carry-forward operator-deferred rows + forward-tracking rows queued for future phases.

---

## Closed rows (in-phase)

| Row | Closure event | Commit SHA |
|-----|---------------|------------|
| C-06.1-01 | Wave 1 Task 1 RED — passphrase policy + AUTH-12 error classes + invite-builder helpers (failing tests committed first per TDD cadence) | `b158044` |
| C-06.1-02 | Wave 1 Task 1 GREEN — ≥12-char passphrase floor enforced at `setOrgClientPassphrase` chokepoint + 3 AUTH-12 error classes (`PassphraseInvalidError` / `CrossOrgError` / `PassphraseNotSetError`) + pure-logic invite-builder helpers (`verifyOrgPassphrase` / `buildInviteClaims` / `decideInviteOutcome`) | `fb15d27` |
| C-06.1-03 | Wave 1 Task 2 — 4 new server-only audit-event enum entries + `inviteClient.ts` Pattern A callable skeleton (HttpsError unimplemented body until Wave 2) | `1e2827f` |
| C-06.1-04 | Wave 2 Task 1 RED — `inviteClient` unit tests + hash-parity tests | `268849d` |
| C-06.1-05 | Wave 2 Task 1 GREEN — `inviteClient` body filled (org-passphrase verify + getUserByEmail catch-only-user-not-found + decideInviteOutcome branch + createUser/updateUser + setCustomUserClaims + writeAuditEvent) + server-side `hashString` parity helper + barrel re-export | `0ed0e2d` |
| C-06.1-06 | Wave 2 Task 2 RED — `invite-admin.js` wrapper smoke + 3-error mapping tests | `2d77316` |
| C-06.1-07 | Wave 2 Task 2 GREEN — `src/cloud/invite-admin.js` Pattern D wrapper + AUTH-12 server-code → typed-error mapping | `4570d85` |
| C-06.1-08 | Wave 2 Task 3 RED — invite-modal source-shape tests + inviteClient integration suite + admin-sdk mock extension | `b626c53` |
| C-06.1-09 | Wave 2 Task 3 GREEN — Invite modal rewire to inviteClient + Instructions modal copy revision (no "share separately" wording) + admin-sdk mock extended with stateful getUserByEmail/createUser/updateUser + `_seedUser` inspector helper | `6ad58bf` |
| C-06.1-10 | Wave 3 atomic cutover commit — legacy substrate deletion across 8 zones in a single commit (`src/auth/state-machine.js` + `tests/auth/state-machine.test.js` + `tests/fixtures/auth-passwords.js` + `setUserPassword` + tabs UI + legacy client sign-in branch + `openChangePasswordModal` + 2 wrapper imports + `src/ui/chrome.js` Change-password menu entry + Admin Clients table passwordHash zones); closes HANDOFF.md follow-up #9 | `6c1e89e` |
| C-06.1-11 | Wave 3 Task 2 — `scripts/strip-legacy-user-passwords/run.js` (Admin SDK ADC defensive strip script with `--dry-run` / `--verify` / `--help`) + README + `runbooks/06.1-app-check-backoff.md` body fill | `59ff2a6` |
| C-06.1-12 | Wave 3 Task 3 — SECURITY.md § Client Authentication + § Phase 06.1 Audit Index + REQUIREMENTS.md AUTH-16/17/18 rows + Traceability entries + ROADMAP.md Phase 06.1 placeholder replaced with full goal + 7 success criteria + 3 plans | `9080964` |
| C-06.1-13 | Wave 3 Task 4 — `runbooks/phase6-mfa-recovery-drill.md` § Client users extension (Tier-2 Admin SDK un-enrol + inviteClient resend + re-enrol; 4-event audit trail) + this cleanup ledger zero-out (STATE.md narrative reconciliation deferred to orchestrator per worktree parallel-execution instructions) | `ebaf052` |
| C-06.1-14 | Wave 3 Task 4.5 — SHA back-fill — substituted literal Task-1 cutover SHA `6c1e89e` into SECURITY.md (2 sites — § Client Authentication "Legacy substrate deletion" prose + § Phase 06.1 Audit Index AUTH-17 row; placeholder text replaced). Self-references this commit. | (this commit — `docs(06.1): wave 3 task 4.5 — SHA back-fill into SECURITY.md + cleanup-ledger`) |

Note: the Task 4.5 row (C-06.1-14) self-references the SHA back-fill commit itself. After Task 4.5 lands, Task 4's commit SHA (C-06.1-13) is back-fillable; Task 4.5's own SHA is documented as `(this commit)` per the substrate-honest pattern (auditor checks git log for `docs(06.1): wave 3 task 4.5 — SHA back-fill into SECURITY.md`).

---

## Cross-phase closures

- **Phase 6 HANDOFF.md follow-up #9** — closed by C-06.1-10 (legacy auth-helpers module deletion landed atomically alongside `src/ui/chrome.js` Change-password menu entry + Admin Clients table passwordHash zones cleanup, in a single cutover commit with no dead-code window per CONTEXT D-02).
- **Phase 6 ROADMAP `[ ]` cell for AUTH-14 verification** — overstated completeness in Phase 6/7; Phase 06.1 actually executes the substrate the Phase 6 D-04 audit-narrative claimed. SECURITY.md § Anonymous Auth Disabled paragraph updated 2026-05-22 to reflect this (the "substrate-honest" Phase 6 narrative now points forward to § Phase 06.1 Audit Index for the closure event).

---

## Carry-forward operator-deferred rows (bounded)

| Row | Owner | Trigger / Closure pointer |
|-----|-------|---------------------------|
| C-06.1-15 (operator) | Strip-script execution against production (`node scripts/strip-legacy-user-passwords/run.js --dry-run` → review → real run) | `/gsd-verify-work 06.1` operator checkpoint (Task 5 of this plan). Expected count: 0 per HANDOFF.md. Output captured in the Phase 06.1 UAT evidence runbook under runbooks/ as part of the same operator session. |
| C-06.1-16 (operator) | `/gsd-verify-work 06.1` end-to-end UAT — Test 1 happy invite + Test 2 bad passphrase + Test 3 passphrase-not-set + Test 4 client first-run + Test 5 audit-log + Test 6 self-serve password reset | Bundled into the same operator session as C-06.1-15. UAT evidence runbook captures timestamps + observed outcomes + any deviations; REQUIREMENTS.md AUTH-16/17/18 flip from `[ ]` to `[x]` after the session lands. |

---

## Forward-tracking rows queued (for future phases)

| Row | Owner | Trigger / Phase |
|-----|-------|-----------------|
| F-06.1-01 | reCAPTCHA Enterprise origin config fix (HANDOFF.md follow-up #3) — underlying App Check 22h backoff root cause; operationally mitigated by `runbooks/06.1-app-check-backoff.md` 4-step DevTools Clear-site-data workaround but not yet root-fixed | Phase 7 substrate / operator session whenever backoff next bites |
| F-06.1-02 | v2 client-MFA-hardening — promote opt-in MFA to mandatory for `role: "client"`; deferred per CONTEXT.md Deferred Ideas because adding a hard-enforce gate without a Tier-1 friction-mitigation (e.g. WebAuthn / passkey opt-in) would block low-frequency client users at session-start | v2 milestone |
| F-06.1-03 | `setOrgClientPassphrase` migration from full-org-write (current Wave 1 pattern reads + writes the whole `orgs/{orgId}` doc to update one hash field) to a dedicated callable Cloud Function (server-side hash + targeted field update via `FieldValue` + rules-gated client-side caller). Closes HANDOFF.md follow-up #1 broader cleanup phase | HANDOFF.md follow-up #1 broader cleanup phase |
| F-06.1-04 | Server-side validation of `orgPassphrase` length INSIDE the `inviteClient` callable (defense-in-depth on top of Wave 1's `setOrgClientPassphrase` chokepoint — gates against pre-existing weak hashes set under the legacy ≥4-char policy that may have slipped past the Wave 1 Task 0 operator review). Currently Wave 2 body accepts whatever hash matches (RESEARCH § Critical Pinned Fact 1.1 trade-off) | Concurrent with F-06.1-03 |
| F-06.1-05 | Cross-org client membership (AUTH-V2-02) — SCIM provisioning + shared-email support; currently `inviteClient` refuses with `auth/cross-org-invite-rejected` for any pre-existing `role:"client"` user with mismatched `orgId` | v2 milestone |
| F-06.1-06 | SSO/OIDC for enterprise client orgs (AUTH-V2-01) — per-org-IdP federation; the current `inviteClient` flow assumes Firebase Auth Email/Password is the universal client identity surface | v2 milestone |
| F-06.1-07 | Hardware-key (YubiKey / WebAuthn) second factor for clients + internal — TOTP is v1 substrate; FIDO2 hardware enrolment is queued | v2 milestone |
| F-06.1-08 | Transactional email replacing `mailto:` invite UX (NOTIF-V2-01) — current Invite Instructions modal still opens the operator's mail client. v2 ships a `firestore-send-email`-backed delivery pipeline so the invite copy + the password-reset email use the same channel | v2 milestone |
| F-06.1-09 | Anomaly rule 5 — invite-rejected burst detection (Phase 9 OBS-05 extension; currently no anomaly rule pages on the 4 new audit-event types per RESEARCH § 5 — a burst of `auth.client.invite.rejected.*` events should fire Slack via the existing `authAnomalyAlert` trigger) | Future hardening phase (Phase 9 substrate carry-forward) |

---

## Verification gate

`phase_06.1_active_rows: 0` in frontmatter is the zero-out invariant. Cleanup-ledger close == phase close. Operator-deferred rows (C-06.1-15 + C-06.1-16) close at the `/gsd-verify-work 06.1` operator session — they are bounded follow-throughs, not open-ended work.

Forward-tracking rows (F-06.1-01 through F-06.1-09) are queued for future phases per the cleanup-ledger pattern — they do NOT block the Phase 06.1 close gate.
