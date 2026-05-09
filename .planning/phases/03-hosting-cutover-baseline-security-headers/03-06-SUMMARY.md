---
phase: 03-hosting-cutover-baseline-security-headers
plan: 06
subsystem: phase-close-out
tags: [phase-3, cleanup-ledger, branch-protection, audit-index, doc-10, phase-close-out, operator-deferred]

requires:
  - phase: 03-hosting-cutover-baseline-security-headers
    plan: 02
    provides: SECURITY.md § HTTP Security Headers + § CSP (Report-Only) sections (Phase 3 Plan 02 commits e7a3e06 + 03f4c07) — backfilled with SHAs in this plan
  - phase: 03-hosting-cutover-baseline-security-headers
    plan: 04
    provides: SECURITY.md § Hosting & Deployment section (Phase 3 Plan 04 commit 49afecb) + ci.yml deploy + preview job names (registered in GitHub check registry by first green run, post-cutover) — backfilled with SHA in this plan; check names referenced verbatim in branch-protection runbook
  - phase: 03-hosting-cutover-baseline-security-headers
    plan: 05
    provides: 03-PREFLIGHT.md ## Cutover Log skeleton with cutover_date PENDING-USER (read by the cleanup ledger row's day-14 trigger logic in this plan)
provides:
  - "runbooks/phase-4-cleanup-ledger.md +2 rows: 'Phase 3 GH-Pages rollback substrate' (PENDING-USER day-14 trigger keyed on cutover_date) + 'Phase 3 — meta-CSP regression guard' (Phase 4 forward-task with tests/index-html-meta-csp.test.js hardening target)"
  - "runbooks/branch-protection-bootstrap.md +2 required-status-checks: 'Deploy to Firebase Hosting' + 'Deploy PR Preview Channel' with explicit Pitfall A pattern (DO NOT enable until first green deploy + preview runs register the names in GitHub's check registry)"
  - "SECURITY.md ## § Phase 3 Audit Index (9 framework citation rows mapping each citation to section / artefact / verification / commit SHA) + commit-SHA backfill into existing §HTTP Security Headers / §CSP (Report-Only) / §Hosting & Deployment evidence bullets"
  - "Phase 3 close-out hygiene complete: T-3-4 (GH-Pages day-14) + T-3-meta-csp-conflict (Phase 4 CI guard) calendar/forward-task mitigations tracked; auditor-walkable Phase 3 entry-point landed for Phase 11 DOC-09"
affects:
  - "Phase 4 (CODE-01): cleanup ledger row 'Phase 3 — meta-CSP regression guard' adds tests/index-html-meta-csp.test.js as a forward task"
  - "Phase 7 (FN-04): cleanup-ledger 'Phase 3 OIDC SA over-grant' row from 03-04 SUMMARY hand-off remains open; this plan's Phase 3 Audit Index references the deferral"
  - "Phase 10 (HOST-06 / HOST-07): Phase 3 Audit Index lists Phase 10 as the cross-phase plug-in for CSP enforcement and HSTS preload submission"
  - "Phase 11 (DOC-09): docs/CONTROL_MATRIX.md walks the Phase 3 Audit Index row-by-row"
  - "Phase 12 (Audit Walkthrough): SECURITY_AUDIT_REPORT.md cites the audit index for Phase 3 Pass/Partial/N/A entries"

tech-stack:
  added: []
  patterns:
    - "Authoring-only execution per operator's 'author runbook now, execute later' choice (consistent with 03-05's pattern)"
    - "PENDING-USER explicit-procedure pattern: cleanup ledger row's Re-evaluation date + branch-protection runbook's first-green-run dates carry PENDING-USER tokens with the precise replacement procedure documented inline"
    - "Audit Index as one-stop auditor pointer: rather than spreading framework citations across 3 SECURITY.md sections, a single ## § Phase 3 Audit Index sub-block tabulates citation -> section -> artefact -> verification -> commit SHA"
    - "Commit-SHA backfill as additive (not placeholder-replace): existing Wave 2/3 prose did not carry literal placeholders; SHAs spliced in alongside the existing 'Phase 3 Plan NN' references"

key-files:
  created:
    - ".planning/phases/03-hosting-cutover-baseline-security-headers/03-06-SUMMARY.md (this file)"
  modified:
    - "runbooks/phase-4-cleanup-ledger.md (+2 rows in §Out-of-band soft-fail entries table — Phase 3 GH-Pages rollback substrate + Phase 3 — meta-CSP regression guard)"
    - "runbooks/branch-protection-bootstrap.md (+2 required-status-checks in payload + Pitfall A preamble + ## Apply via GitHub UI section + 5 -> 7 contexts in Verification + UI verification sections + first-green-run PENDING-USER markers)"
    - "SECURITY.md (commit-SHA backfill at 5 evidence bullet locations + new ## § Phase 3 Audit Index sub-block with 9 framework citation rows + cross-phase plug-ins + forward-looking concerns + index self-check)"

