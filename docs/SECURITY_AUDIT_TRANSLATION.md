# SECURITY_AUDIT.md — Vercel/Supabase → Firebase Translation Map

> Produced by Phase 12 Wave 1 (WALK-01). Source of truth: `SECURITY_AUDIT.md` (Vercel/Supabase-shaped).
> Target architecture: Firebase Hosting + Firestore + Firebase Auth + Cloud Functions + Cloud Storage.
> Per-§ walk in source order. Rows without a clean Firebase analogue are flagged as Firebase-architecture-differs N/A rows with rationale (NOT silently skipped — Pitfall 19).

## How to use this map

1. Source guidance column — verbatim from `SECURITY_AUDIT.md` § N.M (paths-only — no `:NN` line-number suffixes; cite `§N.M` not `SECURITY_AUDIT.md:127`).
2. Firebase equivalent column — points into the existing control catalogue: `SECURITY.md § <section>`, `docs/CONTROL_MATRIX.md` REQ-ID, source file paths, or runbooks. Paths only; cite by `SECURITY.md § App Check` not `SECURITY.md:938`.
3. Notes column — rationale, especially mandatory on rows that record a Firebase-architecture-differs N/A verdict (the literal verdict-token sits in the Firebase-equivalent column; the rationale sits here).

## Locked translation pairs (CLAUDE.md baseline)

| Vercel/Supabase | Firebase equivalent |
|-----------------|---------------------|
| RLS | Firestore Rules (`firestore.rules`) |
| `service_role` / `sb_secret_…` | Custom claims (Admin SDK `setCustomUserClaims()`) + Cloud Functions |
| Edge Functions | Cloud Functions |
| `pgaudit` | Cloud Function audit log (`auditLog` collection + BigQuery 7y sink) |
| PITR | Firestore PITR (7-day rolling) |
| Vercel BotID / Firewall | reCAPTCHA Enterprise + App Check |
| OIDC federation (CI → cloud) | GitHub Actions Workload Identity Federation → Firebase Auth tokens (end users) |
| Vercel Audit Logs | Cloud Logging + audit-log Cloud Function |

---

## §1 Phase 1 — Discovery

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §1.1 Repository fingerprint | List top-level files; identify package.json + framework + runtime + hosting + DB + auth + AI/LLM | Phase 1 Wave 1 discovery output ran 2026-05-03; recorded in `.planning/PROJECT.md` + `.planning/codebase/STACK.md` + `.planning/codebase/ARCHITECTURE.md` | All four supporting docs verified present; paths-only citation chain |
| §1.2 Surface area enumeration | Public HTTP routes / Server Actions / webhook endpoints / file upload endpoints / admin / debug | `firebase.json` rewrites + `functions/src/**/*.ts` callables enumeration; Firestore Rules `firestore.rules` deny-by-default at root | Public surface: Firebase Hosting routes (configured in `firebase.json`); callable Cloud Functions; CSP report sink |
| §1.3 Secrets and configuration | Scan for hardcoded keys; `.env*` gitignored; env-var classification | `.env*` in `.gitignore`; gitleaks pre-commit hook + GitHub Push Protection; GCP Secret Manager for runtime secrets (Phase 8 GDPR_PSEUDONYM_SECRET, Phase 9 SLACK_WEBHOOK_URL + SENTRY_DSN) | `SECURITY.md § Secret Scanning` + `SECURITY.md § Build & Supply Chain` |
| §1.4 Dependency inventory | Lockfile committed; `npm audit`; Shai-Hulud IOCs | `package-lock.json` committed; `npm audit` CI job; Socket.dev install (Phase 1); `runbooks/socket-bootstrap.md` | `SECURITY.md § Dependency Monitoring` |
| §1.5 CI/CD and supply chain | GitHub Actions reviewed; SHA-pinned third-party actions; SBOM | `.github/workflows/ci.yml` pins third-party actions to SHA; OIDC Workload Identity Federation for Firebase auth | `SECURITY.md § Build & Supply Chain` |

---

