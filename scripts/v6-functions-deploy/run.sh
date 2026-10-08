#!/usr/bin/env bash
# Milestone v6 functions deploy — snapshot, gate, build, deploy, verify.
# Procedure and rationale: runbooks/v6-functions-deploy.md
#
# Reads run on ADC, so `gcloud auth login` is not needed. The one credential
# this cannot provide is the firebase-tools login, which needs a browser.
#
#   ./run.sh            snapshot -> gate -> build -> deploy -> verify
#   ./run.sh --dry-run  snapshot + gate + build only. Touches nothing remote.
#
# This script never writes IAM. If the deploy drops an invoker binding it says
# so and prints the one command to put it back, rather than granting silently.
set -uo pipefail

export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-$HOME/.local/pythons/python/bin/python3}"
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
PROJECT=bedeveloped-base-layers
REGION=europe-west2
SNAP="$HOME/Desktop/v6-deploy-snapshot"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1
mkdir -p "$SNAP"

# The five that changed in #97. Deliberately NOT the blocking auth handlers:
# their IAM-set failure is what takes sign-in down platform-wide (D-8/D-7).
TARGETS="softDelete restoreSoftDeleted permanentlyDeleteSoftDeleted scheduledPurge auditWrite"
# Lowercased Cloud Run service names, including the two blocking handlers, which
# are watched precisely because they must NOT change.
WATCH="auditwrite softdelete restoresoftdeleted permanentlydeletesoftdeleted
       getdocumentsignedurl beforeusercreatedhandler beforeusersignedinhandler"

die() { echo; echo "FAILED: $*" >&2; exit 1; }
hr()  { printf '%s\n' "------------------------------------------------------------"; }

TOKEN=""
token() {
  TOKEN=$(gcloud auth application-default print-access-token 2>/dev/null)
  # Workspace reauth policy invalidates ADC every day or so (invalid_rapt), so
  # this fires routinely rather than exceptionally. The login needs a browser,
  # which is why it cannot live inside this script.
  [ "${#TOKEN}" -ge 100 ] || die "ADC expired or missing. In a terminal with a browser:

      gcloud auth application-default login
      gcloud auth application-default set-quota-project $PROJECT

  The second line is not optional: identitytoolkit returns 403 'requires a
  quota project' without it, and this script then cannot read the IdP config
  it gates on. Then re-run this script."
}

