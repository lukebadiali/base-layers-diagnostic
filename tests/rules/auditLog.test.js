// tests/rules/auditLog.test.js
// @ts-check
// Phase 7 Wave 2 (FN-01 / AUDIT-01 / AUDIT-07 / D-17 / Pitfall 17):
// rules-unit-test cells pinning the auditLog/{eventId} server-only contract
// from the application-tier perspective.
//
// AUDIT-01 (client-write-deny): every client role — anonymous, client_orgA,
// internal, admin — is denied write on auditLog/{*}. Only Admin SDK writes
// from Cloud Functions (auditWrite + the three mirror triggers) reach the
// collection.
//
// AUDIT-07 (audited-user-cannot-read-own): an internal user whose own uid
// matches the audit row's actor.uid is STILL denied read. Only admin reads.
// This pins the rule that even compromised internal sessions cannot
// self-redact their audit trail.
//
// Pairs with the existing tests/rules/server-only-deny-all.test.js (Phase 5
// Wave 1) which proves the deny-all matrix; this file adds the focused
// AUDIT-07 cell + the admin-read-allow cell + the audited-self read-deny
// cell that pins the AUDIT-07 specific case.

import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { setDoc, getDoc, doc, Timestamp } from "firebase/firestore";
import {
  initRulesEnv,
  asUser,
  ROLES,
  assertSucceeds,
  assertFails,
} from "./setup.js";

let testEnv;

const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "audit-log");
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed an auditLog row whose actor.uid is "internal" — same string as the
  // ROLES authenticatedContext uid for the internal role (asUser uses
  // roleName as the uid). Cell 7 reads back this seed AS the internal user
  // and asserts deny: that is the AUDIT-07 audited-self contract.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.now();
    await setDoc(doc(db, "auditLog/seeded"), {
      eventId: "seeded",
      type: "auth.signin.success",
      severity: "info",
      actor: {
        uid: "internal",
        email: null,
        role: "internal",
        orgId: null,
      },
      target: { type: "user", id: "u1" },
      at: now,
      ip: null,
      userAgent: null,
      payload: {},
      idempotencyKey: "internal:auth.signin.success:u1:seed",
      schemaVersion: 1,
    });
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

// ─── AUDIT-01 — write-deny matrix (cells 1-4) ────────────────────────────────
const WRITE_CELLS = [
  { role: "anonymous", expected: "deny", label: "cell 1" },
  { role: "client_orgA", expected: "deny", label: "cell 2" },
  { role: "internal", expected: "deny", label: "cell 3 (Pitfall 17 — server-only even for internal)" },
  { role: "admin", expected: "deny", label: "cell 4 (rules allow write: if false — Admin SDK only)" },
];

describe("auditLog — AUDIT-01 client-write-deny matrix", () => {
  for (const cell of WRITE_CELLS) {
    it(`${cell.label}: ${cell.role} write -> ${cell.expected}`, async () => {
      const claims = claimsByRole[cell.role] || {};
      const db = asUser(testEnv, cell.role, claims);
      const op = setDoc(doc(db, "auditLog/x"), {
        eventId: "x",
        type: "auth.signin.success",
        actor: { uid: cell.role },
        target: { type: "user", id: "u1" },
        at: Timestamp.now(),
      });
      if (cell.expected === "allow") {
        await assertSucceeds(op);
      } else {
        await assertFails(op);
      }
    });
  }
});

// ─── AUDIT-07 — read-deny matrix (cells 5-8) ─────────────────────────────────
//
// The seeded row at auditLog/seeded has actor.uid="internal" — the same
// string as the internal role's authenticatedContext uid. Cell 7 reads that
// row AS the internal user (audited-self) and asserts deny.
const READ_CELLS = [
  { role: "anonymous", expected: "deny", label: "cell 8" },
  { role: "client_orgA", expected: "deny", label: "cell 6 — cross-tenant read" },
  { role: "internal", expected: "deny", label: "cell 7 (AUDIT-07 — audited self CANNOT read own row)" },
  { role: "admin", expected: "allow", label: "cell 5 (admin reads — allow)" },
];

describe("auditLog — AUDIT-07 audited-user-cannot-read-own + admin-only-read", () => {
  for (const cell of READ_CELLS) {
    it(`${cell.label}: ${cell.role} read -> ${cell.expected}`, async () => {
      const claims = claimsByRole[cell.role] || {};
      const db = asUser(testEnv, cell.role, claims);
      const op = getDoc(doc(db, "auditLog/seeded"));
      if (cell.expected === "allow") {
        await assertSucceeds(op);
      } else {
        await assertFails(op);
      }
    });
  }
});
