---
phase: 01-engineering-foundation-tooling
plan: 05
subsystem: tooling
tags: [dependabot, supply-chain, ongoing-monitoring, t-1-01, t-1-04, tool-10]

# Dependency graph
requires:
  - phase: 01-engineering-foundation-tooling
    plan: 01-04
    provides: .github/workflows/ci.yml with 5 SHA-pinned third-party Actions (Dependabot github-actions ecosystem tracks these for weekly bumps)
provides:
  - .github/dependabot.yml — three ecosystems (npm /, npm /functions, github-actions /) on weekly/Monday cadence with auto-merge intentionally OFF
affects:
  [01-06-runbooks-security-md, 07-cloud-functions, 11-evidence-pack]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependabot config v2 — three ecosystems weekly/Monday cadence with rebase-strategy: auto and no automerge key (D-19)"
    - "Forward-declared /functions ecosystem — Dependabot silently skips until Phase 7 creates the directory; avoids a config churn commit later"
    - "github-actions ecosystem layered on top of Wave 3's SHA-pinning (T-1-04 — pinning + ongoing rotation = complete control)"

key-files:
  created:
    - ".github/dependabot.yml (33 lines, 3 ecosystem entries)"
  modified: []

key-decisions:
  - "D-19 honoured: auto-merge intentionally OFF — every Dependabot PR requires human review per compliance posture. Re-evaluate at milestone close."
  - "Forward-declared /functions ecosystem (Phase 7 creates the directory) — Dependabot docs confirm silent-skip on missing directories"
  - "open-pull-requests-limit: 10 for root npm (large dep surface), 5 for functions and github-actions (smaller surfaces)"

patterns-established:
  - "Dependabot config v2 atomic-commit pattern: one file, one commit, all ecosystems declared together for cohesion + reviewer ergonomics"

requirements-completed: [TOOL-10]

# Metrics
duration: ~2 min (file authoring + 4-gate validation + commit)
completed: 2026-05-04
checkpoint_pending: false
---

# Phase 01 Plan 05: Wave 4 — Dependabot Config Summary

**`.github/dependabot.yml` lands the third — and final — supply-chain monitoring layer for Phase 1. Three ecosystems are scanned weekly (Mondays): npm root (production + dev deps), npm /functions (forward-declared for Phase 7), and github-actions (rotates the five SHA pins from Wave 3). Auto-merge is intentionally OFF per D-19 — every dep PR requires human review for compliance posture.**

## Performance

- **Started:** 2026-05-04 (immediately after Wave 3 checkpoint resolution)
- **Completed:** 2026-05-04
- **Duration:** ~2 minutes
- **Tasks complete:** 1 / 1
- **Commits:** 1 atomic (feat)
- **Files created:** 1 (.github/dependabot.yml — 33 lines)
- **Files modified:** 0

## Accomplishments

- **Config v2 schema verified** — `version: 2` declared; `updates` array contains exactly 3 entries; sorted ecosystems are `["github-actions", "npm", "npm"]`. Validated via `node -e` with `js-yaml.load(...)`.
- **Weekly/Monday cadence on every entry** — `schedule.interval === "weekly"` and `schedule.day === "monday"` on all 3 ecosystems. Daily was rejected in CONTEXT.md as too noisy.
- **`rebase-strategy: "auto"` on every entry** — Dependabot keeps each open PR current with `main`, so reviewers always see the latest diff against current HEAD.
- **Auto-merge explicitly OFF (D-19)** — no `automerge:` key anywhere in the file. This is intentional and documented inline as a load-bearing comment. Compliance posture: every dep bump = human review.
- **Three ecosystems (count = 3 verified by grep)** — `package-ecosystem: "npm"` × 2 (root + /functions) and `package-ecosystem: "github-actions"` × 1.
- **PR limits per ecosystem** — root npm at 10 (large dep surface), /functions and github-actions at 5 each.
- **Forward-declared /functions ecosystem** — Dependabot silently skips ecosystems whose target directory doesn't yet exist (per official Dependabot docs), so this entry is harmless until Phase 7 creates `functions/`. Avoids a config-churn commit when Phase 7 lands.

## Task Commits

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create .github/dependabot.yml with three ecosystems | `e4806a2` (feat) | `.github/dependabot.yml` |

## Validation Gate Output

```
$ node -e "const yaml=require('js-yaml'); const fs=require('fs'); const cfg=yaml.load(fs.readFileSync('.github/dependabot.yml','utf8')); ..."
OK schema valid: 3 ecosystems, weekly/monday cadence, version 2

$ grep -c 'package-ecosystem' .github/dependabot.yml
3

$ grep -E '^[[:space:]]*automerge' .github/dependabot.yml || echo "no automerge key (D-19 OK)"
no automerge key (D-19 OK)

$ grep -q 'package-ecosystem: "github-actions"' .github/dependabot.yml && echo "github-actions ecosystem present"
github-actions ecosystem present
```

All four pre-commit gates passed.

## Decisions Made

