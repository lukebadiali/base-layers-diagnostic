// Phase 6 (AUTH-03 / D-10): pure transform from internalAllowlist entry to
// the custom-claims shape attached by beforeUserCreated. The unit-test seam
// per D-01 Wave 2 (tests-first, Vitest, no firebase-functions-test substrate).
// Pure, side-effect-free; safe for unit testing without firebase-functions
// runtime. MUST NOT import from firebase-functions/* or firebase-admin/*.

export interface AllowlistEntry {
  role: "admin" | "internal" | "client";
  orgId?: string;
  addedBy?: string;
}

export interface CustomClaims {
  role: "admin" | "internal" | "client";
  orgId: string | null;
}

export function buildClaims(allowlistEntry: AllowlistEntry | null): CustomClaims {
  if (!allowlistEntry) {
    // Pitfall 6 + ARCHITECTURE.md §7 Flow B: no allowlist match falls through
    // to the "client" default; orgId would come from invite-JWT in a future
    // invite flow. Phase 6 ships internal-only.
    return { role: "client", orgId: null };
  }
  return {
    role: allowlistEntry.role,
    orgId: allowlistEntry.orgId ?? null,
  };
}
