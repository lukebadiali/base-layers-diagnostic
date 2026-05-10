---
phase: 11
slug: documentation-pack-evidence-pack
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-10
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (root) + markdown-link-check + custom citation-validator script |
| **Config file** | `vitest.config.js` |
| **Quick run command** | `npm test -- --run docs` |
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

Phase 11 is doc-heavy. Citation tests and link-checkers land alongside the docs they validate (test-with-doc atomic commits).

---

## Per-Task Verification Map

> Populated by gsd-planner from RESEARCH.md per-task table.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reviewer can answer every claim from SECURITY.md + CONTROL_MATRIX.md alone | DOC-04 | Subjective navigation test | Reviewer reads only those two docs and follows citation links; verifies every cited file exists and contains the cited content |
| security.txt served from production with correct Content-Type | DOC-02 | Live HTTP response check | `curl -i https://baselayers.bedeveloped.com/.well-known/security.txt` shows 200 + `Content-Type: text/plain` |
| docs/evidence/ screenshots exist | DOC-09 | Visual verification | Operator captures screenshots during Phase 8/9/10 close-gates per existing DEFERRED-CHECKPOINT pattern; Phase 11 references presence with PENDING-OPERATOR annotation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