None outside what the plan specified — D-19 (no auto-merge), 3-ecosystem coverage, weekly/Monday cadence, and forward-declared /functions all came from CONTEXT.md.

## Deviations from Plan

**None — plan executed exactly as written.**

The file content matches the plan skeleton verbatim except for whitespace normalisation by the editor. The atomic commit pattern (one file, one commit, no SECURITY.md update) follows D-25 — Wave 5 owns the SECURITY.md "§ Dependency Monitoring" section update with framework citations.

## Issues Encountered

None. Pre-commit hook (lint-staged + gitleaks protect) ran cleanly — `.yml` files don't match lint-staged's `*.js` glob, and the file contains no secrets.

## User Setup Required

**None.** Dependabot is a built-in GitHub feature and activates automatically for any repo containing `.github/dependabot.yml`. No GitHub App install or token configuration required.

## First Scan Window

Today is **2026-05-04 (Monday UTC at write time)**. With weekly/Monday cadence, Dependabot's first scan against this config fires no later than the **next Monday after this commit reaches `origin/main`** — currently scheduled for **2026-05-11**.

If today's commit has been pushed and Dependabot's bookkeeping ran before midnight UTC, the first scan could hit immediately on 2026-05-04 rather than waiting for 2026-05-11. Either way, expect the first batch of Dependabot PRs against `npm` + `github-actions` ecosystems to land in Hugh's inbox in the 2026-05-04 → 2026-05-11 window.

## Next Phase Readiness

- **Plan 01-06 (Wave 5)** is unblocked. `dependabot.yml` is now on `main` (after push), so Wave 5's SECURITY.md "§ Dependency Monitoring" section can honestly cite four monitoring layers: pinned versions + Dependabot weekly + Socket.dev install-time + npm audit/OSV-Scanner per-PR.
- **Phase 1 success criterion #5** ("Dependabot opens weekly PRs against `npm` + `github-actions` ecosystems") is **on track** — the file exists; the verification at Phase 1 close (Wave 5 Task 4) confirms the first PR opened.

## Threat Model Compliance

- **T-1-01 (Tampering / Supply Chain — npm production deps over time) — `mitigate` disposition (final layer):** Dependabot weekly scans the `npm` root ecosystem and opens PRs for outdated deps + CVE-affected deps. Combined with Wave 3's `npm audit --audit-level=high` (HARD) + OSV-Scanner (SOFT) gates, this closes the time-window between CVE publication and a fix landing. ASVS V14.2.1, V14.2.4. ISO 27001 A.8.8, A.8.30, A.12.6.1. SOC2 CC8.1. GDPR Art. 32(1)(d).

- **T-1-04 (Tampering / CI Action Substitution — `.github/workflows/ci.yml` SHA pins) — `mitigate` disposition (final layer):** Dependabot weekly scans the `github-actions` ecosystem and opens PRs to bump pinned SHAs to current release SHAs. Without this, Wave 3's pinned SHAs would slowly go stale and miss security fixes in the Actions themselves. ASVS V14.2.5. ISO 27001 A.8.31. SOC2 CC8.1.

No new threats introduced.

## Known Stubs

None. The Dependabot config is fully wired and live; the only "lazy" element is the forward-declared `/functions` ecosystem which is by design (silent-skip until Phase 7).

## TDD Gate Compliance

This plan is `type: execute`, not `type: tdd`, so the RED/GREEN/REFACTOR commit triad is not required.

## Self-Check: PASSED

Files exist:

- `.github/dependabot.yml` at repo root — FOUND (33 lines)

Commits exist (verified via `git log --oneline`):

- `e4806a2` (feat(01-05): add Dependabot config (npm root, npm functions, github-actions)) — FOUND

Plan-level verification block (every check from the plan's `<verification>` block):

- `test -f .github/dependabot.yml` — PASS
- `node -e "...assert version===2 && updates.length===3..."` — PASS
- `[ "$(grep -c 'package-ecosystem' .github/dependabot.yml)" -eq 3 ]` — PASS
- `! grep -qE '^[[:space:]]*automerge' .github/dependabot.yml` — PASS (no automerge key)
- `grep -q 'package-ecosystem: "github-actions"' .github/dependabot.yml` — PASS
- `[ "$(git rev-list --count HEAD ^HEAD~1)" = "1" ]` — PASS (one atomic commit)

Plan-level success criteria (6 criteria from plan `<success_criteria>` block):

1. `.github/dependabot.yml` exists with three weekly-scheduled ecosystems — PASS
2. YAML schema valid (`version: 2`; `updates.length === 3`) — PASS
3. Auto-merge is OFF (D-19 compliance posture) — PASS
4. T-1-01 (supply-chain) gains an ongoing-monitoring layer beyond Wave 3's per-PR audits — PASS
5. T-1-04 (CI action substitution) gains an ongoing SHA-rotation layer — PASS
6. One atomic commit with Conventional Commits message — PASS

---

_Phase: 01-engineering-foundation-tooling_
_Plan: 05 (Wave 4 — Dependabot Config)_
_Status: Complete_
_Summary committed: 2026-05-04_
