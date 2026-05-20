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
import { getFunctions, httpsCallable } from "firebase/functions";

const HOSTING_DOMAIN = "https://baselayers.bedeveloped.com";
export const functions = getFunctions(app, HOSTING_DOMAIN);
export { httpsCallable };
