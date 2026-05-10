---
phase: 11-documentation-pack-evidence-pack
plan: 03
subsystem: documentation
tags: [docs, doc-03, doc-07, threat-model, stride, data-flow, mermaid, tdd-doc-shape, pitfall-19]
dependency-graph:
  requires: [Phase 11 Plan 11-01 close — SECURITY.md ToC anchors usable as cross-reference targets; Phase 11 Plan 11-02 close — PRIVACY.md residency narrative + verification log to align Mermaid region labels]
  provides:
    - "DOC-03 canonical STRIDE threat model at repo root (4 trust boundaries + 6 categories + defence-in-depth summary)"
    - "DOC-07 canonical data-flow document under docs/ (Mermaid flowchart LR + classifications + processing regions)"
    - "Cross-reference anchors `THREAT_MODEL.md § Trust boundaries` + `THREAT_MODEL.md § Threat categories` + `docs/DATA_FLOW.md § Data classifications` + `docs/DATA_FLOW.md § Processing regions` for Wave 6 CONTROL_MATRIX row-fill + Wave 4/5 retention/IR-runbook cross-references"
  affects:
    - THREAT_MODEL.md (new at repo root)
    - docs/DATA_FLOW.md (new)
    - tests/threat-model-shape.test.js (new)
    - tests/data-flow-shape.test.js (new)
tech-stack:
  added: []
  patterns: ["regex-over-file-body doc-shape tests (mirrors tests/privacy-md-shape.test.js Wave 2 pattern)", "Mermaid flowchart LR fenced block (GitHub-native rendering; no plugin dependency)"]
key-files:
  created:
    - THREAT_MODEL.md
    - docs/DATA_FLOW.md
    - tests/threat-model-shape.test.js
    - tests/data-flow-shape.test.js
    - .planning/phases/11-documentation-pack-evidence-pack/11-03-SUMMARY.md
  modified: []
decisions:
  - id: D-11-03-01
    decision: "Mermaid `Storage[...]` node label carries `PENDING-OPERATOR<br/>recommended europe-west2` annotation rather than the verbatim RESEARCH.md template's `Cloud Storage<br/>europe-west2` label"
    rationale: "Wave 2 (Plan 11-02) Cloud Storage region verification was BLOCKED on non-interactive gcloud auth refresh across all 3 available accounts (D-11-02-01); PRIVACY.md § 3 carries `**PENDING-OPERATOR**` annotation for the Storage cell. The plan's `<action>` line 211 explicitly authorises Mermaid-label divergence when PRIVACY.md verification status diverges. Substrate-honest disclosure (Pitfall 19) preserved across all three docs: no PRIVACY-vs-DATA_FLOW-vs-THREAT_MODEL region claim is asserted as fact where the underlying verification is pending. Mermaid still renders; the longer label only adds two `<br/>` line breaks within the same node box."
  - id: D-11-03-02
    decision: "Mermaid `Auth[...]` node label carries `EU - ASSUMED-PER-A3` annotation rather than the verbatim RESEARCH.md template's `EU` label"
    rationale: "Wave 2 (Plan 11-02) Identity Platform region verification was BLOCKED on `gcloud identity-platform` absence from gcloud root namespace + `alpha` component interactive-only install (D-11-02-01 deviation 2); PRIVACY.md § 3 carries `**ASSUMED-PER-A3**` annotation. The plan's `<action>` line 211 explicitly authorises the footnote-or-label pattern in this case. Footnote below the Mermaid block + label annotation chosen to ensure auditors who skim only the diagram still see the pending-verification status. Cross-references PRIVACY.md § 3 + 11-02-VERIFICATION-LOG.md § A3 for the resolution path."