## §2 Phase 2 — Universal Web Application Audit (OWASP Top 10 2025)

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §2 A01 Broken Access Control | Authorisation re-checked inside handler | `firestore.rules` predicates + callable Cloud Function claims-checks (Phase 7 `functions/src/iam/setClaims.ts` substrate; per `docs/CONTROL_MATRIX.md` AUTH-07 row) | Defence-in-depth; rules are the boundary, callables re-check claims |
| §2 A01 SSRF | SSRF guard (private-IP block, metadata-IP block, DNS-pinned) | **N/A — Firebase architecture differs.** No server-side outbound HTTP from user-supplied URLs. Cloud Functions outbound destinations are all configuration-pinned: Sentry (`de.sentry.io`), Slack (Secret Manager-stored webhook URL), BigQuery (pinned GCP API), Identity Platform (pinned GCP API). | Rationale: SSRF requires user-controlled URL; no such surface exists. `docs/DATA_FLOW.md` Functions→backplane edges enumerate all outbound destinations. |
| §2 A02 Cryptographic Failures + headers | Security headers (HSTS / X-Content-Type-Options / Referrer-Policy / Permissions-Policy / X-Frame-Options or CSP frame-ancestors / CSP) | `firebase.json` headers entry; `SECURITY.md § HTTP Security Headers` + `SECURITY.md § Content Security Policy (enforced)` + `SECURITY.md § HSTS Preload Status` | Phase 3 + Phase 10 |
| §2 A03 Supply-Chain | Software Supply Chain Failures — lockfile + Dependabot/Renovate + SBOM + 2FA + actions pinned + pre-install audited | `package-lock.json` + Dependabot config + `.github/workflows/ci.yml` SHA-pinning + gitleaks + Socket.dev | `SECURITY.md § Build & Supply Chain` + `SECURITY.md § Dependency Monitoring` |
| §2 A04 Cryptographic Failures | TLS 1.2+; HSTS preload; modern password hashing; no tokens in localStorage | Firebase Hosting TLS 1.2+ (managed by Google); HSTS preload submitted (Phase 10 — listing PENDING per Pitfall 19 forward-tracking); Firebase Auth Identity Platform handles password hashing (Scrypt); session via IndexedDB-backed Firebase Auth state — no manual JWT-in-localStorage | `SECURITY.md § HSTS Preload Status` |
| §2 A05 Injection | Parameterised queries everywhere; auto-escape HTML | Firestore Admin SDK uses typed paths (no string-concatenated queries); `src/main.js` uses textContent — `html:` escape hatch deleted in CODE-04 | `SECURITY.md § Code Quality + Module Boundaries` |
| §2 A06 Insecure Design | Threat model exists; rate limits designed in | `THREAT_MODEL.md` (Phase 11) + Phase 7 rate-limit substrate via Firestore Rules predicate (FN-08) | `SECURITY.md § Rate Limiting` |
| §2 A07 Authentication Failures | MFA enforced for admins; lockout; CAPTCHA; session invalidation on password change | Phase 6 TOTP MFA enforced for admins (`SECURITY.md § Multi-Factor Authentication`); Phase 7 App Check (reCAPTCHA Enterprise) on every callable; Firebase Auth handles session invalidation on password change | `SECURITY.md § Authentication & Sessions` + `SECURITY.md § App Check` |
| §2 A08 Data Integrity Failures | Pin hashes; signed packages; pinned image tags | `package-lock.json` hash-locked; `npm audit signatures` advisory; `.github/workflows/ci.yml` pins actions to SHA | `SECURITY.md § Build & Supply Chain` |
| §2 A09 Logging & Alerting Failures | Auth events logged; privileged actions logged; centralised; alerts | Phase 7 `auditLog` collection + 3 mirror triggers + Phase 9 `authAnomalyAlert` Slack webhook + Phase 9 audit-events proxy seam (AUDIT-05 wiring) | `SECURITY.md § Audit Log Infrastructure` + `SECURITY.md § Audit-Event Wiring (AUDIT-05)` + `SECURITY.md § Anomaly Alerting (OBS-05)` |
| §2 A10 Mishandling of Exceptional Conditions | Fail-closed; no fallback to insecure path | Cloud Functions throw HttpsError on guard failure; `firestore.rules` deny-by-default; rules predicates evaluate failures as denials | Defence-in-depth; `firestore.rules` root match deny-by-default |

---

