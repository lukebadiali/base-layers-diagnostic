// tests/ir-runbook-shape.test.js
// @ts-check
//
// Phase 11 Wave 4 (DOC-06): doc-shape gate asserting that docs/IR_RUNBOOK.md
// exists as the 5-scenario incident-response index over the 31 existing
// runbooks under runbooks/. The load-bearing test is Test 5 — every cited
// `runbooks/[a-z0-9-]+\.md` path must resolve to a real file on disk. This
// is the Pitfall 6 mitigation ("IR_RUNBOOK becoming a wishlist").
//
// Mirrors the regex-over-file-body pattern used by tests/privacy-md-shape.test.js.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("docs/IR_RUNBOOK.md — DOC-06 shape (Phase 11 Wave 4)", () => {
  const src = readFileSync(resolve(process.cwd(), "docs/IR_RUNBOOK.md"), "utf-8");

  // Test 1 — file exists at docs/IR_RUNBOOK.md with non-trivial body.
  it("exists at docs/IR_RUNBOOK.md with non-trivial body", () => {
    expect(src.length).toBeGreaterThan(500);
  });

  // Test 2 — contains exactly 5 `## Scenario [1-5]` headings.
  it("contains exactly 5 `## Scenario [1-5]` headings", () => {
    const matches = src.match(/^## Scenario [1-5] /gm) || [];
    expect(matches.length).toBe(5);
  });

  // Test 3 — each scenario sub-section contains Trigger / Owner /
  // Decision tree markers (accept Decision Tree / Decision-tree variants).
  it("each scenario has Trigger / Owner / Decision tree markers", () => {
    const slices = src.split(/^## Scenario [1-5] /m).slice(1, 6); // 5 slices
    expect(slices.length).toBe(5);
    slices.forEach((slice, idx) => {
      const tag = `Scenario ${idx + 1}`;
      expect(slice, `${tag} missing **Trigger:**`).toMatch(/\*\*Trigger:\*\*/i);
      expect(slice, `${tag} missing **Owner:**`).toMatch(/\*\*Owner[^:]*:\*\*/i);
      expect(slice, `${tag} missing Decision tree marker`).toMatch(
        /\*\*Decision[-\s]?tree:?\*\*|\*\*Decision Tree:\*\*/i,
      );
    });
  });

  // Test 4 — each scenario points to at least one runbook path matching
  // `runbooks/[a-z0-9-]+\.md`.
  it("each scenario cites at least one runbook path", () => {
    const slices = src.split(/^## Scenario [1-5] /m).slice(1, 6);
    expect(slices.length).toBe(5);
    slices.forEach((slice, idx) => {
      const tag = `Scenario ${idx + 1}`;
      const refs = slice.match(/runbooks\/[a-z0-9-]+\.md/g) || [];
      expect(refs.length, `${tag} cites no runbooks/*.md path`).toBeGreaterThanOrEqual(1);
    });
  });

  // Test 5 — LOAD-BEARING — every cited runbook path EXISTS on disk
  // (Pitfall 6 cross-reference existence gate).
  it("every cited runbook path exists on disk", () => {
    const matches = src.matchAll(/runbooks\/[a-z0-9-]+\.md/g);
    const cited = [...new Set([...matches].map((m) => m[0]))];
    expect(
      cited.length,
      "expected the document to cite >= 5 distinct runbook paths",
    ).toBeGreaterThanOrEqual(5);
    cited.forEach((p) => {
      expect(existsSync(resolve(process.cwd(), p)), `Missing runbook: ${p}`).toBe(true);
    });
  });

  // Test 6 — contains a `## Comms templates` (or "Communication templates")
  // section.
  it("contains a Comms templates section", () => {
    expect(src).toMatch(/^## (Comms|Communication) templates\s*$/m);
  });

  // Test 7 — contains a `## RCA template` (or "Root Cause Analysis template")
  // section.
  it("contains an RCA template section", () => {
    expect(src).toMatch(/^## (RCA template|Root Cause Analysis template)\s*$/m);
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
