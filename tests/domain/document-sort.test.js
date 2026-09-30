// tests/domain/document-sort.test.js
// @ts-check
// Milestone v6 (FILE-05). The createdAt shape matrix is the point: the live
// listener hands over Firestore Timestamps, the localStorage mirror and the
// fixtures hand over ISO strings, and a comparator that reads one of those as
// zero silently sinks those files to the bottom of a date-ordered list.
import { describe, it, expect } from "vitest";
import {
  DEFAULT_DOCUMENT_SORT,
  DOCUMENT_SORT_KEYS,
  createdMillis,
  normaliseSortKey,
  sortDocuments,
  sortFolders,
  uploaderLabel,
} from "../../src/domain/document-sort.js";

/** @param {number} ms a Firestore Timestamp duck */
const stamp = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });

/** @param {*} over */
const doc = (over) => ({
  id: "d1",
  filename: "file.pdf",
  uploaderName: "Jane Smith",
  createdAt: stamp(1000),
  ...over,
});

describe("createdMillis", () => {
  it("reads a Firestore Timestamp", () => {
    expect(createdMillis({ createdAt: stamp(1750000000000) })).toBe(1750000000000);
  });
  it("reads a Timestamp exposing only toDate", () => {
    expect(createdMillis({ createdAt: { toDate: () => new Date(500) } })).toBe(500);
  });
  it("reads a Date", () => {
    expect(createdMillis({ createdAt: new Date(700) })).toBe(700);
  });
  it("reads an ISO string", () => {
    expect(createdMillis({ createdAt: "2026-09-30T00:00:00.000Z" })).toBe(
      Date.parse("2026-09-30T00:00:00.000Z"),
    );
  });
  it("reads a raw number", () => {
    expect(createdMillis({ createdAt: 900 })).toBe(900);
  });
  it("returns 0 for missing or unparseable timestamps rather than NaN", () => {
    expect(createdMillis({})).toBe(0);
    expect(createdMillis({ createdAt: null })).toBe(0);
    expect(createdMillis({ createdAt: "not a date" })).toBe(0);
    expect(createdMillis(null)).toBe(0);
  });
  it("never returns NaN, which would make every comparison false and leave the list unsorted", () => {
    [undefined, null, "", "xyz", {}, []].forEach((v) => {
      expect(Number.isNaN(createdMillis({ createdAt: v }))).toBe(false);
    });
  });
});

describe("sortDocuments — added (the default)", () => {
  it("puts the newest first", () => {
    const out = sortDocuments([
      doc({ id: "old", createdAt: stamp(100) }),
      doc({ id: "new", createdAt: stamp(900) }),
      doc({ id: "mid", createdAt: stamp(500) }),
    ]);
    expect(out.map((d) => d.id)).toEqual(["new", "mid", "old"]);
  });

  it("is what an omitted or unknown key falls back to", () => {
    const docs = [doc({ id: "old", createdAt: stamp(1) }), doc({ id: "new", createdAt: stamp(2) })];
    expect(sortDocuments(docs).map((d) => d.id)).toEqual(["new", "old"]);
    expect(sortDocuments(docs, "nonsense").map((d) => d.id)).toEqual(["new", "old"]);
    expect(DEFAULT_DOCUMENT_SORT).toBe("added");
  });

  it("orders mixed timestamp shapes against each other correctly", () => {
    const out = sortDocuments([
      doc({ id: "iso", createdAt: "2026-01-01T00:00:00.000Z" }),
      doc({ id: "ts", createdAt: stamp(Date.parse("2026-06-01T00:00:00.000Z")) }),
      doc({ id: "date", createdAt: new Date("2026-03-01T00:00:00.000Z") }),
    ]);
    expect(out.map((d) => d.id)).toEqual(["ts", "date", "iso"]);
  });
});

