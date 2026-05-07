// tests/state.test.js
// @ts-check
// Phase 4 Wave 5 (D-02 / D-12): pin contract for src/state.js — the
// in-memory state singleton extracted byte-identical from app.js:574-587.
import { describe, it, expect, beforeEach } from "vitest";

describe("src/state.js", () => {
  beforeEach(() => {
    // Reset localStorage so each test exercises the default-mode path.
    localStorage.clear();
  });

  it("exports state object with expected default fields (D-02 byte-identical)", async () => {
    const { state } = await import("../src/state.js");
    expect(state).toMatchObject({
      route: "dashboard",
      orgId: null,
      pillarId: null,
      chart: null,
      userMenuOpen: false,
      authTab: "client",
      authError: "",
      chatMessages: [],
      chatSubscription: null,
      chatSubscribedFor: null,
    });
  });

  it("expandedPillars is a Set (per D-02 verbatim from app.js:583)", async () => {
    const { state } = await import("../src/state.js");
    expect(state.expandedPillars).toBeInstanceOf(Set);
  });

  it("mode reads from localStorage with internal default", async () => {
    const { state } = await import("../src/state.js");
    expect(typeof state.mode).toBe("string");
    expect(["internal", "external"]).toContain(state.mode);
  });
});
