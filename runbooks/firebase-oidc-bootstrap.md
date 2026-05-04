# Firebase OIDC Bootstrap Runbook

> Phase 1: Document only. Do NOT provision until Phase 3.
> Phase 3: Run these commands before wiring the deploy job.

## Prerequisites

- `gcloud` CLI authenticated as project owner
- Firebase project ID: `bedeveloped-base-layers`
- GitHub repo: `lukebadiali/base-layers-diagnostic`

## Step 1: Create Workload Identity Pool

```sh
gcloud iam workload-identity-pools create "github-actions" \
  --project="bedeveloped-base-layers" \
  --location="global" \
  --display-name="GitHub Actions"
```

## Step 2: Create OIDC Provider in the Pool

```sh
gcloud iam workload-identity-pools providers create-oidc "github-oidc" \
  --project="bedeveloped-base-layers" \
  --location="global" \
  --workload-identity-pool="github-actions" \
  --display-name="GitHub OIDC" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"
```

## Step 3: Create Service Account for Firebase Deploy

```sh
gcloud iam service-accounts create "github-actions-deploy" \
  --project="bedeveloped-base-layers" \
  --display-name="GitHub Actions Deploy SA"
```

## Step 4: Grant Firebase Hosting Admin to the SA

```sh
gcloud projects add-iam-policy-binding "bedeveloped-base-layers" \
  --member="serviceAccount:github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"
```

## Step 5: Bind Workload Identity to the SA (repo-scoped)

```sh
gcloud iam service-accounts add-iam-policy-binding \
  "github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com" \
  --project="bedeveloped-base-layers" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe bedeveloped-base-layers --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-actions/attribute.repository/lukebadiali/base-layers-diagnostic"
```

## Step 6: GitHub Actions workflow snippet (Phase 3 ci.yml deploy job)

```yaml
- uses: google-github-actions/auth@<SHA>
  with:
    workload_identity_provider: 'projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-actions/providers/github-oidc'
    service_account: 'github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com'

- uses: google-github-actions/setup-gcloud@<SHA>

- run: firebase deploy --only hosting --project bedeveloped-base-layers
```

## Notes

- Replace `<PROJECT_NUMBER>` with output of `gcloud projects describe bedeveloped-base-layers --format='value(projectNumber)'`.
- No long-lived service account JSON key stored in GitHub Secrets.
- Token is scoped to this exact repo; forks cannot request a token.
- `<SHA>` placeholders are filled in Phase 3 by resolving `google-github-actions/auth` and `google-github-actions/setup-gcloud` to current commit SHAs (same `gh api` pattern Wave 3 used for the other 5 Actions). Pin the resolved SHAs and add `# vX.Y.Z` comments.

## Citations

- https://firebase.google.com/docs/hosting/github-integration
- https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines
