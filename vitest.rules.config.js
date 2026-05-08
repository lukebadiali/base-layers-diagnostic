// vitest.rules.config.js
// Phase 5 Wave 1: separate Vitest config for the rules-unit-testing suite.
// vite.config.js's test.environment is happy-dom (Phase 2 D-04); rules tests
// require Node environment for @firebase/rules-unit-testing v5 + firebase-admin
// transitive deps. singleFork: true because the emulator state is shared.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.js"],
    testTimeout: 30000,
    hookTimeout: 30000,
    singleFork: true,
  },
});
