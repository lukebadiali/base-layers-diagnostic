// tests/views/auth.test.js
// @ts-check
// Phase 6 Wave 3 (D-16 / BLOCKER-FIX D-07): contract + snapshot tests for the
// expanded src/views/auth.js Pattern D factory exporting renderSignIn,
// renderFirstRun, renderMfaEnrol, renderEmailVerificationLanding, renderForgotMfa.
// Tests-first per Phase 5 D-10 / Phase 2 D-15 — Task 1 lands these tests RED;
// Task 2 makes them GREEN by expanding src/views/auth.js.
import { describe, it, expect } from "vitest";
import {
  renderAuth,
  createAuthView,
  renderSignIn,
  renderFirstRun,
  renderMfaEnrol,
  renderMfaChallenge,
  renderEmailVerificationLanding,
  renderForgotMfa,
  renderForgotPassword,
} from "../../src/views/auth.js";

describe("src/views/auth.js — Phase 4 Wave 4 contract (carry-forward)", () => {
  it("exports createAuthView as a DI factory", () => {
    expect(typeof createAuthView).toBe("function");
  });
  it("createAuthView returns an object with the Pattern D shape", () => {
    const view = createAuthView({ h: () => document.createElement("div") });
    expect(view).toBeTruthy();
  });
});

describe("renderSignIn (Phase 6 D-16)", () => {
  it("exports renderSignIn as a function", () => {
    expect(typeof renderSignIn).toBe("function");
  });
  it("renders email + password inputs + submit button", () => {
    const view = createAuthView({});
    const el = view.renderSignIn();
    expect(el.querySelector('input[type="email"]')).toBeTruthy();
    expect(el.querySelector('input[type="password"]')).toBeTruthy();
    expect(el.querySelector('button[type="submit"]')).toBeTruthy();
  });
  it("matches the sign-in snapshot", async () => {
    const view = createAuthView({});
    const el = view.renderSignIn();
    document.body.innerHTML = "";
    document.body.appendChild(el);
    await expect(document.body.innerHTML).toMatchFileSnapshot(
      "../__snapshots__/views/auth-sign-in.html",
    );
  });
});

describe("renderSignIn — pending state on submit (tactile feedback)", () => {
  it("disables the submit button + shows a pending label while sign-in is in flight", () => {
    /** @type {() => void} */
    let resolveSignIn = () => {};
    const view = createAuthView({
      signInEmailPassword: () =>
        new Promise((res) => {
          resolveSignIn = res;
        }),
    });
    const el = view.renderSignIn();
    const form = /** @type {HTMLFormElement} */ (el.querySelector("form"));
    const submit = /** @type {HTMLButtonElement} */ (el.querySelector('button[type="submit"]'));

    expect(submit.disabled).toBe(false);
    expect(submit.textContent).toBe("Sign in");

    // The synchronous head of the async submit handler runs during dispatch,
    // before it awaits signInEmailPassword — so the pending state is visible
    // immediately, with no microtask flush.
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(submit.disabled).toBe(true);
    expect(submit.classList.contains("is-loading")).toBe(true);
    expect(submit.textContent).toBe("Signing in…");

    resolveSignIn(); // let the in-flight promise settle so no unhandled state lingers
  });

  it("clears the pending state after a failed sign-in so the user can retry", async () => {
    /** @type {(reason?: unknown) => void} */
    let rejectSignIn = () => {};
    const view = createAuthView({
      signInEmailPassword: () =>
        new Promise((_res, rej) => {
          rejectSignIn = rej;
        }),
      notify: () => {},
    });
    const el = view.renderSignIn();
    const form = /** @type {HTMLFormElement} */ (el.querySelector("form"));
    const submit = /** @type {HTMLButtonElement} */ (el.querySelector('button[type="submit"]'));

    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    // In flight: button is locked (fails on pre-implementation code).
    expect(submit.disabled).toBe(true);

    rejectSignIn(new Error("nope"));
    // Flush microtasks so the rejection, catch and reset all run.
    await Promise.resolve();
    await Promise.resolve();

    expect(submit.disabled).toBe(false);
    expect(submit.classList.contains("is-loading")).toBe(false);
    expect(submit.textContent).toBe("Sign in");
  });
});

