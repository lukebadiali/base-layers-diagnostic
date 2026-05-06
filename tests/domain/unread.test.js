// tests/domain/unread.test.js
// @ts-check

/**
 * REGRESSION BASELINE — Phase 2 / Pitfall 20
 *
 * These tests pin the CURRENT behaviour of unread tracking, including the
 * known H7 (clock skew) entanglement: client clocks are mixed with server
 * clocks in the comparator. Phase 5 (DATA-07) fixes H7 by moving last-read
 * markers into Firestore readStates. When that lands, these tests will fail —
 * that failure IS the evidence of the cutover, not a regression.
 *
 * Phase 5 plan task: replace these tests with new ones that assert
 * server-clock-vs-server-clock comparators (5-minute clock skew on the
 * client does not change unread counts).
 */

// Provenance: Phase 2 (D-05) regression baseline test for src/domain/unread.js extraction

import { describe, it, expect, vi } from "vitest";
import {
  unreadCountForPillar,
  unreadCountTotal,
  markPillarRead,
  unreadChatTotal,
} from "../../src/domain/unread.js";
import fixture from "../fixtures/unread-state.json";

const DATA = { pillars: [{ id: 1 }, { id: 2 }] };

/**
 * @param {*} org
 * @param {number|string} pillarId
 */
const commentsFor = (org, pillarId) => org.comments?.[pillarId] || [];

describe("unreadCountForPillar (H7 entanglement pinned)", () => {
  it("returns 0 when there are no comments", () => {
    const org = { comments: {}, readStates: {} };
    expect(unreadCountForPillar(org, 1, fixture.users.self, commentsFor)).toBe(0);
  });

  it("returns 1 for one comment by other-author after lastRead", () => {
    expect(unreadCountForPillar(fixture.org, 1, fixture.users.self, commentsFor)).toBe(1);
    // c_a is BEFORE lastRead (excluded), c_b is AFTER (included), c_c is self-authored (excluded)
  });

  it("excludes self-authored comments regardless of timestamp", () => {
    expect(unreadCountForPillar(fixture.org, 1, fixture.users.self, commentsFor))
      .toBeLessThan(fixture.org.comments[1].length);
    // i.e., c_c (self) is filtered out
  });

  it("counts every other-author comment as unread when lastT = 0 (no readState entry)", () => {
    // H7 entanglement: with no readState for this user, EVERY other-author comment
    // counts as unread. Phase 5 fixes; Phase 2 pins.
    const orgNoRead = { comments: fixture.org.comments, readStates: {} };
    expect(unreadCountForPillar(orgNoRead, 1, fixture.users.self, commentsFor)).toBe(2);
    // c_a + c_b are by u_other; c_c is filtered out by authorId
  });
});

describe("unreadCountTotal", () => {
  it("sums unreadCountForPillar across DATA.pillars", () => {
    // pillar 1 has 1 unread (per fixture); pillar 2 has 0 (no comments).
    expect(unreadCountTotal(fixture.org, fixture.users.self, DATA, commentsFor)).toBe(1);
  });

  it("returns 0 when DATA.pillars is empty", () => {
    expect(unreadCountTotal(fixture.org, fixture.users.self, { pillars: [] }, commentsFor))
      .toBe(0);
  });
});

describe("markPillarRead", () => {
  it("writes the frozen iso timestamp to readStates[user.id][pillarId] and calls saveOrg once", () => {
    /** @type {*} */
    const org = {};
    const user = { id: "u_self" };
    const saveOrg = vi.fn();

    markPillarRead(org, 1, user, saveOrg);

    expect(org.readStates).toEqual({ u_self: { 1: "2026-01-01T00:00:00.000Z" } });
    expect(saveOrg).toHaveBeenCalledTimes(1);
    expect(saveOrg).toHaveBeenCalledWith(org);
  });

  it("preserves existing readState entries for other users and other pillars", () => {
    /** @type {*} */
    const org = {
      readStates: {
        u_other: { 1: "2025-01-01T00:00:00.000Z" },
        u_self: { 2: "2025-06-01T00:00:00.000Z" },
      },
    };
    const saveOrg = vi.fn();

    markPillarRead(org, 1, { id: "u_self" }, saveOrg);

    expect(org.readStates.u_other).toEqual({ 1: "2025-01-01T00:00:00.000Z" });
    expect(org.readStates.u_self).toEqual({
      2: "2025-06-01T00:00:00.000Z",
      1: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("unreadChatTotal", () => {
  /** @type {(userId: string, orgId: string) => number} */
  const lastReadMillis = () => new Date("2026-01-01T00:00:00.000Z").getTime();
  /** @param {*} m */
  const msgMillis = (m) => new Date(m.createdAt).getTime();
  const unreadChatForOrg = vi.fn(() => 7);

  it("returns 0 for null user", () => {
    expect(unreadChatTotal(null, { chatMessages: [] }, lastReadMillis, msgMillis, unreadChatForOrg))
      .toBe(0);
  });

  it("delegates to unreadChatForOrg for client users", () => {
    const user = { id: "u1", role: "client", orgId: "org_x" };
    expect(unreadChatTotal(user, { chatMessages: [] }, lastReadMillis, msgMillis, unreadChatForOrg))
      .toBe(7);
    expect(unreadChatForOrg).toHaveBeenCalledWith(user, "org_x");
  });

  it("reduces over chatMessages for internal users, excluding self-authored and pre-lastRead", () => {
    const user = { id: "u_self", role: "internal" };
    const state = {
      chatMessages: [
        // counts (after lastRead)
        { authorId: "u_other", orgId: "org_a", createdAt: "2026-01-01T00:05:00.000Z" },
        // excluded (before lastRead)
        { authorId: "u_other", orgId: "org_a", createdAt: "2025-12-31T23:55:00.000Z" },
        // excluded (self)
        { authorId: "u_self", orgId: "org_a", createdAt: "2026-01-01T00:10:00.000Z" },
      ],
    };
    expect(unreadChatTotal(user, state, lastReadMillis, msgMillis, unreadChatForOrg))
      .toBe(1);
  });

  // Plan 02-06 (Wave 5) coverage back-fill: drive the `state.chatMessages || []`
  // defensive short-circuit on line 56 so the 100% src/domain/** threshold (D-15)
  // holds.
  it("returns 0 for an internal user when state.chatMessages is missing (defensive `|| []`)", () => {
    const user = { id: "u_self", role: "internal" };
    /** @type {*} */
    const state = {}; // no chatMessages key
    expect(unreadChatTotal(user, state, lastReadMillis, msgMillis, unreadChatForOrg))
      .toBe(0);
  });
});

// Plan 02-06 (Wave 5) coverage back-fill: drive the `org.readStates || {}`
// defensive short-circuit on src/domain/unread.js:16 so the 100% src/domain/**
// threshold (D-15) holds.
describe("unreadCountForPillar — defensive `org.readStates || {}` branch", () => {
  it("treats a missing readStates key as no-prior-read (lastT = 0, all other-author counted)", () => {
    const org = {
      comments: {
        1: [
          { id: "c1", authorId: "u_other", createdAt: "2026-01-01T00:05:00.000Z" },
          { id: "c2", authorId: "u_self", createdAt: "2026-01-01T00:10:00.000Z" },
        ],
      },
      // NO readStates key — drives `||{}` fallback on line 16
    };
    expect(unreadCountForPillar(org, 1, { id: "u_self" }, commentsFor)).toBe(1);
  });
});
