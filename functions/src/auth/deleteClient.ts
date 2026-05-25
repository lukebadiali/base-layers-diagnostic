// Phase 06.1 post-merge fix: deleteClient — admin-only HTTPS callable that
// removes a client user atomically. The Firestore rule on /users/{uid} denies
// all client-side mutations (server-only mutation invariant per Phase 6 D-09),
// and even if it didn't, deleting only the mirror doc would leave the
// Firebase Auth user as an orphan that can still sign in. This callable does
// both: getAuth().deleteUser(uid) + getFirestore().doc(`users/${uid}`).delete().
//
// Pattern A skeleton mirrors inviteClient.ts (Phase 06.1 Wave 2):
//   - enforceAppCheck: true                       (FN-07)
//   - serviceAccount: "claims-admin-sa@..."       (FN-04 + Phase 06.1 D-15;
//                                                  same SA as inviteClient — claims-admin-sa
//                                                  already has firebaseauth.admin +
//                                                  datastore.user roles granted)
//   - secrets: [SENTRY_DSN]                       (FN-05)
//   - withSentry handler wrapper                  (FN-03)
//   - validateInput(DeleteClientSchema, request.data) (FN-03)
//   - ensureIdempotent(...) before deleteUser     (FN-03 / 5-min window)
//   - Role gate widened: admin OR internal        (matches inviteClient gate)
//   - writeAuditEvent before + after (auth.client.delete + .failed)
//
// Refusal cases:
//   - target user has role:"admin" or "internal" → 403 (prevent admin lock-out;
//     mirrors CR-01 spirit — privileged users not touchable via client-flow callables)
//   - target uid does not exist → 404 with auth/user-not-found typed code
//
// Threat surface:
//   - Pitfall 17: actor uid from VERIFIED ID token only
//   - T-06.1-XX (new): bulk-delete spray — rate-limit at idempotency layer
//     (keyed on caller uid + target uid + clientReqId, 5-min window)

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

const DeleteClientSchema = z.object({
  uid: z.string().min(1).max(128),
  clientReqId: z.string().uuid(),
});

export const deleteClient = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,
    secrets: [SENTRY_DSN],
    serviceAccount: "claims-admin-sa@bedeveloped-base-layers.iam.gserviceaccount.com",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withSentry(async (request: CallableRequest<unknown>) => {
    // Pitfall 17: re-read role from VERIFIED ID token.
    const callerRole = request.auth?.token?.role;
    if (callerRole !== "admin" && callerRole !== "internal") {
      throw new HttpsError("permission-denied", "admin or internal role required");
    }
    if (!request.auth) throw new HttpsError("unauthenticated", "auth required");

    const data = validateInput(DeleteClientSchema, request.data ?? {});

    await ensureIdempotent(
      `${request.auth.uid}:deleteClient:${data.uid}:${data.clientReqId}`,
      "deleteClient",
      5 * 60,
    );

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
          {
            ...baseActorOverlay,
            now: Date.now(),
            eventId: randomUUID(),
          },
        );
      } catch (auditErr) {
        logger.warn("audit.emit.failed", {
          type,
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      }
    }

    // Look up target user to (a) confirm existence and (b) refuse if privileged.
    type AdminUserRecord = {
      uid: string;
      customClaims?: Record<string, unknown>;
    };
    let targetRecord: AdminUserRecord | null = null;
    try {
      targetRecord = (await getAuth().getUser(data.uid)) as AdminUserRecord;
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/user-not-found") {
        await emitAudit("auth.client.delete.failed", {
          reason: "user-not-found",
          targetUid: data.uid,
        });
        throw new HttpsError("not-found", "User not found", {
          code: "auth/user-not-found",
        });
      }
      throw new HttpsError("internal", `Auth lookup failed: ${code}`);
    }

    const targetClaims = (targetRecord?.customClaims ?? {}) as Record<string, unknown>;
    const targetRole =
      typeof targetClaims.role === "string" ? (targetClaims.role as string) : null;
    if (targetRole === "admin" || targetRole === "internal") {
      await emitAudit("auth.client.delete.failed", {
        reason: "privileged-user",
        targetUid: data.uid,
        targetRole,
      });
      throw new HttpsError(
        "permission-denied",
        "Cannot delete a privileged user (admin/internal) via deleteClient",
        { code: "auth/cannot-delete-privileged-user" },
      );
    }

    // Atomic-ish two-step: Auth user first (the harder-to-reverse mutation),
    // then mirror doc. Audit emit on success.
    await getAuth().deleteUser(data.uid);
    await getFirestore().doc(`users/${data.uid}`).delete();

    await emitAudit("auth.client.delete", {
      targetUid: data.uid,
      targetRole: targetRole ?? null,
    });

    logger.info("deleteClient.success", {
      targetUid: data.uid,
      byUid: request.auth.uid,
    });

    return { uid: data.uid, deleted: true };
  }),
);
