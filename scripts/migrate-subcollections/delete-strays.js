// Throwaway: delete 6 stray pre-Phase-4 root-collection fixture docs
// (messages/* and documents/* not under orgs/*) so the Phase 5 migration
// assertions can pass on a clean slate. Rollback substrate is the export
// taken in §3.1 (gs://bedeveloped-base-layers-backups/pre-phase5-migration/).

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ credential: applicationDefault(), projectId: "bedeveloped-base-layers" });
const db = getFirestore();

let deletedCount = 0;
for (const cg of ["messages", "documents"]) {
  const snap = await db.collectionGroup(cg).get();
  for (const doc of snap.docs) {
    if (!doc.ref.path.startsWith("orgs/")) {
      console.log(`DELETE ${doc.ref.path}`);
      await doc.ref.delete();
      deletedCount++;
    } else {
      console.log(`SKIP   ${doc.ref.path} (under orgs/*)`);
    }
  }
}
console.log(`\n[OK] Deleted ${deletedCount} stray docs.`);
process.exit(0);
