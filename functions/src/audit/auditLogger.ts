// Phase 7 Wave 1 (AUDIT-02 / FN-01): two-layer audit-log helper.
//
//   PURE LAYER  — buildAuditEventDoc(input, serverContext) — no Admin SDK
//                 imports. Computes the canonical Firestore doc shape from
//                 the validated input + server-controlled context. This is
//                 the unit-test seam (Pattern C purity contract).
//
//   ADMIN-SDK LAYER — writeAuditEvent(input, serverContext) — calls
//                 firestore.doc(`auditLog/${eventId}`).set(buildAuditEventDoc(...)).
//                 Wave 6 TEST-09 covers via firebase-functions-test@3.5.0.
//
// Both layers consumed by Wave 2:
//   - auditWrite callable          (callable, primary writer)
//   - onOrgDelete / onUserDelete /
//     onDocumentDelete triggers     (server-side defence-in-depth mirrors)
//
// ARCHITECTURE.md section 5 audit-log document schema is the canonical shape;
// schemaVersion: 1 is mandatory. Pitfall 17: actor + at + ip + userAgent +
// idempotencyKey are server-controlled, never trusted from payload.

import type { AuditEventInput } from "./auditEventSchema.js";

/**
 * Stored auditLog/{eventId} document shape.
 * `at` is `unknown` because the server may inject either FieldValue.serverTimestamp()
 * (Admin SDK path) or a Date / number (test seam). Both serialise correctly to
 * a Firestore Timestamp at write time.
 */
export interface AuditLogDoc {
  eventId: string;
  type: AuditEventInput["type"];
  severity: "info" | "warning" | "alert";
  actor: AuditActor;
  target: AuditEventInput["target"];
  at: unknown;
  ip: string | null;
  userAgent: string | null;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  schemaVersion: 1;
}

export interface AuditActor {
  uid: string | null;
  email: string | null;
  role: "admin" | "internal" | "client" | "system" | null;
  orgId: string | null;
}

export interface ServerContext {
  /** Wall-clock millis at handler invocation (FieldValue.serverTimestamp() in Admin SDK path). */
  now: number;
  /** Event UUID — server-generated; never from payload (Pitfall 17). */
  eventId: string;
  /** Caller IP from Function context, or null when unavailable. */
  ip: string | null;
  /** Caller User-Agent from Function context, or null when unavailable. */
  userAgent: string | null;
  /** Server-resolved actor identity (re-read from request.auth.token, never from payload). */
  actor: AuditActor;
  /** Override `at` field (e.g. FieldValue.serverTimestamp()) — defaults to ISO string of `now`. */
  at?: unknown;
  /** Pre-computed idempotency key (typically `${actor.uid}:${type}:${target.id}:${clientReqId}`). */
  idempotencyKey?: string;
}

/**
 * Pure transform: build the canonical auditLog doc from the validated input +
 * server context. Never imports firebase-admin/* — safe for unit tests.
 */
export function buildAuditEventDoc(
  input: AuditEventInput,
  ctx: ServerContext,
): AuditLogDoc {
  const at = ctx.at !== undefined ? ctx.at : new Date(ctx.now).toISOString();
  const idempotencyKey =
    ctx.idempotencyKey ??
    `${ctx.actor.uid ?? "system"}:${input.type}:${input.target.id}:${input.clientReqId}`;

  return {
    eventId: ctx.eventId,
    type: input.type,
    severity: input.severity ?? "info",
    actor: ctx.actor,
    target: input.target,
    at,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    payload: input.payload ?? {},
    idempotencyKey,
    schemaVersion: 1,
  };
}

/**
 * Admin-SDK side: persist the audit event to auditLog/{eventId}. Imports
 * firebase-admin/firestore lazily so the pure helper above stays unit-test
 * safe even when callers transitively import this module.
 *
 * Idempotent at the doc level — eventId collisions overwrite (which never
 * happens because eventId is a fresh UUID per call). Idempotency at the
 * REPLAY level is handled separately by util/idempotency.ts.
 */
export async function writeAuditEvent(
  input: AuditEventInput,
  ctx: ServerContext,
): Promise<AuditLogDoc> {
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  // Substitute in Admin-SDK serverTimestamp for the `at` field unless caller
  // explicitly supplied one (test seam).
  const ctxWithAt: ServerContext =
    ctx.at !== undefined ? ctx : { ...ctx, at: FieldValue.serverTimestamp() };
  const doc = buildAuditEventDoc(input, ctxWithAt);
  await getFirestore().doc(`auditLog/${doc.eventId}`).set(doc);
  return doc;
}
