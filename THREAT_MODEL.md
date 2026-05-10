# Threat Model — Base Layers Diagnostic

**Last updated:** 2026-05-10
**Methodology:** STRIDE (Spoofing / Tampering / Repudiation / Information Disclosure / Denial of Service / Elevation of Privilege).
**Scope:** Production application at `baselayers.bedeveloped.com` + the Firebase project `bedeveloped-base-layers` + the source repository.
**Posture:** Aligned to OWASP ASVS L2 v5.0, ISO/IEC 27001:2022 Annex A, SOC 2 CC6/CC7, and GDPR Art. 32 — credible, not certified.

---

## Trust boundaries

1. **Browser ↔ Firebase backplane** — TLS 1.2+; HSTS preloaded (submission filed per `SECURITY.md` § HSTS Preload Status); CSP enforced (`SECURITY.md` § Content Security Policy (enforced)); App Check token-bound (`SECURITY.md` § App Check).
2. **Firebase Auth ↔ Cloud Functions / Firestore / Storage** — Firebase ID tokens; custom claims (`role` / `orgId` / `firstRun`) set server-side via `beforeUserCreated` + Admin SDK Path B fallback per Phase 6 D-09 (`SECURITY.md` § Authentication & Sessions + § Production Rules Deployment).
3. **Cloud Functions ↔ external services** — Sentry (egress to `*.ingest.de.sentry.io`, EU residency), Slack webhook (`#ops` egress for anomaly alerts), BigQuery (audit-log 7-year archive sink), Identity Platform (Firebase-managed) (`SECURITY.md` § Observability — Sentry + § Anomaly Alerting + § Audit Log Infrastructure).
4. **Operator ↔ Firebase Console / GCP Console** — Google account + 2FA enforced at the org level; OIDC-federated GitHub Actions with no long-lived service-account JSON; secret rotation cadence documented (`SECURITY.md` § Rotation Schedule + § Build & Supply Chain).

## Threat categories

### T1. Authentication bypass

