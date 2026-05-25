// src/cloud/invite-admin.js
// @ts-check
// Phase 06.1 Wave 2 (AUTH-16 / D-14): wires the inviteClient callable
// through src/firebase/functions.js. Pattern D wrapper analog of
// src/cloud/claims-admin.js. Boundary contract — cloud/* imports
// firebase/functions.js, never firebase/functions SDK directly — preserved
// per Phase 4 ESLint Wave 1 + ARCHITECTURE.md §2.
//
// AUTH-12 chokepoint extension: server HttpsError codes (carried in
// err.details.code) map to typed PassphraseInvalidError / CrossOrgError /
// PassphraseNotSetError so the Invite modal in src/main.js never sees raw
// Firebase codes. Unrecognised errors re-throw verbatim — Sentry browser
// SDK + the modal's catch-all handler surface them.
//
// No client-side audit-event emit (per CONTEXT D-11 / RESEARCH § 5 — server
// emits auth.client.invite{,.resend,.rejected.cross-org,.rejected.passphrase-invalid}
// directly from the callable; the admin's chained admin-panel interactions
// already carry iam.claims.set.requested where audit is needed).

import { functions, httpsCallable } from "../firebase/functions.js";
import {
  PassphraseInvalidError,
  CrossOrgError,
  PassphraseNotSetError,
} from "../firebase/auth.js";

const inviteClientCallable = httpsCallable(functions, "inviteClient");

/**
 * @param {{ email: string, name: string, orgId: string, orgPassphrase: string, confirmReset?: boolean }} input
 * @returns {Promise<{ uid: string, existed: boolean, hasFirstRun?: boolean }>}
 */
export async function inviteClient(input) {
  const clientReqId = crypto.randomUUID();
  try {
    const res = await inviteClientCallable({ ...input, clientReqId });
    return /** @type {{ uid: string, existed: boolean, hasFirstRun?: boolean }} */ (
      res.data
    );
  } catch (err) {
    const code =
      /** @type {any} */ (err)?.details?.code ??
      /** @type {any} */ (err)?.code ??
      "";
    if (code === "auth/passphrase-invalid") throw new PassphraseInvalidError();
    if (code === "auth/cross-org-invite-rejected") throw new CrossOrgError();
    if (code === "auth/passphrase-not-set") throw new PassphraseNotSetError();
    throw err;
  }
}
