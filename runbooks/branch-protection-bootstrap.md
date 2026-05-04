# Branch Protection Bootstrap Runbook

> Run AFTER the first successful CI run on the repo (status checks must exist before
> referencing them). This is a one-shot operation. Re-run to update settings.

## Prerequisites

- `gh` CLI authenticated as a repo admin
- First CI run must have completed successfully (creates the check names)

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

## Verification

```sh
gh api repos/lukebadiali/base-layers-diagnostic/branches/main/protection | jq .
```

The output's `required_status_checks.contexts` array MUST list the same 5 entries above.

## UI verification

Visit `https://github.com/lukebadiali/base-layers-diagnostic/settings/branches`. Confirm:

- "Require a pull request before merging" — ON, with 1 required review
- "Require status checks to pass before merging" — ON, listing all 5 contexts
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
