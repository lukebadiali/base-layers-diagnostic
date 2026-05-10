---
phase: 11-documentation-pack-evidence-pack
plan: 01
subsystem: documentation
tags: [docs, doc-01, doc-04, security-md, control-matrix, tdd-doc-shape]
dependency-graph:
  requires: [Phase 10 close — all SECURITY.md DOC-10 increments landed]
  provides:
    - "DOC-01 substrate: SECURITY.md ToC + 3 promoted sections + uniform citation format"
    - "DOC-04 skeleton: docs/CONTROL_MATRIX.md with 15 REQ-prefix anchors (rows in Wave 6)"
    - "Cross-reference anchor targets for Waves 2-5 (PRIVACY.md / THREAT_MODEL.md / IR_RUNBOOK.md / security.txt)"
  affects:
    - SECURITY.md (canonical pass)
    - docs/CONTROL_MATRIX.md (new)
    - tests/security-md-toc.test.js (new)
    - tests/security-md-citation-format.test.js (new)
tech-stack:
  added: []
  patterns: ["regex-over-file-body doc-shape tests (mirrors tests/build/source-map-gate.test.js)"]
key-files:
  created:
    - docs/CONTROL_MATRIX.md
    - tests/security-md-toc.test.js
    - tests/security-md-citation-format.test.js
    - .planning/phases/11-documentation-pack-evidence-pack/11-01-SUMMARY.md
  modified:
    - SECURITY.md
decisions:
  - id: D-11-01-01
    decision: "Promote 3 currently-scattered topics into top-level `## §` sections (Vulnerability Disclosure Policy first; MFA Recovery Procedure after § Multi-Factor Authentication; Rotation Schedule after § Secret Scanning)"
    rationale: "DOC-01 verbatim spec requires MFA recovery procedure + rotation schedule sections; § Vulnerability Disclosure Policy was a Phase 1 blockquote placeholder explicitly tagged for Phase 11 finalisation"
  - id: D-11-01-02
    decision: "Normalise `GDPR Article 32` → `GDPR Art. 32` in the compliance posture footer despite the verbatim-preserve clause"
    rationale: "Test 4 of citation-format.test.js asserts zero `GDPR Article \\d` hits across the file; the verification gate protects the substantive `credible, not certified` boilerplate sentence only, not the citation-form drift on a separate footer line. Confirmed via git diff: zero `credible.*not certified` line changes."
  - id: D-11-01-03
    decision: "CONTROL_MATRIX.md ships with empty tables (zero data rows) at Wave 1"
    rationale: "Wave 6 populates rows. Skeleton-first lets Waves 2-5 cross-reference specific section anchors without race conditions on row placement. Plan frontmatter `must_haves.artifacts` explicitly contracts the skeleton shape."
metrics:
  duration: "464 seconds (~7m 44s)"
  duration-iso: "PT7M44S"
  start: "2026-05-10T21:19:34Z"
  end: "2026-05-10T21:27:19Z"
  tasks-completed: 3
  files-created: 4
  files-modified: 1
  commits: 3
  test-cases-added: 9
  test-cases-passing: "493 passed + 6 skipped (full suite)"
  citation-drift-instances-fixed: 16
  completed: "2026-05-10"
---

# Phase 11 Plan 01: SECURITY.md Canonical Pass + CONTROL_MATRIX.md Skeleton Summary

DOC-01 + DOC-04 structural substrate: SECURITY.md gains a 36-link ToC, three promoted top-level sections (Vulnerability Disclosure Policy / MFA Recovery Procedure / Rotation Schedule), and citation-format uniformity (16 drift instances normalised); docs/CONTROL_MATRIX.md ships as a 15-REQ-prefix-anchor skeleton ready for Wave 6 row-fill.

## One-liner

Phase 11 Wave 1 — DOC-01 canonical pass on the 1278-line SECURITY.md + DOC-04 skeleton with REQ-prefix anchors, locked by 9 regex-over-file-body doc-shape test assertions in two new TDD test files.

## What Landed

### SECURITY.md — DOC-01 canonical substrate (commit `30f104e`)

Five structural changes; line count went 1278 → 1392 (+114 net):

