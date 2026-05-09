// Phase 7 Wave 1 (FN-03 / Pitfall 6): Admin-SDK idempotency-marker helper.
// Sharded by 2-char prefix to avoid hot-spots per Pitfall 6.
//
// Pattern C purity contract: this file IS the Admin-SDK side of the helper —
// pure-logic-only modules MUST NOT import from firebase-admin/*. The unit-test
// seam is the in-memory store override (_setStoreForTest + _resetForTest)
// pattern matching functions/src/csp/dedup.ts (_clearForTest).
//
// Phase 7 Wave 6 (TEST-09) adds firebase-functions-test integration coverage
// against the real Firestore-doc path; Wave 1 unit tests use the in-memory
// store to verify the 5-min TTL + sharding logic without emulator boot.

import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Test-only store seam — an in-memory map standing in for Firestore docs.
 * Production path resolves to a thin getFirestore().doc(...) wrapper.
 */
export interface IdempotencyStore {
  get(path: string): Promise<{ exists: boolean; atMillis: number | null }>;
  set(path: string, scope: string): Promise<void>;
}

const ADMIN_SDK_STORE: IdempotencyStore = {
  async get(path: string) {
    const ref = (getFirestore() as Firestore).doc(path);
    const snap = await ref.get();
    if (!snap.exists) return { exists: false, atMillis: null };
    const at = snap.get("at");
    const atMillis =
      at && typeof at.toMillis === "function" ? at.toMillis() : null;
    return { exists: true, atMillis };
  },
  async set(path: string, scope: string) {
    await (getFirestore() as Firestore).doc(path).set({
      scope,
      at: FieldValue.serverTimestamp(),
    });
  },
};

let store: IdempotencyStore = ADMIN_SDK_STORE;

/**
 * Compute the canonical Firestore doc path for an idempotency key.
 * Sharded by first 2 chars of key (padEnd to "0" so 1-char keys still shard).
 * Exported for cross-module assertion in tests.
 */
export function pathForKey(key: string): string {
  const shard = key.slice(0, 2).padEnd(2, "0");
  return `idempotency/${shard}/keys/${key}`;
}

/**
 * Ensure a callable is idempotent over a sliding window.
 * Throws HttpsError("already-exists") if the same key was seen within windowSec.
 */
export async function ensureIdempotent(
  key: string,
  scope: string,
  windowSec: number,
): Promise<void> {
  const path = pathForKey(key);
  const snap = await store.get(path);
  if (snap.exists) {
    const ageMs = snap.atMillis !== null ? Date.now() - snap.atMillis : 0;
    if (ageMs < windowSec * 1000) {
      throw new HttpsError("already-exists", `Duplicate request (${scope})`);
    }
  }
  await store.set(path, scope);
}

/**
 * Test-only helper: returns true if the marker exists for `key` AND is within
 * `windowSec`. Mirrors ensureIdempotent's window check without throwing.
 */
export async function isDuplicateForTest(
  key: string,
  windowSec: number,
): Promise<boolean> {
  const path = pathForKey(key);
  const snap = await store.get(path);
  if (!snap.exists) return false;
  const ageMs = snap.atMillis !== null ? Date.now() - snap.atMillis : 0;
  return ageMs < windowSec * 1000;
}

/**
 * Test-only seam: install an in-memory store. Returns the previous store so
 * the caller can restore it in afterEach.
 */
export function _setStoreForTest(s: IdempotencyStore): IdempotencyStore {
  const prev = store;
  store = s;
  return prev;
}

/**
 * Test-only seam: reset the store back to the production Admin-SDK path.
 * Mirrors functions/src/csp/dedup.ts `_clearForTest` shape.
 */
export function _resetForTest(): void {
  store = ADMIN_SDK_STORE;
}
