# Phase 6: Real Auth + MFA + Rules Deploy (Cutover) - Context

**Gathered:** 2026-05-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the anonymous-token + hardcoded-password substrate with real Firebase Auth (Email/Password + custom claims) for every production user; ship `beforeUserCreated` + `beforeUserSignedIn` + `setClaims` Cloud Functions in the existing `functions/` workspace; bootstrap Luke + George as real admins via Console + a pre-seeded `internalAllowlist/{email}` source-of-truth; enforce TOTP MFA hard for all internal users with email-link recovery as the user-side recovery path (AUTH-09 superseded — no pre-generated recovery codes); drill the two-admin Admin-SDK un-enrol procedure live (AUTH-10); deploy `firestore.rules` + `storage.rules` to production (RULES-07) in lockstep with `beforeUserCreated` populating claims and Anonymous Auth being disabled in the Firebase Console; delete `INTERNAL_PASSWORD_HASH` + `INTERNAL_ALLOWED_EMAILS` + `src/auth/state-machine.js` + `tests/auth/state-machine.test.js` + `tests/fixtures/auth-passwords.js` + the `signInAnonymously` import + call site in `src/firebase/auth.js` — all atomic with the cutover commit; ship a new `src/views/auth.js` Pattern D view housing sign-in, first-run forced password change, MFA enrolment, and email verification landing surfaces; document the 5-minute rules rollback (git revert + Phase 3 CI redeploy) and rehearse it against the live Firebase project before cutover.

**Explicitly NOT in this phase** (owned elsewhere):

- Audit-event wiring across `views/*` (sign-in, sign-out, role change, delete, export, MFA enrol, password change emit `auditWrite`) → Phase 9 (AUDIT-05). Phase 6 ships the substrate via `beforeUserSignedIn` audit-write; the cross-cutting wiring is Phase 9's job.
- App Check enforcement (per-service rollout: Storage → Firestore → Functions) → Phase 7 (FN-07/08). Phase 4's `firebase/check.js` no-op stub stays in place.
- `auditLog/{eventId}`, `softDeleted/{type}/items/{id}`, `rateLimits/{uid}/buckets/{windowStart}` Cloud Function writers → Phase 7 (FN-01..09). Phase 5's rules `allow write: if false` deny-blocks stay in place.
- Sentry browser/node init + PII scrubber + auth-anomaly Slack alerts → Phase 9 (OBS-01..08).
- Soft-delete restore + GDPR export/erase + automated backups → Phase 8.
- CSP enforcement (drop `unsafe-inline`) → Phase 10.
- `firebase-functions-test` v3 suite → Phase 7 (TEST-09). Phase 6 unit-tests pure claim-build logic via Vitest against extracted helper functions; full integration tests defer.

</domain>

<decisions>
## Implementation Decisions

### Cutover Wave Shape & Atomicity

