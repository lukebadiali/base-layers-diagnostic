// Phase 3 (HOST-05, FN-10): /api/csp-violations sink. 2nd-gen Cloud Function
// (firebase-functions v7) pinned to europe-west2 per D-04a + D-06.
//
// Wire formats accepted (D-08):
//   - application/csp-report (legacy report-uri; { "csp-report": {...} })
//   - application/reports+json (modern Reporting API; array of report objects)
//
// Abuse mitigation per D-12 / T-3-3: content-type allowlist (400 on miss),
// 64 KiB body cap (413 on overflow). Per-IP rate limit deferred to Phase 7
// (FN-09).
//
// Filter pipeline:
//   1. Content-type gate            (400)
//   2. Body-size gate               (413)
//   3. rawBody fallback parse       (400 on JSON parse error — Pitfall 3)
//   4. normalise()                  (204 on garbage)
//   5. shouldDrop()                 (204 on extension/synthetic noise)
//   6. isDuplicate() / markSeen()   (204 on dedup hit; D-11)
//   7. logger.warn(message, obj)    (D-10a — yields severity=WARNING +
//      queryable jsonPayload in Cloud Logging; the console.* family is banned
//      in this workspace by ESLint no-console=error per RESEARCH.md §Pattern 2)
//
// Always responds 204. Browser ignores the body; 204 is the conventional
// acknowledgement for a fire-and-forget violation report.

import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { normalise } from "./normalise.js";
import { shouldDrop } from "./filter.js";
import { isDuplicate, markSeen, fingerprint } from "./dedup.js";

const MAX_BODY_BYTES = 64 * 1024;

export const cspReportSink = onRequest(
  { region: "europe-west2" },
  (req, res) => {
    // Step 1 — content-type gate (D-12 / T-3-3).
    const contentType = String(req.headers["content-type"] ?? "");
    const isLegacy = contentType.includes("application/csp-report");
    const isModern = contentType.includes("application/reports+json");
    if (!isLegacy && !isModern) {
      res.status(400).send("Bad Request");
      return;
    }

    // Step 2 — body-size gate (D-12 / T-3-3, 64 KiB cap).
    const contentLength = parseInt(String(req.headers["content-length"] ?? "0"), 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      res.status(413).send("Payload Too Large");
      return;
    }

    // Step 3 — rawBody fallback parse (Pitfall 3).
    // firebase-functions v7's body-parser auto-parses application/json but may
    // not auto-parse application/csp-report (custom Content-Type that express's
    // built-in json() middleware does not match). When req.body is empty or
    // missing, manually decode req.rawBody as UTF-8 JSON. End-to-end smoke in
    // 03-05-PLAN.md verifies the real wire format reaches Cloud Logging.
    let parsedBody: unknown = req.body;
    if (
      parsedBody === undefined ||
      parsedBody === null ||
      (typeof parsedBody === "object" &&
        !Array.isArray(parsedBody) &&
        Object.keys(parsedBody as object).length === 0)
    ) {
      try {
        const raw = (req as unknown as { rawBody?: Buffer }).rawBody?.toString("utf8") ?? "";
        parsedBody = raw ? JSON.parse(raw) : null;
      } catch {
        res.status(400).send("Bad Request");
        return;
      }
    }

    // Step 4 — normalise to NormalisedReport (or 204 on garbage).
    const report = normalise(parsedBody);
    if (!report) {
      res.status(204).send();
      return;
    }

    // Step 5 — drop extension/synthetic noise (D-11).
    if (shouldDrop(report)) {
      res.status(204).send();
      return;
    }

    // Step 6 — 5-minute dedup window (D-11).
    if (isDuplicate(report)) {
      res.status(204).send();
      return;
    }
    markSeen(report);

    // Step 7 — structured Cloud Logging (D-10a / RESEARCH.md §Pattern 2).
    // logger.warn(message, structuredObj) yields severity=WARNING with a
    // queryable jsonPayload. Cloud Logging Logs Explorer query:
    //   resource.type="cloud_run_revision"
    //   severity=WARNING
    //   jsonPayload.message="csp.violation"
    logger.warn("csp.violation", { report, fingerprint: fingerprint(report) });

    res.status(204).send();
  },
);
