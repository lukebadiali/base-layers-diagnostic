"use strict";

// Phase 3 (HOST-05, FN-10): ESLint config for the functions/ workspace.
//
// NOTE: ESLint 10.x removes the ESLINT_USE_FLAT_CONFIG=false escape hatch and
// no longer auto-discovers .eslintrc.* files. The CANONICAL config used at
// runtime is functions/eslint.config.cjs (flat config in CommonJS form).
// This file is retained ONLY as documentation of the rule set and as a
// migration breadcrumb so 03-03-PLAN.md acceptance ("functions/.eslintrc.cjs
// exists") is satisfied verbatim. eslint will NOT read this file.
//
// If a future ESLint downgrade re-enables eslintrc, this file becomes active
// again. Do not delete without coordinating with eslint.config.cjs.

module.exports = {
  env: {
    es2022: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    sourceType: "module",
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  ignorePatterns: ["lib/", "node_modules/"],
  rules: {
    "no-console": "error",
    "@typescript-eslint/no-explicit-any": "warn",
  },
};
