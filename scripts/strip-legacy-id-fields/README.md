# scripts/strip-legacy-id-fields

Phase 6 Wave 6 (D-17): closes the Phase 5 D-21 cleanup-ledger carry-forward row by deleting the now-unused `legacyAppUserId` and `legacyAuthorId` fields from existing migrated Firestore docs.

## Why

Phase 5 DATA-02 retained `legacyAppUserId` on `users/{firebaseUid}` docs and `legacyAuthorId` on per-doc records under `orgs/{orgId}/{responses,comments,actions,messages}/` — both as backfill mapping during the subcollection migration. Phase 6 Wave 5 cutover keyed users by `firebaseUid` (the Auth-issued UID); the legacy mapping fields are now unused.

This script scrubs them. The cleanup-ledger row "Phase 6 (AUTH-15) deletes inline legacyAppUserId/legacyAuthorId fields after backfill" closes when this script ships (substrate is in place); operator runs at their convenience post-cutover.

## Prerequisites

- `gcloud auth application-default login` completed (Pitfall 13).
- Operator's gcloud account has `Cloud Datastore User` role on `bedeveloped-base-layers`.
- Phase 6 Wave 5 cutover complete (verified via `06-PREFLIGHT.md ## Cutover Log: cutover_complete: yes`).

## Usage

Dry run (no writes):

```sh
cd functions && node ../scripts/strip-legacy-id-fields/run.js --dry-run
```

Real run:

```sh
cd functions && node ../scripts/strip-legacy-id-fields/run.js
```

## Expected outcome

For each of these collection groups: `responses`, `comments`, `actions`, `messages`, plus the `users` collection — the script reads every doc, removes `legacyAppUserId` and/or `legacyAuthorId` if present, leaves docs unchanged otherwise.

The script is idempotent: re-running on already-clean data prints `skipped=N` for every doc; no-op writes do not occur.

## Pitfall 10 considerations

- Backups: ensure the most recent Phase 8 `scheduledPurge` snapshot exists before running real-mode (Phase 8 is not yet shipped — currently any Phase 6 export is operator-paced via `gcloud firestore export`).
- ID re-keying: the script does NOT re-key documents — it only deletes fields. The doc ID + parent path are unchanged.
