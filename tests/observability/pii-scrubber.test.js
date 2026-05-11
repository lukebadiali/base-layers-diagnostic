// tests/observability/pii-scrubber.test.js
// @ts-check
// Phase 9 Wave 1 (OBS-01 / Pitfall 18): unit tests for the shared PII scrubber
// dictionary + scrubPii(event) helper. Drift across the browser/.js and
// node/.ts twins is caught separately by the parity test in
// functions/test/util/pii-scrubber-parity.test.ts.
import { describe, it, expect } from "vitest";
import { PII_KEYS, scrubPii } from "../../src/observability/pii-scrubber.js";

describe("observability/pii-scrubber.js — PII_KEYS dictionary", () => {
  it("PII_KEYS is a frozen array containing the canonical keys", () => {
    expect(Object.isFrozen(PII_KEYS)).toBe(true);
    expect(PII_KEYS).toContain("email");
    expect(PII_KEYS).toContain("name");
    expect(PII_KEYS).toContain("displayName");
    expect(PII_KEYS).toContain("ip");
    expect(PII_KEYS).toContain("phone");
    expect(PII_KEYS).toContain("address");
    expect(PII_KEYS).toContain("body");
    expect(PII_KEYS).toContain("message");
    expect(PII_KEYS).toContain("chatBody");
    expect(PII_KEYS).toContain("commentBody");
  });
});

describe("observability/pii-scrubber.js — scrubPii", () => {
  it("Test 1: scrubs PII keys inside event.extra", () => {
    const event = { extra: { email: "leak@example.com", keepme: "ok" } };
    const out = scrubPii(event);
    expect(out.extra.email).toBe("<redacted>");
    expect(out.extra.keepme).toBe("ok");
  });

  it("Test 2: scrubs free-form request.body string", () => {
    const event = { request: { body: "long chat message body" } };
    const out = scrubPii(event);
    expect(out.request.body).toBe("<redacted-body>");
  });

  it("Test 3: returns null/undefined/strings unchanged", () => {
    expect(scrubPii(null)).toBeNull();
    expect(scrubPii(undefined)).toBeUndefined();
    expect(scrubPii("string")).toBe("string");
  });

  it("Test 4: scrubs PII keys inside event.contexts.<bag>", () => {
    const event = { contexts: { user: { name: "Alice", role: "admin" } } };
    const out = scrubPii(event);
    expect(out.contexts.user.name).toBe("<redacted>");
    expect(out.contexts.user.role).toBe("admin");
  });

  it("Test 5: scrubs request.data string + leaves non-string request fields alone", () => {
    const event = {
      request: {
        data: "some chat payload",
        method: "POST",
        url: "https://example.com",
      },
    };
    const out = scrubPii(event);
    expect(out.request.data).toBe("<redacted-body>");
    expect(out.request.method).toBe("POST");
    expect(out.request.url).toBe("https://example.com");
  });

  it("is safe to call with an empty object", () => {
    expect(() => scrubPii({})).not.toThrow();
    expect(scrubPii({})).toEqual({});
  });
});
