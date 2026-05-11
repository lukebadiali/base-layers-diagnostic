# SECURITY_AUDIT.md — Claude Code Security Audit & Remediation Playbook

> **Drop this file into the root of any project.** Then ask Claude Code: *"Run SECURITY_AUDIT.md against this repo."* Claude will perform a layered audit, produce a prioritised report, and apply fixes — pausing for human review on anything destructive or high-blast-radius.

**Scope of frameworks consolidated here:**
- NCSC *Guidelines for Secure AI System Development* (Aug 2023)
- NCSC *Cyber Assessment Framework v4.0* (Aug 2025)
- OWASP *Top 10 for Web Applications 2025*
- OWASP *Top 10 for LLM Applications 2025*
- OWASP *Developer Guide* + ASVS 5.0 + Cheat Sheets + Proactive Controls
- OWASP *Vulnerability Scanning Tools* community list
- Supabase Cloud hardening (RLS, JWT, Auth, Edge Functions, MCP)
- Vercel platform hardening (Firewall, BotID, OIDC, Audit Logs)
- Documented incident patterns: CVE-2025-29927 (Next.js middleware bypass), CVE-2025-55182 (React2Shell RCE), CVE-2025-48757 (Supabase RLS), Shai-Hulud npm worm, Vercel/Context.ai OAuth breach, MCP "lethal trifecta" exfiltration

---

## 0. Operating Contract for Claude

Claude, when this file is invoked you will:

1. **Discover before you act.** Read the project completely before recommending a single change. Identify language(s), framework(s), hosting platform, database, auth provider, AI/LLM integrations, package manager, and CI/CD. Detect Supabase and Vercel automatically and load the platform-specific sections.
2. **Audit first, fix second.** Produce `SECURITY_AUDIT_REPORT.md` (findings, evidence, severity, references) before any code edit. Findings are categorised **CRITICAL / HIGH / MEDIUM / LOW / INFO** by CVSS-style impact × exploitability.
3. **Fix in tiers.** Apply *Tier 1 (auto-fix)* changes silently with passing tests. Stop and request human approval for *Tier 2 (review-required)* and *Tier 3 (destructive/blast-radius)* — defined in §11.
4. **Never weaken a control to make a test pass.** If a test fails because the new control is doing its job, fix the test, not the control.
5. **Assume scale.** Every recommendation must hold for a multi-tenant production system with untrusted users, hostile networks, and adversarial LLM input. No "fine for now" patches.
6. **Cite every recommendation.** Each finding references the relevant framework section (e.g. *OWASP A01:2025*, *LLM06:2025*, *CAF B2.a*, *Splinter 0011*) so the human reviewer can verify independently.
7. **Verify libraries.** Every dependency change must be checked against current advisories (`npm audit`, `pip-audit`, `osv-scanner`, GitHub advisory DB, Socket.dev) — outdated training-data assumptions are not acceptable.
8. **Preserve a paper trail.** All changes go in a single PR titled `security: SECURITY_AUDIT.md remediation pass <date>`. Each commit references one finding ID. Never force-push, never amend prior commits.
9. **Fail closed.** When uncertain, the safer behaviour wins. A blocked legitimate request can be unblocked; a leaked database cannot be un-leaked.
10. **Never disable a security control** (RLS, CSP, rate limiter, WAF rule, signature check) to make a feature work. Find another way.

---

## 1. Phase 1 — Discovery (always first)

Run discovery commands. Do not modify files during this phase.

### 1.1 Repository fingerprint
- List top-level files; identify `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`, etc.
- Identify framework: Next.js / Remix / SvelteKit / Astro / Express / FastAPI / Django / Rails / Laravel / Spring.
- Identify runtime: Node.js / Bun / Deno / Python / Go / Ruby / JVM.
- Detect hosting platform from `vercel.json`, `netlify.toml`, `wrangler.toml`, `fly.toml`, `Dockerfile`, `kubernetes/`, `terraform/`.
- Detect database: connection string patterns, `supabase/`, `prisma/schema.prisma`, ORMs, migration directories.
- Detect auth: `next-auth`, `@clerk/`, `@workos/`, Supabase Auth, Auth0, custom JWT.
- Detect AI/LLM: `openai`, `@anthropic-ai/sdk`, `ai` (Vercel AI SDK), `langchain`, `llamaindex`, MCP servers in config.

### 1.2 Surface area enumeration
- Public HTTP routes / Server Actions / Route Handlers.
- Webhook endpoints (Stripe, GitHub, Slack, custom).
- File upload endpoints.
- Admin routes / dashboards / debug routes.
- Background jobs and cron endpoints.
- Anything under `/api/`, `/internal/`, `/admin/`, `/debug/`, `/_next/`, etc.

### 1.3 Secrets and configuration
- Scan for hardcoded keys: `AKIA[0-9A-Z]{16}`, `sk_live_`, `sk-ant-`, `eyJhbGciOi`, `-----BEGIN`, `service_role`, `sb_secret_`, `xoxb-`, `ghp_`, `glpat-`.
- Read `.env*` files; flag any committed secret.
- Check `.gitignore` covers all env files.
- Map every env var to: server-only / NEXT_PUBLIC_* / VITE_* / EXPO_PUBLIC_* — public prefixes containing secrets are CRITICAL.

### 1.4 Dependency inventory
- Lockfile present and committed? (Missing lockfile → HIGH.)
- Run advisory scans: `npm audit --omit=dev` (or `pnpm audit`/`yarn npm audit`), `pip-audit`, `osv-scanner -r .`, `cargo audit`, `bundle audit`.
- Check for *Shai-Hulud* IOCs: any `Shai-Hulud` repo under team accounts, suspicious `preinstall`/`postinstall` scripts in `node_modules`, calls to `setup_bun.js` / `bun_environment.js` from packages that have no business invoking Bun.
- Identify anything pinned to a major version older than two majors behind current.
- Check `npm audit signatures` (if Node) for unsigned packages.

