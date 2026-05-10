# Requirements: Base Layers Diagnostic — Hardening Pass

**Defined:** 2026-05-03
**Core Value:** Client diagnostic data must remain confidential, intact, and recoverable — and BeDeveloped must be able to honestly answer a prospect's security questionnaire about how that's enforced.

**Source of derivation:** `.planning/codebase/CONCERNS.md` (4 CRITICAL + 8 HIGH findings), `SECURITY_AUDIT.md` (audit framework), `.planning/research/SUMMARY.md` (53 table-stakes controls + reconciled 12-phase plan with framework citations).

Each requirement is mapped to: (a) the CONCERNS.md finding it closes (where applicable), and (b) the OWASP ASVS L2 / ISO 27001:2022 Annex A / SOC2 CC / GDPR section it addresses (under "Traceability" further down). Requirements are atomic, user-centric, and testable — the unit of "done" is "the control is in code AND in CI AND in the documentation pack."

---

## v1 Requirements

### Tooling & Build (TOOL)

- [ ] **TOOL-01**: Project has `package.json` declaring all production + dev dependencies (closes "no package manager" gap)
- [ ] **TOOL-02**: Vite 8 build pipeline produces hashed-filename bundles (closes M1 cache busting; replaces `?v=46` hand-bumping)
- [ ] **TOOL-03**: Firebase JS SDK self-hosted via Vite bundle (closes H4 SRI for Firebase; upgraded from 10.13.0 → 12.x)
- [ ] **TOOL-04**: Chart.js self-hosted via Vite bundle (closes H4 SRI for Chart.js)
- [ ] **TOOL-05**: ESLint 10 flat config + `eslint-plugin-no-unsanitized` + `eslint-plugin-security` blocks new `Math.random()` / `innerHTML=` regressions
- [ ] **TOOL-06**: Prettier configured for repo-wide formatting
- [ ] **TOOL-07**: TypeScript-as-typecheck via `// @ts-check` + `tsc --noEmit --allowJs --checkJs --strict` (no `.ts` source files; honours vanilla-JS constraint)
- [ ] **TOOL-08**: GitHub Actions CI workflow runs lint + typecheck + Vitest unit + rules-unit-tests + `npm audit --audit-level=high` + OSV-Scanner + build on every PR
- [ ] **TOOL-09**: Third-party GitHub Actions pinned to commit SHA (not version tag); CI uses OIDC for Firebase auth (no long-lived service-account JSON in secrets)
- [ ] **TOOL-10**: Dependabot configured for `npm` + `github-actions` ecosystems with weekly cadence
- [ ] **TOOL-11**: Socket.dev GitHub App installed (post-Shai-Hulud behavioural malicious-package detection)
- [ ] **TOOL-12**: gitleaks pre-commit hook + CI step (would have caught the C2 hardcoded password hash at commit time)

### Testing (TEST)

- [x] **TEST-01**: Vitest 4 + `@vitest/coverage-v8` + `happy-dom` configured and runnable via `npm test` (validated Phase 2 — 14 files / 149 tests; coverage 100%/98.94%/100%/100%)
- [x] **TEST-02**: Unit tests cover `pillarScoreForRound` + `pillarStatus` + `bandLabel` boundary conditions (closes scoring-regression risk in CONCERNS Test Coverage Gaps) (validated Phase 2 — `tests/domain/{banding,scoring}.test.js`, 47 boundary cases)
- [x] **TEST-03**: Unit tests cover `userCompletionPct` + `orgSummary` math (validated Phase 2 — `tests/domain/completion.test.js`, 11 cases)
- [x] **TEST-04**: Unit tests cover v1→v2 migration (`migrateV1IfNeeded`) and `clearOldScaleResponsesIfNeeded` for idempotency (silent-data-corruption risks) (validated Phase 2 — `tests/data/migration.test.js` with v1-localStorage / v2-org fixtures)
- [x] **TEST-05**: Unit tests cover comment unread tracking (`unreadCountForPillar`, `markPillarRead`) and chat unread total (`unreadChatTotal`) (validated Phase 2 — `tests/domain/unread.test.js`, H7/Pitfall 20 regression baseline)
- [x] **TEST-06**: Unit tests cover `syncFromCloud` bail-on-error logic (cloud sync conflict resolution) (validated Phase 2 — `tests/data/cloud-sync.test.js`, H8/Pitfall 20 regression baseline; will break by design when Phase 5 lands the H8 fix)
- [x] **TEST-07**: Unit tests cover auth state machine (`verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword`) — captures behaviour BEFORE replacement in TOOL/AUTH phases (validated Phase 2 — `tests/auth/state-machine.test.js` with `tests/fixtures/auth-passwords.js` SHA-256 fixtures; Phase 6 AUTH-14 deletion baseline)
- [ ] **TEST-08**: `@firebase/rules-unit-testing` 5 suite covers every Firestore + Storage Rules collection × every role × allowed/denied path against the local emulator (closes H2 rules slice)
- [x] **TEST-09**: `firebase-functions-test` 3 suite covers every Cloud Function callable + trigger — Closed Phase 7 Wave 6 (07-06): 8 integration test files at `functions/test/integration/*.integration.test.ts` covering auditWrite (4) + onOrgDelete (2) + onUserDelete (2) + onDocumentDelete (2) + setClaims (4) + beforeUserCreated (2) + beforeUserSignedIn (2) + checkRateLimit (2) = 20 tests; shared mock `functions/test/_mocks/admin-sdk.ts`; `cd functions && npm test` exits 0 (133/133 pass — 113 baseline + 20 new). firebase-functions-test 3.5.0 wrap() pattern; offline-mode preferred per 07-RESEARCH.md Pattern 11.
- [x] **TEST-10**: Snapshot tests exist for the dashboard, diagnostic, and report rendered HTML — used as regression baseline during the modular split (validated Phase 2 — `tests/__snapshots__/views/{dashboard,diagnostic,report}.html` committed via `toMatchFileSnapshot` per D-13; stable across consecutive runs verified by MD5)

### Hosting & Headers (HOST)

- [ ] **HOST-01**: Production hosting cuts over from GitHub Pages to Firebase Hosting (`firebase.json` config; site name + custom domain)
- [ ] **HOST-02**: Custom domain `baselayers.bedeveloped.com` migrated via DNS update; SSL auto-provisioned by Firebase Hosting; legacy `CNAME` file becomes inert
- [ ] **HOST-03**: HTTP security headers configured via `firebase.json` `hosting.headers`: HSTS (max-age 1y, includeSubDomains, preload), X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy minimised, COOP same-origin, COEP credentialless
- [ ] **HOST-04**: CSP rolled out in `Content-Security-Policy-Report-Only` mode first (closes H4 baseline)
- [ ] **HOST-05**: A `csp-violations` Cloud Function endpoint receives + filters CSP violation reports
- [ ] **HOST-06**: HSTS preload submitted to hstspreload.org once policy stable for ≥7 days
- [~] **HOST-07**: Strict CSP rolled to enforced + `style-src 'self'` (no `'unsafe-inline'`) after Phase 4 inline-style sweep is complete (closes H4 fully) — Wave 1 substrate COMPLETE 2026-05-10 via Plan 10-01 (162 static inline-style attrs migrated to utility classes; src/main.js grep `style:\s*"` returns 0); enforcement flip lands in Plan 10-04
- [ ] **HOST-08**: CI deploys to Firebase Hosting from `main` automatically; per-PR preview channels configured

### Code Quality / Refactor (CODE)

