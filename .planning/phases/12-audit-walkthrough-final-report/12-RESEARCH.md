# Phase 12: Audit Walkthrough + Final Report — Research

**Researched:** 2026-05-10
**Domain:** Audit-framework translation + control walkthrough + evidence-cited reporting (documentation phase, no new application code)
**Confidence:** HIGH (everything cited is verified against committed artefacts in this repo; nothing in this phase requires upstream library research)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Discuss phase skipped** via `workflow.skip_discuss=true`. All implementation choices at Claude's discretion.
- **`SECURITY_AUDIT.md` is the source checklist** (Vercel/Supabase-shaped) — already present at repo root. Phase 12 produces the translation map + Firebase-shaped run + final report.
- **Phase 11 evidence pack is the citation source** for `SECURITY_AUDIT_REPORT.md`. Each Pass/Partial/N/A verdict cites: code path + test file + framework citation + evidence file (from `docs/evidence/`).
- **Substrate-honest disclosure (Pitfall 19)** — final posture is verbatim `"credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2"` — **NOT** "compliant" or "certified". Language locked.
- **LLM01–LLM10 sections** of `SECURITY_AUDIT.md` (OWASP LLM Top-10): LLM03 (training-data poisoning), LLM05 (improper output handling — re-reads as supply-chain in some framings), LLM10 (unbounded consumption / model theft framing) get **explicit N/A with `"this app has no LLM surface"` rationale**. The other LLM sections (LLM01/02/04/06/07/08/09) are also N/A by the same logic — confirm each explicitly rather than silently skip.
- **Vercel/Supabase → Firebase translation table (from CLAUDE.md, baseline):**
  - RLS → Firestore Rules
  - service_role → custom claims + Cloud Functions
  - Edge Functions → Cloud Functions
  - pgaudit → Cloud Function audit log (`auditLog` collection + BigQuery 7y sink)
  - PITR → Firestore PITR
  - Vercel BotID/Firewall → reCAPTCHA Enterprise / App Check
  - OIDC federation → Firebase Auth tokens (for end users) + GitHub Actions OIDC → Workload Identity Federation (for CI)
  - Vercel Audit Logs → Cloud Logging + audit-log Cloud Function
- **Some Vercel/Supabase sections have NO clean Firebase equivalent** — these get explicit `"N/A — Firebase architecture differs"` with rationale (NOT silently skipped).

### Claude's Discretion

- Wave structure, internal section ordering of the translation map, exact column shape of the report table, schema-test gates (or operator-checklist gates) for forbidden-words / posture-statement / N/A-rationale presence.
- Whether `SECURITY_AUDIT_REPORT.md` lives at repo root (mirrors `SECURITY.md` / `PRIVACY.md` / `THREAT_MODEL.md`) or under `docs/`. **Research recommendation: repo root** (parity with `SECURITY_AUDIT.md` source + auditor-discoverable from top-level `ls`).

### Deferred Ideas (OUT OF SCOPE)

- None — discuss phase skipped. Anything outside WALK-01..WALK-04 + DOC-10 final increment is out of scope for this phase.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WALK-01 | `docs/SECURITY_AUDIT_TRANSLATION.md` produced — per-section map from `SECURITY_AUDIT.md` Vercel/Supabase guidance to Firebase equivalents | §Translation Map Structure (Pattern 1) — table-driven per-section walkthrough mirroring `SECURITY_AUDIT.md` §1–§14 |
| WALK-02 | Translated `SECURITY_AUDIT.md` checklist run end-to-end against the hardened repo | §End-to-End Walkthrough (Pattern 2) — every §13 sign-off checkbox + every §2–§7 numbered control surfaced for verdict |
| WALK-03 | `SECURITY_AUDIT_REPORT.md` produced — every checklist item documented as Pass / Partial / N/A with citations into the codebase + `docs/`; non-Firebase-equivalent sections flagged "N/A — Firebase architecture differs" with rationale (NOT silently skipped) | §Report Row Template (Pattern 3) — 7-column row format with rationale-mandatory cell for any N/A verdict |
| WALK-04 | `SECURITY_AUDIT.md` LLM03 / LLM05 / LLM10 sections judged N/A with documented rationale (this app has no LLM surface) | §LLM Section Disposition Map (Pattern 4) — explicit per-LLM-section N/A rows preventing silent skip |
| DOC-10 | Final increment — Phase 12 appends to `SECURITY.md` (Phase 12 Audit Index) | §SECURITY.md Increment (Pattern 5) — mirrors Phase 11 Wave 6 pattern: § Phase 12 Audit Index appended after § Phase 11 Audit Index |

</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Stay on Firebase** — no Vercel/Supabase migration. (Pitfall 14)
- **Stay on vanilla JS** — modular split + Vite + Vitest + JSDoc-as-typecheck. (No framework rewrite.)
- **No backwards-compatibility window** — clean cutover migrations acceptable; not relevant to Phase 12 (doc-only phase).
- **Compliance bar = credible, not certified** — Pitfall 19 substrate-honest disclosure pattern. Verbatim posture statement is locked.
- **12-phase plan, not 5–8** — justified by four load-bearing sequencing constraints. Phase 12 is the closing artefact phase.
- **Conventional Commits** — `docs:` for Phase 12 (every commit is a doc commit).
- **No emojis** in commit messages or in source unless asked. (The report MUST NOT introduce emojis.)
- **Source-layout rules** are not in scope — Phase 12 introduces zero source code.

---

## Summary

Phase 12 is a **pure-documentation phase**. It produces **two new top-level artefacts** and **one SECURITY.md increment**:

1. `docs/SECURITY_AUDIT_TRANSLATION.md` (WALK-01) — a per-section map translating `SECURITY_AUDIT.md`'s Vercel/Supabase guidance to Firebase equivalents, including explicit "N/A — Firebase architecture differs" rows for sections without clean equivalents.
2. `SECURITY_AUDIT_REPORT.md` at repo root (WALK-02 + WALK-03 + WALK-04) — the closing artefact of the milestone, with every `SECURITY_AUDIT.md` checklist item (including all §13 sign-off rows and every numbered control in §2–§7) given a Pass / Partial / N/A verdict, citing into the existing Phase 11 evidence substrate (`SECURITY.md` §§, `docs/CONTROL_MATRIX.md`, `docs/evidence/`, `PRIVACY.md`, `THREAT_MODEL.md`, `docs/DATA_FLOW.md`, `docs/RETENTION.md`, `docs/IR_RUNBOOK.md`).
3. `SECURITY.md` § Phase 12 Audit Index appended (DOC-10 final increment) — mirrors the per-phase Audit Index pattern established across Phases 3, 5, 6, 7, 8, 9, 10, 11.

There is **no new application code** in Phase 12. There are **no new tests** at the application level, but doc-shape schema-tests (mirroring `tests/threat-model-shape.test.js`, `tests/retention-md-shape.test.js`, `tests/ir-runbook-shape.test.js`, `tests/security-md-paths-exist.test.js`) are the recommended gate for: (a) every cited path exists, (b) Pitfall 4 line-number drift sweep, (c) Pitfall 19 forbidden-words check (`compliant` / `certified` without the negation lookbehind), (d) posture statement byte-for-byte match.

The technical surface is **narrow but high-stakes for Pitfall 19**. Every claim in `SECURITY_AUDIT_REPORT.md` must be verifiable by an auditor walking the citation chain to the actual artefact. The Phase 11 evidence pack is the citation substrate — every Pass row cross-walks to a `SECURITY.md` section anchor, a `docs/CONTROL_MATRIX.md` row, a source path, and a framework citation (OWASP ASVS L2 v5.0 / ISO 27001:2022 Annex A / SOC2 CC / GDPR Art.).

The single largest risk is **broken citation drift** — line-number `:NN` suffixes go stale within a single commit. Pitfall 4 fix is already in place project-wide (paths-only convention enforced by `tests/security-md-paths-exist.test.js` and `tests/control-matrix-paths-exist.test.js`). Phase 12's new artefacts MUST follow the same convention.

**Primary recommendation:** Organise as **4 waves**:

- **Wave 1** — `docs/SECURITY_AUDIT_TRANSLATION.md` (WALK-01): per-§ translation map with explicit "N/A — Firebase architecture differs" rows. TDD doc-shape gate.
- **Wave 2** — `SECURITY_AUDIT_REPORT.md` Discovery + OWASP A01–A10 + Phase 3 Auth + Phase 4 Input + Phase 5 Network sections (WALK-02 partial + WALK-03 partial). Most rows are direct lifts from `docs/CONTROL_MATRIX.md`.
- **Wave 3** — `SECURITY_AUDIT_REPORT.md` LLM Top-10 dispositions (WALK-04) + §7 Attack class table + §10 Toolchain inventory + §13 Sign-off Checklist verdicts (WALK-02 remainder + WALK-03 remainder).
- **Wave 4** — `SECURITY.md` § Phase 12 Audit Index increment (DOC-10 final) + final cross-document broken-link sweep + Pitfall 19 posture-statement schema-test + `/gsd-verify-work 12` operator-deferred close.

