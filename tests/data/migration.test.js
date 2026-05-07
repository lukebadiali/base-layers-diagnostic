// tests/data/migration.test.js
// @ts-check
// Phase 2 (TEST-04): coverage of src/data/migration.js.
// Phase 4 Wave 6 (CODE-13): the v1→v2 migration body was REMOVED from
// src/data/migration.js (CONCERNS L2 closure). The 9 tests that exercised
// the removed body (legacy-user creation, v1-org→v2-shape transform,
// already-migrated skip, missing-org-body defensive guard, falsy-fallback
// coverage back-fill, internalNote hoisting, single/multi-org orgId linking,
// idempotency) were DELETED — they pinned behaviour we no longer have.
// Pre-deletion verification documented in src/data/migration.js header +
// 04-06-SUMMARY.md "CODE-13 closure" section. The unused v1Fixture +
// v2Expected JSON imports were dropped alongside the deleted tests.
//
// Tests retained:
//   - migrateV1IfNeeded no-op when users.length > 0 (the v2-active early-return guard;
//     this is the entire post-CODE-13 contract).
//   - migrateV1IfNeeded no-op when users.length === 0 (the only branch left).
//   - clearOldScaleResponsesIfNeeded — separate function, NOT dead, fully retained.
import { describe, it, expect } from "vitest";
import { migrateV1IfNeeded, clearOldScaleResponsesIfNeeded } from "../../src/data/migration.js";

/**
 * Build a fresh dependency bundle backed by an in-memory store. Mimics the
 * IIFE's loadUsers/loadOrgMetas/loadOrg/saveOrg/upsertUser/findUser shape.
 * Phase 4 Wave 6: scope narrowed — migrateV1IfNeeded only consumes loadUsers
 * post-CODE-13 closure; clearOldScaleResponsesIfNeeded still uses the full set.
 * @param {any} initial
 */
function makeDeps(initial) {
  const store = {
    users: initial.users ? [...initial.users] : [],
    orgMetas: initial.orgMetas ? JSON.parse(JSON.stringify(initial.orgMetas)) : [],
    orgs: initial.orgs ? JSON.parse(JSON.stringify(initial.orgs)) : {},
    settings: initial.settings ? JSON.parse(JSON.stringify(initial.settings)) : {},
    v1Active: initial.v1Active === undefined ? true : initial.v1Active,
  };
  return {
    store,
    loadUsers: () => store.users,
    loadOrgMetas: () => store.orgMetas,
    /** @param {string} id */
    loadOrg: (id) => store.orgs[id] || null,
    /** @param {any} org */
    saveOrg: (org) => { store.orgs[org.id] = JSON.parse(JSON.stringify(org)); },
    /** @param {any} user */
    upsertUser: (user) => {
      const i = store.users.findIndex((/** @type {any} */ u) => u.id === user.id);
      if (i >= 0) store.users[i] = JSON.parse(JSON.stringify(user));
      else store.users.push(JSON.parse(JSON.stringify(user)));
    },
    /** @param {string} id */
    findUser: (id) => store.users.find((/** @type {any} */ u) => u.id === id) || null,
    removeV1ActiveKey: () => { store.v1Active = false; },
    loadSettings: () => store.settings,
    /** @param {any} s */
    saveSettings: (s) => { store.settings = JSON.parse(JSON.stringify(s)); },
  };
}

