// Phase 06.1 (AUTH-16 / D-12 / D-15) + Phase 7 substrate (FN-03 / FN-04 /
// FN-05 / FN-07): admin-only HTTPS callable that invites a client user into
// an org via Firebase Auth. Server-side authority — re-reads admin role from
// the verified ID token (Pitfall 17). Wave 1 shipped the skeleton; Wave 2
// (this file) replaces the unimplemented throw with the real body:
//   - read orgs/{orgId} + check clientPassphraseHash
//   - verify orgPassphrase against stored hash (server-side hashString parity)
//   - auth.getUserByEmail (catch only auth/user-not-found per RESEARCH § 3)
//   - decideInviteOutcome → branch (create / resend / cross-org-refuse)
//   - createUser / updateUser + setCustomUserClaims + writeAuditEvent
//   - return { uid, existed, hasFirstRun? }
//
// Pattern A template inherited from functions/src/auth/setClaims.ts. Critical
// delta: serviceAccount: "claims-admin-sa" EXPLICITLY (CONTEXT D-15 + Phase 7
// FN-04 — reuse the existing SA, do not provision a new one per RESEARCH §
// Alternatives Considered). The setClaims callable currently uses the default
// Functions runtime SA — Phase 06.1 pins the explicit SA here because the
// inviteClient body does broader Auth-Admin work (createUser / updateUser,
// not just setCustomUserClaims).
//
// Audit-emit shape: actor sourced from the VERIFIED ID token (Pitfall 17).
// Each writeAuditEvent wrapped in try/catch + logger.warn so an audit-emit
// failure NEVER blocks the underlying mutation (Pattern 5 #2 best-effort).
// All 4 enum entries land here:
//   - auth.client.invite                         (happy create)
//   - auth.client.invite.resend                  (happy resend w/ confirmReset)
//   - auth.client.invite.rejected.cross-org      (failure: cross-org refusal)
//   - auth.client.invite.rejected.passphrase-invalid (failure: not-set | mismatch)

import {
  onCall,
  HttpsError,
  type CallableRequest,
} from "firebase-functions/v2/https";
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
import { hashString } from "../util/hash.js";
import { decideInviteOutcome, buildInviteClaims } from "./invite-builder.js";
import type { AuditEventInput } from "../audit/auditEventSchema.js";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");

const InviteClientSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(128),
  orgId: z.string().min(1),
  orgPassphrase: z.string().min(1), // length enforced upstream at setOrgClientPassphrase
  confirmReset: z.boolean().optional(),
  clientReqId: z.string().uuid(),
});

