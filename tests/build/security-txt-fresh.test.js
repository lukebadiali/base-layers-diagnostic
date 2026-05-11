// tests/build/security-txt-fresh.test.js
// @ts-check
//
// Phase 11 Wave 5 (DOC-08 / Pitfall 3): freshness gate for public/.well-known/security.txt.
// Asserts that the RFC 9116 file has a valid Expires field at least 30 days in the
// future, the canonical Contact / Canonical / Policy fields, and contains no
// non-ASCII characters. Pitfall 3 mitigation: fails the build BEFORE the
// Expires field drifts within 30 days of expiry so the rotation reminder
// fires loudly during routine CI rather than silently after the file
// expires in production.
//
// Source pattern: 11-RESEARCH.md §"Code Examples" → tests/build/security-txt-fresh.test.js;
// Test 6 (Policy field) added per 11-05-PLAN.md <behavior> line 120.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

describe("security.txt — RFC 9116 freshness gate (DOC-08 / Pitfall 3)", () => {
  const sourcePath = resolve(process.cwd(), "public/.well-known/security.txt");
  const content = readFileSync(sourcePath, "utf-8");

  it("has a Contact: field", () => {
    expect(content).toMatch(/^Contact:\s+mailto:security@bedeveloped\.com\s*$/m);
  });

  it("has an Expires: field at least 30 days in the future", () => {
    const match = content.match(/^Expires:\s+(\S+)\s*$/m);
    expect(match).not.toBeNull();
    const expires = new Date(match[1]);
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    expect(expires.getTime()).toBeGreaterThan(thirtyDaysFromNow.getTime());
  });

  it("has a Canonical: field pointing to the production URL", () => {
    expect(content).toContain(
      "Canonical: https://baselayers.bedeveloped.com/.well-known/security.txt",
    );
  });

  it("contains no emoji or non-ASCII characters (RFC 9116)", () => {
    for (const ch of content) {
      expect(ch.charCodeAt(0)).toBeLessThan(128);
    }
  });

  it("has a Policy: field pointing to the disclosure policy in SECURITY.md", () => {
    expect(content).toContain("Policy: https://baselayers.bedeveloped.com/SECURITY.md");
  });
});
