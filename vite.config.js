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
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html"],
      exclude: [
        "tests/**",
        "app.js",
        "firebase-init.js",
        "data/pillars.js",
        "vite.config.js",
        "eslint.config.js",
        "**/_generators/**",
        "node_modules/**",
        "dist/**",
        "coverage/**",
      ],
      thresholds: {
        // DO NOT add a global threshold key — app.js is excluded by design until
        // the Phase 4 modular split. See decision D-15 in 02-CONTEXT.md.
        "src/domain/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
        "src/util/**":   { lines: 100, branches: 100, functions: 100, statements: 100 },
        "src/auth/**":   { lines: 95,  branches: 95,  functions: 95,  statements: 95 },
        "src/data/**":   { lines: 90,  branches: 90,  functions: 90,  statements: 90 },
      },
    },
  },
});
