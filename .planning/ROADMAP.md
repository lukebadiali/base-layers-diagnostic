# Roadmap: Base Layers Diagnostic — Hardening Pass

**Defined:** 2026-05-03
**Granularity:** standard (overridden — 12 phases justified by dependency chain; see "Granularity Rationale" below)
**Coverage:** 120/120 v1 requirements mapped (DOC-10 cross-cutting, all others single-phase)
**Mode:** yolo, parallelization enabled

**Core Value:** Client diagnostic data must remain confidential, intact, and recoverable — and BeDeveloped must be able to honestly answer a prospect's security questionnaire about how that's enforced.

---

## Granularity Rationale

Standard granularity calibration suggests 5–8 phases. This roadmap uses **12 phases** because the dependency chain has four load-bearing sequencing constraints (from `.planning/research/PITFALLS.md` and `.planning/research/SUMMARY.md` §"Critical Pitfalls / Non-Negotiables") that cannot be collapsed without breaking the milestone:

1. **Tests-first before modular split** (Pitfall 9). Tests (Phase 2) must be green before split (Phase 4) — without a test fence the IIFE refactor surfaces ~30 closure-captured globals as runtime crashes.
2. **Rules committed-and-tested early; deployed only after Auth migration is live** (Pitfall 1). Phase 5 ships rules + unit tests; Phase 6 deploys them after `beforeUserCreated` populates claims and Anonymous Auth is disabled. Collapsing these = production lockout.
3. **Subcollection migration before Rules deployment** (ARCHITECTURE.md §8 dep-note 1). Rules predicates for nested-map writes vs subcollection writes are fundamentally different. Doing data model first means Rules are written once.
4. **Hosting cutover before any real CSP work** (Pitfalls 14, 15, 16). `<meta http-equiv>` CSP cannot set `frame-ancestors`, `report-uri`, HSTS, Permissions-Policy, COOP/COEP. Phase 3 must precede Phase 10.

Trying to merge (e.g.) Phase 5 with Phase 6, or Phase 1 with Phase 2, violates one of these gates. The 12-phase shape is therefore the *natural* phase count for this work, not a padded count.

---

## Phases