describe("renderFirstRun (Phase 6 D-16)", () => {
  it("exports renderFirstRun as a function", () => {
    expect(typeof renderFirstRun).toBe("function");
  });
  it("renders newPassword + confirmPassword inputs + submit button", () => {
    const view = createAuthView({});
    const el = view.renderFirstRun();
    expect(el.querySelector('input[type="password"][name="newPassword"]')).toBeTruthy();
    expect(el.querySelector('input[type="password"][name="confirmPassword"]')).toBeTruthy();
    expect(el.querySelector('button[type="submit"]')).toBeTruthy();
  });
  it("uses the login-page hero+form layout", () => {
    const view = createAuthView({});
    const el = view.renderFirstRun();
    expect(el.classList.contains("auth-wrap")).toBe(true);
    expect(el.querySelector(".auth-hero")).toBeTruthy();
    expect(el.querySelector(".auth-form")).toBeTruthy();
  });
  it("matches the first-run snapshot", async () => {
    const view = createAuthView({});
    const el = view.renderFirstRun();
    document.body.innerHTML = "";
    document.body.appendChild(el);
    await expect(document.body.innerHTML).toMatchFileSnapshot(
      "../__snapshots__/views/auth-first-run.html",
    );
  });
});

describe("renderMfaEnrol (Phase 6 D-16)", () => {
  it("exports renderMfaEnrol as a function", () => {
    expect(typeof renderMfaEnrol).toBe("function");
  });
  it("renders QR-code img + verification-code input + submit button", () => {
    const view = createAuthView({});
    const el = view.renderMfaEnrol();
    expect(el.querySelector("img.qr-code")).toBeTruthy();
    expect(el.querySelector('input[name="verificationCode"]')).toBeTruthy();
    expect(el.querySelector('button[type="submit"]')).toBeTruthy();
  });
  it("renders an escape-hatch sign-out button", () => {
    const view = createAuthView({});
    const el = view.renderMfaEnrol();
    expect(el.querySelector("button.auth-sign-out-link")).toBeTruthy();
  });
  it("uses the login-page hero+form layout", () => {
    const view = createAuthView({});
    const el = view.renderMfaEnrol();
    expect(el.classList.contains("auth-wrap")).toBe(true);
    expect(el.querySelector(".auth-hero")).toBeTruthy();
    expect(el.querySelector(".auth-form")).toBeTruthy();
  });
  it("matches the mfa-enrol snapshot", async () => {
    const view = createAuthView({});
    const el = view.renderMfaEnrol();
    document.body.innerHTML = "";
    document.body.appendChild(el);
    await expect(document.body.innerHTML).toMatchFileSnapshot(
      "../__snapshots__/views/auth-mfa-enrol.html",
    );
  });
});

describe("renderMfaChallenge (Phase 6 follow-up — sign-in 2nd-factor prompt)", () => {
  it("exports renderMfaChallenge as a function", () => {
    expect(typeof renderMfaChallenge).toBe("function");
  });
  it("renders a single 6-digit verification code input + submit button", () => {
    const view = createAuthView({});
    const el = view.renderMfaChallenge();
    const input = /** @type {HTMLInputElement} */ (
      el.querySelector('input[name="verificationCode"]')
    );
    expect(input).toBeTruthy();
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("pattern")).toBe("[0-9]{6}");
    expect(input.getAttribute("autocomplete")).toBe("one-time-code");
    expect(el.querySelector('button[type="submit"]')).toBeTruthy();
  });
  it("uses the login-page hero+form layout", () => {
    const view = createAuthView({});
    const el = view.renderMfaChallenge();
    expect(el.classList.contains("auth-wrap")).toBe(true);
    expect(el.querySelector(".auth-hero")).toBeTruthy();
    expect(el.querySelector(".auth-form")).toBeTruthy();
  });
  it("offers a cancel button + a forgot-2FA link", () => {
    const view = createAuthView({});
    const el = view.renderMfaChallenge();
    expect(el.querySelector("button.auth-sign-out-link")).toBeTruthy();
    expect(el.querySelector("button.auth-forgot-mfa-link")).toBeTruthy();
  });
  it("submit calls deps.verifyMfaCode(deps.mfaResolver, code)", async () => {
    /** @type {Array<{ resolver: *, code: string }>} */
    const calls = [];
    const fakeResolver = { hints: [{ uid: "f1" }] };
    const view = createAuthView({
      mfaResolver: fakeResolver,
      verifyMfaCode: async (resolver, code) => {
        calls.push({ resolver, code });
      },
    });
    const el = view.renderMfaChallenge();
    const input = /** @type {HTMLInputElement} */ (
      el.querySelector('input[name="verificationCode"]')
    );
    input.value = "123456";
    const form = /** @type {HTMLFormElement} */ (el.querySelector("form"));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    // Microtask flush so the async submit handler completes.
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual([{ resolver: fakeResolver, code: "123456" }]);
  });
  it("cancel button calls deps.cancelMfaChallenge", () => {
    let called = false;
    const view = createAuthView({ cancelMfaChallenge: () => (called = true) });
    const el = view.renderMfaChallenge();
    /** @type {HTMLButtonElement} */ (el.querySelector("button.auth-sign-out-link")).click();
    expect(called).toBe(true);
  });
  it("matches the mfa-challenge snapshot", async () => {
    const view = createAuthView({});
    const el = view.renderMfaChallenge();
    document.body.innerHTML = "";
    document.body.appendChild(el);
    await expect(document.body.innerHTML).toMatchFileSnapshot(
      "../__snapshots__/views/auth-mfa-challenge.html",
    );
  });
});

