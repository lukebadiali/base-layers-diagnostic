// tests/index-html-meta-csp.test.js
// @ts-check
// Phase 4 (D-18 / CODE-01): regression guard for T-3-meta-csp-conflict — closes
// the Phase 3 cleanup-ledger row at runbooks/phase-4-cleanup-ledger.md "Phase 3
// — meta-CSP regression guard". index.html must not regrow a
// <meta http-equiv="Content-Security-Policy"> tag (would conflict with the
// firebase.json header CSP shipped in Phase 3).
//
// Pattern analog: tests/firebase-config.test.js — read file from disk, regex-assert.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(process.cwd(), "index.html"), "utf-8");

describe("index.html — meta CSP regression guard (T-3-meta-csp-conflict)", () => {
  it("contains zero <meta http-equiv='Content-Security-Policy'> tags", () => {
    // Case-insensitive; tolerates extra whitespace around `=` and the attr value
    // single/double quotes.
    expect(/<meta[^>]+http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(html)).toBe(false);
  });
});
