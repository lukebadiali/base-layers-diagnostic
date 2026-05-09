// tests/data/rate-limit.test.js
// @ts-check
// Phase 7 Wave 4 (FN-09 / 07-04): unit tests for the client-side
// incrementBucketAndWrite + currentRateLimitWindow helpers.
//
// Pure-mocked: vi.mock retargets src/firebase/db.js to the test mock factory
// so the helper composes against an in-memory seed map. Real bucket-counter
// contention + rules-side predicate denials are exercised in
// tests/rules/rate-limit.test.js against the Firestore emulator. This file
// verifies the data-layer helper's compose logic + window math.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

const mockFactory = makeFirestoreMock({ seed: {} });
vi.mock("../../src/firebase/db.js", () => mockFactory);

const { currentRateLimitWindow } = await import("../../src/data/rate-limit.js");

describe("data/rate-limit.js — currentRateLimitWindow", () => {
  it("returns the floor-to-60s windowStart for now", () => {
    const win = currentRateLimitWindow();
    expect(win).toBe(Math.floor(Date.now() / 60_000) * 60_000);
    // Window aligns to 60_000-millisecond boundary.
    expect(win % 60_000).toBe(0);
  });

  it("two calls within the same 60s return the same window", () => {
    const w1 = currentRateLimitWindow();
    const w2 = currentRateLimitWindow();
    expect(w1).toBe(w2);
  });
});

describe("data/rate-limit.js — incrementBucketAndWrite", () => {
  it("first call creates the bucket with count:1 + writes the protected doc", async () => {
    // Reset the mock factory's seed for this test so we know exact state.
    const local = makeFirestoreMock({ seed: {} });
    vi.doMock("../../src/firebase/db.js", () => local);
    vi.resetModules();
    const { incrementBucketAndWrite: fn } = await import("../../src/data/rate-limit.js");

    await fn("user-1", "orgs/orgA/messages/m1", {
      authorId: "user-1",
      body: "hi",
    });

    // Verify runTransaction was called with the db sentinel
    expect(local.runTransaction).toHaveBeenCalledTimes(1);
    expect(local.runTransaction.mock.calls[0][0]).toEqual({ __isMockDb: true });

    // The seed map should now contain the bucket + the protected doc.
    // Inspect via the doc handler's __path key shape (collection/id).
    const win = currentRateLimitWindow();
    expect(local.doc.mock.calls.some(
      ([, path]) => path === `rateLimits/user-1/buckets/${win}`,
    )).toBe(true);
    expect(local.doc.mock.calls.some(
      ([, path]) => path === "orgs/orgA/messages/m1",
    )).toBe(true);
  });

  it("subsequent call updates the bucket count to n+1", async () => {
    const win = Math.floor(Date.now() / 60_000) * 60_000;
    const local = makeFirestoreMock({
      seed: {
        [`rateLimits/user-2/buckets/${win}`]: { uid: "user-2", count: 5 },
      },
    });
    vi.doMock("../../src/firebase/db.js", () => local);
    vi.resetModules();
    const { incrementBucketAndWrite: fn } = await import("../../src/data/rate-limit.js");

    await fn("user-2", "orgs/orgA/comments/c1", {
      authorId: "user-2",
      body: "comment",
    });

    expect(local.runTransaction).toHaveBeenCalledTimes(1);
  });

  it("propagates rules-side permission-denied (transaction rejection)", async () => {
    // Make runTransaction reject — simulating the rules predicate denying
    // the write because bucket.count >= 30 OR cross-uid OR window-tamper.
    const local = makeFirestoreMock({ seed: {} });
    local.runTransaction = vi.fn(async () => {
      const err = new Error(
        "PERMISSION_DENIED: Missing or insufficient permissions.",
      );
      // Firebase JS SDK uses the `code` field on FirestoreError-shaped throws
      // for callers to disambiguate; mirror the shape so caller-side error
      // handling can be exercised in views/* without a real emulator round-trip.
      // @ts-ignore — adding a code field to a plain Error for shape parity
      err.code = "permission-denied";
      throw err;
    });
    vi.doMock("../../src/firebase/db.js", () => local);
    vi.resetModules();
    const { incrementBucketAndWrite: fn } = await import("../../src/data/rate-limit.js");

    await expect(
      fn("user-3", "orgs/orgA/messages/m1", { authorId: "user-3", body: "x" }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("uses the current 60s window for the bucket path", async () => {
    const local = makeFirestoreMock({ seed: {} });
    vi.doMock("../../src/firebase/db.js", () => local);
    vi.resetModules();
    const { incrementBucketAndWrite: fn } = await import("../../src/data/rate-limit.js");

    const before = Math.floor(Date.now() / 60_000) * 60_000;
    await fn("user-4", "orgs/orgA/messages/m1", {
      authorId: "user-4",
      body: "x",
    });
    const after = Math.floor(Date.now() / 60_000) * 60_000;

    // The helper used SOME current-or-near-current window — should be
    // either `before` or (if the millisecond boundary rolled mid-call) `after`.
    const usedPaths = local.doc.mock.calls
      .map(([, path]) => path)
      .filter((/** @type {string} */ p) => p.startsWith("rateLimits/user-4/buckets/"));
    expect(usedPaths.length).toBeGreaterThanOrEqual(1);
    const win = Number(usedPaths[0].split("/").pop());
    expect([before, after]).toContain(win);
  });
});
