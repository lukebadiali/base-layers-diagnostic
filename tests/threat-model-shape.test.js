// tests/threat-model-shape.test.js
// @ts-check
//
// Phase 11 Wave 3 (DOC-03): doc-shape gate asserting that THREAT_MODEL.md at
// the repo root carries the canonical STRIDE structure — 4+ trust boundaries
// + exactly 6 threat categories (T1-T6) each with Threat / Mitigations /
// Evidence sub-blocks + a Defence-in-depth summary table + the Pitfall 19
// forbidden-words check ("compliant" / "certified" outside code spans).
//
// Mirrors the regex-over-file-body pattern used by tests/privacy-md-shape.test.js.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("THREAT_MODEL.md — DOC-03 shape (Phase 11 Wave 3)", () => {
  const src = readFileSync(resolve(process.cwd(), "THREAT_MODEL.md"), "utf-8");

  // Test 1 — file exists at repo root with non-trivial body.
  it("exists at repo root with non-trivial body", () => {
    expect(src.length).toBeGreaterThan(500);
  });

  // Test 2 — H1 heading equals `# Threat Model — Base Layers Diagnostic`.
  it("has the canonical H1 heading", () => {
    expect(src).toMatch(/^# Threat Model — Base Layers Diagnostic\s*$/m);
  });

  // Test 3 — `## Trust boundaries` section with >= 4 numbered items
  // (`/^[1-4]\. \*\*/m` matches >= 4 items per the plan).
  it("contains a Trust boundaries section with at least 4 numbered items", () => {
    expect(src).toMatch(/^## Trust [Bb]oundaries\s*$/m);

    // Slice from the Trust boundaries heading to the next `## ` heading.
    const startMatch = src.match(/^## Trust [Bb]oundaries\s*$/m);
    expect(startMatch).not.toBeNull();
    const startIdx = (startMatch?.index ?? 0) + (startMatch?.[0].length ?? 0);
    const after = src.slice(startIdx);
    const endMatch = after.match(/^## /m);
    const slice = endMatch?.index !== undefined ? after.slice(0, endMatch.index) : after;

    // Per plan: regex /^[1-4]\. \*\*/m matches >= 4 items.
    const numbered = slice.match(/^[1-4]\. \*\*/gm) || [];
    expect(numbered.length).toBeGreaterThanOrEqual(4);
  });

  // Test 4 — `## Threat categories` heading present.
  it("contains a `## Threat categories` heading", () => {
    expect(src).toMatch(/^## Threat categories\s*$/m);
  });

  // Test 5 — exactly 6 `### T[1-6]. ` sub-headings.
  it("contains exactly 6 STRIDE threat sub-headings (T1-T6)", () => {
    const matches = src.match(/^### T[1-6]\. /gm) || [];
    expect(matches.length).toBe(6);
  });

  // Test 6 — each T1-T6 slice contains all 3 sub-block markers
  // (`**Threat:**` / `**Mitigations:**` / `**Evidence:**`).
  it("each T1-T6 category has Threat / Mitigations / Evidence sub-blocks", () => {
    const slices = src.split(/^### T\d\. /m).slice(1, 7); // 6 slices T1..T6
    expect(slices.length).toBe(6);
    slices.forEach((slice, idx) => {
      const tag = `T${idx + 1}`;
      expect(slice, `${tag} missing **Threat:**`).toContain("**Threat:**");
      expect(slice, `${tag} missing **Mitigations:**`).toContain("**Mitigations:**");
      expect(slice, `${tag} missing **Evidence:**`).toContain("**Evidence:**");
    });
  });

  // Test 7 — Defence-in-depth summary table with >= 6 layer rows.
  // Accept both "Defence" and "Defense" spellings.
  it("contains a Defence-in-depth summary with a >= 6-row markdown table", () => {
    expect(src).toMatch(/^## Defen[cs]e in depth summary\s*$/m);

    const startMatch = src.match(/^## Defen[cs]e in depth summary\s*$/m);
    const startIdx = (startMatch?.index ?? 0) + (startMatch?.[0].length ?? 0);
    const after = src.slice(startIdx);
    const endMatch = after.match(/^## /m);
    const slice = endMatch?.index !== undefined ? after.slice(0, endMatch.index) : after;

    // Markdown table data rows: lines that start with `|` minus the header
    // and delimiter rows.
    const tableLines = slice.split("\n").filter((line) => line.trim().startsWith("|"));
    const dataLines = tableLines.filter((line) => !/^\|[\s:|-]+\|\s*$/.test(line.trim()));
    // dataLines = 1 header + N layer rows; require N >= 6.
    expect(dataLines.length - 1).toBeGreaterThanOrEqual(6);
  });

  // Test 8 — Pitfall 19 forbidden-words check ("compliant" / "certified")
  // outside backtick code spans, with negation-tolerant regex preserving
  // the project canonical phrasing "credible, not certified".
  it("does not contain forbidden words `compliant` or `certified` outside code spans", () => {
    const stripped = src.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
    const matches = stripped.match(/\b(?<!non-)(?<!not\s)(compliant|certified)\b/gi) || [];
    expect(
      matches.length,
      `forbidden-word hits outside code spans: ${JSON.stringify(matches)}`,
    ).toBe(0);
  });
});