## §3 Phase 3 — Auth, Sessions, and Identity

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §3 Session storage | HttpOnly + Secure + SameSite cookies; no JWTs in localStorage | Firebase Auth uses IndexedDB; no manual cookie/JWT storage | Firebase Auth state managed by SDK — `SECURITY.md § Authentication & Sessions` |
| §3 Session rotation | New session ID on login / privilege change / MFA enrolment | Firebase Auth ID token refresh on login + claim hydration after MFA; custom claims set via Phase 7 `setClaims` Cloud Function | `SECURITY.md § Multi-Factor Authentication` |
| §3 Refresh tokens | Single-use rotation; reuse detection revokes family | Firebase Auth refresh-token rotation managed by Identity Platform | Managed by Google Identity Platform; not authored in repo |
| §3 JWT validation | Signature against JWKS; `iss`/`aud`/`exp`/`nbf` strict | Firebase Auth ID tokens validated by Admin SDK `auth.verifyIdToken()` in every callable Cloud Function (Phase 7) | Phase 7 callable middleware pattern; `SECURITY.md § Cloud Functions Workspace` |
| §3 CSRF | SameSite=Lax/Strict + explicit CSRF token | Firebase Auth callable Cloud Functions use HTTPS POST with App Check token in header — App Check binds request to verified app instance; no traditional cookie-based session vulnerable to CSRF | `SECURITY.md § App Check` |
| §3 Password reset | Tokens single-use, time-limited (≤ 1h) | Firebase Auth password reset email-link tokens single-use + Identity Platform default 1h expiry | Managed by Identity Platform |
| §3 Account enumeration | Identical responses for "user exists" vs "user doesn't" | Firebase Auth `signInWithEmailAndPassword` returns generic `auth/invalid-credential` (not `user-not-found` vs `wrong-password`) since SDK v10+ | Managed by Identity Platform |
| §3 OAuth | `state` cryptographically random + verified; PKCE; redirect URI exact-match | **N/A — Firebase architecture differs.** No third-party OAuth in this milestone. Email + password is the only auth path; AUTH-09 recovery codes superseded by email-link recovery per Phase 6 D-07. | No SSO in v1 (AUTH-V2-01 in roadmap "v2 Requirements") |
| §3 WebAuthn / passkeys | Preferred for admin / high-value | **N/A — Firebase architecture differs.** TOTP MFA in v1. Phase 6 ships TOTP enforced for admins; passkeys deferred to v2 (AUTH-V2-03 SMS MFA is the closest v2 entry). | `SECURITY.md § Multi-Factor Authentication` |

---

## §4 Phase 4 — Input Validation and Output Encoding

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §4 Every external input has a schema | Zod schemas on every callable Cloud Function input (Phase 7 FN-01..09) | `functions/src/**/*.ts` callables use `zod` for input validation | Zod is the project-canonical schema lib |
| §4 Server-side validation | All validation in Cloud Functions (server) | Firestore Rules predicates + callable Cloud Function zod validation | Defence-in-depth |
| §4 File uploads | MIME sniffing; size limits; extension allowlist; store outside web root; signed URL | Firebase Cloud Storage signed-URL upload pattern (Phase 8 BACKUP-04 signed URLs); MIME-type + size validation in callable | `SECURITY.md § Backups + DR + PITR + Storage Versioning` |
| §4 URL parameters | Typed and validated; reject coercion exploits | Firebase Hosting routes use static path matching; no dynamic URL param coercion surface | — |
| §4 HTML output | Framework auto-escape; DOMPurify for rich-text | `src/main.js` uses `textContent` (auto-escape); `html:` escape hatch deleted in CODE-04 | `SECURITY.md § Code Quality + Module Boundaries` |
| §4 JSON output | Never reflect user input into `<script>` block | Firebase Hosting serves pre-built static assets; no server-side templating | Vite build outputs `index.html` with no user-input interpolation |
| §4 SQL | Parameterised | **N/A — Firebase architecture differs.** No SQL surface. Firestore is document-NoSQL; queries are typed via Admin SDK / Web SDK. | No SQL injection surface |

---