# identitytoolkit returns 403 "requires a quota project" for bare user ADC, and
# the first version of this check rendered that error as "0 triggers / mfa None"
# — a false alarm that said do-not-deploy about a healthy project. The header
# goes on every call so both APIs behave identically.
api() { curl -s -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" "$@"; }

snapshot() {  # $1 = before|after
  local phase="$1" s
  for s in $WATCH; do
    api "https://run.googleapis.com/v2/projects/$PROJECT/locations/$REGION/services/$s:getIamPolicy" \
      > "$SNAP/$s.$phase.json"
  done
  api "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config" \
    > "$SNAP/idp.$phase.json"
}

token
hr; echo "STEP 1  snapshot (before)"; hr
snapshot before
python3 "$HERE/report.py" "$SNAP" before --gate $WATCH \
  || die "pre-deploy gate. NOTHING WAS DEPLOYED. Fix the above first."
echo
echo "  gate passed"

hr; echo "STEP 2  build + test"; hr
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || die "Node 22 required (nvm install 22)"
echo "  node $(node -v)"
# `npm ci`, NOT `npm install`. npm 10 — which Node 22 ships and which Cloud
# Build uses — crashes in arborist while RESOLVING this dependency set:
# "Cannot read properties of null (reading 'edgesOut')". npm ci does no
# resolution, so it is immune. When deps change, regenerate the lockfile with
#     cd functions && npx -y npm@11 install --package-lock-only
# npm 10 can read that lockfile but cannot write it.
( cd "$REPO/functions" && npm ci >/dev/null 2>&1 ) || die "functions npm ci failed. If deps changed:
      cd functions && npx -y npm@11 install --package-lock-only"
( cd "$REPO/functions" && npm run build >/dev/null ) || die "functions build (tsc)"
( cd "$REPO/functions" && npm test >/dev/null 2>&1 ) || die "functions tests"
# The lockfile must REACH Cloud Build, or it resolves from scratch and hits the
# same crash. This is what made the first deploy attempt fail.
python3 -c "
import json, sys
ig = json.load(open('$REPO/firebase.json'))['functions'][0].get('ignore', [])
sys.exit(1 if 'package-lock.json' in ig else 0)" \
  || die "firebase.json lists package-lock.json under functions.ignore.
  Cloud Build would get no lockfile, resolve from scratch, and crash. Remove it."
grep -q '"folder"' "$REPO/functions/lib/lifecycle/resolveDocRef.js" \
  || die "compiled resolveDocRef.js has no \"folder\" — wrong artifact, do not deploy"
echo "  built; resolveDocRef.js carries \"folder\""

if [ "$DRY" = 1 ]; then echo; echo "--dry-run: stopping before the deploy."; exit 0; fi

hr; echo "STEP 3  deploy"; hr
# Probe auth with a REAL authenticated call. `login:list` reports "Logged in
# as ..." from the stored id_token without validating it, so it says yes to an
# expired credential — which is how a stale token got all the way into a
# half-started deploy and six lines of "credentials are no longer valid".
WHO=$(npx firebase-tools@15.16.0 login:list 2>&1 | sed -n 's/^Logged in as //p' | head -1)
PROBE=$(npx firebase-tools@15.16.0 projects:list 2>&1)
if echo "$PROBE" | grep -qiE "no authorized|no longer valid|Authentication Error|Failed to authenticate|not logged in"; then
  die "firebase-tools auth is stale${WHO:+ (stored account: $WHO)}.
  Needs a browser, so run this in YOUR OWN terminal, then re-run this script:

      npx firebase-tools@15.16.0 login --reauth

  Check the account it reauths as. Deploying needs roles/cloudfunctions.admin
  and roles/iam.serviceAccountUser on $PROJECT; the repo handover names Luke as
  the project admin, so if the reauth lands on an account without those, the
  deploy 403s and it is his to run."
fi
echo "  firebase-tools authenticated${WHO:+ as $WHO}"
ONLY=$(echo $TARGETS | tr ' ' '\n' | sed 's/^/functions:/' | paste -sd, -)
echo "  --only $ONLY"
npx firebase-tools@15.16.0 deploy --only "$ONLY" --project "$PROJECT" 2>&1 \
  | tee "$SNAP/deploy.log"
DEPLOY_RC=${PIPESTATUS[0]}

hr; echo "STEP 4  snapshot (after)"; hr
token
snapshot after
python3 "$HERE/report.py" "$SNAP" after --diff $WATCH

hr
if [ "$DEPLOY_RC" = 0 ]; then echo "DEPLOY: ok"; else
  echo "DEPLOY: exited $DEPLOY_RC — read $SNAP/deploy.log"
fi
cat <<'GATES'

If the diff above says a service LOST allUsers roles/run.invoker, put it back:

    gcloud auth login      # only needed for this; reads above did not use it
    gcloud run services add-iam-policy-binding <service> \
      --region europe-west2 --member=allUsers --role=roles/run.invoker

If org policy refuses it, callables still reach the browser through the Hosting
rewrites — Hosting's own SA holds invoker. Gates A and B settle it either way.

VERIFICATION GATES — run A first. It is the outage this scoping exists to avoid.

  A  sign-in       private window -> baselayers.bedeveloped.com -> sign out, sign in.
                   MFA challenge verifies. IF THIS FAILS, restore
                   blockingFunctions.triggers from ~/Desktop/v6-deploy-snapshot/idp.before.json
                   (the PATCH is in runbooks/v6-functions-deploy.md, Rollback).
  B  empty delete  BeDeveloped -> Documents -> new throwaway folder -> Delete -> confirm.
  C  the cascade   A > B > C all empty -> Delete A -> "2 empty sub-folders" -> all three go.
  D  refusal       put a file in C -> Delete A -> "sub-folders still hold 1 file".
  E  audit rows    Firestore auditLog where type == data.folder.softDelete.
  F  restore       restore one deleted folder -> it returns to where it was.
GATES
