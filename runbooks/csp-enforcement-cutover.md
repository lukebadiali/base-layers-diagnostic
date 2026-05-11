# Phase 10 — CSP Enforcement Cutover (Operator Runbook)

> Phase: 10 — CSP Tightening (Second Sweep)
> Wave: 4 (Plan 10-04)
> Requirement: HOST-07 (Strict CSP rolled to enforced + style-src 'self' — Stage C of Pitfall 16 three-stage rollout)
> Date authored: 2026-05-10
> Objective: Single-session operator procedure that flips `firebase.json` line 21 header key from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` AND runs the HOST-07 SC#2 5-target smoke matrix under enforcement.
> Cutover window: ~45 min active work (deploy ~5 min + curl verify ~2 min + 5-target smoke ~25 min + Cutover Log update ~5 min + buffer ~8 min)
> Rollback window: single-knob revert + redeploy, ~5 min total — see `## Rollback Procedure` below.

This runbook is intentionally executor-deferred. The autonomous portion of Plan 10-04 (Task 1) authored this runbook, pre-staged the schema-test edits under `describe.skip(...)` in `tests/firebase-config.test.js`, and STOPPED. The actual key flip + production deploy + 5-target smoke + Cutover Log fill are operator-only — `checkpoint:human-action` per Plan 10-04 Task 2 frontmatter (`autonomous: false`). The runbook exists so the operator follows a written script during the enforcement-flip cutover, not so improvisation happens at the keyboard under deploy pressure.

---

## Prerequisites

Before opening this runbook on cutover day, ALL of the following MUST be true. If any is false, stop and resolve it before continuing.

### From `10-PREFLIGHT.md ## Soak Log` — PENDING-USER items resolved

The 7-day Stage B soak from Plan 10-03 must have closed CLEAN before Wave 4 starts. Verify:

- [ ] **Plan 10-03 Soak Log Day 7 close-out row marks `CLEAN`** (zero non-extension-origin violations across the 7-day Stage B window). Open `.planning/phases/10-csp-tightening-second-sweep/10-PREFLIGHT.md ## Soak Log` and confirm the final `Day 7` row of the most recent cycle reads `CLEAN`.
- [ ] **Wave 4 explicitly authorised in `## Wave 3 Close Decision`** section of `10-PREFLIGHT.md`. The first checkbox ("Soak Log Cycle N Day 7 row marks `CLEAN`") must be ticked AND the operator resume signal `soak clean — authorise Wave 4` must have been delivered to the spawning agent.
- [ ] **No outstanding triage incidents** in `## Triage Incidents` section without a documented fix-commit-SHA + cycle-N start timestamp.

### From `tests/firebase-config.test.js`

- [ ] **All 24 baseline + Wave 2 assertions remain green** under the existing Report-Only state:
  ```sh
  npm test -- --run firebase-config
  ```
  Expected: `24 passed (24)` plus a SKIP marker for the Plan 10-04 Task 1 pre-staged describe block (`describe.skip("firebase.json — Phase 10 enforced CSP shape (HOST-07) — Wave 4 un-skip", ...)`).

### From the build pipeline

