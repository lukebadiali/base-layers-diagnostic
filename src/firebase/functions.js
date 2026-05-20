// src/firebase/functions.js
// @ts-check
// Phase 4 (D-05): Functions instance + httpsCallable wrapper for cloud/* clients.
//
// Phase 6 follow-up (UAT-discovered CORS on prod): every Cloud Function is
// deployed to europe-west2 (functions/src/**/*.ts region option) but the
// client SDK defaults to us-central1 without an explicit region argument —
// callables resolved to a non-existent us-central1 URL and the cross-origin
// preflight failed with "No 'Access-Control-Allow-Origin' header". Pin the
// region here so every callable (setClaims, auditWrite, gdprExportUser, ...)
// hits the right endpoint.
import { app } from "./app.js";
import { getFunctions, httpsCallable } from "firebase/functions";

export const functions = getFunctions(app, "europe-west2");
export { httpsCallable };