1. **Table of Contents** (lines 7-44, 36 markdown anchor links). Placed after the front matter and before the first `## §` section, with anchor targets matching GitHub's auto-anchor algorithm (lowercase; spaces → hyphens; `§` glyph stripped, leaving a leading hyphen).
2. **§ Vulnerability Disclosure Policy** (top-level `## §` section; first in source order). Replaces the Phase 1 blockquote placeholder at the old lines 7-15. Final wording: 5-business-day acknowledgement + 10-business-day substantive update + safe-harbour language for good-faith researchers + explicit in-scope (production app + source repo) / out-of-scope (third-party Firebase + Sentry; social engineering; DoS testing) + RFC 9116 forward-reference (Wave 5 ships `/.well-known/security.txt`).
3. **§ MFA Recovery Procedure** (top-level `## §` section after § Multi-Factor Authentication). Two-tier structure: Tier 1 user-side email-link recovery (Phase 6 D-07 supersession of AUTH-09 recovery codes); Tier 2 operator-side Admin SDK un-enrol via `runbooks/phase6-mfa-recovery-drill.md`. Evidence row marks `docs/evidence/phase-6-mfa-recovery-drill-pass.png` PENDING-OPERATOR per Pitfall 19 (substrate-honest disclosure).
4. **§ Rotation Schedule** (top-level `## §` section after § Secret Scanning). Seven-row table covering rotating secrets (GDPR_PSEUDONYM_SECRET annual + on-leak; Sentry DSN on-leak; Slack webhook URL on-leak) + non-rotating-by-design secrets (3 OIDC/WIF paths: BigQuery sink + Firebase deploy + audit-alert-sa) + Firebase-managed TLS rotation. Cross-references three operator runbooks for bootstrap + rotation paths.
5. **Citation normalisation** — 16 total drift instances fixed:
   - 15 × `OWASP ASVS L2 V<N>` → `OWASP ASVS L2 v5.0 V<N>` (single `replace_all` since the literal prefix is uniquely drift).
   - 1 × `GDPR Article 32` → `GDPR Art. 32` in the compliance posture footer.
   - 0 × `ISO 27001 ` (without `:2022`) drift — already clean.
   - 0 × `SOC2` (without space) drift — already clean.

### docs/CONTROL_MATRIX.md — DOC-04 skeleton (commit `fb09246`)

100-line skeleton with:

- Frontmatter (Last-updated / Owner / Source pointer to SECURITY.md / Compliance-posture pointer to the `credible, not certified` footer).
- How-to-use orientation block: row-lookup convention + 4 canonical citation short-forms + PENDING-OPERATOR convention + paths-no-line-numbers rule.
- 15 REQ-prefix section anchors in alphabetical order: **AUDIT / AUTH / BACKUP / CODE / DATA / DOC / FN / GDPR / HOST / LIFE / OBS / RULES / TEST / TOOL / WALK** — each carrying an empty 5-column table header (REQ | Control | Code Path(s) | Test / Evidence | Framework).
- Closing population-status note explaining Wave 6 row-fill cadence.

Heading count: `grep -c "^## " docs/CONTROL_MATRIX.md` returns **16** (1 How-to-use + 15 REQ categories — meets the `>= 16` verification gate).

### TDD doc-shape tests (commit `4c95516`)

Two new test files (66 + 55 lines), 9 total assertions, mirroring the regex-over-file-body pattern from `tests/build/source-map-gate.test.js`:

**tests/security-md-toc.test.js** (5 cases):

1. `## Table of Contents` heading within first 50 lines.
2. ToC contains anchor links for 5 sampled sections (3 new + 2 existing).
3. Exactly ONE `## § Vulnerability Disclosure Policy` heading.
4. Exactly ONE `## § MFA Recovery Procedure` heading.
5. Exactly ONE `## § Rotation Schedule` heading.

**tests/security-md-citation-format.test.js** (4 cases):

1. Zero bare `OWASP ASVS L2 V<digit>` (missing `v5.0`).
2. Zero `ISO 27001 ` without `:2022`.
3. Zero `SOC2` (no space).
4. Zero `GDPR Article <digit>` long-form.

## TDD Gate Compliance

- **RED gate** (commit `4c95516`): Both test files authored with NO source edits. `npm test --run security-md-toc security-md-citation-format` produced **7 failures / 2 passes** (5 ToC + 2 citation drift = 7 expected fails; SOC 2 + ISO drift already clean = 2 expected passes). RED gate verified before any SECURITY.md edit.
- **GREEN gate** (commit `30f104e`): All edits landed in a single follow-up commit. Re-run produced **9 passes / 0 failures**. Full-suite `npm test`: 493 passed + 6 skipped (was 484 + 6 pre-Wave; +9 from the new tests; zero regressions).

