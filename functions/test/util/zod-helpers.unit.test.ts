// Phase 7 Wave 1 (FN-03): unit tests for validateInput.
// Pure-logic test — no Firestore / Sentry / Admin SDK.

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateInput } from "../../src/util/zod-helpers.js";

const Schema = z.object({
  uid: z.string(),
  role: z.enum(["admin", "internal", "client"]).optional(),
});

describe("validateInput — valid input (Test 1)", () => {
  it("returns the parsed result when input matches the schema", () => {
    expect(validateInput(Schema, { uid: "abc" })).toEqual({ uid: "abc" });
    expect(validateInput(Schema, { uid: "abc", role: "admin" })).toEqual({
      uid: "abc",
      role: "admin",
    });
  });
});

describe("validateInput — invalid input throws HttpsError (Test 2)", () => {
  it("throws invalid-argument with a path-prefixed message when the schema fails", () => {
    expect(() => validateInput(Schema, { uid: 42 })).toThrow();
    try {
      validateInput(Schema, { uid: 42 });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      expect(e.code).toBe("invalid-argument");
      expect(e.message).toContain("uid");
      expect(e.message).toContain("Validation failed");
    }
  });

  it("includes every failing path in the joined message", () => {
    const Multi = z.object({ a: z.string(), b: z.number() });
    try {
      validateInput(Multi, { a: 1, b: "x" });
      throw new Error("should have thrown");
    } catch (err) {
      const e = err as { code?: string; message?: string };
      expect(e.code).toBe("invalid-argument");
      expect(e.message).toContain("a:");
      expect(e.message).toContain("b:");
    }
  });
});

describe("validateInput — non-Zod throws are wrapped (Test 3)", () => {
  it("rethrows a non-Zod synchronous error as HttpsError(invalid-argument, 'Validation failed')", () => {
    const explodingSchema = {
      parse: () => {
        throw new Error("boom");
      },
    } as unknown as z.ZodTypeAny;

    try {
      validateInput(explodingSchema, {});
      throw new Error("should have thrown");
    } catch (err) {
      const e = err as { code?: string; message?: string };
      expect(e.code).toBe("invalid-argument");
      expect(e.message).toBe("Validation failed");
    }
  });
});
