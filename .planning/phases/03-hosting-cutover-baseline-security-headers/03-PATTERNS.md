# Phase 3: Hosting Cutover + Baseline Security Headers — Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 19 (15 new, 4 modified)
**Analogs found:** 19 / 19 (all green-field — closest cross-cutting patterns extracted)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `firebase.json` | config | request-response | `03-RESEARCH.md` §firebase.json Skeleton | research-skeleton |
| `.firebaserc` | config | — | `03-RESEARCH.md` (trivial JSON) | research-skeleton |
| `functions/package.json` | config | — | root `package.json` (scripts vocabulary) | role-match |
| `functions/tsconfig.json` | config | — | root `tsconfig.json` (standalone, incompatible options) | anti-analog (do NOT extend root) |
| `functions/src/index.ts` | config (entry) | — | `03-RESEARCH.md` §functions/ Directory Structure | research-skeleton |
| `functions/src/csp/cspReportSink.ts` | cloud-function | request-response | `03-RESEARCH.md` §Pattern 1 onRequest handler | research-skeleton |
| `functions/src/csp/normalise.ts` | utility | transform | extracted from `03-RESEARCH.md` §Pattern 1 `normalise()` | research-skeleton |
| `functions/src/csp/filter.ts` | utility | transform | extracted from `03-RESEARCH.md` §Pattern 1 `shouldDrop()` | research-skeleton |
| `functions/src/csp/dedup.ts` | utility | event-driven | extracted from `03-RESEARCH.md` §Pattern 1 dedup map | research-skeleton |
| `functions/test/csp/normalise.test.ts` | test | transform | `tests/domain/banding.test.js` (vitest boundary-table style, but TS mode) | role-match + mode-diff |
| `functions/test/csp/filter.test.ts` | test | transform | `tests/domain/banding.test.js` | role-match + mode-diff |
| `functions/test/csp/dedup.test.ts` | test | event-driven | `tests/util/ids.test.js` (fake-timer aware) | role-match + mode-diff |
| `functions/.eslintrc.cjs` | config | — | root `eslint.config.js` (flat config) | anti-analog (CommonJS, not flat) |
| `functions/.gitignore` | config | — | root `.gitignore` (node_modules / dist pattern) | role-match |
| `runbooks/hosting-cutover.md` | runbook | — | `runbooks/firebase-oidc-bootstrap.md` | exact-role |
| `tests/firebase-config.test.js` | test | request-response | `tests/util/ids.test.js` + `tests/setup.test.js` (JS+JSDoc vitest root style) | role-match |
| `.github/workflows/ci.yml` (modified) | CI | — | existing `lint`, `test`, `build` jobs in same file (lines 25–132) | exact-role |
| `SECURITY.md` (modified) | doc | — | `SECURITY.md` §Build & Supply Chain (lines 19–75), §Dependency Monitoring (lines 77–127) | exact-role |
| `runbooks/phase-4-cleanup-ledger.md` (modified) | doc | — | existing ledger table (lines 19–58) | exact-role |

---

## Pattern Assignments

### `firebase.json` (config)

**Analog:** `03-RESEARCH.md` §firebase.json Skeleton (verified ordering)