- [ ] **`.github/workflows/ci.yml` `deploy` job last-run green on `main`.** Verify:
  ```sh
  gh run list --workflow=ci.yml --branch=main --status=success --limit=5 --json databaseId,createdAt,headSha,event
  ```
  At least one entry whose `headSha` matches the Wave 3 commits (after Plan 10-03 Task 2's deploy SHA `{{ DEPLOY_SHA }}` recorded in `10-PREFLIGHT.md ## Soak Log` Day 0).
- [ ] **No in-flight Cloud Function deploys** (Pitfall 8 — concurrent deploys can shadow this hosting deploy and cause race conditions). Verify:
  ```sh
  gcloud functions list --project=bedeveloped-base-layers --regions=europe-west2 --format="table(name,state,updateTime)"
  ```
  All listed functions should show `state: ACTIVE` with `updateTime` older than the last 10 minutes.

### Operator state

- [ ] **`firebase login:list` shows authenticated identity** for `bedeveloped-base-layers` project (or push-to-main triggers CI deploy via the OIDC pool). Either deploy path is acceptable — local `firebase deploy` is faster for a 1-knob flip.
- [ ] **DevTools console available in a clean Chrome profile** for the 5-target smoke matrix. Use Incognito or a dedicated profile so extension-origin CSP violations do not contaminate the smoke evidence (Phase 3 substrate filters extension origins server-side, but client-side console will still show them in DevTools).
- [ ] **Foreground terminal session for `gcloud auth login`** so post-deploy curl verification can run without prompting.

### Cutover window

- [ ] **~45 min active work scheduled.** The flip itself is ~3 min, but the 5-target smoke matrix + Cutover Log update bring the active window to ~45 min. Triage-and-rollback path adds ~5 min for revert + redeploy + console verification.
- [ ] **No competing deploys planned** in the cutover window (e.g. functions deploys, Firestore rules deploys). Pitfall 8 substrate.

---

## Pre-cutover Smoke Checklist (run under EXISTING Report-Only state)

Goal: confirm all 5 targets work TODAY (BEFORE the flip) so any post-flip regression is provably caused by the flip and not pre-existing drift. This checklist mirrors the Step 6 5-target smoke matrix below — same 5 targets, same expected console state — except the existing CSP-RO state DOES NOT BLOCK the violations (it only logs them). Surface them NOW so they get fixed BEFORE the flip.

1. Visit `https://baselayers.bedeveloped.com` in a clean Chrome profile (Incognito or a dedicated profile)
2. Open DevTools → Console → keep open through all 5 targets
3. **Sign in** (Phase 6 Email/Password flow — `signInWithEmailAndPassword` via `src/auth/`)
4. Land on the **dashboard**; verify pillar tiles render with computed colours/styles
5. Open a diagnostic; verify **radar + donut charts** render fully (Chart.js@4.5.1, npm-imported per Phase 4 D-08)
6. Open the documents view; attempt a **document upload** (small PDF, ≤1 MB)
7. Open client **chat**; send a test message and verify the real-time round-trip

**Expected:** zero `Refused to ... because it violates ...` lines in DevTools console (Report-Only doesn't BLOCK — but any console-logged violation under RO becomes a BLOCKED action under enforced; surface them NOW so they get fixed BEFORE the flip).

**If pre-cutover smoke surfaces ANY console violations:**

- STOP. Do not flip the key.
- Root-cause the violation (likely a missed Wave 1 inline-style site OR a new feature added since Plan 10-03's soak window started)
- Open a sub-wave 10.x micro-plan to fix the violation
- Restart Plan 10-03 7-day soak per `runbooks/phase-10-csp-soak-bootstrap.md` Cycle 2
- Wave 4 stays blocked until the next Cycle N Day 7 close-out marks `CLEAN`

---

## Cutover Steps

### Step 1: Apply the firebase.json key flip (~3 min)

Edit `firebase.json` line 21. Change ONLY the key string. The directive value (line 22) is identical to what Wave 2 committed — DO NOT EDIT THE VALUE. The single-knob flip pattern (10-RESEARCH.md Pattern 1) keeps Wave 4's commit minimal so a forward-fix retry is trivial.

```diff
        { "key": "Reporting-Endpoints", "value": "csp-endpoint=\"/api/csp-violations\"" },
        {
-         "key": "Content-Security-Policy-Report-Only",
+         "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://securetoken.google.com https://de.sentry.io; frame-src 'self'; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; report-uri /api/csp-violations; report-to csp-endpoint"
        }
```

### Step 2: Un-skip the pre-staged enforced-shape describe + delete the Wave 2 RO describe (~1 min)

Plan 10-04 Task 1 pre-staged the enforced-shape assertions under a `describe.skip(...)` block. This step is two surgical edits in `tests/firebase-config.test.js`, both deletions:

(a) Locate the line:

```js
describe.skip("firebase.json — Phase 10 enforced CSP shape (HOST-07) — Wave 4 un-skip", () => {
```

and delete `.skip` so the call reads:

```js
describe("firebase.json — Phase 10 enforced CSP shape (HOST-07) — Wave 4 un-skip", () => {
```

(b) Delete the now-superseded Wave 2 describe block in its entirety. The block to remove starts with:

```js
// Phase 10 Wave 2 (HOST-07): assert the TIGHTENED CSP-RO shape. The header
// KEY remains `Content-Security-Policy-Report-Only` at Wave 2 — Wave 4
// (Plan 10-04) flips the key to `Content-Security-Policy` and updates the
// first assertion below to target the enforced key.
describe("firebase.json — Phase 10 tightened CSP shape (HOST-07)", () => {
  const cspKey = "Content-Security-Policy-Report-Only";
  // ... 6 it() blocks ...
});
```

and ends at the closing `});` of that describe. Its assertions targeted the RO key, which no longer ships after the flip — they would all FAIL under the new key.

(c) Optionally, if the existing Phase 3 describe block (`firebase.json — security headers present (T-3-1 mitigation)`) still includes `"Content-Security-Policy-Report-Only"` in the it.each() array, edit that array to swap to `"Content-Security-Policy"` so the security-headers presence test continues to pass. (This is a one-token swap if needed — verify by running tests; the existing 24/24 baseline includes that header presence test.)

No new test code is authored in this step; (a) and (b) are deletions; (c) is a one-token swap if the array references the RO key by name.

### Step 3: Local verification (~2 min)

Run the schema test against the modified firebase.json + tests/firebase-config.test.js:

```sh
npm test -- --run firebase-config
```

**Expected:** the suite reports a count consistent with: 17 baseline + 6 enforced-shape (un-skipped Plan 10-04 describe) — Wave 2 RO describe (6) deleted = 23/23 OR 24/24 depending on whether step (c) above was needed (the security-headers `it.each` array length is unchanged either way; only the key string differs).

Net delta vs. pre-flip:

- **Lost:** 6 assertions targeting the RO key (Wave 2 describe deleted)
- **Gained:** 6 assertions targeting the enforced key (Plan 10-04 Task 1 describe un-skipped)
- **Net:** zero change in assertion count

If any assertion fails, REVERT both edits (`git restore tests/firebase-config.test.js firebase.json`) and triage before redeploying.

### Step 4: Selective hosting deploy (~5 min)

```sh
firebase deploy --only hosting --project bedeveloped-base-layers
```

**Pitfall 8 reminder — DO NOT RUN any of these:**

- `firebase deploy` (mass deploy — Phase 7 Wave 5 cleanup-ledger forbids in production)
- `firebase deploy --only functions` (would redeploy `cspReportSink` and may break `csp-sink-sa` rebind from Phase 7 Wave 5)
- `firebase deploy --only functions:cspReportSink` (single-function variant of the same risk)
- `firebase deploy --only firestore` or `--only storage` (out of Wave 4 scope)

If you accidentally ran one of the forbidden commands, run the recovery procedure in `runbooks/phase-10-csp-soak-bootstrap.md ## Step 1` (sub-step 1.4 — `gcloud functions describe + SA verification + sub-wave 10.x rebind if drifted`).

Record deploy timestamp + commit SHA in `10-PREFLIGHT.md ## Cutover Log` Row B as soon as the deploy command returns success. Pitfall 19 substrate-honest disclosure: timestamp must be the deploy moment, not back-filled at close-out.

### Step 5: Post-deploy curl smoke (~2 min)

```sh
curl -sI https://baselayers.bedeveloped.com | grep -i content-security
```

**Expected response (single line, must match all of):**

- Header KEY = `content-security-policy:` (lowercase, NO `-report-only` suffix)
- Header VALUE includes `default-src 'self'; script-src 'self'; style-src 'self';` (and the rest of the directive matrix unchanged from Wave 2)
- **MUST NOT** contain `-report-only` suffix anywhere
- **MUST NOT** appear twice (no dual RO + enforced state — would indicate a partial deploy or CDN cache lag)

If output has `-report-only` suffix → CDN cache lag; wait 60s and retry. If after 5 min the header still has the RO suffix → STOP + run `## Rollback Procedure` below to reverse any partial state, then investigate (likely a deploy-target mismatch — verify the project ID matched `bedeveloped-base-layers`).

If output shows BOTH `content-security-policy:` AND `content-security-policy-report-only:` (dual headers) → STOP + run Rollback Procedure. This is a firebase.json edit error (both blocks present). Fix the JSON and retry.

### Step 6: 5-target smoke matrix under enforcement (~25 min)

Open `https://baselayers.bedeveloped.com` in a clean Chrome profile with DevTools → Console open. Run each target and verify zero `Refused to ... because it violates ...` violation lines after each step.

| Target              | Action                                                  | Expected                                              | If fails                                                                                |
| ------------------- | ------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1. Sign-in          | Email/Password sign-in via Firebase Auth                | Successful auth + dashboard renders                   | Likely connect-src missed an Identity Platform host; ROLLBACK + investigate             |
| 2. Dashboard        | Render pillar tiles + summary stats                     | All pillar tiles render with computed colours/styles  | Likely style-src violation (missed Wave 1 inline-style site); ROLLBACK + open sub-wave  |
| 3. Radar+Donut chart| Open a diagnostic; verify Chart.js charts render        | Both charts render fully with all data points         | Likely Chart.js transient inline style (unexpected); investigate before ROLLBACK        |
| 4. Document upload  | Upload a small PDF via documents view                   | Upload succeeds; signed URL returned                  | Likely connect-src missed firebasestorage origin (unlikely — Phase 5 substrate); ROLLBACK |
| 5. Chat             | Send a message in client chat                           | Message round-trips; real-time update arrives         | Likely WebSocket `wss://*.firebaseio.com` missing (unlikely — Phase 3 substrate); ROLLBACK |

For EACH target, the verification gate is: zero `Refused to ...` lines in DevTools console after the action completes. A single CSP violation under enforcement is a HARD FAIL — the user-visible behaviour breaks (button doesn't work, chart doesn't render, upload doesn't upload, etc.) and the smoke must mark FAIL.

**Capture:** DevTools console screenshot showing zero CSP violation lines after all 5 targets exercised. Save to `docs/evidence/phase-10-enforcement-smoke-console.png`.

Record Smoke Row C in `10-PREFLIGHT.md ## Cutover Log` with PASS or FAIL per target. If ANY target marks FAIL → run Rollback Procedure.

### Step 7: Update 10-PREFLIGHT.md (~5 min)

Append a `## Cutover Log` section to `10-PREFLIGHT.md` (Plan 10-03 created the file with `## Soak Log`; this step extends it). Use this paste-ready template:

```markdown
## Cutover Log

> Wave 4 operator-fill audit substrate. Substrate-honest disclosure (Pitfall 19): rows D + E are explicitly `{{ PENDING }}` in this wave — Plan 10-05 closes them. Do NOT delete rows; do NOT back-fill timestamps.

| Step | Action                                                                | T+0 (UTC)              | Result                | Evidence                                                                                                                          |
| ---- | --------------------------------------------------------------------- | ---------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A    | Plan 10-03 7-day soak window closed `CLEAN` (zero violations)         | `{{ YYYY-MM-DD HH:MM }}` | `{{ PASS / FAIL }}`   | `10-PREFLIGHT.md ## Soak Log` Cycle `{{ N }}` Day 7 row reads `CLEAN`                                                             |
| B    | `firebase deploy --only hosting --project bedeveloped-base-layers`    | `{{ YYYY-MM-DD HH:MM }}` | `{{ PASS / FAIL }}`   | Commit SHA `{{ short_sha }}` + `curl -sI https://baselayers.bedeveloped.com \| grep -i content-security` showing `content-security-policy:` (no `-report-only` suffix) |
| C    | 5-target smoke under enforcement (sign-in / dashboard / charts / upload / chat) | `{{ YYYY-MM-DD HH:MM }}` | `{{ PASS / FAIL }}`   | `docs/evidence/phase-10-enforcement-smoke-console.png` showing zero CSP violation lines; per-target results: 1=`{{ PASS/FAIL }}`, 2=`{{ PASS/FAIL }}`, 3=`{{ PASS/FAIL }}`, 4=`{{ PASS/FAIL }}`, 5=`{{ PASS/FAIL }}` |
| D    | `securityheaders.com` rating = A+                                     | `{{ PENDING }}`        | `{{ PENDING }}`       | Plan 10-05 Wave 5 closes — `docs/evidence/phase-10-securityheaders-rating.png` to be captured then                               |
| E    | 7-day post-enforcement soak (no new violations)                       | `{{ PENDING }}`        | `{{ PENDING }}`       | Plan 10-05 Wave 5 closes — Cloud Logging filter with `disposition="enforce"`; HOST-07 SC#2                                       |
```

Rows A + B + C close in this plan (Plan 10-04). Rows D + E close in Plan 10-05 — they remain `{{ PENDING }}` here per Pitfall 19 substrate-honest disclosure.

Commit message for the Wave 4 commit:

```
feat(10-04): flip CSP from Report-Only to enforced (HOST-07 SC#1 closes)

- firebase.json line 21: Content-Security-Policy-Report-Only → Content-Security-Policy
- tests/firebase-config.test.js: un-skip Plan 10-04 enforced-shape describe; delete Wave 2 RO describe
- 10-PREFLIGHT.md: append ## Cutover Log with rows A/B/C filled, D/E PENDING for Plan 10-05
```

---

## Rollback Procedure (single-knob; ~5 min)

If Step 6 smoke fails on any target — OR if Step 5 curl shows the wrong header state — execute these steps in order:

1. **Edit `firebase.json` line 21 — revert key back to `Content-Security-Policy-Report-Only`.** Single-line edit, inverse of Step 1's diff. The directive value remains unchanged (Wave 2 substrate stays).

2. **Edit `tests/firebase-config.test.js`:**

   (a) Restore `.skip` on the Plan 10-04 enforced-shape describe block (single token re-add — change `describe(...)` back to `describe.skip(...)`).
   (b) Restore the Wave 2 RO describe block (use `git restore -p tests/firebase-config.test.js` for the hunk, OR re-paste from Plan 10-02 Task 2 `<action>` — the original block is in commit `24f8a7c`).
   (c) If Step 2(c) was performed (security-headers `it.each` array swap), revert that token swap.

3. **Run `npm test -- --run firebase-config`** — expect 24 green again (matching the pre-flip baseline).

4. **Re-deploy:**

   ```sh
   firebase deploy --only hosting --project bedeveloped-base-layers
   ```

5. **Post-deploy curl verify:**

   ```sh
   curl -sI https://baselayers.bedeveloped.com | grep -i content-security
   ```

   Expect `content-security-policy-report-only:` suffix returned. If still showing the enforced key, wait 60s for CDN cache and retry.

6. **Open `runbooks/phase-10-csp-soak-bootstrap.md` — restart at Step 3 with `--freshness=24h`** to confirm the rollback is observed cleanly (a daily soak query against the rolled-back CSP-RO).

7. **Document the rollback in `10-PREFLIGHT.md ## Cutover Log`** — root-cause + fix-commit-SHA + rollback timestamp. Cancel the wave 4 attempt and either (a) open a sub-wave 10.x micro-plan to fix the underlying issue + retry Wave 4 cleanly, or (b) restart Plan 10-03 Cycle N+1 if the failure suggests a Wave 3 substrate gap (e.g. Sentry sub-host A4 misclassified — connect-src needs adjustment).

8. **The Wave 4 commit may be reverted via `git revert`** OR replaced by a forward fix — planner-recommended path is forward-fix on a sub-wave 10.x micro-plan + retry Wave 4 cleanly. Reverting risks loss of the un-skip token edit, which Plan 10-04 Task 1 invested autonomous time in pre-staging.

---

## Post-deploy 7-day soak (Plan 10-05 owns)

After this runbook closes, a 7-day post-enforcement soak runs to satisfy HOST-07 SC#2 ("no new violations during 7-day post-tightening soak"). The Cloud Logging query is identical to Plan 10-03's, but `disposition` is now `"enforce"` not `"report"`:

```sh
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="cspreportsink" AND severity=WARNING AND jsonPayload.message="csp.violation" AND jsonPayload.report.disposition="enforce"' \
  --project=bedeveloped-base-layers --limit=200 --format=json --freshness=7d
```

See Plan 10-05 + `runbooks/phase-10-csp-soak-bootstrap.md` Step 3 for the daily cadence + close-out gate.

---

## Citations

- HOST-07 SC#1 + SC#2 (`.planning/REQUIREMENTS.md` + `.planning/ROADMAP.md`) — enforcement flip + 7-day post-enforcement soak success criteria
- HOST-06 (`.planning/REQUIREMENTS.md`) — HSTS preload submission (Plan 10-05 owns full closure)
- Pitfall 8 (`.planning/research/PITFALLS.md`) — selective deploy boundary (only `--only hosting` for Wave 4)
- Pitfall 16 (`.planning/research/PITFALLS.md`) — Stage C enforcement flip (three-stage rollout: Stage A=RO with `'unsafe-inline'`, Stage B=RO tightened, Stage C=enforced)
- Pitfall 19 (`.planning/research/PITFALLS.md`) — substrate-honest disclosure (`{{ PENDING }}` markers for rows D + E)
- `10-RESEARCH.md` Pattern 1 — single-knob flip + directive value unchanged from Wave 2
- `10-PATTERNS.md §File 5` — Cutover Log tabular form (Phase 9 deploy-checkpoint analog)
- `runbooks/hosting-cutover.md` (Phase 3) — primary structural analog for header-flip cutover with same-session smoke + Cutover Log + Revert Procedure
- `runbooks/phase-9-deploy-checkpoint.md` (Phase 9) — Cutover Log tabular shape with PASS/FAIL/PENDING/DORMANT markers
- `runbooks/phase-10-csp-soak-bootstrap.md` (Plan 10-03) — Wave 3 soak runbook this wave depends on
- ASVS L2 V14.4.1 — CSP defined and enforced
- ISO 27001 A.5.7 (Threat intelligence) + A.8.23 (Web filtering) — CSP as defence-in-depth control
- SOC 2 CC6.6 — logical access controls including content-security boundaries
- GDPR Art. 32(1)(b) — ongoing confidentiality/integrity (CSP enforcement reduces XSS exfiltration surface)
