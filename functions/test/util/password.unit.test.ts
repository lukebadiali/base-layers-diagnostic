// Unit tests for the temp-password generator used by inviteInternal.ts.
// Pure-logic seam (node:crypto only) — no firebase-functions-test substrate.
// Tests land BEFORE the implementation per the tests-first cadence (canonical
// RED signal: module-not-found error).

import { describe, it, expect } from "vitest";
import { generateTempPassword } from "../../src/util/password.js";

describe("generateTempPassword", () => {
  it("returns a non-empty string", () => {
    const pw = generateTempPassword();
    expect(typeof pw).toBe("string");
    expect(pw.length).toBeGreaterThan(0);
  });

  it("is long enough to satisfy any reasonable passwordPolicy (>= 20 chars)", () => {
    // The temp password is the member's first sign-in credential and is
    // validated by Identity Platform at signInWithEmailAndPassword. Always
    // comfortably above any minimum (6/8/12) so it never bricks first sign-in.
    expect(generateTempPassword().length).toBeGreaterThanOrEqual(20);
  });

  it("contains only URL-safe base64 characters (safe to relay verbatim)", () => {
    expect(generateTempPassword()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is unpredictable — 200 generations are all distinct", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(generateTempPassword());
    expect(seen.size).toBe(200);
  });
});
