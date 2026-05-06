// eslint.config.js
import js from "@eslint/js";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import security from "eslint-plugin-security";

export default [
  // Global ignores — these dirs are never linted
  {
    ignores: ["dist/", "coverage/", "node_modules/", "functions/lib/"],
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

      // Belt + suspenders — block Math.random() via no-restricted-syntax for explicit-error message
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            "Use crypto.randomUUID() instead. Phase 4: replace all call sites. See runbooks/phase-4-cleanup-ledger.md",
        },
      ],

      // Soft warn in Phase 1 — hardens to error in Phase 4 when modular boundary lands
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: [
                "firebase/firestore",
                "firebase/storage",
                "firebase/auth",
                "firebase/app-check",
              ],
              message:
                "Import Firebase services only through the firebase/ adapter module. This will harden to 'error' in Phase 4.",
            },
          ],
        },
      ],
    },
  },

  // Phase 2 (Plan 02-06, T-2-03 mitigation): block production code from
  // importing test fixtures. tests/fixtures/auth-passwords.js holds TEST
  // credentials; a stray import from src/** or app.js would leak them into
  // the production bundle. The rule is files-scoped so tests/ keep importing
  // from tests/ freely. Hard error — this is a security boundary.
  {
    files: ["src/**/*.js", "app.js"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
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
];
