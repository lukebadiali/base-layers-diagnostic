// tests/security-md-paths-exist.test.js
// @ts-check
//
// Phase 11 Wave 6 (DOC-10 final pass): doc-shape gate asserting that every
// code-path cited in SECURITY.md resolves to a real file on disk AND that
// no citation carries a `:NN` line-number suffix (Pitfall 4 — paths only,
// line numbers drift). Wave 6 also requires SECURITY.md to gain a
// § Phase 11 Audit Index section appended after § Phase 10 Audit Index.
//
// Mirrors tests/control-matrix-paths-exist.test.js shape verbatim.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

describe("SECURITY.md — DOC-10 path-existence sweep (Phase 11 Wave 6)", () => {
  const src = readFileSync(resolve(process.cwd(), "SECURITY.md"), "utf-8");

  // Test 1 — SECURITY.md is at least 1300 lines (Wave 1 added ~150 lines for
  // ToC + 3 promoted sections; Wave 6 appends § Phase 11 Audit Index).
  it("SECURITY.md is at least 1300 lines long (Wave 1 + Wave 6 expansions in place)", () => {
    const lines = src.split("\n").length;
    expect(lines, `expected >= 1300 lines; found ${lines}`).toBeGreaterThanOrEqual(1300);
  });

  // Test 2 — every code-path-shaped citation extracted from SECURITY.md must
  // exist on disk (or be tracked in git ls-files for glob patterns).
  it("every cited code path exists on disk (or in git ls-files)", () => {
    const pathRegex =
      /(src|functions|tests|runbooks|docs|public|scripts)\/[A-Za-z0-9_./*-]+\.[A-Za-z0-9]+|\.github\/workflows\/[a-z0-9-]+\.ya?ml|firebase\.json|firestore\.rules|storage\.rules|package(?:-lock)?\.json|\.gitleaks\.toml|vite\.config\.js|vitest\.config\.js|vitest\.rules\.config\.js|eslint\.config\.js|index\.html|styles\.css|PRIVACY\.md|THREAT_MODEL\.md|CONTRIBUTING\.md/g;

    const tracked = new Set(
      execSync("git ls-files", { cwd: process.cwd() })
        .toString()
        .split("\n")
        .filter(Boolean)
        .map((p) => p.replace(/\\/g, "/")),
    );

    const cited = [...new Set([...src.matchAll(pathRegex)].map((m) => m[0]))];
    expect(cited.length, "expected at least one code-path citation").toBeGreaterThan(0);

    const missing = [];
    cited.forEach((p) => {
      if (p.includes("*")) {
        const globRegex = new RegExp(
          "^" + p.replace(/\./g, "\\.").replace(/\*\*/g, ".+").replace(/\*/g, "[^/]+") + "$",
        );
        const anyMatch = [...tracked].some((t) => globRegex.test(t));
        if (!anyMatch) missing.push(p);
      } else {
        if (!existsSync(resolve(process.cwd(), p)) && !tracked.has(p)) {
          missing.push(p);
        }
      }
    });
    expect(missing, `Missing or stale citations in SECURITY.md: ${missing.join(", ")}`).toEqual([]);
  });

  // Test 3 — zero citations contain a `:NN` line-number suffix (Pitfall 4).
  it("zero citations contain `:NN` line-number suffixes (Pitfall 4)", () => {
    const lineNumberSuffix =
      /(?:src|functions|tests|runbooks|docs|public|scripts|\.github)\/[A-Za-z0-9_./*-]+\.[A-Za-z0-9]+:\d+|(?:firebase\.json|firestore\.rules|storage\.rules|package\.json|index\.html|styles\.css|vite\.config\.js|PRIVACY\.md|THREAT_MODEL\.md):\d+/g;
    const offenders = [...new Set([...src.matchAll(lineNumberSuffix)].map((m) => m[0]))];
    expect(
      offenders,
      `Citations with :NN line-number suffix in SECURITY.md: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