## §5 Phase 5 — Network, Infrastructure, and Platform

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §5.1 TLS + HSTS preload | TLS 1.2+; HSTS preload | Firebase Hosting TLS 1.2+ (managed); HSTS preload submitted Phase 10 (listing-status PENDING per Pitfall 19 forward-tracking F1) | `SECURITY.md § HSTS Preload Status` |
| §5.1 DNS — DNSSEC; CAA | DNSSEC enabled; CAA records | **PENDING-OPERATOR** — Firebase Hosting custom-domain DNSSEC + CAA depend on registrar (Cloudflare DNS). | Operator session — tracked in `docs/evidence/README.md` |
| §5.1 Open ports | Only intended ports exposed | **N/A — Firebase architecture differs.** Firebase Hosting + Cloud Functions are managed; no exposed Redis / DB ports. | Google-managed perimeter |
| §5.1 Egress filtering | Outbound restricted to known destinations | Cloud Functions outbound is configuration-pinned (Sentry / Slack / BigQuery / Identity Platform); no arbitrary internet egress | `docs/DATA_FLOW.md` Functions→backplane edges |
| §5.1 Backups | Encrypted; tested restoration; off-site; RTO/RPO documented | Phase 8: GCS bucket lifecycle (Standard→Nearline@30d→Archive@365d) + Firestore PITR (7-day) + uploads versioning + quarterly drill cadence (`runbooks/phase-8-restore-drill-cadence.md`) | `SECURITY.md § Backups + DR + PITR + Storage Versioning` |
| §5.2 If Vercel detected → §9 | Apply §9 controls | **N/A — Firebase architecture differs.** See §9 rows below for per-Vercel-control translation. | — |
| §5.3 If Supabase detected → §8 | Apply §8 controls | **N/A — Firebase architecture differs.** See §8 rows below for per-Supabase-control translation. | — |
| §5.4 IAM least-priv + OIDC | No wildcard `*` in policies; OIDC federation | Phase 7+8 IAM service accounts (e.g. `storage-reader-sa`, `lifecycle-sa`, `gdpr-reader-sa`, `gdpr-writer-sa`, `csp-sink-sa`) least-priv; OIDC Workload Identity Federation in `.github/workflows/ci.yml` | `SECURITY.md § Rotation Schedule` non-rotating OIDC row |
| §5.4 Object storage — no public buckets unless intended | GCS / S3 buckets default-private | GCS buckets in this project: `bedeveloped-base-layers-backups` (private), `bedeveloped-base-layers-uploads` (private with signed URLs), Firebase default bucket (private) | `SECURITY.md § Backups + DR + PITR + Storage Versioning` |
| §5.4 Secrets manager | All runtime secrets via managed secret store | GCP Secret Manager: `GDPR_PSEUDONYM_SECRET`, `SLACK_WEBHOOK_URL`, `SENTRY_DSN` (Phase 8 + Phase 9) | `SECURITY.md § GDPR (Export + Erasure)` + `SECURITY.md § Anomaly Alerting (OBS-05)` |
| §5.4 Logging to Cloud Audit Logs centralised + alerted | Centralised, alerted, retained | Cloud Logging + Phase 7 `auditLog` Firestore collection + Phase 9 Slack alerts | `SECURITY.md § Audit Log Infrastructure` |
| §5.4 VPC — private subnets | Private subnets for compute, public for load balancers | **N/A — Firebase architecture differs.** Cloud Functions Gen 2 run on managed serverless infrastructure; no VPC configuration in v1. | Managed serverless tier |

---

## §6 Phase 6 — AI / LLM Security (OWASP LLM Top 10 2025 + NCSC Guidelines)

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §6 LLM01..LLM10 | All 10 LLM Top-10 controls | **N/A — Firebase architecture differs.** No LLM surface in this application — no openai / anthropic-ai / langchain / llamaindex / MCP / RAG / embedding / agent / tool-calling integration. Verifiable absence: `package.json` zero LLM SDK deps. | WALK-04 anchor — each LLM section enumerated as an explicit N/A row in `SECURITY_AUDIT_REPORT.md` (Wave 3) |
| §6 NCSC AI Guidelines — additional checks | Threat model includes adversarial examples; SBOM for models; secure deployment; monitor for drift | **N/A — Firebase architecture differs.** Same rationale as LLM01..10 — no LLM surface. | Single shared rationale; per-row enumeration in `SECURITY_AUDIT_REPORT.md` |

---

