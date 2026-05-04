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
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html"],
    },
  },
});
