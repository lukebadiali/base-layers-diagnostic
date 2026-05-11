// tests/rules/authFailureCounters.test.js
// @ts-check
// Phase 9 Wave 5 (OBS-05 / Pattern 10): authFailureCounters/{ipHash} is
// server-only — Admin SDK from the authAnomalyAlert trigger (running as
// audit-alert-sa) is the only writer. Mirrors the Phase 7 auditLog deny
// matrix shape — `allow read+write: if false` for every client role.
//
// 4 cells (anonymous read, signed-in client read, signed-in client write,
// internal-role write) — all assert deny.

import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { setDoc, getDoc, doc } from "firebase/firestore";
import { initRulesEnv, asUser, ROLES, assertFails } from "./setup.js";

const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

let testEnv;

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "auth-failure-counters");
});

beforeEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

describe("authFailureCounters/{ipHash} — server-only deny matrix", () => {
  it("Cell 1: anonymous client read denied", async () => {
    const db = asUser(testEnv, "anonymous", claimsByRole.anonymous || {});
    await assertFails(getDoc(doc(db, "authFailureCounters/abc")));
  });

  it("Cell 2: signed-in client (client_orgA) read denied", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(getDoc(doc(db, "authFailureCounters/abc")));
  });

  it("Cell 3: signed-in client (client_orgA) write denied", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(
      setDoc(doc(db, "authFailureCounters/abc"), {
        count: 1,
        windowStart: 0,
      }),
    );
  });

  it("Cell 4: internal-role write denied (Admin SDK only — audit-alert-sa)", async () => {
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(
      setDoc(doc(db, "authFailureCounters/abc"), {
        count: 1,
        windowStart: 0,
      }),
    );
  });
});
