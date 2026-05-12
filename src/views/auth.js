// src/views/auth.js
// @ts-check
// Phase 6 Wave 3 (D-16 / D-13 / D-14): expanded Pattern D DI factory housing
// the entire Phase 6 client UI surface - sign-in, forced password change,
// MFA enrol, email verification landing, forgot-MFA Tier-1 recovery (D-07).
//
// Boundary: views/* never imports firebase/* directly (Phase 4 ESLint rule).
// Auth functions (signInEmailPassword, multiFactor, sendEmailVerification, ...)
// reach this view via the deps object - main.js / router.js populate them
// from src/firebase/auth.js.
//
// Phase 4 carry-forward: renderAuth is preserved as a backward-compat alias
// for renderSignIn so existing callers do not break during the Wave 5 cutover.
import { h as defaultH } from "../ui/dom.js";

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 *   notify?: (level: string, msg: string) => void,
 *   signInEmailPassword?: (email: string, password: string) => Promise<*>,
 *   signOut?: () => Promise<void>,
 *   updatePassword?: (newPassword: string) => Promise<void>,
 *   enrollTotp?: (verificationCode: string) => Promise<void>,
 *   qrcodeDataUrl?: string,
 *   currentUser?: *,
 *   sendEmailVerification?: (user: *) => Promise<void>,
 *   sendSignInLinkToEmail?: (email: string, settings: *) => Promise<void>,
 *   sendPasswordResetEmail?: (email: string) => Promise<void>,
 *   unenrollAllMfa?: () => Promise<void>,
 *   isMfaRecoveryFlow?: boolean,
 *   routeToForgotMfa?: () => void,
 *   routeToMfaEnrol?: () => void,
 * }} AuthDeps
 */

/**
 * Pattern D DI factory - returns the 5 Phase 6 render functions.
 * @param {AuthDeps} deps
 */
