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
//   3. An email that already has an account is classified, not blanket-refused
//      (2026-10). A live healthy account is still refused — promoting an
//      existing user is a separate, deliberate action. But an account that is
//      disabled, GDPR-erased, or missing its /users profile is REVIVABLE in
//      place via reclaim:true, because the old behaviour left those states as
//      a dead end: unable to sign in and unable to be re-created. See
//      account-state.ts for the state taxonomy. Reclaim keeps the original
//      uid, so authored content and audit history stay attached.
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
import { classifyExistingAccount } from "./account-state.js";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");

const InviteInternalSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(128),
  role: z.enum(["admin", "internal"]),
  // 2026-10: explicit opt-in to revive an existing-but-unusable account in
  // place (disabled / GDPR-erased / profile-orphaned). Absent or false, a
  // pre-existing email is still refused — the admin gets the diagnosis in
  // err.details and decides. Reviving an erasure is never implicit.
  reclaim: z.boolean().optional(),
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

    async function emitAudit(
      targetId: string,
      payload: Record<string, unknown> = { newRole: data.role, email: data.email },
    ): Promise<void> {
      try {
        await writeAuditEvent(
          {
            type: "auth.internal.invite",
            target: { type: "user", id: targetId, orgId: null },
            clientReqId: data.clientReqId,
            // NO temp password in payload (Pitfall 17).
            payload,
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
    type ExistingRecord = {
      uid: string;
      disabled?: boolean;
      customClaims?: Record<string, unknown> | null;
    };
    let existing: ExistingRecord | null = null;
    try {
      existing = (await getAuth().getUserByEmail(data.email)) as ExistingRecord;
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code !== "auth/user-not-found") {
        throw new HttpsError("internal", `Auth lookup failed: ${code}`);
      }
    }
    // 2026-10: an existing Auth record is no longer a dead end. Read the
    // surrounding state (profile mirror + GDPR redaction row), classify it,
    // and either refuse with a diagnosis the UI can act on, or — when the
    // admin has explicitly passed reclaim:true — revive the account in place.
    if (existing) {
      const [usersSnap, redactionSnap] = await Promise.all([
        getFirestore().doc(`users/${existing.uid}`).get(),
        getFirestore().doc(`redactionList/${existing.uid}`).get(),
      ]);
      const diagnosis = classifyExistingAccount({
        auth: {
          uid: existing.uid,
          disabled: existing.disabled,
          customClaims: existing.customClaims ?? null,
        },
        usersDoc: usersSnap.exists
          ? (usersSnap.data() as Record<string, unknown>)
          : null,
        hasRedactionRow: redactionSnap.exists,
      });

      if (!diagnosis.reclaimable || data.reclaim !== true) {
        throw new HttpsError("already-exists", diagnosis.summary, {
          code: "auth/email-already-exists",
          state: diagnosis.state,
          reclaimable: diagnosis.reclaimable,
          uid: diagnosis.reclaimable ? existing.uid : undefined,
          currentRole: diagnosis.currentRole,
        });
      }

      // ── Reclaim in place ────────────────────────────────────────────────
      // Same uid, so everything already keyed to it (authored messages and
      // comments, uploads, audit rows) stays attached. A fresh account would
      // orphan all of it.
      const reclaimPassword = generateTempPassword();
      await getAuth().updateUser(existing.uid, {
        disabled: false,
        password: reclaimPassword,
        emailVerified: true,
        displayName: data.name,
        // The authenticator that paired with this account is assumed lost
        // along with the access. firstRun re-enrols TOTP from scratch, and
        // mfaEnrolmentRequiredForRole makes that mandatory, not optional.
        multiFactor: { enrolledFactors: [] },
      });
      await getAuth().setCustomUserClaims(
        existing.uid,
        buildInternalInviteClaims(data.role),
      );
      // Full overwrite (not merge) so an erasure tombstone — erasedAt /
      // erasedTo / nulled email+name — cannot survive into the live profile.
      await getFirestore().doc(`users/${existing.uid}`).set({
        id: existing.uid,
        email: data.email,
        name: data.name,
        role: data.role,
        orgId: null,
        createdAt: new Date().toISOString(),
      });
      // Load-bearing: redactionList is replayed over restored backups to
      // re-apply tombstones (gdprEraseUser.ts:279). Leaving the row in place
      // would silently re-erase this account after the next restore drill.
      if (redactionSnap.exists) {
        await getFirestore().doc(`redactionList/${existing.uid}`).delete();
      }
      await emitAudit(existing.uid, {
        newRole: data.role,
        email: data.email,
        reclaimed: true,
        reclaimedFrom: diagnosis.state,
        redactionRowCleared: redactionSnap.exists,
      });

      logger.info("inviteInternal.reclaimed", {
        role: data.role,
        state: diagnosis.state,
        targetUid: existing.uid,
        byUid: request.auth.uid,
      });

      return { uid: existing.uid, tempPassword: reclaimPassword, existed: true };
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