**Core pattern** — the exact skeleton to copy verbatim (research-verified):
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          {
            "key": "Permissions-Policy",
            "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), bluetooth=(), hid=(), midi=(), serial=(), display-capture=(), idle-detection=(), browsing-topics=(), autoplay=(), encrypted-media=(), picture-in-picture=(), fullscreen=(), screen-wake-lock=(), web-share=()"
          },
          { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
          { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" },
          { "key": "Cross-Origin-Resource-Policy", "value": "same-origin" },
          { "key": "Reporting-Endpoints", "value": "csp-endpoint=\"/api/csp-violations\"" },
          {
            "key": "Content-Security-Policy-Report-Only",
            "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-src https://bedeveloped-base-layers.firebaseapp.com; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; report-uri /api/csp-violations; report-to csp-endpoint"
          }
        ]
      },
      {
        "source": "index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      },
      {
        "source": "**/*.@(js|css|png|svg|woff2|ico)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ],
    "rewrites": [
      {
        "source": "/api/csp-violations",
        "function": { "functionId": "cspReportSink", "region": "europe-west2" }
      },
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log", "*.local.json"]
    }
  ],
  "emulators": {
    "hosting": { "port": 5002 },
    "functions": { "port": 5001 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

**DO NOT copy:** The RESEARCH.md skeleton's `Permissions-Policy` directive list (`interest-cohort` only). Use the expanded list above which adds `browsing-topics` (replaces deprecated FLoC directive) and all hardware/media capabilities per research §Permissions-Policy Directive List.

**CRITICAL ordering constraint:** `/api/csp-violations` rewrite MUST appear before `**` SPA fallback. Reversed order silently returns `index.html` for every CSP POST — no error, no traffic to function.

**Pre-flight check required:** Run `npm run build` and inspect `dist/index.html` — if Google Fonts CDN links survive the Vite build, add `https://fonts.googleapis.com` to `style-src` and `https://fonts.gstatic.com` to `font-src`.

---

### `.firebaserc` (config)

**Analog:** Firebase docs convention (trivial JSON, no existing analog in repo)

**Pattern:**
```json
{
  "projects": {
    "default": "bedeveloped-base-layers"
  }
}
```

Project ID `bedeveloped-base-layers` is confirmed in `runbooks/firebase-oidc-bootstrap.md` line 9 and `INTEGRATIONS.md`. Verify with `firebase projects:list` before committing.

---

### `functions/package.json` (config)

**Analog:** root `package.json` (lines 1–51) — scripts vocabulary must match

**Scripts pattern** (copy the vocabulary `lint`/`build`/`typecheck` from root; omit `test` until vitest is wired as a Phase 3 task):
```json
{
  "name": "base-layers-functions",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": "22" },
  "main": "lib/index.js",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "lint": "eslint src/ --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "firebase-admin": "13.8.0",
    "firebase-functions": "7.2.5"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "vitest": "4.1.5",
    "@vitest/coverage-v8": "4.1.5"
  }
}
```

**Script vocabulary rule (from root `package.json` lines 9–21):** use `lint` (not `eslint`), `build` (not `compile`), `typecheck` (not `tsc`), `test` (not `vitest`), `test:coverage` (not `coverage`). This mirrors the root exactly so CI can call `npm run build` / `npm run lint` with the same command surface.

**DO NOT copy from root:** `"type": "module"` — functions workspace uses CommonJS (`"module": "commonjs"` in tsconfig). Omit `"type"` field entirely.

**DO NOT copy from root:** `workspaces` field — this workspace is intentionally standalone. Root `package.json` must NOT be modified to add `functions/` as a workspace member.

**`"main": "lib/index.js"` is required** — Firebase deploy tool reads this field to find the compiled entry point. Missing it causes a silent deploy failure.

**`"engines": { "node": "22" }` is required** — Firebase 2nd-gen defaults to Node 18 if absent.

---

### `functions/tsconfig.json` (config)

**Analog:** root `tsconfig.json` (lines 1–26) — DO NOT EXTEND; shape differs fundamentally

**Standalone pattern** (research-verified — `03-RESEARCH.md` §functions/tsconfig.json):
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2022",
    "esModuleInterop": true
  },
  "compileOnSave": true,
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**DO NOT extend root `tsconfig.json`.** Root uses `"module": "esnext", "moduleResolution": "bundler", "allowJs": true, "checkJs": true, "noEmit": true` — all Vite-oriented, incompatible with Cloud Functions which need `"module": "commonjs", "outDir": "lib"`.

**Root `tsconfig.json` action required:** Add `"functions/**"` to the root `exclude` array (current: `["node_modules", "dist", "functions/lib", "coverage", ...]`). Without this, root `tsc --noEmit` attempts to type-check real TypeScript files in `functions/src/` as JSDoc, producing false errors. Change `"functions/lib"` → `"functions/**"`.

---

### `functions/src/index.ts` (config — entry point)

**Analog:** `03-RESEARCH.md` §functions/ Directory Structure

**Pattern:**
```typescript
// functions/src/index.ts
// Phase 3: CSP report sink. Phase 7 expands this file with App Check,
// Zod validation, per-function service accounts, and audit-log writers.
export { cspReportSink } from "./csp/cspReportSink.js";
```

This file only re-exports. Phase 7 adds additional exports here. The `.js` extension in the import path is required even for TypeScript source files when `"module": "commonjs"` compiles to Node.js.

---

### `functions/src/csp/cspReportSink.ts` (cloud-function, request-response)

**Analog:** `03-RESEARCH.md` §Pattern 1 (lines 277–426 of RESEARCH.md) — the full handler

**Imports pattern:**
```typescript
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { normalise } from "./normalise.js";
import { shouldDrop } from "./filter.js";
import { isDuplicate, markSeen } from "./dedup.js";
```

**Core pattern** — HTTPS onRequest with region pin (D-04a + D-06):
```typescript
export const cspReportSink = onRequest(
  { region: "europe-west2" },
  (req, res) => {
    // D-12: content-type gate
    const contentType = req.headers["content-type"] ?? "";
    const isLegacy = contentType.includes("application/csp-report");
    const isModern = contentType.includes("application/reports+json");
    if (!isLegacy && !isModern) { res.status(400).send("Bad Request"); return; }

    // D-12: body-size gate (64 KB)
    const bodySize = parseInt(req.headers["content-length"] ?? "0", 10);
    if (bodySize > 64 * 1024) { res.status(413).send("Payload Too Large"); return; }

    const report = normalise(req.body);
    if (!report) { res.status(204).send(); return; }

    if (shouldDrop(report)) { res.status(204).send(); return; }

    if (isDuplicate(report)) { res.status(204).send(); return; }
    markSeen(report);

    // D-10: structured log — logger.warn yields severity=WARNING + queryable jsonPayload
    logger.warn("csp.violation", { report, fingerprint: ... });

    res.status(204).send();
  }
);
```

**DO NOT use `console.warn(JSON.stringify({severity:"WARNING",...}))`** — this puts output in `textPayload` (a string) not `jsonPayload` (structured fields). Cloud Logging Logs Explorer queries on `jsonPayload.report.violatedDirective` will fail silently. Use `logger.warn(message, obj)` from `firebase-functions/logger` (research §Pattern 2).

**Response is always 204** (success or filtered) — never 200 for a browser CSP report. Browser ignores the body; 204 is the conventional acknowledgement.

---

### `functions/src/csp/normalise.ts` (utility, transform)

**Analog:** `03-RESEARCH.md` §Pattern 1 `normalise()` function (lines 309–343)

**Interface + core pattern:**
```typescript
export interface NormalisedReport {
  blockedUri: string;
  violatedDirective: string;
  documentUri: string;
  disposition: string;
  sourceFile?: string;
}

export function normalise(body: unknown): NormalisedReport | null {
  // Modern: application/reports+json — body is Array<{type, body}>
  if (Array.isArray(body)) {
    const report = (body as Array<{type?: string; body?: Record<string, unknown>}>)
      .find((r) => r.type === "csp-violation");
    if (!report?.body) return null;
    const b = report.body;
    return {
      blockedUri:        String(b["blockedURL"]          ?? ""),
      violatedDirective: String(b["effectiveDirective"]  ?? ""),
      documentUri:       String(b["documentURL"]         ?? ""),
      disposition:       String(b["disposition"]         ?? "report-only"),
      sourceFile:        b["sourceFile"] ? String(b["sourceFile"]) : undefined,
    };
  }
  // Legacy: application/csp-report — body is { "csp-report": {...} }
  const obj = body as Record<string, unknown>;
  const csp = obj["csp-report"] as Record<string, unknown> | undefined;
  if (csp && typeof csp === "object") {
    return {
      blockedUri:        String(csp["blocked-uri"]          ?? ""),
      violatedDirective: String(csp["effective-directive"]  ?? csp["violated-directive"] ?? ""),
      documentUri:       String(csp["document-uri"]         ?? ""),
      disposition:       String(csp["disposition"]          ?? "report-only"),
      sourceFile:        csp["source-file"] ? String(csp["source-file"]) : undefined,
    };
  }
  return null;
}
```

**Field name difference to watch:** Modern format uses camelCase (`blockedURL`, `documentURL`, `effectiveDirective`); legacy format uses kebab-case (`blocked-uri`, `document-uri`, `effective-directive`). Both must be normalised to the same `NormalisedReport` shape.

---

### `functions/src/csp/filter.ts` (utility, transform)

**Analog:** `03-RESEARCH.md` §Pattern 1 `shouldDrop()` and `EXTENSION_SCHEMES` / `SYNTHETIC_ORIGINS` constants (lines 289–377)

**Core pattern:**
```typescript
const EXTENSION_SCHEMES = [
  "chrome-extension://", "moz-extension://", "safari-web-extension://",
  "webkit-masked-url://", "safari-extension://",
];
const SYNTHETIC_ORIGINS = ["about:srcdoc", "about:blank", "data:"];

export function shouldDrop(r: NormalisedReport): boolean {
  const blocked = r.blockedUri;
  const srcFile = r.sourceFile ?? "";
  // Drop extension origins (typically 70-90% of unfiltered CSP volume)
  for (const scheme of EXTENSION_SCHEMES) {
    if (blocked.startsWith(scheme) || srcFile.startsWith(scheme)) return true;
  }
  // Drop synthetic origins
  for (const synthetic of SYNTHETIC_ORIGINS) {
    if (blocked.startsWith(synthetic) || srcFile.startsWith(synthetic)) return true;
  }
  // D-11: Keep document-uri mismatches during soak window (tighten in Phase 10)
  return false;
}
```

**DO NOT add `document-uri` filtering yet** — D-11 explicitly keeps document-uri-mismatch reports during the soak window. Add a `// TODO Phase 10: tighten document-uri filter` comment where that logic will go.

---

### `functions/src/csp/dedup.ts` (utility, event-driven)

**Analog:** `03-RESEARCH.md` §Pattern 1 dedup map + `fingerprint()` function (lines 283–288, 345–355)

**Core pattern:**
```typescript
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const recentFingerprints = new Map<string, number>();

export function fingerprint(r: NormalisedReport): string {
  let blocked = r.blockedUri.toLowerCase();
  try {
    const url = new URL(blocked);
    blocked = url.origin; // strip path/query, keep scheme+host
  } catch {
    // not a URL (e.g. "inline", "eval") — use as-is
  }
  return `${blocked}|${r.violatedDirective.toLowerCase()}`;
}

export function isDuplicate(r: NormalisedReport): boolean {
  const fp = fingerprint(r);
  const last = recentFingerprints.get(fp) ?? 0;
  return Date.now() - last < DEDUP_WINDOW_MS;
}

export function markSeen(r: NormalisedReport): void {
  recentFingerprints.set(fingerprint(r), Date.now());
}

/** Exposed for testing with fake timers */
export function _clearForTest(): void {
  recentFingerprints.clear();
}
```

**Cold-start behaviour:** Module-level `Map` is reset on every cold start — acceptable; across cold-starts we re-log once per dedup window, not per session (D-11).

**Dedup key:** `${origin}|${directive}` — lowercase origin (scheme+host, no path/query) + lowercase directive name. This is the canonical tuple per D-11.

---

### `functions/test/csp/normalise.test.ts` (test, transform)

**Analog:** `tests/domain/banding.test.js` (lines 1–50) — vitest boundary-table style

**Key differences from root JS tests:**
- Real TypeScript (no `// @ts-check` comment needed — it IS TypeScript)
- No `// @ts-check` header
- Import paths use `.js` extension even for `.ts` source files (TS CommonJS convention)
- No global setup file (functions tests do not use `tests/setup.js` fake timers unless a `vitest.config.ts` in `functions/` references one)
- `describe` + `it.each` table-driven pattern carries over exactly

**Pattern:**
```typescript
// functions/test/csp/normalise.test.ts
import { describe, it, expect } from "vitest";
import { normalise } from "../../src/csp/normalise.js";

describe("normalise — modern reports+json format", () => {
  it("extracts fields from a valid csp-violation report", () => {
    const body = [{ type: "csp-violation", body: {
      blockedURL: "https://evil.example/script.js",
      effectiveDirective: "script-src-elem",
      documentURL: "https://baselayers.bedeveloped.com/",
      disposition: "report-only",
    }}];
    const result = normalise(body);
    expect(result).toEqual({
      blockedUri: "https://evil.example/script.js",
      violatedDirective: "script-src-elem",
      documentUri: "https://baselayers.bedeveloped.com/",
      disposition: "report-only",
      sourceFile: undefined,
    });
  });
  // ... legacy format cases, null body, missing type, etc.
});
```

**DO NOT import from `../../tests/setup.js`** — the root setup file is ESM and won't resolve in a CommonJS functions workspace. Fake timers for dedup tests are configured separately (see `dedup.test.ts` below).

---

### `functions/test/csp/filter.test.ts` (test, transform)

**Analog:** `tests/domain/banding.test.js` — boundary-table `it.each` style

**Pattern:** Same TypeScript vitest pattern as `normalise.test.ts`. Table-drive with `it.each`:
```typescript
import { describe, it, expect } from "vitest";
import { shouldDrop } from "../../src/csp/filter.js";
import type { NormalisedReport } from "../../src/csp/normalise.js";

const base: NormalisedReport = {
  blockedUri: "https://example.com/bad.js",
  violatedDirective: "script-src-elem",
  documentUri: "https://baselayers.bedeveloped.com/",
  disposition: "report-only",
};

describe("shouldDrop — extension origins", () => {
  it.each([
    "chrome-extension://abc/inject.js",
    "moz-extension://xyz/content.js",
    "safari-web-extension://id/script.js",
    "webkit-masked-url://fake",
    "safari-extension://ext/script.js",
  ])("drops blockedUri starting with %s", (blocked) => {
    expect(shouldDrop({ ...base, blockedUri: blocked })).toBe(true);
  });
});
```

---

### `functions/test/csp/dedup.test.ts` (test, event-driven)

**Analog:** `tests/util/ids.test.js` (fake-timer aware pattern) — but in TypeScript + vitest fake timers API

**Key difference from root tests:** Root fake timers are configured globally in `tests/setup.js`. Functions tests use vitest's `vi.useFakeTimers()` / `vi.useRealTimers()` locally per test, since there is no shared setup file in the functions workspace.

**Pattern:**
```typescript
// functions/test/csp/dedup.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { isDuplicate, markSeen, _clearForTest } from "../../src/csp/dedup.js";
import type { NormalisedReport } from "../../src/csp/normalise.js";

const report: NormalisedReport = {
  blockedUri: "https://evil.example/x.js",
  violatedDirective: "script-src-elem",
  documentUri: "https://baselayers.bedeveloped.com/",
  disposition: "report-only",
};

describe("dedup — 5-minute window", () => {
  beforeEach(() => {
    _clearForTest();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("first occurrence is not a duplicate", () => {
    expect(isDuplicate(report)).toBe(false);
  });

  it("second occurrence within 5 min is a duplicate", () => {
    markSeen(report);
    vi.advanceTimersByTime(4 * 60 * 1000 + 59_000); // 4m59s
    expect(isDuplicate(report)).toBe(true);
  });

  it("occurrence after 5 min is NOT a duplicate", () => {
    markSeen(report);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1); // 5m0.001s
    expect(isDuplicate(report)).toBe(false);
  });
});
```

**`_clearForTest()` export is required** — the module-level `Map` persists across tests in the same worker. Without a clear hook, tests pollute each other's dedup state.

---

### `functions/.eslintrc.cjs` (config)

**Analog:** root `eslint.config.js` — flat config, but functions workspace uses CommonJS

**Pattern** (CommonJS `.eslintrc.cjs` format, NOT flat config):
```javascript
// functions/.eslintrc.cjs
"use strict";

module.exports = {
  env: {
    es2022: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    "no-console": "error",  // must use logger.warn not console.warn
    "@typescript-eslint/no-explicit-any": "warn",
  },
};
```

**DO NOT use root flat config format (`eslint.config.js`).** The functions workspace uses CommonJS (`"type"` field absent = CommonJS by default for Node). ESLint flat config requires ESM. Use `.eslintrc.cjs` (CommonJS) in the functions directory.

**`@typescript-eslint/parser` + `@typescript-eslint` plugin are new devDependencies** in `functions/package.json` — add them.

**`"no-console": "error"` rule is important** — enforces `logger.warn` over `console.warn` (research §Pattern 2 anti-pattern).

---

### `functions/.gitignore` (config)

**Analog:** root `.gitignore` (node_modules / build output pattern)

**Pattern:**
```
node_modules/
lib/
coverage/
*.local.json
```

`lib/` is the tsc output directory (`outDir` in `functions/tsconfig.json`). Committed source is `src/`; `lib/` is always built fresh.

---

### `runbooks/hosting-cutover.md` (runbook)

**Analog:** `runbooks/firebase-oidc-bootstrap.md` (lines 1–83) — heading structure + step shape

**Structure to copy:**

```markdown
# Hosting Cutover Runbook

> Phase 3 deliverable. Execute on cutover day per D-02.
> Rollback window: 14 days from cutover date.

## Prerequisites

- Firebase Console: Hosting enabled on `bedeveloped-base-layers`
- Firebase default URL verified: `bedeveloped-base-layers.web.app`
- DNS admin access to `bedeveloped.com` registrar confirmed
- `firebase deploy --only hosting,functions` green on CI (deploy job green on main)

## Pre-cutover Smoke Checklist (on bedeveloped-base-layers.web.app)

1. App boots without console errors
2. Firestore reads work (anon auth still active until Phase 6)
3. Storage uploads work
4. Dashboard / diagnostic / report views render
5. `curl -I https://bedeveloped-base-layers.web.app` returns all headers:
   - `Strict-Transport-Security`
   - `X-Content-Type-Options`
   - `Referrer-Policy`
   - `Permissions-Policy`
   - `Cross-Origin-Opener-Policy`
   - `Cross-Origin-Embedder-Policy`
   - `Content-Security-Policy-Report-Only`
6. securityheaders.com rates >= "A" on the `.web.app` URL
7. One CSP violation report reaches Cloud Logging within 30s of test trigger

## Cutover Steps

### Step 1: Disable GitHub Pages serving

Settings → Pages → Source → None → Save.
DO NOT delete the `gh-pages` branch or any Pages workflows.

### Step 2: Lower DNS TTL

Set existing A/CNAME records for `baselayers.bedeveloped.com` to TTL=300s.
Wait 1 TTL cycle (~5 min) before updating records.

### Step 3: Add custom domain in Firebase Console

Hosting → Add custom domain → `baselayers.bedeveloped.com`.
Add the TXT verification record to the registrar.

### Step 4: Update A/AAAA records

Replace GitHub Pages IPs with Firebase Hosting IPs from the Console.

### Step 5: Monitor

`watch -n 30 "curl -sI https://baselayers.bedeveloped.com | head -5"`

Wait until HSTS + CSP-RO headers appear (Firebase serves them; GitHub Pages does not).
Total expected time: ~1h per D-02.

### Step 6: Verify securityheaders.com on live domain

Must rate >= "A".

## DNS Revert Procedure (rollback)

Time estimate: 15 min total.

1. Re-enable GitHub Pages: Settings → Pages → Source → `gh-pages` → Save (~1 min).
2. Revert DNS: Restore GitHub Pages A/CNAME records at the registrar.
3. Wait for propagation (TTL = 300s if lowered; ~5 min).
4. Verify `baselayers.bedeveloped.com` resolves to GitHub Pages again.

Rollback window closes: `<CUTOVER_DATE + 14 days>`. Record actual date here.

## Day-14 Cleanup

Commit with message `chore(03): delete GH-Pages rollback substrate (day 14)`:
1. Delete `gh-pages` branch: `git push origin --delete gh-pages`
2. If any Pages-deploy workflow exists: delete the file from `.github/workflows/`.
3. Close the cleanup ledger entry added to `runbooks/phase-4-cleanup-ledger.md`.

## Citations

- [Firebase Hosting custom domain](https://firebase.google.com/docs/hosting/custom-domain)
- [GitHub Pages disable semantics](https://docs.github.com/en/pages)
- D-02, D-03 (CONTEXT.md)
```

**Heading shape to match:** `## Prerequisites`, `## Step N: <action>`, `## Notes`, `## Citations` — same pattern as `runbooks/firebase-oidc-bootstrap.md`. Use `>` blockquote for the phase + timing context at the top.

---

### `tests/firebase-config.test.js` (test, request-response)

**Analog:** `tests/util/ids.test.js` (lines 1–12) + `tests/setup.test.js` (lines 1–24) — JS + `// @ts-check` + vitest import style

**Pattern** (JS+JSDoc, runs under root Vitest config, no fake timers needed):
```javascript
// tests/firebase-config.test.js
// @ts-check
// Phase 3: Schema-validate firebase.json hosting config — rewrite ordering,
// header presence, and SPA fallback position.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cfg = JSON.parse(
  readFileSync(resolve(process.cwd(), "firebase.json"), "utf-8")
);
const rewrites = cfg.hosting.rewrites;

describe("firebase.json — rewrite ordering", () => {
  it("function rewrite for /api/csp-violations appears before SPA fallback **", () => {
    const fnIdx = rewrites.findIndex((r) => r.source === "/api/csp-violations");
    const spaIdx = rewrites.findIndex((r) => r.source === "**");
    expect(fnIdx).toBeGreaterThanOrEqual(0);
    expect(spaIdx).toBeGreaterThanOrEqual(0);
    expect(fnIdx).toBeLessThan(spaIdx);
  });
});

describe("firebase.json — security headers present", () => {
  const globalHeaders = cfg.hosting.headers.find((h) => h.source === "**")?.headers ?? [];
  const headerKeys = globalHeaders.map((h) => h.key.toLowerCase());

  it.each([
    "strict-transport-security",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "cross-origin-opener-policy",
    "cross-origin-embedder-policy",
    "cross-origin-resource-policy",
    "reporting-endpoints",
    "content-security-policy-report-only",
  ])("header '%s' is present in source:** block", (key) => {
    expect(headerKeys).toContain(key);
  });
});
```

**DO NOT add a `// Phase 2` header** — this is Phase 3. Follow the comment pattern `// Phase N: <description>` seen in `tests/util/ids.test.js` line 3 and `tests/setup.test.js` line 3.

**Runs under root Vitest** — no separate Vitest config needed; `vite.config.js` already points `test.include` at `tests/**`. The `firebase.json` path must use `process.cwd()` to be CI-safe (not `__dirname` which is undefined in ESM).

---

### `.github/workflows/ci.yml` — `deploy` + `preview` jobs (modified)

**Analog:** Existing `build` job (lines 115–132) + `test` job (lines 51–76) — use the same checkout+setup+npm-ci sequence

**CI job shape to copy** (excerpt from existing `ci.yml` lines 18–36 — the canonical step sequence):
```yaml
# EVERY job uses this exact step sequence (no reuse action, just copy the 4 steps):
- uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
- uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
  with:
    node-version: "22"
    cache: "npm"
- run: npm ci
```

**`deploy` job pattern** (RESEARCH.md §Pattern 3, lines 499–548):
```yaml
deploy:
  name: Deploy to Firebase Hosting
  needs: build
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  concurrency:
    group: firebase-deploy-main
    cancel-in-progress: false   # never cancel in-flight prod deploys
  permissions:
    contents: read
    id-token: write             # OIDC requires this
  steps:
    - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
    - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
      with:
        node-version: "22"
        cache: "npm"
    - run: npm ci
    - run: npm run build
    - run: cd functions && npm ci && npm run build
    - uses: google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093 # v3
      with:
        workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
        service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
    - run: npx firebase-tools@15.16.0 deploy --only hosting,functions --project bedeveloped-base-layers --non-interactive
    - name: Assert security headers
      run: |
        HEADERS=$(curl -s -I https://baselayers.bedeveloped.com)
        echo "$HEADERS" | grep -i "strict-transport-security" || (echo "MISSING: HSTS" && exit 1)
        echo "$HEADERS" | grep -i "x-content-type-options" || (echo "MISSING: X-CTO" && exit 1)
        echo "$HEADERS" | grep -i "cross-origin-opener-policy" || (echo "MISSING: COOP" && exit 1)
        echo "$HEADERS" | grep -i "content-security-policy-report-only" || (echo "MISSING: CSP-RO" && exit 1)
```

**`preview` job pattern** (RESEARCH.md §Pattern 3, lines 548–579):
```yaml
preview:
  name: Deploy PR Preview Channel
  if: github.event_name == 'pull_request'
  needs: build
  runs-on: ubuntu-latest
  permissions:
    contents: read
    id-token: write
    pull-requests: write        # FirebaseExtended action needs this to comment
  steps:
    # ... same checkout+setup+npm-ci+build+functions-build+auth steps ...
    - uses: FirebaseExtended/action-hosting-deploy@e2eda2e106cfa35cdbcf4ac9ddaf6c4756df2c8c # v0.10.0
      with:
        repoToken: ${{ secrets.GITHUB_TOKEN }}
        projectId: bedeveloped-base-layers
        channelId: pr-${{ github.event.pull_request.number }}
        expires: 7d
```

**SHA pins to use** (RESEARCH.md §Standard Stack, lines 124–125):
- `google-github-actions/auth`: `7c6bc770dae815cd3e89ee6cdf493a5fab2cc093` (v3)
- `FirebaseExtended/action-hosting-deploy`: `e2eda2e106cfa35cdbcf4ac9ddaf6c4756df2c8c` (v0.10.0)

**`top-level permissions` block** in `ci.yml` (line 10–11): Currently `permissions: contents: read`. The `deploy` and `preview` jobs each declare `id-token: write` locally — this is the correct pattern (job-level permissions override the global). No change to the global `permissions` block is needed.

**Pitfall A (branch protection):** Add `deploy` to required-status-checks via `runbooks/branch-protection-bootstrap.md` ONLY after the first green deploy run registers the check name. Same as Phase 1 D-12.

**`functions/` build in CI:** Both jobs need `cd functions && npm ci && npm run build` as a separate step BEFORE the deploy step. The root `npm ci` does NOT install functions dependencies. Missing this causes deploy to upload stale or absent `lib/` output.

---

### `SECURITY.md` — three new sections (modified)

**Analog:** `SECURITY.md` §Build & Supply Chain (lines 19–75) — the compliance-citation table shape

**Section shape to copy** (from §Build & Supply Chain lines 19–50):
```markdown
## § <Section Name>

**Control:** <One paragraph describing the control and its implementation.>

**Evidence:**

- <Artifact>: <file/location> (<phase/wave reference> — commit `<sha>`)
- ...

**Framework citations:**

- OWASP ASVS L2 vX V<number> — <clause description>
- ISO/IEC 27001:2022 A.<number> — <clause description>
- SOC 2 CC<number> — <clause description>
- GDPR Art. <number>(<clause>) — <description> [if applicable]
```

**Three sections to add** (D-15):

1. **§ HTTP Security Headers** — citations: `OWASP ASVS L2 v5.0 V14.4`, `ISO/IEC 27001:2022 A.13.1.3`, `SOC 2 CC6.6`
2. **§ Content Security Policy (Report-Only)** — citations: `OWASP ASVS L2 v5.0 V14.4`, `ISO/IEC 27001:2022 A.13.1`, `SOC 2 CC6.6`, `GDPR Art. 32`
3. **§ Hosting & Deployment** — citations: `OWASP ASVS L2 v5.0 V14.7`, `ISO/IEC 27001:2022 A.5.7`, `SOC 2 CC8.1`

**Atomic commit rule** (Phase 1 D-25 / Phase 2 D-21): each SECURITY.md section lands in the same commit as its corresponding code change — not at phase-end. E.g., the `firebase.json` + § HTTP Security Headers commit, the `cspReportSink.ts` + § CSP (Report-Only) commit.

**Replace the stub** `### § CSP & Headers — *TODO Phases 3 & 10*` (SECURITY.md line 235) — Phase 3 fills in the Phase 3 half; leave a note that Phase 10 fills the enforcement half.

---

### `runbooks/phase-4-cleanup-ledger.md` — one new row (modified)

**Analog:** Existing `## Out-of-band soft-fail entries` table (lines 53–58) — same 5-column format

**Row to append** (under the Out-of-band soft-fail entries table, or as a new Phase 3 section):
```markdown
| Phase 3 GH-Pages rollback substrate | gh-pages branch + Pages workflow kept dormant post-cutover | Cutover date + 14 days | Delete gh-pages branch + workflow per `runbooks/hosting-cutover.md` Day-14 Cleanup step |
```

**Table columns** (from existing rows, lines 53–58): `Source | Why soft-fail | Re-evaluation date | Hardening target`

---

## Shared Patterns

### Atomic commit convention
**Source:** `SECURITY.md` lines 193–194 (D-25 reference) + Phase 2 D-21 practice
**Apply to:** Every code file commit in this phase — `firebase.json`, `cspReportSink.ts`, `ci.yml` deploy job
**Rule:** SECURITY.md section lands in the same commit as the code it documents. Never a separate "docs:" commit at phase-end for a code change that already merged.
**Commit message shape** (from CLAUDE.md conventions):
```
feat(03-XX): <short description>

- <bullet of what changed>
- SECURITY.md § <section name>: populated (D-15)
```

### SHA-pinned Actions
**Source:** `.github/workflows/ci.yml` lines 18, 20, 65, 98, 109, 127 — every `uses:` line has `@<sha> # vX.Y.Z`
**Apply to:** Both new Actions in `deploy` + `preview` jobs
**Pattern:** `uses: google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093 # v3`
**DO NOT:** use `@v3` tag alone — tags are mutable; SHA pins are not.

### Pinned npm versions (no `^` / `~`)
**Source:** root `package.json` lines 29–49 — every dep at exact version
**Apply to:** `functions/package.json` dependencies + devDependencies
**Pattern:** `"firebase-admin": "13.8.0"` not `"^13.8.0"`

### `// @ts-check` header (JS test files only)
**Source:** `tests/util/ids.test.js` line 2, `tests/setup.test.js` line 1
**Apply to:** `tests/firebase-config.test.js` only — it is a `.js` file under root Vitest
**DO NOT apply to:** `functions/test/**/*.test.ts` — those are real TypeScript; `// @ts-check` is a JSDoc-only annotation

### Phase header comment
**Source:** `tests/util/ids.test.js` line 3: `// Phase 2 (TEST-01): coverage of src/util/ids.js`
**Apply to:** Every new test file (`tests/firebase-config.test.js`, `functions/test/csp/*.test.ts`)
**Pattern:** `// Phase 3 (HOST-XX): <description of what this test covers>`

---

## No Analog Found

All files have sufficient analogs (either from existing codebase or from the verified research skeletons in `03-RESEARCH.md`). No file requires pure invention.

---

## tsconfig.json Action Required (not a new file, but a required modification)

**File:** root `tsconfig.json` line 20 (`"functions/lib"` in exclude array)
**Change:** Replace `"functions/lib"` with `"functions/**"` in the `exclude` array.
**Why:** Phase 3 creates real TypeScript files at `functions/src/**/*.ts`. Root `tsconfig.json` currently only excludes `functions/lib` (compiled output); it does not exclude `functions/src`. Without this fix, root `tsc --noEmit` (the `typecheck` CI job) will attempt to check `functions/src/` TypeScript as JSDoc — producing type errors on valid TypeScript syntax.
**Source for this call-out:** `03-RESEARCH.md` §Functions Workspace Config Gotchas "Root tsconfig.json exclusion" section.

---

## Metadata

**Analog search scope:** `.github/workflows/`, `runbooks/`, `tests/`, root config files (`package.json`, `tsconfig.json`, `SECURITY.md`, `.github/dependabot.yml`)
**Files read:** 14 (ci.yml, SECURITY.md, package.json, tsconfig.json, dependabot.yml, firebase-oidc-bootstrap.md, branch-protection-bootstrap.md, phase-4-cleanup-ledger.md, tests/util/ids.test.js, tests/setup.test.js, tests/domain/banding.test.js, 03-CONTEXT.md, 03-RESEARCH.md sections, CLAUDE.md)
**Pattern extraction date:** 2026-05-06
