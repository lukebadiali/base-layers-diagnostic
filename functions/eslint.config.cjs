"use strict";

// Phase 3 (HOST-05, FN-10): Flat ESLint config for the functions/ workspace.
// CommonJS (.cjs) form because functions/package.json has no "type" field
// (i.e., the workspace is CommonJS). ESLint 10 dropped legacy .eslintrc.*
// auto-discovery (Migration to v10 § default config) — this flat config is
// the canonical runtime config.
//
// Mirrors the (legacy-format) .eslintrc.cjs sibling 1:1:
//   - parser: @typescript-eslint/parser pointed at ./tsconfig.json
//   - extends: eslint:recommended + @typescript-eslint/recommended
//   - rules: no-console: error (D-10a / RESEARCH.md §Pattern 2 enforcement),
//            @typescript-eslint/no-explicit-any: warn
//   - ignores: lib/, node_modules/

const path = require("node:path");
const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
  {
    ignores: ["lib/", "node_modules/", "coverage/"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
      globals: {
        // Node 22 globals (workspace runtime is Cloud Run / Node 22)
        Buffer: "readonly",
        process: "readonly",
        console: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...(tsPlugin.configs.recommended.rules || {}),
      // D-10a / RESEARCH.md §Pattern 2: enforce logger.warn over console.warn.
      // logger.warn(message, structuredObj) yields severity=WARNING + queryable
      // jsonPayload in Cloud Logging; console.warn(JSON.stringify(...)) yields
      // textPayload (string) which is NOT queryable by field. This rule blocks
      // the regression at lint time.
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
