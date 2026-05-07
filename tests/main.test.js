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

  it("does NOT have a // @ts-nocheck directive (Wave 5 closes the last @ts-nocheck row)", () => {
    const src = readFileSync(resolve("src/main.js"), "utf8");
    expect(src).not.toMatch(/@ts-nocheck/);
  });
});
