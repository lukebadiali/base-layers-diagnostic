---
phase: 12-audit-walkthrough-final-report
plan: 01
subsystem: docs
tags: [audit, walkthrough, translation, firebase, security_audit, walk-01, doc_only]
requirements: [WALK-01]
dependency_graph:
  requires:
    - "SECURITY_AUDIT.md (source — Vercel/Supabase-shaped 697-line audit framework)"
    - "SECURITY.md (Phase 11 canonical pass — section anchors are the Firebase-equivalent column targets)"
    - "docs/CONTROL_MATRIX.md (Phase 11 88-row catalogue — REQ-ID anchors are the Firebase-equivalent column targets)"
    - "tests/threat-model-shape.test.js (pattern source for doc-shape Vitest regex-over-file-body)"
    - "tests/security-md-paths-exist.test.js (pattern source for Pitfall 19 negation-tolerant forbidden-words regex)"
  provides:
    - "docs/SECURITY_AUDIT_TRANSLATION.md (WALK-01 Pattern 1 per-section translation map — source-order walk of SECURITY_AUDIT.md sections 1-15)"
    - "tests/security-audit-translation-shape.test.js (4-case doc-shape schema gate — file existence + section coverage + N/A rationale presence + Pitfall 19 forbidden-words)"
    - "Phase 12 Plan 12-02 substrate (SECURITY_AUDIT_REPORT.md authoring anchor)"
  affects:
    - "Phase 12 Plan 12-02 (Wave 2 SECURITY_AUDIT_REPORT.md executive summary + body) — unblocked"
    - "Phase 12 Plan 12-03 (Wave 3 SECURITY_AUDIT_REPORT.md sign-off checklist) — unblocked downstream of 12-02"
    - "Phase 12 Plan 12-04 (Wave 4 SECURITY.md § Phase 12 Audit Index + path-existence sweep extension) — unblocked downstream of 12-03"
tech_stack:
  added:
    - "(none — documentation + Vitest schema-gate only; pattern reuse of Phase 11 Wave 3 doc-shape tests)"
  patterns:
    - "Pattern 1 (12-RESEARCH.md): hand-authored per-section translation table, source-order walk, paths-only citations"
    - "Pitfall 19 substrate-honest disclosure: negation-tolerant lookbehind regex preserves canonical 'Not certified' phrasing while gating positive-form 'compliant' / 'certified' outside code spans"
    - "Doc-shape gate pattern: readFileSync + body-regex assertions (mirror tests/threat-model-shape.test.js shape)"
key_files:
  created:
    - "docs/SECURITY_AUDIT_TRANSLATION.md (257 lines, per-section walk of SECURITY_AUDIT.md sections 1-15 inclusive)"
    - "tests/security-audit-translation-shape.test.js (67 lines, 4 it() cases — file existence + section coverage + N/A rationale presence + Pitfall 19 forbidden-words)"
  modified:
    - "(none)"
decisions:
  - "D-12-01-01: Prose-token avoidance pattern — the literal 'N/A — Firebase architecture differs' appears ONLY inside markdown table cells, never in section preambles or 'How to use' prose. Prose paraphrases as 'Firebase-architecture-differs N/A' or 'not applicable on Firebase'. Test 3 enforces this contract structurally (no silent skips outside table rows = no silent skips at all)."
  - "D-12-01-02: Closing posture statement uses 'Verbatim. Not certified.' — the negation-tolerant 'Not certified' form preserves canonical project phrasing ('credible, not certified') while satisfying the Pitfall 19 lookbehind regex `\\b(?<!non-)(?<!not\\s)(compliant|certified)\\b`. Phase 11 Plan 11-02 D-11-02-02 pattern reused byte-for-byte."
  - "D-12-01-03: Two atomic commits (docs Task 1, test Task 2) preferred over the plan's optional single-commit alternative. RED-then-GREEN ordering not used because the doc landed first (no failing-test demonstration cycle needed — schema gate is structural, not behavioural)."
metrics:
  duration_minutes: 18
  task_count: 2
  file_count: 2
  completed_date: 2026-05-11
---

# Phase 12 Plan 12-01: WALK-01 Translation Map + Schema Gate Summary

**One-liner:** Lands `docs/SECURITY_AUDIT_TRANSLATION.md` — a 257-line per-section walk of `SECURITY_AUDIT.md` sections 1-15 mapping every Vercel/Supabase control to its Firebase equivalent (or an explicit Firebase-architecture-differs N/A row with rationale) — plus a 4-case Vitest schema gate that locks the doc shape against drift.

## Final state

| Artefact | Status | Size | Citation |
|---|---|---|---|
| `docs/SECURITY_AUDIT_TRANSLATION.md` | LANDED | 257 lines | Commit `32fd813` |
| `tests/security-audit-translation-shape.test.js` | LANDED | 67 lines, 4 cases | Commit `985e878` |

## Translation map row count + section coverage