metrics:
  duration: "206 seconds (~3m 26s)"
  duration-iso: "PT3M26S"
  start: "2026-05-10T21:56:19Z"
  end: "2026-05-10T21:59:45Z"
  tasks-completed: 2
  files-created: 4
  files-modified: 0
  commits: 2
  test-cases-added: 15
  test-cases-passing: "516 passed + 6 skipped (full suite); was 501 + 6 pre-Wave-3 (+15 from threat-model + data-flow doc-shape tests)"
  threat-model-trust-boundaries: 4
  threat-model-stride-categories: 6
  data-flow-mermaid-nodes: 8
  data-flow-mermaid-edges: 10
  data-flow-europe-west2-citations: 9
  cross-doc-residency-consistency: "VERIFIED (15 europe-west2 hits across PRIVACY.md + DATA_FLOW.md + THREAT_MODEL.md; all same region for the same nouns)"
  mermaid-render-verification: "PENDING-OPERATOR (manual visual check on GitHub PR view — surfaced per plan <output> block, not a blocking gate; doc-shape test only validates structure)"
  completed: "2026-05-10"
---

# Phase 11 Plan 03: THREAT_MODEL.md (DOC-03) + docs/DATA_FLOW.md (DOC-07) Summary

DOC-03 STRIDE threat model + DOC-07 Mermaid data-flow diagram landed at repo root and docs/ respectively; both are auditor-facing syntheses of substrate already shipped under SECURITY.md + per-phase plan `<threat_model>` blocks. 15-case doc-shape gate (8 + 7) locks structural contract; cross-document residency consistency with PRIVACY.md preserved via PENDING-OPERATOR + ASSUMED-PER-A3 annotations on Mermaid node labels.

## One-liner

Phase 11 Wave 3 — DOC-03 STRIDE threat model (4 trust boundaries + 6 categories T1-T6 each with Threat / Mitigations / Evidence sub-blocks + 6-layer defence-in-depth table) + DOC-07 Mermaid `flowchart LR` (8 nodes / 10 edges / 4-row classifications table / 4-bullet processing-regions list) authored with Mermaid-label substrate-honest disclosure mirroring Wave 2 PRIVACY.md residency annotations.

## What Landed

### `THREAT_MODEL.md` — DOC-03 STRIDE threat model at repo root (commit `1bf9c54`)

86-line synthesis document, 7 `## ` top-level sections (Trust boundaries / Threat categories / Defence in depth summary + 4 narrative subsections under Threat categories for the 6 categories grouped under one heading per RESEARCH.md Pattern 3):

- **Front-matter.** Last-updated 2026-05-10 / Methodology STRIDE (5-word category gloss) / Scope (production app + Firebase project + source repo) / Posture sentence ("Aligned to OWASP ASVS L2 v5.0, ISO/IEC 27001:2022 Annex A, SOC 2 CC6/CC7, and GDPR Art. 32 — credible, not certified") preserving the project's canonical compliance-posture phrasing.
- **§ Trust boundaries.** 4 numbered items: (1) Browser ↔ Firebase backplane (TLS / HSTS / CSP / App Check); (2) Firebase Auth ↔ Cloud Functions / Firestore / Storage (ID tokens / custom claims / `beforeUserCreated` + Phase 6 D-09 Path B); (3) Cloud Functions ↔ external services (Sentry EU egress / Slack `#ops` webhook / BigQuery 7y archive / Identity Platform); (4) Operator ↔ Firebase Console / GCP Console (Google account + 2FA / OIDC-federated GitHub Actions / no long-lived service-account JSON).
- **§ Threat categories.** Six `### T1.` through `### T6.` sub-headings — Authentication bypass / Tenant boundary breach (cross-org IDOR) / File upload abuse / Denial of wallet / Supply-chain compromise / Insider misuse — each with `**Threat:**` / `**Mitigations:**` / `**Evidence:**` sub-blocks. Every Evidence block cites at least one SECURITY.md section + one or more source paths.
- **§ Defence in depth summary.** 6-row markdown table (Network / Application / Data / Operational / Supply chain / Compliance) mapping each layer to the specific controls + SECURITY.md sections.
- **Closing source-artefacts paragraph.** Documents the relationship between per-phase plan `<threat_model>` blocks (granular T-N-NN-NN row IDs) and this synthesis document (auditor-facing prose); explicitly directs auditors to SECURITY.md sections for implementation details.

Pitfall 19 substrate-honest disclosure preserved throughout: every Mitigations bullet either cites a shipped control with a real path or is annotated against substrate that already exists. Zero forbidden-words hits ("compliant" / "certified" outside backtick code spans with negation-tolerant regex; only the canonical "credible, not certified" phrasing is used).

