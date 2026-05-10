// Phase 7 Wave 6 (TEST-09 / 07-06): firebase-functions-test integration coverage
// for the checkRateLimit fallback callable (FN-09).
//
// Pattern 5b context: callable is deployed-but-not-live-wired. The primary
// rate-limit path is the firestore.rules `rateLimitOk(uid)` predicate
// composed on messages + comments create rules. This integration suite pins
// the callable's runtime behaviour for the operator hot-swap path.
//
// Pins:
//   - happy path: count under limit returns {ok:true, count, limit:30}
//   - resource-exhausted: 30+ writes in current window throws HttpsError

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import functionsTest from "firebase-functions-test";

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
}));

vi.mock("firebase-admin/firestore", async () => {
  const m = await import("../_mocks/admin-sdk.js");
  return {
    getFirestore: () => m.getFirestoreMock(),
    FieldValue: m.FieldValueMock,
  };
});

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({ name, value: () => "" }),
}));

vi.mock("firebase-functions/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());

const VALID_REQ_ID_A = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(async () => {
  const m = await import("../_mocks/admin-sdk.js");
  m.adminMockState._reset();
});

async function loadWrapped() {
  vi.resetModules();
  const mod = await import("../../src/ratelimit/checkRateLimit.js");
  return t.wrap(mod.checkRateLimit);
}

const userCtx = {
  uid: "rate-limited-user",
  token: { role: "internal" as const },
};

function currentWindowStart(): number {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

describe("checkRateLimit — integration (firebase-functions-test v3)", () => {
  it("happy path: count under limit returns {ok:true, count:1, limit:30} on first call", async () => {
    const wrapped = await loadWrapped();
    const result = (await wrapped({
      data: { scope: "chat", clientReqId: VALID_REQ_ID_A },
      auth: userCtx,
    } as never)) as { ok: boolean; count: number; limit: number };

    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(result.limit).toBe(30);

    const m = await import("../_mocks/admin-sdk.js");
    const winStart = currentWindowStart();
    const bucket = m.adminMockState._readDoc(
      `rateLimits/rate-limited-user/buckets/${winStart}`,
    );
    expect(bucket).toBeDefined();
    expect(bucket!.count).toBe(1);
  });

  it("resource-exhausted: count >= 30 throws HttpsError('resource-exhausted')", async () => {
    // Seed the current bucket at exactly 30 — next call should be rejected.
    const m = await import("../_mocks/admin-sdk.js");
    const winStart = currentWindowStart();
    m.adminMockState._seedDoc(
      `rateLimits/rate-limited-user/buckets/${winStart}`,
      { uid: "rate-limited-user", count: 30 },
    );

    const wrapped = await loadWrapped();
    await expect(
      wrapped({
        data: { scope: "comment", clientReqId: VALID_REQ_ID_A },
        auth: userCtx,
      } as never),
    ).rejects.toMatchObject({ code: "resource-exhausted" });
  });
});
