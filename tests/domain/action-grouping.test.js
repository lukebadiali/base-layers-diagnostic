// tests/domain/action-grouping.test.js
// @ts-check
// Milestone v6 (ACT-01 / ACT-02). The case that matters commercially is the
// undated action: bulk paste creates every item with a blank due date, so a
// grouping rule that treated "" as "before today" would dump an entire pasted
// batch into Overdue the moment it was created.
import { describe, it, expect } from "vitest";
import {
  groupActions,
  isOverdue,
  isoToday,
  orderedGroups,
} from "../../src/domain/action-grouping.js";

const TODAY = "2026-09-30";

/** @param {*} over */
const act = (over) => ({
  id: "a1",
  title: "An action",
  due: "",
  done: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

describe("isOverdue", () => {
  it("is true only for an unfinished action with a due date in the past", () => {
    expect(isOverdue(act({ due: "2026-09-29" }), TODAY)).toBe(true);
  });

  it("is false on the due date itself — due today is not yet late", () => {
    expect(isOverdue(act({ due: TODAY }), TODAY)).toBe(false);
  });

  it("is false for a future due date", () => {
    expect(isOverdue(act({ due: "2026-10-01" }), TODAY)).toBe(false);
  });

  it("is false for a completed action however far past its date", () => {
    expect(isOverdue(act({ due: "2020-01-01", done: true }), TODAY)).toBe(false);
  });

  it("is false when there is no due date at all", () => {
    expect(isOverdue(act({ due: "" }), TODAY)).toBe(false);
    expect(isOverdue(act({ due: "   " }), TODAY)).toBe(false);
    expect(isOverdue(act({ due: undefined }), TODAY)).toBe(false);
    expect(isOverdue(act({ due: null }), TODAY)).toBe(false);
  });

  it("is false for a null or undefined action", () => {
    expect(isOverdue(null, TODAY)).toBe(false);
    expect(isOverdue(undefined, TODAY)).toBe(false);
  });
});

describe("groupActions", () => {
  it("puts an undated open action in Current, never Overdue", () => {
    const g = groupActions([act({ id: "u", due: "" })], TODAY);
    expect(g.current.map((a) => a.id)).toEqual(["u"]);
    expect(g.overdue).toEqual([]);
  });

  it("routes a whole freshly pasted batch to Current", () => {
    const batch = ["p1", "p2", "p3"].map((id) => act({ id, due: "", owner: "" }));
    const g = groupActions(batch, TODAY);
    expect(g.current).toHaveLength(3);
    expect(g.overdue).toHaveLength(0);
    expect(g.completed).toHaveLength(0);
  });

  it("splits overdue, current and completed", () => {
    const g = groupActions(
      [
        act({ id: "late", due: "2026-09-01" }),
        act({ id: "soon", due: "2026-10-05" }),
        act({ id: "undated", due: "" }),
        act({ id: "finished", due: "2026-01-01", done: true }),
      ],
      TODAY,
    );
    expect(g.overdue.map((a) => a.id)).toEqual(["late"]);
    expect(g.current.map((a) => a.id)).toEqual(["soon", "undated"]);
    expect(g.completed.map((a) => a.id)).toEqual(["finished"]);
  });

  it("completion beats an overdue date", () => {
    const g = groupActions([act({ id: "x", due: "2020-01-01", done: true })], TODAY);
    expect(g.completed.map((a) => a.id)).toEqual(["x"]);
    expect(g.overdue).toEqual([]);
  });

  it("orders open groups by soonest due date, undated last", () => {
    const g = groupActions(
      [
        act({ id: "none", due: "" }),
        act({ id: "dec", due: "2026-12-01" }),
        act({ id: "oct", due: "2026-10-02" }),
      ],
      TODAY,
    );
    expect(g.current.map((a) => a.id)).toEqual(["oct", "dec", "none"]);
  });

  it("orders overdue by how long it has been late, worst first", () => {
    const g = groupActions(
      [act({ id: "recent", due: "2026-09-29" }), act({ id: "ancient", due: "2025-01-01" })],
      TODAY,
    );
    expect(g.overdue.map((a) => a.id)).toEqual(["ancient", "recent"]);
  });

  it("breaks due-date ties with newest created first", () => {
    const g = groupActions(
      [
        act({ id: "older", due: "", createdAt: "2026-09-01T00:00:00.000Z" }),
        act({ id: "newer", due: "", createdAt: "2026-09-20T00:00:00.000Z" }),
      ],
      TODAY,
    );
    expect(g.current.map((a) => a.id)).toEqual(["newer", "older"]);
  });

  it("orders completed by most recently completed", () => {
    const g = groupActions(
      [
        act({ id: "first", done: true, completedAt: "2026-05-01T00:00:00.000Z" }),
        act({ id: "last", done: true, completedAt: "2026-09-01T00:00:00.000Z" }),
      ],
      TODAY,
    );
    expect(g.completed.map((a) => a.id)).toEqual(["last", "first"]);
  });

  it("falls back to createdAt when a completed action has no completedAt", () => {
    const g = groupActions(
      [
        act({ id: "old", done: true, createdAt: "2026-01-01T00:00:00.000Z" }),
        act({ id: "new", done: true, createdAt: "2026-08-01T00:00:00.000Z" }),
      ],
      TODAY,
    );
    expect(g.completed.map((a) => a.id)).toEqual(["new", "old"]);
  });

  it("does not mutate its input", () => {
    const input = [act({ id: "b", due: "2026-12-01" }), act({ id: "a", due: "2026-10-01" })];
    const before = input.map((a) => a.id);
    groupActions(input, TODAY);
    expect(input.map((a) => a.id)).toEqual(before);
  });

  it("tolerates a non-array and null entries", () => {
    expect(groupActions(/** @type {*} */ (null), TODAY)).toEqual({
      overdue: [],
      current: [],
      completed: [],
    });
    const g = groupActions([null, undefined, act({ id: "real" })], TODAY);
    expect(g.current.map((a) => a.id)).toEqual(["real"]);
  });
});

describe("orderedGroups", () => {
  it("returns overdue, current, completed in that order", () => {
    const g = groupActions([], TODAY);
    expect(orderedGroups(g).map((x) => x.key)).toEqual(["overdue", "current", "completed"]);
    expect(orderedGroups(g).map((x) => x.label)).toEqual(["Overdue", "Current", "Completed"]);
  });
});

describe("isoToday", () => {
  it("formats the local calendar day, zero-padded", () => {
    expect(isoToday(new Date(2026, 0, 5, 12, 0, 0))).toBe("2026-01-05");
    expect(isoToday(new Date(2026, 11, 31, 12, 0, 0))).toBe("2026-12-31");
  });

  it("uses the local day, not the UTC one, late in the evening", () => {
    // 23:30 local on 30 Sep is already 1 Oct in UTC for any positive offset.
    // The consultant looking at the screen is still on the 30th.
    const late = new Date(2026, 8, 30, 23, 30, 0);
    expect(isoToday(late)).toBe("2026-09-30");
  });
});
