---
phase: 11-documentation-pack-evidence-pack
plan: 02
subsystem: documentation
tags: [docs, doc-02, privacy-md, sub-processors, residency, gdpr-dsr, tdd-doc-shape, pitfall-19]
dependency-graph:
  requires: [Phase 11 Plan 11-01 close — DOC-04 CONTROL_MATRIX.md skeleton + SECURITY.md ToC anchors usable as cross-reference targets]
  provides:
    - "DOC-02 canonical sub-processor + residency + retention-summary + DSR-flow document at repo root"
    - "Verification audit trail for A1 + A3 + Google Fonts + Sentry EU + Sentry DPA URL (5 gates)"
    - "Forward-tracking rows F-DOC-02-A1 + F-DOC-02-A3 queued for Wave 6 cleanup ledger"
    - "Cross-reference anchor `## 5. Data subject rights` for SECURITY.md § GDPR future increment"
  affects:
    - PRIVACY.md (new at repo root)
    - tests/privacy-md-shape.test.js (new)
    - .planning/phases/11-documentation-pack-evidence-pack/11-02-VERIFICATION-LOG.md (new)
tech-stack:
  added: []
  patterns: ["regex-over-file-body doc-shape tests (mirrors tests/security-md-toc.test.js Wave 1 pattern)"]
key-files:
  created:
    - PRIVACY.md
    - tests/privacy-md-shape.test.js
    - .planning/phases/11-documentation-pack-evidence-pack/11-02-VERIFICATION-LOG.md
    - .planning/phases/11-documentation-pack-evidence-pack/11-02-SUMMARY.md
  modified: []
decisions:
  - id: D-11-02-01
    decision: "Take the plan's authorised PENDING-OPERATOR + ASSUMED-PER-A3 annotation paths instead of stopping the wave when non-interactive gcloud auth refresh failed across all 3 accounts"
    rationale: "The plan ESCALATE branch (line 117) was scoped to 'region OTHER than europe-west2'; the actual situation (no region returned at all due to auth refresh failure) is a strictly stronger ESCALATE class. The plan's parallel <action> tree (lines 232-234) explicitly authorises ASSUMED-PER-A3 + PENDING-OPERATOR annotations when verification commands cannot run, with paste-ready operator commands queued. Substrate-honest disclosure (Pitfall 19) is preserved: every region claim is either VERIFIED or annotated, never plain assertion. Cleanup-ledger forward-tracking rows F-DOC-02-A1 + F-DOC-02-A3 capture the operator-pending verifications."
  - id: D-11-02-02
    decision: "Author Test 8 (Pitfall 19 forbidden-words) with negation-tolerant regex `\\b(?<!non-)(?<!not\\s)(compliant|certified)\\b`"
    rationale: "The project's canonical phrasing is 'credible, not certified' (CLAUDE.md locked decision). A blanket /\\b(compliant|certified)\\b/i match would fail on the negation forms the project deliberately uses. Lookbehind exclusion of `non-` and `not ` preserves both the forbidden-words gate AND the canonical negation phrasing."
metrics:
  duration: "777 seconds (~12m 57s)"
  duration-iso: "PT12M57S"
  start: "2026-05-10T21:32:43Z"
  end: "2026-05-10T21:45:40Z"
  tasks-completed: 3
  files-created: 4
  files-modified: 0
  commits: 3
  test-cases-added: 8
  test-cases-passing: "501 passed + 6 skipped (full suite); was 493 + 6 pre-Wave-2 (+8 from privacy-md-shape)"
  verification-gates-pass: "3 of 5 (Google Fonts negative + Sentry EU + Sentry DPA URL)"
  verification-gates-pending-operator: "2 of 5 (A1 Cloud Storage region + A3 Identity Platform region — both bundleable into the existing operator deferred-checkpoint cluster)"
  completed: "2026-05-10"
---

# Phase 11 Plan 02: PRIVACY.md (DOC-02) — Sub-processors + Residency + DSR Flow Summary

