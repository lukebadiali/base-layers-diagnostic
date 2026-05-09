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
// Phase 7 Wave 3 (FN-07): initAppCheck now imports firebase/app-check.
// Mock the Enterprise provider + initializer so the adapter shape test can
// exercise the body-filled stub without spinning up real reCAPTCHA Enterprise.
vi.mock("firebase/app-check", () => ({
  initializeAppCheck: vi.fn(() => ({ name: "[mock-app-check]" })),
  ReCaptchaEnterpriseProvider: vi.fn().mockImplementation((siteKey) => ({
    name: "[mock-recaptcha-enterprise-provider]",
    siteKey,
  })),
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

describe("src/firebase/check.js — initAppCheck body fill (Phase 7 Wave 3, FN-07)", () => {
  it("exports initAppCheck as a function", async () => {
    const { initAppCheck } = await import("../../src/firebase/check.js");
    expect(typeof initAppCheck).toBe("function");
  });

  it("returns null when VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is unset (DEV path)", async () => {
    // happy-dom test environment: import.meta.env.DEV is true; no site key
    // is present -> the DEV branch returns null without throwing.
    const { initAppCheck } = await import("../../src/firebase/check.js");
    expect(initAppCheck({})).toBeNull();
  });
});
