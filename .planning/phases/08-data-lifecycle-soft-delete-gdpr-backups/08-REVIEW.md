---
phase: 08-data-lifecycle-soft-delete-gdpr-backups
reviewed: 2026-05-10T13:49:41Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - functions/src/backup/scheduledFirestoreExport.ts
  - functions/src/backup/getDocumentSignedUrl.ts
  - functions/src/lifecycle/resolveDocRef.ts
  - functions/src/lifecycle/softDelete.ts
  - functions/src/lifecycle/restoreSoftDeleted.ts
  - functions/src/lifecycle/scheduledPurge.ts
  - functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts
  - functions/src/gdpr/assembleUserBundle.ts
  - functions/src/gdpr/gdprExportUser.ts
  - functions/src/gdpr/pseudonymToken.ts
  - functions/src/gdpr/eraseCascade.ts
  - functions/src/gdpr/gdprEraseUser.ts
  - functions/src/index.ts
  - functions/test/_mocks/admin-sdk.ts
  - src/cloud/signed-url.js
  - src/cloud/soft-delete.js
  - src/cloud/gdpr.js
  - src/data/soft-deleted.js
  - src/data/messages.js
  - src/data/comments.js
  - src/data/actions.js
  - src/data/documents.js
  - src/data/funnel-comments.js
  - src/views/admin.js
  - scripts/post-erasure-audit/run.js
  - firestore.rules
findings:
  critical: 0
  high: 2
  medium: 2
  low: 3
  total: 7
status: findings_present
---

# Phase 8: Code Review Report

**Reviewed:** 2026-05-10T13:49:41Z
**Depth:** standard
**Files Reviewed:** 25 (including firestore.rules)
**Status:** findings_present

## Summary

Phase 8 ships 8 new Cloud Functions (backup export, signed URL, 4 lifecycle callables, 2 GDPR callables), Firestore rules predicate updates, browser-side seams, and an operator audit script. The overall security posture is strong: Pattern A is consistently applied across all callables (enforceAppCheck, Zod validation, Pitfall 17 actor-from-token, ensureIdempotent, withSentry), signed URL TTLs are pinned constants, the tombstone strategy is deterministic and idempotent, and audit logs correctly tombstone PII in-place rather than deleting.

Two high-severity issues require attention before the Wave 6 operator deploy:

1. **`resolveDocRef.ts` has `"org"` where the design requires `"action"`** — `actions` are listed as a soft-deletable type in all planning documents and the data wrapper (`src/data/actions.js`) has the `where("deletedAt", "==", null)` conjunct added, but the type enum and path resolver include `"org"` instead of `"action"`. This means actions cannot be soft-deleted through any lifecycle callable, and `scheduledPurge` iterates `softDeleted/org/items` (which will always be empty) while never touching `softDeleted/action/items`.

2. **`scripts/post-erasure-audit/run.js` audit-log check always emits FAIL** — Both branches of the `if (untombstoned.length === 0)` conditional at lines 184–200 produce identical FAIL output. When `untombstoned.length === 0`, it means erasure succeeded (all matched docs are tombstoned), but the script reports FAIL instead of PASS. This makes the GDPR-03 audit evidence script unreliable as a pass/fail gate.

---

## High Issues

### H-01: `resolveDocRef.ts` — `"action"` missing from SOFT_DELETABLE_TYPES; `"org"` included instead

**File:** `functions/src/lifecycle/resolveDocRef.ts:6-9`

**Issue:** The type union and the `SOFT_DELETABLE_TYPES` array contain `"org"` and exclude `"action"`. The 08-03-SUMMARY decision record explicitly states the 5 types are `comment, message, action, document, funnelComment`. The firestore.rules `notDeleted` predicate was added to the `actions` subcollection (line 80) and `src/data/actions.js` has the `where("deletedAt", "==", null)` client conjunct applied. However, no lifecycle callable (softDelete, restoreSoftDeleted, permanentlyDeleteSoftDeleted) can accept `type: "action"` because Zod rejects it via `z.enum(SOFT_DELETABLE_TYPES)`.

Downstream effects:
- `scheduledPurge` loops over `SOFT_DELETABLE_TYPES` and queries `softDeleted/org/items` (always empty) while skipping `softDeleted/action/items` entirely — expired soft-deleted actions are never purged.
- `src/data/soft-deleted.js` also uses `SOFT_DELETABLE_TYPES` directly and lists `"org"` items instead of `"action"` items in the admin UI.
- `resolveDocPath` case `"org"` resolves to `orgs/${input.id}` — if an org were soft-deleted, the tombstone writes to the org's own doc rather than `orgs/{orgId}/{type}/{id}`, which is also structurally wrong for `softDeleted/{type}/items/{id}` snapshot semantics.