| Section | Rows | Disposition split |
|---|---|---|
| §1 Phase 1 — Discovery | 5 | 5 Firebase-equivalent / 0 N/A |
| §2 Phase 2 — Universal Web Application Audit (OWASP Top 10 2025) | 11 | 10 Firebase-equivalent / 1 N/A (SSRF — no user-controlled URL surface) |
| §3 Phase 3 — Auth, Sessions, and Identity | 9 | 7 Firebase-equivalent / 2 N/A (OAuth + WebAuthn — v2) |
| §4 Phase 4 — Input Validation and Output Encoding | 7 | 6 Firebase-equivalent / 1 N/A (SQL) |
| §5 Phase 5 — Network, Infrastructure, and Platform | 12 | 6 Firebase-equivalent / 4 N/A / 2 PENDING-OPERATOR (DNS DNSSEC + open ports + VPC + Vercel/Supabase pointers) |
| §6 Phase 6 — AI / LLM Security | 2 | 0 Firebase-equivalent / 2 N/A (no LLM surface) |
| §7 Phase 7 — Specific Attack Class Defences | 16 | 12 Firebase-equivalent / 2 N/A / 2 PENDING-OPERATOR (DMARC + DNSSEC registrar) |
| §8 Phase 8 — Supabase Hardening | 19 | 0 Firebase-equivalent (all N/A — Firebase architecture differs) / 2 PENDING-OPERATOR (leaked-password protection + custom SMTP) |
| §9 Phase 9 — Vercel Hardening | 14 | 8 Firebase-equivalent / 5 N/A / 1 PENDING-OPERATOR (npm 2FA) |
| §10 Phase 10 — Vulnerability Scanning Toolchain | 9 | 4 Firebase-equivalent / 5 N/A (IaC + container + DAST + LLM-tools + Periodic partial) |
| §11 Remediation Tiers | 1 | 0 / 1 N/A (process-section, not control) |
| §12 Output | 1 | 1 self-reference (this Phase implements §12) |
| §13 Sign-off Checklist | 4 | section-level disposition row per checklist family (Universal + Supabase + Vercel + AI/LLM) |
| §14 Maintenance | 1 | maintenance trigger row |
| §15 References | 1 | framework-citation cross-walk row |
| **Total** | **~112 rows** | section-coverage Test 2 PASS |

## Locked translation pairs (CLAUDE.md baseline — all 8 surfaced verbatim)

| Vercel/Supabase | Firebase equivalent | Surfaced? |
|---|---|---|
| RLS | Firestore Rules (`firestore.rules`) | YES (locked-pairs table + §8.1 row) |
| `service_role` / `sb_secret_…` | Custom claims + Cloud Functions | YES (locked-pairs table + §8.3 row) |
| Edge Functions | Cloud Functions | YES (locked-pairs table + §8.6 row) |
| `pgaudit` | `auditLog` collection + BigQuery 7y sink | YES (locked-pairs table + §8.7 row + §9.7 row) |
| PITR | Firestore PITR (7-day rolling) | YES (locked-pairs table + §5.1 + §8.7 rows) |
| Vercel BotID / Firewall | reCAPTCHA Enterprise + App Check | YES (locked-pairs table + §9.2 row) |
| OIDC federation | GitHub Actions WIF + Firebase Auth tokens | YES (locked-pairs table + §9.1 row + §5.4 row) |
| Vercel Audit Logs | Cloud Logging + audit-log Cloud Function | YES (locked-pairs table + §9.7 row) |

## Schema-test green output

```
RUN  v4.1.5 C:/Users/hughd/OneDrive/Desktop/base-layers-diagnostic

✓ tests/security-audit-translation-shape.test.js > docs/SECURITY_AUDIT_TRANSLATION.md doc shape (WALK-01) > Test 1: file exists at docs/SECURITY_AUDIT_TRANSLATION.md 6ms
✓ tests/security-audit-translation-shape.test.js > docs/SECURITY_AUDIT_TRANSLATION.md doc shape (WALK-01) > Test 2: walks every required top-level § of SECURITY_AUDIT.md 2ms
✓ tests/security-audit-translation-shape.test.js > docs/SECURITY_AUDIT_TRANSLATION.md doc shape (WALK-01) > Test 3: every 'N/A — Firebase architecture differs' appearance is inside a table row with rationale cell 3ms
✓ tests/security-audit-translation-shape.test.js > docs/SECURITY_AUDIT_TRANSLATION.md doc shape (WALK-01) > Test 4: Pitfall 19 forbidden-words check — no bare 'compliant' / 'certified' outside code spans (negation-tolerant) 3ms

Test Files  1 passed (1)
     Tests  4 passed (4)
```

Full-suite regression check: `81 Test Files passed | 554 Tests passed | 6 skipped (560 total)` — was `80 Test Files | 550 Tests + 6 skipped (556)` pre-Plan; `+1 Test File / +4 Tests` exactly matching this plan's delta; zero regressions across the 80 prior test files.

## Drift-prevention spot checks

