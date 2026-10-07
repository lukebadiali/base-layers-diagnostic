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
  [ "${#TOKEN}" -ge 100 ] || die "ADC unavailable. Run: gcloud auth application-default login"
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
# npm 10 crashes in arborist on vitest's optional peer set (edgesOut); npm 11
# resolves it. Pinning a vitest version does not hold — keep the npm 11 route.
( cd "$REPO/functions" && npx -y npm@11 install >/dev/null 2>&1 ) || die "functions install"
( cd "$REPO/functions" && npm run build >/dev/null ) || die "functions build (tsc)"
( cd "$REPO/functions" && npm test >/dev/null 2>&1 ) || die "functions tests"
git -C "$REPO" checkout -- functions/package-lock.json 2>/dev/null
grep -q '"folder"' "$REPO/functions/lib/lifecycle/resolveDocRef.js" \
  || die "compiled resolveDocRef.js has no \"folder\" — wrong artifact, do not deploy"
echo "  built; resolveDocRef.js carries \"folder\""

if [ "$DRY" = 1 ]; then echo; echo "--dry-run: stopping before the deploy."; exit 0; fi

hr; echo "STEP 3  deploy"; hr
if npx firebase-tools@15.16.0 login:list 2>&1 | grep -qi "no authorized"; then
  die "firebase-tools is not logged in.
  It needs a browser, so run this in YOUR OWN terminal, then re-run this script:
      npx firebase-tools@15.16.0 login"
fi
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
