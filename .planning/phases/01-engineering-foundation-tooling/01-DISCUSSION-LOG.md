# Phase 1: Engineering Foundation (Tooling) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 1 — Engineering Foundation (Tooling)
**Areas discussed:** Coexistence with un-split `app.js`, `index.html` cutover timing, Pre-commit tooling, Branch protection, `SECURITY.md` skeleton (DOC-10 incremental)
**Mode:** Single-pass — user accepted all 5 baked-in recommendations after one round of clarification.

---

## Milestone Confirmation

User confirmed the milestone is the **Full Hardening Pass** — closing CRITICAL + HIGH `CONCERNS.md` findings + standing up audit/soft-delete/GDPR/DR layer + producing a vendor-questionnaire-ready evidence pack. Compliance bar = credible (not certified) against SOC2 CC / ISO 27001 Annex A / GDPR Art. 32 / OWASP ASVS L2. Driver: a prospect's security questionnaire. Phase 12 owns the audit walkthrough itself.

Phase 1's role: stand up the engineering foundation so every downstream phase is testable + dependency-monitored + lint-enforced + CI-gated.

---

## Area 1 — Coexistence with un-split `app.js` (loud-vs-quiet)

The 4,103-line IIFE will trip every danger-rule in ESLint and explode `tsc --strict`. Three approaches:

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Loud — strict from day 1 | ESLint + TS strict fire on `app.js`; fix every error in Phase 1 (large blast radius into Phase 4's territory) | |
| (b) Quiet — file-level overrides | `app.js` gets `// @ts-nocheck` + ESLint excludes via `ignores`; new files get strict rules. CI green; debt invisible. | |
| (c) **Quiet, time-bounded — per-line disables + cleanup ledger** | `// @ts-nocheck` only on `app.js`; ESLint danger rules fire as `error` on all files but with per-line `eslint-disable-next-line` comments at each existing call site; `runbooks/phase-4-cleanup-ledger.md` enumerates every disable. Phase 4 removes them and the ledger empties. | ✓ |

**User's choice:** (c). Recommendation accepted without pushback.
**Notes:** This makes the technical debt visible and trackable rather than hidden behind a blanket exclude. Phase 4's `gsd-verifier` can grep for `eslint-disable-next-line` and `@ts-nocheck` to confirm cleanup is complete.

---

## Area 2 — `index.html` rewrite + `?v=46` cutover timing

Vite's build assumes `index.html` as entry. But the live GH-Pages site needs to keep shipping the un-built HTML until Phase 3's hosting cutover.

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Rewrite now | Phase 1 replaces `?v=46` with Vite-injected hashed paths; CI deploys `dist/index.html` to GH Pages; Phase 3 just swaps the host | |
| (b) **Don't change the served HTML** | Phase 1 stands up `vite.config.js` with `index.html` as entry; CI builds `dist/` as a verification artefact only; live site keeps shipping un-built HTML + `?v=46` until Phase 3 | ✓ |
| (c) Branch-deploy split | Phase 1 deploys `dist/` to a `gh-pages` branch / preview channel; main branch keeps un-built HTML | |

**User's choice:** (b). Recommendation accepted.
**Notes:** Cleanest separation. Phase 1's blast radius = "tooling lands; nothing user-visible changes". Phase 3 owns both the deploy mechanism (Firebase Hosting) and the served-bundle change in one cutover.

---

## Area 3 — Pre-commit hook tooling

`gitleaks` needs pre-commit per TOOL-12. Several wrappers exist.

| Option | Description | Selected |
|--------|-------------|----------|
| (a) **husky + lint-staged** | 2026 standard; ~5 lines config; auto-fixes ESLint+Prettier on staged JS + separate gitleaks step | ✓ |
| (b) simple-git-hooks | Smaller deps; less ecosystem support; manual lint-staged equivalent | |
| (c) gitleaks-only (native) | `gitleaks install --hook=pre-commit`; no wrapper; no lint-on-staged | |
| (d) Python `pre-commit` framework | Heaviest; only justified for cross-language hooks | |

**User's choice:** (a). Recommendation accepted.
**Notes:** lint-staged auto-fixes formatting on commit which keeps the team-of-2 commit history clean. CI also runs `gitleaks detect --source .` so a dev who skips local hook install still gets caught.

---

## Area 4 — Branch protection on `main`

TOOL-08 implies CI gating but doesn't mandate the GitHub-side branch protection rule.

| Option | Description | Selected |
|--------|-------------|----------|
| (a) **In Phase 1 scope, manual `gh api` step** | Required status checks (lint/typecheck/test/build/osv); 1 review; linear history; no force-push; PR-only. Documented as `runbooks/branch-protection-bootstrap.md`. Reproducible + auditable. | ✓ |
| (b) Out of Phase 1 scope | Treat as a separate manual GitHub UI task; not part of the milestone | |
| (c) Defer to Phase 11 | Bundle with the evidence-pack push | |

**User's choice:** (a). Recommendation accepted.
**Notes:** Branch protection without a runbook means an accidental "unprotect to fix something" leaves no audit trail. Documenting the exact `gh api` call makes restoration a 10-second copy-paste and gives DOC-09 a screenshot target for the evidence pack.

---

## Area 5 — `SECURITY.md` skeleton (DOC-10 incremental)

DOC-10 says every phase appends to `SECURITY.md` as it closes findings. Phase 1 closes supply-chain controls (Dependabot, Socket.dev, OSV-Scanner, gitleaks).

| Option | Description | Selected |
|--------|-------------|----------|
| (a) **Create skeleton with TOC + 3 populated sections** | Build & Supply Chain / Dependency Monitoring / Secret Scanning, each with framework citations (OWASP ASVS V14.2 + V14.4, ISO 27001 A.12.6 + A.10.1 + A.14.2.5, SOC2 CC6.1 + CC8.1). Stub TOC entries with phase references for the rest. | ✓ |
| (b) Wait until Phase 11 | Canonical owner finalises everything at the end | |
| (c) Single bullet list | No structure; just append controls as they land | |

**User's choice:** (a). Recommendation accepted.
**Notes:** Pitfall 19 prevention is exactly this pattern. Future phases append to existing sections rather than retrofitting structure. Stub TOC entries with phase references make the document's eventual shape visible from day 1.

---

## Claude's Discretion

- Exact `vite.config.js` shape (Vite default vs explicit `build.rollupOptions.input` for the un-built dev workflow) — researcher confirms
- Exact `gh api` payload for branch protection (API shape may evolve; researcher pulls the current docs)
- Whether to use `vite-plugin-sri` or built-in Vite SRI emission — researcher decides based on Vite 8 capability
- `eslint.config.js` exact rule severities for the broader rule sets beyond the explicitly-locked danger rules (D-06)
- Specific `.gitleaks.toml` rule patterns beyond the SHA-256-hex-literal rule (D-18)

## Deferred Ideas

- commitlint / Conventional Commits enforcement (already used by convention)
- Renovate (Dependabot is the locked choice)
- CodeQL / Semgrep SAST (deferred per STACK.md)
- Performance Monitoring SDK
- Python `pre-commit` framework
- Auto-merge for Dependabot patch updates
- `functions/` workspace skeleton (Phase 7 creates from scratch)
- OSV-Scanner hard fail (soft fail in Phase 1; revisit after 30 days of signal data)
</content>
</invoke>