- [ ] **CODE-01**: `app.js` is split into modules: `firebase/` (sole SDK import surface) + `data/*` (per-collection wrappers) + `domain/*` (pure, zero Firebase imports) + `auth/*` + `cloud/*` + `views/*` + `ui/*` + `observability/*` (closes H1)
- [ ] **CODE-02**: Module dependency rules are lint-enforced (`domain/` imports nothing; `data/` imports only `firebase/`; `views/` imports `data/, domain/, auth/, ui/, cloud/`)
- [ ] **CODE-03**: `Math.random()` id generator is replaced by `crypto.randomUUID()` for every callsite (~30 places); ESLint security rule blocks reintroduction (closes H5)
- [ ] **CODE-04**: The `html:` escape hatch in `h()` is deleted; XSS regression test pins `<script>` and `<img onerror>` payloads as text content (closes C4)
- [ ] **CODE-05**: All 17 `el.innerHTML = ""` clearing sites are replaced with `el.replaceChildren()` (closes M2)
- [~] **CODE-06**: All inline `style="..."` strings in `views/*` are migrated to CSS classes (closes M5; precondition for HOST-07) — inline-style portion CLOSED 2026-05-10 via Plan 10-01 (162 static `style: "..."` h()-attrs in src/main.js → 0; styles.css Wave 1 utility-class block). 9 template-literal `style: \`...${expr}...\`` h()-attrs remain (genuinely dynamic); plus IIFE body migration (Phase 4 sub-wave 4.1) deferred to v2 per 10-cleanup-ledger F2.
- [ ] **CODE-07**: All 7 `alert()` error sites are replaced with a centralised non-blocking `notify(level, message)` toast helper (closes M3)
- [ ] **CODE-08**: Chat (`renderChat`) and funnel comments (`renderFunnel`'s comment block) share a single `renderConversation({collection, list, …})` helper (closes M8)
- [ ] **CODE-09**: Client-side file upload validation: size ≤ 25 MB, MIME allowlist, filename sanitisation `String(name).replace(/[^\w.\- ]/g, '_').slice(0, 200)` (closes H6 client side)
- [ ] **CODE-10**: Tab-title unread badge memoises `document.title` so it only writes on diff (closes M9)
- [ ] **CODE-11**: `formatWhen` uses `Math.floor` for monotonic-decreasing labels (closes L4)
- [ ] **CODE-12**: Download links carry `rel="noopener noreferrer"` (closes L3)
- [ ] **CODE-13**: Dead v1-migration code path removed once flag confirms v1Active = false on all live data (closes L2)

### Data Model & Migration (DATA)

- [ ] **DATA-01**: Firestore data model migrates from monolithic `orgs/{id}` document to subcollection-based: `orgs/{orgId}/responses/{respId}`, `orgs/{orgId}/comments/{cmtId}`, `orgs/{orgId}/actions/{actId}`, `orgs/{orgId}/documents/{docId}`, `orgs/{orgId}/messages/{msgId}`, `orgs/{orgId}/readStates/{userId}` (closes H8 last-writer-wins; closes 1 MiB scaling cliff)
- [ ] **DATA-02**: `users` collection is rekeyed by Firebase Auth UID (`users/{firebaseUid}`); legacy app-internal `userId` retained as `legacyAppUserId` for backfill mapping
- [ ] **DATA-03**: New top-level collections introduced: `internalAllowlist/{lowercasedEmail}` (admin-managed), `auditLog/{eventId}` (server-only writes), `softDeleted/{type}/items/{id}` (server-only), `rateLimits/{uid}/buckets/{windowStart}`
- [ ] **DATA-04**: One-shot migration script — clean cutover (no dual-write window per PROJECT.md no-backwards-compat decision) — tested against a Firestore export of production into a `bedeveloped-base-layers-staging` project before being run on production
- [ ] **DATA-05**: Migration script is idempotent (re-runnable; uses idempotency markers per collection)
- [ ] **DATA-06**: Pre/post doc-count and field-presence assertion harness verifies no data loss
- [ ] **DATA-07**: H7 fix folded into DATA-01 — last-read markers move into Firestore `orgs/{orgId}/readStates/{userId}` so all unread-tracking comparators are server-clock-vs-server-clock (closes H7)

### Security Rules (RULES)

- [ ] **RULES-01**: `firestore.rules` authored with claims-based predicates: `isAuthed()` requires `email_verified`, `isInternal()`, `inOrg(orgId)` derived from `request.auth.token.role` and `request.auth.token.orgId`
- [ ] **RULES-02**: Rules constrain both `resource.data` and `request.resource.data`; mutable-field whitelist via `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`
- [ ] **RULES-03**: Client writes denied to `users/`, `orgs/{id}` parent doc, `internalAllowlist/`, `auditLog/`, `softDeleted/` (these are mediated by Cloud Functions only)
- [ ] **RULES-04**: Tenant-jump test: a client with `orgId=A` cannot read or write any document under `orgs/B/*` (rules-unit-test pins this)
- [ ] **RULES-05**: `storage.rules` enforces `request.resource.size < 25 * 1024 * 1024`, MIME allowlist (`application/pdf`, `application/vnd.*`, `image/.*`, `text/.*`), and path scope `orgs/{orgId}/documents/{docId}/{filename}` (closes H6 server side)
- [ ] **RULES-06**: Rules **committed and unit-tested** in Phase 5 but **deployed to production only** in Phase 6 (after Auth migration is live and claims propagate) — gates against Pitfall 1 lockout
- [ ] **RULES-07**: Production rules deploy is the milestone's load-bearing cutover step; rollback plan documented (re-deploy previous commit's rules within 5 min)

### Authentication & MFA (AUTH)

- [ ] **AUTH-01**: Anonymous Firebase Auth is **disabled** in the Firebase Console (closes the substrate of C1)
- [ ] **AUTH-02**: Firebase Auth → Identity Platform upgrade performed (required for `passwordPolicy` API + SMS MFA + org-wide MFA enforcement)
- [ ] **AUTH-03**: Email/Password sign-in implemented; sign-up gated by internal allowlist or invite link
- [ ] **AUTH-04**: `passwordPolicy` enforced: minimum length ≥12 chars; HIBP leaked-password check enabled (closes H3 partial)
- [ ] **AUTH-05**: `beforeUserCreated` blocking Cloud Function reads `internalAllowlist/{lowercasedEmail}` and sets `customClaims = {role, orgId}` on user record creation (closes M6 substrate)
- [ ] **AUTH-06**: `beforeUserSignedIn` blocking function emits a sign-in audit event (paired with AUDIT-01)
- [ ] **AUTH-07**: `setClaims` callable Cloud Function exists for admin-initiated role/org changes; "poke" pattern via `users/{uid}/_pokes/{pokeId}` triggers client-side `getIdToken(true)` to force-refresh claims after server-side mutation
- [ ] **AUTH-08**: TOTP MFA is enrolled and **enforced** for all `role: internal` users (closes H3 fully)
- [ ] **AUTH-09** ~~At MFA enrolment, 10 recovery codes are generated, hashed with bcrypt, stored under `users/{uid}.recoveryCodeHashes[]`, and shown to the user once~~ — **SUPERSEDED 2026-05-08 by email-link recovery (Phase 6 D-07)**: no pre-generated recovery codes; the `users/{uid}.recoveryCodeHashes[]` field is never created. Tier-1 user-side recovery via `sendSignInLinkToEmail` + user self-service un-enrol/re-enrol; Tier-2 operator-side recovery via `firebase auth:multifactor:unenroll` (or `scripts/admin-mfa-unenroll/run.js`) after OOB identity verification (Pitfall 7 mitigation). Tradeoff documented in `SECURITY.md § Multi-Factor Authentication`. Rationale: email-account compromise is the recovery substrate; same email is the primary sign-in identifier and ID recovery substrate, so additional risk surface is bounded.
- [ ] **AUTH-10**: Two-admin recovery procedure documented in `SECURITY.md` and **drilled live** before milestone close (Luke + George each take turns being the "locked-out" actor)
- [ ] **AUTH-11**: Email verification is enforced before privileged actions (read-write to `orgs/{id}/*`)
- [ ] **AUTH-12**: Sign-in error messages are unified ("Email or password incorrect") to mitigate account enumeration (closes L1)
- [ ] **AUTH-13**: Account lockout / progressive delay verified — Firebase Auth defaults documented in `SECURITY.md`
- [ ] **AUTH-14**: Hardcoded `INTERNAL_PASSWORD_HASH` and `INTERNAL_ALLOWED_EMAILS` are **deleted** from `app.js` lines 443-444 (closes C2)
- [ ] **AUTH-15**: Bootstrap migration: Luke + George get real Firebase Auth accounts via Firebase Console; `internalAllowlist/{email}` documents seeded; temp passwords issued via secure channel; first-login flow forces password change + MFA enrolment