export const inviteClient = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,
    secrets: [SENTRY_DSN],
    serviceAccount: "claims-admin-sa@bedeveloped-base-layers.iam.gserviceaccount.com", // FN-04 — reuse per CONTEXT D-15. Full email form required: firebase-tools short-name "claims-admin-sa" gets passed through to Secret Manager setIamPolicy which rejects non-email SA refs with 400 Invalid service account.
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withSentry(async (request: CallableRequest<unknown>) => {
    // Pitfall 17: re-read role from the VERIFIED ID token, NEVER from payload.
    // Widened vs setClaims to admit "internal" callers — internal staff may
    // invite clients into orgs they're working on; client-role users may not.
    if (
      request.auth?.token?.role !== "admin" &&
      request.auth?.token?.role !== "internal"
    ) {
      throw new HttpsError(
        "permission-denied",
        "admin or internal role required",
      );
    }
    const data = validateInput(InviteClientSchema, request.data ?? {});

    // Idempotency-marker BEFORE side effect (FN-03 / 5-min window).
    // Keyed on (caller uid, email, clientReqId) per RESEARCH § 3 — same-
    // email replay within 5 min from the same admin with the same
    // clientReqId is a no-op; concurrent invites for the same email from
    // different clientReqIds fall through to the auth.getUserByEmail
    // lookup (existed-flag branch handles dedup).
    await ensureIdempotent(
      `${request.auth.uid}:inviteClient:${data.email}:${data.clientReqId}`,
      "inviteClient",
      5 * 60,
    );

    // Build the actor overlay once — Pitfall 17: actor sourced from VERIFIED
    // ID token only. Shape mirrors setClaims.ts:99-114 verbatim (same
    // role-narrowing ternary + null-coalescing for missing fields).
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

    // Pattern 5 #2 best-effort wrapper — log + swallow on emit failure so audit
    // emission NEVER blocks the underlying mutation.
    async function emitAudit(
      type: AuditEventInput["type"],
      payload: Record<string, unknown>,
      targetType: "user" | "org",
      targetId: string,
    ): Promise<void> {
      try {
        await writeAuditEvent(
          {
            type,
            target: { type: targetType, id: targetId, orgId: data.orgId },
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
          error:
            auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      }
    }

    // ─── Step 1: read orgs/{orgId} + check clientPassphraseHash ──────────────
    const orgSnap = await getFirestore().doc(`orgs/${data.orgId}`).get();
    const storedHash: string | null = (orgSnap.exists
      ? ((orgSnap.data()?.clientPassphraseHash as string | undefined) ?? null)
      : null) as string | null;

    if (!storedHash) {
      await emitAudit(
        "auth.client.invite.rejected.passphrase-invalid",
        { reason: "passphrase-not-set", email: data.email },
        "org",
        data.orgId,
      );
      throw new HttpsError(
        "failed-precondition",
        "Set the company passphrase first",
        { code: "auth/passphrase-not-set" },
      );
    }

    // ─── Step 2: verify passphrase ────────────────────────────────────────────
    const candidateHash = await hashString(data.orgPassphrase);
    if (candidateHash !== storedHash) {
      await emitAudit(
        "auth.client.invite.rejected.passphrase-invalid",
        { reason: "passphrase-mismatch", email: data.email },
        "org",
        data.orgId,
      );
      throw new HttpsError(
        "failed-precondition",
        "Passphrase incorrect",
        { code: "auth/passphrase-invalid" },
      );
    }

    // ─── Step 3: look up existing user (catch only auth/user-not-found) ──────
    // RESEARCH § 3 critical pin: do NOT catch arbitrary errors — they mask
    // real network / permission failures and could falsely route to the
    // create branch.
    type AdminUserRecord = {
      uid: string;
      customClaims?: Record<string, unknown>;
    };
    let existingUser: AdminUserRecord | null = null;
    try {
      existingUser = (await getAuth().getUserByEmail(
        data.email,
      )) as AdminUserRecord;
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code !== "auth/user-not-found") {
        throw new HttpsError("internal", `Auth lookup failed: ${code}`);
      }
    }

    // ─── Step 4: decide outcome via pure-logic helper ─────────────────────────
    const existingClaims = (existingUser?.customClaims ?? {}) as Record<
      string,
      unknown
    >;
    const outcome = decideInviteOutcome({
      passphraseValid: true,
      passphraseSet: true,
      existingUser: existingUser
        ? {
            uid: existingUser.uid,
            orgId:
              typeof existingClaims.orgId === "string"
                ? (existingClaims.orgId as string)
                : null,
            role:
              typeof existingClaims.role === "string"
                ? (existingClaims.role as string)
                : null,
          }
        : null,
      requestedOrgId: data.orgId,
      confirmReset: data.confirmReset ?? false,
    });

    // ─── Step 5: branch on outcome ────────────────────────────────────────────
    if (outcome.kind === "create") {
      const userRecord = await getAuth().createUser({
        email: data.email,
        password: data.orgPassphrase,
        emailVerified: true,
        displayName: data.name,
      });
      await getAuth().setCustomUserClaims(
        userRecord.uid,
        buildInviteClaims(data.orgId),
      );
      await emitAudit(
        "auth.client.invite",
        { existed: false, newRole: "client", email: data.email },
        "user",
        userRecord.uid,
      );
      logger.info("inviteClient.success", {
        orgId: data.orgId,
        existed: false,
        byUid: request.auth.uid,
      });
      return { uid: userRecord.uid, existed: false };
    }

    if (outcome.kind === "cross-org-refuse") {
      await emitAudit(
        "auth.client.invite.rejected.cross-org",
        {
          reason: "cross-org",
          existingOrgId: outcome.existingOrgId,
          requestedOrgId: data.orgId,
          email: data.email,
        },
        "user",
        outcome.existingUid,
      );
      throw new HttpsError(
        "failed-precondition",
        `User already belongs to a different org (existing orgId=${outcome.existingOrgId}, requested=${data.orgId})`,
        { code: "auth/cross-org-invite-rejected" },
      );
    }

    // Phase 06.1 CR-01 fix: refuse role-takeover. An existing admin/internal
    // user MUST NOT be adopted into a client invite — the resend branch would
    // otherwise password-reset and demote them to role:"client". We reuse the
    // existing "auth.client.invite.rejected.cross-org" audit type with a
    // payload discriminator (reason: "privileged-user") rather than widening
    // the auditEventSchema enum, because the schema is constrained and a new
    // enum entry would churn payload validators in audit-log readers. The
    // reason discriminator makes the two refusal paths distinguishable in
    // queries while keeping the schema stable.
    if (outcome.kind === "existing-privileged-user") {
      await emitAudit(
        "auth.client.invite.rejected.cross-org",
        {
          reason: "privileged-user",
          existingRole: outcome.existingRole,
          requestedOrgId: data.orgId,
          email: data.email,
        },
        "user",
        outcome.existingUid,
      );
      throw new HttpsError(
        "failed-precondition",
        "Email belongs to an existing privileged user",
        { code: "auth/email-belongs-to-privileged-user" },
      );
    }

    // outcome.kind === "resend" — narrow explicitly. The passphrase-* outcomes
    // are statically unreachable here because Steps 1+2 throw before
    // decideInviteOutcome is called with passphraseSet/Valid:false, but TS
    // can't prove that without a runtime guard.
    if (outcome.kind !== "resend") {
      // Defensive: should never hit (the if/if branches above cover create +
      // cross-org-refuse; passphrase-* outcomes are pre-empted by Steps 1+2).
      throw new HttpsError(
        "internal",
        `Unexpected outcome kind: ${outcome.kind}`,
      );
    }

    if (!data.confirmReset) {
      const hasFirstRun = existingClaims.firstRun === true;
      logger.info("inviteClient.existed.noReset", {
        orgId: data.orgId,
        byUid: request.auth.uid,
      });
      return { uid: outcome.existingUid, existed: true, hasFirstRun };
    }

    await getAuth().updateUser(outcome.existingUid, {
      password: data.orgPassphrase,
    });
    // Phase 06.1 WR-02 contract: setCustomUserClaims OVERWRITES the entire
    // claim set (Admin SDK semantics — there is no merge mode). The resend
    // branch deliberately reverts the user to the canonical client claim
    // shape `{role:"client", orgId, firstRun:true}` returned by
    // buildInviteClaims. Any per-user claims added in future phases (e.g.
    // mfaEnrolled flags, feature-flag claims, email_verified-derived
    // sub-claims) MUST be re-applied AFTER the resend completes, OR this
    // call MUST be changed to read-merge-write against existingClaims —
    // see invite-builder.ts `existingClaims` shape pinned at the
    // decideInviteOutcome call site above. CR-01's privileged-user gate
    // already rules out admin/internal claim wipes; the regression hazard
    // here is forward-only (Phase 9+ claim additions).
    await getAuth().setCustomUserClaims(
      outcome.existingUid,
      buildInviteClaims(data.orgId),
    );
    await emitAudit(
      "auth.client.invite.resend",
      { existed: true, newRole: "client", email: data.email },
      "user",
      outcome.existingUid,
    );
    logger.info("inviteClient.success", {
      orgId: data.orgId,
      existed: true,
      byUid: request.auth.uid,
    });
    return { uid: outcome.existingUid, existed: true };
  }),
);
