# Phase 11: Documentation Pack (Evidence Pack) - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

**Goal:** A vendor-questionnaire-ready evidence pack exists with every claimed control backed by a code link + test link + framework citation — not "industry-standard encryption" hand-waves.

**ROADMAP description:** `SECURITY.md` + `PRIVACY.md` + `THREAT_MODEL.md` + `docs/CONTROL_MATRIX.md` + `docs/RETENTION.md` + `docs/IR_RUNBOOK.md` + `docs/DATA_FLOW.md` + `/.well-known/security.txt` + `docs/evidence/` VSQ-ready screenshots; every claimed control has code link + test link + framework citation.

**Depends on:** Phase 10 (every control is in code first, then catalogued).

**Requirements:** DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, DOC-08, DOC-09, DOC-10 (canonical owner — final pass).

**Success Criteria** (from ROADMAP — must be TRUE at phase close):

1. `SECURITY.md`, `PRIVACY.md`, `THREAT_MODEL.md`, `docs/CONTROL_MATRIX.md`, `docs/RETENTION.md`, `docs/IR_RUNBOOK.md`, and `docs/DATA_FLOW.md` all exist and each row in `CONTROL_MATRIX.md` cites a code path, config file, test, and explicit framework section (OWASP ASVS L2 / ISO 27001:2022 Annex A / SOC2 CC / GDPR Article).
2. `/.well-known/security.txt` (RFC 9116) is served from production with disclosure contact `security@bedeveloped.com`; `SECURITY.md` carries the vulnerability disclosure policy paragraph.
3. `PRIVACY.md` lists Google/Firebase, Sentry, and Google Fonts as sub-processors with Google Cloud DPA + Standard Contractual Clauses references; the verified Firestore data residency region is documented.
4. `docs/evidence/` contains screenshots: MFA enrolment for Luke + George, sample audit-log entry (PII redacted), backup-policy console, Firestore region, App Check enforcement state per service, rules deployment timestamp, latest CI green run, latest `npm audit` clean output.
5. A reviewer reading only `SECURITY.md` + `CONTROL_MATRIX.md` can answer every claim by following the citations into the codebase or `docs/`.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints carried forward:
- **SECURITY.md** is already extensively populated (Phases 1-10 each appended sections via DOC-10 incremental updates). Phase 11 is the canonical-pass + cross-reference verification + final structural pass.
- **PRIVACY.md, THREAT_MODEL.md, docs/CONTROL_MATRIX.md, docs/RETENTION.md, docs/IR_RUNBOOK.md, docs/DATA_FLOW.md** — likely don't exist yet; Phase 11 creates them.
- **docs/evidence/** — operator captures screenshots during Phase 8/9/10 close-gates per existing pattern (already referenced in DEFERRED-CHECKPOINT documents). Phase 11 verifies presence + indexes them in CONTROL_MATRIX.md citation column.
- **/.well-known/security.txt (RFC 9116)** — single new file with structured contact info (Contact, Expires, Encryption optional, Acknowledgments optional, Preferred-Languages optional, Canonical, Policy URL, Hiring optional). Hosted via firebase.json rewrite or just dropped in `public/`/`dist/` per Phase 3 hosting setup.
- **Substrate-honest disclosure (Pitfall 19):** Compliance bar = credible, not certified. Statements use language like "credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2" — NOT "compliant" or "certified".
- **Sub-processor list:** Google/Firebase, Sentry (added Phase 9), Google Fonts (self-hosted post-Phase-4 — VERIFY whether still a sub-processor at all).
- **Firestore data residency:** verified region from Phase 6 D-09 (operator should have captured during Phase 6 cutover).
- **Phase 8 + 9 + 10 evidence is operator-deferred** — Phase 11 documents this honestly with PENDING-OPERATOR rows for any control whose evidence file isn't yet captured.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Notable seams:
- `SECURITY.md` — extensive content from Phases 1-10 DOC-10 incremental updates.
- `firebase.json` — hosting headers (Phase 3) + tightened CSP (Phase 10).
- `firestore.rules` + `storage.rules` — claims-based predicates (Phase 5+6).
- `functions/` — auditWrite + setClaims + lifecycle + GDPR + authAnomalyAlert callables.
- `runbooks/` — operator runbooks for cutover, soak, deploy-checkpoint, restore-drill, etc.
- `.github/workflows/ci.yml` — supply-chain audit + OSV-Scanner + gitleaks.
- Phase 8/9/10 DEFERRED-CHECKPOINT docs — operator session dependencies.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP and SC above. Plan-phase researcher should produce:
- Inventory of which docs exist vs need creating.
- Per-doc structure recommendation (sections + citation pattern).
- CONTROL_MATRIX.md row template (Requirement | Code Path | Config File | Test | Framework Citation).
- Framework citation conventions (OWASP ASVS L2 vN.N section X.Y; ISO 27001:2022 Annex A.X.Y; SOC2 CC X.Y; GDPR Art. X(Y)).
- security.txt RFC 9116 minimum field set + Firebase Hosting serving strategy.
- Evidence pack inventory + which items are captured-pending vs already-captured.
- DPA + SCC reference URLs for Google Cloud + Sentry.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
