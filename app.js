/* ============================================================
   BeDeveloped — Base Layers (v2)
   - Login (internal + client roles)
   - Multi-user diagnostic, per-user responses
   - Assessment rounds with radar overlay (current vs previous)
   - Comments thread per pillar with unread tracking
   - Data isolation: clients see only their org
   All state in localStorage — no backend required.
   ============================================================ */

(function () {
  "use strict";

  const DATA = window.BASE_LAYERS;
  const LS   = window.localStorage;

  // ---------- Storage keys ----------
  const K = {
    users:       "baselayers:users",
    session:     "baselayers:session",
    settings:    "baselayers:settings",
    orgs:        "baselayers:orgs",
    mode:        "baselayers:mode",
    org:         (id) => `baselayers:org:${id}`,
    // v1 compat
    v1Active:    "baselayers:active"
  };

  // ---------- Utilities ----------
  const uid = (p = "") =>
    p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  const iso = () => new Date().toISOString();

  const formatWhen = (when) => {
    if (!when) return "";
    const d = new Date(when);
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
    if (mins < 60 * 24 * 7) return `${Math.round(mins / (60*24))}d ago`;
    return d.toLocaleDateString();
  };

  const formatDate = (when) => {
    if (!when) return "";
    return new Date(when).toLocaleDateString(undefined,
      { year: "numeric", month: "short", day: "numeric" });
  };

  const initials = (name = "") =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join("");

  // ---------- JSON helpers ----------
  const jget = (k, fallback) => {
    try { const v = LS.getItem(k); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  };
  const jset = (k, v) => LS.setItem(k, JSON.stringify(v));

  // ---------- Settings ----------
  function loadSettings() { return jget(K.settings, { internalPassphrase: null }); }
  function saveSettings(s) { jset(K.settings, s); }

  // ---------- Users ----------
  function loadUsers() { return jget(K.users, []); }
  function saveUsers(u) { jset(K.users, u); }
  function findUser(id) { return loadUsers().find(u => u.id === id) || null; }
  function findUserByEmail(email) {
    const e = (email || "").trim().toLowerCase();
    return loadUsers().find(u => u.email.toLowerCase() === e) || null;
  }
  function upsertUser(user) {
    const users = loadUsers();
    const i = users.findIndex(u => u.id === user.id);
    if (i >= 0) users[i] = user; else users.push(user);
    saveUsers(users);
  }
  function deleteUser(id) {
    saveUsers(loadUsers().filter(u => u.id !== id));
  }

  // ---------- Orgs ----------
  function loadOrgMetas() { return jget(K.orgs, []); }
  function saveOrgMetas(m)  { jset(K.orgs, m); }
  function loadOrg(id)      { return jget(K.org(id), null); }
  function saveOrg(org)     { jset(K.org(org.id), org); }
  function deleteOrg(id) {
    LS.removeItem(K.org(id));
    saveOrgMetas(loadOrgMetas().filter(o => o.id !== id));
    // cascade: delete client users bound to this org
    saveUsers(loadUsers().filter(u => u.orgId !== id));
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
      readStates: {}
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
    return (org.rounds || []).find(r => r.id === id) || null;
  }

  function previousRoundId(org) {
    const rs = org.rounds || [];
    const idx = rs.findIndex(r => r.id === org.currentRoundId);
    if (idx <= 0) return null;
    return rs[idx - 1].id;
  }

  // ---------- Scoring (aggregated across users in a round) ----------
  function pillarScoreForRound(org, roundId, pillarId) {
    const byUser = (org.responses || {})[roundId] || {};
    const allScores = [];
    Object.values(byUser).forEach(perPillar => {
      const perQ = (perPillar || {})[pillarId] || {};
      Object.values(perQ).forEach(r => {
        if (Number.isFinite(r.score)) allScores.push(r.score);
      });
    });
    if (!allScores.length) return null;
    const avg = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    return Math.round(avg * 20);
  }

  function pillarScore(org, pillarId) {
    return pillarScoreForRound(org, org.currentRoundId, pillarId);
  }

  function pillarStatus(score) {
    if (score === null || score === undefined) return "gray";
    if (score < 40) return "red";
    if (score < 70) return "amber";
    return "green";
  }

  function respondentsForRound(org, roundId) {
    const byUser = (org.responses || {})[roundId] || {};
    return Object.keys(byUser);
  }

  function answeredCount(org, roundId, userId, pillarId) {
    const resp = (((org.responses || {})[roundId] || {})[userId] || {})[pillarId] || {};
    const total = DATA.pillars.find(p => p.id === pillarId).diagnostics.length;
    const done = Object.values(resp).filter(r => Number.isFinite(r.score)).length;
    return { done, total };
  }

  function userCompletionPct(org, roundId, userId) {
    const totalQ = DATA.pillars.reduce((s, p) => s + p.diagnostics.length, 0);
    const resp = ((org.responses || {})[roundId] || {})[userId] || {};
    let done = 0;
    DATA.pillars.forEach(p => {
      const pq = resp[p.id] || {};
      done += Object.values(pq).filter(r => Number.isFinite(r.score)).length;
    });
    return Math.round((done / totalQ) * 100);
  }

  function orgSummary(org) {
    const scored = DATA.pillars
      .map(p => pillarScore(org, p.id))
      .filter(s => s !== null);
    const avg = scored.length
      ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
      : null;
    const statuses = DATA.pillars.map(p => pillarStatus(pillarScore(org, p.id)));
    return {
      avg,
      red:   statuses.filter(s => s === "red").length,
      amber: statuses.filter(s => s === "amber").length,
      green: statuses.filter(s => s === "green").length,
      gray:  statuses.filter(s => s === "gray").length,
      scoredCount: scored.length
    };
  }

  function topConstraints(org, n = 3) {
    return DATA.pillars
      .map(p => ({ p, s: pillarScore(org, p.id) }))
      .filter(x => x.s !== null)
      .sort((a, b) => a.s - b.s)
      .slice(0, n)
      .map(x => x.p);
  }

  // ---------- Comments ----------
  function addComment(org, pillarId, authorId, text, internal = false) {
    org.comments = org.comments || {};
    org.comments[pillarId] = org.comments[pillarId] || [];
    const c = {
      id: uid("c_"),
      authorId, text, internal: !!internal, createdAt: iso()
    };
    org.comments[pillarId].push(c);
    saveOrg(org);
    return c;
  }

  function commentsFor(org, pillarId, user) {
    const list = (org.comments || {})[pillarId] || [];
    if (user && user.role === "client") return list.filter(c => !c.internal);
    return list;
  }

  function unreadCountForPillar(org, pillarId, user) {
    const list = commentsFor(org, pillarId, user);
    const last = ((org.readStates || {})[user.id] || {})[pillarId];
    const lastT = last ? new Date(last).getTime() : 0;
    return list.filter(c => new Date(c.createdAt).getTime() > lastT && c.authorId !== user.id).length;
  }

  function unreadCountTotal(org, user) {
    return DATA.pillars.reduce((s, p) => s + unreadCountForPillar(org, p.id, user), 0);
  }

  function markPillarRead(org, pillarId, user) {
    org.readStates = org.readStates || {};
    org.readStates[user.id] = org.readStates[user.id] || {};
    org.readStates[user.id][pillarId] = iso();
    saveOrg(org);
  }

  // ---------- Auth ----------
  function currentSession() { return jget(K.session, null); }
  function currentUser() {
    const s = currentSession();
    return s ? findUser(s.userId) : null;
  }
  function signIn(userId) {
    jset(K.session, { userId });
  }
  function signOut() {
    LS.removeItem(K.session);
  }

  // trivial hashing for demo purposes (NOT secure — just to avoid plaintext storage)
  async function hashString(s) {
    try {
      const enc = new TextEncoder().encode(String(s));
      const buf = await crypto.subtle.digest("SHA-256", enc);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // fallback
      let h = 0;
      for (const ch of String(s)) h = ((h << 5) - h) + ch.charCodeAt(0) | 0;
      return String(h);
    }
  }

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
  async function verifyInternalPassword(pass) {
    const h = await hashString(pass);
    return h === INTERNAL_PASSWORD_HASH;
  }

  // ---------- Client org passphrase (shared by all users of an org) ----------
  async function setOrgClientPassphrase(orgId, pass) {
    const org = loadOrg(orgId);
    if (!org) return false;
    org.clientPassphraseHash = await hashString(pass);
    saveOrg(org);
    return true;
  }
  async function verifyOrgClientPassphrase(orgId, pass) {
    const org = loadOrg(orgId);
    if (!org || !org.clientPassphraseHash) return false;
    const h = await hashString(pass);
    return h === org.clientPassphraseHash;
  }
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
  async function verifyUserPassword(userId, pass) {
    const u = findUser(userId);
    if (!u || !u.passwordHash) return false;
    const h = await hashString(pass);
    return h === u.passwordHash;
  }

  // ---------- v1 → v2 migration ----------
  function migrateV1IfNeeded() {
    const users = loadUsers();
    const orgs = loadOrgMetas();
    if (users.length > 0) return; // already v2

    // If v1 data exists, migrate it
    const v1Orgs = orgs.slice();
    if (v1Orgs.length === 0) return;

    // Create a legacy respondent user so historical responses have an owner
    const legacyId = uid("u_");
    const legacy = {
      id: legacyId,
      email: "legacy@bedeveloped.local",
      name: "Legacy respondent",
      role: "client",
      orgId: null,   // set later if single-org
      createdAt: iso()
    };
    upsertUser(legacy);

    v1Orgs.forEach(meta => {
      const raw = loadOrg(meta.id);
      if (!raw) return;

      // Already migrated?
      if (raw.rounds && raw.currentRoundId) return;

      const roundId = uid("r_");
      const migrated = {
        id: raw.id,
        name: raw.name,
        createdAt: raw.createdAt || iso(),
        currentRoundId: roundId,
        rounds: [{ id: roundId, label: "Round 1 (migrated)", createdAt: raw.createdAt || iso() }],
        responses: { [roundId]: {} },
        internalNotes: {},
        actions: (raw.actions || []).map(a => ({ ...a, createdBy: legacyId })),
        engagement: raw.engagement || { currentStageId: "diagnosed", stageChecks: {} },
        comments: {},
        readStates: {}
      };

      // migrate old responses (single respondent)
      const oldResp = raw.responses || {};
      const byUser = migrated.responses[roundId];
      byUser[legacyId] = {};
      Object.entries(oldResp).forEach(([pillarId, qs]) => {
        byUser[legacyId][pillarId] = {};
        Object.entries(qs || {}).forEach(([idx, r]) => {
          byUser[legacyId][pillarId][idx] = {
            score: r.score,
            note: r.note || ""
          };
          if (r.internalNote) {
            migrated.internalNotes[pillarId] = migrated.internalNotes[pillarId] || {};
            migrated.internalNotes[pillarId][idx] = r.internalNote;
          }
        });
      });

      saveOrg(migrated);
    });

    // If there was exactly one org, point legacy user at it
    if (v1Orgs.length === 1) {
      const leg = findUser(legacyId);
      leg.orgId = v1Orgs[0].id;
      upsertUser(leg);
    }

    LS.removeItem(K.v1Active);
  }

  // ---------- State ----------
  const state = {
    mode: jget(K.mode, "internal"), // internal view mode (only meaningful for internal role)
    route: "dashboard",
    orgId: null,     // current selected org (for internal role; for client it's pinned)
    pillarId: null,
    chart: null,
    userMenuOpen: false,
    authTab: "client",
    authError: "",
    expandedPillars: new Set()    // dashboard-tile accordion state
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
  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const h = (tag, attrs = {}, children = []) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (v === false || v === null || v === undefined) continue;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c === null || c === undefined || c === false) return;
      if (typeof c === "string" || typeof c === "number") el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    });
    return el;
  };

  // ---------- Modal ----------
  function modal(content) {
    const root = $("#modalRoot");
    root.innerHTML = "";
    const wrap = h("div", { class: "modal" }, content);
    root.appendChild(wrap);
    root.classList.remove("hidden");
    const close = (ev) => {
      if (ev && ev.target !== root && !ev.isProgrammatic) return;
      root.classList.add("hidden");
      root.innerHTML = "";
      root.removeEventListener("click", close);
    };
    root.addEventListener("click", close);
    return {
      close: () => {
        const ev = new Event("click");
        ev.isProgrammatic = true;
        Object.defineProperty(ev, "target", { value: root });
        close(ev);
      }
    };
  }

  function promptText(title, placeholder, onSubmit, initial = "") {
    const input = h("input", { type: "text", placeholder });
    input.value = initial;
    const cancel = h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel");
    const ok = h("button", {
      class: "btn",
      onclick: () => {
        const v = input.value.trim();
        if (!v) return;
        onSubmit(v);
        m.close();
      }
    }, "Save");
    input.addEventListener("keydown", e => { if (e.key === "Enter") ok.click(); });
    const m = modal([
      h("h3", {}, title),
      input,
      h("div", { class: "row" }, [cancel, ok])
    ]);
    setTimeout(() => input.focus(), 10);
  }

  function confirmDialog(title, message, onOk, okLabel = "Confirm") {
    const m = modal([
      h("h3", {}, title),
      h("p", { style: "color: var(--ink-2); font-size: 14px;" }, message),
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        h("button", { class: "btn", onclick: () => { onOk(); m.close(); } }, okLabel)
      ])
    ]);
  }

  // ---------- Router ----------
  function setRoute(route) {
    state.route = route;
    render();
  }

  // ---------- Top-level render ----------
  const appEl = () => $("#app");

  function render() {
    if (state.chart) { try { state.chart.destroy(); } catch {} state.chart = null; }

    const app = appEl();
    app.innerHTML = "";

    const user = currentUser();
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
    }
    else if (route === "actions") main.appendChild(renderActions(user, org));
    else if (route === "engagement") main.appendChild(renderEngagement(user, org));
    else if (route === "report") main.appendChild(renderReport(user, org));
    else if (route === "admin" && !isClient) main.appendChild(renderAdmin(user));
    else {
      state.route = "dashboard";
      main.appendChild(renderDashboard(user, org));
    }
  }

  // ================================================================
  // TOPBAR
  // ================================================================
  function renderTopbar(user) {
    const isClient = user.role === "client";
    const org = activeOrgForUser(user);

    const logoImg = h("img", {
      class: "brand-logo",
      src: "assets/logo.png",
      alt: "BeDeveloped"
    });
    const brand = h("div", { class: "brand" }, [
      logoImg,
      h("span", { class: "brand-sub" }, "Base Layers")
    ]);

    // Nav
    const nav = h("nav", { class: "topnav" });
    const items = [
      ["dashboard",   "Dashboard"],
      ["diagnostic",  "Diagnostic"],
      ["actions",     "Actions"],
      ["engagement",  "Engagement"],
      ["report",      "Report"]
    ];
    if (!isClient) items.push(["admin", "Admin"]);

    const unread = org ? unreadCountTotal(org, user) : 0;

    items.forEach(([route, label]) => {
      const btn = h("button", {
        class: "nav-btn" + (state.route === route ||
          (route === "diagnostic" && state.route.startsWith("pillar:")) ? " active" : ""),
        "data-route": route,
        onclick: () => setRoute(route)
      }, label);
      // Unread indicator on diagnostic (since comments live on pillar pages)
      if (route === "diagnostic" && unread > 0) {
        btn.appendChild(h("span", { class: "dot", title: `${unread} unread comment(s)` }));
      }
      nav.appendChild(btn);
    });

    const topright = h("div", { class: "topright" });

    // Internal-only: mode toggle + org switcher
    if (!isClient) {
      const modeToggle = h("label", {
        class: "mode-toggle",
        title: "Internal view shows private commentary. Client view previews what a client sees."
      }, [
        h("span", {}, state.mode === "internal" ? "Internal" : "Client preview"),
        (() => {
          const input = h("input", {
            type: "checkbox",
            checked: state.mode === "internal"
          });
          input.addEventListener("change", () => {
            state.mode = input.checked ? "internal" : "external";
            jset(K.mode, state.mode);
            render();
          });
          return input;
        })(),
        h("span", { class: "switch" })
      ]);
      topright.appendChild(modeToggle);

      const orgSelect = h("select", { "aria-label": "Select organisation" });
      loadOrgMetas().forEach(o => {
        const opt = document.createElement("option");
        opt.value = o.id;
        opt.textContent = o.name;
        if (o.id === org?.id) opt.selected = true;
        orgSelect.appendChild(opt);
      });
      orgSelect.id = "orgSelect";
      orgSelect.addEventListener("change", (e) => {
        state.orgId = e.target.value;
        state.route = "dashboard";
        render();
      });
      topright.appendChild(orgSelect);
    }

    // User chip
    const avatar = h("span", {
      class: "avatar" + (isClient ? "" : " internal")
    }, initials(user.name || user.email));
    const who = h("div", { class: "who" }, [
      h("div", { class: "name" }, user.name || user.email),
      h("div", { class: "role" }, isClient
        ? (org ? org.name : "Client")
        : "BeDeveloped team")
    ]);
    const chip = h("button", {
      class: "user-chip",
      onclick: (e) => {
        e.stopPropagation();
        state.userMenuOpen = !state.userMenuOpen;
        render();
      }
    }, [avatar, who]);

    if (state.userMenuOpen) {
      const menu = h("div", { class: "user-menu" });
      menu.addEventListener("click", e => e.stopPropagation());
      menu.appendChild(h("div", { style: "padding: 8px 12px; font-size: 12px; color: var(--ink-3);" },
        `Signed in as ${user.email}`));
      menu.appendChild(h("div", { class: "divider" }));
      if (!isClient) {
        menu.appendChild(h("button", {
          onclick: () => { state.userMenuOpen = false; setRoute("admin"); }
        }, "Admin · manage people"));
      }
      menu.appendChild(h("button", {
        onclick: () => {
          state.userMenuOpen = false;
          signOut();
          render();
        }
      }, "Sign out"));
      chip.appendChild(menu);

      // click-outside to close
      setTimeout(() => {
        const handler = () => { state.userMenuOpen = false; render(); };
        document.addEventListener("click", handler, { once: true });
      }, 10);
    }

    topright.appendChild(chip);

    return h("header", { class: "topbar" }, [brand, nav, topright]);
  }

  // ================================================================
  // FOOTER
  // ================================================================
  function renderFooter(user, org) {
    if (!user || user.role === "client") {
      // minimal footer for clients
      return h("footer", { class: "footer" }, [
        h("span", {}, `BeDeveloped Base Layers — ${org ? org.name : "client view"}`),
        h("span", {})
      ]);
    }
    const actions = h("span", { class: "footer-actions" }, [
      h("button", {
        class: "btn ghost",
        onclick: exportData
      }, "Export data"),
      (() => {
        const input = h("input", { type: "file", accept: "application/json", style: "display:none;" });
        input.addEventListener("change", (e) => {
          if (e.target.files && e.target.files[0]) importData(e.target.files[0]);
          e.target.value = "";
        });
        const btn = h("button", {
          class: "btn ghost",
          onclick: () => input.click()
        }, "Import data");
        return h("span", {}, [btn, input]);
      })()
    ]);
    return h("footer", { class: "footer" }, [
      h("span", {}, "BeDeveloped Base Layers — local build. Data stays in this browser."),
      actions
    ]);
  }

  // ================================================================
  // AUTH / LOGIN SCREEN
  // ================================================================
  function renderAuth() {
    const wrap = h("div", { class: "auth-wrap" });

    // Hero side
    wrap.appendChild(h("div", { class: "auth-hero" }, [
      h("img", { class: "hero-logo", src: "assets/logo.png", alt: "BeDeveloped" }),
      h("div", {}, [
        h("h1", {}, "Build effective early-stage sales processes that strengthen and improve your business development function."),
        h("p", { class: "lede" },
          "The ten-pillar operating model BeDeveloped uses to diagnose, design and develop early-stage sales functions into repeatable revenue engines."),
        h("hr", { class: "hero-accent" })
      ]),
      h("div", { class: "quote" }, "“Early-stage sales is a function, not a personality. Process beats heroics, and repeatability beats charisma.”")
    ]));

    // Form side
    const form = h("div", { class: "auth-form" });
    form.appendChild(renderSignInForm());
    wrap.appendChild(form);
    return wrap;
  }

  function renderFirstRunSetup() {
    const container = h("div");
    container.appendChild(h("h2", { class: "auth-heading" }, "First-time setup"));
    container.appendChild(h("p", { class: "auth-sub" },
      "Create the first BeDeveloped internal account. You'll use this to sign in and to invite clients."));

    const name  = h("input", { type: "text",     placeholder: "e.g. Luke Badiali" });
    const email = h("input", { type: "email",    placeholder: "you@bedeveloped.com" });
    const pass  = h("input", { type: "password", placeholder: "Team passphrase (shared by internal team)" });

    const errBox = h("div");

    const submit = h("button", {
      class: "auth-submit",
      onclick: async () => {
        errBox.innerHTML = "";
        if (!name.value.trim() || !email.value.trim() || pass.value.length < 4) {
          errBox.appendChild(h("div", { class: "auth-error" },
            "Please complete all fields. Passphrase must be at least 4 characters."));
          return;
        }
        await setInternalPassphrase(pass.value);
        const user = {
          id: uid("u_"),
          email: email.value.trim(),
          name: name.value.trim(),
          role: "internal",
          createdAt: iso()
        };
        upsertUser(user);
        signIn(user.id);
        render();
      }
    }, "Create account");

    [
      ["Your name", name],
      ["Email", email],
      ["Team passphrase", pass]
    ].forEach(([lbl, input]) => {
      container.appendChild(h("div", { class: "auth-field" }, [
        h("label", {}, lbl),
        input
      ]));
    });

    container.appendChild(errBox);
    container.appendChild(submit);

    container.appendChild(h("div", { class: "auth-help" },
      "The team passphrase is shared by all BeDeveloped internal team members. Client accounts you invite later will log in with their email only — they won't see this side of the app."));

    return container;
  }

  function renderSignInForm() {
    const container = h("div");

    const tabs = h("div", { class: "auth-tabs" }, [
      h("button", {
        class: state.authTab === "client" ? "active" : "",
        onclick: () => { state.authTab = "client"; state.authError = ""; render(); }
      }, "Client"),
      h("button", {
        class: state.authTab === "internal" ? "active" : "",
        onclick: () => { state.authTab = "internal"; state.authError = ""; render(); }
      }, "Internal team")
    ]);
    container.appendChild(tabs);

    if (state.authTab === "client") {
      container.appendChild(h("h2", { class: "auth-heading" }, "Client sign-in"));
      container.appendChild(h("p", { class: "auth-sub" },
        "Sign in with the email your BeDeveloped contact used to invite you, your company passphrase, and your personal password."));

      const email   = h("input", { type: "email",    placeholder: "you@company.com" });
      const team    = h("input", { type: "password", placeholder: "Company passphrase (shared)" });
      const pass    = h("input", { type: "password", placeholder: "Your password" });
      const passConfirm = h("input", { type: "password", placeholder: "Confirm password (first sign-in only)", style: "display:none;" });
      const errBox  = h("div");
      if (state.authError) errBox.appendChild(h("div", { class: "auth-error" }, state.authError));

      const hint = h("div", { class: "auth-help", style: "margin-top:0; padding-top:0; border:0;" },
        "First time signing in? Fill in your email + company passphrase, then set a password below. It'll be remembered next time.");

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
          state.authError = "We don't have a client account for that email. Ask your BeDeveloped contact to invite you.";
          render(); return;
        }
        if (!u.orgId) {
          state.authError = "Your client account isn't linked to an organisation yet. Contact BeDeveloped.";
          render(); return;
        }
        if (!orgHasClientPassphrase(u.orgId)) {
          state.authError = "Your organisation hasn't finished sign-in setup yet. Contact your BeDeveloped lead.";
          render(); return;
        }
        const okTeam = await verifyOrgClientPassphrase(u.orgId, team.value);
        if (!okTeam) {
          state.authError = "Company passphrase didn't match. Ask your BeDeveloped contact for the current one.";
          render(); return;
        }
        if (!u.passwordHash) {
          // First sign-in — password in "pass" field is a new password being set.
          if (pass.value.length < 4) {
            state.authError = "Choose a password of at least 4 characters.";
            render(); return;
          }
          if (pass.value !== passConfirm.value) {
            state.authError = "Password and confirmation don't match.";
            render(); return;
          }
          await setUserPassword(u.id, pass.value);
        } else {
          const okPass = await verifyUserPassword(u.id, pass.value);
          if (!okPass) {
            state.authError = "Password didn't match. Contact your BeDeveloped lead if you've forgotten it.";
            render(); return;
          }
        }
        signIn(u.id);
        state.route = "dashboard";
        render();
      };
      [email, team, pass, passConfirm].forEach(el =>
        el.addEventListener("keydown", e => { if (e.key === "Enter") doClientLogin(); })
      );

      [["Email", email], ["Company passphrase", team], ["Password", pass]].forEach(([lbl, input]) => {
        container.appendChild(h("div", { class: "auth-field" }, [
          h("label", {}, lbl),
          input
        ]));
      });
      container.appendChild(h("div", { class: "auth-field", style: "margin-top:-6px;" }, [passConfirm]));
      container.appendChild(hint);
      container.appendChild(errBox);
      container.appendChild(h("button", { class: "auth-submit", onclick: doClientLogin }, "Sign in"));

      container.appendChild(h("div", { class: "auth-help" },
        "Clients only see their own company's data. If your email or passphrase isn't working, ask your BeDeveloped contact."));
    } else {
      container.appendChild(h("h2", { class: "auth-heading" }, "Internal sign-in"));
      container.appendChild(h("p", { class: "auth-sub" },
        "BeDeveloped team members. Enter your work email and the team password."));

      const email = h("input", { type: "email",    placeholder: "you@bedeveloped.com" });
      const pass  = h("input", { type: "password", placeholder: "Team password" });
      const errBox = h("div");
      if (state.authError) errBox.appendChild(h("div", { class: "auth-error" }, state.authError));

      const doInternalLogin = async () => {
        state.authError = "";
        if (!isAllowedInternalEmail(email.value)) {
          state.authError = "That email isn't on the internal allowlist. Contact Luke to be added.";
          render(); return;
        }
        const ok = await verifyInternalPassword(pass.value);
        if (!ok) {
          state.authError = "Password didn't match. Ask another team member for the current one.";
          render(); return;
        }
        let u = findUserByEmail(email.value);
        if (u && u.role !== "internal") {
          state.authError = "That email is registered as a client.";
          render(); return;
        }
        if (!u) {
          u = {
            id: uid("u_"),
            email: email.value.trim().toLowerCase(),
            name: email.value.split("@")[0],
            role: "internal",
            createdAt: iso()
          };
          upsertUser(u);
        }
        signIn(u.id);
        state.route = "dashboard";
        render();
      };
      pass.addEventListener("keydown", e => { if (e.key === "Enter") doInternalLogin(); });
      email.addEventListener("keydown", e => { if (e.key === "Enter") doInternalLogin(); });

      [["Email", email], ["Team password", pass]].forEach(([lbl, input]) => {
        container.appendChild(h("div", { class: "auth-field" }, [
          h("label", {}, lbl),
          input
        ]));
      });
      container.appendChild(errBox);
      container.appendChild(h("button", { class: "auth-submit", onclick: doInternalLogin }, "Sign in"));

      container.appendChild(h("div", { class: "auth-help" },
        "Access is limited to the BeDeveloped internal team. You can invite clients after signing in."));
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
        h("p", { style: "color: var(--ink-3); max-width:480px; margin: 0 auto;" },
          "Your client account isn't linked to an organisation yet. Please contact your BeDeveloped team lead to finish setup.")
      ]);
    }
    return h("div", { class: "card", style: "text-align:center; padding:48px;" }, [
      h("h2", { style: "margin-top:0; font-size: 28px;" }, "Create your first client engagement"),
      h("p", { style: "color: var(--ink-3); max-width: 520px; margin: 0 auto 20px;" },
        "Start by adding an organisation. Then you can invite their team to complete the Base Layers diagnostic."),
      h("button", {
        class: "btn",
        onclick: () => promptText("New organisation", "e.g. Acme Ltd", (name) => {
          const org = createOrg(name);
          state.orgId = org.id;
          render();
        })
      }, "+ Create organisation")
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
    const respUsers = respondents.map(id => findUser(id)).filter(Boolean);

    // Heading
    frag.appendChild(h("h1", { class: "view-title" }, org.name));

    frag.appendChild(h("p", { class: "view-sub" },
      summary.scoredCount === 0
        ? "No diagnostics completed yet. Start scoring a pillar to see the Base Layers view."
        : `Scored ${summary.scoredCount} of ${DATA.pillars.length} pillars. Overall health ${summary.avg ?? "—"} / 100.`
    ));

    // Round bar
    frag.appendChild(renderRoundBar(user, org, currentRound, prevRound, respUsers));

    // Top row
    const dashTop = h("div", { class: "dash-top" });

    // Radar card
    const chartCard = h("div", { class: "card" });
    chartCard.appendChild(h("h3", {}, "Base Layers"));
    const chartWrap = h("div", { class: "chart-wrap" });
    chartWrap.appendChild(h("canvas", { id: "radar" }));
    chartCard.appendChild(chartWrap);
    dashTop.appendChild(chartCard);

    // Summary card
    const sumCard = h("div", { class: "card" });
    sumCard.appendChild(h("h3", {}, "Health summary"));
    const grid = h("div", { class: "summary-grid" }, [
      summaryCell("Overall", summary.avg !== null ? `${summary.avg}` : "—", "overall"),
      summaryCell("Red",   summary.red,   "red"),
      summaryCell("Amber", summary.amber, "amber"),
      summaryCell("Green", summary.green, "green"),
      summaryCell("Not scored", summary.gray, "gray"),
      summaryCell("Pillars", `${summary.scoredCount}/${DATA.pillars.length}`, "count")
    ]);
    sumCard.appendChild(grid);

    if (constraints.length) {
      const tc = h("div", { class: "top-constraints" });
      tc.appendChild(h("h3", {}, "Top constraints"));
      const ol = h("ol");
      constraints.forEach(p => {
        const s = pillarScore(org, p.id);
        const li = h("li", {}, [
          h("a", {
            href: "#",
            onclick: (e) => { e.preventDefault(); setRoute("pillar:" + p.id); }
          }, p.name),
          ` — ${s}/100`
        ]);
        ol.appendChild(li);
      });
      tc.appendChild(ol);
      sumCard.appendChild(tc);
    }
    dashTop.appendChild(sumCard);
    frag.appendChild(dashTop);

    // Tiles (accordion — click to expand in place)
    const tilesHeader = h("div", { style: "display:flex; justify-content:space-between; align-items:baseline; margin-top:28px; margin-bottom:10px;" }, [
      h("h2", { style: "margin:0;" }, "The ten pillars"),
      h("button", {
        class: "btn ghost sm",
        style: "border-color:var(--line); color:var(--ink-3);",
        onclick: () => {
          if (state.expandedPillars.size === DATA.pillars.length) state.expandedPillars.clear();
          else DATA.pillars.forEach(p => state.expandedPillars.add(p.id));
          render();
        }
      }, state.expandedPillars.size === DATA.pillars.length ? "Collapse all" : "Expand all")
    ]);
    frag.appendChild(tilesHeader);

    const tiles = h("div", { class: "tiles" });
    DATA.pillars.forEach(p => {
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
        }
      });
      tile.appendChild(h("div", { class: "num" }, `PILLAR ${String(p.id).padStart(2,"0")}`));
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
        scoreWrap.appendChild(h("span", { class: cls, style: "font-size:12px;" },
          `${arrow} ${Math.abs(d)}`));
      }
      foot.appendChild(scoreWrap);

      const rightFoot = h("div", { style: "display:flex; align-items:center; gap:8px;" });
      rightFoot.appendChild(h("span", { class: `badge ${status}` },
        statusLabel(status, done, total)));
      rightFoot.appendChild(h("span", { class: "tile-caret", "aria-hidden": "true" }, "▾"));
      foot.appendChild(rightFoot);
      tile.appendChild(foot);

      // Expansion body
      if (isOpen) {
        const exp = h("div", { class: "tile-expansion", onclick: (e) => e.stopPropagation() });
        exp.appendChild(h("p", { class: "exp-desc" }, p.dashDescription || p.overview));
        exp.appendChild(h("div", { class: "exp-achieve" }, [
          h("span", { class: "exp-achieve-label" }, "What we're trying to achieve "),
          h("span", {}, p.dashAchieve || "")
        ]));
        exp.appendChild(h("div", { class: "exp-actions" }, [
          h("button", {
            class: "btn sm secondary",
            onclick: (e) => { e.stopPropagation(); setRoute("pillar:" + p.id); }
          }, "Open full diagnostic →")
        ]));
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
      "Governance structures that maintain discipline and quality as the organisation scales"
    ];
    const isOpen = state.expandedPillars.has("opex");
    const tile = h("div", {
      class: "tile opex" + (isOpen ? " expanded" : ""),
      onclick: () => {
        if (isOpen) state.expandedPillars.delete("opex");
        else state.expandedPillars.add("opex");
        render();
      }
    });
    tile.appendChild(h("div", { class: "num" }, "PERFORMANCE LAYER"));
    tile.appendChild(h("div", { class: "name" }, "Operational Excellence"));
    if (!isOpen) {
      tile.appendChild(h("div", { class: "tag" },
        "Underpins the ten pillars to ensure clarity and coaching is developed, not just strategy and theory. Ensures early-stage sales is implemented, adopted and sustained, not treated as a one-off initiative or leadership push."));
    }

    const foot = h("div", { class: "foot", style: "justify-content: flex-end;" });
    foot.appendChild(h("span", { class: "tile-caret", "aria-hidden": "true" }, "▾"));
    tile.appendChild(foot);

    if (isOpen) {
      const exp = h("div", { class: "tile-expansion", onclick: (e) => e.stopPropagation() });
      exp.appendChild(h("p", { class: "exp-desc" },
        "Underpins the ten pillars to ensure clarity and coaching is developed, not just strategy and theory. Ensures early-stage sales is implemented, adopted and sustained, not treated as a one-off initiative or leadership push."));
      const ul = h("ul", { class: "opex-list" });
      points.forEach(p => ul.appendChild(h("li", {}, p)));
      exp.appendChild(ul);
      tile.appendChild(exp);
    }
    return tile;
  }

  function answerSummaryForPillar(org, pillarId) {
    const byUser = (org.responses || {})[org.currentRoundId] || {};
    let done = 0, total = 0;
    Object.values(byUser).forEach(perPillar => {
      const qs = (perPillar || {})[pillarId] || {};
      total += DATA.pillars.find(p => p.id === pillarId).diagnostics.length;
      done  += Object.values(qs).filter(r => Number.isFinite(r.score)).length;
    });
    return { done, total };
  }

  function renderRoundBar(user, org, currentRound, prevRound, respUsers) {
    const bar = h("div", { class: "round-bar" });
    const label = h("div", { class: "round-label" });

    label.appendChild(h("span", { class: "round-pill" }, currentRound ? currentRound.label : "Round 1"));
    label.appendChild(h("span", { class: "round-meta" },
      `started ${formatDate(currentRound?.createdAt)}`));

    if (respUsers.length) {
      const stack = h("span", { class: "respondent-stack", style: "display:inline-flex; margin-left:10px;" });
      respUsers.slice(0, 5).forEach(u => {
        stack.appendChild(h("span", { class: "avatar", title: u.name || u.email },
          initials(u.name || u.email)));
      });
      label.appendChild(stack);
      label.appendChild(h("span", { class: "respondents-chip" },
        `${respUsers.length} respondent${respUsers.length === 1 ? "" : "s"}`));
    } else {
      label.appendChild(h("span", { class: "respondents-chip" }, "No respondents yet"));
    }

    if (prevRound) {
      label.appendChild(h("span", { class: "round-meta", style: "margin-left:10px;" },
        `· previous: ${prevRound.label}`));
    }

    bar.appendChild(label);

    const actions = h("div", { class: "round-bar-actions" });
    if (!isClientView(user)) {
      actions.appendChild(h("button", {
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
            "Start new round"
          );
        }
      }, "+ Start new round"));
    }
    bar.appendChild(actions);
    return bar;
  }

  function summaryCell(label, value, cls) {
    return h("div", { class: `summary-cell ${cls}` }, [
      h("div", { class: "label" }, label),
      h("div", { class: "value" }, String(value ?? "—"))
    ]);
  }

  function statusLabel(status, done, total) {
    if (status === "gray") return done > 0 ? `${done}/${total} answers` : "Not scored";
    return { red: "Red", amber: "Amber", green: "Green" }[status];
  }

  function drawRadar(org, prevRoundId) {
    if (!window.Chart) { setTimeout(() => drawRadar(org, prevRoundId), 120); return; }
    const canvas = $("#radar");
    if (!canvas) return;

    const labels = DATA.pillars.map(p => p.shortName || p.name);
    const curr = DATA.pillars.map(p => pillarScore(org, p.id) ?? 0);

    const datasets = [];
    if (prevRoundId) {
      const prev = DATA.pillars.map(p => pillarScoreForRound(org, prevRoundId, p.id) ?? 0);
      datasets.push({
        label: "Previous",
        data: prev,
        fill: true,
        backgroundColor: "rgba(237, 125, 49, 0.12)",
        borderColor: "rgba(237, 125, 49, 0.9)",
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 2,
        pointBackgroundColor: "#ED7D31"
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
      pointBackgroundColor: "#579EC0"
    });

    state.chart = new Chart(canvas.getContext("2d"), {
      type: "radar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: !!prevRoundId, position: "bottom", labels: { font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.r}/100` } }
        },
        scales: {
          r: {
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: { stepSize: 20, color: "#8a94a7", backdropColor: "rgba(0,0,0,0)", font: { size: 10 } },
            grid: { color: "#e3e6ee" },
            angleLines: { color: "#e3e6ee" },
            pointLabels: { font: { size: 11, family: "Inter" }, color: "#303849" }
          }
        }
      }
    });
  }

  // ================================================================
  // DIAGNOSTIC INDEX
  // ================================================================
  function renderDiagnosticIndex(user, org) {
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Diagnostic"));
    frag.appendChild(h("p", { class: "view-sub" },
      isClientView(user)
        ? "Score each pillar honestly against the diagnostic questions. Your responses join the team view."
        : "Score each pillar against its diagnostic questions. Evidence-based, 1–5."));

    // Show current user's own completion if client/internal preview
    if (isClientView(user)) {
      const pct = userCompletionPct(org, org.currentRoundId, user.id);
      frag.appendChild(h("div", {
        style: "background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); padding:14px 18px; margin-bottom:16px; display:flex; gap:14px; align-items:center;"
      }, [
        h("span", { class: "avatar" }, initials(user.name || user.email)),
        h("div", { style: "flex:1;" }, [
          h("div", { style: "font-weight:600;" }, "Your progress"),
          h("div", { style: "color: var(--ink-3); font-size: 12px;" },
            `${pct}% of ${DATA.pillars.length * DATA.pillars[0].diagnostics.length} questions answered`)
        ]),
        h("div", {
          style: "height:8px; width:180px; background:var(--line); border-radius:999px; overflow:hidden;"
        }, h("span", {
          style: `display:block; height:100%; width:${pct}%; background:var(--brand);`
        }))
      ]));
    }

    const tiles = h("div", { class: "tiles" });
    DATA.pillars.forEach(p => {
      const s = pillarScore(org, p.id);
      const status = pillarStatus(s);
      const unread = unreadCountForPillar(org, p.id, user);

      // For the current user's answered state
      let userDone = 0;
      const userResp = (((org.responses || {})[org.currentRoundId] || {})[user.id] || {})[p.id] || {};
      userDone = Object.values(userResp).filter(r => Number.isFinite(r.score)).length;
      const total = p.diagnostics.length;

      const tile = h("div", {
        class: "tile",
        onclick: () => setRoute("pillar:" + p.id)
      });
      tile.appendChild(h("div", { class: "num" }, `PILLAR ${String(p.id).padStart(2,"0")}`));
      tile.appendChild(h("div", { class: "name" }, p.name));
      tile.appendChild(h("div", { class: "tag" },
        isClientView(user)
          ? `${userDone}/${total} of your answers · team score ${s !== null ? s + "/100" : "—"}`
          : `${userDone}/${total} of your answers · team score ${s !== null ? s + "/100" : "—"}`
      ));
      const foot = h("div", { class: "foot" });
      foot.appendChild(h("div", { class: "score" }, s !== null ? `${s}` : "—"));
      const badgeWrap = h("div", { style: "display:flex; gap:6px; align-items:center;" });
      if (unread > 0) badgeWrap.appendChild(h("span", { class: "count-badge", title: "Unread comments" }, unread));
      badgeWrap.appendChild(h("span", { class: `badge ${status}` }, statusLabel(status, userDone, total)));
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
    const p = DATA.pillars.find(x => x.id === pillarId);
    if (!p) return h("div", {}, "Pillar not found.");

    // mark comments read on load
    markPillarRead(org, pillarId, user);

    const s = pillarScore(org, p.id);
    const status = pillarStatus(s);
    const isClient = isClientView(user);

    const frag = h("div");

    // Header
    frag.appendChild(h("div", { class: "pillar-header" }, [
      h("div", {}, [
        h("button", {
          class: "back",
          onclick: () => setRoute("diagnostic")
        }, "← Back to diagnostic"),
        h("div", { class: "pillar-pill" }, `PILLAR ${String(p.id).padStart(2,"0")}`),
        h("h1", { class: "view-title", style: "margin-top:2px;" }, p.name),
        h("p", { class: "view-sub", style: "max-width:720px;" }, p.tagline)
      ]),
      h("span", { class: `badge ${status}` }, s !== null ? `${s}/100 team` : "Not scored")
    ]));

    // Overview card
    frag.appendChild(h("div", { class: "card", style: "margin-bottom:20px;" }, [
      h("p", {}, p.overview)
    ]));

    const grid = h("div", { class: "pillar-grid" });

    // Left: diagnostic questions (user's own)
    const left = h("div");
    left.appendChild(h("h3", {}, isClient ? "Your responses" : "Diagnostic questions (your responses)"));
    p.diagnostics.forEach((q, idx) => {
      left.appendChild(renderQuestion(user, org, p, idx, q));
    });

    // Team average (if more than self-has-answered)
    const teamPanel = renderTeamResponses(user, org, p);
    if (teamPanel) left.appendChild(teamPanel);

    // Comments thread
    left.appendChild(renderComments(user, org, p));

    grid.appendChild(left);

    // Right: side panels
    const right = h("div");
    right.appendChild(renderScoreBlock(org, p));
    right.appendChild(sidePanel("Objectives", p.objectives));
    right.appendChild(sidePanel("Components", p.components));
    right.appendChild(sidePanel("Outcomes",   p.outcomes));
    if (!isClient) right.appendChild(sidePanel("What we do (internal)", p.whatWeDo, true));

    // Pillar-specific actions
    const filteredActions = (org.actions || [])
      .filter(a => a.pillarId === p.id)
      .filter(a => !isClient || !a.internal);

    const actionsPanel = h("div", { class: "side-panel" }, [
      h("div", { style: "display:flex; justify-content:space-between; align-items:center;" }, [
        h("h3", { style: "margin:0;" }, "Actions"),
        h("button", {
          class: "btn sm",
          onclick: () => promptText("New action", "e.g. Validate ICP with closed-won data",
            (title) => { addAction(user.id, p.id, title); render(); })
        }, "+ Add")
      ]),
      filteredActions.length === 0
        ? h("p", { style: "color: var(--ink-3); font-size:13px; margin-top:10px;" }, "No actions yet.")
        : h("ul", {}, filteredActions.map(a =>
            h("li", { style: a.done ? "text-decoration:line-through; color: var(--ink-4);" : "" }, a.title)
          ))
    ]);
    right.appendChild(actionsPanel);

    grid.appendChild(right);
    frag.appendChild(grid);
    return frag;
  }

  function renderQuestion(user, org, p, idx, qText) {
    const resp = (((((org.responses || {})[org.currentRoundId] || {})[user.id] || {})[p.id] || {})[idx]) || {};
    const card = h("div", { class: "q-card" });
    card.appendChild(h("div", { class: "q-text" }, `${idx + 1}. ${qText}`));

    // Likert
    const likert = h("div", { class: "likert" });
    for (let n = 1; n <= 5; n++) {
      const btn = h("button", {
        class: resp.score === n ? "sel" : "",
        onclick: () => { setResponse(user, org, p.id, idx, { score: n }); render(); }
      }, [
        h("span", { class: "n" }, String(n)),
        h("span", { class: "t" }, DATA.scoreLabels[n])
      ]);
      likert.appendChild(btn);
    }
    card.appendChild(likert);

    // Evidence note
    card.appendChild(h("div", { style: "font-size:11px; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-3); margin-bottom:4px;" }, "Evidence / notes (your answer)"));
    const note = h("textarea", {
      class: "note",
      placeholder: "Evidence, examples, links to artefacts…"
    });
    note.value = resp.note || "";
    note.addEventListener("blur", () => setResponse(user, org, p.id, idx, { note: note.value }));
    card.appendChild(note);

    // Internal shared note (not per-user)
    if (!isClientView(user)) {
      const internalText = ((org.internalNotes || {})[p.id] || {})[idx] || "";
      card.appendChild(h("div", { class: "internal-badge", style: "margin-top:10px;" }, "Internal shared note"));
      const inote = h("textarea", {
        class: "note internal-note",
        placeholder: "BeDeveloped commentary — visible to the team only."
      });
      inote.value = internalText;
      inote.addEventListener("blur", () => {
        const o = loadOrg(org.id);
        o.internalNotes = o.internalNotes || {};
        o.internalNotes[p.id] = o.internalNotes[p.id] || {};
        o.internalNotes[p.id][idx] = inote.value;
        saveOrg(o);
      });
      card.appendChild(inote);
    }
    return card;
  }

  function renderTeamResponses(user, org, p) {
    const byUser = ((org.responses || {})[org.currentRoundId] || {});
    const users = Object.keys(byUser);
    if (users.length <= 1) return null;

    const panel = h("div", { class: "card", style: "margin-top:16px;" });
    panel.appendChild(h("h3", { style: "margin-top:0;" },
      `Team responses (${users.length} respondents)`));

    p.diagnostics.forEach((q, idx) => {
      const row = h("div", { style: "padding: 10px 0; border-top: 1px solid var(--line);" });
      row.appendChild(h("div", { style: "font-size:13px; font-weight:500; margin-bottom:6px;" }, `Q${idx + 1}. ${q}`));
      const scores = h("div", { style: "display:flex; flex-wrap:wrap; gap:6px;" });
      users.forEach(uid => {
        const u = findUser(uid);
        const r = ((byUser[uid] || {})[p.id] || {})[idx];
        const score = r?.score;
        const pill = h("span", {
          title: (u?.name || u?.email || "respondent") + (score ? ` — ${score}/5` : " — no answer"),
          style: `display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:999px; background:var(--surface-muted); border:1px solid var(--line); font-size:11px; color:var(--ink-2);`
        }, [
          h("span", {
            class: "avatar",
            style: "width:16px; height:16px; font-size:8px;"
          }, initials(u?.name || u?.email || "")),
          score ? `${score}/5` : "—"
        ]);
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
        h("span", { class: "out" }, " / 100")
      ]),
      h("div", { class: "bar" },
        h("span", { style: `width:${s ?? 0}%; background:${statusColor(status)};` })),
      h("div", { style: "color: var(--ink-3); font-size:12px;" },
        `${done}/${total} team answers`)
    ]);
    return block;
  }

  function statusColor(status) {
    return { red: "var(--red)", amber: "var(--amber)", green: "var(--green)", gray: "var(--line-2)" }[status];
  }

  function sidePanel(title, items, internal = false) {
    return h("div", { class: "side-panel" }, [
      internal ? h("span", { class: "internal-badge" }, "Internal only") : null,
      h("h3", { style: "margin-top:0;" }, title),
      h("ul", {}, items.map(x => h("li", {}, x)))
    ]);
  }

  function setResponse(user, org, pillarId, idx, patch) {
    const o = loadOrg(org.id);
    o.responses = o.responses || {};
    o.responses[o.currentRoundId] = o.responses[o.currentRoundId] || {};
    o.responses[o.currentRoundId][user.id] = o.responses[o.currentRoundId][user.id] || {};
    o.responses[o.currentRoundId][user.id][pillarId] = o.responses[o.currentRoundId][user.id][pillarId] || {};
    const cur = o.responses[o.currentRoundId][user.id][pillarId][idx] || {};
    o.responses[o.currentRoundId][user.id][pillarId][idx] = Object.assign({}, cur, patch);
    saveOrg(o);
  }

  // ================================================================
  // COMMENTS (Slack-style)
  // ================================================================
  function renderComments(user, org, p) {
    const wrap = h("div", { class: "comments" });
    const list = commentsFor(org, p.id, user);
    const lastRead = ((org.readStates || {})[user.id] || {})[p.id];
    const lastReadT = lastRead ? new Date(lastRead).getTime() : 0;

    wrap.appendChild(h("h3", {}, [
      h("span", {}, `Discussion (${list.length})`),
      list.length
        ? h("span", { style: "font-weight:400; font-size:12px; color:var(--ink-3);" }, "Most recent first")
        : null
    ]));

    const listEl = h("div", { class: "comment-list" });
    if (list.length === 0) {
      listEl.appendChild(h("p", { style: "color: var(--ink-3); font-size:13px; margin:0;" },
        "No comments yet. Ask a question or leave a note — BeDeveloped and the team will see it here."));
    } else {
      list.slice().reverse().forEach(c => {
        const author = findUser(c.authorId);
        const isSelf = c.authorId === user.id;
        const isNew = !isSelf && new Date(c.createdAt).getTime() > lastReadT;
        const row = h("div", { class: "comment" + (isNew ? " unread" : "") });
        row.appendChild(h("span", { class: "avatar" + (author?.role === "internal" ? " internal" : "") },
          initials(author?.name || author?.email || "?")));
        const body = h("div");
        body.appendChild(h("div", { class: "head" }, [
          h("span", { class: "name" }, author?.name || author?.email || "Unknown"),
          h("span", { class: "when" }, formatWhen(c.createdAt)),
          c.internal ? h("span", { class: "tag-internal" }, "Internal") : null
        ]));
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
        : "Reply to the client, or leave a note for your team…"
    });
    const optsCol = h("div", { class: "opts" });
    let internalOnly = false;
    if (!isClientView(user)) {
      const lbl = h("label", {}, [
        h("input", {
          type: "checkbox",
          onchange: (e) => internalOnly = e.target.checked
        }),
        h("span", {}, "Internal only")
      ]);
      optsCol.appendChild(lbl);
    }
    const post = h("button", {
      class: "btn",
      onclick: () => {
        const text = ta.value.trim();
        if (!text) return;
        const o = loadOrg(org.id);
        addComment(o, p.id, user.id, text, internalOnly);
        ta.value = "";
        render();
      }
    }, "Post");
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
      id: uid("act_"), pillarId, title, owner, due,
      done: false, internal, createdAt: iso(), createdBy
    });
    saveOrg(o);
  }
  function updateAction(id, patch) {
    const user = currentUser();
    const orgMeta = activeOrgForUser(user);
    const o = loadOrg(orgMeta.id);
    o.actions = (o.actions || []).map(a => a.id === id ? Object.assign({}, a, patch) : a);
    saveOrg(o);
  }
  function deleteAction(id) {
    const user = currentUser();
    const orgMeta = activeOrgForUser(user);
    const o = loadOrg(orgMeta.id);
    o.actions = (o.actions || []).filter(a => a.id !== id);
    saveOrg(o);
  }

  function renderActions(user, org) {
    const isClient = isClientView(user);
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Action plan"));
    frag.appendChild(h("p", { class: "view-sub" }, "Cross-pillar action tracker. Assign owners, set due dates, mark complete."));

    const all = (org.actions || []).filter(a => !isClient || !a.internal);
    const toolbar = h("div", { style: "display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;" }, [
      h("div", {}, `${all.length} total · ${all.filter(a => a.done).length} complete`),
      h("button", { class: "btn", onclick: () => openActionModal(user) }, "+ New action")
    ]);
    frag.appendChild(toolbar);

    if (!all.length) {
      frag.appendChild(h("div", { class: "empty" },
        "No actions yet. Add one from here or from any pillar detail page."));
      return frag;
    }

    const table = h("div", { class: "actions-table" });
    table.appendChild(h("div", { class: "action-row" }, [
      h("div", {}, "✓"),
      h("div", {}, "Action"),
      h("div", {}, "Pillar"),
      h("div", {}, "Owner"),
      h("div", {}, "Due"),
      h("div", {}, "")
    ]));
    all.forEach(a => table.appendChild(renderActionRow(a)));
    frag.appendChild(table);
    return frag;
  }

  function renderActionRow(a) {
    const p = DATA.pillars.find(x => x.id === a.pillarId);
    const row = h("div", { class: `action-row ${a.done ? "done" : ""}` });

    const chk = h("input", { type: "checkbox" });
    chk.checked = !!a.done;
    chk.addEventListener("change", () => { updateAction(a.id, { done: chk.checked }); render(); });
    row.appendChild(chk);

    const title = h("input", { type: "text", class: "a-title", value: a.title });
    title.addEventListener("blur", () => updateAction(a.id, { title: title.value }));
    row.appendChild(title);

    row.appendChild(h("div", {}, [
      h("a", {
        href: "#",
        onclick: (e) => { e.preventDefault(); setRoute("pillar:" + a.pillarId); }
      }, p ? p.name : "—")
    ]));

    const owner = h("input", { type: "text", class: "a-owner", placeholder: "Owner", value: a.owner || "" });
    owner.addEventListener("blur", () => updateAction(a.id, { owner: owner.value }));
    row.appendChild(owner);

    const due = h("input", { type: "date", class: "a-due", value: a.due || "" });
    due.addEventListener("change", () => updateAction(a.id, { due: due.value }));
    row.appendChild(due);

    const del = h("button", {
      class: "btn ghost sm",
      style: "border-color: var(--line);",
      onclick: () => confirmDialog("Delete action?", "This cannot be undone.",
        () => { deleteAction(a.id); render(); }, "Delete")
    }, "×");
    row.appendChild(del);
    return row;
  }

  function openActionModal(user) {
    const title = h("input", { type: "text", placeholder: "Action description" });
    const select = h("select", { style: "width:100%; padding:10px; border:1px solid var(--line); border-radius:8px; font:inherit;" });
    DATA.pillars.forEach(p => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = `${p.id}. ${p.name}`;
      select.appendChild(o);
    });
    const internalWrap = !isClientView(user)
      ? h("label", { style: "display:flex; gap:6px; align-items:center; font-size:13px; margin-top:10px;" }, [
          h("input", { type: "checkbox", id: "actInternal" }),
          "Internal only (hidden from client view)"
        ])
      : null;

    const m = modal([
      h("h3", {}, "New action"),
      title,
      h("div", { style: "height:10px;" }),
      select,
      internalWrap,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        h("button", {
          class: "btn",
          onclick: () => {
            const t = title.value.trim();
            if (!t) return;
            const internal = internalWrap ? internalWrap.querySelector("input").checked : false;
            addAction(user.id, Number(select.value), t, { internal });
            m.close();
            render();
          }
        }, "Add")
      ])
    ]);
    setTimeout(() => title.focus(), 10);
  }

  // ================================================================
  // ENGAGEMENT
  // ================================================================
  function renderEngagement(user, org) {
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Engagement lifecycle"));
    frag.appendChild(h("p", { class: "view-sub" },
      "Every BeDeveloped engagement runs through four stages. Track progress and readiness to move on."));

    const current = org.engagement?.currentStageId || "diagnosed";
    const stages = h("div", { class: "stages" });
    DATA.engagementStages.forEach((s, i) => {
      const checks = (org.engagement?.stageChecks || {})[s.id] || {};
      const checkedCount = s.checklist.filter((_, idx) => checks[idx]).length;
      const pct = Math.round((checkedCount / s.checklist.length) * 100);

      const card = h("div", {
        class: `stage-card ${current === s.id ? "active" : ""}`,
        onclick: () => {
          if (isClientView(user)) return; // clients can't change stage
          setEngagementStage(org.id, s.id);
        }
      }, [
        h("div", { class: "n" }, `STAGE ${i + 1}`),
        h("div", { class: "name" }, s.name),
        h("div", { class: "sum" }, s.summary),
        h("div", { class: "progress" }, h("span", { style: `width:${pct}%;` })),
        h("div", { style: "font-size:11px; color:var(--ink-3); margin-top:4px;" }, `${checkedCount}/${s.checklist.length} complete`)
      ]);
      stages.appendChild(card);
    });
    frag.appendChild(stages);

    const stage = DATA.engagementStages.find(s => s.id === current);
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
  function renderReport(user, org) {
    const frag = h("div");
    const summary = orgSummary(org);
    const constraints = topConstraints(org, 3);
    const stage = DATA.engagementStages.find(s => s.id === (org.engagement?.currentStageId || "diagnosed"));
    const isClient = isClientView(user);
    const round = roundById(org, org.currentRoundId);
    const prevRoundId = previousRoundId(org);

    frag.appendChild(h("div", { class: "report-toolbar" }, [
      h("button", { class: "btn secondary", onclick: () => window.print() }, "Print / save PDF"),
      !isClient ? h("button", { class: "btn secondary", onclick: exportData }, "Export JSON") : null
    ]));

    const r = h("div", { class: "report" });
    r.appendChild(h("h1", {}, `Base Layers diagnostic — ${org.name}`));
    r.appendChild(h("div", { class: "sub" },
      `${isClient ? "Client view" : "Internal view"} · ${round?.label || "Current round"} · Generated ${new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`));

    r.appendChild(reportRow("Overall health",
      summary.avg !== null ? `${summary.avg} / 100` : "Not yet scored"));
    r.appendChild(reportRow("Pillars scored", `${summary.scoredCount} of ${DATA.pillars.length}`));
    r.appendChild(reportRow("Status mix",
      `${summary.green} green · ${summary.amber} amber · ${summary.red} red · ${summary.gray} not scored`));
    r.appendChild(reportRow("Engagement stage", stage ? stage.name : "—"));
    const respondents = respondentsForRound(org, org.currentRoundId);
    r.appendChild(reportRow("Respondents", `${respondents.length}`));

    if (constraints.length) {
      r.appendChild(reportRow("Top constraints",
        constraints.map((p, i) => `${i + 1}. ${p.name} (${pillarScore(org, p.id)}/100)`).join(" · ")));
    }

    const rp = h("div", { class: "r-pillars" });
    rp.appendChild(h("h2", { style: "margin-top:28px;" }, "Pillar detail"));
    DATA.pillars.forEach(p => {
      const s = pillarScore(org, p.id);
      const prevS = prevRoundId ? pillarScoreForRound(org, prevRoundId, p.id) : null;
      const status = pillarStatus(s);
      const { done, total } = answerSummaryForPillar(org, p.id);

      const block = h("div", { class: "r-pillar" });
      const header = h("header", {}, [
        h("span", { class: "name" }, `${p.id}. ${p.name}`),
        h("span", { class: "meta" }, [
          s !== null ? `${s}/100` : "—",
          prevS !== null ? ` (was ${prevS})` : "",
          " · ",
          h("span", { class: `badge ${status}` }, statusLabel(status, done, total))
        ])
      ]);
      block.appendChild(header);
      block.appendChild(h("p", {}, p.tagline));

      // Internal notes shown only to internal
      const iNote = ((org.internalNotes || {})[p.id] || {});
      if (!isClient) {
        Object.entries(iNote).forEach(([idx, text]) => {
          if (!text) return;
          block.appendChild(h("div", { class: "r-notes internal-note", style: "margin-top:6px;" }, [
            h("span", { class: "internal-badge" }, "Internal"),
            h("div", { style: "font-size:12px; color:var(--ink-3);" }, `Q${Number(idx) + 1}: ${p.diagnostics[idx]}`),
            h("div", {}, text)
          ]));
        });
      }

      const actions = (org.actions || []).filter(a => a.pillarId === p.id && (!isClient || !a.internal));
      if (actions.length) {
        block.appendChild(h("div", { style: "margin-top:10px; font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-3);" }, "Actions"));
        const ul = h("ul", { style: "margin:4px 0 0; padding-left:18px; font-size:13px;" });
        actions.forEach(a => ul.appendChild(h("li", {
          style: a.done ? "text-decoration:line-through; color:var(--ink-4);" : ""
        }, [
          a.title,
          a.owner ? ` · ${a.owner}` : "",
          a.due ? ` · due ${a.due}` : ""
        ])));
        block.appendChild(ul);
      }
      rp.appendChild(block);
    });
    r.appendChild(rp);
    frag.appendChild(r);
    return frag;
  }

  function reportRow(label, value) {
    return h("div", { class: "row" }, [
      h("div", { class: "label" }, label),
      h("div", {}, value)
    ]);
  }

  // ================================================================
  // ADMIN (internal only)
  // ================================================================
  function renderAdmin(user) {
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Admin"));
    frag.appendChild(h("p", { class: "view-sub" },
      "Manage organisations and client accounts. Client accounts see only their own organisation."));

    // Organisations
    frag.appendChild(h("h2", {}, "Organisations"));
    const orgs = loadOrgMetas();
    const orgCard = h("div", { class: "card" });

    const orgBar = h("div", { style: "display:flex; justify-content:flex-end; margin-bottom:12px;" }, [
      h("button", {
        class: "btn",
        onclick: () => promptText("New organisation", "e.g. Acme Ltd", (name) => {
          const o = createOrg(name);
          state.orgId = o.id;
          render();
        })
      }, "+ New organisation")
    ]);
    orgCard.appendChild(orgBar);

    if (!orgs.length) {
      orgCard.appendChild(h("p", { style: "color: var(--ink-3);" }, "None yet."));
    } else {
      const table = h("div");
      orgs.forEach(m => {
        const o = loadOrg(m.id);
        const clients = loadUsers().filter(u => u.role === "client" && u.orgId === m.id);
        const row = h("div", { style: "display:grid; grid-template-columns: 1.5fr 1fr 1fr auto; gap:12px; align-items:center; padding:12px 0; border-top:1px solid var(--line);" });
        row.appendChild(h("div", {}, [
          h("div", { style: "font-weight:600;" }, m.name),
          h("div", { style: "color:var(--ink-3); font-size:12px;" },
            `${(o?.rounds?.length || 0)} round(s) · ${respondentsForRound(o, o.currentRoundId).length} respondents`)
        ]));
        const hasPass = !!(o && o.clientPassphraseHash);
        row.appendChild(h("div", {}, [
          h("div", {}, `${clients.length} client user${clients.length === 1 ? "" : "s"}`),
          h("div", { style: `font-size:11px; margin-top:2px; color: ${hasPass ? "var(--green)" : "var(--amber)"};` },
            hasPass ? "✓ passphrase set" : "⚠ no passphrase")
        ]));
        row.appendChild(h("div", {}, formatDate(o?.createdAt)));
        row.appendChild(h("div", { style: "display:flex; gap:6px;" }, [
          h("button", {
            class: "btn secondary sm",
            onclick: () => { state.orgId = m.id; setRoute("dashboard"); }
          }, "Open"),
          h("button", {
            class: "btn ghost sm",
            onclick: () => openSetOrgPassphrase(m.id, m.name)
          }, hasPass ? "Change passphrase" : "Set passphrase"),
          h("button", {
            class: "btn ghost sm danger",
            onclick: () => confirmDialog("Delete organisation?",
              `This deletes ${m.name}, all its diagnostic data, and any client accounts linked to it. Cannot be undone.`,
              () => { deleteOrg(m.id); render(); }, "Delete")
          }, "Delete")
        ]));
        table.appendChild(row);
      });
      orgCard.appendChild(table);
    }
    frag.appendChild(orgCard);

    // Client users
    frag.appendChild(h("h2", {}, "Client accounts"));
    const allClients = loadUsers().filter(u => u.role === "client");
    const usersCard = h("div", { class: "card" });

    const userBar = h("div", { style: "display:flex; justify-content:flex-end; margin-bottom:12px;" }, [
      h("button", {
        class: "btn",
        onclick: () => openInviteClientModal()
      }, "+ Invite client")
    ]);
    usersCard.appendChild(userBar);

    if (!allClients.length) {
      usersCard.appendChild(h("p", { style: "color: var(--ink-3);" }, "No client users yet. Invite someone to let them log in."));
    } else {
      const table = h("div");
      table.appendChild(h("div", {
        style: "display:grid; grid-template-columns: 1fr 1.5fr 1fr auto; gap:12px; padding:8px 0; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:var(--ink-3);"
      }, [
        h("div", {}, "Name"),
        h("div", {}, "Email"),
        h("div", {}, "Organisation"),
        h("div", {}, "")
      ]));
      allClients.forEach(u => {
        const o = u.orgId ? loadOrgMetas().find(m => m.id === u.orgId) : null;
        const row = h("div", {
          style: "display:grid; grid-template-columns: 1fr 1.5fr 1fr auto; gap:12px; align-items:center; padding:10px 0; border-top:1px solid var(--line); font-size:13.5px;"
        });
        row.appendChild(h("div", {}, u.name || "—"));
        row.appendChild(h("div", {}, [
          h("div", {}, u.email),
          h("div", { style: `font-size:11px; margin-top:2px; color: ${u.passwordHash ? "var(--green)" : "var(--ink-3)"};` },
            u.passwordHash ? "password set" : "awaiting first sign-in")
        ]));
        row.appendChild(h("div", {}, o ? o.name : "— (unassigned)"));
        row.appendChild(h("div", { style: "display:flex; gap:6px;" }, [
          u.passwordHash ? h("button", {
            class: "btn ghost sm",
            onclick: () => confirmDialog("Reset password?",
              `${u.email} will be asked to set a new password the next time they sign in.`,
              () => {
                const fresh = findUser(u.id);
                if (fresh) { delete fresh.passwordHash; upsertUser(fresh); render(); }
              }, "Reset")
          }, "Reset password") : null,
          h("button", {
            class: "btn ghost sm danger",
            onclick: () => confirmDialog("Remove client access?",
              `${u.email} will no longer be able to sign in. Their responses from past rounds will remain in the data.`,
              () => { deleteUser(u.id); render(); }, "Remove")
          }, "Remove")
        ].filter(Boolean)));
        table.appendChild(row);
      });
      usersCard.appendChild(table);
    }
    frag.appendChild(usersCard);

    // Internal team
    frag.appendChild(h("h2", {}, "Internal team"));
    const internals = loadUsers().filter(u => u.role === "internal");
    const intCard = h("div", { class: "card" });
    if (!internals.length) {
      intCard.appendChild(h("p", { style: "color: var(--ink-3);" }, "None."));
    } else {
      internals.forEach(u => {
        intCard.appendChild(h("div", {
          style: "display:flex; gap:12px; align-items:center; padding:10px 0; border-top:1px solid var(--line); font-size:13.5px;"
        }, [
          h("span", { class: "avatar internal" }, initials(u.name || u.email)),
          h("div", { style: "flex:1;" }, [
            h("div", { style: "font-weight:600;" }, u.name || u.email),
            h("div", { style: "color:var(--ink-3); font-size:12px;" }, u.email)
          ]),
          u.id !== user.id ? h("button", {
            class: "btn ghost sm danger",
            onclick: () => confirmDialog("Remove team member?",
              `${u.email} will no longer be able to sign in with internal access.`,
              () => { deleteUser(u.id); render(); }, "Remove")
          }, "Remove") : h("span", { style: "font-size:11px; color:var(--ink-3);" }, "you")
        ]));
      });
    }
    frag.appendChild(intCard);

    // Settings
    frag.appendChild(h("h2", {}, "Settings"));
    const settingsCard = h("div", { class: "card" });
    settingsCard.appendChild(h("p", { style: "color:var(--ink-2); font-size:13px; margin-top:0;" },
      "Internal sign-in is restricted to a fixed allowlist of emails with a shared team password, configured in the app source. To add a team member or rotate the password, edit the repo."));
    settingsCard.appendChild(h("div", { style: "font-size:12.5px; color:var(--ink-3);" },
      "Allowed emails: " + INTERNAL_ALLOWED_EMAILS.join(", ")));
    frag.appendChild(settingsCard);

    return frag;
  }

  function openInviteClientModal() {
    const name  = h("input", { type: "text",  placeholder: "Client contact name" });
    const email = h("input", { type: "email", placeholder: "client@company.com" });
    const select = h("select", { style: "width:100%; padding:10px; border:1px solid var(--line); border-radius:8px; font:inherit;" });
    const orgs = loadOrgMetas();
    orgs.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.name;
      select.appendChild(opt);
    });
    const errBox = h("div");

    const m = modal([
      h("h3", {}, "Invite a client"),
      h("p", { style: "color: var(--ink-3); font-size: 13px; margin-top:0;" },
        "They'll sign in with their email + the company passphrase you set, then create their own password on first login."),
      h("div", { style: "display:flex; gap:10px; flex-direction:column;" }, [
        h("div", {}, [
          h("label", { style: "font-size:12px; color:var(--ink-2); font-weight:600;" }, "Name"),
          name
        ]),
        h("div", {}, [
          h("label", { style: "font-size:12px; color:var(--ink-2); font-weight:600;" }, "Email"),
          email
        ]),
        h("div", {}, [
          h("label", { style: "font-size:12px; color:var(--ink-2); font-weight:600;" }, "Organisation"),
          select
        ])
      ]),
      errBox,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        h("button", {
          class: "btn",
          onclick: () => {
            errBox.innerHTML = "";
            const em = (email.value || "").trim().toLowerCase();
            if (!em || !em.includes("@")) {
              errBox.appendChild(h("div", { class: "auth-error" }, "Enter a valid email."));
              return;
            }
            if (findUserByEmail(em)) {
              errBox.appendChild(h("div", { class: "auth-error" }, "A user with that email already exists."));
              return;
            }
            if (!orgs.length) {
              errBox.appendChild(h("div", { class: "auth-error" }, "Create an organisation first."));
              return;
            }
            const user = {
              id: uid("u_"),
              email: em,
              name: (name.value || "").trim(),
              role: "client",
              orgId: select.value,
              createdAt: iso()
            };
            upsertUser(user);
            m.close();
            render();
          }
        }, "Send invite")
      ])
    ]);
    setTimeout(() => name.focus(), 10);
  }

  function openSetOrgPassphrase(orgId, orgName) {
    const org = loadOrg(orgId);
    const existing = !!(org && org.clientPassphraseHash);
    const nw = h("input", { type: "password", placeholder: "New company passphrase (min 4 chars)" });
    const confirm = h("input", { type: "password", placeholder: "Confirm passphrase" });
    const errBox = h("div");
    const m = modal([
      h("h3", {}, (existing ? "Change" : "Set") + " passphrase — " + orgName),
      h("p", { style: "color: var(--ink-3); font-size: 13px; margin-top:0;" },
        "Share this with the client team. They'll type it alongside their email and personal password when they sign in. If you change it, tell everyone at " + orgName + " the new one."),
      h("div", { style: "display:flex; flex-direction:column; gap:10px;" }, [nw, confirm]),
      errBox,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        h("button", {
          class: "btn",
          onclick: async () => {
            errBox.innerHTML = "";
            if (nw.value.length < 4) { errBox.appendChild(h("div", { class: "auth-error" }, "Passphrase must be at least 4 characters.")); return; }
            if (nw.value !== confirm.value) { errBox.appendChild(h("div", { class: "auth-error" }, "Passphrases don't match.")); return; }
            await setOrgClientPassphrase(orgId, nw.value);
            m.close();
            render();
          }
        }, existing ? "Update" : "Save")
      ])
    ]);
    setTimeout(() => nw.focus(), 10);
  }

  function openChangePassphrase() {
    const cur = h("input", { type: "password", placeholder: "Current passphrase" });
    const nw  = h("input", { type: "password", placeholder: "New passphrase (min 4 chars)" });
    const errBox = h("div");
    const m = modal([
      h("h3", {}, "Change team passphrase"),
      h("div", { style: "display:flex; flex-direction:column; gap:10px;" }, [cur, nw]),
      errBox,
      h("div", { class: "row" }, [
        h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
        h("button", {
          class: "btn",
          onclick: async () => {
            errBox.innerHTML = "";
            const ok = await verifyInternalPassphrase(cur.value);
            if (!ok) { errBox.appendChild(h("div", { class: "auth-error" }, "Current passphrase wrong.")); return; }
            if (nw.value.length < 4) { errBox.appendChild(h("div", { class: "auth-error" }, "New passphrase must be at least 4 characters.")); return; }
            await setInternalPassphrase(nw.value);
            m.close();
          }
        }, "Update")
      ])
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
      orgs: loadOrgMetas().map(m => loadOrg(m.id)).filter(Boolean)
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
        if (data.users) saveUsers(data.users);
        if (data.settings) saveSettings(data.settings);
        if (Array.isArray(data.orgs)) {
          data.orgs.forEach(org => {
            if (!org.id || !org.name) return;
            saveOrg(org);
            const metas = loadOrgMetas();
            if (!metas.find(o => o.id === org.id)) {
              metas.push({ id: org.id, name: org.name });
              saveOrgMetas(metas);
            }
          });
        }
        render();
        alert("Import complete.");
      } catch (e) {
        alert("Import failed: " + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ================================================================
  // INIT
  // ================================================================
  function init() {
    migrateV1IfNeeded();
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
