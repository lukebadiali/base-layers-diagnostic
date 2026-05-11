// tests/cloud/gdpr.test.js
// @ts-check
// Phase 4 Wave 3 (D-11) smoke + Phase 8 Wave 3/4 (GDPR-01/02): verifies that
// exportUser and eraseUser are exported as functions and call their
// respective httpsCallable wrappers. Firebase functions module is mocked so
// no real network call is made.
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/firebase/functions.js", () => ({
  functions: { __mock: "functions" },
  httpsCallable: vi.fn((_functions, name) => {
    if (name === "gdprExportUser") {
      return vi.fn(async (_input) => ({
        data: { url: "https://signed.example/x", expiresAt: 1234567890 },
      }));
    }
    if (name === "gdprEraseUser") {
      return vi.fn(async (_input) => ({
        data: { ok: true, counts: { messages: 0, comments: 0 } },
      }));
    }
    return vi.fn(async (_input) => ({ data: { ok: true } }));
  }),
}));

const { exportUser, eraseUser } = await import("../../src/cloud/gdpr.js");

describe("cloud/gdpr.js (Phase 8 GDPR-01/02 — real httpsCallable wrappers)", () => {
  it("exportUser is a function", () => {
    expect(typeof exportUser).toBe("function");
  });

  it("eraseUser is a function", () => {
    expect(typeof eraseUser).toBe("function");
  });

  it("exportUser returns { url, expiresAt } from the callable response", async () => {
    const out = await exportUser({ userId: "u1" });
    expect(out).toHaveProperty("url");
    expect(out).toHaveProperty("expiresAt");
    expect(out.url).toBe("https://signed.example/x");
  });

  it("eraseUser returns { ok, counts } from the callable response", async () => {
    const out = await eraseUser({ userId: "u1" });
    expect(out.ok).toBe(true);
    expect(out.counts).toEqual({ messages: 0, comments: 0 });
  });
});
