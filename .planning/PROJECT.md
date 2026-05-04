# Base Layers Diagnostic

## What This Is

A web-based ten-pillar business diagnostic tool that BeDeveloped consultants run with client organisations. Internal staff lead engagements, score clients across the ten pillars over multiple rounds, and use built-in collaboration features (chat, comments, documents, plan/roadmap, sales-funnel KPIs) to track the work; clients see a scoped view of their own org. The product is live at `baselayers.bedeveloped.com` as a static single-page app on Firebase, but is currently between active engagements — giving us a window to do a hardening pass before onboarding new clients.

## Core Value

Client diagnostic data must remain confidential, intact, and recoverable — and BeDeveloped must be able to honestly answer a prospect's security questionnaire about how that's enforced.

## Requirements

### Validated

<!-- Existing capabilities inferred from `.planning/codebase/`. These shipped and are relied upon by the production app. -->

- ✓ **Ten-pillar diagnostic with Likert scoring (multi-round)** — `app.js:206` (`pillarScoreForRound`), `data/pillars.js`
- ✓ **Radar chart and report donut visualisations** — `app.js:1565`, `app.js:2377` (Chart.js 4.4.1)
- ✓ **Multi-org workspace** — internal users can manage many client organisations — `app.js:91-141`, Firestore `orgs/{id}`
- ✓ **Internal-vs-client role gating** — including "internal-as-client preview" mode — `app.js:579-605`
- ✓ **Per-pillar comments thread** — with internal-only filter — `app.js:286-302`
- ✓ **Action tracking** — CRUD + modal — `app.js:1981-2122`
- ✓ **Engagement lifecycle staging** — `app.js:2123-2194`
- ✓ **Document uploads** — Firebase Storage with real-time list — `app.js:2722-2876`
- ✓ **Real-time chat** — per-org, with unread-badge tracking — `app.js:2878-3026`
- ✓ **Plan / roadmap (per-org)** — `app.js:3028-3267`, Firestore `roadmaps/{orgId}`
- ✓ **Funnel KPI tracker** — quarter/year grid + comments — `app.js:3325-3800`
- ✓ **Admin panel** — user/org management — `app.js:2413-2599`
- ✓ **Manual export/import backup** — `app.js:4016-4061`

### Active

<!-- The "Full Hardening Pass" milestone. End state: a production-grade, compliance-credible platform on Firebase. -->

**Security hardening — close all CRITICAL + HIGH findings from `.planning/codebase/CONCERNS.md`:**

- [ ] Author + deploy `firestore.rules` and `storage.rules` enforcing `orgId`-scoped reads/writes (closes C3)
- [ ] Replace anonymous Firebase Auth + shared-password gate with real per-user Firebase Auth (Email/Password + custom claims for `role` / `orgId`) (closes C1, C2, M6, H3)
- [ ] Remove the hardcoded `INTERNAL_PASSWORD_HASH` + email allowlist from `app.js:443-444` (closes C2)
- [ ] Add MFA enrolment for internal users (closes H3)
- [ ] Delete the `html:` escape hatch in `h()`, audit all stored-content rendering paths (closes C4)
- [ ] Add Content-Security-Policy + security headers + Subresource Integrity on third-party scripts (closes H4)
- [ ] Replace `Math.random()` id generator with `crypto.randomUUID()` (closes H5)
- [ ] Validate file uploads — size cap, MIME allowlist, filename sanitisation, enforced both client- and rules-side (closes H6)
- [ ] Reconcile `serverTimestamp()` vs client-clock comparators in unread tracking (closes H7)
- [ ] Replace last-writer-wins cloud sync with transactional or subcollection-scoped writes (closes H8)

**Engineering foundations — pre-requisite tooling that makes the security work testable + auditable:**

- [ ] Add `package.json` + Vite build pipeline; self-host Firebase + Chart.js bundles (replaces CDN-with-no-SRI)
- [ ] Add Vitest + initial test suite covering data-integrity helpers (scoring, completion, status banding, migration, sync, unread, auth)
- [ ] Modular split of `app.js` into `auth.js / storage.js / cloud-sync.js / domain/scoring.js / views/*.js` (no framework rewrite)
- [ ] Add GitHub Actions CI workflow: typecheck (JSDoc), test, `npm audit`, build
- [ ] Add Dependabot / Renovate config for dependency monitoring
- [ ] Hashed-filename cache busting (replaces hand-bumped `?v=46`)

