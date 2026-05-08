// scripts/migrate-subcollections/assertions.js
// @ts-check
//
// Phase 5 Wave 2 (DATA-06 / RESEARCH Example 1): pre/post migration assertion
// harness. Pure functions that take a firebase-admin Firestore handle (or a
// duck-typed mock with the same surface) and return baseline counts or throw
// on shape regressions.
//
// Three exports:
//   - captureBaselineCounts(db) -> Promise<Record<string, number>>
//       Read-only. Used pre- and post-migration; the diff is the assertion.
//   - assertCollectionGroupCount(preCounts, postCounts) -> void (throws)
//       Pure. Compares two count snapshots; throws on regression.
//   - assertFieldPresence(db, sampleSize?) -> Promise<void> (throws)
//       Sample-based. Verifies D-03 legacy field invariants on migrated docs.
//   - summarise(counts) -> string
//       Pure. Pretty-prints a counts snapshot for the migration log.

const SUBCOLLECTIONS = /** @type {const} */ ([
  "responses",
  "comments",
  "actions",
  "documents",
  "messages",
  "readStates",
]);

/**
 * Capture pre/post counts for: orgs (parent), each subcollection via
 * `collectionGroup`. Used to detect any data-loss regression across the
 * migration boundary (DATA-06).
 *
 * @param {*} db - firebase-admin Firestore instance (or duck-typed mock)
 * @returns {Promise<Record<string, number>>}
 */
export async function captureBaselineCounts(db) {
  /** @type {Record<string, number>} */
  const counts = {};
  counts.orgs = (await db.collection("orgs").count().get()).data().count;
  for (const subcoll of SUBCOLLECTIONS) {
    counts[subcoll] = (await db.collectionGroup(subcoll).count().get()).data().count;
  }
  return counts;
}

/**
 * Assert post-migration counts honour the no-regression contract:
 *   - orgs parent count MUST match pre-migration exactly (no parent doc is
 *     created or destroyed by the subcollection migration).
 *   - Subcollection counts MUST be >= pre-migration (the migration writes
 *     subcollection docs from the parent's nested-maps; counts grow or stay
 *     equal across re-runs given idempotency markers).
 *
 * Throws an Error with a structured message on any regression. Pure — does
 * not touch the db.
 *
 * @param {Record<string, number>} preCounts
 * @param {Record<string, number>} postCounts
 * @returns {void}
 */
export function assertCollectionGroupCount(preCounts, postCounts) {
  for (const [coll, pre] of Object.entries(preCounts)) {
    const post = postCounts[coll];
    if (post === undefined) {
      throw new Error(`assertCollectionGroupCount: post snapshot missing key '${coll}'`);
    }
    if (coll === "orgs") {
      if (post !== pre) {
        throw new Error(
          `orgs parent count drift: pre=${pre} post=${post} (parent docs must not be created or destroyed)`,
        );
      }
    } else {
      if (post < pre) {
        throw new Error(
          `${coll} subcollection count regressed: pre=${pre} post=${post}`,
        );
      }
    }
  }
}

/**
 * Sample-based field-presence assertion: scan up to `sampleSize` docs in each
 * subcollection that should bear an inline legacy field per D-03 and verify
 * the field is present on every sampled doc.
 *
 * Coverage:
 *   - responses -> legacyAppUserId
 *   - comments  -> legacyAuthorId
 *   - messages  -> legacyAuthorId
 *
 * (actions + documents also carry `legacyAppUserId`, but the value is
 * `null`-able when `ownerId`/`uploadedBy` is absent in the source — Phase 6's
 * backfill handles those independently.)
 *
 * Throws on any sampled doc that is missing the field.
 *
 * @param {*} db - firebase-admin Firestore instance (or duck-typed mock)
 * @param {number} [sampleSize=20]
 * @returns {Promise<void>}
 */
export async function assertFieldPresence(db, sampleSize = 20) {
  /** @type {Array<{ coll: string, field: string }>} */
  const checks = [
    { coll: "responses", field: "legacyAppUserId" },
    { coll: "comments", field: "legacyAuthorId" },
    { coll: "messages", field: "legacyAuthorId" },
  ];
  for (const { coll, field } of checks) {
    const snap = await db.collectionGroup(coll).limit(sampleSize).get();
    let missing = 0;
    let total = 0;
    snap.forEach(/** @param {*} d */ (d) => {
      total++;
      const data = d.data();
      if (!data || !(field in data)) missing++;
    });
    if (missing > 0) {
      throw new Error(
        `${coll}: ${missing}/${total} sampled docs missing inline legacy field '${field}' (D-03 invariant)`,
      );
    }
  }
}

/**
 * Pretty-print a counts snapshot for the migration log. Pure.
 *
 * @param {Record<string, number>} counts
 * @returns {string}
 */
export function summarise(counts) {
  const lines = Object.entries(counts).map(([k, v]) => `  ${k.padEnd(12)} ${v}`);
  return lines.join("\n");
}