- **Threat:** Attacker bypasses Email/Password + TOTP MFA to impersonate a privileged user, sign in as another tenant, or escalate from anonymous to privileged session.
- **Mitigations:** Anonymous Auth disabled (Phase 6 SC#1); `beforeUserCreated` + `setClaims` set custom claims server-side; `firestore.rules` predicates check `request.auth.token.role` + `request.auth.token.orgId`; TOTP MFA enforced for internal users (Luke + George); AUTH-12 unified-error wrapper prevents Firebase error codes leaking through the layer boundary (Pitfall 8 anti-pattern guarded); MFA recovery via Phase 6 D-07 email-link supersession of AUTH-09 recovery codes.
- **Evidence:** `functions/src/auth/*.ts`; `firestore.rules`; `tests/rules/*.test.js`; `runbooks/phase6-cutover.md`; `SECURITY.md` § Authentication & Sessions + § Multi-Factor Authentication + § MFA Recovery Procedure + § Anonymous Auth Disabled.

### T2. Tenant boundary breach (cross-org IDOR)

- **Threat:** Authenticated user reads or writes another organisation's data via direct object reference manipulation, query parameter tampering, or subcollection traversal.
- **Mitigations:** Every Firestore + Storage rule predicate enforces `request.auth.token.orgId == resource.data.orgId`; `data/*` query helpers always include `where("orgId", "==", currentOrgId)`; lint-enforced module boundary `views/* → no firebase/*` removes a class of bypass; Phase 5 subcollection migration colocated orgId on every document path (Pitfall 17 audit-log self-read carve-out documented).
- **Evidence:** `firestore.rules`; `storage.rules`; `tests/rules/*.test.js`; `eslint.config.js`; `SECURITY.md` § Firestore Security Rules — Authored, Not Yet Deployed + § Storage Rules + § Production Rules Deployment.

### T3. File upload abuse

- **Threat:** Malicious payload uploaded as a document — XSS via stored content, malware delivery, denial-of-storage via oversized files, MIME confusion.
- **Mitigations:** `validateUpload(file)` magic-byte sniff + MIME allowlist (PDF / JPEG / PNG / DOCX / XLSX / TXT); 25 MiB size cap; filename sanitisation `[\w.\- ]+` capped at 200 chars; Storage Rules re-enforce server-side (defence-in-depth); CSP `object-src 'none'` blocks plugin execution; `frame-src 'self'` blocks iframe embedding of attacker content.
- **Evidence:** `src/ui/upload.js`; `storage.rules`; `tests/ui/upload.test.js`; `SECURITY.md` § Storage Rules + § Content Security Policy (enforced).

### T4. Denial of wallet (cost exhaustion)

- **Threat:** Attacker drives Firebase invocation cost, Cloud Storage egress, or Sentry event count beyond budget — either via direct abuse (bot signups, write floods) or via legitimate-looking but unbounded request bursts.
- **Mitigations:** App Check enrolled (Phase 7); reCAPTCHA Enterprise binds clients to legitimate app instances; `rateLimitOk(uid)` predicate caps writes at 30/60s/uid; Sentry `fingerprintRateLimit()` 10 events / fingerprint / 60s; GCP budget alerts at 50 / 80 / 100% thresholds (£100 GBP default; `BUDGET_AMOUNT` / `BUDGET_CURRENCY` env overrides); Sentry 70% quota alert; Cloud Functions concurrency + max-instances pinned per function.
- **Evidence:** `firestore.rules` `rateLimitOk`; `src/observability/sentry.js`; `scripts/setup-budget-alerts/run.js`; `scripts/setup-uptime-check/run.js`; `runbooks/phase-9-monitors-bootstrap.md`; `SECURITY.md` § App Check + § Rate Limiting + § Out-of-band Monitors.

### T5. Supply-chain compromise

- **Threat:** Compromised npm package or GitHub Action injects malicious code (Shai-Hulud-class), exfiltrates secrets, or back-doors the build artefact (e.g., source-map leak with embedded keys).
- **Mitigations:** Pinned versions (no `^` / `~`); `package-lock.json` committed; `npm ci` in CI verifies integrity hashes; Dependabot weekly; Socket.dev install-time behavioural detection; OSV-Scanner in CI; gitleaks pre-commit + CI; all third-party Actions pinned to commit SHA; OIDC for Firebase auth (no long-lived service-account JSON); `@sentry/vite-plugin` `filesToDeleteAfterUpload` plus CI second-layer `Assert no .map files` step (Pitfall 6 two-layer defence).
- **Evidence:** `package.json` + `package-lock.json`; `.github/workflows/ci.yml`; `.gitleaks.toml`; `runbooks/socket-bootstrap.md`; `SECURITY.md` § Build & Supply Chain + § Dependency Monitoring + § Secret Scanning + § Rotation Schedule.

### T6. Insider misuse

- **Threat:** Internal user (Luke / George) reads or modifies client data outside an engagement scope, or removes audit trail to cover unauthorised access.
- **Mitigations:** Audit log written from Cloud Functions only (`auditLog` rules `allow write: if false` for clients); audited user cannot read their own entries (Pitfall 17 carve-out); BigQuery 7-year archive sink (tamper-evident); 4 anomaly rules in `authAnomalyAlert` (auth-fail burst + MFA disenrol + role escalation + unusual-hour GDPR export) post to Slack `#ops`; soft-delete + 30-day restore + Cloud Storage object versioning (90 days) protect against both accidental and malicious deletion; GDPR export / erase callables are audit-logged and subject to anomaly alerting.
- **Evidence:** `functions/src/audit/auditWrite.ts`; `firestore.rules` `auditLog/{eventId}` block; `functions/src/observability/authAnomalyAlert.ts`; Phase 8 `softDelete` callables; `SECURITY.md` § Audit Log Infrastructure + § Anomaly Alerting + § Data Lifecycle (Soft-Delete + Purge) + § Backups + DR + PITR + Storage Versioning.

## Defence in depth summary

| Layer | Control |
|-------|---------|
| Network | HTTPS-only (Firebase Hosting managed certs); HSTS preload submission filed (subdomain-only); COOP / COEP / CORP headers per `SECURITY.md` § HTTP Security Headers |
| Application | CSP enforced (per-directive matrix at `SECURITY.md` § Content Security Policy (enforced)); App Check + reCAPTCHA Enterprise; custom claims set server-side via `beforeUserCreated` |
| Data | Firestore Rules orgId-scoped + Storage Rules orgId-scoped; soft-delete + 30-day restore window; Cloud Storage object versioning 90 days; PITR 7-day rolling window |
| Operational | Audit log (Firestore + BigQuery 7y archive); 4-rule anomaly alerting to Slack `#ops`; GCP budget alerts 50/80/100%; Sentry 70% quota alert; uptime checks USA + EUROPE + ASIA_PACIFIC |
| Supply chain | Pinned dependencies; `npm ci` integrity; Dependabot + Socket.dev + OSV-Scanner; gitleaks pre-commit + CI; OIDC-federated GitHub Actions (no long-lived JSON); third-party Actions pinned to commit SHA |
| Compliance | Per-phase `SECURITY.md` increment; this threat model (DOC-03); `docs/CONTROL_MATRIX.md` (DOC-04); `PRIVACY.md` (DOC-02); `docs/DATA_FLOW.md` (DOC-07); `docs/RETENTION.md`; `.well-known/security.txt` (RFC 9116) |

---

**Source artefacts:** Per-phase plan `<threat_model>` blocks under `.planning/phases/{NN}/{NN-XX}-PLAN.md` are the granular substrate (T-N-NN-NN row IDs map each plan-level threat to a disposition + mitigation pointer); this document is the auditor-facing synthesis. Cross-references in each Evidence block point to `SECURITY.md` sections where implementation details live.
