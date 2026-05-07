// src/firebase/functions.js
// @ts-check
// Phase 4 (D-05): Functions instance + httpsCallable wrapper for cloud/* clients.
import { app } from "./app.js";
import { getFunctions, httpsCallable } from "firebase/functions";

export const functions = getFunctions(app);
export { httpsCallable };
