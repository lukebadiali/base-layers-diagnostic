// Phase 9 Wave 5 (OBS-05 / FN-01 / Task 1b): behaviour tests for the four
// anomaly rules in functions/src/observability/authAnomalyAlert.ts.
//
// Trimmed from 10 → 6 per the plan's WARNING 5 split:
//   T1: Rule 1 burst — first 5 events increment, 6th fires Slack
//   T2: Rule 1 dedup — 7th, 8th events do NOT re-fire Slack
//   T3: Rule 1 window expiry — counter resets, fresh threshold-cross fires
//   T4: Rule 3 role-escalation positive — internal→admin fires Slack
//   T5: Rule 3 role-escalation negative — admin→admin does NOT fire Slack
//   T6: Rule 4 unusual-hour — UTC 23 fires Slack; UTC 14 does NOT
//
// Rule 2 (MFA disenrol) is DORMANT (no current emit source); a passing test
// would assert against fake input that never appears in production. Rules 1-3
// indirectly exercise the postToSlack helper through _handleAuditEvent.
//
// Tests drive the test-only `_handleAuditEvent` export from authAnomalyAlert.ts
// — pure handler with injected `now` (time control) + injected `postToSlackFn`
// (Slack mock) + injected fake-Firestore. No vi.mock of firebase-* SDKs
// needed for the handler itself, only the trigger envelope (which is not
// exercised here — we test the rule body directly).

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks for the secret/logger/admin-app machinery loaded at module level ──
//
// authAnomalyAlert.ts pulls these in at import time (defineSecret +
// initializeApp). We mock them so the module loads without errors but the
// handler under test (_handleAuditEvent) is fully isolated.

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
}));

vi.mock("firebase-admin/firestore", () => {
  // FieldValue.increment / .serverTimestamp must be opaque sentinel values —
  // tests don't rely on their identity, only that the test's `tx.set` /
  // `tx.update` Map is mutated in the right shape.
  const FieldValue = {
    increment: (n: number) => ({ __increment: n }),
    serverTimestamp: () => ({ __serverTimestamp: true }),
  };
  // Minimal Timestamp shim — only `.toMillis()` is consumed by Rule 4.
  class Timestamp {
    private _ms: number;
    constructor(ms: number) {
      this._ms = ms;
    }
    static fromMillis(ms: number): Timestamp {
      return new Timestamp(ms);
    }
    toMillis(): number {
      return this._ms;
    }
  }
  return {
    getFirestore: () => ({
      doc: () => ({}),
      runTransaction: async () => 0,
    }),
    FieldValue,
    Timestamp,
  };
});

vi.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: (
    _opts: unknown,
    _handler: (event: unknown) => Promise<unknown>,
  ) => _handler,
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

// withSentry passthrough so the module loads cleanly.
vi.mock("../../src/util/sentry.js", () => ({
  withSentry: <TIn, TOut>(h: (req: TIn) => Promise<TOut>) => h,
}));

// ─── Fake Firestore for Rule 1 testing ───────────────────────────────────────
//
// Backs an in-memory Map<string, {count, windowStart}> keyed by doc-ref path.
// runTransaction(cb) invokes cb with a fake `tx` shape that the handler uses:
//   tx.get(ref)         → snap with .exists + .data()
//   tx.set(ref, val)    → write the val (replaces)
//   tx.update(ref, val) → merge the val (handles {count: FieldValue.increment(1)})
//
// The handler's transaction body returns the per-tx-pass `next` count; we
// surface that via runTransaction's resolved value.

interface CounterDoc {
  count: number;
  windowStart: number;
  lastSeenAt?: unknown;
}

function makeFakeFirestore(initialState?: Record<string, CounterDoc>) {
  const store = new Map<string, CounterDoc>();
  if (initialState) {
    for (const [k, v] of Object.entries(initialState)) store.set(k, { ...v });
  }
  function doc(path: string) {
    return { _path: path };
  }
  async function runTransaction<T>(
    cb: (tx: {
      get: (ref: { _path: string }) => Promise<{
        exists: boolean;
        data: () => CounterDoc | undefined;
      }>;
      set: (ref: { _path: string }, val: CounterDoc) => void;
      update: (
        ref: { _path: string },
        val: { count: { __increment: number }; lastSeenAt?: unknown },
      ) => void;
    }) => Promise<T>,
  ): Promise<T> {
    const tx = {
      get: async (ref: { _path: string }) => {
        const cur = store.get(ref._path);
        return {
          exists: cur !== undefined,
          data: () => cur,
        };
      },
      set: (ref: { _path: string }, val: CounterDoc) => {
        store.set(ref._path, { ...val });
      },
      update: (
        ref: { _path: string },
        val: { count: { __increment: number }; lastSeenAt?: unknown },
      ) => {
        const cur = store.get(ref._path);
        if (!cur) throw new Error(`fake-tx update on missing doc ${ref._path}`);
        store.set(ref._path, {
          ...cur,
          count: cur.count + (val.count?.__increment ?? 0),
          lastSeenAt: val.lastSeenAt,
        });
      },
    };
    return cb(tx);
  }
  return {
    _store: store,
    doc,
    runTransaction,
  };
}

