// tests/cloud/gdpr.test.js
// @ts-check
// Phase 4 Wave 3 (D-11) smoke test. Phase 8 (GDPR-01/02) fills the body.
import { describe, it, expect } from "vitest";
import { exportUser, eraseUser } from "../../src/cloud/gdpr.js";

describe("cloud/gdpr.js (Phase 4 D-11 stub)", () => {
  it("exportUser is a function", () => {
    expect(typeof exportUser).toBe("function");
  });

  it("eraseUser is a function", () => {
    expect(typeof eraseUser).toBe("function");
  });

  it("exportUser resolves to a placeholder shape (no-op today)", async () => {
    const out = await exportUser({ userId: "u1" });
    expect(out).toBeDefined();
    expect(out).toHaveProperty("downloadURL");
  });

  it("eraseUser resolves without throwing (no-op)", async () => {
    await expect(eraseUser({ userId: "u1" })).resolves.toBeUndefined();
  });
});
