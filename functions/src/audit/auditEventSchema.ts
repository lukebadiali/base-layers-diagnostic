// Phase 7 Wave 1 (AUDIT-02): Zod schema for the auditWrite callable input.
// Single source of truth for the audit event shape. Mirror triggers in
// functions/src/audit/onOrgDelete.ts etc. (Wave 2) bypass this schema (system
// events do not cross the client boundary), but `auditWrite` callable
// validates against this schema before any side effect (FN-03 + AUDIT-02).
//
// Pattern C purity: this file imports from `zod` only — NEVER from
// firebase-admin/* or firebase-functions/*. Safe to ship into pure-logic
// unit tests.
//
// Stored shape (server-set fields not in this schema): eventId, actor, at,
// ip, userAgent, idempotencyKey, schemaVersion: 1 — see ARCHITECTURE.md
// section 5 + Pitfall 17 (server-side-only fields, never trusted from
// payload).

import { z } from "zod";

export const auditEventType = z.enum([
  "auth.signin.success",
  "auth.signin.failure",
  "auth.signout",
  "auth.mfa.enrol",
  "auth.mfa.unenrol",
  "auth.password.change",
  "auth.password.reset",
  "iam.claims.set",
  "data.org.create",
  "data.org.update",
  "data.org.softDelete",
  "data.org.restore",
  "data.user.create",
  "data.user.delete",
  "data.document.upload",
  "data.document.delete",
  "data.message.create",
  "data.message.delete",
  "data.comment.create",
  "data.comment.delete",
  "compliance.export.user",
  "compliance.erase.user",
  "ratelimit.exceeded",
  "appcheck.failure",
  "rules.deployed",
]);

export type AuditEventType = z.infer<typeof auditEventType>;

export const auditEventInput = z.object({
  type: auditEventType,
  severity: z.enum(["info", "warning", "alert"]).optional(),
  target: z.object({
    type: z.string().min(1).max(64),
    id: z.string().min(1).max(128),
    orgId: z.string().nullable().optional(),
    snapshot: z.record(z.string(), z.unknown()).optional(),
  }),
  clientReqId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type AuditEventInput = z.infer<typeof auditEventInput>;
