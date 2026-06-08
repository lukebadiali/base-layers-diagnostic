// tests/main/add-internal-modal.test.js
// @ts-check
// Pins the 2026-06 "Add internal member" admin UI in src/main.js. The IIFE does
// not export openAddInternalModal, so (like invite-modal.test.js) these are
// source-content assertions over the extracted function blocks:
//   - inviteInternal + deleteInternal imported from the cloud wrapper
//   - the Add-internal modal mounts name/email/role inputs, offers internal+admin
//     roles, calls inviteInternal, and reveals the temp password once
//   - the credentials modal surfaces the temp password + a shown-once warning
//   - the Internal-team Remove button routes through the deleteInternal callable
//     (NOT the deleted local-only deleteUser path)

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(resolve("src/main.js"), "utf8");

function extractFunctionBlock(/** @type {string} */ src, /** @type {string} */ name) {
  const lines = src.split(/\r?\n/);
  /** @type {string[]} */
  const out = [];
  let depth = 0;
  let started = false;
  for (const line of lines) {
    if (!started) {
      // eslint-disable-next-line security/detect-non-literal-regexp -- name is a hardcoded literal at call sites.
      if (new RegExp(`function\\s+${name}\\s*\\(`).test(line)) {
        started = true;
        const m = line.match(/^(\s*)/);
        depth = m ? m[1].length : 0;
        out.push(line);
        continue;
      }
    } else {
      // eslint-disable-next-line security/detect-non-literal-regexp -- depth is a numeric indent derived from source.
      const reEnd = new RegExp(`^\\s{0,${depth}}function\\s+`);
      if (reEnd.test(line) && !line.includes(name)) break;
      out.push(line);
    }
  }
  return out.join("\n");
}

const addModalBlock = extractFunctionBlock(SRC, "openAddInternalModal");
const credsModalBlock = extractFunctionBlock(SRC, "openInternalCredentialsModal");

describe("src/main.js — internal-member wrapper imports", () => {
  it("imports inviteInternal + deleteInternal from ./cloud/invite-admin.js", () => {
    expect(SRC).toMatch(
      /import\s+\{[^}]*\binviteInternal\b[^}]*\}\s+from\s+["']\.\/cloud\/invite-admin\.js["']/s,
    );
    expect(SRC).toMatch(
      /import\s+\{[^}]*\bdeleteInternal\b[^}]*\}\s+from\s+["']\.\/cloud\/invite-admin\.js["']/s,
    );
  });
});

describe("openAddInternalModal — create-staff path", () => {
  it("mounts name + email + role inputs", () => {
    expect(addModalBlock).toMatch(/Team member name/);
    expect(addModalBlock).toMatch(/type:\s*["']email["']/);
    expect(addModalBlock).toMatch(/h\(\s*["']select["']/);
  });

  it("offers both internal and admin roles", () => {
    expect(addModalBlock).toMatch(/["']internal["']/);
    expect(addModalBlock).toMatch(/["']admin["']/);
  });

  it("calls inviteInternal(...) on submit", () => {
    expect(addModalBlock).toMatch(/await\s+inviteInternal\s*\(/);
  });

  it("reveals the temp password via the credentials modal", () => {
    expect(addModalBlock).toMatch(/openInternalCredentialsModal\s*\(/);
    expect(addModalBlock).toMatch(/res\.tempPassword/);
  });
});

describe("openInternalCredentialsModal — one-time temp password reveal", () => {
  it("renders the temp password and a shown-once warning", () => {
    expect(credsModalBlock).toMatch(/tempPassword/);
    expect(credsModalBlock).toMatch(/shown once/i);
  });

  it("offers a copy-to-clipboard affordance", () => {
    expect(credsModalBlock).toMatch(/clipboard\.writeText/);
  });
});

describe("Internal-team Remove — server-side deletion", () => {
  it("routes Remove through the deleteInternal callable", () => {
    expect(SRC).toMatch(/await\s+deleteInternal\s*\(\s*\{\s*uid:\s*u\.id\s*\}\s*\)/);
  });

  it("no longer defines the local-only deleteUser helper (orphaned + removed)", () => {
    expect(SRC).not.toMatch(/function\s+deleteUser\s*\(/);
  });
});
