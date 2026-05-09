---
phase: 03
slug: hosting-cutover-baseline-security-headers
status: ready
nyquist_compliant: pending
wave_0_complete: pending-execution
created: 2026-05-06
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (root) + vitest 3.x (functions/) — Phase 2 already installed root vitest |
| **Config file** | `vitest.config.js` (root, Phase 2) + `functions/vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `npm test -- --run` (root) and `cd functions && npm test -- --run` (functions) |
| **Full suite command** | `npm test -- --run --coverage` (root) and `cd functions && npm test -- --run --coverage` (functions) |
| **Estimated runtime** | ~30s (root after Phase 2) + ~10s (functions/ once populated) |

---

## Sampling Rate

- **After every task commit:** Run quick test for the affected workspace (root or functions/)
- **After every plan wave:** Run full suite in both workspaces
- **Before `/gsd-verify-work`:** Both suites green; `npm run lint` and `npm run typecheck` (root) green; `cd functions && npm run lint && npm run build` green
- **Max feedback latency:** 60s (per workspace)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T1 | 01 | 1 | HOST-01,HOST-02,HOST-08,FN-10 | T-3-5,T-3-7 | Pre-flights resolve every Open Question A1-A8 + populate canonical 03-PREFLIGHT.md | smoke (commands) + grep | node -e "const s=require('fs').readFileSync('.planning/phases/03-hosting-cutover-baseline-security-headers/03-PREFLIGHT.md','utf8');['## Firestore Region','## Firebase Project','## Registrar','## OIDC Pool','## OIDC SA Roles','## index.html meta-CSP scan','## dist/index.html font-CDN scan','## SDK 12.x connect-src verification'].every(h=>s.includes(h))||process.exit(1)" | ✅ if 03-PREFLIGHT.md exists with all 8 sections | ⬜ pending |
| 01-T2 | 01 | 1 | HOST-01,HOST-02 | T-3-5 | Human confirms registrar admin, Firebase Console state, OIDC secrets present | manual-checkpoint | (manual — see Manual-Only table) | N/A | ⬜ pending |
| 02-T1 | 02 | 2 | HOST-01,HOST-03,HOST-04,HOST-05 | T-3-1,T-3-2,T-3-6,T-3-7 | firebase.json declares full header set + verbatim D-13 values + rewrite ordering correct | unit (json+grep) | npm test -- --run tests/firebase-config.test.js | ✅ firebase.json + .firebaserc + index.html (if meta-CSP existed) | ⬜ pending |
| 02-T2 | 02 | 2 | HOST-03,HOST-04 | T-3-1,T-3-2 | Schema test guards header presence + rewrite order; tsconfig excludes functions/** | unit | npm test -- --run tests/firebase-config.test.js && npm run typecheck | ✅ tests/firebase-config.test.js + tsconfig.json | ⬜ pending |
| 02-T3 | 02 | 2 | DOC-10 | T-3-6 | SECURITY.md gains §HTTP Security Headers + §CSP (Report-Only) atomic with firebase.json | grep | node -e "const s=require('fs').readFileSync('SECURITY.md','utf8');['## § HTTP Security Headers','## § Content Security Policy (Report-Only)','OWASP ASVS L2 v5.0 V14.4','GDPR Art. 32'].every(t=>s.includes(t))||process.exit(1)" | ✅ SECURITY.md | ⬜ pending |
| 03-T1 | 03 | 2 | HOST-05,FN-10 | T-3-functions-mod-not-found | functions/ workspace scaffolded with pinned deps; root has no workspaces key | unit (npm install + json checks) | cd functions && npm ci && npm run typecheck && npm run lint && npm run build | ✅ functions/package.json + tsconfig + .eslintrc.cjs + .gitignore + vitest.config.ts | ⬜ pending |
| 03-T2 | 03 | 2 | HOST-05,FN-10 | T-3-3,T-3-pitfall-3,T-3-logger-vs-console | cspReportSink + normalise + filter + dedup TDD-implemented; logger.warn (no console); rawBody fallback | unit (vitest) | cd functions && npm test -- --run && npm run build && grep -c "csp.violation" functions/lib/csp/cspReportSink.js | ✅ functions/src/csp/*.ts + functions/test/csp/*.test.ts | ⬜ pending |
| 04-T1 | 04 | 3 | HOST-08,HOST-01,HOST-03,HOST-04,DOC-10 | T-3-1,T-3-5,T-3-functions-mod-not-found,T-3-deploy-collision,T-3-pr-channel-leak,T-3-no-branch-protection,T-3-supply-chain-functions | ci.yml gains deploy + preview jobs via OIDC; post-deploy curl asserts headers; functions audit step extends to functions/ workspace | unit (yaml parse + grep) | node -e "const yaml=require('js-yaml');const d=yaml.load(require('fs').readFileSync('.github/workflows/ci.yml','utf8'));!!d.jobs.deploy && !!d.jobs.preview || process.exit(1)" | ✅ .github/workflows/ci.yml + SECURITY.md | ⬜ pending |
| 05-T1 | 05 | 4 | HOST-01,HOST-02,HOST-08 | T-3-rollback-fallback,T-3-meta-csp-conflict | runbooks/hosting-cutover.md authored with prerequisites + smoke + steps + revert + day-14 + cutover log | grep | node -e "const t=require('fs').readFileSync('runbooks/hosting-cutover.md','utf8');['## Prerequisites','## Pre-cutover Smoke Checklist','## Cutover Steps','## DNS Revert Procedure','## Day-14 Cleanup','## Cutover Log'].every(h=>t.includes(h))||process.exit(1)" | ✅ runbooks/hosting-cutover.md | ⬜ pending |
| 05-T2 | 05 | 4 | HOST-05,FN-10 | T-3-2,T-3-pitfall-3,T-3-3 | Synthetic smoke: 5 curl POSTs (modern + legacy + 2 abuse + 1 filter); Cloud Logging probe verifies severity=WARNING entries match | integration (curl + gcloud logging) | (executor runs the 5 smokes; result block populated in 03-PREFLIGHT.md ## Smoke Result) — verifier asserts `all_smokes_passed: yes` AND `cloud_logging_seen: yes` appears ≥2× (smoke 1 modern + smoke 2 legacy) | ✅ entry in 03-PREFLIGHT.md | ⬜ pending |
| 05-T3 | 05 | 5 | HOST-01,HOST-02 | T-3-cutover-window,T-3-rollback-fallback | Cutover executed per runbook; CNAME flip + GH-Pages disable; live custom domain serves headers; securityheaders.com ≥ A | manual-checkpoint | (manual — see Manual-Only table) | N/A | ⬜ pending |
| 06-T1 | 06 | 6 | HOST-01,HOST-08,DOC-10 | T-3-4,T-3-meta-csp-conflict,T-3-bp-pitfall-a | Cleanup ledger rows added + branch protection runbook updated | grep | node -e "const l=require('fs').readFileSync('runbooks/phase-4-cleanup-ledger.md','utf8');const b=require('fs').readFileSync('runbooks/branch-protection-bootstrap.md','utf8');const dateOk=/Phase 3 GH-Pages[\s\S]{0,500}?(20\d{2}-\d{2}-\d{2}|TBD — cutover rolled back)/.test(l);if(!l.includes('Phase 3 GH-Pages')||!b.includes('Deploy to Firebase Hosting')||!dateOk)process.exit(1)" | ✅ runbooks/phase-4-cleanup-ledger.md + runbooks/branch-protection-bootstrap.md | ⬜ pending |
| 06-T2 | 06 | 6 | DOC-10 | T-3-audit-index-stale | SECURITY.md commit-SHA placeholders backfilled + §Phase 3 Audit Index added with 9 citation rows | grep | node -e "const s=require('fs').readFileSync('SECURITY.md','utf8');!s.includes('${commit-sha') && s.includes('## § Phase 3 Audit Index') || process.exit(1)" | ✅ SECURITY.md | ⬜ pending |
| 06-T3 | 06 | 6 | HOST-08 | T-3-bp-pitfall-a | Branch protection applied via GitHub UI (or deferral logged) | manual-checkpoint | (manual — see Manual-Only table) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Planner: every task in every PLAN.md must add a row here mapping it to (a) its REQ-ID(s) and (b) the automated command that verifies its acceptance criteria. Tasks lacking automated verification go to the Manual-Only Verifications table below with a reason.

---

## Wave 0 Requirements

- [ ] `functions/package.json` — pin `firebase-admin@13.x`, `firebase-functions@7.x`, dev `vitest@3.x`, `typescript@5.x`, `@types/node@22.x`
- [ ] `functions/tsconfig.json` — Node 22 + 2nd-gen target; emit to `lib/`
- [ ] `functions/vitest.config.ts` — config for the function unit tests (CSP filter, dedup, normalisation)
- [ ] `functions/.eslintrc.cjs` (or flat config) — extends repo root if compatible, otherwise standalone
- [ ] `functions/src/csp/normalise.ts` — pure function (legacy + modern wire formats → canonical shape)
- [ ] `functions/src/csp/filter.ts` — pure filter rules (extension/synthetic origin drop)
- [ ] `functions/src/csp/dedup.ts` — pure 5-min in-memory dedup
- [ ] `functions/src/csp/cspReportSink.ts` — onRequest handler wiring
- [ ] `functions/test/csp/normalise.test.ts` — covers both wire formats + missing-fields cases
- [ ] `functions/test/csp/filter.test.ts` — covers extension origins, synthetic origins, doc-uri-mismatch retention during soak
- [ ] `functions/test/csp/dedup.test.ts` — fake-timer 5-min window
- [ ] `tests/firebase-config.test.js` (root) — schema-validate `firebase.json` (rewrite ordering + headers shape)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `https://baselayers.bedeveloped.com` resolves to Firebase Hosting | HOST-01 | DNS + SSL provisioning is registrar-side and can take up to 24h | After cutover: `dig +short baselayers.bedeveloped.com` returns Firebase IPs; `curl -I https://baselayers.bedeveloped.com` returns `server: ...firebase...` (or absent — verify against Firebase docs); `openssl s_client -connect baselayers.bedeveloped.com:443 -servername baselayers.bedeveloped.com </dev/null` shows a Firebase-issued cert |
| GitHub Pages site disabled in repo settings | HOST-01 | GitHub Settings UI action; no API automation in scope | Open repo Settings → Pages; confirm "Source" is "None"; confirm `<org>.github.io/<repo>/` returns 404 |
| `securityheaders.com` rating ≥ "A" | HOST-08 | External scanner; can't be hit from CI without flakiness | After cutover: visit `https://securityheaders.com/?q=baselayers.bedeveloped.com&followRedirects=on` and confirm rating |
| End-to-end CSP violation arrives in Cloud Logging within 30s | HOST-05, FN-10 | Requires real browser + production CSP header + live Cloud Function | Open `https://baselayers.bedeveloped.com` in Chrome; in DevTools Console run a snippet that triggers a CSP violation (e.g., inject `<img src='https://evil.example.com'>`); within 30s confirm log entry in Logs Explorer with `severity=WARNING jsonPayload.message="csp.violation"` |
| OIDC WIF deploy on push to `main` | HOST-02 | Requires actual push to `main`; CI run is the verification | Push the merge commit; observe `deploy` job in GitHub Actions; confirm `firebase deploy` succeeds and the curl-header-presence post-deploy step passes |
| Per-PR preview channel comment | HOST-02 | Requires PR creation + GitHub PR API | Open a test PR; confirm bot comment with `https://<project>--pr-<N>-<channelId>.web.app` URL appears within ~3 min |
| `gcloud firestore databases describe` confirms region (D-06 pre-flight) | (pre-flight) | Auth'd gcloud CLI required | Manual gcloud login + describe; planner records output in CONTEXT.md addendum |
| Cleanup ledger entry for GH-Pages 14-day deletion | HOST-01, DOC-10 | Calendar-driven follow-up; not in this phase's commits | `runbooks/phase-4-cleanup-ledger.md` contains an entry with the exact deletion date; entry closes via a follow-up commit on day 14 |
| **Anchored task → checkpoint mapping** | — | — | 01-T2 anchors registrar/Console/OIDC manual gates; 05-T3 anchors cutover human-action; 06-T3 anchors branch-protection apply. All three have <resume-signal> blocks in their respective PLAN.md files. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (functions/ workspace must be installed before any function code can be tested)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (currently `pending` — flip to `true` ONLY when every box above is ticked at execution end)

**Approval:** pending
