// src/router.js
// @ts-check
// Phase 4 Wave 5 (D-02 / D-12): setRoute + render-dispatcher SHAPE extracted
// byte-identical (logical structure) from app.js:625-696. Pattern D DI per
// Phase 2 D-05 — render() and renderRoute() take a `deps` object so the
// dispatcher is testable in isolation AND the IIFE-resident renderX bodies
// (still in src/main.js's main IIFE) wire in unchanged.
//
// Wave 5 strategy (Rule 1/3 deviation extending Wave 4 Dev #1 + Wave 3 Dev #1):
// the IIFE-resident renderDashboard / renderDiagnosticIndex / renderPillar /
// renderActions / renderEngagement / renderReport / renderDocuments /
// renderChat / renderRoadmap / renderFunnel / renderAdmin functions stay
// inside src/main.js as private closures (they capture loadOrg, currentUser,
// ensureChatSubscription, jset, K, etc. — all closure-scoped IIFE locals).
// Moving 5,000+ lines of IIFE bodies + closures into ESM modules in one
// wave would jeopardise the Phase 2 D-08 snapshot baselines (zero-diff is
// the cutover gate per D-03). So: router.js owns the dispatcher SHAPE +
// setRoute; main.js calls renderRoute(main, user, org, deps) with deps
// supplied from its closure. The four-boundary lint constraints stay
// honoured (router.js itself imports nothing from firebase/* or data/*).
//
// The 12 src/views/*.js stub Pattern D DI factories preserved at Wave 4
// (84bbed2 / 8edb169) are NOT wired this wave — they are the future shape
// that a follow-up commit (or Phase 5 view-side rewires) lands when body
// migration is safe. Wave 4 Dev #1's logic applies: the snapshot baselines
// + threat model T-4-5-2 (rendered-DOM drift) + D-12 trump literal task
// instructions when conflict arises.

import { state } from "./state.js";

/**
 * @typedef {{
 *   render?: () => void,
 * }} SetRouteDeps
 */

/**
 * Sets state.route + triggers a re-render via the supplied deps.render.
 * Mirrors app.js:625-628 verbatim.
 * @param {string} route
 * @param {SetRouteDeps} [deps]
 * @returns {void}
 */
export function setRoute(route, deps) {
  state.route = route;
  if (deps && typeof deps.render === "function") deps.render();
}

/**
 * @typedef {{
 *   isClientView: (user: *) => boolean,
 *   renderDashboard: (user: *, org: *) => HTMLElement,
 *   renderDiagnosticIndex: (user: *, org: *) => HTMLElement,
 *   renderPillar: (user: *, org: *, id: number) => HTMLElement,
 *   renderActions: (user: *, org: *) => HTMLElement,
 *   renderEngagement: (user: *, org: *) => HTMLElement,
 *   renderReport: (user: *, org: *) => HTMLElement,
 *   renderDocuments: (user: *, org: *) => HTMLElement,
 *   renderChat: (user: *, org: *) => HTMLElement,
 *   renderRoadmap: (user: *, org: *) => HTMLElement,
 *   renderFunnel: (user: *, org: *) => HTMLElement,
 *   renderAdmin: (user: *) => HTMLElement,
 * }} RouteDispatchDeps
 */

/**
 * The route → renderX dispatcher. Body byte-identical (logical shape) with
 * app.js:675-696. Each renderX call is supplied via deps so main.js's IIFE
 * closure provides them without router.js needing to import the IIFE-locals
 * (loadOrg, currentUser, jset, K, etc.) directly.
 *
 * @param {HTMLElement} main
 * @param {*} user
 * @param {*} org
 * @param {RouteDispatchDeps} deps
 * @returns {void}
 */
export function renderRoute(main, user, org, deps) {
  const isClient = deps.isClientView(user);

  const route = state.route;
  if (route === "dashboard") main.appendChild(deps.renderDashboard(user, org));
  else if (route === "diagnostic") main.appendChild(deps.renderDiagnosticIndex(user, org));
  else if (route.startsWith("pillar:")) {
    const id = Number(route.split(":")[1]);
    main.appendChild(deps.renderPillar(user, org, id));
  } else if (route === "actions") main.appendChild(deps.renderActions(user, org));
  else if (route === "engagement") main.appendChild(deps.renderEngagement(user, org));
  else if (route === "report") main.appendChild(deps.renderReport(user, org));
  else if (route === "documents") main.appendChild(deps.renderDocuments(user, org));
  else if (route === "chat") main.appendChild(deps.renderChat(user, org));
  else if (route === "roadmap") main.appendChild(deps.renderRoadmap(user, org));
  else if (route === "funnel") main.appendChild(deps.renderFunnel(user, org));
  else if (route === "admin" && !isClient) main.appendChild(deps.renderAdmin(user));
  else {
    state.route = "dashboard";
    main.appendChild(deps.renderDashboard(user, org));
  }
}
