// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2020",
    sourcemap: true,
    rollupOptions: {
      input: { main: "index.html" },
      output: {
        manualChunks: {
          firebase: [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
            "firebase/storage",
            "firebase/app-check",
          ],
          chart: ["chart.js"],
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
