// src/cloud/claims-admin.js
// @ts-check
// Phase 6 Wave 3 (AUTH-07 / Pattern D): wires the setClaims callable through
// src/firebase/functions.js. The boundary contract - cloud/* imports
// firebase/functions.js, never firebase/functions SDK directly - is preserved
// per Phase 4 ESLint Wave 1 + ARCHITECTURE.md section 2 dep matrix.
//
// Phase 7 Wave 5 (BLOCKER-FIX 1 + Wave 1 SetClaimsSchema clientReqId
// requirement): the server-side callable now requires `clientReqId: uuid` in
// its Zod input schema (functions/src/auth/setClaims.ts SetClaimsSchema). This
// wrapper generates clientReqId per call so callers (e.g.
// src/firebase/auth.js#updatePassword) don't need to bring crypto.randomUUID()
// into their own scope. The 5-min idempotency window (FN-03 ensureIdempotent)
// keys off this id + the caller uid + the target uid.
import { functions, httpsCallable } from "../firebase/functions.js";

const setClaimsCallable = httpsCallable(functions, "setClaims");

/**
 * @param {{ uid: string, role?: string|null, orgId?: string|null }} input
 * @returns {Promise<void>}
 */
export async function setClaims(input) {
  const clientReqId = crypto.randomUUID();
  await setClaimsCallable({ ...input, clientReqId });
}
