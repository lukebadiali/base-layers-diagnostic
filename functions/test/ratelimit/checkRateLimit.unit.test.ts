// Phase 7 Wave 4 (FN-09 / 07-04): unit tests for the checkRateLimit
// fallback callable. Mirrors functions/test/auth/setClaims.unit.test.ts
// shape — pure-mocked, no Firestore emulator.
//
// Tests cover the Pattern A overlays (App Check via metadata, Zod input
// gate, ensureIdempotent ordering, Sentry passthrough) plus the FN-09
// token-bucket logic (count == 0 → set count:1; 0 < count < 30 → update
// count + 1; count >= 30 → throw resource-exhausted).

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const ensureIdempotentSpy = vi.fn();
const txGetSpy = vi.fn();
const txSetSpy = vi.fn();
const txUpdateSpy = vi.fn();
const runTransactionSpy = vi.fn();
const firestoreDocSpy = vi.fn(() => ({ __isRef: true }));

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    doc: firestoreDocSpy,
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
      runTransactionSpy(fn),
  }),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: (
    _opts: unknown,
    handler: (req: unknown) => Promise<unknown>,
  ) => handler,
  HttpsError: class HttpsError extends Error {
    public code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({ name, value: () => "" }),
}));

vi.mock("firebase-functions/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../src/util/idempotency.js", () => ({
  ensureIdempotent: (key: string, scope: string, windowSec: number) =>
    ensureIdempotentSpy(key, scope, windowSec),
}));

vi.mock("../../src/util/sentry.js", () => ({
  withSentry: <TIn, TOut>(h: (req: TIn) => Promise<TOut>) => h,
}));

const VALID_REQ_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  ensureIdempotentSpy.mockReset().mockResolvedValue(undefined);
  txGetSpy.mockReset();
  txSetSpy.mockReset();
  txUpdateSpy.mockReset();
  runTransactionSpy.mockReset().mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: txGetSpy,
        set: txSetSpy,
        update: txUpdateSpy,
      };
      return fn(tx);
    },
  );
  firestoreDocSpy.mockClear();
});

async function loadHandler(): Promise<
  (req: unknown) => Promise<unknown>
> {
  vi.resetModules();
  const mod = await import("../../src/ratelimit/checkRateLimit.js");
  return mod.checkRateLimit as unknown as (req: unknown) => Promise<unknown>;
}

const authedCtx = (uid = "user-1") => ({ uid, token: { role: "client" } });

// ─── Authentication gate ──────────────────────────────────────────────────

describe("checkRateLimit — auth gate", () => {
  it("throws HttpsError(unauthenticated) when request.auth is absent", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: null,
        data: { scope: "chat", clientReqId: VALID_REQ_ID },
      }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    expect(ensureIdempotentSpy).not.toHaveBeenCalled();
    expect(runTransactionSpy).not.toHaveBeenCalled();
  });
});

// ─── Zod input validation (FN-03) ─────────────────────────────────────────

