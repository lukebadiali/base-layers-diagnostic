// tests/evidence-readme-shape.test.js
// @ts-check
//
// Phase 11 Wave 6 (DOC-09): doc-shape gate asserting that docs/evidence/README.md
// exists with an `## Inventory` heading and a markdown table listing every
// required capture. The load-bearing tests are 4 + 5 — every row must be
// either PRESENT or PENDING-OPERATOR (no silent omission per Pitfall 19), and
// every PENDING-OPERATOR row must carry an explicit pointer to the
// deferred-checkpoint document or user-testing batch step.
//
// Mirrors the regex-over-file-body pattern used by tests/ir-runbook-shape.test.js.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("docs/evidence/README.md — DOC-09 shape (Phase 11 Wave 6)", () => {
  const src = readFileSync(resolve(process.cwd(), "docs/evidence/README.md"), "utf-8");

  // Test 1 — file exists with non-trivial body.
  it("exists at docs/evidence/README.md with non-trivial body", () => {
    expect(src.length).toBeGreaterThan(500);
  });

  // Test 2 — contains an `## Inventory` heading.
  it("contains an `## Inventory` heading", () => {
    expect(src).toMatch(/^## Inventory\s*$/m);
  });

  // Helper — slice the inventory table out of the file body.
  function getInventoryTableRows(srcText) {
    const startMatch = srcText.match(/^## Inventory\s*$/m);
    if (!startMatch || startMatch.index === undefined) return [];
    const afterStart = srcText.slice(startMatch.index + startMatch[0].length);
    const endMatch = afterStart.match(/^## /m);
    const slice =
      endMatch && endMatch.index !== undefined ? afterStart.slice(0, endMatch.index) : afterStart;
    return slice
      .split("\n")
      .filter((line) => line.trim().startsWith("|"))
      .filter((line) => !/^\|[\s:|-]+\|\s*$/.test(line.trim())) // drop delimiter rows
      .slice(1); // drop header row
  }

  // Test 3 — at least 15 evidence-item rows present.
  it("Inventory table contains at least 15 evidence-item rows", () => {
    const rows = getInventoryTableRows(src);
    expect(
      rows.length,
      `expected >= 15 evidence rows; found ${rows.length}`,
    ).toBeGreaterThanOrEqual(15);
  });

  // Test 4 — every row's Status column is exactly one of PRESENT or
  // PENDING-OPERATOR (no other states allowed per Pitfall 19).
  it("every row's status is PRESENT or PENDING-OPERATOR (no other states)", () => {
    const rows = getInventoryTableRows(src);
    const offenders = [];
    rows.forEach((row, idx) => {
      const hasPresent = /\bPRESENT\b/.test(row);
      const hasPending = /\bPENDING-OPERATOR\b/.test(row);
      if (!hasPresent && !hasPending) {
        offenders.push(`row ${idx + 1}: ${row.slice(0, 120)}`);
      }
    });
    expect(
      offenders,
      `rows without PRESENT or PENDING-OPERATOR status: ${JSON.stringify(offenders)}`,
    ).toEqual([]);
  });

  // Test 5 — every PENDING-OPERATOR row carries an explicit pointer to a
  // deferred-checkpoint document OR a "Phase N Step M" / "user-testing batch"
  // reference (Pitfall 1 substrate-honest — no silent deferral).
  it("every PENDING-OPERATOR row has an explicit pointer (Pitfall 19)", () => {
    const rows = getInventoryTableRows(src);
    const pendingRows = rows.filter((r) => /\bPENDING-OPERATOR\b/.test(r));
    expect(pendingRows.length, "expected at least one PENDING-OPERATOR row").toBeGreaterThan(0);

    const offenders = [];
    pendingRows.forEach((row, idx) => {
      const hasPointer =
        /DEFERRED-CHECKPOINT/i.test(row) ||
        /user-testing batch/i.test(row) ||
        /Phase\s+\d+/i.test(row) ||
        /RESUME-NOTE/i.test(row) ||
        /Wave\s+\d+/i.test(row);
      if (!hasPointer) {
        offenders.push(`pending row ${idx + 1}: ${row.slice(0, 120)}`);
      }
    });
    expect(
      offenders,
      `PENDING-OPERATOR rows without explicit pointer: ${JSON.stringify(offenders)}`,
    ).toEqual([]);
  });
});