**Compliance-credible controls — the audit-trail layer:**

- [ ] Audit log of sensitive actions (auth events, role changes, deletes, exports) — written server-side via Cloud Function
- [ ] Soft-delete + restore window for orgs, users, comments, documents (closes the no-undo gap)
- [ ] Rate limiting on chat / comment / upload writes (Cloud Function or App Check)
- [ ] Automated daily Firestore export to Storage (DR — replaces "manual export only")
- [ ] Firebase App Check enrolled (binds clients to legitimate app instances)
- [ ] GDPR data export per user (right of access) and erasure flow (right to be forgotten)
- [ ] Documented data retention + deletion policy
- [ ] Centralised observability — error sink (Sentry free tier or equivalent) for client + Cloud Function errors
- [ ] `SECURITY.md` documenting controls, threat model, and how findings map to OWASP / NCSC / ASVS sections
- [ ] Vendor-questionnaire-ready evidence pack (control list + screenshots / artefacts)

**Audit-driven walkthrough:**

- [ ] Translate `SECURITY_AUDIT.md` Vercel/Supabase-specific sections into Firebase equivalents (Firestore Rules ↔ Supabase RLS, App Check ↔ BotID, Cloud Functions ↔ Edge Functions, etc.)
- [ ] Run the translated `SECURITY_AUDIT.md` end-to-end against the hardened repo, produce `SECURITY_AUDIT_REPORT.md`

### Out of Scope

- **Framework rewrite (React / Vue / Svelte)** — orthogonal to the hardening goal. Auditors don't care which framework you ran on; they care about controls. Adding a rewrite to this milestone doubles risk and dilutes the security narrative. Defer to a separate milestone if hiring/maintainability ever motivates it.
- **Platform migration to Vercel + Supabase** — explicitly considered. Decision: stay on Firebase. Translating `SECURITY_AUDIT.md`'s Vercel/Supabase guidance to Firebase is the lighter lift than migrating; Firebase has parity for every control we need (Auth, Rules, App Check, Cloud Functions, Storage Rules).
- **Native mobile apps** — out of scope for this milestone; web-only.
- **New diagnostic features** (more pillars, new visualisations, new collaboration tools) — not allowed during the hardening pass. Adding features mid-hardening invalidates the audit narrative ("the version we secured is the version we shipped").
- **Compliance certification** (SOC2 audit, ISO27001 certification) — out of scope. The bar is _credible_ — could honestly say "on track for" — not certified. Certification is a separate workstream involving auditors, policies, and ongoing operational evidence.
- **Backwards compatibility for existing localStorage sessions / shared passwords** — not in use right now (no active engagements), so we have freedom to do clean cutover migrations rather than maintain a backwards-compatible window.
- **Replacing `mailto:` invite flow with transactional email** — likely valuable but defer. The invite UX works; the security gap is in auth, not email delivery. Revisit after hardening.

## Context

**Project state at start of milestone:**

- Live at `baselayers.bedeveloped.com` (GitHub Pages, deployed from `main`).
- Currently between active client engagements — no live users to disrupt during this milestone.
- Codebase map exists at `.planning/codebase/` (analysis dated 2026-05-03), covering ARCHITECTURE / STACK / STRUCTURE / INTEGRATIONS / CONVENTIONS / TESTING / CONCERNS.
- `SECURITY_AUDIT.md` (project root, untracked) is a generic OWASP / NCSC / ASVS / Supabase / Vercel audit playbook — being used as a _framework_ for this milestone, not a script. Vercel/Supabase-specific sections need translating to Firebase equivalents.
- `CONCERNS.md` enumerates 4 CRITICAL, 8 HIGH, 9 MEDIUM, and 5 LOW findings against this codebase, plus a "Missing Critical Features" list (audit log, soft-delete, rate limiting, backup automation) and a "Recommended Fix Order" the roadmapper should treat as a starting point.

**Tech environment:**

