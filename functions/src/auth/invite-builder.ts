// Phase 06.1 (AUTH-16 / D-12): pure transform helpers for the inviteClient
// callable's verify + branch logic. The Vitest unit-test seam per D-12.
// Pure, side-effect-free; safe for unit testing without firebase-functions
// runtime. MUST NOT import from firebase-functions/* or firebase-admin/*.
//
// Wave 1 (this file) lands the helpers + their Vitest tests. Wave 2 imports
// these into functions/src/auth/inviteClient.ts to drive the callable body.

export interface OrgPassphraseGate {
  storedHash: string | null;
  candidate: string;
}

export type InviteOutcome =
  | { kind: "create" }
  | { kind: "resend"; existingUid: string }
  | {
      kind: "cross-org-refuse";
      existingUid: string;
      existingOrgId: string;
    }
  | { kind: "passphrase-invalid" }
  | { kind: "passphrase-not-set" };

/**
 * Verifies an org passphrase candidate against the stored hash.
 *
 * MUST short-circuit to false when storedHash is null — without invoking
 * hashFn (which would be wasted work, and in some test seams masks the
 * "passphrase-not-set" branch). The unit test pins this contract.
 *
 * @param storedHash - The SHA-256 hex from `orgs/{orgId}.clientPassphraseHash`.
 * @param candidate  - The plaintext passphrase typed by the admin at invite time.
 * @param hashFn     - Hash function. Injected so the unit test can pin behaviour
 *                     deterministically without pulling in node:crypto.
 */
export async function verifyOrgPassphrase(
  storedHash: string | null,
  candidate: string,
  hashFn: (s: string) => Promise<string>,
): Promise<boolean> {
  if (!storedHash) return false;
  const candidateHash = await hashFn(candidate);
  return candidateHash === storedHash;
}

/**
 * Builds the custom-claims shape attached to an invited client user.
 *
 * RESEARCH § 6.2 regression-gate: `firstRun: true` MUST be the literal
 * boolean true. SetClaimsSchema deliberately omits `firstRun`, so when
 * src/firebase/auth.js#updatePassword calls setClaims post-password-change,
 * `setCustomUserClaims` overwrites the entire claim set and drops firstRun.
 * That gate is what flips a first-run user OUT of renderFirstRun on next
 * getIdToken(true) refresh. If firstRun is anything other than the literal
 * true here, the first-run loop never starts.
 */
export function buildInviteClaims(orgId: string): {
  role: "client";
  orgId: string;
  firstRun: true;
} {
  return { role: "client", orgId, firstRun: true };
}

/**
 * Pure switch over invite outcomes. The inviteClient callable body computes
 * `passphraseSet`, `passphraseValid`, and `existingUser` from the Firestore
 * org doc + Admin SDK auth.getUserByEmail lookup, then defers the branching
 * decision here so the logic is unit-testable without the Admin SDK.
 *
 * Branch order (matters):
 *   1. passphraseSet === false           → passphrase-not-set
 *   2. passphraseValid === false         → passphrase-invalid
 *   3. existingUser === null             → create
 *   4. existing client w/ different orgId → cross-org-refuse
 *      (RESEARCH § 8: cross-org refusal is based on the existing user's
 *       claims.orgId, NOT the inviting admin's orgId. An existing user with
 *       role !== "client" or orgId === null is "claimable" — adopt into
 *       the requested org via the resend branch.)
 *   5. otherwise                         → resend
 *
 * NOTE: `confirmReset` is accepted in the args but not branched on here —
 * the resend branch is unconditional in the pure switch; the callable body
 * (Wave 2) checks confirmReset to decide whether to actually invoke
 * auth.updateUser({password}) vs just return existed:true for confirmation.
 */
export function decideInviteOutcome(args: {
  passphraseValid: boolean;
  passphraseSet: boolean;
  existingUser: {
    uid: string;
    orgId: string | null;
    role: string | null;
  } | null;
  requestedOrgId: string;
  confirmReset: boolean;
}): InviteOutcome {
  if (!args.passphraseSet) return { kind: "passphrase-not-set" };
  if (!args.passphraseValid) return { kind: "passphrase-invalid" };
  if (args.existingUser === null) return { kind: "create" };
  if (
    args.existingUser.role === "client" &&
    args.existingUser.orgId !== null &&
    args.existingUser.orgId !== args.requestedOrgId
  ) {
    return {
      kind: "cross-org-refuse",
      existingUid: args.existingUser.uid,
      existingOrgId: args.existingUser.orgId,
    };
  }
  return { kind: "resend", existingUid: args.existingUser.uid };
}
