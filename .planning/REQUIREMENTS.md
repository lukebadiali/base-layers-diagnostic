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

- [ ] **TEST-01**: Vitest 4 + `@vitest/coverage-v8` + `happy-dom` configured and runnable via `npm test`
- [ ] **TEST-02**: Unit tests cover `pillarScoreForRound` + `pillarStatus` + `bandLabel` boundary conditions (closes scoring-regression risk in CONCERNS Test Coverage Gaps)
- [ ] **TEST-03**: Unit tests cover `userCompletionPct` + `orgSummary` math
- [ ] **TEST-04**: Unit tests cover v1→v2 migration (`migrateV1IfNeeded`) and `clearOldScaleResponsesIfNeeded` for idempotency (silent-data-corruption risks)
- [ ] **TEST-05**: Unit tests cover comment unread tracking (`unreadCountForPillar`, `markPillarRead`) and chat unread total (`unreadChatTotal`)
- [ ] **TEST-06**: Unit tests cover `syncFromCloud` bail-on-error logic (cloud sync conflict resolution)
- [ ] **TEST-07**: Unit tests cover auth state machine (`verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword`) — captures behaviour BEFORE replacement in TOOL/AUTH phases
- [ ] **TEST-08**: `@firebase/rules-unit-testing` 5 suite covers every Firestore + Storage Rules collection × every role × allowed/denied path against the local emulator (closes H2 rules slice)
- [ ] **TEST-09**: `firebase-functions-test` 3 suite covers every Cloud Function callable + trigger
- [ ] **TEST-10**: Snapshot tests exist for the dashboard, diagnostic, and report rendered HTML — used as regression baseline during the modular split

### Hosting & Headers (HOST)

- [ ] **HOST-01**: Production hosting cuts over from GitHub Pages to Firebase Hosting (`firebase.json` config; site name + custom domain)
- [ ] **HOST-02**: Custom domain `baselayers.bedeveloped.com` migrated via DNS update; SSL auto-provisioned by Firebase Hosting; legacy `CNAME` file becomes inert
- [ ] **HOST-03**: HTTP security headers configured via `firebase.json` `hosting.headers`: HSTS (max-age 1y, includeSubDomains, preload), X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy minimised, COOP same-origin, COEP credentialless
- [ ] **HOST-04**: CSP rolled out in `Content-Security-Policy-Report-Only` mode first (closes H4 baseline)
- [ ] **HOST-05**: A `csp-violations` Cloud Function endpoint receives + filters CSP violation reports
- [ ] **HOST-06**: HSTS preload submitted to hstspreload.org once policy stable for ≥7 days
- [ ] **HOST-07**: Strict CSP rolled to enforced + `style-src 'self'` (no `'unsafe-inline'`) after Phase 4 inline-style sweep is complete (closes H4 fully)
- [ ] **HOST-08**: CI deploys to Firebase Hosting from `main` automatically; per-PR preview channels configured

### Code Quality / Refactor (CODE)

- [ ] **CODE-01**: `app.js` is split into modules: `firebase/` (sole SDK import surface) + `data/*` (per-collection wrappers) + `domain/*` (pure, zero Firebase imports) + `auth/*` + `cloud/*` + `views/*` + `ui/*` + `observability/*` (closes H1)
- [ ] **CODE-02**: Module dependency rules are lint-enforced (`domain/` imports nothing; `data/` imports only `firebase/`; `views/` imports `data/, domain/, auth/, ui/, cloud/`)
- [ ] **CODE-03**: `Math.random()` id generator is replaced by `crypto.randomUUID()` for every callsite (~30 places); ESLint security rule blocks reintroduction (closes H5)
- [ ] **CODE-04**: The `html:` escape hatch in `h()` is deleted; XSS regression test pins `<script>` and `<img onerror>` payloads as text content (closes C4)
- [ ] **CODE-05**: All 17 `el.innerHTML = ""` clearing sites are replaced with `el.replaceChildren()` (closes M2)
- [ ] **CODE-06**: All inline `style="..."` strings in `views/*` are migrated to CSS classes (closes M5; precondition for HOST-07)
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
- [ ] **AUTH-09**: At MFA enrolment, 10 recovery codes are generated, hashed with bcrypt, stored under `users/{uid}.recoveryCodeHashes[]`, and shown to the user once
- [ ] **AUTH-10**: Two-admin recovery procedure documented in `SECURITY.md` and **drilled live** before milestone close (Luke + George each take turns being the "locked-out" actor)
- [ ] **AUTH-11**: Email verification is enforced before privileged actions (read-write to `orgs/{id}/*`)
- [ ] **AUTH-12**: Sign-in error messages are unified ("Email or password incorrect") to mitigate account enumeration (closes L1)
- [ ] **AUTH-13**: Account lockout / progressive delay verified — Firebase Auth defaults documented in `SECURITY.md`
- [ ] **AUTH-14**: Hardcoded `INTERNAL_PASSWORD_HASH` and `INTERNAL_ALLOWED_EMAILS` are **deleted** from `app.js` lines 443-444 (closes C2)
- [ ] **AUTH-15**: Bootstrap migration: Luke + George get real Firebase Auth accounts via Firebase Console; `internalAllowlist/{email}` documents seeded; temp passwords issued via secure channel; first-login flow forces password change + MFA enrolment

