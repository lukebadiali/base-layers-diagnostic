// Phase 7 Wave 2 (FN-01 / AUDIT-04): Auth-event mirror writer for user
// deletions. Defence-in-depth twin of the auditWrite callable for the
// `data.user.delete` event family. 60-second primary-event dedup window.
//
// IMPLEMENTATION NOTE: as of firebase-functions 7.2.5 (verified 2026-05-09),
// the v2 `firebase-functions/v2/identity` module exports only the four
// blocking handlers (`beforeUserCreated`, `beforeUserSignedIn`,
// `beforeEmailSent`, `beforeSmsSent`). There is NO v2 `onUserDeleted`
// equivalent yet — Google has not migrated the auth-user-deleted event to
// 2nd-gen. The 1st-gen API (`firebase-functions/v1/auth.user().onDelete()`)
// remains the canonical way to subscribe to user-deletion events. This file
// uses v1; everything else in functions/ (cspReportSink, beforeUserCreated,
// beforeUserSignedIn, setClaims, auditWrite, onOrgDelete, onDocumentDelete)
// stays on v2. Mixing generations in a single index.ts is officially
// supported (Firebase v2 migration guide § "Coexistence with 1st gen").
//
// Plan deviation (Rule 1 / Rule 3): the 07-02-PLAN.md and 07-RESEARCH.md
// references to `onUserDeleted` from v2/identity are aspirational —
// upstream API doesn't exist yet. v1 fallback chosen over deferring the
// mirror so AUDIT-04 stays fully covered in Wave 2.
//
// Runs as audit-mirror-sa (FN-04 / Wave 1 SA inventory) with
// roles/datastore.user + roles/eventarc.eventReceiver. The 1st-gen
// runWith().auth.user().onDelete() shape carries serviceAccount /
// region in runWith(), then auth.user() then onDelete(handler).

import { randomUUID } from "node:crypto";
import * as functionsV1 from "firebase-functions/v1";
import { logger } from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { writeAuditEvent } from "../auditLogger.js";

if (!getApps().length) initializeApp();

// Phase 7 Wave 6 (TEST-09 / Rule 1 auto-fix): firebase-functions v1 runtime
// validation requires `serviceAccount` to be `'default'`, an Expression, or a
// string containing '@' (assertRuntimeOptionsValid in
// node_modules/firebase-functions/lib/esm/v1/function-builder.mjs:38).
// The `'{name}@'` shorthand expands to
// `{name}@<projectId>.iam.gserviceaccount.com` at deploy time. v2 (used by
// onOrgDelete + onDocumentDelete) accepts the bare name; v1 is stricter. The
// bare-name form shipped in Wave 2 throws at module-load time under
// firebase-functions-test wrap(), so Wave 6 hardens to the v1-compliant form.
export const onUserDelete = functionsV1
  .runWith({
    serviceAccount: "audit-mirror-sa@",
  })
  .region("europe-west2")
  .auth.user()
  .onDelete(async (user) => {
    const uid = user.uid;
    if (!uid) {
      logger.warn("audit.mirror.user.skipped", { reason: "missing-uid" });
      return;
    }
    const email = user.email ?? null;

    // 60s primary-event dedup query (Pattern 4b + Pitfall 7).
    const recent = await getFirestore()
      .collection("auditLog")
      .where("type", "==", "data.user.delete")
      .where("target.id", "==", uid)
      .where("at", ">", new Date(Date.now() - 60_000))
      .limit(1)
      .get();
    if (!recent.empty) {
      logger.info("audit.mirror.skipped", {
        uid,
        reason: "primary-exists",
      });
      return;
    }

    const eventId = randomUUID();
    await writeAuditEvent(
      {
        type: "data.user.delete.mirror",
        severity: "warning",
        target: {
          type: "user",
          id: uid,
          snapshot: email !== null ? { email } : undefined,
        },
        clientReqId: eventId,
        payload: {
          source: "trigger",
          reason: "no-primary-audit-found",
        },
      },
      {
        now: Date.now(),
        eventId,
        actor: {
          uid: "system",
          email: null,
          role: "system",
          orgId: null,
        },
        ip: null,
        userAgent: null,
        idempotencyKey: `mirror:user:${uid}:${eventId}`,
      },
    );
    logger.warn("audit.mirror.fired", { uid, type: "user" });
  });