// Stub firestore that throws on any access — used by Tests 4-6 (Rules 3, 4)
// where Rule 1 should never be reached. Confirms the early-return scoping is
// correct (no Firestore call on non-Rule-1 types).
function makeStubFirestore() {
  return {
    doc: () => {
      throw new Error("Rule 1 firestore should NOT be reached for non-auth.signin.failure events");
    },
    runTransaction: () => {
      throw new Error("Rule 1 runTransaction should NOT be reached for non-auth.signin.failure events");
    },
  };
}

// ─── Module loader (lazy) ────────────────────────────────────────────────────

async function loadHandler(): Promise<{
  _handleAuditEvent: (
    audit: Record<string, unknown> | undefined,
    now: number,
    postToSlackFn: (payload: { text: string }) => Promise<void>,
    firestore: unknown,
  ) => Promise<void>;
  Timestamp: { fromMillis: (ms: number) => unknown };
}> {
  const mod = await import("../../src/observability/authAnomalyAlert.js");
  const { Timestamp } = await import("firebase-admin/firestore");
  return {
    _handleAuditEvent: mod._handleAuditEvent as never,
    Timestamp: Timestamp as { fromMillis: (ms: number) => unknown },
  };
}

const FIXED_NOW = 1_700_000_000_000; // arbitrary unix-ms anchor for window logic
const IP = "1.2.3.4";

// authAnomalyAlert.ts:115 hashes the IP via sha256, slices first 16 hex chars.
// Pre-computed for IP="1.2.3.4" to assert exact ipHash in store keys.
import { createHash } from "node:crypto";
const IP_HASH = createHash("sha256").update(IP).digest("hex").slice(0, 16);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Test 1: Rule 1 burst — first 5 events increment, 6th fires Slack ────────

describe("authAnomalyAlert — Rule 1 (auth-fail burst)", () => {
  it("Test 1: first 5 events increment counter; 6th event fires Slack EXACTLY ONCE", async () => {
    const { _handleAuditEvent } = await loadHandler();
    const firestore = makeFakeFirestore();
    const slack = vi.fn(async () => undefined);

    const event = {
      type: "auth.signin.failure",
      ip: IP,
      actor: { uid: null },
    };

    // Drive 6 events at the same `now` so window stays open.
    for (let i = 0; i < 6; i++) {
      await _handleAuditEvent(event, FIXED_NOW, slack, firestore as never);
    }

    // Slack fires EXACTLY ONCE on the 6th event (count === FAIL_LIMIT+1 boundary).
    expect(slack).toHaveBeenCalledTimes(1);
    const slackCall = slack.mock.calls[0][0] as { text: string };
    expect(slackCall.text).toMatch(/Auth-fail burst/);
    expect(slackCall.text).toContain(IP_HASH);

    // Counter is at 6 in the store after the burst.
    const stored = firestore._store.get(`authFailureCounters/${IP_HASH}`);
    expect(stored?.count).toBe(6);
    expect(stored?.windowStart).toBe(FIXED_NOW);
  });

  it("Test 2: 7th and 8th events in same window do NOT re-fire Slack", async () => {
    const { _handleAuditEvent } = await loadHandler();
    const firestore = makeFakeFirestore();
    const slack = vi.fn(async () => undefined);

    const event = {
      type: "auth.signin.failure",
      ip: IP,
      actor: { uid: null },
    };

    // 6 events → 1 Slack POST.
    for (let i = 0; i < 6; i++) {
      await _handleAuditEvent(event, FIXED_NOW, slack, firestore as never);
    }
    expect(slack).toHaveBeenCalledTimes(1);

    // 7th, 8th events at same `now` (still inside window) — NO additional POST.
    await _handleAuditEvent(event, FIXED_NOW, slack, firestore as never);
    await _handleAuditEvent(event, FIXED_NOW, slack, firestore as never);
    expect(slack).toHaveBeenCalledTimes(1);

    // Counter advanced to 8.
    const stored = firestore._store.get(`authFailureCounters/${IP_HASH}`);
    expect(stored?.count).toBe(8);
  });

  it("Test 3: window expiry resets counter; fresh threshold-cross fires Slack again", async () => {
    const { _handleAuditEvent } = await loadHandler();
    // Seed store with an existing counter whose windowStart is > FAIL_WINDOW_MS old.
    const FAIL_WINDOW_MS = 5 * 60_000;
    const firestore = makeFakeFirestore({
      [`authFailureCounters/${IP_HASH}`]: {
        count: 8,
        windowStart: FIXED_NOW - FAIL_WINDOW_MS - 1, // expired by 1ms
      },
    });
    const slack = vi.fn(async () => undefined);

    const event = {
      type: "auth.signin.failure",
      ip: IP,
      actor: { uid: null },
    };

    // First event in NEW window — counter resets to 1, no Slack.
    await _handleAuditEvent(event, FIXED_NOW, slack, firestore as never);
    expect(slack).toHaveBeenCalledTimes(0);
    let stored = firestore._store.get(`authFailureCounters/${IP_HASH}`);
    expect(stored?.count).toBe(1);
    expect(stored?.windowStart).toBe(FIXED_NOW);

    // Drive 5 more events at the same `now` — 6th overall in this fresh window
    // crosses threshold, fires Slack.
    for (let i = 0; i < 5; i++) {
      await _handleAuditEvent(event, FIXED_NOW, slack, firestore as never);
    }
    expect(slack).toHaveBeenCalledTimes(1);
    stored = firestore._store.get(`authFailureCounters/${IP_HASH}`);
    expect(stored?.count).toBe(6);
  });
});

