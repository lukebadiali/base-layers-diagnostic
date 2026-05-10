# Privacy — Base Layers Diagnostic

**Last updated:** 2026-05-10
**Maintained by:** BeDeveloped (security@bedeveloped.com)
**Related documents:** SECURITY.md, docs/RETENTION.md, docs/CONTROL_MATRIX.md
**Verification audit trail:** `.planning/phases/11-documentation-pack-evidence-pack/11-02-VERIFICATION-LOG.md`

This document describes how Base Layers Diagnostic processes personal data, who acts as a sub-processor, where the data lives, and how data subjects exercise their rights under GDPR. Every region claim is either **VERIFIED** with a citation or annotated **PENDING-OPERATOR** / **ASSUMED-PER-A3** with the resolution path.

---

## 1. Data we process

The application processes three classes of personal and operational data:

- **Client diagnostic data.** Pillar responses, comments, uploaded documents, chat messages, action items, plan and roadmap entries, and funnel KPIs entered by consultants and client-side participants during a Base Layers engagement. Each record is scoped to a single `orgId` and an authenticated `uid`.
- **User account data.** Email addresses, custom claims (`role`, `orgId`), MFA enrolment metadata (TOTP factor identifiers; no shared secrets in repo), and Firebase Auth-managed identifiers. No passwords are stored by BeDeveloped — Identity Platform owns the credential surface.
- **Operational data.** Audit-log entries, rate-limit counters, and authentication-failure counters keyed by IP-hash (`SHA-256(ip + GDPR_PSEUDONYM_SECRET)`) per Phase 9 OBS-08. Audit-log entries record `who / what / when / where (orgId)` for every privileged write; clients cannot read their own audit entries (Pitfall 17).

No payment-card data, special-category personal data per GDPR Art. 9, or biometric data is processed.

---

## 2. Sub-processors

| Sub-processor | Purpose | Data accessed | Region | DPA / SCCs |
|---------------|---------|---------------|--------|------------|
| Google LLC (Firebase / GCP) | Hosting, Auth, Firestore, Storage, Cloud Functions, App Check, Identity Platform | All client + user + operational data | Firestore + Cloud Functions: `europe-west2` (UK) — verified 2026-05-08T20:30:00Z via `gcloud firestore databases describe`, see `.planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md` line 37. Cloud Storage: **PENDING-OPERATOR** — operator gcloud verification queued (see `## 3` footer). Identity Platform / Auth: **ASSUMED-PER-A3** — EU multi-region default; Firebase Console verification queued. | Cloud Data Processing Addendum: https://cloud.google.com/terms/data-processing-addendum — incorporates Standard Contractual Clauses (SCCs) for transfers outside the EU/UK. Firebase-specific terms: https://firebase.google.com/terms/data-processing-terms |
| Functional Software, Inc. (Sentry) | Error reporting + source-map upload for browser + Cloud-Functions runtime errors | Error stack traces with PII scrubbed at the SDK boundary via the shared `PII_KEYS` dictionary (parity test gates browser/node drift per OBS-04) | EU — `*.ingest.de.sentry.io` (verified `vite.config.js:36` carries `url: "https://de.sentry.io/"`; `src/observability/sentry.js:9` documents DSN form `*.ingest.de.sentry.io`) | Sentry DPA: https://sentry.io/legal/dpa/ — incorporates SCCs; Schrems II EU residency confirmed by sub-domain selection at project creation |

**Not a sub-processor (post-Phase-4).** Google Fonts. Inter and Bebas Neue (both OFL-licensed) are self-hosted under `assets/fonts/` per Phase 4 Wave 1 (see SECURITY.md § Build & Supply Chain). Verified 2026-05-10:

- Live-site grep returned zero hits: `curl -s https://baselayers.bedeveloped.com | grep -ci "fonts.googleapis.com|fonts.gstatic.com"` — output `0`.
- Source-tree grep returned zero hits: `grep -rn "fonts.googleapis.com|fonts.gstatic.com" src/ index.html public/ firebase.json` — no output.
- The CSP `font-src 'self' data:` allowlist (`firebase.json` line 22) carries no Google Fonts host.

Sub-processor list maintenance is queued for quarterly review in `runbooks/phase-11-cleanup-ledger.md` (substrate authored Wave 6).

---

## 3. Data residency

Customer data is processed and stored in the United Kingdom and European Union:

- **Firestore** database `(default)` for project `bedeveloped-base-layers` is `europe-west2 / FIRESTORE_NATIVE` (London). **VERIFIED 2026-05-08T20:30:00Z** via `gcloud firestore databases describe --database="(default)" --project=bedeveloped-base-layers`. Source: `.planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md` line 37.
- **Cloud Functions** are deployed and co-located in `europe-west2` (Phase 6 D-09 region-pinning decision; Phase 6/7/8/9 functions all carry `region: "europe-west2"` in source).
- **Cloud Storage** bucket `bedeveloped-base-layers.firebasestorage.app` — **PENDING-OPERATOR** verification. Non-interactive `gcloud storage buckets describe` failed across all three available accounts in the executor environment (see `.planning/phases/11-documentation-pack-evidence-pack/11-02-VERIFICATION-LOG.md` § A1). Operator command queued:

  ```bash
  gcloud auth login   # interactive, on operator terminal
  gcloud storage buckets describe gs://bedeveloped-base-layers.firebasestorage.app \
    --format="value(location,locationType,storageClass)" \
    --project=bedeveloped-base-layers
  ```

  Update this section once captured. Forward-tracking row `F-DOC-02-A1` is queued in the Phase 11 cleanup ledger.

- **Identity Platform / Firebase Auth** — **ASSUMED-PER-A3**. Identity Platform region is not exposed by a non-interactive gcloud command in the executor environment (`gcloud identity-platform` is not in the root namespace; `alpha` component install is interactive-only — see verification log § A3). Firebase Console verification path:

  `https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/settings`

  Forward-tracking row `F-DOC-02-A3` is queued for the same operator session that resolves A1.
- **Cloud Logging** retention follows function region — logs for `europe-west2` functions stay in `europe-west2`.
- **Sentry** events are ingested at `*.ingest.de.sentry.io` (EU). See § 2.

Verification audit trail: `.planning/phases/11-documentation-pack-evidence-pack/11-02-VERIFICATION-LOG.md`.

---

## 4. Retention

See `docs/RETENTION.md` for the full per-data-class retention manifest. Summary:

- **Org and user data.** Retained while engagement active. Soft-deleted on deletion request with a 30-day restore window. Permanently deleted on Phase 8 `permanentlyDeleteSoftDeleted` callable invocation, or on `gdprEraseUser` Art. 17 invocation.
- **Audit log.** 12 months hot in Firestore + 7 years archive in BigQuery (Phase 7 § Audit Log Infrastructure).
- **Firestore export backups.** Standard storage class → Nearline at 30 days → Archive at 365 days (Phase 8 § Backups).
- **Cloud Storage object versions.** Retained 90 days post-deletion (Phase 8 § Storage Versioning).

---

## 5. Data subject rights (GDPR Art. 15 + Art. 17 + Art. 21)

- **Art. 15 — Right of access.** The `gdprExportUser` callable (Phase 8 GDPR-01) assembles a JSON bundle across the seven user-linked collection paths and returns a Cloud-Storage V4 signed URL with a 24-hour TTL. Server entry point: `functions/src/gdpr/exportUser.ts`. Client wrapper: `src/cloud/gdpr.js` `exportUser`.
- **Art. 17 — Right to erasure.** The `gdprEraseUser` callable (Phase 8 GDPR-02) cascades deletion across all user-linked collections and writes a tombstone marker for consistent-token replay. Audit-log retention is preserved per Pitfall 11 (regulatory-evidence carve-out). Server entry point: `functions/src/gdpr/eraseUser.ts`. Client wrapper: `src/cloud/gdpr.js`.
- **Art. 21 — Right to object.** Handled out-of-band via `security@bedeveloped.com`; not currently exposed as a callable.

**Response SLA:** 30 days from receipt of a verified request, per GDPR Art. 12(3). One-time 60-day extension available where the request is complex or numerous, with reasoned communication to the data subject within the initial 30 days.

Cross-references: SECURITY.md § GDPR (Export + Erasure); REQUIREMENTS.md GDPR-01 + GDPR-02.

---

## 6. International transfers

Customer data does not leave the UK / EU under normal operation. Specifically:

- Firestore + Cloud Functions: `europe-west2` (UK) — see § 3.
- Cloud Storage: residency **PENDING-OPERATOR** verification (see § 3); recommended `europe-west2` per project configuration pattern. PRIVACY.md is updated inline once the gcloud verification lands.
- Identity Platform / Firebase Auth: EU multi-region default (**ASSUMED-PER-A3** — Firebase Console verification queued).
- Sentry telemetry: EU only (`*.ingest.de.sentry.io`). Stack traces are PII-scrubbed at the SDK boundary via the shared `PII_KEYS` dictionary; a parity test gates drift between the browser SDK and the node Cloud-Functions SDK (OBS-04).

Where transfers to third-country sub-processors do occur (e.g. Google support staff outside the UK / EU under the Cloud DPA), Standard Contractual Clauses (SCCs) are incorporated by reference into the underlying Data Processing Addendum signed with each sub-processor (see § 2 DPA URLs). No additional Schrems II-specific addendum is held; sub-processor EU-residency selections plus standard DPA SCC incorporation are the basis for the transfer posture.

---

## 7. Contact

For GDPR data-subject requests (access / erasure / objection / rectification / restriction) and privacy enquiries:

`security@bedeveloped.com`

Response within 30 days per GDPR Art. 12(3). Public security disclosure protocol is documented separately in SECURITY.md § Vulnerability Disclosure Policy and at `/.well-known/security.txt` (RFC 9116 — Wave 5).