key-decisions:
  - "Operator-deferred execution per the special instruction (consistent with 03-05): all deliverables that do NOT depend on cutover_date or first-green-deploy-run are authored fully; deliverables that DO depend on those operator-only events carry PENDING-USER tokens with the precise replacement procedure documented inline. This applies to: cleanup ledger Re-evaluation date for the GH-Pages substrate row (cutover_date + 14 days), and branch-protection runbook first-green-run dates."
  - "No SECURITY.md placeholders existed at session start. The plan's Task 2 acceptance criteria envisaged literal \${commit-sha-of-Task-1} / \${commit-sha-of-this-task} placeholders to backfill, but Wave 2/3 prose was already SHA-aware (referenced sections by 'Phase 3 Plan NN' rather than placeholders). Per the special instruction's escape hatch — 'pick the right primitive: either replace placeholders OR add a Phase 3 Audit Index sub-block that lists section -> commit SHA -> framework citations explicitly' — chose BOTH primitives: (a) splice SHAs into the existing prose at 5 evidence bullet locations for traceability, and (b) add the audit index as the canonical auditor entry-point. Recorded as a finding rather than mutating perfectly-good prose."
  - "Cleanup ledger 'GH-Pages rollback substrate' row uses PENDING-USER for the Re-evaluation date (NOT a placeholder ISO date). 03-PREFLIGHT.md ## Cutover Log carries cutover_date: PENDING-USER (operator fills in post-cutover); deriving any concrete day-14 ISO date here would invent state. The row's Hardening target cell points the operator at runbooks/hosting-cutover.md §Day-14 Cleanup for the deletion command sequence."
  - "Cleanup ledger 'meta-CSP regression guard' row uses Phase 4 (CODE-01) as the Re-evaluation date (NOT PENDING-USER). The row is forward-looking — Phase 4 closes it when the modular split lands; no operator-only event gates it, so a concrete cell value is correct."
  - "Branch-protection runbook update extends the existing 5-context payload to 7 contexts AND adds a separate 'Phase 3 additions — Pitfall A pattern' callout block with the operator-action procedure. Both representations exist (the inline payload edit + the dedicated callout) so a future operator who reads only the payload sees 7 contexts; one who reads the runbook narrative sees the explicit Pitfall A precondition."
  - "Task 3 (checkpoint:human-verify — apply branch protection in GitHub UI) deliberately skipped per operator-deferred mode. The runbook update is the AUTHORING half; the actual GitHub Settings -> Branches mutation is documented as PENDING-USER with the exact click-path. The orchestrator's verification gate at /gsd-verify-work 3 will catch this if Phase 3 close-out requires the rule applied; in that case the operator runs the gh CLI command in the runbook's ## Command section or follows the ## Apply via GitHub UI section."

requirements-completed:
  # Phase 3 close-out hygiene only. The phase's HOST-01 / HOST-02 / HOST-08
  # requirements close at the orchestrator's /gsd-verify-work 3 gate, which
  # reads cutover_complete in 03-PREFLIGHT.md ## Cutover Log. This plan
  # adds the close-out documentation that lets the verifier confirm the
  # phase is auditor-ready, but does not mark the requirements complete
  # itself (that is the verifier's call after the cutover).
  - DOC-10  # SECURITY.md incremental for Phase 3 closes here

metrics:
  duration: ~25 min
  tasks_completed: 2 of 3 (Task 1 + Task 2 atomically committed; Task 3 deferred per operator-deferred mode)
  files_created: 1 (this SUMMARY.md)
  files_modified: 3 (runbooks/phase-4-cleanup-ledger.md + runbooks/branch-protection-bootstrap.md + SECURITY.md)
  atomic_commits: 2 (one per non-checkpoint task)
  insertions: ~115 lines (cleanup ledger +2 rows + branch protection +75 lines + SECURITY.md +40 lines net)
  deletions: ~9 lines (5 contexts -> 7 contexts in branch-protection prose; SHA backfill replacements)
  completed: 2026-05-06
---

# Phase 3 Plan 06: Phase Close-Out (Cleanup Ledger + Branch Protection + Audit Index) Summary

