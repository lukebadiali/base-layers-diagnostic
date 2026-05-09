// tests/data/allowlist.test.js
// @ts-check
// Phase 4 Wave 3 (D-09): allowlist is read-only (admin-only writes go through
// Phase 7 callable). No write helpers — verified by absence of save/delete
// functions on the import surface.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "internalAllowlist/luke@bedeveloped.local": { email: "luke@bedeveloped.local", role: "internal" },
  },
}));

const allowlist = await import("../../src/data/allowlist.js");
const { getAllowlistEntry, listAllowlist } = allowlist;

describe("data/allowlist.js (D-09 read-only owner)", () => {
  it("getAllowlistEntry lowercases the email lookup", async () => {
    const e = await getAllowlistEntry("LUKE@BeDeveloped.local");
    expect(e).toEqual({ email: "luke@bedeveloped.local", role: "internal" });
  });

  it("getAllowlistEntry returns null when absent", async () => {
    const e = await getAllowlistEntry("missing@example.com");
    expect(e).toBeNull();
  });

  it("listAllowlist returns the seeded entries", async () => {
    const list = await listAllowlist();
    expect(list.find((/** @type {any} */ e) => e.email === "luke@bedeveloped.local")).toBeTruthy();
  });

  it("does NOT export any write helpers (admin-only writes go through Phase 7 callable)", () => {
    expect(/** @type {any} */ (allowlist).saveAllowlistEntry).toBeUndefined();
    expect(/** @type {any} */ (allowlist).deleteAllowlistEntry).toBeUndefined();
    expect(/** @type {any} */ (allowlist).addAllowlistEntry).toBeUndefined();
  });
});
