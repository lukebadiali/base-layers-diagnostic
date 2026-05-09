// src/router.js
// @ts-check
// Phase 4 Wave 5 (D-02 / D-12): setRoute + render-dispatcher SHAPE extracted
// byte-identical (logical structure) from app.js:625-696. Pattern D DI per
// Phase 2 D-05 - render() and renderRoute() take a `deps` object so the
// dispatcher is testable in isolation AND the IIFE-resident renderX bodies
// (still in src/main.js's main IIFE) wire in unchanged.
//
// Phase 6 Wave 3 (D-16): renderRoute now runs an auth-state ladder BEFORE
// the existing route conditional ladder. The 5 auth render fns
// (renderSignIn, renderEmailVerificationLanding, renderFirstRun, renderMfaEnrol,
// renderForgotMfa) are optional in deps because main.js wires them in Wave 5;
// if absent we fall through (preserves backward-compat during the cutover).
//
// BLOCKER-FIX (cross-plan contract): the router reads user.appClaims.role and
// user.appEnrolledFactors. These are NOT native Firebase JS SDK properties on
// the User object - main.js's onAuthStateChanged callback hydrates them BEFORE
// invoking renderRoute via:
//   user.appClaims = (await user.getIdTokenResult()).claims;
//   user.appEnrolledFactors = multiFactor(user).enrolledFactors;
// Wave 3 ships the consumer; Wave 5 (06-05) lands the producer alongside the
// AUTH-14 deletion / firebase-ready bridge retirement.

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
 *   renderSignIn?: () => HTMLElement,
 *   renderEmailVerificationLanding?: () => HTMLElement,
 *   renderFirstRun?: () => HTMLElement,
 *   renderMfaEnrol?: () => HTMLElement,
 *   renderForgotMfa?: () => HTMLElement,
 * }} RouteDispatchDeps
 */

/**
 * The route -> renderX dispatcher. Body byte-identical (logical shape) with
 * app.js:675-696. Each renderX call is supplied via deps so main.js's IIFE
 * closure provides them without router.js needing to import the IIFE-locals
 * (loadOrg, currentUser, jset, K, etc.) directly.
 *
 * Phase 6 Wave 3 (D-16) extends with an auth-state ladder ahead of the
 * existing route ladder.
 *
 * @param {HTMLElement} main
 * @param {*} user
 * @param {*} org
 * @param {RouteDispatchDeps} deps
 * @returns {void}
 */
export function renderRoute(main, user, org, deps) {
  // Phase 6 Wave 3 (D-16): auth-state guards run BEFORE the existing route
  // ladder. Existing ladder only reached for fully-authed + verified +
  // MFA-enrolled sessions. The 5 auth render fns are optional in deps
  // because main.js wires them in Wave 5; if absent, we fall through to
  // the existing ladder (preserves backward-compat during the cutover).
  if (!user && deps.renderSignIn) {
    main.appendChild(deps.renderSignIn());
    return;
  }
  if (user && user.emailVerified === false && deps.renderEmailVerificationLanding) {
    main.appendChild(deps.renderEmailVerificationLanding());
    return;
  }
  if (user && user.firstRun === true && deps.renderFirstRun) {
    main.appendChild(deps.renderFirstRun());
    return;
  }
  // BLOCKER-FIX D-07 Tier-1: explicit Forgot 2FA route - user clicked the
  // sign-in screen's Forgot 2FA button OR landed via the email-link recovery
  // URL. main.js sets state.route = "forgot-mfa" in both cases.
  if (deps.renderForgotMfa && state.route === "forgot-mfa") {
    main.appendChild(deps.renderForgotMfa());
    return;
  }
  // Phase 6 Wave 5 cutover-recovery (2026-05-09): MFA-enrol gate temporarily
  // bypassed so Step 11 SC#4 clock-skew drill can run. The deferred Wave-5
  // wiring items (enrollTotp + qrcodeDataUrl in src/firebase/auth.js) plus
  // mfa.state DISABLED at IdP level (matching this client-side bypass) make
  // the gate moot today. Restore the gate once the post-Wave-5 verification
  // batch (TOTP enrol + AUTH-10 drill) wires in. Tracked in Wave 6 06-06
  // cleanup-ledger.
  // ORIGINAL GATE BELOW — DO NOT DELETE; restore by removing the `false &&` short-circuit.
  if (user && deps.renderMfaEnrol) {
    const role = user.appClaims && user.appClaims.role;
    const enrolled = user.appEnrolledFactors;
    const hasMfa = enrolled && enrolled.length > 0;
    // eslint-disable-next-line no-constant-condition, no-constant-binary-expression
    if (false && (role === "admin" || role === "internal") && !hasMfa) {
      main.appendChild(deps.renderMfaEnrol());
      return;
    }
  }

  // Existing route ladder unchanged from here.
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
