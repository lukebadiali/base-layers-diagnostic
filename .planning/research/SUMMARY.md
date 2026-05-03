# Project Research Summary

**Project:** Base Layers Diagnostic — Full Hardening Pass milestone
**Domain:** Compliance-credible hardening of an existing live Firebase + vanilla-JS SaaS (BeDeveloped Base Layers, `baselayers.bedeveloped.com`)
**Researched:** 2026-05-03
**Confidence:** HIGH (Firebase platform, OWASP/ISO/SOC2/GDPR mappings, version pinning all verified against authoritative sources on 2026-05-03)

---

## Executive Summary

The milestone is a **hardening pass on an existing 4,103-line single-IIFE vanilla-JS Firebase SPA**, not a greenfield build. The product has shipped, has prior client data on Firebase, and is currently between active engagements — which buys a clean-cutover window for breaking changes (no live users to disrupt). The commercial driver is a prospect security questionnaire BeDeveloped cannot currently answer credibly: 4 CRITICAL findings (client-only auth, hardcoded password hash in repo, no Firestore/Storage rules, latent stored-XSS), 8 HIGH findings (4-char passwords, no MFA, no CSP/SRI, `Math.random()` ids, file-upload validation gaps, no tests, monolithic codebase, last-writer-wins sync), plus structural gaps (no audit log, no soft-delete, no GDPR rights, manual-only backup).

**The recommended approach is reconciled across the four research dimensions into one consolidated 12-phase plan.** Stack research locked exact versions against the live npm registry (Firebase JS SDK 12.12.1, Vite 8.0.10, Vitest 4.1.5, firebase-functions 7.2.5 Gen 2, etc.) and pre-decided two consequential platform moves: **migrate hosting from GitHub Pages to Firebase Hosting** (GitHub Pages cannot set HTTP response headers, so a credible CSP/HSTS posture is impossible there) and **upgrade Auth to Identity Platform** (required for org-wide MFA enforcement and `passwordPolicy` API). Architecture research recommended a `firebase/`-adapter source layout, **subcollection-based Firestore data model** (`orgs/{id}/responses/*`, `orgs/{id}/comments/*`, etc.) replacing the current monolithic-doc shape, and **2nd-gen Cloud Functions in TypeScript** for the trusted-server work. Feature research framed every control against OWASP ASVS L2 / ISO 27001:2022 Annex A / SOC2 CC / GDPR Art. 32 with explicit citations and produced an evidence-pack deliverable (`SECURITY.md`, `PRIVACY.md`, `CONTROL_MATRIX.md`, `THREAT_MODEL.md`, `IR_RUNBOOK.md`, `RETENTION.md`, `DATA_FLOW.md`, `SECURITY_AUDIT_REPORT.md`).

**The key risk is sequencing, not technology.** Pitfalls research identified four load-bearing constraints that the naive reading of the work-list violates: (1) tests must come **before** the modular split (otherwise refactor regressions go undetected — H1+H2 are entangled); (2) Firestore Rules can be **committed and unit-tested early** but **deployed only after** real Auth + custom claims propagate (deploying strict rules against anonymous-auth users locks production out); (3) the **data-model migration to subcollections must precede Rules deployment** (Rules shape for nested-map writes vs subcollection writes is fundamentally different — doing it the other way means writing Rules twice); (4) **Firebase Hosting cutover must precede CSP** because `<meta http-equiv>` CSP is strictly weaker than HTTP-header CSP (no `frame-ancestors`, no `report-uri`, late-parsed). The consolidated phase plan in §"Implications for Roadmap" below respects all four constraints.

## Key Findings

### Recommended Stack

Single, authoritative version table — `STACK.md` numbers are canonical (verified against the live npm registry 2026-05-03; any minor drift in `ARCHITECTURE.md` defers to these). Full rationale in `.planning/research/STACK.md`.

**Production runtime (browser):**
- **Firebase JS SDK `12.12.1`** — Auth + Firestore + Storage + App Check + Functions (self-hosted via Vite bundle; closes H4 SRI). Major upgrade from current `10.13.0`.
- **Chart.js `4.5.1`** — radar + donut visualisations (drop-in upgrade from `4.4.1`; tree-shake to `RadarController` + `DoughnutController`).
- **DOMPurify `3.4.2`** — sanitiser for any future rich-text path (the current `html:` escape hatch is being deleted, but DOMPurify is the canonical replacement if rich-text returns).
- **`@sentry/browser` `10.51.0`** — centralised client error sink (free tier 5k errors/month; configure with `sendDefaultPii: false`).

**Cloud Functions (`functions/` workspace, TypeScript, Node 22, Gen 2):**
- **`firebase-admin` `13.8.0`** — server-side identity, custom claims, audit-log writes.
- **`firebase-functions` `7.2.5`** — 2nd-gen exclusively (1st-gen `functions.config()` is decommissioned March 2027).
- **`@sentry/node` `10.51.0`** — server-side error sink (same DSN as browser SDK).

**Build / dev / test:**
- **Vite `8.0.10`** — bundler + dev server + content-hashed filenames (closes M1) + SRI (closes H4) + multi-entry. Requires Node 20.19+ / 22.12+.
- **Vitest `4.1.5`** + `@vitest/coverage-v8` `4.1.5` + **`happy-dom` `20.9.0`** — test runner (closes H2).
- **TypeScript `6.0.3`** — `tsc --noEmit --allowJs --checkJs --strict` against JSDoc-annotated `.js` (no source rewrite per Constraints).
- **ESLint `10.3.0`** + **`eslint-plugin-no-unsanitized` `4.1.5`** + **`eslint-plugin-security` `4.0.0`** — flat config; catches every `innerHTML=` / `Math.random()` regression.
- **Prettier `3.8.3`** — zero-config formatting.
- **`@firebase/rules-unit-testing` `5.0.0`** — Firestore + Storage Rules unit tests against the local emulator.
- **`firebase-functions-test` `3.4.1`** — Cloud Functions unit tests.
- **`firebase-tools` `15.16.0`** — CLI for deploys + emulator suite (pin in `devDependencies`).

**CI / supply chain:**
- **GitHub Actions** — workflow shape: lint, typecheck, Vitest unit, Vitest rules (emulator), `npm audit --audit-level=high`, OSV-Scanner, build, deploy on `main`. Third-party Actions pinned to commit SHA. OIDC for Firebase auth (no long-lived service-account JSON).
- **Dependabot** — recommended over Renovate (single-developer GitHub-only project; Renovate's grouping advantage doesn't pay back the setup cost at this scale).
- **Socket.dev** — free GitHub App; behavioural malicious-package detection (post-Shai-Hulud essential).
- **gitleaks** — pre-commit + CI secret scan (would have caught C2 at commit time).

**Firebase platform decisions (verified):**
- **Firebase Hosting** replaces GitHub Pages — required for HTTP-header CSP/HSTS/Permissions-Policy. Custom domain `baselayers.bedeveloped.com` migrates via DNS update; ~2h end-to-end including TTL wait. Free Spark plan covers Hosting itself.
- **Auth → Identity Platform upgrade** — required for `passwordPolicy` API + SMS MFA + org-wide MFA enforcement. Free for first 50k MAU. **TOTP MFA** is the recommended primary factor; SMS optional.
- **App Check with reCAPTCHA Enterprise** — 10k assessments/month free, sufficient for this app's scale. Enrol → 7-day soak in unenforced mode → enforce per-service in stages (see Pitfall 8).
- **Cloud Functions Gen 2** exclusively (`functions.config()` decommission March 2027 forces this regardless).
- **Firebase Extensions:** `firestore-send-email` (transactional email path) + `delete-user-data` (GDPR Art. 17 right-to-erasure cascade).
- **Cloud Logging Data Access logs → BigQuery sink** — tier-2 infrastructure-level audit log (paired with the application-level `auditLog/{eventId}` Firestore collection).

**Hosting / cost note:** Cloud Functions, scheduled exports, BigQuery sink, and reCAPTCHA Enterprise all require **Blaze (pay-as-you-go) plan**. Confirm Blaze is enabled before Phase 7. Estimate: $5–15/month at the project's current load.

### Table-Stakes Feature List (flat, prioritised, traceable)

Single flat list — every item links to the CONCERNS finding it closes, the audit framework section it addresses, and the consolidated phase it belongs to. Full rationale in `.planning/research/FEATURES.md`.