### `docs/DATA_FLOW.md` — DOC-07 Mermaid + classifications + regions (commit `1bf9c54`)

43-line document, 3 `## ` top-level sections + cross-references footer:

- **Front-matter.** Last-updated 2026-05-10 / Scope (production app + Firebase project) / Companion-documents pointer (PRIVACY.md / SECURITY.md / THREAT_MODEL.md / RETENTION.md).
- **§ Diagram.** Mermaid `flowchart LR` block with 8 named nodes (Client / Auth / Firestore / Storage / Functions / Sentry / Slack / BigQuery) + 10 labelled edges (10 ≥ 9 minimum): 5 Client→backplane edges (TLS+HSTS+CSP+App Check / claims-gated / signed URL / callable / error events) + 5 Functions→backplane edges (Admin SDK to Firestore / Admin SDK to Storage / onDocumentCreated mirror / anomaly alerts to Slack / audit-log archive to BigQuery). Two footnotes below the Mermaid block cross-reference the Storage PENDING-OPERATOR + Auth ASSUMED-PER-A3 verification paths (D-11-03-01 + D-11-03-02).
- **§ Data classifications.** 4-row table (Customer business data / User account data / Operational data / Error telemetry) × 5 columns (Class | Examples | Storage location | Encryption | Access control). Every cell either cites a shipped control or annotates PENDING-OPERATOR / ASSUMED-PER-A3 with a resolution-path pointer.
- **§ Processing regions.** 4 bulleted lines — Primary `europe-west2` (Firestore VERIFIED + Functions VERIFIED + Storage PENDING-OPERATOR) / Auth EU ASSUMED-PER-A3 / Telemetry EU `de.sentry.io` / Logs `europe-west2`. Total `europe-west2` citations across the document: 9 (gate ≥ 3 in the Processing regions slice alone).
- **Cross-references footer.** 4 bullets pointing back to PRIVACY.md § 2/3/6 + SECURITY.md § Cloud Functions Workspace / § Audit Log Infrastructure / § Observability — Sentry / § Authentication & Sessions + THREAT_MODEL.md § Trust boundaries + docs/RETENTION.md.

### TDD doc-shape tests (commit `dccf654`)

Two new test files (107 + 92 lines), 15 total assertions (8 + 7), mirroring the regex-over-file-body pattern from `tests/privacy-md-shape.test.js`:

**tests/threat-model-shape.test.js** (8 cases):

1. THREAT_MODEL.md exists at repo root with non-trivial body (>500 chars).
2. H1 heading equals `# Threat Model — Base Layers Diagnostic`.
3. `## Trust boundaries` section with at least 4 items matching `/^[1-4]\. \*\*/m`.
4. `## Threat categories` heading present.
5. Exactly 6 `### T[1-6]\. ` sub-headings (no more, no fewer).
6. Each T1-T6 slice contains all 3 sub-block markers (`**Threat:**` / `**Mitigations:**` / `**Evidence:**`).
7. `## Defen[cs]e in depth summary` (accepts both spellings) with markdown table containing ≥ 6 layer rows.
8. Pitfall 19 forbidden-words check (negation-tolerant `(?<!non-)(?<!not\s)(compliant|certified)`).

**tests/data-flow-shape.test.js** (7 cases):

1. docs/DATA_FLOW.md exists with non-trivial body (>500 chars).
2. H1 starts with `# Data Flow`.
3. Contains a ` ```mermaid ... ``` ` fenced block.
4. Mermaid block contains all 8 expected node identifiers.
5. Mermaid block contains ≥ 9 `-->` edges (actual: 10).
6. `## Data classifications` table with ≥ 4 data-class rows + spot-check class names (Customer business / User account / Operational / Error telemetry).
7. `## Processing regions` slice cites `europe-west2` ≥ 3 times.

## TDD Gate Compliance

- **RED gate** (commit `dccf654`): Both test files authored with NO source docs present. `npx vitest run tests/threat-model-shape.test.js tests/data-flow-shape.test.js` produced **2 failed Test Files / 0 tests** with `ENOENT: no such file or directory` errors at module load (intentional: `readFileSync` at describe scope) — this is the canonical RED signal for "file does not exist yet" doc-shape tests, matches Wave 2 PRIVACY.md RED pattern documented in 11-02-SUMMARY.md.
- **GREEN gate** (commit `1bf9c54`): Both documents authored in a single follow-up commit. Re-run produced **15/15 pass** (8 threat-model + 7 data-flow). Full-suite `npx vitest run`: **516 passed + 6 skipped** (was 501 + 6 pre-Wave-3; +15 from the new tests; zero regressions across 71 prior test files).

