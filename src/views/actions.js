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

  /**
   * @param {*} user
   * @param {*} org
   * @returns {HTMLElement}
   */
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

    const all = (org.actions || []).filter((/** @type {*} */ a) => !isClient || !a.internal);
    const toolbar = h(
      "div",
      { class: "stage-section-banner" },
      [
        h(
          "div",
          {},
          `${all.length} total · ${all.filter((/** @type {*} */ a) => a.done).length} complete`,
        ),
        // Creating actions stays staff-only (rules deny client creates);
        // clients still complete/uncomplete via each row's checkbox. Both
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

    const openActions = all.filter((/** @type {*} */ a) => !a.done);
    const completedActions = all.filter((/** @type {*} */ a) => a.done);
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
      openActions.forEach((/** @type {*} */ a) =>
        openTable.appendChild(renderActionRow(a, isClient)),
      );
    }
    frag.appendChild(openTable);

    // Completed actions, in their own section
    if (completedActions.length) {
      frag.appendChild(
        h("h2", { class: "section-banner-spread" }, `Completed (${completedActions.length})`),
      );
      const doneTable = h("div", { class: "actions-table" });
      doneTable.appendChild(headerRow());
      completedActions.forEach((/** @type {*} */ a) =>
        doneTable.appendChild(renderActionRow(a, isClient)),
      );
      frag.appendChild(doneTable);
    }

    return frag;
  }

  /**
   * @param {*} a
   * @param {boolean} isClient
   * @returns {HTMLElement}
   */
  function renderActionRow(a, isClient) {
    const p = DATA.pillars.find((/** @type {*} */ x) => x.id === a.pillarId);
    const todayIso = new Date().toISOString().slice(0, 10);
    const isOverdue = !a.done && !!a.due && a.due < todayIso;
    const row = h("div", {
      class: `action-row ${a.done ? "done" : ""} ${isOverdue ? "overdue" : ""}`,
    });

    // Completion toggles for BOTH roles (2026-07): the checkbox patch carries
    // exactly the fields firestore.rules lets a client change (done +
    // completion audit fields) — everything else on the row is staff-only.
    const chk = /** @type {HTMLInputElement} */ (h("input", { type: "checkbox" }));
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
    row.appendChild(chk);

    const title = /** @type {HTMLInputElement} */ (
      h("input", { type: "text", class: "a-title", value: a.title })
    );
    if (isClient) {
      title.disabled = true;
    } else {
      title.addEventListener("blur", () => updateAction(a.id, { title: title.value }));
    }
    row.appendChild(title);

    // 2026-08 scope change: actions may carry no pillar (or a pillarId that no
    // longer resolves). Render those as plain "Unassigned" text — the old
    // unconditional link navigated to pillar:null and dead-ended.
    row.appendChild(
      p
        ? h("div", {}, [
            h(
              "a",
              {
                href: "#",
                onclick: (/** @type {Event} */ e) => {
                  e.preventDefault();
                  setRoute("pillar:" + a.pillarId);
                },
              },
              p.name,
            ),
          ])
        : h(
            "div",
            { class: "action-pillar-none", title: "Not assigned to one of the 10 pillars" },
            "Unassigned",
          ),
    );

    const owner = /** @type {HTMLInputElement} */ (
      h("input", {
        type: "text",
        class: "a-owner",
        placeholder: "Owner",
        value: a.owner || "",
      })
    );
    if (isClient) {
      owner.disabled = true;
    } else {
      owner.addEventListener("blur", () => updateAction(a.id, { owner: owner.value }));
    }
    row.appendChild(owner);

    const dueWrap = h("div", { class: "due-wrap" });
    const due = /** @type {HTMLInputElement} */ (
      h("input", { type: "date", class: "a-due", value: a.due || "" })
    );
    if (isClient) {
      due.disabled = true;
    } else {
      due.addEventListener("change", () => updateAction(a.id, { due: due.value }));
    }
    dueWrap.appendChild(due);
    if (isOverdue)
      dueWrap.appendChild(
        h("span", { class: "overdue-tag", title: "Due date has passed" }, "Overdue"),
      );
    row.appendChild(dueWrap);

    if (isClient) {
      row.appendChild(h("div", {}));
    } else {
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
    }
    return row;
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
