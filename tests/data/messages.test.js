// tests/data/messages.test.js
// @ts-check
// Phase 5 Wave 3 (DATA-01 / 05-03): subcollection rewrite — H8-precursor wiring.
// messages.js now reads/writes orgs/{orgId}/messages/{msgId} directly via
// firebase/db.js. CRITICAL: subscribeMessages now subscribes to the
// SUBCOLLECTION (not the parent doc) — this is the H8-precursor wiring;
// Wave 4 Commit B finalises the H8 fix in data/cloud-sync.js.
// Phase 4 D-09 / D-10 API surface preserved verbatim.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1/messages/m1": {
      authorId: "u_a",
      legacyAuthorId: "u_a",
      body: "hello",
      // toMillis-bearing pseudo-timestamp so the sort comparator engages
      createdAt: { toMillis: () => 1 },
    },
    "orgs/o1/messages/m2": {
      authorId: "u_b",
      legacyAuthorId: "u_b",
      body: "world",
      createdAt: { toMillis: () => 2 },
    },
  },
}));

const { listMessages, addMessage, subscribeMessages } = await import("../../src/data/messages.js");

describe("data/messages.js (Phase 5 subcollection rewrite + onSnapshot)", () => {
  it("listMessages returns the seeded subcollection messages sorted by createdAt asc", async () => {
    const ms = await listMessages("o1");
    expect(ms.map((/** @type {any} */ m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("listMessages returns [] when the org has no messages subcollection docs", async () => {
    const ms = await listMessages("missing-org");
    expect(ms).toEqual([]);
  });

  it("addMessage writes to subcollection with serverTimestamp + legacyAuthorId; returns the new doc id", async () => {
    const id = await addMessage("o1", { authorId: "u_c", body: "later" });
    expect(id).toBeTruthy();
    const ms = await listMessages("o1");
    const added = ms.find((/** @type {any} */ m) => m.id === id);
    expect(added).toBeTruthy();
    expect(added.body).toBe("later");
    expect(added.authorId).toBe("u_c");
    expect(added.legacyAuthorId).toBe("u_c");
    expect(added.createdAt).toEqual({ __serverTimestamp: true });
  });

  it("subscribeMessages subscribes to the SUBCOLLECTION (not parent doc) — H8-precursor", () => {
    /** @type {Array<any[]>} */
    const received = [];
    const unsub = subscribeMessages("o1", {
      onChange: (ms) => received.push(ms),
      onError: () => {},
    });
    expect(typeof unsub).toBe("function");
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(received[0])).toBe(true);
    // Sorted by createdAt asc — m1 (toMillis=1) before m2 (toMillis=2).
    // Filter to just the seeded ids so the assertion is robust to any
    // addMessage-injected docs from earlier tests (the mock seed is shared
    // across `it`s within the same file).
    const seededIds = received[0]
      .filter((/** @type {any} */ m) => m.id === "m1" || m.id === "m2")
      .map((/** @type {any} */ m) => m.id);
    expect(seededIds).toEqual(["m1", "m2"]);
  });
});
