// tests/rules/rate-limit.test.js
// @ts-check
// Phase 7 Wave 4 (FN-09 / 07-04): rules-unit-tests for the
// `rateLimits/{uid}/buckets/{windowStart}` predicate + composed rate-limit
// gate on `orgs/{orgId}/messages` and `orgs/{orgId}/comments` create rules.
//
// 15 cells per Behavior contract:
//   1-3   bucket-direct read predicates (anon deny, self-read allow, cross-uid deny)
//   4-11  bucket-direct write predicates (create count==1, future/past window deny,
//         monotonic +1 update, count<=30 cap, no-delete, cross-uid deny)
//   12-13 composed-predicate burst (30 messages succeed; 31st denies — Phase 7 SC#5)
//   14    new-window resumption
//   15    cross-collection bucket sharing (messages + comments share the bucket)
//
// Harness mirrors tests/rules/firestore.test.js (Phase 5 Wave 1 D-14/D-16):
//   - initRulesEnv("firestore", "rate-limit") for unique projectId namespace
//   - asUser(testEnv, role, claims) for authenticatedContext + sign_in_provider
//   - assertSucceeds / assertFails for allow/deny outcomes
//   - withSecurityRulesDisabled for fixture seeding
//
// `currentWindow()` helper mirrors firestore.rules `rateLimitWindow()` exactly:
// floor(now / 60000) * 60000. Tests author bucket docs at this window so the
// rule predicate `windowStart == rateLimitWindow()` matches.
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  initRulesEnv,
  asUser,
  ROLES,
  assertSucceeds,
  assertFails,
} from "./setup.js";

let testEnv;

const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

/**
 * Mirror firestore.rules `rateLimitWindow()` — floor to 60s window.
 * @returns {number}
 */
function currentWindow() {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

/**
 * Build a rateLimits bucket path for the given uid + window.
 * @param {string} uid
 * @param {number|string} win
 */
function bucketPath(uid, win) {
  return `rateLimits/${uid}/buckets/${win}`;
}

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "rate-limit");
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed an org so client_orgA can create messages/comments under it.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "orgs/orgA"), {
      orgId: "orgA",
      name: "Org A",
      createdAt: Timestamp.now(),
    });
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

// ─── Bucket-direct cells (1-11) ───────────────────────────────────────────

