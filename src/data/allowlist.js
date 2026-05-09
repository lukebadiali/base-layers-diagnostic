// src/data/allowlist.js
// @ts-check
// Phase 4 Wave 3 (D-09): READ-ONLY client for the internalAllowlist/{email}
// collection. Phase 6 (AUTH-07) wires Email/Password sign-in against this
// allowlist. NO write helpers exported — admin writes go through the Phase 7
// callable so the audit log + Admin SDK gate are enforced server-side.
//
// Threat-model anchor (T-4-3-6): data/allowlist.js exposes ZERO write surface.
// Phase 5 storage.rules denies internalAllowlist/* writes from clients
// (RULES-03). Single source of truth for the allowlist substrate.
import { db, collection, doc, getDoc, getDocs } from "../firebase/db.js";

/**
 * @param {string} email
 * @returns {Promise<any|null>}
 */
export async function getAllowlistEntry(email) {
  const key = String(email || "").toLowerCase();
  if (!key) return null;
  const snap = await getDoc(doc(db, "internalAllowlist", key));
  return snap.exists() ? snap.data() : null;
}

/**
 * @returns {Promise<Array<any>>}
 */
export async function listAllowlist() {
  /** @type {Array<any>} */
  const out = [];
  const snap = await getDocs(collection(db, "internalAllowlist"));
  snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
  return out;
}
