// tests/security-audit-translation-shape.test.js
// @ts-check
//
// Phase 12 Wave 1 (WALK-01): doc-shape gate for docs/SECURITY_AUDIT_TRANSLATION.md.
// Pattern source: tests/threat-model-shape.test.js + tests/security-md-paths-exist.test.js.
//
// Asserts:
//   1. File exists at docs/SECURITY_AUDIT_TRANSLATION.md.
//   2. Walks every required top-level § of SECURITY_AUDIT.md
//      (§1, §2, §3, §4, §5, §6, §7, §8, §9, §10, §13).
//   3. Every "N/A — Firebase architecture differs" appearance is inside a
//      markdown table row (has a `|` separator) so it carries a rationale
//      cell (no silent skips).
//   4. Pitfall 19 forbidden-words check — no bare "compliant" / "certified"
//      outside code spans (negation-tolerant lookbehind allows "not certified"
//      / "non-certified" — Plan 11-02 D-11-02-02 pattern).

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const TRANS_PATH = resolve(process.cwd(), "docs/SECURITY_AUDIT_TRANSLATION.md");

describe("docs/SECURITY_AUDIT_TRANSLATION.md doc shape (WALK-01)", () => {
  it("Test 1: file exists at docs/SECURITY_AUDIT_TRANSLATION.md", () => {
    expect(existsSync(TRANS_PATH)).toBe(true);
  });

  it("Test 2: walks every required top-level § of SECURITY_AUDIT.md", () => {
    const body = readFileSync(TRANS_PATH, "utf-8");
    // SECURITY_AUDIT.md has 16 top-level ## headings (verified 2026-05-10).
    // The translation map MUST surface every § that has substantive control
    // content (skip §0 / §12 / §14 / §15 — those are process / output /
    // maintenance / references).
    for (const ref of ["§1", "§2", "§3", "§4", "§5", "§6", "§7", "§8", "§9", "§10", "§13"]) {
      expect(body, `expected ${ref} in translation map body`).toContain(ref);
    }
  });

  it("Test 3: every 'N/A — Firebase architecture differs' appearance is inside a table row with rationale cell", () => {
    const body = readFileSync(TRANS_PATH, "utf-8");
    // Split into lines, find every line containing the literal "N/A — Firebase
    // architecture differs", assert each such line is a markdown table row
    // (contains pipe characters).
    const lines = body.split("\n");
    const naLines = lines.filter((l) => l.includes("N/A — Firebase architecture differs"));
    expect(
      naLines.length,
      "expected at least 5 'N/A — Firebase architecture differs' rows",
    ).toBeGreaterThanOrEqual(5);
    for (const line of naLines) {
      expect(line, `expected table-row formatting (pipes) for: ${line.slice(0, 80)}…`).toMatch(
        /\|/,
      );
    }
  });

  it("Test 4: Pitfall 19 forbidden-words check — no bare 'compliant' / 'certified' outside code spans (negation-tolerant)", () => {
    const body = readFileSync(TRANS_PATH, "utf-8");
    // Strip fenced code blocks + inline code spans (Plan 11-02 D-11-02-02 pattern).
    const stripped = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
    // Negation-tolerant lookbehind: allow "non-certified" / "not certified"
    // / "non-compliant" / "not compliant".
    const offenders = stripped.match(/\b(?<!non-)(?<!not\s)(compliant|certified)\b/gi) || [];
    expect(offenders, `Pitfall 19 forbidden-words offenders: ${offenders.join(", ")}`).toEqual([]);
  });
});
