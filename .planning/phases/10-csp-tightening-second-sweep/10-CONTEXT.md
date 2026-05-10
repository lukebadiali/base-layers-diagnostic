# Phase 10: CSP Tightening (Second Sweep) - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

**Goal:** The CSP report-only headers from Phase 3 become enforced at the strictest level the app can run under, closing H4 fully and consuming the inline-style sweep done in Phase 4.

**ROADMAP description:** `style-src 'unsafe-inline'` dropped (Phase 4 sweep complete); `frame-src` for Firebase Auth popups; staged report-only soak before enforcement; HSTS preload submitted to hstspreload.org once policy stable for ≥7 days.

**Depends on:** Phase 4 (inline-style → class sweep complete), Phase 3 (report-only soak data via `csp-violations` endpoint).

**Requirements:** HOST-06 (CSP enforced + style-src 'self' + frame-src + base-uri + form-action), HOST-07 (HSTS preload submission), DOC-10 (incremental SECURITY.md update — final canonical pass in Phase 11).

**Success Criteria** (from ROADMAP — must be TRUE at phase close):

1. `Content-Security-Policy` is enforced (no longer Report-Only) with `style-src 'self'` (no `'unsafe-inline'`); `script-src 'self'` (or `'self' 'strict-dynamic'` if needed for Firebase SDK lazy loading); `frame-src` constrained to Firebase Auth popup origin; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`.
2. Sign-in, dashboard, radar/donut chart, document upload, and chat all function under enforced CSP (verified on staging before promotion); the `csp-violations` Cloud Function shows no new violations during a 7-day post-tightening soak.
3. HSTS preload submission is filed at `hstspreload.org` and the domain appears in the preload list.
4. `securityheaders.com` rating is "A+".

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints carried forward from accumulated decisions:
- **Phase 4 inline-style sweep** is the prerequisite for `style-src 'self'`. Phase 4 cleanup-ledger documented ~132 static `style="..."` strings in `src/main.js` deferred as "sub-wave 4.1" — these MUST be migrated to CSS classes BEFORE CSP enforcement, OR the affected views break under enforcement.
- **Phase 3 CSP-RO infrastructure** lives in `firebase.json` (Content-Security-Policy-Report-Only header + cspReportSink Cloud Function via `/api/csp-violations` rewrite).
- **Phase 6 Firebase Auth popup** requires `frame-src https://bedeveloped-base-layers.firebaseapp.com` (or the verified Identity Platform popup origin) — Phase 6 D-09 raised this as a forward-tracking row.
- **HSTS preload requirements:** `max-age=63072000; includeSubDomains; preload` (Phase 3 already sets this); domain must include `preload` directive AND be served on HTTPS only (no HTTP fallback) AND apex domain redirect to www (or vice versa) consistent.
- **Staged enforcement:** Report-Only must soak for ≥7 days with zero new violations before flipping to enforced. The cspReportSink (Phase 3) is the soak monitor.
- **Operator-paced steps:**
  - 7-day report-only soak (calendar time)
  - HSTS preload submission at hstspreload.org (web form, manual)
  - securityheaders.com rating verification (manual)
- **Pitfall 14/15/16 (CSP-related):** Already mitigated by Phase 3 (Hosting cutover + HTTP-header CSP infrastructure). Phase 10 is the enforcement flip.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Notable seams already in place:

- `firebase.json` — `Content-Security-Policy-Report-Only` header active; flipping the directive name to `Content-Security-Policy` is the enforcement gate.
- `functions/src/csp/cspReportSink.ts` — Phase 3 violation report sink. Soak monitoring uses Cloud Logging filter `severity=WARNING resource.type="cloud_function" jsonPayload.event="csp.violation"`.
- `tests/firebase-config.test.js` — Phase 3 schema-validation test (17 assertions). Needs to be updated to check enforced CSP shape.
- `runbooks/hosting-cutover.md` — Phase 3 — analog for new `runbooks/csp-enforcement-cutover.md`.
- `src/main.js` — Phase 4 deferred inline-style cluster (~132 strings); needs Phase 10 sweep OR sub-wave 4.1 to land first.
- `index.html` — `<meta http-equiv="Content-Security-Policy">` was deleted in Phase 3 (HTTP-header only). Verify still absent.
- `vite.config.js` — Phase 4 + Phase 9 — build pipeline output. CSP must accommodate `<script type="module">` ESM with hashed filenames.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria above. Plan-phase researcher should produce:
- Per-success-criterion implementation breakdown.
- Audit of `src/main.js` inline-style remnants (Phase 4 sub-wave 4.1 status — closed or pending).
- CSP directive matrix (`script-src`, `style-src`, `frame-src`, `frame-ancestors`, `base-uri`, `form-action`, `connect-src`, `img-src`, `font-src`, `object-src`, `media-src`, `worker-src`).
- Firebase Auth popup origin verification (against the verified Identity Platform popup target).
- 7-day soak monitoring procedure + cspReportSink query example.
- HSTS preload submission runbook.
- securityheaders.com manual verification step.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
