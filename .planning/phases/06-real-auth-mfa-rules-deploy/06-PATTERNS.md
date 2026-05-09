# Phase 6: Real Auth + MFA + Rules Deploy (Cutover) - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 22 (13 NEW + 9 MODIFIED — 3 DELETED need no analog)
**Analogs found:** 22 / 22 (all NEW + MODIFIED files have a strong codebase analog)

---

## File Classification

### NEW files

| New file | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `functions/src/auth/beforeUserCreated.ts` | cloud-fn (auth-blocking trigger) | event-driven (auth event) | `functions/src/csp/cspReportSink.ts` | role+stack-match (both 2nd-gen, europe-west2; cspReportSink is `onRequest` not blocking — see notes) |
| `functions/src/auth/beforeUserSignedIn.ts` | cloud-fn (auth-blocking trigger) | event-driven (auth event) | `functions/src/csp/cspReportSink.ts` | role+stack-match (same caveat) |
| `functions/src/auth/setClaims.ts` | cloud-fn (HTTPS callable) | request-response | `functions/src/csp/cspReportSink.ts` | partial — closest CF in repo; differs (callable vs onRequest) |
| `functions/src/auth/claim-builder.ts` | utility (pure logic seam) | transform | `functions/src/csp/normalise.ts` + `functions/src/csp/filter.ts` | exact (sibling pure-logic helper, no firebase-functions import) |
| `functions/test/auth/claim-builder.test.ts` | test (unit, Vitest, TS) | n/a | `functions/test/csp/normalise.test.ts` + `filter.test.ts` | exact |
| `src/views/auth.js` | view (Pattern D DI factory) | request-response (form submit) | existing `src/views/auth.js` (Phase-4 placeholder) + `src/views/admin.js` | exact (target file IS the existing stub; just expanding the body) |
| `tests/views/auth.test.js` | test (view contract / snapshot) | n/a | existing `tests/views/auth.test.js` + `tests/views/admin.test.js` | exact (extend the stub) |
| `scripts/seed-internal-allowlist/run.js` | script (Admin SDK one-shot) | batch | `scripts/migrate-subcollections/run.js` | exact (sibling Admin SDK one-shot) |
| `scripts/strip-legacy-id-fields.js` | script (Admin SDK one-shot) | batch | `scripts/migrate-subcollections/run.js` | exact |
| `runbooks/phase6-cutover.md` | runbook (operator checklist) | n/a | `runbooks/hosting-cutover.md` + `runbooks/phase5-subcollection-migration.md` | exact (same checklist shape) |
| `runbooks/phase6-bootstrap.md` | runbook | n/a | `runbooks/firebase-oidc-bootstrap.md` + `runbooks/hosting-cutover.md` | exact |
| `runbooks/phase6-mfa-recovery-drill.md` | runbook (drill / evidence template) | n/a | `runbooks/hosting-cutover.md` (Cutover Log skeleton) | role-match |
| `runbooks/phase6-rules-rollback-rehearsal.md` | runbook (rehearsal / evidence template) | n/a | `runbooks/hosting-cutover.md` (DNS Revert Procedure section) | role-match |

### MODIFIED files

| Modified file | Role | Data Flow | Closest Analog (in-file pattern) | Match Quality |
|---------------|------|-----------|----------------------------------|---------------|
| `firebase.json` | config | n/a | own existing `firestore` + `storage` blocks (already present, lines 50-56) | exact — declarations already present; verify-and-leave / no-op gate |
| `functions/src/index.ts` | config (re-exports) | n/a | own existing `cspReportSink` re-export (line 3) | exact |
| `src/firebase/auth.js` | adapter (per-feature submodule) | request-response | `src/firebase/functions.js` (per-feature submodule shape) + own existing placeholder bodies | exact |
| `src/cloud/claims-admin.js` | adapter (callable client) | request-response | `src/firebase/functions.js` (`httpsCallable` export) + `src/cloud/claims-admin.js` own JSDoc shape | exact |
| `src/router.js` | dispatcher | n/a | own existing `renderRoute` dispatcher (lines 78-99) | exact (extend the route conditional ladder) |
| `src/main.js` | entry (constants + IIFE) | n/a | own existing constants block (lines 625-633) | exact (delete-only mod) |
| `.gitleaks.toml` | config | n/a | own existing custom-rule block (lines 8-14) | exact (delete-only mod) |
| `SECURITY.md` | docs (per-phase increment) | n/a | own §Phase 5 Audit Index (lines 648-678) + §Phase 3 Audit Index (lines 494-523) | exact |
| `.planning/REQUIREMENTS.md` | docs | n/a | own existing AUTH-09 row | trivial — append SUPERSEDED note |

### DELETED files (no analog needed)