## §7 Phase 7 — Specific Attack Class Defences

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §7 DoS / DDoS | CDN/WAF; per-route rate limits; circuit breakers | Firebase Hosting CDN + Cloud Functions auto-scaling + Phase 7 rate-limit (Firestore Rules predicate primary, callable fallback — FN-08) | `SECURITY.md § Rate Limiting` |
| §7 MITM | TLS 1.2+, HSTS preload | Firebase Hosting TLS 1.2+; HSTS preload submitted (Phase 10 — listing-status PENDING) | `SECURITY.md § HTTP Security Headers` |
| §7 Phishing | DMARC `p=reject`; SPF; DKIM; passkeys for admin | **PENDING-OPERATOR** — DMARC/SPF/DKIM are registrar/Workspace concerns; passkeys deferred to v2 | Operator domain config — beyond repo scope |
| §7 Ransomware | Backups (off-site, immutable, tested restore); EDR | Phase 8 GCS lifecycle + PITR + uploads versioning + quarterly drill | `SECURITY.md § Backups + DR + PITR + Storage Versioning` |
| §7 Password attacks | Modern hashing; HIBP; MFA; lockout; CAPTCHA | Firebase Auth password hashing (Scrypt-Identity-Platform); Phase 6 TOTP MFA for admins; Phase 7 App Check (reCAPTCHA Enterprise) | `SECURITY.md § Multi-Factor Authentication` + `SECURITY.md § App Check` |
| §7 SQL injection | Parameterised queries; ORM; least-priv DB user | **N/A — Firebase architecture differs.** No SQL surface (Firestore is document-NoSQL). | — |
| §7 URL interpretation / Path traversal | `path.resolve()` + prefix check | **N/A — Firebase architecture differs.** No filesystem path surface in Cloud Functions (storage is GCS via signed URLs). | — |
| §7 DNS spoofing | DNSSEC; DNS-over-HTTPS; pinned resolvers | **PENDING-OPERATOR** — DNSSEC registrar-side; pinned resolvers in Cloud Functions outbound calls are configuration-pinned (Sentry sub-host etc.) | Registrar action |
| §7 Session hijacking | HttpOnly cookies; rotate on privilege change | Firebase Auth IndexedDB-backed state; ID-token refresh on claim hydration | `SECURITY.md § Authentication & Sessions` |
| §7 Brute force | Rate limits + progressive delays + CAPTCHA + IP reputation | Phase 7 rate-limit predicate + App Check (reCAPTCHA Enterprise blocks abuse signal) | `SECURITY.md § Rate Limiting` + `SECURITY.md § App Check` |
| §7 Insider threats | Least privilege; audit logs to SIEM; separation of duties | Phase 7 audit log infrastructure + Phase 8 GDPR_PSEUDONYM_SECRET + Phase 9 Slack alerts on anomaly | `SECURITY.md § Audit Log Infrastructure` |
| §7 Trojans / Drive-by / Malware | EDR; npm 2FA; Socket.dev pre-install | gitleaks + Socket.dev install (Phase 1); GitHub Push Protection | `SECURITY.md § Dependency Monitoring` |
| §7 XSS | Auto-escape; strict CSP with nonces; sanitise rich-text | Phase 4 modular split deleted `html:` escape hatch; Phase 10 CSP enforced without `'unsafe-inline'` in style-src; allowlist-based | `SECURITY.md § Content Security Policy (enforced)` |
| §7 Eavesdropping | TLS everywhere | Firebase Hosting + GCP managed TLS 1.2+ | — |
| §7 Birthday / hash collision | SHA-256 minimum | GCP/Firebase use SHA-256+ for token hashing | — |
| §7 Web attacks generally | Defence-in-depth | `THREAT_MODEL.md` 6 STRIDE categories + 6-row defence-in-depth summary | `SECURITY.md` ToC |

---

## §8 Phase 8 — Supabase Hardening