DOC-02 canonical privacy document landed at repo root with the 7-section structure from RESEARCH.md Pattern 2; sub-processor table carries exactly two vendor rows (Google LLC + Functional Software Inc.) with three verbatim DPA URLs; Google Fonts is verifiably disclaimed; the GDPR DSR flow cites both Phase 8 callables and the Art. 12(3) 30-day SLA; every residency claim is either **VERIFIED** with citation or annotated **PENDING-OPERATOR** / **ASSUMED-PER-A3** with the exact resolution path. 8-case doc-shape test gate locks the contract.

## One-liner

Phase 11 Wave 2 — DOC-02 PRIVACY.md authored with substrate-honest annotation pattern (Pitfall 19): A1 + A3 hit non-interactive gcloud-auth blockers, both annotated and forward-tracked rather than asserted; 3 PASS verifications cited inline; doc-shape gate (8 cases) GREEN.

## What Landed

### `.planning/phases/11-documentation-pack-evidence-pack/11-02-VERIFICATION-LOG.md` — A1 + A3 + Fonts + Sentry verification audit trail (commit `9d3dcc2`)

286 lines, 8 `## ` sections (gate ≥5):

1. **A1 — Cloud Storage Region.** `gcloud storage buckets describe gs://bedeveloped-base-layers.firebasestorage.app` failed with `Reauthentication failed. cannot prompt during non-interactive execution` on the `business@bedeveloped.com` account; `hugh@assume-ai.com` had the same auth-refresh failure; `lukebadiali@gmail.com` lacked `storage.buckets.get` IAM. Decision: **ESCALATE → PENDING-OPERATOR** with paste-ready operator command + forward-tracking row `F-DOC-02-A1`.
2. **A3 — Identity Platform Region.** `gcloud identity-platform config describe` returned `Invalid choice: 'identity-platform'` (not in root namespace); `gcloud alpha identity-platform` requires interactive `alpha` component install. Decision: **ASSUMED-PER-A3** with Firebase Console verification URL + forward-tracking row `F-DOC-02-A3` (matches Phase 6 D-09 Console-only verification precedent).
3. **Google Fonts negative.** Live-site `curl -s https://baselayers.bedeveloped.com | grep -ci "fonts.googleapis.com|fonts.gstatic.com"` returned `0`. Source/config grep returned no output. **PASS.**
4. **Sentry EU residency.** Two confirming hits: `vite.config.js:36` carries `url: "https://de.sentry.io/"`; `src/observability/sentry.js:9` documents `*.ingest.de.sentry.io` DSN form. **PASS.**
5. **Sentry DPA URL liveness.** `curl -sIL https://sentry.io/legal/dpa/` returned `HTTP/1.1 200 OK` direct (no redirect). **PASS.**
6. **Summary table** + **Escalations E1 (non-interactive gcloud auth refresh failure across all available accounts)** + **Decision Gate for Task 2** sections close the log.

The escalation E1 explicitly bundles A1 + A3 into the existing operator deferred-checkpoint cluster (Phase 8 + Phase 9 + Phase 10) for ~3 min marginal-cost resolution.

### `tests/privacy-md-shape.test.js` — DOC-02 doc-shape gate (commit `e5b6684`, RED → GREEN)

117 lines, 1 describe block, 8 it() cases mirroring `tests/security-md-toc.test.js` regex-over-file-body pattern:

1. PRIVACY.md exists at repo root with non-trivial body (`>500` chars).
2. All 7 required `## N.` numbered sections present (`## 1.` through `## 7.`).
3. Section 2 sub-processor table contains exactly 2 vendor rows (count by filtering delimiter rows + subtracting header).
4. Section 2 explicitly disclaims Google Fonts via positive-form `Not a sub-processor|no longer a sub-processor` match.
5. Section 3 cites `europe-west2` at least twice (Firestore + Functions verified).
6. Section 2 contains 3 verbatim DPA URLs (`cloud.google.com/terms/data-processing-addendum` + `firebase.google.com/terms/data-processing-terms` + `sentry.io/legal/dpa/`).
7. Section 5 cites both `gdprExportUser` + `gdprEraseUser` callables + `30 days` + `Art. 12(3)`.
8. Pitfall 19 forbidden-words check: zero `compliant` / `certified` hits outside backtick code spans, with negation-tolerant regex (`(?<!non-)(?<!not\s)`) preserving the project's canonical "credible, not certified" phrasing (D-11-02-02).

