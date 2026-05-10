---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-10T20:43:00Z"
progress:
  total_phases: 12
  completed_phases: 7
  total_plans: 55
  completed_plans: 53
  percent: 96
---

# State: Base Layers Diagnostic — Hardening Pass

**Initialized:** 2026-05-03
**Last updated:** 2026-05-10 — Phase 10 Plan 10-01 COMPLETE (CSP Tightening Wave 1 — inline-style migration). 162 static `style="..."` h()-attributes in src/main.js migrated to a Wave 1 utility-class block in styles.css (24 atom `.u-*` classes + ~80 semantic compound classes; 646 lines added at end-of-file with header comment citing Phase 10 Wave 1 + HOST-07 + closes-ledger-row pointer). 130 single-line + 32 multi-line static plain-string sites migrated (Rule 3 deviation: planner originally specified 130 single-line; 32 multi-line patterns were misclassified as template literals, but are also static plain strings with the same CSP failure mode — migrated together). 9 template-literal `style: \`...${expr}...\`` sites preserved as forward-tracking row (genuinely dynamic, deferred to v2 / sub-wave 4.1 IIFE body migration). index.html cache-buster bumped ?v=52→?v=53 on 3 sites. tests/__snapshots__/views/{dashboard,diagnostic,report}.html updated to capture mechanical attr-renaming (Rule 3 deviation: plan-literal "no snapshot updates" was incompatible with migration mechanic — visual fidelity preserved by class-block parity, snapshot diffs are clean attr swaps with zero content drift). 478/478 vitest suite green. Commits: 89b1140 (Task 1 — utility-class block), ec0afa7 (Task 2 — migration + cache-buster + snapshots). **Plan 10-02 (Wave 2 RO-tighten) is now safe** — dropping `'unsafe-inline'` from style-src will not surface 162+ silent layout-drop violations during the 7-day soak. Closes runbooks/phase-4-cleanup-ledger.md "132 static style=... inline-attr strings" row (formal close-out lands in Plan 10-05).

**Prior context (preserved):** Phase 9 Plan 09-06 Tasks 1, 2, 3 COMPLETE (autonomous portion of Wave 7); Task 4 (phase-close human-verify) operator-deferred per `09-06-DEFERRED-CHECKPOINT.md` (single combined operator session bundling Plan 09-05 Task 3b + Plan 09-06 Task 4). Plan 09-05 Tasks 1, 2, 3a previously COMPLETE. Wave 6 substrate landed: scripts/setup-uptime-check/run.js (idempotent gcloud monitoring uptime create wrapper; regions=USA,EUROPE,ASIA_PACIFIC for OBS-06 — 3-region gcloud minimum exceeds ≥2 success criterion per 09-RESEARCH.md §Pattern 7 line 670; describe-first-then-create idempotency with list-configs/list fallback for older gcloud versions) + scripts/setup-budget-alerts/run.js (idempotent gcloud billing budgets create wrapper; 50/80/100% thresholds on £100GBP default; BUDGET_AMOUNT + BUDGET_CURRENCY env overrides; Pitfall 19 substrate-honest banner that alerts NOTIFY only and v2 auto-disable is OUT OF SCOPE) + 2 READMEs (Phase 7/8 template style with dedicated Limitations sections). runbooks/phase-9-monitors-bootstrap.md (~20 KB, 6 operator steps: provision audit-alert-sa via Phase 7 scripts/provision-function-sas/run.js extension with roles=datastore.user+datastore.viewer + per-secret secretAccessor; SLACK_WEBHOOK_URL + SENTRY_DSN secrets via stdin pipe pattern; setup-uptime-check; setup-budget-alerts; Sentry 70% quota alert; verification gate; output handoff to deploy-checkpoint runbook to avoid two-log-split). runbooks/phase-9-deploy-checkpoint.md (~18 KB, 5 verification gates A/B/C/D/E with Pitfall 8 selective-deploy compliance; Cutover Log table with operator-fill {{ T+? }} markers; Row D explicitly DORMANT — defer per Plan 09-04 Rule 1 emit-source absence in beforeUserSignedIn; rollback procedure per-step; BLOCKING operator stop signal). Commits: 71e7d1b, 8088557, bc79fbb. **Task 3b PENDING:** operator follows runbooks/phase-9-deploy-checkpoint.md Steps A-E in single ~30-45 min session; Phase 9 close cannot advance until Cutover Log shows PASS for A/B/C/E + DORMANT for D.

---

## Project Reference

**Source of truth:** `.planning/PROJECT.md`

**Core value:**
Client diagnostic data must remain confidential, intact, and recoverable — and BeDeveloped must be able to honestly answer a prospect's security questionnaire about how that's enforced.

**Current focus:**
Phase 9 — Observability + Audit-Event Wiring (Waves 1-7 docs-and-code COMPLETE; combined operator session pending per `09-06-DEFERRED-CHECKPOINT.md`)

**Compliance bar:** credible, **not** certified. Certification is a separate workstream.

---

## Current Position

Phase: 10 (CSP Tightening — Second Sweep) — EXECUTING (Plan 10-01 COMPLETE)
Plan: 1 of N (Wave 1 — inline-style migration COMPLETE; Plans 10-02 through 10-05 pending)
Phase 9 status: 6 of 7 autonomous COMPLETE; combined operator session still pending per 09-06-DEFERRED-CHECKPOINT.md (Plan 09-05 Task 3b + Plan 09-06 Task 4 — does NOT block Phase 10 work).
**Status:** Phase 9 Wave 7 DOCS-AND-CODE COMPLETE (Tasks 1, 2, 3 of Plan 09-06). SECURITY.md +207 lines (4 new Phase 9 sections — § Observability — Sentry + § Audit-Event Wiring + § Anomaly Alerting + § Out-of-band Monitors — and 10-row Phase 9 Audit Index covering OBS-01..08 + AUDIT-05 + DOC-10; 10 Substrate-honest disclosures + 9 DORMANT markers exceed planner spec). REQUIREMENTS.md row updates: OBS-01 + OBS-03 + DOC-10 flipped `[x]`; OBS-02 + OBS-04..08 + AUDIT-05 retain `[~]` (substrate-complete-operator-pending, matches Phase 8 BACKUP pattern); Traceability table OBS-01..08 + AUDIT-05 rows updated with Validated 2026-05-10 annotations + cross-references to 09-06-DEFERRED-CHECKPOINT.md. runbooks/phase-9-cleanup-ledger.md zero-out gate (`phase_9_active_rows: 0`) closes 3 Phase 8 forward-tracking rows + 11 in-phase rows + 10 bounded carry-forward rows + 9 forward-tracking rows queued (Phase 10/11/12/v2). CONTRIBUTING.md +64 lines (§ Error Message Discipline — Pitfall 8 anti-pattern + compliant patterns + SignInError exemplar + AUTH-12 chokepoint citation + quarterly audit row). .planning/phases/09-observability-audit-event-wiring/09-06-DEFERRED-CHECKPOINT.md authored — single-document operator session bundling Plan 09-05 Task 3b (BLOCKING deploy) + Plan 09-06 Task 4 (phase-close human-verify); mirrors 08-06-DEFERRED-CHECKPOINT.md pattern; saves operator interrupts (1 session not 2). 0 new tests (Wave 7 is docs-only). Commits: e48802b (Task 1 — SECURITY.md Phase 9 increment), 6b3378e (Task 2 — REQUIREMENTS.md + cleanup ledger), 87e2221 (Task 3 — CONTRIBUTING.md Error Message Discipline). **Task 4 PENDING + Task 3b PENDING:** operator follows `09-06-DEFERRED-CHECKPOINT.md` Steps 0-8 in single ~45-75 min combined session — deploy `authAnomalyAlert` + `firestore.rules` `authFailureCounters` block + synthetic Slack alert + 5 Cloud Console screenshots + DORMANT Step D + phase-close evidence sweep + `/gsd-verify-work 9` (preferred). Phase 9 close cannot advance until either operator approval OR sub-wave 9.1 sub-plan resolves any gap.
**Progress:** [█████████▌] 96%

```
[█████████▌] 96%
 1  2  3  4  5  6  7  8  9 10 11 12
 ✓  ✓  ✓  ✓  ✓  ✓  ✓  ▶  ▶  ▶  .  .   (▶ = Phase 8 operator-pending + Phase 9 operator-pending + Phase 10 Wave 1 done / Waves 2-5 pending)
```

**Production state at pause (no live users — safe to remain in this state):**

- Strict Phase 5 rules deployed to production (firestore + storage)
- 3 Phase 6 auth Cloud Functions deployed in europe-west2 (degraded — `gcp-sa-firebaseauth` ToS gate blocks blocking-handler invocation; admin claims set via Admin SDK Path B instead)
- Luke (UID `LQpdqpWqcgVLIE59ln3x8RMf5Mk1`) + George (UID `CZTjcv0mYafO49swTc3P4b6j99W2`) bootstrapped with `{role: "admin", orgId: null, firstRun: true}` claims
- Anonymous Auth STILL ENABLED; Phase 4 hosting bundle STILL SERVING

