// src/firebase/db.js
// @ts-check
// Phase 4 (D-05 / D-10): Firestore instance + SDK helper re-exports + onSnapshot
// wrapper for data/* to compose. Bridges window.FB for app.js IIFE until Wave 5
// deletes app.js (D-03).
import { app } from "./app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from "firebase/firestore";

export const db = getFirestore(app);
export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
};

/**
 * onSnapshot wrapper for data/* to compose (D-10 Promise-CRUD-+-subscribe API
 * surface). Returns the unsubscribe fn.
 * @param {*} ref
 * @param {{ onChange: (snap: any) => void, onError: (err: Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeDoc(ref, { onChange, onError }) {
  return onSnapshot(ref, onChange, onError);
}

// Bridge for app.js IIFE — Phase 4 only; Wave 5 (D-03) removes app.js entirely.
if (typeof window !== "undefined") {
  /** @type {*} */ (window).FB = /** @type {*} */ (window).FB || {};
  /** @type {*} */ (window).FB.db = db;
  /** @type {*} */ (window).FB.firestore = {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    limit,
  };
}
