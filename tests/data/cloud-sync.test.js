// tests/data/cloud-sync.test.js
// @ts-check

/**
 * REGRESSION BASELINE — Phase 2 / Pitfall 20 (H8 entanglement)
 *
 * These tests pin CURRENT behaviour of syncFromCloud — cloud wins on overlap
 * (last-writer-wins). Phase 5+ subcollection migration will rewrite the merge
 * algorithm; when that lands, these tests will fail — that failure IS the
 * evidence of the cutover, not a regression.
 */

// Provenance: Phase 2 (D-05) regression baseline test for src/data/cloud-sync.js extraction

import { describe, it, expect, vi } from "vitest";
import { syncFromCloud } from "../../src/data/cloud-sync.js";
import fixture from "../fixtures/cloud-sync-conflict.json";

const K = {
  orgs: "baselayers:orgs",
  users: "baselayers:users",
  /** @param {string} id */
  org: (id) => `baselayers:org:${id}`,
};

/**
 * @param {any} [overrides]
 */
function makeDeps(overrides = {}) {
  /** @type {Record<string, any>} */
  const store = {};
  return {
    store,
    deps: {
      fbReady: overrides.fbReady ?? vi.fn(() => true),
      cloudFetchAllOrgs: overrides.cloudFetchAllOrgs ?? vi.fn(() => Promise.resolve([])),
      cloudFetchAllUsers: overrides.cloudFetchAllUsers ?? vi.fn(() => Promise.resolve([])),
      cloudPushOrg: overrides.cloudPushOrg ?? vi.fn(),
      cloudPushUser: overrides.cloudPushUser ?? vi.fn(),
      jget: vi.fn((/** @type {string} */ k, /** @type {any} */ fallback) => (k in store ? store[k] : fallback)),
      jset: vi.fn((/** @type {string} */ k, /** @type {any} */ v) => { store[k] = v; }),
      K,
      render: overrides.render ?? vi.fn(),
    },
  };
}

