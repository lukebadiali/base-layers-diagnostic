// tests/main.test.js
// @ts-check
// Phase 4 Wave 5 (D-02 / D-06 / D-12): pin contract for src/main.js — the
// terminal application bootstrap. Wave 5 reuses the existing app.js
// snapshot tests (tests/views/{dashboard,diagnostic,report}.test.js) for
// integration verification of the full boot path; this test pins the boot
// shape (firebase-first import, init exists, DOMContentLoaded auto-start).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("src/main.js — boot path shape", () => {
  it("imports firebase/app.js as the FIRST functional import (D-06 critical)", () => {
    const src = readFileSync(resolve("src/main.js"), "utf8");
    // Find the first non-comment, non-blank-line import statement
    const lines = src.split(/\r?\n/);
    let firstImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("import ")) {
        firstImportIdx = i;
        break;
      }
    }
    expect(firstImportIdx).toBeGreaterThanOrEqual(0);
    // The first import must reference firebase/app
    const firstImportBlock = lines.slice(firstImportIdx, firstImportIdx + 3).join("\n");
    expect(firstImportBlock).toMatch(/firebase\/app/);
  });

  it("contains a DOMContentLoaded auto-start", () => {
    const src = readFileSync(resolve("src/main.js"), "utf8");
    expect(src).toMatch(/DOMContentLoaded/);
  });

  it("contains an init() function", () => {
    const src = readFileSync(resolve("src/main.js"), "utf8");
    expect(src).toMatch(/function\s+init\s*\(/);
  });

  // Phase 4 Wave 5 transitional: src/main.js carries `// @ts-nocheck` while
  // the IIFE body remains intact (D-12 + Wave 4 Dev #1 + Wave 3 Dev #1 —
  // body migration to src/views/*.js is a follow-up wave; the snapshot
  // baselines are the rendered-DOM contract). Wave 6 cleanup migrates the
  // IIFE-resident renderX functions into the views/* stubs, after which
  // src/main.js shrinks to the boot scaffold + dispatcher wiring + init
  // and the @ts-nocheck row closes. The cleanup-ledger row tracking app.js:
  // 1 (// @ts-nocheck) closes at app.js deletion (Wave 5 — done) but
  // re-emerges as src/main.js:1 (// @ts-nocheck) for Wave 6 to close.
  it("carries // @ts-nocheck transitionally (Wave 6 closes when bodies migrate to views/*)", () => {
    const src = readFileSync(resolve("src/main.js"), "utf8");
    expect(src).toMatch(/@ts-nocheck/);
  });
});
