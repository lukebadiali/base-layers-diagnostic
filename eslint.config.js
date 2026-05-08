// eslint.config.js
import js from "@eslint/js";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import security from "eslint-plugin-security";

export default [
  // Global ignores — these dirs are never linted
  {
    ignores: ["dist/", "coverage/", "node_modules/", "functions/"],
  },

  // Base recommended rules for all JS files
  {
    files: ["**/*.js"],
    ...js.configs.recommended,
  },

  // Browser globals for app.js / firebase-init.js / data/pillars.js / future
  // ES modules. Declared inline so we don't add the `globals` npm dep
  // (deviation from plan's pinned dep set — minimal fix per Pitfall F /
  // Rule 3). Phase 4: when modular split lands, narrow per-file overrides
  // (e.g., domain/* should NOT see DOM globals).
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Browser
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        history: "readonly",
        console: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        Image: "readonly",
        Event: "readonly",
        CustomEvent: "readonly",
        HTMLElement: "readonly",
        Node: "readonly",
        getComputedStyle: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        crypto: "readonly",
        atob: "readonly",
        btoa: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        queueMicrotask: "readonly",
        // CDN-injected (Chart.js global until Phase 4 npm import migration)
        Chart: "readonly",
        // Vite-injected
        __APP_VERSION__: "readonly",
      },
    },
  },

  // Security plugins — fire on all source files (including app.js with per-line disables)
  {
    files: ["**/*.js"],
    plugins: {
      "no-unsanitized": noUnsanitized,
      security,
    },
    rules: {
      // XSS prevention — innerHTML/outerHTML/insertAdjacentHTML/document.write all error
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",

      // CSPRNG enforcement — Math.random() is error everywhere
      // NOTE: actual rule name is detect-pseudoRandomBytes (camelCase) in
      // eslint-plugin-security@4.0.0 — plan's "detect-pseudo-random-bytes"
      // identifier doesn't exist in this plugin version (Rule 3 fix).
      // Intent (CSPRNG enforcement) preserved; no-restricted-syntax below is
      // the belt+suspenders gate that actually matches Math.random() calls.
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-eval-with-expression": "error",

      // Allow underscore-prefixed parameters/variables to opt out of no-unused-vars
      // (Phase 4 D-05: src/firebase/* placeholder helpers like signInEmailPassword(_email, _password)
      // declare bodies that Phase 6+ fills in; the underscore prefix is the explicit
      // "intentionally unused" convention).
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Belt + suspenders — block Math.random() via no-restricted-syntax for explicit-error message
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            "Use crypto.randomUUID() instead. Phase 4: replace all call sites. See runbooks/phase-4-cleanup-ledger.md",
        },
      ],

    },
  },

  // Tests run under Node (vitest); declare Node globals so schema tests like
  // tests/firebase-config.test.js (which calls process.cwd()) lint clean.
  // Phase 5 Wave 2 (05-02): also covers scripts/**/*.js — the migration
  // script (scripts/migrate-subcollections/run.js) is a Node entry point
  // using process.exitCode + console + Buffer-style APIs.
  {
    files: ["tests/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
  },

  // Phase 4 Wave 1 (D-04): firebase/* is the sole SDK import surface. Non-firebase/**
  // files must not import the SDK directly. Hardened from Phase 1's "warn" → "error"
  // with the firebase/ adapter landing this wave (D-05). The src/firebase/** files
  // import the SDK through bare specifiers — they are excluded via `ignores`.
  // Also carries the Phase 2 T-2-03 mitigation (block src/** + app.js from importing
  // tests/**) folded into the same rule key — ESLint flat config replaces (does not
  // merge) the same rule key when later configs match the same file, so both pattern
  // groups live in one rule. Subsequent waves close `domain/* → firebase/*` (Wave 2),
  // `data/* → only firebase/*` (Wave 3), and `views/* → no firebase/*` (Wave 4) per
  // ARCHITECTURE.md §2.4 by extending this block's pattern set.
  {
    files: ["src/**/*.js", "app.js"],
    ignores: ["src/firebase/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "firebase/firestore",
                "firebase/storage",
                "firebase/auth",
                "firebase/app-check",
                "firebase/functions",
              ],
              message:
                "Import Firebase services through the firebase/ adapter (src/firebase/*). Phase 4 Wave 1 (D-04).",
            },
            {
              group: ["**/tests/**", "../tests/*", "../../tests/*"],
              message:
                "Production code (src/** or app.js) must not import from tests/. T-2-03 mitigation: tests/fixtures/auth-passwords.js is a TEST credential and must not leak into production paths.",
            },
          ],
        },
      ],
    },
  },

  // Phase 4 Wave 1 (D-04): also block direct SDK imports in tests/** (excluding the
  // adapter shape contract test at tests/firebase/app.test.js which mocks them via
  // vi.mock and never actually imports `firebase/*` runtime). This catches accidental
  // test-file SDK imports that bypass the adapter under test.
  {
    files: ["tests/**/*.js"],
    ignores: ["tests/firebase/**", "tests/mocks/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "firebase/firestore",
                "firebase/storage",
                "firebase/auth",
                "firebase/app-check",
                "firebase/functions",
              ],
              message:
                "Import Firebase services through the firebase/ adapter (src/firebase/*). Phase 4 Wave 1 (D-04).",
            },
          ],
        },
      ],
    },
  },

  // Phase 4 Wave 2 (D-04): domain/* MUST NOT import firebase/* — codifies the
  // Phase 2 D-03 already-zero-imports state. domain/* is pure logic; any
  // Firestore / Storage / Auth touch belongs in data/* or auth/*. This rule
  // is dormant-but-active at Wave 2 close: zero src/domain/** files import
  // firebase/* today, so the rule fires nothing — but reintroduction during
  // Wave 4 view extraction or any future change fails CI.
  // ARCHITECTURE.md §2.4: domain/* imports nothing from Firebase (lint-enforced).
  {
    files: ["src/domain/**/*.js"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/firebase/*",
                "../firebase/*",
                "../../firebase/*",
                "firebase/*",
              ],
              message:
                "domain/* is pure logic — no Firebase imports allowed (ARCHITECTURE.md §2.4). Phase 4 Wave 2 (D-04).",
            },
          ],
        },
      ],
    },
  },

  // Phase 4 Wave 3 (D-04): data/* must access the SDK only through the
  // adapter — src/firebase/db.js + src/firebase/storage.js. Direct
  // firebase/firestore | storage | auth | app-check | functions imports are
  // blocked outside src/firebase/**. This is the audit-narrative anchor for
  // T-4-3-1 (Tampering at the data → firebase boundary): every Firestore
  // write goes through src/data/*, which imports only from src/firebase/db.js
  // (or src/firebase/storage.js for Storage), which imports the SDK. Lint
  // hard-fails CI on any new boundary breach. Rule is dormant-but-active at
  // Wave 3 close: src/data/* uses only src/firebase/db.js +
  // src/firebase/storage.js today (verified by grep).
  {
    files: ["src/data/**/*.js"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "firebase/firestore",
                "firebase/storage",
                "firebase/auth",
                "firebase/app-check",
                "firebase/functions",
              ],
              message:
                "data/* must access SDK only through src/firebase/db.js + src/firebase/storage.js (Wave 3 D-04).",
            },
          ],
        },
      ],
    },
  },

  // Phase 4 Wave 4 (D-04): views/* may import data/, domain/, auth/, ui/,
  // cloud/ — but NOT firebase/* directly (per ARCHITECTURE.md §2.4). Closes
  // the fourth and final boundary of the four-boundary D-04 plan. Views
  // construct DOM and orchestrate user flows; every Firestore/Storage/Auth/
  // Functions touch belongs in data/* / cloud/* / auth/* — which themselves
  // route through src/firebase/* (Waves 1+3). Lint hard-fails CI on any
  // boundary breach. Rule is dormant-but-active at Wave 4 close: src/views/*
  // are stub Pattern D DI factories that import only from src/ui/dom.js +
  // _shared/render-conversation.js today (no firebase/* imports anywhere).
  {
    files: ["src/views/**/*.js"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "**/firebase/*",
                "../firebase/*",
                "../../firebase/*",
                "firebase/*",
              ],
              message:
                "views/* may import data/, domain/, auth/, ui/, cloud/ — never firebase/* directly (Wave 4 D-04).",
            },
          ],
        },
      ],
    },
  },

  // Phase 4 Wave 6 (D-04 final hardening): block bare-global access to `FB`
  // (the Wave 5 transitional `window.FB` bridge sites in src/main.js use
  // `window.FB.X` which is member-access on `window` — this rule does NOT
  // fire for `window.FB` references). The rule is dormant-but-active at
  // Wave 6 close; it gates against any future src/* file accidentally
  // re-introducing the bare-global IIFE pattern after Wave 5 retired the
  // standalone bridge tags from index.html. Wave 5 threat model T-4-5-1
  // anchor.
  //
  // The corresponding `Chart` bare-global guard is DEFERRED to the
  // main.js-body-migration carryover sub-wave: src/main.js IIFE-resident
  // render functions at lines 1604 + 2749 consume `Chart` as a bare global
  // (via the window.Chart bridge in src/ui/charts.js); enforcing now would
  // break the boot path. The bridge retires when IIFE bodies migrate into
  // src/views/report.js + dashboard.js + funnel.js (Wave 5 carryover);
  // this rule extends with `Chart` at that point. Tracked in
  // runbooks/phase-4-cleanup-ledger.md "Wave 6 carryover" section.
  //
  // Excludes src/firebase/** + src/ui/charts.js (legitimate users of the
  // adapter ESM imports) + src/main.js (carries the IIFE residue per
  // Wave 5 deviation #2; transitional carry-forward until body migration).
  {
    files: ["src/**/*.js"],
    ignores: ["src/firebase/**", "src/ui/charts.js", "src/main.js"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "FB",
          message:
            "window.FB was a Wave 5 transitional bridge — retiring with the main.js IIFE body migration. Use src/firebase/* imports for new code (Phase 4 Wave 6 D-04 final hardening).",
        },
      ],
    },
  },
];