### 1.5 CI/CD and supply chain
- GitHub Actions / GitLab CI / CircleCI configs reviewed for: hardcoded secrets, `pull_request_target`, missing `permissions:` block, third-party actions pinned to commit SHA (not tag).
- Check for SBOM generation step (CycloneDX / SPDX).
- Check for signed commits requirement on protected branches.

Output of Phase 1 → `SECURITY_AUDIT_REPORT.md` *Discovery* section. Do not proceed until this is written.

---

## 2. Phase 2 — Universal Web Application Audit (OWASP Top 10 2025)

Walk every category. For each, document **what was checked**, **what was found**, **severity**, **fix**.

### A01 — Broken Access Control (now includes SSRF)
- Every protected route must re-check authorization **inside the handler**. Middleware is defence-in-depth, not the boundary. *(CVE-2025-29927: Next.js middleware bypass via `x-middleware-subrequest` header — middleware-only auth is broken.)*
- Object-level authorization (IDOR): every resource fetch by user-supplied id must verify ownership. Search for `findUnique({ where: { id: params.id }})`, `findById(req.params.id)`, `getDoc(id)` patterns without a `userId` / `tenantId` filter.
- Server-side enforcement: never trust `role` from client cookies/JWT claims that the client controls (e.g. Supabase `user_metadata`).
- Implement a **Data Access Layer** with `import 'server-only'` (Next.js) or equivalent runtime guard so DB calls cannot ship to the client.
- **SSRF guard for any URL the server fetches**: block `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` (incl. `169.254.169.254` cloud metadata), `::1`, `fc00::/7`, `fe80::/10`. Use a DNS-pinned HTTP client to defeat DNS rebinding (resolve once, connect to that IP, refuse if private).
- Default to **deny**; allowlist what's permitted.

