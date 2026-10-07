# Milestone v6 — Functions Deploy (folder lifecycle)

> Milestone: v6 — Workflow & Usability, plus the FILE-04 cascade amendment of 2026-10-07
> Date authored: 2026-10-07
> Objective: get `folder` into the deployed `SOFT_DELETABLE_TYPES` so folder
> deletion works at all, and the six folder audit-event literals into the
> deployed `auditWrite` schema so folder rows stop being dropped.
> Operator: needs a **gcloud CLI identity with deploy rights on
> `bedeveloped-base-layers`**. ADC alone is not enough (see Step 0).

## Why this is not a routine deploy

`firebase deploy --only functions` on this project tries to bind
`roles/run.invoker` to `allUsers` on every Cloud Run service it touches. Org
policy `iam.allowedPolicyMemberDomains` blocks that (D-8), and **the failed
IAM-set step also wipes the manually-bound `gcp-sa-identitytoolkit` invoker**
(D-7) — which breaks the blocking auth handlers end to end. Those handlers are
live (`blockingFunctions.triggers` re-wired 2026-10-06 09:50Z), so an
unscoped run can take sign-in down platform-wide.

Mitigation used here: **deploy only the five functions that actually changed.**
The blocking handlers (`beforeUserCreatedHandler`, `beforeUserSignedInHandler`)
are not in the set, so the deploy never touches their IAM policy. Steps 1 and 4
snapshot and re-check the bindings anyway.

### The five, and why each is in the set

`git diff 207c50a~1 207c50a -- functions/` changed `auditEventSchema.ts`,
`resolveDocRef.ts` and the three lifecycle callables:

| Function                       | Why                                                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `softDelete`                   | `folder` in the Zod enum + `resolveDocPath`. **Without this, folder deletion returns `invalid-argument`.**                          |
| `restoreSoftDeleted`           | The confirm dialogue promises "restorable within 30 days". Undeployed, that promise is false for folders.                           |
| `permanentlyDeleteSoftDeleted` | Admin hard-delete of a tombstoned folder.                                                                                           |
| `scheduledPurge`               | Source unchanged but imports `resolveDocRef`. Undeployed, tombstoned folders are never purged — they sit past the retention window. |
| `auditWrite`                   | The six `data.folder.*` literals. Undeployed, folder audit rows fail schema validation and are silently skipped.                    |

---

## Step 0 — environment

A non-interactive shell does not source `~/.zshrc`, so `CLOUDSDK_PYTHON` must be
set inline or gcloud loads macOS Python 3.9 and hands back an empty access
token (which surfaces as a confusing `401 CREDENTIALS_MISSING` from whatever API
you were calling).

```sh
export CLOUDSDK_PYTHON="$HOME/.local/pythons/python/bin/python3"
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
export PROJECT=bedeveloped-base-layers
export REGION=europe-west2
export SNAP="$HOME/Desktop/v6-deploy-snapshot"
mkdir -p "$SNAP"

# ADC was configured on 2026-10-06; a CLI identity was NOT. `gcloud run ...`
# and the deploy both need the CLI identity, so this login is required even
# though firebase-admin scripts already work.
gcloud auth login
gcloud config set project "$PROJECT"
gcloud auth list
```

If the deploy in Step 3 returns 403, this account lacks
`roles/cloudfunctions.admin` + `roles/iam.serviceAccountUser` on the project and
the deploy has to go to Luke. Stop here rather than granting yourself roles.

## Step 1 — snapshot what the deploy can break

```sh
for S in auditwrite softdelete restoresoftdeleted permanentlydeletesoftdeleted \
         getdocumentsignedurl beforeusercreatedhandler beforeusersignedinhandler; do
  if gcloud run services get-iam-policy "$S" --region "$REGION" \
       --format=json > "$SNAP/$S.before.json" 2>/dev/null; then
    echo "snapshot  $S"
  else
    echo "MISSING   $S   <- note it, do not proceed blind"
  fi
done

# The IdP config, because blockingFunctions.triggers is the thing whose loss
# takes sign-in down. Keep this file until Step 5 passes.
curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config" \
  > "$SNAP/idp-config.before.json"
python3 -c "import json,sys; d=json.load(open('$SNAP/idp-config.before.json')); \
print(json.dumps(d.get('blockingFunctions',{}), indent=2)); \
print('mfa.state =', d.get('mfa',{}).get('state'))"
```

Expect four blocking-handler URLs and `mfa.state = ENABLED`. If
`blockingFunctions` is already `{}`, that is a pre-existing problem — fix it
before deploying, not after.

## Step 2 — build

```sh
nvm use 22            # the functions workspace will not install on Node 20
cd ~/Desktop/base-layers-diagnostic/functions

# npm 10 (which Node 22 ships) crashes in arborist resolving vitest's optional
# peer set — `edgesOut`. npm 11 resolves it. Pinning a vitest version does not
# hold; this is the durable route.
npx -y npm@11 install
npm run build
npm test

# Optional. Reports 7 pre-existing errors in files v6 did not touch.
npm run lint || true

# `npm install` rewrites the lockfile. Drop that churn unless you mean to
# commit it — regenerating it properly on Linux is a separate open item.
cd .. && git checkout -- functions/package-lock.json
```