> **All §8 rows: not applicable on Firebase.** This project is Firebase, not Supabase. Each row carries an explicit Firebase-architecture-differs N/A verdict with rationale (see the table cells below); each maps to its Firebase analogue where one exists.

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §8.1 RLS enabled + forced on every table | `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` | **N/A — Firebase architecture differs.** Firestore Security Rules (`firestore.rules`) — deny-by-default at root + per-collection `allow read, write: if request.auth != null && ...` predicates | Firestore is deny-by-default; "FORCE" semantics map to root `match /{document=**} { allow read, write: if false; }` |
| §8.1 RLS auth predicate | `auth.uid()` policy predicate | **N/A — Firebase architecture differs.** `request.auth.uid` in rules predicate is the direct equivalent; the `(select auth.uid())` performance optimisation has no Firestore analogue (rules are not query-planned) | `firestore.rules` patterns |
| §8.1 `user_metadata` is user-writable | Never reference in policies | **N/A — Firebase architecture differs.** Firebase Auth custom claims are server-only via Admin SDK `setCustomUserClaims()` — equivalent threat-class is using `request.auth.token.role` set client-side (impossible — claims are minted by Cloud Functions) | Phase 7 `iam.claims.set` Cloud Function is the authoritative claims-setter; `setClaims` callable is the only client-reachable path |
| §8.1 WITH CHECK on writes | `WITH CHECK` on writes; FOR ALL split | **N/A — Firebase architecture differs.** Firestore Rules use `allow update: if ... && request.resource.data ...` (post-state check) which is the WITH CHECK analogue | `firestore.rules` patterns |
| §8.1 Multi-tenant SECURITY DEFINER helper | Cache membership in SECURITY DEFINER helper | **N/A — Firebase architecture differs.** No SECURITY DEFINER / SECURITY INVOKER concept; Firestore Rules are deny-by-default with `request.auth.token.<claim>` predicate evaluation in-process. | Architectural difference |
| §8.1 Restrictive policy AAL2 | MFA-gated policy | **N/A — Firebase architecture differs.** TOTP MFA verified via custom claim post-enrolment; Firestore Rules check `request.auth.token.mfaEnrolled == true` | `SECURITY.md § Multi-Factor Authentication` |
| §8.2 Functions and views — SECURITY DEFINER + search_path | `SECURITY DEFINER` only when essential; `set search_path = ''` + FQ refs | **N/A — Firebase architecture differs.** No PostgreSQL functions / views; Cloud Functions are TypeScript Admin SDK code. | — |
| §8.3 Auth surface — asymmetric JWT keys; service_role secrecy | `service_role` / `sb_secret_…` never in browser bundles / public env | **N/A — Firebase architecture differs.** Firebase Admin SDK only initialises in Cloud Functions runtime (Node) — Admin SDK is not exportable to the browser. Equivalent threat-class is a service-account JSON key committed to the repo | gitleaks pre-commit + GitHub Push Protection guard; CI fails on detection |
| §8.3 MFA org-wide + CAPTCHA | MFA enforced; CAPTCHA on signup/sign-in/password reset | **N/A — Firebase architecture differs.** TOTP MFA enforced for admins (Phase 6); reCAPTCHA Enterprise + App Check on every callable (Phase 7) | `SECURITY.md § Multi-Factor Authentication` + `SECURITY.md § App Check` |
| §8.3 Leaked-password protection | Detect leaked passwords toggle on | **PENDING-OPERATOR** — Firebase Auth Identity Platform Password Policy includes a "Detect leaked passwords" toggle; operator session enables in console (forward-tracked F-AUTH-LEAKED-PWD) | `runbooks/phase-11-cleanup-ledger.md` |
| §8.3 OTP / email-link expiry ≤ 3600s | Short-lived OTP | **N/A — Firebase architecture differs.** Identity Platform default email-link expiry 1h | Managed by Identity Platform |
| §8.3 Custom SMTP | Production-grade SMTP | **PENDING-OPERATOR** — Phase 6 v1 uses Identity Platform default SMTP; custom SMTP via `firestore-send-email` is v2 (NOTIF-V2-01) | `.planning/ROADMAP.md` v2 Requirements |
| §8.3 Anonymous sign-in cleanup | Sweep anonymous sessions | **N/A — Firebase architecture differs.** Anonymous Auth disabled in Phase 6; no anonymous sessions to clean up | `SECURITY.md § Anonymous Auth Disabled` |
| §8.4 Data API surface — default grants revoked; business logic in dedicated schema | PostgREST / pg_graphql surface hardening | **N/A — Firebase architecture differs.** No PostgREST / pg_graphql; Firestore is queried via Web SDK (rules-checked) and Admin SDK (in Cloud Functions only). | Architectural difference |
| §8.5 Storage — buckets default-private; RLS on storage.objects; signed URLs; size/MIME allowlists | Bucket hardening | **N/A — Firebase architecture differs.** Phase 8 BACKUP-04 signed URLs (V4); buckets default-private; uploads bucket versioning + soft-delete | `SECURITY.md § Backups + DR + PITR + Storage Versioning` |
| §8.6 Edge Functions hardening | `service_role` only behind authenticated/validated requests; HMAC; idempotency; rate limits | **N/A — Firebase architecture differs.** Phase 7 Cloud Functions: App Check + claims-check + zod validation + rate-limit predicate | `SECURITY.md § Cloud Functions Workspace` |
| §8.7 Operations — pgaudit + supa_audit + PITR + pgTAP + Splinter | DB operational gates | **N/A — Firebase architecture differs.** `auditLog` Firestore collection + 3 mirror triggers (Phase 7) + Firestore PITR (Phase 8) + rules-unit-test suite (Phase 5 TEST-08 + Phase 7 TEST-09) | `SECURITY.md § Audit Log Infrastructure` + `SECURITY.md § Backups + DR + PITR + Storage Versioning` |
| §8.7 MCP integration — read_only + project-scoped to dev | MCP server hardening | **N/A — Firebase architecture differs.** No MCP integration in this project; no MCP servers configured; no MCP entries in `package.json` or config files. | Verifiable absence |
| §8.8 The 15 "never do this" anti-patterns | Avoid each anti-pattern | **N/A — Firebase architecture differs.** Each anti-pattern is verifiable absence in this project; the anti-pattern class doesn't exist in Firebase. | Auditor checks via grep; `SECURITY_AUDIT_REPORT.md` (Wave 3) enumerates each |

---

## §9 Phase 9 — Vercel Hardening