**Fix:**
```typescript
// functions/src/lifecycle/resolveDocRef.ts — replace "org" with "action"

export type SoftDeletableType = "action" | "comment" | "document" | "message" | "funnelComment";
export const SOFT_DELETABLE_TYPES: readonly SoftDeletableType[] = [
  "action", "comment", "document", "message", "funnelComment",
] as const;

export function resolveDocPath(input: { type: SoftDeletableType; orgId: string; id: string }): string {
  switch (input.type) {
    case "action":       return `orgs/${input.orgId}/actions/${input.id}`;
    case "comment":      return `orgs/${input.orgId}/comments/${input.id}`;
    case "document":     return `orgs/${input.orgId}/documents/${input.id}`;
    case "message":      return `orgs/${input.orgId}/messages/${input.id}`;
    case "funnelComment": return `funnelComments/${input.id}`;
    default: {
      const _exhaustive: never = input.type;
      throw new RangeError(`Unknown type: ${_exhaustive}`);
    }
  }
}
```

Also update `src/data/soft-deleted.js` line 15 and `src/cloud/soft-delete.js` JSDoc type comments to replace `"org"` with `"action"`.

---

### H-02: `scripts/post-erasure-audit/run.js` — audit-log check always emits FAIL regardless of erasure success

**File:** `scripts/post-erasure-audit/run.js:183-200`

**Issue:** The conditional at line 184 computes `untombstoned` (docs where `actor.uid` is NOT a tombstone token) and then branches on `untombstoned.length === 0`. Both the `if` branch (length === 0, meaning ALL docs are tombstoned — erasure succeeded) and the `else` branch print identical FAIL output. When erasure has correctly tombstoned all audit log entries, this check reports FAIL instead of PASS. The GDPR-03 evidence output is therefore always wrong for the audit-log step.

Note: after erasure, the query `where("actor.uid", "==", uid)` may actually return zero results (because the value was replaced by the tombstone token), so the outer `if (snap.empty)` block would handle the common success case. However, if any docs still exist in the result set (e.g., because the `actor.uid` field stores the raw uid in the index but the tombstone was applied — this depends on Firestore index update timing), the branch logic is inverted.

**Fix:**
```javascript
// scripts/post-erasure-audit/run.js — lines 183-200, replace with:
const untombstoned = snap.docs.filter((d) => !isTombstoneToken(d.data()?.actor?.uid));
if (untombstoned.length === 0) {
  // All matched docs have been tombstoned — erasure succeeded on this collection.
  printRow("auditLog (about user)", "PASS", `${snap.size} docs tombstoned correctly`);
} else {
  printRow("auditLog (about user)", "FAIL", `${untombstoned.length} of ${snap.size} docs still reference raw uid`);
  allPass = false;
  failures.push({
    check: "auditLog (about user)",
    reason: `${untombstoned.length} untombstoned audit docs`,
  });
}
```

---

## Medium Issues

### M-01: `gdprEraseUser.ts` — tombstone token returned to caller in response body

**File:** `functions/src/gdpr/gdprEraseUser.ts:298`

**Issue:** The callable returns `{ ok: true, tombstoneToken: tombstone, counts }`. The tombstone token is a deterministic sha256 derivative of `(uid + GDPR_PSEUDONYM_SECRET)`. Returning it in the callable response means it is transmitted over the Firebase Functions wire, stored in the client SDK's in-memory state, and visible in network inspector tools for any admin who triggers erasure. The token's determinism means it can be used to re-identify a tombstoned record if an attacker obtains both the token and the secret (or can correlate token values across users).

The token is already recorded in `redactionList/{userId}` (admin-only read) and in the compliance audit event — callers have no operational need for it in the response. The `src/cloud/gdpr.js` browser seam types the return as `{ ok: true, tombstoneToken: string, counts: Record<string, number> }`, meaning the UI receives the token.

**Fix:**
```typescript
// functions/src/gdpr/gdprEraseUser.ts — line 298, remove tombstoneToken from response
return { ok: true, counts };

// functions/src/gdpr/gdprEraseUser.ts — also update the return type JSDoc comment above

// src/cloud/gdpr.js — update JSDoc return type:
// @returns {Promise<{ ok: true, counts: Record<string, number> }>}
```

---

### M-02: `gdprEraseUser.ts` — `legacyAuthorId` field on messages/comments queried by `authorId` only; erasure may miss `legacyAuthorId`-only records

**File:** `functions/src/gdpr/gdprEraseUser.ts:103-104`, `functions/src/gdpr/eraseCascade.ts:84-99`

**Issue:** The erasure pre-fetch queries `collectionGroup("messages").where("authorId", "==", userId)` and `collectionGroup("comments").where("authorId", "==", userId)`. The D-03 invariant writes `legacyAuthorId: uid` to every new message/comment, and `eraseCascade.ts` correctly tombstones both `authorId` and `legacyAuthorId` on matched records. However, historic pre-D-03 records (if any) may have `legacyAuthorId: uid` but no `authorId` field (or a different value). Those records would not appear in the query and would not be tombstoned.

The `gdprExportUser` call uses the same query shape, creating a symmetric gap: such records would be missing from the export bundle as well.

