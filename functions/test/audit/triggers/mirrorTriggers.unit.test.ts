// Phase 7 Wave 2 (FN-01 / AUDIT-04): wiring unit tests for the three
// Firestore-trigger mirror writers (onOrgDelete / onUserDelete /
// onDocumentDelete). Pure-mocked — no emulator. Wave 6 TEST-09 covers the
// firebase-functions-test integration path.
//
// Pins:
//   - Each trigger writes a `{type}.delete.mirror` audit row when NO primary
//     `data.{type}.softDelete` (or `data.{type}.delete` for user/document)
//     event exists in the auditLog/ collection within the last 60s.
//   - Each trigger SKIPS the audit write (logs `audit.mirror.skipped`) when
//     a primary event with matching `target.id` exists in the 60s window.
//   - Each trigger calls `writeAuditEvent` with `actor: {uid:"system", role:"system", ...}`
//     and an `idempotencyKey` of the shape `mirror:{type}:{id}:{eventId}`.
//   - The 60s dedup query uses .where("type","==", primaryType)
//     + .where("target.id","==", id) + .where("at", ">", new Date(now-60000))
//     + .limit(1).

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Shared mocks ────────────────────────────────────────────────────────────

const writeAuditEventSpy = vi.fn();
const limitSpy = vi.fn();
const whereSpy = vi.fn();
const collectionSpy = vi.fn();

// Build a chainable .where().where().where().limit().get() shape backed by the
// `recentEmpty` flag and `recentDocs` payload below.
let recentEmpty = true;
let recentDocs: Array<{ data: () => Record<string, unknown> }> = [];

function buildQuery(): {
  where: typeof whereSpy;
  limit: typeof limitSpy;
  get: () => Promise<{ empty: boolean; docs: typeof recentDocs }>;
} {
  const q = {
    where: (...args: unknown[]) => {
      whereSpy(...args);
      return q;
    },
    limit: (...args: unknown[]) => {
      limitSpy(...args);
      return q;
    },
    get: async () => ({ empty: recentEmpty, docs: recentDocs }),
  } as unknown as {
    where: typeof whereSpy;
    limit: typeof limitSpy;
    get: () => Promise<{ empty: boolean; docs: typeof recentDocs }>;
  };
  return q;
}

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
}));

const SERVER_TS = { __serverTs: true };
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: (...args: unknown[]) => {
      collectionSpy(...args);
      return buildQuery();
    },
  }),
  FieldValue: { serverTimestamp: () => SERVER_TS },
}));

// onDocumentDeleted / onUserDeleted: pass through (opts, handler) so the test
// invokes the handler directly with a synthetic event.
vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentDeleted: (
    _opts: unknown,
    handler: (event: unknown) => Promise<unknown>,
  ) => handler,
}));

// v1 auth.user().onDelete() chain — the v2 firebase-functions API does not
// yet ship an onUserDeleted equivalent (verified 2026-05-09 firebase-functions
// 7.2.5). Returns the handler directly so the test invokes it with a
// synthetic UserRecord.
vi.mock("firebase-functions/v1", () => {
  const onDelete = (handler: (user: unknown) => Promise<unknown>) => handler;
  const userBuilder = { onDelete };
  const auth = { user: () => userBuilder };
  const regionBuilder = { auth };
  const runWithBuilder = { region: () => regionBuilder };
  return {
    runWith: () => runWithBuilder,
    auth,
  };
});

vi.mock("firebase-functions/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../src/audit/auditLogger.js", () => ({
  writeAuditEvent: (input: unknown, ctx: unknown) =>
    writeAuditEventSpy(input, ctx),
}));

beforeEach(() => {
  writeAuditEventSpy.mockReset().mockResolvedValue(undefined);
  whereSpy.mockReset();
  limitSpy.mockReset();
  collectionSpy.mockReset();
  recentEmpty = true;
  recentDocs = [];
});

// ─── onOrgDelete ─────────────────────────────────────────────────────────────

async function loadOnOrgDelete(): Promise<
  (event: unknown) => Promise<unknown>
> {
  vi.resetModules();
  const mod = await import("../../../src/audit/triggers/onOrgDelete.js");
  return mod.onOrgDelete as unknown as (event: unknown) => Promise<unknown>;
}

