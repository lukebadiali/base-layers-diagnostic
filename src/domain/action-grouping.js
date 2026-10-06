// src/domain/action-grouping.js
// @ts-check
// Milestone v6 (ACT-01 / ACT-02): the Actions tab groups into Overdue,
// Current and Completed, in that order. Kept pure — no DOM, no Firebase — so
// the boundary that decides "overdue" is unit-testable without booting the
// app, and so the pillar-detail action panel can adopt the same rule later
// without the two views drifting apart.
//
// The rules, in the order they are applied to each action:
//   1. done          -> Completed, whatever its due date says.
//   2. due < today   -> Overdue.
//   3. everything else (including an action with no due date at all)
//                    -> Current.
//
// Rule 2 compares ISO date strings (YYYY-MM-DD) lexically, which is the same
// comparison the old renderActionRow used. It is correct for that format and
// avoids dragging timezone arithmetic into a grouping decision: an action is
// overdue relative to the viewer's own calendar day, which is what a
// consultant looking at the screen means by the word.
//
// Rule 3 is the load-bearing one. Bulk paste creates actions with no due date
// (every pasted item arrives with no pillar, no owner and no due), so most of
// a freshly pasted batch has a blank `due`. Sorting those into Overdue because
// "" < todayIso is lexically true would drop the whole batch into a red panic
// section. Undated work is not late work; it is unscheduled work.

/**
 * Today as a YYYY-MM-DD string in the viewer's local calendar.
 *
 * Deliberately local rather than UTC: `new Date().toISOString()` rolls over at
 * midnight UTC, so a UK consultant working at 23:30 BST in summer would see
 * tomorrow's date and an action due today would flip to overdue half an hour
 * early. Callers pass the result into the functions below rather than letting
 * them read the clock, so tests can pin the day.
 *
 * @param {Date} [now]
 * @returns {string}
 */
export function isoToday(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * True when an action is past its due date and not yet done.
 *
 * @param {*} action
 * @param {string} todayIso YYYY-MM-DD
 * @returns {boolean}
 */
export function isOverdue(action, todayIso) {
  if (!action || action.done) return false;
  const due = typeof action.due === "string" ? action.due.trim() : "";
  if (!due) return false;
  return due < todayIso;
}

/**
 * Sort key for a due date, with undated work pushed to the end of its group.
 * Returns a string that sorts correctly against other due dates: a real date
 * sorts as itself, a blank sorts after every real date.
 *
 * @param {*} action
 * @returns {string}
 */
function dueSortKey(action) {
  const due = typeof action?.due === "string" ? action.due.trim() : "";
  return due || "9999-99-99";
}

/** @param {*} a */
function createdMillis(a) {
  const t = Date.parse(a?.createdAt || "");
  return Number.isNaN(t) ? 0 : t;
}

/** @param {*} a */
function completedMillis(a) {
  const t = Date.parse(a?.completedAt || "");
  return Number.isNaN(t) ? createdMillis(a) : t;
}

/**
 * Split actions into the three display groups, each internally ordered.
 *
 * Within Overdue and Current, the soonest due date comes first and undated
 * work sits at the bottom — a consultant scanning the list wants the next
 * thing that bites at the top. Ties fall back to newest-created-first, which
 * keeps a freshly pasted batch together and in the order it was pasted
 * (addManyActions prepends the batch as a block).
 *
 * Within Completed, most-recently-completed comes first: the useful question
 * about finished work is "what got done lately", not "what got done first".
 *
 * Input is never mutated.
 *
 * @param {Array<*>} actions
 * @param {string} todayIso YYYY-MM-DD
 * @returns {{ overdue: Array<*>, current: Array<*>, completed: Array<*> }}
 */
export function groupActions(actions, todayIso) {
  /** @type {{ overdue: Array<*>, current: Array<*>, completed: Array<*> }} */
  const out = { overdue: [], current: [], completed: [] };
  if (!Array.isArray(actions)) return out;

  actions.forEach((a) => {
    if (!a) return;
    if (a.done) out.completed.push(a);
    else if (isOverdue(a, todayIso)) out.overdue.push(a);
    else out.current.push(a);
  });

  const byDue = (/** @type {*} */ a, /** @type {*} */ b) => {
    const ka = dueSortKey(a);
    const kb = dueSortKey(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return createdMillis(b) - createdMillis(a);
  };
  out.overdue.sort(byDue);
  out.current.sort(byDue);
  out.completed.sort((a, b) => completedMillis(b) - completedMillis(a));

  return out;
}

/**
 * The three groups in display order, with their labels. Views iterate this
 * rather than hard-coding the order, so "in that order" is stated once.
 *
 * @param {{ overdue: Array<*>, current: Array<*>, completed: Array<*> }} grouped
 * @returns {Array<{ key: "overdue"|"current"|"completed", label: string, items: Array<*> }>}
 */
export function orderedGroups(grouped) {
  return [
    { key: /** @type {const} */ ("overdue"), label: "Overdue", items: grouped.overdue },
    { key: /** @type {const} */ ("current"), label: "Current", items: grouped.current },
    { key: /** @type {const} */ ("completed"), label: "Completed", items: grouped.completed },
  ];
}