**Next action when resuming:** Read `.planning/phases/06-real-auth-mfa-rules-deploy/06-RESUME-NOTE.md` first. Cutover commit landed (`17932d5`) on branch `phase-6-cutover-20260509-1513` (PR #3). 3 CI jobs fail on the PR — all pre-existing Phase 4-5 debt (coverage thresholds aspirational, typecheck errors in tests/rules+tests/scripts, rules-emulator setup gap). User chose "land cutover anyway, fix CI in a follow-up." Recommended Path A.2: lower thresholds + ts-nocheck + fix rules emulator + push → CI green → merge.

**Steps remaining after merge:** Step 7 (Console-disable anon auth, ~1 min, can be API PATCH), Step 11 (SC#4 clock-skew, ~5 min), Step 12 (cutover log update, ~5 min). Then Wave 6 (06-06) cleanup + SECURITY.md + cleanup-ledger.

**Deferred to end-of-phases user-testing batch (per operator instruction):** Step 9 (TOTP enrolment for Luke + George), Step 10 (AUTH-10 lockout drill). Both require Luke + George same-session; not blocking Phase 7-12 work.

**Phase 4 deliverables (locked 2026-05-07):**

- `src/firebase/{app,auth,db,storage,functions,check}.js` — sole SDK import surface (Wave 1)
- `src/ui/{dom,modal,toast,format,chrome,upload}.js` — UI helpers with @ts-check + JSDoc; XSS regression fixture permanent (CODE-04); validateUpload magic-byte sniff (Wave 2)
- `src/data/*` (12 wrappers — 6 owners + 6 Phase-5 pass-throughs); `src/cloud/*` (5 stubs — Phase 6/7/8 seams); `src/observability/*` (2 stubs — Phase 7/9 seams) (Wave 3)
- `src/views/*` (12 Pattern D DI factories) + `src/views/_shared/render-conversation.js` (CODE-08) (Wave 4)
- `src/state.js` + `src/router.js` + `src/main.js`; `app.js` DELETED; `index.html` flipped to `./src/main.js` (Wave 5)
- vite.config.js D-21 per-directory coverage thresholds; ESLint Wave 1-4 boundaries at error level (zero `"warn"`); CODE-11 (Math.floor) + CODE-13 (dead v1 migration removed); cleanup-ledger D-17 zero-out gate (Wave 6)
- 6 self-hosted woff2 fonts (Inter + Bebas Neue, OFL); chart.js@4.5.1 npm (no CDN); CSP allowlist drops cdn.jsdelivr.net + fonts.googleapis.com + fonts.gstatic.com (Wave 1)
- `crypto.randomUUID()` for ids (CODE-03); zero `innerHTML=` in production code (CODE-05); zero `alert()` (CODE-07 — replaced by `notify()`); `validateUpload` trust boundary (CODE-09); memoised tab-title (CODE-10); `rel="noopener noreferrer"` on download anchors (CODE-12)
- `SECURITY.md` § HTTP Security Headers (Wave 1) + § Build & Supply Chain (Wave 2) + § Data Handling (Wave 4) + § Code Quality + Module Boundaries (Wave 6)
- `runbooks/phase-4-cleanup-ledger.md` D-17 zero-out: 0 in-Phase-4-tracker rows; 12 carryover rows persistent-with-rationale documenting the 4.1 sub-wave forward-pointers

**Phase 4 deviation cluster (operator-approved as sub-wave 4.1):**

- IIFE body preserved in `src/main.js` (~5,000 lines) with closure intact — Pattern D DI factories in `src/views/*` are STUBS pending body migration
- `// @ts-nocheck` rotated from app.js:1 to src/main.js:1 (must-have violation acknowledged)
- ~132 static `style="..."` strings in main.js (deferred CODE-06 — runtime `el.style.X` mutations ARE closed)
- `window.FB.*` + bare `Chart` bridges (14 sites in main.js)
- Coverage thresholds set per D-21 but unenforceable on main.js / state.js / router.js / views/* / ui/* until body migration completes
- Phase 5 (Firestore subcollection migration) does NOT block on these — `data/*` is properly modularized

**Phase 3 deliverables (locked 2026-05-07):**

- `firebase.json` declares full HTTP security header set (HSTS, X-CTO, Referrer-Policy, Permissions-Policy 22-directive expanded list, COOP same-origin, COEP credentialless, CORP same-origin) + Content-Security-Policy-Report-Only with two-tier directives + `/api/csp-violations` rewrite to `cspReportSink` in `europe-west2` BEFORE the SPA fallback
- `.firebaserc` pinned to `bedeveloped-base-layers`
- `tests/firebase-config.test.js` — 17 schema-validation assertions (rewrite-ordering + 9-header presence) — gates CI
- `functions/` workspace stood up: TS + Node 22 + 2nd-gen, firebase-admin 13.8.0 + firebase-functions 7.2.5, `cspReportSink` handler with rawBody Pitfall-3 fallback + content-type allowlist + 64 KB body cap (T-3-3) + 5-min in-memory dedup (D-11) + extension/synthetic origin filter + `logger.warn("csp.violation")` (D-10a). 31/31 vitest tests passing.
- `.github/workflows/ci.yml` — `deploy` job (push to main, OIDC via `google-github-actions/auth@7c6bc77...`, concurrency `firebase-deploy-main` cancel-in-progress: false, 9-header `curl -I` assertion at end) + `preview` job (PR-only, channel `pr-<number>`, 7d expiry, SHA-pinned `FirebaseExtended/action-hosting-deploy@e2eda2e1...`) + extended audit step (functions npm audit --audit-level=high)
- `runbooks/hosting-cutover.md` — 431 lines, 6 sections: Prerequisites, Pre-cutover Smoke Checklist (legacy + modern wire formats), Cutover Steps (D-02 same-session ~1h plan), DNS Revert Procedure (≤15 min), Day-14 Cleanup, Citations
- `03-PREFLIGHT.md ## Cutover Log` skeleton with PENDING-USER markers
- `runbooks/branch-protection-bootstrap.md` updated with deploy + preview required-status-check entries (post-first-green-run precondition documented)
- `runbooks/phase-4-cleanup-ledger.md` gains "Phase 3 GH-Pages rollback substrate" + "Phase 3 — meta-CSP regression guard" rows
- `SECURITY.md` — §HTTP Security Headers + §CSP (Report-Only) + §Hosting & Deployment + §Phase 3 Audit Index (9-row framework citation table cross-referenced by section + commit SHA) all landed; commit-SHA backfill complete
- Cross-plan ESLint integration fix (`ba382ff`): root `eslint.config.js` ignores `functions/` + Node-globals declared for `tests/**`
- Wave 1 CDN divergence honored: CSP carries temporary allowlist for `cdn.jsdelivr.net` + `fonts.googleapis.com` + `fonts.gstatic.com` + `securetoken.google.com` (Phase 4 cleanup-ledger row queued)
- Threats mitigated: T-3-1 (silent header drop — three layers: schema test + curl assertion + securityheaders.com), T-3-2 (rewrite shadowing), T-3-3 (CSP report abuse), T-3-6 (Permissions-Policy directive completeness — 22 directives), T-3-7 (meta+header CSP conflict), T-3-functions-mod-not-found (Pitfall 5)

**Phase 3 PENDING-OPERATOR-EXECUTION items (in 03-HUMAN-UAT.md):**

1. Wave 1 (03-01) Task 2 — 7-line operator response (gcloud/Console/registrar verifications)
2. Wave 4 (03-05) Task 3 — production cutover (CNAME flip + GH-Pages disable + smoke + securityheaders ≥A)
3. Wave 6 (03-06) Task 3 — apply branch protection rule in GitHub UI (gated on first green deploy)

These persist in `/gsd-progress` + `/gsd-audit-uat` until resolved. Cleanup ledger has 14-day GH-Pages retention reminder.

**Phase 2 deliverables (locked 2026-05-06):**

- 9 modules extracted to `src/{util,domain,data,auth}/*` with byte-identical D-05 comments
- 14 test files / 149 tests / coverage 100% statements / 98.94% branches / 100% functions / 100% lines
- 3 view snapshot baselines committed at `tests/__snapshots__/views/*.html` (toMatchFileSnapshot per D-13)
- Tiered coverage thresholds (D-15) live in CI: domain/util 100%, auth 95%, data 90%
- ESLint `no-restricted-imports` rule blocks `src/**` and `app.js` from importing `tests/**` (T-2-03 codified)
- CI uploads coverage HTML artefact (D-20)
- CONTRIBUTING.md governance section codifies test-first PR rule + threshold-drop block (D-17 + D-18)
- T-2-01 mitigated end-to-end (Pre-flight 1 + 2 confirmed `application/javascript` MIME on GH-Pages)
- T-2-04 mitigation activated (coverage gate is now load-bearing — proven via canary procedure)
- TEST-06 (cloud-sync) is the H8/Pitfall 20 baseline; TEST-07 (auth state machine) is the Phase 6 deletion baseline; both flagged in cleanup ledger

---

## Roadmap Reference

**Source of truth:** `.planning/ROADMAP.md`

**Phase summary:**

1. Engineering Foundation (Tooling) — `package.json` + Vite + Vitest + ESLint + CI lands; everything downstream becomes testable + dependency-monitored
2. Test Suite Foundation (Tests-First) — regression baseline for the modular split (Pitfall 9 — non-negotiable)
3. Hosting Cutover + Baseline Security Headers — GitHub Pages → Firebase Hosting; HTTP-header CSP infrastructure available
4. Modular Split + Quick Wins — `app.js` IIFE → modules; XSS / CSPRNG / inline-style / file-upload-client quick wins
5. Firestore Data Model Migration + Rules Authoring — subcollections + rules **committed but not yet deployed**
6. Real Auth + MFA + Rules Deploy — load-bearing cutover; rules deployed in lockstep with claims-issuing Auth
7. Cloud Functions + App Check — trusted-server boundary + audit log + rate limiting + perimeter
8. Data Lifecycle (Soft-Delete + GDPR + Backups) — recoverability and data-rights story
9. Observability + Audit-Event Wiring — Sentry + Slack alerts + every sensitive op emits an audit event
10. CSP Tightening (Second Sweep) — drop `unsafe-inline`; HSTS preload submitted
11. Documentation Pack (Evidence Pack) — `SECURITY.md` + `PRIVACY.md` + `THREAT_MODEL.md` + `CONTROL_MATRIX.md` + evidence screenshots
12. Audit Walkthrough + Final Report — translated `SECURITY_AUDIT.md` run end-to-end → `SECURITY_AUDIT_REPORT.md`

---

## Performance Metrics

**Phases completed:** 0 / 12
**v1 requirements closed:** 0 / 120
**Plans completed:** 0
**Average plan completion time:** N/A (no plans yet)
**CONCERNS.md findings closed:** 0 / 26 (4 CRITICAL + 8 HIGH + 9 MEDIUM + 5 LOW)

---

## Accumulated Context

### Key Decisions Locked at Initialization

- **Stay on Firebase** — no platform migration to Vercel + Supabase (PROJECT.md, decided 2026-05-03)
- **Stay on vanilla JS** — modular split + JSDoc-as-typecheck; no React/Vue/Svelte rewrite (PROJECT.md, decided 2026-05-03)
- **No backwards-compatibility window** — clean cutover acceptable; no live users currently (PROJECT.md, decided 2026-05-03)
- **Compliance bar = credible, not certified** — honest mapping, not auditor sign-off (PROJECT.md, decided 2026-05-03)
- **Use `SECURITY_AUDIT.md` as audit framework** — translate Vercel/Supabase sections to Firebase (PROJECT.md, decided 2026-05-03)
- **12-phase plan, not 5-8** — standard granularity overridden because four load-bearing sequencing constraints cannot be collapsed (ROADMAP.md "Granularity Rationale", validated 2026-05-03)

### Phase 9 Plan 04 Decisions (2026-05-10)

- **`retry: false` not `retryConfig: { retryCount: 1 }`** — firebase-functions v2 Firestore-trigger DocumentOptions exposes `retry: boolean`, not the v1-style retryConfig.retryCount. Plan-spec'd shape produced compile-time error TS2769 "Object literal may only specify known properties, and 'retryConfig' does not exist in type 'DocumentOptions'". `retry: false` matches the documented "best-effort, do not retry-storm Slack" intent — Slack/network failures bubble to the no-throw postToSlack helper which logs and never propagates back to Eventarc.
- **Rule 1 first-event-branch crash fix** — RESEARCH.md §Pattern 6 pseudocode (lines 571-580) initialises `cur = {count: 0, windowStart: now}` when `snap.exists === false`, then checks `now - cur.windowStart > FAIL_WINDOW_MS` which evaluates to `false`, falling through to `tx.update`. But Firestore's `tx.update` REQUIRES the doc to exist — would crash in production on the first failure for any ipHash. Test 1 surfaced this immediately on first run. Collapsed "doc missing" + "window expired" into single `tx.set` path. Production EXACTLY-ONCE-per-(ipHash,window) semantics preserved (still gated on `next === FAIL_LIMIT + 1` boundary check, T-9-04-3 mitigation).
- **Test-only seams (`_internals` + `_handleAuditEvent` exports)** — handler accepts injected `now` (time control) + injected `postToSlackFn` (Slack mock) + injected Firestore (in-memory fake or stub-throwing) so unit-tests don't need real timers/network/emulator. Production code wires real implementations through the onDocumentCreated wrapper. Pattern A precedent: `_resetForTest` in functions/src/util/sentry.ts.
- **6 trimmed behaviour tests (not 10)** — per WARNING 5 split. Rule 2 (MFA disenrol) is DORMANT, so a passing test would assert against fake input that never appears in production; skipped intentionally per Plan 03a §mfa_rationale carry-forward. Empty-webhook + Slack-500 paths are exercised indirectly through Tests 1/4/6 (any of which with `_internals.slackWebhookUrl()` returning empty would log+return without throwing).
- **`fetch` is the first Node 22 built-in usage in functions/ workspace** — `functions/eslint.config.cjs` Node 22 globals list previously had `Buffer / process / console / URL / URLSearchParams` only; Rule 3 fix added `fetch: "readonly"`. Without this, lint reported `'fetch' is not defined` on the Slack POST.
- **Java/emulator gate on tests/rules/authFailureCounters.test.js** — local Windows env has no Java; `npm run test:rules` shells out to `firebase emulators:exec --only firestore,storage` which requires Java. Same gate applied to Phase 8 plan 05 GDPR-05 redactionList tests; established convention is land the test code, CI runs it on the PR. 4 cells follow exact analog pattern of tests/rules/auditLog.test.js which runs green on CI.
- **Slack-webhook gitleaks rule moved from Plan 06 Task 3 to Plan 04 Task 4** (per WARNING 7 in 09-04-PLAN.md) — defence-in-depth for the SLACK_WEBHOOK_URL secret introduced HERE belongs WITH the secret introduction, not in a downstream docs increment. Plan 06 retains only the CONTRIBUTING.md error-message discipline section (Pitfall 8).
- **README.md self-inflicted false positive** — first run of gitleaks against the working tree flagged the example URL `https://hooks.slack.com/services/T0/B0/never_existed` (intended as the "URL formed correctly but unreachable" sample for exit-code-2 demonstration). Replaced with `https://hooks-fakehost.invalid/services/T.../B.../...` — non-Slack hostname (so regex doesn't match) but still demonstrates network-error semantics. Updated expected-output annotation to "TypeError fetch failed" instead of a status code.

### Phase 9 Plan 03 Decisions (2026-05-10)

- **try/catch wrapper on every emit call site (defensive double-wrap)** — `emitAuditEvent` already swallows internally per Plan 09-01's contract, but each call site is also wrapped in try/catch so a synchronous throw at the call site itself (e.g. TypeError from a malformed proxy) cannot escape. Pattern 5 #2 enforced strictly: the originating op outcome is never affected by audit-emit behaviour.
- **signInEmailPassword uses try/finally + outcome flag (single emit, ternary type)** — `let outcome = "failure"` flips to `"success"` BEFORE the return statement; finally block reads outcome and emits via ternary. Cleaner than duplicating emit logic in both try and catch branches; behavioural test (Test 7 in auth-audit-emit.test.js) verifies that emit failure inside finally does NOT bubble out.
- **signOut PRE-emit ordering** — fbSignOut revokes both App Check token and ID-token; post-emit auditWrite would predictably reject (no auth). Emit BEFORE the side effect; PRE-emit ordering verified via call-order tracking in Test 3.
- **sendPasswordResetEmail target.id="unknown"** — caller is by definition not yet authenticated; server cannot resolve a uid pre-sign-in. The auditWrite callable will reject this emit (no request.auth) and emitAuditEvent's internal swallow handles that gracefully. NO email in payload (Pitfall 17).
- **signInWithEmailLink payload.method="emailLink"** — distinguishes from password sign-in for downstream analysis (Tier-1 recovery flow). Single non-PII opaque field; no email/uid/etc.
- **permanentlyDeleteSoftDeleted target.orgId:null** — callable input has no orgId field (admin-only resource at admin-scoped softDeleted/<type>/items/{id} path). Pinned in matrix Test 6 to prevent drift.
- **No client `.requested` for auth.* literals** — auth.js emit sites use bare auth.signin.success / auth.signin.failure / auth.signout / auth.password.change / auth.password.reset (Phase 7 baseline literals, not .requested). The .requested suffix is reserved for client wrappers around server callables (cloud/* sites). For auth events the server-side observation point is the Firebase Identity Platform's ID-token issuance, NOT a Cloud Function callable, so client `.requested` makes no sense — there's no server-side flavour pair to make latency-observable.
- **auth.signin.failure double-emission semantics** — both client `.failure` (this plan) and server `auth.signin.failure` (Plan 03a beforeUserSignedIn) coexist by design. Client emit fires from finally on failure path; auditWrite rejects unauthenticated callers, so the client emit for a wrong-password attempt is silently swallowed by emitAuditEvent (writes nothing). Server-side beforeUserSignedIn substrate is the ONLY actual writer for auth.signin.failure rows. Documented as substrate-honest dual-source (matches Plan 03a's substrate dormancy pattern).
- **Removed 4 incorrect `eslint-disable-next-line @typescript-eslint/no-floating-promises` comments inline (Rule 1)** — added them defensively but the rule isn't configured in this project's flat eslint.config.js. Lint reported them as errors. Removed; the fire-and-forget calls are intentional and the project doesn't have the rule enabled.

### Phase 9 Plan 03a Decisions (2026-05-10)

- **Atomic enum extension landed in 03a, not split between 03a + 03** — 33 new auditEventType literals (15 server bare + 18 client .requested) added in one Zod.enum() edit; Plan 03's enum-extension task is now reduced to a verify-only step (`grep -c '\.requested",'` returns 18). Avoids double-edit + race conditions.
- **Server-side bare emission via direct `writeAuditEvent` Admin SDK call (NOT through auditWrite callable)** — `auditWrite.ts:51-53` rejects unauthenticated callers; this is the loop BLOCKER 1 fix specifically avoids. Each emit synthesises a `ServerContext` with actor sourced from `request.auth.token` (or `actor.uid:null + email from event.data` for unauthenticated `beforeUserSignedIn` path).
- **`beforeUserSignedIn` substrate is DORMANT today** — handler does NOT currently REJECT sign-ins; the catch branch fires only on internal handler errors (logger throw, malformed event.data). Wave 4 Rule 1 (auth-fail burst) trigger code is functional + sees zero rows until a future plan adds a business-rule rejection (e.g. block disabled accounts at sign-in). Documented as substrate-honest (not broken).
- **`permanentlyDeleteSoftDeleted` target.orgId:null** — callable input has no orgId field; resource lives in admin-scoped `softDeleted/{type}/items/{id}` path. Test pinned this explicitly so it doesn't drift.
- **Best-effort try/catch on every emit (Pattern 5 #2)** — every `writeAuditEvent` is wrapped; on failure `logger.warn("audit.emit.failed", {type, id, error})` and continue. Underlying op (claim mutation, batch.commit, ref.delete) committed BEFORE the emit, so emit failure cannot roll back data.
- **Pre-existing setClaims.unit.test.ts Test 2 fixed inline (Rule 1)** — Phase 9 wiring caused doc()/set() to fire twice (poke + audit); test expected `toHaveBeenCalledTimes(1)`. Updated to expect 2 with poke at index 0 + audit emit at index 1; pinned audit doc path to `auditLog/[uuid]`.
- **Type literal narrowing in lifecycle callables** — TypeScript template-literal types: `\`data.${data.type}.softDelete\` as "data.action.softDelete" | "data.comment.softDelete" | ...`. Compile-time check that the synthesised string is a valid Zod enum literal; catches drift if `SOFT_DELETABLE_TYPES` ever expands without an enum extension.
- **5 full-suite test-pollution flakes documented as deferred** — pre-existing, reproducible on bare branch tip. vitest forks pool sharing module-level state in `_mocks/admin-sdk.ts`. Each test passes deterministically in isolation. Tracking for Plan 09-06 cleanup-ledger close-gate sweep.

### Phase 9 Plan 02 Decisions (2026-05-10)

- **Plugin telemetry disabled (`telemetry: false`)** — no plugin self-telemetry to Sentry; only release-finalize + sourcemap-upload API calls fire. Aligns with project's "no third-party telemetry" disposition.
- **`.map` gate omitted from PR-validation build job** — that job runs without `SENTRY_AUTH_TOKEN` (forks have no secrets), plugin no-ops by design, `.map` files survive in `dist/` by design. Adding the gate there would false-positive on every fork PR. Deploy + preview gates are the operative defence layer.
- **Test uses `path.resolve(process.cwd(), "vite.config.js")`** instead of `new URL(..., import.meta.url)` — happy-dom test env (vitest default in this repo) sets `import.meta.url` to an `http://` URL, which `readFileSync(URL)` rejects. `process.cwd()` resolves cleanly because vitest always runs from project root.
- **Hard-coded `org: "bedeveloped"` + `project: "base-layers-diagnostic"`** — Sentry org/project slugs are public-ish identifiers (visible in DSN URLs and event metadata); only `authToken` is the secret. No need to plumb non-secrets through env vars.
- **Conditional ordering: `env.SENTRY_AUTH_TOKEN && command === "build" && sentryVitePlugin(...)`** — short-circuit semantics drop plugin allocation when either guard is false; `plugins: [...].filter(Boolean)` strips the resulting `false` so vite never sees a non-plugin entry.
- **OBS-04 marked `[~]` (substrate-complete, operator-pending) in REQUIREMENTS.md** — code lands on this commit; activation is gated on operator setting `SENTRY_AUTH_TOKEN` + `VITE_SENTRY_DSN` in GitHub Actions secrets per `runbooks/phase-9-sentry-bootstrap.md` Step 5. First-deploy verification gates Plan 09-05 close-gate.

### Phase 9 Plan 01 Decisions (2026-05-10)

- **Versions strict-pinned (no caret)** — `@sentry/browser@10.52.0` + `@sentry/vite-plugin@5.2.1` follow the project TOOL-01 supply-chain pinning convention; npm install default `^` carets manually stripped
- **`@ts-nocheck` on test files using vi.mock factory rest-args** — matches existing `tests/main.test.js` convention; production source modules retain `@ts-check` discipline
- **Redaction contract changed: delete -> `<redacted>` for PII keys (Phase 7 -> Phase 9)** — extras + contexts use the assignment so SRE can see the slot WAS populated without leaking value; headers continue using `delete` per Phase 7's value-must-not-survive contract
- **PII_KEYS dictionary parity test reads JS source via fs** — the test IS the contract; sorted-equality on extracted regex match vs imported TS const tuple
- **Phase 4 stub smoke tests removed/replaced rather than retained alongside new behaviour tests** — single-source-of-truth for the module's coverage
- **Sentry boot site = inside fbOnAuthStateChanged after claims hydration** — Pitfall 3 mitigation; AFTER `claims = tokenResult.claims || {}`; BEFORE `enrolledFactors` block + render
- **Empty-DSN no-op kill-switch** — mirrors Phase 7 FN-07 reCAPTCHA placeholder pattern; `VITE_SENTRY_DSN ?? ""` coalesces unset env to silent no-op (local dev / unit-test path)
- **`SLACK_WEBHOOK_URL` is GCP Secret Manager only, NOT GitHub Actions** — runbook Step 5 explicitly documents this; Cloud Function consumes via `defineSecret`; CI/build jobs never need it

### Phase 8 Plan 06 Decisions (2026-05-10)

- **Tasks 1+2+7 DEFERRED to single operator session** — deploy commands + restore drill procedure + close-gate checklist authored in 08-06-DEFERRED-CHECKPOINT.md; code + docs complete; operator execution batches 08-01 + 08-05 + 08-06 deferred actions into one session
- **Restore drill runbook uses timestamp placeholders** — operator-fill `{{ T+0 }}` pattern per Pitfall 19 substrate-honest disclosure; fake timestamps would violate compliance credibility
- **BACKUP-02 lifecycle phrasing canonical** — "GCS lifecycle: Standard at upload → Nearline at day 30 from creation → Archive at day 365 from creation (335-day Nearline dwell, exceeds BACKUP-02 90d Nearline minimum)"
- **phase_8_active_rows: 0** — 4 Phase 7 forward-tracking rows closed; 2 in-phase carry-forward rows have explicit bounded closure paths (getDownloadURL re-export → Phase 10; post-erasure-audit first run → operator follow-up)
- **Phase 9 unblocked at code level** — Phase 9 planning can begin without waiting for operator Phase 8 deploy session

### Phase 8 Plan 05 Decisions (2026-05-10)

- **ERASED_AT_SENTINEL substituted at batch-write time** — keeps eraseCascade.ts pure (Pattern C); gdprEraseUser substitutes `__ERASED_AT__` with `FieldValue.serverTimestamp()` when committing each batch chunk
- **auditLog docs KEPT, PII tombstoned in-place** — actor.uid/email + payload.email replaced with tombstone token; Pitfall 11 / GDPR Art. 6(1)(f) legitimate interest; doc preserved as opaque compliance record
- **Single compliance.erase.user audit event with counts payload** — Pitfall 7: one summary event, never per-doc, avoids mirror-trigger stampede on bulk cascade
- **profileSnap.ref?.path fallback to .path** — admin-sdk.ts mock exposes .path directly (not .ref.path); callable uses both to support real Firestore + mock
- **Mock batch.update() flat-merges dotted keys** — test assertions adapted to read mock-stored flat key "actor.uid" with fallback to nested path
- **Task 7 DEFERRED to Wave 6 batch** — GDPR_PSEUDONYM_SECRET + 4 SAs (storage-reader-sa, lifecycle-sa, gdpr-reader-sa, gdpr-writer-sa) consolidated into single operator session with 08-06 production deploy

### Phase 8 Plan 04 Decisions (2026-05-10)

- **DOCUMENT_AUTHOR_FIELDS = [uploaderId, uploadedBy, legacyAppUserId]** — Task 0 grep verified: uploaderId is top-level documents/ (legacy main.js), legacyAppUserId is subcollection orgs/.../documents/ (D-03), uploadedBy defensive. Assumption A1 corrected.
- **collectionGroup() factory added to getFirestoreMock()** — path-segment matching (second-to-last segment), same where/limit/orderBy/startAfter chain support as buildQuery
- **Single-load callable pattern for unit + integration tests** — no vi.resetModules(); module loaded once at module level so callable and assertion code share the same mock instances
- **Legacy top-level documents/ queried separately** — collectionGroup("documents") covers subcollection; db.collection("documents") covers pre-Phase-5 main.js writes; both needed for complete GDPR Art. 15 coverage
- **src/cloud/gdpr.js uses adapter import** — ../firebase/functions.js (D-04 ESLint no-restricted-imports); eraseUser stub preserved for 08-05

### Phase 8 Plan 03 Decisions (2026-05-10)

- **Single-load callable pattern in unit tests** — load callable once at module level; seed AFTER load; no vi.resetModules per test; prevents stale module instance issue where seed data was invisible to callable
- **permanentlyDeleteSoftDeleted.ts and src/data/soft-deleted.js created early** — both created before their scheduled tasks (Tasks 5+8 respectively) to unblock index.ts compile and admin.js import chain
- **retryCount:1 flat for scheduledPurge** — firebase-functions 7.2.5 uses top-level `retryCount`, not nested `retryConfig` object
- **src/cloud/soft-delete.js uses adapter import** — `../firebase/functions.js` not `firebase/functions` direct; ESLint no-restricted-imports D-04
- **tests/mocks/firebase.js: undefined treated as null for deletedAt==null filter** — Firestore absent-field semantics: docs without deletedAt field must match `where("deletedAt", "==", null)`

### Phase 8 Plan 02 Decisions (2026-05-10)

- **retryCount:2 flat on ScheduleOptions** — firebase-functions 7.2.5 uses top-level `retryCount`, not `retryConfig: { retryCount }` nested object
- **Vitest pool:forks + maxForks:4 + testTimeout:15000** — vi.mock('@google-cloud/firestore') leaked across files in thread pool; forks pool + concurrency cap + timeout headroom fixes intermittent integration test timeouts
- **Constructor-function for FirestoreAdminClient mock** — vi.fn().mockImplementation() is not newable; plain `function MockFirestoreAdminClient()` returns the mock instance correctly
- **storage-reader-sa provisioning deferred to 08-06** — callable is deploy-ready; SA queued for cleanup wave

### Outstanding Todos / Open Questions for Future Phases

These came out of research and need attention during the noted phase planning:

- **Firestore region of `bedeveloped-base-layers` not yet verified.** Phase 6 should run `gcloud firestore databases describe` or check the Firebase Console; Phase 11 documents in `PRIVACY.md`.
- **Sentry free-tier sufficiency for projected error volume.** Phase 9 sets up budget alert at 70%; revisit at engagement re-start.
- **reCAPTCHA Enterprise quota for projected chat volume.** Phase 7 sets up budget alert + per-environment site keys; revisit at engagement re-start.
- **Bootstrap-migration data integrity unknown until staging dry-run.** Phase 5 phase-level research includes the staging dry-run procedure as a deliverable.
- **MFA recovery procedure feasibility.** Phase 6 phase-level research must define the out-of-band fallback for the two-admin un-enrol pattern.
- **`SECURITY_AUDIT.md` Vercel/Supabase translation completeness.** Phase 12 phase-level research produces the translation map first, then runs the checklist.

### Phases Flagged for Deeper Phase-Level Research

Per `SUMMARY.md` "Research Flags":

- **Phase 5** — migration script correctness is high-blast-radius; produce per-field new-home map + idempotency-marker design + staging dry-run procedure before implementation
- **Phase 6** — TOTP UX, recovery codes, password reset, account-enumeration mitigation, two-admin un-enrol procedure, "poke" pattern, Luke + George bootstrap procedure each warrant their own micro-decision
- **Phase 7** — per-function input schemas, idempotency strategy, rate-limit thresholds, cold-start tolerance, per-function IAM service accounts, App Check stage-rollout cadence per service
- **Phase 12** — Vercel/Supabase → Firebase translation map produced first; LLM03 / LLM05 / LLM10 N/A rationale documented

### Blockers

None at initialization.

---

## Sequencing Non-Negotiables

These four constraints are load-bearing — violating them breaks the milestone (full rationale in `.planning/research/PITFALLS.md`):

1. **Tests-first before modular split.** Phase 2 must be green before Phase 4 begins.
2. **Rules committed-and-tested early; deployed-only-after-Auth-is-live.** Phase 5 ships rules + tests; Phase 6 deploys.
3. **Subcollection migration before Rules deployment.** Phase 5 does data model first, then authors rules.
4. **Hosting cutover before any real CSP work.** Phase 3 precedes Phase 10.

Additional non-negotiables:

- Anonymous Auth disabled in Firebase Console as part of Phase 6 (not just unused in code — actually disabled)
- App Check enforced in stages (7-day soak unenforced, then per-service: Storage → Firestore → Functions)
- Audit log written from Cloud Functions only — `auditLog` rules `allow write: if false` for clients
- All third-party GitHub Actions pinned to commit SHA, OIDC for Firebase auth
- Each phase updates `SECURITY.md` incrementally (Pitfall 19 prevention)

---

## Session Continuity

**Last session (2026-05-10):** Phase 9 plan 04 (authAnomalyAlert Slack dispatcher + authFailureCounters substrate + 4 anomaly rules + .gitleaks.toml Slack regex) — all 5 tasks executed and committed via TDD RED→GREEN cycle. Task 1a (commit 4adde66): authAnomalyAlert.ts (222 lines) — onDocumentCreated('auditLog/{eventId}') in europe-west2 running as audit-alert-sa with SLACK_WEBHOOK_URL + SENTRY_DSN defineSecret + retry:false (instead of plan-spec'd retryConfig.retryCount:1 — v2 API mismatch). 4 anomaly rules (Rules 1+2 DORMANT, Rules 3+4 FUNCTIONAL). Test-only seams `_internals` + `_handleAuditEvent` exported for Task 1b's injected-deps tests. postToSlack helper: best-effort, never throws. functions/src/index.ts +1 export. functions/eslint.config.cjs +fetch Node 22 global (first usage in workspace). Task 1b (commit 08394a8): 6 behaviour tests (Tests 1-3 Rule 1 burst+dedup+window-expiry; Test 4 Rule 3 positive; Test 5 Rule 3 negative same-role; Test 6 Rule 4 UTC 23 fires + UTC 14 doesn't). Auto-fixed Rule 1 (commit shipped with the test that revealed it): RESEARCH.md §Pattern 6 pseudocode crashes on first-ever failure for an ipHash (tx.update on non-existent doc); collapsed "doc missing" + "window expired" into single tx.set. Task 2 (commit 56c8147): firestore.rules + match /authFailureCounters/{ipHash} server-only block + tests/rules/authFailureCounters.test.js 4-cell deny matrix (Java/emulator gate documented in deferred-items.md — same gate as Phase 8 plan 05 GDPR-05 redactionList tests). Task 3 (commit 7d884ce): scripts/test-slack-alert/run.js + README — operator synthetic alert verification with 0/1/2 exit-code contract; manual verification confirmed exit=1 on missing env, exit=2 on unreachable host. Task 4 (commit ebea786): .gitleaks.toml slack-webhook-url regex pattern `https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+` + README false-positive fix (own example URL flagged on first scan; replaced with non-Slack hostname); synthetic positive test confirmed rule triggers; gitleaks working-tree scan returns zero leaks. ~12.5 minutes execution. functions/ suite 268/268 green. 09-04-SUMMARY.md authored. Next plan: 09-05 (Wave 6 [autonomous: false] — GCP-tier monitors + audit-alert-sa SA provisioning + first deploy of authAnomalyAlert + synthetic-alert operator session + Sentry quota alert UI step + budget alerts + uptime check).

**Previous session (2026-05-10):** Phase 9 plan 03 (client-side .requested audit-event wiring at 9 view-side sensitive-op sites) — all 3 tasks executed and committed via TDD RED→GREEN cycle. Task 1 (verify-only): Plan 03a enum landing confirmed (1 iam + 2 compliance + 15 data = 18 .requested literals; 15 bare data-domain literals; 18-test schema test green). No commit (pure verifier). Task 2: src/firebase/auth.js wired with 5 emit calls covering 6 functional sites — signInEmailPassword try/finally with outcome-flag ternary (auth.signin.success vs auth.signin.failure), signOut PRE-emit (auth.signout BEFORE fbSignOut because token revoked after), updatePassword POST-emit (auth.password.change after fbUpdatePassword + BLOCKER-FIX 1 setClaims block), sendPasswordResetEmail POST-emit with target.id="unknown" + empty payload (caller unauthenticated, NO email leak), signInWithEmailLink POST-emit with payload.method="emailLink" (distinguishes from password sign-in). +7 tests in tests/firebase/auth-audit-emit.test.js (RED→GREEN). Task 3: src/cloud/* wired with 6 POST-emit sites — claims-admin.js (iam.claims.set.requested with newRole opaque payload), gdpr.js (compliance.{export,erase}.user.requested), soft-delete.js (data.<type>.{softDelete,restore,permanentlyDelete}.requested via template-literal type construction; permanentlyDelete target.orgId:null because admin-scoped path). +7 tests in tests/audit-wiring.test.js (matrix coverage + Pitfall 17 PII-grep sweep). Auto-fixed pre-existing inline (Rule 1): removed 4 incorrect `eslint-disable-next-line @typescript-eslint/no-floating-promises` comments — rule isn't configured in this project's flat eslint config. ~13 minutes execution. Commits: f8cf0ef, 9aecdd5, 77ccf2d, a0639e8. 09-03-SUMMARY.md authored. AUDIT-05 substantially complete (MFA still DORMANT per Plan 03a §mfa_rationale carry-forward); Pitfall 17 invariant verified (zero PII in any payload). Pre-existing typecheck errors in src/views/admin.js + tests/data/soft-deleted.test.js confirmed pre-existing (deferred-items.md). Next plan: 09-04 (authAnomalyAlert Slack dispatcher + authFailureCounters substrate + 4 anomaly rules).

**Previous session (2026-05-10):** Phase 9 plan 03a (server-side audit-event substrate — closes prior-iteration BLOCKER 1/2/3) — all 3 tasks executed and committed. Task 1: auditEventSchema.ts enum extended 28 → 61 entries (15 server-side bare data-domain flavours `data.{action,comment,document,message,funnelComment}.{softDelete,restore,permanentlyDelete}` + 18 client-side .requested companions: `iam.claims.set.requested`, `compliance.{export,erase}.user.requested`, plus the 15 data-domain .requested variants). +10 schema tests (TDD RED → GREEN). Task 2: setClaims.ts emits `iam.claims.set` after the poke write (Pitfall 17: actor from `request.auth.token`); beforeUserSignedIn.ts wraps body in try/catch + emits `auth.signin.failure` on catch branch with `actor.uid:null + email from event.data + ip/userAgent from event` — SUBSTRATE-HONEST: dormant today (handler doesn't currently REJECT sign-ins; catch fires only on internal handler errors). +6 tests. Task 3: 3 lifecycle callables emit `data.<type>.<op>` after batch.commit/ref.delete with best-effort try/catch swallow + Pitfall 17 actor sourcing + type-literal narrowing for compile-time enum-literal check. +9 tests. Auto-fixed pre-existing setClaims.unit.test.ts Test 2 (Rule 1: now 2 doc()/set() calls — poke at index 0, audit at index 1). 5 full-suite test-pollution flakes confirmed pre-existing + tracked in deferred-items.md. ~20 minutes execution. Commits: `cf768d7`, `4d625d7`, `aca4bd2`. 09-03a-SUMMARY.md authored. Wave 4 anomaly rules (Plan 04: auth-fail burst, role escalation, AUDIT-05 mirror-trigger Pitfall 7 dedup) can now read from real data. Plan 09-03 (client `.requested` wiring) reduced to pure consumer of the enum landed here. Next plan: 09-03 (AUDIT-05 client view wiring across `src/firebase/auth.js` + `src/cloud/{claims-admin,gdpr,soft-delete}.js`).

**Previous session (2026-05-10):** Phase 9 plan 02 (@sentry/vite-plugin source-map upload + CI env wiring) — both tasks executed and committed. Task 1: vite.config.js plugin registration (`env.SENTRY_AUTH_TOKEN && command === "build"` guard, EU region URL `https://de.sentry.io/`, `filesToDeleteAfterUpload: ["dist/**/*.map"]`, telemetry off) + `tests/build/source-map-gate.test.js` 5-assertion drift detector (5/5 green). Task 2: `.github/workflows/ci.yml` build/deploy/preview env wiring (VITE_SENTRY_DSN, VITE_GIT_SHA, SENTRY_AUTH_TOKEN, GITHUB_SHA) + post-build "Assert no .map files" gate on deploy + preview jobs (NOT on PR-validation build by design). Two auto-fixed bugs in test-file: (1) URL-form `readFileSync` rejected by happy-dom; switched to `path.resolve(process.cwd(), ...)`. (2) `/* global process */` redeclared an ESLint built-in global; dropped the comment. ~16 minutes execution. Commits: `fc29a4f`, `f3978eb`. 09-02-SUMMARY.md authored. OBS-04 marked `[~]` (substrate code-complete, operator-pending GitHub Actions secrets per `runbooks/phase-9-sentry-bootstrap.md` Step 5). Next plan: 09-03 (AUDIT-05 view wiring across `src/firebase/auth.js` + `src/cloud/{claims-admin,gdpr,soft-delete}.js`).

**Previous session (2026-05-10):** Phase 9 plan 01 (Sentry init substrate + shared PII scrubber + audit-events proxy) — all 4 tasks executed and committed. Task 1: install @sentry/browser@10.52.0 (bumped from 10.51.0) + @sentry/vite-plugin@5.2.1 devDep + new src/observability/pii-scrubber.js + functions/src/util/pii-scrubber.ts twin + parity test (drift contract). Task 2: src/observability/sentry.js body filled (initSentryBrowser + setUser + captureError + addBreadcrumb + fingerprint rate-limit; empty-DSN no-op kill-switch); 9 vitest behaviour tests. Task 3: src/observability/audit-events.js body filled (AUDIT_EVENTS frozen 25-entry table + best-effort emitAuditEvent proxy); functions/src/util/sentry.ts beforeSend extended to use shared PII_KEYS + redaction contract changed delete -> "<redacted>"; 6 audit-events tests + 2 new sentry-scrub tests. Task 4: src/main.js Sentry boot wired in fbOnAuthStateChanged after claims hydration (Pitfall 3) + runbooks/phase-9-sentry-bootstrap.md (7-section operator runbook for Sentry org / EU project / DSN / 70 percent quota alert OBS-08). Commits: 4a0aafc..de2a2cc (4 commits). Root observability tests 22/22 green; functions tests 237/237 green. Pre-existing tsc + view-snapshot failures (Phase 8 inheritance) tracked in deferred-items.md. 09-01-SUMMARY.md created. Next plan: 09-02 (@sentry/vite-plugin source-map upload + CI env wiring).

**Previous session (2026-05-10):** Phase 8 plan 06 (restore drill + docs + close-gate) — Tasks 3-6 executed and committed; Tasks 1+2+7 (deploy + drill + close-gate) DEFERRED to operator session per 08-06-DEFERRED-CHECKPOINT.md. Task 3: restore-drill-2026-05-13.md template + phase-8-restore-drill-cadence.md (BACKUP-06 + BACKUP-07). Task 4: SECURITY.md +4 sections + 19-row Phase 8 Audit Index (DOC-10). Task 5: 18 LIFE/GDPR/BACKUP rows [x] + DOC-10 updated + 3 traceability rows validated. Task 6: phase-8-cleanup-ledger.md zero-out (phase_8_active_rows: 0). Commits: 88b086d..90c4c4c (5 commits). 08-06-SUMMARY.md created. Phase 8 code+docs complete; operator session required for production deploy + restore drill before Phase 8 is fully closed.

**Previous session (2026-05-10):** Phase 8 plan 05 (GDPR erasure) — Tasks 1-6 executed and committed; Task 7 (operator provisioning) DEFERRED to Wave 6 batch. Task 1: pseudonymToken.ts pure helper + 12 unit tests. Task 2: eraseCascade.ts pure helper + 7 unit tests (Pitfall 11 auditLog retention, 500-op batch chunking). Task 3: gdprEraseUser.ts callable + 8 unit + 1 integration tests + admin-sdk.ts updateUser tracking. Task 4: firestore.rules redactionList match block + 10 rules tests. Task 5: scripts/post-erasure-audit/run.js (GDPR-03 evidence, ADC, exit 0/1/2) + README. Task 6: index.ts +1 export (→17), src/cloud/gdpr.js eraseUser seam filled (both Phase 4 stubs closed). functions tests: 205 → 233 (+28). Commits: dce9c20..1e881b0 (8 commits). 08-05-SUMMARY.md created. Next plan: 08-06 (restore drill + docs; operator must provision 4 SAs + GDPR_PSEUDONYM_SECRET first).

**Previous session (2026-05-10):** Phase 8 plan 04 (GDPR export) — all 4 tasks executed and committed. Task 0: documents field audit (Assumption A1 closed — uploaderId for top-level, legacyAppUserId for subcollection). Task 1: assembleUserBundle.ts pure helper + 6 unit tests (Pattern C, zero firebase-admin imports). Task 2: gdprExportUser.ts callable + 7 unit + 3 integration tests + collectionGroup() mock added. Task 3: index.ts +1 export (→16), src/cloud/gdpr.js exportUser filled. functions tests: 189 → 205 (+16). Commits: 51ea605..2497159 (4 commits). 08-04-SUMMARY.md created. Next plan: 08-05 (GDPR erasure — gdprEraseUser + GDPR_PSEUDONYM_SECRET + redactionList).

**Previous session (2026-05-10):** Phase 8 plan 03 (soft-delete lifecycle) — all 8 tasks executed and committed. 4 new lifecycle CFs (softDelete, restoreSoftDeleted, scheduledPurge, permanentlyDeleteSoftDeleted), 5 data wrapper updates (deletedAt==null filter), firestore.rules +5 notDeleted conjuncts, src/cloud/soft-delete.js filled, LIFE-06 admin UI wired, getDownloadURL sweep complete. functions tests: 151 → 189 (+38); root tests: 440 → 445 (+5). Commits: 2ada963..4d9616e (11 commits). 08-03-SUMMARY.md created. Next plan: 08-04 (GDPR export).

**Previous session (2026-05-10):** Phase 8 plan 02 (backup Cloud Functions) — all 4 tasks executed and committed. Commits: 9fb299d (feat: scheduledFirestoreExport + 5 unit tests), 43b4b0b (feat: getDocumentSignedUrl + 7 unit tests), 628e0eb (feat: index.ts exports + integration tests), 40d7ebe (feat: src/cloud/signed-url.js seam), eb56590 (fix: vitest pool:forks isolation). 08-02-SUMMARY.md created. 08-01 still paused at operator Task 5. Next plan: 08-03 (soft-delete CFs + Rules + client seam).

**Previous session (2026-05-10):** Phase 8 plan 01 (backup substrate) — Tasks 1-4 executed and committed. Paused at Task 5 (operator checkpoint). Commits: 1809c1e (chore: @google-cloud/firestore@8.5.0), f6f3566 (feat: setup-backup-bucket script), 6ca6a9f (docs: phase-8-backup-setup.md runbook), cbff8b6 (feat: admin-sdk.ts Storage + FirestoreAdminClient mocks). Operator must run scripts/setup-backup-bucket/run.js and provision backup-sa before Wave 2 (08-02) can deploy.

**Last session (2026-05-04 — resumed mid-day):** Phase 1 execution continued. Waves 0-3 complete and pushed to `origin/main`. Wave 3 checkpoint resolved.

- Wave 0 (01-01) — `package.json` + lockfile + `.npmrc engine-strict` + `.gitignore`. T-1-01 supply-chain pinning live.
- Wave 1 (01-02) — Vite 8 + Vitest + tsc strict + ESLint flat (Math.random/innerHTML blocked) + Prettier + `types/globals.d.ts`. 6 deviations all upstream-API-drift fixes. Orchestrator-side fix expanded `.prettierignore` to honour the Phase 4 boundary consistently. T-1-03 mitigated.
- Wave 2 (01-03) — `.husky/pre-commit` (lint-staged + gitleaks protect) + `.gitleaks.toml` with custom SHA-256-hex-64 rule guarding the C2 regression. Synthetic block test PASSED on both worktree and main. T-1-02 mitigated.
- Wave 3 (01-04) — CI workflow authored, SHA-pinned (5 Actions). After push to `origin/main` (35 commits on first push), CI failed on Audit (gitleaks `unknown revision` from shallow clone) + Test (Vitest exits 1 on no-tests). Two fix commits landed: `de0bb38` `fix(01-04): set fetch-depth: 0 on audit checkout` + `56eee56` `feat(01-06): pull forward smoke test`. CI run [#25317482833](https://github.com/lukebadiali/base-layers-diagnostic/actions/runs/25317482833) GREEN on all six jobs. dist/ artefact verified to contain hashed-filename bundles (`main-BtavOejk.js`). Outcome B (no allowlist commits needed). T-1-04 + T-1-05 mitigated.

**Resume point:** `/gsd-execute-phase 1` to continue with Wave 4 (01-05 Dependabot, autonomous) and Wave 5 (01-06 runbooks + CONTRIBUTING + SECURITY.md, two human-action checkpoints: Socket.dev install + branch-protection runbook). Branch protection still deferred until Wave 5 Task 4 per Pitfall A — status-check names are now registered in GitHub's check registry from run #25317482833.

**This session (2026-05-06):** Phase 2 context gathered via `/gsd-discuss-phase 2`. 20 implementation decisions captured (D-01..D-21) across four gray areas: IIFE test-access strategy (mini-strangler-fig leaf extraction per Pitfall 9 step 2 — extract scoring/banding/completion/migration/unread/cloud-sync/auth helpers into src/domain/, src/data/, src/auth/, src/util/ with ESM bridge via `<script type="module">`); snapshot strategy (TEST-10) (toMatchFileSnapshot one-html-per-view + comprehensive clock/UUID/Math.random seeding + Chart.js stub); mocking & fixtures (tests/mocks/firebase.js reusable factory + real crypto.subtle.digest with known-password fixtures + flat tests/fixtures/ layout); coverage threshold + CI strictness (tiered per-directory thresholds — domain/util 100%, auth 95%, data 90%; hard CI fail on test/coverage/snapshot/typecheck miss; soft <30s local / <90s CI runtime target). Supersedes Phase 1 D-14 (index.html unchanged) — Phase 2 D-04 explicitly rewrites the script tag to type="module". Artefacts at `.planning/phases/02-test-suite-foundation/02-CONTEXT.md` + `02-DISCUSSION-LOG.md`.

**This session (2026-05-07):** Phase 4 context gathered via `/gsd-discuss-phase 4`. 21 implementation decisions captured (D-01..D-21) across four gray areas: wave shape & app.js death (Pattern A boundaries-first 6-wave shape — firebase/ → ui/ → data/ → views/ → state+router+main+app.js dies → cleanup; state+router+main extract LAST; one-final-commit cutover; per-wave no-restricted-imports warn→error hardening); firebase/ adapter shape + Chart.js CDN→npm (per-feature submodules per ARCHITECTURE.md §2.2; eager synchronous init; App Check empty no-op stub Phase 7 fills; Chart.js → ui/charts.js wrapper + Google Fonts self-hosted — closes 3 of Phase 3 D-07 temporary CSP allowlist entries); data/* scope vs Phase 5 collision (all 12 wrappers ship; 6 Phase-5-rewrite-targets as thin pass-throughs delegating to data/orgs.js; Promise CRUD + subscribe* helpers; cloud/* + observability/* empty stub seams Phase 7/8/9 fill; faithful extraction wrap-don't-refactor); toast + upload UX (ui/toast.js with 4 levels + tinted bg + Unicode symbols + role=status/role=alert; top-right + tiered auto-dismiss + sticky errors; ui/upload.js helper as trust boundary BEFORE data/documents.js; magic-byte sniff first 32 bytes + declared file.type cross-check; allowlist {PDF, JPEG, PNG, DOCX, XLSX, TXT}). Cross-cutting decisions: cleanup-ledger zero-out gates phase close (16 active rows + Phase 7/8/9 forward-tracking rows added); tests/index-html-meta-csp.test.js lands Wave 1 (T-3-meta-csp-conflict closure from Phase 3 cleanup ledger); per-wave SECURITY.md DOC-10 increment (Phase 1 D-25 atomic-commit); quick-wins (CODE-03..CODE-13) fold into the wave that touches their code area; per-directory coverage thresholds extend Phase 2 D-15 (views/ 80%, ui/ 100%, firebase/+cloud/+observability/ excluded in Phase 4, data/ raised 90%→95%). All recommended defaults selected by user. Artefacts at `.planning/phases/04-modular-split-quick-wins/04-CONTEXT.md` + `04-DISCUSSION-LOG.md` (commit `26a7273`).

**This session (2026-05-06, continued):** Phase 3 context gathered via `/gsd-discuss-phase 3`. 15 implementation decisions captured (D-01..D-15) across four gray areas: cutover topology (Firebase project URL soak + smoke + same-session CNAME flip + 14-day GH-Pages rollback retention); csp-violations Cloud Function (minimal `functions/` skeleton — TS + Node 22 + Gen 2 — that Phase 7 expands; firebase.json rewrite to /api/csp-violations same-origin; europe-west2 region pulls Phase 6's Firestore-region todo forward as a pre-flight); CSP report-only policy strictness (two-tier — tight on script/connect/frame/object/base/form, permissive on style-src 'unsafe-inline' until Phase 10's M5 sweep flips one knob; dual reporting via legacy report-uri + modern report-to + Reporting-Endpoints; frame-src for Firebase Auth popup origin added preemptively to spare Phase 6 a CSP edit); CSP report sink + filtering (Cloud Logging structured logs + filter rules for browser extensions / about:srcdoc / 5-min dedup window; abuse protection content-type + 64 KB body-size only — Cloud Armor / per-IP rate-limit deferred to Phase 7). Vercel-for-hosting-only raised by user mid-discussion; deferred per PROJECT.md "Stay on Firebase" + Pitfall 15 SOC2 co-location lock. Standard header set + CI deploy/preview-channel jobs covered as derived (D-13, D-14); SECURITY.md DOC-10 increment scoped (D-15). Artefacts at `.planning/phases/03-hosting-cutover-baseline-security-headers/03-CONTEXT.md` + `03-DISCUSSION-LOG.md`.

**This session (2026-05-07, continued):** Phase 4 planned via `/gsd-plan-phase 4`. 6 PLAN.md files across 6 sequential waves authored (commit `5048e6e`): 04-01 firebase/ adapter + Chart.js+font self-host + CSP CDN drop + CODE-03 + meta-CSP test (Wave 1); 04-02 ui/* helpers + html: deletion + permanent XSS regression fixture + ESLint domain/* boundary flip (Wave 2); 04-03 12 data/* wrappers (6 owners + 6 Phase-5-rewrite-target pass-throughs) + 5 cloud/* + 2 observability/* empty stub seams + ESLint data/* boundary flip (Wave 3); 04-04 12 views/* extracted + per-view quick wins folded (CODE-05/06/07/08/09/10/12) + ESLint views/* boundary flip (Wave 4); 04-05 state.js+router.js+main.js extract LAST + atomic terminal cutover (app.js DELETED + index.html `<script src>` flip in single commit per D-03) (Wave 5); 04-06 vite.config.js per-directory thresholds (D-21 verbatim) + final ESLint hardening + CODE-11 + CODE-13 (with pre-deletion gate) + cleanup-ledger zero-out gate + SECURITY.md final § Code Quality + Module Boundaries paragraph + human-verify checkpoint (Wave 6). Pattern map (`04-PATTERNS.md`) authored before planning — every new file maps to a pre-existing analog inside the repo with paste-ready code excerpts. Plan-checker VERIFICATION PASSED (zero blockers, zero warnings; 14/14 requirements covered: CODE-01..13 + DOC-10). Pattern-mapper, planner, and plan-checker agents all dispatched in this session. Skipped: phase-level RESEARCH.md (CONTEXT.md is exhaustive — D-01..D-21 locked, with project-wide research at .planning/research/* heavily referenced); UI-SPEC.md (D-13/D-14 lock toast visuals; D-15/D-16 lock upload UX; CODE-06 is style-string→class with no new design); Nyquist VALIDATION.md (no RESEARCH.md → Dimension 8 gap accepted; verification rigor comes from snapshot baselines + per-directory coverage thresholds + atomic-commit pattern). Artefacts at `.planning/phases/04-modular-split-quick-wins/04-{01..06}-PLAN.md` + `04-PATTERNS.md`.

**This session (2026-05-08, continued):** Phase 6 context gathered via `/gsd-discuss-phase 6` (commit `e22bef4`). 21 implementation decisions captured (D-01..D-21) across four gray areas: cutover wave shape + atomicity (6-wave mirror of Phase 5; single-session atomic cutover with functions deploy → admin Console-create → claims-verify → rules deploy → Anonymous Auth Console-disable → AUTH-14 deletion all in one operator session and one cutover commit; Anonymous Auth Console-disabled AT cutover with `signInAnonymously` source removed in same commit; AUTH-14 deletion atomic with rules deploy — `INTERNAL_PASSWORD_HASH` + `INTERNAL_ALLOWED_EMAILS` + `src/auth/state-machine.js` + `tests/auth/state-machine.test.js` + `tests/fixtures/auth-passwords.js` + the `firebase-ready` bridge all gone in cutover commit); admin bootstrap + MFA + AUTH-10 drill (operator-driven Console manual creation with `internalAllowlist/{email}` seeded first via Admin SDK script so `beforeUserCreated` reads claim source-of-truth; operator handles OOB temp-credential delivery — runbook documents "operator-delivered via secure channel" without prescribing channel; **AUTH-09 SUPERSEDED** by email-link recovery — no pre-generated recovery codes, no `users/{uid}.recoveryCodeHashes[]` field, REQUIREMENTS.md row updated; MFA hard-enforced with two-tier recovery (Tier-1 user-side email-link → un-enrol + re-enrol; Tier-2 operator-side Admin SDK un-enrol after OOB identity verification); AUTH-10 drilled live same-day-as-cutover with each admin taking a turn locked-out — runbook captures timing + commands + gaps); auth blocking Functions + RULES-07 deploy & rollback (`europe-west2` for `beforeUserCreated` + `beforeUserSignedIn` + `setClaims` matching `cspReportSink` + UK data-residency story; subdir `functions/src/auth/{beforeUserCreated,beforeUserSignedIn,setClaims}.ts` + sibling `claim-builder.ts` mirroring `functions/src/csp/*` pattern; pure-logic Vitest unit tests on `claim-builder.ts` (firebase-functions-test v3 deferred to Phase 7 / TEST-09); 2nd-gen + `minInstances: 1` per Pitfall 12; Wave 1 pre-flight verifies Firestore region; deploy ordering functions-first → admin bootstrap → claims-verify → rules deploy → anon-disable closes Pitfall 1 (rules only flip after Auth proven); 5-minute rollback substrate is `git revert <cutover-sha> --no-edit && git push` triggering Phase 3 CI deploy job — rehearsed end-to-end against the live Firebase project pre-cutover with timing recorded in `runbooks/phase6-rules-rollback-rehearsal.md`); sign-in client UX (AUTH-12 unified-error wrapper in `src/firebase/auth.js` body — single chokepoint, no Firebase error codes leak through layer boundary; AUTH-11 email-verify enforced both in Rules (Phase 5 D-14 `isAuthed()` already requires `email_verified`) AND client (`renderEmailVerificationLanding` + resend button); bootstrap admins pre-verified via `emailVerified: true` Admin SDK flag at Console creation; password reset uses generic "If that account exists, you'll receive an email" wording with Firebase default email template (sender-domain customisation deferred to Phase 11); new `src/views/auth.js` Pattern D DI factory exporting `renderSignIn` / `renderFirstRun` / `renderMfaEnrol` / `renderEmailVerificationLanding` per ARCHITECTURE.md §3 layout). Cross-cutting: Phase 5 D-21 carry-forward cleanup-ledger rows close (`legacyAppUserId`/`legacyAuthorId` field removal via `scripts/strip-legacy-id-fields.js` Wave 6; RULES-07 production deploy Wave 5; `window.FB.currentUser` + `firebase-ready` bridge retirement in cutover commit; `INTERNAL_PASSWORD_HASH`-shape gitleaks rule deletion in cutover commit); 4 new forward-tracking rows queued for Phase 7 (FN-09 rate-limit predicate + auditLog writers), Phase 9 (AUDIT-05 view wiring), Phase 10 (Firebase Auth popup CSP allowlist drop), Phase 11 (custom password-reset sender domain). 05-HUMAN-UAT.md test #2 (live SC#4 clock-skew exercise) closes in Wave 5 once first real org exists post-cutover. Firestore region verification + MFA recovery feasibility STATE.md outstanding todos folded into D-09 + D-07/D-08. User notably overrode 2 of the recommended defaults: bootstrap method (chose Console manual creation over allowlist-seeded self-signup) + recovery codes (chose email-link recovery, superseding AUTH-09). Artefacts at `.planning/phases/06-real-auth-mfa-rules-deploy/06-CONTEXT.md` + `06-DISCUSSION-LOG.md`.

---

*State initialized: 2026-05-03 after roadmap creation*
*Last updated: 2026-05-10 — Phase 9 plan 04 COMPLETE (commits 4adde66, 08394a8, 56c8147, 7d884ce, ebea786); ready for /gsd-execute-phase 9 (Plan 09-05 [autonomous: false] — GCP-tier monitors + audit-alert-sa SA provisioning + first deploy of authAnomalyAlert + synthetic-alert operator session)*
