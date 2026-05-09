# Branch Protection Bootstrap Runbook

> Run AFTER the first successful CI run on the repo (status checks must exist before
> referencing them). This is a one-shot operation. Re-run to update settings.

## Prerequisites

- `gh` CLI authenticated as a repo admin
- First CI run must have completed successfully (creates the check names)
- For the Phase 3 additions (`Deploy to Firebase Hosting` + `Deploy PR Preview Channel`):
  the **first green deploy run on `main`** must have completed AND the **first green PR
  preview run** must have completed. Pitfall A from Phase 1 D-12: GitHub's
  required-status-checks API only accepts context names that have appeared in at least
  one completed check run; adding a name before its first run blocks every subsequent PR
  with `expected check '...' has not been reported`. **DO NOT enable the deploy + preview
  required-status-checks until both first green runs have registered the names in
  GitHub's check registry.**

## Command

```sh
gh api repos/lukebadiali/base-layers-diagnostic/branches/main/protection \
  --method PUT \
  --header "Accept: application/vnd.github+json" \
  --field required_status_checks[strict]=true \
  --field "required_status_checks[contexts][]=Lint" \
  --field "required_status_checks[contexts][]=Typecheck" \
  --field "required_status_checks[contexts][]=Test" \
  --field "required_status_checks[contexts][]=Security Audit" \
  --field "required_status_checks[contexts][]=Build" \
  --field "required_status_checks[contexts][]=Deploy to Firebase Hosting" \
  --field "required_status_checks[contexts][]=Deploy PR Preview Channel" \
  --field required_pull_request_reviews[required_approving_review_count]=1 \
  --field required_pull_request_reviews[dismiss_stale_reviews]=true \
  --field required_linear_history=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false \
  --field enforce_admins=false
```

> **Status-check name correction (2026-05-04):** The plan's original payload referenced
> contexts as lowercase YAML keys (`lint`, `typecheck`, `test`, `audit`, `build`). The
> first green CI run (#25317482833) registered the contexts using each job's `name:`
> field — `Lint`, `Typecheck`, `Test`, `Security Audit`, `Build`. GitHub's
> required-status-checks API matches the rendered job names (the strings shown in the
> Checks UI), not the YAML keys. The payload above uses the registered names.
> Confirm via `gh api repos/lukebadiali/base-layers-diagnostic/commits/main/check-runs --jq '.check_runs[].name' | sort -u`
> before executing.

> **Phase 3 additions — Pitfall A pattern (2026-05-06):** Two new required-status-checks
> were added by Phase 3 Plan 06:
>
> - `Deploy to Firebase Hosting` — the `name:` field of the `deploy` job in
>   `.github/workflows/ci.yml` (added by Phase 3 Plan 04, commit `49afecb`). Pitfall A:
>   this name will be registered in GitHub's check registry by the **first green deploy
>   run on `main`** AFTER Phase 3 Plan 05's cutover lands `cutover_date` in
>   `.planning/phases/03-hosting-cutover-baseline-security-headers/03-PREFLIGHT.md
>   ## Cutover Log`. The runbook update (this file) is the AUTHORING half; the actual
>   GitHub Settings → Branches → Branch protection rule update is **PENDING-USER** until
>   the first green run lands the name in the registry.
> - `Deploy PR Preview Channel` — the `name:` field of the `preview` job (added by
>   Phase 3 Plan 04, commit `49afecb`). Pitfall A: registered by the **first green PR
>   preview run** on any pull-request after the deploy job lands.
>
> **Operator action (PENDING-USER):**
>
> 1. Confirm the first green deploy run on `main` has completed:
>    `gh run list --workflow=ci.yml --branch=main --status=success --limit=10 --json databaseId,createdAt,name,headSha`.
>    Find the earliest run whose `headSha` is at-or-after commit `49afecb` AND whose
>    `deploy` job step "Assert security headers" passed (post-cutover; pre-cutover the
>    assertion fails because the custom domain does not yet point at Firebase). Record
>    the run ID + ISO date.
> 2. Confirm the first green preview run has completed:
>    `gh run list --workflow=ci.yml --event=pull_request --status=success --limit=10 --json databaseId,createdAt,name`.
>    Find the earliest run that includes the `preview` job. Record the run ID + ISO date.
> 3. Confirm both check names appear in the registry:
>    `gh api repos/lukebadiali/base-layers-diagnostic/commits/main/check-runs --jq '.check_runs[].name' | sort -u`.
>    The output MUST include both `Deploy to Firebase Hosting` and `Deploy PR Preview Channel`.
> 4. Apply the updated payload above (or use the GitHub UI per `## Apply via GitHub UI`
>    below).
>
> **First-green-run dates (PENDING-USER):**
>
> - `Deploy to Firebase Hosting` first-green-run date: PENDING-USER (operator records ISO date + run ID after the first post-cutover deploy on `main` succeeds end-to-end).
> - `Deploy PR Preview Channel` first-green-run date: PENDING-USER (operator records ISO date + run ID after the first PR preview run succeeds end-to-end).

## Apply via GitHub UI

1. Navigate to https://github.com/lukebadiali/base-layers-diagnostic/settings/branches.
2. Edit the existing branch protection rule for `main`.
3. Under "Require status checks to pass before merging", search for and add (only AFTER
   the first-green-run preconditions above are met):
   - `Deploy to Firebase Hosting`
   - `Deploy PR Preview Channel`
4. The existing required checks (`Lint`, `Typecheck`, `Test`, `Security Audit`, `Build`)
   remain unchanged.
5. Save.
6. Confirm the rule now lists 7 required checks (5 existing + 2 new from Phase 3).
7. Re-take the evidence screenshot per `## Evidence screenshot` below so the DOC-09
   pack reflects the post-Phase-3 state.

## Verification

```sh
gh api repos/lukebadiali/base-layers-diagnostic/branches/main/protection | jq .
```

The output's `required_status_checks.contexts` array MUST list all 7 entries above
(the 5 Phase-1 contexts — `Lint`, `Typecheck`, `Test`, `Security Audit`, `Build` — plus
the 2 Phase-3 contexts: `Deploy to Firebase Hosting`, `Deploy PR Preview Channel`).

## UI verification

Visit `https://github.com/lukebadiali/base-layers-diagnostic/settings/branches`. Confirm:

- "Require a pull request before merging" — ON, with 1 required review
- "Require status checks to pass before merging" — ON, listing all 7 contexts (5 Phase-1 + 2 Phase-3)
- "Require linear history" — ON
- "Allow force pushes" — OFF
- "Allow deletions" — OFF
- "Do not allow bypassing the above settings" / "Apply to administrators" — OFF (`enforce_admins=false`); admins retain a manual override path for emergency rollback

## Evidence screenshot

Save a screenshot of `https://github.com/lukebadiali/base-layers-diagnostic/settings/branches`
to `docs/evidence/branch-protection-screenshot.png` for the DOC-09 evidence pack.

## Threat model coverage

- **T-1-Wave5-01 (Repudiation — `main` branch protection):** mitigated. `allow_force_pushes=false` preserves the CI evidence trail; `required_status_checks[strict]=true` prevents merging stale branches that haven't re-run CI; `required_pull_request_reviews` enforces human review.

## Citation

- GitHub REST API: `PUT /repos/{owner}/{repo}/branches/{branch}/protection` — https://docs.github.com/en/rest/branches/branch-protection
