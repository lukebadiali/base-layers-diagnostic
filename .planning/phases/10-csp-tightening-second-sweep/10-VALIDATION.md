---
phase: 10
slug: csp-tightening-second-sweep
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (root) |
| **Config file** | `vitest.config.js` |
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

## Wave-of-Build Replaces Wave 0 Stubs

Per Phase 9 pattern: every task that produces production code ALSO produces its own tests in the same atomic commit. No separate Wave 0 stub task.

---

## Per-Task Verification Map

> Populated by gsd-planner from RESEARCH.md per-task table.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 7-day Report-Only soak with zero new violations | HOST-06 | Calendar time + production traffic | Operator monitors `cspReportSink` Cloud Logging filter; documents zero-new-violations result in cutover-runbook Cutover Log |
| HSTS preload list inclusion | HOST-07 | hstspreload.org review queue (weeks) | Operator submits domain via web form; tracks submission state; documents inclusion in cutover-runbook |
| securityheaders.com rating "A+" | HOST-06 | External scanner | Operator runs scan; saves screenshot to `docs/evidence/phase-10-securityheaders-A+.png` |
| Cross-browser smoke under enforced CSP | HOST-06 | Manual click-through | Operator tests sign-in, dashboard, radar/donut, document upload, chat in Chrome + Firefox + Safari |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
