// tests/domain/unread.test.js
// @ts-check
// Phase 5 Wave 4 Commit A (DATA-07 / H7 fix): the Phase 2 TEST-05 baseline
// pinned the BROKEN behaviour as regression evidence - this rewrite is the
// evidence of the cutover (the Wave 4 fix lands in the same commit as this
// test rewrite per D-10). Comparators now use server-time Timestamp via
// duck-typed toMillis() exclusively. The legacy domain-side write helper is
// DELETED - no shim test.

import { describe, it, expect, vi } from "vitest";
import {
  unreadCountForPillar,
  unreadCountTotal,
  unreadChatTotal,
} from "../../src/domain/unread.js";

// Duck-typed Timestamp factory (matches Firestore Timestamp.toMillis() shape)
/** @param {number} ms */
const ts = (ms) => ({ toMillis: () => ms });

describe("unreadCountForPillar (H7 fix - server-clock comparator)", () => {
  it("counts other-author comments after lastReadTs (inline duck-typed Timestamp)", () => {
    // Inline duck-typed { toMillis: () => N } proves comparator only consumes
    // server-time-shaped values; client clock is irrelevant.
    const lastReadTs = { toMillis: () => 999000 };
    const comments = [
      { authorId: "u_other", createdAt: { toMillis: () => 1000000 } },
    ];
    expect(unreadCountForPillar(lastReadTs, comments, "u_self")).toBe(1);
  });

  it("excludes self-authored comments", () => {
    expect(unreadCountForPillar(ts(999000), [
      { authorId: "u_self", createdAt: ts(1000000) },
    ], "u_self")).toBe(0);
  });

  it("treats lastReadTs=null as no-prior-read (counts all other-author comments)", () => {
    expect(unreadCountForPillar(null, [
      { authorId: "u_other", createdAt: ts(1000000) },
      { authorId: "u_other", createdAt: ts(2000000) },
    ], "u_self")).toBe(2);
  });

  it("treats lastReadTs=undefined as no-prior-read (defensive guard)", () => {
    expect(unreadCountForPillar(undefined, [
      { authorId: "u_other", createdAt: ts(1000000) },
    ], "u_self")).toBe(1);
  });

  it("skips comments with no createdAt (defensive guard)", () => {
    expect(unreadCountForPillar(ts(999000), [
      { authorId: "u_other" },
      { authorId: "u_other", createdAt: ts(1000000) },
    ], "u_self")).toBe(1);
  });

  it("excludes comments with createdAt before lastReadTs (inline duck-typed Timestamps)", () => {
    // Ensure inline literal Timestamp objects work in addition to the ts() factory.
    const lastReadTs = { toMillis: () => 2000000 };
    const before = { authorId: "u_other", createdAt: { toMillis: () => 1000000 } };
    const after  = { authorId: "u_other", createdAt: { toMillis: () => 3000000 } };
    expect(unreadCountForPillar(lastReadTs, [before, after], "u_self")).toBe(1);
  });

  it("handles empty comments list", () => {
    expect(unreadCountForPillar(ts(999000), [], "u_self")).toBe(0);
  });

  it("handles null/undefined comments list (defensive guard)", () => {
    expect(unreadCountForPillar(ts(999000), /** @type {any} */ (null), "u_self")).toBe(0);
    expect(unreadCountForPillar(ts(999000), /** @type {any} */ (undefined), "u_self")).toBe(0);
  });

  it("5-minute client clock skew does NOT change unread count (H7 / ROADMAP SC#4)", () => {
    // Inline duck-typed Timestamps - the comparator must NEVER reach for Date.now().
    const commentTs  = { toMillis: () => 1000000 };
    const lastReadTs = { toMillis: () => 999000 };
    const dateNowSpy = vi.spyOn(Date, "now");
    // +5min skew
    dateNowSpy.mockReturnValue(1000000 + 5 * 60 * 1000);
    expect(unreadCountForPillar(lastReadTs, [
      { authorId: "u_other", createdAt: commentTs },
    ], "u_self")).toBe(1);
    // -5min skew
    dateNowSpy.mockReturnValue(1000000 - 5 * 60 * 1000);
    expect(unreadCountForPillar(lastReadTs, [
      { authorId: "u_other", createdAt: commentTs },
    ], "u_self")).toBe(1);
    dateNowSpy.mockRestore();
  });
});

describe("unreadCountTotal", () => {
  it("sums unreadCountForPillar across pillars; missing pillarReads entry treated as null", () => {
    const pillarReads = { "1": ts(999000) };
    const commentsByPillar = {
      "1": [{ authorId: "u_other", createdAt: ts(1000000) }],
      "2": [{ authorId: "u_other", createdAt: ts(500) }],
    };
    expect(unreadCountTotal(pillarReads, commentsByPillar, "u_self", [{ id: 1 }, { id: 2 }])).toBe(2);
  });

  it("returns 0 for empty pillars list", () => {
    expect(unreadCountTotal({}, {}, "u_self", [])).toBe(0);
  });

  it("handles undefined pillarReads (defensive fallback)", () => {
    const commentsByPillar = {
      "1": [{ authorId: "u_other", createdAt: ts(1000000) }],
    };
    expect(unreadCountTotal(/** @type {any} */ (undefined), commentsByPillar, "u_self", [{ id: 1 }])).toBe(1);
  });

  it("missing commentsByPillar entry treated as empty list", () => {
    const pillarReads = { "1": ts(0) };
    expect(unreadCountTotal(pillarReads, {}, "u_self", [{ id: 1 }])).toBe(0);
  });
});

