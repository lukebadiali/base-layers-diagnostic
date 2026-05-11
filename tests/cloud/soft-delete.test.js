// tests/cloud/soft-delete.test.js
// @ts-check
// Phase 4 Wave 3 (D-11) smoke + Phase 8 Wave 2 (LIFE-04): verifies that
// softDelete, restoreSoftDeleted, and permanentlyDeleteSoftDeleted are
// exported as functions and call their respective httpsCallable wrappers.
// Firebase functions module is mocked so no real network call is made.
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/firebase/functions.js", () => ({
  functions: { __mock: "functions" },
  httpsCallable: vi.fn((_functions, _name) => {
    // Return a callable stub that resolves with { data: { ok: true } }
    return vi.fn(async (_input) => ({ data: { ok: true } }));
  }),
}));

const { softDelete, restoreSoftDeleted, permanentlyDeleteSoftDeleted } =
  await import("../../src/cloud/soft-delete.js");

describe("cloud/soft-delete.js (Phase 8 Wave 2 LIFE-04 — real httpsCallable wrappers)", () => {
  it("softDelete is a function", () => {
    expect(typeof softDelete).toBe("function");
  });

  it("restoreSoftDeleted is a function", () => {
    expect(typeof restoreSoftDeleted).toBe("function");
  });

  it("permanentlyDeleteSoftDeleted is a function", () => {
    expect(typeof permanentlyDeleteSoftDeleted).toBe("function");
  });

  it("softDelete calls the httpsCallable and returns {ok:true}", async () => {
    const result = await softDelete({ type: "comment", orgId: "orgA", id: "c1" });
    expect(result).toEqual({ ok: true });
  });

  it("restoreSoftDeleted calls the httpsCallable and returns {ok:true}", async () => {
    const result = await restoreSoftDeleted({ type: "comment", orgId: "orgA", id: "c1" });
    expect(result).toEqual({ ok: true });
  });

  it("permanentlyDeleteSoftDeleted calls the httpsCallable and returns {ok:true}", async () => {
    const result = await permanentlyDeleteSoftDeleted({ type: "comment", id: "c1" });
    expect(result).toEqual({ ok: true });
  });
});
