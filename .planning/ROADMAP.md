# Roadmap: Base Layers Diagnostic â€” Hardening Pass

**Defined:** 2026-05-03
**Granularity:** standard (overridden â€” 12 phases justified by dependency chain; see "Granularity Rationale" below)
**Coverage:** 120/120 v1 requirements mapped (DOC-10 cross-cutting, all others single-phase)
**Mode:** yolo, parallelization enabled

**Core Value:** Client diagnostic data must remain confidential, intact, and recoverable â€” and BeDeveloped must be able to honestly answer a prospect's security questionnaire about how that's enforced.

---

## Granularity Rationale

Standard granularity calibration suggests 5â€“8 phases. This roadmap uses **12 phases** because the dependency chain has four load-bearing sequencing constraints (from `.planning/research/PITFALLS.md` and `.planning/research/SUMMARY.md` Â§"Critical Pitfalls / Non-Negotiables") that cannot be collapsed without breaking the milestone:

1. **Tests-first before modular split** (Pitfall 9). Tests (Phase 2) must be green before split (Phase 4) â€” without a test fence the IIFE refactor surfaces ~30 closure-captured globals as runtime crashes.
2. **Rules committed-and-tested early; deployed only after Auth migration is live** (Pitfall 1). Phase 5 ships rules + unit tests; Phase 6 deploys them after `beforeUserCreated` populates claims and Anonymous Auth is disabled. Collapsing these = production lockout.
3. **Subcollection migration before Rules deployment** (ARCHITECTURE.md Â§8 dep-note 1). Rules predicates for nested-map writes vs subcollection writes are fundamentally different. Doing data model first means Rules are written once.
4. **Hosting cutover before any real CSP work** (Pitfalls 14, 15, 16). `<meta http-equiv>` CSP cannot set `frame-ancestors`, `report-uri`, HSTS, Permissions-Policy, COOP/COEP. Phase 3 must precede Phase 10.

Trying to merge (e.g.) Phase 5 with Phase 6, or Phase 1 with Phase 2, violates one of these gates. The 12-phase shape is therefore the *natural* phase count for this work, not a padded count.

---

## Phases

