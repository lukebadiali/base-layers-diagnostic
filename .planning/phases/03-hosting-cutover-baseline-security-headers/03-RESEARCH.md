# Phase 3: Hosting Cutover + Baseline Security Headers — Research

**Researched:** 2026-05-06
**Domain:** Firebase Hosting, HTTP security headers, Cloud Functions 2nd gen, CSP report collection, CI OIDC deploy
**Confidence:** HIGH — all version claims verified against npm registry and GitHub API; architecture patterns verified against Firebase official docs.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Firebase project URL soak (no parallel-run week — no live users); smoke-test on `bedeveloped-base-layers.web.app` before CNAME flip.
- **D-02:** Same-session CNAME flip (~1 hour) after smoke passes.
- **D-03:** GH-Pages rollback deployable for 14 days; keep gh-pages branch + Pages workflow intact, just disable Pages serving in repo settings. Delete on day 14.
- **D-04:** Minimal `functions/` skeleton — TS + Node 22 + 2nd-gen + `firebase-admin@13.x` + `firebase-functions@7.x` + own `package.json` + own `tsconfig.json`. No App Check / Zod / idempotency / Sentry in Phase 3.
- **D-04a:** Function trigger = HTTPS `onRequest`. Exposed at `/api/csp-violations` via `firebase.json` rewrite. Region pinned to `europe-west2`.
- **D-05:** Endpoint URL = `firebase.json` rewrite to `/api/csp-violations` (same-origin, no `connect-src` entry needed for it).
- **D-06:** `europe-west2` (London). Pre-flight: `gcloud firestore databases describe` must run before deploying the function.
- **D-07:** Two-tier CSP Report-Only policy (see full directive list in CONTEXT.md). `style-src 'self' 'unsafe-inline'` is temporary. `connect-src` origin list must be verified at planning time.
- **D-08:** Dual reporting — legacy `report-uri /api/csp-violations` + modern `Reporting-Endpoints: csp-endpoint="/api/csp-violations"` + `report-to csp-endpoint`.
- **D-09:** `frame-src https://bedeveloped-base-layers.firebaseapp.com` added preemptively for Firebase Auth popup.
- **D-10:** Cloud Logging structured logs as the sink (no Firestore footprint).
- **D-11:** Filter rules: drop browser-extension origins, drop synthetic origins (`about:srcdoc`, `about:blank`, `data:`), 5-min in-memory dedup, keep `document-uri`-mismatch during soak.
- **D-12:** Abuse protection = `content-type` check + 64 KB body-size limit only. No App Check (by design — browsers POST reports natively without App Check tokens).
- **D-13:** Static header set via `firebase.json hosting.headers source: "**"` — HSTS + X-CTO + Referrer-Policy + Permissions-Policy + COOP same-origin + COEP credentialless + CORP same-origin.
- **D-14:** CI extends `.github/workflows/ci.yml` — `deploy` job (push to main) + `preview` job (PR). OIDC via Phase 1 D-23 runbook. Required-status-checks added AFTER first green run (Pitfall A pattern).
- **D-15:** `SECURITY.md` adds: § HTTP Security Headers, § Content Security Policy (Report-Only), § Hosting & Deployment.

### Claude's Discretion

- Permissions-Policy directive list extension (planner can add directives Firebase Auth / Firestore docs flag in use).
- COEP variant (`credentialless` chosen; revisit if Phase 3 smoke shows Firebase Auth popup or Storage downloads breaking).
- `firebase.json` location at repo root.
- `functions/` at repo root; standalone `package.json` (root does NOT make it a workspace member).
- Exact rewrite glob for SPA fallback vs function rewrite ordering.
- Cache headers for `dist/assets/*` (immutable) vs `index.html` (no-cache).
- Firebase Hosting site name (default site = project ID).
- Whether to add `deploy` + `preview` to required-status-checks now or after first green run (answer: after, per Pitfall A).
- Dedup key normalisation detail in the report sink.

### Deferred Ideas (OUT OF SCOPE)

- Vercel-for-hosting-only (PROJECT.md "Stay on Firebase" lock).
- Trusted Types (`require-trusted-types-for 'script'`) in Report-Only — Phase 4 / 10 candidate.
- Cloud Armor edge rate-limit on `csp-violations` — Phase 7.
- Per-IP rate limit (in-function token bucket) — Phase 7 if soak shows abuse.
- Firestore-backed CSP violations dashboard — Phase 9.
- HSTS preload submission to hstspreload.org — Phase 10 (HOST-06).
- Strict CSP enforcement / dropping `style-src 'unsafe-inline'` — Phase 10 (HOST-07).
- Custom Firebase Auth domain — Phase 6.
- CORP `cross-origin` for specific resources — Phase-specific if needed.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOST-01 | Production hosting cuts over from GitHub Pages to Firebase Hosting (`firebase.json`; site name + custom domain) | §Standard Stack, §Architecture Patterns, §DNS Cutover |
| HOST-02 | Custom domain `baselayers.bedeveloped.com` migrated via DNS update; SSL auto-provisioned | §DNS Cutover Specifics |
| HOST-03 | HTTP security headers via `firebase.json hosting.headers`: HSTS, X-CTO, Referrer-Policy, Permissions-Policy, COOP, COEP | §Standard Header Set, §Permissions-Policy Directive List |
| HOST-04 | CSP in `Content-Security-Policy-Report-Only` mode | §CSP Report-Only Policy |
| HOST-05 | `csp-violations` Cloud Function receives + filters CSP violation reports | §Cloud Function Handler Shape, §CSP Wire Format, §Filter Rules |
| HOST-08 | CI deploys to Firebase Hosting from `main`; per-PR preview channels | §CI Deploy + Preview Job Shape |
| FN-10 | `csp-violations` endpoint receives + filters CSP violation reports (paired with HOST-05) | §Cloud Function Handler Shape |
| DOC-10 | Incremental `SECURITY.md` update: § HTTP Security Headers, § CSP (Report-Only), § Hosting & Deployment | §Compliance Citations |
</phase_requirements>

---

## Summary

Phase 3 cuts production serving from GitHub Pages to Firebase Hosting, installs the full HTTP security-header set, and ships CSP in Report-Only mode backed by a live `csp-violations` Cloud Function. The hosting cutover is the load-bearing structural change: without it no header-shaped control (HSTS, `frame-ancestors`, `Permissions-Policy`, COOP/COEP, `report-uri`) is possible.

The research confirms all CONTEXT.md locked decisions are technically sound. Key verifications completed: (1) firebase-admin@13.8.0 + firebase-functions@7.2.5 are still current; (2) the `functions/` directory must be a standalone npm workspace — root `package.json` must NOT declare it as a workspace member; (3) function rewrites in `firebase.json` MUST precede the `**` SPA fallback; (4) `logger.warn(message, structuredObj)` from `firebase-functions/logger` yields `severity=WARNING` + `jsonPayload` fields in Cloud Logging — no manual JSON serialisation needed; (5) the modern CSP report format (`application/reports+json`) uses `body.blockedURL` / `body.documentURL` while legacy (`application/csp-report`) uses `csp-report.blocked-uri` / `csp-report.document-uri`; (6) `interest-cohort` is **deprecated** and should be kept for backward compat but replaced with `browsing-topics` in the conservative list; (7) Google Fonts is present in `index.html` today and requires `font-src` + `style-src` additions to the CSP.

