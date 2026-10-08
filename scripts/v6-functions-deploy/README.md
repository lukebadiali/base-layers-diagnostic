# scripts/v6-functions-deploy

One-command operator deploy for the five Cloud Functions that Milestone v6
changed but never deployed. Full rationale: `runbooks/v6-functions-deploy.md`.

```sh
npx firebase-tools@15.16.0 login          # your own terminal — needs a browser
bash scripts/v6-functions-deploy/run.sh   # everything else
bash scripts/v6-functions-deploy/run.sh --dry-run   # snapshot + gate + build only
```

## What it does

1. Snapshots the Cloud Run IAM policies for seven services and the IdP config
   into `~/Desktop/v6-deploy-snapshot/`. Reads go over ADC — no
   `gcloud auth login` needed.
2. **Gates.** Refuses to deploy unless the snapshot is readable _and_ healthy:
   two blocking triggers, `mfa.state = ENABLED`. An unreadable snapshot is its
   own failure, distinct from an empty one.
3. Builds `functions/` on Node 22 via npm 11, runs its tests, and asserts the
   compiled `resolveDocRef.js` actually carries `"folder"`.
4. Deploys exactly `softDelete`, `restoreSoftDeleted`,
   `permanentlyDeleteSoftDeleted`, `scheduledPurge`, `auditWrite`.
5. Re-snapshots and names anything lost — invoker bindings, blocking triggers,
   `mfa.state`.

## Why only five functions

`firebase deploy --only functions` tries to bind `roles/run.invoker` to
`allUsers` on every service it touches. Org policy
`iam.allowedPolicyMemberDomains` blocks it (D-8), and the failed IAM-set wipes
the manually-bound `gcp-sa-identitytoolkit` invoker (D-7), which breaks the
blocking auth handlers and takes sign-in down platform-wide.

Scoping to the five that changed keeps `beforeUserCreatedHandler` and
`beforeUserSignedInHandler` out of the IAM-set path entirely. They are still in
the watch list, because the point is to prove they did not change.

## It never writes IAM

By design. If the deploy drops a binding, `run.sh` reports it and prints the
`gcloud run services add-iam-policy-binding` command. Granting `allUsers` on a
production service is an operator decision, not a script's.

## Files

|             |                                                                                |
| ----------- | ------------------------------------------------------------------------------ |
| `run.sh`    | the procedure                                                                  |
| `report.py` | reads the snapshots; `--gate` blocks a bad deploy, `--diff` names what changed |
