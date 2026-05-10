# Post-Erasure Audit Script

**Phase 8 Wave 4 — GDPR-03 evidence script**

Verifies that `gdprEraseUser` successfully tombstoned every reference to a user
across all denormalised collections. Exits 0 (PASS) if zero residual PII is found;
exits 1 (FAIL) with paths if any non-tombstoned field remains.

## Prerequisites

1. **Java 11+** is not required — this is a Node.js script, not a Firebase emulator command.
2. **Application Default Credentials (ADC):**
   ```bash
   gcloud auth application-default login
   ```
3. **`firebase-admin` available** — already present in the repo root `node_modules/`
   (hoisted from `functions/`). If not, run from the repo root:
   ```bash
   npm install firebase-admin@13.8.0
   ```

## Usage

```bash
# Basic (uses default project: bedeveloped-base-layers)
node scripts/post-erasure-audit/run.js --uid=<userId>

# Override project
node scripts/post-erasure-audit/run.js --uid=<userId> --project=<projectId>

# Help
node scripts/post-erasure-audit/run.js --help
```

## Expected output (PASS)

```
USER ERASURE AUDIT — uid=LQpdqpWqcgVLIE59ln3x8RMf5Mk1  project=bedeveloped-base-layers
────────────────────────────────────────────────────────
users/{uid}                       PASS   email=null, name=null, erasedTo=deleted-user-14461cc2e6f67959
auditLog (about user)             PASS   0 docs (none reference raw uid)
messages.authorId == uid          PASS   0 hits
comments.authorId == uid          PASS   0 hits
actions.ownerId == uid            PASS   0 hits
documents.uploaderId (subcoll)    PASS   0 hits
documents.uploaderId (legacy)     PASS   0 hits
documents.uploadedBy (subcoll)    PASS   0 hits
documents.uploadedBy (legacy)     PASS   0 hits
documents.legacyAppUserId (sub.)  PASS   0 hits
documents.legacyAppUserId (leg.)  PASS   0 hits
funnelComments.authorId           PASS   0 hits
redactionList/{uid}               PASS   exists, tombstoneToken=deleted-user-14461cc2e6f67959
Auth user.disabled                PASS   true
────────────────────────────────────────────────────────
RESULT: PASS (zero residual PII)
```

## Troubleshooting

### FAIL — residual paths listed

Re-run `gdprEraseUser` with the same `userId`. The deterministic token guarantees
an idempotent re-cascade — the same tombstone token will be written to every
collection, regardless of how many times the function runs.

Use a fresh `clientReqId` (UUID) for the re-run (the 5-minute idempotency window
deduplicates on `clientReqId`, not on the overall erasure operation).

### FAIL — redactionList/{uid} not found

`gdprEraseUser` did not complete. Check Cloud Functions logs for errors.
Ensure `GDPR_PSEUDONYM_SECRET` is set in Firebase Secret Manager.

### FAIL — Auth user.disabled = false

The Auth disable step may have been skipped due to a user-not-found error.
Check Cloud Functions logs for `compliance.erase.auth.user_not_found` warnings.
If the Auth user still exists, manually disable via:
```bash
firebase auth:update <userId> --disabled --project=bedeveloped-base-layers
```

## Notes

- This script is **read-only** — it performs no mutations.
- GDPR Art. 17 requirement: run this script after every erasure invocation and
  retain the PASS output as evidence in the compliance pack (Phase 11).
- The `auditLog` check looks for raw `uid` references; post-erasure audit entries
  should have `actor.uid` replaced with the tombstone token (Pitfall 11 / GDPR
  Art. 6(1)(f) legitimate interest — the audit record is preserved, PII redacted).
