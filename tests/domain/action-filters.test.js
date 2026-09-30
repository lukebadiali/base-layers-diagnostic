// tests/domain/action-filters.test.js
// @ts-check
// Milestone v6 (ACT-03). Two behaviours carry the weight: owner is free text
// so the same person arrives under several spellings, and the "Unassigned"
// option has to mean genuinely blank rather than falsily-blank — a pillarId of
// 0 would be a real pillar if the data ever had one.
import { describe, it, expect } from "vitest";
import {
  ANY,
  UNASSIGNED,
  DUE_FILTERS,
  NO_FILTERS,
  addDays,
  filterActions,
  hasUnassignedOwner,
  hasUnassignedPillar,
  isFiltered,
  ownerOptions,
} from "../../src/domain/action-filters.js";

const TODAY = "2026-09-30";

/** @param {*} over */
const act = (over) => ({
  id: "a1",
  title: "An action",
  pillarId: null,
  owner: "",
  due: "",
  done: false,
  ...over,
});

describe("addDays", () => {
  it("adds across a month boundary", () => {
    expect(addDays("2026-09-30", 7)).toBe("2026-10-07");
  });
  it("adds across a year boundary", () => {
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  });
  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("crosses a British Summer Time boundary without losing a day", () => {
    // BST ends on 25 Oct 2026. A naive local-time +86400000ms lands on 24 Oct
    // 23:00 and slices back to the 24th.
    expect(addDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(addDays("2026-10-25", 1)).toBe("2026-10-26");
  });
});

describe("ownerOptions", () => {
  it("returns distinct owners, sorted", () => {
    expect(
      ownerOptions([act({ owner: "Zoe" }), act({ owner: "Adam" }), act({ owner: "Zoe" })]),
    ).toEqual(["Adam", "Zoe"]);
  });

  it("treats spelling variants as one person and keeps the first spelling seen", () => {
    expect(
      ownerOptions([act({ owner: "Jane" }), act({ owner: "jane" }), act({ owner: "  JANE  " })]),
    ).toEqual(["Jane"]);
  });

  it("omits blank owners entirely — they are the Unassigned option, not a name", () => {
    expect(
      ownerOptions([act({ owner: "" }), act({ owner: "   " }), act({ owner: "Sam" })]),
    ).toEqual(["Sam"]);
  });

  it("tolerates a non-array", () => {
    expect(ownerOptions(/** @type {*} */ (null))).toEqual([]);
  });
});

describe("hasUnassigned helpers", () => {
  it("detects a blank owner", () => {
    expect(hasUnassignedOwner([act({ owner: "Sam" })])).toBe(false);
    expect(hasUnassignedOwner([act({ owner: "Sam" }), act({ owner: "" })])).toBe(true);
  });

  it("detects a blank pillar without treating pillar 0 as blank", () => {
    expect(hasUnassignedPillar([act({ pillarId: 1 })])).toBe(false);
    expect(hasUnassignedPillar([act({ pillarId: null })])).toBe(true);
    expect(hasUnassignedPillar([act({ pillarId: undefined })])).toBe(true);
    expect(hasUnassignedPillar([act({ pillarId: 0 })])).toBe(false);
  });
});

describe("filterActions — pillar", () => {
  const actions = [
    act({ id: "p1", pillarId: 1 }),
    act({ id: "p2", pillarId: 2 }),
    act({ id: "none", pillarId: null }),
  ];

  it("returns everything under ANY", () => {
    expect(filterActions(actions, { pillar: ANY }, TODAY)).toHaveLength(3);
  });

  it("matches a numeric id given as a string, as a <select> hands it over", () => {
    expect(filterActions(actions, { pillar: "1" }, TODAY).map((a) => a.id)).toEqual(["p1"]);
    expect(filterActions(actions, { pillar: 1 }, TODAY).map((a) => a.id)).toEqual(["p1"]);
  });

  it("UNASSIGNED matches only the blank pillar, not pillar 1", () => {
    expect(filterActions(actions, { pillar: UNASSIGNED }, TODAY).map((a) => a.id)).toEqual([
      "none",
    ]);
  });
});

describe("filterActions — owner", () => {
  const actions = [
    act({ id: "jane", owner: "Jane" }),
    act({ id: "jane2", owner: "jane" }),
    act({ id: "sam", owner: "Sam" }),
    act({ id: "blank", owner: "" }),
  ];

  it("matches every spelling of the chosen owner", () => {
    expect(filterActions(actions, { owner: "Jane" }, TODAY).map((a) => a.id)).toEqual([
      "jane",
      "jane2",
    ]);
  });

  it("UNASSIGNED matches only blank owners", () => {
    expect(filterActions(actions, { owner: UNASSIGNED }, TODAY).map((a) => a.id)).toEqual([
      "blank",
    ]);
  });
});

describe("filterActions — due date", () => {
  const actions = [
    act({ id: "late", due: "2026-09-01" }),
    act({ id: "lateDone", due: "2026-09-01", done: true }),
    act({ id: "today", due: TODAY }),
    act({ id: "in5", due: "2026-10-05" }),
    act({ id: "in30", due: "2026-10-30" }),
    act({ id: "undated", due: "" }),
  ];

  it("overdue excludes completed work and excludes today itself", () => {
    expect(filterActions(actions, { due: "overdue" }, TODAY).map((a) => a.id)).toEqual(["late"]);
  });

  it("next7 spans today through seven days out, inclusive at both ends", () => {
    expect(filterActions(actions, { due: "next7" }, TODAY).map((a) => a.id)).toEqual([
      "today",
      "in5",
    ]);
    expect(
      filterActions([act({ id: "edge", due: addDays(TODAY, 7) })], { due: "next7" }, TODAY),
    ).toHaveLength(1);
    expect(
      filterActions([act({ id: "past", due: addDays(TODAY, 8) })], { due: "next7" }, TODAY),
    ).toHaveLength(0);
  });

  it("month is the calendar month, so it includes dates already passed in it", () => {
    const ids = filterActions(actions, { due: "month" }, TODAY).map((a) => a.id);
    expect(ids).toEqual(["late", "lateDone", "today"]);
  });

  it("UNASSIGNED matches only actions with no due date", () => {
    expect(filterActions(actions, { due: UNASSIGNED }, TODAY).map((a) => a.id)).toEqual([
      "undated",
    ]);
  });

  it("every dated bucket excludes undated work", () => {
    ["overdue", "next7", "month"].forEach((due) => {
      expect(filterActions(actions, { due }, TODAY).some((a) => a.id === "undated")).toBe(false);
    });
  });

  it("exposes its buckets in select order with ANY first", () => {
    expect(DUE_FILTERS.map((f) => f.key)).toEqual([ANY, "overdue", "next7", "month", UNASSIGNED]);
  });
});

describe("filterActions — composition", () => {
  const actions = [
    act({ id: "match", pillarId: 1, owner: "Jane", due: "2026-09-01" }),
    act({ id: "wrongPillar", pillarId: 2, owner: "Jane", due: "2026-09-01" }),
    act({ id: "wrongOwner", pillarId: 1, owner: "Sam", due: "2026-09-01" }),
    act({ id: "wrongDue", pillarId: 1, owner: "Jane", due: "2026-12-01" }),
  ];

  it("ANDs the three filters together", () => {
    expect(
      filterActions(actions, { pillar: 1, owner: "Jane", due: "overdue" }, TODAY).map((a) => a.id),
    ).toEqual(["match"]);
  });

  it("the empty criteria is the identity", () => {
    expect(filterActions(actions, NO_FILTERS, TODAY)).toHaveLength(4);
    expect(filterActions(actions, {}, TODAY)).toHaveLength(4);
    expect(filterActions(actions, undefined, TODAY)).toHaveLength(4);
  });

  it("does not mutate its input", () => {
    const before = actions.map((a) => a.id);
    filterActions(actions, { pillar: 1 }, TODAY);
    expect(actions.map((a) => a.id)).toEqual(before);
  });

  it("tolerates a non-array and null entries", () => {
    expect(filterActions(/** @type {*} */ (null), {}, TODAY)).toEqual([]);
    expect(filterActions([null, act({ id: "real" })], {}, TODAY).map((a) => a.id)).toEqual([
      "real",
    ]);
  });
});

describe("isFiltered", () => {
  it("is false for the cleared criteria and true once anything narrows", () => {
    expect(isFiltered(NO_FILTERS)).toBe(false);
    expect(isFiltered({})).toBe(false);
    expect(isFiltered(undefined)).toBe(false);
    expect(isFiltered({ pillar: 1 })).toBe(true);
    expect(isFiltered({ owner: UNASSIGNED })).toBe(true);
    expect(isFiltered({ due: "overdue" })).toBe(true);
  });
});

describe("filterActions — an unrecognised due bucket", () => {
  it("passes dated actions through rather than hiding everything", () => {
    // A stale value from an older build, or a typo in a caller. Showing too
    // much is recoverable; silently showing nothing looks like data loss.
    const actions = [act({ id: "dated", due: "2026-10-01" }), act({ id: "undated", due: "" })];
    expect(filterActions(actions, { due: "someOldKey" }, TODAY).map((a) => a.id)).toEqual([
      "dated",
    ]);
  });
});

describe("filterActions — malformed field types", () => {
  it("treats a non-string due and a non-string owner as blank", () => {
    // Same reason as the grouping module's equivalent cases: the actions array
    // is a localStorage mirror that has been through several schema changes,
    // so a field can arrive as the wrong type. Blank is the safe reading —
    // it surfaces the action under "Unassigned" rather than dropping it.
    const actions = [
      act({ id: "numDue", due: 20260101 }),
      act({ id: "objOwner", owner: { name: "Jane" } }),
    ];
    // Both match "no due date": numDue's due is a number rather than a string,
    // and objOwner's is the blank the fixture defaults to.
    expect(filterActions(actions, { due: UNASSIGNED }, TODAY).map((a) => a.id)).toEqual([
      "numDue",
      "objOwner",
    ]);
    expect(filterActions(actions, { owner: UNASSIGNED }, TODAY).map((a) => a.id)).toEqual([
      "numDue",
      "objOwner",
    ]);
  });

  it("hasUnassigned* tolerate null entries and non-string fields", () => {
    expect(hasUnassignedOwner([null, act({ owner: "Sam" })])).toBe(false);
    expect(hasUnassignedOwner([act({ owner: 42 })])).toBe(true);
    expect(hasUnassignedPillar([null, act({ pillarId: 1 })])).toBe(false);
    expect(hasUnassignedPillar([act({ pillarId: "" })])).toBe(true);
  });

  it("ownerOptions ignores a non-string owner", () => {
    expect(ownerOptions([act({ owner: 42 }), act({ owner: "Sam" })])).toEqual(["Sam"]);
  });
});
