// tests/data/users.test.js
// @ts-check
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: { "users/u1": { id: "u1", email: "luke@bedeveloped.local", name: "Luke" } },
}));

const { getUser, listUsers, saveUser, deleteUser, subscribeUsers } = await import("../../src/data/users.js");

describe("data/users.js (D-09 full owner)", () => {
  it("getUser returns the seeded doc", async () => {
    const u = await getUser("u1");
    expect(u).toEqual({ id: "u1", email: "luke@bedeveloped.local", name: "Luke" });
  });

  it("getUser returns null when the doc is absent", async () => {
    const u = await getUser("missing");
    expect(u).toBeNull();
  });

  it("listUsers returns an array of seeded users with id merged", async () => {
    const list = await listUsers();
    expect(list.find((/** @type {any} */ u) => u.id === "u1")).toBeTruthy();
  });

  it("saveUser merges the doc", async () => {
    await saveUser({ id: "u2", email: "george@bedeveloped.local", name: "George" });
    const u = await getUser("u2");
    expect(u).toBeTruthy();
    expect(u.name).toBe("George");
  });

  it("deleteUser removes the doc", async () => {
    await deleteUser("u1");
    const u = await getUser("u1");
    expect(u).toBeNull();
  });

  it("subscribeUsers returns an unsubscribe function and fires onChange initially", () => {
    /** @type {any[]} */
    const received = [];
    const unsub = subscribeUsers({
      onChange: (users) => received.push(users),
      onError: () => {},
    });
    expect(typeof unsub).toBe("function");
    expect(received.length).toBeGreaterThanOrEqual(1);
  });
});