describe("checkRateLimit — input validation", () => {
  it("throws HttpsError(invalid-argument) when scope is missing", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: authedCtx(),
        data: { clientReqId: VALID_REQ_ID },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws HttpsError(invalid-argument) when scope is not chat|comment", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: authedCtx(),
        data: { scope: "actions", clientReqId: VALID_REQ_ID },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws HttpsError(invalid-argument) when clientReqId is not a UUID", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: authedCtx(),
        data: { scope: "chat", clientReqId: "not-a-uuid" },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

// ─── Idempotency ordering (FN-03 / Pitfall 6) ─────────────────────────────

describe("checkRateLimit — idempotency before bucket mutation", () => {
  it("invokes ensureIdempotent BEFORE the transaction runs", async () => {
    const order: string[] = [];
    ensureIdempotentSpy.mockImplementation(async () => {
      order.push("ensureIdempotent");
    });
    runTransactionSpy.mockImplementation(async () => {
      order.push("runTransaction");
      return { ok: true, count: 1, limit: 30 };
    });

    const handler = await loadHandler();
    await handler({
      auth: authedCtx("user-x"),
      data: { scope: "chat", clientReqId: VALID_REQ_ID },
    });

    expect(order).toEqual(["ensureIdempotent", "runTransaction"]);
    // Canonical key shape: uid:checkRateLimit:scope:clientReqId
    expect(ensureIdempotentSpy).toHaveBeenCalledWith(
      `user-x:checkRateLimit:chat:${VALID_REQ_ID}`,
      "checkRateLimit",
      60,
    );
  });

  it("propagates already-exists from ensureIdempotent without touching the bucket", async () => {
    const HttpsErrorClass = (
      await import("firebase-functions/v2/https")
    ).HttpsError;
    ensureIdempotentSpy.mockRejectedValue(
      new HttpsErrorClass("already-exists", "duplicate"),
    );

    const handler = await loadHandler();
    await expect(
      handler({
        auth: authedCtx(),
        data: { scope: "chat", clientReqId: VALID_REQ_ID },
      }),
    ).rejects.toMatchObject({ code: "already-exists" });
    expect(runTransactionSpy).not.toHaveBeenCalled();
  });
});

// ─── Token-bucket logic (FN-09) ────────────────────────────────────────────

describe("checkRateLimit — token-bucket logic", () => {
  it("first call in window: count == 0 → tx.set with count:1; returns ok:true", async () => {
    txGetSpy.mockResolvedValue({
      exists: false,
      get: () => undefined,
    });

    const handler = await loadHandler();
    const result = await handler({
      auth: authedCtx("u1"),
      data: { scope: "chat", clientReqId: VALID_REQ_ID },
    });

    expect(result).toEqual({ ok: true, count: 1, limit: 30 });
    expect(txSetSpy).toHaveBeenCalledTimes(1);
    expect(txSetSpy.mock.calls[0][1]).toEqual({ uid: "u1", count: 1 });
    expect(txUpdateSpy).not.toHaveBeenCalled();
  });

  it("subsequent call in window: 0 < count < 30 → tx.update with count+1; returns ok:true", async () => {
    txGetSpy.mockResolvedValue({
      exists: true,
      get: (field: string) => (field === "count" ? 7 : undefined),
    });

    const handler = await loadHandler();
    const result = await handler({
      auth: authedCtx("u2"),
      data: { scope: "comment", clientReqId: VALID_REQ_ID },
    });

    expect(result).toEqual({ ok: true, count: 8, limit: 30 });
    expect(txUpdateSpy).toHaveBeenCalledTimes(1);
    expect(txUpdateSpy.mock.calls[0][1]).toEqual({ count: 8 });
    expect(txSetSpy).not.toHaveBeenCalled();
  });

  it("31st call: count >= 30 → throws HttpsError(resource-exhausted); no mutation", async () => {
    txGetSpy.mockResolvedValue({
      exists: true,
      get: (field: string) => (field === "count" ? 30 : undefined),
    });

    const handler = await loadHandler();
    await expect(
      handler({
        auth: authedCtx("u3"),
        data: { scope: "chat", clientReqId: VALID_REQ_ID },
      }),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
    expect(txSetSpy).not.toHaveBeenCalled();
    expect(txUpdateSpy).not.toHaveBeenCalled();
  });
});

// ─── Bucket path shape (FN-09) ─────────────────────────────────────────────

describe("checkRateLimit — bucket path shape", () => {
  it("doc path is rateLimits/{uid}/buckets/{currentWindow}", async () => {
    txGetSpy.mockResolvedValue({
      exists: false,
      get: () => undefined,
    });

    const handler = await loadHandler();
    await handler({
      auth: authedCtx("user-bucket"),
      data: { scope: "chat", clientReqId: VALID_REQ_ID },
    });

    expect(firestoreDocSpy).toHaveBeenCalledTimes(1);
    const pathArg = firestoreDocSpy.mock.calls[0][0] as unknown as string;
    expect(pathArg).toMatch(/^rateLimits\/user-bucket\/buckets\/\d+$/);
    // Window is a multiple of 60_000 ms (60s buckets).
    const win = Number(pathArg.split("/").pop());
    expect(win % 60_000).toBe(0);
  });
});