A `sliceSection(srcText, sectionNumber)` helper extracts each `## N.` block to its boundary for targeted assertions.

### `PRIVACY.md` — DOC-02 canonical document at repo root (commit `a2eeefc`, GREEN)

112 lines, 7-section canonical structure:

- **Front-matter.** Last-updated 2026-05-10, maintainer security@bedeveloped.com, Related-documents pointer (SECURITY.md / RETENTION.md / CONTROL_MATRIX.md), explicit verification audit-trail pointer.
- **§ 1. Data we process.** Three classes (client diagnostic / user account / operational); explicit no-PCI / no-Art.9-special-category statement.
- **§ 2. Sub-processors.** Two-row table — Google LLC + Functional Software Inc. — with VERIFIED-vs-PENDING-OPERATOR-vs-ASSUMED-PER-A3 annotations on each region cell. Google Fonts disclaimer paragraph cites live-curl `0` hits + source-grep no-output + `firebase.json` line 22 CSP allowlist evidence.
- **§ 3. Data residency.** Six bullet rows (Firestore VERIFIED 2026-05-08 + Functions europe-west2 + Cloud Storage PENDING-OPERATOR with paste-ready gcloud command + Identity Platform ASSUMED-PER-A3 with Firebase Console URL + Cloud Logging follows function region + Sentry EU); cross-references the verification log.
- **§ 4. Retention.** One-paragraph orientation + four bullet summaries + `See docs/RETENTION.md` link (RESEARCH.md Open Question 6 recommendation: link only, no duplication).
- **§ 5. Data subject rights.** Art. 15 (gdprExportUser callable + V4 signed URL 24h TTL + server entry point + client wrapper); Art. 17 (gdprEraseUser callable + cascade + tombstone + Pitfall 11 audit-log carve-out); Art. 21 (out-of-band email); 30-day SLA per Art. 12(3) with one-time 60-day extension.
- **§ 6. International transfers.** Bullet enumeration of each sub-processor + region + transfer basis (SCCs incorporated by reference into DPAs).
- **§ 7. Contact.** `security@bedeveloped.com` + 30-day Art. 12(3) commitment + cross-reference to SECURITY.md § Vulnerability Disclosure Policy + Wave 5 `/.well-known/security.txt`.

## TDD Gate Compliance

- **RED gate** (commit `e5b6684`): test file authored with NO PRIVACY.md present. `npx vitest run tests/privacy-md-shape.test.js` produced `Test Files 1 failed` with `ENOENT: no such file or directory, open '...PRIVACY.md'`. The describe block fails at module load (intentional: readFileSync at describe scope) — this is the canonical RED signal for a "file does not exist yet" doc-shape test.
- **GREEN gate** (commit `a2eeefc`): PRIVACY.md authored. Re-run produced **8/8 pass**. Full-suite `npx vitest run`: **501 passed + 6 skipped** (was 493 + 6 pre-Wave-2; +8 from privacy-md-shape; zero regressions across 70 other test files).