describe("rateLimits bucket-direct predicates", () => {
  it("Cell 1: anonymous user write to rateLimits/{any}/buckets/{any} → DENY", async () => {
    const db = asUser(testEnv, "anonymous", {});
    const win = currentWindow();
    await assertFails(
      setDoc(doc(db, bucketPath("anyUid", win)), { uid: "anyUid", count: 1 }),
    );
  });

  it("Cell 2: user A reads own rateLimits/userA/buckets/{currentWindow} → ALLOW", async () => {
    const win = currentWindow();
    // Seed a bucket via security-rules-disabled context so the read has a target.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), bucketPath("client_orgA", win)), {
        uid: "client_orgA",
        count: 5,
      });
    });
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    await assertSucceeds(getDoc(doc(db, bucketPath("client_orgA", win))));
  });

  it("Cell 3: user A reads userB's rateLimits/userB/buckets/{currentWindow} → DENY", async () => {
    const win = currentWindow();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), bucketPath("client_orgB", win)), {
        uid: "client_orgB",
        count: 5,
      });
    });
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    await assertFails(getDoc(doc(db, bucketPath("client_orgB", win))));
  });

  it("Cell 4: user A creates rateLimits/userA/buckets/{currentWindow} with count=1 → ALLOW", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    const win = currentWindow();
    await assertSucceeds(
      setDoc(doc(db, bucketPath("client_orgA", win)), {
        uid: "client_orgA",
        count: 1,
      }),
    );
  });

  it("Cell 5: user A creates with windowStart in the future → DENY", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    const futureWin = currentWindow() + 5 * 60_000; // 5 minutes ahead
    await assertFails(
      setDoc(doc(db, bucketPath("client_orgA", futureWin)), {
        uid: "client_orgA",
        count: 1,
      }),
    );
  });

  it("Cell 6: user A creates with windowStart in the past (>60s ago) → DENY", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    const pastWin = currentWindow() - 5 * 60_000; // 5 minutes ago
    await assertFails(
      setDoc(doc(db, bucketPath("client_orgA", pastWin)), {
        uid: "client_orgA",
        count: 1,
      }),
    );
  });

  it("Cell 7: user A updates own bucket count from 5 to 6 → ALLOW", async () => {
    const win = currentWindow();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), bucketPath("client_orgA", win)), {
        uid: "client_orgA",
        count: 5,
      });
    });
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    await assertSucceeds(
      updateDoc(doc(db, bucketPath("client_orgA", win)), { count: 6 }),
    );
  });

  it("Cell 8: user A updates own bucket count from 5 to 7 (skip) → DENY (must be n+1)", async () => {
    const win = currentWindow();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), bucketPath("client_orgA", win)), {
        uid: "client_orgA",
        count: 5,
      });
    });
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    await assertFails(
      updateDoc(doc(db, bucketPath("client_orgA", win)), { count: 7 }),
    );
  });

  it("Cell 9: user A updates with count > 30 → DENY (hard cap)", async () => {
    const win = currentWindow();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), bucketPath("client_orgA", win)), {
        uid: "client_orgA",
        count: 30,
      });
    });
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    await assertFails(
      updateDoc(doc(db, bucketPath("client_orgA", win)), { count: 31 }),
    );
  });

  it("Cell 10: user A deletes own bucket → DENY", async () => {
    const win = currentWindow();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), bucketPath("client_orgA", win)), {
        uid: "client_orgA",
        count: 5,
      });
    });
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    await assertFails(deleteDoc(doc(db, bucketPath("client_orgA", win))));
  });

  it("Cell 11: user A updates userB's bucket → DENY (cross-uid)", async () => {
    const win = currentWindow();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), bucketPath("client_orgB", win)), {
        uid: "client_orgB",
        count: 5,
      });
    });
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    await assertFails(
      updateDoc(doc(db, bucketPath("client_orgB", win)), { count: 6 }),
    );
  });
});

// ─── Composed-predicate burst cells (12-15) — Phase 7 SC#5 evidence ──────

