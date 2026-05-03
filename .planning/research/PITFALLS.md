# Pitfalls Research

**Domain:** Firebase-backed multi-tenant SaaS — hardening pass to compliance-credible (SOC2 / ISO27001 / GDPR / OWASP ASVS L2)
**Researched:** 2026-05-03
**Confidence:** HIGH for Firebase-platform pitfalls (Context7 + official docs verified). MEDIUM for codebase-specific sequencing (inferred from `.planning/codebase/CONCERNS.md`). LOW only where flagged inline.

---

## Phase Reference

This document refers to phases by the **recommended fix order** from `CONCERNS.md` §Summary and the Active list in `PROJECT.md`. Treat this mapping as the canonical phase numbering for the milestone:

| # | Phase | Closes |
|---|-------|--------|
| 1 | Firestore + Storage Security Rules (server-side authz substrate) | C3, H6 |
| 2 | Real Firebase Auth (Email/Password + custom claims) + remove `INTERNAL_PASSWORD_HASH` + MFA for internal users | C1, C2, M6, H3 |
| 3 | Engineering foundations: `package.json` + Vite + Vitest + GitHub Actions CI + self-host Firebase/Chart.js + SRI/CSP scaffold + `crypto.randomUUID()` + delete `html:` escape hatch | H1, H2, H4 (partial), H5, C4, M1, M2 |
| 4 | Modular split of `app.js` (test-fenced refactor) | H1 |
| 5 | App Check enrolment (after auth + foundations stable) | (defence-in-depth across all collections) |
| 6 | Cloud Functions for privileged writes (audit log, custom-claims setter, scheduled jobs, soft-delete cascades) | M4 (partial), Missing: audit log, soft-delete |
| 7 | Soft-delete + GDPR export + erasure flows | Missing: soft-delete, GDPR rights |
| 8 | Scheduled Firestore export to GCS (DR backup) | Missing: backup automation |
| 9 | Strict CSP rollout (report-only → enforced) + finish security headers | H4 (full) |
| 10 | Centralised observability (Sentry-or-equivalent for browser + Functions) + structured audit log alerting | M4 (full) |
| 11 | Data-integrity test pass — H7 (clock comparators) + H8 (last-writer-wins sync) — *only safe after tests + Rules + sync changes ready* | H7, H8 |
| 12 | `SECURITY.md` + audit-driven walkthrough → `SECURITY_AUDIT_REPORT.md` | Compliance-credibility evidence |

---

## Critical Pitfalls

### Pitfall 1: Locking yourself out of production Firestore on first rules deploy

**What goes wrong:**
You ship a strict `firestore.rules` to production while the app is still running on anonymous auth + custom claims that haven't propagated. Every existing client (and the migration job you're about to run) starts getting `permission-denied`. Sync stops. Client `localStorage` caches go stale. You can't even read your own data to debug.

**Why it happens:**
- The natural instinct is to fix C3 (no rules) by writing the *correct* rules first time. But "correct" assumes the *rest* of the system already meets them — non-anonymous auth, custom claims with `orgId`/`role`, sanitised document shapes, an `authorId` on every write.
- This codebase currently violates *all* of those preconditions. Anonymous auth has no claims (`firebase-init.js:52`). Documents are written without an `authorId` field on many paths. Org docs lack a canonical `orgId` claim mapping per user.
- Rules deployed via `firebase deploy --only firestore:rules` are atomic and immediate. There is no "10% rollout" knob for Rules (unlike App Check).

**How to avoid:**
1. **Sequence Rules deployment AFTER auth migration is complete and verified for all production users in the data set.** Concretely: don't ship strict rules in Phase 1 in isolation — Phase 1 ships the *Rules logic and unit tests*, but the production *deploy* gate is Phase 2 completion (real auth + claims).
2. **Use a staging Firebase project** (`bedeveloped-base-layers-staging`) seeded from a Firestore export of production. Run the full migration on staging. Verify rules pass with real claims. Only then deploy to production.
3. **Never go straight from "test mode" (`allow read, write: if request.auth != null`) to strict.** Use a transitional shape per collection during cutover:
   ```
   match /orgs/{orgId} {
     // Phase 1 transitional: scoped to authenticated, all reads allowed for migration job
     allow read: if request.auth != null;
     allow write: if request.auth != null
       && request.auth.token.role == "internal"; // only the migration tool / Cloud Functions
   }
   ```
   Then narrow read to `request.auth.token.orgId == orgId` once claims are populated.
4. **Keep an "owner debug" predicate** during migration: `allow read: if request.auth.token.email in ["luke@bedeveloped.com","george@bedeveloped.com"]`. Remove on Phase 2 closeout.
5. **Have the rollback ready** — keep the previous `firestore.rules` in git, and rehearse `firebase deploy --only firestore:rules` against the staging project from a known-good commit.

**Warning signs:**
- Browser console fills with `FirebaseError: Missing or insufficient permissions` after a Rules deploy.
- `cloudPushOrg` in `app.js:2614` starts hitting its `catch` branch silently (`console.error` only — `app.js:2618`); user sees nothing but data isn't syncing.
- Cloud Function `onSnapshot` cursors stop firing (the listener silently errors).

**Phase to address:** **Phase 1 (write + test rules)**, **Phase 2 (deploy strict rules)**. Critical that Phase 1 *commits the rules file* but doesn't deploy it to prod.

---

### Pitfall 2: Confusing `request.auth != null` with access control

**What goes wrong:**
Default test-mode rules say `allow read, write: if request.auth != null`. Devs assume "logged-in users only" = "secure". With anonymous auth still enabled (which this app uses), *every page visitor* gets a Firebase token — so `request.auth != null` is **trivially satisfied by anyone who can hit the app's URL**. This is exactly C3 in `CONCERNS.md`.

**Why it happens:**
Firebase Auth's default mode is anonymous-friendly; `signInAnonymously` produces a `request.auth` that is non-null, has a UID, and looks identical to an authenticated user from the perspective of a naive rules predicate. The rule reads "is signed in", but in this app the threshold for "signed in" is "loaded the page".

**How to avoid:**
1. **Disable Anonymous Auth in the Firebase Console** as part of Phase 2. (Authentication → Sign-in method → Anonymous → Disable.) This single step eliminates an entire class of rules-bypass.
2. **Predicate every rule on a custom claim, not on `auth != null`**:
   ```
   function isAuthed() { return request.auth != null && request.auth.token.email_verified == true; }
   function isInternal() { return isAuthed() && request.auth.token.role == "internal"; }
   function inOrg(orgId) { return isAuthed() && request.auth.token.orgId == orgId; }
   ```
3. **Add a CI test** (`@firebase/rules-unit-testing`) that asserts an anonymous-token holder is denied on every collection. Make this test fail closed.
4. **In Cloud Functions, double-check `context.auth.token.role`** — never trust the client to send its own role.

**Warning signs:**
- Any rule predicate of the form `if request.auth != null` reaches review.
- `isSignedIn()` helper in rules without further claim checks.
- Anonymous Auth still shown as "Enabled" in Firebase Console after Phase 2.

**Phase to address:** **Phase 1** (write rules predicated on claims) + **Phase 2** (disable Anonymous Auth + populate claims).

---

### Pitfall 3: `resource.data` vs `request.resource.data` confusion in update rules

**What goes wrong:**
Devs write `allow update: if resource.data.orgId == request.auth.token.orgId` to enforce that a user can only update docs in their own org. Then a malicious user *changes* `orgId` on the update payload and the rule passes — because `resource.data` is the *pre-update* state and the rule says nothing about what the *post-update* state will look like.

**Why it happens:**
The names are subtly different: `resource.data` = current document; `request.resource.data` = incoming write payload. Forgetting to constrain *both* sides of an update lets attackers re-key documents into their own tenant.

**How to avoid:**
1. **For every `allow update` rule, constrain immutable fields:**
   ```
   allow update: if inOrg(resource.data.orgId)
     && request.resource.data.orgId == resource.data.orgId       // can't change owner
     && request.resource.data.id == resource.data.id              // can't change id
     && request.resource.data.createdAt == resource.data.createdAt; // can't backdate
   ```
2. **Add a `function diff(a, b)` helper** using `request.resource.data.diff(resource.data).affectedKeys()` to whitelist exactly which fields a role can change:
   ```
   function clientCanUpdateFields() {
     return request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(["responses", "comments", "actions"]);
   }
   ```
3. **Unit-test the "tenant-jump" attack** explicitly: assert that a write changing `orgId` is denied even if the principal is inOrg of the *original* `orgId`.

**Warning signs:**
- Rules that mention `resource.data` but not `request.resource.data` on update paths.
- `diff(...).affectedKeys()` not used anywhere — almost certainly missing immutability checks.

**Phase to address:** **Phase 1** — bake into the rules linter / unit tests from day one. Cross-tenant rewrites are the highest-impact rules failure.

---

### Pitfall 4: `getAfter()` and `get()` rule traps — billing, depth limits, and emulator vs prod drift