Conventional Commits prefixes used: `test(11-01)` for the RED commit, `docs(11-01)` for the GREEN + skeleton commits. Matches the project's TDD-test-then-implementation pattern.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Doc-shape tests GREEN | `npm test --run security-md-toc security-md-citation-format` | 9/9 PASS |
| Full suite zero regressions | `npm test` | 493 passed + 6 skipped (was 484 + 6) |
| Compliance posture footer untouched | `git diff SECURITY.md \| grep -E '^[-+].*credible.*not certified'` | 0 hits |
| SECURITY.md line growth | `wc -l SECURITY.md` | 1278 → 1392 (+114) |
| ToC visible at top | `head -50 SECURITY.md` | ToC structure visible |
| CONTROL_MATRIX skeleton shape | `grep -c "^## " docs/CONTROL_MATRIX.md` | 16 (meets `>= 16`) |
| 15 REQ-prefix anchors present | `grep -E "^## (AUDIT\|AUTH\|...\|WALK)" docs/CONTROL_MATRIX.md` | All 15 present, alphabetical |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Resolved internal conflict in the plan between "preserve footer verbatim" and "replace `GDPR Article ` → `GDPR Art. ` everywhere"**

- **Found during:** Task 2 Step 5 (citation normalisation).
- **Issue:** Plan `<behavior>` block line 200 says lines 1271-1278 must be preserved VERBATIM; Action Step 5 says replace `GDPR Article ` → `GDPR Art. ` everywhere; Task 1 RED test asserts zero `GDPR Article \d` hits across the entire file. These three constraints conflict on the literal `GDPR Article 32` token in the compliance posture footer.
- **Fix:** Rewrote `GDPR Article 32` → `GDPR Art. 32` on line 1389 (was 1274). Rationale: (a) the verification gate `git diff SECURITY.md | grep credible.*not certified` only protects the substantive "credible, not certified" boilerplate sentence — which is on a different line and untouched; (b) the citation-form change preserves all substantive claims; (c) without this change the GREEN gate fails Test 4. Confirmed via `git diff`: zero `credible.*not certified` line changes.
- **Files modified:** SECURITY.md (footer line only)
- **Documented as decision D-11-01-02 in this SUMMARY's frontmatter.**

**2. [Rule 3 — Blocking issue] Plan Action Step 4 placed § Rotation Schedule "BEFORE the next `## §`" but the next heading after § Secret Scanning is `## Sections planned for later phases` (not a `## §` section)**

- **Found during:** Task 2 Step 4 placement.
- **Issue:** § Secret Scanning ends at line 396 (post-edit); the next heading is `## Sections planned for later phases` on line 400. This is a Phase 1 stubs index, not a `## §` content section.
- **Fix:** Inserted § Rotation Schedule between line 397 (end of § Secret Scanning evidence) and line 398 (the `---` separator preceding `## Sections planned for later phases`). Functionally equivalent to "before the next ##" — preserves source-order ToC enumeration.
- **Files modified:** SECURITY.md (insertion only)
- **Tracked as a placement clarification, not a structural deviation.**

### Architectural decisions

None — Rule 4 not triggered. All edits stayed within the structural contract specified by the plan's `<interfaces>` block (existing 34 `## §` sections preserved in source order; 3 new sections added at the placement boundaries specified).

### Out-of-scope discoveries

None deferred. The only pre-existing PENDING-OPERATOR markers are intentional substrate-honest disclosures inherited from Phases 6/8/9/10; Phase 11 surfaces them in the new sections but does not attempt to resolve them.

## Known Stubs

None blocking the plan goal:

- `docs/CONTROL_MATRIX.md` ships with 15 empty REQ-prefix tables (zero data rows). **Intentional + plan-contracted** — frontmatter explicitly states "rows populated Wave 6". Section anchors are immediately usable as cross-reference targets for Waves 2-5.
- The MFA Recovery Procedure section references `docs/evidence/phase-6-mfa-recovery-drill-pass.png` as **PENDING-OPERATOR**. **Intentional substrate-honest disclosure** per Pitfall 19 — the runbook + script exist; the drill capture is queued in the end-of-phases user-testing batch per Phase 6 operator deferral. Pointer to `.planning/phases/06-real-auth-mfa-rules-deploy/06-RESUME-NOTE.md` provided.

## Threat Flags

None. Documentation-only changes; no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Commits

| Task | Description | Hash | Files |
|------|-------------|------|-------|
| 1 | TDD RED — author 2 shape test files | `4c95516` | tests/security-md-toc.test.js (new); tests/security-md-citation-format.test.js (new) |
| 2 | DOC-01 GREEN — ToC + 3 promoted sections + 16 citation normalisations | `30f104e` | SECURITY.md |
| 3 | DOC-04 skeleton — CONTROL_MATRIX.md with 15 REQ-prefix anchors | `fb09246` | docs/CONTROL_MATRIX.md (new) |

## Self-Check: PASSED

- `SECURITY.md` — FOUND
- `docs/CONTROL_MATRIX.md` — FOUND
- `tests/security-md-toc.test.js` — FOUND
- `tests/security-md-citation-format.test.js` — FOUND
- commit `4c95516` — FOUND in git log
- commit `30f104e` — FOUND in git log
- commit `fb09246` — FOUND in git log
