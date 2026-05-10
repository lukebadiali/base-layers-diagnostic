---
phase: 9
slug: observability-audit-event-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (root + functions/) |
| **Config file** | `vitest.config.js` (root) + `functions/vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run && (cd functions && npm test -- --run)` |
| **Estimated runtime** | ~30 seconds (root) + ~25 seconds (functions) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run` (or scoped subset)
- **After every plan wave:** Run full suite (root + functions)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Populated by gsd-planner from RESEARCH.md §Validation Architecture per-task table.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `@sentry/browser`, `@sentry/node`, `@sentry/vite-plugin` installed (Wave 1 task)
- [ ] `tests/observability/sentry-init.test.js` — Sentry browser init contract test
- [ ] `functions/tests/sentry-node.test.ts` — Sentry node init contract test
- [ ] `functions/tests/auth-anomaly/authAnomalyAlert.test.ts` — Slack alert callable test
- [ ] `tests/audit-wiring.test.js` — AUDIT-05 wiring matrix (9 sites)

*Stubs land in Wave 1; real assertions arrive as wave-of-build.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Operator receives synthetic Slack alert | OBS-03 | Slack webhook receipt verification | Send test event via callable; confirm Slack channel post |
| Source maps resolve in Sentry UI | OBS-05 | Sentry UI inspection | Trigger error in prod build; verify stack frames show original source in Sentry dashboard |
| Uptime monitor probes from 2+ regions | OBS-04 | GCP Console / `gcloud monitoring uptime list` | Verify configured locations cover >= 2 regions |
| Firebase budget alert delivery | OBS-04 | Email/Pub-Sub receipt | Lower threshold temporarily; verify alert email; restore |
| Sentry quota alert | OBS-04 | Sentry UI inspection | Configure quota at 70%; verify alert config |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