describe("migrateV1IfNeeded (CODE-13 — body REMOVED Phase 4 Wave 6)", () => {
  it("is a no-op when users.length > 0 (the post-CODE-13 contract — v2-active guard)", () => {
    const deps = makeDeps({ users: [{ id: "u_existing", role: "internal" }] });
    migrateV1IfNeeded(deps);
    expect(deps.store.users).toHaveLength(1); // unchanged — early return triggered
    expect(deps.store.v1Active).toBe(true);   // not cleared (the body that cleared it is gone)
  });

  it("is a no-op when users.length === 0 (the only branch left after CODE-13 body removal)", () => {
    // Pre-CODE-13: this was the path where v1-localStorage migration ran. Post-CODE-13:
    // the function returns silently without doing anything. We assert that nothing
    // mutates — no legacy user created, no orgs migrated, no flags toggled.
    const deps = makeDeps({
      // Even with v1 orgs present, the body that consumed them is gone.
      orgMetas: [{ id: "x", name: "X" }],
      orgs: { x: { id: "x", name: "X", responses: {} } },
    });
    migrateV1IfNeeded(deps);
    expect(deps.store.users).toHaveLength(0); // no legacy user
    expect(deps.store.orgs.x.rounds).toBeUndefined(); // no v2 shape forced
    expect(deps.store.v1Active).toBe(true); // flag NOT cleared (the line that cleared it is gone)
  });
});

describe("clearOldScaleResponsesIfNeeded", () => {
  it("clears responses + internalNotes when settings.scaleV2Cleared is false", () => {
    const deps = makeDeps({
      orgMetas: [{ id: "x" }],
      orgs: { x: { id: "x", currentRoundId: "r1", responses: { r1: { u1: { 1: { 0: { score: 5 } } } } }, internalNotes: { 1: { 0: "n" } } } },
      settings: { scaleV2Cleared: false },
    });
    clearOldScaleResponsesIfNeeded(deps);
    expect(deps.store.orgs.x.responses).toEqual({ r1: {} });
    expect(deps.store.orgs.x.internalNotes).toEqual({});
    expect(deps.store.settings.scaleV2Cleared).toBe(true);
  });

  it("is a no-op when settings.scaleV2Cleared is already true (idempotency-via-flag)", () => {
    const orgs = { x: { id: "x", currentRoundId: "r1", responses: { r1: { u1: { 1: { 0: { score: 5 } } } } }, internalNotes: { 1: { 0: "n" } } } };
    const deps = makeDeps({
      orgMetas: [{ id: "x" }],
      orgs,
      settings: { scaleV2Cleared: true },
    });
    clearOldScaleResponsesIfNeeded(deps);
    // responses + internalNotes unchanged
    expect(deps.store.orgs.x.responses).toEqual(orgs.x.responses);
    expect(deps.store.orgs.x.internalNotes).toEqual(orgs.x.internalNotes);
  });

  // Plan 02-06 (Wave 5) coverage back-fill: drive the defensive `if (!org) return`
  // branch on line 110 + the `if (org.currentRoundId)` false branch on line 113
  // so the 90% src/data/** branches threshold (D-15) holds.
  it("skips orgs whose body is missing in storage (defensive `if (!org) return`)", () => {
    const deps = makeDeps({
      orgMetas: [{ id: "ghost" }, { id: "x" }],
      orgs: { x: { id: "x", currentRoundId: "r1", responses: { r1: { u1: { 1: { 0: { score: 5 } } } } } } },
      settings: { scaleV2Cleared: false },
    });
    clearOldScaleResponsesIfNeeded(deps);
    // Ghost is skipped; x is cleared normally.
    expect(deps.store.orgs.ghost).toBeUndefined();
    expect(deps.store.orgs.x.responses).toEqual({ r1: {} });
    expect(deps.store.settings.scaleV2Cleared).toBe(true);
  });

  it("clears orgs without currentRoundId without seeding a round entry (line 113 false branch)", () => {
    const deps = makeDeps({
      orgMetas: [{ id: "x" }],
      orgs: { x: { id: "x", responses: { someRound: { u1: {} } }, internalNotes: { 1: {} } } }, // NO currentRoundId
      settings: { scaleV2Cleared: false },
    });
    clearOldScaleResponsesIfNeeded(deps);
    // responses fully empty (no round-id seed) because currentRoundId is missing.
    expect(deps.store.orgs.x.responses).toEqual({});
    expect(deps.store.orgs.x.internalNotes).toEqual({});
  });
});
