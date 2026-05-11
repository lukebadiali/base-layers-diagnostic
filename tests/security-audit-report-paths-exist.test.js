// @ts-nocheck
/* eslint-disable security/detect-non-literal-regexp */
// tests/security-audit-report-paths-exist.test.js
//
// Phase 12 Wave 3 (WALK-03 — Pitfall 6 wishlist gate): asserts every code-path
// cited in SECURITY_AUDIT_REPORT.md resolves to a real file on disk (or in git ls-files
// for glob patterns), AND zero `:NN` line-number suffixes (Pitfall 4 carry-forward gate).
//
// Mirrors tests/security-md-paths-exist.test.js Test 2 + Test 3 verbatim,
// retargeted at SECURITY_AUDIT_REPORT.md instead of SECURITY.md.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

describe("SECURITY_AUDIT_REPORT.md — Pitfall 6 wishlist + Pitfall 4 line-number drift sweep (Phase 12 Wave 3)", () => {
  const REPORT_PATH = resolve(process.cwd(), "SECURITY_AUDIT_REPORT.md");
  const src = readFileSync(REPORT_PATH, "utf-8");

  it("Test 1: SECURITY_AUDIT_REPORT.md is at least 200 lines (substrate has §2..§5 + §6 + §7 + §10 + §13 = 4-sub-section)", () => {
    const lines = src.split("\n").length;
    expect(lines, `expected >= 200 lines; found ${lines}`).toBeGreaterThanOrEqual(200);
  });

  it("Test 2: every cited code path exists on disk (or in git ls-files)", () => {
    const pathRegex =
      /(src|functions|tests|runbooks|docs|public|scripts)\/[A-Za-z0-9_./*-]+\.[A-Za-z0-9]+|\.github\/workflows\/[a-z0-9-]+\.ya?ml|firebase\.json|firestore\.rules|storage\.rules|package(?:-lock)?\.json|\.gitleaks\.toml|vite\.config\.js|vitest\.config\.js|vitest\.rules\.config\.js|eslint\.config\.js|index\.html|styles\.css|PRIVACY\.md|THREAT_MODEL\.md|CONTRIBUTING\.md|SECURITY\.md|SECURITY_AUDIT\.md|SECURITY_AUDIT_REPORT\.md/g;

    const tracked = new Set(
      execSync("git ls-files", { cwd: process.cwd() })
        .toString()
        .split("\n")
        .filter(Boolean)
        .map((p) => p.replace(/\\/g, "/")),
    );

    // Pitfall 19 substrate-honest: strip backtick-quoted paths followed by
    // `(PENDING-OPERATOR ...)` or `(verifiable absence)` annotations before
    // extraction — those rows cite paths whose evidence is in transition (Pitfall 19)
    // or whose evidence IS the absence (LLM N/A rows cite package.json for verifiable absence;
    // the path itself must still exist on disk — that's enforced by the extraction).
    const stripped = src
      .replace(
        /`[^`]+\.(png|jpg|jpeg|svg|gif|webp|md)`\s*\(PENDING-OPERATOR[^)]*\)/g,
        "(PENDING-OPERATOR)",
      )
      .replace(/\*\*PENDING-OPERATOR[^*]*\*\*[^|`\n]*/g, "**PENDING-OPERATOR**")
      // Strip docs/evidence/*.png paths — PENDING-OPERATOR captures, will exist post-operator session.
      .replace(/`docs\/evidence\/[a-z0-9-]+\.png`/g, "(evidence-pending)");

    const cited = [...new Set([...stripped.matchAll(pathRegex)].map((m) => m[0]))];
    expect(cited.length, "expected at least one code-path citation").toBeGreaterThan(0);

    const missing = [];
    cited.forEach((p) => {
      if (p.includes("*")) {
        // Glob handling — same shape as tests/security-md-paths-exist.test.js Test 2.
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
    expect(
      missing,
      `Missing or stale citations in SECURITY_AUDIT_REPORT.md: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("Test 3: zero citations contain `:NN` line-number suffixes (Pitfall 4)", () => {
    const lineNumberSuffix =
      /(?:src|functions|tests|runbooks|docs|public|scripts|\.github)\/[A-Za-z0-9_./*-]+\.[A-Za-z0-9]+:\d+|(?:firebase\.json|firestore\.rules|storage\.rules|package\.json|index\.html|styles\.css|vite\.config\.js|PRIVACY\.md|THREAT_MODEL\.md|SECURITY\.md|SECURITY_AUDIT\.md|SECURITY_AUDIT_REPORT\.md):\d+/g;
    const offenders = [...new Set([...src.matchAll(lineNumberSuffix)].map((m) => m[0]))];
    expect(
      offenders,
      `Pitfall 4 :NN offenders in SECURITY_AUDIT_REPORT.md: ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});
