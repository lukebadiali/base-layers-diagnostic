// @ts-nocheck
// Phase 4 Wave 5 (D-12 transitional): the IIFE body is preserved verbatim
// per Wave 4 Dev #1 + Wave 3 Dev #1 — body migration to src/views/*.js is
// a follow-up wave (the snapshot baselines at tests/__snapshots__/views/
// {dashboard,diagnostic,report}.html are the rendered-DOM contract). The
// strict checkJs surface is too tight for a 5,000-line IIFE that uses
// duck typing throughout (HTMLElement.value, implicit any in callbacks,
// etc.). Wave 6 cleanup migrates IIFE-resident renderX functions into the
// views/* stubs, after which src/main.js shrinks to the boot scaffold +
// dispatcher wiring + init() and this directive closes (the cleanup-
// ledger row tracking the @ts-nocheck migrates from app.js:1 to
// src/main.js:1 for Wave 6 to close). The new src/state.js + src/router.js
// modules (D-02 byte-identical extractions) DO have full @ts-check
// coverage with strict JSDoc types — the architectural intent (per-file
// type-discipline) is honoured for the cleanly-extracted units.
/* ============================================================
   BeDeveloped — Base Layers (v2) — src/main.js
   Phase 4 Wave 5 (D-02 / D-03 / D-06 / D-12): terminal cutover. The
   legacy `app.js` IIFE that served as the single bootstrap from Phase 0
   through Wave 4 is re-homed here as src/main.js. index.html's script
   tag flips to ./src/main.js in this same atomic commit. The IIFE body
   stays intact (D-12 + Wave 4 Dev #1 + Wave 3 Dev #1 — the snapshot
   baselines at tests/__snapshots__/views/{dashboard,diagnostic,report}
   .html are the rendered-DOM contract); a follow-up wave migrates the
   IIFE-resident renderX functions into the src/views/*.js stub Pattern D
   DI factories that Wave 4 created (84bbed2 / 8edb169).

   - Login (internal + client roles)
   - Multi-user diagnostic, per-user responses
   - Assessment rounds with radar overlay (current vs previous)
   - Comments thread per pillar with unread tracking
   - Data isolation: clients see only their org
   ============================================================ */

// CRITICAL D-06: src/firebase/app.js MUST be the FIRST functional import —
// initializeApp + initAppCheck (Phase 4 = no-op stub; Phase 7 = real
// reCAPTCHA Enterprise) MUST run before any data/* or views/* code touches
// the Firebase SDK. Phase 7 (FN-04) wires the App Check body into the
// existing slot — zero adapter-shape change between phases.
import "./firebase/app.js";
// Side-effect imports for Firebase SDK adapter feature submodules. These
// previously loaded as separate <script type="module"> tags in index.html
// (Wave 1 bridge tags); main.js now imports them transitively so the only
// application bootstrap script in index.html is ./src/main.js.
import "./firebase/auth.js";
import "./firebase/db.js";
import "./firebase/storage.js";
import "./ui/charts.js";

// Phase 6 Wave 5 (BLOCKER-FIX 1 wiring contract): named imports for the
// Firebase Auth helpers consumed by the Phase 6 sign-in / first-run / MFA
// views. main.js subscribes to onAuthStateChanged here, hydrates user.appClaims
// + user.appEnrolledFactors, and passes the 5 auth render fns into the router
// via the deps object so renderRoute's auth-state ladder takes precedence.
import {
  auth as fbAuthInstance,
  onAuthStateChanged as fbOnAuthStateChanged,
  onIdTokenChanged as fbOnIdTokenChanged,
  signInEmailPassword as fbSignInEmailPassword,
  signOut as fbSignOut,
  multiFactor as fbMultiFactor,
  updatePassword as fbUpdatePassword,
  sendSignInLinkToEmail as fbSendSignInLinkToEmail,
  // isSignInWithEmailLink + signInWithEmailLink imports deferred to user-testing
  // phase when the email-link MFA recovery flow is fully wired (06-WAVE-5-PARTIAL-STATE.md).
  sendEmailVerification as fbSendEmailVerification,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  beginTotpEnrollment as fbBeginTotpEnrollment,
  enrollTotp as fbEnrollTotp,
  unenrollAllMfa as fbUnenrollAllMfa,
  verifyMfaCode as fbVerifyMfaCode,
} from "./firebase/auth.js";
import { createAuthView } from "./views/auth.js";

// Phase 9 Wave 1 (OBS-01 + Pitfall 3): @sentry/browser boot. initSentryBrowser
// is called inside the fbOnAuthStateChanged callback below — AFTER claims
// hydration so setUser carries the verified UID + role (never PII like email).
// Empty VITE_SENTRY_DSN coalesces to "" and the init becomes a silent no-op
// (kill-switch + local-dev path; mirrors the FN-07 reCAPTCHA placeholder
// pattern in vite.config.js).
import { initSentryBrowser, setUser as sentrySetUser } from "./observability/sentry.js";
import { emitAuditEvent } from "./observability/audit-events.js";

// Application state singleton — extracted byte-identical to src/state.js
// (D-02). The IIFE closure references the imported binding directly; no
// shape change.
import { state } from "./state.js";
// Router dispatcher — setRoute + renderRoute extracted to src/router.js
// (D-02 / Pattern D DI per Phase 2 D-05). The IIFE closure provides the
// renderX functions via a deps object at the dispatcher call site.
import { setRoute as routerSetRoute, renderRoute as routerRenderRoute } from "./router.js";
// PLATFORM-UAT T17: role-predicate helpers. Most legacy
// `user.role === "internal"` checks across this file actually meant "is
// BeDeveloped staff" (admin OR internal). isStaff is the right predicate
// at almost every site; see src/auth/role-predicates.js for the contract.
import { isStaff, mfaEnrolmentRequiredForRole } from "./auth/role-predicates.js";
// Client-side 30-day session-age cap. Firebase's default persistence keeps
// returning users signed in indefinitely; isSessionExpired gates the boot path
// so a user whose last interactive sign-in is older than 30 days is bounced
// back to the sign-in screen. See src/auth/session-policy.js for the rationale.
import { isSessionExpired } from "./auth/session-policy.js";