### A02 — Security Misconfiguration
- Security headers present and correct: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `X-Frame-Options: DENY` (or `frame-ancestors 'none'` in CSP), `Content-Security-Policy` (strict, nonce-based).
- CORS: explicit origin allowlist, never `*` with `credentials: true`. Reject `Origin: null`.
- Default routes / debug endpoints / source maps in production: removed or protected.
- Error responses: no stack traces, no SQL fragments, no internal paths leaked to clients.
- Cookie flags: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict` for auth cookies).
- Verbose logging of secrets, full prompts, full PII: removed/redacted.

### A03 — Software Supply Chain Failures *(NEW in 2025, expanded from "Vulnerable Components")*
- Lockfile committed; CI uses `npm ci` / `pnpm install --frozen-lockfile` / `pip install -r requirements.txt --require-hashes` (or equivalent).
- Dependabot or Renovate configured.
- SBOM generated per build (CycloneDX preferred).
- npm: WebAuthn 2FA + trusted publishing for any package this project publishes.
- All third-party GitHub Actions pinned to commit SHA, not tag (`uses: actions/checkout@v4` → `uses: actions/checkout@<sha>`).
- Pre-install / post-install scripts audited; consider `npm ci --ignore-scripts` for CI where scripts aren't needed.
- OAuth app review (GitHub, Google Workspace, Vercel, npm): unused integrations revoked. *(The Apr 2026 Vercel/Context.ai breach was an OAuth supply-chain compromise.)*
- Quarterly rotation calendar for all long-lived tokens.

### A04 — Cryptographic Failures
- TLS 1.2+ only; HSTS preload.
- Passwords: Argon2id (preferred) or bcrypt (cost ≥ 12). Never MD5/SHA1/SHA256-of-password.
- Secrets in storage: AES-256-GCM with rotated keys.
- JWTs: asymmetric (ES256/RS256/EdDSA) preferred over HS256 for new systems.
- No tokens in `localStorage` / `sessionStorage` (XSS-readable). Use `HttpOnly` cookies.
- Session cookies: short-lived (≤ 1h for sensitive apps; HIPAA-grade 15m), refresh-token rotation with reuse detection.
- Random IDs/tokens use a CSPRNG (`crypto.randomUUID()`, `secrets.token_urlsafe()`); never `Math.random()`.

### A05 — Injection (SQLi, XSS, command, LDAP, NoSQL)
- All DB access via parameterized queries / prepared statements / ORM. Search for string-concatenated SQL.
- Shell exec: never with user input without explicit allowlist; prefer language-native APIs.
- HTML output: escape by default; `dangerouslySetInnerHTML` / `v-html` / `{{{ }}}` reviewed and justified per call site.
- Markdown rendering: see §6 (LLM05 — model output is also injection surface).
- Template engines configured to auto-escape (Jinja `autoescape=True`, Handlebars triple-stash audited, etc.).

### A06 — Insecure Design
- Threat model exists for every feature handling auth, money, PII, AI agency, or admin actions. (OWASP Threat Dragon / pytm / a written design doc all qualify.)
- Rate limiting designed in, not bolted on.
- Quotas and cost ceilings designed in, especially for AI features (see §6 LLM10).
- Fail-closed defaults; least privilege from day one.

### A07 — Authentication Failures
- Password policy: minimum 12 chars, four character classes (or NIST SP 800-63B–style with leaked-password check via HIBP).
- MFA available for all users, **enforced** for admins.
- Account lockout / progressive delays on auth endpoints.
- CAPTCHA on signup, login, password reset.
- Session invalidation on password change, MFA enrolment, role change, logout.
- Email verification required before privileged actions.
- OAuth / OIDC: validate `iss`, `aud`, `exp`, `nbf`, `nonce`, signature (kid → JWKS).

### A08 — Software or Data Integrity Failures
- Pin dependency hashes (npm: `--strict-peer-deps`, lockfile integrity checks).
- Verify package signatures (`npm audit signatures`, Sigstore for Python).
- Dataset/model provenance for AI: pinned versions, signed weights when available.
- No autoloading of remote configs / remote code at runtime.
- Image tags pinned (no `:latest`).
- Subresource Integrity (`integrity="sha384-..."`) on any external `<script>` (rare — CSP should usually block these anyway).

### A09 — Security Logging and Alerting Failures
- Auth events logged (success + failure) with user id, IP, UA, timestamp.
- Privileged actions logged (admin operations, role changes, data exports).
- Logs centralised (SIEM, Datadog, Sumo, Loki, ELK).
- Alerts on: failed-auth bursts, env-var read anomalies, deployment-protection bypass usage, new SECURITY DEFINER functions, sudden cost spikes.
- PII redacted in logs; structured JSON; correlation IDs.
- Log integrity: append-only / immutable retention for compliance window.

### A10 — Mishandling of Exceptional Conditions *(NEW in 2025)*
- Catch blocks never silently swallow errors. Log + re-throw or return structured error.
- Default code path on unexpected state is **deny**, not allow.
- When a guardrail fails, the system **refuses**, not "best-effort continues".
- No fallback to insecure path when secure path errors (e.g. don't fall through to unauthenticated mode if MFA check throws).
- Health-check / liveness endpoints don't leak internal state.

---

## 3. Phase 3 — Auth, Sessions, and Identity

Independent of A07 above, walk these specifically:

- **Session storage**: HttpOnly + Secure + SameSite cookies. No JWTs in localStorage.
- **Session rotation**: new session ID on login, on privilege change, on MFA enrolment.
- **Refresh tokens**: single-use with rotation; reuse detection revokes the entire family.
- **JWT validation**: signature verified against JWKS (cached, with rotation tolerance); `iss`, `aud`, `exp`, `nbf` strictly checked; `alg: none` rejected; algorithm allowlist enforced (don't accept HS256 if you issue ES256 — algorithm confusion).
- **CSRF**: SameSite=Lax/Strict on auth cookies + explicit CSRF token on state-changing requests where SameSite is insufficient. *(CVE-2026-27978: Next.js Server Action CSRF via `Origin: null` — explicitly reject `null` origins.)*
- **Password reset**: tokens single-use, time-limited (≤ 1h), bound to the email at issue time. Don't reveal whether an email is registered.
- **Account enumeration**: identical responses for "user exists" vs "user doesn't" on login, signup, reset.
- **OAuth**: `state` parameter cryptographically random and verified. PKCE for all public clients. Redirect URI exact-match.
- **WebAuthn / passkeys**: preferred for admin and high-value accounts.

---

## 4. Phase 4 — Input Validation and Output Encoding

- Every external input has a schema (Zod / Pydantic / Joi / io-ts / class-validator) — type, length, range, format.
- Validation runs **server-side**. Client-side validation is UX, not security.
- File uploads: MIME sniffing (don't trust `Content-Type`), size limits, extension allowlist, scan for malware if user-shared, store outside web root, serve via signed URL.
- URL parameters: typed and validated; reject coercion exploits (`?id=1` vs `?id=1.json` vs `?id[]=1`).
- HTML output: framework auto-escape on; explicit sanitisation (DOMPurify) for any rich-text path.
- JSON output: never reflect user input into a `<script>` block; `Content-Type: application/json` strictly.
- SQL: parameterised everywhere; flag every `query(\`...${var}...\`)` or `format()` with user data.

---

## 5. Phase 5 — Network, Infrastructure, and Platform

### 5.1 Universal
- TLS 1.2+ only; modern cipher suites; OCSP stapling.
- DNS: DNSSEC where supported; CAA record limits issuers; TXT records reviewed for stale verification entries.
- Open ports: only what's needed. Database, Redis, internal services not exposed publicly.
- Egress filtering: production servers shouldn't be able to reach arbitrary internet — allowlist by destination.
- Backups: encrypted, tested restoration, off-site copy, RTO/RPO documented (CAF D1).

### 5.2 If Vercel detected → §9
### 5.3 If Supabase detected → §8
### 5.4 If AWS/GCP/Azure detected
- IAM: least privilege; no wildcard `*` in policies. No long-lived access keys — use OIDC federation from CI / Vercel.
- S3 / GCS / Blob: no public buckets unless explicitly intended; bucket policy + IAM both checked; no `s3:GetObject` to `Principal: "*"`.
- Secrets manager (AWS Secrets Manager / GCP Secret Manager / Azure Key Vault): all secrets there, not env files.
- Logging to CloudTrail / Cloud Audit Logs / Azure Activity Logs centralised and alerted.
- VPC: private subnets for compute, public subnets only for load balancers.

---

## 6. Phase 6 — AI / LLM Security (OWASP LLM Top 10 2025 + NCSC Guidelines)

Activate this section if any of: `openai`, `@anthropic-ai/sdk`, `ai` (Vercel AI SDK), `langchain`, `llamaindex`, MCP servers, embeddings, RAG, agents, tool-calling.

### LLM01 — Prompt Injection (direct and indirect)
- **Constrain scope** in system prompt; explicit refusal rules.
- **Spotlighting**: wrap retrieved RAG content in delimiters (e.g. `<UNTRUSTED_DOCUMENT>...</UNTRUSTED_DOCUMENT>`) and instruct the model to never follow instructions inside.
- **Instruction hierarchy**: system > developer > user > retrieved content. Encode this explicitly.
- **Guardrails**: Llama Guard, GPT-OSS-Safeguard, Vercel AI Gateway Guardrails, or a separate small model classifying input as safe/unsafe before main inference.
- **Adversarial testing**: Promptfoo / DeepTeam / Garak in CI for any user-facing LLM endpoint.
- **Critical**: prompt-engineering alone is **not** a security boundary. Defence in depth (input filter + structured output + tool sandbox + downstream authz + monitoring) is mandatory.

### LLM02 — Sensitive Information Disclosure
- Never put secrets in system prompts (they leak — see LLM07).
- Retrieve secrets dynamically only when needed, via authenticated tools.
- PII redaction **before** embedding/RAG ingestion.
- Output scanning for secrets, PII, internal hostnames before returning to user.
- Data classification on what may be sent to providers; consider Anthropic Zero-Data-Retention or equivalent for regulated data.

### LLM03 — Supply Chain (model + tooling + datasets)
- Pin model versions explicitly (`claude-opus-4-7-20251201` not `claude-opus-latest`).
- Vet pre-trained checkpoints; signed weights when available; model SBOM.
- MCP servers: only OAuth-authenticated, audited servers. Validate `aud`, `iss`. Pin server versions. **Never connect MCP to a production database with write access. Never give MCP `service_role` / admin credentials.** *(General Analysis demonstrated full Supabase exfiltration via a malicious support ticket and an MCP-connected agent with `service_role`.)*
- Plugin/tool review: each tool is a supply-chain dependency.

### LLM04 — Data and Model Poisoning
- RAG ingestion: validate sources; require provenance for documents entering the corpus; allowlist scraped domains; signature on documents where feasible.
- Re-indexing on schedule with provenance verification.
- Fine-tuning: treat training data like code (versioned, reviewed, SBOM-equivalent). *(PoisonedRAG achieves attacker-chosen answers >90% with 5 documents; HijackRAG ~97%.)*

### LLM05 — Improper Output Handling
- **Treat model output as untrusted user input.** It flows into HTML, SQL, shell, tool calls — sanitise accordingly.
- **Structured outputs**: Zod / Pydantic schemas on every tool input *and* output. Reject malformed; do not "best-effort parse".
- **Markdown rendering** (very common XSS vector — *CVE-2025-24981 Nuxt MDC*):
  - Use `react-markdown` (produces React elements; JSX-escaped) — **never** combine with `rehype-raw` unless `rehype-sanitize` runs after.
  - For raw-HTML paths, DOMPurify with a strict allowlist.
  - `urlTransform` to block `javascript:`, `data:`, `vbscript:` URI schemes in links.
- **Never** `dangerouslySetInnerHTML` on model output.
- **Never** feed model output into `eval`, `Function`, `exec`, `system`, raw SQL, or shell without explicit allowlist + sandbox.

### LLM06 — Excessive Agency
- **Minimum tool set**: only what the agent strictly needs.
- **Minimum function granularity**: `read_user_email_subject` not `execute_arbitrary_query`.
- **Minimum permission downstream**: scoped credentials per tool, ephemeral JIT credentials where possible.
- **Authorization in the downstream resource, not the prompt.** OWASP's explicit guidance — confused-deputy defence. The DB / API enforces who can do what; the LLM cannot be trusted to honour "you must not …" instructions.
- **Human-in-the-loop** on: writes that affect billing/money, sending external messages, code execution, fetching arbitrary URLs, deleting data.
- **Sandbox** code execution: gVisor / microVM / Vercel Sandbox / Firecracker / Kata. Egress allowlist. No metadata-IP access.
- **Rate-limit tool invocations** per user/session.

### LLM07 — System Prompt Leakage *(NEW)*
- Assume the system prompt **will** be extracted. Design accordingly.
- No secrets, no internal URLs, no raw credentials, no privileged hint that "if you say the magic phrase you bypass auth".
- Business logic must not rely on secrecy of the prompt.

### LLM08 — Vector and Embedding Weaknesses *(NEW)*
- Tenant isolation in vector store: `WHERE tenant_id = ?` enforced server-side, not as a metadata filter the client can override.
- Embedding inversion: assume embeddings can be reversed to approximate text. Don't embed PII you wouldn't store as plaintext.
- Embedding-space poisoning: validate ingestion (LLM04).

### LLM09 — Misinformation
- For factual domains, ground on retrieved sources and cite them.
- Confidence calibration; refusal on uncertainty for high-stakes domains (medical, legal, financial).
- Human oversight for outputs that drive real-world action.

### LLM10 — Unbounded Consumption ("Denial of Wallet")
- **Per-user rate limits** keyed on authenticated user id (e.g. `@upstash/ratelimit` sliding window). IP-based limits alone are insufficient.
- **Per-route token caps**: max input tokens, max output tokens, max tool-call iterations.
- **Concurrency caps** per session.
- **Cost budgets** with hard cut-offs; alert at 50% / 80% / 100% of daily budget.
- **Semantic caching** (e.g. Upstash Vector) to bound spend.
- **Bot mitigation** at the perimeter (Vercel BotID / Cloudflare Turnstile / hCaptcha) on every paid AI route.
- **Streaming abandonment**: cancel inference when client disconnects (`AbortSignal`).

### NCSC AI Guidelines — additional checks
- **Secure design**: threat model includes adversarial examples, prompt injection, model theft, training-data extraction, membership inference.
- **Secure development**: model + dataset + pipeline have SBOMs; CI scans model weights for known backdoors where feasible.
- **Secure deployment**: model served from authenticated, rate-limited endpoint; no anonymous access to expensive operations.
- **Secure operation and maintenance**: monitor for drift, jailbreak attempts, abuse patterns; incident plan covers model rollback.

---

## 7. Phase 7 — Specific Attack Class Defences

For each attack class the user listed, verify a defence exists.

| Attack | Primary defence | Backstop |
|---|---|---|
| **DoS / DDoS** | CDN/WAF auto-mitigation (Vercel/Cloudflare); per-route rate limits; circuit breakers | Auto-scaling with cost ceiling |
| **MITM** | TLS 1.2+ only, HSTS preload, certificate pinning for mobile, no mixed content | DNSSEC, CAA records |
| **Phishing / Spear-phishing / Whaling** | DMARC `p=reject`, SPF, DKIM aligned to domain; user training; passkeys for admin | Sender authentication banners; explicit out-of-band verification for finance ops |
| **Ransomware** | Backups (off-site, immutable, tested restore), least-privilege endpoints, EDR | RPO ≤ 1h for production data; quarterly restore drills (CAF D1) |
| **Password attacks** | Argon2id, leaked-password check (HIBP), MFA, account lockout, CAPTCHA | Passkeys |
| **SQL injection** | Parameterised queries everywhere; ORM; least-priv DB user | WAF with SQLi rules; input schema |
| **URL interpretation / Path traversal** | `path.resolve()` + prefix check; reject `..`; canonicalise before checks | Containerisation; chroot |
| **DNS spoofing** | DNSSEC; DNS-over-HTTPS for clients; pinned resolvers in server-side fetch | Certificate transparency monitoring |
| **Session hijacking** | HttpOnly + Secure + SameSite cookies; rotate on privilege change; bind to UA/IP fingerprint where appropriate | Short session TTL + refresh rotation |
| **Brute force** | Rate limits + progressive delays + CAPTCHA + IP reputation | fail2ban / WAF rules |
| **Insider threats** | Least privilege; quarterly access reviews (CAF B2); audit logs to SIEM; separation of duties | Anomaly detection on privileged-action patterns (CAF C1.f) |
| **Trojans / Drive-by / Malware** | EDR on dev machines; npm 2FA + trusted publishing; Socket.dev / Aikido pre-install scanning; signed commits | Build environment isolation |
| **XSS (stored / reflected / DOM)** | Auto-escape, strict CSP with nonces, `Trusted Types` where supported; sanitise rich-text input | DOMPurify + framework-level escaping |
| **Eavesdropping** | TLS everywhere, including internal service-to-service (mTLS); encrypted backups | VPN / private network for control plane |
| **Birthday / hash collision** | SHA-256 minimum for collision-resistance contexts; never SHA-1/MD5 for security | HMAC for authenticated hashing |
| **Web attacks generally** | Defence-in-depth: WAF + CSP + input validation + output encoding + auth + logging | Threat modelling per feature |

For each row, the audit confirms the primary defence is in place; if not → **finding**.

---

## 8. Phase 8 — Supabase Hardening (activate if Supabase detected)

Source of truth: Supabase Splinter advisor + the platform-specific report. Run the advisor (`supabase db lint` and the dashboard Security Advisor) and treat every `error`-level lint as blocking.

### 8.1 RLS — non-negotiables
- Every table in every schema exposed via PostgREST/pg_graphql/Realtime has `ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY`. *(CVE-2025-48757 / DeepStrike / Escape.tech all trace breaches to this single failure.)*
- Install the event trigger that auto-enables RLS on every newly created `public.*` table (provided in the Supabase report §1).
- No `USING (true)` policies. Every policy scoped by `auth.uid()` or tenant id.
- Wrap `auth.uid()` as `(select auth.uid())` for initPlan caching (>100× perf on large tables).
- Every policy includes `TO authenticated` (or `TO anon` if explicitly intended) — never `TO public`.
- Index every column referenced in a policy.
- Split `FOR ALL` into explicit `SELECT` / `INSERT` / `UPDATE` / `DELETE` policies.
- Every `INSERT` policy has `WITH CHECK`. Every `UPDATE` policy has **both** `USING` and `WITH CHECK`. *(Missing `WITH CHECK` on UPDATE = mass-assignment / IDOR.)*
- Policies referencing user attributes use `app_metadata` / Custom Access Token Hook output — **never** `user_metadata` (user-writable via `supabase.auth.updateUser({ data: { is_admin: true }})`).
- Multi-tenant: cache membership lookup in a `SECURITY DEFINER` helper in a `private` schema, called via `(select * from private.user_teams())`.
- Restrictive policy enforces AAL2 for sensitive tables: `using ((select auth.jwt() ->> 'aal') = 'aal2')`.

### 8.2 Functions and views
- Default `SECURITY INVOKER`; `SECURITY DEFINER` only when essential.
- Every `SECURITY DEFINER` function has `SET search_path = ''` and uses fully-qualified identifiers (`public.tbl`, not `tbl`). *(Splinter 0011; Cybertec exploit demonstrates schema hijacking via `public.+(int,int)` operator otherwise.)*
- Views in PG15+: `WITH (security_invoker = true)`. Pre-PG15: move to `private` schema.
- Materialized views never in an exposed schema (Splinter 0016).
- `SECURITY DEFINER` helpers parked in `private` schema, not exposed via PostgREST.

### 8.3 Auth surface
- Asymmetric (ES256/RS256) JWT signing keys; legacy HS256 retired. `sb_publishable_…` / `sb_secret_…` replace `anon` / `service_role`.
- **`service_role` / `sb_secret_…` never appears in:** browser bundles, mobile apps, public env vars (`NEXT_PUBLIC_*`, `VITE_*`, `EXPO_PUBLIC_*`), CI artifacts, LLM/MCP context, Edge Functions that ingest untrusted text.
- MFA enforced org-wide (Pro+); restrictive RLS policy gates sensitive ops on `aal2`.
- CAPTCHA on signup, sign-in, password reset, **especially** anonymous sign-ins.
- Leaked-password protection enabled (HIBP).
- OTP / email-link expiry ≤ 3600s.
- Custom SMTP configured (default mailer is rate-limited and untrusted).
- Anonymous sign-in cleanup via `pg_cron` (the platform doesn't auto-purge).
- Auth version ≥ 2.185.0 (CVE-2026-31813 OIDC issuer-spoofing); out of 2.67.1–2.163.0 window (GHSA-3529-5m8x-rpv3 X-Forwarded-Host email-link poisoning).

### 8.4 Data API surface
- Default grants revoked: `alter default privileges in schema public revoke all on tables/routines/sequences from anon, authenticated;`
- Business logic in dedicated `api` schema; internals in `public` / `private`.
- Disable Data API entirely if app uses Edge Functions exclusively.
- pg_graphql introspection disabled in production if not used.
- Realtime: row-level filters server-side; never trust client filter args.

### 8.5 Storage
- Buckets default-private. Public buckets only for genuinely public assets (no PII ever).
- RLS-equivalent policies on `storage.objects`.
- Signed URLs with short TTL for private content.
- Upload size and MIME-type allowlists.

### 8.6 Edge Functions
- `service_role` only behind authenticated, validated requests; never callable by `anon` directly without explicit intent.
- Webhook endpoints: HMAC verification with constant-time compare; replay protection via timestamp + nonce.
- Idempotency keys on side-effect endpoints.
- Rate limits per function.

### 8.7 Operations
- pgaudit object-mode on `auth.users`.
- `supa_audit` enabled on user-data tables; append-only RLS on audit history.
- Log Drain → SIEM.
- Network Restrictions configured (IP allowlist for direct DB access).
- PITR add-on enabled; quarterly clone-to-new-project drills.
- pgTAP + basejump tests in CI; Splinter advisor blocks deploy on `error` lints.
- Migrations only via PR + branching; no direct dashboard edits to production.
- Multiple org owners (no single-point-of-failure).
- **MCP integration**: `read_only=true` and `project_ref=<dev-only>`. **Never connect MCP to production. Never give MCP `service_role`.** Per-tool human approval.

### 8.8 The 15 "never do this" anti-patterns
Verify none of these are present:
1. `service_role` shipped to browser / mobile / public env / LLM context.
2. RLS policy referencing `user_metadata`.
3. `SECURITY DEFINER` function without `set search_path = ''` + FQ refs.
4. `FOR ALL` policies (must split into 4).
5. `INSERT` or `UPDATE` policy missing `WITH CHECK`.
6. Relying on `auth.uid() IS NOT NULL` instead of `TO authenticated`.
7. `SECURITY DEFINER` helper in an exposed schema.
8. Testing RLS in SQL Editor as the postgres role.
9. Public Storage bucket containing PII.
10. New project on HS256 JWT secret.
11. Direct DB writes outside migrations once branching is adopted.
12. MCP connected to production, or `read_only=false` against anything ingesting untrusted text.
13. Trusting client-controlled headers (`X-Forwarded-Host`, etc.) for security decisions.
14. Auto-confirm emails in production; OTP expiry > 1h.
15. Deleting a project containing the only copy of important data (backups vanish too).

---

## 9. Phase 9 — Vercel Hardening (activate if Vercel detected)

### 9.1 Secrets and credentials
- **Every** environment variable holding a credential / token / key / password / connection string is marked **Sensitive**. Plain env vars only for non-secret config (region names, public URLs, feature flags).
- **OIDC Federation** to AWS / GCP / Azure — eliminates long-lived cloud keys entirely. Use `@vercel/oidc` and `@vercel/oidc-aws-credentials-provider`.
- Deployment Protection bypass tokens treated as credentials; rotated quarterly.
- npm: WebAuthn 2FA + trusted publishing.
- Any credentials that lived in plain (non-Sensitive) env vars between Feb–Apr 2026 are **rotated** (Vercel/Context.ai breach scope).

### 9.2 Edge / Perimeter
- **Vercel Firewall** active (default). Custom WAF rules for known abuse patterns.
- **Bot Filter / Bot Protection ruleset** enabled (free).
- **AI Bots ruleset** enabled.
- **BotID Deep Analysis** on every paid AI route (`/api/chat`, `/api/completion`, agent endpoints).
- **WAF rate-limit rule** per-IP on expensive endpoints + per-user `@upstash/ratelimit` keyed on authenticated user id.
- **Attack Challenge Mode** documented in IR runbook (manual trigger).
- **Geo / ASN / UA blocks** for known abuse sources.
- **Critical**: **no Cloudflare (or any reverse proxy) in front of Vercel** — strips signals BotID and Bot Protection rely on.

### 9.3 Deployment Protection
- Production: public, but every paid endpoint behind BotID + WAF + per-user rate limit.
- Preview: Standard or All-deployments protection (default Pro/Enterprise).
- **Trusted Sources** for service-to-service: validate OIDC `iss`, `aud`, `sub`.
- Bypass tokens scoped narrowly; injected via `VERCEL_AUTOMATION_BYPASS_SECRET`; rotated.

### 9.4 Next.js framework
- **Next.js version current**, including:
  - ≥ 15.2.3 / 14.2.25 / 13.5.9 / 12.3.5 (CVE-2025-29927 middleware bypass).
  - Out of React Server Components RCE window (CVE-2025-55182 / 66478 — React2Shell). If app ran an unpatched RSC version: **rotate all secrets, assume compromise**.
  - ≥ 16.1.7 (CVE-2026-27978 Server Action CSRF; reject `Origin: null`).
- **Authorization re-checked inside every Route Handler and Server Action.** Middleware is defence-in-depth, not the boundary.
- Server Actions: `serverActions.allowedOrigins` set; never includes `null`; CSRF token for sensitive actions.
- `import 'server-only'` on all DB / secrets modules.

### 9.5 Headers and CSP
Set in `vercel.json` or middleware:
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'strict-dynamic' 'nonce-{{nonce}}';
  style-src 'self' 'nonce-{{nonce}}';
  img-src 'self' data: https:;
  connect-src 'self' https://api.anthropic.com https://api.openai.com;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
  form-action 'self';
  upgrade-insecure-requests
```
Adjust per actual provider list. Nonces generated per request in middleware. `frame-ancestors 'none'` replaces `X-Frame-Options: DENY`.

### 9.6 AI route hardening (combine with §6)
- BotID Deep Analysis on the route.
- Per-user rate limit (sliding window, `@upstash/ratelimit`).
- Hard token / concurrency caps per request.
- Vercel AI Gateway with BYOK for centralised observability + retries + failover.
- Guardrails: AI Gateway Guardrails / Llama Guard / GPT-OSS-Safeguard.
- Streaming: cancel on client disconnect.
- Audit log streamed to SIEM.

### 9.7 Detection
- **Vercel Audit Logs** streamed to SIEM (Datadog / Splunk / Sumo / S3) — Enterprise feature; Pro: scheduled CSV export at minimum.
- Anomaly baselines on env-var reads, deployment cadence, API token usage.
- Threat hunting: search logs for `x-middleware-subrequest` headers (CVE-2025-29927 attempts), Shai-Hulud IOCs, OAuth-app activity from unfamiliar IPs.

### 9.8 IR runbook (CAF D1)
- Credential-compromise scenario tested.
- Rapid-patch SLA for Next.js / React advisories (hours, not days — React2Shell hit CISA KEV in 48h).
- Lessons fed back into controls (CAF D2).

---

## 10. Phase 10 — Vulnerability Scanning Toolchain

Run, in this order, and integrate into CI:

### 10.1 SAST (static)
- **Semgrep** (`semgrep --config=auto`) — generic + framework rules.
- **CodeQL** (GitHub Advanced Security) — deep dataflow analysis.
- **Bandit** (Python), **Brakeman** (Rails), **gosec** (Go), **ESLint security plugin** (JS/TS).
- Language-specific: `cargo audit` (Rust), `composer audit` (PHP).

### 10.2 SCA (supply chain)
- **`npm audit` / `pnpm audit` / `yarn npm audit`** with `--omit=dev` for production-relevant signal.
- **`osv-scanner -r .`** — OSV.dev advisories across ecosystems.
- **`pip-audit`** for Python.
- **Dependabot** or **Renovate** with grouped PRs.
- **Socket.dev** for behavioural malicious-package detection (post-Shai-Hulud essential).
- **Snyk** / **Aikido** / **Trivy** for broader coverage.
- **`npm audit signatures`** to verify package signatures.

### 10.3 Secrets scanning
- **gitleaks** (`gitleaks detect --source . -v`) — pre-commit hook + CI gate.
- **trufflehog** for high-entropy detection.
- **GitHub Secret Scanning + Push Protection** at org level (free for public repos; org plan for private).

### 10.4 IaC scanning
- **Checkov** / **tfsec** / **terrascan** for Terraform.
- **kubesec** / **kube-score** for Kubernetes manifests.

### 10.5 Container scanning
- **Trivy** for image CVEs.
- **Dockle** / **hadolint** for Dockerfile best practices.

### 10.6 DAST (dynamic)
- **OWASP ZAP** baseline scan in CI against staging.
- **Nuclei** templates for known-CVE checks.
- **sqlmap** in scoped pen-test windows only.

### 10.7 LLM-specific
- **Promptfoo** — adversarial prompt test suites.
- **Garak** — LLM vulnerability probes.
- **DeepTeam** — red-team automation.

### 10.8 The OWASP community list
For specific stacks, consult <https://owasp.org/www-community/Vulnerability_Scanning_Tools>. Choose tools per language; avoid stacking five tools that all detect the same thing. Calibrate signal-to-noise — false-positive fatigue is itself a security risk.

### 10.9 Wire to CI
Every PR runs (at minimum): Semgrep + npm audit (or equivalent) + gitleaks + framework-specific linter + project test suite including security tests (e.g. pgTAP for Supabase RLS, Promptfoo for LLM endpoints).

### 10.10 Periodic
- Quarterly: dependency update sweep; OAuth app review; access review (CAF B2); restore drill (CAF D1).
- Annually: third-party pen test (OWASP recommends; Vercel Pro/Enterprise customers can request platform pen-test reports).

---

## 11. Remediation Tiers — what Claude may auto-fix

### Tier 1 — auto-fix (commit + run tests)
- Adding security headers (`Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, baseline CSP scaffold).
- Tightening cookie flags (`HttpOnly`, `Secure`, `SameSite`).
- Replacing `Math.random()` with CSPRNG in security contexts.
- Replacing string-concatenated SQL with parameterised queries.
- Replacing `dangerouslySetInnerHTML` on model output with `react-markdown` + sanitiser.
- Adding `import 'server-only'` to DB / secrets modules.
- Adding input validation schemas (Zod / Pydantic) where none exist.
- Adding rate-limiter to AI / auth / webhook endpoints.
- Adding `WITH CHECK` to existing Supabase `INSERT` / `UPDATE` policies.
- Wrapping bare `auth.uid()` as `(select auth.uid())` in policies.
- Adding `set search_path = ''` to `SECURITY DEFINER` functions.
- Pinning GitHub Actions to commit SHA.
- Adding `.env*` to `.gitignore` if missing.
- Updating dependencies with patch-level security fixes (lockfile change only).

### Tier 2 — propose, request approval (write a draft PR comment, do not merge)
- Schema changes (new columns, new indexes for RLS performance).
- New RLS policies on existing tables.
- Splitting `FOR ALL` policies into four.
- Renaming env vars or marking them Sensitive on Vercel (requires platform-side action).
- Major dependency updates (any major version bump).
- Moving objects to a `private` / `api` schema (PostgREST exposure changes).
- Replacing legacy HS256 JWT keys with asymmetric.
- Introducing new auth flows (MFA enforcement, passkeys).
- CSP hardening that may break embeds / analytics scripts.
- Removing routes / endpoints flagged as unused.

### Tier 3 — destructive / blast-radius (never apply without written approval)
- **Rotating production credentials** (always human-driven).
- **Revoking OAuth apps** (potential outage of integrations).
- **Disabling Data API on Supabase** (changes app behaviour platform-wide).
- **Changing default org-wide policies** on Vercel/Supabase.
- **Deleting historical data**, audit logs, or backups.
- **Force-pushing or rewriting git history**.
- **Bypassing branch protection** to land a fix.
- **Disabling a feature flag** that gates a payment / regulatory flow.
- **Production database migrations** that aren't backwards-compatible.

When proposing Tier 2 / Tier 3 changes, Claude writes a short *Change Brief* in the PR including: the finding, the framework citation, the proposed fix, the rollback plan, and the test plan.

---

## 12. Output — what Claude produces at the end of every audit pass

1. **`SECURITY_AUDIT_REPORT.md`** at repo root containing:
   - *Executive summary* (5–10 lines).
   - *Discovery* (what stack was detected).
   - *Findings table* (ID, category, severity, location, framework citation, status: `fixed` / `proposed` / `requires-human`).
   - *Per-finding detail* (evidence, fix applied or proposed, references).
   - *Tooling output appendix* (raw scanner output references).
   - *Sign-off checklist* derived from §13.
2. **A git branch** `security/audit-<YYYYMMDD>` with one commit per finding, message format: `security(<finding-id>): <short>`.
3. **A draft PR** linking each commit to its finding ID.
4. **A `SECURITY.md`** at repo root if one doesn't exist (vulnerability disclosure contact, PGP key, supported versions).
5. **CI integration** proposed (workflow YAML diff) wiring scanners from §10.

---

## 13. Sign-off Checklist

Claude marks each item ✅ / ❌ / ⚠️ with evidence. The audit is not "complete" until every item is one of ✅ or ⚠️ (with a reasoned justification).

### Universal
- [ ] Phase 1 discovery written to report.
- [ ] OWASP A01–A10 (2025) walked, each with finding or "no issue + evidence".
- [ ] Auth, sessions, identity reviewed.
- [ ] Input validation and output encoding reviewed.
- [ ] Network / infra / platform reviewed.
- [ ] Specific attack-class table (§7) reviewed.
- [ ] Vulnerability scanners run; raw output captured.
- [ ] Security headers + strict CSP in place.
- [ ] No hardcoded secrets; lockfile committed; `.env*` gitignored.
- [ ] All dependencies free of `error`-level advisories.
- [ ] Logging and alerting wired to a central destination.
- [ ] `SECURITY.md` exists.
- [ ] CI integrates Semgrep + secrets scan + dep audit + tests on every PR.
- [ ] IR runbook exists (CAF D1) and covers credential compromise.

### If Supabase
- [ ] Splinter advisor zero `error`-level lints.
- [ ] Every exposed table: RLS enabled + forced.
- [ ] All policies: `TO authenticated`, `(select auth.uid())`, `WITH CHECK` on writes, four-policy split.
- [ ] No `user_metadata` references in policies.
- [ ] All `SECURITY DEFINER`: `set search_path = ''` + FQ refs.
- [ ] `service_role` confirmed absent from client-reachable surfaces.
- [ ] Asymmetric JWT signing keys.
- [ ] MFA org-wide; CAPTCHA on auth; leaked-password protection on; custom SMTP.
- [ ] pgTAP tests in CI.
- [ ] MCP — if used — read-only and project-scoped to dev.
- [ ] PITR enabled; restore drill scheduled.

### If Vercel
- [ ] All secrets marked Sensitive.
- [ ] OIDC federation to cloud providers (no long-lived AWS/GCP/Azure keys).
- [ ] BotID Deep Analysis on paid AI routes.
- [ ] WAF rate limits + per-user `@upstash/ratelimit` on AI / auth / webhook routes.
- [ ] Next.js patched against CVE-2025-29927, CVE-2025-55182, CVE-2026-27978.
- [ ] Authorization re-checked inside every Route Handler / Server Action.
- [ ] Strict CSP with nonces; full security header set.
- [ ] No Cloudflare / reverse proxy in front of Vercel.
- [ ] Audit Logs streamed to SIEM (Enterprise) or scheduled export (Pro).
- [ ] Bypass tokens rotation calendar.

### If AI / LLM
- [ ] Prompt-injection guardrails (input filter + spotlighting + structured output).
- [ ] No secrets in system prompts.
- [ ] Tool allowlist per agent; minimum function granularity; downstream authorization.
- [ ] Human-in-the-loop on writes / money / external messaging / code execution / arbitrary URL fetch.
- [ ] Code-execution sandboxed (gVisor / microVM / Vercel Sandbox) with egress allowlist.
- [ ] SSRF guard on all server-fetched URLs (private-IP + metadata-IP block, DNS-pinned client).
- [ ] Markdown rendered safely (`react-markdown` without `rehype-raw`, or with `rehype-sanitize`).
- [ ] Per-user rate limits + token caps + concurrency caps + cost budgets.
- [ ] Adversarial test suite (Promptfoo / Garak) in CI.
- [ ] MCP servers — if used — pinned, OAuth-authenticated, validated `aud`/`iss`, never given `service_role` / production write access.

---

## 14. Maintenance — keeping this file alive

- Review this file every quarter. Frameworks change (CAF v4.0 added threat-hunting and supply-chain principles in Aug 2025; OWASP added Software Supply Chain and Mishandling Exceptional Conditions in 2025; OWASP LLM Top 10 added System Prompt Leakage and Vector/Embedding Weaknesses in 2025).
- Update CVE references after every confirmed major incident affecting your stack.
- When the audit produces a new class of finding not covered here, add it to the checklist.
- Treat **this file as code**: PRs, review, history, no silent edits.

---

## 15. References

**Authoritative**
- NCSC, *Guidelines for Secure AI System Development* — https://www.ncsc.gov.uk/collection/guidelines-secure-ai-system-development
- NCSC, *Cyber Assessment Framework v4.0* (Aug 2025) — https://www.ncsc.gov.uk/collection/caf
- OWASP, *Top 10 for Web Applications 2025* — https://owasp.org/Top10/2025/
- OWASP, *Top 10 for LLM Applications 2025* — https://genai.owasp.org/resource/owasp-top-10-for-llm-applications-2025/
- OWASP, *Developer Guide* — https://devguide.owasp.org/
- OWASP, *Application Security Verification Standard 5.0*
- OWASP, *Cheat Sheet Series* — https://cheatsheetseries.owasp.org/
- OWASP, *Vulnerability Scanning Tools* — https://owasp.org/www-community/Vulnerability_Scanning_Tools
- OWASP, *Top 10 for Agentic AI Applications* (2025)

**Platform**
- Supabase Security Advisor (Splinter) and database lints
- Vercel Security documentation; Vercel Audit Logs; BotID; OIDC Federation

**Incidents and CVEs referenced**
- CVE-2025-29927 — Next.js middleware authorization bypass
- CVE-2025-48757 — Supabase RLS misconfiguration class (Lovable disclosure)
- CVE-2025-55182 / CVE-2025-66478 — React2Shell RCE
- CVE-2026-27978 — Next.js Server Action CSRF (`Origin: null`)
- CVE-2026-31813 — Supabase Auth OIDC issuer-spoofing (< 2.185.0)
- GHSA-3529-5m8x-rpv3 — Supabase Auth `X-Forwarded-Host` email-link poisoning
- CVE-2025-24981 — Nuxt MDC markdown XSS
- Shai-Hulud / Shai-Hulud 2.0 npm worm campaigns (Sept + Nov 2025)
- Vercel / Context.ai OAuth supply-chain breach (Apr 2026)
- General Analysis / Pomerium MCP "lethal trifecta" Supabase exfiltration

**Pen-testing platforms** (out-of-scope for self-audit but cited): https://pentestnet.com/

---

*Last reviewed: <update on every audit pass>. This file is part of the project's secure SDLC artifacts (CAF A4.b, NIST SSDF). Treat changes to it with the same review discipline as production code.*
