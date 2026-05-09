// Phase 3 (HOST-05, FN-10): pure shouldDrop() over extension and synthetic
// origins per D-11. Drops the 70-90% of CSP volume that comes from user-
// installed browser extensions (chrome-extension://, moz-extension://, etc.)
// and synthetic frame origins (about:srcdoc, about:blank, data:). Never drops
// legitimate https:// reports.
//
// document-uri-mismatch reports are KEPT during the Phase-3 soak window
// (D-11). Phase 10 tightens that filter once the policy is enforced.

import type { NormalisedReport } from "./normalise.js";

const EXTENSION_SCHEMES = [
  "chrome-extension://",
  "moz-extension://",
  "safari-web-extension://",
  "webkit-masked-url://",
  "safari-extension://",
];

const SYNTHETIC_ORIGINS = ["about:srcdoc", "about:blank", "data:"];

export function shouldDrop(r: NormalisedReport): boolean {
  const blocked = r.blockedUri ?? "";
  const srcFile = r.sourceFile ?? "";

  // Drop extension origins (typical 70-90% of unfiltered CSP volume).
  for (const scheme of EXTENSION_SCHEMES) {
    if (blocked.startsWith(scheme) || srcFile.startsWith(scheme)) return true;
  }

  // Drop synthetic origins (ad/extension iframes, data-URI documents).
  for (const synthetic of SYNTHETIC_ORIGINS) {
    if (blocked.startsWith(synthetic) || srcFile.startsWith(synthetic)) return true;
  }

  // D-11: keep document-uri mismatches during the soak window. They tell us
  // whether some Firebase-default URL is generating reports we wouldn't
  // otherwise see. TODO Phase 10: tighten this filter once CSP is enforced.

  return false;
}
