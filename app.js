// @ts-nocheck
// Phase 4: remove after modular split. See runbooks/phase-4-cleanup-ledger.md
/* ============================================================
   BeDeveloped — Base Layers (v2)
   - Login (internal + client roles)
   - Multi-user diagnostic, per-user responses
   - Assessment rounds with radar overlay (current vs previous)
   - Comments thread per pillar with unread tracking
   - Data isolation: clients see only their org
   All state in localStorage — no backend required.
   ============================================================ */

// Phase 2 (D-04 supersedes Phase 1 D-14): index.html now loads this file as
// type="module". Imports below are populated by Waves 1-4.
//
// Waves that populate this block:
//   Wave 1 (Plan 02-02): src/util/ids.js, src/util/hash.js  [LANDED]
//   Wave 2 (Plan 02-03): src/domain/banding.js, src/domain/scoring.js
//   Wave 3 (Plan 02-04): src/domain/completion.js, src/domain/unread.js
//   Wave 4 (Plan 02-05): src/data/migration.js, src/data/cloud-sync.js, src/auth/state-machine.js
import {
  uid,
  iso,
  formatWhen,
  initials,
  firstNameFromAuthor,
} from "./src/util/ids.js";
import { hashString } from "./src/util/hash.js";
import {
  pillarStatus,
  bandLabel,
  bandStatement,
  bandColor,
} from "./src/domain/banding.js";
import {
  pillarScoreForRound as _pillarScoreForRound,
  pillarScore as _pillarScore,
  respondentsForRound,
  answeredCount as _answeredCount,
} from "./src/domain/scoring.js";
import {
  userCompletionPct as _userCompletionPct,
  orgSummary as _orgSummary,
} from "./src/domain/completion.js";
import {
  unreadCountForPillar as _unreadCountForPillar,
  unreadCountTotal as _unreadCountTotal,
  markPillarRead as _markPillarRead,
  unreadChatTotal as _unreadChatTotal,
} from "./src/domain/unread.js";
import {
  migrateV1IfNeeded as _migrateV1IfNeeded,
  clearOldScaleResponsesIfNeeded as _clearOldScaleResponsesIfNeeded,
} from "./src/data/migration.js";
import { syncFromCloud as _syncFromCloud } from "./src/data/cloud-sync.js";
import * as auth from "./src/auth/state-machine.js";
// Phase 4 Wave 2 (D-12): ui/* helpers extracted from app.js IIFE.
// Closes runbooks/phase-4-cleanup-ledger.md row at app.js:676 (CODE-04 — html:
// branch deleted in src/ui/dom.js) and app.js:527 (the no-unused-vars
// disable for $$ — now legitimately exported).
// $$ is exported from src/ui/dom.js for Wave 4 view consumers; aliased to _$$
// here so app.js's per-file `no-unused-vars` rule (^_ argsIgnorePattern)
// permits the unused import without re-introducing an eslint-disable.
import { h, $, $$ as _$$ } from "./src/ui/dom.js";
import { modal, promptText, confirmDialog } from "./src/ui/modal.js";
// formatWhen/iso/initials/firstNameFromAuthor already imported above from
// ./src/util/ids.js — Wave 4 may switch consumers to ./src/ui/format.js
// per ARCHITECTURE.md §2 helpers-table import path. The re-export module
// exists; consumers stay on util/ids.js this wave (D-12 faithful extraction).
import { notify } from "./src/ui/toast.js";
import {
  validateUpload,
  ALLOWED_MIME_TYPES as _ALLOWED_MIME_TYPES,
  MAX_BYTES as _MAX_BYTES,
} from "./src/ui/upload.js";
// Wave 4 (D-20): notify wired (CODE-07 closes 7 alert() sites);
// validateUpload wired (CODE-09 closes documents-upload trust boundary at
// app.js:3201 — runs BEFORE saveDocument). ALLOWED_MIME_TYPES / MAX_BYTES
// remain _-aliased — they are exported for cross-tier reuse (Phase 5
// storage.rules + Phase 7 callable will reference the same constants).
// Phase 5 + Phase 7 are the actual server-side trust boundaries; client-side
// is the UX/audit-narrative layer per D-15. No new eslint-disable rows
// added (Phase 4 D-17 ledger zero-out).
import { createChrome } from "./src/ui/chrome.js";
// Phase 4 Wave 4 (CODE-10 / D-20): tab-title unread badge memoisation —
// only writes document.title when value differs. Setter lives in src/views/
// chat.js (the view that owns the tab-title surface).
import { setTitleIfDifferent } from "./src/views/chat.js";
// Phase 4 Wave 3 (D-09 / D-10): 6 full-owner data/* wrappers (orgs, users,
// roadmaps, funnels, funnel-comments, allowlist). Imports land NOW so Wave 4
// view extraction is a pure rewire — no new module discovery. Aliased _* to
// satisfy the `^_` argsIgnorePattern (added Wave 1) until Wave 4 wires
// consumers; the current IIFE keeps its localStorage-fronted helpers
// (loadOrg/loadUsers/etc.) verbatim per D-12 faithful extraction so the
// snapshot baselines at tests/__snapshots__/views/{dashboard,diagnostic,
// report}.html continue to produce zero diff. Phase 5 (DATA-01..06) replaces
// the localStorage-fronted helpers with these wrappers' subcollection-aware
// successors; Wave 4 (04-04) is the wave that flips views/* call sites.
import {
  getOrg as _getOrg,
  listOrgs as _listOrgs,
  saveOrg as _saveOrg,
  deleteOrg as _deleteOrg,
  subscribeOrgs as _subscribeOrgs,
} from "./src/data/orgs.js";
import {
  getUser as _getUser,
  listUsers as _listUsers,
  saveUser as _saveUser,
  deleteUser as _deleteUser,
  subscribeUsers as _subscribeUsers,
} from "./src/data/users.js";
import {
  getRoadmap as _getRoadmap,
  listRoadmaps as _listRoadmaps,
  saveRoadmap as _saveRoadmap,
  deleteRoadmap as _deleteRoadmap,
  subscribeRoadmaps as _subscribeRoadmaps,
} from "./src/data/roadmaps.js";
import {
  getFunnel as _getFunnel,
  listFunnels as _listFunnels,
  saveFunnel as _saveFunnel,
  deleteFunnel as _deleteFunnel,
  subscribeFunnels as _subscribeFunnels,
} from "./src/data/funnels.js";
import {
  listFunnelComments as _listFunnelComments,
  addFunnelComment as _addFunnelComment,
  deleteFunnelComment as _deleteFunnelComment,
  subscribeFunnelComments as _subscribeFunnelComments,
} from "./src/data/funnel-comments.js";
import {
  getAllowlistEntry as _getAllowlistEntry,
  listAllowlist as _listAllowlist,
} from "./src/data/allowlist.js";

