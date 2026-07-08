# Scope-Call UX Polish Implementation Plan (items 1, 2, 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stale auth error toasts no longer survive into the app after a successful Authenticator login; modal-driven actions and MFA QR generation get pending feedback; the mode toggle says "Client" instead of "Client preview".

**Architecture:** Three independent surgical changes: a `dismissAllToasts()` chokepoint call in the signed-in `onAuthStateChanged` branch; async-aware `promptText`/`confirmDialog` (backwards-compatible) plus a QR loading placeholder reusing the `.is-loading`/`auth-spin` spinner vocabulary; a one-word label change.

**Tech Stack:** Vanilla JS, `h()` DOM helper, existing `pendingButton` (src/ui/pending-button.js) + toast (src/ui/toast.js) substrates, Vitest + happy-dom (fake timers by default per tests/setup.js).

**Spec:** `docs/superpowers/specs/2026-07-06-scope-ux-polish-design.md`

## Global Constraints

- Conventional Commits; no emojis in commits or source.
- Branch `feat/scope-ux-polish` (stacked on `feat/client-readonly-diagnostic` / PR #80); commit directly to it, no new branches/worktrees.
- Pre-commit hook runs eslint/prettier (lint-staged) + gitleaks only; eslint runs with `--max-warnings=0`.
- Do NOT run the full `npm run test` in tasks (documented parallel-suite flake); run the named test files in isolation.
- Repo has unrelated untracked files — stage ONLY files named in each task's commit step; never `git add -A` / `git add .`.
- Line numbers cited below may drift a few lines — locate code by quoted content.

---

### Task 1: Dismiss stale toasts at the signed-in chokepoint (scope item 1)

**Files:**
- Modify: `src/ui/toast.js` (add export after `notify`)
- Modify: `src/main.js` — the `fbOnAuthStateChanged` callback (~line 3965) and the toast import site
- Test: `tests/ui/toast.test.js` (extend)

**Interfaces:**
- Produces: `dismissAllToasts(): void` exported from `src/ui/toast.js` (Task 2 does not use it; no cross-task deps).

- [ ] **Step 1: Write the failing tests**

Append to `tests/ui/toast.test.js` (note the import at the top of the file must become `import { notify, dismissAllToasts } from "../../src/ui/toast.js";`):

```js
describe("dismissAllToasts() — auth-transition clear (scope item 1, 2026-07)", () => {
  it("removes every visible toast, including sticky errors", () => {
    notify("error", "Invalid verification code");
    notify("info", "hello");
    expect(document.querySelectorAll(".toast").length).toBe(2);
    dismissAllToasts();
    expect(document.querySelectorAll(".toast").length).toBe(0);
  });

  it("is a no-op when no toast container exists", () => {
    expect(document.getElementById("toastRoot")).toBeNull();
    expect(() => dismissAllToasts()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/toast.test.js`
Expected: FAIL — `dismissAllToasts` is not exported (SyntaxError/undefined import).

- [ ] **Step 3: Implement toast.js**

Append to `src/ui/toast.js`:

```js
/**
 * Remove every visible toast. Called at the successful-sign-in chokepoint
 * (src/main.js onAuthStateChanged, signed-in branch) so sticky auth-flow
 * errors ("Invalid verification code" after a TOTP retry) don't survive
 * into the app render. D-14 in-app stickiness is unchanged — auth-state
 * transitions are the only caller.
 */
export function dismissAllToasts() {
  const root = document.getElementById("toastRoot");
  if (root) root.replaceChildren();
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/ui/toast.test.js`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Wire the chokepoint in main.js**

Find the toast import in `src/main.js` (search `from "./ui/toast.js"`) and add `dismissAllToasts` to it.

In the `fbOnAuthStateChanged(fbAuthInstance, async (fbUser) => {` callback (~line 3965), directly AFTER the `if (!fbUser) { ... return; }` block and BEFORE the 30-day session-cap check, insert:

```js
    // Scope item 1 (2026-07): sticky auth-flow error toasts ("Invalid
    // verification code" from a TOTP retry) otherwise survive the successful
    // sign-in into the app render — #toastRoot lives on <body>, outside the
    // #app re-render, and D-14 makes errors persist until closed. Clear them
    // the moment sign-in lands. Signed-in branch ONLY: the session-expiry
    // path below notifies right before signOut() re-fires this callback with
    // null, and that message must survive.
    dismissAllToasts();
```

Placement matters: before the session-cap check, so the "session has expired" toast raised by that path is not wiped (it is raised after this line runs).

- [ ] **Step 6: Verify main.js still lints/typechecks + boots**

Run: `npm run lint` → clean. `npx vitest run tests/views/diagnostic.test.js` → PASS (proves main.js still boots under the test harness).
(Typecheck note: `npm run typecheck` fails on the pre-existing untracked `scripts/bootstrap-admin/run.js` — branch files must introduce NO new errors; confirm the only error remains that file.)

- [ ] **Step 7: Commit**

```bash
git add src/ui/toast.js src/main.js tests/ui/toast.test.js
git commit -m "fix(auth): clear stale sticky toasts when sign-in lands

A failed TOTP attempt leaves a sticky 'Invalid verification code' error
toast that survived the successful retry into the app (toastRoot lives on
body, outside the app re-render). Dismiss all toasts in the signed-in
onAuthStateChanged branch; the signed-out branch is untouched so the
session-expiry notice still shows.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Pending feedback — async modals + MFA QR placeholder (scope item 2)

**Files:**
- Modify: `src/ui/modal.js` (async-aware `promptText` + `confirmDialog`)
- Modify: `src/views/auth.js` — QR block in `renderMfaEnrol` (~line 233)
- Modify: `styles.css` — after the `.auth-mfa-enrol .qr-code` rule (~line 3808)
- Test: `tests/ui/modal.test.js` (extend), `tests/views/auth-mfa.test.js` if it exists — otherwise assert the QR placeholder via a NEW small test file `tests/ui/qr-loading.test.js` is NOT needed; instead extend the existing auth view test if present. Check `ls tests/views/` and `ls tests/auth/` first; if no auth view test exists, cover the placeholder branch with a direct `createAuthView` unit test appended to `tests/ui/modal.test.js`'s sibling NEW file `tests/views/mfa-enrol-qr.test.js` (code below).

**Interfaces:**
- Consumes: `pendingButton` from `src/ui/pending-button.js` (`{start, stop}` contract); `notify` from `src/ui/toast.js`.
- Produces: `promptText(title, placeholder, onSubmit, initial?)` and `confirmDialog(title, message, onOk, okLabel?)` — signatures UNCHANGED; new behavior: a thenable return from `onSubmit`/`onOk` keeps the modal open with a pending spinner until settled (close on resolve; stay open + error toast on reject). Sync returns behave exactly as today.

- [ ] **Step 1: Write the failing modal tests**

Append to `tests/ui/modal.test.js` (fake timers are default; promises need `await vi.runAllTimersAsync()` or manual resolution — use direct promise control as below):

```js
describe("promptText() — async onSubmit (scope item 2, 2026-07)", () => {
  it("keeps the modal open with a pending Save while the promise is in flight, closes on resolve", async () => {
    /** @type {(v?: *) => void} */
    let resolveAction = () => {};
    promptText("Title", "ph", () => new Promise((res) => (resolveAction = res)));
    const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
    const input = /** @type {HTMLInputElement} */ (root.querySelector("input"));
    input.value = "v";
    const buttons = Array.from(root.querySelectorAll("button"));
    const ok = /** @type {HTMLButtonElement} */ (buttons.find((b) => b.textContent?.includes("Save")));
    const cancel = /** @type {HTMLButtonElement} */ (buttons.find((b) => b.textContent === "Cancel"));
    ok.click();
    expect(root.classList.contains("hidden")).toBe(false);
    expect(ok.classList.contains("is-loading")).toBe(true);
    expect(ok.disabled).toBe(true);
    expect(cancel.disabled).toBe(true);
    resolveAction();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.classList.contains("hidden")).toBe(true);
  });

  it("on reject: stays open, restores the buttons, raises an error toast", async () => {
    /** @type {(e: Error) => void} */
    let rejectAction = () => {};
    promptText("Title", "ph", () => new Promise((_res, rej) => (rejectAction = rej)));
    const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
    const input = /** @type {HTMLInputElement} */ (root.querySelector("input"));
    input.value = "v";
    const ok = /** @type {HTMLButtonElement} */ (
      Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.includes("Save"))
    );
    ok.click();
    rejectAction(new Error("cloud says no"));
    await Promise.resolve();
    await Promise.resolve();
    expect(root.classList.contains("hidden")).toBe(false);
    expect(ok.disabled).toBe(false);
    expect(ok.classList.contains("is-loading")).toBe(false);
    expect(document.querySelector(".toast-error")?.textContent).toContain("cloud says no");
  });

  it("sync onSubmit still closes immediately (regression)", () => {
    let got = "";
    promptText("Title", "ph", (v) => {
      got = v;
    });
    const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
    const input = /** @type {HTMLInputElement} */ (root.querySelector("input"));
    input.value = "x";
    /** @type {HTMLButtonElement} */ (
      Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.includes("Save"))
    ).click();
    expect(got).toBe("x");
    expect(root.classList.contains("hidden")).toBe(true);
  });
});