describe("rateLimits composed predicate on messages/comments (FN-09 SC#5)", () => {
  it("Cell 12: user A 30 messages in same window all succeed", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    const win = currentWindow();
    const bucketRef = doc(db, bucketPath("client_orgA", win));

    // First write — create bucket with count:1 + protected message
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        tx.set(bucketRef, { uid: "client_orgA", count: 1 });
        tx.set(doc(db, "orgs/orgA/messages/m1"), {
          authorId: "client_orgA",
          body: "m1",
          createdAt: Timestamp.now(),
        });
      }),
    );

    // 29 more writes — each transactionally increments count and writes a message
    for (let i = 2; i <= 30; i++) {
      await assertSucceeds(
        runTransaction(db, async (tx) => {
          const cur = await tx.get(bucketRef);
          tx.update(bucketRef, { count: cur.data().count + 1 });
          tx.set(doc(db, `orgs/orgA/messages/m${i}`), {
            authorId: "client_orgA",
            body: `m${i}`,
            createdAt: Timestamp.now(),
          });
        }),
      );
    }

    // Verify the bucket reached 30 (read via security-rules-disabled to avoid
    // depending on the read-self-bucket cell's outcome).
    let finalCount = 0;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDoc(
        doc(ctx.firestore(), bucketPath("client_orgA", win)),
      );
      finalCount = snap.data()?.count;
    });
    expect(finalCount).toBe(30);
  });

  it("Cell 13: user A 31st message in same window denies — Phase 7 SC#5 burst test", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    const win = currentWindow();
    const bucketRef = doc(db, bucketPath("client_orgA", win));

    // Build up to count:30
    await runTransaction(db, async (tx) => {
      tx.set(bucketRef, { uid: "client_orgA", count: 1 });
      tx.set(doc(db, "orgs/orgA/messages/m1"), {
        authorId: "client_orgA",
        body: "m1",
        createdAt: Timestamp.now(),
      });
    });
    for (let i = 2; i <= 30; i++) {
      await runTransaction(db, async (tx) => {
        const cur = await tx.get(bucketRef);
        tx.update(bucketRef, { count: cur.data().count + 1 });
        tx.set(doc(db, `orgs/orgA/messages/m${i}`), {
          authorId: "client_orgA",
          body: `m${i}`,
          createdAt: Timestamp.now(),
        });
      });
    }

    // 31st write — predicate denies because bucket.count already === 30.
    await assertFails(
      runTransaction(db, async (tx) => {
        const cur = await tx.get(bucketRef);
        tx.update(bucketRef, { count: cur.data().count + 1 });
        tx.set(doc(db, "orgs/orgA/messages/m31"), {
          authorId: "client_orgA",
          body: "m31",
          createdAt: Timestamp.now(),
        });
      }),
    );
  });

  it("Cell 14: user A waits 61s, writes in next window → ALLOW (new bucket)", async () => {
    // Simulating a 61-second wait inside a unit test is impractical.
    // Instead: directly write to a NEXT-window bucket — the rules predicate
    // computes `rateLimitWindow()` from request.time (server-side), so a
    // bucket whose windowStart equals the CURRENT server window allows count=1
    // even if the previous window's bucket already hit 30.
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    const win = currentWindow();

    // Seed a saturated previous-window bucket (count=30).
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), bucketPath("client_orgA", win - 60_000)), {
        uid: "client_orgA",
        count: 30,
      });
    });

    // New write goes to the CURRENT window — predicate sees no bucket OR
    // bucket.count < 30 for current window, so the message create succeeds.
    await assertSucceeds(
      runTransaction(db, async (tx) => {
        tx.set(doc(db, bucketPath("client_orgA", win)), {
          uid: "client_orgA",
          count: 1,
        });
        tx.set(doc(db, "orgs/orgA/messages/m_newwin"), {
          authorId: "client_orgA",
          body: "after window roll",
          createdAt: Timestamp.now(),
        });
      }),
    );
  });

  it("Cell 15: 30 messages + 1 comment in same window → 31st (comment) denies (shared bucket)", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole["client_orgA"]);
    const win = currentWindow();
    const bucketRef = doc(db, bucketPath("client_orgA", win));

    // Build up to count:30 via messages
    await runTransaction(db, async (tx) => {
      tx.set(bucketRef, { uid: "client_orgA", count: 1 });
      tx.set(doc(db, "orgs/orgA/messages/x1"), {
        authorId: "client_orgA",
        body: "x1",
        createdAt: Timestamp.now(),
      });
    });
    for (let i = 2; i <= 30; i++) {
      await runTransaction(db, async (tx) => {
        const cur = await tx.get(bucketRef);
        tx.update(bucketRef, { count: cur.data().count + 1 });
        tx.set(doc(db, `orgs/orgA/messages/x${i}`), {
          authorId: "client_orgA",
          body: `x${i}`,
          createdAt: Timestamp.now(),
        });
      });
    }

    // 31st write attempt — but as a COMMENT this time. Shared per-uid bucket
    // means the comments path also denies because bucket.count >= 30.
    await assertFails(
      runTransaction(db, async (tx) => {
        const cur = await tx.get(bucketRef);
        tx.update(bucketRef, { count: cur.data().count + 1 });
        tx.set(doc(db, "orgs/orgA/comments/c31"), {
          authorId: "client_orgA",
          body: "31st across collections",
          pillarId: "1",
          createdAt: Timestamp.now(),
        });
      }),
    );
  });
});
