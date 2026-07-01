// tests/data/org-secrets.test.js
// @ts-check
// Unit tests for src/data/org-secrets.js. Mocks src/firebase/db.js so no
// Firestore connection is needed (mirrors tests/data/soft-deleted.test.js).
import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("../../src/firebase/db.js", () => {
  const store = new Map();
  return {
    db: { __mock: true },
    doc: vi.fn((_db, ...segments) => ({ __path: segments.join("/") })),
    getDoc: vi.fn(async (ref) => {
      const has = store.has(ref.__path);
      const data = store.get(ref.__path);
      return { exists: () => has, data: () => data };
    }),
    setDoc: vi.fn(async (ref, value) => {
      store.set(ref.__path, value);
    }),
    serverTimestamp: vi.fn(() => "SERVER_TS"),
    __store: store,
  };
});

const dbMod = await import("../../src/firebase/db.js");
const { setOrgPassphraseSecret, getOrgPassphraseSecret } = await import(
  "../../src/data/org-secrets.js"
);

describe("src/data/org-secrets.js", () => {
  beforeEach(() => {
    /** @type {any} */ (dbMod).__store.clear();
  });

  it("writes the plaintext passphrase to orgSecrets/{orgId} with a timestamp", async () => {
    await setOrgPassphraseSecret("orgA", "correct horse battery");
    const written = /** @type {any} */ (dbMod).__store.get("orgSecrets/orgA");
    expect(written.passphrase).toBe("correct horse battery");
    expect(written.updatedAt).toBe("SERVER_TS");
  });

  it("reads back the stored passphrase", async () => {
    await setOrgPassphraseSecret("orgA", "correct horse battery");
    expect(await getOrgPassphraseSecret("orgA")).toBe("correct horse battery");
  });

  it("returns null when no secret is stored for the org", async () => {
    expect(await getOrgPassphraseSecret("ghost")).toBeNull();
  });

  it("returns null when the doc exists but has no string passphrase field", async () => {
    // e.g. a partial/legacy doc — the ternary's false branch must return null,
    // not undefined.
    /** @type {any} */ (dbMod).__store.set("orgSecrets/orgA", { updatedAt: "SERVER_TS" });
    expect(await getOrgPassphraseSecret("orgA")).toBeNull();
  });

  it("returns null when the doc exists but its data is empty", async () => {
    // Guards the `snap.data() || {}` fallback (data() falsy while exists()).
    /** @type {any} */ (dbMod).__store.set("orgSecrets/orgA", undefined);
    expect(await getOrgPassphraseSecret("orgA")).toBeNull();
  });
});