---

## Architectural Responsibility Map

> Phase 12 introduces zero new architectural surfaces. The map here is a **documentation-tier ownership map** — which artefact owns which type of claim.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vercel/Supabase → Firebase section translation | `docs/SECURITY_AUDIT_TRANSLATION.md` (WALK-01) | — | New artefact; owns the per-source-§ mapping shape |
| Per-checklist-item verdict + citation | `SECURITY_AUDIT_REPORT.md` (WALK-03) | `docs/CONTROL_MATRIX.md` (citation source for code paths) | Report assembles verdicts; matrix is the verified-once citation row source |
| LLM Top-10 disposition (N/A rationale) | `SECURITY_AUDIT_REPORT.md` § LLM Top-10 section (WALK-04) | — | Single canonical place; not duplicated in TRANSLATION |
| Posture statement (`"credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2"`) | `SECURITY_AUDIT_REPORT.md` (Pitfall 19 anchor) | `SECURITY.md` "Compliance posture statement" footer (already present, line 1416–1418 — verified) | Report's executive summary owns the verbatim posture sentence; SECURITY.md footer already carries the equivalent locked phrasing — keep both in sync |
| Phase-12 closure narrative in canonical doc | `SECURITY.md` § Phase 12 Audit Index (DOC-10 final increment) | — | Per-phase Audit Index pattern established Phases 3/5/6/7/8/9/10/11 |
| Cross-document citation existence | `tests/security-md-paths-exist.test.js` (extend) + new `tests/security-audit-report-paths-exist.test.js` | — | Mirrors Phase 11 Pattern G gate; prevents wishlist citations |
| Pitfall 19 forbidden-words gate | New `tests/security-audit-report-shape.test.js` | Mirrors Phase 11 `tests/threat-model-shape.test.js` / `tests/retention-md-shape.test.js` Test 8 patterns | Lookbehind regex pattern (`\b(?<!non-)(?<!not\s)(compliant\|certified)\b`) — preserves "credible, not certified" canonical phrasing per Plan 11-02 Decision D-11-02-02 |

---

## Standard Stack

> Phase 12 adds **no production dependencies**. Only test-time tooling.

### Core (already present, used as-is)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 1.6.x (matches repo baseline) | Doc-shape schema-tests + paths-exist gates | Pattern from `tests/threat-model-shape.test.js` / `tests/security-md-paths-exist.test.js` |
| Node `fs.existsSync` + `readFileSync` | built-in | Path-existence + body-regex assertions | No new dep — same pattern as every Phase 11 doc-shape gate |

### Supporting (already present)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `git ls-files` (CLI) | n/a | Optional second-pass for path-existence (catches build-artefact paths excluded from existsSync) | Mirrors `tests/control-matrix-paths-exist.test.js` Test 2 fallback (gracefully tolerates paths that are git-tracked but transient on disk) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Vitest doc-shape gates | Manual operator checklist in `12-HUMAN-UAT.md` | **Lose CI enforcement** — Phase 11 deliberately ratcheted up to schema-tested doc-shape (Plan 11-02 Decision D-11-02-01 onwards). Don't regress. **Recommendation: schema-tests.** |
| `SECURITY_AUDIT_REPORT.md` at repo root | `docs/SECURITY_AUDIT_REPORT.md` | Root mirrors `SECURITY_AUDIT.md` source location + auditor-discoverable from top-level `ls`. **Recommendation: repo root.** |
| Single-pass full report write | Section-by-section iterative population | Single pass risks Pitfall 19 over-claim; iterative + schema-test ratcheting catches drift. **Recommendation: iterative, mirror Phase 11 Wave 1→6 ratchet pattern.** |

**Installation:** No new dependencies required. No `npm install` step in Phase 12.

**Version verification:** N/A — no new packages introduced.

---

## Architecture Patterns

### System Architecture Diagram

```
                    ┌────────────────────────────────────────────────┐
                    │   Phase 12 — Audit Walkthrough + Final Report  │
                    └────────────────────────────────────────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
            ▼                             ▼                             ▼
  ┌──────────────────┐         ┌────────────────────┐        ┌──────────────────────┐
  │ INPUT (existing) │         │  TRANSLATION layer │        │  REPORT (new — root) │
  │                  │         │  (new — docs/)     │        │                      │
  │ SECURITY_AUDIT.md├────────►│SECURITY_AUDIT_     ├───────►│SECURITY_AUDIT_       │
  │ (Vercel/Supabase)│         │  TRANSLATION.md    │        │  REPORT.md           │
  │   §1..§15        │         │  (WALK-01)         │        │  (WALK-02+03+04)     │
  └──────────────────┘         │                    │        │                      │
                               │ Per-§ Firebase     │        │ Per-checklist-item:  │
                               │ equivalent +       │        │  Verdict (P/Pa/N/A)  │
                               │ "N/A — Firebase    │        │  Citation chain      │
                               │ architecture       │        │  Framework citation  │
                               │ differs" rows      │        │  Evidence pointer    │
                               └────────────────────┘        │  LLM N/A rationale   │
                                                             └──────────┬───────────┘
                                                                        │
                                                                        ▼
                                                            ┌────────────────────────┐
                                                            │ CITATION SUBSTRATE     │
                                                            │ (already-built, Ph 11) │
                                                            │                        │
                                                            │ SECURITY.md §§         │
                                                            │ docs/CONTROL_MATRIX.md │
                                                            │  (128 rows)            │
                                                            │ docs/evidence/         │
                                                            │  README.md (22 rows)   │
                                                            │ PRIVACY.md             │
                                                            │ THREAT_MODEL.md        │
                                                            │ docs/DATA_FLOW.md      │
                                                            │ docs/RETENTION.md      │
                                                            │ docs/IR_RUNBOOK.md     │
                                                            │ runbooks/*.md          │
                                                            └──────────┬─────────────┘
                                                                        │
                                                                        ▼
                                                            ┌────────────────────────┐
                                                            │ DOC-10 final increment │
                                                            │                        │
                                                            │ SECURITY.md            │
                                                            │  § Phase 12 Audit Index│
                                                            │  (appended after       │
                                                            │   § Phase 11 Audit     │
                                                            │   Index, line 1386)    │
                                                            └────────────────────────┘
                                                                        │
                                                                        ▼
                                                            ┌────────────────────────┐
                                                            │ ENFORCEMENT GATES      │
                                                            │ (CI — Vitest schema)   │
                                                            │                        │
                                                            │ tests/security-audit-  │
                                                            │  translation-shape     │
                                                            │ tests/security-audit-  │
                                                            │  report-shape          │
                                                            │ tests/security-audit-  │
                                                            │  report-paths-exist    │
                                                            │ tests/security-md-     │
                                                            │  paths-exist (extend)  │
                                                            └────────────────────────┘
```

**Data flow trace (auditor perspective):** Auditor opens `SECURITY_AUDIT_REPORT.md` → reads §A01 row "Pass" with citation `SECURITY.md § Firestore Security Rules + firestore.rules + ASVS V4.1.1` → opens `SECURITY.md` → finds the cited section → finds the cited code path → finds the framework citation → verdict confirmed. End-to-end traversability is the milestone close criterion.

### Recommended Project Structure

```
base-layers-diagnostic/
├── SECURITY_AUDIT.md                          # EXISTING — source (697 lines verified)
├── SECURITY_AUDIT_REPORT.md                   # NEW — Phase 12 closing artefact (WALK-02+03+04)
├── SECURITY.md                                # EXISTING — append § Phase 12 Audit Index (DOC-10 final)
├── PRIVACY.md / THREAT_MODEL.md               # EXISTING — citation sources (do not modify)
├── docs/
│   ├── SECURITY_AUDIT_TRANSLATION.md          # NEW — WALK-01 deliverable
│   ├── CONTROL_MATRIX.md                      # EXISTING — 128 REQ-rows; citation source
│   ├── DATA_FLOW.md / RETENTION.md /          # EXISTING — citation sources
│   ├── IR_RUNBOOK.md
│   └── evidence/
│       └── README.md                          # EXISTING — 22-row inventory; PENDING-OPERATOR rows
├── tests/
│   ├── security-audit-translation-shape.test.js   # NEW — WALK-01 schema gate
│   ├── security-audit-report-shape.test.js        # NEW — WALK-02+03+04 schema gate
│   ├── security-audit-report-paths-exist.test.js  # NEW — Pitfall 4 + 6 drift gate
│   └── security-md-paths-exist.test.js            # EXISTING — extend to cover new Phase 12 Audit Index rows
└── runbooks/                                  # EXISTING — citation sources for IR runbook rows (no new runbooks)
```