export function createAuthView(deps) {
  const h = deps.h || defaultH;
  const notify = deps.notify || ((/** @type {string} */ _l, /** @type {string} */ _m) => {});

  function renderSignIn() {
    const wrap = h("div", { class: "auth-sign-in" });
    wrap.appendChild(h("h2", { class: "auth-heading" }, "Internal sign-in"));
    wrap.appendChild(
      h("p", { class: "auth-sub" }, "Sign in with your BeDeveloped email and password."),
    );

    const form = h("form", { method: "post" });
    const email = h("input", {
      type: "email",
      name: "email",
      required: "",
      autocomplete: "username",
      placeholder: "you@bedeveloped.com",
    });
    const password = h("input", {
      type: "password",
      name: "password",
      required: "",
      autocomplete: "current-password",
      placeholder: "Your password",
    });

    form.appendChild(h("div", { class: "auth-field" }, [h("label", {}, "Email"), email]));
    form.appendChild(h("div", { class: "auth-field" }, [h("label", {}, "Password"), password]));

    const submit = h("button", { type: "submit", class: "auth-submit" }, "Sign in");
    form.appendChild(submit);

    form.addEventListener("submit", async (/** @type {Event} */ e) => {
      e.preventDefault();
      const emailVal = /** @type {HTMLInputElement} */ (email).value;
      const passVal = /** @type {HTMLInputElement} */ (password).value;
      try {
        if (deps.signInEmailPassword) await deps.signInEmailPassword(emailVal, passVal);
      } catch (err) {
        notify("error", (err && /** @type {*} */ (err).message) || "Sign-in failed");
      }
    });
    wrap.appendChild(form);

    const reset = h("button", { type: "button", class: "auth-reset-link" }, "Forgot password?");
    const forgotMfa = h("button", { type: "button", class: "auth-forgot-mfa-link" }, "Forgot 2FA?");
    reset.addEventListener("click", async () => {
      const emailVal = /** @type {HTMLInputElement} */ (email).value;
      try {
        if (deps.sendPasswordResetEmail && emailVal) await deps.sendPasswordResetEmail(emailVal);
      } catch (_err) {
        /* swallow - D-15 generic-success */
      }
      notify(
        "info",
        "If that account exists, you will receive a reset email shortly. Please check your inbox.",
      );
    });
    forgotMfa.addEventListener("click", () => {
      if (deps.routeToForgotMfa) deps.routeToForgotMfa();
    });
    wrap.appendChild(
      h("div", { class: "auth-help" }, [
        reset,
        h("span", { class: "auth-help-sep" }, " · "),
        forgotMfa,
      ]),
    );

    return wrap;
  }

  function renderFirstRun() {
    const wrap = h("div", { class: "auth-wrap auth-first-run" });
    wrap.appendChild(
      h(
        "p",
        {},
        "Set a new password to continue. Minimum 12 characters; passwords reused on other sites are rejected.",
      ),
    );
    const form = h("form", { class: "auth-form", method: "post" });
    const newPass = h("input", {
      type: "password",
      name: "newPassword",
      required: "",
      autocomplete: "new-password",
      placeholder: "New password (>= 12 chars)",
    });
    const confirm = h("input", {
      type: "password",
      name: "confirmPassword",
      required: "",
      autocomplete: "new-password",
      placeholder: "Confirm new password",
    });
    const submit = h("button", { type: "submit" }, "Set password");
    form.appendChild(newPass);
    form.appendChild(confirm);
    form.appendChild(submit);
    form.addEventListener("submit", async (/** @type {Event} */ e) => {
      e.preventDefault();
      const a = /** @type {HTMLInputElement} */ (newPass).value;
      const b = /** @type {HTMLInputElement} */ (confirm).value;
      if (a !== b) {
        notify("error", "Passwords do not match");
        return;
      }
      try {
        if (deps.updatePassword) await deps.updatePassword(a);
      } catch (err) {
        notify("error", (err && /** @type {*} */ (err).message) || "Password update failed");
      }
    });
    wrap.appendChild(form);
    // Phase 6 Wave 5 cutover-recovery (2026-05-09): escape hatch on the
    // firstRun screen for cases where the post-password setClaims wiring
    // hasn't flipped firstRun:true → false yet (BLOCKER-FIX 1 carry-forward).
    // Without this, an admin who lands here after a stale session has no UI
    // path off the screen.
    const signOutBtn = h("button", { type: "button", class: "auth-sign-out-link" }, "Sign out");
    signOutBtn.addEventListener("click", async () => {
      try {
        if (deps.signOut) await deps.signOut();
      } catch (err) {
        notify("error", (err && /** @type {*} */ (err).message) || "Sign out failed");
      }
    });
    wrap.appendChild(signOutBtn);
    return wrap;
  }

  function renderMfaEnrol() {
    const wrap = h("div", { class: "auth-wrap auth-mfa-enrol" });
    wrap.appendChild(h("h2", {}, "Enrol two-factor authentication"));
    wrap.appendChild(
      h(
        "p",
        {},
        "Scan the QR code with your authenticator app (Google Authenticator, 1Password, Authy).",
      ),
    );
    const qr = h("img", { class: "qr-code", alt: "TOTP enrolment QR code" });
    if (deps.qrcodeDataUrl) /** @type {HTMLImageElement} */ (qr).src = deps.qrcodeDataUrl;
    wrap.appendChild(qr);
    const form = h("form", { class: "auth-form", method: "post" });
    const code = h("input", {
      type: "text",
      name: "verificationCode",
      required: "",
      inputmode: "numeric",
      pattern: "[0-9]{6}",
      placeholder: "6-digit code",
    });
    const submit = h("button", { type: "submit" }, "Verify");
    form.appendChild(code);
    form.appendChild(submit);
    form.addEventListener("submit", async (/** @type {Event} */ e) => {
      e.preventDefault();
      const codeVal = /** @type {HTMLInputElement} */ (code).value;
      try {
        if (deps.enrollTotp) await deps.enrollTotp(codeVal);
      } catch (err) {
        notify("error", (err && /** @type {*} */ (err).message) || "Verification failed");
      }
    });
    wrap.appendChild(form);
    // Escape hatch: mirrors renderFirstRun's auth-sign-out-link pattern. Without
    // this, an admin forced through the MFA-enrol gate has no way off the screen
    // if their authenticator is lost or the QR fails to render.
    const signOutBtn = h("button", { type: "button", class: "auth-sign-out-link" }, "Sign out");
    signOutBtn.addEventListener("click", async () => {
      try {
        if (deps.signOut) await deps.signOut();
      } catch (err) {
        notify("error", (err && /** @type {*} */ (err).message) || "Sign out failed");
      }
    });
    wrap.appendChild(signOutBtn);
    return wrap;
  }

  function renderEmailVerificationLanding() {
    const wrap = h("div", { class: "auth-wrap auth-email-verification" });
    wrap.appendChild(h("h2", {}, "Check your email"));
    wrap.appendChild(
      h("p", {}, "We have sent a verification link to your inbox. Click the link to continue."),
    );
    const resend = h(
      "button",
      { type: "button", class: "resend-verification" },
      "Resend verification email",
    );
    resend.addEventListener("click", async () => {
      try {
        if (deps.sendEmailVerification && deps.currentUser)
          await deps.sendEmailVerification(deps.currentUser);
        notify("info", "Verification email resent.");
      } catch (_err) {
        notify("error", "Failed to resend verification email.");
      }
    });
    wrap.appendChild(resend);
    // Escape hatch: same pattern as renderFirstRun / renderMfaEnrol. Without
    // this, a user whose email-verification flow stalls (wrong inbox, link
    // expired, gmail filtering) has no UI path off the screen.
    const signOutBtn = h("button", { type: "button", class: "auth-sign-out-link" }, "Sign out");
    signOutBtn.addEventListener("click", async () => {
      try {
        if (deps.signOut) await deps.signOut();
      } catch (err) {
        notify("error", (err && /** @type {*} */ (err).message) || "Sign out failed");
      }
    });
    wrap.appendChild(signOutBtn);
    return wrap;
  }

  function renderForgotMfa() {
    const wrap = h("div", { class: "auth-wrap auth-forgot-mfa" });
    wrap.appendChild(h("h2", {}, "Lost access to your authenticator?"));
    wrap.appendChild(
      h(
        "p",
        {},
        "We will email you a sign-in link. After signing in, we will un-enrol your existing 2FA so you can re-enrol with a fresh authenticator app.",
      ),
    );
    const form = h("form", { class: "auth-form", method: "post" });
    const email = h("input", {
      type: "email",
      name: "email",
      required: "",
      autocomplete: "username",
      placeholder: "Email",
    });
    const sendLink = h(
      "button",
      { type: "submit", class: "send-mfa-recovery-link" },
      "Email me a sign-in link",
    );
    form.appendChild(email);
    form.appendChild(sendLink);
    form.addEventListener("submit", async (/** @type {Event} */ e) => {
      e.preventDefault();
      const emailVal = /** @type {HTMLInputElement} */ (email).value;
      try {
        if (deps.sendSignInLinkToEmail && emailVal) {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem("emailForSignIn", emailVal);
          }
          await deps.sendSignInLinkToEmail(emailVal, {
            url: (typeof window !== "undefined" ? window.location.origin : "") + "/?mfaRecovery=1",
            handleCodeInApp: true,
          });
        }
      } catch (_err) {
        /* swallow */
      }
      notify(
        "info",
        "If that account exists, you will receive a sign-in link shortly. Please check your inbox.",
      );
    });
    wrap.appendChild(form);
    const confirm = h(
      "button",
      { type: "button", class: "confirm-unenroll-mfa" },
      "I have signed in - un-enrol my 2FA and start over",
    );
    confirm.addEventListener("click", async () => {
      try {
        if (deps.unenrollAllMfa) await deps.unenrollAllMfa();
        notify("info", "2FA un-enrolled. You will now be asked to set up a fresh authenticator.");
        if (deps.routeToMfaEnrol) deps.routeToMfaEnrol();
      } catch (_err) {
        notify(
          "error",
          "Could not un-enrol 2FA. Try the operator-assisted Tier-2 recovery path (contact the other admin).",
        );
      }
    });
    wrap.appendChild(confirm);
    // Escape hatch: signOut is a no-op when no current user (initial-visit case
    // before email-link sign-in) and returns the user to the sign-in screen
    // when invoked post-email-link. Either way, exits the forgot-MFA flow.
    const backBtn = h(
      "button",
      { type: "button", class: "auth-back-to-signin" },
      "Back to sign in",
    );
    backBtn.addEventListener("click", async () => {
      try {
        if (deps.signOut) await deps.signOut();
      } catch (err) {
        notify("error", (err && /** @type {*} */ (err).message) || "Sign out failed");
      }
    });
    wrap.appendChild(backBtn);
    return wrap;
  }

  return {
    renderSignIn,
    renderFirstRun,
    renderMfaEnrol,
    renderEmailVerificationLanding,
    renderForgotMfa,
    renderAuth: renderSignIn,
  };
}

export function renderSignIn() {
  return createAuthView({}).renderSignIn();
}
export function renderFirstRun() {
  return createAuthView({}).renderFirstRun();
}
export function renderMfaEnrol() {
  return createAuthView({}).renderMfaEnrol();
}
export function renderEmailVerificationLanding() {
  return createAuthView({}).renderEmailVerificationLanding();
}
export function renderForgotMfa() {
  return createAuthView({}).renderForgotMfa();
}
export function renderAuth() {
  return createAuthView({}).renderSignIn();
}
