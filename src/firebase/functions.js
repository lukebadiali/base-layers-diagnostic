// src/firebase/functions.js
// @ts-check
// Phase 4 (D-05): Functions instance + httpsCallable wrapper for cloud/* clients.
//
// Phase 6 follow-up: route callables through the Firebase Hosting custom domain
// instead of the direct *.cloudfunctions.net URL. Rewrites in firebase.json map
// /setClaims, /auditWrite, etc. to the corresponding europe-west2 functions.
//
// Why: the GCP organization policy iam.allowedPolicyMemberDomains blocks
// allUsers + roles/run.invoker on Cloud Run services, which prevents the
// direct-URL preflight from returning CORS headers. Firebase Hosting's own
// service identity already has invoker — when callables are routed through
// the hosting domain, that SA invokes the function and bypasses the org
// policy entirely. Bonus: requests are same-origin, so CORS doesn't apply.
//
// The functions themselves remain deployed in europe-west2 with App Check
// enforcement + the function-level enforceAppCheck + Zod + idempotency layers
// providing the real access control (Phase 7 FN-03/FN-07).
import { app } from "./app.js";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions";

const HOSTING_DOMAIN = "https://baselayers.bedeveloped.com";
// Dev-only emulator gate — same shape as src/firebase/app.js. When emulators
// are active, the HOSTING_DOMAIN custom-origin choice is overridden by
// connectFunctionsEmulator below, so callables route to localhost:5001 and
// bypass the production same-origin invariant. Without this hook, local UAT
// against inviteClient (and every other callable) preflight-fails on CORS.
const USE_EMULATORS = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "1";
export const functions = getFunctions(app, USE_EMULATORS ? "europe-west2" : HOSTING_DOMAIN);
if (USE_EMULATORS) connectFunctionsEmulator(functions, "localhost", 5001);
export { httpsCallable };
