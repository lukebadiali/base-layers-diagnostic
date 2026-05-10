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
  // Phase 7 Wave 2 (FN-01 / AUDIT-04): mirror enum values written by the
  // Firestore-trigger defence-in-depth writers (onOrgDelete / onUserDelete /
  // onDocumentDelete). The mirror writers are the canonical producer; a
  // client COULD submit one via auditWrite, but actor.{uid,email,role,orgId}
  // is overwritten from request.auth.token (Pitfall 17), so a forged
  // "system" actor on a mirror event is structurally impossible. The enum
  // widening is therefore safe.
  "data.org.delete.mirror",
  "data.user.delete.mirror",
  "data.document.delete.mirror",
  // Phase 9 Wave 3 (AUDIT-05 / OBS-05): server-side bare flavours emitted by
  // the corresponding callables (lifecycle/* and setClaims) and by the
  // beforeUserSignedIn rejection branch (substrate; dormant until rejection
  // rules exist — see 09-03a-PLAN.md mfa_rationale + interfaces). Wave 4
  // anomaly rules read from THESE literals (`auth.signin.failure` already
  // existed; the data-domain bare flavours are NEW). 5 types × 3 ops = 15.
  "data.action.softDelete",
  "data.action.restore",
  "data.action.permanentlyDelete",
  "data.comment.softDelete",
  "data.comment.restore",
  "data.comment.permanentlyDelete",
  "data.document.softDelete",
  "data.document.restore",
  "data.document.permanentlyDelete",
  "data.message.softDelete",
  "data.message.restore",
  "data.message.permanentlyDelete",
  "data.funnelComment.softDelete",
  "data.funnelComment.restore",
  "data.funnelComment.permanentlyDelete",
  // Phase 9 Wave 3 (AUDIT-05): client-side .requested companion flavours.
  // Server emits the bare flavour (above + Phase 7 baseline auth.* / iam.* /
  // compliance.*); client emits the .requested suffix from the call-site
  // wrapper so the pair is observable for latency analysis (gap between
  // client request + server execution). Pitfall 17: actor.uid/email/role/
  // orgId is server-overlaid on auditWrite from request.auth.token —
  // payload never carries identity. 1 iam + 2 compliance + 15 data = 18.
  "iam.claims.set.requested",
  "compliance.export.user.requested",
  "compliance.erase.user.requested",
  "data.action.softDelete.requested",
  "data.action.restore.requested",
  "data.action.permanentlyDelete.requested",
  "data.comment.softDelete.requested",
  "data.comment.restore.requested",
  "data.comment.permanentlyDelete.requested",
  "data.document.softDelete.requested",
  "data.document.restore.requested",
  "data.document.permanentlyDelete.requested",
  "data.message.softDelete.requested",
  "data.message.restore.requested",
  "data.message.permanentlyDelete.requested",
  "data.funnelComment.softDelete.requested",
  "data.funnelComment.restore.requested",
  "data.funnelComment.permanentlyDelete.requested",
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
