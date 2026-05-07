// tests/cloud/soft-delete.test.js
// @ts-check
// Phase 4 Wave 3 (D-11) smoke test. Phase 8 (LIFE-04) fills the body.
import { describe, it, expect } from "vitest";
import { softDelete, restoreSoftDeleted } from "../../src/cloud/soft-delete.js";

describe("cloud/soft-delete.js (Phase 4 D-11 stub)", () => {
  it("softDelete is a function", () => {
    expect(typeof softDelete).toBe("function");
  });

  it("restoreSoftDeleted is a function", () => {
    expect(typeof restoreSoftDeleted).toBe("function");
  });

  it("softDelete resolves without throwing (no-op)", async () => {
    await expect(softDelete({ type: "org", id: "o1" })).resolves.toBeUndefined();
  });

  it("restoreSoftDeleted resolves without throwing (no-op)", async () => {
    await expect(restoreSoftDeleted({ type: "org", id: "o1" })).resolves.toBeUndefined();
  });
});