### Cloud Functions & App Check (FN)

- [ ] **FN-01**: `functions/` workspace exists (separate `package.json`); TypeScript; Node 22 runtime; 2nd-generation Cloud Functions exclusively (1st-gen `functions.config()` decommissioned March 2027)
- [ ] **FN-02**: `firebase-admin@13.x` + `firebase-functions@7.x` installed in `functions/`
- [ ] **FN-03**: Each callable has `enforceAppCheck: true`, Zod input validation, idempotency-key marker doc with 5-minute window, Sentry node SDK error capture
- [ ] **FN-04**: Each function runs as its own minimal-IAM service account (`audit-writer-sa` has `roles/datastore.user`, `gdpr-export-sa` has `roles/storage.objectAdmin`, etc.)
- [ ] **FN-05**: Secrets accessed via `defineSecret()` (Firebase Secret Manager), never env vars
- [ ] **FN-06**: Auth-blocking functions (`beforeUserCreated`, `beforeUserSignedIn`) have `minInstances: 1` to absorb cold-start latency within the 7s deadline (Pitfall 12)
- [ ] **FN-07**: App Check enrolled with reCAPTCHA Enterprise; per-environment site keys; debug tokens stored in `.env.local` only (gitignored)
- [ ] **FN-08**: App Check rolled out in stages: 7-day soak in **unenforced** mode → enforced per-service in order (Storage → Firestore collection-by-collection → Cloud Functions); quota monitor alert at 70% of free tier (closes Pitfall 8)
- [ ] **FN-09**: Rate limiting on chat/comment writes — preferred path: Firestore Rules `request.time` predicate against `rateLimits/{uid}/buckets/{windowStart}` doc; fallback path: callable Cloud Function token-bucket (closes "missing rate limiting" gap)
- [ ] **FN-10**: `csp-violations` Cloud Function endpoint receives + filters CSP violation reports (paired with HOST-05)

### Audit Logging (AUDIT)

- [ ] **AUDIT-01**: Tier 1 audit log: `auditLog/{eventId}` Firestore collection — server-only writes via the `auditWrite` Cloud Function callable; rules `allow read: if isInternal(); allow write, update, delete: if false`
- [ ] **AUDIT-02**: Audit-event schema: `{eventId, eventType, timestamp (serverTimestamp), actorUid, actorEmail, actorRole, targetType, targetId, targetOrgId, action, before, after, ip, userAgent, schemaVersion}`
- [ ] **AUDIT-03**: Tier 2 audit log: Cloud Logging Data Access logs sunk to BigQuery dataset `audit_logs_bq` with 7-year retention (compliance archive)
- [ ] **AUDIT-04**: Mirror Firestore-trigger audit writers attach to sensitive collections (`onOrgDelete`, `onUserDelete`, `onDocumentDelete`) for defence-in-depth — even if the client forgets to call `auditWrite`, the event is still captured
- [ ] **AUDIT-05**: Audit-event wiring in `views/*`: every sign-in, sign-out, role change, delete, export, MFA enrol, password change calls `auditWrite` with actor identity from the verified ID token (never from the client payload — Pitfall 17)
- [ ] **AUDIT-06**: Audit log retention is documented: 12 months online + 7 years archival in BigQuery / GCS Coldline
- [ ] **AUDIT-07**: Audited user CANNOT read or delete their own audit records (rules-unit-test pins this; Pitfall 17)

