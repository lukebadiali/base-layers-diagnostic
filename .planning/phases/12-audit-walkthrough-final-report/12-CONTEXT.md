# Phase 12: Audit Walkthrough + Final Report - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

**Goal:** `SECURITY_AUDIT.md`'s Vercel/Supabase-shaped checklist becomes a Firebase-shaped checklist run end-to-end against the hardened repo, producing the milestone's closing artefact: `SECURITY_AUDIT_REPORT.md`.

**ROADMAP description:** `SECURITY_AUDIT.md` Vercel/Supabase sections translated to Firebase equivalents; translated checklist run end-to-end against the hardened repo; `SECURITY_AUDIT_REPORT.md` produced documenting every checklist item as Pass / Partial / N/A with citations.

**Depends on:** Phase 11 (evidence pack is the citation source for the report).

**Requirements:** WALK-01, WALK-02, WALK-03, WALK-04, DOC-10 (final increment).

**Success Criteria** (from ROADMAP — must be TRUE at phase close):

1. `docs/SECURITY_AUDIT_TRANSLATION.md` exists with a per-section map from Vercel/Supabase guidance to Firebase equivalents (RLS↔Firestore Rules; service_role↔custom claims + Cloud Functions; Edge Functions↔Cloud Functions; pgaudit↔Cloud Function audit log; PITR↔Firestore PITR; Vercel BotID/Firewall↔reCAPTCHA Enterprise / App Check; OIDC federation↔Firebase Auth tokens; Vercel Audit Logs↔Cloud Logging + audit-log Cloud Function).
2. `SECURITY_AUDIT.md` LLM03 / LLM05 / LLM10 sections are explicitly judged N/A with documented rationale ("this app has no LLM surface") — not silently skipped.
3. `SECURITY_AUDIT_REPORT.md` documents every checklist item as Pass / Partial / N/A with citations into the codebase + `docs/`; sections without clean Firebase equivalents are explicitly flagged "N/A — Firebase architecture differs" with rationale.
4. The report's overall posture statement reads "credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2" — not "compliant" or "certified" (Pitfall 19 prevention).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

Key constraints carried forward:
- **SECURITY_AUDIT.md** is the source checklist (Vercel/Supabase-shaped) — already present in repo root (referenced in CLAUDE.md). Phase 12 produces the translation map + Firebase-shaped run + final report.
- **Phase 11 evidence pack** is the citation source for `SECURITY_AUDIT_REPORT.md`. Each Pass/Partial/N/A verdict cites: code path + test file + framework citation + evidence file (from `docs/evidence/`).
- **Substrate-honest disclosure (Pitfall 19)** — final posture is "credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2" — NOT "compliant" or "certified". Verbatim language locked.
- **LLM01-10 sections** of SECURITY_AUDIT.md (OWASP LLM Top-10 — LLM application threats): LLM03 (training data poisoning), LLM05 (supply chain), LLM10 (model theft) get explicit N/A with "this app has no LLM surface" rationale. Other LLM sections may also be N/A depending on the audit framework.
- **Vercel/Supabase → Firebase translation table** (from CLAUDE.md):
  - RLS → Firestore Rules
  - service_role → custom claims + Cloud Functions
  - Edge Functions → Cloud Functions
  - pgaudit → Cloud Function audit log (auditLog collection)
  - PITR → Firestore PITR
  - Vercel BotID/Firewall → reCAPTCHA Enterprise / App Check
  - OIDC federation → Firebase Auth tokens
  - Vercel Audit Logs → Cloud Logging + audit-log Cloud Function
- **Some Vercel/Supabase sections will not have clean Firebase equivalents** — these get explicit "N/A — Firebase architecture differs" with rationale.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Notable artefacts:
- `SECURITY_AUDIT.md` (project root) — Vercel/Supabase audit checklist (the source).
- `SECURITY.md` (Phase 11) — controls inventory with 11 Audit Indexes.
- `docs/CONTROL_MATRIX.md` (Phase 11) — 88-row Pass/Partial/N/A citation source.
- `docs/evidence/README.md` (Phase 11) — 22-row evidence inventory with PENDING-OPERATOR annotations.
- `docs/DATA_FLOW.md`, `docs/RETENTION.md`, `docs/IR_RUNBOOK.md`, `THREAT_MODEL.md`, `PRIVACY.md` — Phase 11 doc pack (citation sources).
- Phase 11 Wave 6 cleanup ledger forward-tracks F4-F5 (WALK-01..WALK-04 deliverables).

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Plan-phase researcher should produce:
- Per-Vercel/Supabase-section translation table (with Firebase equivalents from CLAUDE.md as starting point + extensions).
- SECURITY_AUDIT.md LLM01-10 section disposition map (LLM03/05/10 N/A explicit; others context-dependent).
- SECURITY_AUDIT_REPORT.md row template (Section | Item | Verdict (Pass/Partial/N/A) | Citation | Framework).
- Phase 11 evidence inventory cross-walk (which evidence file backs which checklist item).
- Posture statement template + lock language.
- Recommended wave structure (3-5 waves; lighter than Phase 11).

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
