---
phase: 12
slug: audit-walkthrough-final-report
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-11
---

# Phase 12 — Validation Strategy

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
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Wave-of-Build Replaces Wave 0 Stubs

Phase 12 is doc-only. Schema-test gates land alongside the docs they validate (test-with-doc atomic commits).

---

## Per-Task Verification Map

> Populated by gsd-planner from RESEARCH.md per-task table.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reviewer can answer every Pass/Partial/N/A verdict from REPORT alone | WALK-03 | Subjective navigation | Reviewer reads SECURITY_AUDIT_REPORT.md and follows each citation; verifies file exists + claim matches |
| Posture statement reads "credible / on track for SOC2..." verbatim | WALK-04 / Pitfall 19 | Reading test (automated forbidden-words gate covers most) | Reviewer confirms no "compliant" / "certified" language not negated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
