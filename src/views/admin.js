// src/views/admin.js
// @ts-check
// Phase 8 Wave 2 (LIFE-06 functional): admin Recently Deleted view —
// table of soft-deleted items with Restore + Permanently delete now buttons.
// Wires through src/cloud/soft-delete.js (LIFE-04 + permanentlyDelete callables)
// AND src/data/soft-deleted.js#listSoftDeleted (admin-read of softDeleted/* per
// existing firestore.rules `allow read: if isAdmin()`).
//
// Phase 4 Wave 4 (D-12 / D-20) Pattern D DI factory preserved — createAdminView
// accepts optional dep overrides so tests can inject mocks without adapter
// changes. Production path defaults every dep to the real wired helper.

import { h as defaultH } from "../ui/dom.js";
import { listSoftDeleted as defaultListSoftDeleted } from "../data/soft-deleted.js";
import {
  restoreSoftDeleted as defaultRestoreSoftDeleted,
  permanentlyDeleteSoftDeleted as defaultPermanentlyDelete,
} from "../cloud/soft-delete.js";

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 *   listSoftDeleted?: () => Promise<Array<{ type: string, orgId: string|null, id: string, snapshot: any, deletedAt: any }>>,
 *   restoreSoftDeleted?: (input: { type: string, orgId: string, id: string }) => Promise<{ ok: true }>,
 *   permanentlyDeleteSoftDeleted?: (input: { type: string, id: string }) => Promise<{ ok: true }>,
 *   onChange?: () => void,
 * }} AdminDeps
 */

/**
 * @param {AdminDeps} [deps]
 * @returns {{ renderAdmin: (user: *) => HTMLElement }}
 */
export function createAdminView(deps = {}) {
  const h = deps.h || defaultH;
  const listFn = deps.listSoftDeleted || defaultListSoftDeleted;
  const restoreFn = deps.restoreSoftDeleted || defaultRestoreSoftDeleted;
  const purgeFn = deps.permanentlyDeleteSoftDeleted || defaultPermanentlyDelete;

  return {
    renderAdmin(_user) {
      const root = h("div", { class: "admin-view" });
      root.appendChild(h("h2", { class: "view-title" }, "Admin"));

      const section = h("section", { class: "admin-recently-deleted" });
      section.appendChild(h("h3", null, "Recently Deleted"));
      const tableHost = h("div", { class: "admin-table-host" }, "Loading…");
      section.appendChild(tableHost);
      root.appendChild(section);

      const refresh = async () => {
        try {
          const items = await listFn();
          if (!items || items.length === 0) {
            tableHost.replaceChildren(h("p", { class: "muted" }, "No recently deleted items."));
            return;
          }
          const rows = items.map((it) =>
            h("tr", null, [
              h("td", null, it.type),
              h("td", null, it.id),
              h(
                "td",
                null,
                it.deletedAt?.toDate?.()?.toISOString?.() || String(it.deletedAt || ""),
              ),
              h("td", null, [
                h(
                  "button",
                  {
                    class: "btn sm",
                    onclick: async () => {
                      try {
                        await restoreFn({ type: it.type, orgId: it.orgId || "", id: it.id });
                        if (deps.onChange) deps.onChange();
                        refresh();
                      } catch (e) {
                        tableHost.appendChild(
                          h("p", { class: "auth-error" }, String(e?.message || e)),
                        );
                      }
                    },
                  },
                  "Restore",
                ),
                " ",
                h(
                  "button",
                  {
                    class: "btn sm danger",
                    onclick: async () => {
                      if (
                        !window.confirm(
                          "Permanently delete this record? This cannot be undone.",
                        )
                      )
                        return;
                      try {
                        await purgeFn({ type: it.type, id: it.id });
                        if (deps.onChange) deps.onChange();
                        refresh();
                      } catch (e) {
                        tableHost.appendChild(
                          h("p", { class: "auth-error" }, String(e?.message || e)),
                        );
                      }
                    },
                  },
                  "Permanently delete now",
                ),
              ]),
            ]),
          );
          const table = h("table", { class: "admin-table" }, [
            h("thead", null, [
              h("tr", null, [
                h("th", null, "Type"),
                h("th", null, "ID"),
                h("th", null, "Deleted At"),
                h("th", null, "Actions"),
              ]),
            ]),
            h("tbody", null, rows),
          ]);
          tableHost.replaceChildren(table);
        } catch (e) {
          tableHost.replaceChildren(
            h("p", { class: "auth-error" }, "Failed to load: " + (e?.message || e)),
          );
        }
      };
      refresh();
      return root;
    },
  };
}

/**
 * @param {*} user
 * @returns {HTMLElement}
 */
export function renderAdmin(user) {
  return createAdminView().renderAdmin(user);
}
