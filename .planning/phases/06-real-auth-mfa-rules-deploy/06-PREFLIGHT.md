# Phase 6 — Wave 1 Pre-flight Verifications

**Plan:** 06-01
**Phase:** 06-real-auth-mfa-rules-deploy
**Authored:** 2026-05-08T20:21:52Z
**Status:** PARTIAL — automated checks PASS; operator-side checks PENDING-OPERATOR-EXECUTION (see `## Wave 1 Status`)

**Purpose.** Prove the platform can run Phase 6 BEFORE writing handlers. Identity Platform must be upgraded (else `passwordPolicy` + TOTP APIs are absent); Firestore must be in `europe-west2` (else `cspReportSink` + new auth functions live in a different region than the database, violating D-09's UK data-residency story); `passwordPolicy` must be enabled (else AUTH-04 is unimplementable); `firebase.json` must already declare `firestore.rules` + `storage.rules` (verify-and-leave per pattern mapper).

This is the load-bearing gate that closes the STATE.md "Firestore region not yet verified" outstanding todo and establishes the deployment substrate Wave 2 lands on.

---

## Firestore Region

**Requirement:** Firestore region for `bedeveloped-base-layers` MUST be `europe-west2` per D-09 (co-located with `cspReportSink` + new `functions/src/auth/*` handlers; UK data-residency story for `PRIVACY.md` Phase 11). If `locationId != europe-west2`, escalate to user before Wave 2 (deviation gate).

**Closes STATE.md outstanding todo:** "Firestore region of `bedeveloped-base-layers` not yet verified."

### Verify Command

```bash
gcloud firestore databases describe \
  --database="(default)" \
  --project=bedeveloped-base-layers \
  --format="value(locationId,type)"
```

**Expected output (PASS):**

```
europe-west2	FIRESTORE_NATIVE
```

### Captured Output

**Status:** PASS — captured 2026-05-08T20:30:00Z

Run by orchestrator from project root using the absolute path to `gcloud.cmd` (Git Bash invokes the Windows .cmd shim correctly, bypassing the broken `gcloud` Python launcher in PATH that the worktree executor agent hit).

```
$ /c/Users/hughd/AppData/Local/Google/Cloud\ SDK/google-cloud-sdk/bin/gcloud.cmd firestore databases describe --database="(default)" --project=bedeveloped-base-layers --format="value(locationId,type)"
europe-west2	FIRESTORE_NATIVE
```

Active gcloud account at capture: `business@bedeveloped.com` (confirmed via `gcloud auth list`).

**Verified at:** `2026-05-08T20:30:00Z`

### Decision

**PASS — region verified at 2026-05-08T20:30:00Z.** Firestore database `(default)` for project `bedeveloped-base-layers` is `europe-west2 / FIRESTORE_NATIVE`, matching D-09's UK data-residency requirement and co-locating with `cspReportSink` (Phase 3) + the new `functions/src/auth/*` handlers (Wave 2). Closes the STATE.md "Firestore region of `bedeveloped-base-layers` not yet verified" outstanding todo. Wave 2 unblocked on this section.

---

## Identity Platform Upgrade

**Requirement:** Firebase project `bedeveloped-base-layers` MUST have the Identity Platform upgrade in place per AUTH-02 (else `passwordPolicy` API + TOTP MFA + org-wide MFA enforcement are absent — Phase 6 cannot ship).

This is a Firebase Console verification — no programmatic command exposes the upgrade flag uniformly.

### Verify Steps (Operator-Run)

1. Visit: `https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/providers`
2. Visual indicator: the page shows "Identity Platform" branding (top-right or in the header) AND the left nav shows an "MFA" tab AND the "Settings" sub-page exposes a "Password policy" section.
3. If absent (page shows only "Firebase Authentication" branding and no MFA tab), the project is on the legacy Firebase Auth tier and must be upgraded via Console "Upgrade to Identity Platform" button. Note: the upgrade is irreversible and may surface billing changes (operator should review pricing before upgrading).

### Captured Confirmation

**Status:** PASS — captured 2026-05-09T00:15:00Z (post-upgrade)

**History:** Pre-flight initially captured `subtype: "FIREBASE_AUTH"` + `mfa.state: "DISABLED"` (legacy Firebase Auth tier) on 2026-05-08T20:35:00Z via the IdP admin v2 API. Operator (Hugh) ran the Identity Platform upgrade in Firebase Console between 20:35 and 00:15. Re-query confirmed the upgrade landed.

**Verification command (orchestrator-run):**

```bash
TOKEN=$(gcloud.cmd auth print-access-token)
curl -sS -H "Authorization: Bearer $TOKEN" \
  -H "X-Goog-User-Project: bedeveloped-base-layers" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/bedeveloped-base-layers/config"
```

**Captured response (relevant fields):**

```json
{
  "subtype": "IDENTITY_PLATFORM",
  "mfa": { "state": "DISABLED" },
  "passwordPolicyConfig": {
    "passwordPolicyEnforcementState": "ENFORCE",
    "passwordPolicyVersions": [{
      "customStrengthOptions": { "minPasswordLength": 12, "maxPasswordLength": 4096 },
      "schemaVersion": 1
    }],
    "lastUpdateTime": "2026-05-08T20:39:34.664871Z"
  },
  "blockingFunctions": {},
  "emailPrivacyConfig": { "enableImprovedEmailPrivacy": true }
}
```

**Verified at:** `2026-05-09T00:15:00Z`

### Decision

**PASS — Identity Platform upgrade verified at 2026-05-09T00:15:00Z.** Project tier is `IDENTITY_PLATFORM` (not legacy `FIREBASE_AUTH`); blocking-function registration surface (`blockingFunctions: {}`) is now available for Wave 2 to populate; passwordPolicy is enforced with minLength=12; `enableImprovedEmailPrivacy: true` is a positive AUTH-12 signal (account-enumeration story).

**Wave 5 carry-forward (NON-BLOCKING for Wave 2, MUST resolve before live cutover):**

1. **`mfa.state: "DISABLED"`** — IdP tier is in but org-wide MFA enforcement is off. Wave 5 cutover requires enabling TOTP MFA at the project level before admin enrolment can succeed. Operator action: in Console > Authentication > Sign-in method > Multi-factor authentication, enable TOTP and (per AUTH-02) set the enforcement scope. Re-verify with the same admin v2 query — `mfa.state` should be `ENABLED` (or active enforcement equivalent).
2. **HIBP / leaked-password check** — `passwordPolicyConfig.customStrengthOptions` does not expose a breach-check field in the API response. Operator earlier reported the Console toggle is ON, but propagation to the API is not visible. Wave 5 verification: during admin Console-creation, attempt to set a known-breached password (e.g., `Password123!`) and confirm Firebase rejects it. If accepted, escalate before the cutover commit lands.

---

## passwordPolicy

**Requirement:** Project-level `passwordPolicy` MUST be enabled with `minLength >= 12` AND "Check passwords against compromised credentials" (HIBP) enabled per AUTH-04. Without this, Phase 6 client + Console-creation workflows cannot enforce the password floor.

### Verify Steps (Operator-Run)

**Primary path — Firebase Console:**

1. Visit: `https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/settings`
2. Scroll to "Password policy" section.
3. Confirm:
   - **Minimum length** set to a value `>= 12`.
   - **Require uppercase character / lowercase character / numeric character / non-alphanumeric character** — set per project policy (Phase 6 D-?? does not mandate specific composition rules; minimum length + HIBP are the load-bearing checks).
   - **Check passwords against compromised credentials** — toggle ON (HIBP / leaked-password check).

**Secondary path — gcloud (alternative if Console access is unavailable):**

```bash
gcloud identity-toolkit projects describe bedeveloped-base-layers \
  --format="value(passwordPolicyConfig)"
```

(Note: `gcloud identity-toolkit` may require `gcloud components install identity-toolkit` first; some clusters expose this only via REST. If not available, rely on Console verification above.)

### Captured Output

**Status:** PARTIAL-PASS — captured 2026-05-09T00:15:00Z (orchestrator-run via IdP admin v2 API, post-IdP-upgrade)

**Captured fields (from the same admin v2 GET that verified Identity Platform upgrade above):**

```
verified_at: 2026-05-09T00:15:00Z
passwordPolicyEnforcementState: ENFORCE
min_length: 12
max_length: 4096
containsLowercaseCharacter: false
containsUppercaseCharacter: false
containsNumericCharacter: false
containsNonAlphanumericCharacter: false
schemaVersion: 1
lastUpdateTime: 2026-05-08T20:39:34.664871Z
console_url: https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/settings
operator: Hugh (orchestrator-run)
```

**Operator confirmation (Firebase Console):** Hugh confirmed via Console UI on 2026-05-08 (pre-upgrade) that "Check passwords against compromised credentials" toggle is ON. The IdP admin v2 API response does not surface this field in `customStrengthOptions` — either it persists under a v1 endpoint, has a different field name in the API surface than the Console UI suggests, or the Console toggle has not propagated post-upgrade. Treated as PARTIAL-PASS pending Wave 5 runtime verification.

### Decision

**PARTIAL-PASS — verified at 2026-05-09T00:15:00Z (minLength=12, ENFORCE state, HIBP UI-confirmed but not API-visible).**

minLength=12 satisfies AUTH-04's hard floor. `passwordPolicyEnforcementState: ENFORCE` confirms the policy is server-side active (not just OFFLINE/audit). Wave 2 unblocks on this section.

**Wave 5 carry-forward (NON-BLOCKING for Wave 2, MUST resolve before live cutover):**

The HIBP / leaked-password check is not visible in the v2 admin API response. During Wave 5 admin Console-creation, attempt to set a known-breached password (e.g., `Password123!` or any HIBP top-100k value) and confirm Firebase rejects with the expected `auth/password-does-not-meet-requirements` error code. If the breached password is accepted, the AUTH-04 HIBP requirement is not actually enforced and the cutover commit must NOT land until Console > Authentication > Settings > Password policy > "Check passwords against compromised credentials" is toggled ON and propagation is confirmed.

---

## firebase.json declarations

**Requirement (per pattern mapper):** `firebase.json` MUST already declare `firestore.rules` + `firestore.indexes.json` + `storage.rules` paths. Wave 1's plan task collapses to a verify-and-leave gate — declarations are EXPECTED to be present from prior phase work; this section confirms and is a no-op if PASS.

### Verify Command

```bash
node -e "const j=require('./firebase.json'); console.log(JSON.stringify({fs: j.firestore, st: j.storage}, null, 2))"
```

### Captured Output

Run on 2026-05-08T20:21:52Z by executor agent:

```json
{
  "fs": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "st": {
    "rules": "storage.rules"
  }
}
```

### File Existence Check

```bash
ls -la firestore.rules storage.rules firestore.indexes.json
```

Captured stdout:

```
-rw-r--r-- 1 hughd 197609   48 May  8 21:21 firestore.indexes.json
-rw-r--r-- 1 hughd 197609 7633 May  8 21:21 firestore.rules
-rw-r--r-- 1 hughd 197609 1841 May  8 21:21 storage.rules
```

All three files present at repo root with non-zero byte size (`firestore.rules` = 7633 bytes / 159 lines from Phase 5; `storage.rules` = 1841 bytes / 44 lines from Phase 5; `firestore.indexes.json` = 48 bytes scaffold).

### Decision

**PASS — verified at 2026-05-08T20:21:52Z.** `firebase.json` declares both `firestore` (rules + indexes) and `storage` (rules) blocks per the expected shape (lines 50-56 of `firebase.json`). All three referenced files exist at the repo root. Pattern mapper's "verify-and-leave" gate is satisfied — no edit to `firebase.json` is required in Wave 1.

---

## functions/src/auth scaffolding

**Requirement:** `functions/src/auth/` subdirectory MUST exist in git so Wave 2 (06-02) can populate it with `beforeUserCreated.ts`, `beforeUserSignedIn.ts`, `setClaims.ts`, and `claim-builder.ts` per CONTEXT.md D-10. Empty subdirectories are not tracked by git, so a `.keep` placeholder is the minimal acceptable scaffold.

### Verify Command

```bash
test -f functions/src/auth/.keep && grep -q "Phase 6" functions/src/auth/.keep && echo "placeholder OK"
```

### Captured Output

```
subdirectory_created: yes
placeholder_path: functions/src/auth/.keep
verified_at: 2026-05-08T20:21:52Z
```

Captured stdout from verify command:

```
placeholder OK
```

### Decision

**PASS — verified at 2026-05-08T20:21:52Z.** `functions/src/auth/.keep` exists with a one-line comment naming Phase 6 Wave 1 + the Wave 2 hand-off (`beforeUserCreated.ts`, `beforeUserSignedIn.ts`, `setClaims.ts`, `claim-builder.ts` per CONTEXT.md D-10). Zero `.ts` source files added in this wave (D-01 wave shape: Wave 2 owns those). `functions/src/index.ts` UNCHANGED. `functions/package.json` UNCHANGED (Phase 3 pinned firebase-admin@13.8.0 + firebase-functions@7.2.5 stand).

---

## Wave 1 Status

**Summary as of 2026-05-09T00:15:00Z (orchestrator-resolved post-IdP-upgrade):**

| Section                          | Status                                | Decision        |
| -------------------------------- | ------------------------------------- | --------------- |
| Firestore Region                 | Verified by orchestrator (gcloud)     | PASS            |
| Identity Platform Upgrade        | Verified by orchestrator (admin v2)   | PASS            |
| passwordPolicy                   | Verified by orchestrator (admin v2)   | PARTIAL-PASS    |
| firebase.json declarations       | Verified by agent (verify-and-leave)  | PASS            |
| functions/src/auth scaffolding   | Verified by agent (.keep placeholder) | PASS            |

**Wave 2 unblock condition: SATISFIED.** All five Wave 1 sections decisively pass for the Wave 2 scope (function source authoring + Vitest unit tests against `claim-builder.ts`; no production deploy). The PARTIAL-PASS on `passwordPolicy` (HIBP not visible in admin v2 API response) is a Wave 5 carry-forward, not a Wave 2 blocker — Wave 2 doesn't exercise the password policy.

**Wave 5 carry-forward (must resolve before live cutover commits):**

1. Enable TOTP MFA at the project level (`mfa.state` is currently `DISABLED`). Verify post-toggle via the same admin v2 GET; expect `mfa.state: "ENABLED"` (or active enforcement equivalent) and a non-empty `mfa.providerConfigs` containing a TOTP entry.
2. Verify HIBP / leaked-password rejection at runtime during Wave 5 admin Console-creation: attempt a known-breached password (e.g., `Password123!`); expect `auth/password-does-not-meet-requirements`. If accepted, toggle ON in Console > Authentication > Settings > Password policy and re-test before the AUTH-14 deletion commit lands.

**Commit SHA of this preflight:** `<orchestrator updates after Wave 1 merge commit>`

**Wave 2 unblock timestamp:** `2026-05-09T00:15:00Z`

**Wave 1 done — Wave 2 cleared to start.**

---

## Wave 5 D-12 substrate adjustment (deviation captured 2026-05-09T13:30:00Z)

**Discovered before Step 1 of cutover.** The original D-12 design assumed the Phase 3 CI deploy job redeploys `firestore.rules` + `storage.rules` on every push to main. Reading `.github/workflows/ci.yml:189-192` showed the actual deploy command is:

```yaml
npx firebase-tools@15.16.0 deploy \
  --only hosting,functions \
  --project bedeveloped-base-layers \
  --non-interactive
```

Rules are not in the `--only` list — Phase 3 set up CI to deploy hosting+functions only. D-12's "5-minute rollback via `git revert + push`" substrate therefore did not actually exist at Wave 5 start. Caught before any production state changed.

**Resolution chosen (decided 2026-05-09T13:30:00Z): Option A — extend CI deploy to include rules.** The cutover commit (Step 8 in `runbooks/phase6-cutover.md`) will include a single-line edit to `ci.yml` adding `firestore:rules,storage:rules` to the `--only` list, atomic with the AUTH-14 deletions per D-04. The push of that commit IS the rules deploy. From that commit onward, the D-12 substrate works as designed: `git revert <cutover-sha> && git push` triggers CI which redeploys whatever rules are at the parent commit.

**Step 1 rehearsal procedure adjusted:** Because CI does not yet include rules, the pre-cutover rehearsal cannot use the `git revert + push + watch CI` loop in `runbooks/phase6-cutover.md` Step 1 verbatim. Substituted with a manual local `firebase deploy --only firestore:rules,storage:rules` rehearsal that exercises the same effect (production rules can be flipped quickly) using a different mechanism. Procedure:

1. Deploy current main rules to production: `firebase deploy --only firestore:rules,storage:rules --project bedeveloped-base-layers` (T0 timestamp).
2. Switch worktree to a pre-Phase-5 SHA's rules: `git show <pre-phase-5-sha>:firestore.rules > firestore.rules; git show <pre-phase-5-sha>:storage.rules > storage.rules`.
3. Deploy reverted rules: same `firebase deploy --only firestore:rules,storage:rules` (T1 timestamp).
4. Verify rules reverted in Firebase Console.
5. Restore current rules from main: `git checkout HEAD -- firestore.rules storage.rules`.
6. Re-deploy current rules: same `firebase deploy --only firestore:rules,storage:rules` (T2 timestamp).
7. Total elapsed time = T2 − T0; SC#4 target < 5 minutes.

The rehearsal proves the operator can flip rules in <5min via local CLI; the post-cutover production rollback uses the CI substrate. Both paths are now load-bearing and operator should know both. Captured for runbook update post-cutover.

**Runbook update deferred to post-cutover.** `runbooks/phase6-cutover.md` Step 1 + Step 8 are not edited mid-cutover. The actual procedure executed for this phase is the procedure above; the runbook will be reconciled to match in Step 12 or as a Wave 6 documentation task.

---

*Phase: 06-real-auth-mfa-rules-deploy*
*Plan: 06-01 (Wave 1 — Pre-flight Verifications)*
*Authored: 2026-05-08T20:21:52Z*
*Updated: 2026-05-09T13:30:00Z (D-12 substrate adjustment captured)*