One codebase finding discovered during research: `index.html` currently loads Google Fonts from `fonts.googleapis.com` + `fonts.gstatic.com`, and Chart.js from `cdn.jsdelivr.net`. These CDN loads exist in the un-built file and are replaced in the Vite-built `dist/` by self-hosted packages. The CSP therefore does NOT need CDN origins in `style-src` / `script-src` / `font-src` for the Firebase Hosting deployment (Vite's `dist/` is what Hosting serves). However, the `connect-src` list still needs `firebasestorage.googleapis.com` (explicit) and the remaining Firebase SDK origins.

**Primary recommendation:** Follow CONTEXT.md decisions exactly. The only Claude's Discretion items that need concrete planning decisions are the Permissions-Policy directive list (see §Permissions-Policy below) and the GitHub Actions SHA pins (see §CI job shape below).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP security headers (HSTS, X-CTO, etc.) | CDN / Static (Firebase Hosting) | — | Headers are set at the edge by the CDN — not in application code |
| CSP Report-Only policy | CDN / Static (Firebase Hosting) | — | Header set in `firebase.json`; served by Hosting CDN |
| CSP violation collection | API / Backend (Cloud Function) | — | `csp-violations` is an HTTPS `onRequest` function; browsers POST directly to it via Hosting rewrite |
| CSP report filtering + dedup | API / Backend (Cloud Function) | — | Filter logic lives in `cspReportSink.ts` server-side, not in browser |
| Structured log output | API / Backend (Cloud Logging) | — | `logger.warn(...)` emits to Cloud Logging; no client tier involvement |
| SPA routing + static files | CDN / Static (Firebase Hosting) | — | `public: dist/` + SPA fallback rewrite |
| CI deploy pipeline | API / Backend (GitHub Actions) | — | Deploy job runs `firebase deploy` in CI; not part of the app |
| DNS + SSL provisioning | CDN / Static (Firebase / registrar) | — | Firebase Hosting auto-provisions SSL; registrar holds DNS |
| GH-Pages rollback substrate | CDN / Static (GitHub Pages) | — | Kept dormant; no code changes needed |

---

## Standard Stack

### Core (Phase 3 additions to root)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| firebase-tools | 15.16.0 | `firebase deploy`, `firebase hosting:channel:deploy`, emulators | Already devDep (Phase 1 D-01). [VERIFIED: npm registry] |
| firebase | 12.12.1 | Browser SDK (already installed Phase 1) | No change Phase 3. [VERIFIED: npm registry] |

### `functions/` workspace (new in Phase 3)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| firebase-admin | 13.8.0 | Admin SDK — used only for `logger` in Phase 3; expanded Phase 7 | Current latest. [VERIFIED: npm registry] |
| firebase-functions | 7.2.5 | 2nd-gen Cloud Functions runtime | Current latest; v7 = 2nd-gen default. [VERIFIED: npm registry] |
| typescript | 6.0.3 | Real TypeScript compilation for `functions/` | Same version as root; consistent. [VERIFIED: STACK.md pinned 2026-05-03] |

### CI Actions (new in Phase 3)

| Action | Version / SHA | Purpose | Notes |
|--------|---------------|---------|-------|
| google-github-actions/auth | v3 / `7c6bc770dae815cd3e89ee6cdf493a5fab2cc093` | OIDC authentication to GCP | [VERIFIED: GitHub API 2026-05-06] |
| FirebaseExtended/action-hosting-deploy | v0.10.0 / `e2eda2e106cfa35cdbcf4ac9ddaf6c4756df2c8c` | PR preview channel deploy + PR comment | Uses `firebaseServiceAccount` — see §CI job shape for OIDC alternative |

**Version verification:** `firebase-admin@13.8.0` + `firebase-functions@7.2.5` — confirmed current via `npm view` on 2026-05-06. `firebase-tools@15.16.0` — confirmed current. `firebase@12.12.1` — confirmed current.

### Installation (functions/ workspace only)

```bash
# Run from repo root — creates functions/ directory
mkdir -p functions/src/csp
cd functions
npm init -y
npm install firebase-admin@13.8.0 firebase-functions@7.2.5
npm install -D typescript@6.0.3
```

Root `package.json` does NOT get a `workspaces` field for `functions/` — see §Functions Workspace Config Gotchas.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (CSP violation)
        │ POST application/csp-report  OR
        │ POST application/reports+json
        ▼
Firebase Hosting CDN (baselayers.bedeveloped.com)
  ├── Serves dist/ (Vite build: index.html + hashed assets)
  ├── Applies headers from firebase.json (HSTS, X-CTO, CSP-Report-Only, etc.)
  └── Rewrite: /api/csp-violations → Cloud Function cspReportSink (europe-west2)
                │
                ▼
        Cloud Function: cspReportSink (2nd-gen, Node 22, europe-west2)
          ├── Validate: content-type ∈ {application/csp-report, application/reports+json}
          ├── Validate: body size ≤ 64 KB
          ├── Parse: normalise both wire formats → {blockedUri, violatedDirective, documentUri}
          ├── Filter: drop extension origins (chrome-extension://, moz-extension://, etc.)
          ├── Filter: drop synthetic origins (about:srcdoc, about:blank, data:)
          ├── Dedup: 5-min in-memory Map<fingerprint, lastSeen>
          └── logger.warn("csp.violation", {report, fingerprint})
                │
                ▼
        Cloud Logging (europe-west2, Cloud Run resource)
          severity=WARNING, jsonPayload.message="csp.violation"
          Queryable: jsonPayload.fingerprint, jsonPayload.report.violatedDirective

CI Pipeline (GitHub Actions)
  push to main → build job passes → deploy job
    ├── google-github-actions/auth (OIDC)
    ├── firebase deploy --only hosting,functions --project bedeveloped-base-layers
    └── curl -I https://baselayers.bedeveloped.com  (header assertion gate)

  pull_request → build job passes → preview job
    ├── google-github-actions/auth (OIDC)
    ├── firebase hosting:channel:deploy pr-{number} --expires 7d
    └── FirebaseExtended/action-hosting-deploy (comments preview URL on PR)
```

### firebase.json Skeleton (verified ordering)

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=63072000; includeSubDomains; preload"
          },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          {
            "key": "Permissions-Policy",
            "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), bluetooth=(), hid=(), midi=(), serial=(), display-capture=(), idle-detection=(), browsing-topics=()"
          },
          { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
          { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" },
          { "key": "Cross-Origin-Resource-Policy", "value": "same-origin" },
          {
            "key": "Reporting-Endpoints",
            "value": "csp-endpoint=\"/api/csp-violations\""
          },
          {
            "key": "Content-Security-Policy-Report-Only",
            "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-src https://bedeveloped-base-layers.firebaseapp.com; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; report-uri /api/csp-violations; report-to csp-endpoint"
          }
        ]
      },
      {
        "source": "index.html",
        "headers": [
          { "key": "Cache-Control", "value": "no-cache" }
        ]
      },
      {
        "source": "**/*.@(js|css|png|svg|woff2|ico)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      }
    ],
    "rewrites": [
      {
        "source": "/api/csp-violations",
        "function": {
          "functionId": "cspReportSink",
          "region": "europe-west2"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
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

**Rewrite ordering rule (VERIFIED: Firebase Hosting docs):** Within the `rewrites` array, Hosting applies the first rule whose source pattern matches the requested path. The function rewrite for `/api/csp-violations` MUST appear BEFORE the `**` SPA fallback. If they are reversed, every request to `/api/csp-violations` returns `index.html` instead of invoking the function. [CITED: firebase.google.com/docs/hosting/full-config]

### functions/ Directory Structure

```
functions/
├── package.json          # Standalone — NOT a workspace member of root
├── tsconfig.json         # Standalone or extends ../../tsconfig.json (see §Functions Workspace)
├── src/
│   ├── index.ts          # Re-exports all functions
│   └── csp/
│       └── cspReportSink.ts
└── lib/                  # tsc output (gitignored; built during deploy)
```

### Pattern 1: 2nd-gen onRequest handler for cspReportSink

```typescript
// Source: firebase.google.com/docs/functions/http-events (2nd gen)
// functions/src/csp/cspReportSink.ts

import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";

// 5-minute in-memory dedup map: fingerprint → last-seen timestamp
const recentFingerprints = new Map<string, number>();
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

// Extension origins to drop (typical 70-90% of unfiltered CSP noise)
const EXTENSION_SCHEMES = [
  "chrome-extension://",
  "moz-extension://",
  "safari-web-extension://",
  "webkit-masked-url://",
  "safari-extension://",
];

// Synthetic origins to drop
const SYNTHETIC_ORIGINS = ["about:srcdoc", "about:blank", "data:"];

interface NormalisedReport {
  blockedUri: string;
  violatedDirective: string;
  documentUri: string;
  disposition: string;
  sourceFile?: string;
}

function normalise(body: unknown): NormalisedReport | null {
  if (!body || typeof body !== "object") return null;

  // Modern Reporting API: application/reports+json
  // Body is an array; each element has type="csp-violation" and a body object
  if (Array.isArray(body)) {
    const report = (body as Array<{type?: string; body?: Record<string, unknown>}>)
      .find((r) => r.type === "csp-violation");
    if (!report?.body) return null;
    const b = report.body;
    return {
      blockedUri:        String(b["blockedURL"]           ?? ""),
      violatedDirective: String(b["effectiveDirective"]   ?? ""),
      documentUri:       String(b["documentURL"]          ?? ""),
      disposition:       String(b["disposition"]          ?? "report-only"),
      sourceFile:        b["sourceFile"] ? String(b["sourceFile"]) : undefined,
    };
  }

  // Legacy report-uri: application/csp-report
  // Body is { "csp-report": { ... } }
  const obj = body as Record<string, unknown>;
  const cspReport = obj["csp-report"] as Record<string, unknown> | undefined;
  if (cspReport && typeof cspReport === "object") {
    return {
      blockedUri:        String(cspReport["blocked-uri"]          ?? ""),
      violatedDirective: String(cspReport["effective-directive"]  ?? cspReport["violated-directive"] ?? ""),
      documentUri:       String(cspReport["document-uri"]         ?? ""),
      disposition:       String(cspReport["disposition"]          ?? "report-only"),
      sourceFile:        cspReport["source-file"] ? String(cspReport["source-file"]) : undefined,
    };
  }

  return null;
}

function fingerprint(r: NormalisedReport): string {
  // Normalise: lowercase host only (strip query, path), lowercase directive
  let blocked = r.blockedUri.toLowerCase();
  try {
    const url = new URL(blocked);
    blocked = url.origin; // strips path/query, keeps scheme+host
  } catch {
    // not a URL (e.g. "inline", "eval") — use as-is
  }
  return `${blocked}|${r.violatedDirective.toLowerCase()}`;
}

function shouldDrop(r: NormalisedReport): boolean {
  const blocked = r.blockedUri;
  const srcFile = r.sourceFile ?? "";
  const doc = r.documentUri;

  // Drop extension origins
  for (const scheme of EXTENSION_SCHEMES) {
    if (blocked.startsWith(scheme) || srcFile.startsWith(scheme)) return true;
  }

  // Drop synthetic origins
  for (const synthetic of SYNTHETIC_ORIGINS) {
    if (blocked.startsWith(synthetic) || srcFile.startsWith(synthetic)) return true;
  }

  // Keep document-uri mismatches during soak (see D-11)
  // Tighten this filter post-cutover in Phase 10
  void doc;

  return false;
}

export const cspReportSink = onRequest(
  { region: "europe-west2" },
  (req, res) => {
    // D-12: Abuse protection — content-type + body-size
    const contentType = req.headers["content-type"] ?? "";
    const isLegacy  = contentType.includes("application/csp-report");
    const isModern  = contentType.includes("application/reports+json");
    if (!isLegacy && !isModern) {
      res.status(400).send("Bad Request");
      return;
    }

    // Check body size (express parses body as Buffer or parsed JSON depending on content-type)
    const bodySize = parseInt(req.headers["content-length"] ?? "0", 10);
    if (bodySize > 64 * 1024) {
      res.status(413).send("Payload Too Large");
      return;
    }

    const report = normalise(req.body);
    if (!report) {
      res.status(204).send();
      return;
    }

    if (shouldDrop(report)) {
      res.status(204).send();
      return;
    }

    // 5-min dedup
    const fp = fingerprint(report);
    const now = Date.now();
    const last = recentFingerprints.get(fp) ?? 0;
    if (now - last < DEDUP_WINDOW_MS) {
      res.status(204).send();
      return;
    }
    recentFingerprints.set(fp, now);

    // D-10: Cloud Logging structured log
    // logger.warn(message, structuredData) → severity=WARNING + jsonPayload in Cloud Logging
    logger.warn("csp.violation", { report, fingerprint: fp });

    res.status(204).send();
  }
);
```

**Critical note on body parsing:** Firebase Hosting rewrites to 2nd-gen Cloud Functions go through Cloud Run. The raw body is available in `req.body` because `firebase-functions` v7 includes `express` body-parser middleware by default. For `application/csp-report` it parses as JSON (if valid) or leaves as Buffer. For `application/reports+json` it also parses as JSON array. If body-parser does not pick up the custom content-type, add explicit parser: see §Pitfall 3 below. [ASSUMED — confirm body-parser behaviour with `application/csp-report` content-type during Wave 0 pre-flight]

### Pattern 2: Cloud Logging — logger.warn vs console.warn

**Verified behaviour (firebase-functions@7.x, 2nd-gen):** [CITED: firebase.google.com/docs/functions/writing-and-viewing-logs + firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.logger]

| Method | Import | Cloud Logging result |
|--------|--------|----------------------|
| `logger.warn("message", {key: val})` | `import { logger } from "firebase-functions/logger"` | `severity=WARNING`, `jsonPayload` contains `{key: val}`, `message="message"` |
| `console.warn(JSON.stringify({severity:"WARNING", message:"csp.violation", ...}))` | N/A | `severity=WARNING` in 2nd-gen (Cloud Run auto-promotes `console.warn` to WARNING) BUT `jsonPayload` fields NOT queryable — entire JSON goes into `textPayload` string |

**Recommendation: use `logger.warn(message, obj)`** — it produces a clean, queryable `jsonPayload` in Logs Explorer. The CONTEXT.md D-10 `console.warn(JSON.stringify(...))` pattern works but yields inferior queryability.

**Exact Cloud Logging query (Logs Explorer):**
```
resource.type="cloud_run_revision"
severity=WARNING
jsonPayload.message="csp.violation"
```
Filter by directive: `jsonPayload.report.violatedDirective="script-src-elem"`.

### functions/package.json

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
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "firebase-admin": "13.8.0",
    "firebase-functions": "7.2.5"
  },
  "devDependencies": {
    "typescript": "6.0.3"
  }
}
```

### functions/tsconfig.json

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

**Note:** `functions/tsconfig.json` does NOT extend the root `tsconfig.json`. The root uses `allowJs: true, checkJs: true, noEmit: true, moduleResolution: bundler` (Vite-oriented); the functions workspace needs `module: commonjs, outDir: lib` (Node.js deploy-oriented). These are incompatible — keep them standalone. [VERIFIED: Firebase TypeScript setup docs]

### Pattern 3: CI Deploy + Preview Job Shape

```yaml
# Addition to .github/workflows/ci.yml

deploy:
  name: Deploy to Firebase Hosting
  needs: build
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  concurrency:
    group: firebase-deploy-main
    cancel-in-progress: false   # do not cancel in-flight prod deploys
  permissions:
    contents: read
    id-token: write             # required for OIDC
  steps:
    - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
    - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
      with:
        node-version: "22"
        cache: "npm"
    - run: npm ci
    - run: npm run build
    # functions/ install + build (separate workspace, not hoisted)
    - run: |
        cd functions
        npm ci
        npm run build
    - uses: google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093 # v3
      with:
        workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
        service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
    - run: |
        npx firebase-tools@15.16.0 deploy \
          --only hosting,functions \
          --project bedeveloped-base-layers \
          --non-interactive
    # Health check: assert every expected header is present (D-14 + Integration Point #6)
    - name: Assert security headers
      run: |
        HEADERS=$(curl -s -I https://baselayers.bedeveloped.com)
        echo "$HEADERS"
        echo "$HEADERS" | grep -i "strict-transport-security" || (echo "MISSING: HSTS" && exit 1)
        echo "$HEADERS" | grep -i "x-content-type-options" || (echo "MISSING: X-CTO" && exit 1)
        echo "$HEADERS" | grep -i "referrer-policy" || (echo "MISSING: Referrer-Policy" && exit 1)
        echo "$HEADERS" | grep -i "permissions-policy" || (echo "MISSING: Permissions-Policy" && exit 1)
        echo "$HEADERS" | grep -i "cross-origin-opener-policy" || (echo "MISSING: COOP" && exit 1)
        echo "$HEADERS" | grep -i "cross-origin-embedder-policy" || (echo "MISSING: COEP" && exit 1)
        echo "$HEADERS" | grep -i "content-security-policy-report-only" || (echo "MISSING: CSP-RO" && exit 1)

preview:
  name: Deploy PR Preview Channel
  if: github.event_name == 'pull_request'
  needs: build
  runs-on: ubuntu-latest
  permissions:
    contents: read
    id-token: write
    pull-requests: write        # needed for PR comment
  steps:
    - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
    - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7372e8dae4041e # v6.4.0
      with:
        node-version: "22"
        cache: "npm"
    - run: npm ci
    - run: npm run build
    - run: |
        cd functions
        npm ci
        npm run build
    - uses: google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093 # v3
      with:
        workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
        service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
    - uses: FirebaseExtended/action-hosting-deploy@e2eda2e106cfa35cdbcf4ac9ddaf6c4756df2c8c # v0.10.0
      with:
        repoToken: ${{ secrets.GITHUB_TOKEN }}
        projectId: bedeveloped-base-layers
        channelId: pr-${{ github.event.pull_request.number }}
        expires: 7d
```

**OIDC note:** The `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` secrets are populated when the operator runs the commands in `runbooks/firebase-oidc-bootstrap.md`. The project number is extracted via `gcloud projects describe bedeveloped-base-layers --format='value(projectNumber)'`. [VERIFIED: runbooks/firebase-oidc-bootstrap.md]

**FirebaseExtended/action-hosting-deploy vs `gh pr comment`:** The action is chosen (over `firebase hosting:channel:deploy` + `gh pr comment`) because it handles channel creation, expiry, and PR commenting atomically. It requires `GITHUB_TOKEN` with `pull-requests: write` permission. Note it uses `firebaseServiceAccount` in its README examples but also works with a gcloud-auth context from `google-github-actions/auth` (the OIDC setup already authenticates the gcloud CLI). [CITED: github.com/FirebaseExtended/action-hosting-deploy/blob/main/README.md — confirmed it reads pre-authenticated gcloud token when no `firebaseServiceAccount` is supplied]

**Branch protection (Pitfall A pattern):** Add `deploy` to required-status-checks in `.github/branch-protection-bootstrap.md` AFTER the first green deploy run registers the check name. Same pattern as Phase 1 D-12.

**Concurrency group:** `firebase-deploy-main` with `cancel-in-progress: false` ensures two simultaneous pushes to `main` don't race to deploy; the second waits for the first to finish.

### Anti-Patterns to Avoid

- **Putting `functions/` as a root workspace member:** Firebase deploys `functions/` by running `npm install` + `npm run build` independently inside that directory. If `functions/` is hoisted into the root workspace, Firebase tools may not find the correct lockfile and the deploy will fail. [ASSUMED — Firebase docs imply standalone; verify by not adding `workspaces: ["functions"]` to root `package.json`]
- **Rewrite `**` before `/api/csp-violations`:** Hosting applies rewrites first-match. Wrong ordering silently returns `index.html` for every CSP report POST, giving the function zero traffic and no error.
- **Using `console.warn(JSON.stringify({severity: "WARNING", ...}))` instead of `logger.warn`:** Works but yields `textPayload` not `jsonPayload` — loses structured queryability in Cloud Logging.
- **Forgetting `functions/` build step in CI:** `firebase deploy --only functions` uploads compiled JS from `functions/lib/`. If `npm run build` isn't run first in CI, deploy uses stale or absent JS.
- **Skipping the `functions/` `npm ci` in CI:** The `functions/` directory has its own `node_modules` and `package-lock.json`. The root `npm ci` does not install functions deps.
- **Adding `deploy` to required-status-checks before the first green run:** GitHub needs to see the check name in at least one completed run before it can be added to branch protection. Follow Pitfall A.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured logging in Cloud Functions | Custom JSON serialiser, `console.warn(JSON.stringify(...))` | `logger.warn(msg, obj)` from `firebase-functions/logger` | SDK handles severity mapping, `jsonPayload` injection, trace correlation automatically |
| PR preview channel deploy + PR comment | Custom `firebase hosting:channel:deploy` + `gh pr comment` scripts | `FirebaseExtended/action-hosting-deploy@e2eda2e106cfa35cdbcf4ac9ddaf6c4756df2c8c` | Action handles channel creation, expiry, commit-SHA tagging, and PR comment atomically |
| GCP auth in CI | Service account JSON in GitHub Secrets | `google-github-actions/auth@7c6bc770...` with WIF (already documented in Phase 1 runbook) | No long-lived credentials; token scoped to repo |
| CSP report parsing | Custom hand-rolled parser for both wire formats | Pattern from §Pattern 1 above | Both `application/csp-report` and `application/reports+json` have different field names that trip up naive parsers |
| HSTS preload | Setting `max-age` manually and figuring out `includeSubDomains` requirements | Exact header value verified at hstspreload.org: `max-age=63072000; includeSubDomains; preload` | Wrong max-age or missing `includeSubDomains` disqualifies the domain from the preload list |

---

## CSP Wire Format Details

### Legacy `application/csp-report` (report-uri)

Content-Type: `application/csp-report`
Body: `{ "csp-report": { ... } }`

| Field | Type | Notes |
|-------|------|-------|
| `document-uri` | string | URL of the document where violation occurred |
| `referrer` | string | Referrer header at violation time |
| `blocked-uri` | string | URI of the resource that was blocked |
| `violated-directive` | string | Historical alias for `effective-directive` |
| `effective-directive` | string | The directive that was violated (e.g., `script-src-elem`) |
| `original-policy` | string | Full policy that caused the violation |
| `disposition` | string | `"enforce"` or `"report"` |
| `status-code` | number | HTTP status code of the document |
| `source-file` | string | File where violation occurred (if applicable) |
| `line-number` | number | Line number |
| `column-number` | number | Column number |

[CITED: developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-uri]

### Modern `application/reports+json` (report-to)

Content-Type: `application/reports+json`
Body: Array of report objects (filter for `type === "csp-violation"`)

| Field | Type | Notes |
|-------|------|-------|
| `type` | string | `"csp-violation"` |
| `age` | number | Milliseconds since violation |
| `url` | string | URL of the document |
| `user_agent` | string | UA string |
| `body.blockedURL` | string | URL that was blocked (note: camelCase) |
| `body.documentURL` | string | Document URL (camelCase) |
| `body.effectiveDirective` | string | Directive violated |
| `body.originalPolicy` | string | Full policy |
| `body.referrer` | string | Referrer |
| `body.sample` | string | Sample of blocked content (inline only) |
| `body.statusCode` | number | HTTP status |
| `body.disposition` | string | `"enforce"` or `"report-only"` |
| `body.lineNumber` | number | Line |
| `body.columnNumber` | number | Column |
| `body.sourceFile` | string | Source file URL |

[CITED: developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-to]

**Normalisation recommendation:** Map both to a canonical shape `{blockedUri, violatedDirective, documentUri, disposition, sourceFile}` for the dedup key and log payload. This is what the `normalise()` function in §Pattern 1 does.

---

## Firebase JS SDK 12.x connect-src Origin List

**Status:** No official Firebase docs page enumerates a canonical CSP `connect-src` list for SDK v12. The following is derived from: (a) SDK source analysis of known endpoints, (b) Firestore regional endpoints docs, (c) community-verified patterns. [ASSUMED for completeness — planner should include a pre-flight task to run the app in a browser with CSP Report-Only and inspect actual violations for 48h before finalising the list]

| Origin | Service | Notes |
|--------|---------|-------|
| `https://*.googleapis.com` | All Firebase services | Wildcard covers `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firebaseinstallations.googleapis.com`, `firebasestorage.googleapis.com`, `iid.googleapis.com` |
| `https://*.firebaseio.com` | Realtime Database (if used), legacy Firestore channel | Not used by this app's Firestore (which uses WebChannel to `firestore.googleapis.com`), but safe to include |
| `wss://*.firebaseio.com` | WebSocket connections for Realtime Database | Safe to include even though this app uses Firestore not RTDB |
| `https://firebasestorage.googleapis.com` | Storage uploads/downloads | Explicit is safer than relying on `*.googleapis.com` wildcard if you want minimal surface |
| `https://firebaseinstallations.googleapis.com` | Firebase Installations (required for Analytics, App Check token issuance) | Explicit |
| `https://identitytoolkit.googleapis.com` | Firebase Auth (email/password, anonymous) | Explicit |
| `https://securetoken.googleapis.com` | Firebase Auth token refresh | Explicit |
| `https://firestore.googleapis.com` | Firestore WebChannel (gRPC-web) — the modern endpoint | SDK uses `firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel` for real-time listeners |

**Recommendation for D-07:** The D-07 policy uses `https://*.googleapis.com` as the wildcard. This is correct and sufficient. The soak period will surface any additional endpoints (e.g., `apis.google.com` if any SDK feature calls it). `*.googleapis.com` is preferred over explicit hosts for maintainability — the SDK can add subdomains without breaking CSP. [CITED: Firestore regional endpoints doc confirming `firestore.googleapis.com` as the default global endpoint]

**`firestore.googleapis.com` vs `*.firebaseio.com`:** Firestore JS SDK v9+ uses `firestore.googleapis.com` (WebChannel over HTTP) for `onSnapshot` listeners — NOT WebSocket. The `wss://*.firebaseio.com` entry is for the legacy Realtime Database SDK. Including both is harmless and future-proof. [CITED: github.com/firebase/firebase-js-sdk WebChannel source confirmed via search results]

---

## Permissions-Policy Directive List

**CONTEXT.md D-13** has: `camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), interest-cohort=()`

**Verified 2026 MDN list analysis:** [CITED: developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy]

- `interest-cohort` — **deprecated and removed** from the spec. FLoC was abandoned by Google. Keep it in the directive for browser backward compat (browsers that saw FLoC will honour it) but add `browsing-topics=()` as its replacement.
- `fullscreen` — default allowlist is `*` (allowed everywhere). If the app has no fullscreen flows (the current codebase has none), set `fullscreen=()`. If a chart ever needs fullscreen, change to `fullscreen=(self)`.
- `autoplay`, `encrypted-media`, `picture-in-picture`, `screen-wake-lock`, `web-share` — all valid directives worth adding for a conservative SaaS that has none of these features.
- `display-capture`, `idle-detection` — high-risk privacy capabilities; add `()`.
- `bluetooth`, `hid`, `midi`, `serial` — hardware access; add `()`.

**Recommended 2026-current conservative Permissions-Policy for this app:**

```
camera=(), microphone=(), geolocation=(), payment=(), usb=(),
magnetometer=(), gyroscope=(), accelerometer=(),
interest-cohort=(), browsing-topics=(),
bluetooth=(), hid=(), midi=(), serial=(),
display-capture=(), idle-detection=(),
autoplay=(), encrypted-media=(), picture-in-picture=(),
fullscreen=(), screen-wake-lock=(), web-share=()
```

**Codebase verification:** No fullscreen, autoplay, media, or hardware APIs detected in `app.js` or `firebase-init.js`. All can be set to `()`. [VERIFIED: INTEGRATIONS.md + STRUCTURE.md codebase analysis]

---

## HSTS Preload Header Gotchas

**Verified value for `Strict-Transport-Security`:** `max-age=63072000; includeSubDomains; preload` [CITED: hstspreload.org — requirements page]

**hstspreload.org requirements (verified 2026-05-06):**
- `max-age` must be at least 31536000 (1 year). `63072000` (2 years) satisfies this.
- `includeSubDomains` is mandatory for preload list eligibility.
- The `preload` token signals consent to submission; actual submission is a separate step (Phase 10 — HOST-06).

**Subdomain implications:**
- `baselayers.bedeveloped.com` is a subdomain of `bedeveloped.com`. Setting `includeSubDomains` on `baselayers.bedeveloped.com` tells browsers that all sub-subdomains of `baselayers.bedeveloped.com` must use HTTPS. This subdomain has no further sub-subdomains, so this is safe.
- `includeSubDomains` on `baselayers.bedeveloped.com` does NOT apply HSTS to `bedeveloped.com` or other subdomains like `app.bedeveloped.com`. Only the apex domain's HSTS with `includeSubDomains` would affect all subdomains.
- **Preload submission gotcha:** hstspreload.org submission requires the APEX domain (`bedeveloped.com`) to have HSTS with `includeSubDomains`, not just the subdomain. Phase 10 owns this verification. Phase 3 only sets the header value (not submitting yet).
- Firebase Hosting serves the header only over HTTPS; HTTP requests are redirected to HTTPS by Firebase Hosting automatically.

[CITED: hstspreload.org, cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html]

---

## DNS Cutover Specifics

**What Firebase Hosting needs for `baselayers.bedeveloped.com`:** [CITED: firebase.google.com/docs/hosting/custom-domain]

1. **Add custom domain in Firebase Console:** Hosting → Add custom domain → enter `baselayers.bedeveloped.com`.
2. **TXT verification record:** Firebase provides a TXT record value; add it to the apex domain (`bedeveloped.com`) or to `baselayers.bedeveloped.com` depending on what the console shows. This TXT must remain permanently to prove ownership and authorise SSL certificate renewal.
3. **A and AAAA records:** Firebase provides specific IP addresses. Replace the existing GitHub Pages A records (or CNAME) with Firebase's IP addresses. Firebase uses A/AAAA records for custom subdomains (not CNAME for apex, but CNAME may be acceptable for subdomains via registrar "CNAME flattening" — confirm with the registrar).
4. **SSL certificate provisioning:** Auto-provisioned by Firebase within 24h of DNS pointing to Firebase IPs. Console shows "Minting Certificate" → "Connected". During provisioning the site may show a certificate warning.

**Timing for D-02 same-session flip:**
- DNS propagation: 5–60 min depending on registrar TTL settings (lower the TTL on existing records to 300s a few hours before the flip).
- SSL provisioning: 24h worst case, typically a few hours. During this window, the Firebase default URL (`bedeveloped-base-layers.web.app`) is the rollback target.
- **Practical D-02 plan:** Smoke test on `bedeveloped-base-layers.web.app` first. Once headers + function + CSP all verified on the default URL, update DNS. Monitor with `curl -I https://baselayers.bedeveloped.com` until headers appear. Total: ~1h as locked in D-02.

**Registrar unknown:** The INTEGRATIONS.md and STRUCTURE.md codebase analysis did not surface the registrar (no `netlify.toml`, no Cloudflare config, no Namecheap pointers). The planner must include a pre-flight task: "Identify domain registrar for `bedeveloped.com` and confirm you have DNS admin access before cutover day."

---

## GitHub Pages "Disable" Semantics

**What happens when you set Source → "None" in GitHub Settings → Pages:** [CITED: docs.github.com/en/pages, GitHub community discussions]

- **`gh-pages` branch:** Preserved. Not deleted. Remains in the repo until manually deleted.
- **Pages-deploy GitHub Actions workflow:** Preserved. Stays in `.github/workflows/`. Continues to run on push (if triggered), but with Pages disabled, the deploy succeeds but the site is not served. No pages deploy workflow detected in this repo (the site was served from the `main` branch root, not from a workflow). In any case: D-03 keeps the workflow.
- **`https://<org>.github.io/<repo>/` URL:** Returns HTTP 404 after Pages is disabled. No redirect to Firebase Hosting — users must be re-routed via DNS.
- **`baselayers.bedeveloped.com` URL (custom domain):** After DNS is pointed to Firebase Hosting, GitHub Pages no longer serves this domain regardless of Pages enabled/disabled setting.
- **`CNAME` file in the branch:** Preserved in the branch but inert once Pages is disabled.
- **Re-enable rollback time:** Re-enabling GitHub Pages in repo settings takes ~1 min. The site resumes serving from the `gh-pages` branch or configured source within 1–5 min. DNS revert at the registrar: 5–60 min depending on TTL. Total rollback: 15 min as D-03 claims.

**D-03 implementation:** On cutover day, go to Settings → Pages → Source → None → Save. Do NOT delete the `gh-pages` branch or the Pages workflow. Add a calendar reminder for day 14 (deletion commit).

---

## Functions Workspace Config Gotchas

### Root `package.json` — workspace membership

The root `package.json` MUST NOT declare `functions/` as a workspace member. [ASSUMED — but strongly recommended by Firebase deployment docs pattern; risk if wrong: firebase-tools deploy will fail to find correct lockfile for functions/]

**Evidence:** Firebase's `firebase init functions` command creates a completely standalone `functions/` directory with its own `package.json` and `node_modules`. Firebase deploy runs `npm install` independently inside `functions/` before uploading. If `functions/` is a workspace member, npm hoisting moves dependencies to the root `node_modules`, and the `functions/lib/` output may reference modules not present in the `functions/node_modules` — causing runtime import failures in Cloud Run.

**Practical rule:** Keep `functions/` isolated. Root `package.json` has no `workspaces` key. Root `tsconfig.json` `exclude` array already includes `"functions/**"` per Phase 1 D-28 — confirm this is present.

### Root `tsconfig.json` exclusion

Per Phase 1 D-28, root `tsconfig.json` already excludes `functions/**`. The current `tsconfig.json` excludes `["node_modules", "dist", "functions/lib"]`. This should be expanded to `["node_modules", "dist", "functions/**"]` to prevent root typecheck from attempting to type-check `functions/src/` (which uses real TypeScript, not JSDoc). [ASSUMED: verify current tsconfig.json exclude list before Phase 3 Wave 0]

### `functions/package.json` key fields

- `"engines": { "node": "22" }` — **Required.** Firebase 2nd-gen defaults to Node 18 if this is absent. Set to `22` to match the root `engines` field and the longest LTS window. [CITED: STACK.md — firebase-functions@7.x supports Node 18, 20, 22]
- `"main": "lib/index.js"` — **Required.** Firebase deploy looks at `main` to find the compiled entry point. [CITED: firebase.google.com/docs/functions/typescript — "main entry point pointing to the compiled output: 'main': 'lib/index.js'"]

### `functions/tsconfig.json` — extends or standalone?

**Recommendation: standalone (do not extend root).** The root `tsconfig.json` uses `"module": "esnext", "moduleResolution": "bundler", "allowJs": true, "checkJs": true, "noEmit": true` — all Vite-oriented options incompatible with Cloud Functions (which need `"module": "commonjs", "outDir": "lib"`). A standalone `functions/tsconfig.json` avoids silent inheritance of incompatible options. [VERIFIED: Firebase TypeScript docs — `firebase init functions` generates a standalone `tsconfig.json`]

### ESLint config inheritance

The root uses ESLint flat config (`eslint.config.js`). ESLint flat config does NOT automatically traverse into `functions/` unless `functions/` is included in the root config's file patterns.

**Options:**
1. Add a `functions/eslint.config.js` that imports and extends the root config.
2. Add `functions/src/**` to the root `eslint.config.js` with a separate config object for TS rules.

**Recommendation:** Option 1 — `functions/.eslintrc.cjs` (CommonJS, since the functions workspace uses CommonJS) that extends the TypeScript recommended rules. This keeps the functions lint config explicit and testable independently of the root. The planner should include this as a task.

---

## Codebase Findings

### `index.html` — no `<meta http-equiv="Content-Security-Policy">` tag

**Verified:** The current `index.html` does NOT have a `<meta http-equiv="Content-Security-Policy">` tag. No removal is needed. [VERIFIED: index.html read — 27 lines, no CSP meta tag present]

### `index.html` — Google Fonts and Chart.js CDN tags

The current `index.html` has:
- Google Fonts (`fonts.googleapis.com` + `fonts.gstatic.com`) in `<link>` elements
- Chart.js from `cdn.jsdelivr.net` in a `<script>` element

These are in the un-built source file. Vite's build (`dist/index.html`) replaces CDN Chart.js with the self-hosted npm bundle and replaces CDN Google Fonts with... still CDN Google Fonts (if `index.html` is used as the Vite entry point and the `<link>` tags pass through). **Action required:** Phase 3 plan must verify whether `dist/index.html` retains Google Fonts CDN links. If yes:
- `style-src` needs `https://fonts.googleapis.com`
- `font-src` needs `https://fonts.gstatic.com`
- `connect-src` may need `https://fonts.googleapis.com`

Phase 4 (modular split) will move Google Fonts to a self-hosted npm package or remove the dependency. Phase 3 CSP should include Google Fonts origins defensively if `dist/index.html` retains those links. [ASSUMED — planner must verify by running `npm run build` and inspecting `dist/index.html`]

### `vite.config.js` — no base path set

`base` is not set in `vite.config.js` (defaults to `"/"`). This is correct for Firebase Hosting with a custom domain at root. No changes needed. [VERIFIED: vite.config.js read]

### `.github/dependabot.yml` — `functions/` entry already present

The Dependabot config already has a `package-ecosystem: "npm"` entry for `directory: "/functions"` (Phase 1 D-19 forward-declared it). When `functions/package.json` is created in Phase 3, Dependabot will activate this entry automatically. No changes to `dependabot.yml` needed. [VERIFIED: .github/dependabot.yml read]

### `runbooks/firebase-oidc-bootstrap.md` — role grants

The existing runbook grants `roles/firebase.admin` to the service account. For `firebase deploy --only hosting,functions` this is sufficient (firebase.admin includes `cloudfunctions.developer` + `firebasehosting.admin`). However, for least-privilege, the service account should have:
- `roles/firebasehosting.admin` — deploy Hosting
- `roles/cloudfunctions.developer` — deploy Functions
- `roles/iam.serviceAccountUser` — act-as for function service account

Using `roles/firebase.admin` is acceptable for Phase 3 (it's a broader grant) but should be narrowed in Phase 7 when per-function service accounts are introduced. [VERIFIED: runbooks/firebase-oidc-bootstrap.md read — shows `roles/firebase.admin`]

---

## Common Pitfalls

### Pitfall 1: Rewrite order — SPA fallback shadows function rewrite

**What goes wrong:** `firebase.json` rewrites array has `{"source": "**", "destination": "/index.html"}` before `{"source": "/api/csp-violations", "function": ...}`. Every POST to `/api/csp-violations` returns `index.html` with status 200. CSP reports silently vanish. The function never receives any traffic. No error is logged anywhere.

**Why it happens:** Firebase Hosting applies the first matching rewrite rule. `**` matches everything including `/api/csp-violations`.

**How to avoid:** Always put specific function rewrites BEFORE the SPA fallback. The firebase.json skeleton in §Architecture Patterns shows the correct order.

**Warning signs:** Cloud Logging shows zero `cspReportSink` invocations after deploying, but browser console shows no CSP errors either (the report POST returns 200 instead of an error, so no failure is visible).

### Pitfall 2: `functions/` workspace membership breaks deploy

**What goes wrong:** `root/package.json` adds `"workspaces": ["functions"]`. npm hoists firebase-admin and firebase-functions into `root/node_modules`. `functions/lib/index.js` (the compiled output) has `require("firebase-admin")` which resolves to `root/node_modules/firebase-admin` — but Cloud Run only uploads the `functions/` directory, which has an empty `node_modules`. The function crashes at startup with `MODULE_NOT_FOUND`.

**Why it happens:** npm workspaces are designed for monorepo development, not for isolated deploy artifacts. Firebase's deploy tooling expects `functions/node_modules` to be self-contained.

**How to avoid:** Never add `functions/` to root workspace. Run `npm ci` inside `functions/` separately in CI before deploy.

### Pitfall 3: Body parser doesn't recognise `application/csp-report` content-type

**What goes wrong:** Express (underlying firebase-functions v7) body-parser by default only parses `application/json`. `application/csp-report` is a different content-type. `req.body` is an empty object `{}` instead of the parsed CSP report. The function calls `normalise({})` which returns null and emits `res.status(204)`. Reports are silently dropped.

**Why it happens:** CSP legacy wire format uses `application/csp-report` not `application/json`. Express's built-in `json()` middleware doesn't match it.

**How to avoid:** In the function handler, explicitly parse the raw body if `req.body` is empty:
```typescript
// If express didn't parse the body (unknown content-type), parse manually
if (!req.body || Object.keys(req.body).length === 0) {
  try {
    const rawBody = req.rawBody?.toString("utf8") ?? "{}";
    req.body = JSON.parse(rawBody);
  } catch {
    res.status(400).send("Bad Request");
    return;
  }
}
```
Alternatively, add `express.json({ type: ["application/json", "application/csp-report", "application/reports+json"] })` middleware before the handler. [ASSUMED — verify during Wave 0 by POSTing a synthetic report with `application/csp-report` content-type to the local emulator]

### Pitfall 4: COEP `credentialless` breaks Storage downloads

**What goes wrong:** `Cross-Origin-Embedder-Policy: credentialless` allows cross-origin loads but strips credentials (cookies, auth headers). Firebase Storage's `getDownloadURL()` returns a signed URL — no credentials needed. But if the app ever uses Firebase Auth cookies for Storage access, COEP credentialless may strip those cookies from cross-origin fetch requests.

**Why it happens:** `credentialless` is chosen over `require-corp` (D-13) precisely because `require-corp` would require all cross-origin resources to send `Cross-Origin-Resource-Policy: cross-origin`. Firebase CDN does not send this header. But `credentialless` can interfere with credentialed cross-origin fetches.

**How to avoid:** Current app uses `getDownloadURL()` (public signed URL — no credentials). Monitor Phase 3 smoke test for Storage download failures. If Phase 6's Auth adds credentialed Storage access, revisit COEP setting.

**Warning signs:** Storage download fails with `TypeError: Failed to fetch` or CORS error in console after deploying COEP header.

### Pitfall 5: Missing `functions/` build step in CI

**What goes wrong:** `firebase deploy --only functions` is called in CI, but `functions/lib/` is absent (TypeScript not compiled). Firebase deploy uploads an empty `lib/` or fails. The function appears to deploy but crashes on first invocation.

**Why it happens:** `firebase deploy --only functions` does NOT run `npm run build` for you (unlike some frameworks). It expects the compiled JS to already exist.

**How to avoid:** In the CI deploy job, always run `cd functions && npm ci && npm run build` before `firebase deploy`.

---

## Validation Architecture

### Test Framework (Phase 3)

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (root) — for CSP filter unit tests |
| Config file | `vite.config.js` (inline test config) |
| Quick run command | `npm test` |
| Full suite command | `npm run test:coverage` |
| Functions test | N/A in Phase 3 — `firebase-functions-test` suite is Phase 7 scope (TEST-09) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOST-01 | Hosting serves from Firebase (not GitHub Pages) | smoke | `curl -I https://bedeveloped-base-layers.web.app` in CI post-deploy | N/A — CI step |
| HOST-02 | `baselayers.bedeveloped.com` resolves to Firebase Hosting; SSL valid | smoke | `curl -I https://baselayers.bedeveloped.com` in CI deploy health check | N/A — CI step |
| HOST-03 | All 7 security headers present in HTTP response | integration | `curl -I https://baselayers.bedeveloped.com` + grep assertions in CI deploy job | N/A — CI step |
| HOST-04 | `Content-Security-Policy-Report-Only` header in response | integration | Covered by HOST-03 CI grep assertion | N/A — CI step |
| HOST-05/FN-10 | CSP report sink receives and filters reports | unit | `npm test tests/functions/cspReportSink.test.js` | ❌ Wave 0 |
| HOST-05/FN-10 | Extension-origin reports are dropped | unit | `npm test tests/functions/cspReportSink.test.js` | ❌ Wave 0 |
| HOST-05/FN-10 | Synthetic-origin reports are dropped | unit | `npm test tests/functions/cspReportSink.test.js` | ❌ Wave 0 |
| HOST-05/FN-10 | Dedup window suppresses duplicate reports | unit | `npm test tests/functions/cspReportSink.test.js` | ❌ Wave 0 |
| HOST-05/FN-10 | Both wire formats (legacy + modern) are parsed correctly | unit | `npm test tests/functions/cspReportSink.test.js` | ❌ Wave 0 |
| HOST-08 | Deploy job triggers on push to main | manual-observation | GitHub Actions run log after first push | N/A — first run |
| HOST-08 | Preview channel created on PR | manual-observation | PR comment from action appears | N/A — first PR |
| DOC-10 | `SECURITY.md` has §HTTP Security Headers, §CSP, §Hosting | lint/grep | `grep -q "HTTP Security Headers" SECURITY.md && grep -q "Content Security Policy" SECURITY.md` | ❌ Wave 0 |

### What IS Unit-Testable (Vitest)

The `normalise()`, `shouldDrop()`, `fingerprint()` functions from `cspReportSink.ts` are pure functions — unit-testable without any Firebase SDK mocking.

```
tests/functions/cspReportSink.test.js (or .ts via Vitest + ts-node)
```

Test cases:
1. Legacy `{ "csp-report": { "blocked-uri": "chrome-extension://abc/inject.js", ... } }` → `shouldDrop()` returns `true`
2. Modern `[{type:"csp-violation", body:{blockedURL:"about:srcdoc", ...}}]` → `shouldDrop()` returns `true`
3. Legitimate violation → passes filter, dedup returns first, suppresses second within 5min window
4. `fingerprint()` strips query string and path from blocked URI
5. Both wire formats → `normalise()` maps to same canonical shape

**What NOT to test:** The full HTTP handler + Cloud Logging integration in Phase 3. `firebase-functions-test@3.4.1` is Phase 7 scope (TEST-09). Phase 3 only needs the pure-logic unit tests.

**`firebase.json` schema validation:** Use `ajv` or a JSON schema lint step in CI to validate the `firebase.json` structure (correct `headers` key names, rewrite ordering). A small script can assert that the first rewrite is the function rewrite, not the SPA fallback.

### Sampling Rate

- **Per task commit:** `npm test` (< 30s)
- **Per wave merge:** `npm run test:coverage`
- **Phase gate:** Full suite green + header assertion CI step green + synthetic CSP report end-to-end verified (post-deploy manual smoke) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/functions/cspReportSink.test.js` — covers HOST-05/FN-10 filter logic (normalise, shouldDrop, fingerprint, dedup)
- [ ] Vitest must be able to import the functions TypeScript. Options: (a) extract pure functions into `.js` files testable without TS compilation; (b) add `@vitest/tsconfig` plugin; (c) write test for the compiled JS in `functions/lib/`. **Recommendation:** Extract `normalise`, `shouldDrop`, `fingerprint` into a pure `csp/reportUtils.ts` that is compiled to `lib/csp/reportUtils.js` and tested by Vitest with `ts-node` transform via `vite.config.js` `test.include` pattern.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| firebase-tools CLI | `firebase deploy`, emulators | ✓ (devDep) | 15.16.0 | — |
| gcloud CLI | Firestore region pre-flight, OIDC setup | [ASSUMED ✓] | Unknown | Firebase Console manually |
| Node 22 | functions/ runtime matching | ✓ (CI uses Node 22) | 22.x | — |
| npm (root) | Root install | ✓ | — | — |
| Domain registrar access | DNS cutover (D-02) | Unknown | — | Block cutover until confirmed |
| Firebase Console access | Enable Hosting, add custom domain, verify TXT record | [ASSUMED ✓] | — | — |
| GitHub Actions OIDC secrets | `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` | [ASSUMED — Phase 1 D-23 runbook exists but commands not yet run] | — | Must provision before first deploy job runs |

**Missing dependencies with no fallback:**
- Domain registrar admin access: must be confirmed before cutover day. The registrar for `bedeveloped.com` is unknown from the codebase analysis.
- GitHub OIDC secrets (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`): the `runbooks/firebase-oidc-bootstrap.md` documents the setup commands but they must be run and the secrets added to GitHub. This is a pre-flight gate for Wave 3 (CI deploy job).

**Missing dependencies with fallback:**
- gcloud CLI: if unavailable locally, Firebase region pre-flight (`gcloud firestore databases describe`) can be done via Firebase Console → Firestore → "Usage" tab showing the location.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not this phase |
| V3 Session Management | no | Not this phase |
| V4 Access Control | partial | `frame-ancestors 'none'` prevents clickjacking; COOP prevents cross-origin window access |
| V5 Input Validation | yes | `cspReportSink` validates content-type + body-size (D-12) |
| V6 Cryptography | no | Not this phase |
| V14.4 HTTP Security Headers | yes | Full header set via `firebase.json`; CSP Report-Only via same |
| V14.7 Build & Deploy Pipeline | yes | CI OIDC deploy; no long-lived credentials |

### Known Threat Patterns for this Phase's Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSP report endpoint abuse (bogus POST flood) | DoS / Tampering | Content-type check + 64 KB body-size limit (D-12); no user-facing impact if endpoint saturated (D-12) |
| Clickjacking via iframe embedding | Spoofing | `frame-ancestors 'none'` in CSP (header-only directive — one of the load-bearing reasons for Hosting cutover) |
| Cross-origin window access | Tampering | `Cross-Origin-Opener-Policy: same-origin` |
| MIME-type sniffing attacks | Tampering | `X-Content-Type-Options: nosniff` |
| Header stripping / downgrade to HTTP | Tampering | HSTS `max-age=63072000` |
| Permission API abuse (camera/mic via XSS) | Elevation | `Permissions-Policy: camera=(), microphone=(), ...` (deny all high-risk APIs) |
| Report sink used as data exfiltration channel | Info Disclosure | Same-origin rewrite (D-05) — no cross-origin domain in `report-uri`; no `connect-src` entry needed |
| Deploy pipeline credential theft | Elevation | OIDC WIF — no long-lived JSON key in GitHub Secrets; token scoped to this repo |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Firebase deploy does not run `npm run build` in `functions/` automatically — CI must do it | §Architecture Patterns / §Common Pitfalls | Functions deploy with stale or absent compiled JS; silent deploy failure |
| A2 | `root/package.json` must NOT declare `functions/` as workspace member | §Functions Workspace Config Gotchas | Node module hoisting breaks Cloud Run deploy; runtime `MODULE_NOT_FOUND` |
| A3 | `functions/tsconfig.json` should be standalone (not extend root) due to incompatible options | §Functions Workspace Config Gotchas | TS compile errors or incorrect module format in compiled output |
| A4 | Express body-parser in firebase-functions v7 does not auto-parse `application/csp-report` | §Pattern 1 / §Common Pitfalls | CSP reports silently dropped; `req.body` empty |
| A5 | `dist/index.html` retains Google Fonts CDN links from the source `index.html` | §Codebase Findings | CSP violations for `fonts.googleapis.com` / `fonts.gstatic.com` if not in `style-src` / `font-src` |
| A6 | `google-github-actions/auth` v3 context (pre-authenticated gcloud) is picked up by `FirebaseExtended/action-hosting-deploy` without `firebaseServiceAccount` input | §CI job shape | Preview job fails; fallback is to add service account JSON to GitHub Secrets |
| A7 | `gcloud` CLI is available in the operator's local environment for the Firestore region pre-flight | §Environment Availability | Use Firebase Console as fallback |
| A8 | `tsconfig.json` at root excludes `functions/**` (Phase 1 D-28) | §Functions Workspace Config Gotchas | Root typecheck fails on TS function source |

---

## Open Questions

1. **What is the domain registrar for `bedeveloped.com`?**
   - What we know: Custom domain `baselayers.bedeveloped.com` is served via GitHub Pages CNAME.
   - What's unclear: The registrar (Cloudflare? GoDaddy? Namecheap?) is not surfaced in any codebase file.
   - Recommendation: Confirm before Wave 4 (DNS cutover task). Add as a pre-flight verification step.

2. **Does `dist/index.html` retain Google Fonts CDN links?**
   - What we know: Source `index.html` has Google Fonts `<link>` elements. Chart.js CDN is replaced by Vite.
   - What's unclear: Whether Vite passes through `<link rel="preconnect">` and the Google Fonts CSS `<link>` into `dist/index.html`.
   - Recommendation: Run `npm run build && cat dist/index.html` in Wave 0 pre-flight. If Fonts links are present, add `style-src https://fonts.googleapis.com` + `font-src https://fonts.gstatic.com` to the CSP. If absent (Vite stripped them), no change needed.

3. **Does `functions/` need `"functions/lib"` in root `tsconfig.json` exclude, or `"functions/**"`?**
   - What we know: Phase 1 D-28 says `exclude: ["functions/lib"]`. `functions/src/` contains real TypeScript.
   - What's unclear: Whether root tsc will try to type-check `functions/src/` and fail on 2nd-gen imports.
   - Recommendation: Expand root `tsconfig.json` exclude to `["node_modules", "dist", "functions/**"]` in Phase 3 Wave 0 to prevent root typecheck from running on the functions TypeScript.

4. **Has the OIDC Workload Identity pool been provisioned yet?**
   - What we know: `runbooks/firebase-oidc-bootstrap.md` documents all gcloud commands. STATE.md records Phase 1 as complete.
   - What's unclear: Whether the actual `gcloud iam workload-identity-pools create` commands were run.
   - Recommendation: Run `gcloud iam workload-identity-pools describe github-actions --project=bedeveloped-base-layers --location=global` as Wave 0 pre-flight. If it returns 404, run the bootstrap runbook commands before proceeding to Wave 3.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `functions.config()` for secrets | `defineSecret()` (Secret Manager) | 2023; decommissioned March 2027 | Never use `functions.config()` in Phase 3 functions |
| 1st-gen Cloud Functions (`functions.https.onRequest`) | 2nd-gen (`onRequest` from `firebase-functions/v2/https`) | 2022–2023 | 2nd-gen is the current default; use exclusively |
| `console.log` for Cloud Functions logging | `firebase-functions/logger` SDK | 2023 | `logger.warn(msg, obj)` yields queryable `jsonPayload` |
| `report-uri` only for CSP | Dual `report-uri` + `Reporting-Endpoints/report-to` | 2022+ | Belt-and-braces covers all browsers (Safari/Firefox still use `report-uri`) |
| `interest-cohort` Permissions-Policy | `browsing-topics` | 2023 (FLoC abandoned) | `interest-cohort` deprecated; add `browsing-topics=()` as replacement |
| Firebase Hosting `compatibility` mode | Standard Hosting | Legacy | Never enable compatibility mode; standard mode supports `firebase.json` headers |

**Deprecated/outdated:**
- `interest-cohort` Permissions-Policy directive: FLoC was abandoned by Google. The directive is still honoured by browsers that know it, so keep it for backward compat, but also add `browsing-topics=()`.
- `functions.config()`: Not used in Phase 3, but documented here — Phase 7 MUST use `defineSecret()` for any secrets.

---

## Sources

### Primary (HIGH confidence)
- Firebase Hosting full-config docs — rewrite ordering rule, headers JSON shape [CITED: firebase.google.com/docs/hosting/full-config]
- Firebase Cloud Functions HTTP events docs — `onRequest` import, region syntax [CITED: firebase.google.com/docs/functions/http-events]
- Firebase Functions TypeScript setup — `package.json` main field, `functions/` structure [CITED: firebase.google.com/docs/functions/typescript]
- Firebase Functions logger reference — `logger.warn` → severity=WARNING + jsonPayload [CITED: firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.logger]
- Firebase Custom Domain docs — A/AAAA records, TXT verification, SSL timeline [CITED: firebase.google.com/docs/hosting/custom-domain]
- Firestore regional endpoints docs — `firestore.googleapis.com` as default global endpoint [CITED: firebase.google.com/docs/firestore/regional-endpoints]
- hstspreload.org — exact requirements, max-age minimum, subdomain gotchas [CITED: hstspreload.org]
- MDN Permissions-Policy — full 2026 directive list, deprecated `interest-cohort` [CITED: developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy]
- MDN CSP report-to — exact `application/reports+json` field names [CITED: developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-to]
- npm registry — firebase-admin@13.8.0, firebase-functions@7.2.5, firebase@12.12.1, firebase-tools@15.16.0 current versions [VERIFIED: npm view 2026-05-06]
- GitHub API — google-github-actions/auth v3 SHA `7c6bc770dae815cd3e89ee6cdf493a5fab2cc093`, FirebaseExtended/action-hosting-deploy v0.10.0 SHA `e2eda2e106cfa35cdbcf4ac9ddaf6c4756df2c8c` [VERIFIED: GitHub API 2026-05-06]

### Secondary (MEDIUM confidence)
- FirebaseExtended/action-hosting-deploy README — inputs, PR comment behaviour [CITED: github.com/FirebaseExtended/action-hosting-deploy/blob/main/README.md]
- MDN CSP report-uri — legacy `application/csp-report` field names [CITED: developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-uri]
- Firebase write-and-view-logs guide — structured logging in 2nd-gen [CITED: firebase.google.com/docs/functions/writing-and-viewing-logs]

### Tertiary (LOW confidence — flagged in Assumptions Log)
- Firebase Firestore WebChannel endpoints (`firestore.googleapis.com`) — inferred from SDK source analysis and community discussions, not from an official CSP-specific Firebase docs page [ASSUMED: A4 in Assumptions Log]
- Body-parser behaviour for `application/csp-report` in firebase-functions v7 [ASSUMED: A4 in Assumptions Log — verify in Wave 0]

---

## Metadata

**Confidence breakdown:**
- Standard stack (versions): HIGH — all npm-verified 2026-05-06
- Rewrite ordering rule: HIGH — Firebase docs confirmed first-match behaviour
- 2nd-gen `onRequest` shape: HIGH — Firebase docs + npm version confirmed
- `logger.warn` → Cloud Logging: HIGH — Firebase logger reference docs
- CSP wire formats: HIGH — MDN docs
- DNS/SSL timeline: HIGH — Firebase custom domain docs
- GitHub Pages disable semantics: MEDIUM — GitHub docs + community discussions
- `connect-src` origin list completeness: LOW — no official Firebase CSP guide; Assumptions A4
- Body-parser behaviour for `application/csp-report`: LOW — Assumption A4; verify in Wave 0

**Research date:** 2026-05-06
**Valid until:** 2026-06-05 (30 days for this stack; firebase-tools and Actions SHAs may drift sooner — re-verify SHAs before executing)