**What goes wrong:**
`getAfter()` is the only way Rules can read a document's *post-write* state across a transaction (e.g. "the audit-log doc was written and matches this update"). Misuses:
- **Billing surprise:** every `get()` / `getAfter()` is a billable Firestore read *even if the rule denies the write* ([Firebase docs](https://firebase.google.com/docs/firestore/security/rules-conditions)). At scale, rules-side reads dominate cost.
- **Depth limit:** Rules cap document-access calls per evaluation (10 calls in single-doc requests, 20 for multi-doc). Going over fails closed — every write rejected with a non-obvious error.
- **Emulator passes, prod fails:** the emulator's `getAfter()` historically threw on non-existent docs ([firebase/firebase-tools#2067](https://github.com/firebase/firebase-tools/issues/2067)) — the production behaviour and emulator behaviour have diverged, so your rules tests can give a false green.

**Why it happens:**
Rules language *looks* like JavaScript but runs in a constrained, billable, depth-limited environment. Devs treat it like general code, write deeply nested cross-collection lookups, and only discover the limits in production under load.

**How to avoid:**
1. **Denormalise the data needed by Rules onto the document itself.** If a rule needs to know "is this user a member of this org", store `members: [uid1, uid2]` directly on the org doc, not via a `get(/orgs/.../members/$uid)` lookup.
2. **Push complex cross-collection authorisation to Cloud Functions**, not Rules. Rule says `allow write: if false; // writes via callable function only`. Function does the cross-doc validation server-side, where logic is testable, observable, and not depth-capped.
3. **Custom claims for tenant scope.** `request.auth.token.orgId` is free to read; `get(/users/$(uid)).data.orgId` costs a read every rule eval. Bake `orgId` into the claim.
4. **Pin emulator to current version + run rules tests against a real Firebase test project nightly in CI** to catch emulator/prod drift.

**Warning signs:**
- Firestore "Rules evaluations" cost line item growing faster than Firestore reads.
- `permission-denied` errors with message text "too many calls" or "exceeded the maximum number".
- Anything beyond 1 `get()` per rule.

**Phase to address:** **Phase 1** (architect the Rules to avoid these traps). **Phase 6** when offloading to Cloud Functions.

---

### Pitfall 5: Anonymous-auth UID vs application-internal `userId` mapping during auth migration

**What goes wrong:**
This codebase keys Firestore documents by app-internal `userId` strings minted by `Math.random()` (`app.js:30-31`, `app.js:121, 122, 144, 153` etc). Firebase Auth uses its own UIDs. When you migrate to real auth, every existing document's `authorId`, `userId` field, and `orgs/{orgId}.users[]` reference still points at the *old* random ids — but `request.auth.uid` is now a *new* Firebase UID. Rules predicated on `resource.data.authorId == request.auth.uid` fail for every legacy doc.

**Why it happens:**
Anonymous Firebase Auth produced a per-browser-install UID that the app never bothered to use; the app's identity layer (in `localStorage`) was completely separate. Cutting over to real auth means *replacing the identity space*, not just *adding to it*. Without a remapping table, every legacy reference is orphaned.

**How to avoid:**
1. **Add an `appUserId → firebaseUid` map** as the first migration step. For each user record in Firestore `users/`, when they first sign in via Firebase Auth, write a `users/{firebaseUid}` doc with `legacyAppUserId: <old-id>`. Keep the legacy doc but mark `migrated: true`.
2. **Run a backfill Cloud Function** that, for every `orgs/*`, `messages/*`, `documents/*`, `funnelComments/*` doc, rewrites `authorId` / `userId` from legacy id → Firebase UID using the map. **Do this in transactions, in batches of ≤500, with idempotency markers** so re-runs don't duplicate work.
3. **Rules during migration accept either id**:
   ```
   function isAuthor() {
     return resource.data.authorId == request.auth.uid
         || resource.data.authorId in request.auth.token.legacyIds;
   }
   ```
   Once backfill completes, drop the second clause.
4. **Make backfill audit-logged** — the audit log entry "remapped X documents from <legacyId> to <newUid>" is exactly what an auditor will ask to see.

**Warning signs:**
- Users sign in successfully but see "no orgs assigned" on first login.
- Comments / chat messages show "Unknown" as author after migration (already foreshadowed by `app.js:286-302` `firstNameFromAuthor` fallback).
- Firestore rules deny on doc updates that should succeed — because `authorId` ≠ `auth.uid`.

**Phase to address:** **Phase 2** — auth migration cannot ship without this. Has a hard dependency on **Phase 6** for the Cloud Function that does the backfill.

---

### Pitfall 6: Custom claims propagation lag — `getIdToken(true)` is mandatory, not optional

**What goes wrong:**
Cloud Function sets `customClaims = { role: "internal", orgId: "abc" }` on the user. Frontend reads `auth.currentUser.getIdTokenResult()` immediately — gets the *old* token (no claims) because tokens are cached client-side and refresh ~hourly. Rules predicated on the new claim deny every request from the user for up to ~60 minutes. User reports "I just signed up but the app says I have no org".

**Why it happens:**
Per [Firebase docs](https://firebase.google.com/docs/auth/admin/custom-claims): "After new claims are modified … they are propagated when the user signs in or re-authenticates, when an existing session's token refreshes after expiry, or when force-refreshed via `currentUser.getIdToken(true)`." None of these happen automatically when a *server* mutates claims.

**How to avoid:**
1. **Force-refresh the token immediately after any claim mutation that the *user* triggered** (e.g. they accepted an invite, completed onboarding):
   ```
   await firebase.functions().httpsCallable("setUserOrgClaim")({ orgId });
   await firebase.auth().currentUser.getIdToken(true); // mandatory
   ```
2. **Use Firestore as a signaling mechanism for *server-initiated* claim changes** (per [Doug Stevenson's pattern](https://medium.com/firebase-developers/patterns-for-security-with-firebase-supercharged-custom-claims-with-firestore-and-cloud-functions-bb8f46b24e11)): Cloud Function writes `users/{uid}.claimsUpdatedAt = serverTimestamp()`. Client subscribes to its own user doc, sees the timestamp change, and calls `getIdToken(true)`.
3. **Set claims in the `beforeUserCreated` blocking function** wherever possible — claims are then present in the very first ID token, no refresh needed. Reserves `beforeUserCreated` for *initial* assignment; later mutations use the signaling pattern.
4. **Don't cache claims in component state** — read from `getIdTokenResult().claims` on every authorization check, with the awareness it returns stale data unless force-refreshed.

**Warning signs:**
- Users complain they're "stuck" or "not getting access" after admin actions.
- Rules denials clustered in the first ~hour after a role change.
- Tests pass but production fails when a workflow does claim-mutation immediately followed by a Firestore write.

**Phase to address:** **Phase 2** (auth migration architecture must account for this) + **Phase 6** (the signalling pattern lives in Cloud Functions).

---

### Pitfall 7: MFA enrolment lockout — losing a second factor with no recovery path

**What goes wrong:**
You enforce MFA for `role: internal` users. Luke or George enrols TOTP, the phone is wiped/lost, and there is no recovery code path. Now the only path back in is a Firebase Console admin un-enrolling them — but Firebase MFA does not expose "remove second factor" via the public Admin SDK in a clean way until you have a fallback channel set up.

**Why it happens:**
- Firebase Auth's TOTP MFA was added in 2023 and is now stable, but recovery-code generation on enrolment is not automatic — you must build it.
- The "internal users" set is small (2 people per `INTERNAL_ALLOWED_EMAILS`), so a single lost device is a 50% outage.
- Email-based MFA reset is itself an attack vector — if you make it too easy, the MFA isn't worth much.

**How to avoid:**
1. **Generate one-time recovery codes at enrolment** (10 codes, hashed, stored in `users/{uid}.recoveryCodeHashes[]`). Show once at enrolment, never again. Each code is single-use; consuming one writes an audit log entry.
2. **Require *two* enrolled second factors** for internal users (e.g. TOTP + a hardware key like a YubiKey, or a backup phone number). Firebase Auth supports multiple factors per user.
3. **Document an out-of-band recovery procedure** — written in `SECURITY.md`, with the admin un-enrol path going via a senior internal user using `admin.auth().updateUser(uid, { multiFactor: { enrolledFactors: [] }})` from a maintenance environment. Require **two** internal admins to authorise (separation of duties).
4. **Test the recovery path before enforcement.** Pretend Luke loses his phone, walk through restoration, audit it, document it. If you can't restore in <30 minutes, the procedure isn't real.

**Warning signs:**
- Enrolment flow does not display recovery codes.
- Only one second factor permitted per user.
- No audit-log entry on MFA enrolment / un-enrolment / recovery-code use.

**Phase to address:** **Phase 2** — MFA enrolment is part of the auth migration; recovery flow must ship alongside.

---

### Pitfall 8: App Check enrolled too early — locks out development and emulators

**What goes wrong:**
You add App Check to all Firebase services as part of "hardening". Suddenly:
- Local dev with `localhost:5173` → "App Check token verification failed" → no Firestore reads.
- The Firebase emulator suite → can't talk to its own Firestore because App Check rejects.
- A second machine that hasn't registered its debug token yet → gets cut off mid-debug.

**Why it happens:**
App Check has two modes per service: *unenforced* (logs verification failures, allows traffic) and *enforced* (blocks unverified traffic). Devs see "App Check enabled" in the console and assume it's working — but enforcement is a separate per-service toggle. Once enforced, debug tokens are the only way to authenticate from non-attested clients (CI, dev machines, emulators).

**How to avoid:**
1. **Roll out in three stages, per service:**
   - **Stage A (Phase 5 start):** Enrol App Check (reCAPTCHA Enterprise for web). Leave Firestore / Storage / Functions in *unenforced* mode. Watch the App Check metrics dashboard for "verified vs unverified" ratio for *at least 7 days*. Per [Firebase docs](https://firebase.google.com/docs/app-check/enable-enforcement): "If almost all of the recent requests are from verified clients, consider enabling enforcement."
   - **Stage B:** Enforce on Storage first (lowest blast radius — uploads only). Then on individual Firestore collections one at a time using Rules + a `requireAppCheck` predicate — *not* the global enforcement toggle. This gives per-collection rollback.
   - **Stage C:** Global enforce on Firestore + Functions. Document in `SECURITY.md` and the audit log.
2. **Register debug tokens for every dev environment** *before* enforcing. Each developer generates a token via the Firebase Console, stores it in `localStorage` via `self.FIREBASE_APPCHECK_DEBUG_TOKEN = "..."` *only in dev builds*. **Never commit** these.
3. **Vite-gate debug tokens** via `import.meta.env.DEV`:
   ```
   if (import.meta.env.DEV) {
     self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
   }
   ```
   The token is read from a `.env.local` file gitignored.
4. **Verify reCAPTCHA Enterprise quotas** before going live. The free tier is generous (1M assessments/month), but a chatty client subscribing to `messages` could blow through it. Cost monitor + alert at 70% of quota.
5. **Don't attest only Cloud Functions and forget Firestore SDK calls.** Web SDK Firestore calls *also* need App Check tokens — App Check covers the entire SDK surface, not just one product.

**Warning signs:**
- App Check dashboard shows >5% "unverified" requests for >24h after enabling — something legit is being blocked. Debug tokens not propagated.
- Errors in production like `firebase: Error (appCheck/fetch-network-error)` — reCAPTCHA Enterprise call from client is failing.
- CI test runs that hit real Firebase fail with App Check token errors — CI debug token missing.

**Phase to address:** **Phase 5** — explicitly *after* auth + tooling phases stabilise, with the gradual-enforce sequence above.

---

### Pitfall 9: Refactoring a 4,103-line IIFE without test fences in place first

**What goes wrong:**
The natural temptation is to ship the modular split (H1) early because it makes everything else easier to read. You start carving out `auth.js`, `storage.js`, `views/dashboard.js`. Suddenly a render breaks because the dashboard implicitly depends on `state.expandedPillars` (a Set) being mutated by a closure in the diagnostic view (`app.js:564-577`). Or `pillarScoreForRound` (`app.js:206-222`) silently becomes wrong because a global cache used by `topConstraints` (`app.js:240-256`) was preserved as a copy, not a reference.

**Why it happens:**
4,103 lines of IIFE = ~30 closure-captured globals. The current `state` object (`app.js:564-577`) is mutated from 51+ render call sites (`CONCERNS.md` F1). Splitting into modules forces explicit imports/exports — every implicit dependency you didn't know was load-bearing surfaces as a runtime crash *somewhere on the user's path*. With no test suite, you find out which path by user reports.

**How to avoid:**
1. **Phase 3 before Phase 4 — non-negotiable.** Ship Vitest + GitHub Actions CI + an initial test pass *before* the modular split begins. Tests-first is the only fence that catches refactor regressions.
2. **Sequence the test suite for max regression coverage with min effort:**
   - Tier 1 (must have before refactor begins): pure-function tests for `pillarScoreForRound`, `pillarScore`, `pillarStatus`, `respondentsForRound`, `answeredCount`, `userCompletionPct`, `unreadCountForPillar`, `unreadChatTotal`. These are the deterministic math at `app.js:167-313, 336-370`. Pull each into its own module *first*, with tests, *then* let other modules depend on the pulled-out version.
   - Tier 2: migration idempotency — `migrateV1IfNeeded` (`app.js:489-561`) and `clearOldScaleResponsesIfNeeded` (`app.js:4068-4082`). These mutate user data; regressions are silent + irreversible.
   - Tier 3: integration — sign-in flow, render-route dispatch, auth state machine.
3. **Strangler-fig the split, don't big-bang it.** Each PR moves *one* module out: write tests against the inline version, extract the module, point the IIFE at the module, verify all tests still green. Merge. Next PR moves the next module. This keeps the trunk shippable at every commit.
4. **Use Vite's `import.meta.glob`** for view registration so adding a view doesn't require touching a central registry — but pin the order of loads explicitly because `data/pillars.js` (a global assignment) must precede everything (`data/pillars.js:4`, `app.js:14`).
5. **Snapshot the rendered HTML** of the dashboard, diagnostic view, and report *before* refactoring. Vitest + happy-dom + a "render fixture, snapshot innerHTML" test catches the entire class of "the DOM looks subtly different" regressions (e.g. `app.js:1565` radar chart, `app.js:2377` donut).

**Warning signs:**
- Anyone proposing the modular split before CI is green on a non-trivial test suite.
- Tests written *against* the new modular version but not against the inline original (no regression baseline).
- "Just one more module" PRs landing without their own tests.

**Phase to address:** **Phase 3 must be complete before Phase 4 begins.** Listed as Phase 4 not Phase 3 specifically because the dependency direction is critical.

---

### Pitfall 10: ID migration without idempotency — re-run = duplicate or destroy

**What goes wrong:**
You write a migration that walks all `orgs`, mints `crypto.randomUUID()` for any doc whose id matches the old `Math.random` shape (`app.js:30-31`), copies the doc to the new id, and deletes the old. Halfway through, the migration crashes (network blip, Functions timeout). On re-run, some docs already moved (new id exists, old id deleted), some didn't move (old id exists, new id missing), and the migration script can't tell which is which — so it duplicates or destroys.

**Why it happens:**
- Document copy + delete is not atomic across documents.
- Foreign-key references (e.g. `orgs/{id}.userIds[]` pointing at `users/{userId}`) span multiple collections; a mid-migration state has dangling refs.
- The 4-line generator at `app.js:30-31` has no shape signature ("looks random"), so distinguishing "old random id" from "new UUID" is the only reliable signal.

**How to avoid:**
1. **Don't change ids. Add a separate field.** Lower-risk approach: keep all existing doc paths exactly as-is. Add a `uuid: <crypto.randomUUID()>` field to every doc going forward. New code references this field for security-relevant purposes (filenames, public URLs); old `id` field stays for backwards-compatible references. This sidesteps the migration entirely and is honest at audit time ("we generated CSPRNG ids for all new resources from <date>").
2. **If full re-keying is truly required**, build the migration as **two phases**:
   - Phase A: write a `migratedFrom: <oldId>` field on every doc with a new UUID. Old docs get `migratedTo: <newUuid>` and a TTL of 90 days. Both old and new readable. Foreign keys updated to new ids in a *separate* doc-walk after Phase A is verified complete.
   - Phase B: only after every reference is updated, delete old docs. Idempotent because Phase B's predicate is "old doc exists AND new doc exists with `migratedFrom` matching".
3. **Migration order matters** for foreign-key safety:
   1. `users` (deepest leaf — referenced by orgs, messages, comments, but doesn't reference back)
   2. `orgs` (references users in `userIds[]`)
   3. `messages`, `documents`, `funnelComments`, `roadmaps`, `funnels` (reference orgs and users)
4. **Idempotency markers are mandatory.** Every migration step writes `migrations/{stepId}.{docId}.completed = true` before moving on. Re-runs check this marker first.
5. **Run the entire migration on a Firestore export → fresh project first** (the staging project from Pitfall 1). Compare doc counts before/after. Only deploy to production after staging is bit-for-bit consistent.

**Warning signs:**
- A "migrate all" Cloud Function with no per-step idempotency tracking.
- Foreign-key fields rewritten in the same transaction that creates the new doc (means a partial failure leaves dangling refs).
- No before/after doc-count assertion in CI.

**Phase to address:** **Phase 3** for the `crypto.randomUUID()` switch on *new* resources (low risk, no migration). **Phase 6** for any historical re-keying via Cloud Functions, *only after* Phase 8 (backups) is in place — never re-key without a backup.

---

### Pitfall 11: GDPR right-to-erasure with denormalised data + audit-log retention conflict

**What goes wrong:**
A client invokes their right to erasure. You delete the `users/{uid}` doc and the `orgs/{orgId}` doc. The cascade you forgot:
- `messages` collection: still has the user's messages, with their email and content visible to other org members.
- `funnelComments` collection: same.
- `documents` collection metadata: `uploaderId`, `uploaderEmail` still present.
- Storage bucket: files under `orgs/{orgId}/documents/{docId}/{filename}` (`app.js:2759`) still there.
- **Audit log: contains the user's UID, email, IP for every auth event ever.** *And it must.*
- Backups (per Phase 8): a Firestore export from yesterday is in GCS, fully intact.

The conflict: GDPR Art. 17 (erasure) vs. SOC2 / ISO27001 audit-log retention requirements (typically 1-3 years). You cannot both delete and retain.

**Why it happens:**
Denormalisation across collections means user identifiers are baked into many docs. The standard pattern (cascade delete) misses some, and even if it didn't, audit-log retention for compliance directly contradicts erasure for GDPR.

**How to avoid:**
1. **Tombstone, don't delete.** On erasure request, mutate every reference to:
   - `authorId: <uid>` → `authorId: "deleted-user-<random-token>"` (one consistent token per user, so historical attribution survives without identifying them).
   - `email`, `name`, `profileImage` → null/redacted.
   - Message body, comment text → check your retention legal basis. For free-text content authored *by* the user, GDPR favours deletion. For content *referring* to them (an internal note like "discussed onboarding with Hugh"), legitimate interest may apply but it must be documented.
2. **Audit log gets the same tombstone treatment, not deletion.** Standard pattern: replace user-identifying fields with the consistent `deleted-user-<token>`. The audit narrative "user X performed action Y at time T" survives but is no longer linked back to the natural person. ICO and EDPB have both confirmed this satisfies erasure provided the link is genuinely cut (the token is not a re-identification key).
3. **Document the erasure-vs-retention boundary in `SECURITY.md`** — what fields you redact, what you keep, the legal basis. This is exactly what an auditor wants to see.
4. **Backups must propagate erasure on next rotation.** Standard pattern: backups have a fixed retention window (e.g. 90 days). Erasure request marks the user as "to be redacted in next backup cycle". The backup expires naturally at 90 days, and any restore from that backup re-runs the redaction list before re-exposing data. **Do not** try to mutate backups in place — that defeats the integrity of the backup.
5. **Storage objects: enumerate + delete server-side** via a Cloud Function. `storage.objects.list()` over `orgs/{orgId}/documents/{docId}/{*}` and `deleteObject` each. **Do not let the client invoke this** — it must be Cloud Functions with full credentials and Rules deny client-side `storage.delete` on the bucket root.
6. **Run the erasure flow on a test fixture before shipping it.** Create a test user, write data across all collections, invoke erasure, verify with a separate audit script that no PII remains in any collection except as redacted tombstones. This script becomes your evidence pack ("GDPR erasure verified by automated check").

**Warning signs:**
- Erasure flow that touches `users` and `orgs` only.
- Audit log redacted by `delete()` rather than field-level redaction.
- No documented backup-rotation schedule, so erasure requests can't ever fully complete.
- Storage objects deletable by clients (would let the *attacker* invoke "erasure" of incriminating files).

**Phase to address:** **Phase 7** (build the flows) + **Phase 8** (backup retention policy must be coordinated). Cannot skip — GDPR Art. 12-22 are mandatory for the EU/UK clients in the prospect pool.

---

## Stack-Specific Pitfalls (continued)

### Pitfall 12: Cloud Functions 1st-gen vs 2nd-gen choice — auth-blocking gotchas

**What goes wrong:**
You write `beforeUserCreated` blocking functions in 2nd-gen syntax assuming they behave like Cloud Run (longer cold starts acceptable, region flexibility). Auth blocking functions have hard latency budgets — Firebase Auth times them out at 7 seconds total. A 2nd-gen Cloud Run cold start can eat 2-3 seconds of that on Node 20 just for the runtime. User registration flakes intermittently.

**Why it happens:**
- 1st-gen and 2nd-gen Cloud Functions look similar in code but have different deployment models, quotas, and latency profiles.
- Auth blocking functions (`beforeUserCreated`, `beforeUserSignedIn`) are time-critical: Firebase will fail the auth attempt if the function doesn't return in time.
- Cold starts on 2nd-gen are dominated by container provisioning; min instances mitigate but cost money.

**How to avoid:**
1. **For auth blocking functions, use 2nd-gen with `minInstances: 1` and a small CPU/memory profile** (`{ cpu: 1, memory: '256MiB' }`). The min instance is ~$5/month; 100% reduction in cold-start auth failures is worth it. Document this as a recurring cost in `SECURITY.md`.
2. **Keep blocking-function logic minimal.** Write claims, validate email domain, that's it. Anything heavier — sending welcome email, provisioning resources — goes in a non-blocking trigger after `onUserCreated`.
3. **Avoid 1st-gen for new code.** 1st-gen is end-of-life trajectory; the migration burden later is worse than learning 2nd-gen now.
4. **Monitor function p99 latency** and alert if it climbs over 4 seconds — leaves only 3 seconds before the auth-attempt timeout.

**Warning signs:**
- Auth signup occasionally fails with "internal error" — no specific cause shown to user. Checking Cloud Functions logs reveals timeout.
- Function execution time histogram has a long tail at exactly 7 seconds (the cap).
- 1st-gen and 2nd-gen functions co-existing for the same project — invariably one gets neglected.

**Phase to address:** **Phase 6** — when Cloud Functions are introduced, set the standard: 2nd-gen, blocking functions get min-instances.

---

### Pitfall 13: Cloud Functions secret management — env vars vs Secret Manager

**What goes wrong:**
Devs put a sensitive value (Sentry DSN with project key, Slack webhook for alerts, third-party API key) in `firebase functions:config:set` (1st-gen) or as a plain environment variable in `defineString` (2nd-gen). It ends up in deployment artifacts, function logs, and the Cloud Console for anyone with `viewer` IAM. SOC2 auditor flags it.

**Why it happens:**
- 1st-gen `functions.config()` was the historical norm and is *not* secret storage — it's plain text in the function's environment.
- 2nd-gen offers `defineSecret()` (proper Secret Manager integration) alongside plain env vars. Devs reach for the env var because the syntax is shorter.

**How to avoid:**
1. **Always use `defineSecret()`** for anything that's a credential, token, key, or webhook URL. Even Sentry DSN counts (it allows event submission against your Sentry project — denial-of-wallet).
2. **Audit the runtime service account.** Firebase Cloud Functions default service account is `<project>@appspot.gserviceaccount.com` with very broad permissions. Per SOC2 least-privilege, create per-function service accounts with only the IAM roles needed (e.g. `roles/datastore.user` for an audit-log writer; not `roles/owner`).
3. **Rotate secrets quarterly.** Document the rotation date in `SECURITY.md`. Secret Manager versions make rollback trivial.
4. **Never log secrets, even in dev.** Pre-commit hook or CI lint that scans for `console.log(secretName)` patterns.

**Warning signs:**
- `firebase functions:config:get` returns secrets in plaintext — unaudited.
- Function code uses `process.env.MY_SECRET` without a `defineSecret` declaration — means the value is plain env var.
- IAM list on the runtime service account has "Owner" or "Editor".

**Phase to address:** **Phase 6** — set the convention from the first Cloud Function shipped.

---

### Pitfall 14: Vite + GitHub Pages base-path traps with strict CSP

**What goes wrong:**
The site lives at `baselayers.bedeveloped.com` (custom CNAME on GitHub Pages). Vite default `base: '/'` works in dev. After the GitHub Actions build deploys to `gh-pages` branch, asset URLs resolve correctly because the custom domain is at root. But if you ever lose the CNAME (or test on `<user>.github.io/<repo>/`), every asset 404s. Once strict CSP is in place, the recovery is uglier — `script-src 'self'` blocks attempts to load from the wrong origin.

**Why it happens:**
- `base` in `vite.config.ts` is the prefix Vite bakes into `<script src="...">` and asset references at build time.
- GitHub Pages custom domain (CNAME) makes the site root-served. Without CNAME, GitHub Pages serves at `/<repo>/`. Same build, different resolution.
- CSP `script-src 'self'` then blocks any script that resolved to the wrong origin.

**How to avoid:**
1. **Set `base: '/'` in `vite.config.ts` and depend on the CNAME existing.** Document the CNAME as a deploy prerequisite in `SECURITY.md`. Add a CI check that fails the deploy if `CNAME` is missing from the build output.
2. **Use absolute origin in CSP `connect-src`** for Firebase endpoints (`https://firestore.googleapis.com`, `https://www.googleapis.com`, `https://*.firebaseapp.com`, `wss://*.firebaseio.com`) — see the suggested CSP in `CONCERNS.md` H4.
3. **Inline scripts: nonces, not `'unsafe-inline'`.** GitHub Pages doesn't support per-request CSP headers (no header support for static hosts). Switch to **Firebase Hosting** for the production deployment specifically *because* it supports `firebase.json` `headers` config. This may be the right time to consolidate hosting under Firebase. (See Pitfall 15.)
4. **In Vite, use `import.meta.env.MODE`** to gate dev-only paths. Common bug: a dev-only debug-mode logger that reads from `localStorage` ships to prod because the gate was `if (location.hostname === "localhost")` instead of `if (import.meta.env.DEV)`. Latter is statically eliminated by tree-shaking; former is a runtime check that ships.
5. **Self-host Firebase + Chart.js** via npm install. Vite tree-shakes the JS SDK fine if you import only the modules you use (`firebase/firestore`, `firebase/auth`, `firebase/storage`, `firebase/app-check`, `firebase/functions`). Don't `import * from "firebase/firestore"` — pulls everything.

**Warning signs:**
- Console: "Refused to load … because it violates Content Security Policy".
- Production manifest references `/<repo>/assets/...` paths that 404.
- Bundle size > 500 KB despite "tree-shaken" — usually means you imported the entire `firebase` namespace.

**Phase to address:** **Phase 3** for the base-path/build-config + self-hosting. **Phase 9** for strict CSP rollout.

---

### Pitfall 15: Hosting platform mismatch — GitHub Pages vs Firebase Hosting for header support

**What goes wrong:**
You add `<meta http-equiv="Content-Security-Policy" content="...">` to `index.html` because GitHub Pages doesn't let you set HTTP headers. Then you discover:
- `meta http-equiv` ignores `frame-ancestors` (must be a real header).
- `meta http-equiv` doesn't apply to the document itself before the meta tag is parsed — race condition where early scripts run unrestricted.
- `Strict-Transport-Security` only works as a header, not meta.
- `Permissions-Policy` only works as a header.

So the CSP "rollout" from H4 in CONCERNS.md is *partial* on GitHub Pages — and that's a finding an auditor will catch.

**Why it happens:**
GitHub Pages is a static-only host with a fixed header set. The full security-header set (HSTS, frame-ancestors, Permissions-Policy, COOP/COEP) requires a host that lets you configure response headers.

**How to avoid:**
1. **Migrate to Firebase Hosting.** It supports `firebase.json` `headers` config:
   ```json
   {
     "hosting": {
       "headers": [{
         "source": "**",
         "headers": [
           { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
           { "key": "X-Content-Type-Options", "value": "nosniff" },
           { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
           { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
           { "key": "Content-Security-Policy", "value": "..." }
         ]
       }]
     }
   }
   ```
   Existing `baselayers.bedeveloped.com` CNAME points at Firebase Hosting instead of GitHub Pages. DNS change is a few minutes; rollback is reverting the CNAME.
2. **Co-locate hosting with the Firebase project** — same project boundary, same IAM, same audit trail. SOC2 evidence pack benefits.
3. **Cost: Firebase Hosting free tier is 10 GB/month transfer, 360 MB/day storage** — well within scope of this app.

**Warning signs:**
- `<meta http-equiv="Content-Security-Policy">` is your *only* CSP source.
- HSTS missing from response headers — securityheaders.com grade is C or worse.
- Report-only CSP set up but no endpoint to receive reports.

**Phase to address:** **Phase 3** (set up Firebase Hosting alongside GitHub Pages, run both for a week, cut over). **Phase 9** (full strict CSP).

---

### Pitfall 16: CSP rollout — too-strict-too-fast breaks Chart.js, Firebase popups, inline styles

**What goes wrong:**
You ship strict CSP `default-src 'self'; script-src 'self'; style-src 'self'; ...` Chart.js silently fails to render the radar (`app.js:1565`) because it builds inline styles for tooltips. Firebase Auth's email-link sign-in opens a popup whose CSP lineage chains back to the parent — popup denied. The 17 `innerHTML = ""` sites in `app.js` (`CONCERNS.md` M2) are fine for clear-only, but the M5 inline `style="..."` strings everywhere are blocked en masse.

**Why it happens:**
- `style-src` blocks both `<style>` blocks and `style="..."` attributes; the M5 audit explicitly identifies this as a future CSP break.
- Chart.js 4.x uses some inline style assignment internally for transient elements.
- Firebase Auth UI popups inherit some CSP context from the opener.

**How to avoid:**
1. **Three-stage CSP rollout:**
   - **Stage A: report-only.** Set `Content-Security-Policy-Report-Only` with the desired strict policy. Wire to a `report-uri` endpoint (a tiny Cloud Function that writes to a `csp-violations` Firestore collection). Run for **1-2 weeks** to enumerate every real-world violation. Triage: legit ones get exemption, illegit ones (XSS attempts) become alerts.
   - **Stage B: enforced with `unsafe-inline` style temporarily.** `style-src 'self' 'unsafe-inline'`. This is the H4 baseline from CONCERNS.md and is a *defensible audit position* ("CSP enforced, with a documented exception for inline styles pending CSS-class refactor"). Most real-world apps live here for a long time.
   - **Stage C: nonces for any remaining inline.** Once all M5 inline styles are migrated to classes, drop `'unsafe-inline'`. For any genuinely-required inline (e.g. dynamically-coloured chart legend), use a per-request nonce. **Firebase Hosting does not generate nonces** — you'd need a Cloud Function in front, or accept hashes-instead-of-nonces.
2. **Hash-based fallback for inline event handlers.** The codebase has on* handlers via `h(tag, { onclick })` which compile to `addEventListener` (safe). Audit anything that *renders* `<button onclick="...">` strings — none should remain post-refactor.
3. **`'strict-dynamic'`** — allows trusted scripts to load other scripts. Useful when self-hosting Firebase SDK because the SDK lazy-loads chunks. Combine: `script-src 'self' 'strict-dynamic' 'nonce-XYZ'`.
4. **`frame-src` for Firebase Auth popups:** allow `https://<projectId>.firebaseapp.com` (the auth domain).
5. **Test the entire flow** — sign-in, dashboard, radar, donut, document upload, chat — under CSP enforcement on staging before promoting.

**Warning signs:**
- CSP report-only logs spike when you visit any chart route — Chart.js inline injection.
- Sign-in flow freezes mid-flow — popup blocked.
- "Refused to apply inline style" errors in console.

**Phase to address:** **Phase 9** — explicit, gated rollout.

---

### Pitfall 17: Audit log written from the client (forgeable, deletable, incomplete)

**What goes wrong:**
You add an audit log because compliance demands one. The path of least resistance: client adds a doc to `auditLog` collection on every action (sign-in, role-change, delete). This is forgeable (client can omit, falsify, replay), grants the audited user `read` on their own audit (they can see "did the system catch me?"), and misses fields the client doesn't have access to (server-side IP, user-agent normalisation, real timestamp).

**Why it happens:**
- Client-side write is one line of code; server-side write requires Cloud Functions, Rules, IAM.
- The auditing instinct is "log everything" — including from the client. But client-controlled logs aren't evidence; they're decoration.

**How to avoid:**
1. **Audit log writes happen *only* in Cloud Functions.** Rules:
   ```
   match /auditLog/{eventId} {
     allow read: if isInternal();         // only auditors / admins
     allow create, update, delete: if false; // not even Firebase Admin SDK from client
   }
   ```
   Cloud Functions write via Admin SDK (which bypasses Rules). Every write through a single helper `writeAuditEvent({ event, actorUid, targetType, targetId, metadata })`.
2. **Sources of truth for sensitive fields:**
   - Timestamp: `admin.firestore.FieldValue.serverTimestamp()`, never `Date.now()` from client.
   - Actor UID: `context.auth.uid` (callable function) or extracted from the auth token, not from the request body.
   - IP: in Cloud Functions HTTP requests, `req.headers['x-forwarded-for']` (Cloud Functions does not surface client IP via a typed property). Take the *first* IP in the comma-separated list (the original client; subsequent are proxies). Document this in code comments.
   - User-agent: `req.headers['user-agent']`. Trim, normalise.
3. **Audit log schema is fixed and versioned.**
   ```
   { id, ts, schemaVersion: 1, event, actorUid, actorEmail, targetType, targetId,
     ipHash, userAgent, metadata, sessionId? }
   ```
   `schemaVersion` lets you migrate the schema without losing the audit trail.
4. **Audit log is append-only — no updates, no deletes.** Even erasure happens via tombstone (Pitfall 11), not delete.
5. **Storage cost growth: estimate.** A noisy app can produce 10K events/month/user = ~5 MB/month. At 100 users, ~500 MB/year. Firestore at $0.18/GB/month → ~$1/year per user. Trivial. But monitor it — a runaway loop logging the same event 1000×/sec is a different beast. Add a per-event-type rate limit: "more than N of event-type X in 60s = log once with `repeatedCount: M`".
6. **Test: write an audit event from a Cloud Function. Read it from the audited user's session via the client SDK. Assert it returns `permission-denied`.**

**Warning signs:**
- Any client code path calls `addDoc(collection(db, "auditLog"), ...)`.
- Audit log Rules allow client writes.
- Audit events missing `actorUid` or with `actorUid` originating from request body.

**Phase to address:** **Phase 6** — audit log goes in with the first Cloud Functions.

---

### Pitfall 18: Sentry / observability leaking PII through breadcrumbs and error context

**What goes wrong:**
You wire Sentry at app boot. By default, Sentry captures breadcrumbs (last N user actions), the URL at error time, request/response bodies for `fetch` errors, and the entire DOM on click. The chat bubble being rendered at the moment of error contains a customer's name and message body. The funnel comments contain commercially-sensitive numbers. All of this lands in Sentry — which is a US-based third party — and now you have a GDPR transfer to a sub-processor that wasn't disclosed in your DPA.

**Why it happens:**
Sentry's defaults are designed for "just works" debugging — they prioritise developer ergonomics over data minimisation. The sub-processor angle is often overlooked entirely.

**How to avoid:**
1. **Configure Sentry with `beforeSend` hook** that scrubs known PII fields:
   ```js
   Sentry.init({
     dsn: ...,
     beforeSend(event) {
       // Strip user-identifying fields from breadcrumbs, contexts, request bodies
       event = scrubPii(event);
       return event;
     },
     beforeBreadcrumb(breadcrumb) {
       if (breadcrumb.category === "ui.click" && containsPii(breadcrumb.message)) {
         breadcrumb.message = "[redacted]";
       }
       return breadcrumb;
     },
     // Disable sending DOM, network bodies
     attachStacktrace: true,
     sendDefaultPii: false, // critical default flip
   });
   ```
2. **Disable `sendDefaultPii`** (it's `false` by default but explicitly set it). Disable `replaysSessionSampleRate` if Session Replay is offered.
3. **List Sentry as a sub-processor in your DPA** and a privacy policy. EU/UK customers need this disclosed.
4. **Self-host Sentry** if budget allows (it's open-source) — sidesteps the sub-processor question. Otherwise use Sentry's EU region (`*.de.sentry.io`) for EU customer data.
5. **Free-tier limits:** Sentry free is 5K errors/month, 50 replays/month. A chatty error storm (e.g. a regression that throws on every render) hits the cap in hours. Set up an alert at 70% of monthly quota. Add **client-side rate limiting** on Sentry submission: if same fingerprint fires >10× per minute, dedupe.
6. **Cloud Functions logs go to Cloud Logging by default**, which has different PII risk surface. For Functions, use structured logging and explicitly allow-list which fields are logged.

**Warning signs:**
- Sentry event detail page showing customer email or message text in breadcrumbs.
- Sentry event count climbing fast — error storm + no rate limit = $$$ or quota.
- Sentry not listed in privacy policy / DPA sub-processor list.

**Phase to address:** **Phase 10** — design the PII scrubbing *before* the first event is sent.

---

### Pitfall 19: Compliance theatre — claiming controls without backing evidence

**What goes wrong:**
You ship a `SECURITY.md` listing "MFA enforced, audit log, encryption at rest, etc." A prospect's IT reviewer asks "show me the MFA enrolment policy". You don't have one written down — only the code that enforces it. Or the audit log is real but there's no documented retention period. Or you wrote "ASVS L2 compliant" when you've actually only met L1 in some categories.

The deeper failure mode: writing claims that are *almost* true, that an auditor's diligence will expose. That conversation kills the deal harder than not having the claim at all.

**Why it happens:**
- Security work and policy work are different muscles. Devs ship code; security policies need procedural artifacts (incident response runbook, access review schedule, employee onboarding checklist, vendor risk assessment).
- SOC2 has Trust Service Criteria covering Security, Availability, Processing Integrity, Confidentiality, Privacy — and **operational controls** like Access Reviews, Change Management, Incident Response. A two-person team can't credibly claim "Access Reviews quarterly" without evidence (Jira tickets, signed reviewer attestations, etc.).
- ASVS L2 ≠ ASVS L1 + a few extras. L2 specifically requires *all* controls in chapters 2 (Auth), 3 (Sessions), 4 (Access), 5 (Validation), 7 (Errors), 8 (Data), 9 (Comms), 10 (Mal-code), 11 (BizLogic), 12 (Files), 13 (APIs), 14 (Config). Claiming L2 means you have *evidence* for every L2 requirement.

**How to avoid:**
1. **Use the project's existing constraint honestly: "credible, not certified".** `PROJECT.md` Constraints already says "Aim for controls that map honestly onto SOC2 Common Criteria / ISO27001 Annex A / GDPR Art. 32 / OWASP ASVS L2. Certification itself is out of scope." The vendor questionnaire response is "We are on a documented hardening track aligned to SOC2/ASVS L2; we have not pursued audit certification." That's an answer; "we are SOC2 ready" is a claim that invites scrutiny you can't survive.
2. **Build the evidence pack in lockstep with the controls.** Each control gets a control sheet:
   - What it is (e.g. "MFA enforced for internal users")
   - Where in code (`auth.js:...`, `firestore.rules:...`)
   - Where it's tested (`auth.test.ts:...`)
   - Operational artifact (the procedure for un-enrolment, the recovery codes flow, the rotation schedule)
   - Evidence of operation (audit-log entries showing enrolments)
3. **Map controls to ASVS / SOC2 / ISO with explicit citations.** For each item in `SECURITY.md`, cite e.g. "ASVS V2.1.1, V2.1.10". Auditor can verify directly.
4. **Don't claim what you haven't built.** Specifically: don't claim "incident response", "change management", "vendor risk assessment", "BCP/DR" unless you have written runbooks, ticket records, drill logs. These are operational, not code, and a vendor questionnaire WILL ask for them.
5. **Pen-test reports**: don't claim a pen test you haven't done. The audit-driven walkthrough (`SECURITY_AUDIT_REPORT.md`) is *evidence of internal review*, not external pen test. Distinguish them.
6. **Update `SECURITY.md` as part of every phase.** Each phase closes some `CONCERNS.md` findings; each finding closure is a control addition or strengthening with citations.

**Warning signs:**
- `SECURITY.md` has bullet points like "We use industry-standard encryption" with no specifics.
- A control claim ("audit log") with no procedure document and no retention policy.
- Vendor questionnaire response says "Yes" to questions that should be "Partial — see notes".
- Compliance bar drift: started at "credible", crept to "ready", crept to "compliant".

**Phase to address:** **Phase 12** is the consolidation. But the vigilance is across **every phase** — every closed finding gets a paragraph in `SECURITY.md` immediately, not retroactively.

---

### Pitfall 20: Unsafe sequencing of H7 (clock skew) + H8 (last-writer-wins) fixes

**What goes wrong:**
H8 in `CONCERNS.md` is "cloud sync is last-writer-wins". You "fix" this by adding optimistic-concurrency via a `version` field on the org doc. Concurrent two-tab edit now produces a `version mismatch` error. UX: user sees "Couldn't save your response — try again". They retry — still fails. The implicit retry-loop turns a silent data-loss bug (H8) into a visible "the app is broken" bug. Worse: the H7 clock-skew bug means the version comparison can be off by minutes, so even *non-concurrent* edits start failing.

**Why it happens:**
- H7 and H8 are entangled: any optimistic-concurrency strategy that uses timestamps (`updatedAt > lastSeen`) is vulnerable to client clock skew (H7).
- Splitting an org doc into per-user subcollections (the `CONCERNS.md` H8 fix) means *every* read path in the app needs updating — `loadOrg` (`app.js:106`), `saveOrg` (`app.js:107`), the entire scoring/comments pipeline. Big-bang is risky.
- Without tests, neither bug has a regression baseline.

**How to avoid:**
1. **Don't fix H7 and H8 in the same PR — and don't fix either of them before Phase 3 (tests + CI).**
2. **Order: tests first, then H7, then H8.**
   - **Test pass first** (Phase 3) — write tests for current behaviour of unread tracking and sync. *Including* the broken behaviour. This is the regression baseline.
   - **H7 fix (Phase 11):** standardise on `serverTimestamp()` for all writes; convert all comparators to compare server-time-to-server-time. Move "last read" markers into Firestore (per-user subdoc `users/{uid}/readState/{orgId}`) so the comparator is server-vs-server, not server-vs-client. Tests assert: a 5-minute clock skew on the client doesn't change unread counts.
   - **H8 fix (Phase 11):** move `responses`, `comments`, `actions` into subcollections `orgs/{id}/responses/{userId}/{pillarId}_{idx}` etc. Per-document writes don't collide on the parent. The migration is non-trivial — but with H7 already shipped and tests in place, it's tractable.
3. **Use Firestore transactions (`runTransaction`)** for any cross-doc invariant — e.g. updating a roadmap node *and* logging the change to audit-log atomically. Don't roll your own concurrency control.
4. **Don't add a `version` field for optimistic locking** unless you've implemented the conflict-resolution UX. The user *must* see a meaningful "your changes diverge from another tab — choose one" prompt; not a generic error.

**Warning signs:**
- A PR that touches H7 and H8 together with no test changes — high regression risk.
- Comparator code mixing `serverTimestamp().toMillis()` and `Date.now()` in the same expression (this is currently `app.js:336-370`).
- Optimistic-concurrency fields appearing without a UX flow for conflicts.

**Phase to address:** **Phase 3** (tests) → **Phase 11** (H7) → **Phase 11 same milestone, separate PR** (H8). Resist the urge to combine.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Permissive Rules during migration (`request.auth != null`) | Doesn't break anything during cutover | Forgotten, becomes the production state — exactly C3 today | **Only inside Phase 1-2 window with deploy gate to staging only**; documented removal date in PR description |
| Storing UI state in `localStorage` (current `state` object) | Easy state survival across renders | Coupling between UI and security-relevant state (current C1 root cause) | Never for auth/identity. Acceptable for `mode`, `route`, `expandedPillars` per existing architecture — bounded to non-security UI state |
| Skipping per-collection migration order, doing all-collections-at-once | Single batch is easier to reason about | Foreign-key references break mid-migration; partial state is unrecoverable | Never for production data with live references |
| Using `console.error` for error reporting (current pattern) | Zero infra | No remote signal, no alerts, silent failures (M4) | Until Phase 10 only. Beyond Phase 10 = audit finding |
| Inline `style="..."` for one-off colours (current pattern, M5) | Faster to ship | Blocks strict CSP forever; blast radius across every render | Acceptable inside `<canvas>` or chart-internal where library demands. Never in app DOM |
| Single Sentry project for client + Functions | One DSN to manage | Client error rates drown out Functions signal; PII surface combined | Never — separate the projects from day one |
| Shared service account for all Cloud Functions | Single IAM grant to manage | A compromised function reveals all data; SOC2 finding | Never. Per-function service accounts are the SOC2 baseline |
| Cache-busting via `?v=46` querystring | Trivial to implement | Hand-bumped, easy to forget (M1) | Until Phase 3. Replaced by Vite hashed filenames in build output |
| `html:` escape hatch in `h()` (current C4) | Quick way to render rich content | Exactly one careless commit from XSS | Never. Delete in Phase 3 alongside `crypto.randomUUID()` swap |
| Two near-identical chat/comment renderers (M8) | Faster initial ship | Security fixes have to be applied twice; one rots | Until Phase 4 (modular split with shared `renderConversation`) |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| Firebase Auth | Treating Anonymous Auth as "not real auth" (it is — `request.auth != null` succeeds) | Disable Anonymous in Phase 2 entirely; do not co-exist with Email/Password |
| Firebase Auth | Using `user.email` from client claims for authorisation | Authorise on `request.auth.token.role` and `orgId` claims set server-side; never trust client-provided fields |
| Firestore | Real-time listener (`onSnapshot`) opened in render function without cleanup (current pattern) | Subscribe at module scope or via a cleanup hook; `app.js:392` already shows the pattern, but `renderChat` line 3012 etc. don't always tear down — leaks subscriptions |
| Firestore | Querying with `where("orgId", "==", clientProvided)` and trusting Rules to enforce (current pattern at `app.js:2814-2817`) | Rules MUST enforce server-side; client-side filter is a UX optimisation, not security |
| Firestore | Using `serverTimestamp()` only on writes, comparing to client-clock on reads (current H7) | Move both sides to server-clock; or normalise to a common reference and accept fuzz factor |
| Firebase Storage | Allowing client to set `Content-Type` (current `app.js:2761`) | Server-side validation in Storage Rules + content-type sniff on download path. Storage Rules can match `request.resource.contentType` at upload |
| Firebase Storage | Path scheme that includes user-supplied filename verbatim (current `app.js:2759`) | Sanitise filename to `[\w.\- ]+`, slice to 200 chars, prefix with a UUID; original name retained as a metadata field |
| App Check | Enrolling and enforcing on the same day | Enrol → 7+ day soak in unenforced mode → enforce per-service in stages |
| Cloud Functions | Setting custom claims after user creation, expecting client to see them immediately | Either set in `beforeUserCreated` blocking function (claims in first token), or signal client to call `getIdToken(true)` |
| Cloud Functions | Reading client IP from `req.connection.remoteAddress` | `req.headers['x-forwarded-for']` first comma-separated value (Cloud Functions runs behind a proxy) |
| Cloud Functions | Long-running export/migration in HTTP function (60s timeout default; max 9min) | Use Cloud Tasks + Pub/Sub for fan-out; or scheduled Functions for periodic work |
| Sentry | Default config + sending PII in breadcrumbs | `sendDefaultPii: false`, `beforeSend` scrubber, EU region or self-host |
| reCAPTCHA Enterprise (App Check) | Using the same site key for staging + prod | Per-environment site keys; staging key has lower quota tier and is rotated quarterly |
| GitHub Actions | Auth to Firebase via long-lived service-account JSON in repo secrets | OIDC federation (Workload Identity Federation) — no long-lived credential |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| Org doc per-tenant, all data denormalised (current pattern) | Firestore write rejected with "Document too large" | Move responses/comments/actions to subcollections | At ~5K responses + 1K comments per org (1 MiB doc cap). Already foreshadowed in `CONCERNS.md` Scaling Limits |
| Full app re-render on every Firestore snapshot (`app.js:392-397`) | UI flicker; chart destruction-recreation; growing main-thread time | Snapshot listeners update local state; `render()` only on user-driven route change. Chart instance reused, not recreated | At any chat-heavy session — already a UX bug today, will be worse at any user count |
| All internal users subscribed to entire `messages` collection (current `app.js:384`) | Firestore read costs scale linearly with users × message rate | `where("orgId", "in", [orgsForUser])` scoping; or index on `unreadFor` array | Already costs N×M reads at idle; matters at >5 internal users or >1K messages/day |
| Stacked `onSnapshot` listeners on re-render (current F3) | Memory grows, duplicate updates, eventual quota hit | Unsubscribe on cleanup; reuse single subscription across renders | After ~30 minutes of an open session with frequent route changes |
| Rules with `get()` cross-collection lookups | Firestore rules-evaluation cost rises faster than read cost | Denormalise `members`/`orgId` to claims or doc fields | At 100s of req/sec or rules with 2+ `get()` calls |
| Bundle includes unused Firebase SDK modules | Initial JS payload >500 KB; slow first paint | `import { specific } from "firebase/firestore"` only; tree-shake | At any bundle audit; LCP regression on slower networks |
| App Check token request blocking first Firestore read | First request after page load delayed 200-800ms | Initialize App Check before Firestore (Firebase SDK ordering); use auto-refresh | On every cold session — UX-visible at <3s LCP budgets |
| Scheduled Firestore export with no shard parallelism | Export job exceeds 60min Cloud Functions max | Use Cloud Workflows (Pitfall noted in `medium.com/google-cloud/firestore-backups-the-easy-way-with-cloud-workflows`) or chunked exports | At Firestore >5 GB; not relevant at this app's current scale but bake in for future |

---

## Security Mistakes (Beyond Generic OWASP)

| Mistake | Risk | Prevention |
|---|---|---|
| Trusting `user.email` on a Firebase Auth token without `email_verified` check | An attacker registers with `victim+attacker@victim.com` (email aliases) and bypasses email-allowlist checks | Always check `request.auth.token.email_verified == true`. Bake into `isAuthed()` rules helper |
| Email enumeration in sign-in error messages (current L1) | Attackers enumerate which emails are clients vs internals (`app.js:1071-1077`) | Single error: "Email or password incorrect". Don't differentiate "user doesn't exist", "password wrong", "no org assigned" |
| Storage signed URLs with long TTL | URL leaks (referrer header, screenshot of address bar) → permanent access to file | TTL ≤ 1 hour, refresh on download. Currently `getDownloadURL` returns a long-lived URL — switch to `getDownloadURL` with explicit short-TTL signing |
| Reading file extension from filename for type checking | User uploads `report.pdf.exe` or `payroll.html` claiming `Content-Type: application/pdf` | Server-side magic-byte sniff (libmagic / file-type npm). Storage Rules match on `request.resource.contentType` AND a Cloud Function post-upload validates magic bytes |
| Storing user passwords in custom user records (the existing `passwordHash` pattern in `app.js:444`) | Becomes a target. Hash strength matters. Comparing without constant-time compare = timing attack | Don't. Firebase Auth handles this. Delete `passwordHash` field from `users/` schema entirely after migration |
| Audit log accessible to the audited user | User can see whether their action was caught and time their next action | `auditLog` Rules: `allow read: if isInternal() && claims.role == "auditor"`. Even internal users without auditor scope can't read |
| Cloud Function callable without authentication check on `context.auth` | Anonymous traffic can invoke privileged operation | Every callable function: `if (!context.auth) throw new HttpsError("unauthenticated", ...)`. Plus role check on `context.auth.token.role` |
| Firestore Rules predicated on `request.auth.token.foo` where `foo` was never set | Rule silently evaluates to false; legitimate operation fails | Test: assert that with no `foo` claim, rule denies; with `foo: "wrong"`, rule denies; with `foo: "right"`, rule allows. Three-state test prevents the silent-deny class |
| Subdomain takeover: `baselayers.bedeveloped.com` CNAME pointing at a service you no longer own | An attacker claims the unowned target and serves malicious content under your domain | Document the CNAME chain; CAA record limits issuers; certificate transparency monitor (Cert Spotter / crt.sh) on the parent domain |
| GitHub repo public + Firebase web API key + Anonymous Auth + permissive rules (current state) | "Bug bounty findings" surface in Google's Play Protect / Vercel's BotID — researchers actively scan public repos for `firebaseConfig` patterns and probe the project | Phases 1-2 fix this end-to-end. Until they ship, every commit is a fresh disclosure |
| Public repo containing internal email addresses (`app.js:443` current state) | Spear-phishing target list — Luke and George become known internal admins | Phase 2 deletes this constant. Until then, monitor `luke@bedeveloped.com` and `george@bedeveloped.com` for unusual auth attempts |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| Forced MFA enrolment on first login post-migration with no grace period | Internal users locked out at the worst moment; support burden | Soft-prompt MFA enrolment; hard-enforce after 7 days; ship recovery codes flow first |
| `alert()` for cloud-sync failures (current M3) | Modal interrupts typing; user loses context | Inline toast, non-blocking; preserves input; logs to Sentry |
| Permission-denied error showing raw Firebase error code | "FirebaseError: Missing or insufficient permissions" — terrifying, unactionable | Translate: "You don't have access to this org. Contact your administrator." |
| Soft-delete with no UI for restore | User clicks Delete, regrets it, has no recovery path — same as hard-delete from their perspective | Show a "Recently deleted" tray with 30-day restore window. Audit-log shows who deleted, who restored |
| GDPR data export served as raw JSON | User asked for "their data" — gets a JSON dump they can't read | Serve as a structured Zip: PDF summary + CSV of responses + JSON for completeness. Honor the *spirit* of the right, not just the letter |
| Custom claims update lag visible to user as "you don't have access" | User upgraded role / accepted invite, hits a refresh, gets denied | After any role-change action, force `getIdToken(true)` *and* poll `/users/{uid}.claimsUpdatedAt` for confirmation before showing the new UI |
| App Check enforcement breaks the user's session mid-flow when their attestation expires | "Why did the page just stop working?" with no error visible | Catch App Check errors, show "Your session needs to refresh" with a button to refresh App Check token |
| Email-link sign-in arrives in spam (default mailer is Firebase's) | User abandons signup | Custom SMTP via SendGrid/Postmark with proper SPF/DKIM/DMARC; warmed-up sending domain |
| Anti-pattern: explaining hardening to clients via a long email | Most clients want a one-pager + a contact for questions | Public `SECURITY.md` URL; short cover note: "Here's our security posture, here's our contact for questions" |

---

## "Looks Done But Isn't" Checklist

For the roadmapper / PR reviewer to verify each phase. A control is not done until every relevant box is checked.

- [ ] **Firestore Rules:** Predicate is on `auth.token.role` / `auth.token.orgId`, not on `auth != null`. Verify by inspecting every rule for `if request.auth != null` patterns.
- [ ] **Firestore Rules:** Every `update` rule constrains *both* `resource.data` (current) and `request.resource.data` (incoming) for ownership/tenancy fields. Verify by tenant-jump test in `@firebase/rules-unit-testing`.
- [ ] **Firestore Rules:** Every `update` rule uses `diff().affectedKeys().hasOnly(...)` to whitelist mutable fields. Verify by mass-assignment test (try writing all unrelated fields, assert deny).
- [ ] **Firestore Rules:** No `get()` calls in hot-path rules; tenant scope is from claims. Verify by Rules cost dashboard ratio.
- [ ] **Anonymous Auth:** Firebase Console → Authentication → Sign-in method → Anonymous shows "Disabled". Not just "no longer used in code".
- [ ] **Custom claims:** `getIdToken(true)` called after any client-triggered claim change. Verify by tracing the auth flow in code.
- [ ] **MFA:** Recovery codes shown at enrolment. Verify by walking through enrolment as a fresh user.
- [ ] **MFA:** Two-factor recovery procedure documented in `SECURITY.md` AND tested live. Verify by a fire drill: pretend an admin lost their phone.
- [ ] **App Check:** Enforcement enabled per-product (Firestore, Storage, Functions individually). Verify in Firebase Console → App Check → Apps → Status per product.
- [ ] **App Check:** Debug tokens for dev environments stored only in `.env.local`, gitignored. Verify by `git log -p` for `FIREBASE_APPCHECK_DEBUG_TOKEN`.
- [ ] **Cloud Functions:** All secrets via `defineSecret()`, not env vars. Verify by `firebase functions:secrets:access` listing matches expected.
- [ ] **Cloud Functions:** Per-function service accounts with minimal IAM. Verify by inspecting service account binding in Cloud Console.
- [ ] **Cloud Functions:** Auth-blocking functions have `minInstances: 1`. Verify by deployment manifest.
- [ ] **Audit log:** Client cannot write — confirmed by Rules unit test asserting `permission-denied` on `addDoc(auditLog, ...)`.
- [ ] **Audit log:** Audited user cannot read their own audit entries. Confirmed by Rules unit test.
- [ ] **Audit log:** Schema versioned (`schemaVersion: 1`). Verify by inspecting any audit doc.
- [ ] **Audit log:** Records IP via `x-forwarded-for[0]`, user-agent normalised. Verify by inspecting a real audit event.
- [ ] **CSP:** `report-only` mode soaked for ≥7 days; report endpoint receiving and being triaged. Verify by `csp-violations` collection has entries.
- [ ] **CSP:** Strict CSP enforced as response *header* (not meta-tag). Verify by `curl -I https://baselayers.bedeveloped.com | grep -i csp` returns the policy.
- [ ] **CSP:** `frame-ancestors 'none'` set. Verify same as above.
- [ ] **HSTS:** Header includes `preload` and domain submitted to hstspreload.org. Verify by hstspreload.org submission status.
- [ ] **Self-hosted bundles:** No `<script src="https://cdn...">` in production HTML. Verify by `grep -E 'src="https?://' dist/index.html` returns empty.
- [ ] **Sentry:** `sendDefaultPii: false` set explicitly. Verify by Sentry config code review.
- [ ] **Sentry:** `beforeSend` scrubber covers known PII fields. Verify by Sentry test error containing fake PII shows redacted.
- [ ] **Backup:** Scheduled Firestore export to GCS running. Verify by GCS bucket content.
- [ ] **Backup:** Restore drill executed and documented. Verify by `runbooks/restore-drill-<date>.md` existing.
- [ ] **GDPR erasure:** Walked end-to-end on a test user; verified across all collections + storage. Verify by `tests/gdpr-erasure.test.ts` passing.
- [ ] **GDPR erasure:** Tombstone format consistent across collections. Verify by audit script enumerating any remaining PII.
- [ ] **`crypto.randomUUID()`:** No `Math.random()` in security-relevant paths. Verify by `grep -nE 'Math\.random' src/` returning empty.
- [ ] **`html:` escape hatch:** Removed from `h()`. Verify by `grep -n 'html:' src/dom.js` returning empty.
- [ ] **Tests:** `pillarScoreForRound`, `migrateV1IfNeeded`, `unreadCountForPillar`, `unreadChatTotal`, sync-merge tested. Verify by `vitest run --coverage`.
- [ ] **CI:** Every PR runs Vitest + `npm audit` + Rules unit tests + typecheck. Verify by `.github/workflows/` and recent PR check status.
- [ ] **`SECURITY.md`:** Each control has code link, test link, operational artifact, framework citation. Verify by walking the doc.
- [ ] **Vendor questionnaire response:** Honest "credible / not certified" framing. Verify by reading the response yourself and asking "would I survive a follow-up question on this?".

---

## Recovery Strategies

When a pitfall manifests despite prevention, here's the recovery cost and steps.

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| Locked out by strict Rules deploy (Pitfall 1) | LOW if caught fast | Roll back Rules: `firebase deploy --only firestore:rules` from previous commit. ≤5min recovery. Investigate why staging didn't catch it |
| Tenant-jump via missing immutable-field check (Pitfall 3) | HIGH | Enumerate all docs where `orgId` mutated since rule deploy; identify malicious vs legitimate changes via audit log; revert from backup. Notify affected tenants per breach disclosure obligations |
| Custom claims propagation lag stranded users (Pitfall 6) | LOW | Mass `getIdToken(true)` push: not possible directly; use the Firestore-signal pattern after-the-fact + email users to refresh. Document in incident log |
| MFA lockout (Pitfall 7) | MEDIUM if procedure exists; HIGH if not | Run the documented recovery procedure (admin un-enrol via Admin SDK + identity verification out of band). Without procedure: support ticket → manual Firebase support escalation, days |
| App Check enforced before debug tokens propagated (Pitfall 8) | LOW | Disable enforcement per-product in Firebase Console (instant). Distribute debug tokens. Re-enable. Reconcile any user errors during the gap |
| Modular split broke a render path (Pitfall 9) | MEDIUM-HIGH | Revert the offending PR. Add a regression test for the broken path. Re-attempt. The cost compounds if multiple PRs were merged on top |
| ID migration partial failure (Pitfall 10) | HIGH | Restore from latest Firestore export (Phase 8 must be live!). Re-run migration with idempotency markers. *Do not* try to "fix forward" without the backup as safety net |
| Forgotten cascade in GDPR erasure (Pitfall 11) | MEDIUM | Run a "post-erasure audit script" that enumerates any remaining references to the user. For each, redact / tombstone. Update the erasure flow to include the missed collection. Document in incident log + audit |
| Cloud Function timeout on auth blocking (Pitfall 12) | LOW once detected | Add `minInstances: 1`. Increase memory if logic is genuinely slow. As a stopgap, move blocking work to non-blocking trigger and accept a ~1s claim-propagation delay |
| Sentry quota blown by error storm (Pitfall 18) | LOW | Disable Sentry submission temporarily via remote-config flag; identify and fix the storming error; re-enable with rate limit |
| CSP rollout broke a feature (Pitfall 16) | LOW | Switch CSP back to `Content-Security-Policy-Report-Only` to unblock; investigate via the violation reports; ship the fix; re-enforce |
| Audit log written from client (Pitfall 17) | MEDIUM | Re-classify any client-written audit events as "untrusted/decorative". Server-side audit log starts now; pre-existing events kept for narrative continuity but clearly labelled `source: client_legacy` |
| Compliance over-claim caught by reviewer (Pitfall 19) | HIGH (commercial) | Acknowledge, correct in writing, share the actual posture honestly. Sometimes recoverable; sometimes the deal is dead. Prevention >> recovery |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| 1: Locking out on Rules deploy | Phase 1 (write+test) → Phase 2 (deploy) | Staging deploy succeeds end-to-end before prod deploy |
| 2: `auth != null` confusion | Phase 1 + Phase 2 | Anonymous Auth shown disabled in console; Rules tested with anonymous token (must deny) |
| 3: `resource.data` vs `request.resource.data` | Phase 1 | Tenant-jump rules unit test passes (must deny `orgId` rewrites) |
| 4: `getAfter()` / `get()` traps | Phase 1 (architecture) + Phase 6 (offload to Functions) | Rules cost dashboard within budget; no >1 `get()` per rule |
| 5: UID remapping during auth migration | Phase 2 + Phase 6 | Backfill script idempotent; before/after doc-count assertions pass |
| 6: Custom claims propagation lag | Phase 2 + Phase 6 | Force-refresh + Firestore-signal patterns implemented; tested under role-change scenario |
| 7: MFA lockout | Phase 2 | Recovery codes + un-enrol procedure documented + drilled |
| 8: App Check enrolment too early | Phase 5 | 7-day soak in unenforced; debug tokens distributed; per-service stage rollout |
| 9: Refactor without test fences | Phase 3 (must complete before Phase 4) | CI green on tests for scoring, migration, sync, unread before split begins |
| 10: ID migration without idempotency | Phase 3 (forward-only `crypto.randomUUID()`); Phase 6 (any backfill) — needs Phase 8 first | Idempotency markers; pre-migration backup; staging dry-run |
| 11: GDPR erasure cascade gaps | Phase 7 + Phase 8 coordination | Post-erasure audit script returns clean across all collections + storage |
| 12: 1st vs 2nd gen Cloud Functions / blocking timeouts | Phase 6 | All blocking functions on 2nd-gen with min-instances; p99 < 4s |
| 13: Cloud Functions secret management | Phase 6 | All secrets via `defineSecret()`; per-function service accounts |
| 14: Vite + GitHub Pages base-path | Phase 3 | CNAME asserted in CI; absolute `connect-src` for Firebase |
| 15: Hosting platform (header support) | Phase 3 (cut over to Firebase Hosting) | securityheaders.com grade A on production |
| 16: CSP rollout | Phase 9 | 3-stage rollout completed; reports collection has triage history |
| 17: Audit log from client | Phase 6 | Rules unit test asserts client-write denied; audited-user-read denied |
| 18: Sentry PII leakage | Phase 10 | `sendDefaultPii: false`; scrubber tested with synthetic PII |
| 19: Compliance theatre | Every phase + Phase 12 consolidation | Each control has citation + test + operational artifact |
| 20: H7+H8 unsafe sequencing | Phase 3 (tests) → Phase 11 (H7 separate from H8) | Clock-skew test passes; concurrent-edit test passes |

---

## Codebase-Specific Cross-References (CONCERNS.md Already-Manifesting Pitfalls)

These pitfalls aren't hypothetical — they're **already present in the codebase today**. Linked back to where in `CONCERNS.md` they surface.

| Pitfall | Already manifesting at | Severity in CONCERNS.md |
|---|---|---|
| Pitfall 2 (`auth != null` confusion) | Implied by C1 + C3 — there are no rules at all, so the *default* "is signed in" is the only check; with anonymous auth this means "loaded the page" | C1 + C3 (CRITICAL) |
| Pitfall 5 (UID remapping) | App-internal `userId` baked into `users/{userId}`, `orgs/*.userIds`, `messages.authorId`, `comments.authorId`, `documents.uploaderId`, `funnelComments.authorId`, `roadmaps`. Whole denormalisation surface needs remapping | All of C1, M6, H1 |
| Pitfall 9 (refactor without tests) | H1 (4,103-line monolith) + H2 (zero tests) co-exist. The fragility F1-F3 documents what breaks | H1 + H2 (HIGH) |
| Pitfall 10 (ID migration) | H5 (`Math.random()` ids) — the *forward-only* path (new ids = UUIDs) is low-risk; the *historical* path (rekeying existing) is the high-risk version | H5 (HIGH) |
| Pitfall 14 (Vite + base path) | M1 (`?v=46` cache busting) is the symptom of "no build pipeline"; Vite migration introduces the base-path question | M1 (MEDIUM) |
| Pitfall 15 (hosting platform) | H4 (no CSP / headers) + GitHub Pages = can't fix H4 properly without moving hosts | H4 (HIGH) |
| Pitfall 16 (CSP rollout) | M2 (innerHTML clears) + M5 (inline styles) = strict CSP would break the entire UI on day one | M5 (MEDIUM) |
| Pitfall 18 (Sentry PII) | M4 (only `console.error`) — the moment you wire any remote sink, you face this | M4 (MEDIUM) |
| Pitfall 20 (H7+H8 sequencing) | H7 + H8 (HIGH) — both real, both entangled | Both HIGH |
| Storage objects under user-controlled filename | H6 — `app.js:2759` includes filename verbatim; client sets `Content-Type` | H6 (HIGH) |
| Stored-XSS via `html:` escape hatch | C4 — latent today via `app.js:614`; one careless caller activates it | C4 (CRITICAL) |
| Hardcoded internal-team password hash | C2 — `app.js:443-444`. Visible in public repo since first commit. Treat all derived data as exposed | C2 (CRITICAL) |
| Email enumeration in auth UX | L1 — `app.js:1071-1077, 1148-1152` | L1 (LOW) |
| Stacked subscription leaks | F3 — `app.js:392-397` re-renders on every snapshot, which can re-create listeners | F3 (Fragile) |

---

## Sources

**Authoritative (HIGH confidence)**
- Firebase, *Writing conditions for Cloud Firestore Security Rules* — https://firebase.google.com/docs/firestore/security/rules-conditions (verified billing/depth limit claims, `getAfter` behaviour)
- Firebase, *Control Access with Custom Claims and Security Rules* — https://firebase.google.com/docs/auth/admin/custom-claims (verified `getIdToken(true)` propagation requirement)
- Firebase, *Enable App Check enforcement* — https://firebase.google.com/docs/app-check/enable-enforcement (verified 10-15min enforcement propagation, gradual rollout via Remote Config)
- Firebase, *Extend Firebase Authentication with blocking functions* — https://firebase.google.com/docs/auth/extend-with-blocking-functions (verified `beforeUserCreated` claim-setting pattern)
- Firebase, *Schedule data exports* — https://firebase.google.com/docs/firestore/solutions/schedule-export (verified Cloud Workflows pattern)
- Firebase, *Back up and restore data* — https://firebase.google.com/docs/firestore/backups (verified retention period max 14 weeks; deletion-of-source does not auto-delete backups)
- Firebase, *Configure custom claims on users* (Identity Platform) — https://cloud.google.com/identity-platform/docs/how-to-configure-custom-claims (verified 1000-byte size constraint)
- OWASP, *Top 10 for Web Applications 2025* — used as the framework citation per `SECURITY_AUDIT.md`
- OWASP, *Application Security Verification Standard 5.0* — used for ASVS L2 mapping per `PROJECT.md` Constraints

**Community / Pattern References (MEDIUM confidence)**
- Doug Stevenson, *Patterns for security with Firebase: supercharged custom claims with Firestore and Cloud Functions* — https://medium.com/firebase-developers/patterns-for-security-with-firebase-supercharged-custom-claims-with-firestore-and-cloud-functions-bb8f46b24e11 (Firestore-signal pattern for claim propagation)
- Márton Kodok, *Firestore Backups the easy way with Cloud Workflows* — https://medium.com/google-cloud/firestore-backups-the-easy-way-with-cloud-workflows-3a96a434d3c7 (recommended over Cloud Functions for >5GB exports)
- firebase/firebase-tools issue #2067 — https://github.com/firebase/firebase-tools/issues/2067 (emulator vs prod `getAfter` divergence on non-existent docs)
- OneUptime, *How to Set Up Firebase Auth with Custom Claims for Role-Based Access Control* (Feb 2026) — https://oneuptime.com/blog/post/2026-02-17-how-to-set-up-firebase-auth-with-custom-claims-for-role-based-access-control-in-gcp/view
- App369, *Firebase Security Rules: The Complete Guide for App Developers (2026)* — https://app369.com/blog/firebase-security-guide-2026/

**Project Context (HIGH confidence — same repo)**
- `.planning/codebase/CONCERNS.md` — primary source for codebase-specific manifestations
- `.planning/codebase/ARCHITECTURE.md` — used for fragility points F1-F3, render-flow analysis
- `.planning/codebase/INTEGRATIONS.md` — Firebase project topology, collection inventory
- `SECURITY_AUDIT.md` — framework reference, Tier 2/Tier 3 review-required taxonomy
- `.planning/PROJECT.md` — milestone scope, decisions, constraints, recommended fix order

---

*Pitfalls research for: Firebase-backed compliance-credible SaaS hardening pass*
*Researched: 2026-05-03*
