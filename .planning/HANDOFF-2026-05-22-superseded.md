# Handover — Diagnostic write-path debugging + UAT prep

**Date paused:** 2026-05-22
**Paused mid-task:** §0 of `docs/UAT.md` complete; §1 not yet started. Test accounts designed but not yet created — operator needs to seed `internalAllowlist`, create the internal Auth user in Firebase Console, and invite the two client users via the admin UI before §1 begins.
**Prior session handoff (now closed):** the earlier handover at this path was about getting `setClaims` callable working through Firebase Hosting rewrites; that work landed (PRs #34–#36). This document supersedes it. Old open follow-ups #1–#7 from that handover are repeated under "Open follow-ups" below where still relevant.

---

## TL;DR

User reported diagnostic clicks didn't save and Plan-view drag-drop didn't stick after the persistent-memory cross-device sync landed. Five PRs to triangulate:

| PR | What | Verdict |
|---|---|---|
| **#38** | Rules whitelist for `roadmaps.{months,quarters}` + `funnels.{years,kpis}` (real field names) + render-throttle in `_subscribeOrgs` / `onIdTokenChanged` to stop scroll-reset | Real fix for Plan/Funnel drag. Render-throttle was good. |
| **#39** | `setResponse` migrated to `/orgs/{orgId}/responses/{respId}` subcollection writes + `ensureResponsesSubscription` listener for cross-device sync | Real fix for diagnostic clicks. |
| **#40** | `cloudPushOrg` switched to `setDoc(..., { merge: true })` + strip `id`/`createdAt`/`orgId`. **Based on a wrong hypothesis** about Timestamp serialization drift. | Wrong fix; reverted by #42. |
| **#41** | **Actual root cause:** `immutable(field)` helper in `firestore.rules` used CEL bracket access — `request.resource.data["orgId"]` throws "no such key" on a doc that doesn't have the field, short-circuiting `allow update` to deny. Changed to `Map.get(field, null)`. Added regression test seed for an `orgs/orgLegacy` doc with no `orgId` field. | **Real fix.** |
| **#42** | Revert PR #40. With #41 in place the simpler full-`setDoc` form works correctly. | Cleanup. |

**Current prod state:** PRs #38–#41 deployed. PR #42 (revert of #40) is still open at time of writing — merging it is non-blocking; PR #40 + PR #41 together also work. Hugh confirmed diagnostic clicks + tier change both work post-#41 deploy.

---

## Lesson learned (record so future-me doesn't repeat it)

I spent three PRs (#38, #39, #40) theorizing about why parent-doc writes were failing — Timestamp drift, partial-update semantics, payload shape. **The bug was in the rule helper itself, not the client.** Two things I should have done first:

1. **Read the deployed `firestore.rules`** (via Firebase Rules API). I assumed the file in the repo was deployed; it was, but I didn't verify that early, and I never read the helper closely with fresh eyes.
2. **Run the user's actual scenario in the rules-test emulator** — the existing rules-tests always seeded `orgId: "orgA"` on every fixture doc, so they exercised one shape of the immutability check. A test with a doc *missing* `orgId` would have caught this in CI before any deploy.

The diagnostic script that finally gave me ground truth was simple — `setDoc` of `{ name: existingValue }` with merge. That should have been my first move, not my fourth.

For future debugging of rule denials: **always start with the live error code (`.code`), the actual server-side doc shape, and a minimal write attempt.** Don't theorize about payload composition until you've ruled out auth, doc-shape, and rule-helper behavior.

---

## Open follow-ups

### Architectural — tracked, not blocking UAT

1. **`addComment`, `addAction`/`updateAction`/`deleteAction`, `setEngagementStage`, `toggleStageCheck`, `setOrgClientPassphrase`, `setInternalNotes`** all still write the entire org back through `saveOrg → cloudPushOrg`. They WORK now (with PR #41's rule fix) but they're doing a full-org write per click — gratuitously expensive and a vestige of pre-Phase-5 architecture. Phase 5 already moved each to a dedicated subcollection (`/orgs/{orgId}/comments/{cmtId}` etc.). Worth migrating in a follow-up PR per the Phase 5 source-of-truth design.

2. **Legacy object-shaped responses on the parent doc were never migrated to the subcollection** — `scripts/migrate-subcollections/builders.js#buildResponses` only handled array-shaped values. If any prod org has historical diagnostic data only on the parent doc, it won't surface through `ensureResponsesSubscription`. Operator may need a one-shot backfill — out of scope here.

3. **App Check is in a 22h SDK backoff in prod** (`appCheck/throttled`). Independent of all the rule work — only affects callables (`setClaims`, `gdpr*`, soft-delete). Surfaces during admin role changes (UAT §2.B.3) and GDPR flows (§2.C). Needs the reCAPTCHA Enterprise key / origin config investigated separately. Clearing site data on the domain in DevTools resets the SDK backoff but won't fix the underlying 403 if it recurs.

4. **App Check Firestore enforcement is not on at the client SDK level** (verified: no `enforceAppCheck` reference in deployed bundle). Direct Firestore writes don't gate on App Check. If you later enable enforcement on Firestore in Firebase Console, the existing 22h throttle issue will block ALL Firestore operations, not just callables.

### Inherited from prior session (PR #36 trail) — still open

5. **Deploy the missing 8 callable functions** (`auditWrite`, `gdpr*`, soft-delete, etc.). All have hosting rewrites pre-wired in `firebase.json`. Build artifacts in `functions/lib/` are current.

6. **Re-add `serviceAccount: "<name>-sa"` lines + run `scripts/provision-function-sas/run.js`** in a properly-configured operator environment. Phase 7 FN-04 hardening (per-function minimal-IAM SAs). Currently all functions run under the default Cloud Functions runtime SA — security regression tracked.

7. **Fix `gcloud` on Hugh's Windows** — install Python 3 from python.org (NOT Microsoft Store), check "Add to PATH". Currently a productivity drag because we can't run `gcloud` commands locally for ad-hoc IAM / org-policy / project inspection.

8. **ADC reauth tripwire:** Workspace's reauth policy invalidates the ADC token periodically. Re-run `gcloud auth application-default login` whenever you see `invalid_rapt` from the Admin SDK. Once gcloud is fixed (#7), this becomes cheap.

9. **Roadmap state reconciliation:** `ROADMAP.md` shows Phase 6/7 plans as `[ ]` (autonomous: false). They're not formally done — substrate is on prod but the verification/cutover-runbook isn't followed. `STATE.md` narrative claims 99% milestone progress, which overstates reality. Worth reconciling before claiming the milestone done for the prospect demo.

---

## UAT state — where we are in `docs/UAT.md`

### §0 Pre-flight — `[x]` partially complete

| # | Status | Notes |
|---|---|---|
| 0.1 Browser profiles | ☐ | Need 3: Admin (Chrome default), Internal-consultant (Firefox or Chrome profile 2), Client (Incognito). Hugh has Admin profile only. |
| 0.2 Test accounts | ☐ | Scheme defined below; not yet seeded. |
| 0.3 UAT-Sandbox org | ☐ | Will be created during account setup. |
| 0.4 Sample upload files | ☐ | Need `ok.pdf` (≤5 MB), `big.bin` (≥26 MB), `payload.exe`, `weird name<>.pdf`. |
| 0.5 Headers `curl` | `[x]` | **PASS** — HSTS preload-eligible, CSP (report-only), all other hardened headers present. Captured 2026-05-22 09:00 UTC. |

§1–§6 — not started.

### Test account scheme (already designed, not yet provisioned)

Plus-aliases on `hugh@assume-ai.com` (Google Workspace) so all invites land in one inbox.

| Role | Email | First-time password | Org |
|---|---|---|---|
| Internal consultant | `hugh+uat-internal@assume-ai.com` | Initial via Firebase Console: `UATInternal-2026-Set!Fresh` (forced password change on first sign-in) | n/a |
| Client A | `hugh+uat-alpha@assume-ai.com` | Org passphrase `UATAlpha2026Passphrase`, then own password on first sign-in | `OrgAlpha` (Performance tier) |
| Client B | `hugh+uat-bravo@assume-ai.com` | Org passphrase `UATBravo2026Passphrase`, then own password on first sign-in | `OrgBravo` (Transformation tier) |

### Account-setup sequence (to execute before resuming UAT)

Signed in as Admin on `baselayers.bedeveloped.com`:

1. **Admin → Manage people → + New organisation** twice (OrgAlpha Performance, OrgBravo Transformation).
2. **Each org's row → Set passphrase** — use the passphrases in the table above.
3. **Seed `internalAllowlist`** via devtools console (admin can write per rules):
   ```js
   (async () => {
     const { db, firestore } = window.FB;
     await firestore.setDoc(
       firestore.doc(db, "internalAllowlist", "hugh+uat-internal@assume-ai.com"),
       { role: "internal", addedBy: "uat-setup-2026-05-22", addedAt: firestore.serverTimestamp() }
     );
     console.log("seeded");
   })();
   ```
4. **Firebase Console → Authentication → Add user** for `hugh+uat-internal@assume-ai.com` with the temp password above. `beforeUserCreated` blocking handler reads the allowlist row and assigns `{role: "internal"}` to the user's first ID token (per `functions/src/auth/beforeUserCreated.ts`).
5. **Admin panel → + Invite client** twice, one per org, using the emails + chosen org from the table.
6. **Sign in once as each new account** to complete first-run (set real password, enrol MFA for the internal one).

After step 6, §1–§6 of `docs/UAT.md` can run sequentially.

---

## How to resume

1. **Confirm PR #42 status** — if not merged yet, it's safe to merge (it's a cleanup revert). If you'd rather leave it, current main also works because PR #41's rule fix handles both the simpler full-`setDoc` and the merge-only approach.

2. **Execute the account-setup sequence above** (six steps; ~15–20 minutes including the first-sign-in flows).

3. **Resume from §1 Anonymous** of `docs/UAT.md` (10 min, no account needed — just an incognito window).

4. **Continue through §2 → §3 → §4 → §5 → §6** in order. Active testing target ~3h50; sections that are likely to need a deeper assist:
   - **§2.B.3 (role change)** — exercises `setClaims` callable; App Check throttle may bite here.
   - **§2.C (GDPR export/erasure)** — same App Check concern.
   - **§2.D.3 (backup gs:// inspection)** — needs `gcloud` working OR Cloud Console access.
   - **§2.E (rate-limit smoke)** — paste-script test; trivial once chat is reachable.
   - **§3.E.2 (signed-URL TTL test)** — requires waiting 65 min real-time; structure that around other work.

5. **If any UAT test fails:** open an issue or PR using the same workflow we've established — branch, fix, PR, merge. Re-test the affected section after deploy.

---

## Things future-you should NOT relitigate

- The 12-phase roadmap shape (locked decision per CLAUDE.md).
- Staying on Firebase + vanilla JS (locked decisions).
- The `cloudPushOrg` write path — it now works with PR #41's rule fix. Don't rewire it again unless follow-up #1 (subcollection migration of comments/actions/etc.) is being executed deliberately.
- The decision to route callables through Firebase Hosting (per prior handover — security + works without org-IAM elevation).
- The CSP report-only state — Phase 10 deliberately deployed report-only first; tightening to enforced is its own phase.

---

## Useful files + commands

| File / command | Purpose |
|---|---|
| `docs/UAT.md` | The 5h UAT script we're walking through. |
| `firestore.rules` | Has the `immutable()` safe-access fix as of PR #41. The two `mutableOnly` whitelists (roadmaps + funnels) were widened in PR #38. |
| `tests/rules/firestore.test.js` | Now includes an `orgs/orgLegacy` seed with no `orgId` field — regression test for PR #41. |
| `scripts/inspect-iam-tmp.mjs` | Dump IAM on Cloud Run services (needs ADC). |
| `scripts/grant-invoker-tmp.mjs` | Grant `roles/run.invoker` on a service (needs ADC). |
| `scripts/fetch-deployed-rules-tmp.mjs` | NEW — fetches the live deployed firestore.rules from the project's active release. Use this BEFORE assuming the repo file matches prod. (Needs ADC.) |
| `gh pr list --state open` | See what's still open — PR #42 may still be there if not merged. |
| `curl -I https://baselayers.bedeveloped.com \| grep -i last-modified` | Quickest way to confirm a deploy reached prod after a merge. |
