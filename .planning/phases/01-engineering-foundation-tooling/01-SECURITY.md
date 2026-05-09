---
phase: 01
slug: engineering-foundation-tooling
status: verified
threats_open: 0
asvs_level: 2
created: 2026-05-06
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
>
> Phase 1 stand-alone security narrative (with framework citations and per-control evidence) lives at repo-root `SECURITY.md` — written in Wave 5 Task 2 as the auditor-facing document (`document` disposition for T-1-02 / T-1-03 / T-1-05). This file is the GSD-format audit register that mirrors those closures.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → developer workstation | Untrusted package contents enter via `npm install` (Wave 0) | dependency tarballs, integrity hashes |
| developer workstation → repo | Lockfile must capture exact resolved versions (Wave 0) | `package.json`, `package-lock.json`, `.npmrc` |
| repo → CI | `npm ci` reproduces the same tree from lockfile (Wave 0 / 3) | committed source tree |
| developer code → ESLint / tsc | New code must not introduce XSS / CSPRNG regressions (Wave 1) | JS source, ESLint diagnostics |
| build pipeline → `dist/` | Build output must be reproducible + content-hashed (Wave 1) | `dist/assets/*-<hash>.{js,css}` |
| developer working tree → git index (staged) | Pre-commit is the FIRST gate — no secret should cross it (Wave 2) | staged file diffs |
| git index → repo (committed) | If pre-commit is bypassed (`--no-verify`), Wave 3 CI is the backstop (Wave 2 / 3) | committed file content |
| developer fork → repo CI | CI runs on the un-trusted PR diff with read-only token (Wave 3) | PR diff, ephemeral runner state |
| third-party Action → CI runner | Pinned SHAs prevent silent action substitution (Wave 3) | Action JS / Docker images |
| repo dependencies → CI | `npm audit` + OSV-Scanner + gitleaks scan every push (Wave 3) | dep tree, advisory DBs |
| upstream npm registry → repo deps | Ongoing monitoring required to surface CVEs as disclosed (Wave 4) | dep advisory feed |
| upstream Action publishers → repo CI | Pinned SHAs eventually go stale; Dependabot rotates them (Wave 4) | Action release tags |
| repo `main` branch → contributor pushes | Branch protection enforces lint+typecheck+test+audit+build pass + 1 review (Wave 5) | commit history integrity |
| GitHub Apps (Socket.dev) → repo CI signal | Install-time behavioural detection (Wave 5) | dep behavioural metadata |
| Documentation → audit reviewer | `SECURITY.md` must be evidenced + framework-cited (Wave 5) | audit narrative + citations |

---

## Threat Register

