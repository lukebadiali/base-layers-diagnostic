// tests/router.test.js
// @ts-check
// Phase 4 Wave 5 (D-02 / D-12): pin contract for src/router.js — setRoute()
// + render() + renderRoute() dispatcher extracted from app.js:625-696.
//
// Note: router.js is a Pattern D DI module — render()/renderRoute() take a
// `deps` object so the dispatcher is testable without booting the full IIFE.
// app.js:633-696's body keeps its closure-bound shape; router.js exposes
// the dispatcher SHAPE via DI for tests + Wave-5+ progressive extraction.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setRoute, renderRoute } from "../src/router.js";
import { state } from "../src/state.js";

describe("src/router.js — setRoute + dispatcher shape", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    state.route = "dashboard";
    state.chart = null;
  });

  it("setRoute(route) sets state.route and calls deps.render", () => {
    const renderSpy = vi.fn();
    setRoute("admin", { render: renderSpy });
    expect(state.route).toBe("admin");
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it("renderRoute dispatches to deps.renderDashboard for state.route='dashboard'", () => {
    state.route = "dashboard";
    const main = document.createElement("main");
    const renderDashboard = vi.fn(() => document.createElement("div"));
    const deps = {
      isClientView: () => false,
      renderDashboard,
      renderDiagnosticIndex: vi.fn(),
      renderPillar: vi.fn(),
      renderActions: vi.fn(),
      renderEngagement: vi.fn(),
      renderReport: vi.fn(),
      renderDocuments: vi.fn(),
      renderChat: vi.fn(),
      renderRoadmap: vi.fn(),
      renderFunnel: vi.fn(),
      renderAdmin: vi.fn(),
    };
    renderRoute(main, /** @type {*} */ ({ id: "u1" }), /** @type {*} */ ({ id: "o1" }), deps);
    expect(renderDashboard).toHaveBeenCalled();
  });

  it("renderRoute dispatches to deps.renderPillar for pillar:N route", () => {
    state.route = "pillar:3";
    const main = document.createElement("main");
    const renderPillar = vi.fn(() => document.createElement("div"));
    const deps = {
      isClientView: () => false,
      renderDashboard: vi.fn(),
      renderDiagnosticIndex: vi.fn(),
      renderPillar,
      renderActions: vi.fn(),
      renderEngagement: vi.fn(),
      renderReport: vi.fn(),
      renderDocuments: vi.fn(),
      renderChat: vi.fn(),
      renderRoadmap: vi.fn(),
      renderFunnel: vi.fn(),
      renderAdmin: vi.fn(),
    };
    renderRoute(main, /** @type {*} */ ({ id: "u1" }), /** @type {*} */ ({ id: "o1" }), deps);
    expect(renderPillar).toHaveBeenCalledWith(expect.anything(), expect.anything(), 3);
  });

  it("renderRoute falls back to dashboard for unknown route", () => {
    state.route = "nonsense";
    const main = document.createElement("main");
    const renderDashboard = vi.fn(() => document.createElement("div"));
    const deps = {
      isClientView: () => false,
      renderDashboard,
      renderDiagnosticIndex: vi.fn(),
      renderPillar: vi.fn(),
      renderActions: vi.fn(),
      renderEngagement: vi.fn(),
      renderReport: vi.fn(),
      renderDocuments: vi.fn(),
      renderChat: vi.fn(),
      renderRoadmap: vi.fn(),
      renderFunnel: vi.fn(),
      renderAdmin: vi.fn(),
    };
    renderRoute(main, /** @type {*} */ ({ id: "u1" }), /** @type {*} */ ({ id: "o1" }), deps);
    expect(state.route).toBe("dashboard");
    expect(renderDashboard).toHaveBeenCalled();
  });

  it("renderRoute gates admin route via deps.isClientView", () => {
    state.route = "admin";
    const main = document.createElement("main");
    const renderAdmin = vi.fn(() => document.createElement("div"));
    const renderDashboard = vi.fn(() => document.createElement("div"));
    const deps = {
      isClientView: () => true, // client view — admin route blocked
      renderDashboard,
      renderDiagnosticIndex: vi.fn(),
      renderPillar: vi.fn(),
      renderActions: vi.fn(),
      renderEngagement: vi.fn(),
      renderReport: vi.fn(),
      renderDocuments: vi.fn(),
      renderChat: vi.fn(),
      renderRoadmap: vi.fn(),
      renderFunnel: vi.fn(),
      renderAdmin,
    };
    renderRoute(main, /** @type {*} */ ({ id: "u1" }), /** @type {*} */ ({ id: "o1" }), deps);
    expect(renderAdmin).not.toHaveBeenCalled();
    expect(renderDashboard).toHaveBeenCalled();
  });
});