### Data Lifecycle — Soft-Delete (LIFE)

- [ ] **LIFE-01**: Soft-delete + 30-day restore window across orgs, users (auth-only delete), comments, documents, messages, funnel comments
- [ ] **LIFE-02**: Soft-delete writes a `deletedAt` timestamp tombstone on the doc PLUS a snapshot at `softDeleted/{type}/items/{id}` (preserves full state for restore)
- [ ] **LIFE-03**: Rules hide soft-deleted docs from normal queries (`request.query.where('deletedAt', '==', null)` predicate or equivalent)
- [ ] **LIFE-04**: `restoreSoftDeleted` callable Cloud Function (admin-only) returns soft-deleted record to live state within the 30-day window
- [ ] **LIFE-05**: Daily `scheduledPurge` Cloud Function hard-deletes records past the 30-day window
- [ ] **LIFE-06**: Soft-delete UI in admin panel: "Recently Deleted" view + Restore button + "Permanently delete now" override

### GDPR Rights (GDPR)

- [ ] **GDPR-01**: `gdprExportUser` callable Cloud Function (Art. 15 right of access) returns a signed URL (TTL ≤ 24h) to a JSON bundle of all user-linked data — profile, owned diagnostic responses, comments authored, messages authored, action items assigned, audit events about the user
- [ ] **GDPR-02**: `gdprEraseUser` callable Cloud Function (Art. 17 right to erasure) implements consistent-token tombstone pattern: replaces `authorId` references with a deterministic random token (preserves audit-trail referential integrity), redacts PII fields (name, email, avatar)
- [ ] **GDPR-03**: Erasure cascade covers all denormalised author references in `messages`, `comments`, `actions`, `documents`, `funnelComments`, plus Storage objects under user-owned paths
- [ ] **GDPR-04**: Audit-log retention vs erasure conflict resolved per GDPR best practice: audit events about the user are retained (legitimate interest under Art. 6(1)(f)) but PII fields within them are tombstoned (Pitfall 11)
- [ ] **GDPR-05**: Erasure propagation to backups documented: deletion request adds the user's tombstone token to a `redactionList` consumed by the next backup-rotation cycle

### Backup & DR (BACKUP)

- [ ] **BACKUP-01**: Daily scheduled Firestore export → GCS bucket `gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/` via 2nd-gen `onSchedule` Cloud Function
- [ ] **BACKUP-02**: GCS lifecycle policy: 30 days Standard → 90 days Nearline → 365 days Archive
- [ ] **BACKUP-03**: Firestore PITR enabled (7-day rolling recovery window)
- [ ] **BACKUP-04**: Storage bucket has Object Versioning + 90-day soft-delete enabled
- [ ] **BACKUP-05**: Storage signed URL TTL bound to ≤ 1 hour with refresh-on-download (replaces unbounded `getDownloadURL` paths)
- [ ] **BACKUP-06**: Quarterly restore-drill cadence is documented in `runbooks/`
- [ ] **BACKUP-07**: One restore drill is **performed and documented** before milestone close (`runbooks/restore-drill-<date>.md` with timing, evidence, gaps found)

### Observability & Alerting (OBS)

