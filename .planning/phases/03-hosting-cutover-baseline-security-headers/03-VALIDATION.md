---
phase: 03
slug: hosting-cutover-baseline-security-headers
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| _Populated by gsd-planner_ | | | | | | | | | ⬜ pending |

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

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (functions/ workspace must be installed before any function code can be tested)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
