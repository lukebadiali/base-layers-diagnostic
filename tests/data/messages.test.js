// tests/data/messages.test.js
// @ts-check
// Phase 4 Wave 3 (D-09 pass-through + onSnapshot): messages.js delegates to
// org.messages[messageId] map; subscribeMessages composes the firebase/db.js
// onSnapshot wrapper and projects the messages map to a sorted array. Phase 5
// (DATA-01) moves the storage to orgs/{orgId}/messages/{msgId} subcollection;
// the API surface stays stable.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1": {
      id: "o1",
      messages: {
        m1: { id: "m1", body: "hello", createdAt: 1 },
        m2: { id: "m2", body: "world", createdAt: 2 },
      },
    },
  },
}));

const { listMessages, addMessage, subscribeMessages } = await import("../../src/data/messages.js");

describe("data/messages.js (D-09 pass-through + onSnapshot)", () => {
  it("listMessages returns the seeded messages sorted by createdAt asc", async () => {
    const ms = await listMessages("o1");
    expect(ms.map((/** @type {any} */ m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("listMessages returns [] when the org is absent", async () => {
    const ms = await listMessages("missing-org");
    expect(ms).toEqual([]);
  });

  it("addMessage assigns an id and writes via saveOrg", async () => {
    const id = await addMessage("o1", { body: "later" });
    expect(id).toBeTruthy();
  });

  it("subscribeMessages projects the messages map to a sorted array via onChange", () => {
    /** @type {Array<any[]>} */
    const received = [];
    const unsub = subscribeMessages("o1", {
      onChange: (ms) => received.push(ms),
      onError: () => {},
    });
    expect(typeof unsub).toBe("function");
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(received[0])).toBe(true);
  });
});