describe("confirmDialog() — async onOk (scope item 2, 2026-07)", () => {
  it("pending Confirm during in-flight promise, closes on resolve", async () => {
    /** @type {(v?: *) => void} */
    let resolveAction = () => {};
    confirmDialog("T", "m", () => new Promise((res) => (resolveAction = res)));
    const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
    const ok = /** @type {HTMLButtonElement} */ (
      Array.from(root.querySelectorAll("button")).find((b) => b.textContent?.includes("Confirm"))
    );
    ok.click();
    expect(root.classList.contains("hidden")).toBe(false);
    expect(ok.classList.contains("is-loading")).toBe(true);
    resolveAction();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.classList.contains("hidden")).toBe(true);
  });
});
```

Note the toast assertion: `tests/ui/modal.test.js`'s `beforeEach` sets `document.body.innerHTML = '<div id="modalRoot"></div>'` which also clears any `#toastRoot` — no cross-test leakage.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/modal.test.js`
Expected: FAIL — modal closes immediately on click (async cases), no `is-loading` class, no toast.

- [ ] **Step 3: Implement modal.js**

In `src/ui/modal.js`, add imports after the existing `h` import:

```js
import { pendingButton } from "./pending-button.js";
import { notify } from "./toast.js";
```

Add the shared dispatcher (above `promptText`):

