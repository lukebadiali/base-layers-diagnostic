// Phase 3 (HOST-05, FN-10): pure transform from CSP wire formats to a canonical
// NormalisedReport shape. Two formats supported:
//   1. Modern Reporting API (Content-Type: application/reports+json) — body is
//      Array<{ type, body }>; the csp-violation entry has camelCase fields
//      (blockedURL, effectiveDirective, documentURL).
//   2. Legacy report-uri (Content-Type: application/csp-report) — body is
//      { "csp-report": {...} } with kebab-case fields (blocked-uri,
//      effective-directive | violated-directive, document-uri).
//
// Returns null on any unrecognised input (null/undefined/scalar/empty obj/
// array without csp-violation entry). Pure, side-effect-free; safe for unit
// testing without firebase-functions runtime.

export interface NormalisedReport {
  blockedUri: string;
  violatedDirective: string;
  documentUri: string;
  disposition: string;
  sourceFile?: string;
}

export function normalise(body: unknown): NormalisedReport | null {
  if (!body || typeof body !== "object") return null;

  // Modern Reporting API: application/reports+json.
  // Body is Array<{ type, body }>; we want the entry with type === "csp-violation".
  if (Array.isArray(body)) {
    const entry = (body as Array<{ type?: string; body?: Record<string, unknown> }>).find(
      (r) => r && typeof r === "object" && r.type === "csp-violation",
    );
    if (!entry || !entry.body || typeof entry.body !== "object") return null;
    const b = entry.body;
    return {
      blockedUri: String(b["blockedURL"] ?? ""),
      violatedDirective: String(b["effectiveDirective"] ?? ""),
      documentUri: String(b["documentURL"] ?? ""),
      disposition: String(b["disposition"] ?? "report-only"),
      sourceFile: b["sourceFile"] ? String(b["sourceFile"]) : undefined,
    };
  }

  // Legacy report-uri: application/csp-report.
  // Body is { "csp-report": { "blocked-uri": ..., "effective-directive": ..., ... } }.
  const obj = body as Record<string, unknown>;
  const csp = obj["csp-report"] as Record<string, unknown> | undefined;
  if (csp && typeof csp === "object") {
    return {
      blockedUri: String(csp["blocked-uri"] ?? ""),
      // effective-directive is the modern field name; older browsers send
      // violated-directive instead. Prefer effective when present.
      violatedDirective: String(
        csp["effective-directive"] ?? csp["violated-directive"] ?? "",
      ),
      documentUri: String(csp["document-uri"] ?? ""),
      disposition: String(csp["disposition"] ?? "report-only"),
      sourceFile: csp["source-file"] ? String(csp["source-file"]) : undefined,
    };
  }

  return null;
}