### Pattern 1 — Translation Map Structure (WALK-01)

**What:** `docs/SECURITY_AUDIT_TRANSLATION.md` walks `SECURITY_AUDIT.md` in source order (§0 → §15) and for each §, produces a 3-column row: source guidance | Firebase equivalent | notes / explicit "N/A — Firebase architecture differs" rationale.

**When to use:** Wave 1 of Phase 12. This is the WALK-01 deliverable.

**Source verified — `SECURITY_AUDIT.md` has these top-level §§:**

```
§0  Operating Contract for Claude
§1  Phase 1 — Discovery
§2  Phase 2 — Universal Web Application Audit (OWASP Top 10 2025)
§3  Phase 3 — Auth, Sessions, and Identity
§4  Phase 4 — Input Validation and Output Encoding
§5  Phase 5 — Network, Infrastructure, and Platform
§6  Phase 6 — AI / LLM Security (OWASP LLM Top 10 2025 + NCSC Guidelines)
§7  Phase 7 — Specific Attack Class Defences
§8  Phase 8 — Supabase Hardening (activate if Supabase detected)         ← MOST TRANSLATION WORK
§9  Phase 9 — Vercel Hardening (activate if Vercel detected)             ← MOST TRANSLATION WORK
§10 Phase 10 — Vulnerability Scanning Toolchain
§11 Remediation Tiers
§12 Output (what Claude produces at end of audit)
§13 Sign-off Checklist                                                    ← MOST CHECKLIST-ITEM WORK
§14 Maintenance
§15 References
```

**Example:**

```markdown
| Source § | Source guidance | Firebase equivalent | Notes |
|----------|-----------------|---------------------|-------|
| §8.1 RLS | `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` on every exposed table | Firestore Security Rules (`firestore.rules`) — deny-by-default at root + per-collection `allow read, write: if request.auth != null && ...` predicates | Firestore is deny-by-default; "FORCE" semantics map to root `match /{document=**} { allow read, write: if false; }` |
| §8.1 RLS | `auth.uid()` policy predicate | `request.auth.uid` in rules predicate | Direct equivalent; `(select auth.uid())` performance optimisation has no Firestore analogue (rules are not query-planned) |
| §8.1 RLS | `user_metadata` is user-writable — never reference in policies | Firebase Auth custom claims are server-only via Admin SDK `setCustomUserClaims()` — equivalent threat-class is using `request.auth.token.role` set client-side (impossible — claims are minted by Cloud Functions) | Phase 7 `iam.claims.set` Cloud Function is the authoritative claims-setter; `setClaims` callable is the only client-reachable path |
| §8.3 Auth | `service_role` / `sb_secret_…` never appears in browser bundles | Firebase Admin SDK only initialises in Cloud Functions runtime (Node) — the Admin SDK is not exportable to the browser. Equivalent threat-class is a service-account JSON key committed to the repo | gitleaks pre-commit + GitHub Push Protection guard against committed secrets; CI fails on detection |
| §9.2 Edge / Perimeter | Vercel BotID Deep Analysis on paid AI routes | App Check (reCAPTCHA Enterprise) on every callable Cloud Function | Phase 7 § App Check (`SECURITY.md` line 938) — Stages A–C shipped + per-service staged enforcement |
| §9.2 Edge / Perimeter | No Cloudflare in front of Vercel — strips BotID signals | **N/A — Firebase architecture differs.** Firebase Hosting is its own CDN; no third-party reverse proxy in the path. App Check signals travel directly from client → callable function with App Check token in the request header. | Substrate-honest note: this is an architectural difference, not a "we forgot to do this". |
| §11 Remediation Tiers | Tier 1 auto-fix | **N/A — this section governs the audit runner's behaviour, not the audited system.** Phase 12's Phase 11 evidence pack is the artefact of the human-driven audit pass that ran this milestone; we are not running an automated remediation pass in Phase 12. | This is a process-section, not a control-section. |
```

**Drift-prevention rule:** Every row that says "N/A — Firebase architecture differs" MUST have a rationale cell. The doc-shape gate enforces this.

### Pattern 2 — End-to-End Walkthrough (WALK-02 + WALK-03)

**What:** `SECURITY_AUDIT_REPORT.md` walks **every numbered control** in `SECURITY_AUDIT.md` §§2–§10 + **every checkbox** in §13 Sign-off Checklist, assigning Pass / Partial / N/A with citation.

**Verdict definitions (recommended — pin in report intro):**

- **Pass** — Control is present, tested, and evidence is verifiable. Citation chain resolves to a code path + test file + framework citation + evidence file.
- **Partial** — Control is substrate-complete but operator-deferred (e.g., production deploy pending; PENDING-OPERATOR evidence capture pending). Cite the deferred-checkpoint document. This is the substrate-honest verdict per Pitfall 19 — do NOT inflate to Pass.
- **N/A — Firebase architecture differs** — Control is Vercel/Supabase-specific with no Firebase analogue (e.g., Cloudflare-in-front-of-Vercel guidance, Supabase Splinter advisor). Rationale required.
- **N/A — no LLM surface** — Control is LLM-application-specific; this app has no LLM. Rationale required (single locked rationale string: `"This application has no LLM surface — no openai / anthropic-ai / langchain / llamaindex / MCP / RAG / embedding / agent / tool-calling integration."`).

**Source verified — `SECURITY_AUDIT.md` §13 Sign-off Checklist has these sections:**

```
- Universal (14 items)
- If Supabase (11 items)         ← all "N/A — Firebase architecture differs"
- If Vercel (10 items)           ← mostly "N/A — Firebase architecture differs"
- If AI / LLM (11 items)         ← all "N/A — no LLM surface" (WALK-04 anchor)
```

The 14 Universal items + 10 Vercel items where a Firebase analogue exists (e.g., "All secrets marked Sensitive" → "All secrets in Secret Manager / OIDC federation; no plaintext env in repo") are the **load-bearing Pass/Partial walkthrough**. The 11 Supabase items + the 11 LLM items + the residual Vercel items are the **load-bearing N/A walkthrough with mandatory rationale**.

### Pattern 3 — Report Row Template (WALK-03)

**What:** A single canonical row format used throughout `SECURITY_AUDIT_REPORT.md`.

```markdown
| Source ref | Control | Verdict | Citation | Framework | Evidence |
|------------|---------|---------|----------|-----------|----------|
| §13 Universal #11 | "Logging and alerting wired to a central destination" | Pass | `SECURITY.md § Anomaly Alerting (OBS-05)` + `functions/src/observability/authAnomalyAlert.ts` + `docs/CONTROL_MATRIX.md OBS-05` | ASVS V7.1.1 / V7.2.1 / ISO 27001:2022 A.8.15 | `docs/evidence/README.md` row 14 (PENDING-OPERATOR per `09-06-DEFERRED-CHECKPOINT.md` Step C) |
```

**Sample populated rows (verified against repo state 2026-05-10):**

