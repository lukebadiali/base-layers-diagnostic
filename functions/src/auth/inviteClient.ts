// Phase 06.1 (AUTH-16 / D-12 / D-15) + Phase 7 substrate (FN-03 / FN-04 /
// FN-05 / FN-07): admin-only HTTPS callable that invites a client user into
// an org via Firebase Auth. Server-side authority — re-reads admin role from
// the verified ID token (Pitfall 17). Wave 1 ships the skeleton (onCall
// config + role gate + Zod schema + idempotency-marker write); Wave 2 fills
// the body (Admin SDK auth.getUserByEmail + createUser / updateUser branch +
// setCustomUserClaims + writeAuditEvent + return shape).
//
// Pattern A template inherited verbatim from functions/src/auth/setClaims.ts.
// Critical delta vs setClaims: this file declares `serviceAccount:
// "claims-admin-sa"` EXPLICITLY (CONTEXT D-15 + Phase 7 FN-04 — reuse the
// existing SA, do not provision a new one per RESEARCH § Alternatives
// Considered). The setClaims callable currently uses the default Functions
// runtime SA — Phase 06.1 introduces the explicit pin here because the
// inviteClient body (Wave 2) does broader Auth-Admin work
// (createUser/updateUser, not just setCustomUserClaims).
//
// Wave 1 SKELETON BEHAVIOUR (this file): the handler runs the role gate +
// Zod validation + idempotency-marker write, then throws
// HttpsError("unimplemented", ...). Any accidental client invocation during
// Wave 1 deployment therefore fails LOUDLY — no silent half-implementation.
// Wave 2 (06.1-02-PLAN.md Task 1) replaces the throw with the real body.

import {
  onCall,
  HttpsError,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { z } from "zod";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";
import { ensureIdempotent } from "../util/idempotency.js";

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
    serviceAccount: "claims-admin-sa", // FN-04 — reuse per CONTEXT D-15 + RESEARCH Alternatives Considered
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
    // lookup in Wave 2 (existed-flag branch handles dedup).
    await ensureIdempotent(
      `${request.auth.uid}:inviteClient:${data.email}:${data.clientReqId}`,
      "inviteClient",
      5 * 60,
    );

    // Wave 2 (06.1-02-PLAN.md Task 1) fills the body here:
    //   - read orgs/{orgId} doc + check clientPassphraseHash (passphrase-not-set branch)
    //   - verify orgPassphrase hash via server-side hashString parity helper
    //   - auth.getUserByEmail(email).catch(only auth/user-not-found)
    //   - call decideInviteOutcome(...) from invite-builder.js
    //   - branch on outcome (create / resend / cross-org-refuse / passphrase-* errors)
    //   - writeAuditEvent for the chosen outcome
    //   - return { uid, existed, hasFirstRun? }

    logger.info("inviteClient.skeleton", {
      email: data.email,
      orgId: data.orgId,
      byUid: request.auth.uid,
    });
    throw new HttpsError(
      "unimplemented",
      "inviteClient body lands in 06.1 Wave 2",
    );
  }),
);
