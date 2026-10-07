# Handover — Milestone v6 shipped; MFA and functions deploy still open

**Date paused:** 2026-10-07
**Supersedes:** the 2026-05-22 handover about diagnostic write-path debugging and UAT prep, preserved verbatim at `.planning/HANDOFF-2026-05-22-superseded.md`. Its still-open follow-ups are carried forward in §6 below — do not treat that file as live.
**State:** Milestone v6 is merged and deployed. Nothing is mid-flight. Three things are genuinely open (§5).

---

## 1. TL;DR

Milestone v6 ("Workflow & Usability") shipped across two PRs, both merged and live on production:

| PR | Merged | What |
|---|---|---|
| [#97](https://github.com/lukebadiali/base-layers-diagnostic/pull/97) | 2026-10-06 10:16Z | The nine-item change request: Actions grouping/filters/expand/edit, document folders, sorting, paste review, historic rounds |
| [#98](https://github.com/lukebadiali/base-layers-diagnostic/pull/98) | 2026-10-06 13:01Z | Follow-ups from live testing: org-selection persistence bug, whole-row folder click, Back button, drag-and-drop |

`main` is at `765c4be`. Verified live in the deployed bundle (`assets/main-CN7nWzO8.js`): `baselayers:activeOrg`, `docs-crumb-back`, `drop-target`, `dragstart` all present.

Plan of record: `.planning/MILESTONE-v6-WORKFLOW-USABILITY.md` (phases, REQ-IDs, outcomes, decisions D1–D6).
Manual test checklist: `.planning/MILESTONE-v6-UAT.md`.

**1001 tests, 117 files.** `npx vitest run` is clean on `main`.

---

## 2. Environment — read this before running anything

This machine was set up from scratch on 2026-10-06. Three traps:

**gcloud needs an explicit Python.** macOS ships 3.9; gcloud needs 3.10+. A standalone CPython 3.12 lives at `~/.local/pythons/python/bin/python3` and `~/.zshrc` exports `CLOUDSDK_PYTHON` to it. **A non-interactive shell does not source `~/.zshrc`**, so anything shelling out to `gcloud` must set it inline:

```sh
export CLOUDSDK_PYTHON="$HOME/.local/pythons/python/bin/python3"
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
```

Omitting it yields `gcloud failed to load … Python 3.9`, an empty access token, and a confusing `401 CREDENTIALS_MISSING` from whatever API you were calling. That exact trap cost a round trip.

**gcloud has ADC but no CLI account.** `gcloud auth application-default login` was run; `gcloud auth login` was **not**. So `firebase-admin` scripts work, but `gcloud projects …`, `gcloud functions …` and anything needing a CLI identity will fail with "no active account". Run `gcloud auth login` if you need those. (Carry-forward #8 below: Workspace reauth invalidates ADC periodically — re-run the ADC login on `invalid_rapt`.)

**Node 22 is required for the `functions` workspace.** `nvm use 22` (installed). On Node 20 the workspace will not install at all. Root install needs `npm ci --engine-strict=false` on Node 20.

**npm 10 cannot resolve the functions workspace.** Use `npx -y npm@11 install` inside `functions/`. See §4.

Admin scripts resolve `firebase-admin` from the **repo root** (it is a root devDependency), so run them from the repo root, not from `functions/`, despite what some script READMEs say.

---

## 3. What v6 actually changed

Read `.planning/MILESTONE-v6-WORKFLOW-USABILITY.md` for the full record. Shape of the code:

- `src/views/actions.js` and `src/views/documents.js` are now real (Phase A completed the long-pending Phase 4 D-02 re-homing as a pure move). `src/main.js` went 6,033 → ~5,500 lines.
- Four pure modules under `src/domain/`: `action-grouping.js`, `action-filters.js`, `document-sort.js`, `folder-tree.js`. `src/domain/**` carries a **100% line / 99% branch coverage gate** — adding a defensive branch there without a test fails CI.
- New Firestore subcollection `orgs/{orgId}/folders/{folderId}`. Documents gained `folderId`. **Storage paths are never rewritten by a move** — `firestore.rules` pins `storagePath` immutable for exactly that reason.
- `tests/mocks/window-fb.js` is a `window.FB` test double that unlocked the first behavioural tests the Documents tab has ever had. Three non-obvious requirements are documented in its header; read them before extending it.

### Decisions that will look odd without context

- **No field was added to any record** (decision D6), except `documents.folderId`, which is structurally required for folders. `description`, `lastEditedBy` and `lastEditedAt` were built and then removed on instruction. Consequence: **action content edits are unattributed** — recorded as `THREAT_MODEL.md` § Residual risks R2, not quietly dropped.
- **Documents requirements use the `FILE-` prefix, not `DOC-`.** The hardening milestone already owns `DOC-01`..`DOC-10` for documentation controls, and both sets are indexed by the same `docs/CONTROL_MATRIX.md`. Commits early in #97 still say `DOC-0N`.
- **`due` is staff-only on actions.** Clients can edit title, owner and pillar. The Overdue group is what the engagement is run from, so a client who could move a due date could clear their own overdue list.

### A claim that was made and then withdrawn

The pre-v6 documents listener queried unconstrained against a `notDeleted` read rule, which the documented Firestore model says should refuse the query. That was written up as a live production bug. **A rules test written to confirm it disproved it** — the emulator permits the unconstrained form. The claim was withdrawn from `SECURITY.md`, `docs/CONTROL_MATRIX.md`, the milestone plan, the backfill README and the view's own comment. Do not reintroduce it. The constrained query still ships because it is correct either way, and the backfill was required for an unrelated reason (an equality filter on `null` does not match a document missing the field).

---

## 4. CI — three failures fixed, and why they will recur

All three were pre-existing and unrelated to v6 scope. Fixed in #97.

**The `edgesOut` arborist crash.** `npm install --package-lock-only` in `functions/` crashed on npm 10 while resolving vitest's optional peer set. Bisected: `vitest@4.1.10` alone crashes, `4.1.11` resolves; **npm 11 resolves 4.1.10 fine**. It is an npm 10 bug and `node-version: 22` ships npm 10. Fixed by using `npx -y npm@11` in the audit, deploy and preview jobs. The August "fix" (pinning 4.1.10) only moved the trigger one patch release — **another version pin will not hold; keep the npm 11 route**.

**Do NOT "simplify" the functions audit step to audit the committed lockfile.** Measured: the committed `functions/package-lock.json` audits to 20 production vulnerabilities, 5 high and 1 critical. It is materially stale. The delete-and-re-resolve is load-bearing. The long comment in `.github/workflows/ci.yml` records the measurement. The durable fix is regenerating that lockfile **on Linux** so `npm ci` works — still open.

**`@grpc/grpc-js`** had two high advisories; root override moved to `^1.14.5`.

**There is no functions test or lint job in CI.** The only place functions code is compiled is the `tsc` build inside the deploy and preview jobs. `cd functions && npm test` and `npm run lint` must be run locally. Running them locally for the first time found a broken regression pin that tsc was happy with. `functions/npm run lint` currently reports **7 pre-existing errors** in files v6 did not touch. Adding a functions test+lint job is worth doing.

**Post-squash-merge rebase trap.** PRs here are squash-merged. Branching from a merged feature branch leaves your branch carrying the unsquashed commits while `main` has one — GitHub then cannot build a merge ref, the PR shows `CONFLICTING`, and **CI never fires at all**. This happened on both #97 and #98. Fix: `git rebase --onto origin/main <old-tip> <your-branch>`. Better: always branch from `main`.

---

## 5. Open — in priority order

### 5.1 MFA is enabled, and the enrolment flow has never been tested end to end

**Current state: `mfa.state: ENABLED`**, TOTP provider configured (`adjacentIntervals: 5`). It was `DISABLED` until 2026-10-06 ~11:30Z.

This is the messiest thread in the project and it caused a real lockout yesterday. The history:

- Phase 6 recovery deliberately disabled MFA in **two places to mirror each other**: the client gates (`false &&` short-circuits) and IdP `mfa.state`. `runbooks/phase-6-cleanup-ledger.md:47` tracks restoring both as a pair, conditional on row #1 (TOTP wiring) landing.
- The client gates were restored months ago. `mfa.state` was not. That mismatch is a **lockout waiting for the next sign-in**: the gate fires, then enrolment or the challenge fails against a disabled provider.
- Hugh hit it. His session had been alive since 18 August, so he had not exercised the sign-in path in seven weeks. Enabling `mfa.state` fixed it — his existing factor verified and he is back in.

**What is still unverified: whether a fresh TOTP *enrolment* completes.** Nobody has done one since Phase 6. `accounts:query` shows `george+uat-internal@bedeveloped.com` and `david.wilson@fosway.com` with **zero factors** — they will hit enrolment on their next sign-in. If it does not work, they are locked out.

**Do this:** enrol a test account end to end in a browser, then close the cleanup-ledger row. The escape hatch if someone is stuck is `scripts/admin-mfa-unenroll/run.js --uid <uid>` (clears the factor so they can enrol fresh) — safe only while `mfa.state` is ENABLED.

**Do not** flip `mfa.state` back to DISABLED while the client gates are live. That is what created the trap.

### 5.2 The functions deploy has never run for v6

Folder soft-delete and six folder audit-event literals are **inert**. Deleting a folder errors at the callable; folder audit rows are silently skipped. Everything else in v6 works.

This is **not a routine deploy**. `.github/workflows/ci.yml` and `runbooks/phase-6-cleanup-ledger.md` document that `firebase deploy --only functions` on this project tries to bind `roles/run.invoker` to `allUsers`, which org policy blocks — and the failure **wipes the `gcp-sa-identitytoolkit` invoker binding**, breaking the blocking auth handlers. Those handlers are live (`blockingFunctions.triggers` was re-wired 2026-10-06 09:50Z), so a bad run takes sign-in down platform-wide.

Needs someone with project admin (Luke; Hugh has `pull, push, triage` on the repo and no gcloud CLI account). Invoker bindings were intact as of 2026-10-06 — `allUsers → roles/run.invoker` on `auditwrite`, `getdocumentsignedurl`, `softdelete`, `beforeusercreatedhandler`. **Check them again after any functions deploy.**

```sh
cd functions && npx -y npm@11 install && npm run build
npx firebase-tools@15.16.0 deploy --only functions --project bedeveloped-base-layers
```

### 5.3 Manual UAT of v6 is unfinished

`.planning/MILESTONE-v6-UAT.md` has 79 numbered checks. Hugh confirmed the **document folders work**, which is what produced the #98 follow-ups. The rest — Actions grouping/filters/expand, paste review, historic rounds, the regression sweep — has not been walked.

Its §0 gates are now partly cleared: Java is still **not** installed (no local emulator, so `npm run test:rules` is CI-only), Node 22 is installed, and MFA is enabled.

### 5.4 Lower priority

- **`auditWrite` 401 noise.** Audit events emitted on unauthenticated paths (failed sign-in, password reset) can never succeed — the callable requires auth — and `src/cloud/audit.js` retries 4×, so one failure is four console errors. Harmless and swallowed; the code comments already call it expected. Cheap fix: skip emission when `auth.currentUser` is null. Failed sign-ins should be audited **server-side** from `beforeUserSignedIn` instead.
- **~35 files fail `prettier --check` on `main`.** Pre-existing drift. **Do not run `prettier --write` over `src/` or `tests/`** — it reformats unrelated files, and in one case moved committed snapshots. Format only the files you touched. This caught me twice.
- **`npm run format:check` and `npm run build` fail locally** for unrelated reasons (the build wants `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`). Not regressions.

---

## 6. Carried forward from the 2026-05-22 handover

Still open, verbatim intent:

1. **Full-org writes.** `addComment`, `addAction`/`updateAction`/`deleteAction`, `setEngagementStage`, `toggleStageCheck`, `setOrgClientPassphrase`, `setInternalNotes` still write the whole org doc per click, a pre-Phase-5 vestige. Subcollections already exist. (v6 did not change this — `updateAction` still goes through the localStorage mirror plus a per-action push.)
2. **Legacy object-shaped responses** on the parent doc were never migrated; `scripts/migrate-subcollections/builders.js#buildResponses` only handled array shapes. May need a one-shot backfill.
3. **App Check / reCAPTCHA Enterprise** origin config was never fully investigated. `enforceAppCheck` has been dropped from most callables (see the `PLATFORM-UAT post-T19` comments in `functions/src/`).
4. **Per-function service accounts** (`provision-function-sas`) never applied; all functions run under the default runtime SA. Tracked security regression.
5. **ADC reauth tripwire.** Workspace policy invalidates the ADC token; re-run `gcloud auth application-default login` on `invalid_rapt`.
6. **Roadmap state reconciliation.** `ROADMAP.md` shows Phase 6/7 as `[ ]`; `STATE.md` claims ~99%. The two disagree and `STATE.md` overstates. Worth reconciling before any prospect demo — and v6 is not reflected in either.

---

## 7. Production facts worth knowing

- **8 live orgs**, 19 documents, 155 Auth accounts (17 with email). `PROJECT.md`'s "between active engagements, no live users" is **out of date** — there is real client data.
- Folders exist only in **BeDeveloped** (`org_b5d50284bbe`) — two, created during testing.
- `scripts/backfill-document-folder-fields/run.js` was run on 2026-10-06: 19 documents patched with `deletedAt: null` / `folderId: null`. Idempotent; a re-run reports 0. **It was required** — 18 of those 19 would have vanished from the Documents tab once the constrained query shipped.
- One document is genuinely soft-deleted (`org_8irmvbmobvz/.../doc_6c4b3ac3eba`, `deletedAt` 26 May) and correctly stays hidden.
- `baselayers.bedeveloped.com` and `bedeveloped-base-layers.web.app` serve the **same** bundle.
- Merging to `main` auto-deploys `hosting,firestore,storage`. **Functions are excluded** — always manual (§5.2).

---

## 8. Working notes for whoever picks this up

- **Check the data before reasoning from the code.** Two wrong diagnoses yesterday came from reading source and inferring instead of querying Firestore or the Auth API. The user's "no reports of any issues" was better evidence than either.
- **The classifier blocks production auth-config writes.** `PATCH identitytoolkit …/config` is refused in auto mode. Hand the operator the exact command rather than trying to route around it.
- **A `git stash` / `stash pop` cycle around a `git checkout` will resurrect formatting changes** you previously reverted. Check `git status` after.
