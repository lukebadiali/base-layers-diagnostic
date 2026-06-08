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
import { PassphraseInvalidError, CrossOrgError, PassphraseNotSetError } from "../firebase/auth.js";

const inviteClientCallable = httpsCallable(functions, "inviteClient");
// Phase 06.1 post-merge fix: deleteClient wrapper. Same Pattern D shape as
// inviteClient — clientReqId generated per call, error codes mapped to typed
// errors where the modal cares about the distinction.
const deleteClientCallable = httpsCallable(functions, "deleteClient");
// 2026-06: internal-member lifecycle wrappers (admin-only create + delete of
// staff accounts). Mirror the inviteClient/deleteClient Pattern D shape.
const inviteInternalCallable = httpsCallable(functions, "inviteInternal");
const deleteInternalCallable = httpsCallable(functions, "deleteInternal");

/**
 * Extract the server HttpsError sub-code from a callable rejection.
 * @param {*} err
 * @returns {string}
 */
function errCode(err) {
  return /** @type {any} */ (err)?.details?.code ?? /** @type {any} */ (err)?.code ?? "";
}

/**
 * Wrap a friendly message as an Error carrying the original as `.cause`.
 * Constructor-arg `cause` isn't in the es2020 lib target, so attach it after
 * construction (same pattern as src/firebase/auth.js).
 * @param {string} message
 * @param {*} cause
 * @returns {Error}
 */
function friendlyError(message, cause) {
  const e = new Error(message);
  /** @type {*} */ (e).cause = cause;
  return e;
}

/**
 * @param {{ email: string, name: string, orgId: string, orgPassphrase: string, confirmReset?: boolean }} input
 * @returns {Promise<{ uid: string, existed: boolean, hasFirstRun?: boolean }>}
 */
export async function inviteClient(input) {
  const clientReqId = crypto.randomUUID();
  try {
    const res = await inviteClientCallable({ ...input, clientReqId });
    return /** @type {{ uid: string, existed: boolean, hasFirstRun?: boolean }} */ (res.data);
  } catch (err) {
    const code = /** @type {any} */ (err)?.details?.code ?? /** @type {any} */ (err)?.code ?? "";
    if (code === "auth/passphrase-invalid") throw new PassphraseInvalidError();
    if (code === "auth/cross-org-invite-rejected") throw new CrossOrgError();
    if (code === "auth/passphrase-not-set") throw new PassphraseNotSetError();
    throw err;
  }
}

/**
 * Atomic client deletion: removes the Firebase Auth user AND the /users/{uid}
 * mirror doc via the server-side deleteClient callable. The Firestore rule on
 * /users/{uid} denies client-side deletes; this wrapper is the only path
 * available to admin/internal callers in the UI.
 *
 * @param {{ uid: string }} input
 * @returns {Promise<{ uid: string, deleted: true }>}
 */
export async function deleteClient(input) {
  const clientReqId = crypto.randomUUID();
  const res = await deleteClientCallable({ ...input, clientReqId });
  return /** @type {{ uid: string, deleted: true }} */ (res.data);
}

/**
 * Create an internal/admin (staff) account. Admin-only server-side. Returns the
 * server-generated temporary password for the admin to relay out-of-band; the
 * member is forced to set their own password + enrol MFA on first sign-in.
 *
 * @param {{ email: string, name: string, role: "internal" | "admin" }} input
 * @returns {Promise<{ uid: string, tempPassword: string, existed: boolean }>}
 */
export async function inviteInternal(input) {
  const clientReqId = crypto.randomUUID();
  try {
    const res = await inviteInternalCallable({ ...input, clientReqId });
    return /** @type {{ uid: string, tempPassword: string, existed: boolean }} */ (res.data);
  } catch (err) {
    if (errCode(err) === "auth/email-already-exists") {
      throw friendlyError("An account with this email already exists.", err);
    }
    throw err;
  }
}

/**
 * Delete an internal/admin (staff) account atomically (Auth user + /users mirror
 * doc). Admin-only; the server refuses self-deletion and non-privileged targets.
 *
 * @param {{ uid: string }} input
 * @returns {Promise<{ uid: string, deleted: true }>}
 */
export async function deleteInternal(input) {
  const clientReqId = crypto.randomUUID();
  try {
    const res = await deleteInternalCallable({ ...input, clientReqId });
    return /** @type {{ uid: string, deleted: true }} */ (res.data);
  } catch (err) {
    const code = errCode(err);
    if (code === "auth/cannot-delete-self") {
      throw friendlyError("You can't remove your own account.", err);
    }
    if (code === "auth/not-an-internal-user") {
      throw friendlyError("That account isn't an internal member.", err);
    }
    throw err;
  }
}