- **D-01:** **6-wave shape, mirroring Phase 5's atomic-commit-per-coherent-boundary cadence.**
  - **Wave 1** — Pre-flight verifications: `gcloud firestore databases describe` to lock the Firestore region (closes the carry-forward STATE.md "Firestore region not yet verified" todo); confirm Identity Platform upgrade is in place (required for `passwordPolicy` API + TOTP MFA + org-wide MFA enforcement per AUTH-02); confirm `passwordPolicy` is enabled (≥12 chars + HIBP leaked-password check per AUTH-04); add `firestore.rules` + `storage.rules` declarations to `firebase.json` (the rule paths Phase 5 committed but didn't declare — declaration is what the deploy job consumes); functions/ workspace prep (TS scaffolding for `functions/src/auth/`).
  - **Wave 2** — Auth blocking + callable Cloud Functions: `functions/src/auth/beforeUserCreated.ts`, `beforeUserSignedIn.ts`, `setClaims.ts` + sibling `claim-builder.ts` for pure-logic unit tests; firebase-functions 7.2.5 + firebase-admin 13.8.0 already pinned. Vitest unit tests for `claim-builder.ts` BEFORE the handlers land (tests-first per Phase 5 D-10). 2nd-gen + `minInstances: 1` on auth-blocking handlers (Pitfall 12) + cold-start measurement.
  - **Wave 3** — Sign-in UI: new `src/views/auth.js` Pattern D DI factory exporting `renderSignIn`, `renderFirstRun`, `renderMfaEnrol`, `renderEmailVerificationLanding`; router updates to route unauthenticated/unverified/no-MFA traffic; `src/firebase/auth.js` body fills (real `signInEmailPassword` + `signOut` + `multiFactor` bodies; AUTH-12 unified-error wrapper at this chokepoint). Tests-first per wave.
  - **Wave 4** — Bootstrap script + MFA enrolment UX walkthrough: `scripts/seed-internal-allowlist/run.js` (Admin SDK one-shot script seeding `internalAllowlist/luke@bedeveloped.com` + `internalAllowlist/george@bedeveloped.com` with `{role: "admin"}`); `runbooks/phase6-bootstrap.md` covering the operator-side Console creation + temp-password delivery + first-sign-in walkthrough; `runbooks/phase6-mfa-recovery-drill.md` covering the AUTH-10 two-admin un-enrol procedure.
  - **Wave 5** — Cutover runbook + production execution + AUTH-10 drill: `runbooks/phase6-cutover.md` documenting the single-session atomic sequence (pre-cutover rules-rollback rehearsal → functions deploy → admin Console-create → first sign-in + claims verify → rules deploy + Anonymous Auth Console-disable → AUTH-14 deletion commit → MFA enrolment → AUTH-10 drill → SC#4 clock-skew exercise). Operator runs the cutover live; orchestrator captures evidence + timing.
  - **Wave 6** — Cleanup + DOC-10 SECURITY.md update + RULES-07 deploy verification gate (assert `firebase deploy --only firestore:rules,storage:rules` ran exactly once during this phase, against `bedeveloped-base-layers`, on the cutover SHA); cleanup-ledger zero-out (Phase 5 D-21 carry-forward rows close: `legacyAppUserId`/`legacyAuthorId` field removal + `state-machine.js` deletion + `INTERNAL_PASSWORD_HASH`-shape gitleaks rule retirement); add forward-tracking rows for Phase 7 (FN-09 rate-limit predicate body fills the deny-block + auditLog writers) and Phase 9 (AUDIT-05 view wiring).

  Mirrors Phase 4 + Phase 5's 6-wave cadence; one coherent boundary per wave; Phase 1 D-25 atomic-commit pattern preserved.

- **D-02:** **Single-session atomic cutover.** Wave 5's production-execution step is one operator-supervised session that runs end-to-end: deploy auth-blocking + callable functions → verify cold-start latency p99 ≤ 4s → seed `internalAllowlist/{lukeEmail}` + `internalAllowlist/{georgeEmail}` → operator Console-creates both Auth users (with `emailVerified: true` flag set via Admin SDK so they aren't gated by AUTH-11 + with the "force password change on first sign-in" pattern) → both admins sign in against OLD anon-OK rules → verify `request.auth.token.role == "admin"` claims present in their ID tokens → deploy `firestore.rules` + `storage.rules` via the Phase 3 CI job (or `firebase deploy --only firestore:rules,storage:rules` if preferred) → disable Anonymous Auth in Firebase Console → land the AUTH-14 deletion commit (removes `INTERNAL_PASSWORD_HASH` + `INTERNAL_ALLOWED_EMAILS` + `src/auth/state-machine.js` + `tests/auth/state-machine.test.js` + `tests/fixtures/auth-passwords.js` + the `signInAnonymously` import + call at `src/firebase/auth.js:5,8,31` + the `firebase-ready` window.dispatchEvent path). Pre-cutover: rules-rollback rehearsed end-to-end against the live Firebase project (D-12). Mirrors Phase 5's same-session export → dry-run → real-run → verify pattern. Closes Pitfall 1 + Pitfall 20.

- **D-03:** **Anonymous Auth Console-disable AT cutover; `signInAnonymously` source removed IN the cutover commit.** Single-state outcome — no dead code path lingers. The `firebase-ready` window.dispatchEvent + `window.FB.currentUser` bridge at `src/firebase/auth.js:20-30` retires alongside (Phase 4 D-12 cleanup-ledger row closes here per `04-CONTEXT.md`). Replaces the bridge with `onAuthStateChanged` semantics consumed directly by `views/auth.js` and the router.

- **D-04:** **AUTH-14 deletion is atomic with rules deploy** — lands in the cutover commit. Deletes:
  - `INTERNAL_PASSWORD_HASH` + `INTERNAL_ALLOWED_EMAILS` constants in `src/main.js` (Phase 4 carry-over location — main.js still holds the IIFE body until 4.1 sub-wave migration).
  - `src/auth/state-machine.js` (entire module).
  - `tests/auth/state-machine.test.js` + `tests/fixtures/auth-passwords.js` (Phase 2 TEST-07 deletion baseline retires; the regression baseline is consumed-as-designed when its replacement ships).
  - `signInAnonymously` import + call site at `src/firebase/auth.js:5,8,31`.
  - `firebase-ready` dispatchEvent + `window.FB.currentUser` bridge.
  - The custom `INTERNAL_PASSWORD_HASH`-shape `gitleaks` rule (`.gitleaks.toml`) — its target is gone; cleanup-ledger row closes.

  Cleanest audit narrative: "the password hash was deleted from source in the same commit that disabled anon auth and deployed rules — no dead-code window."

### Admin Bootstrap + MFA Enrolment + AUTH-10 Drill

- **D-05:** **Bootstrap is operator-driven Console creation with `internalAllowlist/{email}` seeded first.** Wave 4 ships `scripts/seed-internal-allowlist/run.js` (Admin SDK one-shot, Pitfall 13 secret pattern via `defineSecret` for any service-account creds it needs); operator runs it before Console creation. `internalAllowlist/luke@bedeveloped.com` + `internalAllowlist/george@bedeveloped.com` get `{role: "admin"}` (Email is lowercased per ARCHITECTURE.md §8 ("Configure custom claims on users")). Operator then opens Firebase Auth Console, creates both Auth users with operator-chosen temp passwords (passwordPolicy ≥12 chars + HIBP applies on creation per AUTH-04), sets `emailVerified: true` via Admin SDK (Console doesn't expose this flag directly — runbook documents the gcloud / Admin SDK call), and sets the "force password change on first sign-in" flag if Identity Platform exposes it via Console (otherwise the temp password is a one-shot value the user is told to change). `beforeUserCreated` fires on Console creation, reads `internalAllowlist/{lowercasedEmail}`, sets claims `{role: "admin"}` on the user record (Pitfall 6 mitigation #3 — claims in first ID token, no refresh dance for bootstrap admins).

- **D-06:** **Operator handles OOB temp-credential delivery** — runbook says "operator delivers via secure channel of their own choosing," does not prescribe the channel. Phase-side deliverable is the technical capability to create accounts + change passwords; operational secret-passing is Luke + George's call. Audit-narrative: "bootstrap credentials were delivered out-of-band per operator's standard practice; details of the channel are out of scope of the Phase 6 record." This deviates from Pitfall 7's "in-person side-by-side enrolment" recommendation — explicit deviation.

- **D-07:** **AUTH-09 (10 hashed recovery codes) is SUPERSEDED — no recovery codes are generated.** REQUIREMENTS.md row updated:
  - **AUTH-09**: ~~10 hashed recovery codes generated at MFA enrolment~~ → **SUPERSEDED 2026-05-08 by email-link recovery**: no pre-generated recovery codes; the `users/{uid}.recoveryCodeHashes[]` field is never created.
  Tier-1 user-side recovery path: user requests email-link sign-in via `sendSignInLinkToEmail` → re-authenticates via the link → un-enrols TOTP themselves via `multiFactor(currentUser).unenroll(...)` → re-enrols TOTP. Tradeoff captured in `SECURITY.md`: email-account compromise is now the recovery substrate; this is acceptable because email is also the primary sign-in identifier and identity recovery substrate, and both admins are expected to maintain modern email account hygiene.

- **D-08:** **MFA hard-enforced for internal users; no in-app "disable MFA" UI toggle exists.** Two-tier recovery model:
  - **Tier 1 (user-side, expected path):** email-link sign-in → user un-enrols + re-enrols TOTP themselves. No admin involvement.
  - **Tier 2 (operator-side, fallback for catastrophic loss):** other admin runs Admin SDK / `firebase auth:multifactor:unenroll` after OOB identity verification (voice/video call confirming identity per Pitfall 7). Documented in `runbooks/phase6-mfa-recovery-drill.md`.

  AUTH-10 drilled live same-day-as-cutover (within Wave 5 — the drill is part of the cutover session). Each admin takes a turn being the locked-out actor; the other runs the Tier-2 procedure end-to-end against the production Firebase project. Document timing + commands + any gaps; persist drill evidence in `runbooks/phase6-mfa-recovery-drill.md` with date stamps. Closes AUTH-10 + Pitfall 7 + Pitfall 19's "claim only what was rehearsed" gate.

### Auth Blocking Cloud Functions + RULES-07 Deploy & Rollback

- **D-09:** **All 3 new auth-related Cloud Functions deploy to `europe-west2`.** Co-located with cspReportSink (Phase 3) and aligned with the expected UK data-residency story for `PRIVACY.md` (Phase 11). Wave 1 pre-flight runs `gcloud firestore databases describe` to lock the Firestore region; if Firestore is not in `europe-west2`, escalate to user before Wave 2 (deviation gate). Auth-blocking 7s deadline (Pitfall 12) + 2nd-gen + `minInstances: 1` configured on `beforeUserCreated` and `beforeUserSignedIn`; `setClaims` callable doesn't need min-instances (admin-initiated, latency-insensitive). Cold-start measurement target: p99 ≤ 4s (ROADMAP Phase 7 SC#6 already names this; Phase 6 measures and pre-validates the metric for its own functions).

- **D-10:** **Source layout: `functions/src/auth/{beforeUserCreated,beforeUserSignedIn,setClaims}.ts` + sibling `functions/src/auth/claim-builder.ts`.** Mirrors `functions/src/csp/{cspReportSink,filter,normalise,dedup}.ts` pattern (Phase 3 deliverable visible in current `functions/` layout). `claim-builder.ts` is pure: `export function buildClaims(allowlistEntry: AllowlistEntry): {role: string; orgId?: string}`; unit-testable via Vitest with no firebase-functions-test substrate (TEST-09 deferred to Phase 7). `functions/src/index.ts` re-exports the three handlers + the existing `cspReportSink`. Each handler is its own file; pure-logic extraction is the test seam.

- **D-11:** **RULES-07 production deploy ordering inside the cutover session: functions FIRST → admin bootstrap + sign-in + claims-verify → rules deploy + anon-disable.** The strict-rules switch only flips after Auth is proven end-to-end: both admins must successfully sign in against the OLD anon-OK rules, with `request.auth.token.role == "admin"` confirmed in their ID tokens (e.g., `getIdTokenResult().claims.role === "admin"` in DevTools console), before the operator runs `firebase deploy --only firestore:rules,storage:rules` (or merges to `main` triggering Phase 3's CI deploy job). If sign-in OR claim verification fails, the rules deploy doesn't run — operator rolls back functions deploy + investigates. Closes Pitfall 1 (lockout): rules cannot deny-everything-because-no-claims-yet, because claims are confirmed before rules tighten.

- **D-12:** **5-minute rollback substrate: `git revert <cutover-sha> --no-edit && git push` triggers the Phase 3 CI deploy job, which redeploys the parent commit's `firestore.rules` + `storage.rules`.** The CI pipeline IS the rollback mechanism — no separate substrate, no `firestore.rules.previous` sidecar file, no manual `firebase deploy` from a checkout. Pre-cutover rehearsal (Wave 5 first task, before the real cutover): operator runs the full revert-and-redeploy cycle against the live Firebase project with the current rules — deploy current → wait for CI green → `git revert` the deploy commit → push → wait for CI green (rules now revert to whatever was before Phase 5's commit-but-not-deploy work, i.e., the Apr-27-2026 ~13-line shape per Phase 5 RULES-06 verification) → re-deploy current rules to restore. Time each step. Document timing in `runbooks/phase6-rules-rollback-rehearsal.md` (e.g., "git revert + push + CI deploy job: 3:42; well within 5-min target"). The rehearsal evidence is the Phase 6 "documented within 5 minutes" SC #4 deliverable.

### Sign-in UX, Email Verification, Password Reset

- **D-13:** **AUTH-12 unified "Email or password incorrect" wrapper lives in `src/firebase/auth.js` body** — the single chokepoint. `signInEmailPassword` catches Firebase's `auth/user-not-found`, `auth/wrong-password`, `auth/invalid-credential`, `auth/too-many-requests` and any other auth-credential error code and re-throws a single typed `SignInError` with message `"Email or password incorrect"`. No Firebase error codes leak through the layer boundary; every caller in `views/*` gets unified wording for free. Same wrapper applies to password-reset request (`sendPasswordResetEmail`) — though Firebase's API for that is silent-success on unknown emails, the wrapper still normalises any unexpected error code to a generic message. Closes account-enumeration leak per AUTH-12 + L1.

- **D-14:** **AUTH-11 email-verification enforcement: BOTH Rules + client.** Rules layer: Phase 5 D-14's `isAuthed()` predicate already requires `request.auth.token.email_verified == true` for any read/write to `orgs/{orgId}/*` — load-bearing. Client layer (UX): after sign-in, if `!user.emailVerified`, router routes to `renderEmailVerificationLanding` (a new view in `src/views/auth.js`) which shows "Check your email — we've sent a verification link" + a `Resend verification email` button calling `sendEmailVerification(user)`. Belt-and-braces: rules enforce, client provides the path. Bootstrap admins (Luke + George): operator marks `emailVerified: true` via Admin SDK during Console creation (D-05) so they don't hit the verification landing.

- **D-15:** **Password reset flow uses generic "If that account exists, you'll receive an email" wording on the request.** Client calls `sendPasswordResetEmail(auth, email)`; UI ALWAYS shows "If that account exists, you'll receive a reset email shortly. Please check your inbox." regardless of whether the email exists. Firebase's API is silent-success on unknown emails (no leak there); the wrapper just doesn't surface anything that would contradict the wording. Reset email content uses Firebase's default template (free-tier acceptable for the milestone). Sender-domain customisation (`noreply@bedeveloped.com` vs default Firebase domain) deferred to Phase 9 / Phase 11 as a polish item — cleanup-ledger row queued. Closes AUTH-12 reset-side enumeration.

- **D-16:** **`src/views/auth.js` is the new Pattern D DI factory holding the entire Phase 6 client UI surface.** Exports:
  - `renderSignIn(deps)` — email + password form; calls `signInEmailPassword`; on success, the auth state machine routes to next step.
  - `renderFirstRun(deps)` — forced password change view triggered when Firebase reports the user must change password (operator-flagged at Console creation per D-05).
  - `renderMfaEnrol(deps)` — TOTP enrolment for users without a second factor; renders QR code + manual secret + verification-code input; submits via `multiFactor(currentUser).enroll(...)`.
  - `renderEmailVerificationLanding(deps)` — shown when `!user.emailVerified`; resend button + status.

  Router routes:
  - Unauthenticated → `renderSignIn`.
  - Signed-in but `!emailVerified` → `renderEmailVerificationLanding`.
  - Signed-in + verified + `firstRun` flag set → `renderFirstRun`.
  - Signed-in + verified + no second factor + `role` ∈ `{internal, admin}` → `renderMfaEnrol`.
  - Otherwise → existing dashboard / role-appropriate landing.

  Matches ARCHITECTURE.md §3 layout (`views/auth.js — sign-in, first-run, MFA enrol, password reset`). Pattern D DI factories per Phase 4. Vitest snapshot tests for each view land same-wave.

### Cross-Cutting (carry-forward + derived)

- **D-17:** **Phase 5 D-21 cleanup-ledger carry-forward rows close in Phase 6.** Each row's closure event:
  - "Phase 6 (AUTH-15) deletes inline `legacyAppUserId`/`legacyAuthorId` fields after backfill" → closes when bootstrap script completes; backfill happens during Wave 5's admin Console-create step (`beforeUserCreated` reads `internalAllowlist`, sets claims, and the user is now keyed by `firebaseUid` — the `legacyAppUserId` fields on existing migrated docs become unused; Wave 6 includes a one-shot `scripts/strip-legacy-id-fields.js` deletion pass via Admin SDK).
  - "Phase 6 (RULES-07) deploys `firestore.rules` + `storage.rules` to production" → closes Wave 5 cutover.
  - Phase 4 D-?? (`window.FB.currentUser` + `firebase-ready` bridge retirement) → closes in cutover commit per D-03.

  New cleanup-ledger rows queued in Wave 6:
  - "Phase 7 (FN-01..09) adds Cloud Function writers for `auditLog/`, `softDeleted/`; replaces Phase 5's `allow write: if false` deny-blocks with rate-limit `request.time` predicate against `rateLimits/{uid}/buckets/{windowStart}`."
  - "Phase 9 (AUDIT-05) wires `auditWrite` calls through every view that does sensitive ops (sign-in, sign-out, role change, delete, export, MFA enrol, password change)."
  - "Phase 10 (HOST-06) drops temporary CSP allowlist for Firebase Auth popups (Phase 3 D-?? added this preemptively)."
  - "Phase 11 (DOC-04) customises Firebase password-reset email sender domain to `noreply@bedeveloped.com`."

- **D-18:** **DOC-10 SECURITY.md additions (Wave 6).** New sections:
  - `§Authentication & Sessions` — Email/Password + custom claims `{role, orgId}` + `passwordPolicy` (≥12 chars + HIBP) + AUTH-12 unified-error wrapper + AUTH-13 progressive-delay reference (Firebase Auth defaults documented).
  - `§Multi-Factor Authentication` — TOTP via Firebase Identity Platform + AUTH-09 superseded note (email-link recovery rationale + tradeoff) + AUTH-10 drill evidence (date + commands + gaps).
  - `§Anonymous Auth Disabled` — Console-disable confirmation + source-removal commit SHA + Pitfall 2 prevention narrative.
  - `§Production Rules Deployment` — RULES-07 deploy SHA + 5-minute rollback procedure + rehearsal timing evidence.
  - `§Phase 6 Audit Index` — framework citation table per Phase 3 D-15 / Phase 4 D-25 / Phase 5 D-20 pattern (OWASP ASVS V2 / ISO 27001 A.5.17 + A.8.5 / SOC2 CC6.1 + CC6.7 / GDPR Art.32(1)(b)).

- **D-19:** **05-HUMAN-UAT.md test #2 (live SC#4 server-clock unread comparator with ±5-min clock skew) closes in Wave 5 of Phase 6** — once the first real org is created post-cutover (Luke or George can spin up a test org), exercise unread-count badge with a deliberate ±5-minute client clock skew via DevTools "Sensors → Clock override" or system time change; confirm badge count does not change. Documents the result in `06-HUMAN-UAT.md` if anything new emerges; otherwise closes 05-HUMAN-UAT.md test #2.

- **D-20:** **Pitfall 13 (Cloud Functions secret management).** Bootstrap script (`scripts/seed-internal-allowlist/run.js`) uses `firebase-admin` initialised via Application Default Credentials (ADC) — the operator runs `gcloud auth application-default login` first; no secrets in source. Cloud Functions for Phase 6 don't need any secrets yet (Identity Platform handles passwordPolicy + HIBP server-side; recaptcha/App Check secrets land Phase 7); convention captured in SECURITY.md `§Authentication & Sessions` for Phase 7 to inherit.

- **D-21:** **AUTH-13 (account lockout / progressive delay)** — Firebase Auth's defaults are documented in SECURITY.md `§Authentication & Sessions`: progressive backoff after repeated failed attempts (Firebase enforces server-side; no client-side counter needed). Verification: Wave 4 spec includes a manual smoke test in `runbooks/phase6-cutover.md` that submits 10 wrong passwords and confirms Firebase returns `auth/too-many-requests` (caught by AUTH-12 wrapper + surfaced as the same generic error). No code change beyond documenting the behaviour.

### Claude's Discretion

- **`scripts/seed-internal-allowlist/` exact path** (vs `scripts/phase6-bootstrap/` vs `tools/seed-allowlist.js`) — planner picks the convention matching repo + Phase 5's `scripts/migrate-subcollections/` precedent.
- **Per-view snapshot test glob layout** — `tests/views/auth.test.js` (single file, 4 snapshot blocks per view) vs `tests/views/auth/{sign-in,first-run,mfa-enrol,verify-email}.test.js` (one file per view) — planner picks based on debuggability.
- **TOTP QR-code rendering library choice** — Firebase Identity Platform exposes the TOTP secret + URI; the QR code can be rendered via `qrcode` npm (small, MIT) or via google-charts API URL (no dep but external request → CSP allowlist hit). Default: bundle `qrcode` npm; avoids Phase 10 CSP allowlist regression.
- **Whether to keep the `INTERNAL_PASSWORD_HASH`-shape `gitleaks` rule for one milestone post-cutover as forensics protection** — D-04 deletes it; planner can keep one milestone if a strong argument emerges (e.g., guard against accidental recreation). Default: delete; cleanup-ledger row.
- **Audit-event firing in `beforeUserSignedIn`** — Pitfall 17 says audit-log writes from Cloud Functions only; Phase 6 ships the auth-blocking handler; whether it writes to `auditLog/{eventId}` directly or defers all audit writes to Phase 7's `auditWrite` substrate — planner picks. Default: defer (Phase 6 handler logs structured Cloud Logging entry only; Phase 7 wires the Firestore-side `auditLog/` writer + back-fills sign-in events from Cloud Logging).

### Folded Todos

- **Firestore region of `bedeveloped-base-layers` not yet verified** (from `.planning/STATE.md` "Outstanding Todos / Open Questions for Future Phases") — folded as Wave 1 pre-flight per D-09. Result documented in `06-PREFLIGHT.md`.
- **MFA recovery procedure feasibility** (from STATE.md outstanding todos) — addressed by D-07 + D-08 + AUTH-10 drill in Wave 5. The two-admin un-enrol procedure is hard-required in Wave 5; if operationally infeasible (both admins simultaneously unavailable), Tier-1 email-link recovery is the user-side fallback. Phase 6 documents the runbook + drills both tiers.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project + milestone context

- `.planning/PROJECT.md` — Locked decisions (Firebase, vanilla JS, no backwards-compat, credible-not-certified compliance bar)
- `.planning/ROADMAP.md` §"Granularity Rationale" #2 — Rules committed early but deployed only after Auth is live (Pitfall 1 prevention)
- `.planning/ROADMAP.md` §"Phase 6" — Goal + dependency + 6 success criteria
- `.planning/REQUIREMENTS.md` — AUTH-01..15 + RULES-07 + DOC-10 (incremental) rows in Traceability table
- `.planning/STATE.md` §"Sequencing Non-Negotiables" — load-bearing constraints incl. "Anonymous Auth disabled in Firebase Console as part of Phase 6"
- `.planning/STATE.md` §"Outstanding Todos / Open Questions for Future Phases" — Firestore region verification + MFA recovery feasibility (both folded into D-09 + D-07/D-08)
- `CLAUDE.md` — Source layout target + sequencing non-negotiables + conventions

### Architecture (load-bearing)

- `.planning/research/ARCHITECTURE.md` §3 (Module layout) — `views/auth.js — sign-in, first-run, MFA enrol, password reset`; `firebase/auth.js — sign-in / sign-out / claims read / MFA enrolment / token refresh on role change`; `cloud/claims-admin.js — client of setClaims`
- `.planning/research/ARCHITECTURE.md` §6 (Cloud Functions enumeration) — `beforeUserCreated`, `beforeUserSignedIn`, `setClaims` definitions + 7s deadline + claims-set-on-creation pattern
- `.planning/research/ARCHITECTURE.md` §8 dep-note 2 — `beforeUserCreated` claims setup must happen before Rules can rely on `request.auth.token.role`
- `.planning/research/ARCHITECTURE.md` §"Decision: Email/Password + custom claims..." — bootstrap procedure + claims propagation + poke pattern
- `.planning/research/ARCHITECTURE.md` §"Auth blocking triggers" — link to Firebase docs

### Pitfalls (load-bearing)

- `.planning/research/PITFALLS.md` §Pitfall 1 (locking yourself out on first rules deploy) — D-11's deploy ordering (functions + bootstrap + claims-verify BEFORE rules deploy) closes this
- `.planning/research/PITFALLS.md` §Pitfall 2 (`request.auth != null` is not access control) — D-03's Console-disable + source-removal of Anonymous Auth + Phase 5's `isAuthed()` predicate combine
- `.planning/research/PITFALLS.md` §Pitfall 6 (custom claims propagation lag) — D-09's claims-set in `beforeUserCreated` (first ID token has them); poke pattern for post-creation mutations per ARCHITECTURE.md §8
- `.planning/research/PITFALLS.md` §Pitfall 7 (MFA enrolment lockout) — D-07 + D-08 (email-link Tier-1 + Admin-SDK Tier-2 + drilled AUTH-10) close this; explicit deviation from Pitfall 7's "in-person side-by-side enrolment" recommendation captured in D-06
- `.planning/research/PITFALLS.md` §Pitfall 12 (1st vs 2nd gen Cloud Functions / blocking timeouts) — D-09's 2nd-gen + minInstances:1 + cold-start measurement
- `.planning/research/PITFALLS.md` §Pitfall 13 (Cloud Functions secret management) — D-20's ADC for bootstrap script; `defineSecret` convention captured for Phase 7
- `.planning/research/PITFALLS.md` §Pitfall 17 (audit log written from client) — D-21's "audit log writes from Cloud Functions only" deferred to Phase 7; Phase 6 logs structured entries only
- `.planning/research/PITFALLS.md` §Pitfall 19 (compliance theatre) — AUTH-10 drill evidence + rules-rollback rehearsal evidence + AUTH-09 supersession note in REQUIREMENTS.md all close this

### Codebase context

- `.planning/codebase/CONCERNS.md` §C1 (anonymous auth substrate) — closed by D-03 (Console-disable + source removal)
- `.planning/codebase/CONCERNS.md` §C2 (hardcoded INTERNAL_PASSWORD_HASH) — closed by D-04 atomic deletion
- `.planning/codebase/CONCERNS.md` §H3 (no MFA) — closed by D-08 hard-enforced TOTP for internal
- `.planning/codebase/CONCERNS.md` §M6 (no real user identity) — closed by D-05 bootstrap + claims-set
- `.planning/codebase/CONCERNS.md` §L1 (account enumeration) — closed by D-13 + D-15 unified-error wrapper

### Phase 5 carry-forward (Phase 6 builds on this)

- `.planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-CONTEXT.md` D-03 — Inline `legacyAppUserId`/`legacyAuthorId` fields are the substrate Phase 6 backfills (D-17)
- `05-CONTEXT.md` D-07 — Rules emulator-tested-only / committed-not-deployed; Phase 6 owns the production deploy (D-11)
- `05-CONTEXT.md` D-14 — `firestore.rules` predicate library (`isAuthed()` requires `email_verified` + `sign_in_provider != "anonymous"`); Phase 6 D-14's email-verify enforcement leans on this
- `05-CONTEXT.md` D-19 — RULES-06 verification gate; Phase 6 D-?? mirror is the RULES-07 deploy verification gate (Wave 6)
- `05-CONTEXT.md` D-21 — Cleanup-ledger carry-forward rows that close in Phase 6 (D-17)
- `.planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-HUMAN-UAT.md` test #2 — Live SC#4 clock-skew exercise deferred from Phase 5; closes Wave 5 per D-19

### Phase 4 carry-forward (Phase 6 retires this)

- `.planning/phases/04-modular-split-quick-wins/04-CONTEXT.md` D-?? — `window.FB.currentUser` + `firebase-ready` dispatchEvent bridge (Phase 4 deviation cluster); retires per D-03
- `tests/auth/state-machine.test.js` (Phase 2 TEST-07) — Auth state machine deletion baseline; consumed-as-designed per D-04

### Phase 3 carry-forward (Phase 6 reuses)

- `firebase.json` — Phase 3 declares `hosting` + `functions`; Phase 6 Wave 1 adds `firestore.rules` + `firestore.indexes.json` + `storage.rules` declarations
- `.github/workflows/ci.yml` deploy job — OIDC-authenticated Firebase deploy via Phase 3's substrate; Phase 6 Wave 5 reuses this for the rules deploy + the rollback rehearsal mechanism (D-12)
- `functions/` workspace — Phase 6 Wave 2 adds `functions/src/auth/*` mirroring Phase 3's `functions/src/csp/*` pattern (D-10)

### Stack reference

- `.planning/research/STACK.md` — Identity Platform requirement for `passwordPolicy` API + TOTP MFA + org-wide enforcement; `firebase-admin@13.x` + `firebase-functions@7.2.5` already pinned in `functions/package.json`
- Firebase Auth `multiFactor(user).enroll(...)` API for TOTP — official docs https://firebase.google.com/docs/auth/web/totp-mfa
- Firebase Auth `sendSignInLinkToEmail` API for email-link recovery — official docs https://firebase.google.com/docs/auth/web/email-link-auth
- Firebase Auth blocking triggers (`beforeUserCreated`, `beforeUserSignedIn`) — official docs https://firebase.google.com/docs/auth/extend-with-blocking-functions
- `passwordPolicy` API — Identity Platform docs https://cloud.google.com/identity-platform/docs/password-policy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/firebase/auth.js`** (Phase 4 Wave 1) — Already has Phase 6 placeholder bodies for `signInEmailPassword`, `signOut`, `multiFactor` (visible in current file at lines 33-47). D-13 + D-16 fill these bodies; D-04 deletes the `signInAnonymously` import + call site (lines 5, 8, 31) + the `firebase-ready` dispatchEvent (lines 20-30).
- **`src/cloud/claims-admin.js`** (Phase 4 Wave 3) — Empty stub for `setClaims` httpsCallable wiring. Wave 3 fills the body via `httpsCallable("setClaims")` through `src/firebase/functions.js`. Cleanup-ledger row "Phase 6 (AUTH-07) replaces body" closes here.
- **`functions/`** workspace (Phase 3 Wave 2) — TS + Node 22 + 2nd-gen + firebase-admin 13.8.0 + firebase-functions 7.2.5 already pinned. Wave 2 adds `functions/src/auth/*` subdirectory; mirrors `functions/src/csp/*` (which exists with `cspReportSink.ts`, `dedup.ts`, `filter.ts`, `normalise.ts`).
- **`functions/src/index.ts`** (Phase 3 Wave 2) — Already exports `cspReportSink`. Wave 2 adds re-exports for `beforeUserCreated`, `beforeUserSignedIn`, `setClaims`.
- **`firestore.rules` + `storage.rules`** (Phase 5 Wave 1) — Already authored, helper-rich predicate library, 176/176 emulator cells green. Phase 6 doesn't author rules — it deploys them per RULES-07.
- **`firebase.json`** (Phase 3 Wave 2) — Already declares `hosting` + `functions`. Wave 1 adds `firestore.rules` + `firestore.indexes.json` + `storage.rules` paths so the deploy job consumes them.
- **`.github/workflows/ci.yml`** (Phase 3 Wave 4) — Deploy job + preview job already use OIDC-authenticated `firebase-tools`. Wave 5 reuses for rules deploy; D-12 rollback substrate is `git revert` into the same pipeline.
- **`tests/mocks/firebase.js`** (Phase 2 D-11; Phase 4 retargeted to `firebase/db.js`) — Phase 6 reuses for `firebase/auth.js` body unit tests.
- **Pattern D DI factories in `src/views/*`** (Phase 4 D-??) — `views/auth.js` follows the same factory shape per D-16; existing views (dashboard, diagnostic, report, etc.) use the convention.

### Established Patterns

- **Per-feature submodule pattern** in `firebase/` (Phase 4 D-05) — Phase 6 fills `firebase/auth.js` body without adding new files.
- **6-wave atomic-commit-per-coherent-boundary pattern** (Phase 1 D-25 / Phase 4 / Phase 5 D-08) — Phase 6 mirrors per D-01.
- **Tests-first inside each wave** (Phase 2 D-15 / Phase 5 D-10) — Phase 6 honours per D-01.
- **Atomic terminal cutover commit** (Phase 4 Wave 5 — `app.js` DELETED in same commit as `index.html` flip; Phase 5 Wave 5 — migration script invocation + commit-the-run) — Phase 6 D-02 mirrors: cutover commit + AUTH-14 deletions in single commit.
- **Per-directory coverage thresholds** (Phase 4 D-21) — `cloud/**` was excluded in Phase 4; Phase 6 raises `cloud/**` to 90% (now `claims-admin.js` has a body) and `views/**` raises slightly with `views/auth.js` snapshot-tested. Planner refines exact thresholds.
- **ESLint `firebase/*` boundary** (Phase 4 ESLint Wave 1) — `firebase/*` is the sole SDK import surface; `views/auth.js` consumes via `firebase/auth.js`, not via direct SDK imports.
- **Cleanup-ledger zero-out gate at phase close** (Phase 4 D-17 / Phase 5 D-21) — Phase 6 closes Phase 5's 4 carry-forward rows + queues 4 new rows for Phase 7/9/10/11.
- **DOC-10 SECURITY.md per-phase increment** (Phase 1 D-25 / Phase 3 D-15 / Phase 4 / Phase 5 D-20) — Phase 6 D-18.
- **Phase audit index citation table** (Phase 3 D-15 / Phase 4 D-25 / Phase 5 D-20) — Phase 6 mirrors in DOC-10 audit-index section.
- **Same-session atomic operator-supervised cutover** (Phase 5 Wave 5 — export + dry-run + real-run + verify in one session) — Phase 6 D-02 mirrors: functions deploy + bootstrap + claims-verify + rules deploy + anon-disable + AUTH-14 delete + drill in one session.

### Integration Points

- **`firebase.json`** — Wave 1 adds `firestore.rules` + `firestore.indexes.json` + `storage.rules` declarations.
- **`functions/src/auth/`** — New subdirectory at Wave 2 with `beforeUserCreated.ts`, `beforeUserSignedIn.ts`, `setClaims.ts`, `claim-builder.ts`.
- **`functions/src/index.ts`** — Wave 2 adds re-exports.
- **`functions/test/auth/claim-builder.test.ts`** — Wave 2 adds Vitest unit tests.
- **`src/firebase/auth.js`** — Wave 3 fills bodies; cutover commit deletes anon-auth substrate.
- **`src/cloud/claims-admin.js`** — Wave 3 fills body via `httpsCallable("setClaims")`.
- **`src/views/auth.js`** — Wave 3 new file; Pattern D DI factory.
- **`src/router.js`** — Wave 3 router updates for auth-state routing per D-16.
- **`src/main.js`** — Cutover commit deletes `INTERNAL_PASSWORD_HASH` + `INTERNAL_ALLOWED_EMAILS` constants (the IIFE body still lives here pending 4.1 sub-wave; the AUTH-14 deletion is targeted at the constants only, not the broader IIFE).
- **`scripts/seed-internal-allowlist/run.js`** — Wave 4 new script.
- **`scripts/strip-legacy-id-fields.js`** — Wave 6 new script (Phase 5 D-21 carry-forward closure).
- **`runbooks/phase6-cutover.md`** — Wave 4 / Wave 5; cutover sequence + rollback rehearsal evidence.
- **`runbooks/phase6-bootstrap.md`** — Wave 4; admin Console-creation + temp-password delivery + first-sign-in walkthrough.
- **`runbooks/phase6-mfa-recovery-drill.md`** — Wave 4 / drilled Wave 5; AUTH-10 drill commands + timing + gaps.
- **`runbooks/phase6-rules-rollback-rehearsal.md`** — Wave 5 (pre-cutover step); rollback timing evidence (D-12).
- **`tests/auth/state-machine.test.js`** + **`tests/fixtures/auth-passwords.js`** — DELETED in cutover commit (D-04).
- **`src/auth/state-machine.js`** — DELETED in cutover commit (D-04).
- **`.gitleaks.toml`** — `INTERNAL_PASSWORD_HASH`-shape custom rule DELETED in cutover commit (D-04).
- **`SECURITY.md`** — Wave 6 5 new sections + Phase 6 audit index per D-18.
- **`REQUIREMENTS.md`** — AUTH-09 row updated to mark superseded per D-07.

</code_context>

<specifics>
## Specific Ideas

- **The "operator handles OOB credential delivery, not prescribed in runbook" decision (D-06)** is operator-confidence, not a generic recommendation. It works for THIS milestone because (a) two trusted admins, (b) no live users, (c) bootstrap is one-shot (not a recurring invite flow yet), (d) the OOB channel choice is below the audit-narrative-resolution. The audit-narrative line in `SECURITY.md` (Wave 6) MUST capture: "operator delivers temp credentials via secure channel of operator's standard practice; runbook does not prescribe channel; future invite flow will codify a single channel." This deviates from Pitfall 7's "in-person enrolment" recommendation.
- **The "AUTH-09 superseded by email-link recovery" decision (D-07)** trades off pre-generated-recovery-codes-as-secret-substrate for email-account-as-recovery-substrate. The audit-narrative captures this honestly: "MFA recovery via email-link sign-in to the verified email address; no pre-generated recovery codes; tradeoff: email-account compromise enables MFA recovery; mitigation: same email is the primary identifier and ID recovery substrate, so the additional risk surface is bounded." Pitfall 7 mitigation is met via the Tier-2 Admin-SDK procedure (drilled per AUTH-10).
- **Functions-first deploy ordering (D-11) is the load-bearing safety pattern.** The cutover ABORTS if either admin can't sign in or doesn't have the expected claims after Console creation. Rules deploy + Anonymous Auth disable only happen after sign-in is confirmed. This is the structural mitigation for Pitfall 1 — the "we deployed strict rules but no users have claims" failure mode literally cannot happen because deploy is gated on claims being verified.
- **Rules-rollback rehearsal evidence is the audit artefact.** Pitfall 19 says "claim only what was rehearsed." D-12's rehearsal procedure runs the full revert-and-redeploy cycle against the live Firebase project before cutover, with timing recorded. The rehearsal output (timestamps + commit SHAs + CI run URLs) lives in `runbooks/phase6-rules-rollback-rehearsal.md` and is cited in SECURITY.md Wave 6.
- **AUTH-10 drilled live same-day-as-cutover** because deferring it means Wave 5 doesn't actually close — the milestone-blocker is "drilled before milestone close" and Phase 6 IS the closest moment to milestone close that's safe to drill (later phases keep adding load on the auth substrate). Same-day drill is highest-evidence + lowest-friction.
- **"functions-first → bootstrap → rules → anon-disable" is a strict ordering** in the cutover runbook. Each step has a verification gate (cold-start latency p99 ≤ 4s, both admins signed in, claims present in ID token, rules deploy CI green, Console flag flipped). The runbook is checklist-shaped, not narrative-shaped — operator ticks each box.

</specifics>

<deferred>
## Deferred Ideas

- **Customising Firebase password-reset email sender domain to `noreply@bedeveloped.com`** — defaults are acceptable for the milestone (free-tier covers the deliverability + domain visibility); customisation is a Phase 11 polish item. Cleanup-ledger row queued.
- **`firebase-functions-test` v3 integration tests for `beforeUserCreated`, `beforeUserSignedIn`, `setClaims`** — Phase 7 owns this per TEST-09. Phase 6 unit-tests pure `claim-builder.ts` logic via Vitest only.
- **Sender-customised TOTP enrolment email** — Firebase Identity Platform sends standard MFA notifications; customisation = Phase 11.
- **In-app "request audit log of my account" self-serve UI for users** — out of milestone scope; Phase 8/11 may surface.
- **Hardware-key (YubiKey) second factor option for internal users** — Pitfall 7 recommends "two enrolled second factors" (TOTP + hardware key) as additional defense. Phase 6 ships TOTP only — credible-not-certified bar accepts single second factor with email-link recovery; hardware-key support is a future v2 milestone item. Cleanup-ledger note (no specific phase).
- **Sidecar `legacyIdMap/{appUserId}` collection vs inline-field backfill** — Phase 5 D-03 + Phase 6 D-17 use inline-field deletion (one-shot script). If Phase 6 implementation discovers cross-collection ID collisions, sidecar revisited; not expected.
- **Pre-deploying rules to a separate Firebase project for nightly integration testing** — deferred from Phase 5 D-21. Once rules are deployed in Phase 6, a nightly CI job comparing emulator vs production rules-engine results becomes feasible. Cleanup-ledger row queued for a future Phase (likely Phase 9 since it's observability-adjacent).
- **`setClaims` callable rate-limiting** — Phase 7 owns `rateLimits/{uid}/buckets/{windowStart}` predicate. Phase 6's `setClaims` is admin-only (rules + caller-claim check); rate-limit at App Check + Phase 7 substrate.
- **Account self-service: "delete my account" UI** — GDPR Art. 17; Phase 8 owns (`gdprEraseUser` callable).
- **Reviewed Todos (not folded)** — none new beyond what's already routed in `.planning/STATE.md` "Outstanding Todos / Open Questions for Future Phases" (Sentry free-tier sufficiency → Phase 9; reCAPTCHA quota → Phase 7; AUDIT translation → Phase 12).

</deferred>

---

*Phase: 06-real-auth-mfa-rules-deploy*
*Context gathered: 2026-05-08*
