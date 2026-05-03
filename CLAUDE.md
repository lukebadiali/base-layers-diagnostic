# Claude Project Guide — Base Layers Diagnostic

This repo is managed under the **GSD (Get Shit Done)** workflow. The canonical project context lives in `.planning/`.

## Read these first (in order)

1. **`.planning/PROJECT.md`** — what this project is, who it's for, current milestone, validated/active/out-of-scope requirements, decisions, constraints.
2. **`.planning/ROADMAP.md`** — phase plan with goals, success criteria, dependencies, and the dependency graph.
3. **`.planning/STATE.md`** — current phase + progress, accumulated decisions, sequencing non-negotiables, blockers.
4. **`.planning/REQUIREMENTS.md`** — REQ-IDs, traceability to phases.
5. **`.planning/research/SUMMARY.md`** — synthesised research; the consolidated 12-phase plan with framework citations.
6. **`.planning/codebase/`** — codebase map: ARCHITECTURE, STACK, STRUCTURE, INTEGRATIONS, CONVENTIONS, TESTING, CONCERNS. Analysis dated 2026-05-03.
7. **`SECURITY_AUDIT.md`** (project root) — the audit framework being used. Built for Vercel/Supabase; sections needing Firebase translation are scoped to Phase 12.

## Project at a glance

**Product:** Base Layers Diagnostic — a vanilla-JS single-page web app at `baselayers.bedeveloped.com` that BeDeveloped consultants use to run a 10-pillar business diagnostic with client orgs. Backend: Firebase (Anonymous Auth + Firestore + Storage). Currently between active engagements.

**Active milestone:** Full Hardening Pass — close all CRITICAL + HIGH `CONCERNS.md` findings; stand up audit log + soft-delete + GDPR rights + automated DR; produce a vendor-questionnaire-ready evidence pack. End state: production-grade, **compliance-credible** (SOC2 / ISO 27001 / GDPR Art. 32 / OWASP ASVS L2 — credible, not certified).

**Driver:** Commercial pressure — a prospect is asking about security and compliance.

## Locked decisions (do not relitigate without explicit ask)

- Stay on Firebase. No Vercel + Supabase migration.
- Stay on vanilla JS. Modular split + Vite + Vitest + JSDoc-as-typecheck. No React/Vue/Svelte rewrite.
- No backwards-compatibility window — clean cutover migrations are acceptable (no live users currently).
- Compliance bar = credible, not certified.
- 12-phase plan, not 5–8 — justified by four load-bearing sequencing constraints (see ROADMAP.md "Granularity Rationale").

## Sequencing non-negotiables

Violating any of these breaks the milestone:

1. **Tests first, modular split second** (Phase 2 → Phase 4).
2. **Rules committed-and-tested early; deployed only after Auth is live** (Phase 5 → Phase 6).
3. **Subcollection migration before Rules deployment** (Phase 5).
4. **Hosting cutover before any real CSP work** (Phase 3 → Phase 10).

## Workflow commands

- `/gsd-progress` — check where things stand and what to do next
- `/gsd-plan-phase <N>` — create the executable plan for phase N
- `/gsd-execute-phase <N>` — run plans in phase N (with parallelisation per `.planning/config.json`)
- `/gsd-verify-work <N>` — verify phase N's deliverables
- `/gsd-help` — full command list

## Conventions

- Conventional Commits (`docs:`, `chore:`, `feat:`, `fix:`, `refactor:`, `test:`).
- `.planning/` is committed (per config).
- No emojis in commit messages or in source unless asked.
- Keep responses tight — show diffs, don't over-explain.
- Source layout target (post-Phase 4): `firebase/` adapter + `data/*` + `domain/*` + `auth/*` + `cloud/*` + `views/*` + `ui/*` + `observability/*`. `domain/*` files import nothing from Firebase (lint-enforced).

## Research files of note

- `.planning/research/STACK.md` — exact 2026 versions verified against npm registry.
- `.planning/research/ARCHITECTURE.md` — target source layout + Firestore data model + Cloud Functions enumeration + dependency graph.
- `.planning/research/PITFALLS.md` — 20 critical pitfalls with prevention strategies; the four sequencing constraints anchor here.
- `.planning/research/FEATURES.md` — table-stakes vs differentiating vs anti-features, with framework citations.

---

*Initialized: 2026-05-03 (project setup via `/gsd-new-project`).*
