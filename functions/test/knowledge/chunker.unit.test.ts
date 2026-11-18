import { describe, expect, it } from "vitest";

import { buildChunks } from "../../src/knowledge/chunker";
import type { Description, ParsedForm } from "../../src/knowledge/types";

const form: ParsedForm = {
  pillar: "1",
  pillarName: "Proposition",
  client: "Acme Ltd",
  sessionDate: "2026-11-11",
  sessionName: "Kick-off",
  attendees: ["Jo Bloggs (CEO)"],
  capturedBy: "",
  summary: "Agreed the core proposition.",
  discussion: [],
  recommendations: [
    { area: "Market segmentation", recommendation: "Lead with outcomes.", agreed: "yes" },
    { area: "Channels", recommendation: "Do not run paid LinkedIn ads.", agreed: "no" },
    { area: "Pricing", recommendation: "Move to fixed fees.", agreed: "pending" },
    { area: "Proof", recommendation: "Publish two case studies.", agreed: "unspecified" },
  ],
  nextSession: { date: "", focus: "", preparation: "" },
};

const desc: Description = {
  jobTitles: [], targetOrganisations: [], competitors: [], positionChanges: [], proofPoints: [],
  mainPoints: ["Outcome-led messaging"], keyTakeaways: [], commonThemes: [], keyDecisions: [],
  pillarKeyPoints: [], topicAreaKeyPoints: [],
  openQuestions: ["Whether the 40% target is realistic in year one"],
  clientContext: "", discussion: [], recommendationAreas: [],
};

const chunks = buildChunks(form, desc, ["Luke"]);
const recs = chunks.filter((c) => c.kind === "recommendation").map((c) => c.text);
const overview = chunks.find((c) => c.kind === "overview")!.text;

describe("buildChunks", () => {
  it("never embeds the describer's openQuestions", () => {
    expect(chunks.some((c) => c.text.includes("40% target"))).toBe(false);
    expect(overview).not.toContain("Open questions");
  });

  it("lists pending items from the form's own Pending rows", () => {
    expect(overview).toContain("Still pending:\n- Pricing: Move to fixed fees.");
    expect(overview).not.toContain("Lead with outcomes");
  });

  it("states each recommendation's agreed status unambiguously", () => {
    expect(recs[0]).toContain("Recommendation on Market segmentation. Status: AGREED (the client accepted this).\nLead with outcomes.");
    expect(recs[1]).toContain("Status: NOT AGREED (the client rejected this; it is not in force).\nDo not run paid LinkedIn ads.");
    expect(recs[2]).toContain("Status: PENDING (not yet decided).");
    expect(recs[3]).toContain("Status: status not recorded.");
  });
});