describe("sortDocuments — name", () => {
  it("sorts A-Z, case-insensitively", () => {
    const out = sortDocuments(
      [
        doc({ id: "z", filename: "zebra.pdf" }),
        doc({ id: "a", filename: "Apple.pdf" }),
        doc({ id: "m", filename: "mango.pdf" }),
      ],
      "name",
    );
    expect(out.map((d) => d.id)).toEqual(["a", "m", "z"]);
  });

  it("orders embedded numbers numerically, so Report 2 precedes Report 10", () => {
    const out = sortDocuments(
      [doc({ id: "ten", filename: "Report 10.pdf" }), doc({ id: "two", filename: "Report 2.pdf" })],
      "name",
    );
    expect(out.map((d) => d.id)).toEqual(["two", "ten"]);
  });

  it("falls back to the `name` field when `filename` is absent", () => {
    const out = sortDocuments(
      [
        doc({ id: "b", filename: undefined, name: "beta.pdf" }),
        doc({ id: "a", filename: undefined, name: "alpha.pdf" }),
      ],
      "name",
    );
    expect(out.map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("breaks name ties with newest first", () => {
    const out = sortDocuments(
      [
        doc({ id: "old", filename: "same.pdf", createdAt: stamp(1) }),
        doc({ id: "new", filename: "same.pdf", createdAt: stamp(2) }),
      ],
      "name",
    );
    expect(out.map((d) => d.id)).toEqual(["new", "old"]);
  });
});

describe("sortDocuments — uploader", () => {
  it("sorts by uploader name A-Z", () => {
    const out = sortDocuments(
      [doc({ id: "z", uploaderName: "Zoe" }), doc({ id: "a", uploaderName: "Adam" })],
      "uploader",
    );
    expect(out.map((d) => d.id)).toEqual(["a", "z"]);
  });

  it("falls back to the uploader's email when no name was recorded", () => {
    expect(uploaderLabel({ uploaderEmail: "x@y.com" })).toBe("x@y.com");
    const out = sortDocuments(
      [
        doc({ id: "byEmail", uploaderName: undefined, uploaderEmail: "aaa@y.com" }),
        doc({ id: "byName", uploaderName: "Zoe" }),
      ],
      "uploader",
    );
    expect(out.map((d) => d.id)).toEqual(["byEmail", "byName"]);
  });

  it("pushes documents with no uploader to the end, not to the top", () => {
    const out = sortDocuments(
      [
        doc({ id: "unknown", uploaderName: undefined, uploaderEmail: undefined }),
        doc({ id: "zoe", uploaderName: "Zoe" }),
      ],
      "uploader",
    );
    expect(out.map((d) => d.id)).toEqual(["zoe", "unknown"]);
  });

  it("breaks uploader ties by filename, then by newest", () => {
    const out = sortDocuments(
      [
        doc({ id: "b", uploaderName: "Jane", filename: "b.pdf" }),
        doc({ id: "a", uploaderName: "Jane", filename: "a.pdf" }),
      ],
      "uploader",
    );
    expect(out.map((d) => d.id)).toEqual(["a", "b"]);
  });
});

describe("sortDocuments — hygiene", () => {
  it("does not mutate its input", () => {
    const docs = [doc({ id: "b", createdAt: stamp(1) }), doc({ id: "a", createdAt: stamp(2) })];
    const before = docs.map((d) => d.id);
    sortDocuments(docs, "name");
    expect(docs.map((d) => d.id)).toEqual(before);
  });

  it("tolerates a non-array", () => {
    expect(sortDocuments(/** @type {*} */ (null))).toEqual([]);
    expect(sortDocuments(/** @type {*} */ (undefined), "name")).toEqual([]);
  });
});

describe("sortFolders", () => {
  it("sorts by name whatever the file sort is, numerically aware", () => {
    const out = sortFolders([{ name: "Phase 10" }, { name: "Phase 2" }, { name: "Admin" }]);
    expect(out.map((f) => f.name)).toEqual(["Admin", "Phase 2", "Phase 10"]);
  });
  it("does not mutate and tolerates junk", () => {
    const input = [{ name: "b" }, { name: "a" }];
    sortFolders(input);
    expect(input.map((f) => f.name)).toEqual(["b", "a"]);
    expect(sortFolders(/** @type {*} */ (null))).toEqual([]);
  });
});

describe("normaliseSortKey", () => {
  it("passes through every implemented key", () => {
    DOCUMENT_SORT_KEYS.forEach((k) => expect(normaliseSortKey(k.key)).toBe(k.key));
  });
  it("falls back to the default for a stale or junk key", () => {
    [undefined, null, "", "size", 42, {}].forEach((k) =>
      expect(normaliseSortKey(k)).toBe(DEFAULT_DOCUMENT_SORT),
    );
  });
});

describe("sortDocuments / sortFolders — malformed rows", () => {
  it("createdMillis survives a toDate that does not return a Date", () => {
    expect(createdMillis({ createdAt: { toDate: () => "not a date" } })).toBe(0);
  });

  it("createdMillis survives a toMillis that returns nothing", () => {
    expect(createdMillis({ createdAt: { toMillis: () => undefined } })).toBe(0);
  });

  it("a document with neither filename nor name sorts as an empty name", () => {
    const out = sortDocuments(
      [
        doc({ id: "named", filename: "b.pdf" }),
        doc({ id: "nameless", filename: undefined, name: undefined }),
      ],
      "name",
    );
    expect(out.map((d) => d.id)).toEqual(["nameless", "named"]);
  });

  it("two documents with no uploader at all keep a stable order", () => {
    // Both sides blank means the !ua !== !ub guard does not fire, and the
    // comparison falls through to filename then to newest-first.
    const out = sortDocuments(
      [
        doc({ id: "b", uploaderName: undefined, uploaderEmail: undefined, filename: "b.pdf" }),
        doc({ id: "a", uploaderName: undefined, uploaderEmail: undefined, filename: "a.pdf" }),
      ],
      "uploader",
    );
    expect(out.map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("uploaderLabel and displayName tolerate a null row", () => {
    expect(uploaderLabel(null)).toBe("");
    expect(sortDocuments([null, doc({ id: "real" })], "name").length).toBe(2);
  });

  it("sortFolders tolerates a folder with no name", () => {
    const out = sortFolders([{ id: "b", name: "Beta" }, { id: "nameless" }]);
    expect(out.map((f) => f.id)).toEqual(["nameless", "b"]);
  });
});

describe("sortDocuments — remaining uploader-sort branches", () => {
  it("pushes a blank uploader down whichever side of the comparison it is on", () => {
    // The named/unnamed guard has to work in both argument orders, or the
    // result depends on the input order the snapshot happened to arrive in.
    const blank = doc({ id: "blank", uploaderName: undefined, uploaderEmail: undefined });
    const named = doc({ id: "named", uploaderName: "Zoe" });
    expect(sortDocuments([blank, named], "uploader").map((d) => d.id)).toEqual(["named", "blank"]);
    expect(sortDocuments([named, blank], "uploader").map((d) => d.id)).toEqual(["named", "blank"]);
  });

  it("falls through to newest-first when uploader AND filename both tie", () => {
    const out = sortDocuments(
      [
        doc({ id: "old", uploaderName: "Jane", filename: "same.pdf", createdAt: stamp(1) }),
        doc({ id: "new", uploaderName: "Jane", filename: "same.pdf", createdAt: stamp(2) }),
      ],
      "uploader",
    );
    expect(out.map((d) => d.id)).toEqual(["new", "old"]);
  });

  it("sortFolders tolerates a null entry", () => {
    const out = sortFolders([null, { id: "a", name: "Alpha" }]);
    expect(out.length).toBe(2);
    expect(out[out.length - 1].id).toBe("a");
  });
});
