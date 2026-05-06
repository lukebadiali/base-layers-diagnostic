// Phase 3 (HOST-05, FN-10): in-memory 5-minute dedup keyed on
// `${origin}|${directive}` lowercased per D-11. Cuts log volume ~95% without
// losing distinct violations.
//
// Cold-start behaviour: the module-level Map is reset on every cold start.
// Acceptable per D-11: across cold starts we re-log once per dedup window,
// not per session. Cloud Logging cost remains bounded.
//
// `_clearForTest` is exposed for unit tests that use vi.useFakeTimers() and
// need to reset state between cases.

import type { NormalisedReport } from "./normalise.js";

const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const recentFingerprints = new Map<string, number>();

export function fingerprint(r: NormalisedReport): string {
  // Normalise: lowercase scheme+host (no path/query) + lowercase directive.
  let blocked = (r.blockedUri ?? "").toLowerCase();
  try {
    const url = new URL(blocked);
    blocked = url.origin; // strips path/query, keeps scheme+host
  } catch {
    // Not a URL (e.g. "inline", "eval", "data") — use as-is.
  }
  return `${blocked}|${(r.violatedDirective ?? "").toLowerCase()}`;
}

export function isDuplicate(r: NormalisedReport): boolean {
  const fp = fingerprint(r);
  const last = recentFingerprints.get(fp) ?? 0;
  return Date.now() - last < DEDUP_WINDOW_MS;
}

export function markSeen(r: NormalisedReport): void {
  recentFingerprints.set(fingerprint(r), Date.now());
}

/** Exposed for testing with fake timers. Not part of the production API. */
export function _clearForTest(): void {
  recentFingerprints.clear();
}