> **§9 rows: most are not applicable on Firebase.** Where a Firebase analogue exists (secrets, OIDC, CSP, headers, rate limits), the equivalent control is cited; the rest carry an explicit Firebase-architecture-differs N/A verdict in the table cells below.

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §9.1 Secrets sensitivity flagging | Every env var holding credentials marked Sensitive | GCP Secret Manager for all runtime secrets; `.env*` gitignored; gitleaks + Push Protection guard | `SECURITY.md § Secret Scanning` |
| §9.1 OIDC Federation to AWS/GCP/Azure | Workload-identity federation in CI | GitHub Actions Workload Identity Federation → Firebase project (`.github/workflows/ci.yml` `id-token: write`) | `SECURITY.md § Rotation Schedule` non-rotating OIDC row |
| §9.1 Deployment Protection bypass tokens rotated quarterly | Token rotation cadence | **N/A — Firebase architecture differs.** No Vercel-style deployment protection bypass tokens; Firebase Hosting preview channels use Google-managed auth. | — |
| §9.1 npm WebAuthn 2FA + trusted publishing | Publish chain hardening | **PENDING-OPERATOR** — npm publishing not used by this project (no published packages); WebAuthn 2FA on GitHub account is forward-tracked | — |
| §9.2 Vercel Firewall + Bot Protection + AI Bots ruleset + BotID Deep Analysis | Edge bot mitigation | App Check (reCAPTCHA Enterprise) on every callable (Phase 7); reCAPTCHA Enterprise abuse signal | `SECURITY.md § App Check` |
| §9.2 WAF rate-limit + per-user `@upstash/ratelimit` | Per-route + per-user rate limits | Phase 7 rate-limit predicate (Firestore Rules + callable fallback Pattern 5b) | `SECURITY.md § Rate Limiting` |
| §9.2 No Cloudflare / reverse proxy in front of Vercel | Avoid signal stripping | **N/A — Firebase architecture differs.** Firebase Hosting is its own CDN; no third-party reverse proxy. App Check signals travel directly from client to callable in the request header. | Architectural difference |
| §9.3 Deployment Protection — preview Standard or All-deployments | Preview-deploy gating | Firebase Hosting preview channels: Google-managed auth; default-public per channel (operator can token-gate per channel — currently public per project posture) | — |
| §9.4 Next.js framework — version current + patched | Framework CVE hygiene | **N/A — Firebase architecture differs.** This is vanilla JS + Vite, no Next.js. (CVE-2025-29927 / CVE-2025-55182 / CVE-2026-27978 don't apply.) | — |
| §9.4 Authorization re-checked inside every Route Handler / Server Action | In-handler authZ | Phase 7 callable Cloud Functions re-check claims; `firestore.rules` predicates re-check | Defence-in-depth — `SECURITY.md § Cloud Functions Workspace` |
| §9.5 Headers + CSP — strict CSP with nonces | Per-request nonces | Phase 10 enforced CSP without `'unsafe-inline'` in style-src; allowlist-based connect-src; nonces not used (Firebase Hosting doesn't inject per-request nonces — allowlist is the credible Firebase Hosting pattern) | `SECURITY.md § Content Security Policy (enforced)` |
| §9.6 AI route hardening | Per-route AI controls | **N/A — Firebase architecture differs.** No LLM / AI route surface. | — |
| §9.7 Vercel Audit Logs streamed to SIEM | Audit-log shipping | Cloud Logging + `auditLog` Cloud Function mirrored to BigQuery 7y sink (Phase 7) | `SECURITY.md § Audit Log Infrastructure` |
| §9.8 IR runbook (CAF D1) — credential-compromise scenario tested | IR walkthrough | `docs/IR_RUNBOOK.md` Scenario 1 (credential compromise) + `runbooks/ir-credential-compromise.md` | `SECURITY.md` |

---

## §10 Phase 10 — Vulnerability Scanning Toolchain

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §10.1 SAST | Semgrep / CodeQL / Bandit / Brakeman / gosec / ESLint security | ESLint security plugin (Phase 1 TOOL-04); Semgrep deferred to v2 (PROJECT.md constraint) | `SECURITY.md § Build & Supply Chain` |
| §10.2 SCA | `npm audit` + `osv-scanner` + Dependabot / Renovate + Socket.dev | `npm audit` CI job + Dependabot + Socket.dev install (Phase 1); `npm audit signatures` | `SECURITY.md § Dependency Monitoring` |
| §10.3 Secrets scanning | gitleaks + trufflehog + GitHub Secret Scanning + Push Protection | gitleaks pre-commit + CI; GitHub Push Protection enabled | `SECURITY.md § Secret Scanning` |
| §10.4 IaC | Checkov / tfsec / terrascan | **N/A — Firebase architecture differs.** No Terraform/Kubernetes IaC. Firebase project config via `firebase.json` + Console. | — |
| §10.5 Container scanning | Trivy / Dockle / hadolint | **N/A — Firebase architecture differs.** No Dockerfile / containers. Firebase Hosting + Cloud Functions are managed serverless. | — |
| §10.6 DAST | OWASP ZAP / Nuclei | **N/A — Firebase architecture differs.** Deferred to v2 (OPS-V2-01 external pen test). | — |
| §10.7 LLM-specific | Promptfoo / Garak / DeepTeam | **N/A — Firebase architecture differs.** No LLM surface. | — |
| §10.9 Wire to CI | Semgrep + npm audit + gitleaks + linter + tests | `npm audit` + gitleaks + ESLint + Vitest in CI; Semgrep v2 | `SECURITY.md § Build & Supply Chain` |
| §10.10 Periodic | Quarterly dep update; OAuth app review; access review; restore drill | Phase 8 quarterly restore drill (`runbooks/phase-8-restore-drill-cadence.md`); Dependabot continuous; OAuth app review queued for operator session | `SECURITY.md § Backups + DR + PITR + Storage Versioning` |

---

## §11 Remediation Tiers

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §11 Tier 1 / Tier 2 / Tier 3 categorisation | Auto-fix / propose / escalate buckets | **N/A — Firebase architecture differs.** This section governs the audit runner's behaviour, not the audited system. Phase 12's Phase 11 evidence pack is the artefact of the human-driven audit pass that ran this milestone; we are not running an automated remediation pass in Phase 12. | This is a process-section, not a control-section. |

---

## §12 Output

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §12 — what Claude produces at audit end | Per-pass output set | The Phase 12 deliverable set IS this output: `docs/SECURITY_AUDIT_TRANSLATION.md` (this file) + `SECURITY_AUDIT_REPORT.md` (Waves 2–3) + `SECURITY.md § Phase 12 Audit Index` (Wave 4 DOC-10 final increment). | Phase 12 implements §12 of the source. |

---

## §13 Sign-off Checklist

> Per-checkbox verdict + citation is produced in `SECURITY_AUDIT_REPORT.md` (Wave 3). This map only flags the section-level disposition.

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §13 Universal (14 items) | Each item gets a Pass/Partial verdict in REPORT § §13 Universal | Phase 12 Wave 3 — most are Pass, U#13 (CI integrates Semgrep + secrets scan + dep audit + tests) is Partial (Semgrep v2) | `SECURITY_AUDIT_REPORT.md` (Wave 3) |
| §13 If Supabase (11 items) | All items get a verdict | **N/A — Firebase architecture differs.** All 11 items map to N/A with rationale per item. | `SECURITY_AUDIT_REPORT.md` § §13 Supabase (Wave 3) |
| §13 If Vercel (10 items) | Each item gets a verdict | Mostly N/A on Firebase; secrets + OIDC + CSP have Firebase analogues (Adapted Pass). The rest carry an explicit **N/A — Firebase architecture differs** verdict per item. Phase 12 Wave 3 enumerates each. | `SECURITY_AUDIT_REPORT.md` § §13 Vercel (Wave 3) |
| §13 If AI / LLM (11 items) | Each item gets a verdict | **N/A — Firebase architecture differs.** No LLM surface; single shared rationale `"This application has no LLM surface — no openai / anthropic-ai / langchain / llamaindex / MCP / RAG / embedding / agent / tool-calling integration."` | WALK-04 anchor — `SECURITY_AUDIT_REPORT.md` § §13 AI/LLM (Wave 3) |

---

## §14 Maintenance

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §14 Quarterly review of this file | Refresh on upstream change | `SECURITY_AUDIT.md` §14 is upstream-owned; this translation map should be re-walked when the source ships a quarterly update. | Maintenance trigger: source file `git log` modification post-Phase-12-close. |

---

## §15 References

| Source ref | Source guidance | Firebase equivalent | Notes |
|------------|-----------------|---------------------|-------|
| §15 Framework citations (NCSC / OWASP / Supabase / Vercel) | Framework references | Framework citations preserved verbatim in `docs/CONTROL_MATRIX.md` Framework column and in `SECURITY_AUDIT_REPORT.md` Framework column. | Cross-walks live in `docs/CONTROL_MATRIX.md`; this translation map only flags the §-level disposition. |

---

## Substrate-honest disclosure (Pitfall 19)

This translation map is the substrate for `SECURITY_AUDIT_REPORT.md` (Waves 2–3). It is **not** a claim of compliance — it is a map showing how the project's Firebase architecture stands against a Vercel/Supabase-shaped audit framework. The final posture statement lives in `SECURITY_AUDIT_REPORT.md` executive summary (Wave 2):

> credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2

Verbatim. Not certified.
