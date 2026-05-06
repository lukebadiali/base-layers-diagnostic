# Phase 3: Hosting Cutover + Baseline Security Headers - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Cut production from GitHub Pages → Firebase Hosting at `baselayers.bedeveloped.com`, land HTTP security headers (HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, COEP), ship CSP in `Content-Security-Policy-Report-Only` mode with a working server-side report sink (`csp-violations` Cloud Function — HOST-05 + FN-10), wire CI to deploy from `main` plus per-PR preview channels, and disable the GH-Pages serving substrate (kept rollback-deployable for 14 days). This phase is the structural unblocker for any subsequent CSP work — no header-shaped controls (HSTS, frame-ancestors, Permissions-Policy, COOP/COEP, real `report-uri`) are possible on GitHub Pages (Pitfalls 14, 15, 16).

**Explicitly NOT in this phase** (owned elsewhere):

- Strict CSP enforcement / dropping `style-src 'unsafe-inline'` → Phase 10 (HOST-06, HOST-07; gated by Phase 4's M5 inline-style sweep)
- HSTS preload submission to hstspreload.org → Phase 10 (HOST-06; gated by ≥7-day stable policy)
- Modular split / IIFE breakup / `crypto.randomUUID()` swap / `html:` deletion / `replaceChildren()` migration → Phase 4
- Firestore + Storage Rules authoring → Phase 5; Rules deployment → Phase 6
- Real Auth (Email/Password + claims + MFA) → Phase 6
- Full `functions/` substrate (App Check, Zod, idempotency markers, Sentry node, per-function service accounts) → Phase 7
- `auditLog/` Firestore collection + audit-event wiring → Phase 7 + Phase 9
- Sentry browser/node init + EU residency + PII scrubber → Phase 9

**Pre-flight gate** (planner must include): `gcloud firestore databases describe` to verify the production Firestore region. The `csp-violations` Cloud Function deploys to `europe-west2` per D-06; if Firestore is also EU, this is consistent with Phase 11 PRIVACY.md narrative (and resolves STATE.md "Firestore region not yet verified" todo ahead of Phase 6). If Firestore is in a non-EU region (e.g., `nam5`), document the divergence in CONTEXT.md so Phase 6 owns the residency conversation.

</domain>

<decisions>
## Implementation Decisions

### Cutover Topology (Area 1)

- **D-01:** **Firebase project URL soak.** Deploy to Firebase Hosting via `firebase deploy --only hosting,functions`; smoke-test on the Firebase default URL (`bedeveloped-base-layers.web.app` or the project's default hosting URL — verify exact value via `firebase hosting:sites:list` during planning). PROJECT.md confirms no live users currently → no need for sub-subdomain soak (no auth/cookies-bound-to-domain logic ships until Phase 6) or parallel-run week. Vercel-for-hosting was raised; redirected to deferred per PROJECT.md "Stay on Firebase" lock + Pitfall 15 SOC2 co-location rationale.
- **D-02:** **Smoke + same-session CNAME flip (~1 hour).** Overrides the conservative 48h default. Defensible because (a) no users to absorb the soak, (b) rollback is registrar-side (DNS revert), (c) the Firebase default URL is a true production-shape URL on a Firebase project that already houses our Auth/Firestore/Storage. Smoke checklist (planner must enumerate): app boots without console errors; Firestore reads work (anon Auth still active until Phase 6); Storage uploads work; dashboard / diagnostic / report views render; `curl -I` returns the full header set (HSTS, X-CTO, Referrer-Policy, Permissions-Policy, COOP, COEP, CSP-Report-Only); securityheaders.com rates ≥ "A"; one CSP violation report makes it to Cloud Logging end-to-end.
- **D-03:** **GH-Pages rollback deployable for 14 days post-cutover.** On cutover day: disable GH-Pages serving in repo settings (HOST-01 success criterion #1) but **keep** the gh-pages branch + the Pages-deploy GitHub Actions workflow intact. Rollback procedure (15 min) = re-enable Pages in repo settings + revert the CNAME at the registrar; documented in `runbooks/hosting-cutover.md`. Delete branch + workflow on day 14 with a follow-up commit; close the cleanup ledger entry.

### `csp-violations` Cloud Function Provisioning (Area 2)

- **D-04:** **Minimal `functions/` skeleton in Phase 3.** Stand up: TypeScript + Node 22 + 2nd-gen Cloud Functions only + `firebase-admin@13.x` + `firebase-functions@7.x` + ESLint (extending the root config) + Prettier (root config) + `tsc --noEmit` + own `package.json` workspace + own `tsconfig.json` + Dependabot entry already exists from Phase 1 D-19. Skip in Phase 3 (Phase 7 lands these): `enforceAppCheck: true`, Zod input validation, idempotency-key marker docs, Sentry node SDK init, per-function minimal-IAM service accounts, `defineSecret()` substrate, `auditLog/{eventId}` collection. The Phase 3 skeleton is the substrate Phase 7 expands — same `functions/` directory, same Node version, same Gen-2 stance.
- **D-05:** **Endpoint URL = `firebase.json` rewrite to `/api/csp-violations`.** Same-origin. The CSP `report-uri` (and `report-to` endpoint URL) stays on `https://baselayers.bedeveloped.com/api/csp-violations` regardless of the underlying function name / region / project. No `connect-src` allowlist entry needed; no preflight surprises; the function URL shape can change in Phase 7 without a CSP edit.
- **D-06:** **`europe-west2` (London).** Closest GCP region to BeDeveloped + UK clients. Phase 11 PRIVACY.md (DOC-02) needs to document data residency; locking EU now avoids re-deploying later if a UK prospect questionnaire requires in-region. Pulls STATE.md's "Firestore region of `bedeveloped-base-layers` not yet verified" Phase 6 todo forward as a Phase 3 pre-flight: `gcloud firestore databases describe`. If Firestore is somewhere else, planner must record the divergence in CONTEXT.md and route the residency decision through Phase 6's allowed scope.
- **D-04a (derived):** **Function trigger = HTTPS `onRequest`** (not callable). CSP browsers POST raw HTTPS bodies with `Content-Type: application/csp-report` or `application/reports+json` — Firebase callables don't accept these wire formats. The function runs as `cspReportSink` (TS file `functions/src/csp/cspReportSink.ts`) and is exposed at `/api/csp-violations` via `firebase.json` rewrite (D-05). Region pinned per D-06.

### CSP Report-Only Policy Strictness (Area 3)

- **D-07:** **Two-tier policy.** Initial Report-Only directives:
  - `default-src 'self'`
  - `script-src 'self'` (Vite produces hashed bundles only — zero inline scripts; no `'strict-dynamic'` needed at this strictness — revisit only if SDK lazy-loading triggers violations during soak)
  - `style-src 'self' 'unsafe-inline'` — **temporary**; Phase 4 sweeps M5 inline `style="..."` strings + Chart.js inline-style usage; Phase 10 drops `'unsafe-inline'` (HOST-07)
  - `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com` (researcher must verify the full Firebase 12.x WebChannel/WebSocket origin list — pin against the Firebase JS SDK 12.x docs at planning time)
  - `frame-src https://bedeveloped-base-layers.firebaseapp.com` (per D-09 — Firebase Auth popup origin, added preemptively)
  - `img-src 'self' data: https:` (Chart.js may emit `data:` URIs; profile photos / avatars from Firebase Storage on `https:`)
  - `font-src 'self' data:` (no Google Fonts dependency expected; `data:` for any base64-embedded glyphs)
  - `object-src 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
  - `frame-ancestors 'none'` (header-only — one of the load-bearing reasons for Phase 3 existing per Pitfall 15)
  - `upgrade-insecure-requests`
  - `report-uri /api/csp-violations` + `report-to csp-endpoint` (per D-08)
  - **No** `worker-src`, `manifest-src`, `media-src` overrides — `default-src 'self'` covers them
- **D-08:** **Dual reporting — both legacy `report-uri` and modern Reporting-Endpoints/`report-to`.** Header set:
  - `Reporting-Endpoints: csp-endpoint="/api/csp-violations"`
  - CSP directive: `report-uri /api/csp-violations; report-to csp-endpoint`
  The `cspReportSink` function accepts both wire formats (legacy: `Content-Type: application/csp-report`, JSON body `{ "csp-report": {...} }`; modern: `Content-Type: application/reports+json`, JSON body is an array of report objects). Modern Chromium prefers `report-to` and emits a deprecation warning for `report-uri` only; legacy Safari / Firefox still use `report-uri`. Belt-and-braces eliminates report loss across browser versions.
- **D-09:** **`frame-src https://bedeveloped-base-layers.firebaseapp.com` added now**, not deferred to Phase 6. The CSP soak begins this phase and runs through Phase 10. Adding the auth popup origin preemptively is harmless (the origin isn't loaded until Phase 6 lands the auth flow) and means Phase 6's cutover doesn't have to touch the CSP — one less load-bearing change in the most load-bearing cutover phase of the milestone. Verify the popup origin shape at planning time — Firebase Auth uses `https://<projectId>.firebaseapp.com` for the IdP redirect handler; some Identity Platform configurations use a custom auth domain (e.g., `https://auth.baselayers.bedeveloped.com` if that's wired up later — defer that consideration to Phase 6 since it's not configured today).

### CSP Report Sink + Filtering (Area 4)

- **D-10:** **Cloud Logging structured logs as the sink.** Function calls `console.warn(JSON.stringify({severity:"WARNING", message:"csp.violation", report: <normalized>, fingerprint: <hash>, ...}))` — Cloud Logging captures structured JSON; queryable in Logs Explorer (`severity=WARNING resource.type="cloud_run_revision" AND jsonPayload.message="csp.violation"`). Cloud Logging free tier 50 GiB/mo; well within scope. **No** Firestore footprint (no rules predicate, no index creation, no soft-delete entanglement with Phase 8, no permission considerations). If a user-facing dashboard becomes valuable, Phase 9 can build it backed by Cloud Logging queries (or BigQuery sink, since Phase 7 sets up a BigQuery dataset for AUDIT-03 retention anyway).
- **D-11:** **Filter rules in the function before logging:**
  1. **Drop browser-extension origins** in `source-file` / `blocked-uri` / `document-uri`: `moz-extension://*`, `chrome-extension://*`, `safari-web-extension://*`, `webkit-masked-url://*`, `safari-extension://*`. These are user-installed extensions injecting scripts/styles into our pages — not our problem; would otherwise drown the signal (typical 70-90% of unfiltered CSP volume).
  2. **Drop synthetic origins**: `about:srcdoc`, `about:blank`, `data:` source-files. These show up when ads/extensions inject iframes; pure noise.
  3. **5-minute in-memory dedup window per (`blocked-uri-normalized`, `violated-directive`) tuple.** One real violation typically generates dozens of reports per session; dedup keyed on the tuple cuts log volume ~95% without losing distinct violations. Cold-start resets the dedup map (acceptable — across cold-starts we re-log once per dedup window, not per session).
  4. **Keep** `document-uri`-mismatch reports (i.e., reports from URLs not matching `baselayers.bedeveloped.com` or `*.web.app`) **during the soak window** — they tell us whether the project URL or some Firebase-default URL is generating reports we wouldn't otherwise see. Tighten this filter post-cutover to `document-uri ∈ {baselayers.bedeveloped.com, *.web.app, *--<project>.web.app}`.
- **D-12:** **Abuse protection on the un-authed endpoint = content-type + body-size only.** Function rejects with 400 anything not `application/csp-report` or `application/reports+json`; rejects with 413 bodies > 64 KB. App Check is **not** enforceable on this endpoint by design (browsers POST CSP reports without App Check tokens). Per-IP rate limiting / Cloud Armor would be Phase-7-grade infrastructure for a single low-volume endpoint; deferred. If Cloud Logging shows abuse during the soak, escalate to per-IP rate-limit (in-function token bucket) as a Phase 7 task.

### Standard Header Set (locked by ROADMAP success criterion #2; Claude's discretion on Permissions-Policy directive list and COEP variant)

- **D-13:** Static header set in `firebase.json` `hosting.headers`, `source: "**"`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — locked by ROADMAP. **Note:** preload submission to hstspreload.org is HOST-06, owned by Phase 10 (gated by ≥7-day stable policy). Setting the `preload` token here without submission is the documented preparation step.
  - `X-Content-Type-Options: nosniff` — locked.
  - `Referrer-Policy: strict-origin-when-cross-origin` — locked.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()` — Claude's discretion; this is the conservative-default minimisation.
  - `Cross-Origin-Opener-Policy: same-origin` — locked by ROADMAP. Required for COEP to apply.
  - `Cross-Origin-Embedder-Policy: credentialless` — Claude's discretion. **Picked over `require-corp`** because credentialless allows cross-origin loads without explicit CORP response headers (Firebase Auth popups, Firestore CDN, Chart.js bundles via Vite). `require-corp` would force every cross-origin resource to send `Cross-Origin-Resource-Policy: cross-origin` — Firebase doesn't, and we don't control its responses.
  - `Cross-Origin-Resource-Policy: same-origin` — Claude's discretion; defends against cross-origin reads. Verify Firebase Auth popup flow doesn't break under this in Phase 6.

### CI Deploy + Preview Channels (mechanically derivable; planner owns)

- **D-14:** CI extends `.github/workflows/ci.yml` with two new jobs:
  - `deploy` — runs on push to `main` (`if: github.ref == 'refs/heads/main'`) AFTER `build` succeeds; uses Workload Identity Federation (OIDC) per `runbooks/firebase-oidc-bootstrap.md` (Phase 1 D-23 deliverable; this phase plugs it in); calls `firebase deploy --only hosting,functions --non-interactive`.
  - `preview` — runs on `pull_request`; uses the same OIDC trust; calls `firebase hosting:channel:deploy pr-${{ github.event.pull_request.number }} --expires 7d`. Comments the preview URL on the PR via `FirebaseExtended/action-hosting-deploy@<sha>` or a small `gh pr comment` step. Branch protection (Phase 1 D-12) gets `deploy` added to required status checks **after** the first green deploy run registers the check name in GitHub's check registry — same Pitfall A pattern Phase 1 used.

### `SECURITY.md` / DOC-10 Incremental (carried from Phase 1 D-25 + Phase 2 D-21)

- **D-15:** Phase 3 appends to `SECURITY.md`:
  - § **HTTP Security Headers** — populated this phase: HSTS / X-CTO / Referrer-Policy / Permissions-Policy / COOP / COEP / CORP values + rationale for `credentialless` over `require-corp`. Cite OWASP ASVS V14.4, ISO 27001:2022 A.13.1.3, SOC2 CC6.6.
  - § **Content Security Policy (Report-Only)** — populated this phase: full directive list per D-07, dual reporting per D-08, sink + filter rules per D-10/D-11, soak duration + tightening gates (Phase 4 sweep enables Phase 10 enforcement). Cite OWASP ASVS V14.4, ISO 27001:2022 A.13.1, SOC2 CC6.6, GDPR Art. 32.
  - § **Hosting & Deployment** — populated this phase: Firebase Hosting at `baselayers.bedeveloped.com`, OIDC-authenticated CI deploy, per-PR preview channels, GH-Pages rollback retention 14 days. Cite OWASP ASVS V14.7, ISO 27001:2022 A.5.7 (cloud services), SOC2 CC8.1.
  Lands in same commit as the corresponding code change per Phase 1 D-25 atomic-commit pattern.

### Folded Todos

- **From STATE.md "Outstanding Todos":** Pulled forward to Phase 3 — "Firestore region of `bedeveloped-base-layers` not yet verified" — folded into D-06 as a pre-flight (`gcloud firestore databases describe`). The todo originally targeted Phase 6 + Phase 11; verifying earlier is cheap, the answer informs Phase 3's CF region choice, and resolves a Phase 11 PRIVACY.md dependency. Phase 6 still owns the residency conversation if the verified region is unsuitable.

### Claude's Discretion

- Permissions-Policy directive list — D-13 specifies a conservative default; planner can extend if Firebase Auth / Firestore docs flag any other features in use.
- COEP variant (`credentialless` chosen in D-13); revisit if the Phase 3 smoke shows Firebase Auth popup or Storage downloads breaking.
- `firebase.json` location at repo root (alongside `vite.config.js`, `package.json`); `.firebaserc` at repo root.
- `functions/` directory at repo root; `functions/package.json` is its own workspace (root `package.json` does NOT make `functions/` a workspace member — researcher should verify whether Vite + Vitest hoist any deps that would break the standalone install pattern Firebase expects).
- Exact rewrite glob in `firebase.json` for the SPA fallback: `{"source": "**", "destination": "/index.html"}` paired with `/api/**` rewrite to the function — verify SPA fallback ordering doesn't break the function rewrite at planning time.
- Cache headers on `dist/assets/*` (immutable hashed-filename bundles → `Cache-Control: public, max-age=31536000, immutable`) vs `index.html` (mutable entry → `Cache-Control: no-cache`).
- Firebase Hosting site name (default site uses the project ID; don't create an additional named site unless we want a separate billing/quota boundary — we don't).
- Whether to add the new `deploy` and `preview` checks to required-status-checks branch protection now or after first green run (Pitfall A pattern from Phase 1 D-12 says "after").
- The exact deduplication key normalization in the report sink (lowercase host, strip query string, etc.) — leave to planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context

- `.planning/PROJECT.md` — Active milestone (§"Active"), Locked Decisions (§"Constraints" — "Stay on Firebase"), Out of Scope (§ — Vercel + Supabase explicitly considered + rejected), Audience (§"Context" — IT/risk reviewers as new audience this milestone unlocks)
- `.planning/REQUIREMENTS.md` §"Hosting & Headers (HOST)" — HOST-01..HOST-05, HOST-08 acceptance criteria
- `.planning/REQUIREMENTS.md` §"Cloud Functions & App Check (FN)" — FN-10 acceptance criterion (paired with HOST-05)
- `.planning/REQUIREMENTS.md` §"Documentation Pack (DOC)" — DOC-10 incremental requirement
- `.planning/ROADMAP.md` §"Phase 3: Hosting Cutover + Baseline Security Headers" — Goal + Success Criteria + Dependencies + UI hint = yes
- `.planning/ROADMAP.md` §"Sequencing Constraint Validation" — Constraint #4: Hosting cutover before any real CSP work
- `.planning/STATE.md` §"Sequencing Non-Negotiables" — Tests-first / Rules-deploy / Subcollection-first / Hosting-first
- `.planning/STATE.md` §"Outstanding Todos" — "Firestore region not yet verified" (folded into D-06 as pre-flight)
- `CLAUDE.md` — Locked Decisions, Sequencing Non-Negotiables, Source layout target

### Pitfalls (load-bearing for Phase 3)

- `.planning/research/PITFALLS.md` §Pitfall 14 — Vite + base path traps; informs `base: '/'` in `vite.config.js` + CNAME-as-deploy-prerequisite + Firebase + Chart.js self-host (TOOL-03 / TOOL-04 already delivered Phase 1 — Phase 3 just ships them to prod)
- `.planning/research/PITFALLS.md` §Pitfall 15 — Hosting platform mismatch; **load-bearing** for D-01..D-03 cutover + the SOC2 evidence-pack reason for staying on Firebase Hosting (co-located project + IAM + audit trail). Includes the `firebase.json` `headers` skeleton template
- `.planning/research/PITFALLS.md` §Pitfall 16 — CSP rollout three-stage. **Load-bearing** for D-07 (two-tier strictness) + D-08 (report-uri + report-to dual-mechanism) + D-09 (frame-src for Firebase Auth popup origin)
- `.planning/research/PITFALLS.md` §Pitfall 8 — App Check staged rollout (referenced for "why csp-violations doesn't enforce App Check" in D-12)

### Research

- `.planning/research/SUMMARY.md` §"Phase 3: Hosting Cutover + Baseline Security Headers" — phase rationale + scope statement (matches D-01..D-15)
- `.planning/research/SUMMARY.md` §"Compliance Mapping Cheat-Sheet" — citations for D-15 SECURITY.md updates (OWASP ASVS V14.4 / V14.7, ISO 27001:2022 A.13.1.3 / A.5.7, SOC2 CC6.6 / CC8.1, GDPR Art. 32)
- `.planning/research/STACK.md` — `firebase-tools@15.16.0` already devDep'd Phase 1 D-01; Vite hashed-bundle output already exercised in Phase 1
- `.planning/research/ARCHITECTURE.md` §3 (Cloud Functions enumeration) — `csp-violations` is the first function landing; substrate Phase 7 expands
- `.planning/research/ARCHITECTURE.md` §"Target source layout" — `cloud/*` is the post-Phase-4 client-side adapter for Cloud Functions (Phase 7-relevant); not directly touched in Phase 3 but shapes how `firebase.json` rewrites get organised

### Codebase Map (analysis dated 2026-05-03)

- `.planning/codebase/CONCERNS.md` §H4 (no CSP / SRI / security headers) — the original gap Phase 3 closes (partial — full closure lands Phase 10 with HOST-07)
- `.planning/codebase/INTEGRATIONS.md` — Firebase project name (`bedeveloped-base-layers`), CDN endpoints currently in use; planner should verify the project ID + default hosting URL via `firebase projects:list`
- `.planning/codebase/STRUCTURE.md` — current file layout (root: `app.js`, `firebase-init.js`, `data/pillars.js`, `index.html`, `styles.css`, `assets/`, plus Phase 1+2 additions: `package.json`, `vite.config.js`, `tsconfig.json`, `eslint.config.js`, `.prettierrc.json`, `.husky/`, `.gitleaks.toml`, `.github/workflows/ci.yml`, `tests/`, `src/`, `runbooks/`, `SECURITY.md`, `CONTRIBUTING.md`, `coverage/` ignored, `dist/` ignored). Phase 3 adds: `firebase.json`, `.firebaserc`, `functions/`, `runbooks/hosting-cutover.md`
- `.planning/codebase/CONVENTIONS.md` — coding style preserved in `functions/` skeleton

### Phase Carry-Forward (already locked, do not re-derive)

- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` D-11 — CI deploy job deferred to Phase 3 (now landed via D-14)
- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` D-13 — Vite produces `dist/` in CI; Phase 3 deploys it
- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` D-19 — Dependabot already has a `functions/` ecosystem entry (forward-declared); Phase 3 D-04 makes it active
- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` D-23 — `runbooks/firebase-oidc-bootstrap.md` documented; Phase 3 D-14 plugs it in
- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` D-12 — branch protection bootstrap pattern (Pitfall A: required-status-checks added AFTER first green run); Phase 3 follows the same pattern for `deploy` + `preview` jobs
- `.planning/phases/02-test-suite-foundation/02-CONTEXT.md` D-04 — `index.html` already on `<script type="module">`; Phase 3 doesn't re-touch it
- `.planning/phases/02-test-suite-foundation/02-CONTEXT.md` D-21 — `SECURITY.md` § Build & Supply Chain populated; Phase 3 adds new sections per D-15

### Audit Framework

- `SECURITY_AUDIT.md` (project root) §A02 (Hosting + Headers), §A07 (CSP), §A03 (CI/CD) — checklist items Phase 3 closes (with Vercel/Supabase guidance translated to Firebase Hosting)
- `SECURITY_AUDIT.md` §0(4) — "no weakening of controls to make tests/features pass" — applies to CSP strictness calls (D-07 two-tier is a tactical, not philosophical, weakness — `style-src 'unsafe-inline'` is bounded by Phase 4's M5 sweep)

### Existing Runbooks (Phase 3 plugs in / extends)

- `runbooks/firebase-oidc-bootstrap.md` (Phase 1 D-23) — D-14's CI deploy job uses the documented OIDC trust pool
- `runbooks/phase-4-cleanup-ledger.md` (Phase 1 D-08) — receives one new entry: "Phase 3 GH-Pages rollback substrate (gh-pages branch + Pages workflow); delete on day 14 (date computed at cutover)"
- New: `runbooks/hosting-cutover.md` — Phase 3 deliverable; documents the cutover smoke checklist (D-02), DNS revert procedure (D-03), and the day-14 cleanup commit

### Compliance Citations (for `SECURITY.md` D-15 updates)

- OWASP ASVS L2 v5.0 — V14.4 (HTTP Security Headers), V14.7 (Build & Deploy Pipeline)
- ISO/IEC 27001:2022 Annex A — A.5.7 (cloud services), A.13.1 (network security management), A.13.1.3 (segregation in networks)
- SOC 2 CC6.6 (logical access security boundaries), CC8.1 (change management)
- GDPR Art. 32(1)(b) (confidentiality of processing systems and services)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`runbooks/firebase-oidc-bootstrap.md`** (Phase 1 D-23) — pre-documented Workload Identity Federation pool config; D-14's `deploy` + `preview` jobs plug into it without a research detour.
- **`firebase-tools@15.16.0`** (Phase 1 D-01) — already a devDep; `firebase deploy --only hosting,functions` and `firebase hosting:channel:deploy` are usable from CI day-one.
- **Vite hashed-filename bundle output** (Phase 1 D-13) — `dist/index.html` already references `dist/assets/*-<hash>.js` paths post-build; Firebase Hosting `public` config points at `dist/`. No Phase 3 build-tooling work; this phase only deploys what Phase 1 already builds.
- **`firebase-init.js`** (existing ES module) — already shaped for the eventual `firebase/` adapter (Phase 4); Phase 3 doesn't touch it but does verify the SDK 12.x origins it talks to are in the `connect-src` allowlist (D-07).
- **`.gitleaks.toml`** (Phase 1 D-18) — verify no false-positives on `firebase.json` / `.firebaserc` content (project IDs, region strings, hosting site names — none of these are secrets, but `.gitleaks.toml`'s SHA-256-hex-64 rule could in theory match a Firebase API key if one is ever pasted in).

### Established Patterns (carried forward)

- **Atomic commits per requirement** (Phase 1 D-25 / Phase 2 D-21) — D-15's SECURITY.md edits commit alongside the corresponding code change, not at phase end
- **Pinned versions, no rolling-`latest`** (Phase 1 D-01) — `functions/package.json` pins `firebase-admin` and `firebase-functions` to STACK.md-verified versions; Dependabot weekly cadence per Phase 1 D-19 keeps them current
- **OSV-Scanner soft fail / `npm audit` hard fail** (Phase 1 D-20 / D-21) — extends to `functions/` workspace (npm audit --omit=dev runs in `functions/` too via the new audit job step)
- **JSDoc-as-typecheck** (Phase 1 D-07) — DOES NOT apply to `functions/` which is real TypeScript. `tsc --noEmit` runs against `functions/` separately; root `tsconfig.json` excludes `functions/` per Phase 1 D-28
- **One Vite config** (Phase 1 D-31) — Phase 3 doesn't touch `vite.config.js`; the build artefact is already what Firebase Hosting wants
- **Branch-protection-via-runbook** (Phase 1 D-12, Pitfall A pattern) — `deploy` + `preview` checks added to required-status-checks AFTER first green run, not at PR-merge time
- **Conventional Commits** — `feat(03-XX): hosting cutover ...`, `chore(03-XX): firebase oidc deploy job ...`, `docs(03-XX): SECURITY.md hosting+CSP sections ...`

### Integration Points

- **`vite.config.js`** — no changes. `dist/` is the Hosting `public` directory; SPA `index.html` is the rewrite fallback target.
- **`index.html`** — no changes (Phase 2 D-04 already modular-bridged it). The `<meta http-equiv="Content-Security-Policy">` tag, if present, must be **removed** in Phase 3 — header CSP is canonical going forward; meta + header co-existence is conflicting policy. Verify at planning time whether one currently exists in `index.html` (codebase scout should confirm; if so, removal lands in same commit as `firebase.json` headers).
- **`.github/workflows/ci.yml`** — D-14 adds `deploy` + `preview` jobs; reuses existing `setup` cached install. New required-status-checks added to branch protection per D-12 Pitfall A pattern.
- **`.github/dependabot.yml`** — Phase 1 D-19 already has `functions/` entry forward-declared; D-04 makes it active. Verify the entry path matches the new `functions/` directory.
- **CI hard-fail policy** (Phase 1 D-09 / D-21, Phase 2 D-16) — extends to deploy: any header-set drift, any CSP report-collection-broken state should fail CI. **Health check** post-deploy: a tiny `curl -I https://baselayers.bedeveloped.com` step in the `deploy` job that asserts on header presence + values; failure fails the job and the deploy is rolled back via re-deploying the previous commit. Researcher should design the exact curl-based assertion (likely `npx -y @hapi/wreck` or just `curl -I | grep -E '(Strict-Transport|X-Content|Referrer-Policy|Permissions|Cross-Origin|Content-Security)'`).
- **`runbooks/phase-4-cleanup-ledger.md`** — receives one new entry: "Phase 3 GH-Pages rollback substrate; delete on day 14"
- **Firebase Console state** (out-of-band) — planner must enumerate the Firebase Console steps that aren't IaC: enabling Hosting on the project, custom-domain SSL provisioning kickoff, Workload Identity pool linkage. Document each as a `runbooks/` step; the cleanup ledger flags any "console-only" state for evidence-pack screenshots in Phase 11 DOC-09.

### Pre-Flight Verifications (planner must include)

1. `gcloud firestore databases describe` — verify Firestore region; align CF region per D-06
2. `firebase projects:list` — verify project ID + default hosting URL (`bedeveloped-base-layers.web.app` is assumed in D-01; confirm)
3. Confirm CNAME registrar (Cloudflare? GoDaddy? — codebase scout didn't surface; planner must verify before D-02 same-session flip)
4. Verify no `<meta http-equiv="Content-Security-Policy">` already lives in `index.html` (would conflict with header CSP); remove if present
5. Verify `firebase-tools@15.16.0` deploy permissions on the OIDC service account — `roles/firebasehosting.admin` + `roles/cloudfunctions.developer` + `roles/iam.serviceAccountUser` per `runbooks/firebase-oidc-bootstrap.md`
6. Test the `deploy` job against a non-`main` branch first (push to a `phase-3-test` branch with a `workflow_dispatch` trigger) to verify OIDC pickup before merging to `main` triggers a real prod deploy
7. Smoke test the `csp-violations` endpoint end-to-end before flipping CNAME: deploy function → POST a synthetic CSP report → verify it appears in Cloud Logging within 30s
8. Verify the Firebase JS SDK 12.x WebChannel + WebSocket origin list (D-07 `connect-src`) — pin against the SDK 12.x docs at planning time; the list can drift between minor versions

</code_context>

<specifics>
## Specific Ideas

- **The Vercel question is logged as deferred, not rejected.** PROJECT.md's Out-of-Scope explicitly considered Vercel + Supabase as a *full migration*; the user's mid-discussion question was about Vercel-for-hosting-only (a narrower variant). The narrower variant has appeal (better DX, simpler OIDC, audit framework already Vercel-shaped) but the same Pitfall 15 SOC2 co-location reason that locked the full-migration decision applies — splitting hosting from auth/functions/storage hurts the audit narrative. Not relitigated here. If a future prospect questionnaire explicitly demands Vercel's edge, revisit.
- **Phase 3 is the structural unblocker** for every subsequent header-shaped control — HSTS preload (Phase 10), `frame-ancestors 'none'` (already shipped here), `report-uri` to a real endpoint (already shipped here). The roadmap's hosting-first sequencing constraint (Pitfall 15) is honoured.
- **Two-tier CSP is *bounded* weakness, not permanent weakness.** `style-src 'self' 'unsafe-inline'` survives until Phase 4 sweeps M5 inline styles + Phase 10 flips the knob. The cleanup ledger gets one new entry per `'unsafe-inline'` instance the policy carries; Phase 10 closes them.
- **No `report-uri` on a meta tag.** If `index.html` has a `<meta http-equiv="Content-Security-Policy" content="...">` today, it has to come out — header CSP is canonical, and `meta` + `header` conflicting policies produce undefined browser behaviour. This is one of the Pitfall 15 reasons we needed Hosting cutover before any "real" CSP work.
- **`europe-west2` for the Cloud Function preempts a Phase 11 PRIVACY.md headache.** If we deploy `csp-violations` in `us-central1` and Firestore later turns out to be in EU, we have one cross-region Cloud Function to migrate before the evidence pack lands. Cheaper to pick now and verify (D-06 pre-flight).
- **The `csp-violations` function is the *only* unauthenticated public Cloud Function in the milestone** (every other callable enforces App Check + claims-checked auth from Phase 7 onward). Document this distinction explicitly in SECURITY.md so an auditor reading the function inventory understands why this one is exempt from App Check.
- **GH-Pages rollback substrate is *retained, not active*.** The Pages setting is disabled in repo settings on cutover day; the branch + workflow are dormant. Re-enabling = 5 min in repo settings + DNS revert (15 min). The 14-day window covers any "we discovered a regression a week later" scenario; deletion happens cleanly with full git history retained for evidence purposes.
- **Health check on deploy** — D-14's `deploy` job MUST include a header-presence assertion as its final step. A `firebase deploy` that succeeds but breaks `firebase.json` `headers` config (e.g., a typo in COOP that makes Firebase silently drop the header) should fail the job, not pass it. This is the deployment-time analogue of Phase 2 D-16's CI-strictness policy: if a control silently weakens, fail loudly.

</specifics>

<deferred>
## Deferred Ideas

- **Vercel-for-hosting-only** — User raised this mid-discussion. Per PROJECT.md "Stay on Firebase" lock + Pitfall 15 SOC2 co-location rationale, deferred. The narrower-than-full-migration variant has real appeal (DX, OIDC simplicity, audit-framework shape) but splitting hosting from auth/functions/storage hurts the audit narrative. Revisit only if a future prospect questionnaire explicitly demands Vercel's edge or BotID/Firewall.
- **Trusted Types (`require-trusted-types-for 'script'`) in Report-Only** — Useful signal for Phase 4's `html:` deletion + `replaceChildren()` sweep validation. Adds complexity to Phase 3's CSP. Revisit at Phase 4 entry as a Phase 4 task or a Phase 10 add-on.
- **Cloud Armor edge rate-limit on `csp-violations`** — Phase 7 territory if Cloud Logging shows abuse during the soak. Default Phase 3 protection is content-type + body-size only.
- **Per-IP rate limit at the function** (in-function token bucket) — Same: defer to Phase 7 unless soak data warrants escalation.
- **Firestore-backed CSP violations dashboard** — Cloud Logging Explorer is sufficient for Phase 3. If Phase 9 (observability) or a stakeholder wants an in-app admin view, build it then backed by Cloud Logging or BigQuery queries.
- **HSTS preload submission to hstspreload.org** — HOST-06; owned by Phase 10 (gated by ≥7-day stable enforced policy).
- **Strict CSP enforcement / dropping `style-src 'unsafe-inline'`** — HOST-07; owned by Phase 10 (gated by Phase 4's M5 sweep completion).
- **Custom Firebase Auth domain** (e.g., `auth.baselayers.bedeveloped.com` instead of `bedeveloped-base-layers.firebaseapp.com`) — D-09 pins the default. Custom auth domain is a Phase 6 consideration (Identity Platform + DNS).
- **Subresource Integrity (SRI) for any third-party scripts** — Already moot post-Phase 1: every dep is npm-installed + Vite-bundled (TOOL-03, TOOL-04). No CDN scripts remain. SRI is implicit via hashed-filename bundles. Document this in SECURITY.md per D-15.
- **CORP `cross-origin` for any specific resources** — D-13 picks `same-origin` as default. If any prod asset needs to be embeddable cross-origin (it shouldn't), revisit per-path with a `firebase.json` `headers` override on that path.
- **Reviewed Todos (not folded)** — none beyond the Firestore region one (which IS folded — D-06).

</deferred>

---

*Phase: 03-hosting-cutover-baseline-security-headers*
*Context gathered: 2026-05-06*