## Step 3 — the scoped deploy

```sh
cd ~/Desktop/base-layers-diagnostic
npx firebase-tools@15.16.0 deploy \
  --only functions:softDelete,functions:restoreSoftDeleted,functions:permanentlyDeleteSoftDeleted,functions:scheduledPurge,functions:auditWrite \
  --project bedeveloped-base-layers \
  --non-interactive
```

Do **not** add `--force` (it auto-deletes functions absent from the set) and do
not widen `--only` to bare `functions`. An IAM-set warning on these five is
expected; a _failure_ of the function upload is not.

## Step 4 — re-check the bindings, and rebind if wiped

```sh
for S in auditwrite softdelete restoresoftdeleted permanentlydeletesoftdeleted \
         getdocumentsignedurl beforeusercreatedhandler beforeusersignedinhandler; do
  echo "== $S"
  gcloud run services get-iam-policy "$S" --region "$REGION" --format=json \
    | python3 -c "import json,sys; [print(' ', b['role'], b['members']) for b in json.load(sys.stdin).get('bindings',[])]"
done
```

Compare against `$SNAP/*.before.json`. Two bindings matter:

- `allUsers -> roles/run.invoker` on `auditwrite`, `softdelete`,
  `getdocumentsignedurl`. Rebind:
  ```sh
  gcloud run services add-iam-policy-binding "$S" --region "$REGION" \
    --member=allUsers --role=roles/run.invoker
  ```
  If org policy refuses this, callables still reach the browser through the
  Firebase Hosting rewrites — Hosting's own service identity holds invoker,
  which is why `src/firebase/functions.js` routes through the custom domain.
  Verify with Step 5 rather than assuming either way.
- `service-<projectNumber>@gcp-sa-identitytoolkit...` on the two blocking
  handlers. These are **not** in the deploy set so should be untouched;
  contingency rebind if they are:
  ```sh
  PN=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
  for S in beforeusercreatedhandler beforeusersignedinhandler; do
    gcloud run services add-iam-policy-binding "$S" --region "$REGION" \
      --member="serviceAccount:service-$PN@gcp-sa-identitytoolkit.iam.gserviceaccount.com" \
      --role=roles/run.invoker
  done
  ```

Then confirm the IdP config did not move:

```sh
curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); \
print(json.dumps(d.get('blockingFunctions',{}), indent=2)); print('mfa.state =', d.get('mfa',{}).get('state'))"
```

## Step 5 — verification gates

| Gate                        | How                                                                                        | Pass                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| A — sign-in survived        | Sign out and back in on `baselayers.bedeveloped.com` in a fresh private window             | Sign-in completes, MFA challenge verifies                     |
| B — empty folder deletes    | BeDeveloped (`org_b5d50284bbe`) → Documents → create a throwaway folder → Delete → confirm | The folder goes; no `invalid-argument` in the console         |
| C — the cascade             | Create `A > B > C`, all empty → Delete `A`                                                 | Dialogue says "2 empty sub-folders"; all three go in one step |
| D — the refusal still bites | Put a file in `C`, then Delete `A`                                                         | Refused: "This folder's sub-folders still hold 1 file"        |
| E — audit rows land         | Firestore `auditLog`, filter `type == data.folder.softDelete`                              | Rows for B and C, actor = your uid                            |
| F — restore works           | `scripts/admin-*` / admin UI restore on one of the deleted folders                         | It comes back where it was                                    |

Gate A is the one that matters most: it is the failure mode this runbook exists
to avoid. Run it first, before B–F.

## Cutover log — operator fill

| Step                        | Run at (UTC) | Result | Notes |
| --------------------------- | ------------ | ------ | ----- |
| 0 env + `gcloud auth login` |              |        |       |
| 1 snapshot                  |              |        |       |
| 2 build + `npm test`        |              |        |       |
| 3 deploy                    |              |        |       |
| 4 bindings re-checked       |              |        |       |
| 5 gate A sign-in            |              |        |       |
| 5 gate B empty delete       |              |        |       |
| 5 gate C cascade            |              |        |       |
| 5 gate D refusal            |              |        |       |
| 5 gate E audit rows         |              |        |       |
| 5 gate F restore            |              |        |       |

## Rollback

The five functions are additive — the enum gains a member, the schema gains six
literals. Nothing existing changes shape, so there is no data migration to
reverse and no rollback needed for a _successful_ deploy.

If the deploy half-lands and sign-in breaks, the fix is the Step 4
`gcp-sa-identitytoolkit` rebind plus restoring `blockingFunctions.triggers`
from `$SNAP/idp-config.before.json`. The classifier refuses production
auth-config PATCHes in agent sessions, so that `PATCH` is operator-run:

```sh
curl -X PATCH \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config?updateMask=blockingFunctions" \
  -d @<(python3 -c "import json; d=json.load(open('$SNAP/idp-config.before.json')); print(json.dumps({'blockingFunctions': d['blockingFunctions']}))")
```
