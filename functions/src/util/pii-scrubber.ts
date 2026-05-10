// Phase 9 Wave 1 (OBS-01 / Pitfall 18): shared PII-scrubber dictionary — TS
// twin of src/observability/pii-scrubber.js. The two arrays MUST be identical
// at the string level; functions/test/util/pii-scrubber-parity.test.ts asserts
// equality by parsing the JS file's array literal and comparing to NODE_KEYS.
//
// Pattern C purity: this module imports from nothing — no firebase-admin/*,
// no firebase-functions/*. Safe to load from any callable / trigger module.
export const PII_KEYS = [
  "email", "name", "displayName", "ip", "phone", "address",
  "body", "message", "chatBody", "commentBody",
] as const;
