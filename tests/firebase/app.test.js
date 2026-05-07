// tests/firebase/app.test.js
// @ts-check
// Phase 4 (D-05 / D-06): adapter shape contract. Subsequent waves rely on these
// exports being non-null after import. Mocks the Firebase SDK so the test
// exercises the adapter's per-feature-submodule split + initAppCheck-before-
// getAuth ordering without touching real Firebase services.
import { describe, it, expect, vi } from "vitest";

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({ name: "[mock-app]" })),
}));
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({ name: "[mock-auth]" })),
  onAuthStateChanged: vi.fn(),
  signInAnonymously: vi.fn(() => Promise.resolve()),
}));
vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({ name: "[mock-db]" })),
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("firebase/storage", () => ({
  getStorage: vi.fn(() => ({ name: "[mock-storage]" })),
  ref: vi.fn(),
  uploadBytesResumable: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));
vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(() => ({ name: "[mock-functions]" })),
  httpsCallable: vi.fn(),
}));

describe("src/firebase/app.js — adapter shape (D-05/D-06)", () => {
  it("exports app, auth, db, storage, functions as non-null sentinels", async () => {
    const m = await import("../../src/firebase/app.js");
    expect(m.app).toBeTruthy();
    expect(m.auth).toBeTruthy();
    expect(m.db).toBeTruthy();
    expect(m.storage).toBeTruthy();
    expect(m.functions).toBeTruthy();
  });
});

describe("src/firebase/check.js — initAppCheck stub (D-07)", () => {
  it("exports initAppCheck as a no-op function", async () => {
    const { initAppCheck } = await import("../../src/firebase/check.js");
    expect(typeof initAppCheck).toBe("function");
    expect(initAppCheck({})).toBeUndefined();
  });
});
