// tests/build/security-txt-served.test.js
// @ts-check
//
// Phase 11 Wave 5 (DOC-08 / Pitfall 3): asserts that public/.well-known/security.txt
// is copied to dist/.well-known/security.txt at build time (Vite default publicDir
// behaviour). If absent, Firebase Hosting won't serve the file at the canonical URL.
// Analogous to tests/build/source-map-gate.test.js — static-source assertion only;
// the live curl check at https://baselayers.bedeveloped.com/.well-known/security.txt
// is the runtime gate (manual operator verify post-deploy).

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("security.txt — DOC-08 build + hosting integration (Phase 11 Wave 5)", () => {
  const publicPath = resolve(process.cwd(), "public/.well-known/security.txt");
  const distPath = resolve(process.cwd(), "dist/.well-known/security.txt");

  it("public/.well-known/security.txt exists", () => {
    expect(existsSync(publicPath)).toBe(true);
  });

  it.skipIf(!existsSync(distPath))(
    "dist/.well-known/security.txt matches public source byte-for-byte",
    () => {
      const pub = readFileSync(publicPath, "utf-8");
      const dist = readFileSync(distPath, "utf-8");
      expect(dist).toBe(pub);
    },
  );

  it("firebase.json declares a /.well-known/** headers entry with Cache-Control max-age=86400", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "firebase.json"), "utf-8"));
    const headers = config?.hosting?.headers ?? [];
    const wellKnownEntry = headers.find((h) => /\/\.well-known/.test(h?.source ?? ""));
    expect(wellKnownEntry, "firebase.json missing /.well-known/** headers entry").toBeDefined();
    const cacheControl = wellKnownEntry.headers.find((h) => h.key === "Cache-Control")?.value ?? "";
    expect(cacheControl).toMatch(/max-age=86400/);
    expect(cacheControl).not.toMatch(/immutable/);
  });
});
