# State: Base Layers Diagnostic — Hardening Pass

**Initialized:** 2026-05-03
**Last updated:** 2026-05-03

---

## Project Reference

**Source of truth:** `.planning/PROJECT.md`

**Core value:**
Client diagnostic data must remain confidential, intact, and recoverable — and BeDeveloped must be able to honestly answer a prospect's security questionnaire about how that's enforced.

**Current focus:**
Full Hardening Pass milestone — close all CRITICAL + HIGH `CONCERNS.md` findings, stand up the audit-trail layer, and produce a vendor-questionnaire-ready evidence pack. End state: a production-grade, compliance-credible Firebase platform that maps honestly onto SOC2 CC / ISO 27001:2022 Annex A / GDPR Art. 32 / OWASP ASVS L2.

**Compliance bar:** credible, **not** certified. Certification is a separate workstream.

---

## Current Position

**Phase:** 1 — Engineering Foundation (Tooling)
**Plan:** Not started
**Status:** Ready to begin
**Progress:** 0/12 phases complete

```
[................] 0%
 1  2  3  4  5  6  7  8  9 10 11 12
 .  .  .  .  .  .  .  .  .  .  .  .
```

**Next action:** `/gsd-plan-phase 1`

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

**Last session:** Project initialization — research synthesis (`SUMMARY.md`, `PITFALLS.md`, `ARCHITECTURE.md`, `STACK.md`, `FEATURES.md`) complete; codebase analysis (`.planning/codebase/`) complete; PROJECT.md + REQUIREMENTS.md defined; ROADMAP.md and STATE.md created from validated 12-phase plan.

**Resume point:** `/gsd-plan-phase 1` — begin planning Phase 1 (Engineering Foundation / Tooling).

---

*State initialized: 2026-05-03 after roadmap creation*
