# scripts/provision-function-sas

Phase 7 Wave 1 (FN-04 / Pitfall 13 / Pattern E): one-shot Admin-SDK ADC script
that provisions the 6 minimal-IAM service accounts each Cloud Function runs
under, per `.planning/phases/07-cloud-functions-app-check-trusted-server-layer/07-RESEARCH.md`
Pattern 7 inventory.

## Why per-function service accounts

- **Pitfall 13** — the default `<project>@appspot.gserviceaccount.com` Compute
  Engine SA holds `roles/editor` (project-wide read/write). A Cloud Function
  compromise running under the default SA escalates to project-wide blast
  radius. Per-function SAs cap each function at its actual privilege need.
- **FN-04** — Phase 7 success criterion 1: every callable + trigger runs as
  its own minimal-IAM service account.
- **SOC2 CC6.1 / ISO 27001 A.5.18** — least-privilege principle for service
  identities; auditable mapping from function to SA to role.

## SA inventory

| Service Account | Roles | Used By |
|----|----|----|
| `audit-writer-sa@bedeveloped-base-layers.iam.gserviceaccount.com` | `roles/datastore.user` | `auditWrite` callable (Wave 2) |
| `audit-mirror-sa@...` | `roles/datastore.user`, `roles/eventarc.eventReceiver` | `onOrgDelete`, `onUserDelete`, `onDocumentDelete` triggers (Wave 2) |
| `claims-admin-sa@...` | `roles/firebaseauth.admin`, `roles/datastore.user` | `setClaims` callable (Phase 6 hardened in Wave 1) |
| `auth-blocking-sa@...` | `roles/firebaseauth.viewer`, `roles/datastore.viewer` | `beforeUserCreatedHandler`, `beforeUserSignedInHandler` (D-22 ToS gate — Wave 5) |
| `ratelimit-sa@...` | `roles/datastore.user` | token-bucket fallback callable (Wave 4) |
| `csp-sink-sa@...` | `roles/logging.logWriter` | `cspReportSink` HTTPS function (re-deploy in Wave 5) |

## Prerequisites

1. Google Cloud SDK (`gcloud`) installed and on `PATH`.
2. ADC credentials initialised:

   ```bash
   gcloud auth application-default login
   ```

3. The operator's user account must hold `roles/iam.serviceAccountAdmin` and
   `roles/resourcemanager.projectIamAdmin` on the project (or equivalent custom
   roles) to create SAs and bind project-level IAM roles.

## Usage

```bash
# default project (bedeveloped-base-layers)
node scripts/provision-function-sas/run.js

# dry-run — diffs target vs current state and prints planned actions; no mutations
node scripts/provision-function-sas/run.js --dry-run

# different project
node scripts/provision-function-sas/run.js --project=bedeveloped-staging
```

## Idempotency semantics

Safe to re-run. On every invocation the script:

1. **Ensures each SA exists** — calls `gcloud iam service-accounts describe`;
   if missing, runs `gcloud iam service-accounts create`.
2. **Diffs current bindings vs target** — reads
   `gcloud projects get-iam-policy --flatten=bindings[].members --filter=bindings.members:serviceAccount:<email>`
   and compares the result set to the inventory roles above.
3. **Adds missing role bindings** —
   `gcloud projects add-iam-policy-binding --member=... --role=... --condition=None`
   (re-binding an existing role is a no-op at the gcloud layer).
4. **Removes extra role bindings (drift correction)** —
   `gcloud projects remove-iam-policy-binding ...` for any role bound to the SA
   that is **not** in the target inventory. Closes Pattern 7 "removes any
   extra roles".
5. **Prints a summary table** — one row per SA: `email | status | added | removed`.
6. **Exits 0 on success; exits 1 on any binding error.**

A clean re-run with no drift exits 0 with `(none)` in the added + removed
columns for every row.

## Operator cadence

| Phase 7 | Cadence | Trigger |
|----|----|----|
| Wave 1 | Once | Initial provisioning of all 6 SAs |
| Wave 5 | Once | Verify before `cspReportSink` redeploy + auth-blocking re-bind |
| Wave 6 | CI verification step | Gate in `.github/workflows/ci.yml` (deferred — out of scope for Wave 1) |

Quarterly drift audit recommended per Pitfall 13 review checklist.

## What this script does NOT do

- **Does NOT manage the Firebase Auth admin SA**
  (`service-<projectNumber>@gcp-sa-firebaseauth.iam.gserviceaccount.com`) —
  that is auto-provisioned when `firebaseauth.googleapis.com` is enabled and
  ToS accepted. See D-22 ToS gate in `.planning/phases/06-real-auth-mfa-rules-deploy/`
  follow-through and Wave 5 of this phase.
- **Does NOT bind IAM at the resource (Firestore document, GCS bucket,
  Logging sink) level** — only project-level IAM bindings are managed here.
  Firestore Security Rules cover the document-level boundary.
- **Does NOT deploy the Cloud Functions themselves** — that is Wave 2 + Wave 4
  + Wave 5 deliverable. The `serviceAccount: "..."` config inside each
  `onCall` / `onDocumentDeleted` declaration only takes effect after the
  function is deployed AND the SA exists. Run this script before the first
  deploy of a new function.
- **Does NOT use a JSON service-account key** — Pitfall 13. The script uses
  the operator's ADC token established by
  `gcloud auth application-default login`.

## Verification

After a real (non-`--dry-run`) execution, manually cross-check:

```bash
gcloud iam service-accounts list \
  --project=bedeveloped-base-layers \
  --format="value(email)" \
  | grep -E "(audit-writer|audit-mirror|claims-admin|auth-blocking|ratelimit|csp-sink)-sa@"
```

should return exactly 6 lines.

For each SA, list its bound roles:

```bash
SA=audit-writer-sa@bedeveloped-base-layers.iam.gserviceaccount.com
gcloud projects get-iam-policy bedeveloped-base-layers \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:$SA" \
  --format="value(bindings.role)"
```

should match the inventory above exactly (no extras, no missing roles).
