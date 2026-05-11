// Phase 9 Wave 5 (OBS-05 / FN-01): authAnomalyAlert — onDocumentCreated trigger
// over auditLog/{eventId}. Pattern-matches against four anomaly rules and
// dispatches a Slack message via SLACK_WEBHOOK_URL secret. Rolling-window
// auth-failure counter at authFailureCounters/{ipHash} for the >5/IP/5min rule
// (same shape as Phase 7 rateLimits/{uid}/buckets — Pattern 10 from RESEARCH.md).
//
// Runs as audit-alert-sa (Wave 6 SA inventory — Plan 09-05) with
// roles/datastore.user on authFailureCounters/* + roles/datastore.viewer on
// auditLog/*. Rules block all client read/write to authFailureCounters/*
// (Wave 5 firestore.rules edit — same plan, sibling task).
//
// Best-effort alerting: retryConfig: { retryCount: 1 } — do not retry-storm
// Slack on transient webhook failure. postToSlack helper logs warnings on
// non-200 responses but never throws so Eventarc does not reschedule.
//
// Rule disposition (per Plan 03a substrate landing):
// - Rule 1 (auth.signin.failure burst): trigger code is FUNCTIONAL but
//   currently DORMANT — beforeUserSignedIn substrate emits zero rows today
//   (no business rejection rules added yet). The moment any future plan adds
//   an explicit rejection ("block disabled accounts at sign-in", etc.) Rule 1
//   begins firing automatically with no schema or trigger-code change.
// - Rule 2 (auth.mfa.unenrol): DORMANT — bound to landing of enrollTotp /
//   unenrollAllMfa deps in src/main.js (currently `// deferred to user-testing
//   phase`). Per Plan 03a §mfa_rationale carry-forward.
// - Rule 3 (iam.claims.set role escalation): FUNCTIONAL — Plan 03a setClaims
//   server emission feeds real rows on every admin claim mutation.
// - Rule 4 (compliance.export.user unusual hour): FUNCTIONAL — Phase 8
//   gdprExportUser server emission feeds real rows.

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { withSentry } from "../util/sentry.js";

if (!getApps().length) initializeApp();

const SLACK_WEBHOOK_URL = defineSecret("SLACK_WEBHOOK_URL");
const SENTRY_DSN = defineSecret("SENTRY_DSN");

// Rolling-window thresholds (Pattern 10 from 09-RESEARCH.md).
const FAIL_WINDOW_MS = 5 * 60_000;
const FAIL_LIMIT = 5;
// "Unusual hour" = 22:00–05:00 UTC (research §A2 assumption).
const UNUSUAL_HOURS = new Set<number>([0, 1, 2, 3, 4, 5, 22, 23]);

/**
 * Test-only seam — exposes the SLACK_WEBHOOK_URL secret value getter so unit
 * tests can mock the secret value without touching firebase-functions/params.
 */
export const _internals = {
  slackWebhookUrl(): string {
    return SLACK_WEBHOOK_URL.value();
  },
};

/** Slack POST helper — best-effort; never throws (research §Pattern 6 lines 606-619). */
async function postToSlack(payload: { text: string }): Promise<void> {
  const url = _internals.slackWebhookUrl();
  if (!url) {
    logger.warn("slack.skip.no-webhook");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) logger.warn("slack.post.failed", { status: res.status });
  } catch (err) {
    logger.warn("slack.post.error", { name: (err as Error)?.name });
  }
}

/**
 * Test-only seam — pure handler that takes the audit doc data, the current
 * time, an injected postToSlack function, and an injected Firestore so unit
 * tests can drive the four anomaly rules without spinning up the emulator.
 *
 * Production path injects Date.now() and getFirestore() automatically via the
 * onDocumentCreated wrapper below.
 */