```js
/**
 * Async-aware dispatch for modal confirm buttons. Sync callbacks (returning
 * undefined) close immediately — the original contract. A thenable return
 * keeps the modal open with a pending spinner (shared pendingButton
 * vocabulary) until it settles: close on resolve; on reject stay open,
 * restore the buttons and surface the error as a toast so the user can
 * retry or cancel. Scope item 2 (2026-07): gives slow Cloud-Function-backed
 * actions visible feedback instead of an instantly-closing modal.
 *
 * @param {HTMLButtonElement} okBtn
 * @param {HTMLButtonElement} cancelBtn
 * @param {string} pendingLabel
 * @param {() => *} action
 * @param {() => void} close
 */
function runModalAction(okBtn, cancelBtn, pendingLabel, action, close) {
  let result;
  try {
    result = action();
  } catch (err) {
    notify("error", (err && /** @type {*} */ (err).message) || "Action failed");
    return;
  }
  if (!result || typeof result.then !== "function") {
    close();
    return;
  }
  const pending = pendingButton(okBtn, pendingLabel);
  pending.start();
  cancelBtn.disabled = true;
  result.then(
    () => close(),
    (/** @type {*} */ err) => {
      pending.stop();
      cancelBtn.disabled = false;
      notify("error", (err && err.message) || "Action failed");
    },
  );
}
```

Rewrite `promptText`'s buttons to route through it (only the `cancel`/`ok` declarations and the ok onclick change):

```js
export function promptText(title, placeholder, onSubmit, initial = "") {
  const input = /** @type {HTMLInputElement} */ (h("input", { type: "text", placeholder }));
  input.value = initial;
  const cancel = /** @type {HTMLButtonElement} */ (
    h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel")
  );
  const ok = /** @type {HTMLButtonElement} */ (
    h(
      "button",
      {
        class: "btn",
        onclick: () => {
          const v = input.value.trim();
          if (!v) return;
          runModalAction(ok, cancel, "Saving…", () => onSubmit(v), () => m.close());
        },
      },
      "Save",
    )
  );
  input.addEventListener("keydown", (e) => {
    if (/** @type {KeyboardEvent} */ (e).key === "Enter") /** @type {HTMLButtonElement} */ (ok).click();
  });
  const m = modal([h("h3", {}, title), input, h("div", { class: "row" }, [cancel, ok])]);
  setTimeout(() => input.focus(), 10);
}
```

And `confirmDialog`:

