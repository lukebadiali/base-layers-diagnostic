---
phase: 09-observability-audit-event-wiring
plan: 04
subsystem: observability/anomaly-alerting
tags: [observability, slack, anomaly-detection, firestore-trigger, gitleaks, wave-5]
requirements: [OBS-05]
dependency_graph:
  requires:
    - 09-03a (server-side bare emissions: iam.claims.set, auth.signin.failure substrate)
    - 09-01 (Sentry init + withSentry wrapper)
    - 07 (writeAuditEvent helper, auditLog/{eventId} schema, audit collection)
    - 08 (gdprExportUser → compliance.export.user emission for Rule 4)
  provides:
    - functions/src/observability/authAnomalyAlert.ts trigger module (4 anomaly rules)
    - authFailureCounters/{ipHash} server-only Firestore collection (rolling 5-min window)
    - operator synthetic Slack alert verification script (Wave 6 close-gate input)
    - .gitleaks.toml slack-webhook-url regex (Pitfall 4 defence-in-depth)
  affects:
    - functions/src/index.ts (+1 export)
    - firestore.rules (+1 match block)
    - functions/eslint.config.cjs (+ Node 22 fetch global)
tech_stack:
  added:
    - node:crypto sha256 (ip → ipHash) — first usage in this trigger module
    - Node 22 global fetch (built-in) — first usage in functions/ workspace
  patterns:
    - Pattern 6 (Slack alert function — RESEARCH.md §525-619)
    - Pattern 10 (rolling-window counter — RESEARCH.md §710-731)
    - Pattern B (Firestore-trigger — onOrgDelete.ts analog)
    - Pattern A (defineSecret + withSentry — setClaims.ts analog)
    - Test-only seam (_internals + _handleAuditEvent injected-deps for unit-tests)
key_files:
  created:
    - functions/src/observability/authAnomalyAlert.ts
    - functions/test/observability/authAnomalyAlert.test.ts
    - tests/rules/authFailureCounters.test.js
    - scripts/test-slack-alert/run.js
    - scripts/test-slack-alert/README.md
    - .planning/phases/09-observability-audit-event-wiring/09-04-SUMMARY.md
  modified:
    - functions/src/index.ts
    - firestore.rules
    - functions/eslint.config.cjs
    - .gitleaks.toml
    - .planning/phases/09-observability-audit-event-wiring/deferred-items.md
