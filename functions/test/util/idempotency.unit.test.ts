// Phase 7 Wave 1 (FN-03 / Pitfall 6): unit tests for ensureIdempotent.
// Uses vi.useFakeTimers + an in-memory IdempotencyStore stand-in to verify
// the 5-min TTL + sharding logic without booting the Firestore emulator.
// Mirrors functions/test/csp/dedup.test.ts harness shape.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ensureIdempotent,
  isDuplicateForTest,
  pathForKey,
  _setStoreForTest,
  _resetForTest,
  type IdempotencyStore,
} from "../../src/util/idempotency.js";

interface StoredEntry {
  scope: string;
  atMillis: number;
}

function makeMemoryStore(): IdempotencyStore & {
  data: Map<string, StoredEntry>;
} {
  const data = new Map<string, StoredEntry>();
  return {
    data,
    async get(path: string) {
      const entry = data.get(path);
      if (!entry) return { exists: false, atMillis: null };
      return { exists: true, atMillis: entry.atMillis };
    },
    async set(path: string, scope: string) {
      // FieldValue.serverTimestamp() in production; in-memory test uses Date.now().
      data.set(path, { scope, atMillis: Date.now() });
    },
  };
}

const WINDOW_SEC = 5 * 60;

let mem: ReturnType<typeof makeMemoryStore>;

beforeEach(() => {
  mem = makeMemoryStore();
  _setStoreForTest(mem);
  vi.useFakeTimers();
  // Anchor wall clock so Date.now() inside the helper is deterministic.
  vi.setSystemTime(new Date("2026-05-09T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  _resetForTest();
});

describe("ensureIdempotent — fresh-key write (Test 1)", () => {
  it("resolves and writes an idempotency marker when the key has not been seen", async () => {
    await expect(
      ensureIdempotent("k1", "scope-a", WINDOW_SEC),
    ).resolves.toBeUndefined();

    const path = pathForKey("k1");
    expect(mem.data.has(path)).toBe(true);
    expect(mem.data.get(path)?.scope).toBe("scope-a");
  });
});

describe("ensureIdempotent — duplicate within window (Test 2)", () => {
  it("throws HttpsError(already-exists) when the same key is replayed inside the window", async () => {
    await ensureIdempotent("k1", "setClaims", WINDOW_SEC);

    // Advance just inside the 5-min window (4m59.999s).
    vi.advanceTimersByTime(WINDOW_SEC * 1000 - 1);

    await expect(
      ensureIdempotent("k1", "setClaims", WINDOW_SEC),
    ).rejects.toMatchObject({
      code: "already-exists",
      message: expect.stringContaining("setClaims"),
    });
  });
});

describe("ensureIdempotent — TTL expiry (Test 3)", () => {
  it("resolves again when the same key replays after the window has elapsed", async () => {
    await ensureIdempotent("k1", "setClaims", WINDOW_SEC);

    // Cross the 5-min boundary by 1ms.
    vi.advanceTimersByTime(WINDOW_SEC * 1000 + 1);

    await expect(
      ensureIdempotent("k1", "setClaims", WINDOW_SEC),
    ).resolves.toBeUndefined();
  });
});

describe("ensureIdempotent — sharding (Test 4)", () => {
  it("derives shard from first 2 chars of the key", () => {
    expect(pathForKey("abcd")).toBe("idempotency/ab/keys/abcd");
    expect(pathForKey("xy:setClaims:user1:reqid")).toBe(
      "idempotency/xy/keys/xy:setClaims:user1:reqid",
    );
  });

  it("padEnds 1-char keys to 2-char shard with literal '0' so sharding is deterministic", () => {
    expect(pathForKey("a")).toBe("idempotency/a0/keys/a");
  });

  it("writes the marker into the sharded path, not a flat collection", async () => {
    await ensureIdempotent("zk-9", "scope", WINDOW_SEC);
    expect(mem.data.has("idempotency/zk/keys/zk-9")).toBe(true);
  });
});

describe("isDuplicateForTest — read-only window check", () => {
  it("returns false when the key has not been written", async () => {
    expect(await isDuplicateForTest("never-seen", WINDOW_SEC)).toBe(false);
  });

  it("returns true when the key was written within the window", async () => {
    await ensureIdempotent("k1", "scope", WINDOW_SEC);
    expect(await isDuplicateForTest("k1", WINDOW_SEC)).toBe(true);
  });

  it("returns false when the key has aged past the window", async () => {
    await ensureIdempotent("k1", "scope", WINDOW_SEC);
    vi.advanceTimersByTime(WINDOW_SEC * 1000 + 1);
    expect(await isDuplicateForTest("k1", WINDOW_SEC)).toBe(false);
  });
});