- [ ] **OBS-01**: Sentry browser SDK + Sentry node SDK both initialised with shared DSN; `sendDefaultPii: false`; `beforeSend` PII scrubber blocks chat bodies, comments, names, emails (Pitfall 18)
- [ ] **OBS-02**: Sentry project hosted in EU region (`*.de.sentry.io`) for GDPR; listed in `PRIVACY.md` as a sub-processor
- [ ] **OBS-03**: Sentry submission rate-limited at SDK level (max 10× same fingerprint per minute) to prevent free-tier exhaustion during error storms
- [ ] **OBS-04**: Source maps uploaded to Sentry via `@sentry/vite-plugin` in CI (release-tagged)
- [ ] **OBS-05**: Cloud Function alert (Slack webhook) fires on auth anomalies: >5 failed sign-ins from the same IP in 5min, MFA disenrolment, role escalation, unusual-hour `gdprExportUser` calls
- [ ] **OBS-06**: Uptime monitor (Better Stack or UptimeRobot free tier) checks `https://baselayers.bedeveloped.com` every 1min from at least 2 regions
- [ ] **OBS-07**: Firebase budget alerts configured at 50% / 80% / 100% of monthly budget (denial-of-wallet defence)
- [ ] **OBS-08**: Sentry quota alert at 70% of monthly free-tier limit (closes M4 fully)

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
- [ ] **DOC-10**: Each phase incrementally appends to `SECURITY.md` as it closes findings — no "Phase 11 cliff" of writing it all at the end (Pitfall 19 — compliance theatre prevention)

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
| TEST-01 to TEST-07                       | Phase 2                                | Pending | Tests-first regression baseline (Pitfall 9)                                                                                         |
| TEST-08                                  | Phase 5                                | Pending | Rules-unit-test suite written alongside the rules (committed in Phase 5; deployed in Phase 6)                                       |
| TEST-09                                  | Phase 7                                | Pending | `firebase-functions-test` suite written alongside Cloud Functions                                                                   |
| TEST-10                                  | Phase 2                                | Pending | Snapshot tests as the regression baseline for the Phase 4 modular split                                                             |
| HOST-01 to HOST-05, HOST-08              | Phase 3                                | Pending | Hosting cutover + report-only CSP + per-PR previews                                                                                 |
| HOST-06, HOST-07                         | Phase 10                               | Pending | HSTS preload submission + strict CSP after Phase 4 inline-style sweep                                                               |
| CODE-01 to CODE-13                       | Phase 4                                | Pending | Modular split + quick wins, gated by Phase 2 tests being green                                                                      |
| DATA-01 to DATA-07                       | Phase 5                                | Pending | Subcollection migration + H7 fix folded in (DATA-07)                                                                                |
| RULES-01 to RULES-06                     | Phase 5                                | Pending | Authored, unit-tested, committed — NOT deployed (deploy gate held for Phase 6)                                                      |
| RULES-07                                 | Phase 6                                | Pending | Production deploy + rollback plan; the load-bearing cutover step                                                                    |
| AUTH-01 to AUTH-15                       | Phase 6                                | Pending | Anonymous Auth disabled; Email/Password + custom claims + TOTP MFA + bootstrap; password hash deleted                               |
| FN-01 to FN-09                           | Phase 7                                | Pending | `functions/` workspace + App Check + audit log infrastructure + rate limiting                                                       |
| FN-10                                    | Phase 3                                | Pending | `csp-violations` endpoint pairs with HOST-05 — ships with the hosting cutover                                                       |
| AUDIT-01 to AUDIT-04, AUDIT-06, AUDIT-07 | Phase 7                                | Pending | Audit-log infrastructure (collection, schema, BigQuery sink, mirror triggers, retention, audited-user-cannot-read-own)              |
| AUDIT-05                                 | Phase 9                                | Pending | Wiring of `auditWrite` calls through every view (depends on Phase 7 infrastructure + Phase 8 lifecycle callers)                     |
| LIFE-01 to LIFE-06                       | Phase 8                                | Pending | Soft-delete + 30-day restore + admin UI + scheduled purge                                                                           |
| GDPR-01 to GDPR-05                       | Phase 8                                | Pending | Art. 15 export + Art. 17 erasure + cascade + audit-vs-erasure conflict resolution + backup propagation                              |
| BACKUP-01 to BACKUP-07                   | Phase 8                                | Pending | Daily Firestore export + GCS lifecycle + PITR + Storage versioning + signed-URL TTL + quarterly drill cadence + one drill performed |
| OBS-01 to OBS-08                         | Phase 9                                | Pending | Sentry browser + node + EU region + scrubber + Slack alerts + uptime + budget alerts                                                |
| DOC-01 to DOC-09                         | Phase 11                               | Pending | Evidence pack — written against existing controls, not new design                                                                   |
| DOC-10                                   | All phases (canonical owner: Phase 11) | Pending | Cross-cutting — every phase appends to `SECURITY.md` as it closes findings; Phase 11 does the final pass                            |
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