| Check | Result |
|---|---|
| Pitfall 4 — zero `:NN` line-number suffixes in code-path citations | PASS (the 2 `:NN` occurrences are inside backticks as "do-not-do-this" examples in the "How to use this map" prose, not actual citations) |
| Pitfall 19 — zero bare `compliant` / `certified` outside code spans | PASS (the sole match is `Not certified.` in the closing posture statement, satisfying the negation-tolerant lookbehind regex) |
| `wc -l` translation map | 257 lines (gate: `min_lines: 120` — exceeded by ~2×) |
| Locked translation pairs surfaced verbatim | PASS (all 8 pairs in the dedicated Locked-pairs table at the top + cross-referenced in their natural §-rows below) |
| Every Firebase-architecture-differs N/A row has rationale | PASS (Test 3 structural enforcement; ~30 N/A rows across §2 §3 §4 §5 §6 §7 §8 §9 §10 §11 §13, every one inside a markdown table row with Notes cell) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Removed prose hits of the literal "N/A — Firebase architecture differs" token outside table rows**

- **Found during:** Task 1 verification (Test 3 failed on first run with 3 prose-row hits)
- **Issue:** The plan's `<action>` block included three prose passages that used the literal `N/A — Firebase architecture differs` token outside markdown table rows: (a) the doc-front blockquote "How to use this map" preamble, (b) the §8 section preamble blockquote, (c) the §9 section preamble blockquote, and (d) the third numbered bullet in the "How to use this map" enumerated list. Test 3 of the schema gate (every appearance of that exact literal MUST be inside a markdown table row) caught all four — exactly as designed (the test's contract is "no silent skips outside table rows = no silent skips at all"; the prose-form weakens that guarantee).
- **Fix:** Rephrased all four prose hits to paraphrase the verdict-token without using the exact literal: "Firebase-architecture-differs N/A rows" (preamble), "not applicable on Firebase" (§8 + §9 preambles), and "rows that record a Firebase-architecture-differs N/A verdict" (numbered bullet). The literal verdict-token is preserved verbatim inside the ~30 actual table-row cells where it belongs.
- **Files modified:** `docs/SECURITY_AUDIT_TRANSLATION.md` (4 prose passages, ~4 lines)
- **Outcome:** Test 3 PASS — 28 table-row hits, 0 prose hits.
- **Decision recorded:** D-12-01-01 above.

### Auto-mode handling

This is an `autonomous: true` plan with zero checkpoints; no auto-advance / auto-approve actions were required.

## Forward-tracking rows queued

| ID | Description | Owner | Trigger |
|---|---|---|---|
| (none) | — | — | — |

Wave 1 is a pure-substrate phase (Pattern 1 hand-authored doc + Vitest schema gate); no forward-tracking rows are queued from this plan. The PENDING-OPERATOR rows surfaced in the translation map body (DNS DNSSEC + DMARC/SPF/DKIM + leaked-password toggle + custom SMTP + npm 2FA) are inherited substrate-honest disclosures referencing existing operator-deferred checkpoints from Phases 7 / 8 / 11 — they are tracked at those plans' cleanup ledgers, not re-opened here.

## Plan 12-02 unblocked

Confirmed. `docs/SECURITY_AUDIT_TRANSLATION.md` is now the audit-traceable anchor for `SECURITY_AUDIT_REPORT.md` per-row "what was the Vercel/Supabase guidance and what's the Firebase equivalent we ran against?" question. Phase 12 Plan 12-02 (Wave 2 — `SECURITY_AUDIT_REPORT.md` executive summary + per-checklist-item body) can begin authoring against the translation map.

## Threat-register mitigation status

All 5 STRIDE threats from the plan `<threat_model>` are LANDED:

| Threat ID | Status |
|---|---|
| T-12-01-01 (Pitfall 19 over-claim) | LANDED — Test 4 PASS, 0 forbidden-word offenders |
| T-12-01-02 (silent §8 / §9 skip) | LANDED — Test 2 + Test 3 PASS; every required section surfaces + every N/A row sits inside a table-row with rationale cell |
| T-12-01-03 (`:NN` line-number drift) | LANDED — zero non-quoted `:NN` suffixes in body; the two illustrative quoted suffixes (`SECURITY_AUDIT.md:127`, `SECURITY.md:938`) are inside backticks in "do-not-do-this" prose, not real citations |
| T-12-01-04 (wishlist citation) | ACCEPTED at plan scope — Wave 4 path-existence sweep extension is the canonical gate; authoring cross-checked against SECURITY.md § headings during write |
| T-12-01-05 (future source drift) | ACCEPTED at plan scope — quarterly maintenance per `SECURITY_AUDIT.md` §14; mid-quarter drift is a v2 concern |

## Commits

| Hash | Type | Subject |
|---|---|---|
| `32fd813` | docs | docs(12-01): land WALK-01 translation map (SECURITY_AUDIT.md -> Firebase) |
| `985e878` | test | test(12-01): add WALK-01 doc-shape schema gate (4 cases) |

## Self-Check: PASSED

- `docs/SECURITY_AUDIT_TRANSLATION.md` — FOUND (257 lines)
- `tests/security-audit-translation-shape.test.js` — FOUND (67 lines, 4 it() cases)
- Commit `32fd813` — FOUND on branch `phase-8-data-lifecycle-20260510`
- Commit `985e878` — FOUND on branch `phase-8-data-lifecycle-20260510`
- 4/4 schema-gate tests pass; full suite 554 passed + 6 skipped (zero regressions)
