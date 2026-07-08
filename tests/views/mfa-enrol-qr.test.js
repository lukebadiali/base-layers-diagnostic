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
