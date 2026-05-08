// scripts/migrate-subcollections/process-doc.js
// @ts-check
//
// Phase 5 Wave 2 (D-02 / D-06 / Pitfall 8 / Pitfall 10): per-source-doc
// processor with two-phase idempotency markers, --dry-run short-circuit, and
// 499-op WriteBatch flushing.
//
// Extracted from run.js as a separate module so it can be unit-tested in
// isolation without booting firebase-admin: the function takes its
// dependencies (db, FieldValue, dryRun) by parameter (DI), so tests inject
// mocks. run.js wires the real db + FieldValue when invoked by the operator.
//
// Marker contract (D-02 / RESEARCH Pattern 2):
//   migrations/{stepId}/items/{sourceDoc.id}
//     -> { status: 'pending' | 'done', startedAt, targetsPlanned, completedAt, targetsWritten }
//
//   - missing marker        -> first run; write PENDING, write batch, write DONE
//   - status === 'done'     -> SKIP (idempotency closure of Pitfall 10)
//   - status === 'pending'  -> RE-PROCESS (partial-run recovery; previous run crashed mid-write)
//
// Dry-run contract (D-06 / Pitfall 5): --dry-run short-circuits at the WRITE
// site, NOT the read site. Source doc reads + builder execution + target path
// computation all run; markers + Firestore writes do not.
//
// Batch contract (Pitfall 8): WriteBatch flushes at 499 ops to stay strictly
// under Firestore's 500-op ceiling.

const BATCH_FLUSH_THRESHOLD = 499;

/**
 * @typedef {Object} ProcessDocDeps
 * @property {*} db - firebase-admin Firestore instance (or duck-typed mock)
 * @property {{ serverTimestamp: () => any }} FieldValue - firebase-admin FieldValue
 * @property {boolean} dryRun - if true, no markers + no batch writes
 * @property {{ log?: (...args: any[]) => void }} [logger] - optional logger override (defaults to console)
 */

/**
 * @typedef {Object} ProcessDocResult
 * @property {boolean} [skipped]   - marker.status === 'done'
 * @property {boolean} [dryRun]    - dry-run mode; no writes performed
 * @property {number}  [wouldWrite] - dry-run target count
 * @property {number}  [written]    - actual writes performed
 */

/**
 * Process a single source doc against a step's builder; idempotency-safe.
 *
 * @param {ProcessDocDeps} deps
 * @param {string} stepId - e.g. 'responses-v1'
 * @param {(orgId: string, orgData: any) => Array<{path: string, data: any}>} builderFn
 * @param {{ id: string, data: () => any }} sourceDoc - QueryDocumentSnapshot from db.collection('orgs').get()
 * @returns {Promise<ProcessDocResult>}
 */
export async function processDoc(deps, stepId, builderFn, sourceDoc) {
  const { db, FieldValue, dryRun } = deps;
  const log = deps.logger?.log ?? console.log;

  const markerRef = db.doc(`migrations/${stepId}/items/${sourceDoc.id}`);
  const marker = await markerRef.get();

  // SKIP path: marker exists + status === 'done'. Re-runs of an already-completed
  // source doc are a no-op (Pitfall 10 idempotency closure).
  if (marker.exists && marker.data && marker.data()?.status === "done") {
    log(`[SKIP] ${stepId}/${sourceDoc.id} - already migrated`);
    return { skipped: true };
  }

  const sourceData = sourceDoc.data();
  const targets = builderFn(sourceDoc.id, sourceData);

  // DRY-RUN path: short-circuit at the WRITE site (D-06 / Pitfall 5).
  // Reads + builder execution have already run above; from here on we only
  // log the intended work and return without touching markers or Firestore.
  if (dryRun) {
    log(`[DRY-RUN] ${stepId}/${sourceDoc.id} - would write ${targets.length} docs`);
    targets.slice(0, 5).forEach((t) =>
      log(`  -> ${t.path} (${JSON.stringify(t.data).length} bytes)`),
    );
    if (targets.length > 5) {
      log(`  ... +${targets.length - 5} more`);
    }
    return { dryRun: true, wouldWrite: targets.length };
  }

  // Two-phase marker (D-02): write PENDING BEFORE batch writes. If this run
  // crashes mid-batch, the next run finds status='pending' and re-processes
  // (the SKIP path only fires on status='done').
  await markerRef.set({
    status: "pending",
    startedAt: FieldValue.serverTimestamp(),
    targetsPlanned: targets.length,
  });

  // WriteBatch with 499-op flush (Pitfall 8: Firestore's 500-op ceiling).
  // We commit at exactly 499 (NOT 500) to leave a safety margin.
  let batch = db.batch();
  let batchCount = 0;
  for (const { path, data } of targets) {
    batch.set(db.doc(path), data);
    batchCount++;
    if (batchCount === BATCH_FLUSH_THRESHOLD) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) {
    await batch.commit();
  }

  // DONE marker after all writes succeed (Pitfall 10 closure).
  await markerRef.set(
    {
      status: "done",
      completedAt: FieldValue.serverTimestamp(),
      targetsWritten: targets.length,
    },
    { merge: true },
  );
  log(`[DONE] ${stepId}/${sourceDoc.id} - wrote ${targets.length} docs`);
  return { written: targets.length };
}

// Exported for tests that want to assert the threshold value matches Pitfall 8.
export const __BATCH_FLUSH_THRESHOLD = BATCH_FLUSH_THRESHOLD;