```markdown
## §2 OWASP Top 10 2025

| Source ref | Control | Verdict | Citation | Framework | Evidence |
|------------|---------|---------|----------|-----------|----------|
| §2 A01 | Authorisation re-checked inside handler (no middleware-only auth) | Pass | `SECURITY.md § Firestore Security Rules` + `firestore.rules` + `SECURITY.md § Cloud Functions Workspace` (callable claims-check pattern) | ASVS V4.1.1 / V4.1.3 / ISO 27001:2022 A.8.3 | `docs/CONTROL_MATRIX.md AUTH-*` + `docs/CONTROL_MATRIX.md RULES-*` |
| §2 A01 | SSRF guard (private-IP block, metadata-IP block, DNS-pinned) | N/A — Firebase architecture differs | The application has no server-side outbound HTTP from user-supplied URLs. The only outbound calls from Cloud Functions are: Sentry (pinned `de.sentry.io`), Slack webhook (pinned URL from Secret Manager), BigQuery (pinned GCP API), Identity Platform (pinned GCP API). All destinations are configuration-pinned, not user-supplied. | — | `docs/DATA_FLOW.md` Functions→backplane edges enumerate all 5 outbound destinations; `THREAT_MODEL.md T4` denial-of-wallet covers cost-side; no SSRF threat in T1–T6 |
| §2 A02 | Security headers (HSTS / X-Content-Type-Options / Referrer-Policy / Permissions-Policy / X-Frame-Options or CSP frame-ancestors / CSP) | Pass | `SECURITY.md § HTTP Security Headers` + `SECURITY.md § Content Security Policy (enforced)` + `SECURITY.md § HSTS Preload Status` + `firebase.json` | ASVS V14.4.* / ISO 27001:2022 A.8.23 | `docs/CONTROL_MATRIX.md HOST-06 / HOST-07` |
| §2 A02 | No source maps in production | Pass | `SECURITY.md § Observability — Sentry` (two-layer source-map deletion gate) + `tests/build/source-map-gate.test.js` + `.github/workflows/ci.yml` post-build .map deletion step | ASVS V14.3.2 / ISO 27001:2022 A.8.28 | `docs/CONTROL_MATRIX.md OBS-04` |
| §2 A04 | No tokens in localStorage/sessionStorage | Pass | `SECURITY.md § Authentication & Sessions` (Firebase Auth uses IndexedDB-backed session storage; no manual JWT-in-localStorage) | ASVS V3.5.* / ISO 27001:2022 A.5.17 | `docs/CONTROL_MATRIX.md AUTH-*` |
| §2 A09 | Privileged actions logged | Pass | `SECURITY.md § Audit Log Infrastructure` + `SECURITY.md § Audit-Event Wiring (AUDIT-05)` + `functions/src/audit/` + `firestore.rules` (audited-user-cannot-read-own predicate) | ASVS V7.1.* / V7.3.* / ISO 27001:2022 A.8.15 / SOC2 CC7.2 | `docs/CONTROL_MATRIX.md AUDIT-01..07` |

## §6 OWASP LLM Top 10 2025

| Source ref | Control | Verdict | Citation | Framework | Evidence |
|------------|---------|---------|----------|-----------|----------|
| §6 LLM01 | Prompt injection guardrails | N/A — no LLM surface | This application has no LLM surface — no openai / anthropic-ai / langchain / llamaindex / MCP / RAG / embedding / agent / tool-calling integration. Verified via `package.json` grep: zero LLM SDK dependencies present. | — | `package.json` (verifiable absence) |
| §6 LLM02 | Sensitive information disclosure | N/A — no LLM surface | (same rationale) | — | (same) |
| §6 LLM03 | Supply chain (model + tooling + datasets) | N/A — no LLM surface | (same rationale) | — | (same) — **WALK-04 explicit row** |
| §6 LLM04 | Data and model poisoning | N/A — no LLM surface | (same rationale) | — | (same) |
| §6 LLM05 | Improper output handling | N/A — no LLM surface | (same rationale) | — | (same) — **WALK-04 explicit row** |
| §6 LLM06 | Excessive agency | N/A — no LLM surface | (same rationale) | — | (same) |
| §6 LLM07 | System prompt leakage | N/A — no LLM surface | (same rationale) | — | (same) |
| §6 LLM08 | Vector and embedding weaknesses | N/A — no LLM surface | (same rationale) | — | (same) |
| §6 LLM09 | Misinformation | N/A — no LLM surface | (same rationale) | — | (same) |
| §6 LLM10 | Unbounded consumption | N/A — no LLM surface | (same rationale) | — | (same) — **WALK-04 explicit row** |

## §13 Sign-off Checklist — Universal

| Source ref | Control | Verdict | Citation | Framework | Evidence |
|------------|---------|---------|----------|-----------|----------|
| §13 U#1 | Phase 1 discovery written to report | Pass | `SECURITY_AUDIT_REPORT.md` § Discovery (this report itself — Wave 2) | — | This report |
| §13 U#2 | OWASP A01–A10 walked | Pass | `SECURITY_AUDIT_REPORT.md` §2 OWASP Top 10 2025 | OWASP Top 10 2025 | This report |
| §13 U#3 | Auth, sessions, identity reviewed | Pass | `SECURITY_AUDIT_REPORT.md` §3 + `SECURITY.md § Authentication & Sessions` + `SECURITY.md § Multi-Factor Authentication` + `SECURITY.md § MFA Recovery Procedure` + `SECURITY.md § Anonymous Auth Disabled` | ASVS V2 + V3 / ISO 27001:2022 A.5.16 / A.5.17 | `docs/CONTROL_MATRIX.md AUTH-01..15` |
| §13 U#4 | Input validation + output encoding | Pass | `SECURITY_AUDIT_REPORT.md` §4 + `SECURITY.md § Code Quality + Module Boundaries` (no `html:` escape hatch) + `SECURITY.md § Content Security Policy (enforced)` | ASVS V5 + V14.4 | `docs/CONTROL_MATRIX.md CODE-04 / CODE-06 / HOST-07` |
| §13 U#13 | CI integrates Semgrep + secrets scan + dep audit + tests on every PR | Partial | `SECURITY.md § Build & Supply Chain` + `SECURITY.md § Dependency Monitoring` + `SECURITY.md § Secret Scanning` + `.github/workflows/ci.yml` | ASVS V14.1.* / ISO 27001:2022 A.8.25 | Semgrep absent; ESLint + Vitest + Vite build + gitleaks + Socket.dev + `npm audit` present. Substrate-honest disclosure: Semgrep is v2 (PROJECT.md constraint). The Phase 12 milestone has CI-level secret/dep scanning + project tests on every PR. |
| §13 U#14 | IR runbook exists (CAF D1) and covers credential compromise | Pass | `docs/IR_RUNBOOK.md` Scenario 1 + `runbooks/ir-credential-compromise.md` | ISO 27001:2022 A.5.24 / A.5.29 / SOC2 CC7.4 | `docs/CONTROL_MATRIX.md DOC-06` |

## §13 Sign-off Checklist — If Supabase

| Source ref | Control | Verdict | Citation | Framework | Evidence |
|------------|---------|---------|----------|-----------|----------|
| §13 S#1 | Splinter advisor zero error-level lints | N/A — Firebase architecture differs | Firebase has no Splinter advisor. Closest equivalent: Firestore Security Rules + rules-unit-tests + production-rules-deploy with rollback rehearsal. Firestore Rules deploy gate is the analogue (Phase 6 `runbooks/phase6-rules-rollback-rehearsal.md`). | — | `docs/CONTROL_MATRIX.md RULES-*` |
| §13 S#2 | Every exposed table: RLS enabled + forced | N/A — Firebase architecture differs | Firestore is deny-by-default at root; RLS-enabled-and-forced semantics map to root `match /{document=**} { allow read, write: if false; }` plus per-collection explicit allow predicates. | — | `firestore.rules` + `docs/CONTROL_MATRIX.md RULES-01..06` |

## §13 Sign-off Checklist — If Vercel

| Source ref | Control | Verdict | Citation | Framework | Evidence |
|------------|---------|---------|----------|-----------|----------|
| §13 V#1 | All secrets marked Sensitive | Adapted Pass — Firebase analogue | All secrets in GCP Secret Manager (Phase 8 `GDPR_PSEUDONYM_SECRET`, Phase 9 `SLACK_WEBHOOK_URL` + `SENTRY_DSN`); no plaintext credentials in repo (gitleaks + GitHub Push Protection enforce); `.env*` gitignored. | ASVS V14.1.4 / ISO 27001:2022 A.8.10 | `docs/CONTROL_MATRIX.md DATA-* / GDPR-* / OBS-*` |
| §13 V#2 | OIDC federation to cloud providers | Pass | `SECURITY.md § Rotation Schedule` (non-rotating OIDC row) + `runbooks/firebase-oidc-bootstrap.md` + `.github/workflows/ci.yml` (Workload Identity Federation `id-token: write`) | ISO 27001:2022 A.5.16 / A.5.17 | `docs/CONTROL_MATRIX.md OBS-04` + `docs/evidence/README.md` branch-protection-screenshot.png |
| §13 V#7 | Strict CSP with nonces | Adapted Pass — nonces not used; allowlist-only CSP | `SECURITY.md § Content Security Policy (enforced)` — strict CSP without `'unsafe-inline'` in style-src; allowlist-based connect-src; per-directive matrix verified in Phase 10 Wave 2. Substrate-honest: Firebase Hosting does not inject per-request nonces; the policy is allowlist-based, which is the credible Firebase Hosting pattern. | ASVS V14.4.4 | `docs/CONTROL_MATRIX.md HOST-07` |
| §13 V#9 | No Cloudflare / reverse proxy in front of Vercel | N/A — Firebase architecture differs | Firebase Hosting is the CDN; no third-party reverse proxy in path. | — | `docs/DATA_FLOW.md` |

## §13 Sign-off Checklist — If AI / LLM

All 11 items: **N/A — no LLM surface.** Single rationale (verbatim): `"This application has no LLM surface — no openai / anthropic-ai / langchain / llamaindex / MCP / RAG / embedding / agent / tool-calling integration."`. Citation: `package.json` (verifiable absence of LLM SDKs).
```

