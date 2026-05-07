---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-07T16:30:00.000Z"
progress:
  total_phases: 12
  completed_phases: 4
  total_plans: 30
  completed_plans: 24
  percent: 80
---

# State: Base Layers Diagnostic — Hardening Pass

**Initialized:** 2026-05-03
**Last updated:** 2026-05-07 — Phase 4 COMPLETE (6/6 plans executed; verifier 4/4 SC + 14/14 requirements; 3 UI smoke checks deferred to 04-HUMAN-UAT.md; sub-wave queued as 4.1 for IIFE body migration)

---

## Project Reference

**Source of truth:** `.planning/PROJECT.md`

**Core value:**
Client diagnostic data must remain confidential, intact, and recoverable — and BeDeveloped must be able to honestly answer a prospect's security questionnaire about how that's enforced.

**Current focus:**
Phase 5 — Firestore Data Model Migration + Rules Authoring (Committed, Not Deployed). Phase 4 closed 2026-05-07 with sub-wave 4.1 queued (main.js-body-migration; closes 16 documented carryover items including @ts-nocheck on src/main.js, 132 static `style="..."` strings, window.FB/Chart bridges, coverage threshold misses).

**Compliance bar:** credible, **not** certified. Certification is a separate workstream.

---

## Current Position

Phase: 4 — COMPLETE (Modular Split + Quick Wins — 6/6 plans executed across 6 sequential waves; verifier 4/4 ROADMAP success criteria + 14/14 requirements; 376/376 tests pass; typecheck/lint/build clean; snapshot baselines zero diff; 3 UI smoke checks deferred to 04-HUMAN-UAT.md; deviation cluster operator-approved as queued sub-wave 4.1)
**Status:** Ready to discuss/plan Phase 5
**Progress:** 4/12 phases complete

```
[######..........] 33%
 1  2  3  4  5  6  7  8  9 10 11 12
 ✓  ✓  ✓  ✓  .  .  .  .  .  .  .  .
```

**Next action:** `/gsd-discuss-phase 5` (recommended — Phase 5 has no CONTEXT.md yet) or `/gsd-plan-phase 5`.

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

---

*State initialized: 2026-05-03 after roadmap creation*
*Last updated: 2026-05-07 — Phase 4 planned (6 plans across 6 sequential waves; commit 5048e6e); ready for /gsd-execute-phase 4*
