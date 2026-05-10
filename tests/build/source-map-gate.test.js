// tests/build/source-map-gate.test.js
// @ts-check
//
// Phase 9 Wave 2 (OBS-04 / Pitfall 6): defensive harness asserting vite.config.js
// contains the sentryVitePlugin registration and the filesToDeleteAfterUpload
// hidden-source-map gate. The CI deploy job runs the real assertion via
// `find dist -name "*.map"` after build; this test catches drift at the
// config-file level so missing config doesn't slip into a green PR.
//
// This is a static-source assertion (regex over the file body) — it does NOT
// execute vite. The CI .map deletion gate in .github/workflows/ci.yml is the
// runtime correctness check; this harness is the cheap drift detector.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("vite.config.js — Sentry source-map upload gate (OBS-04)", () => {
  // Vitest runs with cwd=project-root; path.resolve sidesteps the happy-dom
  // import.meta.url scheme issue (test env serves http:// not file://).
  const src = readFileSync(resolve(process.cwd(), "vite.config.js"), "utf-8");

  it("imports sentryVitePlugin from @sentry/vite-plugin", () => {
    expect(src).toMatch(/import \{ sentryVitePlugin \} from "@sentry\/vite-plugin"/);
  });

  it("registers the plugin under SENTRY_AUTH_TOKEN guard + command==='build'", () => {
    // The condition order is: env.SENTRY_AUTH_TOKEN && command === "build" && sentryVitePlugin(...)
    // The /s flag enables dotall so the regex spans line breaks between the guard tokens
    // and the plugin invocation.
    expect(src).toMatch(/SENTRY_AUTH_TOKEN.*command\s*===\s*"build".*sentryVitePlugin\(/s);
  });

  it("uses EU region URL https://de.sentry.io/", () => {
    expect(src).toMatch(/url:\s*"https:\/\/de\.sentry\.io\/"/);
  });

  it("declares filesToDeleteAfterUpload with dist/**/*.map glob (Pitfall 6 — hidden source maps)", () => {
    expect(src).toMatch(/filesToDeleteAfterUpload:\s*\["dist\/\*\*\/\*\.map"\]/);
  });

  it("disables plugin telemetry", () => {
    expect(src).toMatch(/telemetry:\s*false/);
  });
});