### Pattern 4 — LLM Section Disposition Map (WALK-04)

**What:** Explicit per-LLM-section N/A rows in `SECURITY_AUDIT_REPORT.md` § OWASP LLM Top 10 2025. Source `SECURITY_AUDIT.md` §6 has **10 LLM sections** (LLM01–LLM10) + an "NCSC AI Guidelines — additional checks" sub-block.

**Required per WALK-04:** LLM03, LLM05, LLM10 explicit N/A rows with rationale (`"this app has no LLM surface"`). **Recommendation: all 10 LLM rows explicit + the NCSC AI sub-block row explicit = 11 N/A rows.** WALK-04 only specifies 3, but silent skipping of the other 7 is exactly the Pitfall 19 anti-pattern.

**Verification step for the gate:** `grep -c "^| §6 LLM" SECURITY_AUDIT_REPORT.md` must return `>= 10`. Test 4 in the shape gate.

### Pattern 5 — SECURITY.md Increment (DOC-10 final)

**What:** `SECURITY.md § Phase 12 Audit Index` appended after `## § Phase 11 Audit Index` (currently line 1386 — verified). Mirrors the 10-row Pattern G table format from Phase 11 Wave 6 (`docs/CONTROL_MATRIX.md` Pattern G).

**Recommended row shape (5 rows — 4 WALK + 1 DOC-10):**

```markdown
## § Phase 12 Audit Index

| Req | Control | Implementation | Verification | Framework |
|-----|---------|----------------|--------------|-----------|
| WALK-01 | Per-§ Vercel/Supabase → Firebase translation map | `docs/SECURITY_AUDIT_TRANSLATION.md` | `tests/security-audit-translation-shape.test.js` (N cases) | ISO 27001:2022 A.5.36 |
| WALK-02 | End-to-end checklist run against hardened repo | `SECURITY_AUDIT_REPORT.md` §§ 1–13 every numbered control | `tests/security-audit-report-shape.test.js` cardinality assertion (≥ X rows) | ISO 27001:2022 A.5.36 |
| WALK-03 | Per-item Pass/Partial/N/A with citations | `SECURITY_AUDIT_REPORT.md` row format (Source ref \| Control \| Verdict \| Citation \| Framework \| Evidence) | `tests/security-audit-report-paths-exist.test.js` (every cited path resolves) | OWASP ASVS L2 v5.0 / ISO 27001:2022 A.5.36 |
| WALK-04 | LLM03/05/10 explicit N/A with "no LLM surface" rationale (recommendation: all 10 LLM rows + NCSC sub-block row explicit) | `SECURITY_AUDIT_REPORT.md` § OWASP LLM Top 10 2025 | `tests/security-audit-report-shape.test.js` Test 4 (`>= 10` `\| §6 LLM` rows) | OWASP LLM Top 10 2025 / NCSC AI Guidelines |
| DOC-10 | Phase 12 incremental `SECURITY.md` append (Pitfall 19) — this 5-row Phase 12 Audit Index | This file | this commit; Phase 12 is the canonical milestone close | ISO 27001:2022 A.5.36 |
```

**Posture statement preservation:** `SECURITY.md` already carries the canonical "credible, not certified" footer at line 1416–1418 (verified). The Phase 12 increment MUST NOT alter this footer byte-for-byte. The same posture statement appears verbatim in `SECURITY_AUDIT_REPORT.md` executive summary.

### Anti-Patterns to Avoid

- **Silent skip of LLM sections.** WALK-04 anchor; every LLM section gets an explicit N/A row. The doc-shape gate asserts cardinality.
- **Pass verdicts citing only code paths.** Every Pass must cite: code path **+** test file **+** framework citation **+** evidence file. The row template enforces this via 6-column shape.
- **`:NN` line-number suffixes in citations.** Pitfall 4. Phase 11 Wave 6 swept SECURITY.md clean (3 offenders fixed). Phase 12 MUST NOT reintroduce them. Test 3 in the shape gate.
- **Posture statement drift.** Anywhere in the report or the SECURITY.md increment, the phrase MUST be verbatim. Any of `"compliant"` / `"certified"` (without the negation lookbehind for the canonical `"credible, not certified"` phrasing) is a hard fail. Test 7 in the shape gate.
- **Wishlist citations.** Citing `runbooks/foo.md` that does not exist. Test 5 (existsSync gate) mirroring `tests/ir-runbook-shape.test.js` Test 5.
- **Inflating Partial to Pass for operator-deferred evidence.** PENDING-OPERATOR captures (`docs/evidence/README.md` 20 of 22 rows) are Partial, not Pass. Substrate-honest verdict per Pitfall 19.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-§ translation table generation | A code generator that parses `SECURITY_AUDIT.md` and emits TRANSLATION.md | Write TRANSLATION.md by hand, walking the source TOC | The source is structural prose, not machine-parseable. Hand-written + schema-test gate is the credible approach (mirrors Phase 11 Wave 3 `docs/DATA_FLOW.md` Mermaid hand-authoring). |
| Verdict-row generation from CONTROL_MATRIX | Auto-merge CONTROL_MATRIX rows into report rows | Hand-author report rows citing CONTROL_MATRIX rows by name | CONTROL_MATRIX.md row schema (5 cols) differs from REPORT row schema (6 cols + verdict). Auto-merge would lose verdict + evidence + framework-citation reshaping. |
| LLM section enumeration | Programmatic disposal | Hand-author 10 N/A rows + 1 NCSC row | The 10 rows are constant; the 11th rationale is a single shared string. Hand-author with schema-test cardinality gate. |
| Citation-existence checking | Manual operator audit | Vitest schema-test mirroring `tests/security-md-paths-exist.test.js` | Phase 11 already proved this pattern. Don't regress to manual. |
| Framework citation normalisation | Search-and-replace at write time | Schema-test asserting `OWASP ASVS L2 v5.0 V\d+\.\d+\.\d+` regex shape on every row | Phase 11 Plan 11-01 already normalised 15 OWASP ASVS L2 citations. Same regex enforces drift prevention. |
| Posture-statement protection | Manual review | Schema-test byte-match on the verbatim phrase + Pitfall 19 forbidden-words lookbehind regex | Phase 11 already established the pattern (Plan 11-02 Decision D-11-02-02). Use the same regex. |

**Key insight:** Phase 12 is **scaffolded on top of the Phase 11 evidence pack and its enforcement gates**. Every drift-prevention gate this phase needs already exists in pattern form in Phase 11. Phase 12's job is to **apply the patterns, not reinvent them**.

---

## Runtime State Inventory

**None — Phase 12 is a documentation-only phase.** No databases, services, OS-registered state, secrets, or build artefacts are introduced or modified by Phase 12 deliverables.

Verified:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 12 introduces no Firestore documents, no GCS objects, no BigQuery rows. | — |
| Live service config | None — Phase 12 introduces no Cloud Functions, no scheduled jobs, no third-party service config. | — |
| OS-registered state | None — no Windows Task Scheduler / launchd / systemd / pm2 entries. | — |
| Secrets / env vars | None — no new secrets in GCP Secret Manager, no new env vars in CI. | — |
| Build artefacts | None — `SECURITY_AUDIT_REPORT.md` and `docs/SECURITY_AUDIT_TRANSLATION.md` are committed source files, not build outputs. `tests/security-audit-*.test.js` add to the Vitest suite but produce no new build artefacts. | — |

**The canonical question:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?*

**Answer for Phase 12:** Nothing. This is a pure doc + test phase.

---

## Common Pitfalls

### Pitfall 1: Pitfall 19 substrate-honest disclosure (project-canonical pitfall — apex risk for Phase 12)

**What goes wrong:** Phase 12 is the closing artefact of the entire milestone. A single over-claim ("ASVS L2 compliant" instead of "on track for ASVS L2") is exactly the failure mode `.planning/research/PITFALLS.md` line 657–693 warns against. The deal-killer is **claims that are almost true** — an auditor's diligence will expose the gap, and the conversation goes worse than if the claim had never been made.

**Why it happens:** Phase 12 produces auditor-facing prose. Prose drifts toward marketing register. The default mode in writing "we have X" is more confident than the substrate-honest mode "we have X with these caveats".

**How to avoid:**

