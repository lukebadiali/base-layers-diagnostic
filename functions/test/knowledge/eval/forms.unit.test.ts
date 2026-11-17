// The eval turns Luke's Pillar 1 template into a form for every pillar. This
// checks that path without any model: stub content for each pillar goes
// through toSpec -> tools/fill_form.py -> readDocx -> parseSessionForm and
// comes back as the right pillar, areas, dates and rows.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readDocx } from "../../../src/knowledge/docx";
import { parseSessionForm } from "../../../src/knowledge/form";
import { EVAL_CLIENTS, PILLAR_NAMES, PILLARS, topicAreas } from "./clients";
import { sessionDate, toSpec } from "./generate.eval.test";

const TEMPLATE = join(__dirname, "..", "fixtures", "pillar-1-template.docx");
const FILLER = join(__dirname, "..", "tools", "fill_form.py");

describe("eval form building", () => {
  const dir = mkdtempSync(join(tmpdir(), "kn-eval-"));
  const client = EVAL_CLIENTS[2];

  it.each(PILLARS)("pillar %s round-trips through the template", (p) => {
    const areas = topicAreas(p);
    const content = {
      sessionName: `Week ${p} - Test session`,
      summary: `Summary for pillar ${p}.`,
      discussion: [
        { topic: "First topic", keyPoints: "Point one." },
        { topic: "Second topic", keyPoints: "Point two." },
      ],
      recommendations: [
        { area: areas[0], recommendation: `Do the first thing for pillar ${p}.`, agreed: "Yes" as const },
        { area: areas[areas.length - 1], recommendation: `Do the last thing for pillar ${p}.`, agreed: "Pending" as const },
      ],
      actions: [{ action: "Send notes", owner: "Claire Dunn" }],
      nextFocus: "Next focus.",
      nextPreparation: "Bring numbers.",
      tests: [],
    };
    const spec = join(dir, `p${p}.json`);
    const out = join(dir, `p${p}.docx`);
    writeFileSync(spec, JSON.stringify(toSpec(client, p, "Luke Badiali", sessionDate(2, p), content)));
    execFileSync("python3", ["-I", FILLER, TEMPLATE, spec, out]);

    const form = parseSessionForm(readDocx(readFileSync(out)));
    expect(form.pillar).toBe(p);
    expect(form.pillarName).toBe(PILLAR_NAMES[p]);
    expect(form.client).toBe(client.name);
    expect(form.sessionDate).toMatch(/^2026-\d\d-\d\d$/);
    expect(form.discussion).toHaveLength(2);
    expect(form.recommendations.map((r) => [r.area, r.agreed])).toEqual([
      [areas[0], "yes"],
      [areas[areas.length - 1], "pending"],
    ]);
    expect(form.attendees[0]).toBe("Luke Badiali (BeDeveloped)");
    expect(form.nextSession.focus).toBe("Next focus.");

    // The title and intro lines name this pillar, not Pillar 1.
    const xml = execFileSync("python3", ["-I", "-c", "import sys,zipfile;print(zipfile.ZipFile(sys.argv[1]).read('word/document.xml').decode())", out]).toString();
    if (p !== "1") expect(xml).not.toContain("Strategy, ICP");
  });
});
