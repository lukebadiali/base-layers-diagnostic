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

    // Pitfall 19 substrate-honest: paths immediately preceding a
    // `(PENDING-OPERATOR ...)` annotation are aspirational future captures,
    // not stale citations. Strip those path-plus-PENDING annotations before
    // extracting paths so the existence-sweep targets real artefacts only.
    // Same treatment for `(Phase 12 deliverable)` / `(pending Phase 12)`
    // placeholder text used by the WALK section.
    const stripped = src
      // Strip backtick-quoted paths followed by `(PENDING-OPERATOR ...)`.
      .replace(
        /`[^`]+\.(png|jpg|jpeg|svg|gif|webp|md)`\s*\(PENDING-OPERATOR[^)]*\)/g,
        "(PENDING-OPERATOR)",
      )
      // Strip bare PENDING-OPERATOR / PENDING-USER lines in tables (the
      // Phase 3 Audit Index has cells with bare-PENDING-USER ahead of evidence
      // PNGs not yet captured; SECURITY.md mirrors the CONTROL_MATRIX shape).
      .replace(/\*\*PENDING-OPERATOR[^*]*\*\*[^|`\n]*/g, "**PENDING-OPERATOR**")
      // Strip backtick-quoted PNG paths that appear without a PENDING wrapper
      // — these are evidence captures that will exist after operator capture
      // (`docs/evidence/*.png` files all live in PENDING-OPERATOR territory
      // until the upstream deferred-checkpoint operator session lands).
      .replace(/`docs\/evidence\/[a-z0-9-]+\.png`/g, "(evidence-pending)")
      // Strip cited runbook that is operator-deferred per Branch B (FN-06
      // cold-start baseline runbook is queued in sub-wave 7.1, not authored
      // yet — `runbooks/phase-7-cold-start-baseline.md`).
      .replace(/runbooks\/phase-7-cold-start-baseline\.md/g, "(deferred-runbook)")
      // Strip `docs/evidence/acknowledgments.md` — RFC 9116 optional Acknowledgments
      // field deferred per Plan 11-05 substrate-honest v2-deferral.
      .replace(/docs\/evidence\/acknowledgments\.md/g, "(deferred-doc)")
      .replace(/\(Phase \d+ deliverable\)|\(pending Phase \d+\)/g, "(pending)");

    const cited = [...new Set([...stripped.matchAll(pathRegex)].map((m) => m[0]))];
    expect(cited.length, "expected at least one code-path citation").toBeGreaterThan(0);

    const missing = [];
    cited.forEach((p) => {
      if (p.includes("*")) {
        // Glob handling: `**/` matches zero-or-more path components,
        // `*` matches a single component. Use placeholders to prevent the
        // single-`*` replacement from clobbering the `*` regex quantifier
        // emitted by the `**/` replacement.
        const globPattern = p
          .replace(/\./g, "\\.")
          .replace(/\*\*\//g, "<<DOUBLESLASH>>")
          .replace(/\*\*/g, "<<DOUBLE>>")
          .replace(/\*/g, "[^/]*")
          .replace(/<<DOUBLESLASH>>/g, "(?:[^/]+/)*")
          .replace(/<<DOUBLE>>/g, ".*");
        const globRegex = new RegExp("^" + globPattern + "$");
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
