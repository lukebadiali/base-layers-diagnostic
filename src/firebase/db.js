// src/firebase/db.js
// @ts-check
// Phase 4 (D-05 / D-10): Firestore instance + SDK helper re-exports + onSnapshot
// wrapper for data/* to compose.
//
// Phase 4 Wave 5 (D-03 transitional): the window.FB.{db,firestore} bridge
// stays alive while main.js's IIFE body uses it (14 sites — verified by
// grep). Wave 6 cleanup migrates the IIFE body into views/* + data/*
// (which would import directly from this module via the four-boundary
// D-04 lint plan), at which point the bridge retires. Same Wave 4 Dev #1
// + Wave 3 Dev #1 logic: D-12 + must_haves snapshot stability trump
// literal task instructions.
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
