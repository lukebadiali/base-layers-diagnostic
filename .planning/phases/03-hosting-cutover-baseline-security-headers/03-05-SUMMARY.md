---
phase: 03-hosting-cutover-baseline-security-headers
plan: 05
subsystem: cutover-runbook
tags: [phase-3, cutover, dns, runbook, synthetic-smoke, operator-deferred]

requires:
  - phase: 03-hosting-cutover-baseline-security-headers
    plan: 01
    provides: 03-PREFLIGHT.md (registrar best-guess Namecheap; default URL bedeveloped-base-layers.web.app; PENDING-USER list)
  - phase: 03-hosting-cutover-baseline-security-headers
    plan: 02
    provides: firebase.json with /api/csp-violations rewrite to cspReportSink in europe-west2 (rewrite contract referenced verbatim by the runbook smoke checklist)
  - phase: 03-hosting-cutover-baseline-security-headers
    plan: 03
    provides: cspReportSink + rawBody fallback (Pitfall 3) the runbook Smoke 2 exercises end-to-end
  - phase: 03-hosting-cutover-baseline-security-headers
    plan: 04
    provides: ci.yml deploy job with the post-deploy header assertion (the runbook Prerequisites cite the green deploy run as a gate)
provides:
  - "runbooks/hosting-cutover.md (431 lines) — operator-executable cutover script with 6 required sections"
  - "03-PREFLIGHT.md ## Cutover Log skeleton (78-line append) — single record-keeping target the operator fills in on cutover day"
  - "Authoring-half closure of HOST-01 / HOST-02 / HOST-08 / FN-10 success criteria; live-execution half remains operator-deferred"
affects:
  - 03-06 (cleanup ledger row reads cutover_date from the Cutover Log)
  - Phase 6 (operator already has the registrar / DNS / SSL provisioning shape documented; Auth cutover reuses the runbook structure)
  - Phase 11 (DOC-09 evidence pack consumes ssl_provisioned_at + cutover_observed_headers + securityheaders_rating from the Cutover Log)

tech-stack:
  added: []
  patterns:
    - "Operator-deferred runbook: author once, execute once — runbook is the script for live execution, not an executor-runs-it-now artefact"
    - "PENDING-USER skeleton with inline comments: every field has format, valid-value list, and runbook-step pointer so the operator fills in correctly without re-reading the runbook"
    - "Cutover Log as single record-keeping target: rather than spreading observed state across multiple files, one ## Cutover Log block in 03-PREFLIGHT.md aggregates everything downstream plans need (cutover_date for day-14 trigger; ssl_provisioned_at + observed_headers + rating for DOC-09; cutover_complete as Phase 3 verification gate)"

key-files:
  created:
    - "runbooks/hosting-cutover.md (431 lines)"
    - ".planning/phases/03-hosting-cutover-baseline-security-headers/03-05-SUMMARY.md (this file)"
  modified:
    - ".planning/phases/03-hosting-cutover-baseline-security-headers/03-PREFLIGHT.md (78 lines appended — ## Cutover Log skeleton + reading guide for downstream plans)"

key-decisions:
  - "Authoring-only execution per operator's orchestrator-level checkpoint choice ('Author runbook now, I'll execute later'). NO smoke run, NO DNS change, NO Pages disable, NO Firebase Console mutation. The plan's success criterion 'Pre-cutover synthetic smoke proves end-to-end' is RESOLVED-BY-AUTHORING-ONLY: smoke procedure documented, operator runs it later."
  - "Registrar string in runbook is 'Namecheap (best-effort guess from NS records ns1/ns2.dns-parking.com)' — NOT the literal placeholder <REGISTRAR_FROM_PREFLIGHT> per Task 1 acceptance criterion, AND NOT a definitive 'Namecheap' assertion (03-PREFLIGHT.md still has registrar=PENDING-USER). The runbook Prerequisites checkbox makes the operator confirm + record the actual registrar in the Cutover Log."
  - "Day-14 Cleanup section explicitly states 'DO NOT delete the gh-pages branch before day 14' as a hard rule, with the trigger keyed to cutover_date+14 and conditioned on cutover_complete:yes (rolled-back skips deletion). Per CONTEXT.md D-03."
  - "Smoke 2 (legacy application/csp-report wire format) explicitly framed as the Pitfall 3 rawBody fallback exercise — the unit tests in 03-03 mock body parsing, so this end-to-end smoke is the only test of that branch against a real deployed function. T-3-pitfall-3 mitigation."
  - "Cutover Step 6 includes a post-cutover smoke from the custom domain — the unit tests + the pre-cutover smokes catch wrong handler behaviour, but only a custom-domain POST proves the firebase.json rewrite works through Firebase's edge for live DNS. T-3-2 mitigation."
  - "DNS Revert Procedure structured at 15-min total: 1 min Pages re-enable + 5 min DNS revert + 5 min propagation + 3 min log entry. Matches CONTEXT.md D-03 budget."

