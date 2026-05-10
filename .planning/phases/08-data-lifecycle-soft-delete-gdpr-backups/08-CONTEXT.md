---
phase: 8
phase_name: Data Lifecycle (Soft-Delete + GDPR + Backups)
status: ready_for_planning
mode: auto-generated
generated: 2026-05-10
---

# Phase 8: Data Lifecycle (Soft-Delete + GDPR + Backups) — Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Deletes are recoverable, GDPR Art. 15 + 17 are honourable, and a documented backup + tested restore exists — the milestone's recoverability and data-rights story.

**Depends on:** Phase 7 (Cloud Functions + audit log + App Check substrate; ID re-keying via Functions only after backup is live — Pitfall 10).

**Requirements (from ROADMAP):** LIFE-01..06, GDPR-01..05, BACKUP-01..07, DOC-10 (incremental).

**Success criteria (locked at roadmap level):**
1. Admin can soft-delete and restore an org, comment, document, message, or funnel comment within the 30-day window; soft-deleted items disappear from normal queries (rules predicate enforced) and are hard-deleted by the daily `scheduledPurge` Cloud Function past retention.
2. `gdprExportUser` produces a signed-URL JSON bundle (TTL ≤ 24h) containing all user-linked data: profile, owned diagnostic responses, comments authored, messages authored, action items assigned, audit events about the user.
3. `gdprEraseUser` replaces `authorId` with a deterministic pseudonym token across all denormalised collections (messages, comments, actions, documents, funnelComments) plus Storage objects under user-owned paths, redacts PII fields, and adds the user's tombstone token to the `redactionList` consumed by the next backup-rotation cycle; a post-erasure audit script confirms zero residual PII.
4. Daily Firestore export lands in `gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/` with the 30d Standard / 90d Nearline / 365d Archive lifecycle policy applied; Firestore PITR is enabled (7-day rolling); Storage bucket has Object Versioning + 90-day soft-delete enabled.
5. Storage signed URLs for documents are issued with TTL ≤ 1h and refresh-on-download; the prior unbounded `getDownloadURL` paths are gone.
6. One restore drill has been **performed and documented** in `runbooks/restore-drill-<date>.md` with timing, evidence, and any gaps; quarterly cadence documented.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per `workflow.skip_discuss=true`. Use the ROADMAP phase goal, the locked success criteria above, and project conventions (`.planning/PROJECT.md`, `.planning/codebase/CONVENTIONS.md`, `.planning/research/PITFALLS.md`) to guide decisions.

### Locked project decisions (do not relitigate)
- Firebase only (no Vercel/Supabase migration).
- Vanilla JS + Vite + Vitest + JSDoc-as-typecheck.
- Clean cutover migrations are acceptable — no live users.
- Compliance bar = credible, not certified.
- Pitfall 10 (subcollection migration before rules deploy) is satisfied by Phase 5; this phase respects the established subcollection shape.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Relevant entry points likely include:
- `functions/src/` — existing Cloud Functions surface from Phase 7 (auditWrite, identity bootstrap, rate-limit substrate).
- `src/cloud/*.js` — existing client-side seam stubs for Cloud Function calls (Phase 7 wave 3).
- `src/data/*.js` — data wrappers; soft-delete predicates may need to land here.
- `firestore.rules`, `storage.rules` — must add soft-delete `where` predicates and signed-URL TTL constraints.
- `runbooks/` — host the restore-drill log.

</code_context>

<specifics>
## Specific Ideas

No specific overrides — discuss skipped. Refer to ROADMAP success criteria and PITFALLS.md (notably Pitfall 10 — backups before any ID re-keying / GDPR erasure).

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
