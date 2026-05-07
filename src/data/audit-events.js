// src/data/audit-events.js
// @ts-check
// Phase 4 Wave 3 (D-11): pass-through to cloud/audit.js (which is itself a
// Phase 7 stub). Calls are no-ops today; Phase 7 (FN-04 / AUDIT-01) lands the
// real auditWrite callable. The API surface defined here so that views/*
// (Wave 4 onwards) can call recordAuditEvent today and the call lands on the
// real callable in Phase 7 — zero re-extraction needed.
//
// Cleanup-ledger row: "Phase 7 (FN-04 / AUDIT-01) wires recordAuditEvent →
// cloud/audit.js → real auditWrite callable" — closes at Phase 7.
//
// Threat model anchor (T-4-3-5 / Repudiation): Phase 4 ships before audit-log
// infrastructure exists (Phase 7). The seam exists so views/* can call
// recordAuditEvent today; the call lands at the real callable Phase 7. The
// audit gap is intentional and time-bounded.
import { writeAuditEvent } from "../cloud/audit.js";

/**
 * @param {{ event: string, payload?: any }} input
 * @returns {Promise<void>}
 */
export async function recordAuditEvent(input) {
  await writeAuditEvent(input);
}
