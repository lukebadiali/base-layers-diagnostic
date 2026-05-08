// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2020",
    sourcemap: true,
    rollupOptions: {
      input: { main: "index.html" },
      output: {
        // manualChunks: function form required by Vite 8 / Rolldown (object
        // form throws "manualChunks is not a function" at build time — Rule 3
        // fix while preserving load-bearing intent: split firebase + chart
        // into named chunks).
        manualChunks: (id) => {
          if (id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")) {
            return "firebase";
          }
          if (id.includes("node_modules/chart.js")) {
            return "chart";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5178,
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/setup.js"],
    globals: false,
    // Phase 5 Wave 1 (05-01): the rules suite runs under `vitest.rules.config.js`
    // with environment: "node" + emulator-bound. Excluding it from the default
    // unit suite so `npm test` doesn't try to run rules tests in happy-dom
    // without the Firestore + Storage emulators.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.git/**",
      "tests/rules/**",
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html"],
      exclude: [
        "tests/**",
        "data/pillars.js",         // legacy global; not source-of-truth
        "vite.config.js",
        "eslint.config.js",
        "**/_generators/**",
        "node_modules/**",
        "dist/**",
        "coverage/**",
        // Phase 4 Wave 6 (D-21): firebase/, cloud/, observability/ excluded by design.
        // firebase/* is the SDK adapter — exercised through data/* tests.
        // cloud/* + observability/* are documented stubs; Phase 7/8/9 fill bodies + thresholds.
        // app.js + firebase-init.js rows REMOVED (both deleted in Wave 5 cutover; D-03).
        "src/firebase/**",
        "src/cloud/**",
        "src/observability/**",
      ],
      thresholds: {
        // DO NOT add a global threshold key — firebase/, cloud/, observability/
        // are excluded by design until Phase 7/8/9 fills them. See D-15 (Phase 2)
        // and D-21 (Phase 4 Wave 6).
        "src/domain/**":  { lines: 100, branches: 100, functions: 100, statements: 100 },
        "src/util/**":    { lines: 100, branches: 100, functions: 100, statements: 100 },
        "src/auth/**":    { lines: 95,  branches: 95,  functions: 95,  statements: 95 },
        // Phase 4 Wave 6 (D-21): src/data/** raised from 90 → 95 (Phase 5 will add
        // subcollection bodies; the higher threshold gates regressions during the
        // pass-through → owned rewrite).
        "src/data/**":    { lines: 95,  branches: 95,  functions: 95,  statements: 95 },
        // Phase 4 Wave 6 (D-21): NEW — ui/* helpers are pure DOM; expectation 100%.
        "src/ui/**":      { lines: 100, branches: 100, functions: 100, statements: 100 },
        // Phase 4 Wave 6 (D-21): NEW — views/* are render-heavy + DI-mocked; 80%
        // is realistic for the Wave 4 stub state + Wave 5 main.js IIFE-resident
        // body migration (Wave 6 carryover).
        "src/views/**":   { lines: 80,  branches: 80,  functions: 80,  statements: 80 },
        // Phase 4 Wave 6 (D-21): NEW — boot scaffold + dispatcher + state singleton.
        "src/state.js":   { lines: 90,  branches: 90,  functions: 90,  statements: 90 },
        "src/router.js":  { lines: 90,  branches: 90,  functions: 90,  statements: 90 },
        "src/main.js":    { lines: 90,  branches: 90,  functions: 90,  statements: 90 },
      },
    },
  },
});