describe("onOrgDelete — mirror writer (Test 1 / FN-01 / AUDIT-04)", () => {
  it("writes data.org.delete.mirror when no primary event exists in 60s", async () => {
    const handler = await loadOnOrgDelete();
    await handler({
      params: { orgId: "org-test-1" },
      data: { data: () => ({ name: "Old Org" }) },
    });

    expect(collectionSpy).toHaveBeenCalledWith("auditLog");
    // 3 .where() calls: type, target.id, at.
    expect(whereSpy).toHaveBeenCalledTimes(3);
    expect(limitSpy).toHaveBeenCalledWith(1);

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [input, ctx] = writeAuditEventSpy.mock.calls[0];
    expect(input.type).toBe("data.org.delete.mirror");
    expect(input.severity).toBe("warning");
    expect(input.target).toEqual({
      type: "org",
      id: "org-test-1",
      orgId: "org-test-1",
      snapshot: { name: "Old Org" },
    });
    expect(input.payload).toEqual({
      source: "trigger",
      reason: "no-primary-audit-found",
    });
    expect(ctx.actor).toEqual({
      uid: "system",
      email: null,
      role: "system",
      orgId: null,
    });
    expect(typeof ctx.idempotencyKey).toBe("string");
    expect(ctx.idempotencyKey).toMatch(/^mirror:org:org-test-1:/);
    expect(typeof ctx.eventId).toBe("string");
  });

  it("dedup-queries auditLog by type=data.org.softDelete + target.id + at>now-60s", async () => {
    const handler = await loadOnOrgDelete();
    await handler({
      params: { orgId: "org-dq" },
      data: { data: () => ({}) },
    });

    const args = whereSpy.mock.calls;
    expect(args[0]).toEqual(["type", "==", "data.org.softDelete"]);
    expect(args[1]).toEqual(["target.id", "==", "org-dq"]);
    // Third .where() is `at > new Date(now-60_000)` — assert the operator.
    expect(args[2][0]).toBe("at");
    expect(args[2][1]).toBe(">");
    expect(args[2][2]).toBeInstanceOf(Date);
  });

  it("skips the audit write when a primary event exists in the 60s window", async () => {
    recentEmpty = false;
    recentDocs = [{ data: () => ({ type: "data.org.softDelete" }) }];

    const handler = await loadOnOrgDelete();
    await handler({
      params: { orgId: "org-dup" },
      data: { data: () => ({}) },
    });

    expect(writeAuditEventSpy).not.toHaveBeenCalled();
  });

  it("tolerates a missing event.data (deleted doc payload absent)", async () => {
    const handler = await loadOnOrgDelete();
    await handler({
      params: { orgId: "org-no-snap" },
      data: undefined,
    });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [input] = writeAuditEventSpy.mock.calls[0];
    // snapshot field is omitted (Zod schema marks it optional); writer passes
    // `undefined` so the field is absent on the auditLog row.
    expect(input.target.snapshot).toBeUndefined();
  });
});

// ─── onUserDelete ────────────────────────────────────────────────────────────

async function loadOnUserDelete(): Promise<
  (event: unknown) => Promise<unknown>
> {
  vi.resetModules();
  const mod = await import("../../../src/audit/triggers/onUserDelete.js");
  return mod.onUserDelete as unknown as (event: unknown) => Promise<unknown>;
}

describe("onUserDelete — mirror writer (Test 2 / FN-01 / AUDIT-04)", () => {
  // v1 auth.user().onDelete(handler) — handler is invoked with the
  // UserRecord directly (NOT wrapped in event.data.* like v2 triggers).
  it("writes data.user.delete.mirror when no primary event exists in 60s", async () => {
    const handler = await loadOnUserDelete();
    await handler({ uid: "user-test-1", email: "x@example.com" });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [input, ctx] = writeAuditEventSpy.mock.calls[0];
    expect(input.type).toBe("data.user.delete.mirror");
    expect(input.target.type).toBe("user");
    expect(input.target.id).toBe("user-test-1");
    expect(ctx.actor.role).toBe("system");
    expect(ctx.idempotencyKey).toMatch(/^mirror:user:user-test-1:/);
  });

  it("dedup-queries auditLog by type=data.user.delete + target.id + at>now-60s", async () => {
    const handler = await loadOnUserDelete();
    await handler({ uid: "u-dq" });

    const args = whereSpy.mock.calls;
    expect(args[0]).toEqual(["type", "==", "data.user.delete"]);
    expect(args[1]).toEqual(["target.id", "==", "u-dq"]);
  });

  it("skips when a primary event exists in the 60s window", async () => {
    recentEmpty = false;
    recentDocs = [{ data: () => ({}) }];

    const handler = await loadOnUserDelete();
    await handler({ uid: "u-dup" });

    expect(writeAuditEventSpy).not.toHaveBeenCalled();
  });
});

// ─── onDocumentDelete ────────────────────────────────────────────────────────

async function loadOnDocumentDelete(): Promise<
  (event: unknown) => Promise<unknown>
> {
  vi.resetModules();
  const mod = await import(
    "../../../src/audit/triggers/onDocumentDelete.js"
  );
  return mod.onDocumentDelete as unknown as (
    event: unknown,
  ) => Promise<unknown>;
}

describe("onDocumentDelete — mirror writer (Test 3 / FN-01 / AUDIT-04)", () => {
  it("writes data.document.delete.mirror when no primary event exists", async () => {
    const handler = await loadOnDocumentDelete();
    await handler({
      params: { orgId: "orgA", docId: "doc-test-1" },
      data: { data: () => ({ storagePath: "p" }) },
    });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [input, ctx] = writeAuditEventSpy.mock.calls[0];
    expect(input.type).toBe("data.document.delete.mirror");
    expect(input.target.type).toBe("document");
    expect(input.target.id).toBe("doc-test-1");
    expect(input.target.orgId).toBe("orgA");
    expect(ctx.idempotencyKey).toMatch(/^mirror:document:doc-test-1:/);
  });

  it("dedup-queries auditLog by type=data.document.delete + target.id + at>now-60s", async () => {
    const handler = await loadOnDocumentDelete();
    await handler({
      params: { orgId: "orgA", docId: "doc-dq" },
      data: { data: () => ({}) },
    });

    const args = whereSpy.mock.calls;
    expect(args[0]).toEqual(["type", "==", "data.document.delete"]);
    expect(args[1]).toEqual(["target.id", "==", "doc-dq"]);
  });

  it("skips when a primary event exists in the 60s window", async () => {
    recentEmpty = false;
    recentDocs = [{ data: () => ({}) }];

    const handler = await loadOnDocumentDelete();
    await handler({
      params: { orgId: "orgA", docId: "doc-dup" },
      data: { data: () => ({}) },
    });

    expect(writeAuditEventSpy).not.toHaveBeenCalled();
  });
});