| File | Reason |
|------|--------|
| `src/auth/state-machine.js` | atomic deletion in cutover commit (D-04). |
| `tests/auth/state-machine.test.js` | self-documenting deletion baseline (file's own header at lines 5-14 says "Phase 6 (AUTH-14) deletes alongside the production code"). |
| `tests/fixtures/auth-passwords.js` | consumed-as-designed when its sole consumer (`state-machine.test.js`) is deleted. |

---

## Pattern Assignments

### `functions/src/auth/beforeUserCreated.ts` (cloud-fn auth-blocking trigger, event-driven)

**Analog:** `functions/src/csp/cspReportSink.ts` (lines 1-107) — the only existing 2nd-gen Cloud Function in the repo. It is `onRequest`, not `beforeUserCreated`; the **deploy + region + logger + structural conventions** transfer; the **trigger import + handler signature** must come from the Firebase docs (`https://firebase.google.com/docs/auth/extend-with-blocking-functions`). **Sibling pure helper pattern** comes from `functions/src/csp/{normalise,filter}.ts` — the equivalent for `beforeUserCreated` is `claim-builder.ts`.

**Imports pattern** (cspReportSink.ts lines 26-30 — copy region + logger + sibling-helper import shape):
```typescript
import { onRequest } from "firebase-functions/v2/https"; // <-- replace with: import { beforeUserCreated } from "firebase-functions/v2/identity";
import { logger } from "firebase-functions/logger";
import { normalise } from "./normalise.js";                // <-- pattern: ESM-relative .js import even for .ts (Node-22 + tsconfig)
import { shouldDrop } from "./filter.js";
import { isDuplicate, markSeen, fingerprint } from "./dedup.js";
```
For Phase 6:
```typescript
import { beforeUserCreated } from "firebase-functions/v2/identity";
import { logger } from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { buildClaims } from "./claim-builder.js";
```

**Handler config pattern** (cspReportSink.ts lines 34-36):
```typescript
export const cspReportSink = onRequest(
  { region: "europe-west2" },
  (req, res) => {
```
For Phase 6 — D-09 (region) + Pitfall 12 (`minInstances: 1` for blocking triggers — auth blocking has a 7s deadline; cold start would breach it):
```typescript
export const beforeUserCreatedHandler = beforeUserCreated(
  { region: "europe-west2", minInstances: 1 },
  async (event) => {
    const email = event.data?.email?.toLowerCase();
    if (!email) return; // let Firebase reject via its own validation
    // ... read internalAllowlist/{email}, call buildClaims, return { customClaims }
  },
);
```

**Structured logging pattern** (cspReportSink.ts lines 96-102 — D-10a / RESEARCH §Pattern 2):
```typescript
// logger.warn(message, structuredObj) yields severity=WARNING with a
// queryable jsonPayload. Cloud Logging Logs Explorer query:
//   resource.type="cloud_run_revision"
//   severity=WARNING
//   jsonPayload.message="csp.violation"
logger.warn("csp.violation", { report, fingerprint: fingerprint(report) });
```
For Phase 6 (D-21 / Pitfall 17 — Phase 6 only logs structured Cloud Logging entries; Firestore-side `auditLog/` writer defers to Phase 7):
```typescript
logger.info("auth.user.created", {
  uid: event.data?.uid,
  email,
  role: claims.role,
  orgId: claims.orgId ?? null,
});
```

**Notes / what differs:**
- Trigger class differs (`onRequest` → `beforeUserCreated`); Firebase docs are the source of truth for the handler signature + return shape (`{ customClaims }`).
- 7s deadline (Pitfall 12) — keep allowlist read to a single doc-by-id `getFirestore().doc(\`internalAllowlist/${email}\`).get()`; never list-walk.
- Admin SDK init: must guard against double-init (`if (!getApps().length) initializeApp();`) — required because `index.ts` may import the module multiple times during emulator runs.
- Return value sets claims in the user's first ID token (Pitfall 6 mitigation #3) — no poke needed for bootstrap.

---

### `functions/src/auth/beforeUserSignedIn.ts` (cloud-fn auth-blocking trigger, event-driven)

**Analog:** same as above — `functions/src/csp/cspReportSink.ts`.

**Pattern excerpt** (same `region: "europe-west2"` + `minInstances: 1` config block as `beforeUserCreated`; ARCHITECTURE.md §3 row says "stamp last-sign-in audit event" — a structured Cloud Logging entry):
```typescript
import { beforeUserSignedIn } from "firebase-functions/v2/identity";
import { logger } from "firebase-functions/logger";

export const beforeUserSignedInHandler = beforeUserSignedIn(
  { region: "europe-west2", minInstances: 1 },
  async (event) => {
    logger.info("auth.user.signin", {
      uid: event.data?.uid,
      email: event.data?.email,
      provider: event.data?.providerData?.[0]?.providerId,
      mfa: event.data?.multiFactor?.enrolledFactors?.length ?? 0,
    });
    // No mutation; this trigger is observation-only per Phase 6 D-01 Wave 2 +
    // ARCHITECTURE.md §3 "Use sparingly".
  },
);
```

**Notes / what differs:**
- Even more strictly observation-only than `beforeUserCreated` — no claim mutation, no Firestore read. The 7s deadline becomes trivially met.
- D-21 says Phase 6 logs structured Cloud Logging only; Phase 7 wires the Firestore-side `auditLog/` writer + back-fills sign-in events from Cloud Logging.

---

### `functions/src/auth/setClaims.ts` (cloud-fn HTTPS callable, request-response)

**Analog:** `functions/src/csp/cspReportSink.ts` (region + logger pattern transfer); the **callable signature** (`onCall` with `enforceAppCheck`) comes from ARCHITECTURE.md §3 ("Cloud Functions structural conventions"). No existing callable in repo — closest stack-match.

**Import + region pattern** (cspReportSink.ts lines 26-36 transfer):
```typescript
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const setClaims = onCall(
  { region: "europe-west2" /* enforceAppCheck: true comes Phase 7 FN-07 */ },
  async (request) => {
    // Re-read claims server-side (ARCHITECTURE.md §3 conventions: do NOT trust caller).
    if (request.auth?.token?.role !== "admin") {
      throw new HttpsError("permission-denied", "admin role required");
    }
    const { uid, role, orgId } = request.data ?? {};
    if (typeof uid !== "string" || !uid) {
      throw new HttpsError("invalid-argument", "uid required");
    }
    await getAuth().setCustomUserClaims(uid, { role, orgId: orgId ?? null });
    // Poke pattern per ARCHITECTURE.md §7 Flow C — write users/{uid}/_pokes/{ts}
    // so the target session listener forces an ID-token refresh.
    await getFirestore()
      .doc(`users/${uid}/_pokes/${Date.now()}`)
      .set({ type: "claims-changed", at: FieldValue.serverTimestamp() });
    logger.info("auth.claims.set", { targetUid: uid, role, orgId, byUid: request.auth.uid });
    return { ok: true };
  },
);
```

**Notes / what differs:**
- `enforceAppCheck: true` deferred to Phase 7 (CONTEXT.md `<domain>` paragraph 4).
- Zod input validation deferred (CONTEXT.md does not call out Zod for Phase 6 — ARCHITECTURE.md §3 says "every callable validates with Zod"; planner can choose to ship a minimal manual validation gate now and queue a cleanup-ledger row, OR pull in Zod alongside).
- Idempotency `clientReqId` (ARCHITECTURE.md §3) is a Phase 7 concern; setClaims is admin-only and rarely called.

---

### `functions/src/auth/claim-builder.ts` (utility, pure transform — the unit-test seam)

**Analog (exact):** `functions/src/csp/normalise.ts` (lines 1-61) and `functions/src/csp/filter.ts` (lines 1-41). Both are pure, side-effect-free, no firebase-functions import; safe for unit testing without firebase-functions runtime — verbatim what claim-builder needs to be.

**Header + interface pattern** (normalise.ts lines 1-20):
```typescript
// Phase 3 (HOST-05, FN-10): pure transform from CSP wire formats to a canonical
// NormalisedReport shape. Two formats supported:
//   ...
// Returns null on any unrecognised input (...). Pure, side-effect-free; safe
// for unit testing without firebase-functions runtime.

export interface NormalisedReport {
  blockedUri: string;
  violatedDirective: string;
  documentUri: string;
  disposition: string;
  sourceFile?: string;
}
```
For Phase 6:
```typescript
// Phase 6 (AUTH-03 / D-10): pure transform from internalAllowlist entry to
// the custom-claims shape attached by beforeUserCreated. The unit-test seam
// per D-01 Wave 2 (tests-first, Vitest, no firebase-functions-test substrate).
// Pure, side-effect-free; safe for unit testing without firebase-functions runtime.

export interface AllowlistEntry {
  role: "admin" | "internal" | "client";
  orgId?: string;
  addedBy?: string;
}

export interface CustomClaims {
  role: "admin" | "internal" | "client";
  orgId: string | null;
}
```

**Function pattern** (filter.ts lines 22-41 / normalise.ts lines 22-61 — pure body, returns canonical shape or null):
```typescript
export function shouldDrop(r: NormalisedReport): boolean {
  const blocked = r.blockedUri ?? "";
  const srcFile = r.sourceFile ?? "";
  for (const scheme of EXTENSION_SCHEMES) {
    if (blocked.startsWith(scheme) || srcFile.startsWith(scheme)) return true;
  }
  // ...
  return false;
}
```
For Phase 6 — `buildClaims` is the test seam called by `beforeUserCreated.ts` after it reads `internalAllowlist/{email}`:
```typescript
export function buildClaims(allowlistEntry: AllowlistEntry | null): CustomClaims {
  if (!allowlistEntry) {
    // Pitfall 6 + ARCHITECTURE.md §7 Flow B: client invitees fall through to
    // a "client" role; orgId would come from invite-JWT in a future invite
    // flow. Phase 6 ships internal-only; planner picks signup-policy gate.
    return { role: "client", orgId: null };
  }
  return {
    role: allowlistEntry.role,
    orgId: allowlistEntry.orgId ?? null,
  };
}
```

**Notes / what differs:**
- Same "pure module, no firebase-functions import" rule as normalise/filter — that is what makes Vitest unit testing feasible without `firebase-functions-test` (which is deferred to Phase 7 TEST-09).

---

### `functions/test/auth/claim-builder.test.ts` (test, unit, Vitest, TS)

**Analog (exact):** `functions/test/csp/normalise.test.ts` (lines 1-40 read) and `functions/test/csp/filter.test.ts` (lines 1-49 — read in full).

**Pattern excerpt** (filter.test.ts lines 1-23):
```typescript
// Phase 3 (HOST-05, FN-10): cover shouldDrop() — extension + synthetic origins
import { describe, it, expect } from "vitest";
import { shouldDrop } from "../../src/csp/filter.js";
import type { NormalisedReport } from "../../src/csp/normalise.js";

const base: NormalisedReport = {
  blockedUri: "https://example.com/bad.js",
  violatedDirective: "script-src-elem",
  documentUri: "https://baselayers.bedeveloped.com/",
  disposition: "report-only",
};

describe("shouldDrop — extension origins via blockedUri (D-11)", () => {
  it.each([
    "chrome-extension://abc/inject.js",
    // ...
  ])("drops blockedUri starting with %s", (blocked) => {
    expect(shouldDrop({ ...base, blockedUri: blocked })).toBe(true);
  });
});
```
For Phase 6:
```typescript
// Phase 6 (AUTH-03 / D-01 Wave 2 tests-first): cover buildClaims().
import { describe, it, expect } from "vitest";
import { buildClaims } from "../../src/auth/claim-builder.js";
import type { AllowlistEntry } from "../../src/auth/claim-builder.js";

describe("buildClaims — allowlisted entries", () => {
  it.each<[AllowlistEntry, { role: string; orgId: string | null }]>([
    [{ role: "admin" }, { role: "admin", orgId: null }],
    [{ role: "internal" }, { role: "internal", orgId: null }],
    [{ role: "client", orgId: "org_abc" }, { role: "client", orgId: "org_abc" }],
  ])("maps %j to %j", (entry, expected) => {
    expect(buildClaims(entry)).toEqual(expected);
  });
});

describe("buildClaims — null entry (no allowlist match)", () => {
  it("falls through to a client role with null orgId", () => {
    expect(buildClaims(null)).toEqual({ role: "client", orgId: null });
  });
});
```

**Notes / what differs:**
- Path: `functions/test/auth/claim-builder.test.ts` (mirrors `functions/test/csp/normalise.test.ts`).
- ESM `.js` import path even for `.ts` source — required by the existing tsconfig + `vitest.config.ts` setup that already works for the csp tests.

---

### `src/views/auth.js` (view, Pattern D DI factory)

**Analog (exact):** the existing `src/views/auth.js` (Phase-4 placeholder, lines 1-59) IS the file being expanded. Pattern D shape comes from `src/views/admin.js` + `src/views/dashboard.js`. Phase 6 D-16 expands the placeholder to export 4 render functions instead of one.

**Existing factory shape** (current `src/views/auth.js` lines 30-48 — keep this skeleton, expand the body):
```javascript
/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 *   notify?: (level: string, msg: string) => void,
 * }} AuthDeps
 */

export function createAuthView(deps) {
  const h = deps.h || defaultH;
  return {
    renderAuth() {
      return h("div", { class: "auth-wrap auth-wrap--placeholder" });
    },
  };
}
```
For Phase 6 — D-16's 4 render functions become 4 properties on the returned object. Add `signInEmailPassword` / `multiFactor` / `sendEmailVerification` / `sendSignInLinkToEmail` / `sendPasswordResetEmail` to deps:
```javascript
/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 *   notify?: (level: string, msg: string) => void,
 *   signInEmailPassword?: (email: string, password: string) => Promise<*>,
 *   signOut?: () => Promise<void>,
 *   multiFactor?: (user: *) => *,
 *   sendEmailVerification?: (user: *) => Promise<void>,
 *   sendSignInLinkToEmail?: (email: string, settings: *) => Promise<void>,
 *   sendPasswordResetEmail?: (email: string) => Promise<void>,
 * }} AuthDeps
 */

export function createAuthView(deps) {
  const h = deps.h || defaultH;
  return {
    renderSignIn() { /* email + password form; submit -> deps.signInEmailPassword */ },
    renderFirstRun() { /* forced password change view */ },
    renderMfaEnrol() { /* TOTP QR + manual secret + verification-code input */ },
    renderEmailVerificationLanding() { /* "check your email" + Resend button */ },
  };
}
```

**Imports pattern** (current `src/views/auth.js` line 20 — confirms the four-boundary lint rule for views: `views/*` imports from `ui/*` + `firebase/*` indirectly via deps, never from `firebase/*` directly):
```javascript
import { h as defaultH } from "../ui/dom.js";
```
For Phase 6 — keep this; do NOT add `import { signInEmailPassword } from "../firebase/auth.js"` directly (boundary rule per Phase 4 ESLint Wave 1; the existing `src/views/auth.js` already follows this). Auth functions reach the view through `deps`, which `main.js` / `router.js` populate from `src/firebase/auth.js`.

**Notes / what differs:**
- `views/auth.js` is the only view that needs new deps callbacks beyond `h` and `notify` (specifically the firebase/auth.js helpers). Other views (dashboard, diagnostic, etc.) only need `h`. Document this expanded `AuthDeps` typedef so the planner knows the wiring point in `main.js` / `router.js`.
- TOTP QR-code rendering: per Discretion bullet, default is `qrcode` npm bundled — adds `qrcode@^1.5.x` to root `package.json` deps; CSP allowlist hit avoided.
- The 4 render functions produce **different DOM trees**, not 4 cosmetic variants — each needs its own snapshot.

---

### `tests/views/auth.test.js` (test, view contract / snapshot)

**Analog (exact):** existing `tests/views/auth.test.js` (lines 1-33 — read in full; the file IS the target) and `tests/views/admin.test.js` (lines 1-19).

**Existing pattern** (current `tests/views/auth.test.js` lines 8-33 — extend, don't replace):
```javascript
import { describe, it, expect } from "vitest";
import { renderAuth, createAuthView } from "../../src/views/auth.js";

describe("src/views/auth.js — Wave 4 Pattern D extraction", () => {
  it("exports renderAuth as a function", () => {
    expect(typeof renderAuth).toBe("function");
  });

  it("createAuthView returns an object with renderAuth bound to deps", () => {
    const fakeDeps = { state: {}, h: () => document.createElement("div") };
    const view = createAuthView(fakeDeps);
    expect(view).toBeTruthy();
    expect(typeof view.renderAuth).toBe("function");
  });
  // ...
});
```
For Phase 6 — add 4 contract tests + 4 snapshot tests (one per render function); per Discretion bullet, default is single-file with 4 describe blocks. Snapshot pattern from `tests/views/dashboard.test.js` lines 56-59:
```javascript
it("matches the dashboard snapshot", async () => {
  const html = /** @type {HTMLElement} */ (document.getElementById("app")).innerHTML;
  await expect(html).toMatchFileSnapshot("../__snapshots__/views/dashboard.html");
});
```
For Phase 6:
```javascript
describe("renderSignIn", () => {
  it("renders email + password fields + submit button", () => {
    const view = createAuthView({ h: (tag, attrs, kids) => /* h impl */ });
    const el = view.renderSignIn();
    expect(el.querySelector('input[type="email"]')).toBeTruthy();
    expect(el.querySelector('input[type="password"]')).toBeTruthy();
    expect(el.querySelector('button[type="submit"]')).toBeTruthy();
  });
  it("matches the sign-in snapshot", async () => {
    const view = createAuthView({});
    document.body.appendChild(view.renderSignIn());
    await expect(document.body.innerHTML).toMatchFileSnapshot(
      "../__snapshots__/views/auth-sign-in.html",
    );
  });
});
// ... three more describe blocks for renderFirstRun, renderMfaEnrol, renderEmailVerificationLanding
```

**Notes / what differs:**
- Existing test asserts the placeholder factory shape; Phase 6 expands to 4 render fns.
- Snapshot directory `tests/__snapshots__/views/` already exists per `tests/views/dashboard.test.js` line 58 reference — reuse it.

---

### `scripts/seed-internal-allowlist/run.js` (script, Admin SDK one-shot)

**Analog (exact):** `scripts/migrate-subcollections/run.js` (lines 1-129, fully read). Same shape: `firebase-admin` via ADC + `argv` flags (`--dry-run` / `--verify`) + per-step idempotency markers + pre/post counts + structured `[OK]` / `[FAIL]` exit signaling.

**Header pattern** (lines 1-26 of `migrate-subcollections/run.js`):
```javascript
#!/usr/bin/env node
// scripts/migrate-subcollections/run.js
// @ts-check
//
// Phase 5 Wave 2 (D-01 / D-02 / D-03 / D-06): one-shot Admin-SDK migration script.
// ...
//
// CRITICAL: this script bypasses Firestore Security Rules (Admin SDK).
// It MUST NOT be imported into src/ (Pitfall 4 closure) — lives in scripts/
// entirely separate from the Vite bundled app.
//
// Usage:
//   node scripts/migrate-subcollections/run.js [--dry-run] [--verify]
```
For Phase 6 — mirror verbatim (header + ADC + dry-run flag + verify flag):
```javascript
#!/usr/bin/env node
// scripts/seed-internal-allowlist/run.js
// @ts-check
//
// Phase 6 Wave 4 (D-05 / D-20): one-shot Admin-SDK script. Seeds
// internalAllowlist/{lower(luke@bedeveloped.com)} +
// internalAllowlist/{lower(george@bedeveloped.com)} with { role: "admin" }
// before the operator Console-creates the Auth users (D-05).
//
// CRITICAL: this script bypasses Firestore Security Rules (Admin SDK).
// It MUST NOT be imported into src/ (Pitfall 4 closure).
//
// Usage:
//   node scripts/seed-internal-allowlist/run.js [--dry-run]
```

**Init + ADC pattern** (lines 28-58):
```javascript
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { argv } from "node:process";

const PROJECT_ID = "bedeveloped-base-layers";
const DRY_RUN = argv.includes("--dry-run");

const app = initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});
const db = getFirestore(app);

if (DRY_RUN) console.log("[MODE] DRY-RUN -- no Firestore writes will occur");
```
For Phase 6 — verbatim copy of init block; only the per-doc loop body differs:
```javascript
const ALLOWLIST = [
  { email: "luke@bedeveloped.com", role: "admin" },
  { email: "george@bedeveloped.com", role: "admin" },
];

async function main() {
  for (const { email, role } of ALLOWLIST) {
    const docId = email.toLowerCase(); // ARCHITECTURE.md §8: emails lowercased
    if (DRY_RUN) {
      console.log(`[DRY-RUN] would write internalAllowlist/${docId} = { role: "${role}" }`);
      continue;
    }
    await db.doc(`internalAllowlist/${docId}`).set({
      role,
      addedBy: "phase-6-bootstrap",
      addedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`[OK] internalAllowlist/${docId} seeded with role=${role}`);
  }
}

main().catch((err) => { console.error("[FAIL]", err); process.exitCode = 1; });
```

**Notes / what differs:**
- No need for the per-step idempotency marker substrate (`migrations/{stepId}/items/{docId}`) — only 2 docs total; `set({ merge: true })` is naturally idempotent.
- Verify gate: optional `--verify` flag could read both docs back and confirm shape; planner can keep or drop based on Phase 5 precedent.
- D-20: ADC via `gcloud auth application-default login` (operator-side prerequisite, documented in the bootstrap runbook).

---

### `scripts/strip-legacy-id-fields.js` (script, Admin SDK one-shot)

**Analog (exact):** `scripts/migrate-subcollections/run.js` — same Admin SDK init pattern + per-step idempotency.

**Loop body pattern** (lines 88-108 of `migrate-subcollections/run.js`):
```javascript
for (const step of STEPS) {
  console.log(`\n=== STEP ${step.stepId} (${step.label}) ===`);
  const orgsSnap = await db.collection("orgs").get();
  let written = 0;
  let skipped = 0;
  for (const orgDoc of orgsSnap.docs) {
    const result = await processDoc(
      { db, FieldValue, dryRun: DRY_RUN },
      step.stepId,
      step.builder,
      orgDoc,
    );
    if (result.skipped) skipped++;
    if (result.written) written += result.written;
  }
  console.log(`[STEP ${step.stepId}] orgs=${orgsSnap.size} skipped=${skipped} written=${written}`);
}
```
For Phase 6 — single-step delete pass over collection-group queries for `legacyAppUserId` / `legacyAuthorId` fields:
```javascript
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const COLLECTIONS_WITH_LEGACY_AUTHOR = ["responses", "comments", "actions", "messages"];

async function main() {
  for (const sub of COLLECTIONS_WITH_LEGACY_AUTHOR) {
    const snap = await db.collectionGroup(sub).get();
    let stripped = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!("legacyAppUserId" in data) && !("legacyAuthorId" in data)) continue;
      if (DRY_RUN) { stripped++; continue; }
      await doc.ref.update({
        legacyAppUserId: FieldValue.delete(),
        legacyAuthorId: FieldValue.delete(),
      });
      stripped++;
    }
    console.log(`[STEP ${sub}] docs=${snap.size} stripped=${stripped}`);
  }
}
```

**Notes / what differs:**
- Single-file script (no sibling helpers — operation is too small to warrant `builders.js` / `process-doc.js` split).
- D-17 says: backfill happened during cutover (`beforeUserCreated` claims-set keys users by `firebaseUid`), and this script just scrubs the now-unused legacy fields; close Phase 5 D-21 carry-forward row.

---

### `runbooks/phase6-cutover.md` (runbook)

**Analog (exact):** `runbooks/hosting-cutover.md` (lines 1-432 — read in full). Same shape: Prerequisites → Pre-cutover Smoke → Cutover Steps (numbered) → Rollback → Day-N Cleanup → Citations. Phase 5's `runbooks/phase5-subcollection-migration.md` (lines 1-80 read) extends the same shape with a post-mutation verification section.

**Header pattern** (`hosting-cutover.md` lines 1-9):
```markdown
# Hosting Cutover Runbook

> Phase 3 deliverable. Execute on cutover day per CONTEXT.md D-02.
> Rollback window: 14 days from cutover date per D-03.
> Do NOT delete the `gh-pages` branch ...

This runbook is intentionally executor-deferred. ...
```
For Phase 6:
```markdown
# Phase 6 Cutover Runbook

> Phase 6 deliverable. Execute as a single operator-supervised session per CONTEXT.md D-02.
> Rollback substrate: `git revert <cutover-sha> --no-edit && git push` triggers the Phase 3 CI deploy job (D-12).
> Do NOT skip the rules-rollback rehearsal in §Pre-cutover (D-12) — the rehearsal IS the SC#4 evidence.

This runbook is intentionally executor-deferred. The plan that authored it deliberately did NOT
deploy functions, Console-create the admin users, or flip Anonymous Auth. Those are operator-only
steps. The runbook exists so the operator follows a written script during a single-session
auth + rules cutover, not so improvisation happens at the keyboard.
```

**Step block pattern** (`hosting-cutover.md` lines 191-202 — Step 1 with time estimate + numbered sub-actions):
```markdown
### Step 1: Verify smokes from default URL (~5 min)

Confirm the §Pre-cutover Smoke Checklist above is green and the `## Smoke Result` block is appended to `03-PREFLIGHT.md`. ...

### Step 2: Add custom domain in Firebase Console (~5 min + verification wait)

1. Open https://console.firebase.google.com/project/bedeveloped-base-layers/hosting/sites in a browser.
2. Click "Add custom domain".
...
```
For Phase 6 — D-02 single-session sequence becomes ~10 numbered steps:
```markdown
### Step 1: Pre-cutover rules-rollback rehearsal (~10 min)
[Per D-12: deploy current rules → revert → re-deploy current → time each step.]

### Step 2: Deploy auth-blocking + callable Cloud Functions (~5 min + cold-start verify)
[Per D-09: gcloud functions list confirms p99 ≤ 4s.]

### Step 3: Run scripts/seed-internal-allowlist/run.js (~1 min)

### Step 4: Console-create both admin Auth users (~5 min)
[Per D-05: emailVerified:true via Admin SDK; force-password-change flag.]

### Step 5: Both admins sign in against OLD anon-OK rules; verify claims (~5 min)
[Per D-11: getIdTokenResult().claims.role === "admin" gate; ABORT if absent.]

### Step 6: Deploy firestore.rules + storage.rules (~3 min)
[Per RULES-07: firebase deploy --only firestore:rules,storage:rules OR merge to main.]

### Step 7: Disable Anonymous Auth in Firebase Console (~1 min)

### Step 8: Land the AUTH-14 deletion commit (~3 min)
[Per D-04: deletes INTERNAL_PASSWORD_HASH + state-machine.js + signInAnonymously call.]

### Step 9: Both admins enrol TOTP MFA (~10 min)

### Step 10: AUTH-10 drill — Tier-2 un-enrol procedure (~15 min)
[Per D-08: each admin takes a turn; document timing in phase6-mfa-recovery-drill.md.]

### Step 11: SC#4 clock-skew exercise (~5 min)
[Per D-19: ±5-min DevTools clock override on the unread-count badge.]

### Step 12: Update 06-PREFLIGHT.md ## Cutover Log (~3 min)
```

**Cutover Log block pattern** (`hosting-cutover.md` lines 305-326):
```markdown
cutover_date: <YYYY-MM-DD HH:MM TZ — the moment Step 8 GH-Pages disable was saved>
cutover_complete: yes
cutover_observed_headers: |
  HTTP/2 200
  ...
securityheaders_rating: A
ssl_provisioned_at: <YYYY-MM-DD HH:MM TZ ...>
synthetic_csp_e2e_seen_in_cloud_logging: yes
```
For Phase 6:
```markdown
cutover_date: <YYYY-MM-DD HH:MM TZ — moment of git push of cutover commit>
cutover_complete: yes
functions_deploy_p99_cold_start_ms: <int>
admin_signin_verified: yes (luke + george both ID-token role=admin in DevTools)
rules_deploy_sha: <sha>
anon_auth_console_disabled_at: <YYYY-MM-DD HH:MM TZ>
auth14_deletion_sha: <sha>
mfa_drill_evidence_path: runbooks/phase6-mfa-recovery-drill.md
rollback_rehearsal_total_seconds: <int>
sc4_clock_skew_passed: yes
```

**Citations block pattern** (`hosting-cutover.md` lines 412-431) — final section listing D-XX citations + framework citations.

**Notes / what differs:**
- Phase 6 has no DNS step but adds explicit AUTH-10 drill + MFA enrolment steps.
- Single-session ordering is load-bearing per D-02 + D-11 — sub-steps cannot be reordered without violating Pitfall 1.

---

### `runbooks/phase6-bootstrap.md` (runbook)

**Analog (exact):** `runbooks/firebase-oidc-bootstrap.md` (operator-driven Console-creation walkthrough; same shape) + `runbooks/hosting-cutover.md` for the prerequisite + checklist convention.

**Pattern excerpt** (mirrors `hosting-cutover.md` Prerequisites lines 11-49 — checklist + verify command + capture-the-value cells):
```markdown
## Prerequisites

- [ ] **Phase 6 Wave 4 merged to main.** Verify with `git log --oneline --grep="^docs(06-04):"`.
- [ ] **scripts/seed-internal-allowlist/run.js executed** (Wave 4 runs this BEFORE Console creation).
      Verify: `gcloud firestore ... documents list --collection-id=internalAllowlist` returns 2 docs.
- [ ] **gcloud auth application-default login** completed (D-20).

## Operator Steps

### Step 1: Console-create luke@bedeveloped.com (~3 min)
1. Open https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/users
2. Click "Add user"; enter email + operator-chosen temp password (≥12 chars + HIBP per AUTH-04).
3. Submit. Capture the resulting `uid` (the Console shows it after creation).

### Step 2: Mark emailVerified=true via Admin SDK (~1 min)
[Per D-05: Console doesn't expose this flag directly; use Admin SDK call.]
\`\`\`sh
node -e "import('firebase-admin/app').then(({initializeApp,applicationDefault})=>{...})"
\`\`\`
Verify: gcloud auth list users for the uid; emailVerified field shows true.

### Step 3: OOB temp-credential delivery (operator-defined channel)
[Per D-06: operator-defined; the runbook does NOT prescribe the channel. Capture the channel
in 06-HUMAN-UAT.md after-the-fact only — not before, to avoid leak.]

### Step 4: First sign-in walkthrough
1. Admin opens https://baselayers.bedeveloped.com (or default URL pre-cutover).
2. Email + temp password.
3. App prompts password change (D-05 force-flag); admin sets new password.
4. App prompts email verification; admin clicks the link in their inbox.
5. App prompts MFA enrolment; admin scans QR code with TOTP authenticator + enters code.
```

**Notes / what differs:**
- D-06 explicitly does NOT prescribe a channel — runbook should mirror that ambiguity rather than try to fill it.

---

### `runbooks/phase6-mfa-recovery-drill.md` (runbook, drill / evidence template)

**Analog:** `runbooks/hosting-cutover.md` Cutover Log skeleton (lines 305-326) — the evidence-capture structure transfers; the substantive procedure (Tier-2 Admin SDK / `firebase auth:multifactor:unenroll`) comes from Firebase docs cited in Pitfall 7 + D-08.

**Pattern excerpt** (Cutover Log shape from `hosting-cutover.md` lines 305-326 — same key/value/timestamp shape for the drill log):
```markdown
## Drill Evidence — Round 1 (luke as locked-out actor)

drill_date: <YYYY-MM-DD HH:MM TZ>
locked_out_uid: <luke uid>
operator_uid: <george uid>
step_1_oob_identity_verification:
  channel: <e.g. "voice call">
  verified_at: <HH:MM:SS TZ>
step_2_admin_sdk_unenroll:
  command: firebase auth:multifactor:unenroll --uid <luke uid> --factor <factorId>
  ran_at: <HH:MM:SS TZ>
  exit_code: 0
step_3_locked_out_user_signin:
  attempted_at: <HH:MM:SS TZ>
  ms_to_signin_success: <int>
step_4_re_enrol_totp:
  attempted_at: <HH:MM:SS TZ>
  ms_to_enrol_success: <int>
total_drill_seconds: <int>
gaps_observed: <freeform>

## Drill Evidence — Round 2 (george as locked-out actor)
[Same shape; admins swap roles per D-08.]
```

**Notes / what differs:**
- AUTH-10 closes when both rounds have populated drill evidence + zero `gaps_observed` blockers (per D-08 + Pitfall 19's "claim only what was rehearsed" gate).
- Operator-driven; the runbook exists to make the drill repeatable, not to be auto-generated.

---

### `runbooks/phase6-rules-rollback-rehearsal.md` (runbook, rehearsal / evidence template)

**Analog:** `runbooks/hosting-cutover.md` §DNS Revert Procedure (lines 334-380) + Cutover Log shape — D-12's revert-and-redeploy cycle is structurally the same procedure as the DNS revert.

**Pattern excerpt** (mirroring `hosting-cutover.md` lines 334-380 step pattern):
```markdown
## Rehearsal Procedure (Wave 5 first task)

### Step 1: Confirm CI deploy job is green on current main (~1 min)
\`\`\`sh
gh run list --workflow=ci.yml --branch=main --status=success --limit=1 --json databaseId,createdAt,headSha
\`\`\`

### Step 2: Note the SHA at HEAD (~1 min)
\`\`\`sh
git rev-parse HEAD     # capture as $REHEARSAL_SHA_BEFORE
\`\`\`

### Step 3: git revert + push (~30 sec)
\`\`\`sh
git revert $REHEARSAL_SHA_BEFORE --no-edit
git push
\`\`\`
Capture the resulting revert SHA: $REHEARSAL_REVERT_SHA.
Capture the timestamp the push completed.

### Step 4: Watch CI deploy job ... (~3 min)
\`\`\`sh
gh run watch $(gh run list --branch=main --limit=1 --json databaseId -q '.[0].databaseId')
\`\`\`
Capture the timestamp the deploy job went green.

### Step 5: Verify rules reverted (~1 min)
[Visit Firebase Console -> Firestore -> Rules; confirm pre-rehearsal rules are now deployed.]

### Step 6: Re-deploy current rules (~2 min)
\`\`\`sh
git revert $REHEARSAL_REVERT_SHA --no-edit   # revert-the-revert
git push
\`\`\`

## Rehearsal Evidence
rehearsal_date: <YYYY-MM-DD HH:MM TZ>
rehearsal_sha_before: <sha>
rehearsal_revert_sha: <sha>
total_seconds_revert_to_redeploy_green: <int>
within_5_min_target: <yes | no>
notes: <freeform>
```

**Notes / what differs:**
- D-12's "5-minute target" is the SC#4 deliverable — the rehearsal evidence IS the audit artefact (Pitfall 19 "claim only what was rehearsed").
- Re-deploy step (Step 6) restores production state; without it the rehearsal leaves rules reverted.

---

### `firebase.json` (config, MODIFIED — declarations already present)

**Analog (exact):** the file's own existing `firestore` and `storage` declarations (lines 50-56). **Important finding:** these declarations are ALREADY PRESENT in `firebase.json`:
```json
"firestore": {
  "rules": "firestore.rules",
  "indexes": "firestore.indexes.json"
},
"storage": {
  "rules": "storage.rules"
}
```

**Notes / what differs:**
- The CONTEXT.md `<code_context>` Integration Points entry says "Wave 1 adds `firestore.rules` + `firestore.indexes.json` + `storage.rules` declarations". A line-by-line read of `firebase.json` shows they are already present (lines 50-56). The Wave 1 task collapses to: **verify existing declarations are correct → no change needed**. Planner should record this as a deviation / pre-resolved task in the Wave 1 plan.
- If the planner / CONTEXT author intended the path strings to be relative to a different layout (e.g., `functions/firestore.rules`), check `firestore.rules` and `storage.rules` exist at the repo root (they do — confirmed via `ls`). Verified.

---

### `functions/src/index.ts` (config / re-exports, MODIFIED)

**Analog (exact):** the file itself (lines 1-3 — read in full).

**Existing pattern** (current `functions/src/index.ts`):
```typescript
// Phase 3 (HOST-05, FN-10): CSP report sink. Phase 7 expands this file with
// App Check, Zod validation, per-function service accounts, and audit-log writers.
export { cspReportSink } from "./csp/cspReportSink.js";
```
For Phase 6 — append three new re-exports:
```typescript
// Phase 6 (AUTH-03 / AUTH-07): auth blocking + callable handlers. Phase 7
// expands this file with App Check, Zod validation, per-function service accounts.
export { cspReportSink } from "./csp/cspReportSink.js";
export { beforeUserCreatedHandler } from "./auth/beforeUserCreated.js";
export { beforeUserSignedInHandler } from "./auth/beforeUserSignedIn.js";
export { setClaims } from "./auth/setClaims.js";
```

**Notes / what differs:**
- Same `.js` extension on the import even though sources are `.ts` — consistent with the existing csp re-export.

---

### `src/firebase/auth.js` (adapter / per-feature submodule, MODIFIED)

**Analog:** the file itself (lines 1-48 — read in full) + `src/firebase/functions.js` (per-feature submodule shape) + `src/firebase/app.js` (eager init pattern).

**Existing placeholder pattern** (`src/firebase/auth.js` lines 33-47 — these are the bodies Phase 6 fills):
```javascript
// D-05 placeholder helpers — Phase 6 (AUTH-03 / AUTH-08) fills bodies.
/** @param {string} _email @param {string} _password */
export async function signInEmailPassword(_email, _password) {
  /* Phase 6 (AUTH-03) */
}

/** @returns {Promise<void>} */
export async function signOut() {
  /* Phase 6 (AUTH-03) */
}

/** @param {*} _user */
export function multiFactor(_user) {
  /* Phase 6 (AUTH-08) — TOTP enrol shape */
}
```
For Phase 6 — fill the bodies; AUTH-12 unified-error wrapper at this chokepoint per D-13:
```javascript
import { signInWithEmailAndPassword, signOut as fbSignOut, multiFactor as fbMultiFactor } from "firebase/auth";
import { auth } from "./app.js";

export class SignInError extends Error {
  constructor() { super("Email or password incorrect"); this.name = "SignInError"; }
}

const AUTH_CRED_ERROR_CODES = new Set([
  "auth/user-not-found",
  "auth/wrong-password",
  "auth/invalid-credential",
  "auth/too-many-requests",
  "auth/user-disabled",
  "auth/invalid-email",
]);

/** @param {string} email @param {string} password */
export async function signInEmailPassword(email, password) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (err && AUTH_CRED_ERROR_CODES.has(/** @type {*} */ (err).code)) {
      throw new SignInError(); // D-13: unified wording, no Firebase code leaks
    }
    throw err; // unexpected — let it bubble for observability
  }
}

/** @returns {Promise<void>} */
export async function signOut() {
  await fbSignOut(auth);
}

/** @param {*} user */
export function multiFactor(user) {
  return fbMultiFactor(user); // returns the MultiFactorUser instance for .enroll/.unenroll
}
```

**Deletion pattern** — D-04 deletes lines 5, 8, 20-30, 31:
```javascript
// DELETE line 5: import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
//   (replaced with named imports above)
// DELETE line 8: export { auth, onAuthStateChanged, signInAnonymously };
// DELETE lines 20-30: the onAuthStateChanged + window.FB.currentUser + dispatchEvent block
// DELETE line 31: signInAnonymously(auth).catch(...) call site
```
Replace with `onAuthStateChanged` re-export consumed directly by `views/auth.js` and `router.js` (D-03 narrative).

**Per-feature submodule analog** (`src/firebase/functions.js` lines 1-9 — clean shape to mirror; no init logic, just instance + helper exports):
```javascript
// src/firebase/functions.js
import { app } from "./app.js";
import { getFunctions, httpsCallable } from "firebase/functions";

export const functions = getFunctions(app);
export { httpsCallable };
```

**Notes / what differs:**
- D-13's `SignInError` class is the AUTH-12 chokepoint — single source of unified-error wording.
- Removing the `firebase-ready` `dispatchEvent` is load-bearing per D-03 (closes Phase 4 D-?? cleanup-ledger row). The replacement is `onAuthStateChanged` consumed directly by `router.js` route guards.

---

### `src/cloud/claims-admin.js` (adapter / callable client, MODIFIED)

**Analog:** the file itself (lines 1-16 — read in full) + `src/firebase/functions.js` (`httpsCallable` export pattern) + ARCHITECTURE.md §3 callable client convention.

**Existing stub** (`src/cloud/claims-admin.js` lines 1-16):
```javascript
// src/cloud/claims-admin.js
// Phase 4 Wave 3 (D-11): empty stub seam. Phase 6 (AUTH-07) replaces the body
// with httpsCallable("setClaims") wired through src/firebase/functions.js.

/**
 * @param {{ uid: string, role?: string, orgId?: string }} _input
 * @returns {Promise<void>}
 */
export async function setClaims(_input) {
  /* Phase 6 body lands here (AUTH-07) */
}
```
For Phase 6:
```javascript
import { functions, httpsCallable } from "../firebase/functions.js";

const setClaimsCallable = httpsCallable(functions, "setClaims");

/**
 * @param {{ uid: string, role?: string, orgId?: string }} input
 * @returns {Promise<void>}
 */
export async function setClaims(input) {
  await setClaimsCallable(input);
}
```

**Notes / what differs:**
- Boundary preserved: `cloud/*` imports `firebase/functions.js`, never `firebase/functions` SDK directly (per Phase 4 ESLint rule + ARCHITECTURE.md §2 dep matrix).
- No throw/catch — let server errors bubble up to the caller (the `views/admin.js` admin panel button); planner can decide whether to add a UI-level wrapper here or in the view.

---

### `src/router.js` (dispatcher, MODIFIED)

**Analog:** the file itself (lines 78-99 — read in full).

**Existing dispatcher pattern** (`src/router.js` lines 78-99):
```javascript
export function renderRoute(main, user, org, deps) {
  const isClient = deps.isClientView(user);

  const route = state.route;
  if (route === "dashboard") main.appendChild(deps.renderDashboard(user, org));
  else if (route === "diagnostic") main.appendChild(deps.renderDiagnosticIndex(user, org));
  // ... (10 more conditionals)
  else if (route === "admin" && !isClient) main.appendChild(deps.renderAdmin(user));
  else {
    state.route = "dashboard";
    main.appendChild(deps.renderDashboard(user, org));
  }
}
```
For Phase 6 — D-16's auth-state routes are checked BEFORE the existing route conditional ladder (auth-gating happens first):
```javascript
export function renderRoute(main, user, org, deps) {
  // Phase 6 (D-16): auth-state guards run first; existing route ladder only
  // reached for fully-authed + verified + MFA-enrolled sessions.
  if (!user) {
    main.appendChild(deps.renderSignIn());
    return;
  }
  if (!user.emailVerified) {
    main.appendChild(deps.renderEmailVerificationLanding());
    return;
  }
  if (user.firstRun) {
    main.appendChild(deps.renderFirstRun());
    return;
  }
  const role = user?.idTokenClaims?.role;
  const hasMfa = (user?.multiFactor?.enrolledFactors?.length ?? 0) > 0;
  if ((role === "admin" || role === "internal") && !hasMfa) {
    main.appendChild(deps.renderMfaEnrol());
    return;
  }

  // Existing route ladder unchanged from here ...
  const isClient = deps.isClientView(user);
  const route = state.route;
  if (route === "dashboard") main.appendChild(deps.renderDashboard(user, org));
  // ... etc.
}
```

**Notes / what differs:**
- The four new render fns (`renderSignIn` / `renderEmailVerificationLanding` / `renderFirstRun` / `renderMfaEnrol`) come from `views/auth.js` and are wired into `deps` by `main.js`.
- `RouteDispatchDeps` typedef (`router.js` lines 50-64) needs four new properties — extend, don't replace.

---

### `src/main.js` (entry, MODIFIED — delete-only)

**Analog:** the file itself (lines 625-633 + line 464 + line 3156 — already grep'd above).

**Existing pattern to delete** (`src/main.js` lines 625-633):
```javascript
// ---------- Hardcoded internal credentials ----------
// NOTE: this hash lives in a public repo. Treat as a light access gate,
// not real auth. Rotate the password if you suspect exposure.
const INTERNAL_ALLOWED_EMAILS = ["luke@bedeveloped.com", "george@bedeveloped.com"];
const INTERNAL_PASSWORD_HASH = "6110f27c9c91658c3489285abd5c45ffe5c1aa99c7f3f37d23e32834566e7fce";
function isAllowedInternalEmail(email) {
  const e = (email || "").trim().toLowerCase();
  return INTERNAL_ALLOWED_EMAILS.includes(e);
}
```
Plus three other call sites:
- Line 464: `const verifyInternalPassword = (pass) => auth.verifyInternalPassword(pass, { INTERNAL_PASSWORD_HASH });`
- Line 3156: `"Allowed emails: " + INTERNAL_ALLOWED_EMAILS.join(", "),`

**Notes / what differs:**
- D-04 says "AUTH-14 deletion is targeted at the constants only, not the broader IIFE" — the IIFE body stays in `main.js` pending the 4.1 sub-wave. So the cutover commit only deletes the 9-line block (lines 625-633) + the two call sites at lines 464 and 3156 + the `verifyInternalPassword` wrapper line.
- Touching the IIFE is risky for snapshot-baseline stability (Phase 4 D-12 / Wave 5 deviation precedent in `views/dashboard.js` lines 5-8). Planner should keep the deletion surgical.
- The line-3156 reference is in a UI string ("Allowed emails: ..." displayed somewhere) — its context determines what to replace it with (probably nothing; the auth view renders are taking over that responsibility).

---

### `.gitleaks.toml` (config, MODIFIED — delete-only)

**Analog:** the file itself (lines 8-14 — read in full).

**Existing pattern to delete** (lines 8-14):
```toml
[[rules]]
id = "sha256-hex-literal-regression"
description = "SHA-256 hex literal (64 chars) in source — regression check for C2 INTERNAL_PASSWORD_HASH pattern"
regex = '''(?i)(password|hash|secret|key|token|credential)[^=\n]{0,20}[=:]\s*["\']?[a-f0-9]{64}["\']?'''
secretGroup = 0
tags = ["custom", "c2-regression"]
severity = "CRITICAL"
```

**Notes / what differs:**
- D-04 says delete; cleanup-ledger row closes here.
- Discretion bullet allows keeping it for one milestone post-cutover as forensics protection — default per D-04 is delete; planner can argue otherwise.
- Keep the `[allowlist]` block (lines 16-37) — it covers other legitimate hex literals (Vitest snapshots + Firebase web apiKey) and is unrelated to the C2 rule.

---

### `SECURITY.md` (docs, MODIFIED — append per-phase increment)

**Analog (exact):** §Phase 5 Audit Index (lines 648-678 — read in full) and §Phase 3 Audit Index (lines 494-523 — read in full). Both follow the same `| Audit row | Control | Code path | Test | Framework |` table shape.

**Pattern excerpt** (§Phase 5 Audit Index header + first 3 rows from lines 648-668):
```markdown
## § Phase 5 Audit Index

This is a one-stop pointer for an auditor walking Phase 5's controls. Each row maps a Phase 5 control to (a) the SECURITY.md section + decision that defines it, (b) the code path that implements it, (c) the test that verifies it, and (d) the framework citations it addresses. Mirrors the Phase 3 Audit Index pattern; ...

| Audit row | Control | Code path | Test | Framework |
|-----------|---------|-----------|------|-----------|
| Subcollection data model | DATA-01..04 | `src/data/{responses,...}.js` | `tests/data/*.test.js` | ASVS V4.1.5 / ISO A.8.10 / SOC2 CC6.1 / GDPR Art 32(1)(b) |
| Migration script (one-shot) | DATA-04 / D-01 | `scripts/migrate-subcollections/run.js` | `tests/scripts/migrate-subcollections/*.test.js` | ASVS V14.5.1 / SOC2 CC8.1 |
| Idempotency markers | DATA-05 / D-02 / Pitfall 10 | `scripts/migrate-subcollections/process-doc.js` | `tests/scripts/migrate-subcollections/idempotency.test.js` | SOC2 CC7.4 |
```
For Phase 6:
```markdown
## § Authentication & Sessions
[Email/Password + custom claims {role, orgId} per ARCHITECTURE.md §7;
passwordPolicy ≥12 chars + HIBP per AUTH-04; AUTH-12 unified-error wrapper at
src/firebase/auth.js chokepoint (D-13); AUTH-13 progressive-delay reference
documents Firebase Auth defaults (D-21).]

## § Multi-Factor Authentication
[TOTP via Firebase Identity Platform per AUTH-08; AUTH-09 SUPERSEDED note
(email-link recovery rationale + tradeoff per D-07); AUTH-10 drill evidence
linking to runbooks/phase6-mfa-recovery-drill.md per D-08.]

## § Anonymous Auth Disabled
[Console-disable confirmation timestamp + source-removal commit SHA per D-04;
Pitfall 2 prevention narrative per D-03.]

## § Production Rules Deployment
[RULES-07 deploy SHA + 5-minute rollback procedure (D-12) + rehearsal timing
evidence linking to runbooks/phase6-rules-rollback-rehearsal.md.]

## § Phase 6 Audit Index

This is a one-stop pointer for an auditor walking Phase 6's controls. ...

| Audit row | Control | Code path | Test | Framework |
|-----------|---------|-----------|------|-----------|
| beforeUserCreated claims-set | AUTH-03 | `functions/src/auth/beforeUserCreated.ts` | `functions/test/auth/claim-builder.test.ts` | ASVS V2.4 / ISO A.5.17 / SOC2 CC6.1 |
| beforeUserSignedIn audit substrate | AUTH-03 / D-21 | `functions/src/auth/beforeUserSignedIn.ts` | (Phase 7 TEST-09 integration tests) | ASVS V2.5 / SOC2 CC6.7 |
| setClaims callable | AUTH-07 | `functions/src/auth/setClaims.ts` + `src/cloud/claims-admin.js` | (Phase 7 TEST-09) | ASVS V4.1.1 |
| TOTP MFA enrol | AUTH-08 / D-08 | `src/views/auth.js` renderMfaEnrol + `src/firebase/auth.js` multiFactor | `tests/views/auth.test.js` | ASVS V2.7 / ISO A.8.5 / SOC2 CC6.1 |
| Password policy ≥12 + HIBP | AUTH-04 | (Identity Platform server-side) | runbooks/phase6-cutover.md Step <N> manual smoke (D-21) | ASVS V2.1.1 / GDPR Art 32(1)(b) |
| AUTH-12 unified-error wrapper | AUTH-12 / D-13 | `src/firebase/auth.js` SignInError | `tests/firebase/auth.test.js` | ASVS V2.6 / OWASP Top 10 A07 |
| Anonymous Auth source removal | C1 / D-03 / D-04 | (deletion in cutover commit) | `git log --grep="signInAnonymously" main..HEAD` empty | (audit-narrative integrity) |
| RULES-07 production deploy | RULES-07 / D-11 | `firestore.rules` + `storage.rules` deployed | `git log --grep="firebase deploy --only firestore:rules"` shows exactly one Phase-6 invocation | ASVS V4 / SOC2 CC6.1 |
| 5-min rollback rehearsal | SC#4 / D-12 / Pitfall 19 | `runbooks/phase6-rules-rollback-rehearsal.md` | runbook §Rehearsal Evidence shows total_seconds < 300 | SOC2 CC9.1 / ISO A.5.30 |
| AUTH-10 MFA drill (Tier-2) | AUTH-10 / D-08 / Pitfall 7 | `runbooks/phase6-mfa-recovery-drill.md` | runbook §Drill Evidence Round 1 + Round 2 populated | ASVS V2.7.4 / SOC2 CC6.1 / Pitfall 19 |
| AUTH-14 source deletions | AUTH-14 / C2 / D-04 | (deletion in cutover commit) | `git log --diff-filter=D --name-only main..HEAD` shows state-machine.js | (audit-narrative integrity) |
| AUTH-09 supersession | AUTH-09 / D-07 | `.planning/REQUIREMENTS.md` AUTH-09 row | (REQUIREMENTS.md self-test) | (compliance-credible posture) |
```

**Cross-phase plug-ins block** (lines 672-678 of §Phase 5 Audit Index — same shape for Phase 6):
```markdown
**Cross-phase plug-ins this index will feed:**
- **Phase 7** (FN-01..09) — wires `auditLog/` Firestore-side writers from
  Cloud Logging back-fill; replaces `rateLimits/{uid}/buckets/{windowStart}`
  deny-block body; adds `enforceAppCheck: true` to `setClaims`.
- **Phase 8** (BACKUP-01..07 / GDPR-01..04) — backup automation + GDPR rights.
- **Phase 9** (AUDIT-05 / OBS-01..08) — view-side auditWrite wiring + Sentry +
  auth-anomaly alerts.
- **Phase 10** (HOST-06) — drops temporary CSP allowlist for Firebase Auth popups.
- **Phase 11** (DOC-04) — customises Firebase password-reset email sender domain.
```

**Notes / what differs:**
- 5 new sections + audit index per D-18 (matching SECURITY.md §-header existing convention `## § Section Name`).
- The Phase 6 Audit Index slots between §Phase 5 Audit Index and the existing §Compliance posture statement (line 681).

---

### `.planning/REQUIREMENTS.md` (docs, MODIFIED — annotation only)

**Analog:** trivial — append SUPERSEDED annotation to the existing AUTH-09 row.

**Pattern** (D-07 specifies the exact wording):
```markdown
| AUTH-09 | ~~10 hashed recovery codes generated at MFA enrolment~~ **SUPERSEDED 2026-05-08 by email-link recovery (Phase 6 D-07)**: no pre-generated recovery codes; Tier-1 recovery via `sendSignInLinkToEmail` + user self-service un-enrol/re-enrol. | Phase 6 | superseded |
```

**Notes / what differs:**
- One-line edit; planner should preserve the original requirement text under strikethrough so a reader can see what was removed.

---

## Shared Patterns

### Pattern A: 2nd-gen Cloud Function in europe-west2 with structured logging

**Source:** `functions/src/csp/cspReportSink.ts` lines 26-36 + lines 96-102.
**Apply to:** all 3 new functions in `functions/src/auth/*.ts`.

```typescript
import { onRequest } from "firebase-functions/v2/https"; // (or onCall, or beforeUserCreated, etc)
import { logger } from "firebase-functions/logger";

export const handlerName = onRequest(
  { region: "europe-west2", minInstances: /* 1 for blocking, default for callable */ },
  async (req, res) => {
    // ...
    logger.info("event.type", { /* structured object */ });
  },
);
```

### Pattern B: Pure-logic sibling helper as the unit-test seam

**Source:** `functions/src/csp/normalise.ts` (canonical interface + pure transform) and `filter.ts` (pure decision).
**Apply to:** `functions/src/auth/claim-builder.ts` (the test seam pattern that lets Phase 6 unit-test without `firebase-functions-test`, which is deferred to Phase 7).

```typescript
// PURE — no firebase-functions import. Safe for Vitest.
export interface CanonicalShape { /* ... */ }
export function transform(input: SomeInput | null): CanonicalShape { /* pure */ }
```

### Pattern C: Pattern D DI factory for `views/*`

**Source:** `src/views/admin.js` lines 1-34 + `src/views/dashboard.js` lines 1-44 + the existing placeholder body of `src/views/auth.js`.
**Apply to:** the expanded `src/views/auth.js`.

```javascript
import { h as defaultH } from "../ui/dom.js";

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 *   // additional view-specific deps go here ...
 * }} ViewDeps
 */

export function createXxxView(deps) {
  const h = deps.h || defaultH;
  return {
    renderXxx(...args) { /* uses h + deps */ },
  };
}

export function renderXxx(...args) { return createXxxView({}).renderXxx(...args); }
```

### Pattern D: Per-feature submodule in `src/firebase/*`

**Source:** `src/firebase/functions.js` lines 1-9 (cleanest example) + `src/firebase/app.js` lines 1-28 (eager init).
**Apply to:** filling `src/firebase/auth.js` body — keep the module shape (single instance + named helpers); do NOT add new files (per CONTEXT.md "Established Patterns").

### Pattern E: Admin SDK one-shot script

**Source:** `scripts/migrate-subcollections/run.js` lines 1-129 (header + ADC init + dry-run flag + per-step loop + `[OK]` / `[FAIL]` exit signaling).
**Apply to:** `scripts/seed-internal-allowlist/run.js` and `scripts/strip-legacy-id-fields.js`.

### Pattern F: Operator-deferred runbook with checklist + cutover-log + revert procedure

**Source:** `runbooks/hosting-cutover.md` lines 1-432 (Prerequisites + Pre-cutover Smoke + Cutover Steps + DNS Revert Procedure + Day-N Cleanup + Citations).
**Apply to:** `runbooks/phase6-cutover.md`, `runbooks/phase6-bootstrap.md`, `runbooks/phase6-mfa-recovery-drill.md`, `runbooks/phase6-rules-rollback-rehearsal.md` (varying subsets of the structure per runbook role).

### Pattern G: Per-phase audit index in SECURITY.md

**Source:** §Phase 5 Audit Index (lines 648-678) and §Phase 3 Audit Index (lines 494-523).
**Apply to:** Phase 6 §Audit Index (D-18). Use the exact `| Audit row | Control | Code path | Test | Framework |` table shape; close with the `**Cross-phase plug-ins this index will feed:**` block listing forward-looking entries for Phase 7/8/9/10/11.

### Pattern H: Cleanup-ledger close-and-queue at phase boundary

**Source:** `runbooks/phase-5-cleanup-ledger.md` (Phase 4 D-17 / Phase 5 D-21).
**Apply to:** Phase 6 Wave 6 closes 4 carry-forward rows (Phase 5 D-21 + Phase 4 `firebase-ready` bridge) and queues 4 new rows for Phase 7/9/10/11. Reference: CONTEXT.md D-17 enumerates the exact rows.

---

## No Analog Found

**None.** Every NEW and MODIFIED file has a strong analog in this codebase. The closest stretch is the auth blocking trigger imports (`firebase-functions/v2/identity`) — Firebase docs are the source-of-truth for the handler signature, but the surrounding deploy/region/logger/sibling-pure-helper conventions all transfer from `functions/src/csp/cspReportSink.ts`.

---

## Metadata

**Analog search scope:**
- `functions/src/**` (full — 5 files including `index.ts`)
- `functions/test/**` (full — 3 files)
- `src/firebase/**` (full — 6 files)
- `src/views/**` (representative read of 3 files; 13 files exist)
- `src/cloud/**` (representative read of 2 files; 5 files exist)
- `src/router.js`, `src/main.js` (targeted reads — line ranges around constants)
- `src/auth/state-machine.js` (full — to be deleted)
- `tests/views/**` (representative read of 3 files; 14 files exist)
- `tests/auth/**` (full — to be deleted)
- `tests/fixtures/auth-passwords.js` (full — to be deleted)
- `scripts/migrate-subcollections/**` (run.js read in full; siblings glob'd)
- `runbooks/hosting-cutover.md` (full read) + `runbooks/phase5-subcollection-migration.md` (header read)
- `firebase.json` (full read)
- `.gitleaks.toml` (full read)
- `SECURITY.md` (targeted reads on §Phase 3 + §Phase 5 Audit Index sections)
- `.planning/research/ARCHITECTURE.md` §2 (Module boundaries) + §3 (Cloud Functions) + §7 (Auth + claims flow)

**Files scanned:** ~30 directly + glob discovery on `functions/`, `src/`, `tests/`, `runbooks/`, `scripts/`.

**Pattern extraction date:** 2026-05-08