describe("unreadChatTotal (H7 fix - server-clock comparator)", () => {
  it("returns 0 for null user", () => {
    expect(unreadChatTotal(null, [], () => null)).toBe(0);
  });

  it("client user: counts only their org messages, server-clock vs server-clock", () => {
    const user = { id: "u_self", role: "client", orgId: "orgA" };
    /** @param {string} orgId */
    const lastReadForOrg = (orgId) => orgId === "orgA" ? ts(1000) : null;
    const messages = [
      { orgId: "orgA", authorId: "u_other", createdAt: ts(2000) },
      { orgId: "orgA", authorId: "u_other", createdAt: ts(500) },
      { orgId: "orgA", authorId: "u_self",  createdAt: ts(2000) },
      { orgId: "orgB", authorId: "u_other", createdAt: ts(2000) },
    ];
    expect(unreadChatTotal(user, messages, lastReadForOrg)).toBe(1);
  });

  it("client user with no lastReadForOrg entry counts all other-author org messages", () => {
    const user = { id: "u_self", role: "client", orgId: "orgA" };
    const lastReadForOrg = () => null;
    const messages = [
      { orgId: "orgA", authorId: "u_other", createdAt: ts(2000) },
      { orgId: "orgA", authorId: "u_other", createdAt: ts(500) },
    ];
    expect(unreadChatTotal(user, messages, lastReadForOrg)).toBe(2);
  });

  it("client user skips messages without createdAt (defensive guard)", () => {
    const user = { id: "u_self", role: "client", orgId: "orgA" };
    const lastReadForOrg = () => ts(0);
    const messages = [
      { orgId: "orgA", authorId: "u_other" },
      { orgId: "orgA", authorId: "u_other", createdAt: ts(2000) },
    ];
    expect(unreadChatTotal(user, /** @type {any} */ (messages), lastReadForOrg)).toBe(1);
  });

  it("client user with no orgId defaults to empty string", () => {
    const user = { id: "u_self", role: "client" };
    const lastReadForOrg = () => null;
    const messages = [
      { orgId: "", authorId: "u_other", createdAt: ts(2000) },
      { orgId: "orgA", authorId: "u_other", createdAt: ts(2000) },
    ];
    expect(unreadChatTotal(user, messages, lastReadForOrg)).toBe(1);
  });

  it("internal user: counts across all orgs via per-message lastReadForOrg lookup", () => {
    const user = { id: "u_self", role: "internal" };
    /** @param {string} orgId */
    const lastReadForOrg = (orgId) =>
      ({ orgA: ts(1000), orgB: ts(1500) })[orgId] || null;
    const messages = [
      { orgId: "orgA", authorId: "u_other", createdAt: ts(2000) },
      { orgId: "orgB", authorId: "u_other", createdAt: ts(1000) },
      { orgId: "orgA", authorId: "u_self",  createdAt: ts(2000) },
    ];
    expect(unreadChatTotal(user, messages, lastReadForOrg)).toBe(1);
  });

  it("internal user: skips messages without createdAt (defensive guard)", () => {
    const user = { id: "u_self", role: "internal" };
    const lastReadForOrg = () => ts(0);
    const messages = [
      { orgId: "orgA", authorId: "u_other" },
      { orgId: "orgA", authorId: "u_other", createdAt: ts(2000) },
    ];
    expect(unreadChatTotal(user, /** @type {any} */ (messages), lastReadForOrg)).toBe(1);
  });

  it("returns 0 when chatMessages is missing (defensive)", () => {
    const user = { id: "u_self", role: "internal" };
    expect(unreadChatTotal(user, /** @type {any} */ (null), () => null)).toBe(0);
  });
});

// Boundary tests - imports remain firebase-free + the legacy write helper DELETED
describe("domain/unread.js boundary", () => {
  it("does NOT import from firebase/* or data/* (Phase 4 ESLint Wave 4)", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/domain/unread.js", "utf-8");
    expect(src).not.toMatch(/from\s+["'](.*\/)?firebase\//);
    expect(src).not.toMatch(/from\s+["']\.\.\/data\//);
  });

  it("does NOT export markPillarRead - the iso write path is DELETED (DATA-07 / D-12 / D-18)", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/domain/unread.js", "utf-8");
    expect(src).not.toMatch(/export\s+function\s+markPillarRead/);
    expect(src).not.toMatch(/iso\(\)/);
    expect(src).not.toMatch(/from\s+["']\.\.\/util\/ids\.js["']/);
    expect(src).not.toMatch(/Date\.now\(/);
    expect(src).not.toMatch(/new\s+Date\(/);
  });

  it("src/main.js no longer references markPillarRead (callsite rewired to setPillarRead)", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/main.js", "utf-8");
    expect(src).not.toMatch(/markPillarRead/);
    expect(src).toMatch(/setPillarRead/);
    expect(src).toMatch(/from\s+["']\.\/data\/read-states\.js["']/);
  });
});
