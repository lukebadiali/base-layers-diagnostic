// tests/security-md-toc.test.js
// @ts-check
//
// Phase 11 Wave 1 (DOC-01): doc-shape gate asserting that SECURITY.md carries a
// navigable Table of Contents and that three currently-scattered topics have
// been promoted into top-level `## §` sections per the canonical-pass
// requirements of DOC-01 ("MFA recovery procedure; rotation schedule") + the
// Pitfall 19 disclosure-policy promotion.
//
// Mirrors the regex-over-file-body pattern used by tests/build/source-map-gate.test.js.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("SECURITY.md — DOC-01 shape (Phase 11 Wave 1)", () => {
  const src = readFileSync(resolve(process.cwd(), "SECURITY.md"), "utf-8");

  it("contains a `## Table of Contents` heading within the first 50 lines", () => {
    const first50 = src.split("\n").slice(0, 50).join("\n");
    expect(first50).toMatch(/^## Table of Contents$/m);
  });

  it("ToC enumerates anchor links for the 3 new sections plus 2 sampled existing sections", () => {
    // Extract the ToC slice: from the `## Table of Contents` heading to the
    // next top-level `## ` heading (which will be the first `## §` section).
    const tocStart = src.indexOf("## Table of Contents");
    expect(tocStart).toBeGreaterThan(-1);
    const afterToc = src.slice(tocStart + "## Table of Contents".length);
    const tocBody = afterToc.split(/^## /m)[0];

    // Required anchor link substrings (markdown link form `[label](#anchor)`).
    // GitHub's auto-anchor algorithm: lowercase, spaces -> hyphens, drop most
    // punctuation; the `§` glyph is stripped, leaving a leading hyphen.
    const requiredLinks = [
      "§ Vulnerability Disclosure Policy",
      "§ MFA Recovery Procedure",
      "§ Rotation Schedule",
      "§ Build & Supply Chain",
      "§ Phase 10 Audit Index",
    ];

    for (const label of requiredLinks) {
      // The ToC line must contain the section label inside a markdown link.
      expect(tocBody).toContain(label);
      // And the line must include the markdown anchor link pattern.
      const linkLine = tocBody.split("\n").find((l) => l.includes(label) && l.includes("](#"));
      expect(linkLine, `ToC entry for "${label}" must be a markdown anchor link`).toBeTruthy();
    }
  });

  it("contains exactly ONE top-level `## § Vulnerability Disclosure Policy` heading", () => {
    const matches = src.match(/^## § Vulnerability Disclosure Policy$/gm);
    expect(matches?.length ?? 0).toBe(1);
  });

  it("contains exactly ONE top-level `## § MFA Recovery Procedure` heading", () => {
    const matches = src.match(/^## § MFA Recovery Procedure$/gm);
    expect(matches?.length ?? 0).toBe(1);
  });

  it("contains exactly ONE top-level `## § Rotation Schedule` heading", () => {
    const matches = src.match(/^## § Rotation Schedule$/gm);
    expect(matches?.length ?? 0).toBe(1);
  });
});
