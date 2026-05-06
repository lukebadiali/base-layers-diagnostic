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
});
