// tests/firebase/auth-errors.test.js
// @ts-check
// Phase 06.1 Wave 1 Task 1 (AUTH-16 / D-14 / PATTERNS.md § AUTH-12 chokepoint
// additions): pins the shape + message + .name of 3 new AUTH-12 chokepoint
// error classes consumed by src/cloud/invite-admin.js (Wave 2). The Invite
// Client modal in src/main.js (Wave 2) surfaces err.message verbatim — these
// strings are the user-facing copy contract.
//
// TDD RED gate (Wave 1 Task 1 Step 1b):
// This test file lands BEFORE the 3 new classes exist in src/firebase/auth.js.
// The "is not a constructor" / undefined-import error is the canonical RED
// signal.

import { describe, it, expect } from "vitest";

import {
  PassphraseInvalidError,
  CrossOrgError,
  PassphraseNotSetError,
} from "../../src/firebase/auth.js";

describe("PassphraseInvalidError (AUTH-12 chokepoint — Phase 06.1 D-14)", () => {
  it("is constructible with no args and instanceof Error", () => {
    const e = new PassphraseInvalidError();
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(PassphraseInvalidError);
  });

  it("has name === 'PassphraseInvalidError'", () => {
    expect(new PassphraseInvalidError().name).toBe("PassphraseInvalidError");
  });

  it("has the user-facing chokepoint message", () => {
    expect(new PassphraseInvalidError().message).toBe(
      "Company passphrase incorrect — check it or update via Set Passphrase",
    );
  });
});

describe("CrossOrgError (AUTH-12 chokepoint — Phase 06.1 D-14)", () => {
  it("is constructible with no args and instanceof Error", () => {
    const e = new CrossOrgError();
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(CrossOrgError);
  });

  it("has name === 'CrossOrgError'", () => {
    expect(new CrossOrgError().name).toBe("CrossOrgError");
  });

  it("has the user-facing chokepoint message", () => {
    expect(new CrossOrgError().message).toBe(
      "That email already belongs to a different organisation",
    );
  });
});

describe("PassphraseNotSetError (AUTH-12 chokepoint — Phase 06.1 D-14)", () => {
  it("is constructible with no args and instanceof Error", () => {
    const e = new PassphraseNotSetError();
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(PassphraseNotSetError);
  });

  it("has name === 'PassphraseNotSetError'", () => {
    expect(new PassphraseNotSetError().name).toBe("PassphraseNotSetError");
  });

  it("has the user-facing chokepoint message", () => {
    expect(new PassphraseNotSetError().message).toBe(
      "Set the company passphrase first via Settings",
    );
  });
});
