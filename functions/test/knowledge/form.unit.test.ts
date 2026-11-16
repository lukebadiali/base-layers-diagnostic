import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readDocx, readZipEntry } from "../../src/knowledge/docx";
import { bedevelopedLeads, FormError, parseAgreed, parseSessionForm, parseUkDate, sameClient } from "../../src/knowledge/form";
import { BEDEVELOPED_STAFF } from "../../src/knowledge/types";

const fixture = (n: string) => readFileSync(join(__dirname, "fixtures", n));

describe("readDocx", () => {
  it("reads Luke's blank template as paragraphs and tables in order", () => {
    const blocks = readDocx(fixture("pillar-1-template.docx"));
    const headings = blocks.filter((b) => b.kind === "p").map((b) => (b.kind === "p" ? b.text : ""));
    expect(headings).toEqual(
      expect.arrayContaining(["Session Details", "1. Summary", "2. What We Discussed", "4. Actions", "5. Next Session"]),
    );
    expect(blocks.filter((b) => b.kind === "table")).toHaveLength(6);
  });

  it("rejects a file that is not a zip", () => {
    expect(() => readZipEntry(Buffer.from("not a docx at all, just some text padding it out"), "word/document.xml")).toThrow(
      /Not a \.docx/,
    );
  });
});

describe("parseSessionForm", () => {
  it("stops on the blank template: the Client field is required", () => {
    expect(() => parseSessionForm(readDocx(fixture("pillar-1-template.docx")))).toThrow(FormError);
  });

  it("reads every form field from a completed Pillar 1 form", () => {
    const f = parseSessionForm(readDocx(fixture("northwind-p1-v1.docx")));
    expect(f.pillar).toBe("1");
    expect(f.pillarName).toBe("Strategy, ICP & Market Positioning");
    expect(f.client).toBe("Northwind Analytics");
    expect(f.sessionDate).toBe("2026-10-14");
    expect(f.sessionName).toBe("Week 2 - Ideal Customer Profile");
    expect(f.attendees).toHaveLength(3);
    expect(f.capturedBy).toBe("Luke Badiali");
    expect(f.summary).toMatch(/mid-sized logistics firms/);
    expect(f.discussion.map((d) => d.topic)).toEqual(["Current customer base", "Buyer roles"]);
    expect(f.nextSession).toEqual({
      date: "2026-10-28",
      focus: "Positioning and differentiation against in-house tools",
      preparation: "Northwind to bring win/loss notes from the last ten deals",
    });
  });

  it("keeps only recommendation rows that were filled in, with their Agreed status", () => {
    const f = parseSessionForm(readDocx(fixture("northwind-p1-v1.docx")));
    expect(f.recommendations.map((r) => [r.area, r.agreed])).toEqual([
      ["Ideal Customer Profile", "yes"],
      ["Market segmentation", "pending"],
      ["Competitive landscape", "yes"],
    ]);
  });

  it("does not read the Actions section (action tags were removed at sign-off)", () => {
    const f = parseSessionForm(readDocx(fixture("northwind-p1-v1.docx")));
    expect(JSON.stringify(f)).not.toMatch(/Draft logistics persona/);
  });
});

describe("field helpers", () => {
  it("parses UK dates and rejects impossible ones", () => {
    expect(parseUkDate("1/2/2026", "Date")).toBe("2026-02-01");
    expect(parseUkDate("[DD/MM/YYYY]", "Date")).toBe("");
    expect(() => parseUkDate("31/02/2026", "Date")).toThrow(FormError);
    expect(() => parseUkDate("2026-02-01", "Date")).toThrow(FormError);
  });

  it("normalises Agreed? answers", () => {
    expect(parseAgreed("Yes")).toBe("yes");
    expect(parseAgreed("Y")).toBe("yes");
    expect(parseAgreed("No")).toBe("no");
    expect(parseAgreed("Not agreed yet")).toBe("no");
    expect(parseAgreed("Yet to decide")).toBe("pending");
    expect(parseAgreed("")).toBe("unspecified");
  });

  it("matches client names loosely but not across clients", () => {
    expect(sameClient("Northwind Analytics", "northwind  analytics")).toBe(true);
    expect(sameClient("Smith & Co", "Smith and Co")).toBe(true);
    expect(sameClient("Northwind Analytics", "Northwind Logistics")).toBe(false);
  });

  it("tags BeDeveloped leads without mistaking a client's namesake", () => {
    expect(bedevelopedLeads(["Luke Badiali (Founder, BeDeveloped)", "Priya Shah (CEO)"], BEDEVELOPED_STAFF)).toEqual([
      "Luke Badiali",
    ]);
    expect(bedevelopedLeads(["George (BeDeveloped)"], BEDEVELOPED_STAFF)).toEqual(["George Berrington"]);
    expect(bedevelopedLeads(["Luke Jones (CFO, Acme)"], BEDEVELOPED_STAFF)).toEqual([]);
  });
});
