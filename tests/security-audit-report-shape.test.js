// tests/security-audit-report-shape.test.js
// @ts-check
//
// Phase 12 Wave 2 (WALK-02 + WALK-03 partial): doc-shape gate for SECURITY_AUDIT_REPORT.md.
// Pattern source: tests/threat-model-shape.test.js + tests/security-md-paths-exist.test.js + Example 1 in 12-RESEARCH.md.
//
// This plan (12-02) lands 6 cases:
//   Test 1: file exists at repo root
//   Test 2: H1 is the canonical report title
//   Test 3: no :NN line-number suffixes in citation cells (Pitfall 4)
//   Test 6: posture statement appears verbatim in executive summary (Pitfall 19)
//   Test 7: Pitfall 19 forbidden-words check (negation-tolerant lookbehind)
//   Test A01..A10: §2 OWASP section enumerates one row per A01..A10 (cardinality gate)
//
// Plan 12-03 expands the file to add:
//   Test 4: all 10 OWASP LLM Top-10 sections enumerated (WALK-04 cardinality)
//   Test 5: every cited path exists (Pitfall 6 — also covered by tests/security-audit-report-paths-exist.test.js in Plan 12-04)
//   Test 8: §13 Sign-off Checklist Universal section >= 14 rows

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPORT_PATH = resolve(process.cwd(), "SECURITY_AUDIT_REPORT.md");
const POSTURE = "credible / on track for SOC2 + ISO 27001 + GDPR Art. 32 / OWASP ASVS L2";

describe("SECURITY_AUDIT_REPORT.md doc shape (WALK-02 + WALK-03 partial — Plan 12-02)", () => {
  it("Test 1: file exists at repo root", () => {
    expect(existsSync(REPORT_PATH)).toBe(true);
  });

  it("Test 2: H1 is the canonical report title", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    expect(body).toMatch(/^# Base Layers Diagnostic — SECURITY_AUDIT_REPORT/m);
  });

  it("Test 3: no :NN line-number suffixes in citation cells (Pitfall 4)", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    // Match :NN appearing alongside a code-path extension inside the report body.
    // Same shape Phase 11 Wave 6 swept clean across SECURITY.md.
    const offenders = body.match(/\|[^|]*\.(md|js|ts|json|rules):\d+/g) || [];
    expect(offenders, `Pitfall 4 :NN offenders: ${JSON.stringify(offenders)}`).toEqual([]);
  });

  it("Test 6: posture statement appears verbatim in executive summary (Pitfall 19)", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    expect(body).toContain(POSTURE);
  });

  it("Test 7: Pitfall 19 forbidden-words check — no bare 'compliant' / 'certified' outside code spans (negation-tolerant)", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    // Strip fenced code blocks + inline code spans (Plan 11-02 D-11-02-02 pattern).
    const stripped = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
    // Negation-tolerant lookbehind: allow "non-certified" / "not certified" / "non-compliant" / "not compliant".
    const offenders = stripped.match(/\b(?<!non-)(?<!not\s)(compliant|certified)\b/gi) || [];
    expect(offenders, `Pitfall 19 forbidden-words offenders: ${JSON.stringify(offenders)}`).toEqual(
      [],
    );
  });

  it("Test A01-A10 cardinality: §2 OWASP section enumerates one row per A01..A10 (WALK-02 cardinality)", () => {
    const body = readFileSync(REPORT_PATH, "utf-8");
    // Extract the §2 OWASP section between `## §2 OWASP Top 10 2025` and the next `## ` heading.
    const section = body.match(/##\s+§2\s+OWASP Top 10 2025[\s\S]*?(?=\n##\s+§)/)?.[0] ?? "";
    expect(section.length, "expected §2 OWASP Top 10 2025 section to be present").toBeGreaterThan(
      0,
    );
    // For each A01..A10, expect at least one row in Source ref column.
    for (const n of ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08", "A09", "A10"]) {
      const hits = section.match(new RegExp(`\\|\\s*§2\\s+${n}\\b`, "g")) || [];
      expect(
        hits.length,
        `expected at least one §2 ${n} row in §2 OWASP section`,
      ).toBeGreaterThanOrEqual(1);
    }
  });
});