- [x] **Phase 1: Engineering Foundation (Tooling)** â€” `package.json` + Vite + Vitest + ESLint + TypeScript-as-typecheck + GitHub Actions CI + Dependabot + gitleaks land; everything downstream becomes testable, dependency-monitored, and CI-gated.
- [x] **Phase 2: Test Suite Foundation (Tests-First)** â€” Vitest unit suite covers every data-integrity helper (scoring, completion, migration, unread, sync, auth state machine) against the current inline `app.js` to serve as the regression baseline for the modular split. (Completed 2026-05-06 â€” 14 test files / 149 tests / coverage 100%/98.94%/100%/100%; 9 modules extracted to src/{util,domain,data,auth}/*; H7+H8 + Phase 6 deletion baselines locked.)
- [x] **Phase 3: Hosting Cutover + Baseline Security Headers** â€” Production cuts over from GitHub Pages to Firebase Hosting; baseline security headers (HSTS, X-CTO, Referrer-Policy, Permissions-Policy, COOP/COEP) enforced; CSP rolled out in `Content-Security-Policy-Report-Only` mode with a `csp-violations` Cloud Function endpoint. (Completed 2026-05-07 â€” 6/6 plans executed; verifier 16/19 must-haves verified, 3 operator-execution items deferred to `03-HUMAN-UAT.md` per "author runbook now, execute later" choice. firebase.json + headers + CSP-RO + cspReportSink Cloud Function + CI deploy/preview jobs + cutover runbook + Phase 3 audit index all landed; live cutover (CNAME flip + securityheaders rating) is operator-deferred.)
- [x] **Phase 4: Modular Split + Quick Wins (Pure-Refactor Phase)** â€” `app.js` IIFE splits into `firebase/` + `data/` + `domain/` + `auth/` + `cloud/` + `views/` + `ui/` + `observability/` modules with lint-enforced dependency rules; quick-wins land (`crypto.randomUUID()`, delete `html:`, `replaceChildren()`, inline-style sweep, toast helper, client-side upload validation). (Completed 2026-05-07 â€” 6/6 plans executed across 6 sequential waves; 376/376 tests pass; verifier 4/4 ROADMAP success criteria + 14/14 requirements (CODE-01..13 + DOC-10) accounted for; 3 UI smoke checks deferred to `04-HUMAN-UAT.md`. Operator-approved deviation: IIFE body preserved in `src/main.js` with `// @ts-nocheck` + ~132 static `style="..."` strings + `window.FB`/`Chart` bridges â†’ queued as decimal phase 4.1 main.js-body-migration sub-wave; documented in cleanup-ledger Wave 6 carryover + SECURITY.md.)
- [x] **Phase 5: Firestore Data Model Migration + Rules Authoring** â€” Firestore migrates from monolithic `orgs/{id}` to subcollection-based model; H7 fix folded in (server-clock readStates); `firestore.rules` + `storage.rules` authored with claims-based predicates and full `@firebase/rules-unit-testing` suite; rules **committed but NOT deployed to production** (deploy gate is Phase 6). (Completed 2026-05-08 â€” 6/6 plans executed; verifier 6/6 SC + 15/15 requirements verified at substrate level; 65 files / 454 tests pass + 176/176 rules-emulator cells green. Cutover executed against bedeveloped-base-layers production by business@bedeveloped.com â€” empty-database no-op (PROJECT.md "between client engagements" baseline) + 6 stray pre-Phase-4 root-collection fixture docs cleaned via find-strays.js + delete-strays.js. RULES-06 holds symmetrically â€” repo-side grep + Firebase Console (latest deployed rules: Apr 27, 2026 â€” predates Phase 5) both confirm rules-not-deployed. 1 item deferred to Phase 6 in `05-HUMAN-UAT.md` (live SC#4 clock-skew exercise â€” degenerate against empty DB).)
- [ ] **Phase 6: Real Auth + MFA + Rules Deploy (Cutover)** â€” Anonymous Auth disabled; Identity Platform upgrade; Email/Password + custom claims via `beforeUserCreated`; TOTP MFA enforced for internal; Luke + George bootstrap migration; hardcoded password hash deleted; `firestore.rules` + `storage.rules` **deployed to production** with documented 5-minute rollback plan.
- [ ] **Phase 7: Cloud Functions + App Check (Trusted-Server Layer)** â€” `functions/` workspace stood up (TS, Node 22, Gen 2); `auditWrite` + `setClaims` + mirror Firestore-trigger audit writers + rate-limit infrastructure live; App Check enrolled with reCAPTCHA Enterprise and rolled out via 7-day unenforced soak then per-service staged enforcement.
- [ ] **Phase 8: Data Lifecycle (Soft-Delete + GDPR + Backups)** â€” Soft-delete + 30-day restore window across all user-facing collections; `gdprExportUser` + `gdprEraseUser` callable Cloud Functions implementing Art. 15 + Art. 17 with consistent-token tombstone pattern; daily Firestore export + GCS lifecycle + PITR; one restore drill performed and documented before milestone close.
- [ ] **Phase 9: Observability + Audit-Event Wiring** â€” Sentry browser + node init with PII scrubber and EU residency; auth-anomaly alerts via Slack webhook; uptime monitor; Firebase budget alerts; `auditWrite` calls wired through every view that does sensitive ops (sign-in, sign-out, role change, delete, export, MFA enrol, password change).
- [ ] **Phase 10: CSP Tightening (Second Sweep)** â€” `style-src 'unsafe-inline'` dropped (Phase 4 sweep complete); `frame-src` for Firebase Auth popups; staged report-only soak before enforcement; HSTS preload submitted to hstspreload.org once policy stable for â‰¥7 days.
- [ ] **Phase 11: Documentation Pack (Evidence Pack)** â€” `SECURITY.md` + `PRIVACY.md` + `THREAT_MODEL.md` + `docs/CONTROL_MATRIX.md` + `docs/RETENTION.md` + `docs/IR_RUNBOOK.md` + `docs/DATA_FLOW.md` + `/.well-known/security.txt` + `docs/evidence/` VSQ-ready screenshots; every claimed control has code link + test link + framework citation.
- [ ] **Phase 12: Audit Walkthrough + Final Report** â€” `SECURITY_AUDIT.md` Vercel/Supabase sections translated to Firebase equivalents; translated checklist run end-to-end against the hardened repo; `SECURITY_AUDIT_REPORT.md` produced documenting every checklist item as Pass / Partial / N/A with citations.

---

## Phase Details

### Phase 1: Engineering Foundation (Tooling)
**Goal**: Everything downstream is testable, dependency-monitored, lint-enforced, and CI-gated; CI is the evidence trail for the milestone.
**Depends on**: Nothing (first phase)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06, TOOL-07, TOOL-08, TOOL-09, TOOL-10, TOOL-11, TOOL-12, DOC-10 (incremental â€” start `SECURITY.md` evidence trail)
**Success Criteria** (what must be TRUE):
  1. `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` all run locally and pass on a clean clone
  2. Every PR opened against `main` runs lint + typecheck + Vitest + `npm audit --audit-level=high` + OSV-Scanner + build, with all third-party Actions pinned to commit SHA
  3. Adding a `Math.random()` or `innerHTML =` to a tracked source file fails CI via ESLint `no-unsanitized` / `security` rules
  4. Adding a new committed file containing a credential pattern (the prior `INTERNAL_PASSWORD_HASH` shape) fails CI via gitleaks
  5. Dependabot opens weekly PRs against `npm` + `github-actions` ecosystems
  6. Vite production build outputs hashed-filename bundles in `dist/`, replacing the hand-bumped `?v=46` cache-busting pattern
**Plans**: 6 plans
- [x] 01-01-PLAN.md â€” Wave 0: package.json + npm install + .npmrc + .gitignore augment (TOOL-01, TOOL-03, TOOL-04)
- [x] 01-02-PLAN.md â€” Wave 1: vite.config.js + tsconfig.json + eslint.config.js + .prettierrc.json + types/globals.d.ts (TOOL-02, TOOL-05, TOOL-06, TOOL-07)
- [x] 01-03-PLAN.md â€” Wave 2: .husky/pre-commit + .gitleaks.toml (TOOL-12)
- [x] 01-04-PLAN.md â€” Wave 3: .github/workflows/ci.yml with SHA-pinned Actions + first green CI checkpoint (TOOL-08, TOOL-09)
- [x] 01-05-PLAN.md â€” Wave 4: .github/dependabot.yml (TOOL-10)
- [x] 01-06-PLAN.md â€” Wave 5: smoke test + 4 runbooks + CONTRIBUTING.md + SECURITY.md + Socket.dev install + branch-protection bootstrap (TOOL-08, TOOL-09, TOOL-11, DOC-10)

### Phase 2: Test Suite Foundation (Tests-First)
**Goal**: A regression baseline exists for every data-integrity path that the modular split (Phase 4) and downstream phases will touch â€” so behavioural drift becomes visible before it becomes user-visible.
**Depends on**: Phase 1 (Vitest config, CI runner)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07, TEST-10 (snapshot tests as refactor regression baseline), DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. `npm test` runs Vitest with `happy-dom` and produces a coverage report via `@vitest/coverage-v8`
  2. Scoring (`pillarScoreForRound` + `pillarStatus` + `bandLabel`), completion (`userCompletionPct` + `orgSummary`), and v1â†’v2 migration (`migrateV1IfNeeded` + `clearOldScaleResponsesIfNeeded`) helpers each have idempotency + boundary tests that fail if behaviour drifts
  3. Comment unread tracking, chat unread total, and cloud-sync bail-on-error logic each have tests pinning current behaviour (the regression baseline for Pitfall 20 â€” H7+H8 sequencing)
  4. Snapshot tests of dashboard, diagnostic, and report rendered HTML exist and are stable across runs
  5. Auth state machine tests capture the behaviour of `verifyInternalPassword`, `verifyOrgClientPassphrase`, and `verifyUserPassword` BEFORE Phase 6 replaces them
**Plans**: 6 plans (6/6 complete)
- [x] 02-01-PLAN.md â€” Wave 0: index.html bridge + tests/setup.js + mocks + auth-password fixture generator + crypto-parity preflight + GH-Pages preview-branch smoke (TEST-01)
- [x] 02-02-PLAN.md â€” Wave 1: extract src/util/{ids,hash}.js + first real tests + delete tests/smoke.test.js + SECURITY.md regression baseline + cleanup-ledger seed (TEST-01, DOC-10)
- [x] 02-03-PLAN.md â€” Wave 2: extract src/domain/{banding,scoring}.js with DI + TEST-02 boundary coverage (TEST-02)
- [x] 02-04-PLAN.md â€” Wave 3: extract src/domain/{completion,unread}.js + TEST-03 + TEST-05 (REGRESSION BASELINE â€” Pitfall 20 / H7) (TEST-03, TEST-05)
- [x] 02-05-PLAN.md â€” Wave 4: extract src/data/{migration,cloud-sync}.js + src/auth/state-machine.js + TEST-04 idempotency + TEST-06 (REGRESSION BASELINE â€” H8) + TEST-07 (REGRESSION BASELINE â€” Phase 6 deletes) (TEST-04, TEST-06, TEST-07)
- [x] 02-06-PLAN.md â€” Wave 5: TEST-10 snapshot tests (dashboard/diagnostic/report) + tiered coverage thresholds (D-15) + CI HTML artefact (D-20) + CONTRIBUTING.md governance (D-17, D-18) + ESLint testâ†’src isolation rule (T-2-03) (TEST-10, DOC-10)

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
- [ ] 03-01-PLAN.md â€” Wave 1: pre-flight verifications (Firestore region, project ID, registrar, OIDC pool, index.html meta-CSP scan, dist/index.html font-CDN scan, SDK 12.x connect-src verification)
- [ ] 03-02-PLAN.md â€” Wave 2: firebase.json + .firebaserc + tests/firebase-config.test.js + tsconfig exclude + SECURITY.md Â§HTTP Security Headers + Â§CSP (Report-Only)
- [ ] 03-03-PLAN.md â€” Wave 2: functions/ workspace + cspReportSink + normalise + filter + dedup + TDD unit tests
- [ ] 03-04-PLAN.md â€” Wave 3: ci.yml deploy + preview jobs via OIDC + post-deploy header assertion + functions/ npm audit + SECURITY.md Â§Hosting & Deployment
- [ ] 03-05-PLAN.md â€” Wave 4 + 5: runbooks/hosting-cutover.md + pre-cutover synthetic smoke + same-session CNAME flip + securityheaders.com manual smoke
- [ ] 03-06-PLAN.md â€” Wave 6: cleanup ledger rows (T-3-4 day-14 + T-3-meta-csp-conflict) + branch protection runbook update + SECURITY.md commit-SHA backfill + Â§Phase 3 Audit Index
**UI hint**: yes

### Phase 4: Modular Split + Quick Wins (Pure-Refactor Phase)
**Goal**: The 4,103-line `app.js` IIFE is decomposed into testable, lint-enforced modules and every refactor-safe security/quality fix that doesn't touch backend behaviour ships in this window.
**Depends on**: Phase 2 (test fence â€” Pitfall 9 non-negotiable), Phase 3 (build pipeline + hosting target stable)
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
- [x] 04-01-PLAN.md â€” Wave 1: firebase/ adapter (6 submodules) + Chart.js npm + Google Fonts self-host + CSP allowlist tightening + CODE-03 (crypto.randomUUID) + meta-CSP regression test (D-18) + Wave 1 ESLint flip
- [x] 04-02-PLAN.md â€” Wave 2: ui/* helpers (dom/modal/toast/format/chrome/upload) + CODE-04 (delete html: + permanent XSS regression fixture) + Wave 2 ESLint flip + SECURITY.md Â§ Build & Supply Chain
- [x] 04-03-PLAN.md â€” Wave 3: 12 data/* wrappers (6 owners + 6 pass-throughs) + 5 cloud/* stubs + 2 observability/* stubs + Wave 3 ESLint flip + 13 forward-tracking ledger rows
- [x] 04-04-PLAN.md â€” Wave 4: 12 views/*.js + _shared/render-conversation.js + per-view CODE-05/06/07/08/09/10/12 quick wins + Wave 4 ESLint flip + SECURITY.md Â§ Data Handling
- [x] 04-05-PLAN.md â€” Wave 5: state.js + router.js + main.js + atomic terminal cutover (app.js DELETED, index.html â†’ ./src/main.js) + 3 view-snapshot tests retargeted
- [x] 04-06-PLAN.md â€” Wave 6: cleanup â€” D-21 per-directory coverage thresholds + final ESLint hardening + CODE-11 + CODE-13 + cleanup-ledger zero-out + SECURITY.md Â§ Code Quality + Module Boundaries + human-verify checkpoint
**UI hint**: yes

### Phase 5: Firestore Data Model Migration + Rules Authoring (Committed, Not Deployed)
**Goal**: Production data lives under the subcollection-based shape the Rules will authorise; `firestore.rules` + `storage.rules` are written, unit-tested, and committed to the repo â€” but not yet deployed to production (deploy gate is Phase 6).
**Depends on**: Phase 4 (modular `data/*` boundaries are where new collection shapes land)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, RULES-01, RULES-02, RULES-03, RULES-04, RULES-05, RULES-06, TEST-08, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. Firestore production data is read from subcollections (`orgs/{orgId}/responses/{respId}`, `comments/{cmtId}`, `actions/{actId}`, `documents/{docId}`, `messages/{msgId}`, `readStates/{userId}`) with `orgs/{orgId}` parent docs reduced to small metadata; pre/post doc-count + field-presence assertions confirm zero data loss
  2. The migration script is re-runnable end-to-end against a staging clone of production with no duplicate or destructive effects (idempotency markers per collection)
  3. `users` collection is keyed by Firebase Auth UID with the prior app-internal `userId` retained as `legacyAppUserId` for backfill mapping; new top-level collections (`internalAllowlist`, `auditLog`, `softDeleted/{type}/items/{id}`, `rateLimits/{uid}/buckets/{windowStart}`) exist with correct rule scopes
  4. Comment + chat unread comparators use server-clock-vs-server-clock exclusively (last-read markers in `orgs/{orgId}/readStates/{userId}`); a 5-minute client-clock skew test does not change unread counts
  5. `@firebase/rules-unit-testing` suite covers every collection Ã— every role (anonymous / client / internal / admin) Ã— allowed and denied paths against the local emulator and runs green in CI; tenant-jump test (client with `orgId=A` cannot read or write any document under `orgs/B/*`) passes
  6. `firestore.rules` and `storage.rules` are committed to the repo but **not** present in the production Firebase project (deploy gate held for Phase 6)
**Plans**: 6 plans
Plans:
- [x] 05-01-PLAN.md â€” Wave 1: rules infra (firestore.rules + storage.rules + helper-rich predicate library) + 5 rules-unit-testing files (matrix + tenant-jump + soft-delete + server-only-deny-all + storage) + vitest.rules.config.js + firebase.json declarations + CI test-rules job (RULES-01..06, TEST-08)
- [x] 05-02-PLAN.md â€” Wave 2: migration script body (firebase-admin) with --dry-run + per-doc idempotency markers + pre/post collectionGroup assertion harness + pure builder functions for 6 migration steps + unit tests (DATA-01..06)
- [x] 05-03-PLAN.md â€” Wave 3: 5 src/data/* wrapper bodies rewritten to subcollection access + new src/data/read-states.js wrapper + tests/mocks/firebase.js subcollection-path support + Phase 4 D-09 cleanup-ledger row closures (DATA-01, DATA-04, DATA-07)
- [x] 05-04-PLAN.md â€” Wave 4: H7 fix (src/domain/unread.js server-clock comparator + 5-minute skew test) + H8 fix (src/data/cloud-sync.js per-subcollection dispatcher) â€” TWO ATOMIC COMMITS per Pitfall 20 (DATA-04, DATA-07)
- [x] 05-05-PLAN.md â€” Wave 5: production migration runbook (runbooks/phase5-subcollection-migration.md) + 05-PREFLIGHT.md skeleton + operator-execution checkpoint (gcloud export + dry-run + real run + post-assertions + rollback) (DATA-01..06)
- [x] 05-06-PLAN.md â€” Wave 6: SECURITY.md DOC-10 update (4 sections + Phase 5 Audit Index) + RULES-06 verification gate (zero firebase deploy --only firestore:rules in phase commits) + runbooks/phase-5-cleanup-ledger.md + phase-close human-verify checkpoint (DOC-10, RULES-06)

### Phase 6: Real Auth + MFA + Rules Deploy (Cutover)
**Goal**: Every production user is a real Firebase Auth identity with custom claims, MFA-enrolled if internal; the trust boundary moves from `localStorage` JS gating to server-side Rules + claims; this is the load-bearing cutover phase of the milestone.
**Depends on**: Phase 5 (data model + rules authored; users keyed by `firebaseUid`)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, AUTH-11, AUTH-12, AUTH-13, AUTH-14, AUTH-15, RULES-07, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. Anonymous Auth shows as **disabled** in the Firebase Console; the prior `signInAnonymously` substrate is removed from the client bundle; the hardcoded `INTERNAL_PASSWORD_HASH` + `INTERNAL_ALLOWED_EMAILS` constants are deleted from source
  2. Luke and George can each sign in with email + password (â‰¥12 chars, HIBP leaked-password check enforced via `passwordPolicy`), are challenged for TOTP MFA every session, and have generated and stored 10 hashed recovery codes
  3. `beforeUserCreated` blocking Cloud Function reads `internalAllowlist/{lowercasedEmail}` and sets custom claims `{role, orgId}` on user creation; `beforeUserSignedIn` writes a sign-in audit event; an admin can call `setClaims` to grant/revoke role/org claims and the target user picks up the change within seconds via the `users/{uid}/_pokes` listener pattern
  4. `firestore.rules` and `storage.rules` are **deployed to production**; tenant-jump and audited-user-cannot-read-own-records tests pass against the deployed project; rollback procedure (re-deploy previous commit's rules) is documented in `runbooks/` and verified within 5 minutes against staging
  5. Two-admin MFA recovery procedure is **drilled live** (Luke and George each take a turn being the locked-out actor) and the drill is documented with timing and any gaps
  6. Email verification is enforced before any read/write to `orgs/{id}/*`; sign-in error messages are unified to "Email or password incorrect" (account enumeration mitigation)
**Plans**: 6 plans
Plans:
- [x] 06-01-PLAN.md - Wave 1: pre-flight verifications (Firestore region via gcloud + Identity Platform upgrade + passwordPolicy >=12 + HIBP + firebase.json declarations verify-and-leave + functions/src/auth/ subdirectory placeholder) (AUTH-02, AUTH-04)
- [x] 06-02-PLAN.md - Wave 2: auth blocking + callable Cloud Functions (claim-builder.ts pure-logic test seam tests-first + beforeUserCreated.ts + beforeUserSignedIn.ts + setClaims.ts in europe-west2 with minInstances:1 + functions/src/index.ts re-exports) (AUTH-03, AUTH-05, AUTH-06, AUTH-07)
- [x] 06-03-PLAN.md - Wave 3: sign-in UI + firebase/auth.js body fills (4-render-fn Pattern D factory in src/views/auth.js: renderSignIn/renderFirstRun/renderMfaEnrol/renderEmailVerificationLanding + tests/snapshots tests-first + AUTH-12 SignInError chokepoint + claims-admin.js wired + router auth-state ladder + qrcode npm bundled) (AUTH-03, AUTH-08, AUTH-11, AUTH-12, AUTH-15)
- [x] 06-04-PLAN.md - Wave 4: bootstrap script + 3 cutover-supporting runbooks (scripts/seed-internal-allowlist/run.js Admin SDK ADC one-shot + runbooks/phase6-bootstrap.md + runbooks/phase6-mfa-recovery-drill.md (Tier-1 + Tier-2 + drill evidence template) + runbooks/phase6-cutover.md (12-step single-session atomic cutover)) (AUTH-04, AUTH-05, AUTH-08, AUTH-10, AUTH-13, AUTH-15)
- [ ] 06-05-PLAN.md - Wave 5: production cutover [autonomous: false] (4 checkpoints: rehearsal authoring runbooks/phase6-rules-rollback-rehearsal.md -> functions deploy + bootstrap + claims-verify + rules deploy + anon-disable -> AUTH-14 atomic deletion commit (9 grep verifications) -> MFA enrolment + AUTH-10 drill Round 1+2 + SC#4 clock-skew + 06-PREFLIGHT.md ## Cutover Log finalisation) (AUTH-01, AUTH-03, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-10, AUTH-11, AUTH-12, AUTH-13, AUTH-14, AUTH-15, RULES-07)
- [ ] 06-06-PLAN.md - Wave 6: cleanup + DOC-10 + RULES-07 verification gate (scripts/strip-legacy-id-fields.js Phase-5-D-21 carry-forward closure substrate + SECURITY.md 5 new sections + Phase 6 Audit Index per D-18 + REQUIREMENTS.md AUTH-09 SUPERSEDED 2026-05-08 by email-link recovery per D-07 + runbooks/phase-6-cleanup-ledger.md zero-out + 4 forward-tracking rows queued for Phase 7/9/10/11) (AUTH-09, AUTH-13, RULES-07, DOC-10)
**UI hint**: yes

### Phase 7: Cloud Functions + App Check (Trusted-Server Layer)
**Goal**: A trusted-server boundary exists with audit logging, rate limiting, secret management, and App Check perimeter â€” the substrate every later phase depends on.
**Depends on**: Phase 6 (custom claims live so Functions can re-verify caller identity from ID token)
**Requirements**: FN-01, FN-02, FN-03, FN-04, FN-05, FN-06, FN-07, FN-08, FN-09, AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-06, AUDIT-07, TEST-09, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. The `functions/` workspace builds + tests + deploys cleanly; every callable enforces App Check (`enforceAppCheck: true`), validates input via Zod, writes an idempotency marker doc with a 5-minute window, captures errors to Sentry node, and runs as its own minimal-IAM service account
  2. App Check is enrolled with reCAPTCHA Enterprise; per-environment site keys exist; debug tokens live only in `.env.local`; the App Check dashboard has soaked â‰¥7 days in unenforced mode and enforcement has been turned on per service in the order Storage â†’ Firestore (collection-by-collection) â†’ Cloud Functions; quota alert at 70% of free tier is configured
  3. `auditLog/{eventId}` Firestore collection rejects all client writes (rules `allow write: if false`); only the `auditWrite` Cloud Function (Admin SDK) writes; an audited user cannot read their own audit records (rules-unit-test pins this)
  4. Cloud Logging Data Access logs are sunk to BigQuery dataset `audit_logs_bq` with 7-year retention; mirror Firestore-trigger audit writers (`onOrgDelete`, `onUserDelete`, `onDocumentDelete`) fire end-to-end on the corresponding Firestore changes
  5. Rate limiting on chat / comment writes is enforced (preferred: Firestore Rules `request.time` predicate against `rateLimits/{uid}/buckets/{windowStart}`; fallback: callable Function token-bucket); a synthetic burst test confirms the limit fires
  6. Auth-blocking functions have `minInstances: 1`; cold-start observed p99 â‰¤ 4s; secrets accessed exclusively via `defineSecret()`
**Plans**: 6 plans
- [ ] 07-01-PLAN.md - Wave 1: shared infrastructure (functions/ deps bump 13.9.0/7.2.5/zod 4.4.3/sentry-node 10.52.0/firebase-functions-test 3.5.0; util/idempotency + util/zod-helpers + util/sentry + audit/auditEventSchema + audit/auditLogger pure-logic helpers + Vitest unit tests; setClaims hardened with Pattern A — App Check + Zod + idempotency + Sentry + per-fn SA; scripts/provision-function-sas Pattern E one-shot script creates 6 SAs) [autonomous: true] (FN-01, FN-02, FN-03, FN-04, FN-05, AUDIT-02)
- [ ] 07-02-PLAN.md - Wave 2: auditWrite callable (Pattern A) + 3 mirror triggers (onOrgDelete, onUserDelete, onDocumentDelete with 60s primary-event dedup per Pitfall 7) + auditLog/{eventId} rules-unit-test cells pinning AUDIT-01 (client-write deny matrix) + AUDIT-07 (audited-self read deny) [autonomous: true] (FN-03, AUDIT-01, AUDIT-04, AUDIT-07)
- [ ] 07-03-PLAN.md - Wave 3: App Check Stages A+B+C — operator registers reCAPTCHA Enterprise site key + debug token + 70 percent quota alert; src/firebase/check.js body fill (Phase 4 stub closure); production deploy with enforcement OFF; 7-day soak start; Stages D-F deferred to 07-HUMAN-UAT.md [autonomous: false] (2 operator checkpoints) (FN-07, FN-08)
- [ ] 07-04-PLAN.md - Wave 4: rate-limit predicate replaces Phase 5 deny-block in firestore.rules (rateLimitWindow + rateLimitOk(uid) helpers; rateLimits/{uid}/buckets/{windowStart} predicate body; composed into messages + comments create rules) + src/data/rate-limit.js transactional helper + checkRateLimit fallback callable seam (deployed-but-unwired per Pattern 5b) + tests/rules/rate-limit.test.js 15 cells including 31-write synthetic burst (FN-09 SC#5 evidence) [autonomous: true] (FN-09)
- [ ] 07-05-PLAN.md - Wave 5: D-22 ToS gate verification (operator gcloud check) + branch logic (Branch A — full Wave 5: minInstances:1 restore + cold-start p99 <= 4s baseline + invoker binding restore on 4 Cloud Run services; Branch B — degraded Wave 5: setClaims hardening + BigQuery sink + cspReportSink redeploy + BLOCKER-FIX 1 only) + BigQuery audit_logs_bq dataset (europe-west2 7y retention via scripts/enable-bigquery-audit-sink Pattern E) + cspReportSink redeploy (selective deploy per Pitfall 8 + invoker binding preservation) + BLOCKER-FIX 1 (src/firebase/auth.js:updatePassword wires setClaims callable + getIdToken(true) — Phase 6 sub-wave 6.1 closure) + src/cloud/claims-admin.js clientReqId addition [autonomous: false] (2 operator checkpoints — D-22 verification + close gate) (FN-06, AUDIT-03, AUDIT-06)
- [ ] 07-06-PLAN.md - Wave 6: TEST-09 firebase-functions-test integration suite (8 test files: auditWrite + 3 mirror triggers + setClaims + 2 auth-blocking + checkRateLimit; >=80 percent functions/src/ coverage) + src/cloud/audit.js + src/cloud/retry.js body fills (Phase 4 stub closure) + SECURITY.md DOC-10 5 new sections (§ Cloud Functions Workspace, § App Check, § Audit Log Infrastructure, § Rate Limiting, § Phase 7 Audit Index 15-row Pattern G table) + runbooks/phase-7-cleanup-ledger.md zero-out gate (closes 4 Phase 6 forward-tracking rows + 3 Phase 6 sub-wave 6.1 rows; queues forward-tracking for Phase 8/9/10/11/12) + REQUIREMENTS.md 17 row updates + 07-HUMAN-UAT.md operator-execution items (App Check Stages D/E/F + Branch B sub-wave 7.1 if applicable) [autonomous: false] (1 close-gate operator checkpoint) (TEST-09, DOC-10)


### Phase 8: Data Lifecycle (Soft-Delete + GDPR + Backups)
**Goal**: Deletes are recoverable, GDPR Art. 15 + 17 are honourable, and a documented backup + tested restore exists â€” the milestone's recoverability and data-rights story.
**Depends on**: Phase 7 (Cloud Functions + audit log + App Check substrate; ID re-keying via Functions only after backup is live â€” Pitfall 10)
**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06, GDPR-01, GDPR-02, GDPR-03, GDPR-04, GDPR-05, BACKUP-01, BACKUP-02, BACKUP-03, BACKUP-04, BACKUP-05, BACKUP-06, BACKUP-07, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. An admin user can soft-delete and restore an org, comment, document, message, or funnel comment within the 30-day window; soft-deleted items disappear from normal queries (rules predicate enforced) and are hard-deleted by the daily `scheduledPurge` Cloud Function past retention
  2. A user (or admin on their behalf) can call `gdprExportUser` and download a JSON bundle containing all user-linked data via a signed URL with TTL â‰¤ 24h; the bundle includes profile, owned diagnostic responses, comments authored, messages authored, action items assigned, and audit events about the user
  3. `gdprEraseUser` replaces `authorId` references with a deterministic pseudonym token across all denormalised collections (messages, comments, actions, documents, funnelComments) plus Storage objects under user-owned paths, redacts PII fields, and adds the user's tombstone token to the `redactionList` consumed by the next backup-rotation cycle; a post-erasure audit script confirms zero residual PII
  4. A daily Firestore export lands in `gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/` with the 30d Standard / 90d Nearline / 365d Archive lifecycle policy applied; Firestore PITR is enabled (7-day rolling); Storage bucket has Object Versioning + 90-day soft-delete enabled
  5. Storage signed URLs for documents are issued with TTL â‰¤ 1h and refresh-on-download; the prior unbounded `getDownloadURL` paths are gone
  6. One restore drill has been **performed and documented** in `runbooks/restore-drill-<date>.md` with timing, evidence, and any gaps; quarterly cadence is documented for ongoing
**Plans**: 6 plans
Plans:
- [ ] 08-01-backup-substrate-PLAN.md — Wave 1: GCS backups bucket + lifecycle.json + Firestore PITR + uploads bucket versioning/soft-delete + extended admin-sdk mocks + @google-cloud/firestore@8.5.0 install + operator runbook (BACKUP-02/03/04, DOC-10)
- [x] 08-02-backup-cloud-functions-PLAN.md — Wave 1: scheduledFirestoreExport + getDocumentSignedUrl callables + src/cloud/signed-url.js seam + functions/src/index.ts wiring + 4 test files (BACKUP-01, BACKUP-05)
- [x] 08-03-soft-delete-PLAN.md — Wave 2: softDelete + restoreSoftDeleted + scheduledPurge + resolveDocRef helper + 5 firestore.rules notDeleted conjuncts + 5 data-wrapper where(deletedAt) edits + src/cloud/soft-delete.js fill + src/views/admin.js LIFE-06 minimal + getDownloadURL sweep across src/main.js + src/data/documents.js (LIFE-01..06)
- [x] 08-04-gdpr-export-PLAN.md — Wave 3: gdprExportUser callable + assembleUserBundle pure helper + collectionGroup mock extension + src/cloud/gdpr.js#exportUser fill + 3 test files (GDPR-01)
- [x] 08-05-gdpr-erase-PLAN.md — Wave 4: pseudonymToken + eraseCascade pure helpers + gdprEraseUser callable + redactionList rules + tests/rules/redaction-list.test.js + scripts/post-erasure-audit/run.js + src/cloud/gdpr.js#eraseUser fill; Task 7 (GDPR_PSEUDONYM_SECRET + 4 SAs) DEFERRED to Wave 6 batch (GDPR-02..05)
- [x] 08-06-restore-drill-and-docs-PLAN.md [autonomous: false] — Wave 6: deploy commands + restore drill runbook template + runbooks/phase-8-restore-drill-cadence.md + SECURITY.md DOC-10 (4 sections + Phase 8 Audit Index) + REQUIREMENTS.md 18-row updates + runbooks/phase-8-cleanup-ledger.md zero-out + 08-06-DEFERRED-CHECKPOINT.md (single operator session: deploy + drill + close-gate) — code_and_docs_complete; operator_deploy_pending (BACKUP-06, BACKUP-07, DOC-10) (2026-05-10)
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
**Plans**: 7 plans (09-03a inserted in revision iteration 1 to land server-side substrate before client wiring)
Plans:
- [x] 09-01-PLAN.md — Wave 1: Sentry init substrate + shared PII_KEYS dictionary (browser + node parity-tested) + audit-events.js proxy seam + Sentry boot wiring in src/main.js + runbooks/phase-9-sentry-bootstrap.md (OBS-01, OBS-02, OBS-03, OBS-08 substrate, DOC-10)
- [x] 09-02-PLAN.md — Wave 2: @sentry/vite-plugin source-map upload in vite.config.js + CI env wiring (build/deploy/preview) + post-build .map deletion gate; tests/build/source-map-gate.test.js 5/5 green; OBS-04 substrate code-complete (operator must set GitHub Actions secrets per runbooks/phase-9-sentry-bootstrap.md Step 5 before first deploy actually uploads source maps) (OBS-04) (2026-05-10)
- [x] 09-03a-PLAN.md — Wave 3 (substrate): server-side bare audit emissions for iam.claims.set (setClaims) + auth.signin.failure substrate (beforeUserSignedIn — DORMANT until rejection rules land) + 3 × 5 lifecycle ops (softDelete + restoreSoftDeleted + permanentlyDeleteSoftDeleted across action/comment/document/message/funnelComment); auditEventSchema enum extended 28 → 61 (15 bare + 18 .requested literals); 25 new tests across 6 test files (AUDIT-05, OBS-02, OBS-05) (2026-05-10)
- [x] 09-03-PLAN.md — Wave 3: AUDIT-05 view wiring across 9 sites: 5 emit calls in src/firebase/auth.js (signInEmailPassword try/finally outcome-flag ternary covering signin success+failure, signOut PRE-emit, updatePassword POST, sendPasswordResetEmail POST with target.id="unknown" + empty payload, signInWithEmailLink POST with payload.method="emailLink") + 6 POST-emits in src/cloud/{claims-admin,gdpr,soft-delete}.js (iam.claims.set.requested with newRole, compliance.{export,erase}.user.requested, data.<type>.{softDelete,restore,permanentlyDelete}.requested via template-literal type construction). 14 new tests across 2 new files (tests/firebase/auth-audit-emit.test.js + tests/audit-wiring.test.js); Pitfall 17 invariant verified (zero PII in payloads). MFA wiring still DORMANT per Plan 03a §mfa_rationale. (AUDIT-05, OBS-02 partial) (2026-05-10)
- [x] 09-04-PLAN.md — Wave 4: authAnomalyAlert onDocumentCreated trigger (4 anomaly rules + Slack webhook + audit-alert-sa) + authFailureCounters server-only collection + 4-cell deny rules-test + scripts/test-slack-alert/run.js + .gitleaks.toml slack-webhook-url regex (moved from Plan 06 Task 3 per WARNING 7). 10 new tests (6 trigger behaviour + 4 rules cells); Rules 1+2 DORMANT (auth.signin.failure substrate emits zero rows today; MFA emit-site bound to enrollTotp/unenrollAllMfa deps in src/main.js); Rules 3+4 FUNCTIONAL (Plan 03a setClaims emit + Phase 8 gdprExportUser emit). Auto-fixed inline (Rule 1): RESEARCH.md §Pattern 6 first-event-branch crash (tx.update on non-existent doc), collapsed missing-doc + window-expired into single tx.set; eslint Node 22 fetch global added; README example URL false-positiv'd own gitleaks rule, replaced with non-Slack hostname. ~12.5 min execution. Commits: 4adde66, 08394a8, 56c8147, 7d884ce, ebea786. (OBS-05) (2026-05-10)
- [~] 09-05-PLAN.md [autonomous: false] — Wave 6: GCP-tier monitors — Tasks 1, 2, 3a COMPLETE (scripts/setup-uptime-check/run.js + scripts/setup-budget-alerts/run.js + 2 READMEs at Phase 7/8 template style + runbooks/phase-9-monitors-bootstrap.md 6 operator steps + runbooks/phase-9-deploy-checkpoint.md 5 verification gates with Cutover Log table; Pitfall 19 substrate-honest disclosures preserved — 3-region gcloud minimum exceeds OBS-06 ≥2; alerts NOTIFY only with v2 auto-disable OUT OF SCOPE; Row D explicitly DORMANT per Plan 09-04 emit-source absence). Task 3b BLOCKING operator checkpoint PENDING — bundled with Plan 09-06 Task 4 into single combined operator session per `09-06-DEFERRED-CHECKPOINT.md` (saves operator interrupts; mirrors 08-06-DEFERRED-CHECKPOINT.md pattern). Commits: 71e7d1b, 8088557, bc79fbb. (OBS-04, OBS-06, OBS-07, OBS-08)
- [~] 09-06-PLAN.md [autonomous: false] — Wave 7: Tasks 1, 2, 3 COMPLETE (autonomous portion). SECURITY.md +207 lines (4 new Phase 9 sections — § Observability — Sentry + § Audit-Event Wiring + § Anomaly Alerting + § Out-of-band Monitors — and 10-row Phase 9 Audit Index covering OBS-01..08 + AUDIT-05 + DOC-10; 10 Substrate-honest + 9 DORMANT exceed planner spec); REQUIREMENTS.md row updates (OBS-01 + OBS-03 + DOC-10 `[x]`; OBS-02 + OBS-04..08 + AUDIT-05 `[~]` substrate-complete-operator-pending matching Phase 8 BACKUP pattern; Traceability table OBS-01..08 + AUDIT-05 + DOC-10 rows with Validated 2026-05-10); runbooks/phase-9-cleanup-ledger.md zero-out gate (`phase_9_active_rows: 0`); CONTRIBUTING.md +64 lines (§ Error Message Discipline — Pitfall 8 anti-pattern + SignInError exemplar + AUTH-12 chokepoint + quarterly audit). 09-06-DEFERRED-CHECKPOINT.md bundles Plan 09-05 Task 3b + Plan 09-06 Task 4 into single combined operator session (mirrors 08-06-DEFERRED-CHECKPOINT.md). .gitleaks.toml regex closure REFERENCES Plan 09-04 Task 4 (defence-in-depth lands WITH secret introduction per planner WARNING 7). Task 4 phase-close human-verify PENDING — operator runs ~45-75 min combined session. Commits: e48802b, 6b3378e, 87e2221. (DOC-10) (2026-05-10)

### Phase 10: CSP Tightening (Second Sweep)
**Goal**: The CSP report-only headers from Phase 3 become enforced at the strictest level the app can run under, closing H4 fully and consuming the inline-style sweep done in Phase 4.
**Depends on**: Phase 4 (inline-style â†’ class sweep complete), Phase 3 (report-only soak data via `csp-violations` endpoint)
**Requirements**: HOST-06, HOST-07, DOC-10 (incremental)
**Success Criteria** (what must be TRUE):
  1. `Content-Security-Policy` is enforced (no longer Report-Only) with `style-src 'self'` (no `'unsafe-inline'`); `script-src 'self'` (or `'self' 'strict-dynamic'` if needed for Firebase SDK lazy loading); `frame-src` constrained to Firebase Auth popup origin; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`
  2. Sign-in, dashboard, radar/donut chart, document upload, and chat all function under enforced CSP (verified on staging before promotion); the `csp-violations` Cloud Function shows no new violations during a 7-day post-tightening soak
  3. HSTS preload submission is filed at `hstspreload.org` and the domain appears in the preload list
  4. `securityheaders.com` rating is "A+"
**Plans**: 5 plans
Plans:
- [x] 10-01-PLAN.md — Wave 1: mechanical inline-style → utility class migration (Rule 3 expanded scope: 162 static sites → 0 in src/main.js, covering 130 single-line + 32 multi-line plain-string patterns; 9 template-literal sites preserved per plan); Wave 1 utility-class block in styles.css (24 atom `.u-*` + ~80 semantic compound classes, 646 lines appended); cache-buster bump ?v=52 → ?v=53 on 3 sites; 3 view snapshots updated (mechanical attr-renaming, no content drift); 478/478 vitest green; closes Phase 4 sub-wave 4.1 inline-style carryover. Commits: 89b1140 (Task 1 — utility-class block) + ec0afa7 (Task 2 — migration + cache-buster + snapshots). (HOST-07, CODE-06 inline-style portion) (2026-05-10)
- [x] 10-02-PLAN.md — Wave 2: firebase.json CSP-RO directive value tightened in three surgical edits (style-src `'self'` only / connect-src + `https://de.sentry.io` / frame-src `'self'`); header KEY remains `Content-Security-Policy-Report-Only` (Wave 4 owns the flip per Pitfall 16 Stage B); tests/firebase-config.test.js +6 Phase 10 assertions in new describe block (`firebase.json — Phase 10 tightened CSP shape (HOST-07)`) using single-knob `cspKey` constant pattern; firebase-config 18→24 cases all green; root suite 478→484/484; Pitfall 8 selective-deploy boundary preserved (cspReportSink not touched). Commits: 523e47e (Task 1 — feat: tighten CSP-RO directives) + 24f8a7c (Task 2 — test: add 6 Phase 10 schema assertions). Zero deviations. (HOST-06 substrate via HSTS preload-eligibility test, HOST-07 substrate via tightened RO shape) (2026-05-10)
- [~] 10-03-PLAN.md — Wave 3: [autonomous: false] Production selective deploy of tightened CSP-RO + 7-day calendar soak (Stage B per Pitfall 16); runbooks/phase-10-csp-soak-bootstrap.md (308 lines) + 10-PREFLIGHT.md (138 lines) Soak Log (HOST-06 substrate). **Task 1 (autonomous portion) COMPLETE 2026-05-10** — operator runbook authored with Pre-conditions / Step 1 selective deploy (firebase deploy --only hosting + Pitfall 8 forbidden-deploys list) / Step 2 curl header verification / Step 3 daily gcloud logging read --freshness=24h / Step 4 Day 7 close-out --freshness=7d --limit=200 binary CLEAN/RESTART decision gate / Failure-Mode Triage 4-row decision-tree (Sentry sub-host A4 / missed inline-style / unexpected popup / extension noise) / Cycle-N Soak Log convention; preflight log skeleton with Pre-conditions sign-off + Cycle 1+2 Soak Log (9-row tables) + Day 0 verbatim header capture + Triage Incidents template + Wave 3 Close Decision binary gate; firebase-config 24/24 green sanity. Pitfall 19 substrate-honest disclosure throughout. Commit: ebd6c5d (docs). **Task 2 (operator deploy + 7-day soak) PENDING** — checkpoint:human-action; calendar time cannot be automated.
- [ ] 10-04-PLAN.md — Wave 4: [autonomous: false] Single-knob enforcement flip (Content-Security-Policy-Report-Only → Content-Security-Policy); runbooks/csp-enforcement-cutover.md + 5-target smoke matrix (sign-in/dashboard/charts/upload/chat); Cutover Log rows A/B/C (HOST-06)
- [~] 10-05-PLAN.md — Wave 5: [autonomous: false] hstspreload.org submission + securityheaders.com A+ rating + SECURITY.md DOC-10 increment (§ CSP enforced + § HSTS Preload Status + Phase 10 Audit Index) + REQUIREMENTS.md traceability + runbooks/phase-10-cleanup-ledger.md zero-out (HOST-06 + HOST-07 + DOC-10). **Tasks 1 + 3 autonomous COMPLETE 2026-05-10** — `runbooks/hsts-preload-submission.md` (~190 lines, 5 numbered operator Steps + 3-row Cutover Log + apex-vs-subdomain decision tree); SECURITY.md replaces § CSP (Report-Only) with § CSP (enforced) + adds § HSTS Preload Status + adds § Phase 10 Audit Index (3-row Pattern G) + § Phase 3 Audit Index maintenance (4 rows updated); REQUIREMENTS.md HOST-07 + HOST-06 flipped `[x]` substrate-complete + DOC-10 Phase 10 Wave 5 increment + Traceability table update; `runbooks/phase-10-cleanup-ledger.md` `phase_10_active_rows: 0` zero-out gate (1 Phase 4 row CLOSED + 1 Phase 6/7 row CLOSED + 11 in-phase rows CLOSED + 4 carry-forward operator-deferred + 6 forward-tracking rows queued); cross-phase ledger surgery (phase-4 + phase-6 + phase-7); `10-DEFERRED-CHECKPOINT.md` bundles 4 chained operator actions (Plan 10-03 Task 2 Stage B soak + Plan 10-04 Task 2 enforcement flip + Plan 10-05 Task 2 HSTS submission + Plan 10-05 Task 4 phase-close human-verify) over 14+ calendar days. firebase-config 24 passed | 6 skipped (30); root suite 484 passed | 6 skipped (490). 2 auto-fixed deviations (Rule 2): Phase 3 Audit Index 4-row maintenance + cross-phase Owner column HOST-06 → HOST-07 correction. Commits: 86ec5cd (Task 1 — HSTS runbook), b254230 (Task 3 — SECURITY.md + REQUIREMENTS.md + cleanup ledger surgery). **Tasks 2 + 4 operator session PENDING** per 10-DEFERRED-CHECKPOINT.md Steps 3 + 4; Phase 10 close cannot advance until operator approval OR sub-wave 10.x resolves gaps.
**UI hint**: yes

### Phase 11: Documentation Pack (Evidence Pack)
**Goal**: A vendor-questionnaire-ready evidence pack exists with every claimed control backed by a code link + test link + framework citation â€” not "industry-standard encryption" hand-waves.
**Depends on**: Phase 10 (every control is in code first, then catalogued)
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, DOC-08, DOC-09, DOC-10 (canonical owner â€” final pass)
**Success Criteria** (what must be TRUE):
  1. `SECURITY.md`, `PRIVACY.md`, `THREAT_MODEL.md`, `docs/CONTROL_MATRIX.md`, `docs/RETENTION.md`, `docs/IR_RUNBOOK.md`, and `docs/DATA_FLOW.md` all exist and each row in `CONTROL_MATRIX.md` cites a code path, config file, test, and explicit framework section (OWASP ASVS L2 / ISO 27001:2022 Annex A / SOC2 CC / GDPR Article)
  2. `/.well-known/security.txt` (RFC 9116) is served from production with disclosure contact `security@bedeveloped.com`; `SECURITY.md` carries the vulnerability disclosure policy paragraph (acknowledge in 5 business days, no legal action against good-faith researchers)
  3. `PRIVACY.md` lists Google/Firebase, Sentry, and Google Fonts as sub-processors with Google Cloud DPA + Standard Contractual Clauses references; the verified Firestore data residency region is documented
  4. `docs/evidence/` contains screenshots: MFA enrolment for Luke + George, sample audit-log entry (PII redacted), backup-policy console, Firestore region, App Check enforcement state per service, rules deployment timestamp, latest CI green run, latest `npm audit` clean output
  5. A reviewer reading only `SECURITY.md` + `CONTROL_MATRIX.md` can answer every claim by following the citations into the codebase or `docs/`
**Plans**: 6 plans
  - [~] 11-01-PLAN.md — Wave 1: SECURITY.md ToC + § Vulnerability Disclosure Policy + § MFA Recovery Procedure + § Rotation Schedule + citation-format normalisation + docs/CONTROL_MATRIX.md skeleton (DOC-01 + DOC-04 substrate). **COMPLETE 2026-05-10.** SECURITY.md 1278 → 1392 lines (+114 net): ToC (36 anchor links) + § Vulnerability Disclosure Policy (replaces Phase 1 blockquote placeholder; 5-business-day acknowledgement + safe-harbour + in-scope/out-of-scope + RFC 9116 forward-reference) + § MFA Recovery Procedure (Tier 1 email-link recovery per Phase 6 D-07 + Tier 2 operator Admin SDK un-enrol; PENDING-OPERATOR drill evidence per Pitfall 19) + § Rotation Schedule (7-row table: GDPR_PSEUDONYM_SECRET annual + Sentry DSN/Slack webhook URL on-leak + 3 OIDC/WIF non-rotation rows + Firebase-managed TLS). 16 citation-format drift normalisations: 15 × `OWASP ASVS L2 V` → `OWASP ASVS L2 v5.0 V` + 1 × `GDPR Article 32` → `GDPR Art. 32` in compliance posture footer. `docs/CONTROL_MATRIX.md` skeleton created (100 lines, 15 REQ-prefix anchors alphabetical: AUDIT/AUTH/BACKUP/CODE/DATA/DOC/FN/GDPR/HOST/LIFE/OBS/RULES/TEST/TOOL/WALK; rows populated Wave 6). 2 new TDD doc-shape tests (9 assertions): tests/security-md-toc.test.js (5 cases) + tests/security-md-citation-format.test.js (4 cases). RED gate (commit 4c95516) → GREEN gate (commit 30f104e) → 9/9 PASS; full suite 493 passed + 6 skipped (was 484 + 6; +9; zero regressions). Compliance posture footer `credible, not certified` boilerplate preserved verbatim (zero `credible.*not certified` diff hits). 2 auto-fixed Rule 3 deviations: (a) internal plan conflict between footer-verbatim + Test 4 zero-`GDPR Article \d` resolved by normalising only the citation form not the substantive sentence; (b) § Rotation Schedule placement before `---` separator preceding `## Sections planned for later phases` (the next heading is a stubs index, not a `## §` section). Commits: 4c95516 (test — RED), 30f104e (docs — SECURITY.md GREEN), fb09246 (docs — CONTROL_MATRIX skeleton). Plan 11-02 (PRIVACY.md) is unblocked.
  - [~] 11-02-PLAN.md — Wave 2: PRIVACY.md authoring with A1 (Cloud Storage region) + A3 (Identity Platform region) gcloud verification log + Google Fonts negative verification + Sentry EU + DPA URLs (DOC-02). **COMPLETE 2026-05-10 substrate.** PRIVACY.md authored at repo root (112 lines, 7-section canonical structure per RESEARCH.md Pattern 2) — Data we process / Sub-processors / Data residency / Retention / Data subject rights / International transfers / Contact. Sub-processor table contains exactly 2 vendor rows (Google LLC + Functional Software Inc.) with 3 verbatim DPA URLs (cloud.google.com/terms/data-processing-addendum + firebase.google.com/terms/data-processing-terms + sentry.io/legal/dpa/). Google Fonts explicitly disclaimed with live-curl + source-grep evidence (post-Phase-4 self-hosted). 5-gate verification log at `.planning/phases/11-documentation-pack-evidence-pack/11-02-VERIFICATION-LOG.md` (286 lines): 3 PASS (Google Fonts negative — live-curl + source-grep both 0 hits; Sentry EU residency — `vite.config.js:36` + `src/observability/sentry.js:9` grep; Sentry DPA URL liveness — `HTTP/1.1 200 OK` direct) + 2 PENDING-OPERATOR/ASSUMED-PER-A3 (A1 Cloud Storage region — non-interactive gcloud auth refresh failure across all 3 accounts; A3 Identity Platform region — gcloud root namespace lacks `identity-platform`; both bundleable into existing Phase 8 + 9 + 10 deferred-checkpoint cluster). PRIVACY.md ships substrate-honest annotations (Pitfall 19): Firestore + Functions VERIFIED `europe-west2` (Phase 6 PREFLIGHT 2026-05-08 cited inline); Cloud Storage `**PENDING-OPERATOR**` with paste-ready `gcloud auth login + gcloud storage buckets describe` command; Identity Platform `**ASSUMED-PER-A3**` with Firebase Console URL `https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/settings`. GDPR DSR flow cites both `gdprExportUser` + `gdprEraseUser` callables + Art. 12(3) 30-day SLA. 8-case TDD doc-shape test `tests/privacy-md-shape.test.js` (Section 2 row count + Google Fonts disclaimer + europe-west2 ≥2 hits + 3 DPA URLs + DSR callables + Art. 12(3) + Pitfall 19 forbidden-words gate with negation-tolerant regex preserving "credible, not certified" canonical phrasing) RED→GREEN. Full suite 501 passed + 6 skipped (was 493 + 6; +8; zero regressions). 2 auto-fixed Rule 3 deviations (both within plan-pre-authorised contract): D-11-02-01 — A1 ESCALATE branch taken substrate-honest as PENDING-OPERATOR; auto-fix #2 — A3 plan-authorised Console-only path taken. D-11-02-02 — Test 8 negation-tolerant regex. Forward-tracking rows F-DOC-02-A1 + F-DOC-02-A3 queued for Wave 6 cleanup ledger (operator gcloud verification of A1 + Console verification of A3 closes the row to `[x]`). Commits: 9d3dcc2 (docs — verification log), e5b6684 (test — RED), a2eeefc (docs — PRIVACY.md GREEN). Plan 11-03 (THREAT_MODEL.md + DATA_FLOW.md) is unblocked.
  - [~] 11-03-PLAN.md — Wave 3: THREAT_MODEL.md (STRIDE 4 trust boundaries + 6 categories + defence-in-depth) + docs/DATA_FLOW.md (Mermaid + classifications + processing regions) (DOC-03 + DOC-07). **COMPLETE 2026-05-10.** THREAT_MODEL.md authored at repo root (86 lines, STRIDE structure per RESEARCH.md Pattern 3): 4 trust boundaries (Browser ↔ Firebase backplane / Firebase Auth ↔ Cloud Functions+Firestore+Storage / Functions ↔ external services / Operator ↔ Firebase+GCP Console); 6 STRIDE categories T1 Authentication bypass / T2 Tenant boundary breach / T3 File upload abuse / T4 Denial of wallet / T5 Supply-chain compromise / T6 Insider misuse, each with **Threat:** / **Mitigations:** / **Evidence:** sub-blocks pointing into SECURITY.md sections; 6-row Defence-in-depth summary table (Network / Application / Data / Operational / Supply chain / Compliance); closing source-artefacts paragraph documenting per-phase plan `<threat_model>` block relationship. docs/DATA_FLOW.md authored (43 lines, RESEARCH.md Pattern 4): Mermaid `flowchart LR` block with 8 nodes (Client / Auth / Firestore / Storage / Functions / Sentry / Slack / BigQuery) + 10 labelled edges (≥9 required); 4-row Data classifications table (Customer business / User account / Operational / Error telemetry × Class | Examples | Storage location | Encryption | Access control); 4-bullet Processing regions list citing `europe-west2` 9 times across the document. Cross-document residency consistency with PRIVACY.md preserved: Mermaid Storage node carries `PENDING-OPERATOR<br/>recommended europe-west2` annotation (D-11-03-01) per Wave 2 A1 escalation; Mermaid Auth node carries `EU - ASSUMED-PER-A3` annotation (D-11-03-02) per Wave 2 A3 escalation; two footnotes below diagram cross-reference PRIVACY.md § 3 + 11-02-VERIFICATION-LOG.md § A1 + § A3. 15-case TDD doc-shape gate (8 threat-model + 7 data-flow tests; tests/threat-model-shape.test.js + tests/data-flow-shape.test.js mirror tests/privacy-md-shape.test.js Wave 2 regex-over-file-body pattern) RED → GREEN. Plan-cited gates all pass: `grep -c "^### T[1-6]\." THREAT_MODEL.md` 6 (== 6); `grep -c "europe-west2" docs/DATA_FLOW.md` 9 (≥3); Mermaid edge count 10 (≥9); 8/8 Mermaid node identifiers; cross-doc consistency 15 europe-west2 hits across PRIVACY.md + DATA_FLOW.md + THREAT_MODEL.md (same region for same nouns); Pitfall 19 forbidden-words zero hits in both new docs. Full suite 516 passed + 6 skipped (was 501 + 6; +15; zero regressions across 71 prior test files). Mermaid render verification PENDING-OPERATOR (manual visual check on GitHub PR view per project A6 assumption — doc-shape test validates structure only). 1 auto-fixed Rule 3 deviation (within plan-pre-authorised contract): D-11-03-01 + D-11-03-02 Mermaid Storage + Auth node labels diverge from verbatim RESEARCH.md Pattern 4 template per the plan's `<action>` line 211 contingency authorisation for the case where Wave 2 PRIVACY.md verification status diverged. Commits: dccf654 (test — RED), 1bf9c54 (docs — THREAT_MODEL + DATA_FLOW GREEN). Plan 11-04 (RETENTION.md extension + IR_RUNBOOK.md authoring) is unblocked — DOC-03 § Trust boundaries + § Threat categories + § Defence in depth summary + DOC-07 § Data classifications + § Processing regions anchors are immediately usable as cross-reference targets.
  - [ ] 11-04-PLAN.md — Wave 4: docs/RETENTION.md expansion to 8+ data classes (preserving FN-09 verbatim) + docs/IR_RUNBOOK.md (5 scenarios) + 3 skeleton ir-*.md runbooks (DOC-05 + DOC-06)
  - [ ] 11-05-PLAN.md — Wave 5: public/.well-known/security.txt RFC 9116 + firebase.json /.well-known/** Cache-Control 24h entry + 2 build tests (DOC-08)
  - [ ] 11-06-PLAN.md — Wave 6: docs/CONTROL_MATRIX.md row population (30+ rows) + docs/evidence/README.md inventory + SECURITY.md § Phase 11 Audit Index + REQUIREMENTS.md DOC-01..09 [x] + runbooks/phase-11-cleanup-ledger.md zero-out + cross-phase ledger surgery + /gsd-verify-work 11 (DOC-04 + DOC-09 + DOC-10) [autonomous: false]

### Phase 12: Audit Walkthrough + Final Report
**Goal**: `SECURITY_AUDIT.md`'s Vercel/Supabase-shaped checklist becomes a Firebase-shaped checklist run end-to-end against the hardened repo, producing the milestone's closing artefact: `SECURITY_AUDIT_REPORT.md`.
**Depends on**: Phase 11 (evidence pack is the citation source for the report)
**Requirements**: WALK-01, WALK-02, WALK-03, WALK-04, DOC-10 (final increment)
**Success Criteria** (what must be TRUE):
  1. `docs/SECURITY_AUDIT_TRANSLATION.md` exists with a per-section map from Vercel/Supabase guidance to Firebase equivalents (RLSâ†”Firestore Rules; service_roleâ†”custom claims + Cloud Functions; Edge Functionsâ†”Cloud Functions; pgauditâ†”Cloud Function audit log; PITRâ†”Firestore PITR; Vercel BotID/Firewallâ†”reCAPTCHA Enterprise / App Check; OIDC federationâ†”Firebase Auth tokens; Vercel Audit Logsâ†”Cloud Logging + audit-log Cloud Function)
  2. `SECURITY_AUDIT.md` LLM03 / LLM05 / LLM10 sections are explicitly judged N/A with documented rationale ("this app has no LLM surface") â€” not silently skipped
  3. `SECURITY_AUDIT_REPORT.md` documents every checklist item as Pass / Partial / N/A with citations into the codebase + `docs/`; sections without clean Firebase equivalents are explicitly flagged "N/A â€” Firebase architecture differs" with rationale
  4. The report's overall posture statement reads "credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2" â€” not "compliant" or "certified" (Pitfall 19 prevention)
**Plans**: TBD

---

## Cross-Phase / Cross-Cutting Requirements

| Requirement | Owning Phase | Cross-Cutting Behaviour |
|-------------|--------------|-------------------------|
| DOC-10 (incremental `SECURITY.md` updates) | Phase 11 (canonical) | Every phase appends to `SECURITY.md` as it closes findings â€” Pitfall 19 prevention. Phase 11 does the final pass + ensures no findings closed without a corresponding paragraph. |
| AUDIT-05 (audit-event wiring in `views/*`) | Phase 9 | Builds on `auditWrite` infrastructure from Phase 7 and lifecycle/GDPR callers from Phase 8. |
| RULES-07 (production rules deploy + rollback plan) | Phase 6 | The deploy gate that releases the rules authored in Phase 5; runs alongside the Auth migration cutover. |

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Engineering Foundation (Tooling) | 0/6 | Not started | - |
| 2. Test Suite Foundation (Tests-First) | 0/0 | Not started | - |
| 3. Hosting Cutover + Baseline Security Headers | 6/6 | Complete (3 operator items in 03-HUMAN-UAT.md) | 2026-05-07 |
| 4. Modular Split + Quick Wins | 6/6 | Complete (3 UI smoke items in 04-HUMAN-UAT.md; sub-wave queued as 4.1) | 2026-05-07 |
| 5. Firestore Data Model Migration + Rules Authoring | 6/6 | Complete (1 deferred item in 05-HUMAN-UAT.md â€” live SC#4 clock-skew exercise lands in Phase 6) | 2026-05-08 |
| 6. Real Auth + MFA + Rules Deploy (Cutover) | 0/0 | Not started | - |
| 7. Cloud Functions + App Check | 0/0 | Not started | - |
| 8. Data Lifecycle (Soft-Delete + GDPR + Backups) | 2/6 | In Progress|  |
| 9. Observability + Audit-Event Wiring | 7/7 | Code-and-docs complete; combined operator session pending per `09-06-DEFERRED-CHECKPOINT.md` (bundles 09-05 Task 3b + 09-06 Task 4) | 2026-05-10 (autonomous portion) |
| 10. CSP Tightening (Second Sweep) | 5/5 | Code-and-docs complete; combined operator session pending per `10-DEFERRED-CHECKPOINT.md` (bundles Plan 10-03 Task 2 Stage B soak + Plan 10-04 Task 2 enforcement flip + Plan 10-05 Task 2 HSTS submission + Plan 10-05 Task 4 phase-close human-verify over 14+ calendar days). Plans 10-01+10-02 autonomous COMPLETE; 10-03 Task 1 autonomous COMPLETE; 10-04 Task 1 autonomous COMPLETE (runbooks/csp-enforcement-cutover.md + describe.skip pre-stage); 10-05 Tasks 1 + 3 autonomous COMPLETE (HSTS submission runbook + SECURITY.md DOC-10 increment + REQUIREMENTS.md row updates + phase-10-cleanup-ledger zero-out + cross-phase ledger surgery + 10-DEFERRED-CHECKPOINT.md). HOST-07 + HOST-06 + DOC-10 substrate complete; HOST-06 listing-status forward-tracked F1 per Pitfall 19. | 2026-05-10 (autonomous portion — 10-01/10-02/10-03 T1/10-04 T1/10-05 T1+T3) |
| 11. Documentation Pack (Evidence Pack) | 3/6 | In Progress — Plans 11-01 + 11-02 + 11-03 COMPLETE (Wave 1 DOC-01 + DOC-04 substrate; Wave 2 DOC-02 PRIVACY.md substrate; Wave 3 DOC-03 THREAT_MODEL.md + DOC-07 docs/DATA_FLOW.md substrate); Plans 11-04 + 11-05 + 11-06 remaining; Wave 6 ends with /gsd-verify-work 11 operator gate | 2026-05-10 (Plans 11-01..11-03 autonomous portion) |
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
| Tests-first before modular split (Pitfall 9) | Honoured | Phase 2 (tests) â†’ Phase 4 (split). Phase 3 sits between them but is hosting-only and does not touch the IIFE refactor. |
| Rules committed early; deployed only after Auth is live (Pitfall 1) | Honoured | Phase 5 authors + commits + unit-tests rules. Phase 6 deploys rules **as part of the same cutover** as `beforeUserCreated` populating claims and Anonymous Auth being disabled. RULES-07 (production deploy) lives in Phase 6, never Phase 5. |
| Subcollection migration before Rules deployment | Honoured | Phase 5 does data model migration first, then authors rules against the new shape. Phase 6 deploys those rules. The reverse ordering would force rules to be written twice. |
| Hosting cutover before any real CSP work (Pitfalls 14, 15, 16) | Honoured | Phase 3 (Firebase Hosting + report-only CSP) precedes Phase 10 (CSP enforced + tightened). The intermediate phases inherit Phase 3's HTTP-header capability without doing CSP work themselves. |

---

*Roadmap defined: 2026-05-03*
*Last updated: 2026-05-08 â€” Phase 5 complete (6/6 plans + verifier + cutover); Phase 6 unblocked*