describe("syncFromCloud (H8 cloud-wins-on-overlap pinned)", () => {
  it("bails early when fbReady() returns false (no jget/jset calls)", async () => {
    const { deps, store } = makeDeps({ fbReady: vi.fn(() => false) });
    await syncFromCloud(deps);
    expect(deps.cloudFetchAllOrgs).not.toHaveBeenCalled();
    expect(deps.jget).not.toHaveBeenCalled();
    expect(Object.keys(store)).toHaveLength(0);
  });

  it("bails when cloudFetchAllOrgs returns null (no localStorage write — regression baseline)", async () => {
    const { deps, store } = makeDeps({
      cloudFetchAllOrgs: vi.fn(() => Promise.resolve(null)),
    });
    store[K.orgs] = [{ id: "x", name: "Local X" }];
    await syncFromCloud(deps);
    // No new keys written, original key untouched.
    expect(deps.jset).not.toHaveBeenCalled();
    expect(store[K.orgs]).toEqual([{ id: "x", name: "Local X" }]);
  });

  it("bails when cloudFetchAllUsers returns null", async () => {
    const { deps } = makeDeps({
      cloudFetchAllUsers: vi.fn(() => Promise.resolve(null)),
    });
    await syncFromCloud(deps);
    expect(deps.jset).not.toHaveBeenCalled();
  });

  it("CLOUD WINS on overlap: localStorage org takes the cloud version (H8 baseline)", async () => {
    const { deps, store } = makeDeps({
      cloudFetchAllOrgs: vi.fn(() => Promise.resolve(fixture.scenarioOverlap.cloudOrgs)),
    });
    store[K.orgs] = fixture.scenarioOverlap.localMetas;
    store[K.org("x")] = fixture.scenarioOverlap.localOrg_x;

    await syncFromCloud(deps);

    expect(store[K.org("x")]).toEqual(fixture.scenarioOverlap.cloudOrgs[0]);
    expect(store[K.org("x")].marker).toBe("cloud"); // cloud version, not local
  });

  it("PUSHES local-only orgs to cloud and KEEPS them in localStorage merge", async () => {
    const { deps, store } = makeDeps({
      cloudFetchAllOrgs: vi.fn(() => Promise.resolve([])),
    });
    store[K.orgs] = fixture.scenarioLocalOnly.localMetas;
    store[K.org("y")] = fixture.scenarioLocalOnly.localOrg_y;

    await syncFromCloud(deps);

    expect(deps.cloudPushOrg).toHaveBeenCalledWith(fixture.scenarioLocalOnly.localOrg_y);
    // Local-only org survives merge
    expect(store[K.orgs]).toEqual(expect.arrayContaining([{ id: "y", name: "Local Y" }]));
  });

  it("PUSHES local-only users to cloud and merges them into K.users", async () => {
    const { deps, store } = makeDeps({
      cloudFetchAllOrgs: vi.fn(() => Promise.resolve([])),
      cloudFetchAllUsers: vi.fn(() => Promise.resolve([])),
    });
    store[K.users] = fixture.scenarioLocalOnly.localUsers;

    await syncFromCloud(deps);

    expect(deps.cloudPushUser).toHaveBeenCalledWith({ id: "u_local", name: "Local User" });
    expect(store[K.users]).toEqual(
      expect.arrayContaining([{ id: "u_local", name: "Local User" }]),
    );
  });

  it("calls render() once at the end of a successful sync", async () => {
    const { deps } = makeDeps();
    await syncFromCloud(deps);
    expect(deps.render).toHaveBeenCalledTimes(1);
  });

  // Plan 02-06 (Wave 5) coverage back-fill: drive the defensive branches at
  // src/data/cloud-sync.js:33, :37, :49 so the 90% src/data/** branches threshold
  // (D-15) holds.

  it("does NOT push a local org when its body is missing in storage (line 33 false branch)", async () => {
    const { deps, store } = makeDeps({
      cloudFetchAllOrgs: vi.fn(() => Promise.resolve([])),
    });
    // Meta says "z" exists but the body was never persisted.
    store[K.orgs] = [{ id: "z", name: "Ghost" }];
    // No store[K.org("z")] entry.

    await syncFromCloud(deps);

    expect(deps.cloudPushOrg).not.toHaveBeenCalled();
    // newMetas still preserves the local-only meta (line 41 truthy branch).
    expect(store[K.orgs]).toEqual(expect.arrayContaining([{ id: "z", name: "Ghost" }]));
  });

  it("skips corrupt cloud orgs lacking id (line 37 false branch — defensive `o && o.id`)", async () => {
    // NOTE: line 29's `cloudOrgs.map((o) => o.id)` dereferences without a null
    // guard, so passing `null` would crash before the line 37 `o && o.id`
    // defensive check fires. The line-37 guard exists for objects without `id`
    // — that's the branch we drive here. Logged in cleanup ledger as a
    // candidate Phase 4 hardening (the line-29 map should also defend against
    // null array entries).
    const { deps, store } = makeDeps({
      cloudFetchAllOrgs: vi.fn(() => Promise.resolve([
        { name: "no-id" }, // skipped — line 37 falsy branch
        { id: "good", name: "Good" }, // kept
      ])),
    });

    await syncFromCloud(deps);

    // Only the good org is written.
    expect(store[K.org("good")]).toEqual({ id: "good", name: "Good" });
    // newMetas only contains the good org (line 39 filter retains the only id-bearing entry).
    expect(store[K.orgs]).toEqual([{ id: "good", name: "Good" }]);
  });

  it("does NOT push a local user that already exists in cloud (line 49 false branch)", async () => {
    const { deps, store } = makeDeps({
      cloudFetchAllOrgs: vi.fn(() => Promise.resolve([])),
      cloudFetchAllUsers: vi.fn(() =>
        Promise.resolve([{ id: "u_shared", name: "Cloud Shared" }]),
      ),
    });
    store[K.users] = [{ id: "u_shared", name: "Local Shared" }];

    await syncFromCloud(deps);

    // Local user IS in cloud — should NOT push.
    expect(deps.cloudPushUser).not.toHaveBeenCalled();
    // Cloud version wins (line 51 spread, line 53 false branch — local NOT
    // appended because cloudUserIds.has(u.id) is true).
    expect(store[K.users]).toEqual([{ id: "u_shared", name: "Cloud Shared" }]);
  });
});
