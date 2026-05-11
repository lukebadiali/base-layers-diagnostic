// tests/data-flow-shape.test.js
// @ts-check
//
// Phase 11 Wave 3 (DOC-07): doc-shape gate asserting that docs/DATA_FLOW.md
// carries the canonical Mermaid `flowchart LR` block (8 nodes / 9+ edges)
// + a Data classifications table (>= 4 rows) + a Processing regions section
// citing `europe-west2` at least 3 times.
//
// Mirrors the regex-over-file-body pattern used by tests/privacy-md-shape.test.js.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("docs/DATA_FLOW.md — DOC-07 shape (Phase 11 Wave 3)", () => {
  const src = readFileSync(resolve(process.cwd(), "docs/DATA_FLOW.md"), "utf-8");

  // Test 1 — file exists at docs/ with non-trivial body.
  it("exists at docs/DATA_FLOW.md with non-trivial body", () => {
    expect(src.length).toBeGreaterThan(500);
  });

  // Test 2 — H1 heading starts with `# Data Flow`.
  it("contains an H1 `# Data Flow` heading", () => {
    expect(src).toMatch(/^# Data Flow\b/m);
  });

  // Test 3 — contains a Mermaid fenced block.
  it("contains a Mermaid fenced block (```mermaid ... ```)", () => {
    const m = src.match(/```mermaid\s*\n([\s\S]+?)\n```/);
    expect(m, "expected a ```mermaid ... ``` fenced block").not.toBeNull();
  });

  // Test 4 — Mermaid block contains 8 expected node identifiers.
  it("Mermaid block enumerates the 8 expected node identifiers", () => {
    const m = src.match(/```mermaid\s*\n([\s\S]+?)\n```/);
    const mermaid = m?.[1] ?? "";
    const required = [
      "Client",
      "Auth",
      "Firestore",
      "Storage",
      "Functions",
      "Sentry",
      "Slack",
      "BigQuery",
    ];
    for (const node of required) {
      expect(mermaid, `Mermaid block missing node identifier "${node}"`).toContain(node);
    }
  });

  // Test 5 — Mermaid block contains >= 9 directed edges (` -->`).
  it("Mermaid block contains at least 9 directed edges", () => {
    const m = src.match(/```mermaid\s*\n([\s\S]+?)\n```/);
    const mermaid = m?.[1] ?? "";
    const edges = mermaid.match(/-->/g) || [];
    expect(edges.length).toBeGreaterThanOrEqual(9);
  });

  // Test 6 — `## Data classifications` table with >= 4 data-class rows.
  it("contains a `## Data classifications` table with >= 4 class rows", () => {
    expect(src).toMatch(/^## Data classifications\s*$/m);
    const startMatch = src.match(/^## Data classifications\s*$/m);
    const startIdx = (startMatch?.index ?? 0) + (startMatch?.[0].length ?? 0);
    const after = src.slice(startIdx);
    const endMatch = after.match(/^## /m);
    const slice = endMatch?.index !== undefined ? after.slice(0, endMatch.index) : after;

    const tableLines = slice.split("\n").filter((line) => line.trim().startsWith("|"));
    const dataLines = tableLines.filter((line) => !/^\|[\s:|-]+\|\s*$/.test(line.trim()));
    // dataLines = 1 header + N class rows; require N >= 4.
    expect(dataLines.length - 1).toBeGreaterThanOrEqual(4);

    // Spot-check the 4 expected class names appear somewhere in the slice.
    const required = [
      /Customer\s+business/i,
      /User\s+account/i,
      /Operational/i,
      /Error\s+telemetry/i,
    ];
    for (const re of required) {
      expect(slice, `Data classifications section missing class matching ${re}`).toMatch(re);
    }
  });

  // Test 7 — `## Processing regions` cites `europe-west2` >= 3 times.
  it("contains `## Processing regions` citing `europe-west2` at least 3 times", () => {
    expect(src).toMatch(/^## Processing regions\s*$/m);
    const startMatch = src.match(/^## Processing regions\s*$/m);
    const startIdx = (startMatch?.index ?? 0) + (startMatch?.[0].length ?? 0);
    const after = src.slice(startIdx);
    const endMatch = after.match(/^## /m);
    const slice = endMatch?.index !== undefined ? after.slice(0, endMatch.index) : after;
    const matches = slice.match(/europe-west2/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });
});
