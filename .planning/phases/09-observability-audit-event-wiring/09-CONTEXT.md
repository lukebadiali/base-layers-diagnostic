# Phase 9: Observability + Audit-Event Wiring - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

**Goal:** Every sensitive operation in the app emits a verified-actor audit event; client and server errors flow into a single observability sink with PII scrubbed; auth anomalies wake an operator within minutes.

**ROADMAP description:** Sentry browser + node init with PII scrubber and EU residency; auth-anomaly alerts via Slack webhook; uptime monitor; Firebase budget alerts; `auditWrite` calls wired through every view that does sensitive ops (sign-in, sign-out, role change, delete, export, MFA enrol, password change).

**Depends on:** Phase 7 (`auditWrite` exists), Phase 8 (soft-delete + GDPR exist so events for them have callers).

**Requirements:** OBS-01, OBS-02, OBS-03, OBS-04, OBS-05, OBS-06, OBS-07, OBS-08, AUDIT-05, DOC-10 (incremental).

**Success Criteria** (from ROADMAP — must be TRUE at phase close):

1. Sentry browser SDK + Sentry node SDK both initialise on boot with shared DSN, `sendDefaultPii: false`, and a `beforeSend` PII scrubber that blocks chat bodies, comments, names, and emails; the Sentry project is hosted in EU region (`*.de.sentry.io`) and listed in `PRIVACY.md` as a sub-processor.
2. Every sign-in, sign-out, role change, delete, export, MFA enrolment, and password change emits an `auditWrite` event in which the actor identity comes from the verified ID token (server-side), never from the client payload.
3. A Slack webhook fires for auth anomalies: >5 failed sign-ins from the same IP in 5 minutes, MFA disenrolment, role escalation, and unusual-hour `gdprExportUser` calls; an operator receives a synthetic test alert end-to-end.
4. An uptime monitor checks `https://baselayers.bedeveloped.com` every 1 minute from at least 2 regions; Firebase budget alerts fire at 50% / 80% / 100% of monthly budget; Sentry quota alert at 70% of monthly free-tier.
5. Source maps for production releases are uploaded to Sentry via `@sentry/vite-plugin` in CI and stack traces in Sentry resolve to the original source.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints carried forward from accumulated decisions:
- Sentry EU region required (data residency / Pitfall 19 — substrate-honest disclosure).
- `beforeSend` PII scrubber must block chat bodies, comments, names, emails (links to GDPR Art. 6/Art. 32).
- `auditWrite` actor identity must come from verified ID token server-side, never client payload (Pitfall 11 — server-only audit log writes).
- Slack webhook URL stored via `defineSecret()` (Phase 7 secret-management pattern).
- Mirror Firestore-trigger writers from Phase 7 (`onOrgDelete`, `onUserDelete`, `onDocumentDelete`) feed audit events for soft-delete; lifecycle/GDPR callable Functions in Phase 8 also need audit-event wiring (AUDIT-05 wiring).
- `@sentry/vite-plugin` source-map upload runs in CI on push to `main` (Phase 1 CI extension).
- Pre-existing forward-tracking ledger row from Phase 8 (post-erasure-audit first run → operator follow-up) folds into Phase 9 OBS validation.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Notable seams already in place:

- `src/observability/*` — Phase 4 created two stubs as forward seams for Phase 9.
- `functions/src/util/sentry.ts` — Phase 7 `util/sentry` helper already exists (Pattern A — used by callables for error capture).
- `functions/src/audit/auditLogger.ts` + `functions/src/audit/auditEventSchema.ts` — Phase 7 server-side audit event substrate.
- `auditWrite` callable + 3 mirror triggers (`onOrgDelete`, `onUserDelete`, `onDocumentDelete`) — Phase 7 deployed.
- `src/cloud/audit.js` body fill — Phase 7 closed the Phase 4 stub.
- `src/views/auth.js` — Phase 6 introduced; sign-in / first-run / MFA-enrol / email-verification-landing render fns. AUDIT-05 wiring hooks into these.
- `src/cloud/gdpr.js` — Phase 8 export+erase callables exposed via this seam; AUDIT-05 wiring hooks into the call sites.
- `src/cloud/soft-delete.js` — Phase 8 softDelete / restoreSoftDeleted exposed via this seam; AUDIT-05 wiring hooks here.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria above. Plan-phase researcher should produce a per-success-criterion implementation breakdown with framework citations from `.planning/research/SUMMARY.md` (Sentry EU residency, Slack webhook patterns, Firebase budget alerts via `gcloud billing budgets`).

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