| # | Feature | Closes | Framework citation | Phase |
|---|---------|--------|--------------------|-------|
| 1 | `firestore.rules` authored, unit-tested, **committed** (deploy gated to Phase 6) | C3 | OWASP A01 / ASVS V4.1, V4.2, V4.3 / ISO A.5.15, A.8.3 / SOC2 CC6.3, CC6.6 / GDPR Art.32(1)(b) | 5 (write+test) → 6 (deploy) |
| 2 | `storage.rules` authored, unit-tested, deployed (size cap 25 MB, MIME allowlist, path scoped to `orgs/{orgId}/...`) | C3, H6 | OWASP A01+A05 / ASVS V12.1 / ISO A.5.15 / SOC2 CC6.1 | 5 → 6 |
| 3 | `@firebase/rules-unit-testing` suite in CI (every collection × every role × allowed/denied) | H2 (rules slice) | ASVS V14.2 / ISO A.8.29 / SOC2 CC8.1 | 5 |
| 4 | Real Firebase Auth Email/Password — anonymous auth disabled | C1, M6 | ASVS V2.1 / ISO A.5.16, A.8.5 / SOC2 CC6.1 / GDPR Art.32(1)(b) | 6 |
| 5 | `passwordPolicy` ≥12 chars + leaked-password (HIBP) check (Identity Platform) | H3 | ASVS V2.1.1 / ISO A.8.5 / NIST 800-63B | 6 |
| 6 | Custom claims `{role, orgId}` set via `beforeUserCreated` blocking Cloud Function | C3 (substrate), M6 | ASVS V4.1 / ISO A.5.15 / SOC2 CC6.3 | 6 |
| 7 | TOTP MFA enrolled and **enforced** for all `role: internal` users; recovery codes shown once at enrolment | H3 | ASVS V2.7 / ISO A.5.17 / SOC2 CC6.7 / NIST AAL2 | 6 |
| 8 | MFA two-admin recovery procedure documented in `SECURITY.md` and **drilled live** | H3 | ASVS V2.7 / ISO A.5.17 | 6 |
| 9 | Hardcoded `INTERNAL_PASSWORD_HASH` + `INTERNAL_ALLOWED_EMAILS` deleted from `app.js` | C2 | ASVS V6.1 / ISO A.10.1 / SOC2 CC6.1 | 6 |
| 10 | Email verification enforced before privileged actions; sign-in error messages unified ("Email or password incorrect") | L1 | ASVS V2.1.9, V2.2.4 / ISO A.5.7 / SOC2 CC6.1 | 6 |
| 11 | Account lockout / progressive delay verified (Firebase Auth default; document) | H3 | ASVS V2.2.1 / ISO A.8.5 / SOC2 CC6.1 | 6 |
| 12 | `package.json` + Vite 8 build pipeline; Firebase + Chart.js self-hosted | H4 (SRI), M1 (cache) | ASVS V14.2 / ISO A.8.25, A.8.28 / SOC2 CC8.1 | 1 |
| 13 | Vitest 4 + `happy-dom` data-integrity test suite (scoring, completion, migration, sync, unread, auth) | H2 | ASVS V14.3 / ISO A.8.29, A.8.30 / SOC2 CC8.1 | 2 |
| 14 | GitHub Actions CI: lint + JSDoc-typecheck + Vitest unit + Vitest rules + `npm audit` + OSV-Scanner + build | H2 (CI gate), supply chain | ASVS V14.2 / ISO A.8.29 / SOC2 CC8.1 | 1 |
| 15 | Dependabot configured; Socket.dev GitHub App installed; `gitleaks` pre-commit + CI | OWASP A03 supply chain | ASVS V14.2 / ISO A.8.8 / SOC2 CC7.1 | 1 |
| 16 | Hosting cutover GitHub Pages → Firebase Hosting (CNAME `baselayers.bedeveloped.com`) | H4 enabler | ASVS V14.4 / ISO A.13.1.3 / SOC2 CC6.6 | 3 |
| 17 | Strict CSP via `firebase.json` headers (real HTTP header, not `<meta>`); HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP/COEP, `frame-ancestors 'none'`. Three-stage rollout: report-only → enforced-with-`unsafe-inline` (style) → strict | H4 | OWASP A02 / ASVS V14.4 / ISO A.13.1.3 / SOC2 CC6.6 | 3 (baseline) → 10 (tighten) |
| 18 | `Math.random()` → `crypto.randomUUID()` for all id minting; ESLint security plugin enforces | H5 | ASVS V6.3.1 / ISO A.8.24 / SOC2 CC6.7 | 4 |
| 19 | `html:` escape hatch in `h()` deleted; XSS regression tests added; ESLint `no-unsanitized` enforces | C4 | OWASP A03 / ASVS V5.3 / ISO A.14.2.5 / SOC2 CC6.6 | 4 |
| 20 | `innerHTML = ""` → `el.replaceChildren()` (17 sites) | M2 | ASVS V5.3 / ISO A.14.2.5 | 4 |
| 21 | Inline `style="..."` strings → CSS classes (enables strict CSP `style-src 'self'` in Phase 10) | M5 | ASVS V14.4.6 / ISO A.8.23 / SOC2 CC6.6 | 4 (sweep) → 10 (drop `unsafe-inline`) |
| 22 | File upload validation: client size + MIME + filename sanitisation, mirrored in `storage.rules` | H6 | ASVS V12.1, V12.2, V12.3 / ISO A.5.10, A.8.7 / SOC2 CC6.6 | 4 (client) + 6 (rules) |
| 23 | Modular split of `app.js` into `firebase/` adapter + `data/*` + `domain/*` + `auth/*` + `views/*` + `ui/*` (no framework) | H1 | ASVS V1.1.4 / ISO A.8.4 / SOC2 CC8.1 | 4 |
| 24 | Toast / inline error UX replaces `alert()` (7 sites); centralised `notify(level, message)` helper | M3 | OWASP A10 / ASVS V7.4 / ISO A.8.16 | 4 |
| 25 | Firestore data model migration — explode `orgs/{id}.responses{}.comments{}.actions[]` into subcollections `orgs/{id}/responses/*`, `comments/*`, `actions/*`, `documents/*`, `messages/*`, `readStates/*` | H8 (resolves last-writer-wins by eliminating shared parent doc) | ASVS V4.1, V4.2 / ISO A.5.15 / SOC2 CC6.3 | 5 |
| 26 | `users/{firebaseUid}` keyed by Firebase Auth UID; `internalAllowlist/{lowercasedEmail}` admin-managed allowlist | C1, C2 | ASVS V4.1 / ISO A.5.15 | 5 (schema) + 6 (cutover) |
| 27 | App Check with reCAPTCHA Enterprise — enrolled, 7-day soak in unenforced mode, then enforced per-service (Storage → Firestore collections one at a time → Functions); per-environment site keys; debug tokens in `.env.local` only | OWASP A05 / supply-chain perimeter | ASVS V11.1 / ISO A.8.23 / SOC2 CC6.6 / GDPR Art.32(1)(b) | 7 |
| 28 | Cloud Functions Gen 2 (TypeScript): `beforeUserCreated`, `beforeUserSignedIn`, `setClaims`, `auditWrite`, `softDelete`, `restoreSoftDeleted`, `scheduledPurge`, `scheduledFirestoreExport`, `gdprExportUser`, `gdprEraseUser`, mirror Firestore-trigger audit writers. `enforceAppCheck: true` on every callable; idempotency keys; Zod input validation; per-function service accounts; secrets via `defineSecret()`; `minInstances: 1` on auth-blocking functions | C1, C3, M4 substrate, missing audit log / soft-delete / GDPR rights | OWASP A01 / ASVS V4.2, V8.1 / ISO A.5.15, A.8.15 / SOC2 CC6.3, CC7.2 | 7 |
| 29 | Two-tier audit log: (a) `auditLog/{eventId}` Firestore collection — server-only writes via Cloud Functions, append-only via rules (`allow write: if false` for clients), schema-versioned, 12-month online retention then GCS archive; (b) Cloud Logging Data Access logs → BigQuery sink, 7-year retention | Missing audit log, M4 (partial) | OWASP A09 / ASVS V8.1, V8.2, V8.3 / ISO A.5.28, A.8.15, A.8.16 / SOC2 CC7.2, CC7.3, CC7.4 / GDPR Art.30, Art.32(1)(d) | 7 |
| 30 | Soft-delete + 30-day restore window across orgs, users, comments, documents, messages, funnel comments — `deletedAt` timestamp tombstone + `softDeleted/{type}/items/{id}` snapshot store; rules hide soft-deleted from normal queries; daily `scheduledPurge` Cloud Function | Missing soft-delete, no-undo gap | ASVS V8.3 / ISO A.8.10, A.8.13 / SOC2 CC6.5 / GDPR Art.5(1)(c), (e) | 8 |
| 31 | GDPR Right of Access (Art. 15): callable `gdprExportUser` returns signed URL to JSON bundle of all user-linked data; 24h URL TTL | Missing GDPR rights | GDPR Art.15 / ISO A.5.34 / SOC2 P5.1 | 8 |
| 32 | GDPR Right to Erasure (Art. 17): callable `gdprEraseUser` tombstones author references with consistent random token (preserves audit-trail integrity), redacts PII fields, propagates to backups via next-rotation redaction list | Missing GDPR rights | GDPR Art.17, Art.5(1)(c) / ISO A.5.34 | 8 |
| 33 | Rate limiting on chat/comment writes — App Check perimeter + Firestore Rules `request.time` predicate per user (preferred) or Cloud Function token-bucket (fallback) | Missing rate limiting, denial-of-wallet | OWASP A09 / ASVS V11.1 / ISO A.13.1 / SOC2 CC6.6 | 7 |
| 34 | Daily scheduled Firestore export → GCS bucket via 2nd-gen `onSchedule` Cloud Function; lifecycle 30d Standard / 90d Nearline / 365d Archive; PITR enabled (7-day rolling window) | Missing backup automation | ASVS V8.4 / ISO A.5.30, A.8.13, A.8.14 / SOC2 A1.2, CC9.1 / GDPR Art.32(1)(c) | 8 |
| 35 | One restore drill performed and documented before milestone close (`runbooks/restore-drill-<date>.md`) | "untested backups aren't backups" | ISO A.5.30 / SOC2 A1.3, CC7.5 | 8 |
| 36 | H7 fix: pull last-read markers into Firestore (`orgs/{id}/readStates/{userId}`); all comparators server-clock-vs-server-clock | H7 | ISO A.8.16 (operational integrity) | 5 (data-model) covers schema; verify in 8 |
| 37 | Sentry browser + Sentry node wired with `sendDefaultPii: false`, `beforeSend` PII scrubber, EU region, listed in `PRIVACY.md` as sub-processor; rate-limit on submission (max 10× same fingerprint per minute) | M4 | OWASP A09 / ASVS V8.2 / ISO A.8.16 / SOC2 CC7.2 / GDPR Art.32(1)(d) | 9 |
| 38 | Cloud Function alert on auth anomalies (>5 failed sign-ins from same IP in 5min, MFA disenrolment, role escalation, unusual-hour exports) → Slack webhook | OWASP A09, missing observability | ISO A.5.25, A.8.16 / SOC2 CC7.2, CC7.3 | 9 |
| 39 | Uptime monitor on `baselayers.bedeveloped.com` (Better Stack / UptimeRobot); Firebase budget alerts at 50% / 80% / 100% | Operational, denial-of-wallet | ISO A.8.16 / SOC2 A1.1, CC7.2 | 9 |
| 40 | Audit-event wiring throughout views: every sign-in, sign-out, role change, delete, export, MFA enrol, password change calls `auditWrite` Cloud Function (actor identity from verified ID token, never client payload) | Missing audit log | ASVS V8.1, V8.2 / ISO A.8.15 / SOC2 CC7.2 | 9 |
| 41 | Strict CSP tightened: drop `style-src 'unsafe-inline'` once Phase 4 inline-style sweep is complete; consider `'strict-dynamic'` for Firebase SDK lazy loading; staged via `Content-Security-Policy-Report-Only` for ≥7 days first | H4 (full closure), M5 | ASVS V14.4.6 / ISO A.8.23 / SOC2 CC6.6 | 10 |
| 42 | Storage signed URL TTL ≤ 1 hour; refresh on download (replaces long-lived `getDownloadURL`) | Latent — Storage URL leak risk | ASVS V12.4 / ISO A.8.23 / SOC2 CC6.6 | 8 |
| 43 | `SECURITY.md` — controls catalogue mapped to ASVS / ISO 27001:2022 / SOC2 CC / GDPR; disclosure contact (`security@bedeveloped.com`); supported versions; MFA recovery procedure; rotation schedule | Compliance evidence (the deliverable) | ISO A.5.5, A.5.37 / SOC2 CC2.3 | 11 |
| 44 | `PRIVACY.md` — sub-processors (Google/Firebase, Sentry, Google Fonts), Google Cloud DPA reference, retention, data residency (verify Firestore region — likely `eur3`/`europe-west2` for UK customers), international transfers, SCCs reference, data subject rights flow | GDPR Art.13, Art.30 | GDPR Art.13, Art.14, Art.30, Art.28, Art.46 / ISO A.5.34 | 11 |
| 45 | `THREAT_MODEL.md` (STRIDE-style or written prose: auth bypass, tenant boundary breach, file upload abuse, denial-of-wallet, supply-chain compromise, insider misuse) | OWASP A06 | ASVS V1.1, V1.2 / ISO A.5.7, A.5.8 / SOC2 CC3.1, CC3.2 | 11 |
| 46 | `docs/CONTROL_MATRIX.md` — table mapping each claimed control to (code path, config, doc, test, framework section) | Auditor walk-through artefact | ISO A.5.36, A.5.37 / SOC2 CC1–CC9 / GDPR Art.5(2) | 11 |
| 47 | `docs/RETENTION.md` — per-data-class retention period, basis, deletion mechanism (org data, user data, audit log 12mo + 6y archive, backups 90d, chat, documents) | GDPR foundation, SOC2 expectation | ISO A.5.33, A.8.10 / SOC2 CC6.5 / GDPR Art.5(1)(e) | 11 |
| 48 | `docs/IR_RUNBOOK.md` — credential compromise, data leak/RLS bypass, dependency CVE, supply-chain compromise, lost backup. Per-scenario: trigger, owner, decision tree, comms template, RCA template | Auditor checklist | ISO A.5.24–.29 / SOC2 CC7.3–.5 / GDPR Art.33 | 11 |
| 49 | `docs/DATA_FLOW.md` — diagram: Client → Firebase Auth → Firestore → Storage → Cloud Functions → Sentry; classifications, regions | GDPR Art.30 | ISO A.5.12 / GDPR Art.30 | 11 |
| 50 | `/.well-known/security.txt` (RFC 9116) + `SECURITY.md` disclosure contact; vulnerability disclosure policy paragraph (acknowledge in 5 business days, no legal action against good-faith researchers) | Industry norm | ISO A.5.5, A.5.6 / SOC2 CC2.3 | 11 |
| 51 | `docs/evidence/` VSQ-ready evidence pack — screenshots: MFA enrolment, audit-log entry (redacted), backup-policy console, Firestore region, App Check enforcement, rules deployment, latest CI green, latest `npm audit` clean | Compliance evidence | ISO A.5.36 / SOC2 CC4.1 | 11 |
| 52 | Translate `SECURITY_AUDIT.md` Vercel/Supabase-specific sections to Firebase equivalents (RLS↔Firestore Rules, service_role↔custom claims, Edge Functions↔Cloud Functions, BotID↔reCAPTCHA Enterprise/App Check, OIDC↔Firebase Auth, pgaudit↔Cloud Function audit log, PITR↔Firestore PITR) | Per `PROJECT.md` Active | ISO A.5.36 / SOC2 CC4.1, CC4.2 | 12 |
| 53 | Run translated `SECURITY_AUDIT.md` end-to-end against hardened repo; produce `SECURITY_AUDIT_REPORT.md` documenting every checklist item: pass / partial / N/A with citations | Per `PROJECT.md` Active — closes the loop | ISO A.5.36 / SOC2 CC4.1, CC4.2 | 12 |