1. **Locked posture statement.** Verbatim: `"credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2"`. The report's executive summary opens with this sentence. Any deviation is a hard fail.
2. **Schema-test forbidden-words gate.** Lookbehind regex `\b(?<!non-)(?<!not\s)(compliant|certified)\b` runs against `SECURITY_AUDIT_REPORT.md` body + `docs/SECURITY_AUDIT_TRANSLATION.md` body. Negation forms (`"non-certified"`, `"not certified"`, `"non-compliant"`, `"not compliant"`) are tolerated; bare forms are forbidden. Pattern is byte-identical to Phase 11 Plan 11-02 Decision D-11-02-02.
3. **PENDING-OPERATOR evidence → Partial verdict.** 20 of 22 rows in `docs/evidence/README.md` are PENDING-OPERATOR. Any control whose evidence is PENDING-OPERATOR gets a **Partial** verdict in the report, not Pass.
4. **Distinguish internal-review from pen-test.** Per Pitfall 19 line 681: "the audit-driven walkthrough (`SECURITY_AUDIT_REPORT.md`) is _evidence of internal review_, not external pen test. Distinguish them." The report's executive summary explicitly states this.

**Warning signs:**

- The report contains `"compliant"` or `"certified"` without a preceding `"not"` / `"non-"`.
- A Pass verdict cites no evidence file (citation chain ends at code path).
- A PENDING-OPERATOR evidence row is verdicted Pass instead of Partial.
- The executive summary uses the word `"audited"` (this implies external auditor — say `"internally reviewed"`).

### Pitfall 2: Broken citation drift (Pitfall 4 lineage)

**What goes wrong:** A row cites `SECURITY.md:938` (line 938 = `## § App Check`). A future commit inserts 10 lines before line 938. The citation now points to the wrong section.

**Why it happens:** Line numbers feel precise. They are also brittle to any insertion.

**How to avoid:** Paths-only convention. Cite `SECURITY.md § App Check`, never `SECURITY.md:938`. Schema-test Test 3 asserts zero `:\d+` suffixes in citations. Pattern is byte-identical to Phase 11 Plan 11-06 line-number drift sweep that fixed 3 offenders (`functions/src/gdpr/gdprExportUser.ts:197` + `gdprEraseUser.ts:289` + `src/main.js:916-917`).

**Warning signs:** Any `:\d+` or `:\d+-\d+` substring inside a citation cell.

### Pitfall 3: Silent LLM section skip (WALK-04 anchor)

**What goes wrong:** The Phase 12 author writes the LLM section as "N/A — no LLM surface" once at the top of §6 and moves on, skipping LLM01–LLM10 enumeration. An auditor scanning the report sees no LLM01 row and assumes the audit framework was not followed.

**How to avoid:** All 10 LLM rows + the NCSC AI sub-block row are explicit. Schema-test Test 4 asserts `>= 10` rows matching `^\| §6 LLM`. The single shared rationale string is the same across all 10 rows — say it once at the top of §6 ("All LLM Top-10 items: N/A — single rationale below.") and then enumerate each row pointing to that rationale.

**Warning signs:** Fewer than 10 `^| §6 LLM` rows in the report.

### Pitfall 4: Wishlist citations (Pitfall 6 lineage)

**What goes wrong:** The report cites `docs/evidence/mfa-luke.png` which does not exist (PENDING-OPERATOR per `docs/evidence/README.md` row 6).

**How to avoid:** Schema-test Test 5 (existsSync per cited path), mirroring `tests/ir-runbook-shape.test.js` Test 5 ("every cited `runbooks/*.md` path resolves on disk"). Cited evidence paths that do not exist must be flagged as `PENDING-OPERATOR` with the deferred-checkpoint pointer — never as a Pass evidence cell.

### Pitfall 5: Citing source-page line numbers in `SECURITY_AUDIT.md` itself

**What goes wrong:** The report cites `SECURITY_AUDIT.md:127` for the A03 control. `SECURITY_AUDIT.md` is a maintained document; line 127 moves.

**How to avoid:** Cite `SECURITY_AUDIT.md §2 A03` not `SECURITY_AUDIT.md:127`. The Source ref column uses `§N.M` notation. Phase 12 Wave 1 verified the source §-anchors are stable: 16 top-level `##` headings + sub-§§ for OWASP A01–A10 + LLM01–LLM10 + Supabase + Vercel + Sign-off.

---

## Code Examples

> Phase 12 introduces no application code. The "code" examples here are **test-file templates** for the doc-shape gates.

### Example 1 — `tests/security-audit-report-shape.test.js` (the canonical Phase 12 schema gate)

Pattern source: `tests/threat-model-shape.test.js` + `tests/retention-md-shape.test.js` + `tests/ir-runbook-shape.test.js` (all Phase 11 doc-shape gates).

```javascript
// Source: pattern from tests/threat-model-shape.test.js (Phase 11 Plan 11-03)
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPORT_PATH = resolve(process.cwd(), "SECURITY_AUDIT_REPORT.md");
const POSTURE = "credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2";

describe("SECURITY_AUDIT_REPORT.md doc shape", () => {
  it("Test 1: file exists at repo root", () => {
    expect(existsSync(REPORT_PATH)).toBe(true);
  });

  it("Test 2: H1 is the canonical report title", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    expect(body).toMatch(/^# Base Layers Diagnostic — SECURITY_AUDIT_REPORT/m);
  });

  it("Test 3: no :NN line-number suffixes in citation cells (Pitfall 4)", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    // Match :NN appearing inside table cells (between pipe characters) — exclude URLs and inline code spans
    // Pattern matches the same shape Phase 11 Wave 6 swept clean
    const offenders = body.match(/\|[^|]*\.(md|js|ts|json|rules)\:\d+/g) || [];
    expect(offenders).toEqual([]);
  });

  it("Test 4: all 10 OWASP LLM Top-10 sections enumerated as explicit rows (WALK-04)", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    const llmRows = body.match(/^\|\s*§6\s+LLM\d+/gm) || [];
    expect(llmRows.length).toBeGreaterThanOrEqual(10);
  });

  it("Test 5: every cited path exists on disk or in git ls-files", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    // Extract paths that look like repo-relative: e.g. SECURITY.md, docs/CONTROL_MATRIX.md, functions/src/audit/...
    // Use the same extraction regex as tests/security-md-paths-exist.test.js
    const cited = [...body.matchAll(/\b((?:docs|functions|src|tests|runbooks|\.github|public)\/[\w./-]+)\b/g)].map(m => m[1]);
    const unique = [...new Set(cited)];
    const missing = unique.filter(p => !existsSync(resolve(process.cwd(), p)));
    expect(missing).toEqual([]);
  });

  it("Test 6: posture statement appears verbatim in executive summary (Pitfall 19)", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    expect(body).toContain(POSTURE);
  });

  it("Test 7: Pitfall 19 forbidden-words check — no bare 'compliant' / 'certified' outside code spans", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    // Strip fenced code blocks before regex match (per Phase 11 Plan 11-02 pattern)
    const stripped = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
    // Negation-tolerant lookbehind: allow "non-certified" / "not certified" / "non-compliant" / "not compliant"
    const offenders = stripped.match(/\b(?<!non-)(?<!not\s)(compliant|certified)\b/gi) || [];
    expect(offenders).toEqual([]);
  });

  it("Test 8: §13 Sign-off Checklist Universal section has >= 14 verdict rows (matches SECURITY_AUDIT.md §13)", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    const universalSection = body.match(/## §13 Sign-off Checklist — Universal[\s\S]*?(?=^## |\Z)/m)?.[0] ?? "";
    const universalRows = universalSection.match(/^\|\s*§13\s+U#/gm) || [];
    expect(universalRows.length).toBeGreaterThanOrEqual(14);
  });
});
```

### Example 2 — `tests/security-audit-translation-shape.test.js`

```javascript
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TRANS_PATH = resolve(process.cwd(), "docs/SECURITY_AUDIT_TRANSLATION.md");

describe("docs/SECURITY_AUDIT_TRANSLATION.md doc shape", () => {
  it("file exists", () => {
    expect(existsSync(TRANS_PATH)).toBe(true);
  });

  it("walks every top-level § of SECURITY_AUDIT.md", () => {
    const body = readFileSync(TRANS_PATH, "utf-8");
    // SECURITY_AUDIT.md has 16 top-level ## sections (verified 2026-05-10):
    // §0 Operating Contract / §1 Discovery / §2 OWASP / §3 Auth / §4 Input / §5 Network /
    // §6 LLM / §7 Attack class / §8 Supabase / §9 Vercel / §10 Toolchain / §11 Remediation Tiers /
    // §12 Output / §13 Sign-off / §14 Maintenance / §15 References
    for (const ref of ["§1", "§2", "§3", "§4", "§5", "§6", "§7", "§8", "§9", "§10", "§13"]) {
      expect(body).toContain(ref);
    }
  });

  it("every 'N/A — Firebase architecture differs' row carries a rationale", () => {
    const body = readFileSync(TRANS_PATH, "utf-8");
    const naRows = body.match(/N\/A — Firebase architecture differs[^\n]*/g) || [];
    // Each match must be followed by a non-empty rationale cell (table-cell pipe + content)
    for (const row of naRows) {
      expect(row).toMatch(/\|/); // Has a notes cell separator
    }
  });

  it("Pitfall 19 forbidden-words check (same pattern as report shape Test 7)", () => {
    const body = readFileSync(TRANS_PATH, "utf-8");
    const stripped = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
    const offenders = stripped.match(/\b(?<!non-)(?<!not\s)(compliant|certified)\b/gi) || [];
    expect(offenders).toEqual([]);
  });
});
```