```js
export function confirmDialog(title, message, onOk, okLabel = "Confirm") {
  const cancel = /** @type {HTMLButtonElement} */ (
    h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel")
  );
  const ok = /** @type {HTMLButtonElement} */ (
    h(
      "button",
      {
        class: "btn",
        onclick: () => runModalAction(ok, cancel, "Working…", onOk, () => m.close()),
      },
      okLabel,
    )
  );
  const m = modal([
    h("h3", {}, title),
    h("p", { style: "color: var(--ink-2); font-size: 14px;" }, message),
    h("div", { class: "row" }, [cancel, ok]),
  ]);
}
```

Also update the JSDoc on both exports: `@param {(value: string) => (void|Promise<*>)} onSubmit` and `@param {() => (void|Promise<*>)} onOk`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/ui/modal.test.js`
Expected: PASS (existing + 4 new).

- [ ] **Step 5: QR placeholder — failing test first**

Check for an existing auth view test: `ls tests/views/`. If none covers `renderMfaEnrol`, create `tests/views/mfa-enrol-qr.test.js`:

```js
// tests/views/mfa-enrol-qr.test.js
// @ts-check
// Scope item 2 (2026-07): while the TOTP secret + QR data-URL are being
// generated, renderMfaEnrol shows a visible loading placeholder instead of
// an empty broken <img>. Unit-level: drive createAuthView directly.
import { describe, it, expect, beforeEach } from "vitest";
import { createAuthView } from "../../src/views/auth.js";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("renderMfaEnrol QR loading state", () => {
  it("shows the generating placeholder when qrcodeDataUrl is empty", () => {
    const view = createAuthView({ qrcodeDataUrl: "" });
    const el = view.renderMfaEnrol();
    expect(el.querySelector("img.qr-code")).toBeNull();
    const placeholder = el.querySelector(".qr-code-loading");
    expect(placeholder).not.toBeNull();
    expect(placeholder?.getAttribute("role")).toBe("status");
    expect(placeholder?.textContent).toContain("Generating QR code");
  });

  it("shows the QR image once the data URL exists", () => {
    const view = createAuthView({ qrcodeDataUrl: "data:image/png;base64,AAAA" });
    const el = view.renderMfaEnrol();
    const img = /** @type {HTMLImageElement|null} */ (el.querySelector("img.qr-code"));
    expect(img).not.toBeNull();
    expect(img?.src).toContain("data:image/png");
    expect(el.querySelector(".qr-code-loading")).toBeNull();
  });
});
```

CAUTION: check how `createAuthView` exposes render functions (read the return statement at the bottom of src/views/auth.js). If `renderMfaEnrol` is not directly exported/returned, adapt the test to the actual surface (e.g. the view's dispatcher with a route/state stub) — the assertions stay the same. If adaptation requires more than trivial changes, report DONE_WITH_CONCERNS with what you found.

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run tests/views/mfa-enrol-qr.test.js`
Expected: FAIL — no `.qr-code-loading` element (empty img renders instead).

- [ ] **Step 7: Implement the placeholder**

In `src/views/auth.js` `renderMfaEnrol` (~line 233), replace:

```js
    const qr = h("img", { class: "qr-code", alt: "TOTP enrolment QR code" });
    if (deps.qrcodeDataUrl) /** @type {HTMLImageElement} */ (qr).src = deps.qrcodeDataUrl;
    formSide.appendChild(qr);
```

with:

```js
    // Scope item 2 (2026-07): the QR data-URL arrives async (Firebase secret
    // round-trip + dynamic qrcode import in main.js startMfaEnrolFlow). Show
    // a same-size loading placeholder instead of an empty <img>; the render()
    // on completion swaps the real QR in.
    if (deps.qrcodeDataUrl) {
      const qr = h("img", { class: "qr-code", alt: "TOTP enrolment QR code" });
      /** @type {HTMLImageElement} */ (qr).src = deps.qrcodeDataUrl;
      formSide.appendChild(qr);
    } else {
      formSide.appendChild(
        h("div", { class: "qr-code qr-code-loading", role: "status" }, [
          h("span", { class: "qr-spinner", "aria-hidden": "true" }),
          h("span", {}, "Generating QR code…"),
        ]),
      );
    }
```

In `styles.css`, insert directly after the `.auth-mfa-enrol .qr-code { ... }` rule (~line 3808-3817):

