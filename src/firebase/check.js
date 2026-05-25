// src/firebase/check.js
// @ts-check
// Phase 7 Wave 3 (FN-07): App Check init body fill — Phase 4 (D-07) left this
// as a no-op stub so the boot order in src/firebase/app.js could remain stable
// (initAppCheck(app) is called immediately after initializeApp(); see
// 07-PATTERNS.md Pattern E + Phase 4 D-06).
//
// PLATFORM-UAT post-T19 (2026-05-25): provider switched from
// ReCaptchaEnterpriseProvider to ReCaptchaV3Provider. Reason — reCAPTCHA
// Enterprise's score-based risk engine fails to issue App Check tokens in
// incognito sessions because the third-party cookies + browser
// fingerprinting it depends on for scoring are blocked by default. This
// blocks every server call (updatePassword, setClaims callable, auditWrite)
// for any client opening their invite link in incognito mode — confirmed
// against a live invitee with `appCheck/recaptcha-error` warnings followed
// by 401s on every callable and a 400 on identitytoolkit accounts:update.
// ReCaptchaV3Provider's permissive default score threshold is well-known
// to work in incognito while still attesting "request came from a real
// browser running our SPA" (the App Check value prop). Operator follow-up:
// generate a v3 key at https://www.google.com/recaptcha/admin and register
// it as the App Check provider in Firebase Console — Enterprise keys
// (Google Cloud Console) are not interchangeable with v3 keys (legacy
// reCAPTCHA admin).
//
// Env var name VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is deliberately retained
// to avoid a rename ceremony across GH Actions secrets + .env.local files;
// it now holds a v3 key, documented in .env.example. Cleanup-rename to
// VITE_RECAPTCHA_SITE_KEY can ship later as a low-risk refactor.
//
// Per-environment site keys are pulled from import.meta.env at Vite build
// time. Debug tokens live ONLY in .env.local (gitignored — Pitfall 8
// mitigation #3).
//
// Boot order MUST NOT change — src/firebase/app.js calls initAppCheck(app)
// immediately after initializeApp() (Phase 4 D-06). Only the body changes.
//
// The DEV branch is gated on import.meta.env.DEV so Vite tree-shakes the
// debug-token plumbing out of production bundles (Pitfall 8 mitigation #3).
// PROD without a site key is fail-closed: throwing surfaces the
// misconfiguration loudly rather than silently bypassing App Check
// (T-07-03-06 Tampering disposition: mitigate via fail-closed PROD branch).

import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

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
    provider: new ReCaptchaV3Provider(SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
