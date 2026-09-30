// src/views/actions.js
// @ts-check
// Milestone v6 Phase A (completes the Phase 4 D-02 re-homing): the Actions
// tab moves out of the src/main.js IIFE and into this module, bodies intact.
//
// WHY NOW. The Phase 4 summary parked these bodies in main.js "for snapshot-
// baseline stability", with Wave 5 to re-home them; that wave never ran. The
// v6 scope (grouping, three filters, expand-on-click, per-field client edit,
// a two-step paste review) roughly doubles this code. Doubling it inside a
// 6,000-line IIFE would make every new behaviour reachable only by booting the
// whole app, so the debt is paid here, before the features land, rather than
// after — when the diff would be impossible to read as a pure refactor.
//
// This commit is a PURE MOVE. Every body below is byte-identical to the one it
// replaced apart from the deps indirection; the committed snapshot baselines at
// tests/__snapshots__/views/ are the proof and must not move.
//
// Pattern D DI (Phase 2 D-05, as used by src/ui/chrome.js createChrome): the
// IIFE binds its closure locals once via createActionsView(deps) and gets back
// the same function names with the same signatures, so no call site changes.
import { h as defaultH } from "../ui/dom.js";
import { iso } from "../util/ids.js";
import { parseBulkList, MAX_BULK_ITEMS } from "../domain/bulk-parse.js";
import { groupActions, isOverdue, isoToday, orderedGroups } from "../domain/action-grouping.js";
import {
  ANY,
  UNASSIGNED,
  DUE_FILTERS,
  filterActions,
  hasUnassignedOwner,
  hasUnassignedPillar,
  isFiltered,
  ownerOptions,
} from "../domain/action-filters.js";

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 *   DATA?: *,
 *   isClientView?: (user: *) => boolean,
 *   setRoute?: (route: string) => void,
 *   render?: () => void,
 *   currentUser?: () => *,
 *   addAction?: (createdBy: string, pillarId: number|null, title: string, opts?: *) => void,
 *   addManyActions?: (createdBy: string, pillarId: number|null, titles: string[], opts?: *) => number,
 *   updateAction?: (id: string, patch: *) => void,
 *   deleteAction?: (id: string) => void,
 *   modal?: (children: *) => *,
 *   confirmDialog?: (title: string, body: string, onYes: () => void, yesLabel?: string) => *,
 *   notify?: (level: string, msg: string) => void,
 *   userLabel?: (id: string) => string,
 *   formatDate?: (when: *) => string,
 * }} ActionsDeps
 */

/**
 * Read the "Internal only" checkbox out of its wrapper label.
 *
 * The wrapper is null for a client (who never sees the control), and the
 * original IIFE read `internalWrap.querySelector("input").checked` straight
 * through — which throws rather than returns false if the label is ever
 * rendered without its input. Absent means not-internal, and not-internal is
 * the visible-to-the-client default, so a missing control must never silently
 * mark an action internal.
 *
 * @param {HTMLElement|null} internalWrap
 * @returns {boolean}
 */
function internalCheckboxChecked(internalWrap) {
  if (!internalWrap) return false;
  const input = /** @type {HTMLInputElement|null} */ (internalWrap.querySelector("input"));
  return !!input && input.checked;
}

/**
 * Bind the Actions view to its dependencies.
 *
 * Every dep is optional so the Phase 4 smoke tests (which construct the view
 * with `{ state, h }` alone) keep passing: a missing dep becomes a no-op rather
 * than a TypeError at construction time. A view that renders nothing is a
 * visible bug; a view that throws on construction takes the whole route down.
 *
 * @param {ActionsDeps} deps
 */
