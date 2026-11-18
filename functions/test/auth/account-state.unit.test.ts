// Unit tests for the pure existing-account classifier. No mocks needed — the
// module imports nothing (Pitfall 4), which is the whole point of the seam.
//
// These cases ARE the specification of what "the account already exists" can
// mean. The states were derived from the real failure: a staff account that
// could neither sign in nor be re-created, because Firebase Auth, /users and
// redactionList disagreed and nothing reconciled them.

import { describe, it, expect } from "vitest";
import {
  classifyExistingAccount,
  RECLAIMABLE_STATES,
  type AccountState,
} from "../../src/auth/account-state.js";

const STAFF_CLAIMS = { role: "admin", orgId: null };
const liveProfile = { id: "u1", email: "a@b.com", name: "A B", role: "admin" };

describe("classifyExistingAccount — healthy", () => {
  it("classifies an enabled staff account with an intact profile as healthy", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: false, customClaims: STAFF_CLAIMS },
      usersDoc: liveProfile,
      hasRedactionRow: false,
    });
    expect(d.state).toBe("healthy");
    expect(d.reclaimable).toBe(false);
    expect(d.currentRole).toBe("admin");
  });

  it("treats a missing `disabled` field as not-disabled (Admin SDK omits false)", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", customClaims: STAFF_CLAIMS },
      usersDoc: liveProfile,
      hasRedactionRow: false,
    });
    expect(d.state).toBe("healthy");
  });
});

describe("classifyExistingAccount — disabled", () => {
  it("classifies a disabled account as disabled + reclaimable", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: true, customClaims: STAFF_CLAIMS },
      usersDoc: liveProfile,
      hasRedactionRow: false,
    });
    expect(d.state).toBe("disabled");
    expect(d.reclaimable).toBe(true);
  });
});

describe("classifyExistingAccount — erased", () => {
  // An erased account is ALSO disabled and ALSO has a tombstoned profile.
  // "erased" has to win, because the remedy carries a warning the others
  // don't: pseudonymised content and deleted uploads do not come back.
  it("prefers erased over disabled when a redactionList row exists", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: true, customClaims: STAFF_CLAIMS },
      usersDoc: liveProfile,
      hasRedactionRow: true,
    });
    expect(d.state).toBe("erased");
    expect(d.reclaimable).toBe(true);
    expect(d.summary).toMatch(/NOT recoverable/);
  });

  it("detects an erasure from the profile tombstone alone (no redaction row)", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: true, customClaims: STAFF_CLAIMS },
      usersDoc: { id: "u1", email: null, name: null, erasedAt: "2026-10-01", role: "admin" },
      hasRedactionRow: false,
    });
    expect(d.state).toBe("erased");
  });

  it("prefers erased over orphaned when the profile was deleted outright", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: true, customClaims: STAFF_CLAIMS },
      usersDoc: null,
      hasRedactionRow: true,
    });
    expect(d.state).toBe("erased");
  });

  it("does NOT read an explicit erasedAt:null as an erasure", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: false, customClaims: STAFF_CLAIMS },
      usersDoc: { ...liveProfile, erasedAt: null },
      hasRedactionRow: false,
    });
    expect(d.state).toBe("healthy");
  });
});

describe("classifyExistingAccount — orphaned", () => {
  it("classifies an enabled account with no profile as orphaned + reclaimable", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: false, customClaims: STAFF_CLAIMS },
      usersDoc: null,
      hasRedactionRow: false,
    });
    expect(d.state).toBe("orphaned");
    expect(d.reclaimable).toBe(true);
  });
});

describe("classifyExistingAccount — client", () => {
  it("refuses a client-role account: wrong tool, not a broken staff account", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: false, customClaims: { role: "client", orgId: "org-1" } },
      usersDoc: { id: "u1", role: "client" },
      hasRedactionRow: false,
    });
    expect(d.state).toBe("client");
    expect(d.reclaimable).toBe(false);
  });

  it("still reports an ERASED client as erased — erasure reversal outranks the role split", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: true, customClaims: { role: "client", orgId: "org-1" } },
      usersDoc: null,
      hasRedactionRow: true,
    });
    expect(d.state).toBe("erased");
  });

  it("does not mistake a disabled client for a reclaimable staff account", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: true, customClaims: { role: "client", orgId: "org-1" } },
      usersDoc: { id: "u1", role: "client" },
      hasRedactionRow: false,
    });
    expect(d.state).toBe("client");
    expect(d.reclaimable).toBe(false);
  });
});

describe("classifyExistingAccount — edge cases", () => {
  it("handles entirely absent claims (a pre-claims or Console-made account)", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: false, customClaims: null },
      usersDoc: null,
      hasRedactionRow: false,
    });
    expect(d.state).toBe("orphaned");
    expect(d.currentRole).toBeNull();
  });

  it("ignores a non-string role rather than throwing", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: false, customClaims: { role: 42 } },
      usersDoc: liveProfile,
      hasRedactionRow: false,
    });
    expect(d.currentRole).toBeNull();
    expect(d.state).toBe("healthy");
  });

  it("always returns a non-empty operator-facing summary", () => {
    const states: AccountState[] = ["healthy", "disabled", "erased", "orphaned", "client"];
    const seen = new Set<AccountState>();
    const inputs = [
      { auth: { uid: "u", disabled: false, customClaims: STAFF_CLAIMS }, usersDoc: liveProfile, hasRedactionRow: false },
      { auth: { uid: "u", disabled: true, customClaims: STAFF_CLAIMS }, usersDoc: liveProfile, hasRedactionRow: false },
      { auth: { uid: "u", disabled: true, customClaims: STAFF_CLAIMS }, usersDoc: liveProfile, hasRedactionRow: true },
      { auth: { uid: "u", disabled: false, customClaims: STAFF_CLAIMS }, usersDoc: null, hasRedactionRow: false },
      { auth: { uid: "u", disabled: false, customClaims: { role: "client" } }, usersDoc: liveProfile, hasRedactionRow: false },
    ];
    for (const i of inputs) {
      const d = classifyExistingAccount(i);
      expect(d.summary.length).toBeGreaterThan(20);
      seen.add(d.state);
    }
    // Every documented state is actually reachable.
    expect([...seen].sort()).toEqual([...states].sort());
  });

  it("keeps reclaimable in sync with RECLAIMABLE_STATES", () => {
    const d = classifyExistingAccount({
      auth: { uid: "u1", disabled: true, customClaims: STAFF_CLAIMS },
      usersDoc: liveProfile,
      hasRedactionRow: false,
    });
    expect(RECLAIMABLE_STATES.includes(d.state)).toBe(d.reclaimable);
  });
});
