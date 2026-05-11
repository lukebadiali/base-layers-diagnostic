// src/observability/pii-scrubber.js
// @ts-check
// Phase 9 Wave 1 (OBS-01 / Pitfall 18): shared PII-scrubber dictionary +
// scrubPii(event) helper. Browser SDK (@sentry/browser) imports this directly;
// node SDK (@sentry/node) imports the byte-equivalent TS twin at
// functions/src/util/pii-scrubber.ts. A parity test in
// functions/test/util/pii-scrubber-parity.test.ts asserts the two arrays
// match — the test IS the contract (Pitfall 7 — drift mitigation).

/** @type {readonly string[]} */
export const PII_KEYS = Object.freeze([
  "email",
  "name",
  "displayName",
  "ip",
  "phone",
  "address",
  "body",
  "message",
  "chatBody",
  "commentBody",
]);

/** @param {*} event @returns {*|null} */
export function scrubPii(event) {
  if (!event || typeof event !== "object") return event;
  for (const bag of [event.extra, ...Object.values(event.contexts ?? {})]) {
    if (bag && typeof bag === "object") {
      for (const k of PII_KEYS) if (k in bag) bag[k] = "<redacted>";
    }
  }
  if (event.request && typeof event.request === "object") {
    for (const k of ["data", "body"]) {
      if (typeof event.request[k] === "string") event.request[k] = "<redacted-body>";
    }
  }
  return event;
}
