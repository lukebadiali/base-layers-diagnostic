// 2026-10: pure classifier for "an account already exists for this email —
// what state is it actually in?"
//
// Background: inviteInternal used to treat getUserByEmail() succeeding as a
// flat refusal ("An account with this email already exists"). That conflated
// five genuinely different situations, and in practice produced a dead end:
// a staff member whose account had been erased or disabled could neither sign
// in NOR be re-created, with no surface anywhere in the product explaining
// why. There is no soft-delete for accounts (SOFT_DELETABLE_TYPES covers
// action/comment/document/message/funnelComment/folder only), so there was no
// bin to restore from either.
//
// The states, and why each is distinct:
//   "healthy"   Auth record enabled, staff claims, intact /users mirror. A
//               real working colleague. Refuse — re-inviting would reset a
//               live account's password out from under them. Promoting or
//               re-roling them is a separate deliberate action.
//   "disabled"  Auth record exists but disabled:true. gdprEraseUser disables
//               rather than deletes (gdprEraseUser.ts:207), so this is the
//               state a GDPR-erased user lands in, as does any manual Console
//               disable. Reclaimable.
//   "erased"    A redactionList/{uid} row exists, or the /users mirror carries
//               erasedAt. The GDPR cascade ran. Reclaimable, but reversing an
//               erasure is a deliberate, audited act — never silent.
//   "orphaned"  Auth record exists, /users mirror does not. The admin panel
//               reads /users, so the person is invisible in the UI while Auth
//               still holds their email — exactly the "removed but can't be
//               re-added" report. Reclaimable.
//   "client"    Claims say role:"client". Not a staff account; inviteInternal
//               is the wrong tool. Refuse and point at the client flow.
//
// Pure + side-effect-free. MUST NOT import from firebase-functions/* or
// firebase-admin/* (Pitfall 4) — callers pass plain snapshots of what they
// read, which is also what makes the states exhaustively unit-testable.

export type AccountState = "healthy" | "disabled" | "erased" | "orphaned" | "client";

/** States an admin may revive in place via inviteInternal({ reclaim: true }). */
export const RECLAIMABLE_STATES: readonly AccountState[] = [
  "disabled",
  "erased",
  "orphaned",
] as const;

export interface ExistingAccountInputs {
  /** From getAuth().getUserByEmail() — the caller has already confirmed it exists. */
  auth: {
    uid: string;
    disabled?: boolean;
    customClaims?: Record<string, unknown> | null;
    mfaFactorCount?: number;
  };
  /** users/{uid} — null when the doc does not exist. */
  usersDoc: Record<string, unknown> | null;
  /** True when redactionList/{uid} exists (the GDPR cascade recorded an erasure). */
  hasRedactionRow: boolean;
}

export interface AccountDiagnosis {
  state: AccountState;
  reclaimable: boolean;
  /** Operator-facing one-liner. Safe to surface in UI — no PII beyond the role. */
  summary: string;
  /** Role currently on the Auth record's custom claims, or null. */
  currentRole: string | null;
}

/**
 * Classify an existing Auth record. Order matters: "erased" and "client" are
 * both checked before the enabled/disabled split, because an erased account is
 * also disabled and we want the more specific, more consequential label to win.
 */
export function classifyExistingAccount(
  inputs: ExistingAccountInputs,
): AccountDiagnosis {
  const claims = inputs.auth.customClaims ?? {};
  const currentRole = typeof claims.role === "string" ? claims.role : null;
  const erasedAt = inputs.usersDoc?.erasedAt ?? null;
  const wasErased = inputs.hasRedactionRow || erasedAt != null;

  if (wasErased) {
    return {
      state: "erased",
      reclaimable: true,
      currentRole,
      summary:
        "This account was erased under the GDPR right-to-erasure flow. The sign-in " +
        "record still exists but is disabled and its profile was tombstoned. " +
        "Reactivating restores sign-in only — previously pseudonymised content and " +
        "deleted uploads are NOT recoverable.",
    };
  }

  if (currentRole === "client") {
    return {
      state: "client",
      reclaimable: false,
      currentRole,
      summary:
        "This email belongs to a client account, not a staff one. Use the client " +
        "invite flow, or change their role deliberately rather than re-creating them.",
    };
  }

  if (inputs.auth.disabled === true) {
    return {
      state: "disabled",
      reclaimable: true,
      currentRole,
      summary:
        "The sign-in record exists but is disabled, so they cannot sign in and " +
        "cannot be re-created. Reactivating re-enables it and issues a fresh " +
        "temporary password.",
    };
  }

  if (!inputs.usersDoc) {
    return {
      state: "orphaned",
      reclaimable: true,
      currentRole,
      summary:
        "The sign-in record exists but the profile document does not, so they are " +
        "invisible in the admin panel while still holding the email. Reactivating " +
        "rebuilds the profile and issues a fresh temporary password.",
    };
  }

  return {
    state: "healthy",
    reclaimable: false,
    currentRole,
    summary:
      "This account is live and working. Re-inviting would reset their password; " +
      "if you meant to change their role, do that deliberately instead.",
  };
}
