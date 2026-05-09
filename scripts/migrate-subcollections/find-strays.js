// Throwaway investigation script: locate the 3 stray messages + 3 stray documents
// surfaced by Phase 5 dry-run [PRE] block. Reads parent path of each.

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ credential: applicationDefault(), projectId: "bedeveloped-base-layers" });
const db = getFirestore();

for (const cg of ["messages", "documents"]) {
  console.log(`\n=== ${cg} ===`);
  const snap = await db.collectionGroup(cg).get();
  console.log(`count=${snap.size}`);
  for (const doc of snap.docs) {
    console.log(`  path=${doc.ref.path}`);
    console.log(`    fields=${Object.keys(doc.data()).join(",")}`);
  }
}

process.exit(0);
