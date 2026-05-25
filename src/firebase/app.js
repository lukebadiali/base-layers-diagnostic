// src/firebase/app.js
// @ts-check
// Phase 4 (D-05 / D-06): per-feature SDK adapter — eager sync init at module load.
// Replaces firebase-init.js (deleted in this commit). Phase 7 (FN-04) wires
// src/firebase/check.js body without re-ordering this.
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { initAppCheck } from "./check.js";

const firebaseConfig = {
  apiKey: "AIzaSyDV3RNRFxAoVkSHOMyfl6HqgGTwaenLYfY",
  authDomain: "bedeveloped-base-layers.firebaseapp.com",
  projectId: "bedeveloped-base-layers",
  storageBucket: "bedeveloped-base-layers.firebasestorage.app",
  messagingSenderId: "76749944951",
  appId: "1:76749944951:web:9d0db9603ecaa7cc5fee72",
};

// Dev-only emulator gate. Set VITE_USE_EMULATORS=1 in .env.local AND run
// `firebase emulators:start` in a second terminal. Bypasses the production
// Hosting same-origin invariant so local UAT can hit local code (CR-01 fix,
// etc.) without the CORS denial production endpoints return to cross-origin
// callers. Gate is `import.meta.env.DEV` so it tree-shakes out of prod bundles.
const USE_EMULATORS =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "1";

export const app = initializeApp(firebaseConfig);
if (!USE_EMULATORS) initAppCheck(app); // Phase 7 (FN-04) replaces the body — skip in emulator mode (functions disable enforceAppCheck locally)
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
// Cloud Functions are deployed to europe-west2 — pin the client SDK to match
// or callables resolve to the SDK default (us-central1) and CORS-fail. See
// src/firebase/functions.js header for the full context.
export const functions = getFunctions(app, "europe-west2");

if (USE_EMULATORS) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectStorageEmulator(storage, "localhost", 9199);
  connectFunctionsEmulator(functions, "localhost", 5001);
}
