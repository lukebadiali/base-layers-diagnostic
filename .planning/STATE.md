---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-04T13:01:00.000Z"
progress:
  total_phases: 12
  completed_phases: 0
  total_plans: 6
  completed_plans: 5
  percent: 0
---

# State: Base Layers Diagnostic — Hardening Pass

**Initialized:** 2026-05-03
**Last updated:** 2026-05-03 — Phase 1 planned (6 plans, ready to execute)

---

## Project Reference

**Source of truth:** `.planning/PROJECT.md`

**Core value:**
Client diagnostic data must remain confidential, intact, and recoverable — and BeDeveloped must be able to honestly answer a prospect's security questionnaire about how that's enforced.

**Current focus:**
Phase 01 — engineering-foundation-tooling

**Compliance bar:** credible, **not** certified. Certification is a separate workstream.

---

## Current Position

Phase: 01 (engineering-foundation-tooling) — EXECUTING
Plan: 6 of 6 (Wave 5 next — final)
**Phase:** 1 — Engineering Foundation (Tooling)
**Plan:** 6 plans created (Waves 0-5), 5/6 executed (Wave 4 Dependabot complete 2026-05-04)
**Status:** Executing Phase 01 — Wave 5 (runbooks + SECURITY.md + Socket.dev + branch protection) ready
**Progress:** 0/12 phases complete

```
[................] 0%
 1  2  3  4  5  6  7  8  9 10 11 12
 .  .  .  .  .  .  .  .  .  .  .  .
```

**Next action:** `/gsd-execute-phase 1`

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

---

*State initialized: 2026-05-03 after roadmap creation*
*Last updated: 2026-05-04 — Phase 1 Waves 0-3 complete and on origin/main; first green CI run #25317482833 confirms all 5 status-check names registered (Pitfall A precondition satisfied for Wave 5)*
