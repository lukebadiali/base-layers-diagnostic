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
    // pool: "forks" gives each test file its own process, preventing vi.mock()
    // registrations from leaking across files (Phase 8 08-02: backup unit tests
    // mock @google-cloud/firestore which would otherwise contaminate the shared
    // module registry in the default thread pool).
    pool: "forks",
    // maxForks: cap parallel processes to avoid import-time contention across
    // 25+ test files that all spin up firebase-functions-test simultaneously.
    // testTimeout: raised from 5000ms to 15000ms for integration tests that
    // require multiple async module imports before assertions can run.
    poolOptions: { forks: { maxForks: 4 } },
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/index.ts"],
    },
  },
});
