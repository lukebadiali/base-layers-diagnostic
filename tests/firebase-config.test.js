// @ts-check
// Phase 3 (HOST-01, HOST-03, HOST-04, HOST-05): schema-validate firebase.json
// Guards against (a) silent header drop (T-3-1) and (b) rewrite reordering that
// would shadow the function rewrite behind the SPA fallback (T-3-2).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cfg = JSON.parse(readFileSync(resolve(process.cwd(), "firebase.json"), "utf-8"));
const rewrites = cfg.hosting.rewrites;
const globalHeaders = cfg.hosting.headers.find((h) => h.source === "**")?.headers ?? [];
const headerByKey = (key) => globalHeaders.find((h) => h.key.toLowerCase() === key.toLowerCase());

describe("firebase.json — hosting basics", () => {
  it("public is set to dist", () => {
    expect(cfg.hosting.public).toBe("dist");
  });
});

describe("firebase.json — rewrite ordering (T-3-2 mitigation)", () => {
  it("function rewrite for /api/csp-violations appears BEFORE the SPA fallback **", () => {
    const fnIdx = rewrites.findIndex((r) => r.source === "/api/csp-violations");
    const spaIdx = rewrites.findIndex((r) => r.source === "**");
    expect(fnIdx).toBeGreaterThanOrEqual(0);
    expect(spaIdx).toBeGreaterThanOrEqual(0);
    expect(fnIdx).toBeLessThan(spaIdx);
  });

  it("function rewrite points at cspReportSink in europe-west2", () => {
    const fn = rewrites.find((r) => r.source === "/api/csp-violations");
    expect(fn?.function?.functionId).toBe("cspReportSink");
    expect(fn?.function?.region).toBe("europe-west2");
  });

  it("SPA fallback destination is /index.html", () => {
    const spa = rewrites.find((r) => r.source === "**");
    expect(spa?.destination).toBe("/index.html");
  });
});

describe("firebase.json — security headers present (T-3-1 mitigation)", () => {
  it.each([
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Embedder-Policy",
    "Cross-Origin-Resource-Policy",
    "Reporting-Endpoints",
    "Content-Security-Policy-Report-Only",
  ])("header '%s' is present in the source:** block", (key) => {
    expect(headerByKey(key)).toBeDefined();
  });
});

describe("firebase.json — header values (HSTS preload + COEP + CSP)", () => {
  it("HSTS includes max-age, includeSubDomains, and preload tokens", () => {
    const v = headerByKey("Strict-Transport-Security")?.value ?? "";
    expect(v).toMatch(/max-age=63072000/);
    expect(v).toContain("includeSubDomains");
    expect(v).toContain("preload");
  });

  it("COOP is same-origin and COEP is credentialless", () => {
    expect(headerByKey("Cross-Origin-Opener-Policy")?.value).toBe("same-origin");
    expect(headerByKey("Cross-Origin-Embedder-Policy")?.value).toBe("credentialless");
  });

  it("CSP Report-Only contains frame-ancestors 'none' and dual reporting", () => {
    const v = headerByKey("Content-Security-Policy-Report-Only")?.value ?? "";
    expect(v).toContain("frame-ancestors 'none'");
    expect(v).toContain("report-uri /api/csp-violations");
    expect(v).toContain("report-to csp-endpoint");
  });

  it("Reporting-Endpoints names csp-endpoint pointing at /api/csp-violations", () => {
    const v = headerByKey("Reporting-Endpoints")?.value ?? "";
    expect(v).toContain('csp-endpoint="/api/csp-violations"');
  });

  // Phase 4 Wave 1 (D-08): chart.js npm import + Inter/Bebas Neue self-host let
  // us drop the 3 CDN allowlist entries Phase 3 D-07 carried as temporary.
  it("CSP-RO header drops cdn.jsdelivr.net + fonts.googleapis.com + fonts.gstatic.com (Phase 4 D-08)", () => {
    const csp = headerByKey("Content-Security-Policy-Report-Only")?.value ?? "";
    expect(csp).not.toMatch(/cdn\.jsdelivr\.net/);
    expect(csp).not.toMatch(/fonts\.googleapis\.com/);
    expect(csp).not.toMatch(/fonts\.gstatic\.com/);
  });
});

// Phase 10 Wave 2 (HOST-07): assert the TIGHTENED CSP-RO shape. The header
// KEY remains `Content-Security-Policy-Report-Only` at Wave 2 — Wave 4
// (Plan 10-04) flips the key to `Content-Security-Policy` and updates the
// first assertion below to target the enforced key.
describe("firebase.json — Phase 10 tightened CSP shape (HOST-07)", () => {
  const cspKey = "Content-Security-Policy-Report-Only";

  it("style-src is locked to 'self' — no 'unsafe-inline'", () => {
    const csp = headerByKey(cspKey)?.value ?? "";
    expect(csp).toMatch(/style-src 'self'(?!\s*'unsafe-inline')/);
    expect(csp).not.toMatch(/style-src[^;]*'unsafe-inline'/);
  });

  it("connect-src includes Sentry EU origin (https://de.sentry.io) — Pitfall 10B", () => {
    const csp = headerByKey(cspKey)?.value ?? "";
    expect(csp).toContain("https://de.sentry.io");
  });

  it("frame-src is 'self' (no firebaseapp.com popup origin)", () => {
    const csp = headerByKey(cspKey)?.value ?? "";
    expect(csp).toMatch(/frame-src 'self'/);
    expect(csp).not.toMatch(/firebaseapp\.com/);
  });

  it("base-uri 'self' and form-action 'self' present (HOST-07 SC#1)", () => {
    const csp = headerByKey(cspKey)?.value ?? "";
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("default-src + object-src + frame-ancestors retain Phase 3 substrate", () => {
    const csp = headerByKey(cspKey)?.value ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  // HOST-06 substrate test — actual submission verification is Plan 10-05 manual operator runbook
  it("HSTS preload-eligible: max-age >= 31536000, includeSubDomains, preload", () => {
    const v = headerByKey("Strict-Transport-Security")?.value ?? "";
    const m = v.match(/max-age=(\d+)/);
    expect(m).toBeTruthy();
    expect(parseInt(m[1], 10)).toBeGreaterThanOrEqual(31536000);
    expect(v).toContain("includeSubDomains");
    expect(v).toContain("preload");
  });
});