(function () {
  "use strict";

  const DATA = window.BASE_LAYERS;
  const LS = window.localStorage;

  // ---------- Storage keys ----------
  const K = {
    users: "baselayers:users",
    session: "baselayers:session",
    settings: "baselayers:settings",
    orgs: "baselayers:orgs",
    mode: "baselayers:mode",
    org: (id) => `baselayers:org:${id}`,
    // v1 compat
    v1Active: "baselayers:active",
  };

  // ---------- Utilities ----------
  // Phase 2 (D-05): uid, iso, formatWhen extracted to src/util/ids.js — re-imported at module top, do not re-define.

  const formatDate = (when) => {
    if (!when) return "";
    return new Date(when).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Phase 2 (D-05): initials, firstNameFromAuthor (and the private capitalise helper) extracted to src/util/ids.js — re-imported at module top, do not re-define.

  // ---------- JSON helpers ----------
  const jget = (k, fallback) => {
    try {
      const v = LS.getItem(k);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  };
  const jset = (k, v) => LS.setItem(k, JSON.stringify(v));

  // ---------- Settings ----------
  function loadSettings() {
    return jget(K.settings, { internalPassphrase: null });
  }
  function saveSettings(s) {
    jset(K.settings, s);
  }

  // ---------- Users ----------
  function loadUsers() {
    return jget(K.users, []);
  }
  function saveUsers(u) {
    jset(K.users, u);
  }
  function findUser(id) {
    return loadUsers().find((u) => u.id === id) || null;
  }
  function findUserByEmail(email) {
    const e = (email || "").trim().toLowerCase();
    return loadUsers().find((u) => u.email.toLowerCase() === e) || null;
  }
  function upsertUser(user) {
    const users = loadUsers();
    const i = users.findIndex((u) => u.id === user.id);
    if (i >= 0) users[i] = user;
    else users.push(user);
    saveUsers(users);
    cloudPushUser(user);
  }
  function deleteUser(id) {
    saveUsers(loadUsers().filter((u) => u.id !== id));
    cloudDeleteUser(id);
  }

  // ---------- Orgs ----------
  function loadOrgMetas() {
    return jget(K.orgs, []);
  }
  function saveOrgMetas(m) {
    jset(K.orgs, m);
  }
  function loadOrg(id) {
    return jget(K.org(id), null);
  }
  function saveOrg(org) {
    jset(K.org(org.id), org);
    cloudPushOrg(org);
  }
  function deleteOrg(id) {
    LS.removeItem(K.org(id));
    saveOrgMetas(loadOrgMetas().filter((o) => o.id !== id));
    // cascade: delete client users bound to this org
    const orphanedClientIds = loadUsers()
      .filter((u) => u.orgId === id)
      .map((u) => u.id);
    saveUsers(loadUsers().filter((u) => u.orgId !== id));
    cloudDeleteOrg(id);
    orphanedClientIds.forEach((uid) => cloudDeleteUser(uid));
  }
  function createOrg(name) {
    const id = uid("org_");
    const roundId = uid("r_");
    const org = {
      id,
      name,
      createdAt: iso(),
      currentRoundId: roundId,
      rounds: [{ id: roundId, label: "Round 1", createdAt: iso() }],
      responses: { [roundId]: {} },
      internalNotes: {},
      actions: [],
      engagement: { currentStageId: "diagnosed", stageChecks: {} },
      comments: {},
      readStates: {},
    };
    saveOrg(org);
    const metas = loadOrgMetas();
    metas.push({ id, name });
    saveOrgMetas(metas);
    return org;
  }

  // ---------- Rounds ----------
  function startNewRound(org, label) {
    const roundId = uid("r_");
    const num = (org.rounds || []).length + 1;
    org.rounds = org.rounds || [];
    org.rounds.push({ id: roundId, label: label || `Round ${num}`, createdAt: iso() });
    org.currentRoundId = roundId;
    org.responses = org.responses || {};
    org.responses[roundId] = {};
    saveOrg(org);
    return roundId;
  }

  function roundById(org, id) {
    return (org.rounds || []).find((r) => r.id === id) || null;
  }

  function previousRoundId(org) {
    const rs = org.rounds || [];
    const idx = rs.findIndex((r) => r.id === org.currentRoundId);
    if (idx <= 0) return null;
    return rs[idx - 1].id;
  }

  // ---------- Diagnostic question meta ----------
  // A diagnostic entry can be a plain string (1-10 scale, anchors derived from
  // the question text) or an object: { text, scale, anchors, labels }.
  function questionMeta(entry) {
    const baseScale = 10;
    if (typeof entry === "string") {
      return {
        text: entry,
        scale: baseScale,
        anchors: deriveAnchors(entry),
        labels: null,
      };
    }
    return {
      text: entry.text || "",
      scale: entry.scale || baseScale,
      anchors: entry.anchors || deriveAnchors(entry.text || ""),
      labels: entry.labels || null,
    };
  }

  function deriveAnchors(text) {
    const m = /^How\s+(\w+)/i.exec(text || "");
    const raw = (m ? m[1] : "good").toLowerCase();
    const special = {
      regularly: { low: "Rarely", high: "Very regularly" },
      often: { low: "Never", high: "Always" },
      consistently: { low: "Rarely", high: "Very consistently" },
      quickly: { low: "Very slowly", high: "Very quickly" },
      well: { low: "Not at all", high: "Very well" },
    };
    if (special[raw]) return special[raw];
    // Strip trailing "-ly" so adverbs read as their adjective form
    // ("effectively" -> "effective", "accurately" -> "accurate").
    const adj = raw.length > 4 && raw.endsWith("ly") ? raw.slice(0, -2) : raw;
    return { low: "Not " + adj, high: "Extremely " + adj };
  }

  // ---------- Scoring (aggregated across users in a round) ----------
  // Phase 2 (D-05): pillarScoreForRound, pillarScore, respondentsForRound, answeredCount
  // extracted to src/domain/scoring.js — wrappers below bind DATA + questionMeta (Pattern E).
  // pillarStatus extracted to src/domain/banding.js (D-02 routes it to banding) — re-imported at module top.
  const pillarScoreForRound = (org, roundId, pillarId) =>
    _pillarScoreForRound(org, roundId, pillarId, DATA, questionMeta);
  const pillarScore = (org, pillarId) => _pillarScore(org, pillarId, DATA, questionMeta);
  // eslint-disable-next-line no-unused-vars -- Phase 4: remove dead code or wire up call site. See runbooks/phase-4-cleanup-ledger.md
  const answeredCount = (org, roundId, userId, pillarId) =>
    _answeredCount(org, roundId, userId, pillarId, DATA);

  // Phase 2 Wave 3 (D-05): wrappers for completion + unread (Pattern E).
  // Bodies extracted to src/domain/completion.js + src/domain/unread.js.
  // userCompletionPct + orgSummary inject DATA + pillarScore; unread wrappers
  // inject saveOrg / commentsFor / state / lastReadMillis / msgMillis / unreadChatForOrg
  // (all defined later in the IIFE — safe because wrappers resolve those names
  // at call time, by which point they exist in scope).
  const userCompletionPct = (org, roundId, userId) =>
    _userCompletionPct(org, roundId, userId, DATA);
  const orgSummary = (org) => _orgSummary(org, DATA, pillarScore);
  const unreadCountForPillar = (org, pillarId, user) =>
    _unreadCountForPillar(org, pillarId, user, commentsFor);
  const unreadCountTotal = (org, user) => _unreadCountTotal(org, user, DATA, commentsFor);
  const markPillarRead = (org, pillarId, user) => _markPillarRead(org, pillarId, user, saveOrg);
  const unreadChatTotal = (user) =>
    _unreadChatTotal(user, state, lastReadMillis, msgMillis, unreadChatForOrg);

  // Phase 2 Wave 4 (D-05): wrappers for migration helpers (Pattern E).
  // Bodies extracted to src/data/migration.js.
  const migrateV1IfNeeded = () => _migrateV1IfNeeded({
    loadUsers, loadOrgMetas, loadOrg, saveOrg, upsertUser, findUser,
    removeV1ActiveKey: () => LS.removeItem(K.v1Active),
  });
  const clearOldScaleResponsesIfNeeded = () => _clearOldScaleResponsesIfNeeded({
    loadSettings, saveSettings, loadOrgMetas, loadOrg, saveOrg,
  });
  const syncFromCloud = () => _syncFromCloud({
    fbReady, cloudFetchAllOrgs, cloudFetchAllUsers, cloudPushOrg, cloudPushUser,
    jget, jset, K, render,
  });
  // Phase 2 Wave 4 (D-05): wrappers for auth state-machine (Pattern E).
  // Bodies extracted to src/auth/state-machine.js. Phase 6 (AUTH-14) deletes the whole module.
  const verifyInternalPassword = (pass) => auth.verifyInternalPassword(pass, { INTERNAL_PASSWORD_HASH });
  const verifyOrgClientPassphrase = (orgId, pass) => auth.verifyOrgClientPassphrase(orgId, pass, { loadOrg });
  const verifyUserPassword = (userId, pass) => auth.verifyUserPassword(userId, pass, { findUser });
  const currentUser = () => auth.currentUser({ currentSession, findUser });

  // Phase 2 (D-05): userCompletionPct + orgSummary extracted to src/domain/completion.js — wrappers above.

  function topConstraints(org, n = 3) {
    return DATA.pillars
      .map((p) => ({ p, s: pillarScore(org, p.id) }))
      .filter((x) => x.s !== null)
      .sort((a, b) => a.s - b.s)
      .slice(0, n)
      .map((x) => x.p);
  }

  // ---------- Comments ----------
  function addComment(org, pillarId, authorId, text, internal = false) {
    org.comments = org.comments || {};
    org.comments[pillarId] = org.comments[pillarId] || [];
    const c = {
      id: uid("c_"),
      authorId,
      text,
      internal: !!internal,
      createdAt: iso(),
    };
    org.comments[pillarId].push(c);
    saveOrg(org);
    return c;
  }

  function commentsFor(org, pillarId, user) {
    const list = (org.comments || {})[pillarId] || [];
    if (user && user.role === "client") return list.filter((c) => !c.internal);
    return list;
  }

  // Phase 2 (D-05): unreadCountForPillar, unreadCountTotal, markPillarRead extracted to src/domain/unread.js — wrappers above.

  // ---------- Auth ----------
  function currentSession() {
    return jget(K.session, null);
  }
  // Phase 2 (D-05): currentUser extracted to src/auth/state-machine.js — wrapper above.
  function signIn(userId) {
    jset(K.session, { userId });
  }
  function signOut() {
    stopChatSubscription();
    LS.removeItem(K.session);
  }

  // ---------- Chat unread tracking ----------
  function chatReadKey(userId) {
    return `baselayers:chatLastRead:${userId}`;
  }
  function loadChatLastRead(userId) {
    return jget(chatReadKey(userId), {});
  }
  function saveChatLastRead(userId, map) {
    jset(chatReadKey(userId), map);
  }
  function markChatReadFor(userId, orgId) {
    if (!userId || !orgId) return;
    const m = loadChatLastRead(userId);
    m[orgId] = iso();
    saveChatLastRead(userId, m);
  }
  function lastReadMillis(userId, orgId) {
    const m = loadChatLastRead(userId);
    return m[orgId] ? new Date(m[orgId]).getTime() : 0;
  }
  function msgMillis(msg) {
    return msg.createdAt?.toMillis?.() || (msg.createdAt ? new Date(msg.createdAt).getTime() : 0);
  }
  function unreadChatForOrg(user, orgId) {
    if (!user || !orgId) return 0;
    const lastT = lastReadMillis(user.id, orgId);
    return (state.chatMessages || []).filter(
      (m) => m.orgId === orgId && m.authorId !== user.id && msgMillis(m) > lastT,
    ).length;
  }
  // Phase 2 (D-05): unreadChatTotal extracted to src/domain/unread.js — wrapper above.

  function stopChatSubscription() {
    if (state.chatSubscription) {
      try {
        state.chatSubscription();
        // eslint-disable-next-line no-empty -- Phase 4: replace with explicit ignore + comment. See runbooks/phase-4-cleanup-ledger.md
      } catch {}
      state.chatSubscription = null;
    }
    state.chatMessages = [];
    state.chatSubscribedFor = null;
  }
  function startChatSubscription(user) {
    stopChatSubscription();
    if (!user) return;
    if (!(window.FB && window.FB.currentUser && window.FB.firestore)) return;
    const { db, firestore } = window.FB;
    let q;
    if (user.role === "internal") {
      q = firestore.collection(db, "messages");
    } else if (user.orgId) {
      q = firestore.query(
        firestore.collection(db, "messages"),
        firestore.where("orgId", "==", user.orgId),
      );
    } else {
      return;
    }
    state.chatSubscribedFor = user.id;
    state.chatSubscription = firestore.onSnapshot(
      q,
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        state.chatMessages = list;
        render();
      },
      (err) => console.error("Chat subscription error:", err),
    );
  }
  function ensureChatSubscription(user) {
    if (!user) {
      stopChatSubscription();
      return;
    }
    if (state.chatSubscribedFor === user.id && state.chatSubscription) return;
    if (!(window.FB && window.FB.currentUser)) return;
    startChatSubscription(user);
  }

  const BASE_TAB_TITLE = "BeDeveloped - The Base Layers";
  function updateTabTitleBadge() {
    const user = currentUser();
    const unread = user && user.role === "internal" ? unreadChatTotal(user) : 0;
    // CODE-10 (D-20): memoised title write — only updates when value differs.
    setTitleIfDifferent(unread > 0 ? `(${unread}) ${BASE_TAB_TITLE}` : BASE_TAB_TITLE);
  }

  // Phase 2 (D-05): hashString extracted to src/util/hash.js — re-imported at module top, do not re-define.

  async function setInternalPassphrase(pass) {
    const s = loadSettings();
    s.internalPassphrase = await hashString(pass);
    saveSettings(s);
  }

  async function verifyInternalPassphrase(pass) {
    const s = loadSettings();
    if (!s.internalPassphrase) return false;
    const h = await hashString(pass);
    return h === s.internalPassphrase;
  }

  // ---------- Hardcoded internal credentials ----------
  // NOTE: this hash lives in a public repo. Treat as a light access gate,
  // not real auth. Rotate the password if you suspect exposure.
  const INTERNAL_ALLOWED_EMAILS = ["luke@bedeveloped.com", "george@bedeveloped.com"];
  const INTERNAL_PASSWORD_HASH = "6110f27c9c91658c3489285abd5c45ffe5c1aa99c7f3f37d23e32834566e7fce";
  function isAllowedInternalEmail(email) {
    const e = (email || "").trim().toLowerCase();
    return INTERNAL_ALLOWED_EMAILS.includes(e);
  }
  // Phase 2 (D-05): verifyInternalPassword extracted to src/auth/state-machine.js — wrapper above.

  // ---------- Client org passphrase (shared by all users of an org) ----------
  async function setOrgClientPassphrase(orgId, pass) {
    const org = loadOrg(orgId);
    if (!org) return false;
    org.clientPassphraseHash = await hashString(pass);
    saveOrg(org);
    return true;
  }
  // Phase 2 (D-05): verifyOrgClientPassphrase extracted to src/auth/state-machine.js — wrapper above.
  function orgHasClientPassphrase(orgId) {
    const org = loadOrg(orgId);
    return !!(org && org.clientPassphraseHash);
  }

  // ---------- Per-user password (client users only) ----------
  async function setUserPassword(userId, pass) {
    const u = findUser(userId);
    if (!u) return false;
    u.passwordHash = await hashString(pass);
    upsertUser(u);
    return true;
  }
  // Phase 2 (D-05): verifyUserPassword extracted to src/auth/state-machine.js — wrapper above.

  // Phase 2 (D-05): extracted to src/data/migration.js — wrappers above.

  // ---------- State ----------
  const state = {
    mode: jget(K.mode, "internal"), // internal view mode (only meaningful for internal role)
    route: "dashboard",
    orgId: null, // current selected org (for internal role; for client it's pinned)
    pillarId: null,
    chart: null,
    userMenuOpen: false,
    authTab: "client",
    authError: "",
    expandedPillars: new Set(), // dashboard-tile accordion state
    chatMessages: [], // live feed from Firestore, filtered by role
    chatSubscription: null, // unsubscribe function for the live listener
    chatSubscribedFor: null, // user.id the current subscription is for
  };

  function activeOrgForUser(user) {
    if (!user) return null;
    if (user.role === "client") {
      return user.orgId ? loadOrg(user.orgId) : null;
    }
    // internal: pick state.orgId, else first org
    if (state.orgId) {
      const o = loadOrg(state.orgId);
      if (o) return o;
    }
    const metas = loadOrgMetas();
    if (!metas.length) return null;
    state.orgId = metas[0].id;
    return loadOrg(state.orgId);
  }

  function effectiveRole(user) {
    // internal user in "client preview" mode behaves like a client for content gating
    if (!user) return null;
    if (user.role === "client") return "client";
    return state.mode === "external" ? "client-preview" : "internal";
  }

  function isClientView(user) {
    const r = effectiveRole(user);
    return r === "client" || r === "client-preview";
  }

  // ---------- DOM helpers ----------
  // Phase 4 Wave 2 (D-12 / CODE-04): h / $ / $$ extracted to src/ui/dom.js;
  // modal / promptText / confirmDialog extracted to src/ui/modal.js. The
  // IIFE closure now references the file-scope ESM imports above. The
  // `html:` branch in h() was deleted with permanent XSS regression fixture
  // at tests/ui/dom.test.js (REGRESSION FIXTURE marker).

  // ---------- Router ----------
  function setRoute(route) {
    state.route = route;
    render();
  }

  // ---------- Top-level render ----------
  const appEl = () => $("#app");

  function render() {
    if (state.chart) {
      try {
        state.chart.destroy();
        // eslint-disable-next-line no-empty -- Phase 4: replace with explicit ignore + comment. See runbooks/phase-4-cleanup-ledger.md
      } catch {}
      state.chart = null;
    }

    updateTabTitleBadge();

    const app = appEl();
    // Phase 4 Wave 4 (CODE-05 / D-20): replaceChildren() replaces innerHTML="" — DOM-equivalent (clears children) without touching the unsanitised-property surface ESLint guards.
    app.replaceChildren();

    const user = currentUser();
    ensureChatSubscription(user);
    document.body.classList.toggle("client-view", !!(user && user.role === "client"));
    if (!user) {
      app.appendChild(renderAuth());
      return;
    }

    // Mount shell
    app.appendChild(renderTopbar(user));
    const main = h("main");
    app.appendChild(main);

    const org = activeOrgForUser(user);

    if (!org) {
      // Internal with no orgs yet → show setup prompt
      // Client with no org → account misconfigured message
      main.appendChild(renderNoOrg(user));
    } else {
      renderRoute(main, user, org);
    }

    // footer
    app.appendChild(renderFooter(user, org));
  }

  function renderRoute(main, user, org) {
    const isClient = isClientView(user);

    const route = state.route;
    if (route === "dashboard") main.appendChild(renderDashboard(user, org));
    else if (route === "diagnostic") main.appendChild(renderDiagnosticIndex(user, org));
    else if (route.startsWith("pillar:")) {
      const id = Number(route.split(":")[1]);
      main.appendChild(renderPillar(user, org, id));
    } else if (route === "actions") main.appendChild(renderActions(user, org));
    else if (route === "engagement") main.appendChild(renderEngagement(user, org));
    else if (route === "report") main.appendChild(renderReport(user, org));
    else if (route === "documents") main.appendChild(renderDocuments(user, org));
    else if (route === "chat") main.appendChild(renderChat(user, org));
    else if (route === "roadmap") main.appendChild(renderRoadmap(user, org));
    else if (route === "funnel") main.appendChild(renderFunnel(user, org));
    else if (route === "admin" && !isClient) main.appendChild(renderAdmin(user));
    else {
      state.route = "dashboard";
      main.appendChild(renderDashboard(user, org));
    }
  }

  // ================================================================
  // TOPBAR + FOOTER
  // ================================================================
  // Phase 4 Wave 2 (D-12): renderTopbar + renderFooter extracted byte-identical
  // to src/ui/chrome.js with Pattern D DI per Phase 2 D-05. createChrome(deps)
  // binds the IIFE state + helpers once and returns the two render functions
  // with the original (user) / (user, org) signatures so existing callers in
  // render() / renderRoute() don't change. Wave 5 (D-02) moves state into
  // src/state.js — the createChrome adapter shape stays stable across that
  // cutover.
  const { renderTopbar, renderFooter } = createChrome({
    state,
    activeOrgForUser,
    unreadCountTotal,
    unreadChatTotal,
    setRoute,
    loadOrgMetas,
    jset,
    K,
    render,
    isClientView,
    signOut,
    openChangePasswordModal,
    exportData,
    importData,
  });

  // ================================================================
  // AUTH / LOGIN SCREEN
  // ================================================================
  function renderAuth() {
    const wrap = h("div", { class: "auth-wrap" });

    // Hero side
    wrap.appendChild(
      h("div", { class: "auth-hero" }, [
        h("img", { class: "hero-logo", src: "assets/logo.png", alt: "BeDeveloped" }),
        h("div", {}, [
          h(
            "h1",
            {},
            "Build effective early-stage sales processes that strengthen and improve your business development function.",
          ),
          h(
            "p",
            { class: "lede" },
            "The ten-pillar operating model BeDeveloped uses to diagnose, design and develop early-stage sales functions into repeatable revenue engines.",
          ),
          h("hr", { class: "hero-accent" }),
        ]),
        h(
          "div",
          { class: "quote" },
          "“Early-stage sales is a function, not a personality. Process beats heroics, and repeatability beats charisma.”",
        ),
      ]),
    );

    // Form side
    const form = h("div", { class: "auth-form" });
    form.appendChild(renderSignInForm());
    wrap.appendChild(form);
    return wrap;
  }

  // eslint-disable-next-line no-unused-vars -- Phase 4: remove dead code or wire up call site. See runbooks/phase-4-cleanup-ledger.md
  function renderFirstRunSetup() {
    const container = h("div");
    container.appendChild(h("h2", { class: "auth-heading" }, "First-time setup"));
    container.appendChild(
      h(
        "p",
        { class: "auth-sub" },
        "Create the first BeDeveloped internal account. You'll use this to sign in and to invite clients.",
      ),
    );

    const name = h("input", { type: "text", placeholder: "e.g. Luke Badiali" });
    const email = h("input", { type: "email", placeholder: "you@bedeveloped.com" });
    const pass = h("input", {
      type: "password",
      placeholder: "Team passphrase (shared by internal team)",
    });

    const errBox = h("div");

    const submit = h(
      "button",
      {
        class: "auth-submit",
        onclick: async () => {
          // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
          errBox.replaceChildren();
          if (!name.value.trim() || !email.value.trim() || pass.value.length < 4) {
            errBox.appendChild(
              h(
                "div",
                { class: "auth-error" },
                "Please complete all fields. Passphrase must be at least 4 characters.",
              ),
            );
            return;
          }
          await setInternalPassphrase(pass.value);
          const user = {
            id: uid("u_"),
            email: email.value.trim(),
            name: name.value.trim(),
            role: "internal",
            createdAt: iso(),
          };
          upsertUser(user);
          signIn(user.id);
          render();
        },
      },
      "Create account",
    );

    [
      ["Your name", name],
      ["Email", email],
      ["Team passphrase", pass],
    ].forEach(([lbl, input]) => {
      container.appendChild(h("div", { class: "auth-field" }, [h("label", {}, lbl), input]));
    });

    container.appendChild(errBox);
    container.appendChild(submit);

    container.appendChild(
      h(
        "div",
        { class: "auth-help" },
        "The team passphrase is shared by all BeDeveloped internal team members. Client accounts you invite later will log in with their email only — they won't see this side of the app.",
      ),
    );

    return container;
  }

  function renderSignInForm() {
    const container = h("div");

    const tabs = h("div", { class: "auth-tabs" }, [
      h(
        "button",
        {
          class: state.authTab === "client" ? "active" : "",
          onclick: () => {
            state.authTab = "client";
            state.authError = "";
            render();
          },
        },
        "Client",
      ),
      h(
        "button",
        {
          class: state.authTab === "internal" ? "active" : "",
          onclick: () => {
            state.authTab = "internal";
            state.authError = "";
            render();
          },
        },
        "Internal team",
      ),
    ]);
    container.appendChild(tabs);

    if (state.authTab === "client") {
      container.appendChild(h("h2", { class: "auth-heading" }, "Client sign-in"));
      container.appendChild(
        h(
          "p",
          { class: "auth-sub" },
          "Sign in with the email your BeDeveloped contact used to invite you, your company passphrase, and your personal password.",
        ),
      );

      const email = h("input", { type: "email", placeholder: "you@company.com" });
      const team = h("input", { type: "password", placeholder: "Company passphrase (shared)" });
      const pass = h("input", { type: "password", placeholder: "Your password" });
      const passConfirm = h("input", {
        type: "password",
        placeholder: "Confirm password (first sign-in only)",
        style: "display:none;",
      });
      const errBox = h("div");
      if (state.authError) errBox.appendChild(h("div", { class: "auth-error" }, state.authError));

      const hint = h(
        "div",
        { class: "auth-help", style: "margin-top:0; padding-top:0; border:0;" },
        "First time signing in? Fill in your email + company passphrase, then set a password below. It'll be remembered next time.",
      );

      // Show/hide the confirm field based on whether the entered email belongs to a fresh user
      const updateFirstRunUI = () => {
        const u = findUserByEmail(email.value);
        const needsPassword = u && u.role === "client" && !u.passwordHash;
        passConfirm.style.display = needsPassword ? "block" : "none";
        pass.placeholder = needsPassword ? "Set your password (min 4 chars)" : "Your password";
      };
      email.addEventListener("blur", updateFirstRunUI);
      email.addEventListener("input", updateFirstRunUI);

      const doClientLogin = async () => {
        state.authError = "";
        const u = findUserByEmail(email.value);
        if (!u || u.role !== "client") {
          state.authError =
            "We don't have a client account for that email. Ask your BeDeveloped contact to invite you.";
          render();
          return;
        }
        if (!u.orgId) {
          state.authError =
            "Your client account isn't linked to an organisation yet. Contact BeDeveloped.";
          render();
          return;
        }
        if (!orgHasClientPassphrase(u.orgId)) {
          state.authError =
            "Your organisation hasn't finished sign-in setup yet. Contact your BeDeveloped lead.";
          render();
          return;
        }
        const okTeam = await verifyOrgClientPassphrase(u.orgId, team.value);
        if (!okTeam) {
          state.authError =
            "Company passphrase didn't match. Ask your BeDeveloped contact for the current one.";
          render();
          return;
        }
        if (!u.passwordHash) {
          // First sign-in — password in "pass" field is a new password being set.
          if (pass.value.length < 4) {
            state.authError = "Choose a password of at least 4 characters.";
            render();
            return;
          }
          if (pass.value !== passConfirm.value) {
            state.authError = "Password and confirmation don't match.";
            render();
            return;
          }
          await setUserPassword(u.id, pass.value);
        } else {
          const okPass = await verifyUserPassword(u.id, pass.value);
          if (!okPass) {
            state.authError =
              "Password didn't match. Contact your BeDeveloped lead if you've forgotten it.";
            render();
            return;
          }
        }
        signIn(u.id);
        state.route = "dashboard";
        render();
      };
      [email, team, pass, passConfirm].forEach((el) =>
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") doClientLogin();
        }),
      );

      [
        ["Email", email],
        ["Company passphrase", team],
        ["Password", pass],
      ].forEach(([lbl, input]) => {
        container.appendChild(h("div", { class: "auth-field" }, [h("label", {}, lbl), input]));
      });
      container.appendChild(
        h("div", { class: "auth-field", style: "margin-top:-6px;" }, [passConfirm]),
      );
      container.appendChild(hint);
      container.appendChild(errBox);
      container.appendChild(
        h("button", { class: "auth-submit", onclick: doClientLogin }, "Sign in"),
      );

      container.appendChild(
        h(
          "div",
          { class: "auth-help" },
          "Clients only see their own company's data. If your email or passphrase isn't working, ask your BeDeveloped contact.",
        ),
      );
    } else {
      container.appendChild(h("h2", { class: "auth-heading" }, "Internal sign-in"));
      container.appendChild(
        h(
          "p",
          { class: "auth-sub" },
          "BeDeveloped team members. Enter your work email and the team password.",
        ),
      );

      const email = h("input", { type: "email", placeholder: "you@bedeveloped.com" });
      const pass = h("input", { type: "password", placeholder: "Team password" });
      const errBox = h("div");
      if (state.authError) errBox.appendChild(h("div", { class: "auth-error" }, state.authError));

      const doInternalLogin = async () => {
        state.authError = "";
        if (!isAllowedInternalEmail(email.value)) {
          state.authError = "That email isn't on the internal allowlist. Contact Luke to be added.";
          render();
          return;
        }
        const ok = await verifyInternalPassword(pass.value);
        if (!ok) {
          state.authError = "Password didn't match. Ask another team member for the current one.";
          render();
          return;
        }
        let u = findUserByEmail(email.value);
        if (u && u.role !== "internal") {
          state.authError = "That email is registered as a client.";
          render();
          return;
        }
        if (!u) {
          u = {
            id: uid("u_"),
            email: email.value.trim().toLowerCase(),
            name: email.value.split("@")[0],
            role: "internal",
            createdAt: iso(),
          };
          upsertUser(u);
        }
        signIn(u.id);
        state.route = "dashboard";
        render();
      };
      pass.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doInternalLogin();
      });
      email.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doInternalLogin();
      });

      [
        ["Email", email],
        ["Team password", pass],
      ].forEach(([lbl, input]) => {
        container.appendChild(h("div", { class: "auth-field" }, [h("label", {}, lbl), input]));
      });
      container.appendChild(errBox);
      container.appendChild(
        h("button", { class: "auth-submit", onclick: doInternalLogin }, "Sign in"),
      );

      container.appendChild(
        h(
          "div",
          { class: "auth-help" },
          "Access is limited to the BeDeveloped internal team. You can invite clients after signing in.",
        ),
      );
    }

    return container;
  }

  // ================================================================
  // NO ORG
  // ================================================================
  function renderNoOrg(user) {
    if (user.role === "client") {
      return h("div", { class: "card", style: "text-align:center; padding:48px;" }, [
        h("h2", { style: "margin-top:0;" }, "No organisation assigned"),
        h(
          "p",
          { style: "color: var(--ink-3); max-width:480px; margin: 0 auto;" },
          "Your client account isn't linked to an organisation yet. Please contact your BeDeveloped team lead to finish setup.",
        ),
      ]);
    }
    return h("div", { class: "card", style: "text-align:center; padding:48px;" }, [
      h("h2", { style: "margin-top:0; font-size: 28px;" }, "Create your first client engagement"),
      h(
        "p",
        { style: "color: var(--ink-3); max-width: 520px; margin: 0 auto 20px;" },
        "Start by adding an organisation. Then you can invite their team to complete The Base Layers diagnostic.",
      ),
      h(
        "button",
        {
          class: "btn",
          onclick: () =>
            promptText("New organisation", "e.g. Acme Ltd", (name) => {
              const org = createOrg(name);
              state.orgId = org.id;
              render();
            }),
        },
        "+ Create organisation",
      ),
    ]);
  }

  // ================================================================
  // DASHBOARD
  // ================================================================
  function renderDashboard(user, org) {
    const frag = h("div");
    const summary = orgSummary(org);
    const constraints = topConstraints(org);
    const currentRound = roundById(org, org.currentRoundId);
    const prevRoundId = previousRoundId(org);
    const prevRound = prevRoundId ? roundById(org, prevRoundId) : null;

    const respondents = respondentsForRound(org, org.currentRoundId);
    const respUsers = respondents.map((id) => findUser(id)).filter(Boolean);

    // Internal-only: alert banner for unread client chat messages across all orgs
    if (user.role === "internal") {
      const unreadChat = unreadChatTotal(user);
      if (unreadChat > 0) {
        frag.appendChild(
          h(
            "div",
            {
              style:
                "display:flex; align-items:center; gap:14px; padding:12px 16px; margin-bottom:16px; background: var(--red-bg); border:1px solid var(--red); border-radius: 10px;",
            },
            [
              h(
                "div",
                {
                  style:
                    "min-width:32px; height:32px; border-radius:50%; background: var(--red); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px;",
                },
                String(unreadChat),
              ),
              h("div", { style: "flex:1; color: var(--ink);" }, [
                h(
                  "div",
                  { style: "font-weight:600;" },
                  `${unreadChat} unread client message${unreadChat === 1 ? "" : "s"}`,
                ),
                h(
                  "div",
                  { style: "font-size:12.5px; color: var(--ink-3);" },
                  "Across every client channel - click through to respond.",
                ),
              ]),
              h(
                "button",
                {
                  class: "btn sm",
                  onclick: () => setRoute("chat"),
                },
                "Open chat",
              ),
            ],
          ),
        );
      }
    }

    // Heading
    frag.appendChild(h("h1", { class: "view-title" }, org.name));

    frag.appendChild(
      h(
        "p",
        { class: "view-sub" },
        summary.scoredCount === 0
          ? "No diagnostics completed yet. Start scoring a pillar to see The Base Layers view."
          : `Scored ${summary.scoredCount} of ${DATA.pillars.length} pillars. Overall health ${summary.avg ?? "—"} / 100.`,
      ),
    );

    // Round bar
    frag.appendChild(renderRoundBar(user, org, currentRound, prevRound, respUsers));

    // Top row
    const dashTop = h("div", { class: "dash-top" });

    // Radar card
    const chartCard = h("div", { class: "card" });
    chartCard.appendChild(h("h3", {}, "The Base Layers"));
    const chartWrap = h("div", { class: "chart-wrap" });
    chartWrap.appendChild(h("canvas", { id: "radar" }));
    chartCard.appendChild(chartWrap);
    dashTop.appendChild(chartCard);

    // Summary card
    const sumCard = h("div", { class: "card" });
    sumCard.appendChild(h("h3", {}, "Health summary"));
    const grid = h("div", { class: "summary-grid" }, [
      summaryCell("Overall", summary.avg !== null ? `${summary.avg}` : "—", "overall"),
      summaryCell("Red", summary.red, "red"),
      summaryCell("Amber", summary.amber, "amber"),
      summaryCell("Green", summary.green, "green"),
      summaryCell("Not scored", summary.gray, "gray"),
      summaryCell("Pillars", `${summary.scoredCount}/${DATA.pillars.length}`, "count"),
    ]);
    sumCard.appendChild(grid);

    if (constraints.length) {
      const tc = h("div", { class: "top-constraints" });
      tc.appendChild(h("h3", {}, "Top constraints"));
      const ol = h("ol");
      constraints.forEach((p) => {
        const s = pillarScore(org, p.id);
        const li = h("li", {}, [
          h(
            "a",
            {
              href: "#",
              onclick: (e) => {
                e.preventDefault();
                setRoute("pillar:" + p.id);
              },
            },
            p.name,
          ),
          ` — ${s}/100`,
        ]);
        ol.appendChild(li);
      });
      tc.appendChild(ol);
      sumCard.appendChild(tc);
    }
    dashTop.appendChild(sumCard);
    frag.appendChild(dashTop);

    // Tiles (accordion — click to expand in place)
    const tilesHeader = h(
      "div",
      {
        style:
          "display:flex; justify-content:space-between; align-items:baseline; margin-top:28px; margin-bottom:10px;",
      },
      [
        h("h2", { style: "margin:0;" }, "The ten pillars"),
        h(
          "button",
          {
            class: "btn ghost sm",
            style: "border-color:var(--line); color:var(--ink-3);",
            onclick: () => {
              if (state.expandedPillars.size === DATA.pillars.length) state.expandedPillars.clear();
              else DATA.pillars.forEach((p) => state.expandedPillars.add(p.id));
              render();
            },
          },
          state.expandedPillars.size === DATA.pillars.length ? "Collapse all" : "Expand all",
        ),
      ],
    );
    frag.appendChild(tilesHeader);

    const tiles = h("div", { class: "tiles" });
    DATA.pillars.forEach((p) => {
      const s = pillarScore(org, p.id);
      const prevS = prevRoundId ? pillarScoreForRound(org, prevRoundId, p.id) : null;
      const status = pillarStatus(s);
      const { done, total } = answerSummaryForPillar(org, p.id);
      const isOpen = state.expandedPillars.has(p.id);

      const tile = h("div", {
        class: "tile" + (isOpen ? " expanded" : ""),
        "aria-expanded": isOpen ? "true" : "false",
        onclick: () => {
          if (isOpen) state.expandedPillars.delete(p.id);
          else state.expandedPillars.add(p.id);
          render();
        },
      });
      tile.appendChild(h("div", { class: "num" }, `PILLAR ${p.id}`));
      tile.appendChild(h("div", { class: "name" }, p.name));

      if (!isOpen) {
        tile.appendChild(h("div", { class: "tag" }, p.tagline));
      }

      const foot = h("div", { class: "foot" });
      const scoreWrap = h("div", { style: "display:flex; align-items:baseline; gap:6px;" });
      scoreWrap.appendChild(h("div", { class: "score" }, s !== null ? `${s}` : "—"));
      if (s !== null && prevS !== null) {
        const d = s - prevS;
        const cls = d > 0 ? "delta-up" : d < 0 ? "delta-down" : "delta-same";
        const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "=";
        scoreWrap.appendChild(
          h("span", { class: cls, style: "font-size:12px;" }, `${arrow} ${Math.abs(d)}`),
        );
      }
      foot.appendChild(scoreWrap);

      const rightFoot = h("div", { style: "display:flex; align-items:center; gap:8px;" });
      rightFoot.appendChild(
        h("span", { class: `badge ${status}` }, statusLabel(status, done, total)),
      );
      rightFoot.appendChild(
        h(
          "button",
          {
            class: "tile-toggle",
            "aria-label": isOpen ? "Collapse pillar" : "Expand pillar",
            title: isOpen ? "Collapse" : "Expand",
            onclick: (e) => {
              e.stopPropagation();
              if (isOpen) state.expandedPillars.delete(p.id);
              else state.expandedPillars.add(p.id);
              render();
            },
          },
          "▾",
        ),
      );
      foot.appendChild(rightFoot);
      tile.appendChild(foot);

      // Expansion body
      if (isOpen) {
        const exp = h("div", { class: "tile-expansion", onclick: (e) => e.stopPropagation() });
        exp.appendChild(h("p", { class: "exp-desc" }, p.dashDescription || p.overview));
        exp.appendChild(
          h("div", { class: "exp-achieve" }, [
            h("span", { class: "exp-achieve-label" }, "What we're trying to achieve "),
            h("span", {}, p.dashAchieve || ""),
          ]),
        );
        exp.appendChild(
          h("div", { class: "exp-actions" }, [
            h(
              "button",
              {
                class: "btn sm secondary",
                onclick: (e) => {
                  e.stopPropagation();
                  setRoute("pillar:" + p.id);
                },
              },
              "Open full diagnostic →",
            ),
          ]),
        );
        tile.appendChild(exp);
      }

      tiles.appendChild(tile);
    });

    // Operational Excellence — the underpinning block (not a scored pillar)
    tiles.appendChild(renderOperationalExcellenceTile());

    frag.appendChild(tiles);

    // Draw radar after the DOM settles
    queueMicrotask(() => drawRadar(org, prevRoundId));
    return frag;
  }

  function renderOperationalExcellenceTile() {
    const points = [
      "Clear ownership of commercial processes across sales, marketing and delivery",
      "Defined operating rhythms (weekly, monthly, quarterly) to drive consistency and focus",
      "Standardised documentation to move from informal behaviour to repeatable best practice",
      "Reduced friction between teams through agreed handovers and workflows",
      "Improved execution speed by eliminating ambiguity, duplication and rework",
      "Scalable processes that do not rely on individual heroics or a handful of relationships",
      "Commercial decision-making supported by data and insight, not instinct alone",
      "Governance structures that maintain discipline and quality as the organisation scales",
    ];
    const isOpen = state.expandedPillars.has("opex");
    const tile = h("div", {
      class: "tile opex" + (isOpen ? " expanded" : ""),
      onclick: () => {
        if (isOpen) state.expandedPillars.delete("opex");
        else state.expandedPillars.add("opex");
        render();
      },
    });
    tile.appendChild(h("div", { class: "num" }, "PERFORMANCE LAYER"));
    tile.appendChild(h("div", { class: "name" }, "Operational Excellence"));
    if (!isOpen) {
      tile.appendChild(
        h(
          "div",
          { class: "tag" },
          "Underpins the ten pillars to ensure clarity and coaching is developed, not just strategy and theory. Ensures early-stage sales is implemented, adopted and sustained, not treated as a one-off initiative or leadership push.",
        ),
      );
    }

    const foot = h("div", { class: "foot", style: "justify-content: flex-end;" });
    foot.appendChild(
      h(
        "button",
        {
          class: "tile-toggle",
          "aria-label": isOpen ? "Collapse" : "Expand",
          title: isOpen ? "Collapse" : "Expand",
          onclick: (e) => {
            e.stopPropagation();
            if (isOpen) state.expandedPillars.delete("opex");
            else state.expandedPillars.add("opex");
            render();
          },
        },
        "▾",
      ),
    );
    tile.appendChild(foot);

    if (isOpen) {
      const exp = h("div", { class: "tile-expansion", onclick: (e) => e.stopPropagation() });
      exp.appendChild(
        h(
          "p",
          { class: "exp-desc" },
          "Underpins the ten pillars to ensure clarity and coaching is developed, not just strategy and theory. Ensures early-stage sales is implemented, adopted and sustained, not treated as a one-off initiative or leadership push.",
        ),
      );
      const ul = h("ul", { class: "opex-list" });
      points.forEach((p) => ul.appendChild(h("li", {}, p)));
      exp.appendChild(ul);
      tile.appendChild(exp);
    }
    return tile;
  }

  function answerSummaryForPillar(org, pillarId) {
    const byUser = (org.responses || {})[org.currentRoundId] || {};
    let done = 0,
      total = 0;
    Object.values(byUser).forEach((perPillar) => {
      const qs = (perPillar || {})[pillarId] || {};
      total += DATA.pillars.find((p) => p.id === pillarId).diagnostics.length;
      done += Object.values(qs).filter((r) => Number.isFinite(r.score)).length;
    });
    return { done, total };
  }

  function renderRoundBar(user, org, currentRound, prevRound, respUsers) {
    const bar = h("div", { class: "round-bar" });
    const label = h("div", { class: "round-label" });

    label.appendChild(
      h("span", { class: "round-pill" }, currentRound ? currentRound.label : "Round 1"),
    );
    label.appendChild(
      h("span", { class: "round-meta" }, `started ${formatDate(currentRound?.createdAt)}`),
    );

    if (respUsers.length) {
      const stack = h("span", {
        class: "respondent-stack",
        style: "display:inline-flex; margin-left:10px;",
      });
      respUsers.slice(0, 5).forEach((u) => {
        stack.appendChild(
          h("span", { class: "avatar", title: u.name || u.email }, initials(u.name || u.email)),
        );
      });
      label.appendChild(stack);
      label.appendChild(
        h(
          "span",
          { class: "respondents-chip" },
          `${respUsers.length} respondent${respUsers.length === 1 ? "" : "s"}`,
        ),
      );
    } else {
      label.appendChild(h("span", { class: "respondents-chip" }, "No respondents yet"));
    }

    if (prevRound) {
      label.appendChild(
        h(
          "span",
          { class: "round-meta", style: "margin-left:10px;" },
          `· previous: ${prevRound.label}`,
        ),
      );
    }

    bar.appendChild(label);

    const actions = h("div", { class: "round-bar-actions" });
    if (!isClientView(user)) {
      actions.appendChild(
        h(
          "button",
          {
            class: "btn secondary",
            onclick: () => {
              confirmDialog(
                "Start new assessment round?",
                `This locks in "${currentRound?.label || "the current round"}" as a historic snapshot and opens a fresh round so the team can retake the diagnostic. Progress against the previous round will appear on the dashboard.`,
                () => {
                  const org2 = loadOrg(org.id);
                  startNewRound(org2);
                  render();
                },
                "Start new round",
              );
            },
          },
          "+ Start new round",
        ),
      );
    }
    bar.appendChild(actions);
    return bar;
  }

  function summaryCell(label, value, cls) {
    return h("div", { class: `summary-cell ${cls}` }, [
      h("div", { class: "label" }, label),
      h("div", { class: "value" }, String(value ?? "—")),
    ]);
  }

  function statusLabel(status, done, total) {
    if (status === "gray") return done > 0 ? `${done}/${total} answers` : "Not scored";
    return { red: "Red", amber: "Amber", green: "Green" }[status];
  }

  function drawRadar(org, prevRoundId) {
    if (!window.Chart) {
      setTimeout(() => drawRadar(org, prevRoundId), 120);
      return;
    }
    const canvas = $("#radar");
    if (!canvas) return;

    const labels = DATA.pillars.map((p) => p.shortName || p.name);
    const curr = DATA.pillars.map((p) => pillarScore(org, p.id) ?? 0);

    const datasets = [];
    if (prevRoundId) {
      const prev = DATA.pillars.map((p) => pillarScoreForRound(org, prevRoundId, p.id) ?? 0);
      datasets.push({
        label: "Previous",
        data: prev,
        fill: true,
        backgroundColor: "rgba(237, 125, 49, 0.12)",
        borderColor: "rgba(237, 125, 49, 0.9)",
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 2,
        pointBackgroundColor: "#ED7D31",
      });
    }
    datasets.push({
      label: "Current",
      data: curr,
      fill: true,
      backgroundColor: "rgba(87,158,192,0.18)",
      borderColor: "rgba(87,158,192,1)",
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: "#579EC0",
    });

    state.chart = new Chart(canvas.getContext("2d"), {
      type: "radar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: !!prevRoundId, position: "bottom", labels: { font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.r}/100` } },
        },
        scales: {
          r: {
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: {
              stepSize: 20,
              color: "#8a94a7",
              backdropColor: "rgba(0,0,0,0)",
              font: { size: 10 },
            },
            grid: { color: "#e3e6ee" },
            angleLines: { color: "#e3e6ee" },
            pointLabels: { font: { size: 11, family: "Inter" }, color: "#303849" },
          },
        },
      },
    });
  }

  // ================================================================
  // DIAGNOSTIC INDEX
  // ================================================================
  function renderDiagnosticIndex(user, org) {
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Diagnostic"));
    frag.appendChild(
      h(
        "p",
        { class: "view-sub" },
        isClientView(user)
          ? "Score each pillar honestly against the diagnostic questions. Your responses join the team view."
          : "Score each pillar against its diagnostic questions.",
      ),
    );

    // Show current user's own completion if client/internal preview
    if (isClientView(user)) {
      const pct = userCompletionPct(org, org.currentRoundId, user.id);
      frag.appendChild(
        h(
          "div",
          {
            style:
              "background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:14px 18px; margin-bottom:16px; display:flex; gap:14px; align-items:center;",
          },
          [
            h("span", { class: "avatar" }, initials(user.name || user.email)),
            h("div", { style: "flex:1;" }, [
              h("div", { style: "font-weight:600;" }, "Your progress"),
              h(
                "div",
                { style: "color: var(--ink-3); font-size: 12px;" },
                `${pct}% of ${DATA.pillars.length * DATA.pillars[0].diagnostics.length} questions answered`,
              ),
            ]),
            h(
              "div",
              {
                style:
                  "height:8px; width:180px; background:var(--line); border-radius:999px; overflow:hidden;",
              },
              h("span", {
                style: `display:block; height:100%; width:${pct}%; background:var(--brand);`,
              }),
            ),
          ],
        ),
      );
    }

    const tiles = h("div", { class: "tiles" });
    DATA.pillars.forEach((p) => {
      const s = pillarScore(org, p.id);
      const status = pillarStatus(s);
      const unread = unreadCountForPillar(org, p.id, user);

      // For the current user's answered state
      // eslint-disable-next-line no-useless-assignment -- Phase 4: tighten loop control flow (initial value never read before reassignment). See runbooks/phase-4-cleanup-ledger.md
      let userDone = 0;
      const userResp =
        (((org.responses || {})[org.currentRoundId] || {})[user.id] || {})[p.id] || {};
      userDone = Object.values(userResp).filter((r) => Number.isFinite(r.score)).length;
      const total = p.diagnostics.length;

      const tile = h("div", {
        class: "tile",
        onclick: () => setRoute("pillar:" + p.id),
      });
      tile.appendChild(h("div", { class: "num" }, `PILLAR ${p.id}`));
      tile.appendChild(h("div", { class: "name" }, p.name));
      tile.appendChild(
        h(
          "div",
          { class: "tag" },
          isClientView(user)
            ? `${userDone}/${total} of your answers · team score ${s !== null ? s + "/100" : "—"}`
            : `${userDone}/${total} of your answers · team score ${s !== null ? s + "/100" : "—"}`,
        ),
      );
      const foot = h("div", { class: "foot" });
      foot.appendChild(h("div", { class: "score" }, s !== null ? `${s}` : "—"));
      const badgeWrap = h("div", { style: "display:flex; gap:6px; align-items:center;" });
      if (unread > 0)
        badgeWrap.appendChild(
          h("span", { class: "count-badge", title: "Unread comments" }, unread),
        );
      badgeWrap.appendChild(
        h("span", { class: `badge ${status}` }, statusLabel(status, userDone, total)),
      );
      foot.appendChild(badgeWrap);
      tile.appendChild(foot);
      tiles.appendChild(tile);
    });
    frag.appendChild(tiles);
    return frag;
  }

  // ================================================================
  // PILLAR DETAIL
  // ================================================================
  function renderPillar(user, org, pillarId) {
    const p = DATA.pillars.find((x) => x.id === pillarId);
    if (!p) return h("div", {}, "Pillar not found.");

    // mark comments read on load
    markPillarRead(org, pillarId, user);

    const s = pillarScore(org, p.id);
    const status = pillarStatus(s);
    const isClient = isClientView(user);

    const frag = h("div");

    // Header
    frag.appendChild(
      h("div", { class: "pillar-header" }, [
        h("div", {}, [
          h(
            "button",
            {
              class: "back",
              onclick: () => setRoute("diagnostic"),
            },
            "← Back to diagnostic",
          ),
          h("div", { class: "pillar-pill" }, `PILLAR ${p.id}`),
          h("h1", { class: "view-title", style: "margin-top:2px;" }, p.name),
          h("p", { class: "view-sub", style: "max-width:720px;" }, p.tagline),
        ]),
        h("span", { class: `badge ${status}` }, s !== null ? `${s}/100 team` : "Not scored"),
      ]),
    );

    // Overview card
    frag.appendChild(
      h("div", { class: "card", style: "margin-bottom:20px;" }, [h("p", {}, p.overview)]),
    );

    const grid = h("div", { class: "pillar-grid" });

    // Left: diagnostic questions (user's own)
    const left = h("div");
    left.appendChild(
      h("h3", {}, isClient ? "Your responses" : "Diagnostic questions (your responses)"),
    );
    p.diagnostics.forEach((q, idx) => {
      left.appendChild(renderQuestion(user, org, p, idx, q));
    });

    // Complete button - returns to the diagnostic landing
    left.appendChild(
      h("div", { style: "margin-top:20px; display:flex; justify-content:flex-end;" }, [
        h(
          "button",
          {
            class: "btn",
            onclick: () => setRoute("diagnostic"),
          },
          "Complete",
        ),
      ]),
    );

    // Team average (if more than self-has-answered)
    const teamPanel = renderTeamResponses(user, org, p);
    if (teamPanel) left.appendChild(teamPanel);

    grid.appendChild(left);

    // Right: side panels
    const right = h("div");
    right.appendChild(renderScoreBlock(org, p));
    right.appendChild(sidePanel("Objectives", p.objectives));
    right.appendChild(sidePanel("Components", p.components));
    right.appendChild(sidePanel("Outcomes", p.outcomes));
    if (!isClient) right.appendChild(sidePanel("What we do (internal)", p.whatWeDo, true));

    // Pillar-specific actions
    const filteredActions = (org.actions || [])
      .filter((a) => a.pillarId === p.id)
      .filter((a) => !isClient || !a.internal);
    const openActions = filteredActions.filter((a) => !a.done);
    const completedActions = filteredActions.filter((a) => a.done);

    const actionsPanel = h(
      "div",
      { class: "side-panel" },
      [
        h("div", { style: "display:flex; justify-content:space-between; align-items:center;" }, [
          h("h3", { style: "margin:0;" }, "Actions"),
          h(
            "button",
            {
              class: "btn sm",
              onclick: () =>
                promptText("New action", "e.g. Validate ICP with closed-won data", (title) => {
                  addAction(user.id, p.id, title);
                  render();
                }),
            },
            "+ Add",
          ),
        ]),
        filteredActions.length === 0
          ? h(
              "p",
              { style: "color: var(--ink-3); font-size:13px; margin-top:10px;" },
              "No actions yet.",
            )
          : openActions.length === 0
            ? h(
                "p",
                { style: "color: var(--ink-3); font-size:13px; margin-top:10px;" },
                "No open actions.",
              )
            : h(
                "ul",
                {},
                openActions.map((a) => h("li", {}, a.title)),
              ),
        completedActions.length
          ? h(
              "div",
              { style: "margin-top:14px; padding-top:10px; border-top: 1px solid var(--line);" },
              [
                h(
                  "div",
                  {
                    style:
                      "font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color: var(--ink-3); margin-bottom:6px;",
                  },
                  `Completed (${completedActions.length})`,
                ),
                h(
                  "ul",
                  { style: "margin:0;" },
                  completedActions.map((a) =>
                    h(
                      "li",
                      { style: "text-decoration:line-through; color: var(--ink-4);" },
                      a.title,
                    ),
                  ),
                ),
              ],
            )
          : null,
      ].filter(Boolean),
    );
    right.appendChild(actionsPanel);

    grid.appendChild(right);
    frag.appendChild(grid);
    return frag;
  }

  function renderQuestion(user, org, p, idx, qEntry) {
    const meta = questionMeta(qEntry);
    const resp =
      ((((org.responses || {})[org.currentRoundId] || {})[user.id] || {})[p.id] || {})[idx] || {};
    const card = h("div", { class: "q-card" });
    card.appendChild(h("div", { class: "q-text" }, `${idx + 1}. ${meta.text}`));

    // Anchor row
    card.appendChild(
      h(
        "div",
        {
          style:
            "display:flex; justify-content:space-between; font-size:11px; color:var(--ink-3); margin-bottom:6px; letter-spacing:0.04em;",
        },
        [
          h("span", {}, `1 - ${meta.anchors.low}`),
          h("span", {}, `${meta.scale} - ${meta.anchors.high}`),
        ],
      ),
    );

    // Buttons
    const scaleClass = meta.scale === 10 ? "likert likert-10" : "likert likert-" + meta.scale;
    const likert = h("div", { class: scaleClass });
    // Clamp any stale responses to this question's scale so old data doesn't get stuck selected out-of-range.
    const selectedScore = resp.score >= 1 && resp.score <= meta.scale ? resp.score : null;
    for (let n = 1; n <= meta.scale; n++) {
      const btn = h(
        "button",
        {
          class: selectedScore === n ? "sel" : "",
          title: (meta.labels && meta.labels[n]) || DATA.scoreLabels[n] || String(n),
          onclick: () => {
            setResponse(user, org, p.id, idx, { score: n });
            render();
          },
        },
        [
          h("span", { class: "n" }, String(n)),
          meta.labels && meta.labels[n] ? h("span", { class: "t" }, meta.labels[n]) : null,
        ].filter(Boolean),
      );
      likert.appendChild(btn);
    }
    card.appendChild(likert);
    return card;
  }

  function renderTeamResponses(user, org, p) {
    const byUser = (org.responses || {})[org.currentRoundId] || {};
    const users = Object.keys(byUser);
    if (users.length <= 1) return null;

    const panel = h("div", { class: "card", style: "margin-top:16px;" });
    panel.appendChild(
      h("h3", { style: "margin-top:0;" }, `Team responses (${users.length} respondents)`),
    );

    p.diagnostics.forEach((q, idx) => {
      const meta = questionMeta(q);
      const row = h("div", { style: "padding: 10px 0; border-top: 1px solid var(--line);" });
      row.appendChild(
        h(
          "div",
          { style: "font-size:13px; font-weight:500; margin-bottom:6px;" },
          `Q${idx + 1}. ${meta.text}`,
        ),
      );
      const scores = h("div", { style: "display:flex; flex-wrap:wrap; gap:6px;" });
      users.forEach((uid) => {
        const u = findUser(uid);
        const r = ((byUser[uid] || {})[p.id] || {})[idx];
        const score = r?.score;
        const pill = h(
          "span",
          {
            title:
              (u?.name || u?.email || "respondent") +
              (score ? ` - ${score}/${meta.scale}` : " - no answer"),
            style: `display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:999px; background:var(--surface-muted); border:1px solid var(--line); font-size:11px; color:var(--ink-2);`,
          },
          [
            h(
              "span",
              {
                class: "avatar",
                style: "width:16px; height:16px; font-size:8px;",
              },
              initials(u?.name || u?.email || ""),
            ),
            score ? `${score}/${meta.scale}` : "—",
          ],
        );
        scores.appendChild(pill);
      });
      row.appendChild(scores);
      panel.appendChild(row);
    });
    return panel;
  }

  function renderScoreBlock(org, p) {
    const s = pillarScore(org, p.id);
    const status = pillarStatus(s);
    const { done, total } = answerSummaryForPillar(org, p.id);
    const block = h("div", { class: "side-panel score-block" }, [
      h("div", {}, [
        h("span", { class: "big" }, s !== null ? String(s) : "—"),
        h("span", { class: "out" }, " / 100"),
      ]),
      h(
        "div",
        { class: "bar" },
        h("span", { style: `width:${s ?? 0}%; background:${statusColor(status)};` }),
      ),
      h("div", { style: "color: var(--ink-3); font-size:12px;" }, `${done}/${total} team answers`),
    ]);
    return block;
  }

  function statusColor(status) {
    return {
      red: "var(--red)",
      amber: "var(--amber)",
      green: "var(--green)",
      gray: "var(--line-2)",
    }[status];
  }

  function sidePanel(title, items, internal = false) {
    return h("div", { class: "side-panel" }, [
      internal ? h("span", { class: "internal-badge" }, "Internal only") : null,
      h("h3", { style: "margin-top:0;" }, title),
      h(
        "ul",
        {},
        items.map((x) => h("li", {}, x)),
      ),
    ]);
  }

  function setResponse(user, org, pillarId, idx, patch) {
    const o = loadOrg(org.id);
    o.responses = o.responses || {};
    o.responses[o.currentRoundId] = o.responses[o.currentRoundId] || {};
    o.responses[o.currentRoundId][user.id] = o.responses[o.currentRoundId][user.id] || {};
    o.responses[o.currentRoundId][user.id][pillarId] =
      o.responses[o.currentRoundId][user.id][pillarId] || {};
    const cur = o.responses[o.currentRoundId][user.id][pillarId][idx] || {};
    o.responses[o.currentRoundId][user.id][pillarId][idx] = Object.assign({}, cur, patch);
    saveOrg(o);
  }

  // ================================================================
  // COMMENTS (Slack-style)
  // ================================================================
  // eslint-disable-next-line no-unused-vars -- Phase 4: remove dead code or wire up call site. See runbooks/phase-4-cleanup-ledger.md
  function renderComments(user, org, p) {
    const wrap = h("div", { class: "comments" });
    const list = commentsFor(org, p.id, user);
    const lastRead = ((org.readStates || {})[user.id] || {})[p.id];
    const lastReadT = lastRead ? new Date(lastRead).getTime() : 0;

    wrap.appendChild(
      h("h3", {}, [
        h("span", {}, `Discussion (${list.length})`),
        list.length
          ? h(
              "span",
              { style: "font-weight:400; font-size:12px; color:var(--ink-3);" },
              "Most recent first",
            )
          : null,
      ]),
    );

    const listEl = h("div", { class: "comment-list" });
    if (list.length === 0) {
      listEl.appendChild(
        h(
          "p",
          { style: "color: var(--ink-3); font-size:13px; margin:0;" },
          "No comments yet. Ask a question or leave a note — BeDeveloped and the team will see it here.",
        ),
      );
    } else {
      list
        .slice()
        .reverse()
        .forEach((c) => {
          const author = findUser(c.authorId);
          const isSelf = c.authorId === user.id;
          const isNew = !isSelf && new Date(c.createdAt).getTime() > lastReadT;
          const row = h("div", { class: "comment" + (isNew ? " unread" : "") });
          row.appendChild(
            h(
              "span",
              { class: "avatar" + (author?.role === "internal" ? " internal" : "") },
              initials(author?.name || author?.email || "?"),
            ),
          );
          const body = h("div");
          body.appendChild(
            h("div", { class: "head" }, [
              h("span", { class: "name" }, author?.name || author?.email || "Unknown"),
              h("span", { class: "when" }, formatWhen(c.createdAt)),
              c.internal ? h("span", { class: "tag-internal" }, "Internal") : null,
            ]),
          );
          body.appendChild(h("div", { class: "body" }, c.text));
          row.appendChild(body);
          listEl.appendChild(row);
        });
    }
    wrap.appendChild(listEl);

    // Composer
    const composer = h("div", { class: "comment-composer" });
    const ta = h("textarea", {
      placeholder: isClientView(user)
        ? "Ask a question or leave a comment for the BeDeveloped team…"
        : "Reply to the client, or leave a note for your team…",
    });
    const optsCol = h("div", { class: "opts" });
    let internalOnly = false;
    if (!isClientView(user)) {
      const lbl = h("label", {}, [
        h("input", {
          type: "checkbox",
          onchange: (e) => (internalOnly = e.target.checked),
        }),
        h("span", {}, "Internal only"),
      ]);
      optsCol.appendChild(lbl);
    }
    const post = h(
      "button",
      {
        class: "btn",
        onclick: () => {
          const text = ta.value.trim();
          if (!text) return;
          const o = loadOrg(org.id);
          addComment(o, p.id, user.id, text, internalOnly);
          ta.value = "";
          render();
        },
      },
      "Post",
    );
    optsCol.appendChild(post);

    composer.appendChild(ta);
    composer.appendChild(optsCol);
    wrap.appendChild(composer);
    return wrap;
  }

  // ================================================================
  // ACTIONS
  // ================================================================
  function addAction(createdBy, pillarId, title, { owner = "", due = "", internal = false } = {}) {
    const user = currentUser();
    const orgMeta = activeOrgForUser(user);
    if (!orgMeta) return;
    const o = loadOrg(orgMeta.id);
    o.actions = o.actions || [];
    o.actions.unshift({
      id: uid("act_"),
      pillarId,
      title,
      owner,
      due,
      done: false,
      internal,
      createdAt: iso(),
      createdBy,
    });
    saveOrg(o);
  }
  function updateAction(id, patch) {
    const user = currentUser();
    const orgMeta = activeOrgForUser(user);
    const o = loadOrg(orgMeta.id);
    o.actions = (o.actions || []).map((a) => (a.id === id ? Object.assign({}, a, patch) : a));
    saveOrg(o);
  }
  function deleteAction(id) {
    const user = currentUser();
    const orgMeta = activeOrgForUser(user);
    const o = loadOrg(orgMeta.id);
    o.actions = (o.actions || []).filter((a) => a.id !== id);
    saveOrg(o);
  }

  function renderActions(user, org) {
    const isClient = isClientView(user);
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Action plan"));
    frag.appendChild(
      h(
        "p",
        { class: "view-sub" },
        "Cross-pillar action tracker. Assign owners, set due dates, mark complete.",
      ),
    );

    const all = (org.actions || []).filter((a) => !isClient || !a.internal);
    const toolbar = h(
      "div",
      {
        style:
          "display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;",
      },
      [
        h("div", {}, `${all.length} total · ${all.filter((a) => a.done).length} complete`),
        h("button", { class: "btn", onclick: () => openActionModal(user) }, "+ New action"),
      ],
    );
    frag.appendChild(toolbar);

    if (!all.length) {
      frag.appendChild(
        h(
          "div",
          { class: "empty" },
          "No actions yet. Add one from here or from any pillar detail page.",
        ),
      );
      return frag;
    }

    const openActions = all.filter((a) => !a.done);
    const completedActions = all.filter((a) => a.done);
    const headerRow = () =>
      h("div", { class: "action-row" }, [
        h("div", {}, "✓"),
        h("div", {}, "Action"),
        h("div", {}, "Pillar"),
        h("div", {}, "Owner"),
        h("div", {}, "Due"),
        h("div", {}, ""),
      ]);

    // Open actions
    const openTable = h("div", { class: "actions-table" });
    openTable.appendChild(headerRow());
    if (openActions.length === 0) {
      openTable.appendChild(
        h(
          "div",
          {
            style: "padding:14px 16px; color: var(--ink-3); font-size:13px;",
          },
          "No open actions.",
        ),
      );
    } else {
      openActions.forEach((a) => openTable.appendChild(renderActionRow(a)));
    }
    frag.appendChild(openTable);

    // Completed actions, in their own section
    if (completedActions.length) {
      frag.appendChild(
        h(
          "h2",
          {
            style: "margin-top:28px; margin-bottom:10px;",
          },
          `Completed (${completedActions.length})`,
        ),
      );
      const doneTable = h("div", { class: "actions-table" });
      doneTable.appendChild(headerRow());
      completedActions.forEach((a) => doneTable.appendChild(renderActionRow(a)));
      frag.appendChild(doneTable);
    }

    return frag;
  }

  function renderActionRow(a) {
    const p = DATA.pillars.find((x) => x.id === a.pillarId);
    const todayIso = new Date().toISOString().slice(0, 10);
    const isOverdue = !a.done && !!a.due && a.due < todayIso;
    const row = h("div", {
      class: `action-row ${a.done ? "done" : ""} ${isOverdue ? "overdue" : ""}`,
    });

    const chk = h("input", { type: "checkbox" });
    chk.checked = !!a.done;
    chk.addEventListener("change", () => {
      updateAction(a.id, { done: chk.checked });
      render();
    });
    row.appendChild(chk);

    const title = h("input", { type: "text", class: "a-title", value: a.title });
    title.addEventListener("blur", () => updateAction(a.id, { title: title.value }));
    row.appendChild(title);

    row.appendChild(
      h("div", {}, [
        h(
          "a",
          {
            href: "#",
            onclick: (e) => {
              e.preventDefault();
              setRoute("pillar:" + a.pillarId);
            },
          },
          p ? p.name : "—",
        ),
      ]),
    );

    const owner = h("input", {
      type: "text",
      class: "a-owner",
      placeholder: "Owner",
      value: a.owner || "",
    });
    owner.addEventListener("blur", () => updateAction(a.id, { owner: owner.value }));
    row.appendChild(owner);

    const dueWrap = h("div", { style: "display:flex; align-items:center; gap:6px;" });
    const due = h("input", { type: "date", class: "a-due", value: a.due || "" });
    due.addEventListener("change", () => updateAction(a.id, { due: due.value }));
    dueWrap.appendChild(due);
    if (isOverdue)
      dueWrap.appendChild(
        h("span", { class: "overdue-tag", title: "Due date has passed" }, "Overdue"),
      );
    row.appendChild(dueWrap);

    const del = h(
      "button",
      {
        class: "btn ghost sm",
        style: "border-color: var(--line);",
        onclick: () =>
          confirmDialog(
            "Delete action?",
            "This cannot be undone.",
            () => {
              deleteAction(a.id);
              render();
            },
            "Delete",
          ),
      },
      "×",
    );
    row.appendChild(del);
    return row;
  }

  function openActionModal(user) {
    const title = h("input", { type: "text", placeholder: "Action description" });
    const select = h("select", {
      style:
        "width:100%; padding:10px; border:1px solid var(--line); border-radius:8px; font:inherit;",
    });
    DATA.pillars.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = `${p.id}. ${p.name}`;
      select.appendChild(o);
    });
    const internalWrap = !isClientView(user)
      ? h(
          "label",
          { style: "display:flex; gap:6px; align-items:center; font-size:13px; margin-top:10px;" },
          [
            h("input", { type: "checkbox", id: "actInternal" }),
            "Internal only (hidden from client view)",
          ],
        )
      : null;

    const m = modal([
      h("h3", {}, "New action"),
      title,
      h("div", { style: "height:10px;" }),
      select,
      internalWrap,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              const t = title.value.trim();
              if (!t) return;
              const internal = internalWrap ? internalWrap.querySelector("input").checked : false;
              addAction(user.id, Number(select.value), t, { internal });
              m.close();
              render();
            },
          },
          "Add",
        ),
      ]),
    ]);
    setTimeout(() => title.focus(), 10);
  }

  // ================================================================
  // ENGAGEMENT
  // ================================================================
  function renderEngagement(user, org) {
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Delivery framework"));
    frag.appendChild(
      h(
        "p",
        { class: "view-sub" },
        "Every BeDeveloped engagement runs through four stages. Track progress and readiness to move on.",
      ),
    );

    const current = org.engagement?.currentStageId || "diagnosed";
    const stages = h("div", { class: "stages" });
    const readOnly = isClientView(user);
    DATA.engagementStages.forEach((s, i) => {
      const checks = (org.engagement?.stageChecks || {})[s.id] || {};
      const checkedCount = s.checklist.filter((_, idx) => checks[idx]).length;
      const pct = Math.round((checkedCount / s.checklist.length) * 100);
      const isActive = current === s.id;

      const cardAttrs = {
        class: `stage-card ${isActive ? "active" : ""} ${readOnly ? "read-only" : ""}`,
      };
      if (!readOnly) {
        cardAttrs.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setEngagementStage(org.id, s.id);
          render();
        };
      }
      const card = h("div", cardAttrs, [
        h("div", { class: "n" }, `STAGE ${i + 1}`),
        h("div", { class: "name" }, s.name),
        h("div", { class: "sum" }, s.summary),
        h("div", { class: "progress" }, h("span", { style: `width:${pct}%;` })),
        h(
          "div",
          { style: "font-size:11px; color:var(--ink-3); margin-top:4px;" },
          `${checkedCount}/${s.checklist.length} complete`,
        ),
      ]);
      stages.appendChild(card);
    });
    frag.appendChild(stages);

    const stage = DATA.engagementStages.find((s) => s.id === current);
    const checklist = h("div", { class: "checklist" });
    checklist.appendChild(h("h3", { style: "margin-top:0;" }, `${stage.name} — checklist`));
    stage.checklist.forEach((item, idx) => {
      const done = !!((org.engagement?.stageChecks || {})[current] || {})[idx];
      const row = h("div", { class: `check-item ${done ? "done" : ""}` });
      const cb = h("input", { type: "checkbox", id: `chk-${current}-${idx}` });
      cb.checked = done;
      cb.disabled = isClientView(user);
      cb.addEventListener("change", () => {
        toggleStageCheck(org.id, current, idx, cb.checked);
        render();
      });
      row.appendChild(cb);
      row.appendChild(h("label", { for: `chk-${current}-${idx}` }, item));
      checklist.appendChild(row);
    });
    frag.appendChild(checklist);
    return frag;
  }

  function setEngagementStage(orgId, stageId) {
    const o = loadOrg(orgId);
    o.engagement = o.engagement || { stageChecks: {} };
    o.engagement.currentStageId = stageId;
    saveOrg(o);
  }
  function toggleStageCheck(orgId, stageId, idx, val) {
    const o = loadOrg(orgId);
    o.engagement = o.engagement || { stageChecks: {} };
    o.engagement.stageChecks = o.engagement.stageChecks || {};
    o.engagement.stageChecks[stageId] = o.engagement.stageChecks[stageId] || {};
    o.engagement.stageChecks[stageId][idx] = val;
    saveOrg(o);
  }

  // ================================================================
  // REPORT
  // ================================================================
  // Phase 2 (D-05): bandLabel, bandStatement, bandColor extracted to src/domain/banding.js — re-imported at module top.

  function renderReport(user, org) {
    const frag = h("div");
    const summary = orgSummary(org);
    const constraints = topConstraints(org, 3);
    // eslint-disable-next-line no-unused-vars -- Phase 4: remove dead binding or wire up render. See runbooks/phase-4-cleanup-ledger.md
    const stage = DATA.engagementStages.find(
      (s) => s.id === (org.engagement?.currentStageId || "diagnosed"),
    );
    const isClient = isClientView(user);
    const round = roundById(org, org.currentRoundId);
    const prevRoundId = previousRoundId(org);

    frag.appendChild(
      h(
        "div",
        { class: "report-toolbar" },
        [
          h(
            "button",
            { class: "btn secondary", onclick: () => window.print() },
            "Print / save PDF",
          ),
          !isClient
            ? h(
                "button",
                {
                  class: "btn secondary",
                  title:
                    "Full backup of all orgs, users and responses. Internal only - not a client report.",
                  onclick: exportData,
                },
                "Export backup (JSON)",
              )
            : null,
        ].filter(Boolean),
      ),
    );

    const r = h("div", { class: "report" });
    r.appendChild(h("h1", {}, `The Base Layers diagnostic - ${org.name}`));
    r.appendChild(
      h(
        "div",
        { class: "sub" },
        `${isClient ? "Client view" : "Internal view"} · ${round?.label || "Current round"} · Generated ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`,
      ),
    );

    // Intro block
    const intro = h("div", { class: "report-intro card", style: "margin:18px 0 24px;" });
    intro.appendChild(
      h(
        "h2",
        { style: "margin-top:0;" },
        "Thank you for participating in The Base Layers Sales Assessment.",
      ),
    );
    intro.appendChild(
      h(
        "p",
        {},
        "Your results will provide valuable insights into your current business development processes and help you streamline your operations.",
      ),
    );
    intro.appendChild(
      h(
        "p",
        {},
        "We have assessed your performance from The Base Layers sales framework that covers 10 core strategic pillars:",
      ),
    );
    const pillarList = h("ol", { style: "font-size:14px; color:var(--ink-2);" });
    DATA.pillars.forEach((p) => {
      pillarList.appendChild(h("li", {}, p.name));
    });
    intro.appendChild(pillarList);
    intro.appendChild(
      h(
        "p",
        {},
        "Below, you will find a snapshot of your results. We encourage you to read through your development areas and capture any questions you have for Luke & George to improve your business development strategy.",
      ),
    );
    intro.appendChild(
      h(
        "p",
        {},
        "This assessment will be a guide to start improving your early-stage sales process, by embedding a fully structured implementation roadmap.",
      ),
    );
    r.appendChild(intro);

    // Snapshot grid: donut + key metrics side-by-side
    const snap = h("div", { class: "report-snapshot" });

    const chartCard = h("div", { class: "card", style: "min-height:320px;" });
    chartCard.appendChild(h("h3", { style: "margin-top:0;" }, "Results at a glance"));
    chartCard.appendChild(
      h(
        "p",
        { style: "color:var(--ink-3); font-size:12.5px; margin:-4px 0 10px;" },
        "Each slice is one pillar. Colours show where you're strong (green), developing (amber), or need focus (red).",
      ),
    );
    const canvasWrap = h("div", { style: "position:relative; height:240px;" });
    const canvas = h("canvas", { id: "reportDonut" });
    canvasWrap.appendChild(canvas);
    chartCard.appendChild(canvasWrap);
    snap.appendChild(chartCard);

    const metricsCard = h("div", { class: "card" });
    metricsCard.appendChild(h("h3", { style: "margin-top:0;" }, "Summary"));
    [
      ["Overall health", summary.avg !== null ? `${summary.avg} / 100` : "Not yet scored"],
      ["Pillars scored", `${summary.scoredCount} of ${DATA.pillars.length}`],
      [
        "Status mix",
        `${summary.green} green · ${summary.amber} amber · ${summary.red} red · ${summary.gray} not scored`,
      ],
      ["Respondents", String(respondentsForRound(org, org.currentRoundId).length)],
    ].forEach(([label, val]) => metricsCard.appendChild(reportRow(label, val)));
    if (constraints.length) {
      metricsCard.appendChild(
        reportRow(
          "Top constraints",
          h(
            "div",
            { style: "display:flex; flex-direction:column; gap:4px;" },
            constraints.map((p, i) =>
              h("div", {}, `${i + 1}. ${p.name} (${pillarScore(org, p.id)}/100)`),
            ),
          ),
        ),
      );
    }
    snap.appendChild(metricsCard);
    r.appendChild(snap);

    // Draw donut once DOM is attached
    queueMicrotask(() => drawReportDonut(org));

    // Pillar detail
    const rp = h("div", { class: "r-pillars" });
    rp.appendChild(h("h2", { style: "margin-top:28px;" }, "Pillar detail"));
    DATA.pillars.forEach((p) => {
      const s = pillarScore(org, p.id);
      const prevS = prevRoundId ? pillarScoreForRound(org, prevRoundId, p.id) : null;
      const status = pillarStatus(s);
      const { done, total } = answerSummaryForPillar(org, p.id);
      const band = bandLabel(s);

      const block = h("div", { class: "r-pillar" });
      const header = h("header", {}, [
        h("span", { class: "name" }, `${p.id}. ${p.name}`),
        h("span", { class: "meta" }, [
          h(
            "span",
            {
              style: `display:inline-block; padding:2px 10px; border-radius:999px; background:${bandColor(s)}; color:#fff; font-weight:600; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; margin-right:8px;`,
            },
            band,
          ),
          s !== null ? `${s}/100` : "—",
          prevS !== null ? ` (was ${prevS})` : "",
          " · ",
          h("span", { class: `badge ${status}` }, statusLabel(status, done, total)),
        ]),
      ]);
      block.appendChild(header);

      // Richer pillar definition
      block.appendChild(h("p", { class: "r-def" }, p.dashDescription || p.overview || p.tagline));
      if (p.dashAchieve) {
        block.appendChild(
          h("p", { class: "r-achieve" }, [
            h("strong", {}, "What good looks like: "),
            p.dashAchieve,
          ]),
        );
      }

      // Score band statement
      block.appendChild(
        h(
          "div",
          {
            class: "r-band",
            style: `border-left:3px solid ${bandColor(s)}; padding:10px 12px; background:var(--surface-muted); margin-top:10px; font-size:13.5px;`,
          },
          bandStatement(p.name, s),
        ),
      );

      const actions = (org.actions || []).filter(
        (a) => a.pillarId === p.id && (!isClient || !a.internal),
      );
      if (actions.length) {
        block.appendChild(
          h(
            "div",
            {
              style:
                "margin-top:10px; font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-3);",
            },
            "Actions",
          ),
        );
        const ul = h("ul", { style: "margin:4px 0 0; padding-left:18px; font-size:13px;" });
        actions.forEach((a) =>
          ul.appendChild(
            h(
              "li",
              {
                style: a.done ? "text-decoration:line-through; color:var(--ink-4);" : "",
              },
              [a.title, a.owner ? ` · ${a.owner}` : "", a.due ? ` · due ${a.due}` : ""],
            ),
          ),
        );
        block.appendChild(ul);
      }
      rp.appendChild(block);
    });
    r.appendChild(rp);
    frag.appendChild(r);
    return frag;
  }

  function drawReportDonut(org) {
    if (!window.Chart) {
      setTimeout(() => drawReportDonut(org), 120);
      return;
    }
    const canvas = $("#reportDonut");
    if (!canvas) return;
    if (state.reportChart) {
      try {
        state.reportChart.destroy();
        // eslint-disable-next-line no-empty -- Phase 4: replace with explicit ignore + comment. See runbooks/phase-4-cleanup-ledger.md
      } catch {}
    }

    const labels = [];
    const data = [];
    const colors = [];
    const statusPalette = {
      red: "#C0392B",
      amber: "#D98E00",
      green: "#2F8A4F",
      gray: "#CFD3D8",
    };
    DATA.pillars.forEach((p) => {
      const s = pillarScore(org, p.id);
      labels.push(`${p.id}. ${p.shortName || p.name}`);
      data.push(10); // equal slices
      colors.push(statusPalette[pillarStatus(s)] || statusPalette.gray);
    });

    state.reportChart = new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderColor: "#fff", borderWidth: 2 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "58%",
        plugins: {
          legend: { position: "right", labels: { font: { size: 11 }, boxWidth: 12 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const p = DATA.pillars[ctx.dataIndex];
                const s = pillarScore(org, p.id);
                return `${p.name}: ${s !== null ? s + "/100 (" + bandLabel(s) + ")" : "Not scored"}`;
              },
            },
          },
        },
      },
    });
  }

  function reportRow(label, value) {
    return h("div", { class: "row" }, [h("div", { class: "label" }, label), h("div", {}, value)]);
  }

  // ================================================================
  // ADMIN (internal only)
  // ================================================================
  function renderAdmin(user) {
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Admin"));
    frag.appendChild(
      h(
        "p",
        { class: "view-sub" },
        "Manage organisations and client accounts. Client accounts see only their own organisation.",
      ),
    );

    // Organisations
    frag.appendChild(h("h2", {}, "Organisations"));
    const orgs = loadOrgMetas();
    const orgCard = h("div", { class: "card" });

    const orgBar = h(
      "div",
      { style: "display:flex; justify-content:flex-end; margin-bottom:12px;" },
      [
        h(
          "button",
          {
            class: "btn",
            onclick: () =>
              promptText("New organisation", "e.g. Acme Ltd", (name) => {
                const o = createOrg(name);
                state.orgId = o.id;
                render();
              }),
          },
          "+ New organisation",
        ),
      ],
    );
    orgCard.appendChild(orgBar);

    if (!orgs.length) {
      orgCard.appendChild(h("p", { style: "color: var(--ink-3);" }, "None yet."));
    } else {
      const table = h("div");
      orgs.forEach((m) => {
        const o = loadOrg(m.id);
        const clients = loadUsers().filter((u) => u.role === "client" && u.orgId === m.id);
        const currentTier = orgTier(o);
        const row = h("div", {
          style:
            "display:grid; grid-template-columns: 1.5fr 1fr 1fr auto; gap:12px; align-items:center; padding:12px 0; border-top:1px solid var(--line);",
        });
        row.appendChild(
          h("div", {}, [
            h("div", { style: "display:flex; align-items:center; gap:8px;" }, [
              h("span", { style: "font-weight:600;" }, m.name),
              h(
                "span",
                {
                  style: `display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px; font-size:10.5px; font-weight:600; letter-spacing:0.06em; text-transform:uppercase; background: ${currentTier === "performance" ? "var(--ink)" : "var(--brand-tint)"}; color: ${currentTier === "performance" ? "#fff" : "var(--brand)"};`,
                },
                currentTier === "performance" ? "Performance" : "Transformation",
              ),
            ]),
            h(
              "div",
              { style: "color:var(--ink-3); font-size:12px; margin-top:4px;" },
              `${o?.rounds?.length || 0} round(s) · ${respondentsForRound(o, o.currentRoundId).length} respondents`,
            ),
          ]),
        );
        const hasPass = !!(o && o.clientPassphraseHash);
        row.appendChild(
          h("div", {}, [
            h("div", {}, `${clients.length} client user${clients.length === 1 ? "" : "s"}`),
            h(
              "div",
              {
                style: `font-size:11px; margin-top:2px; color: ${hasPass ? "var(--green)" : "var(--amber)"};`,
              },
              hasPass ? "✓ passphrase set" : "⚠ no passphrase",
            ),
          ]),
        );
        row.appendChild(h("div", {}, formatDate(o?.createdAt)));
        const tierSelect = h("select", {
          title:
            "Tier determines roadmap cadence. Performance = 4 quarters. Transformation = 12 months.",
          style:
            "padding:5px 8px; border:1px solid var(--line); border-radius:6px; font:inherit; font-size:12px; background:#fff; cursor:pointer;",
        });
        ["performance", "transformation"].forEach((v) => {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = v === "performance" ? "Performance" : "Transformation";
          if (v === currentTier) opt.selected = true;
          tierSelect.appendChild(opt);
        });
        tierSelect.addEventListener("change", () => {
          const fresh = loadOrg(m.id);
          if (!fresh) return;
          fresh.tier = tierSelect.value;
          saveOrg(fresh);
          render();
        });
        row.appendChild(
          h("div", { style: "display:flex; gap:6px; align-items:center;" }, [
            tierSelect,
            h(
              "button",
              {
                class: "btn secondary sm",
                onclick: () => {
                  state.orgId = m.id;
                  setRoute("dashboard");
                },
              },
              "Open",
            ),
            h(
              "button",
              {
                class: "btn ghost sm",
                onclick: () => openSetOrgPassphrase(m.id, m.name),
              },
              hasPass ? "Change passphrase" : "Set passphrase",
            ),
            h(
              "button",
              {
                class: "btn ghost sm danger",
                onclick: () =>
                  confirmDialog(
                    "Delete organisation?",
                    `This deletes ${m.name}, all its diagnostic data, and any client accounts linked to it. Cannot be undone.`,
                    () => {
                      deleteOrg(m.id);
                      render();
                    },
                    "Delete",
                  ),
              },
              "Delete",
            ),
          ]),
        );
        table.appendChild(row);
      });
      orgCard.appendChild(table);
    }
    frag.appendChild(orgCard);

    // Client users
    frag.appendChild(h("h2", {}, "Client accounts"));
    const allClients = loadUsers().filter((u) => u.role === "client");
    const usersCard = h("div", { class: "card" });

    const userBar = h(
      "div",
      { style: "display:flex; justify-content:flex-end; margin-bottom:12px;" },
      [
        h(
          "button",
          {
            class: "btn",
            onclick: () => openInviteClientModal(),
          },
          "+ Invite client",
        ),
      ],
    );
    usersCard.appendChild(userBar);

    if (!allClients.length) {
      usersCard.appendChild(
        h(
          "p",
          { style: "color: var(--ink-3);" },
          "No client users yet. Invite someone to let them log in.",
        ),
      );
    } else {
      const table = h("div");
      table.appendChild(
        h(
          "div",
          {
            style:
              "display:grid; grid-template-columns: 1fr 1.5fr 1fr auto; gap:12px; padding:8px 0; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-3);",
          },
          [
            h("div", {}, "Name"),
            h("div", {}, "Email"),
            h("div", {}, "Organisation"),
            h("div", {}, ""),
          ],
        ),
      );
      allClients.forEach((u) => {
        const o = u.orgId ? loadOrgMetas().find((m) => m.id === u.orgId) : null;
        const row = h("div", {
          style:
            "display:grid; grid-template-columns: 1fr 1.5fr 1fr auto; gap:12px; align-items:center; padding:10px 0; border-top:1px solid var(--line); font-size:13.5px;",
        });
        row.appendChild(h("div", {}, u.name || "—"));
        row.appendChild(
          h("div", {}, [
            h("div", {}, u.email),
            h(
              "div",
              {
                style: `font-size:11px; margin-top:2px; color: ${u.passwordHash ? "var(--green)" : "var(--ink-3)"};`,
              },
              u.passwordHash ? "password set" : "awaiting first sign-in",
            ),
          ]),
        );
        row.appendChild(h("div", {}, o ? o.name : "— (unassigned)"));
        row.appendChild(
          h(
            "div",
            { style: "display:flex; gap:6px;" },
            [
              u.passwordHash
                ? h(
                    "button",
                    {
                      class: "btn ghost sm",
                      onclick: () =>
                        confirmDialog(
                          "Reset password?",
                          `${u.email} will be asked to set a new password the next time they sign in.`,
                          () => {
                            const fresh = findUser(u.id);
                            if (fresh) {
                              delete fresh.passwordHash;
                              upsertUser(fresh);
                              render();
                            }
                          },
                          "Reset",
                        ),
                    },
                    "Reset password",
                  )
                : null,
              h(
                "button",
                {
                  class: "btn ghost sm danger",
                  onclick: () =>
                    confirmDialog(
                      "Remove client access?",
                      `${u.email} will no longer be able to sign in. Their responses from past rounds will remain in the data.`,
                      () => {
                        deleteUser(u.id);
                        render();
                      },
                      "Remove",
                    ),
                },
                "Remove",
              ),
            ].filter(Boolean),
          ),
        );
        table.appendChild(row);
      });
      usersCard.appendChild(table);
    }
    frag.appendChild(usersCard);

    // Internal team
    frag.appendChild(h("h2", {}, "Internal team"));
    const internals = loadUsers().filter((u) => u.role === "internal");
    const intCard = h("div", { class: "card" });
    if (!internals.length) {
      intCard.appendChild(h("p", { style: "color: var(--ink-3);" }, "None."));
    } else {
      internals.forEach((u) => {
        intCard.appendChild(
          h(
            "div",
            {
              style:
                "display:flex; gap:12px; align-items:center; padding:10px 0; border-top:1px solid var(--line); font-size:13.5px;",
            },
            [
              h("span", { class: "avatar internal" }, initials(u.name || u.email)),
              h("div", { style: "flex:1;" }, [
                h("div", { style: "font-weight:600;" }, u.name || u.email),
                h("div", { style: "color:var(--ink-3); font-size:12px;" }, u.email),
              ]),
              u.id !== user.id
                ? h(
                    "button",
                    {
                      class: "btn ghost sm danger",
                      onclick: () =>
                        confirmDialog(
                          "Remove team member?",
                          `${u.email} will no longer be able to sign in with internal access.`,
                          () => {
                            deleteUser(u.id);
                            render();
                          },
                          "Remove",
                        ),
                    },
                    "Remove",
                  )
                : h("span", { style: "font-size:11px; color:var(--ink-3);" }, "you"),
            ],
          ),
        );
      });
    }
    frag.appendChild(intCard);

    // Settings
    frag.appendChild(h("h2", {}, "Settings"));
    const settingsCard = h("div", { class: "card" });
    settingsCard.appendChild(
      h(
        "p",
        { style: "color:var(--ink-2); font-size:13px; margin-top:0;" },
        "Internal sign-in is restricted to a fixed allowlist of emails with a shared team password, configured in the app source. To add a team member or rotate the password, edit the repo.",
      ),
    );
    settingsCard.appendChild(
      h(
        "div",
        { style: "font-size:12.5px; color:var(--ink-3);" },
        "Allowed emails: " + INTERNAL_ALLOWED_EMAILS.join(", "),
      ),
    );
    frag.appendChild(settingsCard);

    return frag;
  }

  // ================================================================
  // CLOUD SYNC (Firestore) - keep orgs and users synced across devices
  // localStorage is the working cache; Firestore is the source of truth
  // across devices. Pushes are debounced; pulls happen once on app boot.
  // ================================================================
  function fbReady() {
    return !!(window.FB && window.FB.currentUser);
  }

  const cloudSaveTimers = {};
  function cloudPushOrg(org) {
    if (!fbReady() || !org || !org.id) return;
    clearTimeout(cloudSaveTimers["org:" + org.id]);
    cloudSaveTimers["org:" + org.id] = setTimeout(async () => {
      try {
        const { db, firestore } = window.FB;
        await firestore.setDoc(firestore.doc(db, "orgs", org.id), org);
      } catch (e) {
        console.error("Cloud push org failed:", e);
      }
    }, 400);
  }

  function cloudPushUser(user) {
    if (!fbReady() || !user || !user.id) return;
    clearTimeout(cloudSaveTimers["user:" + user.id]);
    cloudSaveTimers["user:" + user.id] = setTimeout(async () => {
      try {
        const { db, firestore } = window.FB;
        await firestore.setDoc(firestore.doc(db, "users", user.id), user);
      } catch (e) {
        console.error("Cloud push user failed:", e);
      }
    }, 400);
  }

  async function cloudDeleteOrg(orgId) {
    if (!fbReady() || !orgId) return;
    try {
      const { db, firestore } = window.FB;
      await firestore.deleteDoc(firestore.doc(db, "orgs", orgId));
    } catch (e) {
      console.error("Cloud delete org failed:", e);
    }
  }

  async function cloudDeleteUser(userId) {
    if (!fbReady() || !userId) return;
    try {
      const { db, firestore } = window.FB;
      await firestore.deleteDoc(firestore.doc(db, "users", userId));
    } catch (e) {
      console.error("Cloud delete user failed:", e);
    }
  }

  async function cloudFetchAllOrgs() {
    if (!fbReady()) return null;
    try {
      const { db, firestore } = window.FB;
      const snap = await firestore.getDocs(firestore.collection(db, "orgs"));
      return snap.docs.map((d) => d.data());
    } catch (e) {
      console.error("Cloud fetch orgs failed:", e);
      return null;
    }
  }

  async function cloudFetchAllUsers() {
    if (!fbReady()) return null;
    try {
      const { db, firestore } = window.FB;
      const snap = await firestore.getDocs(firestore.collection(db, "users"));
      return snap.docs.map((d) => d.data());
    } catch (e) {
      console.error("Cloud fetch users failed:", e);
      return null;
    }
  }

  // Phase 2 (D-05): syncFromCloud extracted to src/data/cloud-sync.js — wrapper above.
  // Pitfall 20 / H8 entanglement preserved as REGRESSION BASELINE in tests/data/cloud-sync.test.js.

  // ================================================================
  // DOCUMENTS (Firebase Storage + Firestore)
  // ================================================================

  function formatBytes(b) {
    if (b == null) return "";
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + " MB";
    return (b / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  function renderDocuments(user, org) {
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Documents"));
    frag.appendChild(
      h(
        "p",
        { class: "view-sub" },
        org
          ? `Shared with ${org.name}. Everyone in this organisation can see documents unless marked private.`
          : "Select an organisation to see its documents.",
      ),
    );

    if (!org) return frag;

    if (!fbReady()) {
      frag.appendChild(
        h(
          "div",
          { class: "card", style: "padding:32px; text-align:center; color: var(--ink-3);" },
          "Connecting to shared storage…",
        ),
      );
      return frag;
    }

    const { db, storage, firestore, storageOps } = window.FB;

    // Upload card
    const uploadCard = h("div", { class: "card" });
    const fileInput = h("input", { type: "file", style: "display:none;" });
    const privateChk = h("input", { type: "checkbox" });
    const progressBar = h("div", { style: "margin-top:8px; font-size:12px; color:var(--ink-3);" });

    const upload = async (file) => {
      // CODE-09 / D-15 / D-20: validateUpload BEFORE saveDocument trust
      // boundary. Client-side validation (size cap + MIME allowlist + magic-
      // byte sniff + filename sanitisation) for UX feedback + audit-narrative
      // claim. Server-side enforcement is Phase 5 storage.rules + Phase 7
      // callable validation.
      const validation = await validateUpload(file);
      if (!validation.ok) {
        notify("error", validation.reason);
        progressBar.textContent = "";
        return;
      }
      progressBar.textContent = "Uploading " + file.name + "…";
      try {
        const docId = uid("doc_");
        const path = `orgs/${org.id}/documents/${docId}/${validation.sanitisedName}`;
        const r = storageOps.ref(storage, path);
        const task = storageOps.uploadBytesResumable(r, file, { contentType: file.type });
        task.on("state_changed", (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          progressBar.textContent = `Uploading ${file.name}… ${pct}%`;
        });
        await task;
        const url = await storageOps.getDownloadURL(r);
        await firestore.setDoc(firestore.doc(db, "documents", docId), {
          orgId: org.id,
          uploaderId: user.id,
          uploaderName: user.name || user.email,
          uploaderEmail: user.email,
          filename: validation.sanitisedName,
          size: file.size,
          contentType: file.type,
          storagePath: path,
          downloadURL: url,
          visibility: privateChk.checked ? "private" : "org",
          allowedUserIds: privateChk.checked ? [user.id] : [],
          createdAt: firestore.serverTimestamp(),
        });
        progressBar.textContent = `✓ Uploaded ${file.name}`;
        privateChk.checked = false;
      } catch (e) {
        progressBar.textContent = "Upload failed: " + (e.message || e);
      }
    };

    fileInput.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) upload(f);
      e.target.value = "";
    });

    uploadCard.appendChild(
      h("div", { style: "display:flex; gap:12px; align-items:center; flex-wrap:wrap;" }, [
        h("button", { class: "btn", onclick: () => fileInput.click() }, "+ Upload file"),
        fileInput,
        h(
          "label",
          {
            style: "display:flex; align-items:center; gap:6px; font-size:13px; color:var(--ink-2);",
          },
          [privateChk, h("span", {}, "Private (only I can see it)")],
        ),
      ]),
    );
    uploadCard.appendChild(progressBar);
    frag.appendChild(uploadCard);

    // List
    const listCard = h("div", { class: "card", style: "margin-top:16px;" });
    listCard.appendChild(h("h3", { style: "margin-top:0;" }, "Files"));
    const listBody = h("div", {});
    listBody.appendChild(h("p", { style: "color:var(--ink-3);" }, "Loading…"));
    listCard.appendChild(listBody);
    frag.appendChild(listCard);

    const q = firestore.query(
      firestore.collection(db, "documents"),
      firestore.where("orgId", "==", org.id),
    );
    firestore.onSnapshot(
      q,
      (snap) => {
        const docs = [];
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

        const isInternal = user.role === "internal";
        const visible = docs.filter((d) => {
          if (d.visibility !== "private") return true;
          if (isInternal) return true;
          return (d.allowedUserIds || []).includes(user.id);
        });

        // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
        listBody.replaceChildren();
        if (!visible.length) {
          listBody.appendChild(h("p", { style: "color:var(--ink-3);" }, "No files yet."));
          return;
        }
        visible.forEach((d) => {
          const row = h("div", {
            style:
              "display:grid; grid-template-columns: 1.5fr 1fr 1fr auto; gap:12px; align-items:center; padding:10px 0; border-top:1px solid var(--line); font-size:13.5px;",
          });
          row.appendChild(
            h("div", {}, [
              h("div", { style: "font-weight:600;" }, d.filename),
              h(
                "div",
                { style: "font-size:11px; color:var(--ink-3);" },
                formatBytes(d.size) + (d.visibility === "private" ? " · private" : ""),
              ),
            ]),
          );
          row.appendChild(h("div", {}, d.uploaderName || d.uploaderEmail || "—"));
          row.appendChild(h("div", {}, d.createdAt?.toDate?.().toLocaleString?.() || ""));
          const canDelete = isInternal || d.uploaderId === user.id;
          const actions = h(
            "div",
            { style: "display:flex; gap:6px;" },
            [
              h(
                "a",
                {
                  class: "btn secondary sm",
                  href: d.downloadURL,
                  target: "_blank",
                  // CODE-12 (D-20): noreferrer added — opener-phishing mitigation
                  // (CWE-1021). Pairs with target=_blank to prevent the new
                  // tab from accessing window.opener.
                  rel: "noopener noreferrer",
                },
                "Download",
              ),
              canDelete
                ? h(
                    "button",
                    {
                      class: "btn ghost sm danger",
                      onclick: () =>
                        confirmDialog(
                          "Delete file?",
                          `Remove "${d.filename}" for everyone in ${org.name}? This cannot be undone.`,
                          async () => {
                            try {
                              await storageOps.deleteObject(storageOps.ref(storage, d.storagePath));
                              // eslint-disable-next-line no-unused-vars -- Phase 4: replace with central error logger (Phase 9 observability). See runbooks/phase-4-cleanup-ledger.md
                            } catch (e) {
                              /* file may already be gone */
                            }
                            await firestore.deleteDoc(firestore.doc(db, "documents", d.id));
                          },
                          "Delete",
                        ),
                    },
                    "Delete",
                  )
                : null,
            ].filter(Boolean),
          );
          row.appendChild(actions);
          listBody.appendChild(row);
        });
      },
      (err) => {
        // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
        listBody.replaceChildren();
        listBody.appendChild(
          h("p", { style: "color:var(--red);" }, "Couldn't load documents: " + err.message),
        );
      },
    );

    return frag;
  }

  // ================================================================
  // CHAT (Firestore real-time)
  // ================================================================
  function renderChat(user, org) {
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Chat"));
    frag.appendChild(
      h(
        "p",
        { class: "view-sub", style: "margin-bottom:4px;" },
        org
          ? `Team channel for ${org.name}. Everyone in this organisation + BeDeveloped can post and read.`
          : "Select an organisation to open its channel.",
      ),
    );
    if (org) {
      frag.appendChild(
        h(
          "p",
          {
            class: "view-sub",
            style: "margin-top:0; color: var(--ink-3); font-style: italic; font-size: 13px;",
          },
          "The team will aim to respond within 24hrs.",
        ),
      );
    }

    if (!org) return frag;

    // Mark everything up to now as read for this user/org combination.
    markChatReadFor(user.id, org.id);

    if (!fbReady()) {
      frag.appendChild(
        h(
          "div",
          { class: "card", style: "padding:32px; text-align:center; color: var(--ink-3);" },
          "Connecting to chat…",
        ),
      );
      return frag;
    }

    const { db, firestore } = window.FB;

    const card = h("div", {
      class: "card",
      style:
        "padding:0; display:flex; flex-direction:column; height: calc(100vh - 260px); min-height:480px;",
    });

    // Search
    const searchInput = h("input", {
      type: "search",
      placeholder: "Search messages…",
      style:
        "width:100%; padding:10px 14px; border:0; border-bottom:1px solid var(--line); font:inherit; font-size:14px; background:transparent;",
    });
    card.appendChild(searchInput);

    // Message list
    const list = h("div", {
      style:
        "flex:1; overflow-y:auto; padding:16px 20px; display:flex; flex-direction:column; gap:10px;",
    });
    list.appendChild(h("p", { style: "color:var(--ink-3); text-align:center;" }, "Loading…"));
    card.appendChild(list);

    // Composer
    const textInput = h("input", {
      type: "text",
      placeholder: "Type a message…",
      style:
        "flex:1; padding:10px 14px; border:1px solid var(--line-2); border-radius:8px; font:inherit; font-size:14px;",
    });
    const sendBtn = h("button", { class: "btn" }, "Send");

    const composer = h(
      "div",
      {
        style:
          "display:flex; gap:8px; padding:12px 16px; border-top:1px solid var(--line); background:var(--surface-muted);",
      },
      [textInput, sendBtn],
    );
    card.appendChild(composer);
    frag.appendChild(card);

    let allMessages = [];
    const renderList = () => {
      const term = (searchInput.value || "").trim().toLowerCase();
      const filtered = term
        ? allMessages.filter(
            (m) =>
              (m.text || "").toLowerCase().includes(term) ||
              (m.authorName || "").toLowerCase().includes(term),
          )
        : allMessages;
      // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
      list.replaceChildren();
      if (!filtered.length) {
        list.appendChild(
          h(
            "p",
            { style: "color:var(--ink-3); text-align:center;" },
            term ? "No messages match." : "No messages yet — start the conversation.",
          ),
        );
        return;
      }
      filtered.forEach((m) => {
        const isSelf = m.authorId === user.id;
        const isInternalAuthor = m.authorRole === "internal";
        const bg = isInternalAuthor ? "var(--ink)" : "var(--brand)";
        const ts = m.createdAt?.toDate?.().toLocaleString?.() || "";
        const who = firstNameFromAuthor(m);
        const canDelete = isSelf || !isClientView(user);
        const bubble = h(
          "div",
          {
            class: "chat-bubble",
            style: `align-self:${isSelf ? "flex-end" : "flex-start"}; background:${bg}; border-color:${bg};`,
          },
          [
            h("div", { class: "chat-bubble-meta" }, `${who} · ${ts}`),
            h("div", { class: "chat-bubble-text" }, m.text),
          ],
        );
        if (canDelete) {
          const del = h(
            "button",
            {
              class: "chat-bubble-del",
              title: "Delete",
              onclick: (e) => {
                e.stopPropagation();
                confirmDialog(
                  "Delete message?",
                  "This cannot be undone.",
                  async () => {
                    try {
                      await firestore.deleteDoc(firestore.doc(db, "messages", m.id));
                    } catch (err) {
                      notify("error", "Couldn't delete: " + (err.message || err));
                    }
                  },
                  "Delete",
                );
              },
            },
            "×",
          );
          bubble.appendChild(del);
        }
        list.appendChild(bubble);
      });
      list.scrollTop = list.scrollHeight;
    };

    searchInput.addEventListener("input", renderList);

    const send = async () => {
      const text = textInput.value.trim();
      if (!text) return;
      textInput.value = "";
      try {
        await firestore.addDoc(firestore.collection(db, "messages"), {
          orgId: org.id,
          authorId: user.id,
          authorName: user.name || user.email,
          authorEmail: user.email,
          authorRole: user.role,
          text,
          createdAt: firestore.serverTimestamp(),
        });
      } catch (e) {
        textInput.value = text;
        notify("error", "Couldn't send: " + (e.message || e));
      }
    };

    sendBtn.addEventListener("click", send);
    textInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    const q = firestore.query(
      firestore.collection(db, "messages"),
      firestore.where("orgId", "==", org.id),
    );
    firestore.onSnapshot(
      q,
      (snap) => {
        allMessages = [];
        snap.forEach((d) => allMessages.push({ id: d.id, ...d.data() }));
        allMessages.sort(
          (a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0),
        );
        renderList();
      },
      (err) => {
        // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
        list.replaceChildren();
        list.appendChild(
          h("p", { style: "color:var(--red);" }, "Couldn't load chat: " + err.message),
        );
      },
    );

    setTimeout(() => textInput.focus(), 50);
    return frag;
  }

  // ================================================================
  // ROADMAP (Firestore — internal edits, clients read-only)
  // ================================================================
  function orgTier(org) {
    return org?.tier === "performance" ? "performance" : "transformation";
  }
  function periodCount(org) {
    return orgTier(org) === "performance" ? 4 : 12;
  }
  function periodLabelPrefix(org) {
    return orgTier(org) === "performance" ? "Quarter" : "Month";
  }
  function periodsField(org) {
    return orgTier(org) === "performance" ? "quarters" : "months";
  }

  function emptyRoadmap(orgId, tier) {
    const count = tier === "performance" ? 4 : 12;
    return {
      orgId,
      periods: Array.from({ length: count }, () => ({ pillarIds: [], outcomes: [] })),
      updatedAt: null,
    };
  }

  function renderRoadmap(user, org) {
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Plan"));
    const tier = orgTier(org);
    const periodCadence = tier === "performance" ? "4-quarter" : "12-month";
    const periodLabelLower = tier === "performance" ? "quarter" : "month";
    frag.appendChild(
      h(
        "p",
        { class: "view-sub" },
        org
          ? `${periodCadence} delivery plan for ${org.name}. ${user.role === "internal" ? `Drag pillars into a ${periodLabelLower} and add outcomes.` : "Your BeDeveloped team will update this as the engagement progresses."}`
          : "Select an organisation to see its plan.",
      ),
    );
    if (!org) return frag;

    if (!fbReady()) {
      frag.appendChild(
        h(
          "div",
          { class: "card", style: "padding:32px; text-align:center; color: var(--ink-3);" },
          "Connecting to shared storage…",
        ),
      );
      return frag;
    }

    const { db, firestore } = window.FB;
    const canEdit = user.role === "internal";
    const docRef = firestore.doc(db, "roadmaps", org.id);

    const layout = h("div", {
      class: "roadmap-layout",
      style: "display:grid; grid-template-columns: 1fr 260px; gap:18px; align-items:start;",
    });
    const periodsCol = h("div", { style: "display:flex; flex-direction:column; gap:10px;" });
    const palette = h("div", {
      class: "card roadmap-palette",
      style: "position:sticky; top:18px; padding:14px;",
    });

    // Pillar palette
    palette.appendChild(
      h(
        "div",
        {
          style:
            "font-family: var(--font-display); letter-spacing:0.08em; color: var(--brand); font-size:12px; margin-bottom:8px;",
        },
        "PILLARS",
      ),
    );
    palette.appendChild(
      h(
        "p",
        { style: "font-size:11.5px; color:var(--ink-3); margin:0 0 10px; line-height:1.4;" },
        canEdit
          ? `Drag any pillar into a ${periodLabelLower}. A pillar can appear in more than one ${periodLabelLower}.`
          : `Pillars assigned to each ${periodLabelLower} appear below.`,
      ),
    );
    DATA.pillars.forEach((p) => {
      const chip = h(
        "div",
        {
          "data-pillar": p.id,
          style: `padding:6px 10px; margin-bottom:6px; border:1px solid var(--line-2); border-radius:999px; background:var(--brand-tint); color:var(--brand-ink); font-size:12px; ${canEdit ? "cursor:grab;" : ""}`,
        },
        `${p.id}. ${p.shortName || p.name}`,
      );
      if (canEdit) {
        chip.setAttribute("draggable", "true");
        chip.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/pillar-id", String(p.id));
          e.dataTransfer.effectAllowed = "copy";
        });
      }
      palette.appendChild(chip);
    });

    // Render helper for each period card (takes current data, re-renders on save)
    const persistField = periodsField(org);
    const periodLabel = periodLabelPrefix(org);
    let localData = emptyRoadmap(org.id, tier);
    const save = async (next) => {
      localData = next;
      try {
        await firestore.setDoc(
          docRef,
          {
            orgId: org.id,
            [persistField]: next.periods,
            updatedAt: firestore.serverTimestamp(),
          },
          { merge: true },
        );
      } catch (e) {
        notify("error", "Couldn't save roadmap: " + (e.message || e));
      }
    };

    const renderPeriods = () => {
      // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
      periodsCol.replaceChildren();
      localData.periods.forEach((m, idx) => {
        const card = h("div", { class: "card", style: "padding:14px;" });
        card.appendChild(
          h(
            "div",
            {
              style:
                "display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;",
            },
            [
              h(
                "div",
                {
                  style:
                    "font-family: var(--font-display); font-size:18px; letter-spacing:0.02em; color: var(--ink);",
                },
                `${periodLabel} ${idx + 1}`,
              ),
              h(
                "div",
                { style: "font-size:11px; color:var(--ink-3);" },
                `${(m.pillarIds || []).length} pillar${(m.pillarIds || []).length === 1 ? "" : "s"} · ${(m.outcomes || []).length} outcome${(m.outcomes || []).length === 1 ? "" : "s"}`,
              ),
            ],
          ),
        );

        // Pillars drop zone
        const drop = h("div", {
          style: `min-height:42px; padding:8px; border:1px dashed var(--line-2); border-radius:8px; display:flex; flex-wrap:wrap; gap:6px; background:var(--surface-muted); margin-bottom:10px;`,
        });
        if (!(m.pillarIds || []).length) {
          drop.appendChild(
            h(
              "span",
              { style: "font-size:12px; color:var(--ink-4);" },
              canEdit ? "Drag pillars here" : "No pillars assigned yet",
            ),
          );
        }
        (m.pillarIds || []).forEach((pid) => {
          const p = DATA.pillars.find((pp) => pp.id === pid);
          if (!p) return;
          const chip = h(
            "span",
            {
              style:
                "display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; background:var(--brand); color:#fff; font-size:12px;",
            },
            [
              h("span", {}, `${p.id}. ${p.shortName || p.name}`),
              canEdit
                ? h(
                    "button",
                    {
                      style:
                        "border:0; background:transparent; color:#fff; cursor:pointer; padding:0 0 0 4px; font-size:13px; line-height:1;",
                      onclick: () => {
                        const next = {
                          ...localData,
                          periods: localData.periods.map((mm, i) =>
                            i === idx
                              ? { ...mm, pillarIds: (mm.pillarIds || []).filter((x) => x !== pid) }
                              : mm,
                          ),
                        };
                        save(next);
                        renderPeriods();
                      },
                    },
                    "×",
                  )
                : null,
            ].filter(Boolean),
          );
          drop.appendChild(chip);
        });
        if (canEdit) {
          drop.addEventListener("dragover", (e) => {
            e.preventDefault();
            drop.style.background = "var(--brand-tint)";
          });
          drop.addEventListener("dragleave", () => {
            drop.style.background = "var(--surface-muted)";
          });
          drop.addEventListener("drop", (e) => {
            e.preventDefault();
            drop.style.background = "var(--surface-muted)";
            const pid = Number(e.dataTransfer.getData("text/pillar-id"));
            if (!pid) return;
            const current = localData.periods[idx]?.pillarIds || [];
            if (current.includes(pid)) return;
            const next = {
              ...localData,
              periods: localData.periods.map((mm, i) =>
                i === idx ? { ...mm, pillarIds: [...current, pid] } : mm,
              ),
            };
            save(next);
            renderPeriods();
          });
        }
        card.appendChild(drop);

        // Outcomes
        card.appendChild(
          h(
            "div",
            {
              style:
                "font-size:11px; letter-spacing:0.08em; color:var(--ink-3); text-transform:uppercase; margin-bottom:6px;",
            },
            "Outcomes",
          ),
        );
        const outList = h("div", {
          style: "display:flex; flex-direction:column; gap:4px; margin-bottom:8px;",
        });
        if (!(m.outcomes || []).length) {
          outList.appendChild(
            h("div", { style: "font-size:12px; color:var(--ink-4);" }, "None yet."),
          );
        }
        (m.outcomes || []).forEach((o) => {
          const row = h("div", {
            style: "display:flex; align-items:center; gap:8px; font-size:13px;",
          });
          const check = h("input", { type: "checkbox" });
          check.checked = !!o.done;
          if (canEdit) {
            check.addEventListener("change", () => {
              const next = {
                ...localData,
                periods: localData.periods.map((mm, i) =>
                  i === idx
                    ? {
                        ...mm,
                        outcomes: (mm.outcomes || []).map((oo) =>
                          oo.id === o.id ? { ...oo, done: check.checked } : oo,
                        ),
                      }
                    : mm,
                ),
              };
              save(next);
              renderPeriods();
            });
          } else {
            check.disabled = true;
          }
          row.appendChild(check);
          row.appendChild(h("span", { style: "flex:1;" }, o.text));
          if (canEdit) {
            row.appendChild(
              h(
                "button",
                {
                  class: "btn ghost sm danger",
                  style: "padding:2px 8px; font-size:11px;",
                  onclick: () => {
                    const next = {
                      ...localData,
                      periods: localData.periods.map((mm, i) =>
                        i === idx
                          ? { ...mm, outcomes: (mm.outcomes || []).filter((oo) => oo.id !== o.id) }
                          : mm,
                      ),
                    };
                    save(next);
                    renderPeriods();
                  },
                },
                "Remove",
              ),
            );
          }
          outList.appendChild(row);
        });
        card.appendChild(outList);

        if (canEdit) {
          const input = h("input", {
            type: "text",
            placeholder: "Add outcome (e.g. Pipeline forecasting in place)",
            style:
              "flex:1; padding:6px 10px; border:1px solid var(--line-2); border-radius:6px; font:inherit; font-size:13px;",
          });
          const addBtn = h("button", { class: "btn sm" }, "Add");
          const pasteBtn = h(
            "button",
            { class: "btn sm secondary", title: "Paste a list — one outcome per line" },
            "Paste multiple",
          );
          const addOutcome = () => {
            const text = input.value.trim();
            if (!text) return;
            input.value = "";
            const o = { id: uid("out_"), text, done: false };
            const next = {
              ...localData,
              periods: localData.periods.map((mm, i) =>
                i === idx ? { ...mm, outcomes: [...(mm.outcomes || []), o] } : mm,
              ),
            };
            save(next);
            renderPeriods();
          };
          const addManyOutcomes = (lines) => {
            const clean = lines
              // eslint-disable-next-line no-useless-escape -- Phase 4: clean up regex (\\) is unnecessary in char class). See runbooks/phase-4-cleanup-ledger.md
              .map((s) => s.replace(/^\s*[-•*\d.\)]+\s*/, "").trim())
              .filter(Boolean);
            if (!clean.length) return;
            const newOutcomes = clean.map((text) => ({ id: uid("out_"), text, done: false }));
            const next = {
              ...localData,
              periods: localData.periods.map((mm, i) =>
                i === idx ? { ...mm, outcomes: [...(mm.outcomes || []), ...newOutcomes] } : mm,
              ),
            };
            save(next);
            renderPeriods();
          };
          addBtn.addEventListener("click", addOutcome);
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") addOutcome();
          });
          pasteBtn.addEventListener("click", () =>
            openBulkOutcomeModal(`${periodLabel} ${idx + 1}`, addManyOutcomes),
          );
          card.appendChild(
            h("div", { style: "display:flex; gap:6px;" }, [input, addBtn, pasteBtn]),
          );
        }

        periodsCol.appendChild(card);
      });
    };

    layout.appendChild(periodsCol);
    layout.appendChild(palette);
    frag.appendChild(layout);

    // Initial paint + live updates
    renderPeriods();
    const expectedLen = periodCount(org);
    firestore.onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const loaded =
            Array.isArray(d[persistField]) && d[persistField].length === expectedLen
              ? d[persistField]
              : emptyRoadmap(org.id, tier).periods;
          localData = { orgId: org.id, periods: loaded, updatedAt: d.updatedAt || null };
        } else {
          localData = emptyRoadmap(org.id, tier);
        }
        renderPeriods();
      },
      (err) => console.error("Roadmap snapshot error:", err),
    );

    return frag;
  }

  function openBulkOutcomeModal(periodLabel, onAdd) {
    const ta = h("textarea", {
      placeholder:
        "Paste outcomes, one per line. Lines starting with -, •, *, or a number are cleaned up.\n\nExample:\n- Pipeline forecasting in place\n- Weekly revenue review running\n- Proposal template standardised",
      style:
        "width:100%; min-height:220px; padding:12px; border:1px solid var(--line); border-radius:8px; font:13px/1.5 var(--font-sans, inherit); resize:vertical;",
    });
    const countLbl = h("div", { style: "font-size:12px; color:var(--ink-3);" }, "0 outcomes");
    ta.addEventListener("input", () => {
      const n = ta.value
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean).length;
      countLbl.textContent = `${n} outcome${n === 1 ? "" : "s"}`;
    });
    const m = modal([
      h("h3", {}, `Paste multiple outcomes - ${periodLabel}`),
      h(
        "p",
        { style: "color:var(--ink-3); font-size:13px; margin-top:0;" },
        "One outcome per line. Bullet markers and numbering are stripped automatically.",
      ),
      ta,
      countLbl,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              const lines = ta.value.split(/\r?\n/);
              onAdd(lines);
              m.close();
            },
          },
          "Add all",
        ),
      ]),
    ]);
    setTimeout(() => ta.focus(), 10);
  }

  // Re-render when Firebase is ready (so loading states flip to live data)
  window.addEventListener("firebase-ready", async () => {
    ensureChatSubscription(currentUser());
    await syncFromCloud();
    // Cloud data is now mirrored locally; run the framework V2 wipe so
    // saveOrg pushes the cleared responses back up to Firestore.
    clearResponsesForFrameworkV2IfNeeded();
    if (
      state.route === "documents" ||
      state.route === "chat" ||
      state.route === "roadmap" ||
      state.route === "funnel" ||
      state.route === "diagnostic" ||
      state.route === "dashboard" ||
      (typeof state.route === "string" && state.route.startsWith("pillar:"))
    )
      render();
  });

  // ================================================================
  // FUNNEL (Firestore - shared per org, everyone can edit)
  // ================================================================
  const FUNNEL_METRICS = [
    { key: "leads", label: "Leads" },
    { key: "mqls", label: "MQL's" },
    { key: "leadToMql", label: "Lead > MQL %", type: "percent", num: "mqls", den: "leads" },
    { key: "sqls", label: "SQL's" },
    { key: "mqlToSql", label: "MQL > SQL %", type: "percent", num: "sqls", den: "mqls" },
    { key: "proposalsSent", label: "Proposals sent" },
    {
      key: "sqlToProposal",
      label: "SQL > Proposal %",
      type: "percent",
      num: "proposalsSent",
      den: "sqls",
    },
    { key: "qualifiedOutOur", label: "Qualified out (Our decision)" },
    { key: "qualifiedOutTheir", label: "Qualified out (Their decision)" },
    { key: "closedWon", label: "Closed Won" },
    {
      key: "conversion",
      label: "Conversion %",
      type: "percent",
      num: "closedWon",
      denKeys: ["sqls", "qualifiedOutTheir"],
    },
  ];
  const FUNNEL_QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
  const FUNNEL_YEARS = [2026, 2027];

  function renderFunnel(user, org) {
    const frag = h("div");
    frag.appendChild(
      h(
        "button",
        {
          class: "back",
          style: "margin-bottom: 6px;",
          onclick: () => setRoute("dashboard"),
        },
        "← Back to dashboard",
      ),
    );
    frag.appendChild(h("h1", { class: "view-title" }, "Funnel"));
    frag.appendChild(
      h(
        "p",
        { class: "view-sub" },
        org
          ? `Early-stage sales funnel for ${org.name}. Numbers are shared with your team in real time. Percentages calculate automatically.`
          : "Select an organisation to see its funnel.",
      ),
    );
    if (!org) return frag;

    if (!fbReady()) {
      frag.appendChild(
        h(
          "div",
          { class: "card", style: "padding:32px; text-align:center; color: var(--ink-3);" },
          "Connecting to shared storage…",
        ),
      );
      return frag;
    }

    const { db, firestore } = window.FB;
    const docRef = firestore.doc(db, "funnels", org.id);

    const localData = { years: {} };
    FUNNEL_YEARS.forEach((y) => {
      localData.years[y] = {};
      FUNNEL_QUARTERS.forEach((q) => {
        localData.years[y][q] = {};
      });
    });
    let localKpis = [];

    const inputs = {};
    const pctCells = {};
    const avgCells = {};

    // ---------- KPI section ----------
    const kpiCard = h("section", { class: "kpi-section" });
    const kpiHeader = h("div", { class: "kpi-section-header" }, [
      h("div", {}, [
        h("h2", { class: "kpi-section-title" }, "KPIs"),
        h(
          "p",
          { class: "kpi-section-sub" },
          "Track the metrics that matter for this client. Both teams can edit.",
        ),
      ]),
    ]);
    const kpiAddBtn = h("button", { class: "btn" }, "+ New KPI");
    kpiHeader.appendChild(kpiAddBtn);
    kpiCard.appendChild(kpiHeader);

    const kpiTable = h("div", { class: "kpi-table" });
    kpiTable.appendChild(
      h("div", { class: "kpi-row kpi-head" }, [
        h("div", {}, "KPI"),
        h("div", {}, "Target"),
        h("div", {}, "Current"),
        h("div", {}, "Notes"),
        h("div", {}, ""),
      ]),
    );
    const kpiList = h("div", { class: "kpi-list" });
    kpiTable.appendChild(kpiList);
    kpiCard.appendChild(kpiTable);

    const kpiStatus = h("span", { class: "kpi-save-status" }, "");
    kpiCard.appendChild(h("div", { class: "kpi-status-row" }, [kpiStatus]));
    frag.appendChild(kpiCard);

    let kpiSaveTimer = null;
    const flushKpiSave = async () => {
      kpiStatus.textContent = "Saving…";
      try {
        await firestore.setDoc(
          docRef,
          {
            orgId: org.id,
            kpis: localKpis,
            updatedAt: firestore.serverTimestamp(),
          },
          { merge: true },
        );
        const t = new Date();
        const hh = String(t.getHours()).padStart(2, "0");
        const mm = String(t.getMinutes()).padStart(2, "0");
        kpiStatus.textContent = `Saved at ${hh}:${mm}`;
      } catch (e) {
        kpiStatus.textContent = "Save failed - " + (e.message || e);
        console.error("KPI save error:", e);
      } finally {
        kpiSaveTimer = null;
      }
    };
    const queueKpiSave = () => {
      kpiStatus.textContent = "Editing…";
      clearTimeout(kpiSaveTimer);
      kpiSaveTimer = setTimeout(flushKpiSave, 600);
    };

    const renderKpiRows = () => {
      // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
      kpiList.replaceChildren();
      if (!localKpis.length) {
        kpiList.appendChild(
          h("div", { class: "kpi-empty" }, "No KPIs yet. Click + New KPI to add one."),
        );
        return;
      }
      localKpis.forEach((k) => {
        const row = h("div", { class: "kpi-row" });
        const mkInput = (field, placeholder) => {
          const inp = h("input", {
            type: "text",
            class: "kpi-input",
            placeholder,
            value: k[field] || "",
          });
          inp.addEventListener("input", () => {
            k[field] = inp.value;
            queueKpiSave();
          });
          return inp;
        };
        row.appendChild(mkInput("name", "e.g. New leads / week"));
        row.appendChild(mkInput("target", "Target"));
        row.appendChild(mkInput("current", "Current"));
        row.appendChild(mkInput("notes", "Notes"));
        const del = h(
          "button",
          {
            class: "btn ghost sm",
            style: "border-color: var(--line);",
            onclick: () =>
              confirmDialog(
                "Delete KPI?",
                "This cannot be undone.",
                () => {
                  localKpis = localKpis.filter((x) => x.id !== k.id);
                  renderKpiRows();
                  queueKpiSave();
                },
                "Delete",
              ),
          },
          "×",
        );
        row.appendChild(del);
        kpiList.appendChild(row);
      });
    };

    kpiAddBtn.addEventListener("click", () => {
      localKpis.push({ id: uid("kpi_"), name: "", target: "", current: "", notes: "" });
      renderKpiRows();
      queueKpiSave();
      const rows = kpiList.querySelectorAll(".kpi-row");
      const lastRow = rows[rows.length - 1];
      if (lastRow) {
        const firstInput = lastRow.querySelector(".kpi-input");
        if (firstInput) firstInput.focus();
      }
    });

    renderKpiRows();

    const fmtPct = (num, den) => {
      const n = Number(num) || 0;
      const d = Number(den) || 0;
      if (!d) return "-";
      return `${((n / d) * 100).toFixed(1)}%`;
    };

    const denTotal = (m, data) => {
      if (m.denKeys) {
        return m.denKeys.reduce((acc, k) => acc + (Number(data[k]) || 0), 0);
      }
      return Number(data[m.den]) || 0;
    };

    const updatePctCells = (year, q) => {
      FUNNEL_METRICS.forEach((m) => {
        if (m.type !== "percent") return;
        const cell = pctCells[`${year}.${q}.${m.key}`];
        if (!cell) return;
        const data = (localData.years[year] && localData.years[year][q]) || {};
        cell.textContent = fmtPct(data[m.num], denTotal(m, data));
      });
    };

    const updateAvgCells = (year) => {
      FUNNEL_METRICS.forEach((m) => {
        const cell = avgCells[`${year}.${m.key}`];
        if (!cell) return;
        if (m.type === "percent") {
          const pcts = [];
          FUNNEL_QUARTERS.forEach((q) => {
            const data = (localData.years[year] && localData.years[year][q]) || {};
            const num = Number(data[m.num]);
            const den = denTotal(m, data);
            if (den > 0 && !Number.isNaN(num)) {
              pcts.push((num / den) * 100);
            }
          });
          if (!pcts.length) {
            cell.textContent = "-";
            return;
          }
          const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
          cell.textContent = `${avg.toFixed(1)}%`;
        } else {
          const vals = [];
          FUNNEL_QUARTERS.forEach((q) => {
            const data = (localData.years[year] && localData.years[year][q]) || {};
            const v = data[m.key];
            if (v === null || v === undefined || v === "") return;
            const n = Number(v);
            if (!Number.isNaN(n)) vals.push(n);
          });
          if (!vals.length) {
            cell.textContent = "-";
            return;
          }
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          const allInt = vals.every((v) => Number.isInteger(v));
          cell.textContent = allInt ? Math.round(avg).toString() : avg.toFixed(1);
        }
      });
    };

    const saveStatus = h("span", { class: "funnel-save-status" }, "Changes save automatically.");

    let saveTimer = null;
    const flushSave = async () => {
      saveStatus.textContent = "Saving…";
      try {
        await firestore.setDoc(
          docRef,
          {
            orgId: org.id,
            years: localData.years,
            updatedAt: firestore.serverTimestamp(),
          },
          { merge: true },
        );
        const t = new Date();
        const hh = String(t.getHours()).padStart(2, "0");
        const mm = String(t.getMinutes()).padStart(2, "0");
        saveStatus.textContent = `Saved at ${hh}:${mm}`;
      } catch (e) {
        saveStatus.textContent = "Save failed - " + (e.message || e);
        console.error("Funnel save error:", e);
      }
    };
    const saveCell = (year, q, key, value) => {
      if (!localData.years[year]) localData.years[year] = {};
      if (!localData.years[year][q]) localData.years[year][q] = {};
      localData.years[year][q][key] = value;
      updatePctCells(year, q);
      updateAvgCells(year);
      saveStatus.textContent = "Editing…";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 600);
    };

    const buildYearTable = (year) => {
      const wrap = h("div", { class: "funnel-table-wrap" });
      const table = h("table", { class: "funnel-table" });
      const thead = h("thead");
      thead.appendChild(
        h("tr", {}, [
          h("th", { class: "funnel-metric-head" }, "Metric"),
          ...FUNNEL_QUARTERS.map((q) => h("th", {}, q)),
          h("th", { class: "funnel-avg-head" }, "Avg"),
        ]),
      );
      table.appendChild(thead);

      const tbody = h("tbody");
      FUNNEL_METRICS.forEach((m) => {
        const isPct = m.type === "percent";
        const row = h("tr", { class: isPct ? "funnel-row-pct" : "" });
        row.appendChild(h("td", { class: "funnel-metric-label" }, m.label));
        FUNNEL_QUARTERS.forEach((q) => {
          const td = h("td");
          if (isPct) {
            const cell = h("span", { class: "funnel-pct" }, "-");
            pctCells[`${year}.${q}.${m.key}`] = cell;
            td.appendChild(cell);
          } else {
            const inp = h("input", {
              type: "number",
              min: "0",
              step: "1",
              inputmode: "numeric",
              class: "funnel-input",
              placeholder: "0",
            });
            inputs[`${year}.${q}.${m.key}`] = inp;
            const commit = () => {
              const raw = inp.value.trim();
              const v = raw === "" ? null : Number(raw);
              if (raw !== "" && Number.isNaN(v)) return;
              saveCell(year, q, m.key, v);
            };
            inp.addEventListener("input", commit);
            inp.addEventListener("blur", commit);
            inp.addEventListener("keydown", (e) => {
              if (e.key === "Enter") inp.blur();
            });
            td.appendChild(inp);
          }
          row.appendChild(td);
        });
        const avgTd = h("td", { class: "funnel-avg-cell" });
        const avgSpan = h("span", { class: "funnel-avg" }, "-");
        avgCells[`${year}.${m.key}`] = avgSpan;
        avgTd.appendChild(avgSpan);
        row.appendChild(avgTd);
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      return wrap;
    };

    const funnelLayout = h("div", { class: "funnel-layout" });
    const funnelTablesCol = h("div", { class: "funnel-tables-col" });
    funnelLayout.appendChild(funnelTablesCol);

    FUNNEL_YEARS.forEach((year, idx) => {
      const details = h("details", { class: "funnel-year" });
      if (idx === 0) details.setAttribute("open", "");
      details.appendChild(
        h("summary", { class: "funnel-year-summary" }, [
          h("span", { class: "funnel-year-label" }, String(year)),
          h("span", { class: "funnel-year-hint" }, "Click to toggle"),
        ]),
      );
      details.appendChild(buildYearTable(year));
      funnelTablesCol.appendChild(details);
    });

    const glossary = h("aside", { class: "side-panel funnel-glossary" });
    glossary.appendChild(h("h3", {}, "Definitions"));
    const dl = h("dl", { class: "funnel-glossary-list" });
    [
      ["Lead", "Un-qualified. i.e. engaged with content but yet to be qualified to your ICP."],
      ["MQL", "Qualified lead generated from marketing, fits ICP."],
      [
        "SQL",
        "Sales Qualified lead. The point the sales conversation has happened and the sales team deem it an opportunity.",
      ],
      ["%", "Shows the conversion results."],
    ].forEach(([term, def]) => {
      dl.appendChild(h("dt", { class: "funnel-glossary-term" }, term));
      dl.appendChild(h("dd", { class: "funnel-glossary-def" }, def));
    });
    glossary.appendChild(dl);
    funnelLayout.appendChild(glossary);

    frag.appendChild(funnelLayout);

    const saveBtn = h("button", { class: "btn" }, "Save now");
    saveBtn.addEventListener("click", async () => {
      clearTimeout(saveTimer);
      saveBtn.disabled = true;
      await flushSave();
      saveBtn.disabled = false;
    });
    frag.appendChild(h("div", { class: "funnel-save-row" }, [saveStatus, saveBtn]));

    const applySnapshot = () => {
      FUNNEL_YEARS.forEach((y) => {
        FUNNEL_QUARTERS.forEach((q) => {
          const data = (localData.years[y] && localData.years[y][q]) || {};
          FUNNEL_METRICS.forEach((m) => {
            if (m.type === "percent") return;
            const inp = inputs[`${y}.${q}.${m.key}`];
            if (!inp) return;
            if (document.activeElement === inp) return;
            const v = data[m.key];
            inp.value = v === null || v === undefined || Number.isNaN(v) ? "" : String(v);
          });
          updatePctCells(y, q);
        });
        updateAvgCells(y);
      });
    };

    firestore.onSnapshot(
      docRef,
      (snap) => {
        const d = snap.exists() ? snap.data() : null;
        const years = (d && d.years) || {};
        FUNNEL_YEARS.forEach((y) => {
          if (!localData.years[y]) localData.years[y] = {};
          FUNNEL_QUARTERS.forEach((q) => {
            localData.years[y][q] =
              (years[y] && years[y][q]) || (years[String(y)] && years[String(y)][q]) || {};
          });
        });
        applySnapshot();
        // KPIs - skip while user is mid-edit so we don't clobber typing
        if (!kpiSaveTimer) {
          const remoteKpis = d && Array.isArray(d.kpis) ? d.kpis : [];
          const focusedRow =
            document.activeElement &&
            document.activeElement.closest &&
            document.activeElement.closest(".kpi-row");
          if (!focusedRow) {
            localKpis = remoteKpis.map((k) => ({
              id: k.id || uid("kpi_"),
              name: k.name || "",
              target: k.target || "",
              current: k.current || "",
              notes: k.notes || "",
            }));
            renderKpiRows();
          }
        }
      },
      (err) => console.error("Funnel snapshot error:", err),
    );

    // ---------- Comments section ----------
    const commentsCard = h("section", { class: "comments-section" });
    commentsCard.appendChild(
      h("div", { class: "comments-section-header" }, [
        h("h2", { class: "comments-section-title" }, "Comments"),
        h(
          "p",
          { class: "comments-section-sub" },
          "Discuss the funnel - questions, observations, follow-ups. Visible to your team and BeDeveloped.",
        ),
      ]),
    );

    const commentsList = h("div", { class: "comments-list" });
    commentsList.appendChild(h("p", { class: "comments-empty" }, "Loading…"));
    commentsCard.appendChild(commentsList);

    const commentInput = h("textarea", {
      class: "comments-input",
      placeholder: "Add a comment…",
      rows: "1",
    });
    const commentSendBtn = h("button", { class: "btn" }, "Send");
    commentsCard.appendChild(
      h("div", { class: "comments-composer" }, [commentInput, commentSendBtn]),
    );
    frag.appendChild(commentsCard);

    let allComments = [];
    const renderComments = () => {
      // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
      commentsList.replaceChildren();
      if (!allComments.length) {
        commentsList.appendChild(
          h("p", { class: "comments-empty" }, "No comments yet — start the conversation."),
        );
        return;
      }
      allComments.forEach((m) => {
        const isSelf = m.authorId === user.id;
        const isInternalAuthor = m.authorRole === "internal";
        const bg = isInternalAuthor ? "var(--ink)" : "var(--brand)";
        const ts = m.createdAt?.toDate?.().toLocaleString?.() || "";
        const who = firstNameFromAuthor(m);
        const canDelete = isSelf || !isClientView(user);
        const bubble = h(
          "div",
          {
            class: "comment-bubble",
            style: `align-self:${isSelf ? "flex-end" : "flex-start"}; background:${bg}; border-color:${bg};`,
          },
          [
            h("div", { class: "comment-meta" }, `${who} · ${ts}`),
            h("div", { class: "comment-text" }, m.text),
          ],
        );
        if (canDelete) {
          const del = h(
            "button",
            {
              class: "comment-bubble-del",
              title: "Delete",
              onclick: (e) => {
                e.stopPropagation();
                confirmDialog(
                  "Delete comment?",
                  "This cannot be undone.",
                  async () => {
                    try {
                      await firestore.deleteDoc(firestore.doc(db, "funnelComments", m.id));
                    } catch (err) {
                      notify("error", "Couldn't delete: " + (err.message || err));
                    }
                  },
                  "Delete",
                );
              },
            },
            "×",
          );
          bubble.appendChild(del);
        }
        commentsList.appendChild(bubble);
      });
      commentsList.scrollTop = commentsList.scrollHeight;
    };

    const sendComment = async () => {
      const text = commentInput.value.trim();
      if (!text) return;
      commentInput.value = "";
      try {
        await firestore.addDoc(firestore.collection(db, "funnelComments"), {
          orgId: org.id,
          authorId: user.id,
          authorName: user.name || user.email,
          authorEmail: user.email,
          authorRole: user.role,
          text,
          createdAt: firestore.serverTimestamp(),
        });
      } catch (e) {
        commentInput.value = text;
        notify("error", "Couldn't send: " + (e.message || e));
      }
    };
    commentSendBtn.addEventListener("click", sendComment);
    commentInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendComment();
      }
    });

    const commentsQ = firestore.query(
      firestore.collection(db, "funnelComments"),
      firestore.where("orgId", "==", org.id),
    );
    firestore.onSnapshot(
      commentsQ,
      (snap) => {
        allComments = [];
        snap.forEach((d) => allComments.push({ id: d.id, ...d.data() }));
        allComments.sort(
          (a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0),
        );
        renderComments();
      },
      (err) => {
        // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
        commentsList.replaceChildren();
        commentsList.appendChild(
          h("p", { style: "color:var(--red);" }, "Couldn't load comments: " + err.message),
        );
      },
    );

    return frag;
  }

  function openInviteClientModal() {
    const name = h("input", { type: "text", placeholder: "Client contact name" });
    const email = h("input", { type: "email", placeholder: "client@company.com" });
    const select = h("select", {
      style:
        "width:100%; padding:10px; border:1px solid var(--line); border-radius:8px; font:inherit;",
    });
    const orgs = loadOrgMetas();
    orgs.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.name;
      select.appendChild(opt);
    });
    const errBox = h("div");

    const m = modal([
      h("h3", {}, "Invite a client"),
      h(
        "p",
        { style: "color: var(--ink-3); font-size: 13px; margin-top:0;" },
        "They'll sign in with their email + the company passphrase you set, then create their own password on first login.",
      ),
      h("div", { style: "display:flex; gap:10px; flex-direction:column;" }, [
        h("div", {}, [
          h("label", { style: "font-size:12px; color:var(--ink-2); font-weight:600;" }, "Name"),
          name,
        ]),
        h("div", {}, [
          h("label", { style: "font-size:12px; color:var(--ink-2); font-weight:600;" }, "Email"),
          email,
        ]),
        h("div", {}, [
          h(
            "label",
            { style: "font-size:12px; color:var(--ink-2); font-weight:600;" },
            "Organisation",
          ),
          select,
        ]),
      ]),
      errBox,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
              errBox.replaceChildren();
              const em = (email.value || "").trim().toLowerCase();
              if (!em || !em.includes("@")) {
                errBox.appendChild(h("div", { class: "auth-error" }, "Enter a valid email."));
                return;
              }
              if (findUserByEmail(em)) {
                errBox.appendChild(
                  h("div", { class: "auth-error" }, "A user with that email already exists."),
                );
                return;
              }
              if (!orgs.length) {
                errBox.appendChild(
                  h("div", { class: "auth-error" }, "Create an organisation first."),
                );
                return;
              }
              const user = {
                id: uid("u_"),
                email: em,
                name: (name.value || "").trim(),
                role: "client",
                orgId: select.value,
                createdAt: iso(),
              };
              upsertUser(user);
              const chosenOrg = loadOrgMetas().find((o) => o.id === select.value);
              const chosenOrgFull = loadOrg(select.value);
              m.close();
              render();
              openInviteInstructionsModal(
                user,
                chosenOrg,
                !!(chosenOrgFull && chosenOrgFull.clientPassphraseHash),
              );
            },
          },
          "Create account",
        ),
      ]),
    ]);
    setTimeout(() => name.focus(), 10);
  }

  function openInviteInstructionsModal(client, org, hasPassphrase) {
    const signInUrl = "https://baselayers.bedeveloped.com";
    const firstName = (client.name || "").split(" ")[0] || "there";
    const emailSubject = `Your ${org?.name ? org.name + " " : ""}account on The Base Layers`;
    const emailBody = `Hi ${firstName},

You've been set up with access to The Base Layers diagnostic${org?.name ? ` for ${org.name}` : ""}.

To sign in:
1. Go to ${signInUrl}
2. Enter your email: ${client.email}
3. Enter the company passphrase (I'll share this with you separately)
4. Create your own password on first sign-in - you'll use this from then on

Any questions, just let me know.`;

    const mailto = `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    const textArea = h("textarea", {
      readonly: "",
      style:
        "width:100%; min-height:190px; padding:12px; border:1px solid var(--line); border-radius:8px; font:13px/1.5 var(--font-sans, inherit); resize:vertical;",
    });
    textArea.value = emailBody;

    const copyBtn = h("button", { class: "btn secondary" }, "Copy text");
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(emailBody);
        copyBtn.textContent = "Copied ✓";
      } catch {
        textArea.select();
        document.execCommand && document.execCommand("copy");
        copyBtn.textContent = "Copied ✓";
      }
      setTimeout(() => {
        copyBtn.textContent = "Copy text";
      }, 1800);
    };

    const m = modal(
      [
        h("h3", {}, "Client account created"),
        h(
          "p",
          { style: "color: var(--ink-2); font-size:13.5px; margin-top:0;" },
          `${client.email} can now sign in. There's no automatic email - send them the details below. You'll also need to share the company passphrase for ${org?.name || "their organisation"} separately.`,
        ),
        !hasPassphrase
          ? h(
              "div",
              {
                style:
                  "background: var(--amber-bg, #FFF4E0); border:1px solid var(--amber); color: var(--ink-2); padding:10px 12px; border-radius:8px; font-size:12.5px; margin-bottom:10px;",
              },
              `⚠ ${org?.name || "This organisation"} doesn't have a company passphrase set yet. Set one from the Admin page before the client tries to sign in.`,
            )
          : null,
        h(
          "label",
          { style: "font-size:12px; color:var(--ink-3); display:block; margin-bottom:4px;" },
          "Suggested message",
        ),
        textArea,
        h("div", { class: "row" }, [
          h("button", { class: "btn secondary", onclick: () => m.close() }, "Done"),
          copyBtn,
          h(
            "a",
            {
              class: "btn",
              href: mailto,
              style: "text-decoration:none; display:inline-flex; align-items:center;",
              onclick: () => {
                setTimeout(() => m.close(), 100);
              },
            },
            "Open in email",
          ),
        ]),
      ].filter(Boolean),
    );
  }

  function openChangePasswordModal(user) {
    const cur = h("input", { type: "password", placeholder: "Current password" });
    const nw = h("input", { type: "password", placeholder: "New password (min 6 chars)" });
    const confirmPw = h("input", { type: "password", placeholder: "Confirm new password" });
    const errBox = h("div");
    const m = modal([
      h("h3", {}, "Change password"),
      h(
        "p",
        { style: "color:var(--ink-3); font-size:13px; margin-top:0;" },
        "Enter your current password, then choose a new one. You'll use the new password next time you sign in.",
      ),
      h("div", { style: "display:flex; flex-direction:column; gap:10px;" }, [cur, nw, confirmPw]),
      errBox,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        h(
          "button",
          {
            class: "btn",
            onclick: async () => {
              // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
              errBox.replaceChildren();
              const ok = await verifyUserPassword(user.id, cur.value);
              if (!ok) {
                errBox.appendChild(h("div", { class: "auth-error" }, "Current password is wrong."));
                return;
              }
              if ((nw.value || "").length < 6) {
                errBox.appendChild(
                  h("div", { class: "auth-error" }, "New password must be at least 6 characters."),
                );
                return;
              }
              if (nw.value !== confirmPw.value) {
                errBox.appendChild(h("div", { class: "auth-error" }, "New passwords don't match."));
                return;
              }
              await setUserPassword(user.id, nw.value);
              m.close();
            },
          },
          "Update password",
        ),
      ]),
    ]);
    setTimeout(() => cur.focus(), 10);
  }

  function openSetOrgPassphrase(orgId, orgName) {
    const org = loadOrg(orgId);
    const existing = !!(org && org.clientPassphraseHash);
    const nw = h("input", {
      type: "password",
      placeholder: "New company passphrase (min 4 chars)",
    });
    const confirm = h("input", { type: "password", placeholder: "Confirm passphrase" });
    const errBox = h("div");
    const m = modal([
      h("h3", {}, (existing ? "Change" : "Set") + " passphrase — " + orgName),
      h(
        "p",
        { style: "color: var(--ink-3); font-size: 13px; margin-top:0;" },
        "Share this with the client team. They'll type it alongside their email and personal password when they sign in. If you change it, tell everyone at " +
          orgName +
          " the new one.",
      ),
      h("div", { style: "display:flex; flex-direction:column; gap:10px;" }, [nw, confirm]),
      errBox,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        h(
          "button",
          {
            class: "btn",
            onclick: async () => {
              // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
              errBox.replaceChildren();
              if (nw.value.length < 4) {
                errBox.appendChild(
                  h("div", { class: "auth-error" }, "Passphrase must be at least 4 characters."),
                );
                return;
              }
              if (nw.value !== confirm.value) {
                errBox.appendChild(h("div", { class: "auth-error" }, "Passphrases don't match."));
                return;
              }
              await setOrgClientPassphrase(orgId, nw.value);
              m.close();
              render();
            },
          },
          existing ? "Update" : "Save",
        ),
      ]),
    ]);
    setTimeout(() => nw.focus(), 10);
  }

  // eslint-disable-next-line no-unused-vars -- Phase 4: remove dead code or wire up call site. See runbooks/phase-4-cleanup-ledger.md
  function openChangePassphrase() {
    const cur = h("input", { type: "password", placeholder: "Current passphrase" });
    const nw = h("input", { type: "password", placeholder: "New passphrase (min 4 chars)" });
    const errBox = h("div");
    const m = modal([
      h("h3", {}, "Change team passphrase"),
      h("div", { style: "display:flex; flex-direction:column; gap:10px;" }, [cur, nw]),
      errBox,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        h(
          "button",
          {
            class: "btn",
            onclick: async () => {
              // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
              errBox.replaceChildren();
              const ok = await verifyInternalPassphrase(cur.value);
              if (!ok) {
                errBox.appendChild(h("div", { class: "auth-error" }, "Current passphrase wrong."));
                return;
              }
              if (nw.value.length < 4) {
                errBox.appendChild(
                  h(
                    "div",
                    { class: "auth-error" },
                    "New passphrase must be at least 4 characters.",
                  ),
                );
                return;
              }
              await setInternalPassphrase(nw.value);
              m.close();
            },
          },
          "Update",
        ),
      ]),
    ]);
    setTimeout(() => cur.focus(), 10);
  }

  // ================================================================
  // EXPORT / IMPORT
  // ================================================================
  function exportData() {
    const payload = {
      exportedAt: iso(),
      version: "v2",
      users: loadUsers(),
      settings: loadSettings(),
      orgs: loadOrgMetas()
        .map((m) => loadOrg(m.id))
        .filter(Boolean),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `base-layers-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.users) {
          saveUsers(data.users);
          data.users.forEach((u) => cloudPushUser(u));
        }
        if (data.settings) saveSettings(data.settings);
        if (Array.isArray(data.orgs)) {
          data.orgs.forEach((org) => {
            if (!org.id || !org.name) return;
            saveOrg(org);
            const metas = loadOrgMetas();
            if (!metas.find((o) => o.id === org.id)) {
              metas.push({ id: org.id, name: org.name });
              saveOrgMetas(metas);
            }
          });
        }
        render();
        notify("success", "Import complete.");
      } catch (e) {
        notify("error", "Import failed: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ================================================================
  // INIT
  // ================================================================
  // Phase 2 (D-05): clearOldScaleResponsesIfNeeded extracted to src/data/migration.js — wrapper above.

  // One-shot: clear all diagnostic responses when the 10-pillar framework
  // is restructured. Pillar IDs shift meaning so old scores would attach to
  // the wrong pillars. Runs once per browser, after cloud sync completes,
  // so saveOrg propagates the wipe back up to Firestore.
  function clearResponsesForFrameworkV2IfNeeded() {
    const s = loadSettings();
    if (s.frameworkV2Cleared) return;
    loadOrgMetas().forEach((m) => {
      const org = loadOrg(m.id);
      if (!org) return;
      org.responses = {};
      if (org.currentRoundId) org.responses[org.currentRoundId] = {};
      org.internalNotes = {};
      saveOrg(org);
    });
    s.frameworkV2Cleared = true;
    saveSettings(s);
  }

  function init() {
    migrateV1IfNeeded();
    clearOldScaleResponsesIfNeeded();
    const user = currentUser();
    if (user) {
      // set initial orgId for internal
      if (user.role === "internal") {
        const metas = loadOrgMetas();
        if (metas.length && !state.orgId) state.orgId = metas[0].id;
      }
    }
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