**Anti-features (deliberately NOT built — would create more risk than they mitigate):** rolling our own session tokens / cookies; custom encryption beyond KMS; in-house password storage; "trust me" admin-bypass routes; client-written audit log; SIEM with no triage; bug bounty programme on day one; aggressive auto-deletion without retention policy; DRM/watermarking on documents; CAPTCHAs on every form; dual-control approval on every admin action; continuous-compliance scanners (Vanta/Drata) at this stage. Full list in `FEATURES.md`.

### Architecture Approach

**Target source layout** (mechanically derivable; details in `ARCHITECTURE.md`):

- **`src/firebase/`** — sole import surface for the Firebase SDK; everything else imports from here, never `firebase/*` directly. Centralises App Check init, ensures testability via Vitest stubbing.
- **`src/data/`** — per-collection typed wrappers (`orgs.js`, `users.js`, `responses.js`, `comments.js`, `actions.js`, `documents.js`, `messages.js`, `roadmaps.js`, `funnels.js`, `funnel-comments.js`, `audit-events.js`, `allowlist.js`). Owns listener lifecycle.
- **`src/domain/`** — pure functions; zero Firebase imports. `scoring.js`, `completion.js`, `banding.js`, `unread.js`, `migration.js`, `ids.js`. Trivially unit-testable.
- **`src/auth/`** — `session.js`, `mfa.js`, `claims.js` on top of `firebase/auth.js`.
- **`src/cloud/`** — callable Cloud Functions clients (`audit.js`, `soft-delete.js`, `gdpr.js`, `claims-admin.js`, `retry.js`).
- **`src/views/`** — one file per route, each exports `renderX(deps)` returning a DOM node.
- **`src/ui/`** — `dom.js` (`h()` with the `html:` branch deleted), `modal.js`, `toast.js`, `format.js`, `chrome.js`.
- **`src/observability/`** — `sentry.js`, `audit-events.js` (event-type enum).
- **`src/state.js`** — in-memory singleton, drastically smaller than today (no longer the auth source of truth).
- **`src/router.js`** — string-switch route dispatch (no URL hash for now).
- **`src/main.js`** — entry point, boots in correct order.
- **`functions/`** — separate workspace, TypeScript, 2nd-gen, per-handler files in `src/auth/`, `src/audit/`, `src/lifecycle/`, `src/gdpr/`, `src/ratelimit/`, `src/backup/`, `src/shared/`.

