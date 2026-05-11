# Dependency CVE — Incident Response Runbook

> Phase 11 Wave 4 deliverable (DOC-06). Skeleton — operator fills detail at first use. Linked from `docs/IR_RUNBOOK.md ## Scenario 3`.

**Trigger:** Dependabot PR opens against `main`, OR OSV-Scanner CI alert (GitHub Actions `dependency-review.yml` step), OR Socket.dev alert at install-time, OR `npm audit` non-zero exit on the scheduled audit run.

**Owner (default):** Whoever opens the PR (Hugh by default for automated PR creation).

**Severity (CVSS-aligned):**

- **Critical (≥ 9.0):** patch within 24 hours of confirmation.
- **High (7.0-8.9):** patch within 7 days.
- **Medium (4.0-6.9):** patch within 30 days.
- **Low (< 4.0):** batch with next dependency-bump cycle.

**Last reviewed:** 2026-05-10 (Phase 11 Wave 4 — skeleton; operator fills on first use)

---

## Pre-conditions

- [ ] Operator has push access to `bedeveloped/base-layers-diagnostic` (PR review + merge permission).
- [ ] CI green on `main` (build + test + typecheck) before starting — otherwise rollback path is muddled.
- [ ] `npm` + `node` on local PATH at the versions pinned in `package.json` `engines` field.
- [ ] Optional: GitHub CLI `gh` installed for PR-side review.

## Decision tree

1. **Triage severity.** Read the CVE advisory (NVD / GHSA). Note: CVSS base score + attack vector (network / local / physical) + privileges required + user interaction. **Capture** into the RCA template.

2. **Determine reachability.** Is the affected package a **direct** dependency or **transitive**? Run:
   ```bash
   npm ls <package-name>     # shows the import path
   ```
   - **Direct + reachable from app code** → highest-priority patch.
   - **Transitive + reachable through a code path the app executes** → high-priority patch.
   - **Transitive but only used in dev/test** → patch per severity timeline but no production rush.
   - **Transitive and unreachable** (e.g., dead code branch in a sibling util) → still patch on standard cadence; document the non-reachability as a mitigating factor in the RCA, not as a reason to defer.

3. **Apply the patch.**
   - **Direct dep:** `npm install <package>@<patched-version>` → updates `package.json` + `package-lock.json`.
   - **Transitive dep:** use `npm` override block in `package.json`:
     ```json
     "overrides": {
       "<vulnerable-package>": "<patched-version>"
     }
     ```
     Re-run `npm install` to refresh lockfile.

4. **Run full test + smoke matrix.**
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
   All three must be green. Smoke checks: the diagnostic app loads + sign-in works + a chart renders without console errors (manual check — preview locally via `npm run preview`).

5. **Open PR + merge.** Conventional Commits prefix `fix(deps):` for direct security fix; `chore(deps):` for non-security routine bump. PR description cites CVE ID + CVSS score + reachability assessment + test/smoke evidence. Self-review counts (single-maintainer pattern); branch protection allows after CI green.

6. **Post-patch verification.** After deploy (or after merge to `main` for an autodeploy stack):
   - Re-run `npm audit --omit=dev` against deployed `package-lock.json` — expect zero matching advisories.
   - For runtime-loaded packages (e.g., Firebase SDK) — confirm the deployed bundle picks up the new version (check `dist/` hashed-filename diff vs prior deploy).
   - Capture deploy timestamp + commit SHA into the RCA template.

7. **For CRITICAL out-of-band.** If CVSS ≥ 9.0 + reachable + actively exploited (CISA KEV catalogue OR PoC in the wild), bypass the standard PR-review cadence:
   - Patch on a feature branch.
   - Merge with a single-line risk-acceptance commit message citing the CVE + KEV.
   - Notify Luke + George within 1 hour of merge.
   - Treat the same merge as an incident; fill the RCA template.

## Failure-Mode Triage

| Failure | Cause | Recovery |
|---------|-------|----------|
| `npm install` patched version fails resolve | Patched version not yet on npm registry | Fall back to a forked patch via `git+https://` URL in `package.json`; document fork URL in RCA |
| Tests fail after patch | Breaking change in the patched version | Pin to prior version + add `npm` advisories ignore-with-justification block in `.github/dependency-review.yml`; queue major-version-bump as separate work |
| `npm audit` still reports advisory after patch | Lockfile not regenerated, OR transitive override not picked up | Delete `node_modules` + `package-lock.json` → `npm install` → re-run audit |
| Deployed bundle still ships vulnerable version | Cache busting absent OR CDN stale | Bump `dist/` hash via build re-run; confirm `Content-Encoding` + ETag changed on production response |
| Multiple advisories at once + no time to triage each | Bulk CVE day (e.g., disclosure burst) | Patch the Critical/High first; queue Medium/Low in a tracked-deps issue with 30-day deadline; escalate to Luke if backlog grows |

## Comms template

Internal-only by default — no customer comms unless the CVE allowed confirmed exploitation against this codebase. If customer comms needed: see `docs/IR_RUNBOOK.md ## Comms templates`.

## RCA template

Lightweight RCA in PR description for Medium/Low; full RCA template (see `docs/IR_RUNBOOK.md ## RCA template`) for Critical/High patches.

## Citations

- SECURITY.md § Dependency Monitoring (Dependabot + OSV-Scanner + Socket.dev wiring)
- SECURITY.md § Build & Supply Chain (npm-lockfile-clean gate per release)
- runbooks/socket-bootstrap.md (install-time detection layer; Scenario 4 cross-reference)
- runbooks/branch-protection-bootstrap.md (PR + CI gating)
- OWASP ASVS L2 v5.0 V14.2.x (Dependency management)
- ISO/IEC 27001:2022 Annex A.8.8 (Management of technical vulnerabilities)
- SOC 2 CC7.1 (System operations — vulnerability identification)
- CISA KEV Catalogue (https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