Conventional Commits prefixes used: `test(11-03)` for the RED commit, `docs(11-03)` for the GREEN commit. Matches the project's TDD-test-then-implementation pattern documented across Phases 6-11.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Doc-shape tests GREEN | `npx vitest run tests/threat-model-shape.test.js tests/data-flow-shape.test.js` | 15/15 PASS (8 + 7) |
| Full suite zero regressions | `npx vitest run` | 516 passed + 6 skipped (was 501 + 6) |
| THREAT_MODEL.md exists at repo root | `test -f THREAT_MODEL.md` | PASS |
| docs/DATA_FLOW.md exists | `test -f docs/DATA_FLOW.md` | PASS |
| Exactly 6 STRIDE T-headings | `grep -c "^### T[1-6]\." THREAT_MODEL.md` | 6 (gate: == 6) |
| `europe-west2` ≥ 3 hits in DATA_FLOW.md | `grep -c "europe-west2" docs/DATA_FLOW.md` | 9 (gate: ≥ 3) |
| Mermaid edge count ≥ 9 | `awk '/^\`\`\`mermaid$/,/^\`\`\`$/' docs/DATA_FLOW.md \| grep -c -- "-->"` | 10 (gate: ≥ 9) |
| 8 Mermaid node identifiers present | (per-node `grep -c` inside the mermaid block) | 8/8 (1 each: Client / Auth / Firestore / Storage / Functions / Sentry / Slack / BigQuery) |
| Forbidden-words gate THREAT_MODEL.md | (negation-tolerant Node regex outside code spans) | 0 hits |
| Forbidden-words gate DATA_FLOW.md | (negation-tolerant Node regex outside code spans) | 0 hits |
| Cross-doc `europe-west2` consistency | `grep "europe-west2" PRIVACY.md docs/DATA_FLOW.md THREAT_MODEL.md \| wc -l` | 15 hits across 3 docs; all same region for the same nouns |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue + Pitfall 19 substrate-honest preservation] Mermaid Storage + Auth node labels diverge from verbatim RESEARCH.md Pattern 4 template**

- **Found during:** Task 2 — composing the Mermaid block.
- **Issue:** The RESEARCH.md verbatim template ships `Storage[Cloud Storage<br/>europe-west2]` and `Auth[Firebase Auth<br/>Identity Platform<br/>EU]`, but Wave 2 (Plan 11-02) PRIVACY.md verification status for both regions diverges: Storage is `**PENDING-OPERATOR**` (D-11-02-01 — non-interactive gcloud auth refresh failure across all 3 accounts); Identity Platform is `**ASSUMED-PER-A3**` (D-11-02-01 deviation 2 — `gcloud identity-platform` absent from root namespace; `alpha` interactive-only). Shipping the verbatim template would assert as fact what PRIVACY.md correctly annotates as pending. The plan `<action>` line 211 explicitly authorises Mermaid-label divergence in exactly this case: *"If PRIVACY.md found a different Storage region, update the Mermaid Storage node label AND the Processing regions line to reflect that"* + *"If PRIVACY.md left A3 ASSUMED-PER-A3, the Mermaid Auth node retains `Auth[Firebase Auth<br/>Identity Platform<br/>EU]` but add a footnote below the Mermaid block."*
- **Fix:** Mermaid `Storage[Cloud Storage<br/>PENDING-OPERATOR<br/>recommended europe-west2]` + Mermaid `Auth[Firebase Auth<br/>Identity Platform<br/>EU - ASSUMED-PER-A3]` + two footnotes below the diagram cross-referencing PRIVACY.md § 3 and 11-02-VERIFICATION-LOG.md § A1 + § A3 for the resolution paths. § Processing regions bullet for the Primary line carries `Cloud Storage (PENDING-OPERATOR verification — recommended europe-west2 per project configuration pattern, see PRIVACY.md § 3)` consistent with the Mermaid label.
- **Files modified:** `docs/DATA_FLOW.md` (Mermaid block + footnotes + Processing regions bullet).
- **Commit:** `1bf9c54`.
- **Documented as decisions D-11-03-01 + D-11-03-02 in this SUMMARY's frontmatter.**
- **Test 7 gate preserved:** `europe-west2` hit count in the Processing regions slice is 5 (Firestore + Functions + Storage recommended + Logs + Primary header), well above the ≥ 3 minimum; full-document count is 9.

