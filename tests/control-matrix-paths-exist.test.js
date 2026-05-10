// tests/control-matrix-paths-exist.test.js
// @ts-check
//
// Phase 11 Wave 6 (DOC-04 + Pitfall 4): doc-shape gate asserting that
// docs/CONTROL_MATRIX.md is fully populated AND that every code-path cited
// in the matrix resolves to a real file on disk. The load-bearing test is
// Test 2 (existence sweep) — wishlist citations break the auditor narrative.
//
// Mirrors the regex-over-file-body pattern used by tests/ir-runbook-shape.test.js.
// Pitfall 4: citations are paths only — line-number suffixes (`:NN`) are forbidden.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

describe("docs/CONTROL_MATRIX.md — DOC-04 path-existence sweep (Phase 11 Wave 6)", () => {
  const src = readFileSync(resolve(process.cwd(), "docs/CONTROL_MATRIX.md"), "utf-8");

  // Test 1 — file is populated with at least 30 REQ-prefix table rows.
  // Row entries start with `| TOOL-` / `| TEST-` / `| HOST-` / etc.
  it("contains at least 30 REQ-row entries (every REQ-ID gets a row)", () => {
    const rowRegex =
      /^\| (TOOL|TEST|HOST|CODE|DATA|RULES|AUTH|FN|AUDIT|LIFE|GDPR|BACKUP|OBS|DOC|WALK)-\d/gm;
    const rows = src.match(rowRegex) || [];
    expect(rows.length, `expected >= 30 REQ-rows; found ${rows.length}`).toBeGreaterThanOrEqual(30);
  });

  // Test 2 — every code-path-shaped citation extracted from the table must
  // exist on disk (or be tracked in git ls-files for glob patterns).
  it("every cited code path exists on disk (or in git ls-files)", () => {
    // Path regex covers: rooted dirs (src|functions|tests|runbooks|docs|public|
    // scripts|.github) plus bare repo-root config files (firebase.json,
    // firestore.rules, storage.rules, package.json, eslint.config.js, etc.).
    const pathRegex =
      /(src|functions|tests|runbooks|docs|public|scripts)\/[A-Za-z0-9_./*-]+\.[A-Za-z0-9]+|\.github\/workflows\/[a-z0-9-]+\.ya?ml|firebase\.json|firestore\.rules|storage\.rules|package(?:-lock)?\.json|\.gitleaks\.toml|vite\.config\.js|vitest\.config\.js|vitest\.rules\.config\.js|eslint\.config\.js|index\.html|styles\.css|SECURITY\.md|PRIVACY\.md|THREAT_MODEL\.md|CONTRIBUTING\.md/g;

    const tracked = new Set(
      execSync("git ls-files", { cwd: process.cwd() })
        .toString()
        .split("\n")
        .filter(Boolean)
        // Normalise to forward-slash form (git ls-files already returns forward slashes
        // even on Windows, but we belt-and-brace).
        .map((p) => p.replace(/\\/g, "/")),
    );

    const cited = [...new Set([...src.matchAll(pathRegex)].map((m) => m[0]))];
    expect(cited.length, "expected at least one code-path citation").toBeGreaterThan(0);

    const missing = [];
    cited.forEach((p) => {
      if (p.includes("*")) {
        // Glob — convert `*` to `[^/]+` and `**` to `.+`, anchor full path.
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
    expect(
      missing,
      `Missing or stale citations in docs/CONTROL_MATRIX.md: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  // Test 3 — zero citations contain a line-number suffix `:NN` (Pitfall 4).
  // Paths only — never line numbers. Line numbers drift; paths are stable.
  it("zero citations contain `:NN` line-number suffixes (Pitfall 4)", () => {
    const lineNumberSuffix =
      /(?:src|functions|tests|runbooks|docs|public|scripts|\.github)\/[A-Za-z0-9_./*-]+\.[A-Za-z0-9]+:\d+|(?:firebase\.json|firestore\.rules|storage\.rules|package\.json|index\.html|styles\.css|vite\.config\.js|SECURITY\.md|PRIVACY\.md):\d+/g;
    const offenders = [...new Set([...src.matchAll(lineNumberSuffix)].map((m) => m[0]))];
    expect(
      offenders,
      `Citations with :NN line-number suffix in docs/CONTROL_MATRIX.md: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
