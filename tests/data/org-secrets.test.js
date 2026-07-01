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
});
