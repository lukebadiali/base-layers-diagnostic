// src/firebase/storage.js
// @ts-check
// Phase 4 (D-05): Storage instance + SDK helper re-exports.
// Bridges window.FB for app.js IIFE until Wave 5 deletes app.js (D-03).
import { app } from "./app.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

export const storage = getStorage(app);
export { ref, uploadBytesResumable, getDownloadURL, deleteObject };

// Bridge for app.js IIFE — Phase 4 only; Wave 5 (D-03) removes app.js entirely.
if (typeof window !== "undefined") {
  /** @type {*} */ (window).FB = /** @type {*} */ (window).FB || {};
  /** @type {*} */ (window).FB.storage = storage;
  /** @type {*} */ (window).FB.storageOps = { ref, uploadBytesResumable, getDownloadURL, deleteObject };
}
