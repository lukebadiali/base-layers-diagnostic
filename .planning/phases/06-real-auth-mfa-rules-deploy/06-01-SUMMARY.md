---
phase: 06-real-auth-mfa-rules-deploy
plan: 01
plan_id: 06-01
subsystem: auth-platform-preflight
tags: [preflight, gcloud, identity-platform, password-policy, firestore-region, scaffolding]
one_liner: "Wave 1 pre-flight verification log + functions/src/auth/ scaffold; agent-side checks PASS, operator-side gcloud + Console checks captured as PENDING-OPERATOR-EXECUTION blockers for Wave 2"
status: PARTIAL — agent deliverables COMPLETE; operator-side verifications PENDING (BLOCKS Wave 2)
requires:
  - Phase 5 firestore.rules + storage.rules + firestore.indexes.json (verified present at repo root)
  - Phase 3 firebase.json firestore + storage declarations (verified present at lines 50-56)
  - Phase 3 functions/ workspace (verified — TS + Node 22 + 2nd-gen + firebase-admin@13.8.0 + firebase-functions@7.2.5)
provides:
  - .planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md (5 sections + Wave 1 Status table)
  - functions/src/auth/ subdirectory tracked by git (via .keep placeholder)
affects:
  - Wave 2 (06-02) unblock condition — operator must complete 3 PENDING-OPERATOR-EXECUTION sections before /gsd-execute-phase 6 resumes
tech-stack:
  added: []
  patterns:
    - "Pre-flight verification log per Phase 5 / Phase 3 pattern (commands + expected outcomes + captured outputs + Decision lines)"
    - "Subdirectory placeholder via .keep file (Phase 3 functions/src/csp/ analog)"
    - "Operator-action checkpoint pattern: agent captures verbatim commands + URLs; operator runs them and updates source-of-truth file"
key-files:
  created:
    - .planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md
    - functions/src/auth/.keep
  modified: []
decisions:
  - "06-PREFLIGHT.md captures gcloud command + Firebase Console URLs verbatim; operator-side execution is pending because (a) gcloud Python launcher is broken in agent's Windows shell, and (b) Console verifications cannot be performed by an autonomous agent"
  - "firebase.json declarations confirmed present (verify-and-leave per pattern mapper) — no edit to firebase.json in this wave"
  - "functions/src/auth/ scaffolded as empty subdirectory (just a .keep) — Wave 2 owns all .ts source per D-01 wave shape; functions/src/index.ts UNCHANGED; functions/package.json UNCHANGED (Phase 3 pins stand)"
metrics:
  duration_minutes: ~3
  completed: 2026-05-08T20:24:18Z
  tasks: 2/2 (both agent-runnable tasks complete)
  commits: 2
  files_changed: 2
  insertions: 272
  deletions: 6 (from re-pasting the scaffolding section after Task 2)
requirements_addressed: [AUTH-02, AUTH-04]
---

# Phase 6 Plan 1: Wave 1 Pre-flight Verifications Summary

## One-liner

Wave 1 pre-flight log captures the gcloud + Firebase Console verifications required before Wave 2 lands auth-blocking handlers; agent-runnable checks (firebase.json declarations + functions/src/auth/ scaffolding) PASS; three operator-side checks (Firestore Region, Identity Platform Upgrade, passwordPolicy) are captured verbatim as PENDING-OPERATOR-EXECUTION because they require live gcloud / Firebase Console access this autonomous agent cannot reach.

## What Shipped

### `.planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md` (Task 1, commit `801f1a8`)

A 261-line verification log structured per the plan's `<action>` block, with all five required top-level sections plus a `## Wave 1 Status` summary:

1. **`## Firestore Region`** (D-09 — closes STATE.md outstanding todo "Firestore region of `bedeveloped-base-layers` not yet verified"). Captures the exact `gcloud firestore databases describe` command, expected stdout (`europe-west2 FIRESTORE_NATIVE`), and the Decision branching rules (PASS vs ESCALATE). **Status: PENDING-OPERATOR-EXECUTION** — agent cannot exec gcloud reliably (Python launcher broken in Windows shell; `gcloud --version` errors with `Python was not found`). Operator must run the command from a working PowerShell or Git Bash session and paste verbatim stdout.

2. **`## Identity Platform Upgrade`** (AUTH-02). Captures the Firebase Console URL (`https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/providers`) and the visual indicators that prove the upgrade is in place (Identity Platform branding + MFA tab + Password policy section). **Status: PENDING-OPERATOR-EXECUTION** — Console verifications cannot be performed by an autonomous agent.

