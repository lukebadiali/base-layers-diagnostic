// tests/data/cloud-sync.test.js
// @ts-check
// Phase 5 Wave 4 Commit B (D-13 / H8 fix): the Phase 2 TEST-06 H8-baseline
// (cloud-wins-on-overlap last-writer-wins) is replaced - this rewrite is the
// evidence of the H8 cutover. The new dispatcher contract is the source of
// truth for cloud-sync's role.

import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1": { id: "o1", name: "Acme", currentRoundId: "r1" },
  },
}));

const { syncFromCloud, subscribeOrgMetadata } = await import("../../src/data/cloud-sync.js");

describe("subscribeOrgMetadata (Phase 5 Wave 4 H8 fix)", () => {
  it("onChange fires with the seeded parent-doc data + returns unsubscribe", () => {
    /** @type {Array<any>} */
    const received = [];
    const unsub = subscribeOrgMetadata("o1", {
      onChange: (m) => received.push(m),
      onError: () => {},
    });
    expect(typeof unsub).toBe("function");
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0]).toEqual({ id: "o1", name: "Acme", currentRoundId: "r1" });
  });

  it("onChange fires with null when the org doc does not exist", () => {
    /** @type {Array<any>} */
    const received = [];
    subscribeOrgMetadata("missing-org", {
      onChange: (m) => received.push(m),
      onError: () => {},
    });
    expect(received[0]).toBeNull();
  });

  it("returns an unsubscribe function", () => {
    const unsub = subscribeOrgMetadata("o1", {
      onChange: () => {},
      onError: () => {},
    });
    expect(typeof unsub).toBe("function");
    expect(() => unsub()).not.toThrow();
  });
});

describe("syncFromCloud (dispatcher contract / H8 fix)", () => {
  it("calls onMetadata with the parent doc + calls attach(orgId) once on first resolve", () => {
    const onMetadata = vi.fn();
    const attach = vi.fn();
    const onError = vi.fn();
    syncFromCloud("o1", { onMetadata, attach, onError });
    expect(onMetadata).toHaveBeenCalledWith({ id: "o1", name: "Acme", currentRoundId: "r1" });
    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledWith("o1");
  });

  it("does NOT call attach again on subsequent metadata updates (idempotent first-resolve)", () => {
    // The mock's onSnapshot fires synchronously once with the seed; this test
    // asserts attach.calls === 1 on a single seed-resolve cycle. The internal
    // `attached` flag prevents re-firing on subsequent metadata changes.
    const onMetadata = vi.fn();
    const attach = vi.fn();
    const onError = vi.fn();
    syncFromCloud("o1", { onMetadata, attach, onError });
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it("does NOT call attach when the parent doc resolves null", () => {
    const onMetadata = vi.fn();
    const attach = vi.fn();
    const onError = vi.fn();
    syncFromCloud("missing-org", { onMetadata, attach, onError });
    expect(onMetadata).toHaveBeenCalledWith(null);
    expect(attach).not.toHaveBeenCalled();
  });

  it("returns an unsubscribe function", () => {
    const unsub = syncFromCloud("o1", {
      onMetadata: () => {},
      attach: () => {},
      onError: () => {},
    });
    expect(typeof unsub).toBe("function");
  });

  it("throws when invoked with neither legacy shape nor new shape", () => {
    expect(() => syncFromCloud("o1", /** @type {any} */ (undefined))).toThrow();
  });
});

describe("syncFromCloud (legacy 9-prop deps deprecated shim)", () => {
  it("returns a no-op unsubscribe + does not throw + warns", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const unsub = syncFromCloud(/** @type {any} */ ({
      fbReady: () => true,
      cloudFetchAllOrgs: vi.fn(),
      cloudFetchAllUsers: vi.fn(),
      cloudPushOrg: vi.fn(),
      cloudPushUser: vi.fn(),
      jget: vi.fn(),
      jset: vi.fn(),
      K: { orgs: "k", users: "k", org: () => "k" },
      render: vi.fn(),
    }));
    expect(typeof unsub).toBe("function");
    expect(warnSpy).toHaveBeenCalled();
    // No-op unsub must not throw
    expect(() => unsub()).not.toThrow();
    warnSpy.mockRestore();
  });

  it("legacy shim does NOT trigger the parent-doc nested-map syncer (H8 root cause is gone)", () => {
    // The legacy code path's last-writer-wins overlap merge - that was the H8
    // root cause - is intentionally NOT executed. The shim only warns + returns.
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const cloudFetchAllOrgs = vi.fn();
    const cloudPushOrg = vi.fn();
    const jset = vi.fn();
    syncFromCloud(/** @type {any} */ ({
      fbReady: () => true,
      cloudFetchAllOrgs,
      cloudPushOrg,
      jset,
    }));
    expect(cloudFetchAllOrgs).not.toHaveBeenCalled();
    expect(cloudPushOrg).not.toHaveBeenCalled();
    expect(jset).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// Boundary test - imports remain firebase/db.js-only
describe("cloud-sync.js boundary (Phase 4 ESLint Wave 3)", () => {
  it("imports only from src/firebase/db.js (no jget/jset/app.js/view imports)", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/data/cloud-sync.js", "utf-8");
    expect(src).toMatch(/from\s+["']\.\.\/firebase\/db\.js["']/);
    // Legacy nested-map syncer dependencies gone:
    expect(src).not.toMatch(/jget\s*\(|jset\s*\(|cloudFetchAllOrgs\s*\(|cloudPushOrg\s*\(/);
    // No view-state coupling:
    expect(src).not.toMatch(/from\s+["']\.\.\/state/);
    // No imports from app.js or main.js (cloud-sync is consumed BY them, not vice versa):
    expect(src).not.toMatch(/from\s+["'](\.\.\/)+(app|main)\.js["']/);
  });
});