**Module dependency rules (lint-enforced):** `domain/` → nothing; `firebase/` → SDK only; `data/` → `firebase/`; `auth/` → `firebase/`; `views/` → `data/, domain/, auth/, ui/, cloud/`; `main.js` → everything in order. A unit test for `domain/scoring.js` needs **zero** Firebase mocks; a view test mocks `data/*`. That structure is what unblocks H1 + H2 testability.

**Firestore data model (target):** subcollection-based — `orgs/{orgId}` becomes a small parent doc with metadata only, plus subcollections `responses/{respId}`, `comments/{cmtId}`, `actions/{actId}`, `documents/{docId}`, `messages/{msgId}`, `readStates/{userId}`. Top-level: `users/{uid}` (Firebase Auth UID-keyed), `internalAllowlist/{emailLowercased}`, `roadmaps/{orgId}`, `funnels/{orgId}`, `funnelComments/{id}` (kept flat), `auditLog/{eventId}` (server-only writes, append-only via rules), `softDeleted/{type}/items/{id}` (server-only), `rateLimits/{uid}/buckets/{windowStart}`. Migration is a clean cutover (per `PROJECT.md` no-backwards-compat decision).

**Rules pattern:** predicate every rule on custom claims (`request.auth.token.role`, `request.auth.token.orgId`), never on `auth != null`. Constrain both `resource.data` and `request.resource.data` on every update path. Use `request.resource.data.diff(resource.data).affectedKeys().hasOnly(...)` to whitelist mutable fields. Disallow client writes to `users`, `orgs`, `auditLog`, `softDeleted`, `internalAllowlist` — all mediated by Cloud Functions.

### Critical Pitfalls (top 5 — load-bearing)

Full set of 20 in `.planning/research/PITFALLS.md`. The five that drive phase ordering:

1. **Locking yourself out on first Rules deploy (Pitfall 1).** Strict rules deployed before real Auth + claims propagate = production lockout. **Mitigation: write+test rules early, deploy only after Auth migration is live.** The phase plan separates "rules authored + unit-tested" (Phase 5) from "rules deployed to production" (Phase 6, after Auth).
2. **Refactoring without test fences (Pitfall 9).** Splitting the 4,103-line IIFE without a test suite surfaces ~30 closure-captured globals as runtime crashes on user paths. **Mitigation: tests first, modular split second.** The phase plan puts Vitest + initial test pass (Phase 2) before modular split (Phase 4).
3. **Subcollection migration after Rules (would force Rules rewrite).** Rules predicates for nested-map writes vs subcollection writes are fundamentally different shapes. **Mitigation: data-model migration to subcollections (Phase 5) precedes Rules deployment (Phase 6).** Doing it the other way means writing Rules twice.
4. **CSP via `<meta http-equiv>` is strictly weaker than HTTP-header CSP (Pitfalls 14, 15, 16).** No `frame-ancestors`, no `report-uri`, late-parsed; HSTS, Permissions-Policy, COOP/COEP all header-only. **Mitigation: Hosting cutover (Phase 3) precedes any CSP work; CSP rolled out in three stages — report-only (Phase 3) → enforced-with-`unsafe-inline`-style (Phase 3) → strict (Phase 10).**
5. **App Check enforced before debug tokens distributed (Pitfall 8).** Enforcing locks out CI, dev machines, and emulators. **Mitigation: enrol → 7-day soak in unenforced mode → enforce per-service in stages.** Phase 7 explicitly stages this.

Other notable pitfalls covered in detail in `PITFALLS.md`: `auth != null` confusion (Pitfall 2), `resource.data` vs `request.resource.data` (3), `getAfter()`/`get()` cost+depth limits (4), UID remapping for legacy `Math.random()` ids (5), custom-claims propagation lag (6), MFA recovery lockout (7), 1st-gen-vs-2nd-gen Cloud Function blocking-trigger latency (12), Cloud Functions secret management (13), audit log written from client (17), Sentry PII leakage via breadcrumbs (18), compliance theatre / over-claiming (19), unsafe sequencing of H7 + H8 (20).

## Implications for Roadmap

The four research dimensions converge on **12 consolidated phases** that respect every dependency constraint identified in pitfalls research and reconcile FEATURES.md's six logical groups with ARCHITECTURE.md's eleven implementation phases.

### Consolidated 12-Phase Plan

#### Phase 1: Engineering Foundation (Tooling)
**Rationale:** Everything else benefits from being testable, dependency-monitored, and self-hosted. This is the inverse-priority insight from FEATURES.md §"Critical Dependency Notes".
**Delivers:** `package.json`; Vite 8 + Vitest 4 + `@vitest/coverage-v8` + `happy-dom`; TypeScript 6 with `// @ts-check` JSDoc-typecheck mode; ESLint 10 flat config + `no-unsanitized` + `security` plugins; Prettier; `firebase-tools` 15 + emulator suite; Dependabot; Socket.dev; gitleaks pre-commit + CI; GitHub Actions workflow (lint, typecheck, Vitest unit, `npm audit`, OSV-Scanner, build) with third-party Actions pinned to commit SHA + OIDC for Firebase auth.
**Closes:** H1 substrate, H2 (CI gate), M1 (cache busting via Vite hashed filenames), M7 (`.gitignore`), supply-chain (OWASP A03).
**Avoids:** Pitfall 19 (compliance theatre — start the evidence trail with CI runs).
**Research flag:** Standard patterns. Skip per-phase research.

#### Phase 2: Test Suite Foundation (Tests-First)
**Rationale:** Pitfall 9 — modular split (Phase 4) without tests = silent regressions. Tests must come first to be the regression baseline.
**Delivers:** Vitest tests against the **current inline** `app.js` for: `pillarScoreForRound` + completion math, v1→v2 migration + `clearOldScaleResponsesIfNeeded` (silent-data-corruption risks), comment unread tracking, chat unread total, cloud sync merge logic, auth state machine. Each pure function is extracted to its own module with tests *first*, then the IIFE points at the extracted module.
**Closes:** H2 (initial coverage on the highest-leverage data-integrity paths).
**Avoids:** Pitfalls 9 (refactor without fences), 20 (unsafe H7+H8 sequencing — tests are the regression baseline).
**Research flag:** Standard patterns.

#### Phase 3: Hosting Cutover + Baseline Security Headers
**Rationale:** Pitfall 15 — Firebase Hosting is a prerequisite for HTTP-header CSP. Doing this early means CSP infrastructure is *available* from this point even if the policy itself stays permissive. ARCHITECTURE.md moved this up from "step 6" for the same reason.
**Delivers:** GitHub Pages → Firebase Hosting cutover; `firebase.json` `hosting.headers` config; baseline security headers (HSTS preload, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP/COEP); CSP in **`Content-Security-Policy-Report-Only` mode** with a tiny `csp-violations` Cloud Function endpoint receiving reports; CNAME `baselayers.bedeveloped.com` migrated; SSL auto-provisioned; CI deploys to Firebase Hosting from `main`.
**Closes:** H4 (partial — headers infrastructure in place; CSP tightening deferred to Phase 10).
**Avoids:** Pitfalls 14 (Vite + base-path), 15 (hosting platform), 16 (CSP rollout — three-stage rollout begins here).
**Research flag:** Standard patterns. Mechanical migration.

#### Phase 4: Modular Split + Quick Wins (Pure-Refactor Phase)
**Rationale:** Pitfall 9 satisfied (Phase 2 tests in place). All the changes that don't touch backend behaviour go in one phase: structural refactor + the lint-enforced fixes that make the structure stable.
**Delivers:** Modular split per ARCHITECTURE.md §2 (strangler-fig per module, one PR at a time, snapshot tests for dashboard/diagnostic/report rendered HTML); `Math.random()` → `crypto.randomUUID()` everywhere (forward-only, no historical re-keying — see Pitfall 10); `html:` escape hatch in `h()` deleted + XSS regression tests + ESLint `no-unsanitized` enforces; 17 `innerHTML = ""` sites → `el.replaceChildren()`; inline `style="..."` strings → CSS classes (enables Phase 10 CSP tightening); 7 `alert()` sites → toast/inline notify; client-side file upload validation (size, MIME, filename sanitisation — server-side mirror lands in Phase 6); `chat.js` + `funnel-comments.js` extract `renderConversation` helper (M8).
**Closes:** H1 (modular split), H5 (`Math.random()`), C4 (`html:` deletion), M2 (innerHTML clears), M3 (alert UX), M5 (inline styles), M8 (duplicated renderers), L2–L5 tidy-ups, file-upload client-side half of H6.
**Avoids:** Pitfalls 9 (refactor without tests — already mitigated by Phase 2), 10 (ID migration — by going forward-only), 14 (Vite base-path).
**Research flag:** Standard patterns.