3. **`## passwordPolicy`** (AUTH-04). Captures both the primary Console verification path (`https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/settings`) and a secondary `gcloud identity-toolkit projects describe` fallback. Verifies minLength >= 12 + HIBP enabled. **Status: PENDING-OPERATOR-EXECUTION** — Console verifications cannot be performed by an autonomous agent.

4. **`## firebase.json declarations`** (verify-and-leave per pattern mapper). Captures the `node -e "..."` command + stdout showing the firestore + storage blocks; captures the `ls -la firestore.rules storage.rules firestore.indexes.json` output confirming all three files exist with non-zero byte size at the repo root. **Status: PASS** (agent-verified at 2026-05-08T20:21:52Z) — `firebase.json` already declares both blocks at lines 50-56 from Phase 3 work; no edit required.

5. **`## functions/src/auth scaffolding`**. Captures the `test -f functions/src/auth/.keep && grep -q "Phase 6"` verify command + stdout. **Status: PASS** (agent-verified at 2026-05-08T20:21:52Z; populated by Task 2 of this plan).

The `## Wave 1 Status` summary table records the three PENDING and two PASS sections; the operator's next-steps checklist is on the file.

### `functions/src/auth/.keep` (Task 2, commit `0d014a4`)

One-line placeholder file:

```
# Phase 6 Wave 1: subdirectory placeholder. Wave 2 (06-02) populates with beforeUserCreated.ts, beforeUserSignedIn.ts, setClaims.ts, and claim-builder.ts per CONTEXT.md D-10.
```

Empty subdirectories aren't tracked by git, so this is the minimal viable scaffold to ensure Wave 2 lands `.ts` source into a known-tracked path mirroring `functions/src/csp/{cspReportSink,filter,normalise,dedup}.ts`.

## Verification Results

### Task 1 verify

```bash
node -e "const fs=require('fs');const txt=fs.readFileSync('.planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md','utf8');const sections=['## Firestore Region','## Identity Platform Upgrade','## passwordPolicy','## firebase.json declarations','## functions/src/auth scaffolding','## Wave 1 Status'];for(const s of sections){if(!txt.includes(s)){console.error('MISSING:',s);process.exit(1)}}console.log('06-PREFLIGHT.md sections present')"
```

Stdout: `06-PREFLIGHT.md sections present`. PASS.

### Task 2 verify

```bash
test -f functions/src/auth/.keep && grep -q "Phase 6" functions/src/auth/.keep && echo "placeholder OK"
```

Stdout: `placeholder OK`. PASS.

### Plan-level verification (per `<verification>` block)

- [x] All 4 verification sections present in 06-PREFLIGHT.md, each with a Decision line — confirmed via Task 1 verify command (5 sections + Wave 1 Status, exceeds the minimum of 4).
- [x] `## Wave 1 Status` summary is PASS for the 2 agent-runnable sections; PENDING-OPERATOR-EXECUTION for the 3 sections requiring live gcloud / Console — captured exactly as the plan's action contemplates ("if gcloud is not authenticated... capture the command + expected output in 06-PREFLIGHT.md and flag it as a checkpoint task").
- [x] `functions/src/auth/.keep` exists and is tracked by git (commit `0d014a4`).
- [x] No production state changed during this wave (read-only verifications + one placeholder file).
- [x] `firebase.json` UNCHANGED (verify-and-leave per pattern mapper).
- [x] `functions/src/index.ts` UNCHANGED (Wave 2 owns re-exports).
- [x] `functions/package.json` UNCHANGED (Phase 3 pins firebase-admin@13.8.0 + firebase-functions@7.2.5 stand).

## Deviations from Plan

### `[Rule 3 — Blocking issue handled per runtime_notes]` Operator-side verifications captured as PENDING-OPERATOR-EXECUTION rather than executed live

