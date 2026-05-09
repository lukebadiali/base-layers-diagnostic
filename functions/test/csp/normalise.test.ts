// Phase 3 (HOST-05, FN-10): cover normalise() — both wire formats + null on garbage
import { describe, it, expect } from "vitest";
import { normalise } from "../../src/csp/normalise.js";

describe("normalise — modern reports+json", () => {
  it("extracts fields from a valid csp-violation report", () => {
    const body = [
      {
        type: "csp-violation",
        body: {
          blockedURL: "https://evil.example/script.js",
          effectiveDirective: "script-src-elem",
          documentURL: "https://baselayers.bedeveloped.com/",
          disposition: "report-only",
        },
      },
    ];
    expect(normalise(body)).toEqual({
      blockedUri: "https://evil.example/script.js",
      violatedDirective: "script-src-elem",
      documentUri: "https://baselayers.bedeveloped.com/",
      disposition: "report-only",
      sourceFile: undefined,
    });
  });

  it("returns null when the array contains no csp-violation entry", () => {
    expect(normalise([{ type: "deprecation" }])).toBeNull();
  });

  it("preserves sourceFile when provided", () => {
    const body = [
      {
        type: "csp-violation",
        body: {
          blockedURL: "https://x/y.js",
          effectiveDirective: "script-src",
          documentURL: "https://baselayers.bedeveloped.com/",
          disposition: "report-only",
          sourceFile: "https://baselayers.bedeveloped.com/app.js",
        },
      },
    ];
    expect(normalise(body)?.sourceFile).toBe("https://baselayers.bedeveloped.com/app.js");
  });
});

describe("normalise — legacy application/csp-report", () => {
  it("extracts fields from a valid csp-report body", () => {
    const body = {
      "csp-report": {
        "blocked-uri": "https://evil.example/script.js",
        "effective-directive": "script-src-elem",
        "document-uri": "https://baselayers.bedeveloped.com/",
        disposition: "report",
      },
    };
    expect(normalise(body)).toEqual({
      blockedUri: "https://evil.example/script.js",
      violatedDirective: "script-src-elem",
      documentUri: "https://baselayers.bedeveloped.com/",
      disposition: "report",
      sourceFile: undefined,
    });
  });

  it("falls back to violated-directive when effective-directive is absent", () => {
    const body = { "csp-report": { "blocked-uri": "x", "violated-directive": "script-src", "document-uri": "y" } };
    expect(normalise(body)?.violatedDirective).toBe("script-src");
  });
});

describe("normalise — garbage", () => {
  it.each([null, undefined, "string", 42, true, {}, []])("returns null for %s", (input) => {
    expect(normalise(input as unknown)).toBeNull();
  });
});
