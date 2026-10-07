# Milestone v6 — Functions Deploy (folder lifecycle)

> Milestone: v6 — Workflow & Usability, plus the FILE-04 cascade amendment of 2026-10-07
> Date authored: 2026-10-07
> Objective: get `folder` into the deployed `SOFT_DELETABLE_TYPES` so folder
> deletion works at all, and the six folder audit-event literals into the
> deployed `auditWrite` schema so folder rows stop being dropped.
> Operator: needs a **`firebase login`** credential with deploy rights on
> `bedeveloped-base-layers`. See Step 0 — this is a _different_ credential
> store from both ADC and the gcloud CLI, and it is the only one missing.

## The short version

```sh
npx firebase-tools@15.16.0 login          # your own terminal: needs a browser
bash scripts/v6-functions-deploy/run.sh   # everything else
```

`run.sh` snapshots the IAM policies and IdP config, **refuses to deploy unless
the snapshot is healthy and readable**, builds, deploys the five functions,
re-snapshots, and names anything that was lost. `--dry-run` stops before the
deploy. It writes no IAM; if a binding is dropped it prints the command.

The rest of this document is what `run.sh` does and why, for when it fails or
when the next person needs to do it by hand.

### Two traps already paid for

- **ADC needs a quota project.** `identitytoolkit.googleapis.com` returns
  `403 PERMISSION_DENIED — requires a quota project` for bare user ADC. Every
  call in `run.sh` sends `x-goog-user-project`. Fix it globally with
  `gcloud auth application-default set-quota-project bedeveloped-base-layers`.
- **An unreadable snapshot is not an empty one.** That 403, rendered by a
  reader that did not check for an error payload, printed
  `blockingFunctions.triggers: 0 / mfa.state = None` — indistinguishable from a
  project whose blocking handlers had been wiped, on a project that was fine.
  `report.py` now treats unreadable, incomplete and empty as three outcomes.
  `mfa.state = None` rather than `DISABLED` is the tell: a real config always
  carries `mfa`.

---

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

## Step 0 — environment and the three credential stores

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
```

**Three separate credential stores are in play, and confusing them wastes a
round trip.** Verified on this machine 2026-10-07:

| Store                                                         | Command that reads it                                | State                                           | What needs it                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ADC — `~/.config/gcloud/application_default_credentials.json` | `gcloud auth application-default print-access-token` | **present and live** (written 2026-10-06 10:55) | `firebase-admin` scripts; every `curl` in Steps 1 and 4 of this runbook                  |
| gcloud CLI identity                                           | `gcloud auth list`                                   | **absent** (`No credentialed accounts`)         | `gcloud run ...`, `gcloud projects ...`. Optional — Steps 1 and 4 use ADC + curl instead |
| firebase-tools                                                | `firebase login:list`                                | **absent** (configstore is `{}`)                | `firebase deploy`. **This is the one you need.**                                         |

ADC is _not_ a substitute for the firebase-tools credential: firebase-tools
accepts `GOOGLE_APPLICATION_CREDENTIALS` only when it points at a **service
account key file**, not at a user ADC file. So the one required interactive
step is:

```sh
npx firebase-tools@15.16.0 login
npx firebase-tools@15.16.0 login:list      # expect your account
```

`gcloud auth login` is **not** required by this runbook. Run it only if you
prefer `gcloud run services get-iam-policy` over the curl form in Steps 1 and 4.

If the deploy in Step 3 returns 403, the account lacks
`roles/cloudfunctions.admin` + `roles/iam.serviceAccountUser` on the project and
the deploy has to go to Luke. Stop there rather than granting yourself roles.

## Step 1 — snapshot what the deploy can break

Both reads below run on **ADC**, so no `gcloud auth login` is needed.

```sh
ADC() { gcloud auth application-default print-access-token; }

for S in auditwrite softdelete restoresoftdeleted permanentlydeletesoftdeleted \
         getdocumentsignedurl beforeusercreatedhandler beforeusersignedinhandler; do
  curl -s -H "Authorization: Bearer $(ADC)" \
    "https://run.googleapis.com/v2/projects/$PROJECT/locations/$REGION/services/$S:getIamPolicy" \
    > "$SNAP/$S.before.json"
  if python3 -c "import json,sys; d=json.load(open('$SNAP/$S.before.json')); sys.exit(1 if 'error' in d else 0)"; then
    echo "snapshot  $S"
  else
    echo "MISSING   $S   <- note it, do not proceed blind"
  fi
done
```

(The `gcloud run services get-iam-policy "$S" --region "$REGION"` form is
equivalent and nicer to read, but needs the CLI identity ADC does not provide.)

# The IdP config, because blockingFunctions.triggers is the thing whose loss

# takes sign-in down. Keep this file until Step 5 passes.

curl -s -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config" \

> "$SNAP/idp-config.before.json"
python3 -c "import json,sys; d=json.load(open('$SNAP/idp-config.before.json')); \
> print(json.dumps(d.get('blockingFunctions',{}), indent=2)); \
> print('mfa.state =', d.get('mfa',{}).get('state'))"

````

Expect **two** blocking-handler triggers (`beforeCreate`, `beforeSignIn` — the only two handlers `functions/src/index.ts` exports, so two is complete) and `mfa.state = ENABLED`. The handover's "4 verified URLs" counts Cloud Run services with invoker bindings, not trigger slots; conflating them cost a round trip. If
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
````

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
  curl -s -H "Authorization: Bearer $(ADC)" \
    "https://run.googleapis.com/v2/projects/$PROJECT/locations/$REGION/services/$S:getIamPolicy" \
    | python3 -c "import json,sys; [print(' ', b.get('role'), b.get('members')) for b in json.load(sys.stdin).get('bindings',[])]"
done
```

Compare against `$SNAP/*.before.json`. Two bindings matter:

- `allUsers -> roles/run.invoker` on `auditwrite`, `softdelete`,
  `getdocumentsignedurl`. Rebind:
  ```sh
  # Needs the gcloud CLI identity. If you skipped `gcloud auth login`, run it
  # now — a setIamPolicy by hand means resending the whole policy document,
  # which is how bindings get lost.
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
