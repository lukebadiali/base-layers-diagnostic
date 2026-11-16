import { describe, expect, it, vi } from "vitest";
import { normaliseDescription, openrouterDescriber, US_PROVIDERS } from "../../src/knowledge/describer";
import { openaiEmbedder } from "../../src/knowledge/embedder";
import { EMBEDDING_DIMENSIONS, type ParsedForm } from "../../src/knowledge/types";

const form: ParsedForm = {
  pillar: "1",
  pillarName: "Strategy, ICP & Market Positioning",
  client: "Northwind Analytics",
  sessionDate: "2026-10-14",
  sessionName: "Week 2",
  attendees: [],
  capturedBy: "",
  summary: "s",
  discussion: [{ topic: "t", keyPoints: "k" }],
  recommendations: [{ area: "Other", recommendation: "r", agreed: "yes" }],
  nextSession: { date: "", focus: "", preparation: "" },
};

const emptyTags = {
  jobTitles: [],
  targetOrganisations: [],
  competitors: [],
  positionChanges: [],
  proofPoints: [],
  mainPoints: [],
  keyTakeaways: [],
  commonThemes: [],
  keyDecisions: [],
  pillarKeyPoints: [],
  topicAreaKeyPoints: [],
  openQuestions: [],
  clientContext: "",
  discussion: [],
  recommendationAreas: [],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("normaliseDescription", () => {
  it("drops out-of-range rows and maps unknown topic areas to Other", () => {
    const d = normaliseDescription(
      {
        ...emptyTags,
        discussion: [
          { index: 0, clientViews: [], challengesRaised: [], topicArea: "ideal customer profile" },
          { index: 7, clientViews: [], challengesRaised: [], topicArea: "Made up" },
        ],
        recommendationAreas: [{ index: 0, topicArea: "Made up" }],
      },
      form,
    );
    expect(d.discussion).toEqual([{ index: 0, clientViews: [], challengesRaised: [], topicArea: "Ideal Customer Profile" }]);
    expect(d.recommendationAreas).toEqual([{ index: 0, topicArea: "Other" }]);
  });

  it("rejects output that does not match the schema", () => {
    expect(() => normaliseDescription({ ...emptyTags, mainPoints: "not a list" }, form)).toThrow();
  });
});

describe("openrouterDescriber", () => {
  it("calls DeepSeek on OpenRouter, pinned to US providers with no fallback", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ provider: "Fireworks", choices: [{ message: { content: JSON.stringify({ ...emptyTags, mainPoints: ["m"] }) } }] }),
    );
    const r = await openrouterDescriber({ apiKey: "k", fetchImpl }).describe(form);
    expect(r.description.mainPoints).toEqual(["m"]);
    expect(r.provider).toBe("Fireworks");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toMatch(/^deepseek\//);
    expect(body.provider).toEqual({
      only: US_PROVIDERS,
      allow_fallbacks: false,
      require_parameters: true,
      data_collection: "deny",
    });
    expect(US_PROVIDERS.every((p) => p.endsWith("/us"))).toBe(true);
    expect(body.response_format.json_schema.strict).toBe(true);
  });

  it("accepts JSON wrapped in a markdown fence", async () => {
    const fenced = "```json\n" + JSON.stringify({ ...emptyTags, keyDecisions: ["d"] }) + "\n```";
    const fetchImpl = vi.fn(async () => json({ choices: [{ message: { content: fenced } }] }));
    const r = await openrouterDescriber({ apiKey: "k", fetchImpl }).describe(form);
    expect(r.description.keyDecisions).toEqual(["d"]);
  });

  it("retries a 429 and gives up on a 400", async () => {
    const ok = json({ choices: [{ message: { content: JSON.stringify(emptyTags) } }] });
    const retrying = vi.fn().mockResolvedValueOnce(json({}, 429)).mockResolvedValueOnce(ok);
    await openrouterDescriber({ apiKey: "k", fetchImpl: retrying }).describe(form);
    expect(retrying).toHaveBeenCalledTimes(2);

    const bad = vi.fn(async () => json({ error: "bad" }, 400));
    await expect(openrouterDescriber({ apiKey: "k", fetchImpl: bad }).describe(form)).rejects.toThrow(/400/);
    expect(bad).toHaveBeenCalledTimes(1);
  });
});

describe("openaiEmbedder", () => {
  it("returns vectors in input order and checks their size", async () => {
    const vec = (n: number) => new Array(EMBEDDING_DIMENSIONS).fill(n);
    const fetchImpl = vi.fn(async () =>
      json({ data: [{ index: 1, embedding: vec(2) }, { index: 0, embedding: vec(1) }] }),
    );
    const out = await openaiEmbedder({ apiKey: "k", fetchImpl }).embed(["a", "b"]);
    expect(out.map((v) => v[0])).toEqual([1, 2]);
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ model: "text-embedding-3-small", dimensions: 1536 });

    const short = vi.fn(async () => json({ data: [{ index: 0, embedding: [1, 2] }] }));
    await expect(openaiEmbedder({ apiKey: "k", fetchImpl: short }).embed(["a"])).rejects.toThrow(/dimensions/);
  });
});
