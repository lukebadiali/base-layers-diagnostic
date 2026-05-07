// src/firebase/check.js
// @ts-check
// Phase 7 (FN-04) replaces the body with:
//   initializeAppCheck(app, {
//     provider: new ReCaptchaEnterpriseProvider(siteKey),
//     isTokenAutoRefreshEnabled: true,
//   })
// Phase 4 (D-07): no-op stub. The exported function exists so src/firebase/app.js
// can call initAppCheck(app) at boot — Phase 7 fills the body, zero adapter-shape
// change. Same stub pattern as src/cloud/* and src/observability/* per D-11.

/** @param {*} _app */
export function initAppCheck(_app) {
  /* Phase 7 (FN-04) body lands here */
}
