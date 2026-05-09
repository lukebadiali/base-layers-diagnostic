// src/cloud/claims-admin.js
// @ts-check
// Phase 6 Wave 3 (AUTH-07 / Pattern D): wires the setClaims callable through
// src/firebase/functions.js. The boundary contract - cloud/* imports
// firebase/functions.js, never firebase/functions SDK directly - is preserved
// per Phase 4 ESLint Wave 1 + ARCHITECTURE.md section 2 dep matrix.
import { functions, httpsCallable } from "../firebase/functions.js";

const setClaimsCallable = httpsCallable(functions, "setClaims");

/**
 * @param {{ uid: string, role?: string, orgId?: string }} input
 * @returns {Promise<void>}
 */
export async function setClaims(input) {
  await setClaimsCallable(input);
}