### Architectural decisions

None — Rule 4 not triggered. Both auto-fixes stayed within the plan's pre-authorised `<action>` line 211 contingency contract.

### Out-of-scope discoveries

None deferred. The two pre-existing PENDING-OPERATOR / ASSUMED-PER-A3 substrate-honest annotations carried forward from Wave 2 (PRIVACY.md A1 + A3) are now mirrored in the Wave 3 documents per the plan's residency-consistency requirement; both already have forward-tracking rows `F-DOC-02-A1` + `F-DOC-02-A3` queued for Wave 6 cleanup ledger and the existing operator deferred-checkpoint cluster.

## Authentication Gates

None reached during execution. No external API calls, no auth flows triggered — Wave 3 is purely documentation authoring with substrate already present in code + tests + runbooks.

## Known Stubs

None blocking the plan goal. The PENDING-OPERATOR (Storage) + ASSUMED-PER-A3 (Identity Platform) annotations in the Mermaid node labels + Processing regions bullets + Data classifications table cells are **intentional substrate-honest disclosures** per Pitfall 19, inherited from Wave 2 PRIVACY.md and forward-tracked via the same `F-DOC-02-A1` + `F-DOC-02-A3` rows queued for the Wave 6 cleanup ledger. These do NOT prevent the plan's goal — DOC-03 + DOC-07 canonical documents shipped with substrate-honest annotations per the plan's explicit `<action>` line 211 contingency authorisation.

## Threat Flags

None. Documentation-only changes; no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Commits

| Task | Description | Hash | Files |
|------|-------------|------|-------|
| 1 | TDD RED — author 15-case threat-model + data-flow doc-shape tests | `dccf654` | `tests/threat-model-shape.test.js` (new); `tests/data-flow-shape.test.js` (new) |
| 2 | TDD GREEN — author THREAT_MODEL.md (DOC-03) + docs/DATA_FLOW.md (DOC-07) | `1bf9c54` | `THREAT_MODEL.md` (new at repo root); `docs/DATA_FLOW.md` (new) |

## Output (per plan `<output>` block)

| Metric | Value |
|--------|-------|
| Trust boundary count | 4 (Browser ↔ Firebase backplane / Firebase Auth ↔ Functions+Firestore+Storage / Functions ↔ external services / Operator ↔ Firebase+GCP Console) |
| Threat category count | 6 (T1 Authentication bypass / T2 Tenant boundary breach / T3 File upload abuse / T4 Denial of wallet / T5 Supply-chain compromise / T6 Insider misuse) |
| Mermaid node count | 8 (Client / Auth / Firestore / Storage / Functions / Sentry / Slack / BigQuery) |
| Mermaid edge count | 10 (≥ 9 required) |
| Mermaid render verification | **PENDING-OPERATOR** — manual visual check on GitHub PR view (the doc-shape test validates structure only, not visual rendering). GitHub renders ` ```mermaid ` fenced blocks server-side per project A6 assumption (RESEARCH.md). Operator confirms rendering at PR review time. |
| Commits | `dccf654` (RED — test) + `1bf9c54` (GREEN — docs) |

## Self-Check: PASSED

- `THREAT_MODEL.md` — FOUND
- `docs/DATA_FLOW.md` — FOUND
- `tests/threat-model-shape.test.js` — FOUND
- `tests/data-flow-shape.test.js` — FOUND
- commit `dccf654` — FOUND in git log
- commit `1bf9c54` — FOUND in git log
- `npx vitest run tests/threat-model-shape.test.js tests/data-flow-shape.test.js` — 15/15 PASS
- `npx vitest run` (full suite) — 516 passed + 6 skipped (zero regressions)
