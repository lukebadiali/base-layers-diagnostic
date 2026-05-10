# Control Matrix — Base Layers Diagnostic

**Last updated:** 2026-05-10 (Phase 11 Wave 1 — skeleton; rows populated Wave 6)
**Owner:** Phase 11 (DOC-04); maintained per-phase as findings close
**Source:** This matrix is the auditor-friendly index over `SECURITY.md`. Every row maps a `REQUIREMENTS.md` ID to its implementation, test/evidence, and framework citation.
**Compliance posture:** credible, not certified — see `SECURITY.md` (compliance posture statement footer).

---

## How to use this matrix

Find a control by `REQ-ID`. Follow `Code Path(s)` to the implementation, `Test / Evidence` to the verification, and `Framework` to the standards mapping.

Conventions:

- Citations use canonical short-forms: `OWASP ASVS L2 v5.0 V<N>.<N>.<N>`; `ISO/IEC 27001:2022 Annex A.<N>.<N>`; `SOC 2 CC<N>.<N>`; `GDPR Art. <N>(<N>)`.
- `**PENDING-OPERATOR**` annotations point to the specific `NN-DEFERRED-CHECKPOINT.md` step where the evidence will be captured.
- Code paths are paths only — never line numbers. Phase 11 Wave 6 sweeps for line-number drift.
- Rows are REQ-prefix-ordered (alphabetical by category, then numeric within); chronological narrative lives in `SECURITY.md` Audit Indexes.

---

## AUDIT — Audit Log Infrastructure + Wiring (Phase 7 + Phase 9)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## AUTH — Real Auth + MFA (Phase 6)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## BACKUP — Backups + DR + PITR (Phase 8)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## CODE — Modular Split + Quick Wins (Phase 4)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## DATA — Firestore Data Model (Phase 5)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## DOC — Documentation Pack (Phase 11)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## FN — Cloud Functions + App Check (Phase 7)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## GDPR — GDPR Export + Erasure (Phase 8)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## HOST — Hosting & Headers (Phase 3 + Phase 10)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## LIFE — Data Lifecycle / Soft-Delete (Phase 8)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## OBS — Observability (Phase 9)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## RULES — Firestore + Storage Rules (Phase 5 + Phase 6)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## TEST — Test Suite Foundation (Phase 2)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## TOOL — Engineering Foundation (Phase 1)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

## WALK — Audit Walkthrough (Phase 12)

| REQ | Control | Code Path(s) | Test / Evidence | Framework |
|-----|---------|--------------|-----------------|-----------|

---

**Population status:** SKELETON. Rows populated in Phase 11 Wave 6 (`11-06-PLAN.md`) by merging the 6 existing Audit Indexes in `SECURITY.md` (Phase 3 / 5 / 6 / 7 / 8 / 9 / 10) plus filling in Phase 1 / 2 / 4 rows that don't yet have Audit Indexes.