patterns-established:
  - "Operator-deferred plan execution: when an orchestrator checkpoint asks 'author now, execute later', the executor authors all written deliverables (runbook, log skeleton) but skips every command that mutates external state (DNS, Console, repo settings, deployed functions). Every action that requires external state is documented with the exact command, exact expected output, and exact failure-mode triage."
  - "Cutover Log skeleton as authored-not-filled artefact: PENDING-USER markers + inline comments + downstream-reader guide. Operator fills in; downstream plans read."

requirements-completed: []
  # Authoring half is delivered; live-execution half (operator runs the runbook)
  # closes HOST-01 / HOST-02 / HOST-08 / FN-10. None can be marked complete from
  # authoring alone — the orchestrator's verification gate at /gsd-verify-work 3
  # checks cutover_complete: yes in the Cutover Log before closing.

metrics:
  duration: ~10 min
  tasks_completed: 2 of 2 authoring tasks (Task 3 cutover-execution checkpoint deliberately skipped per operator's choice)
  files_created: 2 (hosting-cutover.md, this SUMMARY.md)
  files_modified: 1 (03-PREFLIGHT.md)
  atomic_commits: 2 (one per task)
  insertions: 509 lines (431 runbook + 78 PREFLIGHT append)
  deletions: 0 lines
  completed: 2026-05-06
---

# Phase 3 Plan 05: Hosting Cutover Runbook (Authoring-Only) Summary

**Authored `runbooks/hosting-cutover.md` (431 lines, 6 required sections covering Prerequisites + Pre-cutover Smoke Checklist + 10-step Cutover Steps + 15-minute DNS Revert Procedure + Day-14 Cleanup + Citations) and appended a `## Cutover Log` skeleton to `03-PREFLIGHT.md` (78 lines, PENDING-USER markers for `cutover_date` / `cutover_complete` / `cutover_observed_headers` / `securityheaders_rating` plus six other fields and a downstream-reader guide). NO live execution: no DNS change, no GitHub repo settings change, no Firebase Console interaction, no synthetic smoke run against a deployed function. The runbook is the script the operator follows when they execute the cutover later.**

## Performance

- Duration: ~10 min
- Started: 2026-05-06T20:53:24Z (worktree creation + base reset)
- Completed: 2026-05-06T21:03:02Z
- Tasks: 2 of 2 authoring tasks complete (Task 3 checkpoint:human-action deliberately skipped per operator's choice)
- Files created: 2 (`runbooks/hosting-cutover.md`, this SUMMARY.md)
- Files modified: 1 (`03-PREFLIGHT.md`)
- Atomic commits: 2 (one per task)

## Authoring vs Execution Status

This is a critical distinction for downstream readers and for the orchestrator's verification gate.

### RESOLVED-BY-AUTHORING-ONLY

These truths are fully delivered by this plan; no further work is required to close them:

- `runbooks/hosting-cutover.md` exists with all 6 required sections (Prerequisites, Pre-cutover Smoke Checklist, Cutover Steps, DNS Revert Procedure, Day-14 Cleanup, Citations) and the 10 cutover sub-steps (Step 1–Step 10) that map to D-02 same-session ~1h plan.
- The smoke checklist documents BOTH legacy (`application/csp-report`) AND modern (`application/reports+json`) wire formats with concrete `curl` commands, expected HTTP statuses (204 / 400 / 413 / 204 / 204), and the exact `gcloud logging read` filter expression for `resource.labels.service_name="cspreportsink"` in `europe-west2`.
- The Day-14 Cleanup section explicitly states `DO NOT delete the gh-pages branch before day 14` per D-03, conditioned on `cutover_complete: yes` (rolled-back skips deletion), with the calendar trigger as `cutover_date + 14 days`.
- `03-PREFLIGHT.md ## Cutover Log` skeleton exists with PENDING-USER markers for `cutover_date` / `cutover_complete` / `cutover_observed_headers` / `securityheaders_rating` plus six other fields and a downstream-reader guide.
- DNS Revert Procedure is structured at 15-min total per D-03 (1 min Pages re-enable + 5 min DNS revert + 5 min propagation + 3 min log entry).

### PENDING-OPERATOR-EXECUTION

These truths from the plan's `<must_haves>` block CANNOT be resolved by authoring alone — they require live execution by the operator after this plan completes:

- **"Pre-cutover synthetic smoke proves end-to-end"** — the runbook documents the procedure (Smokes 1–5 with curl + gcloud logging filter expressions), but no smoke has been run against the deployed function. The function may not even be deployed yet (depends on whether the operator has pushed 03-04's commit to main and the deploy job has run green). The runbook's Prerequisites checklist gates this.
- **"Pre-cutover smoke covers BOTH legacy AND modern wire formats — the rawBody Pitfall 3 fallback is exercised here"** — same as above. The procedure is documented; the rawBody fallback exercise (Smoke 2) is procedurally specified but has not been executed against a live function.
- **"Production cutover (CNAME flip + GH-Pages disable) executes per D-02 same-session ~1h plan and is logged into 03-PREFLIGHT.md addendum with cutover_date, cutover_complete, and cutover_observed_headers result"** — the addendum block exists with PENDING-USER markers; values are filled by the operator post-execution.
- **"securityheaders.com manual rating ≥ A confirmed on the live custom domain (HOST-08 manual verification, recorded in PREFLIGHT addendum)"** — the runbook Step 7 directs the operator to securityheaders.com; the PREFLIGHT marker `securityheaders_rating: PENDING-USER` waits for the operator's value.
- **"GH-Pages serving is set to None in repo settings; gh-pages branch + any Pages workflows are RETAINED (not deleted) per D-03 — 14-day rollback window"** — runbook Step 8 directs the operator to GitHub repo Settings → Pages; no repo settings change has been made.

### Why authoring-only is correct here

The operator chose "Author runbook now, I'll execute later" at the orchestrator-level checkpoint. The plan's autonomous Wave-4 task (Task 2: pre-cutover synthetic smoke) and the Wave-5 checkpoint (Task 3: production cutover) both require external state mutation that Claude cannot perform without the operator's interactive auth + Console + DNS access. Documenting them precisely is the maximum value the executor can deliver in operator-deferred mode.

The orchestrator's verification gate at `/gsd-verify-work 3` reads `cutover_complete:` from the Cutover Log to confirm closure. As long as that field is `PENDING-USER`, Phase 3 verification cannot pass HOST-01 / HOST-02 / HOST-08 — which is the correct compliance posture (do not claim a control is in place when it isn't).

## Accomplishments

### `runbooks/hosting-cutover.md` shape (431 lines)

- **Prerequisites** (lines 13–47): three sub-sections — From 03-PREFLIGHT.md (seven PENDING-USER items resolved), From the build pipeline (CI deploy job green + cspReportSink deployed), From the Pre-cutover Smoke Checklist (all five smokes pass), Cutover window (~1h scheduled).
- **Pre-cutover Smoke Checklist** (lines 49–183): five smokes (modern, legacy/Pitfall-3, wrong content-type, oversized body, extension origin) each with concrete curl command + expected HTTP status + gcloud logging verification filter + failure-mode triage. Plus a synthetic-smoke result block template the operator appends to 03-PREFLIGHT.md.
- **Cutover Steps** (lines 185–331): 10 sub-steps over the ~1h window — verify smokes from default URL, add custom domain in Console, get TXT + A/AAAA from Firebase, update DNS at registrar, wait for SSL provisioning, verify smoke from custom domain, verify securityheaders.com rating, disable GitHub Pages, update Cutover Log, raise TTL.
- **DNS Revert Procedure** (lines 333–369): 4 sub-steps — re-enable Pages, revert DNS at registrar, wait for propagation, update Cutover Log with rolled-back values. 15-min total per D-03 budget.
- **Day-14 Cleanup** (lines 371–397): conditioned on `cutover_complete: yes`, with the explicit "DO NOT delete the gh-pages branch before day 14" rule, plus delete-branch + delete-Pages-workflow commands + cleanup-ledger close-out commit message.
- **Citations** (lines 399–431): D-01 / D-02 / D-03 / HOST-01 / HOST-02 / HOST-08 / FN-10 / T-3-2 / Pitfall 3 / 03-RESEARCH.md sections + external Firebase + GitHub Pages docs + OWASP ASVS + ISO 27001 + SOC 2 + GDPR Art. 32 framework citations.

### `03-PREFLIGHT.md ## Cutover Log` skeleton (78 lines appended)

- 10 fields with PENDING-USER markers: `cutover_date`, `cutover_complete`, `cutover_observed_headers`, `securityheaders_rating`, `ssl_provisioned_at`, `synthetic_csp_e2e_seen_in_cloud_logging`, `post_cutover_smoke_blockedUri`, `rollback_reason`, `rollback_completed_at`, `notes`.
- Each field has an inline comment documenting format (e.g. `YYYY-MM-DD HH:MM TZ`), valid values (e.g. `yes | rolled-back`), and the runbook step that produces it (e.g. "Set to the moment Step 8 GH-Pages disable was saved").
- Reading guide for downstream plans: which fields 03-06 reads (cutover_date for day-14 trigger), which Phase 11 DOC-09 reads (ssl_provisioned_at + observed_headers + rating), which `/gsd-verify-work 3` reads (cutover_complete as Phase 3 verification gate).

## Atomic Commit List

Per the plan's atomic-commit convention, this plan made exactly 2 commits.

1. **`0579818`** — `docs(03-05): runbooks/hosting-cutover.md (Wave 4 deliverable)` — 1 file changed, 431 insertions.
2. **`61c0608`** — `docs(03-05): append Cutover Log skeleton to 03-PREFLIGHT.md (Wave 4)` — 1 file changed, 78 insertions.

Plan metadata commit (this SUMMARY.md) follows in the next commit.

## Hand-offs

### To 03-06-PLAN.md (cleanup ledger + branch-protection)

- **Cleanup ledger row to add:** `Phase 3 GH-Pages rollback substrate; cutover_date + 14d = <date>` — populate `<date>` from `03-PREFLIGHT.md ## Cutover Log → cutover_date` after the operator executes the cutover. If `cutover_complete: rolled-back`, the row is added with status "deferred — cutover not yet successful" and the calendar date stays future-tense.
- **No SECURITY.md change in 03-06** — `## § Hosting & Deployment` already landed in 03-04; no new section in 03-06.
- **Branch protection update:** 03-04-SUMMARY.md flagged this for 03-06 (Pitfall A pattern: add `deploy` + `preview` to required-status-checks AFTER first green deploy run). Independent of 03-05's authoring; can proceed regardless of cutover state.

### To Phase 4 (modular split)

- **T-3-meta-csp-conflict forward-concern:** Phase 4 should add a CI check that `index.html` has no `<meta http-equiv="Content-Security-Policy">` regression. 03-PREFLIGHT.md `## index.html meta-CSP scan` confirmed absence today; if the modular split re-introduces one, the existing schema test in 03-02 does not catch it (it only validates `firebase.json`). Suggested location: `tests/index-html-no-meta-csp.test.js`-style check, or a `.husky/pre-commit` grep. Recorded in 03-06's cleanup ledger row as a Phase 4 forward-looking concern.

### To Phase 11 (PRIVACY.md DOC-09 evidence pack)

- The Cutover Log fields `ssl_provisioned_at`, `cutover_observed_headers`, and `securityheaders_rating` are the canonical evidence values Phase 11 DOC-09 consumes. The runbook also notes a screenshot path `docs/evidence/phase-3-securityheaders-rating.png` — the screenshot collection itself is Phase 11's job; this plan only documents the path.

### To the operator (when they execute)

- The runbook is the script. Open `runbooks/hosting-cutover.md` in another window; tick off the Prerequisites checklist; run the Pre-cutover Smoke Checklist; execute Cutover Steps 1–10; fill in `03-PREFLIGHT.md ## Cutover Log`; commit with `chore(03-05): record cutover log in 03-PREFLIGHT.md`. If anything goes wrong, follow §DNS Revert Procedure and record `cutover_complete: rolled-back` instead.

## Deviations from Plan

None — the plan executed exactly as the operator-deferred mode specified.

The plan-internal verifier (`runbooks/hosting-cutover.md` substring check against 33 required strings — `# Hosting Cutover Runbook` through `Pitfall 3`) passes cleanly. The `03-PREFLIGHT.md` Cutover Log verifier (5 PENDING-USER markers) passes cleanly.

The deviation rules (Rules 1–4 in the executor flow) were not engaged because the operator-deferred mode constrains the executor to authoring only — there is no live state to discover bugs, missing functionality, or blockers in. The runbook's failure-mode triage (e.g. "If Smoke 2 returns 204 but Cloud Logging is empty: Pitfall 3 rawBody fallback failed; inspect cspReportSink.ts") encodes the deviation logic AS PROCEDURE for the operator's later execution, which is the correct shape for an authored-not-executed deliverable.

## Authentication Gates

None encountered during authoring. The plan's intrinsic authentication gates are owned by the operator post-execution:

1. **gcloud auth login** — required for the smoke checklist's gcloud logging read commands and the optional gcloud functions describe verification.
2. **Firebase Console session** — required for Step 2 (add custom domain).
3. **Registrar UI session** — required for Step 4 (TXT + A/AAAA records).
4. **GitHub repo settings access** — required for Step 8 (Pages → None).

All four gates are documented in the runbook Prerequisites section as preconditions; none can be bypassed by Claude.

## Issues Encountered

### Write-tool path resolution (recorded for tooling teams; no correctness impact)

The first attempt to write `runbooks/hosting-cutover.md` used the absolute path under the repo root (`C:\Users\hughd\OneDrive\Desktop\base-layers-diagnostic\runbooks\hosting-cutover.md`). The Write tool succeeded but the file landed in main's working tree, NOT in the worktree. `git status` from the worktree was empty.

Diagnosis: this executor runs inside a git worktree at `.claude\worktrees\agent-a8fabb179d564f0bc`; the worktree's working tree is at that absolute path. Writes need to be addressed to the worktree-prefixed absolute path, not the repo-root absolute path. The Write tool does not normalise CWD against worktree state.

Resolution: removed the stray repo-root copy with `rm`, retried Write with the worktree-prefixed path. Second attempt landed correctly inside the worktree (`git status --short` showed `?? runbooks/hosting-cutover.md` as expected).

This is a tooling friction note, not a deviation from plan content. The final state of both authored files (runbook + Cutover Log skeleton) is correct, in the right worktree, and committed.

### Read-before-edit guard tripped twice

The runtime's PreToolUse:Edit guard fired twice during authoring — once for `runbooks/hosting-cutover.md` (after my Edit succeeded but the guard re-fired defensively), and once for `03-PREFLIGHT.md` (because the earlier Read was via the repo-root path, not the worktree-prefixed path). Both were resolved by re-reading the file from the worktree-prefixed path before retrying the Edit. No correctness impact; only one extra Read call per file. The Edit tool's `success` outcome was preserved both times — content landed correctly on first Edit, and the guard's defensive re-read confirmed it.

## T-3-pitfall-3 Mitigation Recap (the load-bearing reason this plan exists)

Pitfall 3 (firebase-functions v7 body-parser may not auto-recognise `application/csp-report` content-type) is the highest-risk untested branch in the function's unit tests — the unit tests in 03-03 mock body parsing entirely. The Phase 3 mitigation chain is:

1. **Pattern in source code:** `cspReportSink.ts` includes a `req.rawBody?.toString("utf8") + JSON.parse(...)` fallback after the content-type allowlist check (03-03-PLAN.md). If the body-parser auto-parsed `application/csp-report`, `req.body` is populated and the fallback is harmless. If body-parser did not auto-parse, the fallback recovers the body from `req.rawBody`.
2. **Procedural test in this plan's runbook:** Smoke 2 POSTs a real legacy-format report at the deployed function and verifies a Cloud Logging entry appears within 30s. If the curl returns 204 but Cloud Logging is empty, the rawBody fallback failed silently — the runbook documents this exact failure-mode triage path.
3. **Production verification post-cutover:** Step 6 of the cutover steps re-runs Smoke 1 (modern format) from the custom domain. If T-3-2 (rewrite shadowing) AND T-3-pitfall-3 (rawBody fallback) are both green, the function is end-to-end functional through Firebase's edge for live DNS.

The pre-cutover smoke (this plan's Smoke 2) is the FIRST and ONLY end-to-end test of the rawBody fallback against a real deployed function. Ship-stopping if it fails — the runbook explicitly says "Do NOT proceed to cutover until Smoke 2 produces a Cloud Logging entry."

## Self-Check

### Created files exist

- `runbooks/hosting-cutover.md` — FOUND (431 lines, 28217 bytes per disk listing)
- `.planning/phases/03-hosting-cutover-baseline-security-headers/03-05-SUMMARY.md` — FOUND (this file)

### Modified files exist and contain expected content

- `.planning/phases/03-hosting-cutover-baseline-security-headers/03-PREFLIGHT.md` — FOUND; contains `## Cutover Log`, `cutover_date: PENDING-USER`, `cutover_complete: PENDING-USER`, `cutover_observed_headers: PENDING-USER`, `securityheaders_rating: PENDING-USER`, plus six other PENDING-USER fields (verified by `node -e ...` substring check — output: `OK`).

### Commits exist

- `0579818` (`docs(03-05): runbooks/hosting-cutover.md (Wave 4 deliverable)`) — FOUND in `git log`.
- `61c0608` (`docs(03-05): append Cutover Log skeleton to 03-PREFLIGHT.md (Wave 4)`) — FOUND in `git log`.

### Plan-internal automated verifier

- `runbooks/hosting-cutover.md` substring check (33 required strings — `# Hosting Cutover Runbook` through `Pitfall 3`) — output: `OK`.
- `03-PREFLIGHT.md` Cutover Log substring check (5 PENDING-USER markers) — output: `OK`.

### Plan-level success criteria match

- [x] runbooks/hosting-cutover.md exists with all six required sections (Prerequisites, Pre-cutover Smoke Checklist, Cutover Steps, DNS Revert Procedure, Day-14 Cleanup, Citations).
- [x] Smoke checklist documents BOTH legacy (application/csp-report) AND modern (application/reports+json) wire formats with concrete curl commands and Cloud Logging filter.
- [x] Cutover steps follow D-02 same-session ~1h plan (Steps 1–10 over ~60 min active + up to 24h SSL provisioning).
- [x] DNS revert procedure ≤15 min (1 + 5 + 5 + 3 = 14 min total).
- [x] Day-14 cleanup section explicitly says "DO NOT delete gh-pages branch before day 14" per D-03.
- [x] 03-PREFLIGHT.md gains ## Cutover Log section with PENDING-USER markers for cutover_date / cutover_complete / cutover_observed_headers / securityheaders_rating.
- [x] Each task atomically committed with conventional prefix (`docs(03-05): ...`).
- [x] SUMMARY.md committed before return (next commit).
- [x] SUMMARY explicitly states which truths are RESOLVED-BY-AUTHORING-ONLY vs PENDING-OPERATOR-EXECUTION (see "Authoring vs Execution Status" section above).
- [x] No live commands run; no DNS/Console changes; no smoke executed.

## Self-Check: PASSED

## Next Phase Readiness

- **03-06-PLAN.md (cleanup ledger + branch-protection)** is unblocked from 03-05's perspective. Two cleanup-ledger rows are queued (the 14-day GH-Pages substrate row + the Phase 7 OIDC SA over-grant row from 03-04); 03-06 owns adding both. Branch-protection bootstrap is independent of cutover state.
- **Phase 3 verification (`/gsd-verify-work 3`)** is BLOCKED on the operator executing the runbook. Until `03-PREFLIGHT.md ## Cutover Log → cutover_complete:` is `yes`, HOST-01 / HOST-02 / HOST-08 cannot close. The orchestrator should track this as an open item with the operator. ROADMAP.md should reflect "Phase 3: 4/6 plans complete; cutover authoring done; cutover execution pending operator".
- **No blockers introduced for the orchestrator's wave-4 merge-back step.** Only 1 new file (`runbooks/hosting-cutover.md`) and 1 modified file (`03-PREFLIGHT.md`) plus this SUMMARY.md. No conflicts expected with parallel-merged files from 03-06.

---

*Phase: 03-hosting-cutover-baseline-security-headers*
*Plan: 05 (Wave 4 — operator-deferred authoring-only)*
*Completed: 2026-05-06*
