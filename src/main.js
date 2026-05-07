// src/main.js
// @ts-check
// Phase 4 Wave 5 (D-02 / D-03 / D-06 / D-12): terminal application bootstrap
// for the Base Layers Diagnostic SPA. Replaces the legacy `app.js` IIFE that
// served as the single bootstrap from Phase 0 through Wave 4.
//
// CRITICAL D-06: src/firebase/app.js MUST be the FIRST functional import —
// initializeApp + initAppCheck (Phase 4 = no-op stub; Phase 7 = real
// reCAPTCHA Enterprise) MUST run before any data/* or views/* code touches
// the Firebase SDK. Phase 7 (FN-04) wires the App Check body into the
// existing slot — zero adapter-shape change between phases.
//
// Wave 5 strategy (Rule 1/3 deviation extending Wave 4 Dev #1 + Wave 3 Dev #1):
// Task 1 lands this scaffold (firebase-first imports + state singleton +
// init shim + DOMContentLoaded auto-start). Task 2 lands the terminal
// cutover commit that re-homes the app.js IIFE body inside the init shim,
// flips index.html script src to ./src/main.js, deletes app.js, and
// retargets the 3 view-snapshot tests. The two-step shape preserves Phase 2
// D-08 snapshot baselines through both gates: Task 1's scaffold doesn't
// change behaviour (app.js still boots as the active path); Task 2 atomically
// swaps the boot path and the snapshot baselines verify zero diff.

// FIRST IMPORT — D-06 critical ordering.
import "./firebase/app.js";
// Side-effect imports for Firebase SDK adapter feature submodules.
import "./firebase/auth.js"; // onAuthStateChanged dispatch + signInAnonymously bridge
import "./firebase/db.js"; // Firestore SDK bindings
import "./firebase/storage.js"; // Storage SDK bindings
import "./ui/charts.js"; // Chart.js npm bundle (replaces cdn.jsdelivr.net)

// Application state singleton — extracted byte-identical from app.js:574-587.
import { state } from "./state.js";
// Router dispatcher — extracted from app.js:625-696 (Pattern D DI shape).
import { setRoute, renderRoute } from "./router.js";
// Migration + cloud-sync — Phase 2 D-02 already extracted; main.js wires
// init() invocations.
import { migrateV1IfNeeded, clearOldScaleResponsesIfNeeded } from "./data/migration.js";
import { syncFromCloud } from "./data/cloud-sync.js";

// Touch the imports so unused-warning lint stays happy until Task 2's body
// re-home wires every consumer. Aliased _* per Wave 1 ^_ argsIgnorePattern.
const _state = state;
const _setRoute = setRoute;
const _renderRoute = renderRoute;
const _migrateV1IfNeeded = migrateV1IfNeeded;
const _clearOldScaleResponsesIfNeeded = clearOldScaleResponsesIfNeeded;
const _syncFromCloud = syncFromCloud;
void _state;
void _setRoute;
void _renderRoute;
void _migrateV1IfNeeded;
void _clearOldScaleResponsesIfNeeded;
void _syncFromCloud;

/**
 * Application init — Task 2 re-homes the app.js IIFE body here. Until then,
 * this is a no-op shim so the boot path is wireable + testable in shape.
 *
 * @returns {void}
 */
function init() {
  /* Phase 4 Wave 5 Task 2 fills the body — re-homes app.js:5049-5061 */
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