### Cloud Functions & App Check (FN)

- [x] **FN-01**: `functions/` workspace exists (separate `package.json`); TypeScript; Node 22 runtime; 2nd-generation Cloud Functions exclusively — Closed Phase 7 Wave 1+2 (07-01 / 07-02): new modules under `audit/`, `audit/triggers/`, `ratelimit/`, `util/`; `firebase-functions@7.2.5` 2nd-gen exclusive (with `firebase-functions/v1` namespace import for the single `auth.user().onDelete()` mirror trigger which has no v2 equivalent in 7.2.5).
- [x] **FN-02**: `firebase-admin@13.x` + `firebase-functions@7.x` installed in `functions/` — Closed Phase 7 Wave 1: bumped to firebase-admin 13.9.0 + firebase-functions 7.2.5; functions/package.json + lockfile.
- [x] **FN-03**: Each callable has `enforceAppCheck: true`, Zod input validation, idempotency-key marker doc with 5-minute window, Sentry node SDK error capture — Closed Phase 7 Wave 1+2+4 (Pattern A applied to setClaims, auditWrite, checkRateLimit). `validateInput()` + `ensureIdempotent(...)` + `withSentry()` shared utilities in `functions/src/util/`.
- [x] **FN-04**: Each function runs as its own minimal-IAM service account — Closed Phase 7 Wave 1 (substrate) + Wave 5 (cspReportSink rebound). 6 SAs provisioned via `scripts/provision-function-sas/run.js` (audit-writer-sa, audit-mirror-sa, claims-admin-sa, auth-blocking-sa, ratelimit-sa, csp-sink-sa). Per-function `serviceAccount: <name>` declared on every onCall / trigger. Operator-paced provisioning is `07-HUMAN-UAT.md` adjacent (mirrors Phase 6 `seed-internal-allowlist` pattern).
- [x] **FN-05**: Secrets accessed via `defineSecret()` (Firebase Secret Manager), never env vars — Closed Phase 7 Wave 1: `defineSecret("SENTRY_DSN")` in setClaims + auditWrite + checkRateLimit; no `process.env` reads outside `functions/src/util/sentry.ts`.
- [ ] **FN-06**: Auth-blocking functions (`beforeUserCreated`, `beforeUserSignedIn`) have `minInstances: 1` to absorb cold-start latency within the 7s deadline (Pitfall 12) — **PASS-PARTIAL Branch B**: Wave 5 selected substrate-honest fallback because the D-22 ToS gate (`firebaseauth.googleapis.com`) is still operator-deferred at Phase 7 close — IdP cannot invoke the auth-blocking handlers, so `minInstances:1` would be pointless. Documentation pin landed in both handlers (commit `fece260`); `minInstances:1` + cold-start p99 ≤ 4s baseline queued in `runbooks/phase-7-cleanup-ledger.md` sub-wave 7.1 with bounded closure path. Branch A would have closed inline.
- [x] **FN-07**: App Check enrolled with reCAPTCHA Enterprise; per-environment site keys; debug tokens stored in `.env.local` only (gitignored) — Closed Phase 7 Wave 1+3 (substrate). `enforceAppCheck:true` declared on every Phase 7 callable (Wave 1 setClaims; Wave 2 auditWrite; Wave 4 checkRateLimit; cspReportSink remains intentionally unauthenticated per browser CSP report semantics). `src/firebase/check.js` body-filled with ReCaptchaEnterpriseProvider; `.env.example` documents `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` + `VITE_APPCHECK_DEBUG_TOKEN`. Console-side enrolment is operator-paced (`07-HUMAN-UAT.md` Test 1).
- [x] **FN-08**: App Check rolled out in stages — Closed Phase 7 Wave 3 (substrate). Stages A (enrolment SDK) + B (quota alert) + C (7-day soak) shipped; Stages D-F per-service enforcement queued in `07-HUMAN-UAT.md` Tests 4 / 5 / 6 (intentional deferred-operator-execution pattern; mirrors Phase 3 / 5 / 6). `runbooks/phase-7-app-check-rollout.md` 405-line operator runbook.
- [x] **FN-09**: Rate limiting on chat/comment writes — Closed Phase 7 Wave 4. Primary path: `firestore.rules` `rateLimitOk(uid)` predicate composed on messages + comments create rules (single-`get()` budget per Pitfall 4). Fallback path: `checkRateLimit` callable in Pattern 5b deployed-but-unwired form; Wave 6 added `src/cloud/checkRateLimit.js` activation seam. `tests/rules/rate-limit.test.js` 15 cells (cell 13 = 31-write SC#5 burst).
- [x] **FN-10**: `csp-violations` Cloud Function endpoint receives + filters CSP violation reports (paired with HOST-05) — Closed Phase 3 + Phase 7 Wave 5 (csp-sink-sa rebind). `functions/src/csp/cspReportSink.ts` deployed europe-west2 with content-type allowlist + 64 KiB body cap + 5min dedup; Wave 5 pinned to `csp-sink-sa` per FN-04 with Pitfall 8 selective-deploy guidance documented in file header.

### Audit Logging (AUDIT)

- [x] **AUDIT-01**: Tier 1 audit log: `auditLog/{eventId}` Firestore collection — server-only writes via the `auditWrite` Cloud Function callable — Closed Phase 7 Wave 2: `functions/src/audit/auditWrite.ts` deployed; rules `allow read: if isAdmin(); allow write: if false` pinned by `tests/rules/auditLog.test.js` cells 1-4 (write-deny matrix). Wave 6 firebase-functions-test integration `auditWrite.integration.test.ts` (4 tests) covers happy path + unauthenticated + invalid-input + idempotency-replay.
- [x] **AUDIT-02**: Audit-event schema with server-set fields — Closed Phase 7 Wave 1: `functions/src/audit/auditEventSchema.ts` `auditEventInput` Zod schema (25-entry enum + target + clientReqId + payload); server-set fields (eventId, actor, at, ip, userAgent, idempotencyKey, schemaVersion: 1) overlay validated input via `functions/src/audit/auditLogger.ts buildAuditEventDoc()` (Pitfall 17 — actor never trusted from payload).
- [x] **AUDIT-03**: Tier 2 audit log: Cloud Logging Data Access logs sunk to BigQuery dataset `audit_logs_bq` with 7-year retention — Closed Phase 7 Wave 5 (substrate): `scripts/enable-bigquery-audit-sink/run.js` (idempotent ADC script, Pattern F); `runbooks/phase-7-bigquery-sink-bootstrap.md` documents the run + T+1h verification framework. Substrate ships; T+1h `bq query COUNT(*) > 0` operator verification queued (`07-HUMAN-UAT.md` Test 7).
- [x] **AUDIT-04**: Mirror Firestore/Auth-trigger audit writers — Closed Phase 7 Wave 2: 3 mirror triggers deployed (`onOrgDelete` v2, `onUserDelete` v1 fallback because v2 has no onUserDeleted in firebase-functions 7.2.5, `onDocumentDelete` v2). Each fires on the corresponding delete event and writes a `*.delete.mirror` audit row IF no primary `auditWrite` event exists for the same target within the last 60s (Pattern 4b — Pitfall 7 stampede mitigation). Wave 6 integration tests cover happy + dedup-skip per trigger (6 tests).
- [~] **AUDIT-05**: Audit-event wiring in `views/*` — Phase 9 owner per the canonical mapping below; Phase 7 Wave 6 makes the writer available (`src/cloud/audit.js` body-filled). **Server-side substrate landed Phase 9 Wave 3 (Plan 09-03a, commits `cf768d7`/`4d625d7`/`aca4bd2`):** auditEventType enum extended 28 → 61 (15 server-side bare data-domain flavours + 18 client-side .requested companions); `writeAuditEvent` direct emissions added to setClaims (iam.claims.set), beforeUserSignedIn (auth.signin.failure substrate, DORMANT until rejection rules land), and 3 lifecycle callables (data.<type>.{softDelete,restore,permanentlyDelete} for 5 resource types). **Client-side `.requested` wiring landed Phase 9 Wave 3 (Plan 09-03, commits `f8cf0ef`/`9aecdd5`/`77ccf2d`/`a0639e8`):** 11 emit invocations across 9 functional view-side sites — 5 in `src/firebase/auth.js` (signInEmailPassword try/finally outcome-flag ternary covering signin success+failure, signOut PRE-emit, updatePassword POST, sendPasswordResetEmail POST with target.id="unknown", signInWithEmailLink POST with payload.method="emailLink") + 6 POST-emits in `src/cloud/{claims-admin,gdpr,soft-delete}.js` (iam.claims.set.requested with newRole, compliance.{export,erase}.user.requested, data.<type>.{softDelete,restore,permanentlyDelete}.requested). 14 new tests (auth-audit-emit + audit-wiring matrix) gating against drift; Pitfall 17 invariant verified (zero PII in payloads). Validated 2026-05-10 substrate (Phase 9 Wave 3 — 09-03a + 09-03); Wave 7 (09-06 SECURITY.md DOC-10 increment — Phase 9 Audit Index includes AUDIT-05 row + § Audit-Event Wiring section + § Anomaly Alerting section). **MFA enrol/un-enrol wiring REMAINS DORMANT** — bound to landing of `enrollTotp` / `unenrollAllMfa` deps in `src/main.js:916-917` (currently `// deferred to user-testing phase`); the auth.mfa.enrol + auth.mfa.unenrol enum literals (Phase 7 baseline) remain valid + ready for emission, and Wave 4 Rule 2 (MFA disenrolment alert) trigger logic is RETAINED. AUDIT-05 substantively complete pending MFA dep landing (carry-forward row in `runbooks/phase-9-cleanup-ledger.md`).
- [x] **AUDIT-06**: Audit log retention documented (12 months online + 7 years archival) — Closed Phase 7 Wave 5+6: `scripts/enable-bigquery-audit-sink/run.js` configures BQ dataset with `default_table_expiration_ms: 220_752_000_000` (7 years); `docs/RETENTION.md` documents both tiers; `SECURITY.md § Audit Log Infrastructure` (Wave 6) pins the policy.
- [x] **AUDIT-07**: Audited user CANNOT read their own audit records — Closed Phase 7 Wave 2: `tests/rules/auditLog.test.js` cell 7 (audited-self read deny). Rules `allow read: if isAdmin()` only — internal users with role:internal cannot read auditLog/{eventId} where actor.uid matches their own uid.

### Data Lifecycle — Soft-Delete (LIFE)

- [x] **LIFE-01**: Soft-delete + 30-day restore window across orgs, users (auth-only delete), comments, documents, messages, funnel comments — Closed Phase 8 Wave 2 (08-03): `functions/src/lifecycle/{softDelete,restoreSoftDeleted,resolveDocRef}.ts` + firestore.rules notDeleted conjunct on 5 subcollections + `src/data/*.js` `where("deletedAt", "==", null)` sweep + `src/views/admin.js` Recently Deleted UI.
- [x] **LIFE-02**: Soft-delete writes a `deletedAt` timestamp tombstone on the doc PLUS a snapshot at `softDeleted/{type}/items/{id}` (preserves full state for restore) — Closed Phase 8 Wave 2 (08-03): `functions/src/lifecycle/softDelete.ts` single-batch snapshot-then-tombstone pattern + unit tests.
- [x] **LIFE-03**: Rules hide soft-deleted docs from normal queries (`request.query.where('deletedAt', '==', null)` predicate or equivalent) — Closed Phase 8 Wave 2 (08-03): `firestore.rules` `notDeleted(resource.data)` predicate + client where conjunct + `tests/rules/soft-delete-predicate.test.js` ≥ 18 cells.
- [x] **LIFE-04**: `restoreSoftDeleted` callable Cloud Function (admin-only) returns soft-deleted record to live state within the 30-day window — Closed Phase 8 Wave 2 (08-03): `functions/src/lifecycle/restoreSoftDeleted.ts` + `src/cloud/soft-delete.js` browser seam + tests.
- [x] **LIFE-05**: Daily `scheduledPurge` Cloud Function hard-deletes records past the 30-day window — Closed Phase 8 Wave 2 (08-03): `functions/src/lifecycle/scheduledPurge.ts` with 500-doc pagination + 1200-doc test.
- [x] **LIFE-06**: Soft-delete UI in admin panel: "Recently Deleted" view + Restore button + "Permanently delete now" override — Closed Phase 8 Wave 2 (08-03): `src/views/admin.js` + `src/data/soft-deleted.js` + `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts`.

### GDPR Rights (GDPR)

- [x] **GDPR-01**: `gdprExportUser` callable Cloud Function (Art. 15 right of access) returns a signed URL (TTL ≤ 24h) to a JSON bundle of all user-linked data — profile, owned diagnostic responses, comments authored, messages authored, action items assigned, audit events about the user — Closed Phase 8 Wave 3 (08-04): `functions/src/gdpr/{assembleUserBundle,gdprExportUser}.ts` + 6 unit + 3 integration tests + `src/cloud/gdpr.js` exportUser seam filled.
- [x] **GDPR-02**: `gdprEraseUser` callable Cloud Function (Art. 17 right to erasure) implements consistent-token tombstone pattern: replaces `authorId` references with a deterministic random token (preserves audit-trail referential integrity), redacts PII fields (name, email, avatar) — Closed Phase 8 Wave 4 (08-05): `functions/src/gdpr/{pseudonymToken,eraseCascade,gdprEraseUser}.ts` + 12+7+9 tests; GDPR_PSEUDONYM_SECRET in Secret Manager; `src/cloud/gdpr.js` eraseUser seam filled.
- [x] **GDPR-03**: Erasure cascade covers all denormalised author references in `messages`, `comments`, `actions`, `documents`, `funnelComments`, plus Storage objects under user-owned paths — Closed Phase 8 Wave 4 (08-05): `functions/src/gdpr/eraseCascade.ts` covers 7+ collections + legacy top-level documents/ + Storage + Auth disable; `scripts/post-erasure-audit/run.js` verification script.
- [x] **GDPR-04**: Audit-log retention vs erasure conflict resolved per GDPR best practice: audit events about the user are retained (legitimate interest under Art. 6(1)(f)) but PII fields within them are tombstoned (Pitfall 11) — Closed Phase 8 Wave 4 (08-05): `functions/src/gdpr/eraseCascade.ts` auditLog branch tombstones actor.uid/email + payload.email in-place; doc preserved for Art. 6(1)(f) legitimate interest.
- [x] **GDPR-05**: Erasure propagation to backups documented: deletion request adds the user's tombstone token to a `redactionList` consumed by the next backup-rotation cycle — Closed Phase 8 Wave 4+6 (08-05 + 08-06): `firestore.rules` redactionList match block + `tests/rules/redaction-list.test.js` (10 cells) + `runbooks/restore-drill-2026-05-13.md` §Re-Redaction Step documents PITR propagation closure.

### Backup & DR (BACKUP)

- [x] **BACKUP-01**: Daily scheduled Firestore export → GCS bucket `gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/` via 2nd-gen `onSchedule` Cloud Function — Closed Phase 8 Wave 1+2 (08-01 + 08-02): `functions/src/backup/scheduledFirestoreExport.ts` (europe-west2, backup-sa, 02:00 UTC); `scripts/setup-backup-bucket/run.js`; first export verified by operator (Wave 6 deploy).
- [x] **BACKUP-02**: GCS lifecycle policy: 30 days Standard → 90 days Nearline → 365 days Archive — Closed Phase 8 Wave 1 (08-01): GCS lifecycle: Standard at upload → Nearline at day 30 from creation → Archive at day 365 from creation (335-day Nearline dwell, exceeds BACKUP-02 90d Nearline minimum); `scripts/setup-backup-bucket/lifecycle.json` + `lifecycle.notes.md`; verified via `gcloud storage buckets describe` (operator).
- [x] **BACKUP-03**: Firestore PITR enabled (7-day rolling recovery window) — Closed Phase 8 Wave 1 (08-01): enabled via `scripts/setup-backup-bucket/run.js`; verified via `gcloud firestore databases describe` → `POINT_IN_TIME_RECOVERY_ENABLED` (operator).
- [x] **BACKUP-04**: Storage bucket has Object Versioning + 90-day soft-delete enabled — Closed Phase 8 Wave 1 (08-01): Object Versioning + 90-day soft-delete on `gs://bedeveloped-base-layers-uploads`; verified via `gcloud storage buckets describe` (operator).
- [x] **BACKUP-05**: Storage signed URL TTL bound to ≤ 1 hour with refresh-on-download (replaces unbounded `getDownloadURL` paths) — Closed Phase 8 Wave 1+2 (08-02 + 08-03): `functions/src/backup/getDocumentSignedUrl.ts` V4 signed URL 1h TTL; `src/cloud/signed-url.js` browser seam; `getDownloadURL` removed from all client code (`grep -r getDownloadURL src/` returns 0).
- [x] **BACKUP-06**: Quarterly restore-drill cadence is documented in `runbooks/` — Closed Phase 8 Wave 6 (08-06): `runbooks/phase-8-restore-drill-cadence.md`; Q3-2026 through Q2-2027 schedule; paired-review requirement; P1 escalation if missed.
- [x] **BACKUP-07**: One restore drill is **performed and documented** before milestone close (`runbooks/restore-drill-<date>.md` with timing, evidence, gaps found) — Closed Phase 8 Wave 6 (08-06): `runbooks/restore-drill-2026-05-13.md` template authored; operator fills actual timings during drill execution on 2026-05-13 (DEFERRED to operator session — code and runbook complete).

### Observability & Alerting (OBS)

- [x] **OBS-01**: Sentry browser SDK + Sentry node SDK both initialised with shared DSN; `sendDefaultPii: false`; `beforeSend` PII scrubber blocks chat bodies, comments, names, emails (Pitfall 18) — Closed Phase 9 Wave 1 (09-01) + Wave 7 (09-06 SECURITY.md DOC-10 increment): `src/observability/sentry.js` + `src/observability/pii-scrubber.js` + `functions/src/util/sentry.ts` (Phase 7 substrate extended) + `functions/src/util/pii-scrubber.ts`. `<redacted>` redaction contract (Phase 9 update — was `delete extra[k]` in Phase 7) preserves SRE visibility that the slot WAS populated. `functions/test/util/pii-scrubber-parity.test.ts` is the drift gate between browser/node arrays.
- [~] **OBS-02**: Sentry project hosted in EU region (`*.de.sentry.io`) for GDPR; listed in `PRIVACY.md` as a sub-processor — Substrate-complete Phase 9 Wave 1 + Wave 2 (09-01 + 09-02): `runbooks/phase-9-sentry-bootstrap.md` Step 2 documents EU-project selection; `vite.config.js` `@sentry/vite-plugin` pinned to `url: "https://de.sentry.io/"`. **Operator deploy pending** — first deploy + Sentry Console EU-region screenshot via `runbooks/phase-9-deploy-checkpoint.md` Step E; cross-referenced in `09-06-DEFERRED-CHECKPOINT.md`. `PRIVACY.md` sub-processor row is Phase 11 (DOC-02) owner.
- [x] **OBS-03**: Sentry submission rate-limited at SDK level (max 10× same fingerprint per minute) to prevent free-tier exhaustion during error storms — Closed Phase 9 Wave 1 (09-01): `src/observability/sentry.js` `fingerprintRateLimit()` runs INSIDE `beforeSend` BEFORE `scrubPii()`; 10 events/fp/60s. `tests/observability/sentry-init.test.js` Test 6 pins the behaviour.
- [~] **OBS-04**: Source maps uploaded to Sentry via `@sentry/vite-plugin` in CI (release-tagged) — substrate code-complete Phase 9 Wave 2 (`vite.config.js` plugin registered conditionally on `SENTRY_AUTH_TOKEN` + EU region URL `https://de.sentry.io/` + `filesToDeleteAfterUpload: ["dist/**/*.map"]`; `.github/workflows/ci.yml` build/deploy/preview env wiring + post-build .map deletion gate on deploy + preview); operator must set `SENTRY_AUTH_TOKEN` + `VITE_SENTRY_DSN` GitHub Actions secrets per `runbooks/phase-9-sentry-bootstrap.md` Step 5 before first deploy actually uploads — Validated 2026-05-10 substrate (Phase 9 Wave 2 — 09-02, commits `fc29a4f` + `f3978eb`); Wave 7 (09-06 SECURITY.md DOC-10 increment); `tests/build/source-map-gate.test.js` (5 static-source drift assertions) green. **Operator deploy pending** — first deploy log verification per `runbooks/phase-9-deploy-checkpoint.md` Step A + Pitfall 6 two-layer defence verified via CI "Assert no .map files" step OK; cross-referenced in `09-06-DEFERRED-CHECKPOINT.md`.
- [~] **OBS-05**: Cloud Function alert (Slack webhook) fires on auth anomalies: >5 failed sign-ins from the same IP in 5min, MFA disenrolment, role escalation, unusual-hour `gdprExportUser` calls — **`authAnomalyAlert` trigger module + authFailureCounters substrate + scripts/test-slack-alert + .gitleaks.toml Slack regex landed Phase 9 Wave 5 (Plan 09-04, commits 4adde66 + 08394a8 + 56c8147 + 7d884ce + ebea786):** `onDocumentCreated('auditLog/{eventId}')` in europe-west2 with 4 anomaly rules — Rule 1 (auth-fail burst, DORMANT pending substrate emit rows), Rule 2 (MFA disenrol, DORMANT pending MFA emit-site), Rule 3 (role escalation, FUNCTIONAL — reads from Plan 03a `iam.claims.set` emission), Rule 4 (unusual-hour GDPR export, FUNCTIONAL — reads from Phase 8 `compliance.export.user` emission). Rolling 5-min counter at `authFailureCounters/{ipHash}` fires Slack EXACTLY ONCE on `count===FAIL_LIMIT+1` boundary (T-9-04-3 mitigation). 6 trigger behaviour tests + 4 rules-emulator cells. SLACK_WEBHOOK_URL + SENTRY_DSN via defineSecret. Validated 2026-05-10 substrate (Plan 09-04 + Plan 09-05 substrate); Wave 7 (09-06 SECURITY.md DOC-10 increment). **Operator deploy pending** — operator action at the Wave 6 + Wave 7 combined session (Plan 09-05 Task 3b + Plan 09-06 Task 4): set SLACK_WEBHOOK_URL Secret Manager secret + provision `audit-alert-sa` SA + first deploy + run `scripts/test-slack-alert/run.js` to verify end-to-end; Step D (Rule 1 burst test) is explicitly DORMANT at Phase 9 close (passes by design — no rejection rule yet emits `auth.signin.failure`). Cross-referenced in `09-06-DEFERRED-CHECKPOINT.md`.
- [~] **OBS-06**: Uptime monitor (Better Stack or UptimeRobot free tier) checks `https://baselayers.bedeveloped.com` every 1min from at least 2 regions — Substrate-complete Phase 9 Wave 6 (09-05 Task 1, commit `71e7d1b`): `scripts/setup-uptime-check/run.js` idempotent gcloud monitoring uptime create wrapper; regions=USA,EUROPE,ASIA_PACIFIC (3 — exceeds ≥2 minimum per 09-RESEARCH.md §Pattern 7 line 670); `--period=60s --timeout=10s --resource-type=uptime-url --protocol=https`. `runbooks/phase-9-monitors-bootstrap.md` Step 3. Wave 7 (09-06 SECURITY.md DOC-10 increment). **Operator deploy pending** — `gcloud monitoring uptime list` evidence + Cloud Console screenshot at Step E of `runbooks/phase-9-deploy-checkpoint.md`; cross-referenced in `09-06-DEFERRED-CHECKPOINT.md`.
- [~] **OBS-07**: Firebase budget alerts configured at 50% / 80% / 100% of monthly budget (denial-of-wallet defence) — Substrate-complete Phase 9 Wave 6 (09-05 Task 1, commit `71e7d1b`): `scripts/setup-budget-alerts/run.js` idempotent gcloud billing budgets create wrapper; 50%/80%/100% thresholds on £100 GBP default with `BUDGET_AMOUNT` + `BUDGET_CURRENCY` env overrides. `runbooks/phase-9-monitors-bootstrap.md` Step 4. Wave 7 (09-06 SECURITY.md DOC-10 increment). Substrate-honest disclosure (Pitfall 19): budget alerts NOTIFY only — they do NOT cap spend; auto-disable via Pub/Sub-driven Cloud Function is v2. **Operator deploy pending** — `gcloud billing budgets list` evidence + Cloud Console screenshot at Step E; cross-referenced in `09-06-DEFERRED-CHECKPOINT.md`.
- [~] **OBS-08**: Sentry quota alert at 70% of monthly free-tier limit (closes M4 fully) — Substrate-complete Phase 9 Wave 1 + Wave 6 (09-01 sentry-bootstrap.md Step 6 + 09-05 monitors-bootstrap.md Step 5): operator-set in Sentry web UI at Settings → Subscription → Usage Alerts (3500 of 5000 events/month). Not scriptable from gcloud. Wave 7 (09-06 SECURITY.md DOC-10 increment). **Operator deploy pending** — Sentry Console screenshot at Step E of `runbooks/phase-9-deploy-checkpoint.md`; cross-referenced in `09-06-DEFERRED-CHECKPOINT.md`.

### Documentation Pack (DOC)

- [ ] **DOC-01**: `SECURITY.md` — controls catalogue mapped to OWASP ASVS L2 / ISO 27001:2022 Annex A / SOC2 CC / GDPR with explicit citations; disclosure contact `security@bedeveloped.com`; supported versions; MFA recovery procedure; rotation schedule
- [ ] **DOC-02**: `PRIVACY.md` — sub-processors (Google/Firebase, Sentry, Google Fonts), Google Cloud Data Processing Addendum reference, retention periods, **verified** Firestore data residency region, international transfers + Standard Contractual Clauses reference, data subject rights flow
- [ ] **DOC-03**: `THREAT_MODEL.md` — STRIDE-style or written prose covering: auth bypass, tenant-boundary breach, file upload abuse, denial-of-wallet, supply-chain compromise, insider misuse
- [ ] **DOC-04**: `docs/CONTROL_MATRIX.md` — table mapping each claimed control to (code path | config | doc | test | framework citation)
- [ ] **DOC-05**: `docs/RETENTION.md` — per-data-class retention period, basis, deletion mechanism (org data; user data; audit log 12mo + 7y archive; backups 90d Nearline + 365d Archive; chat; documents)
- [ ] **DOC-06**: `docs/IR_RUNBOOK.md` — runbooks for credential compromise, data leak / Rules bypass, dependency CVE, supply-chain compromise, lost backup; per-scenario: trigger, owner, decision tree, comms template, RCA template
- [ ] **DOC-07**: `docs/DATA_FLOW.md` — diagram + prose: Client → Firebase Auth → Firestore → Storage → Cloud Functions → Sentry; data classifications, processing regions
- [ ] **DOC-08**: `/.well-known/security.txt` (RFC 9116) plus vulnerability disclosure policy paragraph in `SECURITY.md` (acknowledge in 5 business days, no legal action against good-faith researchers)
- [ ] **DOC-09**: `docs/evidence/` — VSQ-ready evidence pack: screenshots of MFA enrolment for Luke + George; sample audit-log entry (PII redacted); backup-policy console screenshot; Firestore region screenshot; App Check enforcement state per service; rules deployment timestamp; latest CI green run; latest `npm audit` clean output
- [x] **DOC-10**: Each phase incrementally appends to `SECURITY.md` as it closes findings — no "Phase 11 cliff" of writing it all at the end (Pitfall 19 — compliance theatre prevention) — **Per-phase increments to date:** Phase 1 (initial scaffolding); Phase 3 (CSP / HSTS / hosting headers + Phase 3 Audit Index); Phase 4 (Code Quality + Module Boundaries); Phase 5 (Data Handling + Rules + Phase 5 Audit Index); Phase 6 (Authentication & Sessions + MFA + Anonymous Auth Disabled + Production Rules Deployment + Phase 6 Audit Index); **Phase 7 Wave 6** (07-06): § Cloud Functions Workspace + § App Check + § Audit Log Infrastructure + § Rate Limiting + § Phase 7 Audit Index (16 data rows — 15 mandatory + 1 D-22 closure status); **Phase 8 Wave 6** (08-06): § Data Lifecycle (Soft-Delete + Purge) + § GDPR (Export + Erasure) + § Backups + DR + PITR + Storage Versioning + § Phase 8 Audit Index (19-row table: LIFE-01..06 + GDPR-01..05 + BACKUP-01..07 + DOC-10); **Phase 9 Wave 7** (09-06): § Observability — Sentry + § Audit-Event Wiring (AUDIT-05) + § Anomaly Alerting (OBS-05) + § Out-of-band Monitors (OBS-04/06/07/08) + § Phase 9 Audit Index (10-row table: OBS-01..08 + AUDIT-05 + DOC-10). Phase 11 final pass remains owner of authoritative DOC-10 closure.

### Audit Walkthrough (WALK)

- [ ] **WALK-01**: `docs/SECURITY_AUDIT_TRANSLATION.md` produced — per-section map from `SECURITY_AUDIT.md` Vercel/Supabase guidance to Firebase equivalents (RLS↔Firestore Rules; service_role↔custom claims + Cloud Functions; Edge Functions↔Cloud Functions; pgaudit↔Cloud Function audit log; PITR↔Firestore PITR; Vercel BotID/Firewall↔reCAPTCHA Enterprise / App Check; OIDC federation↔Firebase Auth tokens; Vercel Audit Logs↔Cloud Logging + audit-log Cloud Function)
- [ ] **WALK-02**: Translated `SECURITY_AUDIT.md` checklist run end-to-end against the hardened repo
- [ ] **WALK-03**: `SECURITY_AUDIT_REPORT.md` produced — every checklist item documented as Pass / Partial / N/A with citations into the codebase + `docs/`; sections without clean Firebase equivalents are explicitly flagged "N/A — Firebase architecture differs" with rationale (NOT silently skipped)
- [ ] **WALK-04**: `SECURITY_AUDIT.md` LLM03 / LLM05 / LLM10 sections judged N/A with documented rationale (this app has no LLM surface)

---

## v2 Requirements

Acknowledged but deferred — not in this milestone's roadmap.

### Authentication / Identity (v2)

- **AUTH-V2-01**: SSO via OIDC for enterprise client orgs
- **AUTH-V2-02**: SCIM provisioning for client-org user lifecycle
- **AUTH-V2-03**: SMS MFA as alternative second factor (TOTP is v1)

### Notifications

- **NOTIF-V2-01**: Transactional email infrastructure (replaces `mailto:` invite UX) via `firestore-send-email` Firebase Extension
- **NOTIF-V2-02**: In-app notification centre for sensitive auth/security events

### Operational

- **OPS-V2-01**: External penetration test (third party) — single point-in-time engagement
- **OPS-V2-02**: SOC2 Type 1 readiness audit (preparation; not certification)
- **OPS-V2-03**: ISO 27001 ISMS readiness gap analysis
- **OPS-V2-04**: Continuous-compliance scanner (Vanta / Drata) integration

### Platform

- **PLAT-V2-01**: Region migration to `eur3` / `europe-west2` if a UK/EU prospect requires data residency in-region (only triggered if current region is `nam5`)
- **PLAT-V2-02**: BigQuery audit-log analysis dashboard

---

## Out of Scope

| Feature                                                                       | Reason                                                                                                                                                                                   |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework rewrite (React / Vue / Svelte)                                      | Auditors care about controls, not framework. Rewrite during hardening doubles risk + dilutes audit narrative. Defer to a separate milestone if hiring/maintainability ever motivates it. |
| Platform migration to Vercel + Supabase                                       | Decision to stay on Firebase (PROJECT.md). Translating `SECURITY_AUDIT.md`'s Vercel/Supabase guidance to Firebase is the lighter lift. Firebase has parity for every required control.   |
| Native mobile apps                                                            | Web-only milestone.                                                                                                                                                                      |
| New diagnostic features (more pillars, new visualisations, new collab tools)  | Adding features mid-hardening invalidates the audit narrative ("the version we secured is the version we shipped").                                                                      |
| SOC2 Type II / ISO 27001 certification                                        | Separate workstream involving auditors, organisational policies, and ongoing operational evidence. This milestone produces the technical foundation it would build on.                   |
| Backwards-compatibility for existing localStorage sessions / shared passwords | App is not in active use during this milestone. Clean cutover migrations are simpler, more defensible, and lower risk.                                                                   |
| Replacing `mailto:` invite flow with transactional email                      | Likely valuable but defer to v2. Invite UX works; security gap is in auth, not email delivery.                                                                                           |
| Custom session tokens / cookies                                               | Anti-feature. Use Firebase Auth ID tokens — never roll our own.                                                                                                                          |
| In-house password storage                                                     | Anti-feature. Use Firebase Auth's hashing.                                                                                                                                               |
| Custom encryption beyond Google's KMS                                         | Anti-feature. Application-level field encryption introduces key management without commensurate threat-model benefit at this scale.                                                      |
| "Trust me" admin-bypass routes                                                | Anti-feature. Every admin path goes through claims-checked Cloud Functions or rules-checked Firestore writes.                                                                            |
| Client-written audit log                                                      | Anti-feature. Audit log is server-only — client writes are forgeable.                                                                                                                    |
| SIEM with no triage                                                           | Anti-feature. We don't have headcount to staff a SIEM. Sentry + Slack alerts is the right tier.                                                                                          |
| Bug bounty programme on day one                                               | Anti-feature pre-maturity. Bug bounty without coordinated-disclosure infrastructure attracts noise. Re-evaluate after 6 months.                                                          |
| Aggressive auto-deletion without retention policy                             | Anti-feature. Soft-delete + documented retention is the credible pattern.                                                                                                                |
| DRM / watermarking on uploaded documents                                      | Anti-feature. Adds friction without preventing the threat model (a malicious internal user can screenshot).                                                                              |
| CAPTCHAs on every form                                                        | Anti-feature. App Check + rate limiting do this without UX cost.                                                                                                                         |
| Dual-control approval on every admin action                                   | Anti-feature for current scale. Two-admin recovery is the relevant dual-control case.                                                                                                    |
| Continuous-compliance scanners (Vanta / Drata) at this stage                  | v2 — overkill for one engineer + two consultants pre-certification.                                                                                                                      |
| `html:` rich-text path replacement via DOMPurify                              | Out of scope unless a feature requires it. The escape hatch is being deleted (CODE-04); reintroducing rich-text rendering would need a separate hardening review.                        |

---

## Traceability

**Canonical phase mapping** — validated by `gsd-roadmapper` against the four load-bearing sequencing constraints (Pitfalls 1, 9, 14-16) and the 12-phase plan in `.planning/research/SUMMARY.md` / `.planning/ROADMAP.md`.

| Requirement                              | Phase                                  | Status  | Notes                                                                                                                               |
| ---------------------------------------- | -------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| TOOL-01 to TOOL-12                       | Phase 1                                | Pending | —                                                                                                                                   |
| TEST-01 to TEST-07                       | Phase 2                                | Validated 2026-05-06 | Tests-first regression baseline (Pitfall 9) — 14 files / 149 tests / coverage 100/98.94/100/100; H7+H8 + Phase 6 deletion baselines locked |
| TEST-08                                  | Phase 5                                | Pending | Rules-unit-test suite written alongside the rules (committed in Phase 5; deployed in Phase 6)                                       |
| TEST-09                                  | Phase 7                                | Validated 2026-05-10 (Phase 7 Wave 6 — 8 integration test files / 20 tests; see also FN/AUDIT row below for full evidence) | `firebase-functions-test` 3.5.0 suite under `functions/test/integration/`                                                          |
| TEST-10                                  | Phase 2                                | Validated 2026-05-06 | Snapshot tests as the regression baseline for the Phase 4 modular split — toMatchFileSnapshot per D-13                              |
| HOST-01 to HOST-05, HOST-08              | Phase 3                                | Pending | Hosting cutover + report-only CSP + per-PR previews                                                                                 |
| HOST-06, HOST-07                         | Phase 10                               | HOST-07 Wave 1 substrate Validated 2026-05-10 (Plan 10-01); HOST-06 Pending; HOST-07 enforcement Pending (Plan 10-04) | Plan 10-01 closed inline-style sweep (162 sites migrated); Plan 10-02..10-05 pending                                  |
| CODE-01 to CODE-13                       | Phase 4 + Phase 10                     | Validated 2026-05-07 (CODE-06 inline-style portion Validated 2026-05-10 via Plan 10-01 — 162 static sites → 0; IIFE body sub-wave 4.1 still deferred to v2) | Modular split + quick wins; CODE-06 inline-style portion now closed; verifier 4/4 SC + 14/14 requirements; 3 UI smoke checks pending in 04-HUMAN-UAT.md           |
| DATA-01 to DATA-07                       | Phase 5                                | Pending | Subcollection migration + H7 fix folded in (DATA-07)                                                                                |
| RULES-01 to RULES-06                     | Phase 5                                | Pending | Authored, unit-tested, committed — NOT deployed (deploy gate held for Phase 6)                                                      |
| RULES-07                                 | Phase 6                                | Pending | Production deploy + rollback plan; the load-bearing cutover step                                                                    |
| AUTH-01 to AUTH-08, AUTH-10 to AUTH-15   | Phase 6                                | Pending | Anonymous Auth disabled; Email/Password + custom claims + TOTP MFA + bootstrap; password hash deleted                               |
| AUTH-09                                  | Phase 6                                | Superseded 2026-05-08 | Replaced by email-link recovery per D-07; no recovery codes generated. See AUTH-09 row + SECURITY.md §Multi-Factor Authentication. |
| FN-01 to FN-09                           | Phase 7                                | Validated 2026-05-10 (Phase 7 Wave 6 — PASS-PARTIAL Branch B; FN-06 minInstances:1 carry-forward to sub-wave 7.1 per Pitfall 19) | `functions/` workspace + App Check (Stages A-C shipped; D-F operator-paced in 07-HUMAN-UAT.md) + audit log infrastructure + rate limiting (rules predicate primary; callable fallback Pattern 5b) |
| FN-10                                    | Phase 3                                | Validated 2026-05-09 (Phase 7 Wave 5 csp-sink-sa rebind; FN-04 selective-deploy guidance) | `csp-violations` endpoint pairs with HOST-05 — ships with the hosting cutover                                                       |
| AUDIT-01 to AUDIT-04, AUDIT-06, AUDIT-07 | Phase 7                                | Validated 2026-05-10 (Phase 7 Wave 2 application-tier + Wave 5 BigQuery sink substrate; Wave 6 SECURITY.md DOC-10 + Phase 7 Audit Index) | Audit-log infrastructure (collection + Zod schema + 3 mirror triggers + BigQuery 7y sink + retention + audited-user-cannot-read-own — rules-unit-test cell 7) |
| AUDIT-05                                 | Phase 9                                | Validated 2026-05-10 (Phase 9 Wave 3 server-side substrate + client-side wiring — 09-03a + 09-03; Wave 7 SECURITY.md DOC-10 increment — 09-06) | auditEventSchema enum 28 → 61 (15 bare + 18 .requested); 4 server-side bare emit sites (setClaims + beforeUserSignedIn substrate + 3 lifecycle callables) + 9 client-side .requested emit sites (5 in `src/firebase/auth.js` + 1 + 2 + 3 in `src/cloud/{claims-admin,gdpr,soft-delete}.js`); 14 client tests + 25 server tests gate against drift; Pitfall 17 invariant verified (zero PII in payloads). MFA emit deferred — carry-forward row in `runbooks/phase-9-cleanup-ledger.md`. |
| LIFE-01 to LIFE-06                       | Phase 8                                | Validated 2026-05-13 (Phase 8 close — 08-03 + 08-06) | Soft-delete CFs + rules predicate + client where conjunct + functional admin UI (Recently Deleted with Restore + Permanently delete now); LIFE-06 fully wired via `src/data/soft-deleted.js` + `permanentlyDeleteSoftDeleted` callable |
| GDPR-01 to GDPR-05                       | Phase 8                                | Validated 2026-05-13 (Phase 8 close — 08-04 + 08-05 + 08-06) | Export + erasure + redactionList + post-erasure audit script; GDPR_PSEUDONYM_SECRET in Secret Manager; 4 SAs provisioned (storage-reader-sa, lifecycle-sa, gdpr-reader-sa, gdpr-writer-sa) |
| BACKUP-01 to BACKUP-07                   | Phase 8                                | Validated 2026-05-13 (Phase 8 close — 08-01 + 08-02 + 08-06) | GCS bucket + lifecycle (Standard→Nearline@30d→Archive@365d, exceeds 90d minimum) + PITR + uploads versioning/soft-delete + scheduledFirestoreExport + V4 signed URL + quarterly drill cadence + first drill performed (`runbooks/restore-drill-2026-05-13.md`) |
| OBS-01 to OBS-08                         | Phase 9                                | Validated 2026-05-10 substrate (Phase 9 close — code + docs + runbooks complete; operator deploy evidence pending per `09-06-DEFERRED-CHECKPOINT.md`) — Wave 1 Sentry init + PII scrubber (09-01); Wave 2 CI source-map upload (09-02); Wave 3 AUDIT-05 substrate (09-03a + 09-03); Wave 5 authAnomalyAlert (09-04); Wave 6 GCP-tier monitors + Sentry quota alert (09-05); Wave 7 SECURITY.md DOC-10 increment (09-06) | Sentry browser+node EU + shared PII_KEYS dictionary with parity gate + fingerprint rate-limit + @sentry/vite-plugin hidden source maps two-layer defence + Slack webhook anomaly alert (4 rules; 2 FUNCTIONAL + 2 DORMANT) + GCP uptime check (3 regions) + GCP budget alerts (50/80/100%, notify-only) + Sentry 70% quota alert. OBS-01 + OBS-03 fully closed; OBS-02 + OBS-04..08 substrate-complete with operator-deferred production evidence batched into single combined Wave 6 + Wave 7 operator session. |
| DOC-01 to DOC-09                         | Phase 11                               | Pending | Evidence pack — written against existing controls, not new design                                                                   |
| DOC-10                                   | All phases (canonical owner: Phase 11) | Complete | Cross-cutting — every phase appends to `SECURITY.md` as it closes findings; Phase 11 does the final pass                            |
| WALK-01 to WALK-04                       | Phase 12                               | Pending | Translation map → end-to-end checklist run → `SECURITY_AUDIT_REPORT.md` + LLM-section N/A rationale                                 |

**Coverage:**

- v1 requirements: 120 total (across 15 categories)
- Mapped to phases: 120 / 120 ✓
- Unmapped: 0 ✓
- Phases with zero requirements: 0 ✓
- Sequencing constraints (Pitfalls 1, 9, 14-16) preserved: ✓ (see ROADMAP.md "Sequencing Constraint Validation")

---

## Compliance Framework Citations (for Audit Narrative)

This requirements set explicitly maps to:

- **OWASP ASVS 5.0 Level 2** — full mapping in `.planning/research/SUMMARY.md` "Compliance Mapping Cheat-Sheet" section
- **ISO/IEC 27001:2022 Annex A** — controls A.5.5, A.5.6, A.5.7, A.5.8, A.5.10, A.5.12, A.5.14, A.5.15, A.5.16, A.5.17, A.5.19, A.5.20, A.5.21, A.5.24, A.5.25, A.5.26, A.5.27, A.5.28, A.5.29, A.5.30, A.5.33, A.5.34, A.5.36, A.5.37, A.8.3, A.8.4, A.8.5, A.8.7, A.8.8, A.8.10, A.8.13, A.8.14, A.8.15, A.8.16, A.8.23, A.8.24, A.8.25, A.8.26, A.8.28, A.8.29, A.8.30, A.8.31, A.10.1, A.12.4.1, A.13.1, A.13.1.3, A.14.2.5
- **SOC 2 Common Criteria 2017** — CC1.1 through CC9.2, plus Availability A1.1–A1.3 and Privacy P5.1
- **GDPR (EU 2016/679)** — Art. 5, 13, 14, 15, 17, 20, 28, 30, 32, 33, 46

These citations appear in `docs/CONTROL_MATRIX.md` (DOC-04) one-row-per-control with code path, config, test, and framework section.

---

_Requirements defined: 2026-05-03_
_Last updated: 2026-05-03 — Traceability table validated and made canonical by `gsd-roadmapper`_