- Vanilla JavaScript (ES2017+), no transpiler, no build step today.
- Single-file IIFE: `app.js` is 4,103 lines / ~169 KB.
- Backend: Firebase (Anonymous Auth + Firestore + Storage), project `bedeveloped-base-layers`.
- Third-party: Chart.js 4.4.1 (CDN, no SRI), Firebase JS SDK 10.13.0 (gstatic CDN, no SRI).
- Hosting: GitHub Pages via `CNAME = baselayers.bedeveloped.com`.
- No `package.json`, no test suite, no CI — these are added during this milestone.

**Audience:**

- Primary: BeDeveloped consultants (Luke, George — currently the only "internal" users) running diagnostic engagements.
- Secondary: Client organisations being diagnosed — currently see a scoped client view.
- New audience this milestone unlocks: prospects' IT / risk reviewers — who must be able to read a SECURITY.md, get a vendor-questionnaire response, and conclude "credible".

**Driver:**
Commercial pressure — a prospect / client is asking about security and compliance. BeDeveloped cannot sign or renew without a defensible answer. This milestone produces that answer.

## Constraints

- **Tech stack — Firebase**: Stay on Firebase (Auth, Firestore, Storage, Cloud Functions, App Check, Hosting). — Decided 2026-05-03; matches existing platform; avoids a parallel migration project on top of the security work.
- **Tech stack — vanilla JS + tooling**: Add `package.json` + Vite + Vitest + JSDoc types. Do **not** rewrite as React/Vue/Svelte during this milestone. — Decided 2026-05-03; modular split addresses the testability gap without taking on rewrite risk.
- **Compatibility — none required**: No live users currently, so breaking changes / clean cutovers are acceptable. — User confirmed 2026-05-03; lifts the "dual-write window" requirement that would otherwise apply.
- **Compliance — credible, not certified**: Aim for controls that map honestly onto SOC2 Common Criteria / ISO27001 Annex A / GDPR Art. 32 / OWASP ASVS L2. Certification itself is out of scope. — Decided 2026-05-03; balances commercial pressure against milestone size.
- **Audit framework — `SECURITY_AUDIT.md`**: Use as framework, translate Vercel/Supabase-specific sections to Firebase. — Decided 2026-05-03; produces an auditable trail back to a published checklist.
- **Security — no weakening of controls to make tests/features pass**: Per `SECURITY_AUDIT.md` §0(4) — if a test fails because a new control is doing its job, fix the test, not the control.
- **Data — protect existing production data**: The Firebase project has live data from prior engagements. Migration logic must preserve it (responses, comments, actions, plans, funnel data) even though _users_ aren't currently active. — Reduces blast radius of mistakes during the auth-replacement and Rules-deployment phases.

## Key Decisions

| Decision                                                                                    | Rationale                                                                                                                                                            | Outcome                             |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Stay on Firebase, do not migrate to Vercel + Supabase                                       | Avoids a parallel migration project on top of the security work; Firebase has parity for all controls needed; existing data + integrations stay.                     | — Pending (verify at milestone end) |
| Modular split of `app.js`, no framework rewrite                                             | Auditors care about controls not framework; rewrite + harden in same milestone doubles risk and dilutes the audit narrative.                                         | — Pending                           |
| Add `package.json` + Vite + Vitest + GitHub Actions CI                                      | Unlocks tests, SRI for third-party bundles, dependency monitoring, hashed cache-busting — all on every vendor questionnaire.                                         | — Pending                           |
| Use `SECURITY_AUDIT.md` as audit framework, translate Vercel/Supabase sections to Firebase  | Produces an auditable trail back to a published checklist; lighter lift than rejecting the doc and starting from scratch.                                            | — Pending                           |
| Compliance bar = "credible / on track for SOC2 + ISO + GDPR", not certified                 | Certification is a separate workstream involving auditors and ongoing evidence; this milestone produces the technical foundation it would build on.                  | — Pending                           |
| No backwards-compatibility window for existing localStorage sessions / shared passwords     | App not in active use; clean cutover migrations are simpler, more defensible, and lower risk.                                                                        | — Pending                           |
| Treat the "Recommended Fix Order" in `CONCERNS.md` as the starting point for phase ordering | The map's author already reasoned about leverage (rules first, then auth, then tooling, then backlog); roadmapper should adopt unless it has a strong reason not to. | — Pending                           |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-05-03 after initialization_
