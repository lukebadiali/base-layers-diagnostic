// tests/data/migration.test.js
// @ts-check
// Phase 2 (TEST-04): coverage of src/data/migration.js. INCLUDES the load-bearing
// idempotency assertion (Pitfall 10) — second run on migrated data is a no-op.
import { describe, it, expect } from "vitest";
import { migrateV1IfNeeded, clearOldScaleResponsesIfNeeded } from "../../src/data/migration.js";
import v1Fixture from "../fixtures/v1-localStorage.json";
import v2Expected from "../fixtures/v2-org.json";
import { uid } from "../../src/util/ids.js";

// CANARY: pinned EXPECTED_LEGACY_UID guards against tests/setup.js drift.
// If tests/setup.js silently breaks the Math.random=0.5 mock or the fake-timer
// pin for Date.now, migration.test.js's idempotency assertion would still
// pass (both runs use the same drifted UIDs). This canary catches that case.
//
// Pre-computed under tests/setup.js mocks (Math.random=0.5 + Date frozen at
// 2026-01-01T00:00:00.000Z): (0.5).toString(36) = "0.i", slice(2,9) = "i";
// Date.now() = 1767225600000, .toString(36) = "mjuohs00", slice(-4) = "hs00";
// uid("u_") = "u_" + "i" + "hs00" = "u_ihs00".
describe("UID determinism canary (catches harness drift)", () => {
  it("uid('u_') under Math.random=0.5 + frozen Date.now produces the pinned value", () => {
    const EXPECTED_LEGACY_UID = "u_ihs00";
    expect(uid("u_")).toBe(EXPECTED_LEGACY_UID);
    // If this test fails, tests/setup.js has drifted; do NOT update this
    // expectation — diagnose the harness instead.
  });
});

/**
 * Build a fresh dependency bundle backed by an in-memory store. Mimics the
 * IIFE's loadUsers/loadOrgMetas/loadOrg/saveOrg/upsertUser/findUser shape.
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

describe("migrateV1IfNeeded", () => {
  it("is a no-op when users.length > 0 (already v2)", () => {
    const deps = makeDeps({ users: [{ id: "u_existing", role: "internal" }] });
    migrateV1IfNeeded(deps);
    expect(deps.store.users).toHaveLength(1); // unchanged
    expect(deps.store.v1Active).toBe(true);   // not cleared (early return)
  });

  it("is a no-op when there are no v1 orgs", () => {
    const deps = makeDeps({});
    migrateV1IfNeeded(deps);
    expect(deps.store.users).toHaveLength(0);
  });

  it("creates a legacy user and migrates v1 org to v2 shape", () => {
    const deps = makeDeps({
      orgMetas: v1Fixture.orgMetas,
      orgs: v1Fixture.orgs,
    });
    migrateV1IfNeeded(deps);

    expect(deps.store.users).toHaveLength(1);
    const legacy = deps.store.users[0];
    expect(legacy.email).toBe(v2Expected.expected_legacy_user_email);
    expect(legacy.role).toBe(v2Expected.expected_legacy_user_role);
    expect(legacy.name).toBe(v2Expected.expected_legacy_user_name);

    const orgX = deps.store.orgs[v2Expected.expected_org_id];
    expect(orgX.name).toBe(v2Expected.expected_org_name);
    expect(orgX.rounds).toHaveLength(1);
    expect(orgX.rounds[0].label).toBe(v2Expected.expected_round_label);
    expect(orgX.currentRoundId).toBe(orgX.rounds[0].id);

    // Responses re-keyed under the new round + legacy user
    const roundResp = orgX.responses[orgX.currentRoundId];
    expect(roundResp[legacy.id][1][0].score).toBe(
      v2Expected.expected_responses_pillar_1_q_0_score,
    );
    expect(roundResp[legacy.id][1][0].note).toBe(
      v2Expected.expected_responses_pillar_1_q_0_note,
    );

    // Internal note hoisted to org.internalNotes
    expect(orgX.internalNotes[1][0]).toBe(v2Expected.expected_internal_note_pillar_1_q_0);

    // Action createdBy patched
    expect(orgX.actions).toHaveLength(v2Expected.expected_action_count);
    expect(orgX.actions[0].id).toBe(v2Expected.expected_action_id);
    expect(orgX.actions[0].createdBy).toBe(legacy.id);

    // v1Active flag cleared
    expect(deps.store.v1Active).toBe(false);
  });

  it("links the legacy user to the org when there is exactly one v1 org", () => {
    const deps = makeDeps({ orgMetas: v1Fixture.orgMetas, orgs: v1Fixture.orgs });
    migrateV1IfNeeded(deps);
    expect(deps.store.users[0].orgId).toBe(v2Expected.expected_org_id);
  });

  it("is idempotent — second run is a no-op (Pitfall 10)", () => {
    const deps = makeDeps({ orgMetas: v1Fixture.orgMetas, orgs: v1Fixture.orgs });
    migrateV1IfNeeded(deps);
    const afterFirst = JSON.parse(JSON.stringify(deps.store));

    migrateV1IfNeeded(deps);
    const afterSecond = JSON.parse(JSON.stringify(deps.store));

    expect(afterSecond).toEqual(afterFirst);
  });

  it("skips already-migrated orgs (raw.rounds && raw.currentRoundId present)", () => {
    const alreadyMigrated = {
      orgMetas: [{ id: "y", name: "Y" }],
      orgs: {
        y: {
          id: "y", name: "Y", currentRoundId: "r0",
          rounds: [{ id: "r0", label: "Existing" }], responses: { r0: {} },
        },
      },
    };
    const deps = makeDeps(alreadyMigrated);
    migrateV1IfNeeded(deps);
    // The legacy user IS still created (because users.length === 0 at start) — but
    // the v1Orgs loop early-exits per-org via `if (raw.rounds && raw.currentRoundId) return;`
    expect(deps.store.users).toHaveLength(1);
    // The org should be unchanged (early return inside the forEach).
    expect(deps.store.orgs.y.rounds[0].label).toBe("Existing");
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
});