export function createActionsView(deps) {
  const h = deps.h || defaultH;
  const DATA = deps.DATA || { pillars: [] };
  const isClientView = deps.isClientView || (() => false);
  const setRoute = deps.setRoute || (() => {});
  const render = deps.render || (() => {});
  const currentUser = deps.currentUser || (() => null);
  const addAction = deps.addAction || (() => {});
  const addManyActions = deps.addManyActions || (() => 0);
  const updateAction = deps.updateAction || (() => {});
  const deleteAction = deps.deleteAction || (() => {});
  const modal = deps.modal || (() => ({ close: () => {} }));
  const confirmDialog = deps.confirmDialog || (() => {});
  const notify = deps.notify || (() => {});
  // The filter selections and expanded-row set live on the app state singleton
  // so they survive the full re-render that every mutation on this tab causes.
  const state = deps.state || {
    actionFilters: { pillar: ANY, owner: ANY, due: ANY },
    expandedActions: new Set(),
  };
  // uid -> display name, for the provenance footer. Falls back to the raw id,
  // which is ugly but honest: a blank there would read as "nobody did this".
  const userLabel = deps.userLabel || ((/** @type {string} */ id) => (id ? String(id) : ""));
  const formatDate = deps.formatDate || ((/** @type {*} */ w) => (w ? String(w) : ""));

  // ---------- Filter bar (ACT-03) ----------

  /**
   * One labelled select in the filter bar.
   *
   * @param {string} label
   * @param {Array<{ value: string, text: string }>} options
   * @param {string} current
   * @param {(value: string) => void} onChange
   * @returns {HTMLElement}
   */
  function filterSelect(label, options, current, onChange) {
    const sel = /** @type {HTMLSelectElement} */ (
      h("select", { class: "action-filter-select", "aria-label": label })
    );
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.text;
      sel.appendChild(opt);
    });
    // Applied after the options exist: jsdom does not honour `option.selected`
    // set while the option is detached, which silently selects the wrong entry
    // under test while passing in a real browser. Same pattern as the round
    // select on the diagnostic index.
    sel.value = String(current);
    sel.addEventListener("change", () => onChange(sel.value));
    return h("label", { class: "action-filter" }, [
      h("span", { class: "action-filter-label" }, label),
      sel,
    ]);
  }

  /**
   * The pillar / owner / due filter bar.
   *
   * Option lists are built from the actions actually present, so an owner who
   * has left, or a pillar nobody uses, never appears as a filter that returns
   * nothing. "Unassigned" appears only when something is genuinely unassigned,
   * for the same reason.
   *
   * @param {Array<*>} all every action visible to this user, pre-filter
   * @returns {HTMLElement}
   */
  function renderFilterBar(all) {
    const f = state.actionFilters;

    /** @type {Array<{ value: string, text: string }>} */
    const pillarOpts = [{ value: ANY, text: "All pillars" }];
    DATA.pillars.forEach((/** @type {*} */ p) =>
      pillarOpts.push({ value: String(p.id), text: `${p.id}. ${p.name}` }),
    );
    if (hasUnassignedPillar(all)) pillarOpts.push({ value: UNASSIGNED, text: "No pillar" });

    /** @type {Array<{ value: string, text: string }>} */
    const ownerOpts = [{ value: ANY, text: "All owners" }];
    ownerOptions(all).forEach((o) => ownerOpts.push({ value: o, text: o }));
    if (hasUnassignedOwner(all)) ownerOpts.push({ value: UNASSIGNED, text: "No owner" });

    const dueOpts = DUE_FILTERS.map((d) => ({ value: d.key, text: d.label }));

    const bar = h("div", { class: "action-filter-bar" }, [
      filterSelect("Pillar", pillarOpts, String(f.pillar), (v) => {
        state.actionFilters.pillar = v;
        render();
      }),
      filterSelect("Owner", ownerOpts, f.owner, (v) => {
        state.actionFilters.owner = v;
        render();
      }),
      filterSelect("Due", dueOpts, f.due, (v) => {
        state.actionFilters.due = v;
        render();
      }),
    ]);

    // The clear control appears only once something is narrowed. A permanently
    // visible "Clear filters" reads as an available action when nothing is
    // filtered, and its absence is the clearest signal that the list in front
    // of the user is the whole list.
    if (isFiltered(f)) {
      bar.appendChild(
        h(
          "button",
          {
            class: "btn ghost sm action-filter-clear",
            onclick: () => {
              state.actionFilters = { pillar: ANY, owner: ANY, due: ANY };
              render();
            },
          },
          "Clear filters",
        ),
      );
    }
    return bar;
  }

  // ---------- Groups (ACT-01 / ACT-02) ----------

  /**
   * One of the three groups, header and table.
   *
   * Empty groups render with a one-line explanation rather than disappearing.
   * A stable three-section shape is what makes the tab scannable: if Overdue
   * vanished whenever it was empty, the section directly under the filter bar
   * would keep changing meaning, and "nothing is overdue" — which is the good
   * news a consultant wants — would be indistinguishable from "this view does
   * not show overdue work".
   *
   * @param {{ key: string, label: string, items: Array<*> }} group
   * @param {boolean} isClient
   * @param {string} todayIso
   * @param {boolean} filtered whether a filter is currently narrowing the list
   * @returns {HTMLElement}
   */
  function renderActionGroup(group, isClient, todayIso, filtered) {
    const section = h("section", { class: `action-group action-group-${group.key}` });
    section.appendChild(
      h("h2", { class: "action-group-head" }, [
        h("span", { class: `action-group-dot action-group-dot-${group.key}` }, ""),
        h("span", { class: "action-group-title" }, group.label),
        h("span", { class: "action-group-count" }, String(group.items.length)),
      ]),
    );

    const table = h("div", { class: "actions-table" });
    table.appendChild(
      h("div", { class: "action-row action-row-head" }, [
        h("div", {}, "✓"),
        h("div", {}, "Action"),
        h("div", {}, "Pillar"),
        h("div", {}, "Owner"),
        h("div", {}, "Due"),
        h("div", {}, ""),
        h("div", {}, ""),
      ]),
    );

    if (!group.items.length) {
      /** @type {Record<string, string>} */
      const empties = {
        overdue: "Nothing overdue.",
        current: "Nothing on the go.",
        completed: "Nothing completed yet.",
      };
      table.appendChild(
        h(
          "div",
          { class: "empty-card" },
          filtered ? "Nothing here matches these filters." : empties[group.key] || "Nothing here.",
        ),
      );
    } else {
      group.items.forEach((/** @type {*} */ a) =>
        table.appendChild(renderActionRow(a, isClient, todayIso)),
      );
    }

    section.appendChild(table);
    return section;
  }

  /**
   * @param {*} user
   * @param {*} org
   * @returns {HTMLElement}
   */
  function renderActions(user, org) {
    const isClient = isClientView(user);
    const todayIso = isoToday();
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Action plan"));
    frag.appendChild(
      h(
        "p",
        { class: "view-sub" },
        "Cross-pillar action tracker. Assign owners, set due dates, mark complete.",
      ),
    );

    const all = (org.actions || []).filter((/** @type {*} */ a) => !isClient || !a.internal);
    const filtered = isFiltered(state.actionFilters);
    const visible = filterActions(all, state.actionFilters, todayIso);

    const countText = filtered
      ? `showing ${visible.length} of ${all.length}`
      : `${all.length} total · ${all.filter((/** @type {*} */ a) => a.done).length} complete`;

    const toolbar = h(
      "div",
      { class: "stage-section-banner" },
      [
        h("div", {}, countText),
        // Creating actions stays staff-only (rules deny client creates);
        // clients still complete/uncomplete via each row's checkbox and, since
        // v6, edit the wording, owner and pillar from the expanded row. Both
        // buttons sit in one group so the banner's space-between keeps them
        // together on the right instead of stranding one mid-row.
        isClient
          ? null
          : h("div", { class: "banner-actions" }, [
              h(
                "button",
                {
                  class: "btn secondary",
                  title: "Paste a list — one action per line",
                  onclick: () => openBulkActionModal(user),
                },
                "Paste multiple",
              ),
              h("button", { class: "btn", onclick: () => openActionModal(user) }, "+ New action"),
            ]),
      ].filter(Boolean),
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

    frag.appendChild(renderFilterBar(all));

    const grouped = groupActions(visible, todayIso);
    orderedGroups(grouped).forEach((g) =>
      frag.appendChild(renderActionGroup(g, isClient, todayIso, filtered)),
    );

    return frag;
  }

  // ---------- Row (ACT-04 / ACT-05 / ACT-06 / ACT-07) ----------

  /** @param {*} a */
  function pillarNameFor(a) {
    const p = DATA.pillars.find((/** @type {*} */ x) => x.id === a.pillarId);
    return p ? p.name : "";
  }

  /**
   * Stop a click inside an interactive control from also toggling the row.
   *
   * ACT-04 makes the whole row a toggle, which puts every control on the row
   * inside the toggle's hit area. Without this, ticking the completion
   * checkbox would also expand the row — the user would see the panel open
   * and reasonably conclude the tick had not registered.
   *
   * @param {HTMLElement} el
   * @returns {HTMLElement}
   */
  function swallowToggle(el) {
    el.addEventListener("click", (e) => e.stopPropagation());
    return el;
  }

  /**
   * One labelled field in the expanded panel.
   *
   * @param {string} label
   * @param {HTMLElement} control
   * @param {string} [hint]
   * @returns {HTMLElement}
   */
  function panelField(label, control, hint) {
    return h(
      "label",
      { class: "action-panel-field" },
      [
        h("span", { class: "action-panel-label" }, label),
        control,
        hint ? h("span", { class: "action-panel-hint" }, hint) : null,
      ].filter(Boolean),
    );
  }

  /**
   * The expanded detail panel: the full action text, plus every editable field
   * and the provenance footer.
   *
   * Editing lives here rather than inline on the collapsed row. The row is now
   * a click target, so an inline <input> sitting in it would have to swallow
   * the click that the row wants — leaving the user with a row that sometimes
   * expands and sometimes does not, depending on which pixel they hit. One
   * place to edit is worth one extra click.
   *
   * Text fields save on blur without a re-render, so typing is never
   * interrupted. Pillar and due date DO re-render, because both change which
   * group or filter the action belongs to and a row that stayed put after its
   * due date moved into the past would be lying.
   *
   * @param {*} a
   * @param {boolean} isClient
   * @returns {HTMLElement}
   */
  function renderActionPanel(a, isClient) {
    const panel = h("div", { class: "action-panel" });

    const titleTa = /** @type {HTMLTextAreaElement} */ (
      h("textarea", { class: "action-panel-input action-panel-title", rows: "2" })
    );
    titleTa.value = a.title || "";
    titleTa.addEventListener("blur", () => {
      if (titleTa.value !== (a.title || "")) updateAction(a.id, { title: titleTa.value });
    });

    const descTa = /** @type {HTMLTextAreaElement} */ (
      h("textarea", {
        class: "action-panel-input",
        rows: "3",
        placeholder: "Anything the owner needs to know to do this well",
      })
    );
    descTa.value = a.description || "";
    descTa.addEventListener("blur", () => {
      if (descTa.value !== (a.description || "")) updateAction(a.id, { description: descTa.value });
    });

    const pillarSel = pillarSelectEl();
    pillarSel.value = a.pillarId === null || a.pillarId === undefined ? "" : String(a.pillarId);
    pillarSel.addEventListener("change", () => {
      updateAction(a.id, { pillarId: pillarIdFromSelect(pillarSel) });
      render();
    });

    // Navigating to the pillar detail page used to be a link on the collapsed
    // row. It moved here when the row became a click target: a link inside a
    // button is a pixel-lottery, and the thing the user most often wants from
    // the row is to open it, not to leave the page. The affordance survives —
    // it is just one level in, next to the field it relates to.
    const pillarSelWithLink = h("span", { class: "action-panel-pillar" }, [pillarSel]);
    if (a.pillarId !== null && a.pillarId !== undefined && pillarNameFor(a)) {
      pillarSelWithLink.appendChild(
        h(
          "button",
          {
            class: "btn ghost sm action-panel-pillar-link",
            onclick: () => setRoute("pillar:" + a.pillarId),
          },
          "Open pillar",
        ),
      );
    }

    const ownerInput = /** @type {HTMLInputElement} */ (
      h("input", { type: "text", class: "action-panel-input", placeholder: "Who owns this" })
    );
    ownerInput.value = a.owner || "";
    ownerInput.addEventListener("blur", () => {
      if (ownerInput.value !== (a.owner || "")) updateAction(a.id, { owner: ownerInput.value });
    });

    const dueInput = /** @type {HTMLInputElement} */ (
      h("input", { type: "date", class: "action-panel-input" })
    );
    dueInput.value = a.due || "";
    if (isClient) {
      // ACT-07: the due date is the one content field that stays with
      // BeDeveloped. firestore.rules denies the write outright; this is the
      // explanation, so a client who tries reads a sentence rather than a
      // permission error.
      dueInput.disabled = true;
    } else {
      dueInput.addEventListener("change", () => {
        updateAction(a.id, { due: dueInput.value });
        render();
      });
    }

    panel.appendChild(
      h("div", { class: "action-panel-grid" }, [
        panelField("Action", titleTa),
        panelField("Notes", descTa),
        panelField("Pillar", pillarSelWithLink),
        panelField("Owner", ownerInput),
        panelField("Due", dueInput, isClient ? "Due dates are set by BeDeveloped." : undefined),
      ]),
    );

    // Provenance. Only the lines that have something to say are rendered —
    // an action nobody has edited should not carry an empty "Edited by" row.
    /** @type {Array<string>} */
    const meta = [];
    if (a.createdAt) {
      const who = userLabel(a.createdBy);
      meta.push(`Added ${formatDate(a.createdAt)}${who ? ` by ${who}` : ""}`);
    }
    if (a.lastEditedAt) {
      const who = userLabel(a.lastEditedBy);
      meta.push(`Last edited ${formatDate(a.lastEditedAt)}${who ? ` by ${who}` : ""}`);
    }
    if (a.done && a.completedAt) {
      const who = userLabel(a.completedBy);
      meta.push(`Completed ${formatDate(a.completedAt)}${who ? ` by ${who}` : ""}`);
    }

    const foot = h("div", { class: "action-panel-foot" }, [
      h("div", { class: "action-panel-meta" }, meta.join(" · ")),
    ]);
    if (!isClient) {
      foot.appendChild(
        h(
          "button",
          {
            class: "btn ghost sm danger",
            onclick: () =>
              confirmDialog(
                "Delete action?",
                "This cannot be undone.",
                () => {
                  state.expandedActions.delete(a.id);
                  deleteAction(a.id);
                  render();
                },
                "Delete",
              ),
          },
          "Delete action",
        ),
      );
    }
    panel.appendChild(foot);

    return panel;
  }

  /**
   * One action: the collapsed summary row, plus its panel when expanded.
   *
   * The collapsed row is read-only apart from the completion checkbox. It used
   * to carry inline inputs for title, owner and due; those moved into the
   * panel when the row became a click target, because a row that is both a
   * button and a form is a row where every click is a guess.
   *
   * @param {*} a
   * @param {boolean} isClient
   * @param {string} todayIso
   * @returns {HTMLElement}
   */
  function renderActionRow(a, isClient, todayIso) {
    const expanded = state.expandedActions.has(a.id);
    const overdue = isOverdue(a, todayIso);
    const wrap = h("div", { class: `action-item ${expanded ? "expanded" : ""}` });

    // The row is a click target for convenience, but it is NOT the accessible
    // control. role="button" here would be invalid: the row contains a
    // checkbox, and interactive content inside a button is not reliably
    // exposed — a screen-reader user could lose the ability to complete an
    // action, which is the one thing every user of this page can do. The
    // disclosure is a real <button> in the last column instead, and the row
    // click is an extra on top of it.
    const row = h("div", {
      class: `action-row ${a.done ? "done" : ""} ${overdue ? "overdue" : ""}`,
      // A stable handle on a specific action. Rows are now ordered by due date
      // within their group, so "the first row" no longer means "the first
      // action in the array" — anything addressing a particular action, tests
      // included, needs to say which one it means.
      "data-action-id": a.id,
    });

    const toggle = () => {
      if (state.expandedActions.has(a.id)) state.expandedActions.delete(a.id);
      else state.expandedActions.add(a.id);
      render();
    };
    row.addEventListener("click", toggle);

    // Completion toggles for BOTH roles: the checkbox patch carries exactly
    // the fields firestore.rules lets a client change.
    const chk = /** @type {HTMLInputElement} */ (
      h("input", { type: "checkbox", "aria-label": "Mark complete" })
    );
    chk.checked = !!a.done;
    chk.addEventListener("change", () => {
      const u = currentUser();
      updateAction(a.id, {
        done: chk.checked,
        completedAt: chk.checked ? iso() : null,
        completedBy: chk.checked && u ? u.id : null,
      });
      render();
    });
    row.appendChild(swallowToggle(chk));

    row.appendChild(h("div", { class: "a-title", title: a.title || "" }, a.title || ""));

    // An action may carry no pillar, or a pillarId that no longer resolves.
    const pillarName = pillarNameFor(a);
    row.appendChild(
      pillarName
        ? h("div", { class: "a-pillar" }, pillarName)
        : h(
            "div",
            { class: "action-pillar-none", title: "Not assigned to one of the 10 pillars" },
            "Unassigned",
          ),
    );

    row.appendChild(h("div", { class: "a-owner-text" }, a.owner || "—"));

    const dueWrap = h("div", { class: "due-wrap" }, [
      h("span", { class: "a-due-text" }, a.due ? formatDate(a.due) : "—"),
    ]);
    if (overdue)
      dueWrap.appendChild(
        h("span", { class: "overdue-tag", title: "Due date has passed" }, "Overdue"),
      );
    row.appendChild(dueWrap);

    // Sixth column: kept as an empty cell so the collapsed grid keeps the same
    // seven-column shape as its header for both roles. Delete moved into the
    // panel, where it sits next to the provenance it is destroying.
    row.appendChild(h("div", {}));

    // Keyboard and screen-reader users drive the disclosure from here. Native
    // <button> semantics bring Enter/Space and focus handling for free, which
    // is why this is a button and not a styled div with a keydown listener.
    const chevron = h(
      "button",
      {
        class: "action-chevron",
        type: "button",
        "aria-expanded": expanded ? "true" : "false",
        "aria-label": expanded ? `Hide details for ${a.title}` : `Show details for ${a.title}`,
        onclick: toggle,
      },
      expanded ? "▾" : "▸",
    );
    row.appendChild(swallowToggle(chevron));

    wrap.appendChild(row);
    if (expanded) wrap.appendChild(renderActionPanel(a, isClient));
    return wrap;
  }

  // 2026-08 scope change: the pillar dropdown leads with a blank option, for
  // actions that are not relevant to any of the 10 pillars. Blank is the
  // default — it beats silently tagging everything as pillar 1, which is what
  // the previous first-option default did whenever the user left it alone.
  // Callers read the value through pillarIdFromSelect (below), never Number()
  // directly: Number("") is 0, which would look like a real pillar id.
  /** @returns {HTMLSelectElement} */
  function pillarSelectEl() {
    const select = /** @type {HTMLSelectElement} */ (
      h("select", { class: "settings-textarea-comment" })
    );
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "No pillar (unassigned)";
    select.appendChild(blank);
    DATA.pillars.forEach((/** @type {*} */ p) => {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = `${p.id}. ${p.name}`;
      select.appendChild(o);
    });
    return select;
  }
  /**
   * @param {HTMLSelectElement} select
   * @returns {number|null}
   */
  function pillarIdFromSelect(select) {
    return select.value === "" ? null : Number(select.value);
  }

  /** @param {*} user */
  function openActionModal(user) {
    const title = /** @type {HTMLInputElement} */ (
      h("input", { type: "text", placeholder: "Action description" })
    );
    const select = pillarSelectEl();
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
              const internal = internalCheckboxChecked(internalWrap);
              addAction(user.id, pillarIdFromSelect(select), t, { internal });
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

  // 2026-08 scope change (Luke, 10-11 Aug): bulk entry on the Actions tab,
  // mirroring the Plan tab's openBulkOutcomeModal. Every item in the batch
  // takes the one pillar chosen here (blank by default) and the one internal
  // flag — per-row pillars on paste are explicitly out of scope. Staff only:
  // firestore.rules denies client action creates outright, and the button that
  // opens this is behind the same isClient gate as "+ New action".
  /** @param {*} user */
  function openBulkActionModal(user) {
    const select = pillarSelectEl();
    const ta = /** @type {HTMLTextAreaElement} */ (
      h("textarea", {
        placeholder:
          "Paste your list — one action per line.\n\nExample:\nDocument ICP, including firmographics and triggers\nBuild top 50 hit list\nImprove the properties on HubSpot",
        class: "outcomes-textarea",
      })
    );
    const countLbl = h("div", { class: "outcomes-count" }, "0 actions");
    const internalWrap = !isClientView(user)
      ? h("label", { class: "field-row" }, [
          h("input", { type: "checkbox", id: "actBulkInternal" }),
          "Internal only (hidden from client view)",
        ])
      : null;

    const recount = () => {
      const n = parseBulkList(ta.value).length;
      countLbl.textContent =
        n > MAX_BULK_ITEMS
          ? `${n} items — too many. Add up to ${MAX_BULK_ITEMS} at a time.`
          : `${n} action${n === 1 ? "" : "s"}`;
    };
    ta.addEventListener("input", recount);

    // Convenience only — Cmd/Ctrl+V into the textarea does the same thing.
    // navigator.clipboard.readText needs a secure context and (on Chrome) a
    // permission grant, and is absent in jsdom, so every failure path lands on
    // the same toast rather than an unexplained no-op.
    const clipBtn = h(
      "button",
      {
        class: "btn secondary sm",
        onclick: async () => {
          try {
            const text = await navigator.clipboard.readText();
            if (!text || !text.trim()) {
              notify("info", "Clipboard is empty.");
              return;
            }
            ta.value = ta.value.trim() ? `${ta.value.replace(/\s+$/, "")}\n${text}` : text;
            recount();
            ta.focus();
          } catch (_e) {
            notify("error", "Could not read the clipboard — paste into the box with Cmd+V.");
          }
        },
      },
      "Paste from clipboard",
    );

    const m = modal(
      [
        h("h3", {}, "Paste multiple actions"),
        h(
          "p",
          { class: "section-explainer" },
          "One action per line. Bullet markers and numbering are stripped automatically, and commas inside a line are kept. A single line with no line breaks is split on its commas.",
        ),
        h("div", { class: "outcomes-add-row" }, [clipBtn]),
        ta,
        countLbl,
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
                const titles = parseBulkList(ta.value);
                if (!titles.length) {
                  notify("info", "Nothing to add — paste a list first.");
                  return;
                }
                if (titles.length > MAX_BULK_ITEMS) {
                  notify(
                    "error",
                    `That is ${titles.length} items. Add up to ${MAX_BULK_ITEMS} at a time.`,
                  );
                  return;
                }
                const internal = internalCheckboxChecked(internalWrap);
                const n = addManyActions(user.id, pillarIdFromSelect(select), titles, {
                  internal,
                });
                m.close();
                render();
                notify("info", `${n} action${n === 1 ? "" : "s"} added.`);
              },
            },
            "Add all",
          ),
        ]),
      ].filter(Boolean),
    );
    setTimeout(() => ta.focus(), 10);
  }

  return {
    renderActions,
    renderActionRow,
    renderFilterBar,
    renderActionPanel,
    pillarSelectEl,
    pillarIdFromSelect,
    openActionModal,
    openBulkActionModal,
  };
}

/**
 * Standalone entry point kept for the Phase 4 Wave 4 contract test. Renders
 * with defaults only — the app always goes through createActionsView.
 *
 * @param {*} user
 * @param {*} org
 * @returns {HTMLElement}
 */
export function renderActions(user, org) {
  return createActionsView({}).renderActions(user, org);
}