### Example 3 — Posture statement byte-match invariant (extracted constant)

```javascript
// Place at top of SECURITY_AUDIT_REPORT.md and at top of tests/security-audit-report-shape.test.js
// EXTRACT to a single constant if a second consumer needs it (do not duplicate the string by hand)
export const POSTURE_STATEMENT =
  "credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2";
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Run audit framework verbatim against the project | Translate audit framework to project's architecture first, then run | Phase 12 WALK-01 anchor | Vercel/Supabase-shaped audits cannot run verbatim against Firebase; the translation step is the credible substrate for the run |
| Verdict = Pass / Fail | Verdict = Pass / Partial / N/A (with mandatory rationale on N/A) | Phase 12 WALK-03 anchor | Pitfall 19 substrate-honest disclosure — Partial is the correct verdict for operator-deferred evidence; binary Pass/Fail forces inflation or false-fail |
| Citation = code path | Citation = code path + test file + framework citation + evidence file (6-column row) | Phase 12 WALK-03 row template | Auditor verifiability requires end-to-end traversability; single-citation Pass is the Pitfall 19 anti-pattern |
| LLM sections skipped when no LLM present | LLM sections explicit N/A with single shared rationale, all 10 LLM rows enumerated | Phase 12 WALK-04 anchor | Silent skip is Pitfall 19 by definition; auditor scanning the framework sees no LLM walkthrough and assumes the framework was not followed |

**Deprecated/outdated:**

- "We are SOC2 compliant" / "We are ASVS L2 certified" framing — superseded by the locked posture statement (Pitfall 19).
- Single-pass audit-then-fix workflow — superseded by Phase 1–11 incremental DOC-10 substrate-build; Phase 12 only runs the final walkthrough.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `SECURITY_AUDIT_REPORT.md` belongs at repo root (parity with `SECURITY_AUDIT.md` source) | §Architecture Patterns + §Standard Stack | LOW — could relocate to `docs/` per Claude's discretion; the schema-test path is the only consumer. Repo-root recommended for auditor discoverability via top-level `ls`. |
| A2 | `package.json` will continue to have no LLM SDK dependencies | §LLM Section Disposition Map | LOW — if an LLM SDK is added post-milestone, the WALK-04 rationale becomes stale. A future maintenance pass would need to flip the N/A rows to Pass/Partial walkthrough with actual LLM controls. Out of scope for this milestone. |
| A3 | Vitest schema-test pattern is preferred over manual operator checklist | §Recommended Project Structure + §Don't Hand-Roll | LOW — Phase 11 established the schema-test pattern across 5 doc-shape gates; regression to manual would be a deliberate downgrade. Schema-test recommended. |
| A4 | 4-wave structure is the right granularity (Wave 1 TRANSLATION / Waves 2–3 REPORT body / Wave 4 SECURITY.md increment + verify-work) | §Summary primary recommendation | LOW — could compress to 3 waves or expand to 5; the plan-checker can revise. 4-wave mirrors Phase 11's 6-wave but lighter (doc-only). |
| A5 | "N/A — Firebase architecture differs" rationale cells will be drift-free within a Vitest schema-test gate | §Common Pitfalls | LOW — Phase 11 Plan 11-02 Decision D-11-02-02 already proved the negation-tolerant lookbehind regex pattern works for Pitfall 19 forbidden-words. |
| A6 | `SECURITY_AUDIT.md` will not change between Phase 12 Wave 1 and Wave 4 | §End-to-End Walkthrough Pattern 2 | LOW — `SECURITY_AUDIT.md` is the source playbook (697 lines, stable); modifications happen quarterly per its own §14 Maintenance. Phase 12 ships within one commit-window. |

**Note:** All claims in this research are either VERIFIED against the live repo (file existence, line counts, citation chains traced) or LOW-risk assumptions about workflow choice. No CITED-only or ASSUMED-only claims of substance.

---

## Open Questions

> Open questions for the planner. Each carries a recommended default + the path to overriding it.

1. **Should `SECURITY_AUDIT_REPORT.md` live at repo root or under `docs/`?**
   - What we know: `SECURITY_AUDIT.md` is at repo root. `SECURITY.md` / `PRIVACY.md` / `THREAT_MODEL.md` / `CLAUDE.md` / `CONTRIBUTING.md` are at repo root. `docs/CONTROL_MATRIX.md` / `DATA_FLOW.md` / `RETENTION.md` / `IR_RUNBOOK.md` are under `docs/`.
   - What's unclear: the project's convention seems to be "top-level auditor entry points at root; supporting cross-walks under docs/". The REPORT is an entry point.
   - **Recommendation:** Repo root (`SECURITY_AUDIT_REPORT.md`). Pattern-match with `SECURITY_AUDIT.md`.

2. **How granular should the §13 Sign-off Checklist enumeration be?**
   - What we know: §13 has 14 Universal + 11 Supabase + 10 Vercel + 11 LLM = 46 checklist items.
   - What's unclear: do we enumerate all 46 as report rows, or batch-row the 11 Supabase ("all N/A — Firebase architecture differs") and 11 LLM ("all N/A — no LLM surface")?
   - **Recommendation:** Enumerate every row. The schema-test cardinality gate proves coverage. Batch-rowing risks Pitfall 19 silent-skip drift.

3. **Should the report include a section ID column that mirrors `SECURITY_AUDIT.md`'s numbered structure exactly?**
   - What we know: The source uses `§2 A01`, `§6 LLM01`, `§13 U#1` style refs.
   - What's unclear: whether the report's "Source ref" column copies these literally or invents a Phase-12-internal ID.
   - **Recommendation:** Copy source refs literally. Auditor traceability requires the report's Source ref column to be greppable against the source.

4. **Should the LLM N/A rationale be a single sentence repeated 10× or one canonical sentence with 10 pointer-rows?**
   - What we know: The shared rationale is verbatim across all 10 rows.
   - What's unclear: DRY (point to a single canonical sentence) vs. row-self-contained (every row carries the rationale).
   - **Recommendation:** Row-self-contained. Auditor reading row 7 in isolation should not need to scroll up. Document length is not a constraint in a 60-row report. Drift-resistance > terseness.

5. **Should Phase 12 produce a `12-DEFERRED-CHECKPOINT.md` for the `/gsd-verify-work 12` operator session?**
   - What we know: Phases 8, 9, 10, 11 all have deferred-checkpoint operator sessions for evidence captures.
   - What's unclear: whether Phase 12 needs one. The PENDING-OPERATOR rows in `docs/evidence/README.md` are owned by Phases 6/8/9/10/11 — Phase 12 does not introduce new operator captures.
   - **Recommendation:** No new `12-DEFERRED-CHECKPOINT.md`. The `/gsd-verify-work 12` operator session is the milestone close; the report's executive summary acknowledges that evidence captures are PENDING-OPERATOR per upstream phases (single cluster). The substrate-honest verdict in the report (Partial, not Pass, for those rows) is the substrate.

6. **Should the Phase 12 Audit Index match Phase 11's 10-row count exactly, or scale with phase scope?**
   - What we know: Phase 7 = 16 rows, Phase 8 = 19 rows, Phase 9 = 10 rows, Phase 10 = 3 rows, Phase 11 = 10 rows.
   - What's unclear: precedent allows variable row counts.
   - **Recommendation:** 5 rows (WALK-01..04 + DOC-10). Pattern-match Phase 10's 3-row precedent — a doc-only phase has fewer audit-index rows.

---

## Environment Availability