| Threat ID | Category | Component | Wave / Plan | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|-------------|------------|--------|
| T-1-01 (substrate) | Tampering / Supply Chain | `package.json` deps | Wave 0 (01-01) | mitigate | Exact-version pinning, lockfile integrity hashes, `npm ci` verifies on every install. ASVS V14.2.1, V14.2.4. ISO 27001 A.8.30, A.12.6.1. SOC2 CC8.1. | closed |
| T-1-04 (substrate) | Tampering — Node engine drift | dependency manifest format | Wave 0 (01-01) | mitigate | `.npmrc` `engine-strict=true` blocks installs on unsupported Node versions. ASVS V14.2.5. | closed |
| T-1-03 (DOM sink) | Tampering — Unsanitised DOM Sink Regression | new `innerHTML` / `outerHTML` / `insertAdjacentHTML` | Wave 1 (01-02) | mitigate | `eslint.config.js` enforces `no-unsanitized/method` + `no-unsanitized/property` as `error`; synthetic probe verified. ASVS V5.3.3, V5.3.4. SOC2 CC7.1. | closed |
| T-1-03 (CSPRNG) | Tampering — Predictable RNG Regression | new `Math.random()` | Wave 1 (01-02) | mitigate | `security/detect-pseudoRandomBytes` (error) + `no-restricted-syntax` matching `Math.random()` (belt+suspenders). ASVS V6.3.1. ISO 27001 A.10.1. | closed |
| T-1-05 (substrate) | Tampering — Build-Output Cache Poisoning | `dist/` artefacts | Wave 1 (01-02) | mitigate | `vite.config.js` `rollupOptions.output` produces hashed-filename bundles, replacing hand-bumped `?v=46`. ASVS V14.4.1. SOC2 CC8.1. | closed |
| T-1-02 | Information Disclosure — Hardcoded Secret Regression | source files in git index | Wave 2 (01-03) | mitigate | `.husky/pre-commit` runs `gitleaks protect --staged --config .gitleaks.toml` with custom `sha256-hex-literal-regression` rule; synthetic C2-hash probe BLOCKED. ASVS V14.3.2. ISO 27001 A.10.1, A.10.1.1. SOC2 CC6.1. | closed |
| T-1-03 (lint-staged) | Tampering — Auto-fix and format on commit | staged `.js` files | Wave 2 (01-03) | mitigate (auto-fix) | `.husky/pre-commit` runs `npx lint-staged` invoking `eslint --fix` + `prettier --write`. New `innerHTML` / `Math.random` additions caught at error severity. | closed |
| T-1-01 (CI audit) | Tampering / Supply Chain | npm production deps in CI | Wave 3 (01-04) | mitigate | `audit` job runs `npm audit --audit-level=high --omit=dev` as HARD gate; OSV-Scanner runs SOFT alongside. ASVS V14.2.1, V14.2.4. ISO 27001 A.8.30, A.12.6.1. SOC2 CC8.1. | closed |
| T-1-02 (CI backstop) | Information Disclosure / Hardcoded Secrets | repo source via CI | Wave 3 (01-04) | mitigate (CI backstop) | `audit` job runs `gitleaks/gitleaks-action@ff98106e…` (v2.3.9, SHA-pinned) with `config-path: .gitleaks.toml`; catches `--no-verify` pre-commit bypasses. ASVS V14.3.2. ISO 27001 A.10.1. SOC2 CC6.1. | closed |
| T-1-03 (CI lint) | Tampering / Unsanitised DOM Sink | new code in PR | Wave 3 (01-04) | mitigate | `lint` job runs `eslint . --max-warnings=0` (Wave 1 flat config); new `innerHTML` / `Math.random` fails the lint job. ASVS V5.3.3, V6.3.1. SOC2 CC7.1. | closed |
| T-1-04 | Tampering / CI Action Substitution | `.github/workflows/ci.yml` | Wave 3 (01-04) | mitigate | All 5 third-party Actions pinned to 40-char commit SHAs; `grep -nE 'uses: [^@]+@v[0-9]'` gate enforces in CI. ASVS V14.2.5. ISO 27001 A.8.31. SOC2 CC8.1. | closed |
| T-1-05 | Tampering / Build-Output Cache Poisoning | `dist/` via CI | Wave 3 (01-04) | mitigate (substrate) | `build` job runs `npm run build` and uploads `dist/` via `actions/upload-artifact@043fb46d…` (v7.0.1, SHA-pinned); hashed filenames produced by Vite 8. ASVS V14.4.1. SOC2 CC8.1. | closed |
| T-1-01 (Dependabot) | Tampering / Supply Chain | npm production deps over time | Wave 4 (01-05) | mitigate | Dependabot weekly scans `npm` root ecosystem; opens PRs for outdated + CVE-affected deps. Closes time-window between CVE publication and fix. ASVS V14.2.1, V14.2.4. ISO 27001 A.8.8, A.8.30, A.12.6.1. SOC2 CC8.1. GDPR Art. 32(1)(d). | closed |
| T-1-04 (Dependabot) | Tampering / CI Action Substitution | SHA pin freshness | Wave 4 (01-05) | mitigate | Dependabot weekly scans `github-actions` ecosystem; opens PRs to bump pinned SHAs to current release SHAs. ASVS V14.2.5. ISO 27001 A.8.31. SOC2 CC8.1. | closed |
| T-1-01 (Socket + BP) | Tampering / Supply Chain | npm + GH Actions ecosystems | Wave 5 (01-06) | mitigate (final layer) | Socket.dev GitHub App install-time behavioural detection on every dep-update PR; branch protection prevents merge without checks. ASVS V14.2.1, V14.2.4. ISO 27001 A.8.8, A.8.30. SOC2 CC8.1. | closed |
| T-1-04 (BP gate) | Tampering / CI Action Substitution | merge gate | Wave 5 (01-06) | mitigate (final layer) | Branch protection requires `Security Audit` job to pass before merge — malicious PR re-pointing an Action SHA fails SHA grep validation OR OSV-Scanner. ASVS V14.2.5. ISO 27001 A.8.31. | closed |
| T-1-02 / T-1-03 / T-1-05 (audit narrative) | Documentation — auditor-facing closure narrative | repo-root `SECURITY.md` | Wave 5 (01-06) | document | Repo-root `SECURITY.md` catalogues each closure with ASVS / ISO / SOC2 citations (DOC-10 — Pitfall 19 prevention). | closed |
| T-1-Wave5-01 | Repudiation | `main` branch protection | Wave 5 (01-06) | mitigate | Branch protection prevents force-push (`allow_force_pushes=false`) and direct push (PRs only via `required_status_checks[strict]=true`), preserving CI evidence trail. Evidence: `docs/evidence/branch-protection-screenshot.png`. ASVS V8.3.1. ISO 27001 A.8.31. SOC2 CC8.1. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party) · document (narrative-only)*

---

## Accepted Risks Log

No accepted risks. All threats in the register have a `mitigate` or `document` disposition with shipped controls.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By | Method |
|------------|---------------|--------|------|--------|--------|
| 2026-05-06 | 18 | 18 | 0 | hugh@assume-ai.com (manual via /gsd-secure-phase) | Acceptance of SUMMARY-claimed dispositions; no independent auditor re-verification this run. Per-control evidence is captured in each Wave's SUMMARY (`01-0{1..6}-SUMMARY.md`) and consolidated with framework citations in repo-root `SECURITY.md`. |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / document)
- [x] Accepted risks documented (none — all mitigated or documented)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-06 (audit method: SUMMARY-claim acceptance — see audit trail above; re-run `/gsd-secure-phase 1` and choose "Verify all threats with auditor" if independent re-verification is required for an external audit submission).