- [x] **Phase 1: Engineering Foundation (Tooling)** — `package.json` + Vite + Vitest + ESLint + TypeScript-as-typecheck + GitHub Actions CI + Dependabot + gitleaks land; everything downstream becomes testable, dependency-monitored, and CI-gated.
- [x] **Phase 2: Test Suite Foundation (Tests-First)** — Vitest unit suite covers every data-integrity helper (scoring, completion, migration, unread, sync, auth state machine) against the current inline `app.js` to serve as the regression baseline for the modular split. (Completed 2026-05-06 — 14 test files / 149 tests / coverage 100%/98.94%/100%/100%; 9 modules extracted to src/{util,domain,data,auth}/*; H7+H8 + Phase 6 deletion baselines locked.)
- [x] **Phase 3: Hosting Cutover + Baseline Security Headers** — Production cuts over from GitHub Pages to Firebase Hosting; baseline security headers (HSTS, X-CTO, Referrer-Policy, Permissions-Policy, COOP/COEP) enforced; CSP rolled out in `Content-Security-Policy-Report-Only` mode with a `csp-violations` Cloud Function endpoint. (Completed 2026-05-07 — 6/6 plans executed; verifier 16/19 must-haves verified, 3 operator-execution items deferred to `03-HUMAN-UAT.md` per "author runbook now, execute later" choice. firebase.json + headers + CSP-RO + cspReportSink Cloud Function + CI deploy/preview jobs + cutover runbook + Phase 3 audit index all landed; live cutover (CNAME flip + securityheaders rating) is operator-deferred.)
- [ ] **Phase 4: Modular Split + Quick Wins (Pure-Refactor Phase)** — `app.js` IIFE splits into `firebase/` + `data/` + `domain/` + `auth/` + `cloud/` + `views/` + `ui/` + `observability/` modules with lint-enforced dependency rules; quick-wins land (`crypto.randomUUID()`, delete `html:`, `replaceChildren()`, inline-style sweep, toast helper, client-side upload validation).
- [ ] **Phase 5: Firestore Data Model Migration + Rules Authoring** — Firestore migrates from monolithic `orgs/{id}` to subcollection-based model; H7 fix folded in (server-clock readStates); `firestore.rules` + `storage.rules` authored with claims-based predicates and full `@firebase/rules-unit-testing` suite; rules **committed but NOT deployed to production** (deploy gate is Phase 6).
- [ ] **Phase 6: Real Auth + MFA + Rules Deploy (Cutover)** — Anonymous Auth disabled; Identity Platform upgrade; Email/Password + custom claims via `beforeUserCreated`; TOTP MFA enforced for internal; Luke + George bootstrap migration; hardcoded password hash deleted; `firestore.rules` + `storage.rules` **deployed to production** with documented 5-minute rollback plan.
- [ ] **Phase 7: Cloud Functions + App Check (Trusted-Server Layer)** — `functions/` workspace stood up (TS, Node 22, Gen 2); `auditWrite` + `setClaims` + mirror Firestore-trigger audit writers + rate-limit infrastructure live; App Check enrolled with reCAPTCHA Enterprise and rolled out via 7-day unenforced soak then per-service staged enforcement.
- [ ] **Phase 8: Data Lifecycle (Soft-Delete + GDPR + Backups)** — Soft-delete + 30-day restore window across all user-facing collections; `gdprExportUser` + `gdprEraseUser` callable Cloud Functions implementing Art. 15 + Art. 17 with consistent-token tombstone pattern; daily Firestore export + GCS lifecycle + PITR; one restore drill performed and documented before milestone close.
- [ ] **Phase 9: Observability + Audit-Event Wiring** — Sentry browser + node init with PII scrubber and EU residency; auth-anomaly alerts via Slack webhook; uptime monitor; Firebase budget alerts; `auditWrite` calls wired through every view that does sensitive ops (sign-in, sign-out, role change, delete, export, MFA enrol, password change).
- [ ] **Phase 10: CSP Tightening (Second Sweep)** — `style-src 'unsafe-inline'` dropped (Phase 4 sweep complete); `frame-src` for Firebase Auth popups; staged report-only soak before enforcement; HSTS preload submitted to hstspreload.org once policy stable for ≥7 days.
- [ ] **Phase 11: Documentation Pack (Evidence Pack)** — `SECURITY.md` + `PRIVACY.md` + `THREAT_MODEL.md` + `docs/CONTROL_MATRIX.md` + `docs/RETENTION.md` + `docs/IR_RUNBOOK.md` + `docs/DATA_FLOW.md` + `/.well-known/security.txt` + `docs/evidence/` VSQ-ready screenshots; every claimed control has code link + test link + framework citation.
- [ ] **Phase 12: Audit Walkthrough + Final Report** — `SECURITY_AUDIT.md` Vercel/Supabase sections translated to Firebase equivalents; translated checklist run end-to-end against the hardened repo; `SECURITY_AUDIT_REPORT.md` produced documenting every checklist item as Pass / Partial / N/A with citations.

---

## Phase Details

### Phase 1: Engineering Foundation (Tooling)
**Goal**: Everything downstream is testable, dependency-monitored, lint-enforced, and CI-gated; CI is the evidence trail for the milestone.
**Depends on**: Nothing (first phase)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, TOOL-07, TOOL-08, TOOL-09, TOOL-10, TOOL-11, TOOL-12, DOC-10 (incremental — start `SECURITY.md` evidence trail)
**Success Criteria** (what must be TRUE):
  1. `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` all run locally and pass on a clean clone
  2. Every PR opened against `main` runs lint + typecheck + Vitest + `npm audit --audit-level=high` + OSV-Scanner + build, with all third-party Actions pinned to commit SHA
  3. Adding a `Math.random()` or `innerHTML =` to a tracked source file fails CI via ESLint `no-unsanitized` / `security` rules
  4. Adding a new committed file containing a credential pattern (the prior `INTERNAL_PASSWORD_HASH` shape) fails CI via gitleaks
  5. Dependabot opens weekly PRs against `npm` + `github-actions` ecosystems
  6. Vite production build outputs hashed-filename bundles in `dist/`, replacing the hand-bumped `?v=46` cache-busting pattern
**Plans**: 6 plans
- [x] 01-01-PLAN.md — Wave 0: package.json + npm install + .npmrc + .gitignore augment (TOOL-01, TOOL-03, TOOL-04)
- [x] 01-02-PLAN.md — Wave 1: vite.config.js + tsconfig.json + eslint.config.js + .prettierrc.json + types/globals.d.ts (TOOL-02, TOOL-05, TOOL-06, TOOL-07)
- [x] 01-03-PLAN.md — Wave 2: .husky/pre-commit + .gitleaks.toml (TOOL-12)
- [x] 01-04-PLAN.md — Wave 3: .github/workflows/ci.yml with SHA-pinned Actions + first green CI checkpoint (TOOL-08, TOOL-09)
- [x] 01-05-PLAN.md — Wave 4: .github/dependabot.yml (TOOL-10)
- [x] 01-06-PLAN.md — Wave 5: smoke test + 4 runbooks + CONTRIBUTING.md + SECURITY.md + Socket.dev install + branch-protection bootstrap (TOOL-08, TOOL-09, TOOL-11, DOC-10)

### Phase 2: Test Suite Foundation (Tests-First)
**Goal**: A regression baseline exists for every data-integrity path that the modular split (Phase 4) and downstream phases will touch — so behavioural drift becomes visible before it becomes user-visible.
**Depends on**: Phase 1 (Vitest config, CI runner)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-10 (snapshot tests as refactor regression baseline), DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. `npm test` runs Vitest with `happy-dom` and produces a coverage report via `@vitest/coverage-v8`
  2. Scoring (`pillarScoreForRound` + `pillarStatus` + `bandLabel`), completion (`userCompletionPct` + `orgSummary`), and v1→v2 migration (`migrateV1IfNeeded` + `clearOldScaleResponsesIfNeeded`) helpers each have idempotency + boundary tests that fail if behaviour drifts
  3. Comment unread tracking, chat unread total, and cloud-sync bail-on-error logic each have tests pinning current behaviour (the regression baseline for Pitfall 20 — H7+H8 sequencing)
  4. Snapshot tests of dashboard, diagnostic, and report rendered HTML exist and are stable across runs
  5. Auth state machine tests capture the behaviour of `verifyInternalPassword`, `verifyOrgClientPassphrase`, and `verifyUserPassword` BEFORE Phase 6 replaces them
**Plans**: 6 plans (6/6 complete)
- [x] 02-01-PLAN.md — Wave 0: index.html bridge + tests/setup.js + mocks + auth-password fixture generator + crypto-parity preflight + GH-Pages preview-branch smoke (TEST-01)
- [x] 02-02-PLAN.md — Wave 1: extract src/util/{ids,hash}.js + first real tests + delete tests/smoke.test.js + SECURITY.md regression baseline + cleanup-ledger seed (TEST-01, DOC-10)
- [x] 02-03-PLAN.md — Wave 2: extract src/domain/{banding,scoring}.js with DI + TEST-02 boundary coverage (TEST-02)
- [x] 02-04-PLAN.md — Wave 3: extract src/domain/{completion,unread}.js + TEST-03 + TEST-05 (REGRESSION BASELINE — Pitfall 20 / H7) (TEST-03, TEST-05)
- [x] 02-05-PLAN.md — Wave 4: extract src/data/{migration,cloud-sync}.js + src/auth/state-machine.js + TEST-04 idempotency + TEST-06 (REGRESSION BASELINE — H8) + TEST-07 (REGRESSION BASELINE — Phase 6 deletes) (TEST-04, TEST-06, TEST-07)
- [x] 02-06-PLAN.md — Wave 5: TEST-10 snapshot tests (dashboard/diagnostic/report) + tiered coverage thresholds (D-15) + CI HTML artefact (D-20) + CONTRIBUTING.md governance (D-17, D-18) + ESLint test→src isolation rule (T-2-03) (TEST-10, DOC-10)

### Phase 3: Hosting Cutover + Baseline Security Headers
**Goal**: Production serves from Firebase Hosting with HTTP-header CSP infrastructure available, removing the GitHub-Pages "no headers possible" structural blocker before any CSP work begins.
**Depends on**: Phase 1 (CI deploys via OIDC-authenticated `firebase-tools`)
**Requirements**: HOST-01, HOST-02, HOST-03, HOST-04, HOST-05, HOST-08, FN-10 (csp-violations endpoint pairs with HOST-05), DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. `https://baselayers.bedeveloped.com` resolves to Firebase Hosting (DNS migrated, SSL auto-provisioned by Firebase, GitHub Pages site disabled)
  2. `curl -I https://baselayers.bedeveloped.com` returns HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `COOP`, `COEP`, and `Content-Security-Policy-Report-Only` headers
  3. CSP violations from real users / staging sessions arrive at the `csp-violations` Cloud Function endpoint and are persisted (or filtered, for known-noisy paths) without breaking the page
  4. Every push to `main` triggers a CI deploy to Firebase Hosting; opening a PR creates a per-PR preview channel URL
  5. `securityheaders.com` rating is at least "A" (CSP "Report-Only" status acknowledged)
**Plans**: 6 plans
Plans:
- [ ] 03-01-PLAN.md — Wave 1: pre-flight verifications (Firestore region, project ID, registrar, OIDC pool, index.html meta-CSP scan, dist/index.html font-CDN scan, SDK 12.x connect-src verification)
- [ ] 03-02-PLAN.md — Wave 2: firebase.json + .firebaserc + tests/firebase-config.test.js + tsconfig exclude + SECURITY.md §HTTP Security Headers + §CSP (Report-Only)
- [ ] 03-03-PLAN.md — Wave 2: functions/ workspace + cspReportSink + normalise + filter + dedup + TDD unit tests
- [ ] 03-04-PLAN.md — Wave 3: ci.yml deploy + preview jobs via OIDC + post-deploy header assertion + functions/ npm audit + SECURITY.md §Hosting & Deployment
- [ ] 03-05-PLAN.md — Wave 4 + 5: runbooks/hosting-cutover.md + pre-cutover synthetic smoke + same-session CNAME flip + securityheaders.com manual smoke
- [ ] 03-06-PLAN.md — Wave 6: cleanup ledger rows (T-3-4 day-14 + T-3-meta-csp-conflict) + branch protection runbook update + SECURITY.md commit-SHA backfill + §Phase 3 Audit Index
**UI hint**: yes

### Phase 4: Modular Split + Quick Wins (Pure-Refactor Phase)
**Goal**: The 4,103-line `app.js` IIFE is decomposed into testable, lint-enforced modules and every refactor-safe security/quality fix that doesn't touch backend behaviour ships in this window.
**Depends on**: Phase 2 (test fence — Pitfall 9 non-negotiable), Phase 3 (build pipeline + hosting target stable)
**Requirements**: CODE-01, CODE-02, CODE-03, CODE-04, CODE-05, CODE-06, CODE-07, CODE-08, CODE-09, CODE-10, CODE-11, CODE-12, CODE-13, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. The codebase consists of `firebase/` (sole SDK import surface) + `data/*` + `domain/*` + `auth/*` + `cloud/*` + `views/*` + `ui/*` + `observability/*` modules; `domain/*` files have zero Firebase imports (lint-enforced); the previous `app.js` IIFE is gone
  2. Every Phase 2 test still passes; snapshot tests for dashboard / diagnostic / report show no rendered-HTML drift
  3. Every previously-`Math.random()`-derived ID call site now uses `crypto.randomUUID()`; ESLint `security/detect-pseudo-random-bytes` blocks reintroduction
  4. The `html:` branch in `h()` is deleted; an XSS regression test pins `<script>` and `<img onerror>` payloads as text content; ESLint `no-unsanitized` blocks new `innerHTML =` assignments
  5. Every previous `alert()` error site renders a non-blocking `notify(level, message)` toast instead; chat / funnel-comment renderers share a single `renderConversation` helper
  6. Every previous `style="..."` inline string is migrated to a CSS class (precondition for Phase 10 strict CSP)
  7. Client-side file upload validation rejects oversized (>25 MB), wrong-MIME, or unsanitisable-filename uploads before the network call
**Plans**: 6 plans
Plans:
- [x] 04-01-PLAN.md — Wave 1: firebase/ adapter (6 submodules) + Chart.js npm + Google Fonts self-host + CSP allowlist tightening + CODE-03 (crypto.randomUUID) + meta-CSP regression test (D-18) + Wave 1 ESLint flip
- [x] 04-02-PLAN.md — Wave 2: ui/* helpers (dom/modal/toast/format/chrome/upload) + CODE-04 (delete html: + permanent XSS regression fixture) + Wave 2 ESLint flip + SECURITY.md § Build & Supply Chain
- [x] 04-03-PLAN.md — Wave 3: 12 data/* wrappers (6 owners + 6 pass-throughs) + 5 cloud/* stubs + 2 observability/* stubs + Wave 3 ESLint flip + 13 forward-tracking ledger rows
- [x] 04-04-PLAN.md — Wave 4: 12 views/*.js + _shared/render-conversation.js + per-view CODE-05/06/07/08/09/10/12 quick wins + Wave 4 ESLint flip + SECURITY.md § Data Handling
- [ ] 04-05-PLAN.md — Wave 5: state.js + router.js + main.js + atomic terminal cutover (app.js DELETED, index.html → ./src/main.js) + 3 view-snapshot tests retargeted
- [ ] 04-06-PLAN.md — Wave 6: cleanup — D-21 per-directory coverage thresholds + final ESLint hardening + CODE-11 + CODE-13 + cleanup-ledger zero-out + SECURITY.md § Code Quality + Module Boundaries + human-verify checkpoint
**UI hint**: yes

### Phase 5: Firestore Data Model Migration + Rules Authoring (Committed, Not Deployed)
**Goal**: Production data lives under the subcollection-based shape the Rules will authorise; `firestore.rules` + `storage.rules` are written, unit-tested, and committed to the repo — but not yet deployed to production (deploy gate is Phase 6).
**Depends on**: Phase 4 (modular `data/*` boundaries are where new collection shapes land)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, RULES-01, RULES-02, RULES-03, RULES-04, RULES-05, RULES-06, TEST-08, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. Firestore production data is read from subcollections (`orgs/{orgId}/responses/{respId}`, `comments/{cmtId}`, `actions/{actId}`, `documents/{docId}`, `messages/{msgId}`, `readStates/{userId}`) with `orgs/{orgId}` parent docs reduced to small metadata; pre/post doc-count + field-presence assertions confirm zero data loss
  2. The migration script is re-runnable end-to-end against a staging clone of production with no duplicate or destructive effects (idempotency markers per collection)
  3. `users` collection is keyed by Firebase Auth UID with the prior app-internal `userId` retained as `legacyAppUserId` for backfill mapping; new top-level collections (`internalAllowlist`, `auditLog`, `softDeleted/{type}/items/{id}`, `rateLimits/{uid}/buckets/{windowStart}`) exist with correct rule scopes
  4. Comment + chat unread comparators use server-clock-vs-server-clock exclusively (last-read markers in `orgs/{orgId}/readStates/{userId}`); a 5-minute client-clock skew test does not change unread counts
  5. `@firebase/rules-unit-testing` suite covers every collection × every role (anonymous / client / internal / admin) × allowed and denied paths against the local emulator and runs green in CI; tenant-jump test (client with `orgId=A` cannot read or write any document under `orgs/B/*`) passes
  6. `firestore.rules` and `storage.rules` are committed to the repo but **not** present in the production Firebase project (deploy gate held for Phase 6)
**Plans**: TBD

### Phase 6: Real Auth + MFA + Rules Deploy (Cutover)
**Goal**: Every production user is a real Firebase Auth identity with custom claims, MFA-enrolled if internal; the trust boundary moves from `localStorage` JS gating to server-side Rules + claims; this is the load-bearing cutover phase of the milestone.
**Depends on**: Phase 5 (data model + rules authored; users keyed by `firebaseUid`)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, AUTH-11, AUTH-12, AUTH-13, AUTH-14, AUTH-15, RULES-07, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. Anonymous Auth shows as **disabled** in the Firebase Console; the prior `signInAnonymously` substrate is removed from the client bundle; the hardcoded `INTERNAL_PASSWORD_HASH` + `INTERNAL_ALLOWED_EMAILS` constants are deleted from source
  2. Luke and George can each sign in with email + password (≥12 chars, HIBP leaked-password check enforced via `passwordPolicy`), are challenged for TOTP MFA every session, and have generated and stored 10 hashed recovery codes
  3. `beforeUserCreated` blocking Cloud Function reads `internalAllowlist/{lowercasedEmail}` and sets custom claims `{role, orgId}` on user creation; `beforeUserSignedIn` writes a sign-in audit event; an admin can call `setClaims` to grant/revoke role/org claims and the target user picks up the change within seconds via the `users/{uid}/_pokes` listener pattern
  4. `firestore.rules` and `storage.rules` are **deployed to production**; tenant-jump and audited-user-cannot-read-own-records tests pass against the deployed project; rollback procedure (re-deploy previous commit's rules) is documented in `runbooks/` and verified within 5 minutes against staging
  5. Two-admin MFA recovery procedure is **drilled live** (Luke and George each take a turn being the locked-out actor) and the drill is documented with timing and any gaps
  6. Email verification is enforced before any read/write to `orgs/{id}/*`; sign-in error messages are unified to "Email or password incorrect" (account enumeration mitigation)
**Plans**: TBD
**UI hint**: yes

### Phase 7: Cloud Functions + App Check (Trusted-Server Layer)
**Goal**: A trusted-server boundary exists with audit logging, rate limiting, secret management, and App Check perimeter — the substrate every later phase depends on.
**Depends on**: Phase 6 (custom claims live so Functions can re-verify caller identity from ID token)
**Requirements**: FN-01, FN-02, FN-03, FN-04, FN-05, FN-06, FN-07, FN-08, FN-09, AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-06, AUDIT-07, TEST-09, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. The `functions/` workspace builds + tests + deploys cleanly; every callable enforces App Check (`enforceAppCheck: true`), validates input via Zod, writes an idempotency marker doc with a 5-minute window, captures errors to Sentry node, and runs as its own minimal-IAM service account
  2. App Check is enrolled with reCAPTCHA Enterprise; per-environment site keys exist; debug tokens live only in `.env.local`; the App Check dashboard has soaked ≥7 days in unenforced mode and enforcement has been turned on per service in the order Storage → Firestore (collection-by-collection) → Cloud Functions; quota alert at 70% of free tier is configured
  3. `auditLog/{eventId}` Firestore collection rejects all client writes (rules `allow write: if false`); only the `auditWrite` Cloud Function (Admin SDK) writes; an audited user cannot read their own audit records (rules-unit-test pins this)
  4. Cloud Logging Data Access logs are sunk to BigQuery dataset `audit_logs_bq` with 7-year retention; mirror Firestore-trigger audit writers (`onOrgDelete`, `onUserDelete`, `onDocumentDelete`) fire end-to-end on the corresponding Firestore changes
  5. Rate limiting on chat / comment writes is enforced (preferred: Firestore Rules `request.time` predicate against `rateLimits/{uid}/buckets/{windowStart}`; fallback: callable Function token-bucket); a synthetic burst test confirms the limit fires
  6. Auth-blocking functions have `minInstances: 1`; cold-start observed p99 ≤ 4s; secrets accessed exclusively via `defineSecret()`
**Plans**: TBD

### Phase 8: Data Lifecycle (Soft-Delete + GDPR + Backups)
**Goal**: Deletes are recoverable, GDPR Art. 15 + 17 are honourable, and a documented backup + tested restore exists — the milestone's recoverability and data-rights story.
**Depends on**: Phase 7 (Cloud Functions + audit log + App Check substrate; ID re-keying via Functions only after backup is live — Pitfall 10)
**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06, GDPR-01, GDPR-02, GDPR-03, GDPR-04, GDPR-05, BACKUP-01, BACKUP-02, BACKUP-03, BACKUP-04, BACKUP-05, BACKUP-06, BACKUP-07, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. An admin user can soft-delete and restore an org, comment, document, message, or funnel comment within the 30-day window; soft-deleted items disappear from normal queries (rules predicate enforced) and are hard-deleted by the daily `scheduledPurge` Cloud Function past retention
  2. A user (or admin on their behalf) can call `gdprExportUser` and download a JSON bundle containing all user-linked data via a signed URL with TTL ≤ 24h; the bundle includes profile, owned diagnostic responses, comments authored, messages authored, action items assigned, and audit events about the user
  3. `gdprEraseUser` replaces `authorId` references with a deterministic pseudonym token across all denormalised collections (messages, comments, actions, documents, funnelComments) plus Storage objects under user-owned paths, redacts PII fields, and adds the user's tombstone token to the `redactionList` consumed by the next backup-rotation cycle; a post-erasure audit script confirms zero residual PII
  4. A daily Firestore export lands in `gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/` with the 30d Standard / 90d Nearline / 365d Archive lifecycle policy applied; Firestore PITR is enabled (7-day rolling); Storage bucket has Object Versioning + 90-day soft-delete enabled
  5. Storage signed URLs for documents are issued with TTL ≤ 1h and refresh-on-download; the prior unbounded `getDownloadURL` paths are gone
  6. One restore drill has been **performed and documented** in `runbooks/restore-drill-<date>.md` with timing, evidence, and any gaps; quarterly cadence is documented for ongoing
**Plans**: TBD
**UI hint**: yes

### Phase 9: Observability + Audit-Event Wiring
**Goal**: Every sensitive operation in the app emits a verified-actor audit event; client and server errors flow into a single observability sink with PII scrubbed; auth anomalies wake an operator within minutes.
**Depends on**: Phase 7 (`auditWrite` exists), Phase 8 (soft-delete + GDPR exist so events for them have callers)
**Requirements**: OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, OBS-06, OBS-07, OBS-08, AUDIT-05, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. Sentry browser SDK + Sentry node SDK both initialise on boot with shared DSN, `sendDefaultPii: false`, and a `beforeSend` PII scrubber that blocks chat bodies, comments, names, and emails; the Sentry project is hosted in EU region (`*.de.sentry.io`) and listed in `PRIVACY.md` as a sub-processor
  2. Every sign-in, sign-out, role change, delete, export, MFA enrolment, and password change emits an `auditWrite` event in which the actor identity comes from the verified ID token (server-side), never from the client payload
  3. A Slack webhook fires for auth anomalies: >5 failed sign-ins from the same IP in 5 minutes, MFA disenrolment, role escalation, and unusual-hour `gdprExportUser` calls; an operator receives a synthetic test alert end-to-end
  4. An uptime monitor checks `https://baselayers.bedeveloped.com` every 1 minute from at least 2 regions; Firebase budget alerts fire at 50% / 80% / 100% of monthly budget; Sentry quota alert at 70% of monthly free-tier
  5. Source maps for production releases are uploaded to Sentry via `@sentry/vite-plugin` in CI and stack traces in Sentry resolve to the original source
**Plans**: TBD

### Phase 10: CSP Tightening (Second Sweep)
**Goal**: The CSP report-only headers from Phase 3 become enforced at the strictest level the app can run under, closing H4 fully and consuming the inline-style sweep done in Phase 4.
**Depends on**: Phase 4 (inline-style → class sweep complete), Phase 3 (report-only soak data via `csp-violations` endpoint)
**Requirements**: HOST-06, HOST-07, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. `Content-Security-Policy` is enforced (no longer Report-Only) with `style-src 'self'` (no `'unsafe-inline'`); `script-src 'self'` (or `'self' 'strict-dynamic'` if needed for Firebase SDK lazy loading); `frame-src` constrained to Firebase Auth popup origin; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`
  2. Sign-in, dashboard, radar/donut chart, document upload, and chat all function under enforced CSP (verified on staging before promotion); the `csp-violations` Cloud Function shows no new violations during a 7-day post-tightening soak
  3. HSTS preload submission is filed at `hstspreload.org` and the domain appears in the preload list
  4. `securityheaders.com` rating is "A+"
**Plans**: TBD
**UI hint**: yes

### Phase 11: Documentation Pack (Evidence Pack)
**Goal**: A vendor-questionnaire-ready evidence pack exists with every claimed control backed by a code link + test link + framework citation — not "industry-standard encryption" hand-waves.
**Depends on**: Phase 10 (every control is in code first, then catalogued)
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, DOC-08, DOC-09, DOC-10 (canonical owner — final pass)
**Success Criteria** (what must be TRUE):
  1. `SECURITY.md`, `PRIVACY.md`, `THREAT_MODEL.md`, `docs/CONTROL_MATRIX.md`, `docs/RETENTION.md`, `docs/IR_RUNBOOK.md`, and `docs/DATA_FLOW.md` all exist and each row in `CONTROL_MATRIX.md` cites a code path, config file, test, and explicit framework section (OWASP ASVS L2 / ISO 27001:2022 Annex A / SOC2 CC / GDPR Article)
  2. `/.well-known/security.txt` (RFC 9116) is served from production with disclosure contact `security@bedeveloped.com`; `SECURITY.md` carries the vulnerability disclosure policy paragraph (acknowledge in 5 business days, no legal action against good-faith researchers)
  3. `PRIVACY.md` lists Google/Firebase, Sentry, and Google Fonts as sub-processors with Google Cloud DPA + Standard Contractual Clauses references; the verified Firestore data residency region is documented
  4. `docs/evidence/` contains screenshots: MFA enrolment for Luke + George, sample audit-log entry (PII redacted), backup-policy console, Firestore region, App Check enforcement state per service, rules deployment timestamp, latest CI green run, latest `npm audit` clean output
  5. A reviewer reading only `SECURITY.md` + `CONTROL_MATRIX.md` can answer every claim by following the citations into the codebase or `docs/`
**Plans**: TBD

### Phase 12: Audit Walkthrough + Final Report
**Goal**: `SECURITY_AUDIT.md`'s Vercel/Supabase-shaped checklist becomes a Firebase-shaped checklist run end-to-end against the hardened repo, producing the milestone's closing artefact: `SECURITY_AUDIT_REPORT.md`.
**Depends on**: Phase 11 (evidence pack is the citation source for the report)
**Requirements**: WALK-01, WALK-02, WALK-03, WALK-04, DOC-10 (final increment)
**Success Criteria** (what must be TRUE):
  1. `docs/SECURITY_AUDIT_TRANSLATION.md` exists with a per-section map from Vercel/Supabase guidance to Firebase equivalents (RLS↔Firestore Rules; service_role↔custom claims + Cloud Functions; Edge Functions↔Cloud Functions; pgaudit↔Cloud Function audit log; PITR↔Firestore PITR; Vercel BotID/Firewall↔reCAPTCHA Enterprise / App Check; OIDC federation↔Firebase Auth tokens; Vercel Audit Logs↔Cloud Logging + audit-log Cloud Function)
  2. `SECURITY_AUDIT.md` LLM03 / LLM05 / LLM10 sections are explicitly judged N/A with documented rationale ("this app has no LLM surface") — not silently skipped
  3. `SECURITY_AUDIT_REPORT.md` documents every checklist item as Pass / Partial / N/A with citations into the codebase + `docs/`; sections without clean Firebase equivalents are explicitly flagged "N/A — Firebase architecture differs" with rationale
  4. The report's overall posture statement reads "credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2" — not "compliant" or "certified" (Pitfall 19 prevention)
**Plans**: TBD

---

## Cross-Phase / Cross-Cutting Requirements

| Requirement | Owning Phase | Cross-Cutting Behaviour |
|-------------|--------------|-------------------------|
| DOC-10 (incremental `SECURITY.md` updates) | Phase 11 (canonical) | Every phase appends to `SECURITY.md` as it closes findings — Pitfall 19 prevention. Phase 11 does the final pass + ensures no findings closed without a corresponding paragraph. |
| AUDIT-05 (audit-event wiring in `views/*`) | Phase 9 | Builds on `auditWrite` infrastructure from Phase 7 and lifecycle/GDPR callers from Phase 8. |
| RULES-07 (production rules deploy + rollback plan) | Phase 6 | The deploy gate that releases the rules authored in Phase 5; runs alongside the Auth migration cutover. |

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engineering Foundation (Tooling) | 0/6 | Not started | - |
| 2. Test Suite Foundation (Tests-First) | 0/0 | Not started | - |
| 3. Hosting Cutover + Baseline Security Headers | 6/6 | Complete (3 operator items in 03-HUMAN-UAT.md) | 2026-05-07 |
| 4. Modular Split + Quick Wins | 0/0 | Not started | - |
| 5. Firestore Data Model Migration + Rules Authoring | 0/0 | Not started | - |
| 6. Real Auth + MFA + Rules Deploy (Cutover) | 0/0 | Not started | - |
| 7. Cloud Functions + App Check | 0/0 | Not started | - |
| 8. Data Lifecycle (Soft-Delete + GDPR + Backups) | 0/0 | Not started | - |
| 9. Observability + Audit-Event Wiring | 0/0 | Not started | - |
| 10. CSP Tightening (Second Sweep) | 0/0 | Not started | - |
| 11. Documentation Pack (Evidence Pack) | 0/0 | Not started | - |
| 12. Audit Walkthrough + Final Report | 0/0 | Not started | - |

---

## Dependency Graph

```
1 (tooling) -> 2 (tests) -> 3 (hosting + headers report-only) -> 4 (modular split + quick wins)
                                                                      |
                                                                      v
                                                  5 (data model + rules authored + tested)
                                                                      |
                                                                      v
                                                  6 (auth + MFA + rules DEPLOYED + bootstrap)
                                                                      |
                                                                      v
                                                  7 (Cloud Functions + audit log + App Check)
                                                                      |
                                                                      v
                                                  8 (soft-delete + GDPR + backups + drill)
                                                                      |
                                                                      v
                                                  9 (Sentry + audit-event wiring + alerts)
                                                                      |
                                                                      v
                                                  10 (CSP tightening - drop unsafe-inline)
                                                                      |
                                                                      v
                                                  11 (SECURITY.md + PRIVACY.md + evidence)
                                                                      |
                                                                      v
                                                  12 (translate + run audit checklist + report)
```

---

## Coverage Validation

**Total v1 requirements:** 120 across 15 categories (TOOL, TEST, HOST, CODE, DATA, RULES, AUTH, FN, AUDIT, LIFE, GDPR, BACKUP, OBS, DOC, WALK)

**Coverage check (validated against `.planning/REQUIREMENTS.md` Traceability + `.planning/research/SUMMARY.md` 12-phase plan):**

| Category | Count | Phase(s) |
|----------|-------|----------|
| TOOL-01..12 | 12 | Phase 1 |
| TEST-01..07 | 7 | Phase 2 |
| TEST-08 | 1 | Phase 5 |
| TEST-09 | 1 | Phase 7 |
| TEST-10 | 1 | Phase 2 (snapshot baseline for Phase 4) |
| HOST-01..05, HOST-08 | 6 | Phase 3 |
| HOST-06, HOST-07 | 2 | Phase 10 |
| CODE-01..13 | 13 | Phase 4 |
| DATA-01..07 | 7 | Phase 5 |
| RULES-01..06 | 6 | Phase 5 |
| RULES-07 | 1 | Phase 6 |
| AUTH-01..15 | 15 | Phase 6 |
| FN-01..09 | 9 | Phase 7 |
| FN-10 | 1 | Phase 3 (paired with HOST-05) |
| AUDIT-01..04, AUDIT-06, AUDIT-07 | 6 | Phase 7 |
| AUDIT-05 (wiring) | 1 | Phase 9 |
| LIFE-01..06 | 6 | Phase 8 |
| GDPR-01..05 | 5 | Phase 8 |
| BACKUP-01..07 | 7 | Phase 8 |
| OBS-01..08 | 8 | Phase 9 |
| DOC-01..09 | 9 | Phase 11 |
| DOC-10 (incremental) | 1 | All phases (canonical owner: Phase 11) |
| WALK-01..04 | 4 | Phase 12 |

**Total mapped:** 120 / 120 v1 requirements
**Orphans:** 0
**Phases with zero requirements:** 0

**Cross-phase ordering preserves all four load-bearing sequencing constraints.**

---

## Sequencing Constraint Validation

| Constraint | Status | Phase Pair |
|------------|--------|------------|
| Tests-first before modular split (Pitfall 9) | Honoured | Phase 2 (tests) → Phase 4 (split). Phase 3 sits between them but is hosting-only and does not touch the IIFE refactor. |
| Rules committed early; deployed only after Auth is live (Pitfall 1) | Honoured | Phase 5 authors + commits + unit-tests rules. Phase 6 deploys rules **as part of the same cutover** as `beforeUserCreated` populating claims and Anonymous Auth being disabled. RULES-07 (production deploy) lives in Phase 6, never Phase 5. |
| Subcollection migration before Rules deployment | Honoured | Phase 5 does data model migration first, then authors rules against the new shape. Phase 6 deploys those rules. The reverse ordering would force rules to be written twice. |
| Hosting cutover before any real CSP work (Pitfalls 14, 15, 16) | Honoured | Phase 3 (Firebase Hosting + report-only CSP) precedes Phase 10 (CSP enforced + tightened). The intermediate phases inherit Phase 3's HTTP-header capability without doing CSP work themselves. |

---

*Roadmap defined: 2026-05-03*
*Last updated: 2026-05-03 after initial creation*