**Phase 3 close-out hygiene complete — two cleanup ledger rows track T-3-4 (GH-Pages day-14 cleanup, PENDING-USER on cutover_date) and T-3-meta-csp-conflict (Phase 4 forward task with tests/index-html-meta-csp.test.js hardening target); branch-protection runbook documents the Pitfall A procedure for adding Deploy + Preview to required-status-checks (PENDING-USER on first green run); SECURITY.md gains commit-SHA backfill at 5 evidence bullet locations plus a new ## § Phase 3 Audit Index sub-block with 9 framework citation rows that Phase 11 DOC-09 will walk row-by-row to populate docs/CONTROL_MATRIX.md. Per the operator's 'author runbook now, execute later' choice (consistent with 03-05), Task 3 (apply branch protection in GitHub UI) is deferred — the runbook is the script the operator follows post-cutover.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-06T22:00:00Z (worktree creation + base reset to fb5db24)
- **Completed:** 2026-05-06T22:25:00Z
- **Tasks:** 2 of 3 complete (Task 1 + Task 2 atomically committed; Task 3 checkpoint:human-verify deliberately skipped per operator-deferred mode)
- **Files created:** 1 (this SUMMARY.md)
- **Files modified:** 3 (runbooks/phase-4-cleanup-ledger.md, runbooks/branch-protection-bootstrap.md, SECURITY.md)
- **Atomic commits:** 2 (per the plan's atomic-commit convention)

## Authoring vs Execution Status

This plan inherits the operator-deferred mode from 03-05. Distinguishing between RESOLVED-BY-AUTHORING-ONLY and PENDING-OPERATOR-EXECUTION is load-bearing for Phase 11 (DOC-09) traceability and for `/gsd-verify-work 3`.

### RESOLVED-BY-AUTHORING-ONLY

These truths are fully delivered by this plan; no further work is required to close them:

- **`runbooks/phase-4-cleanup-ledger.md` +2 rows.** Both rows exist in the §Out-of-band soft-fail entries table. The "Phase 3 — meta-CSP regression guard" row is fully authored (Re-evaluation date = "Phase 4 (CODE-01)"; Hardening target = `tests/index-html-meta-csp.test.js`); no PENDING-USER field. The "Phase 3 GH-Pages rollback substrate" row is authored except for the Re-evaluation date (which is a PENDING-USER token by design — see below).
- **`runbooks/branch-protection-bootstrap.md` updated.** Two new required-status-checks (`Deploy to Firebase Hosting`, `Deploy PR Preview Channel`) added to the existing 5-context payload, total 7. New ## Apply via GitHub UI section authored. New "Phase 3 additions — Pitfall A pattern" callout block authored with the operator's exact 4-step procedure. Existing Verification + UI verification sections updated to reflect 7 contexts.
- **`SECURITY.md` ## § Phase 3 Audit Index sub-block exists.** 9 framework citation rows (V14.4 x2 + V14.7 + A.13.1.3 + A.13.1 + A.5.7 + CC6.6 + CC8.1 + Art. 32) mapping citation -> section -> artefact -> verification -> commit SHAs. Cross-phase plug-ins (Phase 4 / Phase 10 / Phase 11 / Phase 12) listed. Forward-looking concerns (T-3-4 + T-3-meta-csp-conflict + T-3-5) cross-referenced to the cleanup ledger rows. Index self-check tied to those rows being open.
- **`SECURITY.md` commit-SHA backfill complete.** 5 evidence bullet locations now carry the relevant Phase 3 commit SHAs:
  - §HTTP Security Headers — `e7a3e06` (firebase.json) + `03f4c07` (schema test) + `49afecb` (CI deploy assertion)
  - §CSP (Report-Only) — `e7a3e06` (firebase.json CSP-RO) + `03f4c07` (schema test)
  - §Hosting & Deployment — `49afecb` x2 (deploy + preview jobs)
- **DOC-10 incremental for Phase 3** closes here. The audit index is the canonical Phase 3 entry-point that Phase 11 (DOC-09) walks for `docs/CONTROL_MATRIX.md`.

### PENDING-OPERATOR-EXECUTION

These truths CANNOT be resolved by authoring alone — they require external state mutation by the operator after this plan completes:

- **Cleanup ledger "Phase 3 GH-Pages rollback substrate" Re-evaluation date.** The row's Re-evaluation date cell is `PENDING-USER (compute as cutover_date + 14 days...)`. 03-PREFLIGHT.md `## Cutover Log → cutover_date:` is `PENDING-USER` until the operator executes the cutover. Decision rule (recorded in the row): if `cutover_complete: yes`, replace the PENDING-USER token with the literal ISO date `cutover_date + 14 days`; if `cutover_complete: rolled-back`, replace with the literal string `TBD — cutover rolled back; update when cutover succeeds`. The operator updates this row in the same commit that records the cutover outcome (`chore(03): record cutover log in 03-PREFLIGHT.md`).
- **Branch-protection rule applied in GitHub UI** (Task 3 of this plan). The runbook is the script; applying the rule is the operator's interactive UI step. Two preconditions:
  1. First green deploy run on `main` must have completed AND `Deploy to Firebase Hosting` must appear in the GitHub check registry (`gh api ... --jq '.check_runs[].name'`).
  2. First green PR preview run must have completed AND `Deploy PR Preview Channel` must appear in the registry.
  Both conditions can only be satisfied AFTER 03-05's cutover lands the production deploy. The runbook documents the exact gh CLI payload (`## Command` section) and the GitHub UI click-path (`## Apply via GitHub UI` section). First-green-run dates are recorded as PENDING-USER markers in the runbook.
- **Branch-protection first-green-run date stamps.** Two PENDING-USER markers in `runbooks/branch-protection-bootstrap.md` for the operator to fill in: one for `Deploy to Firebase Hosting` (post-cutover), one for `Deploy PR Preview Channel` (first PR preview run after the deploy job lands).

### Why authoring-only is correct here

The operator's orchestrator-level checkpoint chose "Author runbook now, I'll execute later" — consistent with 03-05's identical decision for the cutover runbook. Task 3 (checkpoint:human-verify) requires the operator to interactively edit the GitHub repo settings; Claude cannot perform this without a UI session. The runbook update is the AUTHORING deliverable; applying the rule is the EXECUTION deliverable. Both are necessary for Phase 3 close-out to be auditor-credible — the runbook is the evidence that the procedure exists and was followed; the applied rule is the evidence that the procedure was executed. This plan delivers the first half; the operator delivers the second half post-cutover.

The orchestrator's verification gate at `/gsd-verify-work 3` will catch any Phase 3 close-out gap. If branch-protection-applied is required for Phase 3 sign-off, the verifier reads `runbooks/branch-protection-bootstrap.md` for the first-green-run markers (still PENDING-USER post-this-plan) and reports the gap. Phase 3 verification can pass HOST-01 / HOST-02 / HOST-08 without the branch protection rule applied — the rule is a Pitfall A close-out, not a phase success criterion.

## Accomplishments

### `runbooks/phase-4-cleanup-ledger.md` — 2 rows added

Both rows append to the §Out-of-band soft-fail entries table (after the existing `gitleaks/gitleaks-action@ff98106e` row).

**Row 1: Phase 3 GH-Pages rollback substrate** (5-column markdown table row)

- **Source:** `Phase 3 GH-Pages rollback substrate (gh-pages branch + any Pages workflow file)`
- **Why soft-fail:** D-03 14-day rollback retention; substrate is dormant (Pages disabled in repo settings) but re-deployable. T-3-4 mitigation.
- **Re-evaluation date:** `PENDING-USER (compute as cutover_date + 14 days...)` — full PENDING-USER procedure documented inline in the cell, including the rolled-back fallback.
- **Hardening target:** Delete `gh-pages` branch (`git push origin --delete gh-pages`) + delete Pages workflow file in `.github/workflows/`; commit `chore(03): delete GH-Pages rollback substrate (day 14 — cutover_date + 14)`. Points at `runbooks/hosting-cutover.md` §Day-14 Cleanup section for the precise command sequence. T-3-4 mitigation.

**Row 2: Phase 3 — meta-CSP regression guard** (5-column markdown table row)

- **Source:** `Phase 3 — meta-CSP regression guard`
- **Why soft-fail:** Phase 3 (`03-PREFLIGHT.md ## index.html meta-CSP scan`) confirmed `index.html` has no `<meta http-equiv="Content-Security-Policy">` tag (T-3-7 mitigated by absence). Phase 4's modular split touches `index.html`; without a CI guard the tag could be re-introduced silently and conflict with the header CSP shipped in `firebase.json`. T-3-meta-csp-conflict mitigation.
- **Re-evaluation date:** `Phase 4 (CODE-01)`
- **Hardening target:** Add CI test `tests/index-html-meta-csp.test.js` that fails if `index.html` contains `http-equiv="Content-Security-Policy"`. Mirror the schema-test pattern from `tests/firebase-config.test.js` (read file, regex-assert absence, `expect(...).toBe(false)`). Optionally also add a `.husky/pre-commit` grep as a pre-CI gate. Close this row when Phase 4 lands the test.

### `runbooks/branch-protection-bootstrap.md` — 4 changes

1. **`## Prerequisites` extended** — adds an entry documenting the Pitfall A precondition for the Phase 3 additions: both first green deploy run AND first green PR preview run must have registered the names in GitHub's check registry; do NOT enable until then.
2. **`## Command` payload extended** — 2 new `--field "required_status_checks[contexts][]=..."` lines for `Deploy to Firebase Hosting` and `Deploy PR Preview Channel` immediately after the 5 Phase-1 contexts.
3. **New "Phase 3 additions — Pitfall A pattern (2026-05-06)" callout block** — documents the source of each check name (deploy job + preview job in ci.yml, both landed in commit `49afecb`); operator action 4-step procedure (gh run list to confirm first green deploy + preview runs, gh api to confirm names in registry, then apply payload or use UI); first-green-run dates recorded as PENDING-USER markers.
4. **New `## Apply via GitHub UI` section** — explicit click-path for the GitHub UI mutation (Settings -> Branches -> Edit rule for main -> Require status checks -> add the 2 new contexts -> Save -> confirm 7 total -> re-take evidence screenshot per `## Evidence screenshot`).
5. **`## Verification` + `## UI verification` updated** — 5 contexts -> 7 contexts (5 Phase-1 + 2 Phase-3) in both prose locations.

### `SECURITY.md` — 4 changes (1 new sub-block + 3 SHA backfills)

1. **§HTTP Security Headers Evidence bullets** — backfilled 3 commit SHAs:
   - "Header configuration: `firebase.json` `hosting.headers[0]` (source: `**`) — Phase 3 Plan 02 commit `e7a3e06`"
   - "Schema validation: `tests/firebase-config.test.js` ... — Phase 3 Plan 02 commit `03f4c07`"
   - "Post-deploy assertion: `.github/workflows/ci.yml` `deploy` job step 'Assert security headers' ... — Phase 3 Plan 04 commit `49afecb`"

2. **§CSP (Report-Only) Evidence bullets** — backfilled 2 commit SHAs:
   - "Policy configuration: `firebase.json` `hosting.headers[0]` ... — Phase 3 Plan 02 commit `e7a3e06`"
   - "Schema validation: `tests/firebase-config.test.js` asserts dual-reporting tokens are present (T-3-1 + T-3-2 mitigation) — Phase 3 Plan 02 commit `03f4c07`"

3. **§Hosting & Deployment Evidence bullets** — backfilled 2 commit SHAs:
   - "CI deploy job: `.github/workflows/ci.yml` job `deploy` (Phase 3 Plan 04 commit `49afecb` ...)"
   - "CI preview job: `.github/workflows/ci.yml` job `preview` (Phase 3 Plan 04 commit `49afecb` ...)"

4. **NEW `## § Phase 3 Audit Index` sub-block** — inserted after §Hosting & Deployment, before `### § Threat Model — *TODO Phase 11*`. Contains:
   - Intro paragraph documenting purpose (auditor walk-target; Phase 11 DOC-09 / Phase 12 cross-reference)
   - 9-row framework citation table: ASVS V14.4 (HTTP Security Headers) + ASVS V14.4 (CSP) + ASVS V14.7 (Build & Deploy) + ISO A.13.1.3 + ISO A.13.1 + ISO A.5.7 + SOC 2 CC6.6 + SOC 2 CC8.1 + GDPR Art. 32(1)(b)
   - Each row: framework | citation | Phase 3 section | Implemented in | Verified by | Commit SHA(s)
   - "Cross-phase plug-ins" sub-block listing Phase 4 / Phase 10 / Phase 11 / Phase 12 follow-ups
   - "Forward-looking concerns recorded in `runbooks/phase-4-cleanup-ledger.md`" sub-block referencing T-3-4, T-3-meta-csp-conflict, and T-3-5 by row title (cross-link to the cleanup ledger rows added in this plan)
   - "Index self-check" paragraph tying index currency to the cleanup ledger rows being open

## Atomic Commit List

Per the plan's atomic-commit convention (D-25 Phase 1 / extended to Phase 3), this plan made exactly 2 commits.

1. **`0a1f214`** — `feat(03-06): cleanup ledger + branch protection close-out (HOST-01, HOST-08)`
   - Files: `runbooks/phase-4-cleanup-ledger.md` (modified) + `runbooks/branch-protection-bootstrap.md` (modified)
   - 2 files changed, 68 insertions(+), 2 deletions(-)
   - Mitigates: T-3-4 (calendar), T-3-meta-csp-conflict (forward task), T-3-bp-pitfall-a (procedure)
   - Closes: HOST-01 (close-out), HOST-08 (close-out)

2. **`1021676`** — `docs(03-06): SECURITY.md commit-SHA backfill + Phase 3 Audit Index (DOC-10 close-out)`
   - File: `SECURITY.md` (modified)
   - 1 file changed, 40 insertions(+), 7 deletions(-)
   - Closes: DOC-10 incremental for Phase 3

Plan metadata commit (this SUMMARY.md) follows in the next commit (orchestrator-driven; this plan does NOT commit STATE.md or ROADMAP.md per the special instruction).

## Hand-offs

### To Phase 4 (modular split / CODE-01)

- **Cleanup ledger row "Phase 3 — meta-CSP regression guard" is the forward task.** Phase 4 closes the row by landing `tests/index-html-meta-csp.test.js`. Suggested test shape (mirror `tests/firebase-config.test.js`):
  ```js
  // tests/index-html-meta-csp.test.js
  import { readFileSync } from "node:fs";
  import { join } from "node:path";
  import { describe, it, expect } from "vitest";

  describe("index.html — no meta CSP regression (T-3-meta-csp-conflict)", () => {
    it("does not contain <meta http-equiv=\"Content-Security-Policy\">", () => {
      const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
      expect(/http-equiv=["']Content-Security-Policy["']/i.test(html)).toBe(false);
    });
  });
  ```
- Optionally also add a `.husky/pre-commit` grep as a pre-CI gate.
- Phase 4 also removes the Phase-3-only CSP CDN allowlist (cdn.jsdelivr.net + fonts.googleapis.com + fonts.gstatic.com) once Chart.js + Google Fonts are self-hosted via npm; the SECURITY.md §CSP "Temporary CDN allowlist" sub-block is rewritten in the Phase 4 commit that lands the migration.

### To Phase 7 (FN-04)

- **Cleanup-ledger entry from 03-04 SUMMARY hand-off remains open** — `roles/firebase.admin` over-grant on the deploy SA (T-3-5 disposition: accepted for Phase 3; Phase 7 narrows to per-function service accounts). Note: this row was flagged in 03-04 SUMMARY for 03-06 to add to the cleanup ledger, but is documentation-shaped (not a code-level cleanup) — Phase 7 owns the actual SA narrowing. The Phase 3 Audit Index references T-3-5 in the "Forward-looking concerns" sub-block; if a future plan wants a literal cleanup-ledger row, add it under §Out-of-band soft-fail entries with `Re-evaluation date: Phase 7 (FN-04)`.

### To Phase 10 (HOST-06 / HOST-07)

- Phase 10 lands CSP enforcement (drop `'unsafe-inline'` from `style-src`) and submits HSTS preload to hstspreload.org. Both changes touch the §HTTP Security Headers + §CSP (Report-Only -> enforced) sections of SECURITY.md, plus the `firebase.json` policy. Phase 10's planning explicitly lists "update SECURITY.md ## § Phase 3 Audit Index" as a task — when CSP flips to enforced, the index's V14.4 (CSP) row's "Phase 3 Section" cell needs to be updated to reference the renamed/promoted section (or the cell stays and a new Phase 10 Audit Index sub-block is added — Phase 10's planner's call).

### To Phase 11 (DOC-09 evidence pack)

- **`docs/CONTROL_MATRIX.md` walks the Phase 3 Audit Index row-by-row.** Each of the 9 framework citations gets a CONTROL_MATRIX.md row with: framework + citation + control narrative + evidence pointer (SECURITY.md section + commit SHA + test/runbook step). Phase 11 also screenshots `securityheaders.com` rating to `docs/evidence/phase-3-securityheaders-rating.png` (already referenced in `runbooks/hosting-cutover.md` Step 7).

### To Phase 12 (Audit Walkthrough)

- `SECURITY_AUDIT_REPORT.md` Pass / Partial / N/A entries for Phase 3 cite specific rows in the Audit Index by framework + citation. The 9-row table is the canonical Phase 3 entry-point.

### To the operator (when they execute)

After 03-05's cutover lands `cutover_date` and the first green deploy + preview runs complete:

1. **Update cleanup ledger row.** Open `runbooks/phase-4-cleanup-ledger.md`; find the "Phase 3 GH-Pages rollback substrate" row; replace the `PENDING-USER` token in the Re-evaluation date cell with either the computed ISO date (`cutover_date + 14 days`) or the literal `TBD — cutover rolled back...` string per the decision rule in the cell itself. Commit: `chore(03-06): backfill cleanup ledger Phase 3 GH-Pages day-14 date`.

2. **Update branch-protection runbook PENDING-USER markers.** Open `runbooks/branch-protection-bootstrap.md`; find the "First-green-run dates (PENDING-USER)" sub-block; fill in the ISO dates + run IDs for `Deploy to Firebase Hosting` and `Deploy PR Preview Channel`. Commit: `chore(03-06): backfill branch protection first-green-run dates`.

3. **Apply branch protection rule** — either via gh CLI (`## Command` section payload) or via GitHub UI (`## Apply via GitHub UI` section click-path). Re-take evidence screenshot to `docs/evidence/branch-protection-screenshot.png` for DOC-09.

4. **Day-14 cleanup** (after `cutover_date + 14 days` if `cutover_complete: yes`) — run `git push origin --delete gh-pages`, delete any Pages workflow file in `.github/workflows/`, commit `chore(03): delete GH-Pages rollback substrate (day 14 — cutover_date + 14)`, and close the cleanup ledger row.

## Phase 3 Close-Out Checklist

| Requirement | Status | Closed by |
|-------------|--------|-----------|
| HOST-01 (Firebase Hosting cuts over from GH-Pages) | RESOLVED-BY-AUTHORING-ONLY (waiting on operator cutover execution) | Plan 02 (firebase.json) + Plan 04 (CI deploy job) + Plan 05 (cutover runbook) — operator executes |
| HOST-02 (custom domain SSL) | PENDING-OPERATOR-EXECUTION | Plan 05 cutover runbook §Cutover Steps Step 5 (SSL provisioning) |
| HOST-03 (security headers) | RESOLVED | Plan 02 commit `e7a3e06` (firebase.json headers) + `03f4c07` (schema test) |
| HOST-04 (CSP report-only) | RESOLVED | Plan 02 commit `e7a3e06` (firebase.json CSP-RO) + `03f4c07` (schema test for dual-reporting tokens) |
| HOST-05 (csp-violations endpoint built) | RESOLVED | Plan 03 (functions/ workspace + cspReportSink) — deployed in Plan 04/05 |
| HOST-08 (CI deploy + preview channels + securityheaders ≥ A) | RESOLVED-BY-AUTHORING-ONLY (CI authored Plan 04; securityheaders rating is PENDING-USER on cutover, recorded as `securityheaders_rating` in 03-PREFLIGHT.md ## Cutover Log) | Plan 04 (CI deploy + preview jobs) + Plan 05 (manual smoke procedure) — operator runs smoke |
| FN-10 (csp-violations endpoint paired with HOST-05) | RESOLVED-BY-AUTHORING-ONLY | Plan 03 (built) + Plan 05 (deployed via cutover runbook smoke checklist) — operator runs Smoke 1+2 |
| DOC-10 (incremental SECURITY.md updates) | RESOLVED | Plan 02 (§HTTP Security Headers + §CSP atomic) + Plan 04 (§Hosting & Deployment atomic) + Plan 06 (commit-SHA backfill + ## § Phase 3 Audit Index) |

## Phase 3 Forward Concerns Recorded

| Concern | Tracking location | Closes in |
|---------|-------------------|-----------|
| T-3-4 (stale GH-Pages substrate accidentally re-enabled) | `runbooks/phase-4-cleanup-ledger.md` "Phase 3 GH-Pages rollback substrate" row + cross-reference in `SECURITY.md ## § Phase 3 Audit Index` "Forward-looking concerns" | Phase 3 day-14 cleanup commit (operator, post-cutover) |
| T-3-meta-csp-conflict (`<meta http-equiv="Content-Security-Policy">` regression in index.html) | `runbooks/phase-4-cleanup-ledger.md` "Phase 3 — meta-CSP regression guard" row + cross-reference in audit index | Phase 4 (CODE-01) lands `tests/index-html-meta-csp.test.js` |
| T-3-5 (over-broad `roles/firebase.admin` on deploy SA) | 03-PREFLIGHT.md ## OIDC SA Roles disposition + `SECURITY.md ## § Phase 3 Audit Index` "Forward-looking concerns" | Phase 7 (FN-04) per-function service accounts |
| Phase 3 CSP CDN allowlist (cdn.jsdelivr.net + fonts.googleapis.com + fonts.gstatic.com) | SECURITY.md §CSP "Temporary CDN allowlist (Phase 3 only)" sub-block (Plan 02) + cleanup-ledger row from Plan 02 hand-off | Phase 4 (CDN-to-npm migration) self-hosts both; Phase 10 (HOST-07) verifies removal before flipping to enforced |

## Deviations from Plan

### Rule-1 (bug) auto-fixes

**1. [Rule 1 - Bug] Edit/Write tool path resolution wrote to main worktree on first attempt for runbooks/phase-4-cleanup-ledger.md and runbooks/branch-protection-bootstrap.md**

- **Found during:** Task 1 verifier (Bash exit code 1 — all 8 checks failed when run from worktree CWD, but Read tool sees file content updated)
- **Issue:** First Edit invocations used the absolute path under the repo root (`C:\Users\hughd\OneDrive\Desktop\base-layers-diagnostic\runbooks\...`). The Edit tool succeeded but wrote to main's working tree, NOT into the isolation worktree at `.claude\worktrees\agent-a548efd3b0cf250b4\runbooks\...`. `git status --short runbooks/` from the worktree showed clean; from the main worktree showed the modifications. This is the same path-resolution issue that 03-05 SUMMARY documents as "Write-tool path resolution".
- **Fix:** Reverted the unintended writes to main's working tree via `git checkout -- runbooks/branch-protection-bootstrap.md runbooks/phase-4-cleanup-ledger.md` from the main repo root. Re-issued the Edit calls using the worktree-prefixed absolute path (`C:\Users\hughd\OneDrive\Desktop\base-layers-diagnostic\.claude\worktrees\agent-a548efd3b0cf250b4\runbooks\...`). All subsequent SECURITY.md Edits used the worktree-prefixed path from the start.
- **Files modified:** `runbooks/phase-4-cleanup-ledger.md` (worktree) + `runbooks/branch-protection-bootstrap.md` (worktree); main worktree restored to baseline.
- **Verification:** Worktree `git status --short runbooks/` showed both files as `M`; main worktree `git status --short runbooks/` showed clean. Plan-internal verifier (8-check script) returned `OK` after the fix.
- **Committed in:** `0a1f214` (Task 1 atomic commit — both files together).
- **Why this is a Rule 1 fix:** the executor's special instruction explicitly warns about this exact failure mode ("the Write tool resolves paths relative to your worktree's $PWD; heredoc fallback has been observed to write to the main worktree path instead of the isolation worktree, polluting the orchestrator's merge resolution"). My initial Edits used absolute paths but to the wrong root; the fix is to use the worktree-prefixed absolute path. No content change was made; only the target path was corrected.

### Rule-2 (missing critical) auto-additions

**2. [Rule 2 - Missing Critical] Recorded that no \${commit-sha-...} placeholders existed in SECURITY.md**

- **Found during:** Task 2 read_first phase (`grep "commit-sha-of\|commit-sha"` against SECURITY.md returned no matches)
- **Issue:** The plan's Task 2 acceptance criteria assumed literal `${commit-sha-of-Task-1}` and `${commit-sha-of-this-task}` placeholders existed in SECURITY.md from Wave 2/3 prose. They did not — Wave 2/3 wrote already-resolved references like "Phase 3 Plan 02" and "Phase 3 Plan 04" without placeholders. The special instruction's escape hatch covered this exact case: "If SECURITY.md does NOT contain literal `${commit-sha-of-Task-1}` placeholders ... record that finding in SUMMARY rather than mutating perfectly-good prose. The point is the audit index — pick the right primitive: either replace placeholders OR add a 'Phase 3 Audit Index' sub-block that lists section → commit SHA → framework citations explicitly."
- **Fix:** Chose BOTH primitives. (a) Spliced commit SHAs into the existing prose at 5 evidence bullet locations for traceability — the SHAs are now load-bearing for an auditor's quick `grep` against the working repo. (b) Added the §Phase 3 Audit Index sub-block as the canonical entry-point. The audit index lists each framework citation with its commit SHA(s) explicitly, satisfying the "pick the right primitive" guidance.
- **Files modified:** `SECURITY.md` (4 distinct edit operations folded into one atomic commit).
- **Verification:** Plan-internal verifier (12 checks) returned `OK`. Manual `grep -n "Phase 3 Plan 02 commit\|Phase 3 Plan 04 commit\|## § Phase 3 Audit Index"` returns 8 distinct hits across the file.
- **Committed in:** `1021676` (Task 2 atomic commit).
- **Why this is a Rule 2 addition:** the plan's `<must_haves>` truth #5 ("Phase 3 SECURITY.md sections all link to commit SHAs from Plans 02 + 04 — fills in the \${commit-sha-of-Task-1} placeholders with real SHAs") is met by the BOTH-primitives approach. The audit index alone would not satisfy it (the in-prose evidence bullets would still lack SHAs); the SHA splice into existing prose is the load-bearing addition. The plan's `<authoring_scope>` explicitly authorised this: "If there are NO such placeholders ... record this finding in SUMMARY's Issues Encountered rather than introducing churn." But the must_have truth requires SHAs in the prose, so the splice is a Rule 2 missing-critical addition rather than a churn-avoidance no-op.

### Rule-3 (blocking) auto-fixes

None encountered after the Rule 1 path-resolution fix.

### Rule-4 (architectural) escalations

None. The plan's deliverables are documentation-only and do not require structural changes.

---

**Total deviations:** 2 (1 Rule-1 path-resolution fix; 1 Rule-2 SHA-splice into existing prose). Both folded into the existing atomic commits — no extra commits introduced.

## Authentication Gates

This plan ran fully autonomously inside the executor — no external auth surfaces (gcloud, firebase login, GitHub) were required for the AUTHORING half. The PENDING-OPERATOR-EXECUTION half (Task 3 — apply branch protection in GitHub UI; cleanup ledger Re-evaluation date backfill; first-green-run date backfills) requires:

1. **GitHub repo admin session** — Task 3 (apply rule via UI or gh CLI).
2. **Operator clock** — cleanup ledger Re-evaluation date computed as `cutover_date + 14 days` (no auth, but requires the `cutover_date` value to exist in 03-PREFLIGHT.md).
3. **`gh` CLI authenticated as repo admin** — to read run IDs for first-green-run date stamps (`gh run list --workflow=ci.yml ...`).

All three are documented in the runbook + cleanup ledger row + this SUMMARY's hand-offs section.

## Issues Encountered

### Edit/Write tool path resolution (recorded for tooling teams; mitigated)

The first attempts to Edit `runbooks/phase-4-cleanup-ledger.md` and `runbooks/branch-protection-bootstrap.md` used the main-worktree absolute path. The Edit tool reported "The file ... has been updated successfully" but the changes landed in main's working tree, NOT the isolation worktree. Diagnosis matches 03-05 SUMMARY's "Write-tool path resolution" issue note: the Edit tool resolves the absolute path verbatim; if the path is the main-worktree path, edits go to main. Mitigation: always use the isolation-worktree-prefixed absolute path (`.claude/worktrees/agent-XXXXX/...`) when editing files inside the worktree.

Workflow impact: detected by running the plan-internal verifier from the worktree CWD and seeing all 8 checks fail despite Edit tool success messages. Reverted main's working tree via `git checkout -- runbooks/branch-protection-bootstrap.md runbooks/phase-4-cleanup-ledger.md` from the main repo root, then re-issued the Edits with the worktree-prefixed path. All subsequent edits (SECURITY.md) used the worktree-prefixed path from the start. Final state of all 3 modified files is correct, in the worktree, and committed atomically. No correctness impact; one-time workflow friction.

### PreToolUse:Edit hook fires defensively even after successful Read

Each Edit call triggered a `PreToolUse:Edit hook additional context: READ-BEFORE-EDIT REMINDER` message AFTER the Edit had already succeeded. The reminder appears to fire defensively rather than as a precondition (the Edit tool does not actually reject the call — content lands correctly). This is the same hook behaviour 03-05 SUMMARY documents as "Read-before-edit guard tripped". No correctness impact; only an annotation noise issue.

## Threat Surface Scan

This plan introduces no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The runbook + ledger + SECURITY.md edits are documentation-only. No `threat_flag:` rows recorded.

## Self-Check

### Created files exist (verified)

- `.planning/phases/03-hosting-cutover-baseline-security-headers/03-06-SUMMARY.md` — FOUND (this file)

### Modified files exist and contain expected content (verified)

- `runbooks/phase-4-cleanup-ledger.md` — FOUND; contains `Phase 3 GH-Pages rollback substrate`, `Phase 3 — meta-CSP regression guard`, `T-3-4`, `tests/index-html-meta-csp.test.js`, `PENDING-USER`, `cutover_date + 14 days`. Plan-internal verifier 8/8 OK.
- `runbooks/branch-protection-bootstrap.md` — FOUND; contains `Deploy to Firebase Hosting`, `Deploy PR Preview Channel`, `Pitfall A`, `## Apply via GitHub UI`, `7 contexts`. 134 lines (up from 70 baseline).
- `SECURITY.md` — FOUND; contains `## § Phase 3 Audit Index`, `Phase 3 Plan 02 commit `e7a3e06``, `Phase 3 Plan 02 commit `03f4c07``, `Phase 3 Plan 04 commit `49afecb``, `V14.4`, `V14.7`, `A.13.1.3`, `A.5.7`, `CC6.6`, `CC8.1`, `Art. 32`, `T-3-4`, `tests/index-html-meta-csp.test.js`. Does NOT contain `${commit-sha-of-Task-1}` or `${commit-sha-of-this-task}`. 367 lines (up from 335 baseline). Plan-internal verifier 12/12 OK.

### Commits exist (verified)

- `0a1f214` (`feat(03-06): cleanup ledger + branch protection close-out (HOST-01, HOST-08)`) — FOUND in `git log --oneline`
- `1021676` (`docs(03-06): SECURITY.md commit-SHA backfill + Phase 3 Audit Index (DOC-10 close-out)`) — FOUND in `git log --oneline`

### Plan-level success criteria match

- [x] runbooks/phase-4-cleanup-ledger.md has BOTH the "Phase 3 GH-Pages rollback substrate" row (with PENDING-USER day-14 date) and the "Phase 3 — meta-CSP regression guard" row.
- [x] runbooks/branch-protection-bootstrap.md has the deploy + preview required-status-check entries with the post-first-green-run precondition documented.
- [x] SECURITY.md ## § Phase 3 Audit Index sub-block exists, lists all Phase 3 framework citations cross-referenced by section + commit SHA.
- [x] SECURITY.md placeholder backfill complete (recorded as no-op + chose-both-primitives in deviation #2).
- [x] Each task atomically committed (2 atomic commits).
- [x] SUMMARY.md committed before return (next commit, in-progress).
- [x] SUMMARY explicitly distinguishes RESOLVED-BY-AUTHORING-ONLY vs PENDING-OPERATOR-EXECUTION truths (consistent with 03-05's pattern).
- [x] No live commands; no GitHub API mutations; no DNS/Console changes.

## Self-Check: PASSED

## Next Phase Readiness

- **Phase 3 close-out documentation complete.** The orchestrator's verification gate at `/gsd-verify-work 3` reads:
  - `03-PREFLIGHT.md ## Cutover Log → cutover_complete:` for HOST-01 / HOST-02 / HOST-08 (still PENDING-USER post-this-plan; will be `yes` after operator executes 03-05's runbook).
  - `runbooks/phase-4-cleanup-ledger.md` for the 2 new Phase 3 rows (RESOLVED post-this-plan).
  - `runbooks/branch-protection-bootstrap.md` for the 2 new contexts (RESOLVED post-this-plan; first-green-run dates remain PENDING-USER).
  - `SECURITY.md` for the §Phase 3 Audit Index (RESOLVED post-this-plan).
- **No blockers introduced for the orchestrator's wave-6 merge-back step.** Only 3 modified files (cleanup ledger + branch protection runbook + SECURITY.md) plus this SUMMARY.md. No conflicts expected — Wave 5 (03-05) modified `runbooks/hosting-cutover.md` and `03-PREFLIGHT.md`, which this plan does not touch.
- **Phase 3 verification still BLOCKED on operator** for cutover execution (HOST-01 / HOST-02 / HOST-08 cannot close until `cutover_complete: yes` in 03-PREFLIGHT.md). This is the correct compliance posture: do not claim a control is in place when it hasn't been exercised. Phase 3 CLOSE-OUT documentation is complete; phase EXECUTION close-out remains a calendar event per the operator-deferred mode the milestone has chosen.

---

*Phase: 03-hosting-cutover-baseline-security-headers*
*Plan: 06 (Wave 6 — phase close-out, operator-deferred for Task 3)*
*Completed: 2026-05-06*