describe("renderEmailVerificationLanding (Phase 6 D-16)", () => {
  it("exports renderEmailVerificationLanding as a function", () => {
    expect(typeof renderEmailVerificationLanding).toBe("function");
  });
  it("renders 'Check your email' text + resend button", () => {
    const view = createAuthView({});
    const el = view.renderEmailVerificationLanding();
    expect(el.textContent || "").toMatch(/check your email/i);
    expect(el.querySelector("button.resend-verification")).toBeTruthy();
  });
  it("renders an escape-hatch sign-out button", () => {
    const view = createAuthView({});
    const el = view.renderEmailVerificationLanding();
    expect(el.querySelector("button.auth-sign-out-link")).toBeTruthy();
  });
  it("matches the email-verification-landing snapshot", async () => {
    const view = createAuthView({});
    const el = view.renderEmailVerificationLanding();
    document.body.innerHTML = "";
    document.body.appendChild(el);
    await expect(document.body.innerHTML).toMatchFileSnapshot(
      "../__snapshots__/views/auth-email-verification-landing.html",
    );
  });
});

describe("renderForgotMfa (Phase 6 BLOCKER-FIX D-07 Tier-1 user-side recovery)", () => {
  it("exports renderForgotMfa as a function", () => {
    expect(typeof renderForgotMfa).toBe("function");
  });
  it("renders email input + send-link button + confirm-unenroll button", () => {
    const view = createAuthView({});
    const el = view.renderForgotMfa();
    expect(el.querySelector('input[type="email"][name="email"]')).toBeTruthy();
    expect(el.querySelector("button.send-mfa-recovery-link")).toBeTruthy();
    expect(el.querySelector("button.confirm-unenroll-mfa")).toBeTruthy();
    expect(el.textContent || "").toMatch(/lost.*authenticator|forgot.*2fa|email.*sign.?in.*link/i);
  });
  it("renders an escape-hatch back-to-sign-in button", () => {
    const view = createAuthView({});
    const el = view.renderForgotMfa();
    expect(el.querySelector("button.auth-back-to-signin")).toBeTruthy();
  });
  it("matches the forgot-mfa snapshot", async () => {
    const view = createAuthView({});
    const el = view.renderForgotMfa();
    document.body.innerHTML = "";
    document.body.appendChild(el);
    await expect(document.body.innerHTML).toMatchFileSnapshot(
      "../__snapshots__/views/auth-forgot-mfa.html",
    );
  });
});

describe("renderForgotPassword (login-page chrome for password reset)", () => {
  it("exports renderForgotPassword as a function", () => {
    expect(typeof renderForgotPassword).toBe("function");
  });
  it("uses the login-page hero+form layout", () => {
    const view = createAuthView({});
    const el = view.renderForgotPassword();
    expect(el.classList.contains("auth-wrap")).toBe(true);
    expect(el.querySelector(".auth-hero")).toBeTruthy();
    expect(el.querySelector(".auth-form")).toBeTruthy();
  });
  it("renders email input + reset-link submit + back-to-sign-in", () => {
    const view = createAuthView({});
    const el = view.renderForgotPassword();
    expect(el.querySelector('input[type="email"][name="email"]')).toBeTruthy();
    expect(el.querySelector("button.send-password-reset-link")).toBeTruthy();
    expect(el.querySelector("button.auth-back-to-signin")).toBeTruthy();
  });
  it("matches the forgot-password snapshot", async () => {
    const view = createAuthView({});
    const el = view.renderForgotPassword();
    document.body.innerHTML = "";
    document.body.appendChild(el);
    await expect(document.body.innerHTML).toMatchFileSnapshot(
      "../__snapshots__/views/auth-forgot-password.html",
    );
  });
});

describe("renderAuth (Phase 4 backward-compat alias for renderSignIn)", () => {
  it("renderAuth is callable and returns an HTMLElement", () => {
    expect(typeof renderAuth).toBe("function");
    const el = renderAuth();
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
