// tests/security-md-citation-format.test.js
// @ts-check
//
// Phase 11 Wave 1 (DOC-01): citation-format normalisation gate. Every framework
// citation in SECURITY.md must use the canonical short-form so an auditor
// reading the document can grep a single regex per framework and find every
// occurrence:
//
//   OWASP ASVS L2 v5.0 V<N>.<N>(.<N>)?
//   ISO/IEC 27001:2022 Annex A.<N>.<N>
//   SOC 2 CC<N>.<N>           (allows optional space — existing dominant form)
//   GDPR Art. <N>(<N>)?
//
// Drift forms (e.g., bare `OWASP ASVS L2 V14.2.1` missing `v5.0`, or
// `GDPR Article 32`, or `ISO 27001 ` without `:2022`, or `SOC2` without
// the space) are blocked here so the next reviewer doesn't have to chase
// 14 micro-edits across the file.
//
// Mirrors the regex-over-file-body pattern used by tests/build/source-map-gate.test.js.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("SECURITY.md — citation-format normalisation (Phase 11 Wave 1)", () => {
  const src = readFileSync(resolve(process.cwd(), "SECURITY.md"), "utf-8");

  it("contains zero bare `OWASP ASVS L2 V<digit>` occurrences (missing `v5.0`)", () => {
    // Canonical: `OWASP ASVS L2 v5.0 V14.2.1`
    // Drift:     `OWASP ASVS L2 V14.2.1`  (no v5.0 between L2 and V)
    const driftMatches = src.match(/OWASP ASVS L2 V\d/g) ?? [];
    expect(driftMatches.length).toBe(0);
  });

  it("contains zero `ISO 27001 ` occurrences missing the `:2022` revision", () => {
    // Canonical: `ISO/IEC 27001:2022 Annex A.8.24`
    // Drift:     `ISO 27001 A.8.24`  (no slash, no revision year)
    const driftMatches = src.match(/ISO 27001 (?!:2022)/g) ?? [];
    expect(driftMatches.length).toBe(0);
  });

  it("contains zero `SOC2` (no space) occurrences", () => {
    // Canonical: `SOC 2 CC6.1` (existing dominant form keeps the space)
    // Drift:     `SOC2 CC6.1`
    const driftMatches = src.match(/SOC2(?!\s)/g) ?? [];
    expect(driftMatches.length).toBe(0);
  });

  it("contains zero `GDPR Article <digit>` long-form occurrences", () => {
    // Canonical: `GDPR Art. 32(1)(b)`
    // Drift:     `GDPR Article 32`
    const driftMatches = src.match(/GDPR Article \d/g) ?? [];
    expect(driftMatches.length).toBe(0);
  });
});
