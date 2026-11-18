// Thin OpenAI REST client (no SDK dependency). Node 22 has fetch.

import { setTimeout as sleep } from "node:timers/promises";

export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Attempts per request for 429 and 5xx responses. */
  maxAttempts?: number;
}

export async function openaiPost<T>(cfg: OpenAIConfig, path: string, body: unknown): Promise<T> {
  if (!cfg.apiKey) throw new Error("OpenAI API key missing");
  const f = cfg.fetchImpl ?? fetch;
  const url = `${cfg.baseUrl ?? "https://api.openai.com/v1"}${path}`;
  const attempts = cfg.maxAttempts ?? 3;
  for (let attempt = 1; ; attempt++) {
    const res = await f(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify(body),
    });
    if (res.ok) return (await res.json()) as T;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= attempts) {
      const detail = (await res.text()).slice(0, 500);
      throw new Error(`OpenAI ${path} failed: ${res.status} ${detail}`);
    }
    await sleep(500 * 2 ** (attempt - 1));
  }
}
