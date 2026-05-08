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

**Status:** PENDING-OPERATOR-EXECUTION

The executor agent's shell (Windows / PowerShell + Git Bash) has `gcloud` installed at `C:/Users/hughd/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud` but the `gcloud` Python launcher is broken in this environment (Python is not on PATH; `gcloud --version` and `gcloud auth list` both error with `Python was not found; run without arguments to install from the Microsoft Store, or disable this shortcut from Settings > Apps > Advanced app settings > App execution aliases`). The agent cannot exec gcloud reliably from inside the worktree.

**Operator action (BLOCKS Wave 2):**

1. Open a PowerShell or Git Bash window in any directory.
2. Confirm gcloud is authenticated: `gcloud auth list` — must show an active account that has `roles/datastore.viewer` (or higher) on the `bedeveloped-base-layers` project. If not, run `gcloud auth login` first.
3. Run the **Verify Command** above and paste verbatim stdout below.
4. If `locationId != europe-west2`, escalate to user before Wave 2 (see Decision section).

```
<paste gcloud stdout here>
```

**Verified at:** `<ISO timestamp when operator pastes>`

### Decision

**PENDING — operator must execute the gcloud command above and update this section before Wave 2 (06-02) starts.**

Outcome rules:

- If captured output is exactly `europe-west2	FIRESTORE_NATIVE`: write `### Decision: PASS — region verified at <ISO timestamp>` and Wave 2 proceeds.
- If `locationId != europe-west2`: write `### Decision: ESCALATE — Firestore region is <X>; D-09 requires europe-west2 to co-locate with cspReportSink + new auth functions; do NOT proceed to Wave 2 until user resolves.` Wave 2 is BLOCKED until escalation resolves (options: (a) accept region mismatch + update D-09 docs + accept latency cost; (b) Firestore data migration to new region — high blast radius; (c) re-create project — high blast radius).

---

## Identity Platform Upgrade

**Requirement:** Firebase project `bedeveloped-base-layers` MUST have the Identity Platform upgrade in place per AUTH-02 (else `passwordPolicy` API + TOTP MFA + org-wide MFA enforcement are absent — Phase 6 cannot ship).

This is a Firebase Console verification — no programmatic command exposes the upgrade flag uniformly.

### Verify Steps (Operator-Run)

1. Visit: `https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/providers`
2. Visual indicator: the page shows "Identity Platform" branding (top-right or in the header) AND the left nav shows an "MFA" tab AND the "Settings" sub-page exposes a "Password policy" section.
3. If absent (page shows only "Firebase Authentication" branding and no MFA tab), the project is on the legacy Firebase Auth tier and must be upgraded via Console "Upgrade to Identity Platform" button. Note: the upgrade is irreversible and may surface billing changes (operator should review pricing before upgrading).

### Captured Confirmation

**Status:** PENDING-OPERATOR-EXECUTION

**Operator action (BLOCKS Wave 2):**

After visiting the URL above and confirming the visual indicators, paste the confirmation block below:

```
verified_at: <ISO timestamp>
identity_platform_upgrade: <present|absent>
mfa_tab_visible: <yes|no>
password_policy_section_visible: <yes|no>
console_url: https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/providers
operator: <Luke|George>
```

### Decision

**PENDING — operator must complete the Console verification above before Wave 2 (06-02) starts.**

Outcome rules:

- If `identity_platform_upgrade: present` AND `mfa_tab_visible: yes` AND `password_policy_section_visible: yes`: write `### Decision: PASS — Identity Platform upgrade verified at <ISO timestamp>`.
- Otherwise: write `### Decision: ESCALATE — Identity Platform upgrade required for AUTH-02 (passwordPolicy + TOTP). Operator must run "Upgrade to Identity Platform" in Firebase Console before proceeding.` Wave 2 BLOCKED.

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

**Status:** PENDING-OPERATOR-EXECUTION

**Operator action (BLOCKS Wave 2):**

After visiting the Console URL above (or running the gcloud command), paste the confirmation block below:

```
verified_at: <ISO timestamp>
min_length: <int — must be >= 12>
hibp_enabled: <yes|no>
console_url: https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/settings
operator: <Luke|George>
gcloud_stdout (optional): <paste if gcloud command was used instead of Console>
```

### Decision

**PENDING — operator must complete the Console (or gcloud) verification above before Wave 2 (06-02) starts.**

Outcome rules:

- If `min_length >= 12` AND `hibp_enabled: yes`: write `### Decision: PASS — passwordPolicy verified at <ISO timestamp> (minLength=<N>, HIBP enabled)`.
- Otherwise: write `### Decision: ESCALATE — passwordPolicy below AUTH-04 threshold (minLength=<N>, hibp=<state>). Operator must enable in Console > Authentication > Settings > Password policy.` Wave 2 BLOCKED.

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

**Summary as of 2026-05-08T20:21:52Z (executor agent commit):**

| Section                          | Status                          | Decision    |
| -------------------------------- | ------------------------------- | ----------- |
| Firestore Region                 | PENDING-OPERATOR-EXECUTION      | PENDING     |
| Identity Platform Upgrade        | PENDING-OPERATOR-EXECUTION      | PENDING     |
| passwordPolicy                   | PENDING-OPERATOR-EXECUTION      | PENDING     |
| firebase.json declarations       | Verified by agent (verify-and-leave) | PASS  |
| functions/src/auth scaffolding   | Verified by agent (.keep placeholder created) | PASS |

**Wave 2 unblock condition:** all five sections must show `Decision: PASS`. Three of the five (Firestore Region, Identity Platform Upgrade, passwordPolicy) require live Firebase Console / gcloud access by the operator. The executor agent has captured the exact commands + URLs + expected outputs above; operator must run them and update this file before `/gsd-execute-phase 6` resumes for Wave 2.

**Commit SHA of this preflight:** `<populated by final commit of plan 06-01>`

**Wave 2 unblock timestamp:** `<populated when operator confirms all 3 PENDING-OPERATOR-EXECUTION sections turn PASS>`

**Operator next steps (in order):**

1. Run the gcloud command in `## Firestore Region` and paste stdout.
2. Visit the Console URL in `## Identity Platform Upgrade` and paste the confirmation block.
3. Visit the Console URL in `## passwordPolicy` and paste the confirmation block.
4. If all three PASS, write the Wave 2 unblock timestamp above.
5. If any ESCALATE, raise with user before running `/gsd-execute-phase 6` to start Wave 2.

---

*Phase: 06-real-auth-mfa-rules-deploy*
*Plan: 06-01 (Wave 1 — Pre-flight Verifications)*
*Authored: 2026-05-08T20:21:52Z*