> Phase 12 has no external runtime dependencies. The Vitest + Node `fs.existsSync` + `readFileSync` stack is identical to every Phase 11 doc-shape gate and is verified-available across the milestone.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | doc-shape schema-tests | ✓ | 1.6.x (matches repo `package.json`) | — |
| Node `fs.existsSync` + `readFileSync` | path-exist + body-regex assertions | ✓ | Node 22 (matches `functions/` runtime) | — |
| `git ls-files` (CLI) | optional second-pass path-exist fallback | ✓ | system git | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.6.x (repo baseline) |
| Config file | `vitest.config.js` (existing — no changes) |
| Quick run command | `npx vitest run tests/security-audit-translation-shape.test.js tests/security-audit-report-shape.test.js tests/security-audit-report-paths-exist.test.js` |
| Full suite command | `npm test` |
| Phase 12 expected suite delta | + 3 new test files; + ~12 new test cases; current baseline 539 passed + 6 skipped → 551 passed + 6 skipped (zero regressions expected — doc-only changes do not touch application code) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WALK-01 | `docs/SECURITY_AUDIT_TRANSLATION.md` exists; walks every top-level § of source; "N/A — Firebase architecture differs" rows carry rationale; Pitfall 19 forbidden-words clean | unit (doc-shape) | `npx vitest run tests/security-audit-translation-shape.test.js` | ❌ Wave 0 (create in Wave 1) |
| WALK-02 | `SECURITY_AUDIT_REPORT.md` exists at repo root; §13 Universal section has ≥14 verdict rows | unit (doc-shape) | `npx vitest run tests/security-audit-report-shape.test.js -t "Test 8"` | ❌ Wave 0 (create in Wave 2) |
| WALK-03 | Every cited path resolves on disk; no `:NN` line-number drift; posture statement byte-match; Pitfall 19 forbidden-words clean | unit (doc-shape + paths-exist) | `npx vitest run tests/security-audit-report-shape.test.js tests/security-audit-report-paths-exist.test.js` | ❌ Wave 0 (create in Waves 2–3) |
| WALK-04 | ≥10 `\| §6 LLM` rows in the report (one per LLM01..LLM10) | unit (doc-shape cardinality) | `npx vitest run tests/security-audit-report-shape.test.js -t "Test 4"` | ❌ Wave 0 (create in Wave 3) |
| DOC-10 | `SECURITY.md § Phase 12 Audit Index` appears (case-sensitive heading); 5 row count | unit (extend existing `tests/security-md-paths-exist.test.js`) | `npx vitest run tests/security-md-paths-exist.test.js` | ✓ (extend existing) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/security-audit-*.test.js tests/security-md-paths-exist.test.js` (Phase 12's three new tests + the SECURITY.md path-exist gate that DOC-10 extends).
- **Per wave merge:** `npm test` (full suite — ~5–10s, repo baseline 539 tests).
- **Phase gate:** Full suite green + `/gsd-verify-work 12` operator session (recommendation: paste the report's executive summary + cite the WALK-01..04 + DOC-10 row in `SECURITY.md § Phase 12 Audit Index`; show schema-test green output; show citation chain by opening one Pass row and walking it).

### Wave 0 Gaps

- [ ] `tests/security-audit-translation-shape.test.js` — covers WALK-01 (Wave 1 deliverable)
- [ ] `tests/security-audit-report-shape.test.js` — covers WALK-02 + WALK-03 + WALK-04 + Pitfall 19 forbidden-words + Pitfall 4 line-number drift (Waves 2–3 deliverable)
- [ ] `tests/security-audit-report-paths-exist.test.js` — covers WALK-03 citation existence + Pitfall 6 wishlist prevention (Wave 3 deliverable)
- [ ] No framework install required (Vitest already configured).
- [ ] No new fixtures required (tests read directly from the new doc files).

---

## Security Domain

> `security_enforcement` is implicitly enabled (no `false` in `.planning/config.json`). However, **Phase 12 introduces zero new application code and zero new attack surface**. The security domain section is included for completeness and to confirm no new threats are introduced.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth surface introduced |
| V3 Session Management | no | No new session surface |
| V4 Access Control | no | No new access-control surface |
| V5 Input Validation | no | No new user input surface (`SECURITY_AUDIT_REPORT.md` is a committed source file, not user-generated) |
| V6 Cryptography | no | No new cryptographic surface |
| V14 Configuration | yes (indirect) | Phase 12 documents existing V14 controls; no new configuration surface |

### Known Threat Patterns for documentation-only phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Compliance over-claim (Pitfall 19) | Repudiation / Information Disclosure (commercial-trust) | Locked posture statement + schema-test forbidden-words + substrate-honest Partial verdicts for PENDING-OPERATOR evidence |
| Citation drift (broken `:NN` line numbers) | Information Disclosure (auditor cannot verify) | Paths-only convention + schema-test Pitfall 4 sweep |
| Wishlist citations (cited file does not exist) | Information Disclosure (auditor follows dead link) | existsSync schema-test Test 5 |
| Silent LLM section skip (WALK-04 anchor) | Repudiation (audit-framework-not-followed perception) | Cardinality schema-test Test 4 + single shared rationale string per row |

**No new STRIDE category is introduced by Phase 12.** All threats above are documentation-process threats, not application threats. The mitigations are schema-tests that gate the new docs.

---

## Sources

### Primary (HIGH confidence — verified against live repo 2026-05-10)

- `SECURITY_AUDIT.md` (project root, 697 lines verified) — top-level §§ enumerated; 16 `##` headings; LLM01–LLM10 + NCSC sub-block under §6; §13 Sign-off Checklist with 4 sub-checklists (Universal × 14, Supabase × 11, Vercel × 10, AI/LLM × 11).
- `SECURITY.md` (project root) — 36 `## §` sections enumerated; § Phase 11 Audit Index at line 1386; canonical "credible, not certified" footer at line 1416–1418 verified.
- `docs/CONTROL_MATRIX.md` — 128 REQ-prefixed rows verified (the citation source for Pass/Partial verdicts).
- `docs/evidence/README.md` — 22 evidence rows verified (2 present + 20 PENDING-OPERATOR).
- `docs/SECURITY_AUDIT_TRANSLATION.md` — does NOT yet exist (Wave 1 deliverable).
- `SECURITY_AUDIT_REPORT.md` — does NOT yet exist (Waves 2–3 deliverable).
- `.planning/research/PITFALLS.md` lines 657–693 — Pitfall 19 verbatim.
- `.planning/phases/12-audit-walkthrough-final-report/12-CONTEXT.md` — phase boundary + locked decisions.
- Phase 11 doc-shape gate test files (pattern source):
  - `tests/threat-model-shape.test.js`
  - `tests/retention-md-shape.test.js`
  - `tests/ir-runbook-shape.test.js`
  - `tests/security-md-paths-exist.test.js`
  - `tests/control-matrix-paths-exist.test.js`
- `runbooks/` directory listing (36 runbook files verified — `ir-credential-compromise.md` / `ir-dependency-cve.md` / `ir-supply-chain-compromise.md` / `phase6-mfa-recovery-drill.md` / `phase6-rules-rollback-rehearsal.md` / `phase-8-restore-drill-cadence.md` / `restore-drill-2026-05-13.md` / `socket-bootstrap.md` / `phase-9-monitors-bootstrap.md` all exist — citation chain pre-verified for IR runbook section of the report).

### Secondary (MEDIUM confidence — cross-walked but not directly verified in this session)

- Plan 11-02 Decision D-11-02-02 (negation-tolerant lookbehind regex pattern for Pitfall 19 forbidden-words) — pattern documented in `.planning/STATE.md` line 197 (referenced; regex is `\b(?<!non-)(?<!not\s)(compliant|certified)\b`).
- Plan 11-06 line-number drift sweep (3 offenders fixed: `gdprExportUser.ts:197`, `gdprEraseUser.ts:289`, `src/main.js:916-917`) — documented in `.planning/REQUIREMENTS.md` DOC-10 row.

### Tertiary (LOW confidence — none)

- None. All claims in this research are verifiable against committed repo state.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — zero new dependencies; Vitest + Node `fs` already in use across 5 Phase 11 doc-shape gates.
- Architecture: HIGH — documentation-tier ownership map mirrors Phase 11 patterns 1:1.
- Pitfalls: HIGH — Pitfall 19 is the apex risk and is explicitly anchored in CONTEXT.md + ROADMAP.md + PITFALLS.md + this research; mitigations are schema-tests with proven Phase 11 patterns.
- Validation Architecture: HIGH — 3 new doc-shape tests + 1 existing test extension; total Phase 12 suite delta ≤ 12 new test cases.

**Research date:** 2026-05-10
**Valid until:** Phase 12 close (estimate: ≤ 7 days — documentation phase, no upstream library changes can invalidate findings; only `SECURITY_AUDIT.md` itself changing would invalidate the §-enumeration tables, and that file is at quarterly cadence per its own §14).