#### Phase 5: Firestore Data Model Migration + Rules Authoring (Committed, Not Deployed)
**Rationale:** ARCHITECTURE.md §8 dependency note 1 — Rules shape depends fundamentally on data shape. Doing data model first means Rules are written once.
**Delivers:** New Firestore data model per ARCHITECTURE.md §4 (subcollections under `orgs/{orgId}`; `users/{uid}` keyed by Firebase Auth UID; `internalAllowlist`, `auditLog`, `softDeleted/{type}/items/{id}` top-level); one-shot migration script (clean cutover per `PROJECT.md` — no live users to disrupt) tested against a Firestore export of production into a `bedeveloped-base-layers-staging` project; H7 fix folded in (move last-read markers into Firestore `readStates/{userId}` so server-clock-vs-server-clock); `firestore.rules` + `storage.rules` authored with claims-based predicates (helpers `isAuthed()` requires `email_verified`, `isInternal()`, `inOrg(orgId)`), tenant-jump tests, immutable-field tests via `diff().affectedKeys().hasOnly(...)`, file size/MIME predicates in `storage.rules`; full `@firebase/rules-unit-testing` suite in CI. **Rules committed to repo but NOT deployed to production yet** — deploy gate is Phase 6 (real Auth + claims live).
**Closes:** Schema for C3 / H6 / H7 / H8; rules-test suite slice of H2.
**Avoids:** Pitfalls 1 (rules deployed before auth ready), 2 (`auth != null` confusion), 3 (`resource.data` vs `request.resource.data`), 4 (`get()` traps — tenant scope from claims), 20 (H7 fix isolated from H8).
**Research flag:** **NEEDS PHASE-LEVEL RESEARCH** during planning. Migration script correctness is high-blast-radius; should produce a per-field "new home" map and idempotency-marker design before implementation.

#### Phase 6: Real Auth + MFA + Rules Deploy (the Cutover Phase)
**Rationale:** ARCHITECTURE.md §8 dependency note 2 — `beforeUserCreated` must populate claims before Rules can rely on them. Pitfall 1 — strict rules production deploy must come *with* Auth migration, not before. This is the load-bearing cutover phase of the whole milestone.
**Delivers:** Anonymous Auth disabled in Firebase Console; Auth → Identity Platform upgrade; Email/Password sign-in with `passwordPolicy` ≥12 chars + leaked-password (HIBP) check; `beforeUserCreated` blocking Cloud Function (Gen 2, `minInstances: 1`, `defineSecret()` for any keys, per-function service account) reads `internalAllowlist/{lowercasedEmail}` and sets `customClaims = {role, orgId}`; `beforeUserSignedIn` mirrors signin audit event; `setClaims` callable for admin-driven role changes; "poke" pattern via `users/{uid}/_pokes/{pokeId}` for force-refresh after server-side claim mutation; bootstrap migration for Luke + George (Firebase Console manual creation + claims script + temp passwords + first-login MFA enrolment); TOTP MFA enforced for `role: internal`; recovery codes flow (10 hashed codes shown once at enrolment); two-admin recovery procedure documented + drilled live; sign-in error messages unified ("Email or password incorrect"); email verification enforced before privileged actions; account-lockout default verified; **`firestore.rules` and `storage.rules` deployed to production** (with the deploy gate of "real users with claims exist"); hardcoded `INTERNAL_PASSWORD_HASH` + `INTERNAL_ALLOWED_EMAILS` deleted from `app.js`; `users/`-doc legacy id fields kept readable via `users/{firebaseUid}.legacyAppUserId` mapping for backfill (see Pitfall 5); server-side mirror of file-upload validation in `storage.rules`.
**Closes:** C1, C2, C3 (deploy), M6, H3, H6 (server-side enforcement), L1.
**Avoids:** Pitfalls 1 (rules deploy gated to auth ready), 2 (anonymous auth disabled), 5 (legacy-id mapping), 6 (claims propagation via blocking trigger + poke pattern), 7 (MFA recovery), 12 (Gen 2 + min-instances on auth blocking).
**Research flag:** **NEEDS PHASE-LEVEL RESEARCH** during planning. TOTP UX, recovery codes UX, password reset flow, account-enumeration mitigation, two-admin recovery procedure are each their own micro-decisions. Also: verify Firestore region (`PROJECT.md` data-residency requirement for UK clients).

#### Phase 7: Cloud Functions + App Check (Trusted-Server Layer)
**Rationale:** ARCHITECTURE.md §3 + Pitfall 8 — App Check rollout requires existing Cloud Functions infrastructure to issue debug tokens against; both phases share workspace setup.
**Delivers:** `functions/` workspace (TypeScript, Node 22, Gen 2); `firebase-admin@13.8.0` + `firebase-functions@7.2.5`; per-function service accounts with minimal IAM; secrets via `defineSecret()`; Sentry node SDK init at top of `index.ts`; Zod input validation + idempotency keys + `enforceAppCheck: true` on every callable; `auditWrite` callable + Tier-1 `auditLog/{eventId}` Firestore collection (server-only writes, append-only via rules) + Tier-2 Cloud Logging Data Access logs → BigQuery sink with 7-year retention; `setClaims` callable; mirror Firestore-trigger audit writers (`onOrgDelete`, `onUserDelete`, `onDocumentDelete`); rate limiting on chat/comment writes (Firestore Rules `request.time` predicate preferred; Cloud Function token-bucket fallback); App Check enrolled with reCAPTCHA Enterprise (per-environment site keys; debug tokens in `.env.local` only, gitignored); 7-day soak in **unenforced** mode watching the verified/unverified dashboard; then enforce per-service in staged order: Storage → Firestore (collection-by-collection via rules `requireAppCheck` predicate, not the global toggle) → Functions; quota monitor + alert at 70%.
**Closes:** Trusted-server substrate for Phase 8 audit/soft-delete/GDPR work; missing audit log; M4 (partial); rate limiting.
**Avoids:** Pitfalls 4 (offload complex authz to Functions, not Rules), 8 (App Check staged rollout), 12 (Gen 2 + min-instances), 13 (secret management), 17 (audit log server-only).
**Research flag:** **NEEDS PHASE-LEVEL RESEARCH** during planning. Per-function specifics: input schema, idempotency strategy, rate-limit thresholds, cold-start tolerance for callable vs background. Also: confirm Blaze plan enabled; verify reCAPTCHA Enterprise quota fits the projected chat volume.