// Phase 2 (D-04 supersedes Phase 1 D-14): index.html now loads this file as
// type="module". Imports below are populated by Waves 1-4.
//
// Waves that populate this block:
//   Wave 1 (Plan 02-02): src/util/ids.js, src/util/hash.js  [LANDED]
//   Wave 2 (Plan 02-03): src/domain/banding.js, src/domain/scoring.js
//   Wave 3 (Plan 02-04): src/domain/completion.js, src/domain/unread.js
//   Wave 4 (Plan 02-05): src/data/migration.js, src/data/cloud-sync.js
//   Phase 06.1 Wave 3 (AUTH-17 / D-16): legacy auth-helpers module +
//   legacy client sign-in branch + per-user password mutation + Change-
//   password modal DELETED atomically. Clients now sign in via Firebase
//   Auth identical to internal admins; closes HANDOFF.md follow-up #9.
//   Audit narrative for the deletion lives in SECURITY.md § Client
//   Authentication + .planning/phases/06.1-*/06.1-03-SUMMARY.md.
import {
  uid,
  iso,
  initials,
  // CODE-08 (Wave 4): firstNameFromAuthor moved to renderConversationBubble
  // helper in src/views/_shared/render-conversation.js. Aliased _* per
  // ^_ argsIgnorePattern (Wave 1 lint convention).
  firstNameFromAuthor as _firstNameFromAuthor,
} from "./util/ids.js";
import { hashString } from "./util/hash.js";
import { pillarStatus, bandLabel, bandStatement, bandColor } from "./domain/banding.js";
import {
  pillarScoreForRound as _pillarScoreForRound,
  pillarScore as _pillarScore,
  respondentsForRound,
  answeredCount as _answeredCount,
} from "./domain/scoring.js";
import { orgSummary as _orgSummary } from "./domain/completion.js";
import {
  unreadCountForPillar as _unreadCountForPillar,
  unreadCountTotal as _unreadCountTotal,
  unreadChatTotal as _unreadChatTotal,
} from "./domain/unread.js";
import { setPillarRead } from "./data/read-states.js";
import {
  migrateV1IfNeeded as _migrateV1IfNeeded,
  clearOldScaleResponsesIfNeeded as _clearOldScaleResponsesIfNeeded,
} from "./data/migration.js";
// Phase 4.1 / D-13 follow-up: the legacy 9-prop syncFromCloud() one-shot pull
// is gone. The orgs + users top-level collections are now hydrated via live
// `_subscribeOrgs` + `_subscribeUsers` snapshot listeners wired post-auth in
// the IIFE below. The new dispatcher contract (subscribeOrgMetadata + the
// (orgId, { onMetadata, attach, onError }) shape) in src/data/cloud-sync.js
// stays available for future per-org-detail hydration but is not used here.
// Phase 06.1 Wave 3 (AUTH-17 / D-16): legacy auth-helpers module import
// DELETED — module retired alongside the legacy client sign-in branch +
// per-user password mutation + Change-password modal. The single
// remaining reader (the legacyCurrentUser wrapper) is inlined below.
// Audit narrative for the deletion event lives in SECURITY.md § Client
// Authentication + 06.1-03-SUMMARY.md.
// Phase 06.1 Wave 1 Task 1 (AUTH-16 / RESEARCH § Critical Pinned Fact 1.1):
// length-floor gate for the org client passphrase. Admin SDK
// auth.createUser({password}) bypasses Identity Platform passwordPolicy, so
// the modal-submit chokepoint here is the load-bearing gate that keeps
// invited clients out of the bricked-first-sign-in failure mode. Pure-logic
// helper — zero firebase/* imports per CLAUDE.md domain/* invariant.
import { ORG_PASSPHRASE_MIN_LENGTH, validateOrgPassphrase } from "./auth/passphrase-policy.js";
import { setOrgPassphraseSecret, getOrgPassphraseSecret } from "./data/org-secrets.js";
// Phase 06.1 Wave 2 (AUTH-16 / D-14): inviteClient callable wrapper + AUTH-12
// chokepoint error classes. The Invite Client modal (openInviteClientModal,
// l.~4906) calls inviteClient on submit; PassphraseInvalidError / CrossOrgError /
// PassphraseNotSetError surface err.message inline so the modal stays open
// for the admin to correct. Wave 1 added the 3 error classes at src/firebase/
// auth.js; Wave 2 wires them into the modal here.
import {
  inviteClient,
  deleteClient,
  inviteInternal,
  deleteInternal,
} from "./cloud/invite-admin.js";
import { PassphraseInvalidError, CrossOrgError, PassphraseNotSetError } from "./firebase/auth.js";
// Phase 4 Wave 2 (D-12): ui/* helpers extracted from app.js IIFE.
// Closes runbooks/phase-4-cleanup-ledger.md row at app.js:676 (CODE-04 — html:
// branch deleted in src/ui/dom.js) and app.js:527 (the no-unused-vars
// disable for $$ — now legitimately exported).
// $$ is exported from src/ui/dom.js for Wave 4 view consumers; aliased to _$$
// here so app.js's per-file `no-unused-vars` rule (^_ argsIgnorePattern)
// permits the unused import without re-introducing an eslint-disable.
import { h, $, $$ as _$$ } from "./ui/dom.js";
import { createVisibilityToggle } from "./ui/password-toggle.js";
import { pendingButton } from "./ui/pending-button.js";
import { createPassphraseReveal } from "./ui/passphrase-reveal.js";
import { modal, promptText, confirmDialog } from "./ui/modal.js";
// formatWhen/iso/initials/firstNameFromAuthor already imported above from
// ./src/util/ids.js — Wave 4 may switch consumers to ./src/ui/format.js
// per ARCHITECTURE.md §2 helpers-table import path. The re-export module
// exists; consumers stay on util/ids.js this wave (D-12 faithful extraction).
import { notify, dismissAllToasts } from "./ui/toast.js";
import {
  validateUpload,
  ALLOWED_MIME_TYPES as _ALLOWED_MIME_TYPES,
  MAX_BYTES as _MAX_BYTES,
} from "./ui/upload.js";
// Wave 4 (D-20): notify wired (CODE-07 closes 7 alert() sites);
// validateUpload wired (CODE-09 closes documents-upload trust boundary at
// app.js:3201 — runs BEFORE saveDocument). ALLOWED_MIME_TYPES / MAX_BYTES
// remain _-aliased — they are exported for cross-tier reuse (Phase 5
// storage.rules + Phase 7 callable will reference the same constants).
// Phase 5 + Phase 7 are the actual server-side trust boundaries; client-side
// is the UX/audit-narrative layer per D-15. No new eslint-disable rows
// added (Phase 4 D-17 ledger zero-out).
import { createChrome } from "./ui/chrome.js";
// Phase 4 Wave 4 (CODE-10 / D-20): tab-title unread badge memoisation —
// only writes document.title when value differs. Setter lives in src/views/
// chat.js (the view that owns the tab-title surface).
import { setTitleIfDifferent } from "./views/chat.js";
// Phase 4 Wave 4 (CODE-08 / D-20): shared bubble helper for chat +
// funnel-comment renderers (M8 chat/funnel duplication closure target).
// Both IIFE renderers call renderConversationBubble for each message —
// chat passes `chat-bubble`/`chat-bubble-meta`/`chat-bubble-text`/
// `chat-bubble-del` class set; funnel passes `comment-bubble`/etc. The
// bubble shape stays visually identical to pre-Wave-4 production DOM.
import { renderConversationBubble } from "./views/_shared/render-conversation.js";
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
} from "./data/orgs.js";
import {
  getUser as _getUser,
  listUsers as _listUsers,
  saveUser as _saveUser,
  deleteUser as _deleteUser,
  subscribeUsers as _subscribeUsers,
} from "./data/users.js";
import {
  getRoadmap as _getRoadmap,
  listRoadmaps as _listRoadmaps,
  saveRoadmap as _saveRoadmap,
  deleteRoadmap as _deleteRoadmap,
  subscribeRoadmaps as _subscribeRoadmaps,
} from "./data/roadmaps.js";
import {
  getFunnel as _getFunnel,
  listFunnels as _listFunnels,
  saveFunnel as _saveFunnel,
  deleteFunnel as _deleteFunnel,
  subscribeFunnels as _subscribeFunnels,
} from "./data/funnels.js";
import {
  listFunnelComments as _listFunnelComments,
  addFunnelComment as _addFunnelComment,
  deleteFunnelComment as _deleteFunnelComment,
  subscribeFunnelComments as _subscribeFunnelComments,
} from "./data/funnel-comments.js";
import {
  getAllowlistEntry as _getAllowlistEntry,
  listAllowlist as _listAllowlist,
} from "./data/allowlist.js";

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
    // en-GB pinned: snapshot tests run on Linux CI (en-US default) but
    // committed baselines were captured in UK locale ("1 Dec 2025"). BeDeveloped
    // is a UK consultancy so en-GB is also the product-correct format.
    return new Date(when).toLocaleDateString("en-GB", {
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
  // Phase 06.1 Wave 3 (AUTH-17 / D-16): `findUserByEmail` helper DELETED.
  // Its only caller (the legacy client sign-in branch + the legacy Invite
  // modal short-circuit) is gone — server-side `auth.getUserByEmail` in
  // the `inviteClient` callable handles email-based user lookup now. Per
  // RESEARCH § 4 ("If unused, remove the helper") at phase author time.
  function upsertUser(user) {
    const users = loadUsers();
    const i = users.findIndex((u) => u.id === user.id);
    if (i >= 0) users[i] = user;
    else users.push(user);
    saveUsers(users);
    cloudPushUser(user);
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
      engagement: { currentStageId: "diagnosed" },
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
  // orgSummary injects DATA + pillarScore; unread wrappers
  // inject saveOrg / commentsFor / state / lastReadMillis / msgMillis
  // (all defined later in the IIFE — safe because wrappers resolve those names
  // at call time, by which point they exist in scope).
  const orgSummary = (org) => _orgSummary(org, DATA, pillarScore);
  // Phase 5 Wave 4 (DATA-07 / H7 fix): the domain comparators were rewritten
  // to consume server-time Timestamp values via duck-typed toMillis(). The
  // IIFE here still works against the legacy parent-doc readStates (ISO
  // strings) + state.chatMessages (mixed ISO/Timestamp via msgMillis); the
  // wrappers below adapt those legacy shapes to the new Timestamp-shaped
  // signatures so the IIFE boot path keeps rendering. The Phase 4 4.1
  // main.js-body-migration sub-wave migrates these IIFE-resident render
  // functions into views/* (Pattern D DI factories) which read directly
  // from data/read-states.js + data/comments.js + data/messages.js (server-
  // time Timestamp natives) and these wrappers retire.
  /** @param {string|null|undefined} iso */
  const _toTsFromIso = (iso) => (iso ? { toMillis: () => Date.parse(iso) || 0 } : null);
  /** @param {{ createdAt?: * }} c */
  const _toCommentDuck = (c) => {
    if (!c || !c.createdAt) return c;
    if (typeof c.createdAt === "object" && typeof c.createdAt.toMillis === "function") return c;
    return { ...c, createdAt: { toMillis: () => new Date(c.createdAt).getTime() || 0 } };
  };
  const unreadCountForPillar = (org, pillarId, user) => {
    const lastIso = ((org.readStates || {})[user.id] || {})[pillarId];
    const list = commentsFor(org, pillarId, user).map(_toCommentDuck);
    return _unreadCountForPillar(_toTsFromIso(lastIso), list, user.id);
  };
  const unreadCountTotal = (org, user) => {
    /** @type {Record<string, *>} */
    const pillarReads = {};
    /** @type {Record<string, Array<*>>} */
    const commentsByPillar = {};
    const userReads = (org.readStates || {})[user.id] || {};
    for (const p of DATA.pillars) {
      pillarReads[String(p.id)] = _toTsFromIso(userReads[p.id]);
      commentsByPillar[String(p.id)] = commentsFor(org, p.id, user).map(_toCommentDuck);
    }
    return _unreadCountTotal(pillarReads, commentsByPillar, user.id, DATA.pillars);
  };
  const unreadChatTotal = (user) => {
    if (!user) return 0;
    const messages = (state.chatMessages || []).map((m) => {
      if (
        m &&
        m.createdAt &&
        typeof m.createdAt === "object" &&
        typeof m.createdAt.toMillis === "function"
      )
        return m;
      return { ...m, createdAt: { toMillis: () => msgMillis(m) } };
    });
    /** @param {string} orgId */
    const lastReadForOrg = (orgId) => ({ toMillis: () => lastReadMillis(user.id, orgId) });
    return _unreadChatTotal(user, messages, lastReadForOrg);
  };
  // The legacy per-org client unread helper was deleted (caller migrated to

  // Phase 2 Wave 4 (D-05): wrappers for migration helpers (Pattern E).
  // Bodies extracted to src/data/migration.js.
  const migrateV1IfNeeded = () =>
    _migrateV1IfNeeded({
      loadUsers,
      loadOrgMetas,
      loadOrg,
      saveOrg,
      upsertUser,
      findUser,
      removeV1ActiveKey: () => LS.removeItem(K.v1Active),
    });
  const clearOldScaleResponsesIfNeeded = () =>
    _clearOldScaleResponsesIfNeeded({
      loadSettings,
      saveSettings,
      loadOrgMetas,
      loadOrg,
      saveOrg,
    });
  // Phase 4.1 / D-13 follow-up: the legacy one-shot syncFromCloud() pull
  // (was: `_syncFromCloud({ fbReady, cloudFetchAllOrgs, cloudFetchAllUsers,
  // cloudPushOrg, cloudPushUser, jget, jset, K, render })`) had been silently
  // no-op'd by the H8 dispatcher rewrite, leaving the orgs + users top-level
  // collections un-hydrated on app boot. Replaced post-auth (search:
  // "_subscribeOrgs(" below) by live `_subscribeOrgs` + `_subscribeUsers`
  // listeners that hydrate K.orgs / K.org(id) / K.users on every snapshot.
  // Phase 06.1 Wave 3 (AUTH-17 / D-16): legacy passphrase + per-user
  // password verification wrappers DELETED alongside the auth module they
  // wrapped. Client sign-in now routes through Firebase Auth
  // signInEmailPassword (src/firebase/auth.js) identically to internal
  // admins; AUTH-12 chokepoint handles error mapping. The legacyCurrentUser
  // + currentUser pair below survives — still used by other surfaces
  // hydrating from localStorage during the IIFE→modular migration window
  // (Phase 4 sub-wave 4.1 carry-forward). The currentUser body is inlined
  // here (formerly: `const s = currentSession(); return s ? findUser(s.userId) : null;`).
  const legacyCurrentUser = () => {
    const s = currentSession();
    return s ? findUser(s.userId) : null;
  };
  // currentUser() now prefers the Phase 6 Firebase-hydrated user (state.fbUser) —
  // legacy localStorage path remains for client/user role flows.
  const currentUser = () => state.fbUser || legacyCurrentUser();

  // Phase 2 (D-05): orgSummary extracted to src/domain/completion.js — wrapper above.

  function topConstraints(org, n = 3) {
    return DATA.pillars
      .map((p) => ({ p, s: pillarScore(org, p.id) }))
      .filter((x) => x.s !== null)
      .sort((a, b) => a.s - b.s)
      .slice(0, n)
      .map((x) => x.p);
  }

  // ---------- Comments ----------
  // PLATFORM-UAT T13 (2026-05-25): per-pillar comments down-scoped — the
  // composer + thread UI (renderComments at L2094) was orphaned during the
  // Phase 4 modular split and never rewired. Local addComment() that backed
  // it has been removed. Per-pillar discussion now happens via the per-org
  // Chat tab. commentsFor() below is retained for backwards compatibility
  // with the unread-count machinery (chrome.js diagnostic-nav dot) so any
  // legacy comments in Firestore from prior engagements still register —
  // but no new comments can be created from the UI.
  function commentsFor(org, pillarId, user) {
    const list = (org.comments || {})[pillarId] || [];
    if (user && user.role === "client") return list.filter((c) => !c.internal);
    return list;
  }

  // Phase 2 (D-05): unreadCountForPillar, unreadCountTotal extracted to src/domain/unread.js — wrappers above.
  // Phase 5 Wave 4 (DATA-07 / H7 fix): the legacy domain-side write helper
  // was DELETED from src/domain/unread.js; its callsite at line 1739 is rewired
  // to setPillarRead from data/read-states.js (server-clock write via
  // serverTimestamp). The IIFE wrappers above for unreadCountForPillar /
  // unreadCountTotal / unreadChatTotal still consume the OLD signatures; they
  // migrate in the Phase 4 4.1 main.js-body-migration sub-wave.

  // ---------- Auth ----------
  function currentSession() {
    return jget(K.session, null);
  }
  // Phase 06.1 Wave 3 (AUTH-17 / D-16): currentUser body inlined into
  // legacyCurrentUser above. Was extracted to a separate auth-helpers
  // module in Phase 2 D-05; that module retired this wave.
  function signIn(userId) {
    jset(K.session, { userId });
  }
  async function signOut() {
    stopChatSubscription();
    LS.removeItem(K.session);
    await fbSignOut();
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
  // Phase 5 Wave 4 (DATA-07 / H7 fix): unreadChatForOrg deleted - the only
  // caller was the IIFE unreadChatTotal wrapper, which now routes through
  // the new server-time domain comparator (_unreadChatTotal) via the
  // lastReadForOrg accessor. The per-org client unread count flows through
  // the same domain function path now.
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
    // Phase 6 Wave 5 cutover-recovery (2026-05-09): top-level /messages was the
    // pre-migration legacy path; Phase 5 rules only cover /orgs/{orgId}/messages
    // (subcollection). Internal users no longer get a cross-org global view here
    // (that wider read pattern was always unsound under the strict rules); for
    // Step 11 we use the active-org subcollection which is what the unread-count
    // comparator (domain/unread.js) is built around. Tracked in Wave 6 06-06.
    const targetOrgId = user.orgId || state.activeOrgId;
    if (!targetOrgId) return;
    q = firestore.collection(db, "orgs", targetOrgId, "messages");
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
    const unread = isStaff(user) ? unreadChatTotal(user) : 0;
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

  // Phase 6 Wave 5 (AUTH-14 / D-04): INTERNAL_ALLOWED_EMAILS + INTERNAL_PASSWORD_HASH
  // + isAllowedInternalEmail removed alongside the legacy doInternalLogin form
  // and the verifyInternalPassword wrapper. Internal admin authentication now
  // routes through Firebase Auth (src/firebase/auth.js signInEmailPassword) +
  // beforeUserCreated/beforeUserSignedIn blocking handlers + custom-claim role.

  // ---------- Client org passphrase (shared by all users of an org) ----------
  async function setOrgClientPassphrase(orgId, pass) {
    // Phase 06.1 Wave 1 Task 1 (AUTH-16 / RESEARCH § Critical Pinned Fact 1.1):
    // ≥12-char length floor enforced HERE — the modal-submit chokepoint that
    // every Set/Change Passphrase route lands at. Admin SDK
    // auth.createUser({password}) bypasses Identity Platform passwordPolicy,
    // so without this gate Wave 2's inviteClient.ts would succeed but the
    // invited client would be bricked at first signInWithEmailAndPassword
    // (auth/password-does-not-meet-requirements).
    if (!validateOrgPassphrase(pass)) return false;
    const org = loadOrg(orgId);
    if (!org) return false;
    org.clientPassphraseHash = await hashString(pass);
    saveOrg(org);
    // Also stash the plaintext in the staff-only orgSecrets/{orgId} doc so
    // internal/admin can view it later (Set-passphrase modal reveal row). The
    // hash above stays the verify source of truth — this is best-effort so a
    // secrets-write failure never blocks setting the passphrase itself.
    try {
      await setOrgPassphraseSecret(orgId, pass);
    } catch (_e) {
      /* best-effort — passphrase still works; only the reveal degrades */
    }
    return true;
  }
  // Phase 06.1 Wave 3 (AUTH-17 / D-16): the legacy reader's sole caller
  // (inside the deleted client sign-in branch) is gone, but per RESEARCH
  // § Critical Pinned Fact 1 + CONTEXT D-16 PRESERVE list this predicate
  // remains as part of the org-passphrase mechanism (the LOAD-BEARING
  // bootstrap-credential substrate). Future surfaces (e.g. Admin Clients
  // "needs passphrase setup" badge) may consume it. eslint-disable is
  // for the temporary no-caller window between Wave 3 cutover and any
  // future surface that wires it back in.
  // eslint-disable-next-line no-unused-vars
  function orgHasClientPassphrase(orgId) {
    const org = loadOrg(orgId);
    return !!(org && org.clientPassphraseHash);
  }

  // Phase 06.1 Wave 3 (AUTH-17 / D-16): per-user password mutation +
  // verification helpers DELETED. Per-user password mutation is now
  // Firebase Auth's responsibility (signInEmailPassword + updatePassword
  // + sendPasswordResetEmail). The legacy passwordHash field on
  // users/{uid} is stripped by scripts/strip-legacy-user-passwords/run.js
  // (expected count 0 per HANDOFF.md).

  // Phase 2 (D-05): extracted to src/data/migration.js — wrappers above.

  // ---------- State ----------
  // Phase 4 Wave 5 (D-02): state singleton extracted to src/state.js — the
  // import binding at top of file (`import { state } from "./state.js"`)
  // brings the same closure-captured object into scope. The state.mode
  // initial value reads from localStorage at module load (mirrors app.js's
  // jget(K.mode, "internal") shape verbatim — see src/state.js).

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
  // Phase 4 Wave 5 (D-02): setRoute delegates to src/router.js — the IIFE
  // closure provides render() via deps so the router module stays
  // independent of IIFE-locals (loadOrg / currentUser / jset / K / etc.).
  function setRoute(route) {
    routerSetRoute(route, { render });
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
      // Cold-load flash guard: on first paint Firebase hasn't yet reported the
      // persisted session (onAuthStateChanged is async), so `user` is null even
      // for an already-signed-in user. Painting the sign-in screen here and
      // then swapping to the app a beat later is the "login screen flashes"
      // glitch. Until auth resolves, show a neutral branded splash instead —
      // the first onAuthStateChanged fire (user OR null) flips authResolved and
      // re-renders into the real screen. Legacy localStorage users are never
      // null here (currentUser() resolved them synchronously), so they skip the
      // splash entirely.
      if (!state.authResolved) {
        app.appendChild(renderSplash());
        return;
      }
      // Pre-auth routes: forgot-password (and forgot-mfa) need to be reachable
      // without an active Firebase session, so check them before falling
      // through to the legacy renderAuth login screen.
      if (state.route === "forgot-password") {
        app.appendChild(authView.renderForgotPassword());
        return;
      }
      if (state.route === "forgot-mfa") {
        app.appendChild(authView.renderForgotMfa());
        return;
      }
      // MFA challenge: signInEmailPassword threw MfaRequiredError, the
      // wrapper stashed the resolver + flipped the route. auth.currentUser is
      // still null at this point — the resolveSignIn call inside verifyMfaCode
      // is what produces the signed-in user. Gate on state.mfaResolver so a
      // stale route value can't render an empty challenge form.
      if (state.route === "mfa-challenge" && state.mfaResolver) {
        app.appendChild(authView.renderMfaChallenge());
        return;
      }
      app.appendChild(renderAuth());
      return;
    }

    // Phase 6 Wave 5 (BLOCKER-FIX 1 / D-16 router auth-state ladder, mirrored inline):
    // For Firebase-authed users (state.fbUser), check the auth-state guards
    // BEFORE the existing topbar+org+route flow. Legacy localStorage users
    // (state.fbUser is null but legacyCurrentUser returns a user) skip these
    // checks — their auth path is unchanged.
    if (state.fbUser && user === state.fbUser) {
      if (state.fbUser.emailVerified === false) {
        app.appendChild(authView.renderEmailVerificationLanding());
        return;
      }
      if (state.fbUser.firstRun === true) {
        app.appendChild(authView.renderFirstRun());
        return;
      }
      if (state.route === "forgot-mfa") {
        app.appendChild(authView.renderForgotMfa());
        return;
      }
      const role = state.fbUser.appClaims && state.fbUser.appClaims.role;
      const enrolled = state.fbUser.appEnrolledFactors;
      const hasMfa = enrolled && enrolled.length > 0;
      // Explicit-route entry: forgot-MFA flow's "I have signed in - un-enrol"
      // button calls routeToMfaEnrol after the un-enrol completes; this match
      // makes the route reachable. Also gives the gate below a non-forced way
      // in (e.g. operator chooses to re-enrol).
      const wantsMfaEnrol = state.route === "mfa-enrol";
      // MFA enrolment is mandatory for every signed-in role — staff AND
      // clients (clients were exempt before 2026-06). See
      // mfaEnrolmentRequiredForRole for the single-source-of-truth role set.
      const mustMfaEnrol = mfaEnrolmentRequiredForRole(role) && !hasMfa;
      if (wantsMfaEnrol || mustMfaEnrol) {
        if (!state.qrcodeDataUrl) startMfaEnrolFlow();
        app.appendChild(authView.renderMfaEnrol());
        return;
      }
    }

    // Mount shell
    app.appendChild(renderTopbar(user));
    const main = h("main");
    app.appendChild(main);

    const org = activeOrgForUser(user);
    // Subscribe to the /orgs/{orgId}/responses subcollection for the active
    // org so diagnostic answers sync cross-device (Phase 5 DATA-01 read path).
    // No-op when fbReady() is false (tests + pre-auth) or when already
    // subscribed to the same orgId.
    ensureResponsesSubscription(org ? org.id : null);

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

  // Phase 4 Wave 5 (D-02): renderRoute delegates to src/router.js's
  // renderRoute. The IIFE closure provides each renderX function via the
  // deps object — router.js stays independent of IIFE-locals (loadOrg /
  // currentUser / etc.) while owning the dispatcher SHAPE. The byte-identical
  // logical structure (route → renderX dispatch + admin gating + unknown
  // fallback) is preserved.
  function renderRoute(main, user, org) {
    routerRenderRoute(main, user, org, {
      isClientView,
      renderDashboard,
      renderDiagnosticIndex,
      renderPillar,
      renderActions,
      renderEngagement,
      renderReport,
      renderDocuments,
      renderChat,
      renderRoadmap,
      renderFunnel,
      renderAdmin,
    });
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
    // Phase 06.1 Wave 3 (AUTH-17 / D-16): the legacy Change-password modal
    // dispatch entry DELETED alongside the modal definition + the chrome
    // user-menu entry that consumed it.
    exportData,
    importData,
  });

  // ================================================================
  // PHASE 6 AUTH VIEW (BLOCKER-FIX 1 wiring)
  // ================================================================
  // Pattern D DI factory bound once with all Firebase Auth helpers + nav
  // callbacks. renderAuth (legacy entry) hands off to authView.renderSignIn()
  // for internal admins. The render() top-level dispatcher injects authView's
  // 5 render fns inline as the auth-state ladder per src/router.js D-16.

  // Closure-scoped transient secret for the in-flight TOTP enrolment.
  // Lives only as long as the enrolment ceremony — cleared on success/abort.
  // Held outside `state` so it can't accidentally serialize anywhere.
  /** @type {*} */
  let inflightTotpSecret = null;

  // Kicks off TOTP enrolment: requests a fresh secret from Firebase, renders
  // the otpauth:// URI to a QR data URL via the qrcode lib (dynamically
  // imported to keep ~80KB out of the main bundle), stuffs it into
  // state.qrcodeDataUrl, and re-renders so renderMfaEnrol picks up the QR.
  async function startMfaEnrolFlow() {
    if (inflightTotpSecret) return;
    try {
      const { secret, totpUri } = await fbBeginTotpEnrollment();
      inflightTotpSecret = secret;
      const qrcodeMod = await import("qrcode");
      const QRCode = /** @type {*} */ (qrcodeMod).default || qrcodeMod;
      state.qrcodeDataUrl = await QRCode.toDataURL(totpUri);
      render();
    } catch (err) {
      inflightTotpSecret = null;
      notify("error", (err && /** @type {*} */ (err).message) || "Could not start MFA enrolment");
    }
  }

  const authView = createAuthView({
    state,
    h,
    notify,
    // Wrap signInEmailPassword so MfaRequiredError (thrown when the account has
    // MFA enrolled) is caught here and routed to the challenge view instead of
    // surfacing as a raw error in the sign-in form. Resolver lives in
    // state.mfaResolver for the duration of the challenge.
    signInEmailPassword: async (email, password) => {
      try {
        return await fbSignInEmailPassword(email, password);
      } catch (err) {
        if (err && /** @type {*} */ (err).name === "MfaRequiredError") {
          state.mfaResolver = /** @type {*} */ (err).resolver;
          setRoute("mfa-challenge");
          render();
          return undefined;
        }
        throw err;
      }
    },
    signOut: fbSignOut,
    updatePassword: fbUpdatePassword,
    sendSignInLinkToEmail: fbSendSignInLinkToEmail,
    sendEmailVerification: fbSendEmailVerification,
    sendPasswordResetEmail: fbSendPasswordResetEmail,
    routeToForgotMfa: () => setRoute("forgot-mfa"),
    routeToMfaEnrol: () => setRoute("mfa-enrol"),
    routeToForgotPassword: () => setRoute("forgot-password"),
    routeToSignIn: () => setRoute("dashboard"),
    // Live getters so the view sees fresh Firebase state on each access.
    get currentUser() {
      return fbAuthInstance.currentUser;
    },
    get qrcodeDataUrl() {
      return state.qrcodeDataUrl || "";
    },
    get isMfaRecoveryFlow() {
      return state.route === "forgot-mfa";
    },
    get mfaResolver() {
      return state.mfaResolver;
    },
    verifyMfaCode: async (resolver, code) => {
      const result = await fbVerifyMfaCode(resolver, code);
      // Clear the transient resolver + flip the route so the post-auth render
      // doesn't briefly mount renderMfaChallenge against a now-stale resolver.
      // onAuthStateChanged will pick up the new currentUser + drive a render.
      state.mfaResolver = null;
      setRoute("dashboard");
      return result;
    },
    cancelMfaChallenge: () => {
      state.mfaResolver = null;
      setRoute("dashboard");
      render();
    },
    enrollTotp: async (verificationCode) => {
      if (!inflightTotpSecret) {
        throw new Error("Enrolment session expired — refresh and try again.");
      }
      await fbEnrollTotp(inflightTotpSecret, verificationCode);
      inflightTotpSecret = null;
      state.qrcodeDataUrl = null;
      // Re-hydrate enrolledFactors on the user shim so the auth-ladder gate
      // sees the new factor immediately and stops re-rendering MFA enrol.
      if (state.fbUser && fbAuthInstance.currentUser) {
        try {
          state.fbUser.appEnrolledFactors =
            fbMultiFactor(fbAuthInstance.currentUser).enrolledFactors || [];
        } catch (_e) {
          state.fbUser.appEnrolledFactors = [];
        }
      }
      if (state.route === "mfa-enrol") state.route = "dashboard";
      notify("info", "Two-factor authentication enrolled.");
      render();
    },
    unenrollAllMfa: fbUnenrollAllMfa,
  });

  // ================================================================
  // SPLASH (cold-load, pre-auth-resolution)
  // ================================================================
  // Neutral holding screen shown on the initial paint while Firebase Auth
  // resolves the persisted session (see the authResolved gate in render()).
  // Deliberately minimal — just the wordmark on the app background — so a
  // returning, already-signed-in user sees a calm loading state that dissolves
  // straight into the app, never the sign-in form. Mirrors the static markup
  // seeded in index.html's #app so there is no white flash before this mounts.
  function renderSplash() {
    return h("div", { class: "auth-splash", role: "status", "aria-label": "Loading" }, [
      h("img", { class: "auth-splash-logo", src: "assets/logo.png?v=54", alt: "BeDeveloped" }),
    ]);
  }

  // ================================================================
  // AUTH / LOGIN SCREEN (legacy)
  // ================================================================
  function renderAuth() {
    const wrap = h("div", { class: "auth-wrap" });

    // Hero side
    wrap.appendChild(
      h("div", { class: "auth-hero" }, [
        h("img", { class: "hero-logo", src: "assets/logo.png?v=54", alt: "BeDeveloped" }),
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

    // Phase 06.1 Wave 3 (AUTH-17 / D-16): the auth-tabs container + the
    // legacy client sign-in branch (legacy client sign-in form against
    // passphrase + per-user password hash + email-lookup short-circuit)
    // DELETED. Clients now sign in via Firebase Auth identical to
    // internal admins — the same Pattern D auth view's renderSignIn
    // wraps Firebase Auth signInWithEmailAndPassword with the AUTH-12
    // unified-error chokepoint. On successful sign-in,
    // onAuthStateChanged hydrates state.fbUser and triggers render();
    // the auth-state ladder in render() then routes through firstRun /
    // mfaEnrol / dashboard per claims state. The legacy auth-tab field
    // in src/state.js is now dead-coded (no readers in src/main.js); the
    // field is preserved for state-shape compatibility with the wider
    // IIFE migration but is no longer mutated or branched on. Phase 6
    // BLOCKER-FIX 1 wiring (the renderSignIn view) is the canonical
    // entry point.
    container.appendChild(authView.renderSignIn());

    return container;
  }

  // ================================================================
  // NO ORG
  // ================================================================
  function renderNoOrg(user) {
    if (user.role === "client") {
      return h("div", { class: "card u-text-center u-pad-48" }, [
        h("h2", { class: "u-mt-0" }, "No organisation assigned"),
        h(
          "p",
          { class: "card-empty-text-client" },
          "Your client account isn't linked to an organisation yet. Please contact your BeDeveloped team lead to finish setup.",
        ),
      ]);
    }
    return h("div", { class: "card u-text-center u-pad-48" }, [
      h("h2", { class: "card-h2-large" }, "Create your first client engagement"),
      h(
        "p",
        { class: "card-empty-text-internal" },
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

    // Staff-only (admin OR internal): alert banner for unread client chat messages across all orgs
    if (isStaff(user)) {
      const unreadChat = unreadChatTotal(user);
      if (unreadChat > 0) {
        frag.appendChild(
          h("div", { class: "unread-chat-banner" }, [
            h("div", { class: "unread-chat-badge" }, String(unreadChat)),
            h("div", { class: "u-flex1-ink" }, [
              h(
                "div",
                { class: "u-fw-600" },
                `${unreadChat} unread client message${unreadChat === 1 ? "" : "s"}`,
              ),
              h(
                "div",
                { class: "unread-chat-sub" },
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
          ]),
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
    const tilesHeader = h("div", { class: "tiles-header-bar" }, [
      h("h2", { class: "u-m-0" }, "The ten pillars"),
      h(
        "button",
        {
          class: "btn ghost sm u-btn-line-ghost",
          onclick: () => {
            if (state.expandedPillars.size === DATA.pillars.length) state.expandedPillars.clear();
            else DATA.pillars.forEach((p) => state.expandedPillars.add(p.id));
            render();
          },
        },
        state.expandedPillars.size === DATA.pillars.length ? "Collapse all" : "Expand all",
      ),
    ]);
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
      const scoreWrap = h("div", { class: "pillar-score-wrap" });
      scoreWrap.appendChild(h("div", { class: "score" }, s !== null ? `${s}` : "—"));
      if (s !== null && prevS !== null) {
        const d = s - prevS;
        const cls = d > 0 ? "delta-up" : d < 0 ? "delta-down" : "delta-same";
        const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "=";
        scoreWrap.appendChild(
          h("span", { class: `${cls} pillar-score-arrow` }, `${arrow} ${Math.abs(d)}`),
        );
      }
      foot.appendChild(scoreWrap);

      const rightFoot = h("div", { class: "pillar-rightfoot" });
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

    const foot = h("div", { class: "foot pillar-foot-end" });
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
        class: "respondent-stack round-meta-inline",
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
        h("span", { class: "round-meta round-meta-ml" }, `· previous: ${prevRound.label}`),
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
          ? "View your responses here. If anything is empty, please contact Luke or George to complete it."
          : "Score each pillar against its diagnostic questions.",
      ),
    );

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
            ? `Team score ${s !== null ? s + "/100" : "—"}`
            : `${userDone}/${total} of your answers · team score ${s !== null ? s + "/100" : "—"}`,
        ),
      );
      const foot = h("div", { class: "foot" });
      foot.appendChild(h("div", { class: "score" }, s !== null ? `${s}` : "—"));
      const badgeWrap = h("div", { class: "badge-wrap" });
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

    // Delivery framework — formerly its own top-nav route ("engagement").
    // Consolidated into Diagnostic so the topnav fits on laptop widths
    // without horizontal scroll. renderEngagement renders an h2 section
    // (not an h1 page title) so it sits cleanly under the pillar tiles.
    frag.appendChild(h("hr", { class: "section-divider" }));
    frag.appendChild(renderEngagement());

    return frag;
  }

  // ================================================================
  // PILLAR DETAIL
  // ================================================================
  function renderPillar(user, org, pillarId) {
    const p = DATA.pillars.find((x) => x.id === pillarId);
    if (!p) return h("div", {}, "Pillar not found.");

    // mark comments read on load (Phase 5 Wave 4 H7 fix: server-clock write via setPillarRead)
    void setPillarRead(org.id, user.id, pillarId);

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
          h("h1", { class: "view-title pillar-title-h1" }, p.name),
          h("p", { class: "view-sub pillar-tagline" }, p.tagline),
        ]),
        h("span", { class: `badge ${status}` }, s !== null ? `${s}/100 team` : "Not scored"),
      ]),
    );

    // Overview card
    frag.appendChild(h("div", { class: "card pillar-overview-card" }, [h("p", {}, p.overview)]));

    const grid = h("div", { class: "pillar-grid" });

    // Left: diagnostic questions (user's own)
    const left = h("div");
    left.appendChild(
      h("h3", {}, isClient ? "Diagnostic questions" : "Diagnostic questions (your responses)"),
    );
    p.diagnostics.forEach((q, idx) => {
      left.appendChild(renderQuestion(user, org, p, idx, q));
    });

    // Complete button - returns to the diagnostic landing (staff only:
    // clients have nothing to complete in the view-only diagnostic)
    if (!isClient) {
      left.appendChild(
        h("div", { class: "pillar-actions-foot" }, [
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
    }

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
        h("div", { class: "actions-card-header" }, [
          h("h3", { class: "u-m-0" }, "Actions"),
          isClient
            ? null
            : h(
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
          ? h("p", { class: "actions-empty-meta" }, "No actions yet.")
          : openActions.length === 0
            ? h("p", { class: "actions-empty-meta" }, "No open actions.")
            : h(
                "ul",
                {},
                openActions.map((a) => h("li", {}, a.title)),
              ),
        completedActions.length
          ? h("div", { class: "actions-divider" }, [
              h("div", { class: "outcomes-eyebrow" }, `Completed (${completedActions.length})`),
              h(
                "ul",
                { class: "u-m-0" },
                completedActions.map((a) =>
                  h("li", { class: "actions-completed-strike" }, a.title),
                ),
              ),
            ])
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
      h("div", { class: "stage-pct-bar" }, [
        h("span", {}, `1 - ${meta.anchors.low}`),
        h("span", {}, `${meta.scale} - ${meta.anchors.high}`),
      ]),
    );

    // Buttons — inert for clients (view-only diagnostic): no handler,
    // disabled, saved answers keep the `sel` highlight so previously
    // captured scoring stays visible.
    const readOnly = isClientView(user);
    const scaleClass = meta.scale === 10 ? "likert likert-10" : "likert likert-" + meta.scale;
    const likert = h("div", { class: scaleClass + (readOnly ? " read-only" : "") });
    // Clamp any stale responses to this question's scale so old data doesn't get stuck selected out-of-range.
    const selectedScore = resp.score >= 1 && resp.score <= meta.scale ? resp.score : null;
    for (let n = 1; n <= meta.scale; n++) {
      const attrs = {
        class: selectedScore === n ? "sel" : "",
        title: (meta.labels && meta.labels[n]) || DATA.scoreLabels[n] || String(n),
      };
      if (readOnly) {
        attrs.disabled = true;
      } else {
        attrs.onclick = () => {
          setResponse(user, org, p.id, idx, { score: n });
          render();
        };
      }
      const btn = h(
        "button",
        attrs,
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

    const panel = h("div", { class: "card team-responses-card" });
    panel.appendChild(
      h("h3", { class: "section-h3-tight" }, `Team responses (${users.length} respondents)`),
    );

    p.diagnostics.forEach((q, idx) => {
      const meta = questionMeta(q);
      const row = h("div", { class: "team-row" });
      row.appendChild(h("div", { class: "team-row-name" }, `Q${idx + 1}. ${meta.text}`));
      const scores = h("div", { class: "team-row-scores" });
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
            class: "score-pill",
          },
          [
            h("span", { class: "avatar team-tiny-pip" }, initials(u?.name || u?.email || "")),
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
      h("div", { class: "team-row-meta" }, `${done}/${total} team answers`),
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
      h("h3", { class: "section-h3-tight" }, title),
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
    const merged = Object.assign({}, cur, patch);
    o.responses[o.currentRoundId][user.id][pillarId][idx] = merged;
    // Local-only write — the in-memory model needs the new score for the
    // inline render() that follows this call.
    //
    // The Phase 5 (DATA-01) cutover moved responses to the
    // /orgs/{orgId}/responses/{respId} subcollection. The previous path
    // (saveOrg → cloudPushOrg → setDoc on /orgs/{orgId}) was rejected by
    // firestore.rules — clients cannot write the parent doc at all, and
    // internal users hit `immutable("createdAt")` whenever the local cache's
    // Timestamp-shape drifted from the server's. The subcollection rules
    // whitelist the right set of writers (userId == request.auth.uid on
    // create; mutableOnly values/updatedAt on update) so this path works
    // for both roles. See PR #37 / #38 trail for the full thread.
    jset(K.org(o.id), o);
    cloudPushResponse(o.id, o.currentRoundId, user.id, pillarId, idx, merged);
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
    const toolbar = h("div", { class: "stage-section-banner" }, [
      h("div", {}, `${all.length} total · ${all.filter((a) => a.done).length} complete`),
      h("button", { class: "btn", onclick: () => openActionModal(user) }, "+ New action"),
    ]);
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
      openTable.appendChild(h("div", { class: "empty-card" }, "No open actions."));
    } else {
      openActions.forEach((a) => openTable.appendChild(renderActionRow(a)));
    }
    frag.appendChild(openTable);

    // Completed actions, in their own section
    if (completedActions.length) {
      frag.appendChild(
        h("h2", { class: "section-banner-spread" }, `Completed (${completedActions.length})`),
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

    const dueWrap = h("div", { class: "due-wrap" });
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
        class: "btn ghost sm btn-line-soft",
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
    const select = h("select", { class: "settings-textarea-comment" });
    DATA.pillars.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = `${p.id}. ${p.name}`;
      select.appendChild(o);
    });
    const internalWrap = !isClientView(user)
      ? h("label", { class: "field-row" }, [
          h("input", { type: "checkbox", id: "actInternal" }),
          "Internal only (hidden from client view)",
        ])
      : null;

    const m = modal([
      h("h3", {}, "New action"),
      title,
      h("div", { class: "progress-spacer" }),
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
  // Renders the Delivery (engagement) framework as a section. Reachable
  // only from inside renderDiagnosticIndex now — the "Delivery" tab was
  // removed from the topnav and /engagement redirects to /diagnostic
  // (src/router.js). Uses section-level h2 instead of page-level h1 so
  // it composes correctly underneath the Diagnostic page title.
  function renderEngagement() {
    const frag = h("div", { class: "delivery-section" });
    frag.appendChild(h("h2", { class: "section-h2" }, "Delivery framework"));
    frag.appendChild(
      h("p", { class: "view-sub" }, "Every BeDeveloped engagement runs through four stages."),
    );

    // Static info cards — the click-to-highlight stage selector was removed
    // 2026-07 (the selected stage was read nowhere else in the app).
    const stages = h("div", { class: "stages" });
    DATA.engagementStages.forEach((s, i) => {
      stages.appendChild(
        h("div", { class: "stage-card" }, [
          h("div", { class: "n" }, `STAGE ${i + 1}`),
          h("div", { class: "name" }, s.name),
          h("div", { class: "sum" }, s.summary),
        ]),
      );
    });
    frag.appendChild(stages);
    return frag;
  }

  // ================================================================
  // REPORT
  // ================================================================
  // Phase 2 (D-05): bandLabel, bandStatement, bandColor extracted to src/domain/banding.js — re-imported at module top.

  function renderReport(user, org) {
    const frag = h("div");
    const summary = orgSummary(org);
    const constraints = topConstraints(org, 3);
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
        `${isClient ? "Client view" : "Internal view"} · ${round?.label || "Current round"} · Generated ${new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`,
      ),
    );

    // Intro block
    const intro = h("div", { class: "report-intro card report-intro-card" });
    intro.appendChild(
      h(
        "h2",
        { class: "report-intro-h2" },
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
    const pillarList = h("ol", { class: "report-pillar-ol" });
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

    const chartCard = h("div", { class: "card report-chart-card" });
    chartCard.appendChild(h("h3", { class: "report-chart-h3" }, "Results at a glance"));
    chartCard.appendChild(
      h(
        "p",
        { class: "report-chart-sub" },
        "Each slice is one pillar. Colours show where you're strong (green), developing (amber), or need focus (red).",
      ),
    );
    const canvasWrap = h("div", { class: "report-canvas-wrap" });
    const canvas = h("canvas", { id: "reportDonut" });
    canvasWrap.appendChild(canvas);
    chartCard.appendChild(canvasWrap);
    snap.appendChild(chartCard);

    const metricsCard = h("div", { class: "card" });
    metricsCard.appendChild(h("h3", { class: "section-h3-tight" }, "Summary"));
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
            { class: "report-summary-cell" },
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
    rp.appendChild(h("h2", { class: "report-section-h2-spaced" }, "Pillar detail"));
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
        block.appendChild(h("div", { class: "outcomes-eyebrow" }, "Actions"));
        const ul = h("ul", { class: "report-pillar-ul" });
        actions.forEach((a) =>
          ul.appendChild(
            h("li", { class: a.done ? "actions-completed-strike" : "" }, [
              a.title,
              a.owner ? ` · ${a.owner}` : "",
              a.due ? ` · due ${a.due}` : "",
            ]),
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

    const orgBar = h("div", { class: "toolbar-end" }, [
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
    ]);
    orgCard.appendChild(orgBar);

    if (!orgs.length) {
      orgCard.appendChild(h("p", { class: "muted-paragraph" }, "None yet."));
    } else {
      const table = h("div");
      orgs.forEach((m) => {
        const o = loadOrg(m.id);
        const clients = loadUsers().filter((u) => u.role === "client" && u.orgId === m.id);
        const currentTier = orgTier(o);
        const row = h("div", { class: "members-row" });
        row.appendChild(
          h("div", {}, [
            h("div", { class: "member-name-flex" }, [
              h("span", { class: "member-name-bold" }, m.name),
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
              { class: "member-meta-tiny" },
              `${o?.rounds?.length || 0} round(s) · ${respondentsForRound(o, o.currentRoundId).length} respondents`,
            ),
          ]),
        );
        const hasPass = !!(o && o.clientPassphraseHash);
        // With a passphrase set, the green badge carries the same masked
        // value + eye reveal as the Set-passphrase modal so admins can look
        // it up without opening the modal. Lazy: the orgSecrets doc is only
        // fetched when THIS row's eye is clicked — never in bulk on render.
        const passBadge = h(
          "div",
          {
            class: "pw-badge-line",
            style: `font-size:11px; margin-top:2px; color: ${hasPass ? "var(--green)" : "var(--amber)"};`,
          },
          hasPass ? "✓ passphrase set" : "⚠ no passphrase",
        );
        if (hasPass) {
          const { value, btn } = orgPassphraseReveal(m.id);
          passBadge.appendChild(value);
          passBadge.appendChild(btn);
        }
        row.appendChild(
          h("div", {}, [
            h("div", {}, `${clients.length} client user${clients.length === 1 ? "" : "s"}`),
            passBadge,
          ]),
        );
        row.appendChild(h("div", {}, formatDate(o?.createdAt)));
        const tierSelect = h("select", {
          title:
            "Tier determines roadmap cadence. Performance = 4 quarters. Transformation = 12 months.",
          class: "members-tier-pill",
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
          h("div", { class: "member-actions-row" }, [
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

    const userBar = h("div", { class: "toolbar-end" }, [
      h(
        "button",
        {
          class: "btn",
          onclick: () => openInviteClientModal(),
        },
        "+ Invite client",
      ),
    ]);
    usersCard.appendChild(userBar);

    if (!allClients.length) {
      usersCard.appendChild(
        h(
          "p",
          { class: "muted-paragraph" },
          "No client users yet. Invite someone to let them log in.",
        ),
      );
    } else {
      const table = h("div");
      table.appendChild(
        h("div", { class: "clients-table-head" }, [
          h("div", {}, "Name"),
          h("div", {}, "Email"),
          h("div", {}, "Organisation"),
          h("div", {}, ""),
        ]),
      );
      // Phase 06.1 Wave 3 (AUTH-17 / D-16): legacy "password set / awaiting
      // first sign-in" indicator + admin-side "Reset password" button
      // DELETED. Clients now use Firebase Auth (Phase 6 D-15 +
      // src/firebase/auth.js sendPasswordResetEmail); the admin-side
      // reset-via-passwordHash mutation is meaningless once the legacy
      // hash field is gone. Only the "Remove" affordance survives.
      allClients.forEach((u) => {
        const o = u.orgId ? loadOrgMetas().find((m) => m.id === u.orgId) : null;
        const row = h("div", { class: "clients-table-row" });
        row.appendChild(h("div", {}, u.name || "—"));
        row.appendChild(h("div", {}, u.email));
        row.appendChild(h("div", {}, o ? o.name : "— (unassigned)"));
        row.appendChild(
          h("div", { class: "clients-actions-row" }, [
            h(
              "button",
              {
                class: "btn ghost sm danger",
                onclick: () =>
                  confirmDialog(
                    "Remove client access?",
                    `${u.email} will no longer be able to sign in. Their responses from past rounds will remain in the data.`,
                    async () => {
                      // Phase 06.1 post-merge fix: client deletion goes through the
                      // deleteClient callable (Admin SDK auth.deleteUser + /users
                      // mirror doc delete in one server-side step). The previous
                      // local-only deleteUser(u.id) + cloudDeleteUser(u.id) path
                      // failed silently against firestore.rules:133 (server-only
                      // mutation invariant) AND left the Firebase Auth user as a
                      // sign-in-capable orphan.
                      // After deleteClient succeeds, update the LOCAL cache inline.
                      // Do NOT call deleteUser() — it chains through cloudDeleteUser
                      // which re-attempts the client-side Firestore delete and fails
                      // with the same rules-permission error (Firestore delete is
                      // idempotent but rules still gate it). The subscribeUsers
                      // snapshot listener will also pick up the server-side
                      // deletion; the inline saveUsers gives instant UI update
                      // without waiting on snapshot latency.
                      try {
                        await deleteClient({ uid: u.id });
                        saveUsers(loadUsers().filter((x) => x.id !== u.id));
                        render();
                      } catch (err) {
                        notify(
                          "error",
                          "Couldn't remove client: " + /** @type {*} */ (err.message || err),
                        );
                      }
                    },
                    "Remove",
                  ),
              },
              "Remove",
            ),
          ]),
        );
        table.appendChild(row);
      });
      usersCard.appendChild(table);
    }
    frag.appendChild(usersCard);

    // Internal team (BeDeveloped staff — admin + internal roles per T17 sweep)
    frag.appendChild(h("h2", {}, "Internal team"));
    const internals = loadUsers().filter((u) => isStaff(u));
    const intCard = h("div", { class: "card" });
    intCard.appendChild(
      h("div", { class: "toolbar-end" }, [
        h(
          "button",
          { class: "btn", onclick: () => openAddInternalModal() },
          "+ Add internal member",
        ),
      ]),
    );
    if (!internals.length) {
      intCard.appendChild(
        h(
          "p",
          { class: "muted-paragraph" },
          "No internal members yet. Add one to let them log in.",
        ),
      );
    } else {
      internals.forEach((u) => {
        intCard.appendChild(
          h("div", { class: "user-row" }, [
            h("span", { class: "avatar internal" }, initials(u.name || u.email)),
            h("div", { class: "u-flex-1" }, [
              h("div", { class: "invite-row-name" }, u.name || u.email),
              h("div", { class: "invite-row-email" }, u.email),
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
                        async () => {
                          // 2026-06: route through the server-side deleteInternal
                          // callable (Admin SDK deleteUser + /users mirror delete).
                          // The legacy local-only deleteUser(u.id) left a
                          // sign-in-capable Firebase Auth orphan. Update the local
                          // cache inline after success; subscribeUsers reflects it
                          // too.
                          try {
                            await deleteInternal({ uid: u.id });
                            saveUsers(loadUsers().filter((x) => x.id !== u.id));
                            render();
                          } catch (err) {
                            notify(
                              "error",
                              "Couldn't remove member: " + /** @type {*} */ (err.message || err),
                            );
                          }
                        },
                        "Remove",
                      ),
                  },
                  "Remove",
                )
              : h("span", { class: "invite-row-you" }, "you"),
          ]),
        );
      });
    }
    frag.appendChild(intCard);

    // Settings
    frag.appendChild(h("h2", {}, "Settings"));
    const settingsCard = h("div", { class: "card" });

    // MFA status — read-only chip showing whether the signed-in admin has
    // a second factor enrolled. The actual enrol/un-enrol flow still lives
    // in the renderMfaEnrol substrate (reached from sign-in); this row
    // just surfaces the current state so admins can see at a glance.
    // user.appEnrolledFactors is hydrated by main.js after every auth
    // state change (multiFactor(currentUser).enrolledFactors).
    const enrolledFactors = (state.fbUser && state.fbUser.appEnrolledFactors) || [];
    const hasMfa = enrolledFactors.length > 0;
    settingsCard.appendChild(
      h("div", { class: "settings-row" }, [
        h("div", { class: "settings-row-label" }, [
          h("div", { class: "settings-row-title" }, "Two-factor authentication"),
          h(
            "div",
            { class: "settings-row-sub" },
            hasMfa
              ? "You have a TOTP authenticator on file. Use it whenever you sign in."
              : "No second factor on file yet. You'll be asked to enrol an authenticator next time you sign in.",
          ),
        ]),
        h(
          "span",
          { class: `badge ${hasMfa ? "green" : "amber"}` },
          hasMfa ? "Enrolled" : "Not configured",
        ),
      ]),
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

  // Per-response subcollection writer (Phase 5 DATA-01 path). One Firestore
  // doc per (round, user, pillar) tuple at /orgs/{orgId}/responses/{respId}
  // where respId = `${roundId}__${userId}__${pillarId}` — matches the shape
  // the migration script (scripts/migrate-subcollections/builders.js) and
  // the data/responses.js wrapper produce. Keyed-debounce per cell so rapid
  // clicks on the same question collapse into a single setDoc.
  function cloudPushResponse(orgId, roundId, userId, pillarId, idx, value) {
    if (!fbReady() || !orgId || !roundId || !userId) return;
    const key = `resp:${orgId}/${roundId}/${userId}/${pillarId}/${idx}`;
    clearTimeout(cloudSaveTimers[key]);
    cloudSaveTimers[key] = setTimeout(async () => {
      try {
        const { db, firestore } = window.FB;
        const respId = `${roundId}__${userId}__${pillarId}`;
        const ref = firestore.doc(db, "orgs", orgId, "responses", respId);
        const snap = await firestore.getDoc(ref);
        const existing = snap.exists() ? snap.data() : null;
        // values is an array indexed by question idx (per the Phase 5 schema).
        const values = existing && Array.isArray(existing.values) ? existing.values.slice() : [];
        values[idx] = value;
        if (snap.exists()) {
          // Update — rules require mutableOnly(["values", "updatedAt", "legacyAppUserId"]).
          await firestore.setDoc(
            ref,
            { values, updatedAt: firestore.serverTimestamp() },
            { merge: true },
          );
        } else {
          // Create — rules require userId == request.auth.uid; set all immutable fields.
          await firestore.setDoc(ref, {
            orgId,
            roundId,
            userId,
            pillarId: String(pillarId),
            values,
            updatedAt: firestore.serverTimestamp(),
          });
        }
      } catch (e) {
        console.error("Cloud push response failed:", e);
      }
    }, 400);
  }

  // Live subscription to /orgs/{orgId}/responses for the active org. Folds
  // each subcollection doc back into the in-memory `org.responses` map
  // (legacy shape: responses[roundId][userId][pillarId][idx]) and renders
  // when something changed. Track which org we're subscribed to so org
  // switches (internal user picking a different client) tear the old
  // listener down before opening the new one.
  let _responsesUnsubscribe = null;
  let _responsesSubscribedFor = null;
  function ensureResponsesSubscription(orgId) {
    if (_responsesSubscribedFor === orgId) return;
    if (typeof _responsesUnsubscribe === "function") {
      try {
        _responsesUnsubscribe();
      } catch (_e) {
        // ignore: unsubscribe never throws in practice but defend anyway
      }
    }
    _responsesUnsubscribe = null;
    _responsesSubscribedFor = orgId;
    if (!orgId || !fbReady()) return;
    const { db, firestore } = window.FB;
    const respCol = firestore.collection(db, "orgs", orgId, "responses");
    _responsesUnsubscribe = firestore.onSnapshot(
      respCol,
      (snap) => {
        const cached = loadOrg(orgId);
        if (!cached) return;
        const responses = {};
        snap.forEach((/** @type {*} */ d) => {
          const data = d.data() || {};
          // Doc id encodes the tuple — fall back to id parts if the field
          // copies are missing (defensive against partially-migrated docs).
          const parts = String(d.id).split("__");
          const roundId = data.roundId || parts[0];
          const userId = data.userId || parts[1];
          const pillarId = data.pillarId != null ? String(data.pillarId) : parts[2];
          if (!roundId || !userId || !pillarId) return;
          const values = Array.isArray(data.values) ? data.values : [];
          responses[roundId] = responses[roundId] || {};
          responses[roundId][userId] = responses[roundId][userId] || {};
          const slot = (responses[roundId][userId][pillarId] = {});
          values.forEach((v, idx) => {
            if (v !== null && v !== undefined) slot[idx] = v;
          });
        });
        const next = Object.assign({}, cached, { responses });
        if (JSON.stringify(cached.responses || {}) !== JSON.stringify(responses)) {
          jset(K.org(orgId), next);
          render();
        }
      },
      (err) => console.error("subscribeResponses failed:", err),
    );
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

  // Phase 4.1 / D-13: cloudFetchAllOrgs + cloudFetchAllUsers deleted. They
  // were the implementation of the silently-no-op'd one-shot pull; live
  // hydration is now driven by _subscribeOrgs + _subscribeUsers wired
  // post-auth (search "_subscribeOrgs(" above).
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
          ? `Shared with ${org.name}. Everyone in this organisation can see these documents.`
          : "Select an organisation to see its documents.",
      ),
    );

    if (!org) return frag;

    if (!fbReady()) {
      frag.appendChild(
        h("div", { class: "card docs-empty-card" }, "Connecting to shared storage…"),
      );
      return frag;
    }

    const { db, storage, firestore, storageOps } = window.FB;

    // Upload card
    const uploadCard = h("div", { class: "card" });
    const fileInput = h("input", { type: "file", class: "u-display-none" });
    const progressBar = h("div", { class: "docs-progress-meta" });

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
        // Phase 8 Wave 2 (BACKUP-05 sweep): getDownloadURL removed — clients
        // fetch signed URLs on demand via getDocumentSignedUrl callable.
        await firestore.setDoc(firestore.doc(db, "orgs", org.id, "documents", docId), {
          orgId: org.id,
          uploaderId: user.id,
          uploaderName: user.name || user.email,
          uploaderEmail: user.email,
          filename: validation.sanitisedName,
          size: file.size,
          contentType: file.type,
          storagePath: path,
          createdAt: firestore.serverTimestamp(),
        });
        progressBar.textContent = `✓ Uploaded ${file.name}`;
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
      h("div", { class: "docs-toolbar-row" }, [
        h("button", { class: "btn", onclick: () => fileInput.click() }, "+ Upload file"),
        fileInput,
      ]),
    );
    uploadCard.appendChild(progressBar);
    frag.appendChild(uploadCard);

    // List
    const listCard = h("div", { class: "card docs-list-card" });
    listCard.appendChild(h("h3", { class: "docs-list-h3" }, "Files"));
    const listBody = h("div", {});
    listBody.appendChild(h("p", { class: "docs-list-loading" }, "Loading…"));
    listCard.appendChild(listBody);
    frag.appendChild(listCard);

    const q = firestore.collection(db, "orgs", org.id, "documents");
    firestore.onSnapshot(
      q,
      (snap) => {
        const docs = [];
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

        const isInternal = isStaff(user);

        // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
        listBody.replaceChildren();
        if (!docs.length) {
          listBody.appendChild(h("p", { class: "docs-list-empty" }, "No files yet."));
          return;
        }
        docs.forEach((d) => {
          const row = h("div", { class: "docs-table-row" });
          row.appendChild(
            h("div", {}, [
              h("div", { class: "docs-row-filename" }, d.filename),
              h("div", { class: "docs-row-meta" }, formatBytes(d.size)),
            ]),
          );
          row.appendChild(h("div", {}, d.uploaderName || d.uploaderEmail || "—"));
          row.appendChild(h("div", {}, d.createdAt?.toDate?.().toLocaleString?.("en-GB") || ""));
          const canDelete = isInternal || d.uploaderId === user.id;
          const actions = h(
            "div",
            { class: "docs-row-actions" },
            [
              h(
                "button",
                {
                  class: "btn secondary sm",
                  // Phase 8 Wave 2 (BACKUP-05 sweep): fetch signed URL on
                  // demand via getDocumentSignedUrl callable — no cached
                  // downloadURL in Firestore. URL is valid for 1 hour; caller
                  // MUST NOT cache it (server enforces TTL).
                  onclick: async () => {
                    try {
                      const { getDocumentSignedUrl } = await import("./cloud/signed-url.js");
                      const { url } = await getDocumentSignedUrl(org.id, d.id, d.filename);
                      window.open(url, "_blank", "noopener,noreferrer");
                    } catch (e) {
                      notify("error", "Couldn't fetch download link: " + (e.message || e));
                    }
                  },
                },
                "Download",
              ),
              canDelete
                ? h(
                    "button",
                    {
                      class: "btn ghost sm danger",
                      // PLATFORM-UAT T15 fix (2026-05-25): swap direct
                      // firestore.deleteDoc + storageOps.deleteObject for
                      // the softDelete Cloud Function callable. Direct
                      // deletes were blocked by firestore.rules:104
                      // (allow delete: if false — soft-delete-via-CF only).
                      // The callable marks the Firestore doc deleted=true;
                      // firestore.rules:101 notDeleted predicate hides it
                      // from the live snapshot so the list re-renders
                      // without the row automatically. Storage object
                      // cleanup is handled by the scheduled purge via
                      // permanentlyDeleteSoftDeleted — no client-side
                      // storage call needed (it would also be blocked by
                      // storage.rules anyway).
                      onclick: () =>
                        confirmDialog(
                          "Delete file?",
                          `Remove "${d.filename}" for everyone in ${org.name}? This can be restored within 30 days.`,
                          async () => {
                            try {
                              const { softDelete } = await import("./cloud/soft-delete.js");
                              await softDelete({
                                type: "document",
                                orgId: org.id,
                                id: d.id,
                              });
                            } catch (e) {
                              notify("error", "Couldn't delete file: " + (e.message || e));
                            }
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
          h("p", { class: "docs-error-paragraph" }, "Couldn't load documents: " + err.message),
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
        { class: "view-sub chat-sub-tight" },
        org
          ? `Team channel for ${org.name}. Everyone in this organisation + BeDeveloped can post and read.`
          : "Select an organisation to open its channel.",
      ),
    );
    if (org) {
      frag.appendChild(
        h(
          "p",
          { class: "view-sub chat-empty-italic" },
          "The team will aim to respond within 24hrs.",
        ),
      );
    }

    if (!org) return frag;

    // Mark everything up to now as read for this user/org combination.
    markChatReadFor(user.id, org.id);

    if (!fbReady()) {
      frag.appendChild(h("div", { class: "card docs-empty-card" }, "Connecting to chat…"));
      return frag;
    }

    const { db, firestore } = window.FB;

    const card = h("div", { class: "card chat-roomshell" });

    // Search
    const searchInput = h("input", {
      type: "search",
      placeholder: "Search messages…",
      class: "chat-search-input",
    });
    card.appendChild(searchInput);

    // Message list
    const list = h("div", { class: "chat-list-scroll" });
    list.appendChild(h("p", { class: "chat-loading-center" }, "Loading…"));
    card.appendChild(list);

    // Composer
    const textInput = h("input", {
      type: "text",
      placeholder: "Type a message…",
      class: "chat-input",
    });
    const sendBtn = h("button", { class: "btn" }, "Send");

    const composer = h("div", { class: "chat-composer-bar" }, [textInput, sendBtn]);
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
            { class: "chat-empty-center" },
            term ? "No messages match." : "No messages yet — start the conversation.",
          ),
        );
        return;
      }
      filtered.forEach((m) => {
        const isSelf = m.authorId === user.id;
        const isInternalAuthor = m.authorRole === "internal";
        const bg = isInternalAuthor ? "var(--ink)" : "var(--brand)";
        const canDelete = isSelf || !isClientView(user);
        // CODE-08 (D-20): shared bubble helper closes M8 chat/funnel
        // duplication; funnel comment block calls the same helper below.
        const bubble = renderConversationBubble({
          message: m,
          isSelf,
          canDelete,
          bg,
          bubbleClass: "chat-bubble",
          metaClass: "chat-bubble-meta",
          textClass: "chat-bubble-text",
          delClass: "chat-bubble-del",
          onDelete: () => {
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
        });
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
        // Phase 6 Wave 5 cutover-recovery: subcollection /orgs/{orgId}/messages
        // (matching firestore.rules:80-86). orgId field dropped — it's in the path.
        await firestore.addDoc(firestore.collection(db, "orgs", org.id, "messages"), {
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

    // Phase 6 Wave 5 cutover-recovery: subcollection path matches rules.
    const q = firestore.collection(db, "orgs", org.id, "messages");
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
          h("p", { class: "chat-error-paragraph" }, "Couldn't load chat: " + err.message),
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
          ? `${periodCadence} delivery plan for ${org.name}. ${isStaff(user) ? `Drag pillars into a ${periodLabelLower} and add outcomes.` : "Your BeDeveloped team will update this as the engagement progresses."}`
          : "Select an organisation to see its plan.",
      ),
    );
    if (!org) return frag;

    if (!fbReady()) {
      frag.appendChild(
        h("div", { class: "card docs-empty-card" }, "Connecting to shared storage…"),
      );
      return frag;
    }

    const { db, firestore } = window.FB;
    const canEdit = isStaff(user);
    const docRef = firestore.doc(db, "roadmaps", org.id);

    const layout = h("div", { class: "roadmap-layout roadmap-grid" });
    const periodsCol = h("div", { class: "roadmap-periods-col" });
    const palette = h("div", { class: "card roadmap-palette roadmap-pool" });

    // Pillar palette
    palette.appendChild(h("div", { class: "roadmap-pool-eyebrow" }, "PILLARS"));
    palette.appendChild(
      h(
        "p",
        { class: "roadmap-pool-explainer" },
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
        const card = h("div", { class: "card roadmap-card" });
        card.appendChild(
          h("div", { class: "roadmap-card-header" }, [
            h("div", { class: "roadmap-card-title" }, `${periodLabel} ${idx + 1}`),
            h(
              "div",
              { class: "roadmap-card-meta" },
              `${(m.pillarIds || []).length} pillar${(m.pillarIds || []).length === 1 ? "" : "s"} · ${(m.outcomes || []).length} outcome${(m.outcomes || []).length === 1 ? "" : "s"}`,
            ),
          ]),
        );

        // Pillars drop zone — CODE-06 (D-20): class roadmap-drop replaces inline style block (precondition for Phase 10 strict-CSP).
        const drop = h("div", { class: "roadmap-drop" });
        if (!(m.pillarIds || []).length) {
          drop.appendChild(
            h(
              "span",
              { class: "roadmap-card-empty" },
              canEdit ? "Drag pillars here" : "No pillars assigned yet",
            ),
          );
        }
        (m.pillarIds || []).forEach((pid) => {
          const p = DATA.pillars.find((pp) => pp.id === pid);
          if (!p) return;
          const chip = h(
            "span",
            { class: "roadmap-pillar-pill" },
            [
              h("span", {}, `${p.id}. ${p.shortName || p.name}`),
              canEdit
                ? h(
                    "button",
                    {
                      class: "roadmap-pillar-pill-x",
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
            // CODE-06 (D-20): classList toggle replaces el.style.background mutation.
            drop.classList.add("is-dragover");
          });
          drop.addEventListener("dragleave", () => {
            // CODE-06 (D-20): classList toggle replaces el.style.background mutation.
            drop.classList.remove("is-dragover");
          });
          drop.addEventListener("drop", (e) => {
            e.preventDefault();
            // CODE-06 (D-20): classList toggle replaces el.style.background mutation.
            drop.classList.remove("is-dragover");
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
        card.appendChild(h("div", { class: "outcomes-eyebrow-2" }, "Outcomes"));
        const outList = h("div", { class: "outcomes-section" });
        if (!(m.outcomes || []).length) {
          outList.appendChild(h("div", { class: "outcomes-empty" }, "None yet."));
        }
        (m.outcomes || []).forEach((o) => {
          const row = h("div", { class: "outcomes-row" });
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
          row.appendChild(h("span", { class: "outcomes-text" }, o.text));
          if (canEdit) {
            row.appendChild(
              h(
                "button",
                {
                  class: "btn ghost sm danger outcomes-edit-btn",
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
            class: "outcomes-input",
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
          card.appendChild(h("div", { class: "outcomes-add-row" }, [input, addBtn, pasteBtn]));
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
      class: "outcomes-textarea",
    });
    const countLbl = h("div", { class: "outcomes-count" }, "0 outcomes");
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
        { class: "section-explainer" },
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

  // Phase 6 Wave 5 (BLOCKER-FIX 1 / D-04): replaces the legacy `firebase-ready`
  // window event listener (deleted alongside the signInAnonymously bridge in
  // src/firebase/auth.js per AUTH-14). Subscribes directly to Firebase Auth
  // state; on a signed-in user, hydrates state.fbUser with a shim that exposes
  // BOTH Firebase User properties (uid, emailVerified, appClaims, appEnrolledFactors)
  // AND the legacy shape (id, role, name, orgId) so existing render functions
  // work unchanged. Also keeps window.FB.currentUser in sync until the IIFE
  // body migrates to fully use state.fbUser (Phase 7+ cleanup-ledger).
  fbOnAuthStateChanged(fbAuthInstance, async (fbUser) => {
    // Firebase has now reported the persisted-session state (this is the first
    // fire on cold load). Flip the flash guard so render() stops showing the
    // splash and paints the real screen — sign-in when null, app when signed
    // in. Set unconditionally, before the null split, so both paths clear it.
    state.authResolved = true;

    if (!fbUser) {
      state.fbUser = null;
      if (typeof window !== "undefined") {
        /** @type {*} */ (window).FB = /** @type {*} */ (window).FB || {};
        /** @type {*} */ (window).FB.currentUser = null;
      }
      render();
      return;
    }

    // Scope item 1 (2026-07): sticky auth-flow error toasts ("Invalid
    // verification code" from a TOTP retry) otherwise survive the successful
    // sign-in into the app render — #toastRoot lives on <body>, outside the
    // #app re-render, and D-14 makes errors persist until closed. Clear them
    // the moment sign-in lands. Signed-in branch ONLY: the session-expiry
    // path below notifies right before signOut() re-fires this callback with
    // null, and that message must survive.
    dismissAllToasts();

    // 30-day session cap (see src/auth/session-policy.js). Persistence keeps the
    // user signed in indefinitely; if their last interactive sign-in is older
    // than 30 days, sign them out here. fbSignOut fires onAuthStateChanged again
    // with null, which repaints the sign-in screen (authResolved is already
    // true, so no splash). Runs before the heavier claims/orgs hydration so an
    // expired session does no needless work.
    if (isSessionExpired(fbUser.metadata && fbUser.metadata.lastSignInTime, Date.now())) {
      notify("info", "Your session has expired — please sign in again.");
      try {
        await signOut();
      } catch (_signOutErr) {
        // Best-effort: if the sign-out call itself fails, the next boot will
        // re-evaluate the same expired timestamp and try again.
      }
      return;
    }

    // Hydrate appClaims (used by router auth-state ladder + main.js role checks).
    /** @type {*} */
    let claims;
    try {
      const tokenResult = await fbUser.getIdTokenResult();
      claims = tokenResult.claims || {};
    } catch (_e) {
      // Token fetch failure — proceed with empty claims; user.role check below
      // will deny access. Phase 9 Sentry will catch the underlying error.
      claims = {};
    }

    // Phase 9 Wave 1 (OBS-01 + Pitfall 3): init Sentry AFTER claims hydration
    // so setUser carries the verified UID + role (never PII like email).
    // Empty VITE_SENTRY_DSN -> "" -> initSentryBrowser becomes a silent no-op
    // (kill-switch + local-dev path; Wave 2 ships the secrets path that puts
    // the DSN into CI/preview/prod builds).
    initSentryBrowser(
      /** @type {string} */ (import.meta.env.VITE_SENTRY_DSN ?? ""),
      /** @type {string} */ (import.meta.env.VITE_GIT_SHA ?? "local"),
    );
    sentrySetUser({ id: fbUser.uid, role: claims.role || "internal" });

    // Hydrate enrolled MFA factors (used by router for renderMfaEnrol guard).
    /** @type {Array<*>} */
    let enrolledFactors;
    try {
      enrolledFactors = fbMultiFactor(fbUser).enrolledFactors || [];
    } catch (_e) {
      enrolledFactors = [];
    }

    // Compose the user shim — Firebase props + hoisted claim flags + legacy shape.
    state.fbUser = {
      // Firebase Auth User properties (live references where possible)
      uid: fbUser.uid,
      email: fbUser.email,
      emailVerified: fbUser.emailVerified,
      displayName: fbUser.displayName,
      providerData: fbUser.providerData,
      metadata: fbUser.metadata,
      // Phase 6 hydrated fields consumed by src/router.js D-16 auth-state ladder
      appClaims: claims,
      appEnrolledFactors: enrolledFactors,
      firstRun: claims.firstRun === true,
      // Legacy user shape consumed by main.js render functions
      id: fbUser.uid,
      name: fbUser.displayName || fbUser.email,
      role: claims.role || "internal",
      orgId: claims.orgId || null,
      createdAt: fbUser.metadata && fbUser.metadata.creationTime,
    };

    if (typeof window !== "undefined") {
      /** @type {*} */ (window).FB = /** @type {*} */ (window).FB || {};
      /** @type {*} */ (window).FB.currentUser = fbUser;
    }

    // Post-auth setup (was previously gated on the firebase-ready event):
    ensureChatSubscription(state.fbUser);

    // Phase 4.1 / D-13 follow-up: Firestore is the source of truth for the
    // orgs + users top-level collections. Live snapshot listeners hydrate
    // the K.orgs / K.org(id) / K.users localStorage caches that the IIFE's
    // synchronous helpers (loadOrgMetas / loadOrg / loadUsers) read, then
    // trigger render(). The first orgs snapshot also drives the one-shot
    // framework-V2 wipe so saveOrg pushes the cleared responses back up to
    // Firestore (matches the original intent of "runs after cloud sync
    // completes" at clearResponsesForFrameworkV2IfNeeded). Replaces the
    // silently-no-op'd syncFromCloud() one-shot pull.
    // Skip render() when the snapshot is identical to what we already cached
    // locally — typically the echo of this client's own setDoc round-trip.
    // The user's action handler already called render() inline; redrawing
    // again would just blow away scroll position and any in-flight drag /
    // focus / mid-interaction DOM state for no visible benefit. Cross-device
    // changes (genuinely new data) still trigger a render. The JSON.stringify
    // compare is O(payload-size) per snapshot — acceptable here because the
    // orgs collection is small (one doc per engagement).
    let _orgsHydratedOnce = false;
    _subscribeOrgs({
      onChange: (orgs) => {
        const newMeta = orgs.map((o) => ({ id: o.id, name: o.name }));
        let changed = JSON.stringify(jget(K.orgs, [])) !== JSON.stringify(newMeta);
        jset(K.orgs, newMeta);
        for (const org of orgs) {
          const prev = jget(K.org(org.id), null);
          // Phase 5 (DATA-01) moved responses to the
          // /orgs/{orgId}/responses subcollection; the parent doc's
          // `responses` field is stale (or absent) and the
          // ensureResponsesSubscription() listener below owns the truth.
          // Preserve the locally-cached responses across parent-doc
          // hydrations so a snapshot doesn't wipe the diagnostic clicks
          // setResponse() just wrote to the subcollection.
          const merged =
            prev && prev.responses ? Object.assign({}, org, { responses: prev.responses }) : org;
          if (!changed && JSON.stringify(prev) !== JSON.stringify(merged)) changed = true;
          jset(K.org(org.id), merged);
        }
        if (!_orgsHydratedOnce) {
          _orgsHydratedOnce = true;
          clearResponsesForFrameworkV2IfNeeded();
          // First snapshot must always paint — the inline render() below
          // fires before this listener completes, so the initial render
          // doesn't have the hydrated orgs yet.
          changed = true;
        }
        if (changed) render();
      },
      onError: (err) => console.error("subscribeOrgs failed:", err),
    });
    _subscribeUsers({
      onChange: (users) => {
        const changed = JSON.stringify(jget(K.users, [])) !== JSON.stringify(users);
        jset(K.users, users);
        if (changed) render();
      },
      onError: (err) => console.error("subscribeUsers failed:", err),
    });

    render();
  });

  // Splash safety net: if Firebase Auth never reports (SDK init stalls, App
  // Check origin failure, offline cold-start), authResolved would stay false
  // and the splash would hang forever. After a short grace period, flip the
  // gate and render anyway — with no user that falls through to the sign-in
  // screen, which is the correct, actionable fallback. Harmless once auth has
  // already resolved (render() is idempotent for a signed-in user).
  setTimeout(() => {
    if (!state.authResolved) {
      state.authResolved = true;
      render();
    }
  }, 2500);

  // Phase 6 follow-up (firstRun loop part 2): onAuthStateChanged does NOT fire
  // on a forced ID-token refresh — only sign-in / sign-out / user-changed.
  // updatePassword's final getIdToken(true) after the setClaims callable picks
  // up the new {role,orgId,firstRun:absent} claims locally, but without this
  // listener state.fbUser.firstRun stays true and the renderFirstRun screen
  // re-renders forever. onIdTokenChanged fires on refresh too. Guard on an
  // already-hydrated state.fbUser so initial sign-in goes through the heavier
  // onAuthStateChanged path above (which also subscribes to orgs + users).
  fbOnIdTokenChanged(fbAuthInstance, async (fbUser) => {
    if (!fbUser || !state.fbUser || fbUser.uid !== state.fbUser.uid) return;
    let claims;
    try {
      const tokenResult = await fbUser.getIdTokenResult();
      claims = tokenResult.claims || {};
    } catch (_e) {
      return;
    }
    const nextFirstRun = claims.firstRun === true;
    const nextRole = claims.role || "internal";
    const nextOrgId = claims.orgId || null;
    // Only re-render when something the render path actually reads from
    // claims has changed — typically only on sign-in or when setClaims flips
    // firstRun. The hourly auto-refresh also fires this listener with the
    // SAME claims; rendering then would wipe scroll position and abort any
    // in-flight drag / focus on every token rotation.
    const changed =
      state.fbUser.firstRun !== nextFirstRun ||
      state.fbUser.role !== nextRole ||
      state.fbUser.orgId !== nextOrgId;
    state.fbUser.appClaims = claims;
    state.fbUser.firstRun = nextFirstRun;
    state.fbUser.role = nextRole;
    state.fbUser.orgId = nextOrgId;
    if (changed) render();
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
          class: "back notes-mb-6",
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
        h("div", { class: "card docs-empty-card" }, "Connecting to shared storage…"),
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
            class: "btn ghost sm btn-line-soft",
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
        const canDelete = isSelf || !isClientView(user);
        // CODE-08 (D-20): shared bubble helper — same call shape as chat
        // renderList above; only class set + Firestore collection differ.
        const bubble = renderConversationBubble({
          message: m,
          isSelf,
          canDelete,
          bg,
          bubbleClass: "comment-bubble",
          metaClass: "comment-meta",
          textClass: "comment-text",
          delClass: "comment-bubble-del",
          onDelete: () => {
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
        });
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
          h("p", { class: "u-color-red" }, "Couldn't load comments: " + err.message),
        );
      },
    );

    return frag;
  }

  function openInviteClientModal() {
    // Phase 06.1 Wave 2 (AUTH-16 / D-14): rewired to call the inviteClient
    // callable (via src/cloud/invite-admin.js) instead of writing a local
    // Firestore user doc. The org passphrase is re-typed here (used both as
    // the admin's vouch + the new Firebase Auth password the client signs in
    // with the first time). PassphraseInvalidError / CrossOrgError /
    // PassphraseNotSetError surface err.message inline; modal stays open so
    // the admin can correct.
    const name = h("input", {
      type: "text",
      class: "settings-textarea-comment",
      placeholder: "Client contact name",
    });
    const email = h("input", {
      type: "email",
      class: "settings-textarea-comment",
      placeholder: "client@company.com",
    });
    const orgPassphrase = h("input", {
      type: "password",
      class: "settings-textarea-comment",
      placeholder: "Re-enter the company passphrase",
    });
    const select = h("select", { class: "settings-textarea-comment" });
    const orgs = loadOrgMetas();
    orgs.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.name;
      select.appendChild(opt);
    });
    const errBox = h("div");

    const createBtn = h("button", { class: "btn" }, "Create account");
    // Processing feedback: mirror the sign-in button's pending state so the
    // 1–2s inviteClient round-trip reads as "working", not "stuck" — shared
    // pending-button controller (.is-loading spinner in styles.css).
    const createPending = pendingButton(/** @type {HTMLButtonElement} */ (createBtn), "Creating…");

    /**
     * @param {Error} err
     */
    function surfaceError(err) {
      errBox.replaceChildren();
      if (
        err instanceof PassphraseInvalidError ||
        err instanceof PassphraseNotSetError ||
        err instanceof CrossOrgError
      ) {
        errBox.appendChild(h("div", { class: "auth-error" }, err.message));
      } else {
        errBox.appendChild(h("div", { class: "auth-error" }, "Something went wrong — try again."));
      }
    }

    /**
     * @param {boolean} confirmReset
     * @returns {Promise<boolean>} true when the invite completed (account
     *   created or reset) and the flow has moved on to the instructions
     *   modal; false on validation failure or error (surfaced in errBox).
     */
    async function doInvite(confirmReset) {
      const em = (email.value || "").trim().toLowerCase();
      const nameVal = (name.value || "").trim();
      const orgIdVal = select.value;
      const passVal = orgPassphrase.value || "";

      errBox.replaceChildren();
      if (!em || !em.includes("@")) {
        errBox.appendChild(h("div", { class: "auth-error" }, "Enter a valid email."));
        return false;
      }
      if (!nameVal) {
        errBox.appendChild(h("div", { class: "auth-error" }, "Enter the client's name."));
        return false;
      }
      if (!orgs.length || !orgIdVal) {
        errBox.appendChild(h("div", { class: "auth-error" }, "Create an organisation first."));
        return false;
      }
      if (!passVal) {
        errBox.appendChild(h("div", { class: "auth-error" }, "Re-enter the company passphrase."));
        return false;
      }

      createPending.start();
      try {
        const res = await inviteClient({
          email: em,
          name: nameVal,
          orgId: orgIdVal,
          orgPassphrase: passVal,
          ...(confirmReset ? { confirmReset: true } : {}),
        });
        if (res && res.existed === true && !confirmReset) {
          // Existed-user path: prompt admin to confirm reset (re-flips firstRun
          // and overwrites the existing password back to the org passphrase).
          const chosenOrgForCopy = loadOrgMetas().find((o) => o.id === orgIdVal);
          const orgName = (chosenOrgForCopy && chosenOrgForCopy.name) || "this organisation";
          const stateDesc = res.hasFirstRun ? "first-run" : "completed";
          // Pending state must live on the button the admin actually clicks:
          // opening this modal evicts the invite modal (and createBtn) from
          // the shared modal root, so decorating createBtn shows nothing.
          const resetBtn = h("button", { class: "btn" }, "Yes, reset");
          const resetPending = pendingButton(
            /** @type {HTMLButtonElement} */ (resetBtn),
            "Resetting…",
          );
          resetBtn.addEventListener("click", async () => {
            resetPending.start();
            const ok = await doInvite(true);
            // Success replaced this modal with the instructions modal — do NOT
            // close here, that would wipe it from the shared root.
            if (ok) return;
            // Failure surfaced in errBox (below); keep the modal open to retry.
            resetPending.stop();
          });
          const confirmModal = modal([
            h("h3", {}, "Email already has an account"),
            h(
              "p",
              { class: "section-explainer" },
              `That email already has a ${stateDesc} account for ${orgName}. Reset their password back to the current company passphrase and re-flip first-run? Their current sign-in will be invalidated.`,
            ),
            // Re-parent errBox from the (now-evicted) invite modal so the
            // reset attempt's validation/network errors land somewhere visible.
            errBox,
            h("div", { class: "row" }, [
              h(
                "button",
                {
                  class: "btn secondary",
                  onclick: () => confirmModal.close(),
                },
                "Cancel",
              ),
              resetBtn,
            ]),
          ]);
          return false;
        }

        // Success — close + open instructions modal.
        const chosenOrg = loadOrgMetas().find((o) => o.id === orgIdVal);
        const client = { email: em, name: nameVal };
        m.close();
        render();
        openInviteInstructionsModal(client, chosenOrg, true);
        return true;
      } catch (err) {
        surfaceError(/** @type {Error} */ (err));
        return false;
      } finally {
        createPending.stop();
      }
    }

    createBtn.addEventListener("click", () => {
      void doInvite(false);
    });

    const m = modal([
      h("h3", {}, "Invite a client"),
      h(
        "p",
        { class: "settings-explainer" },
        "They'll sign in with their email + the company passphrase you set, then create their own password on first login.",
      ),
      h("div", { class: "settings-form-stack" }, [
        h("div", {}, [h("label", { class: "settings-form-label" }, "Name"), name]),
        h("div", {}, [h("label", { class: "settings-form-label" }, "Email"), email]),
        h("div", {}, [h("label", { class: "settings-form-label" }, "Organisation"), select]),
        h("div", {}, [
          h("label", { class: "settings-form-label" }, "Company passphrase"),
          orgPassphrase,
        ]),
      ]),
      errBox,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        createBtn,
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
3. Enter the company passphrase your contact has shared with you
4. Create your own password on first sign-in - you'll use this from then on

Any questions, just let me know.`;

    const mailto = `mailto:${encodeURIComponent(client.email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

    const textArea = h("textarea", {
      readonly: "",
      class: "settings-textarea-tall",
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
          { class: "settings-text-narrow" },
          `${client.email} can now sign in. There's no automatic email - send them the details below. Then share the company passphrase with them via your usual secure channel.`,
        ),
        !hasPassphrase
          ? h(
              "div",
              { class: "settings-amber-banner" },
              `⚠ ${org?.name || "This organisation"} doesn't have a company passphrase set. Set one (min 6 characters) from Settings → Set passphrase before inviting clients.`,
            )
          : null,
        h("label", { class: "settings-section-h" }, "Suggested message"),
        textArea,
        h("div", { class: "row" }, [
          h("button", { class: "btn secondary", onclick: () => m.close() }, "Done"),
          copyBtn,
          h(
            "a",
            {
              class: "btn settings-link-row",
              href: mailto,
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

  // Phase 06.1 Wave 3 (AUTH-17 / D-16): the legacy Change-password modal
  // (which verified the current password against the per-user
  // passwordHash and wrote a new hash) DELETED. Client password changes
  // now flow through Firebase Auth — self-serve resets via
  // sendPasswordResetEmail (src/firebase/auth.js); future
  // password-management UI for clients will surface via the Security
  // panel (CONTEXT D-10). The chrome user-menu entry that opened the
  // modal was deleted in the same atomic commit.

  // 2026-06: Add-internal-member modal. Mirrors openInviteClientModal but for
  // BeDeveloped staff — calls the admin-only inviteInternal callable (via
  // src/cloud/invite-admin.js). There is no shared org passphrase: the server
  // generates a strong temp password and returns it here, shown ONCE via
  // openInternalCredentialsModal for the admin to relay. The new member is
  // forced to set their own password + enrol MFA on first sign-in (firstRun).
  function openAddInternalModal() {
    const name = h("input", {
      type: "text",
      class: "settings-textarea-comment",
      placeholder: "Team member name",
    });
    const email = h("input", {
      type: "email",
      class: "settings-textarea-comment",
      placeholder: "name@bedeveloped.com",
    });
    const role = h("select", { class: "settings-textarea-comment" });
    [
      ["internal", "Internal"],
      ["admin", "Admin"],
    ].forEach(([val, label]) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      role.appendChild(opt);
    });
    const errBox = h("div");
    const createBtn = h("button", { class: "btn" }, "Create account");
    // Processing feedback: same pending-spinner treatment as the client invite
    // + sign-in buttons so the 1–2s inviteInternal round-trip shows progress.
    const createPending = pendingButton(/** @type {HTMLButtonElement} */ (createBtn), "Creating…");

    async function doAdd() {
      const em = (email.value || "").trim().toLowerCase();
      const nameVal = (name.value || "").trim();
      const roleVal = /** @type {"internal" | "admin"} */ (role.value);

      errBox.replaceChildren();
      if (!em || !em.includes("@")) {
        errBox.appendChild(h("div", { class: "auth-error" }, "Enter a valid email."));
        return;
      }
      if (!nameVal) {
        errBox.appendChild(h("div", { class: "auth-error" }, "Enter the member's name."));
        return;
      }

      createPending.start();
      try {
        const res = await inviteInternal({ email: em, name: nameVal, role: roleVal });
        m.close();
        render();
        openInternalCredentialsModal({ email: em, name: nameVal }, res.tempPassword);
      } catch (err) {
        errBox.replaceChildren();
        errBox.appendChild(
          h(
            "div",
            { class: "auth-error" },
            (err && /** @type {*} */ (err).message) || "Something went wrong — try again.",
          ),
        );
      } finally {
        createPending.stop();
      }
    }

    createBtn.addEventListener("click", () => {
      void doAdd();
    });

    const m = modal([
      h("h3", {}, "Add an internal member"),
      h(
        "p",
        { class: "settings-explainer" },
        "We'll create their account and generate a one-time temporary password for you to share. They'll set their own password and enrol two-factor authentication on first sign-in.",
      ),
      h("div", { class: "settings-form-stack" }, [
        h("div", {}, [h("label", { class: "settings-form-label" }, "Name"), name]),
        h("div", {}, [h("label", { class: "settings-form-label" }, "Email"), email]),
        h("div", {}, [h("label", { class: "settings-form-label" }, "Role"), role]),
      ]),
      errBox,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        createBtn,
      ]),
    ]);
    setTimeout(() => name.focus(), 10);
  }

  // 2026-06: one-time temp-password reveal after a successful inviteInternal.
  // The temp password is NOT stored anywhere client-side beyond this modal —
  // closing it discards it (the server never returns it again). Mirrors the
  // copy-to-clipboard affordance of openInviteInstructionsModal.
  function openInternalCredentialsModal(member, tempPassword) {
    const signInUrl = "https://baselayers.bedeveloped.com";
    const firstName = (member.name || "").split(" ")[0] || "there";
    const emailBody = `Hi ${firstName},

You've been set up with internal access to The Base Layers.

To sign in:
1. Go to ${signInUrl}
2. Enter your email: ${member.email}
3. Enter this temporary password: ${tempPassword}
4. You'll set your own password and enrol two-factor authentication on first sign-in.

Any questions, just let me know.`;

    const textArea = h("textarea", { readonly: "", class: "settings-textarea-tall" });
    textArea.value = emailBody;

    const copyBtn = h("button", { class: "btn secondary" }, "Copy text");
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(emailBody);
        copyBtn.textContent = "Copied ✓";
        setTimeout(() => (copyBtn.textContent = "Copy text"), 1500);
      } catch (_e) {
        notify("error", "Couldn't copy — select the text and copy manually.");
      }
    };

    const cm = modal([
      h("h3", {}, "Account created"),
      h(
        "p",
        { class: "settings-explainer" },
        `${member.email} can now sign in. Share the temporary password below via your usual secure channel — it is shown once and cannot be retrieved again.`,
      ),
      h("div", { class: "settings-form-stack" }, [
        h("div", {}, [
          h("label", { class: "settings-form-label" }, "Temporary password"),
          h("code", { class: "temp-password-reveal" }, tempPassword),
        ]),
      ]),
      textArea,
      h("div", { class: "row" }, [
        copyBtn,
        h("button", { class: "btn", onclick: () => cm.close() }, "Done"),
      ]),
    ]);
  }

  // Wires the shared masked-value + eye reveal (src/ui/passphrase-reveal.js)
  // to this org's staff-only orgSecrets/{orgId} doc and audit trail. Every
  // reveal surface (Set-passphrase modal row, Manage-people org rows) goes
  // through here so the fetch/cache/error contract and the best-effort
  // org.passphrase.viewed audit event — NEVER with the secret in the payload
  // (Pitfall 17) — stay identical everywhere.
  function orgPassphraseReveal(orgId) {
    return createPassphraseReveal({
      fetchSecret: () => getOrgPassphraseSecret(orgId),
      onReveal: () =>
        emitAuditEvent("org.passphrase.viewed", { type: "org", id: orgId, orgId }, {}),
    });
  }

  // Builds the labelled "Current passphrase" reveal row for the Set-passphrase
  // modal.
  function buildCurrentPassphraseRow(orgId) {
    const { value, btn } = orgPassphraseReveal(orgId);
    return h("div", { class: "pw-current-row" }, [
      h("span", { class: "pw-current-label" }, "Current passphrase:"),
      value,
      btn,
    ]);
  }

  function openSetOrgPassphrase(orgId, orgName) {
    const org = loadOrg(orgId);
    const existing = !!(org && org.clientPassphraseHash);
    // Placeholder mirrors the ORG_PASSPHRASE_MIN_LENGTH floor in
    // src/auth/passphrase-policy.js + the gate below (2026-06: 6 chars).
    const nw = h("input", {
      type: "password",
      placeholder: "New company passphrase (min 6 chars)",
    });
    const confirm = h("input", { type: "password", placeholder: "Confirm passphrase" });
    const errBox = h("div");

    // Show-while-typing: an eye toggle beside each masked input so the admin can
    // unmask what they're entering as they set the passphrase.
    const nwField = h("div", { class: "pw-field" }, [
      nw,
      createVisibilityToggle(/** @type {HTMLInputElement} */ (nw), { label: "passphrase" }),
    ]);
    const confirmField = h("div", { class: "pw-field" }, [
      confirm,
      createVisibilityToggle(/** @type {HTMLInputElement} */ (confirm), { label: "passphrase" }),
    ]);

    // View-existing: masked "Current passphrase" row when one is already set.
    const currentRow = existing ? buildCurrentPassphraseRow(orgId) : null;

    const m = modal([
      h("h3", {}, (existing ? "Change" : "Set") + " passphrase — " + orgName),
      h(
        "p",
        { class: "settings-explainer" },
        "Share this with the client team. They'll type it alongside their email and personal password when they sign in. If you change it, tell everyone at " +
          orgName +
          " the new one.",
      ),
      currentRow,
      h("div", { class: "settings-form-flex" }, [nwField, confirmField]),
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
              // Phase 06.1 Wave 1 Task 1 (AUTH-16 / RESEARCH § Critical Pinned
              // Fact 1.1): modal-side check raised from 4 to
              // ORG_PASSPHRASE_MIN_LENGTH (12). setOrgClientPassphrase below
              // re-validates via the same helper as a defence-in-depth gate.
              if (nw.value.length < ORG_PASSPHRASE_MIN_LENGTH) {
                errBox.appendChild(
                  h(
                    "div",
                    { class: "auth-error" },
                    "Passphrase must be at least " + ORG_PASSPHRASE_MIN_LENGTH + " characters.",
                  ),
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
      h("div", { class: "settings-form-flex" }, [cur, nw]),
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
      // set initial orgId for staff (admin OR internal)
      if (isStaff(user)) {
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