decisions:
  - retry:false (not retryConfig.retryCount:1) — firebase-functions v2 Firestore-trigger DocumentOptions exposes retry:boolean; plan's retryConfig spec doesn't match the v2 API. retry:false matches "best-effort, do not retry-storm Slack" intent.
  - Rule 1 first-event branch fix — RESEARCH.md §Pattern 6 pseudocode falls through to tx.update on first failure (when the doc doesn't exist), but Firestore tx.update REQUIRES the doc to exist. Collapsed "doc missing" + "window expired" into the same tx.set path. Production EXACTLY-ONCE-per-window semantics preserved.
  - Test-only seams (_internals + _handleAuditEvent exports) — handler accepts injected `now` + injected postToSlackFn + injected Firestore so unit-tests don't need real timers/network. Production code wires real implementations through the onDocumentCreated wrapper.
  - 6 trimmed behaviour tests (not 10) — per WARNING 5 split. Rule 2 (MFA disenrol) is DORMANT, so a passing test would assert against fake input that never appears in production; skipped intentionally. Empty-webhook + Slack-500 paths are exercised indirectly through Tests 1/4/6 (any of which with empty webhook would log+return).
  - Java/emulator gate on tests/rules/authFailureCounters.test.js — local env has no Java; same gate applied to Phase 8 plan 05 GDPR-05 redactionList tests; established convention is land the test code, CI runs it on the PR.
  - Slack-webhook gitleaks rule moved from Plan 06 Task 3 to Task 4 of THIS plan (per WARNING 7 in 09-04-PLAN.md) — defence-in-depth for the SLACK_WEBHOOK_URL secret introduced HERE belongs WITH the secret introduction.
metrics:
  start: "2026-05-10T17:56:23Z"
  end: "2026-05-10T18:08:53Z"
  duration_minutes: 12.5
  tasks_completed: 5
  tests_added: 10  # 6 trigger behaviour + 4 rules cells
  files_created: 5
  files_modified: 5
  commits: 5
---

# Phase 9 Plan 04: authAnomalyAlert + authFailureCounters Substrate + Slack Defences Summary

`onDocumentCreated('auditLog/{eventId}')` Slack dispatcher with 4 anomaly rules (auth-fail burst, MFA disenrol, role escalation, unusual-hour GDPR export), backed by a server-only rolling-window counter at `authFailureCounters/{ipHash}` (Pitfall 4 secret-discipline + Pattern 10 counter shape).

## What Landed

### Task 1a — `authAnomalyAlert` trigger module (commit `4adde66`)

`functions/src/observability/authAnomalyAlert.ts` (new, 222 lines):

- `onDocumentCreated('auditLog/{eventId}')` in `europe-west2` running as `audit-alert-sa` (Wave 6 SA provisioning — Plan 09-05).
- `defineSecret("SLACK_WEBHOOK_URL")` + `defineSecret("SENTRY_DSN")` — never read from env or file.
- 4 anomaly rules (see "The 4 Rules" below).
- Test-only exports `_internals` + `_handleAuditEvent` — pure handler with injected `now` + injected `postToSlackFn` + injected `Firestore` so unit-tests don't need real timers / network / emulator.
- `postToSlack` helper: best-effort, never throws (logs `slack.skip.no-webhook`, `slack.post.failed`, `slack.post.error`).
- `retry: false` (not the plan's spec'd `retryConfig: { retryCount: 1 }` — the v2 Firestore-trigger DocumentOptions exposes `retry: boolean`, not a v1-style retryConfig; `retry: false` matches the "best-effort, no retry-storms" intent).

`functions/src/index.ts` extended with one new export.

`functions/eslint.config.cjs` extended with Node 22 `fetch` global (Rule 3 fix — first `fetch` usage in functions/ workspace).

### Task 1b — 6 behaviour tests (commit `08394a8`)

`functions/test/observability/authAnomalyAlert.test.ts` (new, 295 lines):

| # | Behaviour | Rule | Outcome |
|---|-----------|------|---------|
| 1 | First 5 events increment counter; 6th event fires Slack EXACTLY ONCE on `count===FAIL_LIMIT+1` | 1 | Slack called 1× with "Auth-fail burst" + ipHash |
| 2 | 7th & 8th events at same `now` do NOT re-fire Slack | 1 | Counter advances to 8; Slack still 1× |
| 3 | Window expiry → counter resets; fresh threshold-cross fires Slack at 6th event of new window | 1 | Counter goes 8 → 1 → 6; Slack 1× |
| 4 | `iam.claims.set` `newRole=admin` `previousRole=internal` fires Slack | 3 | Slack called 1× with "Role escalation" |
| 5 | `iam.claims.set` `newRole=admin` `previousRole=admin` does NOT fire Slack | 3 | Slack not called (no escalation) |
| 6 | `compliance.export.user` UTC 23:30 fires Slack; UTC 14:30 does NOT | 4 | Slack 1× ("Unusual-hour GDPR export"); 0× for daytime |

Tests 4-6 use a stub-firestore that throws on any access — pins the early-return scoping (non-Rule-1 events MUST NOT touch Firestore).

### Task 2 — firestore.rules + 4-cell deny test (commit `56c8147`)

`firestore.rules` extended with the `authFailureCounters/{ipHash}` block:

```
match /authFailureCounters/{ipHash} {
  allow read:  if false;
  allow write: if false;
}
```

`tests/rules/authFailureCounters.test.js` (new): 4-cell deny matrix mirroring `tests/rules/auditLog.test.js`:

- Cell 1: anonymous read denied
- Cell 2: signed-in client read denied
- Cell 3: signed-in client write denied
- Cell 4: internal-role write denied (Admin SDK only — `audit-alert-sa`)

Execution gates on Java/emulator (not available locally; same gate as Phase 8 plan 05 GDPR-05 redactionList tests; CI runs it on the PR).

### Task 3 — synthetic Slack alert script (commit `7d884ce`)

`scripts/test-slack-alert/run.js` + `README.md` (new):

- Reads `SLACK_WEBHOOK_URL` from env (preferred source: `gcloud secrets versions access latest --secret=SLACK_WEBHOOK_URL`).
- Posts a synthetic message tagged `:white_check_mark: Phase 9 OBS-05 synthetic test alert (operator-verifiable; safe to dismiss)`.
- Exit-code contract: 0 = success, 1 = no env var, 2 = POST failed / network error / fetch threw.

Wave 6 close-gate uses this as the OBS-05 evidence artefact ("an operator receives a synthetic test alert end-to-end").

### Task 4 — `.gitleaks.toml` Slack-webhook regex (commit `ebea786`)

Custom rule `slack-webhook-url` extends `.gitleaks.toml` with:

```toml
regex = '''https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+'''
```

- Markdown placeholders (`T.../B.../...` with dots/ellipses) do NOT match → docs that reference the URL format are not false-positive.
- Synthetic positive test confirmed: a file containing a real-shape webhook URL triggers the rule (1 leak found).
- Working-tree scan: zero leaks (after fixing one self-inflicted false positive in this plan's own README).

Defence-in-depth (Pitfall 4 + T-9-04-1): the secret introduced HERE (Task 1a's `defineSecret("SLACK_WEBHOOK_URL")`) is paired with the gitleaks regex IN THE SAME PLAN, not deferred to Plan 06.

## The 4 Anomaly Rules

| # | Type | Condition | Disposition | Source emit |
|---|------|-----------|-------------|-------------|
| 1 | `auth.signin.failure` | rolling 5-min counter at `authFailureCounters/{ipHash}` crosses count===FAIL_LIMIT+1 (=6) | **DORMANT** — trigger code FUNCTIONAL; observation pipeline emits zero rows today | Plan 03a `beforeUserSignedIn` substrate (catch branch fires only on internal handler errors today; populates the moment any future plan adds rejection rules like "block disabled accounts at sign-in") |
| 2 | `auth.mfa.unenrol` | any event of this type | **DORMANT** — bound to landing of `enrollTotp`/`unenrollAllMfa` deps in `src/main.js` (currently `// deferred to user-testing phase`) | Carry-forward from Plan 03a §mfa_rationale — no current emit source |
| 3 | `iam.claims.set` | `payload.newRole === "admin" && payload.previousRole !== "admin"` | **FUNCTIONAL** | Plan 03a `setClaims` server-side bare emission — fires on every admin claim mutation |
| 4 | `compliance.export.user` | UTC hour ∈ {0,1,2,3,4,5,22,23} (research §A2 assumption) | **FUNCTIONAL** | Phase 8 `gdprExportUser` server-side bare emission |

**EXACTLY-ONCE Slack-fire guarantee for Rule 1** — boundary check on `next === FAIL_LIMIT + 1`, not `>=`. Using `>=` would re-fire on every event past threshold; the boundary check ensures the burst-detection alert fires once per (ipHash, 5-min window) and not again until either the window expires (counter resets to 1) or a new ipHash crosses threshold.

**The DORMANT designation** means the trigger CODE is fully functional but the OBSERVATION pipeline emits zero rows today. When future code paths add the missing emit sources, Rules 1+2 fire automatically with no schema or trigger-code change.

## Verification Results

```
$ cd functions; npm test -- --run
 Test Files  47 passed (47)
 Tests       268 passed (268)
 Duration    17.77s

$ cd functions; npm run lint     # 6 PRE-EXISTING errors (deferred-items.md)
$ cd functions; npm run typecheck # only PRE-EXISTING node_modules dup-id errors

$ grep -c "authAnomalyAlert" functions/src/index.ts                 = 2
$ grep -c "authFailureCounters" firestore.rules                     = 2
$ grep -c "audit-alert-sa" functions/src/observability/authAnomalyAlert.ts = 2
$ grep -c "slack-webhook-url" .gitleaks.toml                        = 1
$ node -c scripts/test-slack-alert/run.js                           OK
$ gitleaks detect --no-git --source . --config .gitleaks.toml --redact
  → no leaks found
```

Manual exit-code-contract verification of the slack script:
- `unset SLACK_WEBHOOK_URL && node scripts/test-slack-alert/run.js` → stderr "ERROR: SLACK_WEBHOOK_URL not set" + exit=1
- `SLACK_WEBHOOK_URL=https://hooks-fakehost.invalid/...` → stderr "ERROR: Slack POST threw: TypeError fetch failed" + exit=2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rule 1 first-event branch crash**

- **Found during:** Task 1b (Test 1 surfaced it on first run).
- **Issue:** `RESEARCH.md` §Pattern 6's pseudocode falls through to `tx.update` on the first-ever failure for a given `ipHash` (when the counter doc doesn't exist yet) because the synthesised `cur = {count: 0, windowStart: now}` makes `now - cur.windowStart > FAIL_WINDOW_MS` evaluate to `false`. But Firestore `tx.update` REQUIRES the doc to exist — it would crash in production on the first failure for any ipHash.
- **Fix:** Collapsed the "doc missing" and "window expired" branches into the same `tx.set` path. Production EXACTLY-ONCE semantics preserved (still fires Slack on `count===FAIL_LIMIT+1`).
- **Files modified:** `functions/src/observability/authAnomalyAlert.ts`
- **Commit:** `08394a8` (Task 1b's commit — fix shipped with the test that revealed it).

**2. [Rule 3 - Blocking issue] `fetch` not in functions/ ESLint Node 22 globals**

- **Found during:** Task 1a verification (lint reported `'fetch' is not defined` on the Slack POST).
- **Issue:** `functions/eslint.config.cjs` declares Node 22 globals (`Buffer`, `process`, `console`, `URL`, `URLSearchParams`) but not `fetch`. Node 22 has built-in `fetch` (undici); this trigger is the first usage in the workspace.
- **Fix:** Added `fetch: "readonly"` to the globals list with a Phase 9 comment.
- **Files modified:** `functions/eslint.config.cjs`
- **Commit:** `4adde66` (Task 1a)

**3. [Rule 1 - Bug] Self-inflicted false positive in this plan's own README**

- **Found during:** Task 4 verification (gitleaks scan flagged 1 leak).
- **Issue:** `scripts/test-slack-alert/README.md` line 83 contained the example URL `https://hooks.slack.com/services/T0/B0/never_existed` (intended as a "URL formed correctly but unreachable" sample). The just-added `slack-webhook-url` regex matched it.
- **Fix:** Replaced with `https://hooks-fakehost.invalid/services/T.../B.../...` — non-Slack hostname (so the regex doesn't match) but still demonstrates network-error semantics. Updated the expected-output annotation accordingly (TypeError fetch failed, not a status code).
- **Files modified:** `scripts/test-slack-alert/README.md`
- **Commit:** `ebea786` (Task 4 — fix shipped with the rule that revealed it).

### Plan-spec divergences (documented inline)

**1. `retry: false` instead of `retryConfig: { retryCount: 1 }`**

- **Why:** firebase-functions v2 Firestore-trigger DocumentOptions exposes `retry: boolean` (not the v1-style `retryConfig.retryCount`). Compile-time error on the plan's spec'd shape. `retry: false` matches the "best-effort, do not retry-storm Slack" intent — Slack/network failures bubble to the no-throw `postToSlack` helper which logs and never propagates back to Eventarc.
- **Documented in:** `authAnomalyAlert.ts` source comment + `09-04-PLAN.md` Task 1a inline note (this Summary).

**2. Rules-emulator test execution gated on Java**

- **Why:** `npm run test:rules` shells out to `firebase emulators:exec --only firestore,storage` which requires Java to spawn the Firestore emulator. Local Windows env has no Java. Same gate applied to Phase 8 plan 05 GDPR-05 redactionList tests; established convention is land the test code, CI runs it on the PR.
- **Documented in:** `.planning/phases/09-observability-audit-event-wiring/deferred-items.md` (2026-05-10 Plan 09-04 Task 2 entry).

### Auth gates

None occurred during execution. Plan execution was fully autonomous.

## Forward-tracking Ledger Rows

The following rows are queued for the Phase 9 cleanup ledger (Plan 06 Task 2):

1. **`audit-alert-sa` SA provisioning** — Wave 6 / Plan 09-05 operator session. The SA needs `roles/datastore.user` on `authFailureCounters/*` + `roles/datastore.viewer` on `auditLog/*` + Slack-webhook-secret accessor + Sentry-DSN-secret accessor. NO broader Firestore write or invoker permissions (T-9-04-5).

2. **MFA emit-site wiring DEFERRED** (carry-forward from Plan 03a §mfa_rationale) — bound to landing of `enrollTotp`/`unenrollAllMfa` deps in `src/main.js:916-917` (currently `// deferred to user-testing phase`). Re-evaluate when MFA deps land. Rule 2 trigger code stays for forward-readiness.

3. **`#ops-warn` vs `#ops-page` Slack-channel split when staffing scales** (T-9-04-4 partial mitigation) — the current Slack message body for Rules 2/3/4 includes `actor.email` for triage. Channel is internal `#ops-alerts` only (operator policy). When staffing scales beyond a single ops responder, split into `#ops-warn` (no email) + `#ops-page` (email).

4. **Trigger-side first-event branch fix is INTERNAL, not RESEARCH.md** — research file's Pattern 6 pseudocode (lines 571-580) describes the buggy branch that crashes on first failure. Not actionable in this plan (research files are historical), but flagged for any future pattern-mapper run that uses this research as analog.

## Operator Action Required

**BEFORE first deploy of `authAnomalyAlert`:** ensure `SLACK_WEBHOOK_URL` is set in GCP Secret Manager (project `bedeveloped-base-layers`). Per `runbooks/phase-9-sentry-bootstrap.md` Step 5. Without this, the trigger logs `slack.skip.no-webhook` on every audit event and never POSTs (gracefully degraded; not an error).

**BEFORE Wave 6 close-gate** (Plan 09-05 operator session):
1. Provision `audit-alert-sa` per the SA inventory (Plan 09-05 Task — to be authored).
2. Run `node scripts/test-slack-alert/run.js` (with `SLACK_WEBHOOK_URL` from Secret Manager) and confirm receipt in Slack.
3. Capture the screenshot for `docs/evidence/` (Phase 11).

## Next Plan

**09-05 (Wave 6 — autonomous: false):** GCP-tier monitors — uptime check (OBS-06) + budget alerts (OBS-07) + Sentry quota alert (OBS-08) + `audit-alert-sa` SA provisioning + first deploy of `authAnomalyAlert` + synthetic Slack alert verification (using Task 3's script). Operator-paced: gcloud commands + Console clicks + Sentry UI.

## Self-Check: PASSED

**Created files exist:**
- `functions/src/observability/authAnomalyAlert.ts` — FOUND
- `functions/test/observability/authAnomalyAlert.test.ts` — FOUND
- `tests/rules/authFailureCounters.test.js` — FOUND
- `scripts/test-slack-alert/run.js` — FOUND
- `scripts/test-slack-alert/README.md` — FOUND
- `.planning/phases/09-observability-audit-event-wiring/09-04-SUMMARY.md` — being written now

**Commits exist:**
- `4adde66` — feat(09-04): authAnomalyAlert trigger module + index export (Task 1a)
- `08394a8` — test(09-04): authAnomalyAlert behaviour tests + fix Rule 1 first-event branch (Task 1b)
- `56c8147` — feat(09-04): authFailureCounters firestore.rules block + 4-cell deny test (Task 2)
- `7d884ce` — feat(09-04): scripts/test-slack-alert/ synthetic Slack alert verification (Task 3)
- `ebea786` — chore(09-04): .gitleaks.toml slack-webhook-url regex + README false-positive fix (Task 4)
