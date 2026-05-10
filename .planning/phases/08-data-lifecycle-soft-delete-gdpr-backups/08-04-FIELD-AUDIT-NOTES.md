# 08-04 Task 0 — Documents-Collection Field Audit

**Date:** 2026-05-10
**Closes:** Assumption A1 from 08-RESEARCH.md

## Grep output (verbatim)

```
src/data/documents.js:18:// D-03 invariant: every doc carries `legacyAppUserId: meta.uploadedBy` so
src/data/documents.js:76:      legacyAppUserId: meta?.uploadedBy || null, // D-03 (placed after spread so meta cannot override)
src/main.js:3363:          uploaderId: user.id,
src/main.js:3452:          const canDelete = isInternal || d.uploaderId === user.id;
```

(Additional context from full src/ grep — no other matches for uploaderId/uploadedBy/legacyAppUserId in views/*.js)

## Per-collection findings

### Top-level `documents/{docId}` (legacy main.js path)

Author-attribution fields written: `uploaderId`

Evidence: src/main.js lines 3361–3373:
```javascript
await firestore.setDoc(firestore.doc(db, "documents", docId), {
  orgId: org.id,
  uploaderId: user.id,           // <-- the attribution field
  uploaderName: user.name || user.email,
  uploaderEmail: user.email,
  filename: validation.sanitisedName,
  ...
});
```
This write lands in the TOP-LEVEL `documents/{docId}` collection (NOT a subcollection).
The field is hardcoded from `user.id` at write time — it is a read/write field in the payload.

Line 3452 shows the read-side use: `const canDelete = isInternal || d.uploaderId === user.id;`
This confirms `uploaderId` is the canonical author-attribution field for the legacy path.

Note: `uploadedBy` is NOT written here. The top-level collection only uses `uploaderId`.

### Subcollection `orgs/{orgId}/documents/{docId}` (data/documents.js path)

Author-attribution fields written: `legacyAppUserId` (derived from `meta?.uploadedBy`)

Evidence: src/data/documents.js lines 63–82:
```javascript
export async function saveDocument(orgId, file, sanitisedName, meta = {}) {
  ...
  await setDoc(
    doc(db, "orgs", orgId, "documents", docId),
    {
      id: docId,
      orgId,
      name: sanitisedName,
      path,
      ...meta,                                           // meta may carry uploadedBy
      legacyAppUserId: meta?.uploadedBy || null,         // D-03: explicit field
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}
```

The `...meta` spread means if a caller passes `{ uploadedBy: "uid" }`, the subcollection
doc will have BOTH `uploadedBy` (from the spread) AND `legacyAppUserId` (from the explicit
assignment). However, the explicit assignment is placed AFTER the spread to prevent `meta`
from overriding it (per the comment).

The subcollection docs do NOT write `uploaderId` — that field is exclusive to the legacy
top-level collection.

`uploadedBy` only lands in subcollection docs if a caller explicitly passes it in `meta`.
Inspection of call sites in src/main.js shows no call to saveDocument in this codebase (the
Phase 5 subcollection path used `data/documents.js#saveDocument`; the legacy main.js upload
path wrote directly to the top-level collection). In the Phase 5+ path the meta parameter
is not populated with uploadedBy by any identified call site in src/.

## Canonical field list for Tasks 1 + 2

`DOCUMENT_AUTHOR_FIELDS = ["uploaderId", "uploadedBy", "legacyAppUserId"]`

Rationale for all three:
- `uploaderId` — exclusive to top-level `documents/{docId}` (legacy main.js path). Present
  and confirmed by grep.
- `legacyAppUserId` — written to subcollection `orgs/{orgId}/documents/{docId}` by
  data/documents.js (D-03 invariant). Present and confirmed by grep.
- `uploadedBy` — may appear in subcollection docs if `meta.uploadedBy` was supplied by a
  caller; also potentially present in historic docs written before D-03 was enforced.
  Including it in the query is defensive and correct per GDPR Art. 15 (include ALL
  user-linked data; false positives on the query side are preferable to false negatives).

## Assumption A1 closure

Assumption A1 from 08-RESEARCH.md stated: "`orgs/{orgId}/documents/{id}` has an `uploaderId`
field that must be tombstoned on erasure."

**Verification result:** A1 was partially correct but incomplete. The subcollection
`orgs/{orgId}/documents/{docId}` does NOT use `uploaderId` — it uses `legacyAppUserId`
(set from `meta?.uploadedBy`). The field `uploaderId` is exclusive to the LEGACY top-level
`documents/{docId}` collection written by main.js. Both collection paths must be queried
for a complete GDPR export and erasure cascade.

The three confirmed author-attribution fields across both collection paths are:
- `uploaderId` (top-level `documents/{docId}` — legacy main.js)
- `legacyAppUserId` (subcollection `orgs/{orgId}/documents/{docId}` — data/documents.js)
- `uploadedBy` (defensive inclusion — may appear in meta spread or historic docs)

Tasks 1 and 2 must query ALL THREE fields across BOTH the `documents` collectionGroup
(covering the subcollection) AND the top-level `documents` collection (covering the legacy
path) to ensure full GDPR Art. 15 coverage.
