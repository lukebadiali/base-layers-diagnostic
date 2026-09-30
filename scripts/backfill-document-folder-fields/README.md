# scripts/backfill-document-folder-fields

Milestone v6 (DOC-02 / DOC-05). Adds `folderId: null` and `deletedAt: null` to
document metadata rows under `orgs/{orgId}/documents/{docId}` that predate the
folder tree.

## Why this is not optional

The v6 documents listener queries with `where("deletedAt", "==", null)`.

It has to. Firestore does not filter a `list` against a rule that reads
`resource.data` — it refuses the whole query unless the query itself guarantees
every match passes the read rule. The documents read rule is
`inOrg(orgId) && notDeleted(resource.data)`, so an unconstrained query over a
collection holding a single tombstoned file was failing for the whole
collection. `tests/rules/folders.test.js` asserts both halves of this.

A Firestore equality filter on `null` matches documents whose field **is**
`null`. It does **not** match documents that lack the field. The pre-v6 upload
path never wrote `deletedAt`, so without this backfill every file uploaded
before v6 vanishes from the list — no error, no empty state, just a shorter
list than the client remembers.

`folderId: null` is cosmetic by comparison: `src/domain/folder-tree.js` already
treats a missing `folderId` as root. It is written so every row has the same
shape.

## Prerequisites

- `gcloud auth application-default login` completed (Pitfall 13).
- Operator's gcloud account has `Cloud Datastore User` on `bedeveloped-base-layers`.
- Run **before** deploying the v6 client, or files briefly disappear between the
  two. The rules change is backward compatible and can go first.

## Usage

Dry run (no writes):

```sh
node scripts/backfill-document-folder-fields/run.js --dry-run
```

Real run:

```sh
node scripts/backfill-document-folder-fields/run.js
```

Idempotent: a second run reports every row as already having both fields.
