// @ts-nocheck
// Phase 4: remove after CDN import replacement. See runbooks/phase-4-cleanup-ledger.md
// Firebase modular SDK v10 — loaded from Google CDN (no build step needed).
// Exposes `window.FB` for app.js to consume.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDV3RNRFxAoVkSHOMyfl6HqgGTwaenLYfY",
  authDomain: "bedeveloped-base-layers.firebaseapp.com",
  projectId: "bedeveloped-base-layers",
  storageBucket: "bedeveloped-base-layers.firebasestorage.app",
  messagingSenderId: "76749944951",
  appId: "1:76749944951:web:9d0db9603ecaa7cc5fee72"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

let readyResolve;
const ready = new Promise((res) => { readyResolve = res; });

window.FB = {
  app, db, auth, storage,
  currentUser: null,
  ready,
  firestore: {
    collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, onSnapshot, serverTimestamp, limit
  },
  storageOps: { ref, uploadBytesResumable, getDownloadURL, deleteObject }
};

onAuthStateChanged(auth, (u) => {
  if (u) {
    window.FB.currentUser = u;
    readyResolve(u);
    window.dispatchEvent(new Event("firebase-ready"));
  }
});

signInAnonymously(auth).catch((e) => console.error("Firebase anon sign-in failed:", e));