export async function _handleAuditEvent(
  audit: Record<string, unknown> | undefined,
  now: number,
  postToSlackFn: (payload: { text: string }) => Promise<void>,
  firestore: Firestore,
): Promise<void> {
  if (!audit) return;
  const type = audit.type as string | undefined;
  if (!type) return;
  const actor = audit.actor as
    | { uid?: string; role?: string; email?: string }
    | undefined;
  const ip = (audit.ip as string | null | undefined) ?? null;
  const at = audit.at as Timestamp | undefined;
  const hourUtc =
    at && typeof at.toMillis === "function"
      ? new Date(at.toMillis()).getUTCHours()
      : -1;

  // Rule 1: failed-sign-in burst (>FAIL_LIMIT per IP per FAIL_WINDOW_MS).
  // DORMANT today — beforeUserSignedIn emits zero rows. Trigger code is
  // functional and ready the moment any future plan adds rejection rules.
  if (type === "auth.signin.failure" && ip) {
    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
    const ref = firestore.doc(`authFailureCounters/${ipHash}`);
    const next = await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists
        ? (snap.data() as { count: number; windowStart: number })
        : null;
      // Three branches:
      // 1) doc doesn't exist yet → tx.set fresh counter at count=1
      // 2) doc exists but window expired → tx.set fresh counter at count=1
      //    (overwrites stale window — equivalent to a reset)
      // 3) doc exists and window open → tx.update with FieldValue.increment(1)
      // Branches 1 + 2 collapse to the same `tx.set` write because Firestore's
      // `tx.update` REQUIRES the doc to exist. RESEARCH.md §Pattern 6 conflated
      // these two cases and would crash on the first-ever failure for a given
      // ipHash; fixed here.
      if (cur === null || now - cur.windowStart > FAIL_WINDOW_MS) {
        tx.set(ref, {
          count: 1,
          windowStart: now,
          lastSeenAt: FieldValue.serverTimestamp(),
        });
        return 1;
      }
      tx.update(ref, {
        count: FieldValue.increment(1),
        lastSeenAt: FieldValue.serverTimestamp(),
      });
      return cur.count + 1;
    });
    // Fire EXACTLY ONCE per (ipHash, window) — boundary check on === FAIL_LIMIT+1.
    // Using >= would re-fire on every event past the threshold (T-9-04-3 mitigation).
    if (next === FAIL_LIMIT + 1) {
      await postToSlackFn({
        text: `:warning: Auth-fail burst: >${FAIL_LIMIT} failed sign-ins in ${
          FAIL_WINDOW_MS / 60000
        }min from ipHash=${ipHash}`,
      });
    }
    return;
  }

  // Rule 2: MFA disenrolment. DORMANT — no current emit source per Plan 03a
  // §mfa_rationale (bound to enrollTotp / unenrollAllMfa deps in src/main.js
  // currently `// deferred to user-testing phase`). Rule code stays for
  // forward-readiness; populates the moment the MFA emit-site lands.
  if (type === "auth.mfa.unenrol") {
    await postToSlackFn({
      text: `:rotating_light: MFA disenrolment: actor=${
        actor?.email ?? actor?.uid ?? "unknown"
      } role=${actor?.role ?? "?"}`,
    });
    return;
  }

  // Rule 3: role escalation (claims set elevating a user to admin).
  // FUNCTIONAL — Plan 03a setClaims emit feeds rows on every admin claim mutation.
  if (type === "iam.claims.set") {
    const payload = audit.payload as
      | { newRole?: string; previousRole?: string }
      | undefined;
    if (
      payload?.newRole === "admin" &&
      payload?.previousRole !== "admin"
    ) {
      await postToSlackFn({
        text: `:rotating_light: Role escalation: ${
          actor?.email ?? actor?.uid ?? "unknown"
        } elevated to admin (was ${payload?.previousRole ?? "none"})`,
      });
    }
    return;
  }

  // Rule 4: unusual-hour gdprExportUser (22:00–05:00 UTC).
  // FUNCTIONAL — Phase 8 gdprExportUser server emission feeds real rows.
  if (type === "compliance.export.user" && UNUSUAL_HOURS.has(hourUtc)) {
    await postToSlackFn({
      text: `:warning: Unusual-hour GDPR export: actor=${
        actor?.email ?? actor?.uid ?? "unknown"
      } hour=${hourUtc}Z`,
    });
    return;
  }
}

export const authAnomalyAlert = onDocumentCreated(
  {
    document: "auditLog/{eventId}",
    region: "europe-west2",
    serviceAccount: "audit-alert-sa", // Wave 6 SA provisioning — Plan 09-05
    secrets: [SLACK_WEBHOOK_URL, SENTRY_DSN],
    memory: "256MiB",
    timeoutSeconds: 30,
    // best-effort alerting — do not retry-storm Slack on transient webhook
    // failure (T-9-04-3 mitigation). firebase-functions v2 Firestore-trigger
    // EventHandlerOptions exposes `retry: boolean` (not the v1-style
    // retryConfig.retryCount); `retry: false` disables Eventarc retries —
    // Slack/network failures bubble to the no-throw postToSlack helper which
    // logs `slack.post.failed` / `slack.post.error` per RESEARCH.md §Pattern 6
    // and never propagates back to Eventarc.
    retry: false,
  },
  withSentry(async (event) => {
    const audit = event.data?.data() as
      | Record<string, unknown>
      | undefined;
    await _handleAuditEvent(audit, Date.now(), postToSlack, getFirestore());
  }),
);
