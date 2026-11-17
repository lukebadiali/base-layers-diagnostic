// The answerer's request: DeepSeek via OpenRouter, US providers only, no
// fallback, a capped length, and a prompt that carries the concise-answer,
// latest-wins and stay-in-the-excerpts rules.

import { describe, expect, it } from "vitest";
import { MAX_ANSWER_TOKENS, openrouterAnswerer, parseAnswer, systemPrompt, userPrompt } from "../../src/knowledge/answer";
import { US_PROVIDERS } from "../../src/knowledge/describer";
import type { SearchHit } from "../../src/knowledge/retrieve";

const hit = (text: string, sessionDate = "2026-11-11"): SearchHit => ({
  id: "c1",
  distance: 0.2,
  kind: "recommendation",
  pillar: "1",
  sessionDate,
  sessionName: "ICP review",
  text,
});

function stubFetch(body: unknown, status = 200) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchImpl = (async (url: string, init: { body: string }) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("openrouterAnswerer", () => {
  it("pins DeepSeek to US providers with no fallback and a length cap", async () => {
    const content = JSON.stringify({ answered: true, answer: "- Target CFOs" });
    const { fetchImpl, calls } = stubFetch({ provider: "Fireworks", choices: [{ message: { content } }] });
    const a = openrouterAnswerer({ apiKey: "k", fetchImpl, maxAttempts: 1 });
    const res = await a.answer({
      question: "Who should we target?",
      clientName: "Northwind Analytics",
      hits: [hit("Client: Northwind | Pillar 1 | Date: 2026-11-11\n\nTarget CFOs at mid-market firms")],
      coveredPillars: ["1", "2"],
      format: "bullets",
    });
    expect(res).toEqual({ answer: "- Target CFOs", answered: true, provider: "Fireworks" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const b = calls[0].body;
    expect(b.model).toBe("deepseek/deepseek-v4.1-flash");
    expect(b.max_tokens).toBe(MAX_ANSWER_TOKENS);
    expect(b.provider).toEqual({
      only: US_PROVIDERS,
      allow_fallbacks: false,
      require_parameters: true,
      data_collection: "deny",
    });
    expect((b.response_format as { type: string }).type).toBe("json_schema");
    const [system, user] = b.messages as Array<{ role: string; content: string }>;
    expect(system.content).toContain("Northwind Analytics");
    expect(system.content).toContain("Pillar 1, Pillar 2");
    expect(user.content).toContain("Question: Who should we target?");
    expect(user.content).toContain("[Excerpt 1]");
  });

  it("fails loudly when the model returns nothing", async () => {
    const { fetchImpl } = stubFetch({ choices: [{ message: { content: "  " } }] });
    const a = openrouterAnswerer({ apiKey: "k", fetchImpl, maxAttempts: 1 });
    await expect(
      a.answer({ question: "q", clientName: "c", hits: [hit("x")], coveredPillars: ["1"], format: "short" }),
    ).rejects.toThrow(/no content/);
  });
});

describe("prompts", () => {
  it("states the grounding, latest-wins and concise rules", () => {
    const s = systemPrompt("Acme", [], "bullets");
    expect(s).toMatch(/only the session excerpts/);
    expect(s).toMatch(/later Date is the current position/);
    expect(s).toMatch(/When answered is true: Answer in 3 to 6 short bullet points/);
    expect(s).toMatch(/set answered to false and make answer one sentence/);
    expect(s).toMatch(/Do not output links/);
    expect(s).toMatch(/Never use he, she, him, her, his or hers for anyone/);
    expect(s).toContain("Pillars with delivered material so far: none.");
  });

  // 17 Nov eval: NOT AGREED items described as "not settled" / "still needs
  // agreement", and BeDeveloped's advice reported as "the advice was to decline".
  it("gives fixed wording per Status and attributes every recommendation to BeDeveloped", () => {
    const s = systemPrompt("Acme", [], "bullets");
    expect(s).toContain("Every recommendation is BeDeveloped's advice to you; the Status is your decision on it.");
    expect(s).toContain("never word it as advice to decline or as the client's own idea");
    expect(s).toContain('AGREED: "You agreed to <recommendation>."');
    expect(s).toContain(
      'NOT AGREED: "BeDeveloped recommended <recommendation>; you decided not to go ahead with it."',
    );
    expect(s).toMatch(
      /It is decided and closed: never call it open, unsettled, unresolved, still to agree or awaiting agreement, and never say it was ruled out or banned\./,
    );
    expect(s).toContain('PENDING: "BeDeveloped recommended <recommendation>; this has not been decided yet."');
    expect(s).toMatch(/Never call it agreed, or agreed in principle/);
    expect(s).toMatch(/If a session summary or discussion note describes the same item differently[\s\S]*follow the Status/);
  });

  it("keeps qualifiers with their item and quotes ambiguous wording", () => {
    const s = systemPrompt("Acme", [], "short");
    expect(s).toMatch(/Keep every detail \(dates, places, numbers, names\) attached to the item it belongs to/);
    expect(s).toMatch(/quote its wording instead of rephrasing it/);
  });

  it("keeps the pillar list last", () => {
    expect(systemPrompt("Acme", ["review"], "short")).toMatch(/at most 3 short sentences[\s\S]*Review\.$/);
  });

  it("numbers excerpts in retrieval order", () => {
    const u = userPrompt("q", [hit("first"), hit("second")]);
    expect(u.indexOf("[Excerpt 1]\nfirst")).toBeLessThan(u.indexOf("[Excerpt 2]\nsecond"));
  });
});

describe("parseAnswer", () => {
  it("reads the answered flag and trims the answer", () => {
    expect(parseAnswer('{"answered": false, "answer": " Not covered yet. "}')).toEqual({
      answered: false,
      answer: "Not covered yet.",
    });
    expect(parseAnswer('```json\n{"answered": true, "answer": "- a"}\n```')).toEqual({ answered: true, answer: "- a" });
  });

  it("treats a missing flag as answered and rejects an empty answer", () => {
    expect(parseAnswer('{"answer": "x"}').answered).toBe(true);
    expect(() => parseAnswer('{"answered": true, "answer": "  "}')).toThrow(/empty answer/);
    expect(() => parseAnswer("not json")).toThrow();
  });
});

describe("answerer retries", () => {
  it("retries once when the reply is cut off mid-JSON, and uses the second reply", async () => {
    const bodies = [
      { choices: [{ message: { content: '{"answered": true, "answer": "- Target mid-market PE ho' } }] },
      { provider: "Fireworks", choices: [{ message: { content: JSON.stringify({ answered: true, answer: "- Target mid-market PE houses" }) } }] },
    ];
    let n = 0;
    const fetchImpl = (async () => new Response(JSON.stringify(bodies[n++]), { status: 200 })) as unknown as typeof fetch;
    const a = openrouterAnswerer({ apiKey: "k", fetchImpl, maxAttempts: 1 });
    const res = await a.answer({ question: "q", clientName: "c", hits: [hit("x")], coveredPillars: ["1"], format: "bullets" });
    expect(n).toBe(2);
    expect(res).toEqual({ answer: "- Target mid-market PE houses", answered: true, provider: "Fireworks" });
  });

  it("gives up after two bad replies", async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n++;
      return new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const a = openrouterAnswerer({ apiKey: "k", fetchImpl, maxAttempts: 1 });
    await expect(
      a.answer({ question: "q", clientName: "c", hits: [hit("x")], coveredPillars: ["1"], format: "short" }),
    ).rejects.toThrow(/no content/);
    expect(n).toBe(2);
  });
});