#### Phase 8: Data Lifecycle (Soft-Delete + GDPR + Backups)
**Rationale:** All depend on the audit-log + Cloud Functions infrastructure from Phase 7. Pitfall 11 — GDPR erasure must coordinate with backup retention; doing them in the same phase keeps the policy coherent.
**Delivers:** Soft-delete + 30-day restore window across orgs, users, comments, documents, messages, funnel comments — `deletedAt` tombstone + `softDeleted/{type}/items/{id}` snapshot store; rules hide soft-deleted from normal queries; daily `scheduledPurge` Cloud Function; soft-delete UI in admin panel + restore UI; `gdprExportUser` callable returning signed URL (≤24h TTL) to JSON bundle; `gdprEraseUser` callable with consistent-token tombstone pattern (preserves audit trail), redacts PII fields, propagates to backups via next-rotation redaction list; daily `scheduledFirestoreExport` Cloud Function → `gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/`; GCS lifecycle 30d Standard / 90d Nearline / 365d Archive; PITR enabled (7-day rolling); Object Versioning + 90d soft-delete on Storage bucket; quarterly restore-drill cadence documented; **one restore drill performed and documented before milestone close** (`runbooks/restore-drill-<date>.md`); Storage signed URL TTL ≤ 1h with refresh-on-download; H8 fully closed (subcollection writes don't collide on parent doc).
**Closes:** Missing soft-delete, missing GDPR rights, missing backup automation; H8 (verified end-to-end); Storage URL leak risk.
**Avoids:** Pitfalls 10 (id migration via Cloud Functions only after backup live), 11 (GDPR cascade gaps + backup-rotation propagation), 20 (H8 isolated from H7 which was Phase 5).
**Research flag:** **MAY NEED PHASE-LEVEL RESEARCH** during planning if GDPR erasure cascade across all 6+ collections needs careful field-level mapping. Otherwise standard patterns.

#### Phase 9: Observability + Audit-Event Wiring
**Rationale:** Cloud Functions exist (Phase 7); soft-delete + GDPR exist (Phase 8). Now wire `auditWrite` calls from every view that does sensitive ops + add the watchers and alerts.
**Delivers:** Sentry browser + Sentry node init with shared DSN; `sendDefaultPii: false`; `beforeSend` PII scrubber covering chat bodies, comments, names, emails; EU region `*.de.sentry.io`; rate-limit on submission (max 10× same fingerprint per minute); listed in `PRIVACY.md` as sub-processor; source-map upload via `@sentry/vite-plugin` in CI; Cloud Function alert on auth anomalies → Slack webhook (>5 failed sign-ins same IP in 5min, MFA disenrolment, role escalation, unusual-hour exports); uptime monitor on production (Better Stack or UptimeRobot); Firebase budget alerts at 50% / 80% / 100%; audit-event wiring throughout views (every sign-in, sign-out, role change, delete, export, MFA enrol, password change calls `auditWrite` — actor identity from verified ID token, never client payload).
**Closes:** M4 (full).
**Avoids:** Pitfall 18 (Sentry PII leakage), 19 (compliance theatre — wire the audit so the `SECURITY.md` claims are actually evidenced).
**Research flag:** Standard patterns. Sentry has a turnkey Firebase Functions integration.

#### Phase 10: CSP Tightening (Second Sweep)
**Rationale:** Phase 4 inline-style sweep complete; Phase 3 CSP report-only has been soaking for the entire milestone. Now drop `unsafe-inline` for `style-src` and consider `'strict-dynamic'`.
**Delivers:** Drop `style-src 'unsafe-inline'`; consider `script-src 'self' 'strict-dynamic'` for Firebase SDK lazy-loading; `frame-src https://<projectId>.firebaseapp.com` for any Firebase Auth popups; sign-in / dashboard / radar / donut / document upload / chat all tested under enforcement on staging before promoting; report-only soak for at least 7 days post-tightening before declaring done; HSTS preload submission to hstspreload.org.
**Closes:** H4 (full closure), M5 (verified end-to-end).
**Avoids:** Pitfall 16 (CSP rollout — three-stage rollout completes here).
**Research flag:** Standard patterns. Mechanical inline-style → class sweep was Phase 4; Phase 10 just flips the flag.

#### Phase 11: Documentation Pack (Evidence Pack)
**Rationale:** FEATURES.md §"Critical Dependency Notes" item 4 — writing `SECURITY.md` before controls exist is fiction. Writing it last is a literal cataloguing exercise, which is what reviewers want.
**Delivers:** `SECURITY.md` (controls catalogue mapped to ASVS / ISO 27001:2022 / SOC2 CC / GDPR with explicit citations; disclosure contact `security@bedeveloped.com`; supported versions; MFA recovery procedure; rotation schedule); `PRIVACY.md` (Google Cloud DPA reference, sub-processors, retention, **verified** Firestore region, international transfers, SCCs reference, data subject rights flow); `THREAT_MODEL.md` (STRIDE-style or written prose); `docs/CONTROL_MATRIX.md` (control → code → test → operational artefact → framework citation); `docs/RETENTION.md`; `docs/IR_RUNBOOK.md` (credential compromise / data leak / dependency CVE / supply-chain compromise / lost backup, each with trigger / owner / decision tree / comms template / RCA template); `docs/DATA_FLOW.md`; `/.well-known/security.txt` (RFC 9116) + vulnerability disclosure policy paragraph; `docs/evidence/` VSQ-ready screenshots (MFA enrolment for Luke + George, sample audit-log entry redacted, backup-policy console, Firestore region, App Check enforcement per-product, rules deployment, latest CI green, latest `npm audit` clean).
**Closes:** Compliance-credibility evidence pack (the milestone deliverable).
**Avoids:** Pitfall 19 (compliance theatre — every `SECURITY.md` bullet has code link + test link + framework citation; no "industry-standard encryption" hand-waves).
**Research flag:** Standard patterns. Cataloguing exercise.

#### Phase 12: Audit Walkthrough + Final Report
**Rationale:** `PROJECT.md` Active explicitly requires this — translate `SECURITY_AUDIT.md` Vercel/Supabase sections to Firebase, run the translated checklist end-to-end, produce `SECURITY_AUDIT_REPORT.md`. This is the closing-the-loop phase.
**Delivers:** Translated `SECURITY_AUDIT.md` sections (RLS↔Firestore Rules; service_role↔custom claims + Cloud Functions; Edge Functions↔Cloud Functions; pgaudit↔Cloud Function audit log; PITR↔Firestore PITR; CAPTCHA↔App Check reCAPTCHA Enterprise; Vercel Firewall↔App Check + Cloud Armor; BotID↔reCAPTCHA Enterprise; OIDC federation↔Firebase Auth tokens; Vercel Audit Logs↔Cloud Logging + Cloud Function audit log); end-to-end run of translated checklist against the hardened repo; `SECURITY_AUDIT_REPORT.md` documenting every checklist item with status (pass / partial / N/A) and citations into the codebase + `docs/`.
**Closes:** `PROJECT.md` Active "Audit-driven walkthrough"; full milestone deliverable.
**Avoids:** Pitfall 19 (compliance theatre — the report says "credible / on track for", not "compliant" or "certified").
**Research flag:** **NEEDS PHASE-LEVEL RESEARCH** during planning. Translating `SECURITY_AUDIT.md`'s Vercel/Supabase guidance into Firebase equivalents is non-trivial — produce a translation map first (per-section), then run the checklist.

### Phase Ordering Rationale (Reconciliation)

How the 12 consolidated phases reconcile FEATURES.md (A–F), ARCHITECTURE.md (1–11), and PITFALLS.md (1–12):

- FEATURES.md **Phase A (server-side authz foundation)** is split — rules **authoring + tests** live in consolidated Phase 5 (with the data-model migration they depend on), rules **deployment** lives in consolidated Phase 6 (gated to auth being live). This split is forced by Pitfall 1.
- FEATURES.md **Phase B (real auth)** = consolidated Phase 6, with the addition of the rules-deploy gate.
- FEATURES.md **Phase C (engineering foundation)** is split into three consolidated phases: Phase 1 (tooling), Phase 2 (test suite — separated for Pitfall 9), and Phase 4 (modular split + the lint-enforced quick wins that the modular boundaries make safe). Phase 3 (Hosting cutover) is also part of this group but moved up because it unblocks every subsequent CSP/headers phase.
- FEATURES.md **Phase D (operational controls)** = consolidated Phases 7 + 9 (Phase 7 stands up the Cloud Functions + audit log + App Check infrastructure; Phase 9 wires it through views + adds Sentry + alerts).
- FEATURES.md **Phase E (GDPR)** = consolidated Phase 8, paired with soft-delete and backups because Pitfall 11 makes them coordination-dependent.
- FEATURES.md **Phase F (documentation)** = consolidated Phase 11 + 12.
- ARCHITECTURE.md's recommendation to add a **subcollection migration phase** (the new "step 4" in its plan) is preserved as consolidated Phase 5; this is the non-obvious dependency that was missing from the original FEATURES.md grouping.
- ARCHITECTURE.md's recommendation to **split CSP into baseline (Phase 3) and tightening (Phase 10)** is preserved.

The full dependency graph:

```
1 (tooling) ─► 2 (tests) ─► 3 (hosting + headers report-only) ─► 4 (modular split + quick wins)
                                                                          │
                                                                          ▼
                                                       5 (data model + rules authored + tested)
                                                                          │
                                                                          ▼
                                                      6 (auth + MFA + rules DEPLOYED + bootstrap)
                                                                          │
                                                                          ▼
                                                       7 (Cloud Functions + audit log + App Check)
                                                                          │
                                                                          ▼
                                                       8 (soft-delete + GDPR + backups + drill)
                                                                          │
                                                                          ▼
                                                       9 (Sentry + audit-event wiring + alerts)
                                                                          │
                                                                          ▼
                                                          10 (CSP tightening — drop unsafe-inline)
                                                                          │
                                                                          ▼
                                                       11 (SECURITY.md + PRIVACY.md + evidence)
                                                                          │
                                                                          ▼
                                                  12 (translate + run audit checklist + report)
```

**Sanity check against `CONCERNS.md` "Recommended Fix Order":**
- "Today: rules" → consolidated Phase 5 (write+test) → Phase 6 (deploy). Slight delay relative to the doc but forced by the auth-prerequisite — and Phase 5 starts the work immediately.
- "This week: real auth + delete password hash + basic CSP" → consolidated Phase 6 (auth) + Phase 3 (CSP baseline). CSP baseline arrives earlier than CONCERNS.md suggests, because it can.
- "Next sprint: `crypto.randomUUID()` + package.json + Vite + tests" → consolidated Phases 1 + 2 + 4. These come *first* in the consolidated plan, not "next sprint", because they unblock everything else (Pitfall 9 in PITFALLS.md, FEATURES.md "inverse-priority insight").
- "Backlog: M-tier" → distributed across consolidated Phases 4, 8, 9.

The consolidated ordering does not contradict the CONCERNS.md fix order — it refines it with the dependency information from PITFALLS.md and ARCHITECTURE.md.

### Research Flags

**Phases that need their own `/gsd-research-phase` during planning** (the four called out in PROJECT.md / ARCHITECTURE.md as high-blast-radius or sparse-pattern):

| Phase | Why it needs deeper research |
|-------|-------------------------------|
| **5 (data model migration)** | Migration script correctness is high-blast-radius (production data is preserved per `PROJECT.md` Constraints). Should produce: per-field "new home" map for every nested attribute in the current `orgs/{id}` doc; idempotency-marker design; per-collection migration order for foreign-key safety; pre/post doc-count assertion harness; staging-project dry-run procedure. |
| **6 (Auth + MFA)** | TOTP UX, recovery-code generation + display + storage (10 hashed in `users/{uid}.recoveryCodeHashes[]`), password-reset flow, account-enumeration mitigation (L1), two-admin MFA un-enrol procedure, "poke" pattern for force-refresh after server-side claim mutation, bootstrap procedure for Luke + George — each is its own micro-decision and the failure modes (Pitfall 7 lockout) are high-impact. |
| **7 (Cloud Functions)** | Per-function research: input schema (Zod), idempotency strategy (`clientReqId` UUID + marker doc with 5-minute window), rate-limit thresholds (chat 30 msg/60s? comments 10/60s?), cold-start tolerance (auth-blocking 7s budget — `minInstances: 1`), per-function IAM service account (audit-log writer needs `roles/datastore.user`, GDPR export needs `roles/storage.objectAdmin`, etc.), App Check stage-rollout cadence per service. |
| **12 (audit walkthrough)** | Translating `SECURITY_AUDIT.md`'s Vercel/Supabase-specific guidance into Firebase equivalents is non-trivial: each §8 (Supabase) and §9 (Vercel) row needs a translation map. Produces an artefact (`SECURITY_AUDIT_TRANSLATION.md` perhaps) before running the checklist. Also — verify that `SECURITY_AUDIT.md`'s LLM03 / LLM05 / LLM10 sections are correctly judged N/A (this app has no LLM surface). |

**Phases with standard patterns (skip research-phase):**

| Phase | Why standard |
|-------|--------------|
| 1 (tooling) | Vite + Vitest + GitHub Actions are documented; config shapes in STACK.md. |
| 2 (tests) | Pure-function unit tests with documented inputs from `app.js`. |
| 3 (hosting cutover) | Mechanical migration, ~2h. |
| 4 (modular split) | Pure refactor with Phase 2 tests as the regression baseline; strangler-fig per ARCHITECTURE.md. |
| 8 (lifecycle) | Coordination-heavy but no novel patterns — Firebase native scheduled backups, GDPR tombstone is a documented industry pattern. |
| 9 (observability) | Sentry has a turnkey Firebase integration; alerting via Slack webhook is a documented Cloud Function pattern. |
| 10 (CSP tightening) | Mechanical: drop `unsafe-inline`; verify in staging. |
| 11 (documentation) | Cataloguing exercise — writes against existing controls, not new design. |

## Critical Pitfalls / Non-Negotiables (Sequencing Constraints)

These four constraints are load-bearing — violating them breaks the milestone:

1. **Tests-first before modular split.** Phase 2 must be green before Phase 4 begins. Without a test fence, the split surfaces ~30 closure-captured globals as runtime crashes on user paths. Anyone proposing the modular split before CI is green on a non-trivial test suite is overruled by Pitfall 9.
2. **Rules committed-and-tested early; deployed-only-after-Auth-is-live.** Phase 5 ships the rules file and the unit-test suite. Phase 6 ships `firebase deploy --only firestore:rules,storage:rules` *after* `beforeUserCreated` is populating claims and Anonymous Auth is disabled. Mid-phase deploy gate: rules cannot deploy to production while any production user lacks claims. Pitfall 1 lockout recovery is `firebase deploy --only firestore:rules` from the previous commit (≤5min) but only if you noticed in time.
3. **Subcollection migration before Rules deployment.** Phase 5 does the data-model split before authoring the production rules shape. Doing it the other way means writing rules twice (once for nested-map writes, once for subcollection writes) and is high-blast-radius because Rules deployments are atomic and immediate. ARCHITECTURE.md §8 made this explicit; FEATURES.md missed it; PITFALLS.md (Pitfall 1, 3, 4) supports it.
4. **Hosting cutover before any real CSP work.** Phase 3 (Firebase Hosting + report-only CSP) precedes Phase 10 (CSP enforced + tightened). `<meta http-equiv>` CSP cannot set `frame-ancestors`, `report-uri`, `Strict-Transport-Security`, `Permissions-Policy`, or COOP/COEP — those are header-only. GitHub Pages cannot set HTTP response headers. Skipping the Hosting cutover means the CSP work in subsequent phases is partial-and-knowingly-deficient — exactly the kind of finding an auditor catches.

Additional non-negotiables that fall out of these:

- **Anonymous Auth disabled in Firebase Console** as part of Phase 6 — single step that eliminates an entire class of rules-bypass (Pitfall 2). Not just "no longer used in code" — actually disabled.
- **App Check enforced in stages, not all at once** — Phase 7 stages: enrol → 7-day soak unenforced → enforce per-service (Storage → Firestore collections → Functions). Per-environment site keys; debug tokens in `.env.local` only.
- **Audit log written from Cloud Functions only** — `auditLog` collection rules: `allow read: if isInternal(); allow write, update, delete: if false`. Even Firebase Admin SDK from client = denied. Audited user cannot read their own entries (Pitfall 17).
- **All third-party GitHub Actions pinned to commit SHA, not tag.** OIDC federation for Firebase auth (no long-lived service-account JSON in repo secrets).
- **Each phase updates `SECURITY.md` incrementally** — every closed `CONCERNS.md` finding gets a paragraph in `SECURITY.md` immediately, not retroactively (Pitfall 19 prevention).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All version numbers verified against the live npm registry on 2026-05-03. Firebase product surface verified against firebase.google.com docs. Identity Platform pricing + reCAPTCHA Enterprise quota verified. STACK.md numbers are canonical; any minor drift in ARCHITECTURE.md defers to STACK.md. |
| Features | **HIGH** | All controls cross-referenced to OWASP ASVS 5.0 / ISO 27001:2022 / SOC2 CC 2017 / GDPR explicit articles. CONCERNS.md provides the project-specific anchor. Anti-features list is opinionated and grounded in `SECURITY_AUDIT.md` §8 anti-patterns (Supabase service_role lessons, applied to Firebase). |
| Architecture | **HIGH** | Subcollection vs flat schema decision rests on Firestore's documented 1MiB doc limit + the CONCERNS.md scaling table; Cloud Functions Gen 2 decision rests on Firebase's own deprecation of `functions.config()` in March 2027; module dependency rules are lint-enforceable. The `firebase/`-adapter pattern is the testability driver, not future-portability speculation. |
| Pitfalls | **HIGH** for Firebase-platform pitfalls (Context7 + official docs verified). **MEDIUM** for codebase-specific sequencing (inferred from CONCERNS.md). The four load-bearing sequencing constraints are explicitly cross-cited from official Firebase docs and the codebase analysis. |

**Overall confidence:** **HIGH.**

### Gaps to Address During Planning

These could not be resolved at the research stage and need attention during phase planning:

- **Firestore region of `bedeveloped-base-layers` not yet verified.** Phase 11 `PRIVACY.md` requires the answer; Phase 6 should verify it via `gcloud firestore databases describe` or Firebase Console. If the project is in `nam5` (US) and a UK client questionnaire arrives, this is a documentation issue not a code issue, but it must be honest. **Action: verify in Phase 6, document in `PRIVACY.md` in Phase 11.**
- **Sentry free-tier sufficiency for the projected error volume.** 5k errors/month is generous for an app with no live users between engagements, but the first prospect engagement could spike. **Action: Phase 9 sets up the budget alert at 70% of monthly quota; revisit at engagement re-start.**
- **reCAPTCHA Enterprise quota for projected chat volume.** 10k assessments/month is the free tier; a chatty client subscribing to `messages` could blow through it. **Action: Phase 7 sets up budget alert + per-environment site keys; revisit at engagement re-start.**
- **Bootstrap-migration data integrity unknown until staging dry-run is run.** Phase 5 migration script must be tested against a real Firestore export of production into `bedeveloped-base-layers-staging` before being run on production. Surprises (e.g. orphan records, malformed nested fields) might emerge. **Action: Phase 5 phase-level research includes the staging dry-run procedure as a deliverable.**
- **MFA recovery procedure feasibility.** The two-admin un-enrol pattern depends on Luke + George both being available on short notice; if they are ever not (vacation, illness), the recovery path needs an out-of-band fallback. **Action: Phase 6 phase-level research must define the fallback.**
- **`SECURITY_AUDIT.md` Vercel/Supabase-section translation completeness.** Some sections may not have a clean Firebase equivalent. **Action: Phase 12 phase-level research produces the translation map first, then runs the checklist; sections without clean equivalents are documented as "N/A — Firebase architecture differs" with rationale, not skipped silently.**

## Compliance Mapping Cheat-Sheet

One-glance table mapping each consolidated phase to the framework sections it satisfies. For an auditor-facing narrative, this is the table to lift into `docs/CONTROL_MATRIX.md` and prefix each row with code/test citations.

| Phase | Capability | OWASP ASVS L2 | ISO 27001:2022 Annex A | SOC2 CC | GDPR Art. |
|-------|-----------|---------------|------------------------|---------|-----------|
| 1 | Build pipeline + dependency monitoring + CI gates | V14.2, V14.3 | A.8.8, A.8.25, A.8.28, A.8.29, A.8.31 | CC7.1, CC8.1 | Art.32(1)(d) |
| 1 | Pre-commit / CI secret scan (gitleaks) | V14.4 | A.5.10 | CC6.1 | — |
| 2 | Test coverage on data-integrity helpers | V14.3 | A.8.29, A.8.30 | CC8.1 | — |
| 3 | TLS + HSTS preload + Security headers (baseline) | V14.4 | A.8.23, A.8.26, A.13.1.3 | CC6.6, CC6.7 | Art.32(1)(a) |
| 3 | CSP report-only + violations sink | V14.4.6 | A.8.23 | CC6.6 | — |
| 4 | Output encoding / XSS hardening (delete `html:`, replace `innerHTML`) | V5.3 | A.14.2.5 | CC6.6 | Art.32(1)(b) |
| 4 | CSPRNG for security-relevant ids | V6.3.1 | A.8.24 | CC6.7 | — |
| 4 | Modular split (separation of concerns) | V1.1.4 | A.8.4 | CC8.1 | — |
| 4 | File upload validation (client side) | V12.1, V12.2, V12.3 | A.5.10, A.8.7 | CC6.6 | Art.32(1)(b) |
| 5 | Data-model schema + tenant scoping by claim | V4.1, V4.2 | A.5.15, A.8.3 | CC6.3 | Art.32(1)(b) |
| 5 | Firestore + Storage Rules authored + unit tested | V4.1, V4.2, V4.3, V14.2 | A.5.15, A.8.3, A.8.29 | CC6.3, CC6.6, CC8.1 | Art.32(1)(b), Art.5(1)(f) |
| 5 | Server-clock unread tracking (H7 fix) | — | A.8.16 | CC7.2 | — |
| 6 | Real per-user authentication (no anonymous) | V2.1, V3.1 | A.5.16, A.5.17, A.8.5 | CC6.1, CC6.2 | Art.32(1)(b) |
| 6 | Password policy + leaked-password check | V2.1.1, V2.1.7 | A.5.17, A.8.5 | CC6.1 | — |
| 6 | Custom claims `{role, orgId}` via blocking trigger | V4.1 | A.5.15, A.8.3 | CC6.3 | Art.32(1)(b) |
| 6 | TOTP MFA enforced for internal | V2.7, V2.8 | A.5.17, A.8.5 | CC6.1, CC6.7 | Art.32(1)(b) |
| 6 | Server-side authz boundary (rules deployed) | V4.1, V4.2, V4.3 | A.5.15, A.8.3 | CC6.3, CC6.6 | Art.32(1)(b), Art.5(1)(f) |
| 6 | Storage rules + file upload server enforcement | V12.1, V12.2 | A.5.10, A.8.7 | CC6.6 | Art.32(1)(b) |
| 6 | Email verification + unified sign-in errors | V2.1.9, V2.2.4 | A.5.7, A.5.16 | CC6.1 | — |
| 7 | App Check perimeter (reCAPTCHA Enterprise) | V11.1 | A.8.23 | CC6.6 | Art.32(1)(b) |
| 7 | Cloud Functions Gen 2 trusted-server boundary | V4.2 | A.5.15, A.8.3 | CC6.3, CC7.2 | — |
| 7 | Audit log Tier 1 (`auditLog/{eventId}`) + Tier 2 (BigQuery sink) | V8.1, V8.2, V8.3 | A.5.28, A.8.15, A.8.16, A.12.4.1 | CC7.2, CC7.3, CC7.4 | Art.30, Art.32(1)(d) |
| 7 | Rate limiting on writes | V11.1 | A.13.1 | CC6.6 | Art.32(1)(b) |
| 7 | Per-function service accounts + secrets via Secret Manager | V6.1, V6.4 | A.5.16, A.10.1 | CC6.1, CC6.3 | Art.32(1)(a) |
| 8 | Soft-delete + restore window | V8.3 | A.8.10, A.8.13 | CC6.5 | Art.5(1)(c), (e) |
| 8 | GDPR Art. 15 (right of access) | — | A.5.34 | P5.1 | Art.15, Art.20 |
| 8 | GDPR Art. 17 (right to erasure) | — | A.5.34 | P5.1 | Art.17, Art.5(1)(c) |
| 8 | Daily backup + PITR + restore drill | V8.4 | A.5.30, A.8.13, A.8.14 | A1.2, A1.3, CC7.5, CC9.1 | Art.32(1)(c) |
| 8 | Storage signed URL TTL bound | V12.4 | A.8.23 | CC6.6 | — |
| 9 | Centralised observability (Sentry browser + node) | V8.2 | A.8.16 | CC7.2 | Art.32(1)(d) |
| 9 | Auth-anomaly alerting + uptime + budget alerts | — | A.5.25, A.8.16 | CC7.2, CC7.3, A1.1 | — |
| 9 | Audit-event wiring throughout views | V8.1, V8.2 | A.8.15 | CC7.2 | Art.30 |
| 10 | CSP enforced + tightened (drop `unsafe-inline`) | V14.4.6 | A.8.23 | CC6.6 | — |
| 11 | `SECURITY.md` controls catalogue + disclosure contact | — | A.5.5, A.5.6, A.5.37 | CC2.3 | — |
| 11 | `PRIVACY.md` + sub-processor list + DPA + region + SCCs | — | A.5.14, A.5.19, A.5.20, A.5.21, A.5.34 | CC9.2 | Art.13, Art.14, Art.28, Art.30, Art.46 |
| 11 | `THREAT_MODEL.md` | V1.1, V1.2 | A.5.7, A.5.8 | CC3.1, CC3.2 | — |
| 11 | `CONTROL_MATRIX.md` (auditor walk-through) | — | A.5.36, A.5.37 | CC1–CC9 | Art.5(2) (accountability) |
| 11 | `RETENTION.md` | — | A.5.33, A.8.10 | CC6.5 | Art.5(1)(e) |
| 11 | `IR_RUNBOOK.md` | — | A.5.24, A.5.26, A.5.27, A.5.29 | CC7.3, CC7.4, CC7.5 | Art.33 |
| 11 | `DATA_FLOW.md` | — | A.5.12, A.5.14 | CC3.2 | Art.30 |
| 11 | `security.txt` + vulnerability disclosure policy | — | A.5.5, A.5.6 | CC2.3 | — |
| 11 | `docs/evidence/` VSQ pack (screenshots) | — | A.5.36 | CC4.1 | — |
| 12 | Audit walkthrough + `SECURITY_AUDIT_REPORT.md` | — | A.5.36 | CC4.1, CC4.2 | — |

## Sources

### Primary (HIGH confidence — official documentation, current)

**Firebase platform:**
- Firebase JS SDK / Cloud Functions / App Check / Firestore Rules / Hosting / Auth blocking triggers / scheduled exports / PITR — full URL set in `STACK.md` "Sources" and `ARCHITECTURE.md` "Sources" sections.
- npm registry — verified all version pins on 2026-05-03.

**Compliance frameworks (authoritative):**
- OWASP ASVS 5.0 — https://owasp.org/ASVS/
- OWASP Top 10 for Web Applications 2025 — https://owasp.org/Top10/2025/
- ISO/IEC 27001:2022 Annex A — international standard
- AICPA SOC 2 Trust Services Criteria 2017 — https://www.aicpa-cima.com/
- GDPR (Regulation (EU) 2016/679) — https://gdpr-info.eu/
- NIST SP 800-63B — password / MFA guidance
- Google Cloud Data Processing Addendum — https://cloud.google.com/terms/data-processing-addendum

### Secondary (MEDIUM confidence — community / pattern references)

- Doug Stevenson, *Patterns for security with Firebase: supercharged custom claims with Firestore and Cloud Functions* — Firestore-signal pattern for claim propagation.
- Márton Kodok, *Firestore Backups the easy way with Cloud Workflows* — recommended over Cloud Functions for >5GB exports.
- firebase/firebase-tools issue #5999 — Strict-Transport-Security override edge case on Firebase Hosting.
- firebase/firebase-tools issue #2067 — emulator vs prod `getAfter` divergence on non-existent docs.
- App369, *Firebase Security Rules: The Complete Guide for App Developers (2026)*.
- ISO 27001 / SOC2 retention guidance (Ignyte, Konfirmity, OneUptime, hightable.io) — corroborated 12-month-online + 6-7-year-archive consensus for audit log retention.
- appsecsanta.com 2026 Dependabot vs Renovate comparison.

### Project context (HIGH confidence — primary input)

- `.planning/PROJECT.md` — milestone scope, constraints, decisions, "credible / not certified" bar.
- `.planning/codebase/CONCERNS.md` — 4 CRITICAL + 8 HIGH + 9 MEDIUM + 5 LOW findings; "Recommended Fix Order" sanity-checked against the consolidated phase plan above.
- `.planning/codebase/ARCHITECTURE.md` / `STACK.md` / `STRUCTURE.md` / `INTEGRATIONS.md` / `CONVENTIONS.md` / `TESTING.md` — current-state codebase analysis dated 2026-05-03.
- `SECURITY_AUDIT.md` (project root) — audit framework being applied (translated in Phase 12).
- `.planning/research/STACK.md` / `FEATURES.md` / `ARCHITECTURE.md` / `PITFALLS.md` — the four research outputs synthesised here.

---

*Research synthesised: 2026-05-03*
*Ready for roadmap: yes*