// ─── Test 4-5: Rule 3 (role escalation) ──────────────────────────────────────

describe("authAnomalyAlert — Rule 3 (role escalation)", () => {
  it("Test 4: iam.claims.set with newRole=admin and previousRole=internal fires Slack", async () => {
    const { _handleAuditEvent } = await loadHandler();
    const slack = vi.fn(async () => undefined);

    await _handleAuditEvent(
      {
        type: "iam.claims.set",
        actor: { uid: "admin-uid", email: "admin@example.com", role: "admin" },
        payload: { newRole: "admin", previousRole: "internal" },
      },
      FIXED_NOW,
      slack,
      makeStubFirestore() as never,
    );

    expect(slack).toHaveBeenCalledTimes(1);
    expect((slack.mock.calls[0][0] as { text: string }).text).toMatch(
      /Role escalation/,
    );
  });

  it("Test 5: iam.claims.set with newRole=admin AND previousRole=admin does NOT fire Slack (no escalation)", async () => {
    const { _handleAuditEvent } = await loadHandler();
    const slack = vi.fn(async () => undefined);

    await _handleAuditEvent(
      {
        type: "iam.claims.set",
        actor: { uid: "admin-uid", email: "admin@example.com", role: "admin" },
        payload: { newRole: "admin", previousRole: "admin" },
      },
      FIXED_NOW,
      slack,
      makeStubFirestore() as never,
    );

    expect(slack).toHaveBeenCalledTimes(0);
  });
});

// ─── Test 6: Rule 4 (unusual-hour gdpr export) ───────────────────────────────

describe("authAnomalyAlert — Rule 4 (unusual-hour gdpr export)", () => {
  it("Test 6: compliance.export.user at UTC hour 23 fires Slack; at UTC hour 14 does NOT", async () => {
    const { _handleAuditEvent, Timestamp } = await loadHandler();
    const slack = vi.fn(async () => undefined);

    // UTC 23:30 — falls inside UNUSUAL_HOURS = [0..5, 22, 23].
    const unusualMs = Date.UTC(2026, 4, 10, 23, 30, 0);
    await _handleAuditEvent(
      {
        type: "compliance.export.user",
        actor: { uid: "u1", email: "user@example.com" },
        at: Timestamp.fromMillis(unusualMs),
        payload: {},
      },
      FIXED_NOW,
      slack,
      makeStubFirestore() as never,
    );
    expect(slack).toHaveBeenCalledTimes(1);
    expect((slack.mock.calls[0][0] as { text: string }).text).toMatch(
      /Unusual-hour GDPR export/,
    );

    // UTC 14:30 — does NOT fall inside UNUSUAL_HOURS.
    const normalMs = Date.UTC(2026, 4, 10, 14, 30, 0);
    await _handleAuditEvent(
      {
        type: "compliance.export.user",
        actor: { uid: "u1", email: "user@example.com" },
        at: Timestamp.fromMillis(normalMs),
        payload: {},
      },
      FIXED_NOW,
      slack,
      makeStubFirestore() as never,
    );
    // Still only 1 call (unusual-hour event); normal-hour event added 0.
    expect(slack).toHaveBeenCalledTimes(1);
  });
});
