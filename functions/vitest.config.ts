import { defineConfig } from "vitest/config";

// Phase 7 Wave 6 (TEST-09): integration test glob is auto-detected by the
// `test/**/*.test.ts` pattern (covers both *.unit.test.ts and
// *.integration.test.ts). Coverage scope widened from Phase 3 csp-only to the
// entire functions/src/ tree per the Phase 7 close gate; threshold-free
// (reporter mode only) so coverage failures don't block green CI while the
// integration suite is still landing — Phase 8 will ratchet thresholds via a
// dedicated coverage row in its cleanup-ledger.

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/_mocks/**", "node_modules/**"],
    environment: "node",
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/index.ts"],
    },
  },
});
