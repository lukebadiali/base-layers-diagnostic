// @ts-nocheck
// scripts/test-slack-alert/run.js
//
// Phase 9 Wave 5 (OBS-05): synthetic Slack alert verification.
// Operator runs this to confirm the SLACK_WEBHOOK_URL secret is set and
// reachable. Wave 6 close-gate (Plan 09-05) uses this to satisfy the OBS-05
// success criterion: "an operator receives a synthetic test alert end-to-end."
//
// The trigger module (functions/src/observability/authAnomalyAlert.ts)
// reads SLACK_WEBHOOK_URL via defineSecret() at runtime — this script POSTs
// the same Slack incoming-webhook URL out-of-band so operators can verify
// the channel + URL before the trigger ever fires. Idempotent: re-running
// simply posts another synthetic message (Slack accepts unbounded duplicates).
//
// Exit codes:
//   0 = success (POST returned 2xx; operator should now see the message)
//   1 = no SLACK_WEBHOOK_URL env var set
//   2 = POST failed (non-2xx) or network error
//
// Usage (preferred — pull from Secret Manager):
//   SLACK_WEBHOOK_URL=$(gcloud secrets versions access latest \
//     --secret=SLACK_WEBHOOK_URL --project=bedeveloped-base-layers) \
//     node scripts/test-slack-alert/run.js
//
// Usage (local one-shot — secret pasted inline):
//   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../... \
//     node scripts/test-slack-alert/run.js

const url = process.env.SLACK_WEBHOOK_URL;
if (!url) {
  console.error("ERROR: SLACK_WEBHOOK_URL not set");
  console.error("");
  console.error("Hint: pull from Secret Manager —");
  console.error("  SLACK_WEBHOOK_URL=$(gcloud secrets versions access latest \\");
  console.error("    --secret=SLACK_WEBHOOK_URL --project=bedeveloped-base-layers) \\");
  console.error("    node scripts/test-slack-alert/run.js");
  process.exit(1);
}

const payload = {
  text:
    ":white_check_mark: Phase 9 OBS-05 synthetic test alert " +
    "(operator-verifiable; safe to dismiss)",
};

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`ERROR: Slack POST returned status=${res.status} statusText=${res.statusText}`);
    const text = await res.text().catch(() => "<no body>");
    console.error(`Body: ${text.slice(0, 500)}`);
    process.exit(2);
  }
  console.log("OK — message posted; operator should now see it in Slack");
  process.exit(0);
} catch (err) {
  const e = /** @type {Error} */ (err);
  console.error(`ERROR: Slack POST threw: ${e?.name ?? "Error"} ${e?.message ?? ""}`);
  process.exit(2);
}