This is a residual PII risk for pre-D-03 legacy data. The project states "no live users" and "clean cutover migrations are acceptable," which reduces the practical risk, but the gap means the post-erasure audit script would not catch these records either (it also queries by `authorId`).

**Fix:** Add a parallel query for `legacyAuthorId` and merge the results (same pattern used for DOCUMENT_AUTHOR_FIELDS):
```typescript
// functions/src/gdpr/gdprEraseUser.ts — add alongside the messages/comments queries:
db.collectionGroup("messages").where("legacyAuthorId", "==", userId).get(),
db.collectionGroup("comments").where("legacyAuthorId", "==", userId).get(),
```
Then merge de-duped results by path before passing to `buildCascadeOps`. Apply the same fix to `gdprExportUser.ts` for export completeness.

If the project can confirm no pre-D-03 records exist (i.e., a data migration was run that backfilled `authorId` for all legacy records), this can be downgraded to Info.

---

## Low Issues

### L-01: `restoreSoftDeleted.ts` — restore does not verify the live doc still exists before batch-updating it

**File:** `functions/src/lifecycle/restoreSoftDeleted.ts:56-69`

**Issue:** The function reads the snapshot ref to confirm the soft-deleted record exists, then batch-updates the live ref (`liveRef`) without first checking whether the live doc exists. If the live doc was hard-deleted after soft-delete (e.g., by a separate admin action or a `scheduledPurge` bug), `batch.update(liveRef, {...})` on a non-existent document will throw a Firestore `NOT_FOUND` error that propagates as an internal error to the caller rather than a clean `not-found` HttpsError. The snapshot (`snapRef`) is correctly checked for existence; the live ref is not.

**Fix:**
```typescript
// functions/src/lifecycle/restoreSoftDeleted.ts — after line 59, add:
const liveSnap = await liveRef.get();
// If the live doc no longer exists (edge case: hard-deleted after soft-delete),
// still delete the snapshot so state is consistent, but return a warning.
if (!liveSnap.exists) {
  await db.batch().delete(snapRef).commit();
  throw new HttpsError("not-found", "Live document no longer exists; snapshot cleaned up");
}
```

---

### L-02: `gdpr.js` (browser seam) — double import of `../firebase/functions.js`

**File:** `src/cloud/gdpr.js:11-12`

**Issue:** Lines 11 and 12 are two separate named imports from the same module:
```javascript
import { httpsCallable } from "../firebase/functions.js";
import { functions } from "../firebase/functions.js";
```
This is redundant — both can be a single import. Vite deduplicates module loads so there is no runtime error, but it is a code quality issue and may confuse future maintainers into thinking two distinct modules are involved.

**Fix:**
```javascript
import { httpsCallable, functions } from "../firebase/functions.js";
```

---

### L-03: `src/views/admin.js` — `window.confirm()` used for destructive-action guard

**File:** `src/views/admin.js:93-97`

**Issue:** The "Permanently delete now" button uses `window.confirm()` as a guard. This is noted in the project conventions as a CODE-07 concern (`alert()` sites); `window.confirm()` has the same accessibility and UX problems — it cannot be styled, blocks the main thread, and is suppressed by some browser automation frameworks. This is consistent with the existing `window.confirm()` used in Phase 8 per plan, but flagging for awareness against CODE-07 scope which explicitly targets `alert()`/`confirm()` replacement.

The CLAUDE.md `CODE-07` convention notes `alert()` replacement; the plan explicitly chose `window.confirm()` for this guard as an MVP approach. This is flagged as low because the plan was aware of it.

**Fix (post-Phase-8):** Replace with the `modal.js` confirmation pattern used elsewhere in the codebase, or a dedicated `confirmDialog(message)` helper that returns a Promise and uses the existing `h()` DOM factory for a styled overlay.

---

## Notes

**admin-sdk.ts mock coverage:** The batch mock (lines 349-378) does a flat-merge for `update` operations (`{ ...cur, ...data }`). This means dotted-key patches like `{ "actor.uid": token }` are stored as flat string keys rather than nested paths. The SUMMARY documents this as a known test adaptation (both `ev1["actor.uid"]` and `ev1.actor.uid` paths checked in assertions). This is not a production bug but means the unit tests do not exercise dotted-key merge semantics — if `gdprEraseUser` passes this in production and the Firestore Admin SDK interprets dotted keys differently from what the mock simulates, PII tombstoning of audit events could silently fail. This is low risk given Firestore Admin SDK's well-documented dotted-field-path semantics, but worth noting.

**`scheduledFirestoreExport.ts` error logging:** Line 54 logs `err: (err as Error).message ?? String(err)` — the `??` operator means if `.message` is an empty string, it falls through to `String(err)`. This is intentional defensive coding and not a bug.

**Signed URL TTL bounds:** `getDocumentSignedUrl` uses 1h TTL (line 41) and `gdprExportUser` uses 24h TTL (line 53) — both are correctly pinned constants with no caller-supplied override. T-08-02-07 and T-08-04-01 (URL never logged) are both implemented correctly.

---

_Reviewed: 2026-05-10T13:49:41Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
