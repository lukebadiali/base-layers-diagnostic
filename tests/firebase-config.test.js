// @ts-check
// Phase 3 (HOST-01, HOST-03, HOST-04, HOST-05): schema-validate firebase.json
// Guards against (a) silent header drop (T-3-1) and (b) rewrite reordering that
// would shadow the function rewrite behind the SPA fallback (T-3-2).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cfg = JSON.parse(
  readFileSync(resolve(process.cwd(), "firebase.json"), "utf-8"),
);
const rewrites = cfg.hosting.rewrites;
const globalHeaders = cfg.hosting.headers.find((h) => h.source === "**")?.headers ?? [];
const headerByKey = (key) =>
  globalHeaders.find((h) => h.key.toLowerCase() === key.toLowerCase());

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
});
