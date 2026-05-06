// Phase 3 (HOST-05, FN-10): cover shouldDrop() — extension + synthetic origins
import { describe, it, expect } from "vitest";
import { shouldDrop } from "../../src/csp/filter.js";
import type { NormalisedReport } from "../../src/csp/normalise.js";

const base: NormalisedReport = {
  blockedUri: "https://example.com/bad.js",
  violatedDirective: "script-src-elem",
  documentUri: "https://baselayers.bedeveloped.com/",
  disposition: "report-only",
};

describe("shouldDrop — extension origins via blockedUri (D-11)", () => {
  it.each([
    "chrome-extension://abc/inject.js",
    "moz-extension://xyz/content.js",
    "safari-web-extension://id/script.js",
    "webkit-masked-url://fake",
    "safari-extension://ext/script.js",
  ])("drops blockedUri starting with %s", (blocked) => {
    expect(shouldDrop({ ...base, blockedUri: blocked })).toBe(true);
  });
});

describe("shouldDrop — extension origins via sourceFile (D-11)", () => {
  it("drops a sourceFile starting with chrome-extension://", () => {
    expect(shouldDrop({ ...base, sourceFile: "chrome-extension://abc/inject.js" })).toBe(true);
  });
});

describe("shouldDrop — synthetic origins (D-11)", () => {
  it.each(["about:srcdoc", "about:blank", "data:text/html,foo"])(
    "drops blockedUri %s",
    (blocked) => {
      expect(shouldDrop({ ...base, blockedUri: blocked })).toBe(true);
    },
  );
});

describe("shouldDrop — legitimate violations are kept (T-3-2 sanity)", () => {
  it("keeps a normal cross-origin script violation", () => {
    expect(shouldDrop(base)).toBe(false);
  });

  it("keeps document-uri-mismatch reports during soak (D-11)", () => {
    expect(shouldDrop({ ...base, documentUri: "https://other-domain.example/" })).toBe(false);
  });
});
