// 2026-06: admin-only HTTPS callable that removes an internal/admin (staff)
// account atomically (Firebase Auth user + /users mirror doc). The inverse of
// deleteClient, which deliberately REFUSES admin/internal targets — so staff
// removal needs its own gated path.
//
// Guards:
//   - admin-ONLY caller (re-read from verified ID token; Pitfall 17).
//   - self-delete refused. This single guard is sufficient to prevent total
//     admin lock-out: an admin can only delete OTHER users, so the last admin
//     standing can never remove the final admin (themselves).
//   - target MUST be admin/internal. A client target is refused (use
//     deleteClient) so the two callables stay non-overlapping and each guarded.
//   - target must exist (404 otherwise).
//
// Failures emit auth.internal.delete.failed with a payload.reason discriminator
// ("self-delete" | "not-privileged" | "user-not-found"); success emits
// auth.internal.delete. Best-effort audit (Pattern 5 #2 — never block the
// mutation on an audit-emit failure).

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";
import { ensureIdempotent } from "../util/idempotency.js";
import { writeAuditEvent } from "../audit/auditLogger.js";
import type { AuditEventInput } from "../audit/auditEventSchema.js";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");

const DeleteInternalSchema = z.object({
  uid: z.string().min(1).max(128),
  clientReqId: z.string().uuid(),
});

export const deleteInternal = onCall(
  {
    region: "europe-west2",
    secrets: [SENTRY_DSN],
    serviceAccount: "claims-admin-sa@bedeveloped-base-layers.iam.gserviceaccount.com",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withSentry(async (request: CallableRequest<unknown>) => {
    // Pitfall 17: re-read role from the VERIFIED ID token. Admin-ONLY.
    if (request.auth?.token?.role !== "admin") {
      throw new HttpsError("permission-denied", "admin role required");
    }
    const data = validateInput(DeleteInternalSchema, request.data ?? {});

    const token = (request.auth.token ?? {}) as Record<string, unknown>;
    const baseActorOverlay = {
      ip: null,
      userAgent: null,
      actor: {
        uid: request.auth.uid,
        email: typeof token.email === "string" ? token.email : null,
        role:
          token.role === "admin" ||
          token.role === "internal" ||
          token.role === "client" ||
          token.role === "system"
            ? (token.role as "admin" | "internal" | "client" | "system")
            : null,
        orgId: typeof token.orgId === "string" ? token.orgId : null,
      },
    };

    async function emitAudit(
      type: AuditEventInput["type"],
      payload: Record<string, unknown>,
    ): Promise<void> {
      try {
        await writeAuditEvent(
          {
            type,
            target: { type: "user", id: data.uid, orgId: null },
            clientReqId: data.clientReqId,
            payload,
          },
          { ...baseActorOverlay, now: Date.now(), eventId: randomUUID() },
        );
      } catch (auditErr) {
        logger.warn("audit.emit.failed", {
          type,
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      }
    }

    // Self-delete guard FIRST (before idempotency / lookup) — prevents the
    // last admin from locking everyone out.
    if (data.uid === request.auth.uid) {
      await emitAudit("auth.internal.delete.failed", {
        reason: "self-delete",
        targetUid: data.uid,
      });
      throw new HttpsError("failed-precondition", "You cannot delete your own account", {
        code: "auth/cannot-delete-self",
      });
    }

    await ensureIdempotent(
      `${request.auth.uid}:deleteInternal:${data.uid}:${data.clientReqId}`,
      "deleteInternal",
      5 * 60,
    );

    // Look up target to (a) confirm existence and (b) confirm it's privileged.
    type AdminUserRecord = { uid: string; customClaims?: Record<string, unknown> };
    // Definitely assigned below: the try assigns it and both catch paths throw.
    let targetRecord: AdminUserRecord;
    try {
      targetRecord = (await getAuth().getUser(data.uid)) as AdminUserRecord;
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/user-not-found") {
        await emitAudit("auth.internal.delete.failed", {
          reason: "user-not-found",
          targetUid: data.uid,
        });
        throw new HttpsError("not-found", "User not found", {
          code: "auth/user-not-found",
        });
      }
      throw new HttpsError("internal", `Auth lookup failed: ${code}`);
    }

    const targetClaims = (targetRecord.customClaims ?? {}) as Record<string, unknown>;
    const targetRole =
      typeof targetClaims.role === "string" ? (targetClaims.role as string) : null;
    if (targetRole !== "admin" && targetRole !== "internal") {
      await emitAudit("auth.internal.delete.failed", {
        reason: "not-privileged",
        targetUid: data.uid,
        targetRole,
      });
      throw new HttpsError(
        "failed-precondition",
        "deleteInternal removes only internal/admin users — use deleteClient for clients",
        { code: "auth/not-an-internal-user" },
      );
    }

    // Auth user first (harder-to-reverse), then mirror doc.
    await getAuth().deleteUser(data.uid);
    await getFirestore().doc(`users/${data.uid}`).delete();

    await emitAudit("auth.internal.delete", { targetUid: data.uid, targetRole });

    logger.info("deleteInternal.success", {
      targetUid: data.uid,
      byUid: request.auth.uid,
    });

    return { uid: data.uid, deleted: true };
  }),
);