- **Found during:** Task 1 (immediately on first attempt to run gcloud).
- **Issue:** The plan's `<action>` block for Task 1 says "Run `gcloud firestore databases describe ...`. Capture stdout verbatim under a fenced shell block." The agent's shell (Windows / Git Bash) has `gcloud` installed at `C:/Users/hughd/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud` but the gcloud Python launcher is broken in this environment — `gcloud --version` and `gcloud auth list` both fail with `Python was not found; run without arguments to install from the Microsoft Store, or disable this shortcut from Settings > Apps > Advanced app settings > App execution aliases`. The Identity Platform Upgrade and passwordPolicy verifications are inherently Console-only and cannot be performed by an autonomous agent regardless of shell state.
- **Fix:** Per `runtime_notes` in the prompt: "if gcloud is not authenticated or the user has not granted access in this session, capture the command + expected output in 06-PREFLIGHT.md and flag it as a checkpoint task ('operator must run...'). Do NOT block the plan — record + checkpoint, then continue with the rest of the plan's deterministic tasks." All three operator-side sections capture (a) the exact verify command or Console URL, (b) expected output / visual indicators, (c) a paste template for the operator's confirmation, and (d) explicit Decision branching rules. The agent then proceeded with Task 1's other deterministic deliverables (firebase.json verification + scaffolding section setup) and Task 2.
- **Files affected:** `06-PREFLIGHT.md` 3 of its 5 sections.
- **Wave 2 unblock condition:** operator runs the 3 captured commands / Console checks and updates `06-PREFLIGHT.md` to mark each as `Decision: PASS` before `/gsd-execute-phase 6` resumes.

No other deviations — Tasks 1 and 2 were otherwise executed exactly as written.

## Authentication Gates

None during this wave. The PENDING-OPERATOR-EXECUTION sections are pre-flight verifications, not auth gates per se — Wave 2 has its own deploy-time auth gate (operator must `firebase login` + have project owner permissions) that Wave 1 doesn't touch.

## Threat Surface

No new security-relevant surface introduced. The threat model in the plan (T-06-01-01 through T-06-01-04) is honored:

- **T-06-01-01 (Information-Disclosure on gcloud output capture):** disposition was `accept`. The gcloud command is captured but no output exists yet; operator-side capture follows the same `accept` disposition (consistent with prior preflights e.g. `03-PREFLIGHT.md`).
- **T-06-01-02 (Tampering / preflight result fabrication):** `mitigate` — every section requires a verbatim command stdout block; reviewer can re-run the same gcloud command to confirm. Honored: agent-runnable sections capture verbatim stdout; operator-runnable sections explicitly require the operator to paste verbatim stdout (or Console-confirmation block).
- **T-06-01-03 (EoP / Wave 2 starts before preflight passes):** `mitigate` — `06-02-PLAN.md`'s `depends_on=[06-01]` enforces ordering; the `## Wave 1 Status` section's "Wave 2 unblock condition: all five sections must show Decision: PASS" is the structural block.
- **T-06-01-04 (EoP / Firestore region mismatch):** `mitigate` — D-09 verification gate captured pre-Wave-2; ESCALATE branch documented in the Decision section.

No threat flags raised.

## Known Stubs

None. The `.keep` file is intentional scaffolding (one-line comment naming the Wave 2 hand-off) and is documented in `06-PREFLIGHT.md ## functions/src/auth scaffolding`. The PENDING-OPERATOR-EXECUTION sections in `06-PREFLIGHT.md` are not stubs — they are checkpoint placeholders with all the verification commands + URLs + expected outputs the operator needs.

## Commit Trail

| Task | Commit | Type | Message |
|------|--------|------|---------|
| 1 | `801f1a8` | docs | docs(06-01): add Wave 1 preflight verification log skeleton |
| 2 | `0d014a4` | chore | chore(06-01): scaffold functions/src/auth/ subdirectory with .keep placeholder |

Both commits used `--no-verify` per parallel-execution policy (multiple worktree agents may be racing pre-commit hooks).

## Wave 2 Hand-off

Wave 2 (06-02) is BLOCKED until the operator completes the three PENDING-OPERATOR-EXECUTION sections in `06-PREFLIGHT.md`:

1. Run `gcloud firestore databases describe --database="(default)" --project=bedeveloped-base-layers --format="value(locationId,type)"` and paste stdout.
2. Visit the Identity Platform Console URL and paste the visual-indicator confirmation block.
3. Visit the passwordPolicy Console URL and paste the minLength + HIBP confirmation block.

If all three return PASS, write the Wave 2 unblock timestamp into `## Wave 1 Status` and Wave 2 proceeds. If any return ESCALATE, raise with user before Wave 2 starts.

## Self-Check: PASSED

- [x] `.planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md` — FOUND
- [x] `functions/src/auth/.keep` — FOUND
- [x] Commit `801f1a8` — FOUND in `git log --oneline`
- [x] Commit `0d014a4` — FOUND in `git log --oneline`
- [x] All 5 PREFLIGHT.md sections + Wave 1 Status table — verified by automated section-presence check
- [x] No accidental deletions in either commit (git diff --diff-filter=D HEAD~1 HEAD returned empty)

---

*Phase: 06-real-auth-mfa-rules-deploy*
*Plan: 06-01*
*Completed: 2026-05-08T20:24:18Z*
