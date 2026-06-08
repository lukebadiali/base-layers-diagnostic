// Pure transform for the inviteInternal callable's custom-claims shape.
// Mirrors invite-builder.ts buildInviteClaims, but for BeDeveloped staff:
// orgId is null (staff are not org-scoped) and role is admin | internal.
// Pure, side-effect-free; MUST NOT import from firebase-functions/* or
// firebase-admin/*.
//
// firstRun: true is load-bearing (same invariant as buildInviteClaims): it
// routes the member's first sign-in through renderFirstRun so they replace the
// relayed temp password with their own. The claim is dropped when
// updatePassword() chains setClaims() afterwards (SetClaimsSchema omits
// firstRun, so setCustomUserClaims overwrites the whole set). The setClaims
// gate admits this: admin via its isAdmin branch, internal via the
// self-update branch (same uid + unchanged role + orgId:null).

export type InternalRole = "admin" | "internal";

/**
 * Builds the custom claims attached to a newly-invited internal/admin member.
 *
 * @param role - "admin" or "internal"
 */
export function buildInternalInviteClaims(role: InternalRole): {
  role: InternalRole;
  orgId: null;
  firstRun: true;
} {
  return { role, orgId: null, firstRun: true };
}
