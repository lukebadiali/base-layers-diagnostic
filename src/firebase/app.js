// src/firebase/app.js
// @ts-check
// Phase 4 (D-05 / D-06): per-feature SDK adapter — eager sync init at module load.
// Replaces firebase-init.js (deleted in this commit). Phase 7 (FN-04) wires
// src/firebase/check.js body without re-ordering this.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { initAppCheck } from "./check.js";

const firebaseConfig = {
  apiKey: "AIzaSyDV3RNRFxAoVkSHOMyfl6HqgGTwaenLYfY",
  authDomain: "bedeveloped-base-layers.firebaseapp.com",
  projectId: "bedeveloped-base-layers",
  storageBucket: "bedeveloped-base-layers.firebasestorage.app",
  messagingSenderId: "76749944951",
  appId: "1:76749944951:web:9d0db9603ecaa7cc5fee72",
};

export const app = initializeApp(firebaseConfig);
initAppCheck(app); // Phase 7 (FN-04) replaces the body
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
