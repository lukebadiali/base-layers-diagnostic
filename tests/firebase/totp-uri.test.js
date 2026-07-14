// tests/firebase/totp-uri.test.js
// @ts-check
// 2026-07 MFA QR hardening — pins the otpauth URI shape so the Microsoft
// Authenticator "auth/invalid-verification-code" regression can't recur via a
// malformed (unencoded / under-specified) URI.
import { describe, it, expect } from "vitest";

import { buildTotpUri } from "../../src/firebase/totp-uri.js";

describe("buildTotpUri", () => {
  it("percent-encodes the space in the issuer (no raw space in the URI)", () => {
    const uri = buildTotpUri({
      secretKey: "ABC234",
      accountName: "user@example.com",
      issuer: "BeDeveloped Diagnostic",
    });
    expect(uri).not.toContain(" ");
    expect(uri).toContain("BeDeveloped%20Diagnostic");
  });

  it("encodes the account name (@ -> %40) in the label", () => {
    const uri = buildTotpUri({
      secretKey: "ABC234",
      accountName: "user@example.com",
      issuer: "Acme",
    });
    expect(uri).toContain("otpauth://totp/Acme:user%40example.com?");
  });

  it("pins period, algorithm and digits from the secret", () => {
    const uri = buildTotpUri({
      secretKey: "ABC234",
      accountName: "u@e.com",
      issuer: "Acme",
      algorithm: "SHA256",
      digits: 8,
      period: 60,
    });
    expect(uri).toContain("algorithm=SHA256");
    expect(uri).toContain("digits=8");
    expect(uri).toContain("period=60");
  });

  it("defaults to SHA1 / 6 digits / 30s when the secret omits them", () => {
    const uri = buildTotpUri({
      secretKey: "ABC234",
      accountName: "u@e.com",
      issuer: "Acme",
    });
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });

  it("carries the secret + issuer params and the otpauth scheme", () => {
    const uri = buildTotpUri({
      secretKey: "JBSWY3DPEHPK3PXP",
      accountName: "u@e.com",
      issuer: "Acme",
    });
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=Acme");
  });
});
