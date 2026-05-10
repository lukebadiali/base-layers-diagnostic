# Phase 10 — HSTS Preload Submission (Operator Runbook)

> Phase: 10 — CSP Tightening (Second Sweep)
> Wave: 5 (Plan 10-05)
> Requirement: HOST-06 (HSTS preload submitted to hstspreload.org once policy stable for >= 7 days)
> Date authored: 2026-05-10
> Objective: Single-operator-session procedure that submits `baselayers.bedeveloped.com` to the Chrome HSTS preload list at https://hstspreload.org. Operator-paced because the form is web-only and inclusion in browser preload caches takes weeks-months after submission.

This runbook is intentionally executor-deferred. An executor agent cannot fill in a third-party web form, cannot capture a browser screenshot, and cannot wait for Chrome's preload-list update cycle. The autonomous portion of Plan 10-05 (Task 1) authored this document; an operator executes Steps 1-4 in a single ~15-25 minute session; Step 5 is calendar-deferred (weeks to months) and forward-tracked in `runbooks/phase-10-cleanup-ledger.md` Row F1.

---

## Pre-conditions

Before running Step 1, every box below MUST be checked.

### From the prior Phase 10 waves

- [ ] **Plan 10-04 closed:** CSP is enforced — `curl -sI https://baselayers.bedeveloped.com | grep -i content-security-policy` returns a `content-security-policy:` header WITHOUT the `-report-only` suffix.
- [ ] **7-day post-enforcement soak shows zero new violations** (HOST-07 SC#2; Plan 10-04 Cutover Log Row E). Tracked alongside this task in the combined Phase 10 deferred-checkpoint operator session.
- [ ] **`firebase.json` HSTS header carries `max-age=63072000; includeSubDomains; preload`** (Phase 3 substrate; verified by `tests/firebase-config.test.js` Phase 10 HSTS-preload-eligibility assertion landed in Plan 10-02).

### From the operator state

- [ ] **Apex domain `bedeveloped.com` ownership confirmed** — operator (Hugh or Luke) has access to BeDeveloped's domain registrar in case Step 2 needs registrar verification.
- [ ] **Apex-vs-subdomain decision made** — Step 2 below records the decision explicitly; the planner-recommended default is **subdomain-only** (`baselayers.bedeveloped.com`).
- [ ] **Foreground browser session** (Chrome or Firefox) for the hstspreload.org web form.
- [ ] **Cutover window ~15-25 min active operator work** (single session, no calendar pacing within the window — but Step 5 is calendar-deferred outside the window).

---

## Step 1: Verify live HSTS header (~1 min)

```bash
curl -sI https://baselayers.bedeveloped.com | grep -i strict-transport-security
```

Expected output:

```
strict-transport-security: max-age=63072000; includeSubDomains; preload
```

The three load-bearing requirements per hstspreload.org are:

- `max-age` >= 31536000 (1 year). Our value is 63072000 (2 years) — exceeds.
- `includeSubDomains` token present.
- `preload` token present.

If any of these are absent OR `max-age < 31536000`, **STOP**. `firebase.json` is misconfigured. This is unexpected at Phase 10 close — Phase 3 landed the substrate, Plan 10-02 added the schema-test gate, every subsequent CI run guards it. If you see a regression here, suspect a Plan 10-04 rollback that also touched HSTS (improbable but possible). Investigate before continuing.

---

## Step 2: Apex-vs-subdomain decision (~5 min — operator decision)

Per `.planning/phases/10-csp-tightening-second-sweep/10-RESEARCH.md` §HSTS Preload Submission Procedure §Submission decision tree + Open Question 1, there are two paths the operator can choose.

| Option | Pros | Cons | Recommended? |
|--------|------|------|--------------|
| **Submit subdomain `baselayers.bedeveloped.com` only** | Bounded scope; reversible with effort (Chrome maintainers will accept a remove-from-preload request months later if the subdomain is decommissioned); does not commit any other subdomain of bedeveloped.com to HTTPS-only-forever | None for our use case | **YES — planner-recommended default** |
| Submit apex `bedeveloped.com` + `includeSubDomains` | Covers every existing and future subdomain in a single submission | **IRREVERSIBLE in practice** — every current and future subdomain of `bedeveloped.com` is forced to HTTPS forever in browser preload caches, breaking any email mail-server / marketing site / future service that does not yet support HTTPS. The apex submission carries the broader commitment. | NO — too broad for the current footprint |

**Operator decision (tick exactly one):**

- [ ] **Subdomain-only** (`baselayers.bedeveloped.com`) — planner-recommended default
- [ ] Apex+includeSubDomains (`bedeveloped.com`) — chose explicitly, accepting the irreversibility for every present and future bedeveloped.com subdomain

Record the chosen path in this runbook's `## Cutover Log` Row 1 + carry the same value into the Phase 10 PREFLIGHT log per the combined operator session bundle.

---

## Step 3: Submit at https://hstspreload.org (~5 min)

1. Open https://hstspreload.org in a clean browser session (cleared cache or incognito to avoid cached form state).
2. Enter the hostname chosen in Step 2 into the form (`baselayers.bedeveloped.com` if subdomain-only).
3. The site auto-checks the live `Strict-Transport-Security` header against the URL. Wait for all green checks. The expected checks (corresponding to Step 1 above) are:
   - `Strict-Transport-Security` header is sent.
   - `max-age` >= 31536000.
   - `includeSubDomains` directive present.
   - `preload` directive present.
   - HTTPS redirect at the entered hostname.
4. If all checks are green, click **"Submit"**.
5. Capture the post-submission confirmation page screenshot + the confirmation email (hstspreload.org also sends an email acknowledging submission). Save to `docs/evidence/phase-10-hsts-preload-submission.png`.

### Failure modes at Step 3

- **Apex-inconsistency caveat** (subdomain-only path): The form may complain that `bedeveloped.com` apex is HTTP-only or has inconsistent HSTS. This is non-blocking for a subdomain-only submission — Chrome's policy allows a subdomain-only preload entry to coexist with a non-HSTS apex. Ignore the warning IF apex serves HTTPS at all (even without HSTS); abort and escalate if apex is HTTP-only and the form blocks submission.
- **`max-age` token missing** (any path): Step 1 should have caught this. If it surfaces here, abort and re-verify `firebase.json`.
- **Subdomain unreachable**: re-run Step 1; if curl fails too, the Firebase Hosting cutover landed in Phase 3 has regressed (extremely unlikely).

---

## Step 4: Same-session status verification (~2 min)

After submission, hstspreload.org sets the domain to a `pending` state. Confirm via the public status endpoint:

```bash
curl -s "https://hstspreload.org/api/v2/status?domain=baselayers.bedeveloped.com"
```

Expected JSON:

```json
{"status": "pending", ...}
```

OR (depending on hstspreload.org's current state machine wording):

```json
{"status": "in-pending-list", ...}
```

Both indicate "submitted, awaiting Chrome preload-list update cycle" and constitute Step 4 PASS. Record the JSON response body in this runbook's `## Cutover Log` Row 2 + carry the same value into the Phase 10 PREFLIGHT log.

If the response shows `{"status": "unknown"}` immediately after Step 3, the submission did not stick — return to Step 3, re-submit, and re-verify.

---

## Step 5: Periodic listing-status check (calendar-deferred — weeks to months)

The Chrome HSTS preload list update cycle is published in the Chromium release cycle. Inclusion in the rolling preload cache typically takes weeks to months (the public docs at https://hstspreload.org/#removal acknowledge this calendar pacing). This step does NOT close in the Phase 10 operator session.

### Cadence

- Re-check listing status weekly. The simplest manual check is:

  https://hstspreload.org/?domain=baselayers.bedeveloped.com

  The page shows the live state for the domain (one of: unknown / pending / preloaded / pending-removal / removed).
- Alternatively, the same JSON endpoint from Step 4:

  ```bash
  curl -s "https://hstspreload.org/api/v2/status?domain=baselayers.bedeveloped.com"
  ```

### Closure path

When status flips to `preloaded`:

1. Capture screenshot → save to `docs/evidence/phase-10-hsts-preload-listed.png`.
2. Update `runbooks/phase-10-cleanup-ledger.md` Forward-Tracking Row F1 from PENDING to CLOSED (cross-reference the screenshot file + the date observed).
3. Optionally, append a maintenance entry to `SECURITY.md ## § HSTS Preload Status` noting the listing date for the Phase 11 evidence-pack owner.

Calendar-deferred. Forward-tracked. Substrate-honest disclosure (Pitfall 19): Phase 10 closes with Row 3 PENDING, not silently omitted.

---

## Cutover Log

> Operator-fill template. Substrate-honest disclosure (Pitfall 19): Step 3 status remains `PENDING` until Chrome propagates the listing. Phase 10 closes with rows 1 + 2 PASS + row 3 PENDING — Phase 11 (DOC-09 evidence pack) collects the final screenshot when listing arrives.

| Step | Action                                                            | T+0 (UTC)    | Result                       | Evidence                                                                 |
|------|-------------------------------------------------------------------|--------------|------------------------------|--------------------------------------------------------------------------|
| 1    | Verify live HSTS header + apex/subdomain decision recorded        | `{{ T+? }}`  | `{{ PASS / FAIL }}`          | curl output + Step 2 decision-tree tick                                  |
| 2    | hstspreload.org form submission for `{{ hostname }}`              | `{{ T+? }}`  | `{{ PASS / FAIL }}`          | `docs/evidence/phase-10-hsts-preload-submission.png` + confirmation email |
| 3    | hstspreload.org status = `preloaded` (Chrome propagation)         | `{{ T+? }}`  | `{{ PENDING / PASS }}`       | `docs/evidence/phase-10-hsts-preload-listed.png` (calendar-deferred)     |

Phase 10 close-gate: rows 1 + 2 PASS + row 3 PENDING. Row 3 forward-tracked in `runbooks/phase-10-cleanup-ledger.md` Row F1 with explicit closure path (weekly status re-check; flip F1 to CLOSED when status returns `preloaded`).

---

## Rollback Procedure

HSTS preload submissions can be removed by submitting a removal request at https://hstspreload.org/#removal. Removal also takes weeks-months to propagate through Chrome update cycles. Practically, a rollback is only relevant if:

- The subdomain is being decommissioned (so HTTPS-only-forever guarantee is no longer wanted).
- The submission was made in error (e.g. apex was submitted but operator intended subdomain).

Procedure:

1. Visit https://hstspreload.org/#removal.
2. Enter the domain and follow the removal-request flow.
3. Wait weeks-months for Chrome propagation.
4. Update `runbooks/phase-10-cleanup-ledger.md` Row F1 to reflect REMOVED state.

For a Phase 10-style rollback (the wave needs to be re-done because the soak failed), the rollback is NOT this step — it is the firebase.json key-flip revert documented in `runbooks/csp-enforcement-cutover.md ## Rollback Procedure`. The HSTS preload submission persists; only the CSP enforcement gets reverted.

---

## Citations

- HOST-06 (REQUIREMENTS.md) — "HSTS preload submitted to hstspreload.org once policy stable for >= 7 days"
- `.planning/phases/10-csp-tightening-second-sweep/10-RESEARCH.md` §HSTS Preload Submission Procedure + Open Question 1
- `.planning/phases/10-csp-tightening-second-sweep/10-PATTERNS.md` §File 6 (this runbook authored verbatim against Phase 9 monitors-bootstrap analog)
- https://hstspreload.org — Chrome HSTS preload list submission rules + removal policy
- OWASP ASVS L2 v5.0 V14.4 — HTTP Security Headers (HSTS preload directive)
- GDPR Art. 32(1)(a) — Pseudonymisation/encryption of personal data (HTTPS enforcement)
- SOC 2 CC6.7 — Restricted data transmission (HTTPS-only via preload)
- Pitfall 19 (substrate-honest disclosure) — Phase 10 closes with Row 3 PENDING, NOT silently marked PASS
