// src/firebase/check.js
// @ts-check
// Phase 7 Wave 3 (FN-07): App Check init body fill — Phase 4 (D-07) left this
// as a no-op stub so the boot order in src/firebase/app.js could remain stable
// (initAppCheck(app) is called immediately after initializeApp(); see
// 07-PATTERNS.md Pattern E + Phase 4 D-06).
//
// Phase 7 fills the body with the reCAPTCHA Enterprise provider per
// ARCHITECTURE.md §2 + STACK.md line 48. Per-environment site keys are pulled
// from import.meta.env at Vite build time. Debug tokens live ONLY in
// .env.local (gitignored — Pitfall 8 mitigation #3).
//
// Boot order MUST NOT change — src/firebase/app.js calls initAppCheck(app)
// immediately after initializeApp() (Phase 4 D-06). Only the body changes.
//
// The DEV branch is gated on import.meta.env.DEV so Vite tree-shakes the
// debug-token plumbing out of production bundles (Pitfall 8 mitigation #3).
// PROD without a site key is fail-closed: throwing surfaces the
// misconfiguration loudly rather than silently bypassing App Check
// (T-07-03-06 Tampering disposition: mitigate via fail-closed PROD branch).

import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY ?? "";

/** @param {import("firebase/app").FirebaseApp} app */
export function initAppCheck(app) {
  // DEV / emulator / scratch-project path — debug token populated from
  // .env.local. Setting globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN BEFORE
  // initializeAppCheck() registers the token with the SDK
  // (https://firebase.google.com/docs/app-check/web/debug-provider).
  if (import.meta.env.DEV) {
    const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
    if (debugToken && typeof globalThis !== "undefined") {
      /** @type {*} */ (globalThis).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
  }

  if (!SITE_KEY) {
    // Fail-closed in PROD if the site key is missing — without this guard a
    // production build would silently ship without App Check token attachment
    // (T-07-03-06 Tampering: mitigate via fail-closed PROD branch).
    // In DEV, the debug-token path above lets emulator and CI proceed without
    // a real reCAPTCHA Enterprise key (Pitfall 1 mitigation).
    if (import.meta.env.PROD) {
      throw new Error("VITE_RECAPTCHA_ENTERPRISE_SITE_KEY not configured (FN-07)");
    }
    return null;
  }

  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
