// functions/src/util/hash.ts
// Phase 06.1 Wave 2 Task 1 (AUTH-16 / RESEARCH § "Don't Hand-Roll"):
// server-side SHA-256 hex helper. Output MUST be byte-parity with
// src/util/hash.js (client-side) — both use UTF-8 encoding + lowercase hex
// output. This invariant is the basis for inviteClient's orgPassphrase
// verification:
//
//   client (setOrgClientPassphrase modal):
//     hashString(orgPass) === org.clientPassphraseHash  (stored on org doc)
//   server (inviteClient callable):
//     hashString(orgPass) === org.clientPassphraseHash  (verified per invite)
//
// Drift would brick every invite — passphrase-mismatch firing even with the
// correct input. The parity gate at functions/test/util/hash-parity.test.ts
// pins 5 fixed input/output pairs against the canonical SHA-256 vectors.

import { createHash } from "node:crypto";

export async function hashString(s: unknown): Promise<string> {
  return createHash("sha256").update(String(s), "utf8").digest("hex");
}
