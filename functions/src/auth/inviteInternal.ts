// 2026-06: admin-only HTTPS callable that creates an internal/admin (staff)
// account from the admin panel. Mirrors inviteClient.ts wiring (Pattern A:
// Zod + idempotency + Sentry + per-function SA + best-effort audit), with
// three deltas:
//   1. Role gate is admin-ONLY (inviteClient admits internal too). Only admins
//      may mint staff.
//   2. No org passphrase — staff are not org-scoped (orgId: null). The first
//      credential is a server-generated strong temp password returned to the
//      admin to relay; the member is forced (firstRun) to set their own + enrol
//      MFA on first sign-in.
//   3. An email that already has an account is REFUSED (no resend / takeover
//      branch) — promoting an existing user is a separate, deliberate action.
//
// Pitfall 17: actor + caller role sourced from the VERIFIED ID token only.
// The temp password is NEVER written to the audit payload or logs.

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
import { buildInternalInviteClaims } from "./internal-invite-builder.js";
import { generateTempPassword } from "../util/password.js";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");

const InviteInternalSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(128),
  role: z.enum(["admin", "internal"]),
  clientReqId: z.string().uuid(),
});

export const inviteInternal = onCall(
  {
    region: "europe-west2",
    // enforceAppCheck dropped for symmetry with inviteClient / deleteClient
    // (incognito UAT loop). Primary gate (admin role re-read from verified ID
    // token) preserved.
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
    const data = validateInput(InviteInternalSchema, request.data ?? {});

    await ensureIdempotent(
      `${request.auth.uid}:inviteInternal:${data.email}:${data.clientReqId}`,
      "inviteInternal",
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

    async function emitAudit(targetId: string): Promise<void> {
      try {
        await writeAuditEvent(
          {
            type: "auth.internal.invite",
            target: { type: "user", id: targetId, orgId: null },
            clientReqId: data.clientReqId,
            // NO temp password in payload (Pitfall 17).
            payload: { newRole: data.role, email: data.email },
          },
          { ...baseActorOverlay, now: Date.now(), eventId: randomUUID() },
        );
      } catch (auditErr) {
        logger.warn("audit.emit.failed", {
          type: "auth.internal.invite",
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      }
    }

    // Refuse if the email already has an account. Only auth/user-not-found is
    // the "email is free" signal; any other error is surfaced (RESEARCH § 3 —
    // never mask network/permission failures as the create path).
    let existing: { uid: string } | null = null;
    try {
      existing = (await getAuth().getUserByEmail(data.email)) as { uid: string };
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code !== "auth/user-not-found") {
        throw new HttpsError("internal", `Auth lookup failed: ${code}`);
      }
    }
    if (existing) {
      throw new HttpsError(
        "already-exists",
        "An account with this email already exists",
        { code: "auth/email-already-exists" },
      );
    }

    const tempPassword = generateTempPassword();
    const userRecord = await getAuth().createUser({
      email: data.email,
      password: tempPassword,
      emailVerified: true,
      displayName: data.name,
    });
    await getAuth().setCustomUserClaims(
      userRecord.uid,
      buildInternalInviteClaims(data.role),
    );
    // Mirror /users/{uid} so the admin "Internal team" table (hydrated by
    // subscribeUsers over /users) shows the new member. Shape matches
    // inviteClient.ts + cloudPushUser — {id, email, name, role, orgId, createdAt}.
    await getFirestore().doc(`users/${userRecord.uid}`).set({
      id: userRecord.uid,
      email: data.email,
      name: data.name,
      role: data.role,
      orgId: null,
      createdAt: new Date().toISOString(),
    });
    await emitAudit(userRecord.uid);

    logger.info("inviteInternal.success", {
      role: data.role,
      byUid: request.auth.uid,
    });

    // tempPassword is returned to the admin (over HTTPS, to their authenticated
    // session) to relay out-of-band. It is single-use: firstRun forces the
    // member to replace it on first sign-in.
    return { uid: userRecord.uid, tempPassword, existed: false };
  }),
);
