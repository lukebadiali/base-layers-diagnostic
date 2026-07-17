// tests/domain/activity.test.js
// @ts-check
// Scope item 7 (2026-07): pure aggregation for the staff notification bell.
import { describe, it, expect } from "vitest";
import { activitySummary } from "../../src/domain/activity.js";

const ts = (/** @type {number} */ ms) => ({ toMillis: () => ms });
const METAS = [
  { id: "orgA", name: "Acme" },
  { id: "orgB", name: "Bravo" },
];

describe("activitySummary", () => {
  it("counts messages and documents newer than the org marker, excluding own items", () => {
    const activity = {
      messages: {
        orgA: [
          { authorId: "client1", createdAt: ts(2000) },
          { authorId: "me", createdAt: ts(3000) }, // own — excluded
          { authorId: "client1", createdAt: ts(500) }, // older than marker
        ],
      },
      documents: {
        orgA: [{ uploaderId: "client1", createdAt: ts(2500) }],
      },
    };
    const markers = { chatLastRead: { orgA: 1000 }, docsLastSeen: { orgA: 1000 } };
    const s = activitySummary(METAS, activity, markers, "me");
    expect(s.total).toBe(2);
    expect(s.orgs).toEqual([
      { orgId: "orgA", orgName: "Acme", chatCount: 1, docCount: 1, latestMs: 2500 },
    ]);
  });

  it("missing marker means everything foreign counts (epoch 0)", () => {
    const activity = {
      messages: { orgB: [{ authorId: "x", createdAt: ts(1) }] },
      documents: {},
    };
    const s = activitySummary(METAS, activity, { chatLastRead: {}, docsLastSeen: {} }, "me");
    expect(s.total).toBe(1);
    expect(s.orgs[0].orgId).toBe("orgB");
  });

  it("null/absent createdAt (pending server write) counts as newest", () => {
    const activity = {
      messages: { orgA: [{ authorId: "x" }] },
      documents: {},
    };
    const markers = { chatLastRead: { orgA: Date.now() + 100000 }, docsLastSeen: {} };
    const s = activitySummary(METAS, activity, markers, "me");
    expect(s.total).toBe(1);
    expect(s.orgs[0].latestMs).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("items exactly AT the marker do not count (strictly newer)", () => {
    const activity = {
      messages: { orgA: [{ authorId: "x", createdAt: ts(1000) }] },
      documents: {},
    };
    const s = activitySummary(
      METAS,
      activity,
      { chatLastRead: { orgA: 1000 }, docsLastSeen: {} },
      "me",
    );
    expect(s.total).toBe(0);
    expect(s.orgs).toEqual([]);
  });

  it("sorts orgs by latest activity, newest first", () => {
    const activity = {
      messages: {
        orgA: [{ authorId: "x", createdAt: ts(100) }],
        orgB: [{ authorId: "x", createdAt: ts(900) }],
      },
      documents: {},
    };
    const s = activitySummary(METAS, activity, { chatLastRead: {}, docsLastSeen: {} }, "me");
    expect(s.orgs.map((o) => o.orgId)).toEqual(["orgB", "orgA"]);
  });

  it("legacy ISO-string createdAt is compared against the marker like a Timestamp", () => {
    const older = new Date(500).toISOString();
    const newer = new Date(2000).toISOString();
    const activity = {
      messages: {
        orgA: [
          { authorId: "x", createdAt: older }, // older than marker — excluded
          { authorId: "x", createdAt: newer }, // newer than marker — counted
        ],
      },
      documents: {},
    };
    const s = activitySummary(
      METAS,
      activity,
      { chatLastRead: { orgA: 1000 }, docsLastSeen: {} },
      "me",
    );
    expect(s.total).toBe(1);
    expect(s.orgs[0].latestMs).toBe(2000);
  });

  it("authorless items are skipped — they can't be attributed, so they can't be excluded as 'own' either; treat as unattributable rather than risk an undefined-matches-undefined false exclusion", () => {
    const activity = {
      messages: { orgA: [{ createdAt: ts(2000) }] }, // no authorId field at all
      documents: {},
    };
    const s = activitySummary(
      METAS,
      activity,
      { chatLastRead: { orgA: 1000 }, docsLastSeen: {} },
      "me",
    );
    expect(s.total).toBe(0);
    expect(s.orgs).toEqual([]);
  });

  it("unknown orgIds in activity (meta not loaded yet) are skipped, and empty inputs are safe", () => {
    const activity = { messages: { ghost: [{ authorId: "x", createdAt: ts(5) }] }, documents: {} };
    const s = activitySummary(METAS, activity, { chatLastRead: {}, docsLastSeen: {} }, "me");
    expect(s.total).toBe(0);
    expect(
      activitySummary(
        [],
        { messages: {}, documents: {} },
        { chatLastRead: {}, docsLastSeen: {} },
        "me",
      ).total,
    ).toBe(0);
  });

  it("skips null entries in an org's list without counting or throwing", () => {
    const activity = {
      messages: { orgA: [null, { authorId: "x", createdAt: ts(2000) }] },
      documents: {},
    };
    const s = activitySummary(
      METAS,
      activity,
      { chatLastRead: { orgA: 1000 }, docsLastSeen: {} },
      "me",
    );
    expect(s.total).toBe(1);
  });

  it("an unparseable string createdAt falls back to epoch 0", () => {
    const activity = {
      messages: { orgA: [{ authorId: "x", createdAt: "not-a-date" }] },
      documents: {},
    };
    // Marker below 0 so the epoch-0 fallback still reads as newer and counts.
    const s = activitySummary(
      METAS,
      activity,
      { chatLastRead: { orgA: -1 }, docsLastSeen: {} },
      "me",
    );
    expect(s.total).toBe(1);
    expect(s.orgs[0].latestMs).toBe(0);
  });

  it("keeps the newest latestMs when a later item in the list is older", () => {
    const activity = {
      messages: {
        orgA: [
          { authorId: "x", createdAt: ts(3000) },
          { authorId: "y", createdAt: ts(2000) }, // counted, but older — must not lower latestMs
        ],
      },
      documents: {},
    };
    const s = activitySummary(
      METAS,
      activity,
      { chatLastRead: { orgA: 1000 }, docsLastSeen: {} },
      "me",
    );
    expect(s.total).toBe(2);
    expect(s.orgs[0].latestMs).toBe(3000);
  });

  it("tolerates activity and marker objects missing their sub-maps", () => {
    const s = activitySummary(METAS, /** @type {any} */ ({}), /** @type {any} */ ({}), "me");
    expect(s.total).toBe(0);
    expect(s.orgs).toEqual([]);
  });

  it("excludes soft-deleted messages from the bell count", () => {
    const activity = {
      messages: {
        orgA: [
          { authorId: "x", createdAt: ts(2000), deletedAt: ts(2500) }, // deleted -> excluded
          { authorId: "x", createdAt: ts(2000) }, // live -> counted
        ],
      },
      documents: {},
    };
    const s = activitySummary(
      METAS,
      activity,
      { chatLastRead: { orgA: 1000 }, docsLastSeen: {} },
      "me",
    );
    expect(s.total).toBe(1);
  });

  it("tolerates a null orgMetas list", () => {
    const s = activitySummary(
      /** @type {any} */ (null),
      { messages: {}, documents: {} },
      { chatLastRead: {}, docsLastSeen: {} },
      "me",
    );
    expect(s).toEqual({ total: 0, orgs: [] });
  });
});