Conventional Commits prefixes: `docs(11-02)` for the verification log and the GREEN PRIVACY.md commits; `test(11-02)` for the RED commit.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Doc-shape tests GREEN | `npx vitest run tests/privacy-md-shape.test.js` | 8/8 PASS |
| Full suite zero regressions | `npx vitest run` | 501 passed + 6 skipped (was 493 + 6) |
| PRIVACY.md exists | `test -f PRIVACY.md && wc -l PRIVACY.md` | 112 lines (within plan's 80-150 expected) |
| europe-west2 ≥ 2 hits | `grep -c "europe-west2" PRIVACY.md` | 6 (Firestore + Functions VERIFIED + Storage PENDING-OPERATOR target + 3 inline residency-section/transfers-section cites) |
| Substrate-honest annotation pattern present | `grep -c "ASSUMED-PER\|VERIFIED" PRIVACY.md` | 5 (≥ 1 required) |
| Verification log shape | `grep -c "^## " 11-02-VERIFICATION-LOG.md` | 8 (≥ 5 required) |
| Verification log line count | `wc -l 11-02-VERIFICATION-LOG.md` | 286 lines |

## Resolved-Assumption Verdict (per plan `<output>` block)

| Assumption | Verdict | Resolution path in PRIVACY.md |
|------------|---------|-------------------------------|
| A1 — Cloud Storage region | **PENDING-OPERATOR** (non-interactive gcloud auth refresh failure across all 3 accounts) | Sections 2 + 3 + 6 carry `**PENDING-OPERATOR**` annotation + paste-ready `gcloud auth login + gcloud storage buckets describe` command; forward-tracking row `F-DOC-02-A1` queued |
| A3 — Identity Platform region | **ASSUMED-PER-A3** (gcloud root namespace lacks `identity-platform`; `alpha` component install requires interactive) | Sections 2 + 3 + 6 carry `**ASSUMED-PER-A3**` annotation + Firebase Console URL `https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/settings`; forward-tracking row `F-DOC-02-A3` queued |
| Google Fonts negative | **VERIFIED** (live curl + source grep both returned 0 hits) | Section 2 disclaimer paragraph cites both verifications inline |
| Sentry EU residency | **VERIFIED** (`vite.config.js:36` + `src/observability/sentry.js:9` grep) | Section 2 region cell + Section 6 transfers row both cite the file:line evidence |
| Sentry DPA URL liveness | **VERIFIED** (`HTTP/1.1 200 OK` direct, no redirect) | Section 2 vendor row cites `https://sentry.io/legal/dpa/` verbatim |

**DPA URL liveness statuses (per plan `<output>` block):**

- `https://cloud.google.com/terms/data-processing-addendum` — **CITED** (URL form per RESEARCH.md verbatim; not curl-tested in this wave; routine Google legal page)
- `https://firebase.google.com/terms/data-processing-terms` — **CITED** (URL form per RESEARCH.md verbatim; not curl-tested in this wave)
- `https://sentry.io/legal/dpa/` — **CURL-VERIFIED LIVE** (`HTTP/1.1 200 OK` direct; `age: 182433` indicates stable Vercel-cached page)

**Sub-processor table row count (per plan `<output>` block):** 2 vendor rows. Verified by Test 3 of the doc-shape suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Non-interactive gcloud auth-refresh failure across all 3 available accounts (A1)**

- **Found during:** Task 1 — first attempt at `gcloud storage buckets describe` returned `Reauthentication failed. cannot prompt during non-interactive execution`.
- **Issue:** All three gcloud accounts in this executor environment hit either auth-refresh failure (`business@bedeveloped.com`, `hugh@assume-ai.com`) or IAM denial (`lukebadiali@gmail.com` lacks `storage.buckets.get`). The plan's ESCALATE-branch wording (line 117) was scoped to "region OTHER than `europe-west2`" — it did not cover "no region returned at all". This is a strictly stronger ESCALATE class.
- **Fix:** Take the plan's parallel `<action>` tree authorisation (lines 232-234) — annotate `**PENDING-OPERATOR**` in PRIVACY.md Sections 2 + 3 + 6 with paste-ready operator command + forward-tracking row `F-DOC-02-A1` for Wave 6 cleanup ledger. Substrate-honest disclosure (Pitfall 19) preserved: no claim shipped as fact; resolution path explicit. Document the verdict + escalation E1 in the verification log.
- **Files modified:** `.planning/phases/11-documentation-pack-evidence-pack/11-02-VERIFICATION-LOG.md` (new); `PRIVACY.md` (annotation cells in Sections 2 + 3 + 6).
- **Commit:** `9d3dcc2` (verification log) + `a2eeefc` (PRIVACY.md cells).
- **Documented as decision D-11-02-01 in this SUMMARY's frontmatter.**

**2. [Rule 3 — Blocking issue] Identity Platform CLI surface absent from gcloud root namespace (A3)**

- **Found during:** Task 1 — `gcloud identity-platform config describe` returned `Invalid choice: 'identity-platform'`; fallback to `gcloud alpha identity-platform` required interactive `alpha` component install (`Cannot use bundled Python installation to update Google Cloud CLI in non-interactive mode`); fallback to `firebase apps:list` required firebase CLI which is not on this executor's PATH.
- **Issue:** The plan's primary verify command path was unrecoverable in non-interactive mode. The plan explicitly anticipated this (lines 122-127) and authorised the **ASSUMED-PER-A3** annotation path with Firebase Console URL fallback.
- **Fix:** Take the plan-authorised path verbatim — annotate `**ASSUMED-PER-A3**` in PRIVACY.md Sections 2 + 3 + 6 with `https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/settings` URL + forward-tracking row `F-DOC-02-A3`. This matches Phase 6 D-09 Console-only verification precedent (Identity Platform upgrade was Console-only at Wave 1 for the same gcloud-surface reason).
- **Files modified:** Same as deviation 1 above.
- **Commit:** Same as deviation 1 above.
- **Not a true deviation in spirit** — the plan explicitly authorised this branch; logged here for traceability.

### Architectural decisions

None — Rule 4 not triggered. Both auto-fixes stayed within the plan's pre-authorised annotation contract (substrate-honest disclosure pattern).

### Out-of-scope discoveries

None deferred. The Phase 11 cleanup ledger does not yet exist (substrate ships in Wave 6); both forward-tracking rows `F-DOC-02-A1` + `F-DOC-02-A3` are surfaced in PRIVACY.md + the verification log inline so the Wave 6 ledger plan can lift them verbatim.

## Authentication Gates

None reached during execution. The gcloud auth-refresh failure was treated as a verification-environment blocker (Rule 3) routed to Pitfall 19 substrate-honest annotation, NOT as an auth gate requiring operator intervention mid-wave. PRIVACY.md content shipped; the operator-pending verifications are queued for the existing operator deferred-checkpoint session cluster (Phase 8 + Phase 9 + Phase 10).

## Known Stubs

None blocking the plan goal. The two `**PENDING-OPERATOR**` (A1 Cloud Storage) + `**ASSUMED-PER-A3**` (A3 Identity Platform) annotations are **intentional substrate-honest disclosures** per Pitfall 19, with explicit resolution paths queued to the operator deferred-checkpoint cluster:

- **PENDING-OPERATOR — A1 Cloud Storage region.** Annotation in PRIVACY.md Sections 2 + 3 + 6 + paste-ready `gcloud auth login` + `gcloud storage buckets describe` command. Operator updates inline once captured. Forward-tracking row `F-DOC-02-A1` queued for Wave 6 cleanup ledger.
- **ASSUMED-PER-A3 — Identity Platform region.** Annotation in PRIVACY.md Sections 2 + 3 + 6 + Firebase Console URL. Operator confirms in Console. Forward-tracking row `F-DOC-02-A3` queued.

These do NOT prevent the plan's goal (DOC-02 canonical document at repo root with substrate-honest annotations) — the plan explicitly contracted both annotation paths via lines 232-234.

## Threat Flags

None. Documentation-only changes; no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Commits

| Task | Description | Hash | Files |
|------|-------------|------|-------|
| 1 | DOC-02 verification audit trail (5 gates: 3 PASS + 2 PENDING-OPERATOR/ASSUMED-PER-A3) | `9d3dcc2` | `.planning/phases/11-documentation-pack-evidence-pack/11-02-VERIFICATION-LOG.md` (new, 286 lines) |
| 2 | TDD RED — author 8-case PRIVACY.md doc-shape test | `e5b6684` | `tests/privacy-md-shape.test.js` (new) |
| 3 | TDD GREEN — author PRIVACY.md (DOC-02 canonical) | `a2eeefc` | `PRIVACY.md` (new at repo root, 112 lines) |

## Self-Check: PASSED

- `PRIVACY.md` — FOUND
- `tests/privacy-md-shape.test.js` — FOUND
- `.planning/phases/11-documentation-pack-evidence-pack/11-02-VERIFICATION-LOG.md` — FOUND
- commit `9d3dcc2` — FOUND in git log
- commit `e5b6684` — FOUND in git log
- commit `a2eeefc` — FOUND in git log
- `npx vitest run tests/privacy-md-shape.test.js` — 8/8 PASS
- `npx vitest run` (full suite) — 501 passed + 6 skipped (zero regressions)