```css
/* Loading placeholder while main.js generates the TOTP secret + QR data-URL
   (scope item 2, 2026-07). Same box as .qr-code so the layout doesn't jump;
   spinner reuses the auth-spin keyframes from the pending-button contract. */
.auth-mfa-enrol .qr-code-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--ink-3);
  font-size: 13px;
}
.auth-mfa-enrol .qr-code-loading .qr-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: auth-spin 0.7s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .auth-mfa-enrol .qr-code-loading .qr-spinner {
    animation-duration: 1.6s;
  }
}
```

(`auth-spin` keyframes already exist at ~styles.css:1809 — do not redefine.)

- [ ] **Step 8: Run to verify pass**

Run: `npx vitest run tests/views/mfa-enrol-qr.test.js tests/ui/modal.test.js`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/ui/modal.js src/views/auth.js styles.css tests/ui/modal.test.js tests/views/mfa-enrol-qr.test.js
git commit -m "feat(ui): pending feedback for modal actions and MFA QR generation

promptText/confirmDialog now support async callbacks: thenable returns keep
the modal open with the shared pendingButton spinner until settled (close on
resolve; stay open + error toast on reject). Sync callbacks unchanged. The
MFA enrol screen shows a generating placeholder instead of an empty img
while the TOTP secret + QR data-URL are produced.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Rename "Client preview" → "Client" (scope item 6)

**Files:**
- Modify: `src/ui/chrome.js:147`
- Test: `tests/ui/chrome.test.js` (extend)

**Interfaces:** none.

- [ ] **Step 1: Write the failing test**

In `tests/ui/chrome.test.js`, find the `describe("renderTopbar() — client user"` block and append AFTER that block (reuse the file's existing `makeDeps` helper; check how it carries `state` — the deps stub must set `state.mode = "external"` for the first assertion, and the existing internal-user test shows the pattern):

```js
describe("renderTopbar() — mode toggle label (scope item 6, 2026-07)", () => {
  it('says "Client" (not "Client preview") when mode is external', () => {
    const deps = makeDeps();
    deps.state.mode = "external";
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const label = el.querySelector(".mode-toggle span");
    expect(label?.textContent).toBe("Client");
  });

  it('says "Internal" when mode is internal', () => {
    const deps = makeDeps();
    deps.state.mode = "internal";
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const label = el.querySelector(".mode-toggle span");
    expect(label?.textContent).toBe("Internal");
  });
});
```

CAUTION: read `makeDeps` first — if `state` is not a property of the returned deps object, adapt (e.g. `makeDeps({ mode: "external" })` or construct deps inline following the file's conventions). The client-cannot-see-the-toggle gate is already asserted by the existing "does NOT render the mode toggle" test — do not duplicate it.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/chrome.test.js`
Expected: FAIL — label reads "Client preview".

- [ ] **Step 3: Implement**

`src/ui/chrome.js:147`:

```js
          h("span", {}, state.mode === "internal" ? "Internal" : "Client"),
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/ui/chrome.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/chrome.js tests/ui/chrome.test.js
git commit -m "feat(ui): shorten mode-toggle label to Client

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Verification + stacked PR

- [ ] **Step 1: Local gate**

```bash
npm run lint
npx vitest run tests/ui/ tests/views/
```
Expected: lint clean; all files pass in isolation. `npm run typecheck`: the ONLY error allowed is the pre-existing untracked `scripts/bootstrap-admin/run.js`.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/scope-ux-polish
gh pr create --base feat/client-readonly-diagnostic --title "feat: scope-call UX polish — stale auth toast, pending spinners, Client label" --body "..."
```

Stacked on PR #80's branch. If #80 has merged by the time this runs, use `--base main` instead and rebase onto origin/main first. Body should list scope items 1/2/6, root cause of item 1, and the test evidence; end with the standard generation footer. Request review from lukebadiali.

---

## Self-Review (done at plan time)

- Spec coverage: item 1 (Task 1), 2a modals (Task 2 Steps 1-4), 2b QR (Task 2 Steps 5-8), item 6 (Task 3), gate+PR (Task 4). ✓
- Placeholders: none — full code in every step; two CAUTION blocks direct the implementer to verify assumptions about test-file internals (`createAuthView` surface, `makeDeps` shape) rather than guess. ✓
- Type consistency: `runModalAction(okBtn, cancelBtn, pendingLabel, action, close)` used identically in both call sites; `dismissAllToasts()` no-arg in test and wiring; `pendingButton(btn, label) → {start, stop}` matches src/ui/pending-button.js. ✓
