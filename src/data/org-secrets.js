// src/data/org-secrets.js
// @ts-check
// Admin-only read/write wrapper over orgSecrets/{orgId}. Stores the PLAINTEXT
// company passphrase so internal/admin staff can view it later (the
// clientPassphraseHash on the org doc stays the source of truth for the
// inviteClient verify contract — this is a separate, recoverable copy).
//
// SECURITY BOUNDARY: this doc must NOT live on orgs/{orgId} — that doc is
// readable by the org's own clients (firestore.rules `inOrg`), which would leak
// the plaintext to client browsers via the live org subscription. It lives in
// its own top-level collection gated `read/write: if isInternal()` so clients
// (role "client") are denied even for their own org. See firestore.rules
// `match /orgSecrets/{orgId}` + tests/rules/org-secrets.test.js.
import { db, doc, getDoc, setDoc, serverTimestamp } from "../firebase/db.js";

/**
 * Persist the plaintext company passphrase for an org. Overwrites any prior
 * value. Internal/admin only (enforced by firestore.rules).
 * @param {string} orgId
 * @param {string} passphrase
 * @returns {Promise<void>}
 */
export async function setOrgPassphraseSecret(orgId, passphrase) {
  await setDoc(doc(db, "orgSecrets", orgId), {
    passphrase,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Read back the plaintext company passphrase for an org, or null when none is
 * stored (e.g. the passphrase was set before this feature shipped, so only the
 * hash exists). Internal/admin only (enforced by firestore.rules).
 * @param {string} orgId
 * @returns {Promise<string|null>}
 */
export async function getOrgPassphraseSecret(orgId) {
  const snap = await getDoc(doc(db, "orgSecrets", orgId));
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return typeof data.passphrase === "string" ? data.passphrase : null;
}
