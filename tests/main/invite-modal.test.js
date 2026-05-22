// tests/main/invite-modal.test.js
// @ts-check
// Phase 06.1 Wave 2 Task 3 (AUTH-16 / D-14): pins the rewired Invite Client
// modal in src/main.js. The IIFE inside main.js does not expose
// openInviteClientModal, so this file follows the same pattern as
// tests/main.test.js — source-content assertions over the modal block
// (l.~4906-4985) ensuring:
//   - imports of inviteClient wrapper + AUTH-12 error classes are present
//   - new orgPassphrase password input is mounted in the modal
//   - submit handler calls inviteClient(...) via the wrapper
//   - existed-user path opens a confirmation that calls inviteClient with
//     confirmReset: true
//   - legacy upsertUser + findUserByEmail short-circuit are NOT present
//     within openInviteClientModal
//   - typed-error handlers (PassphraseInvalidError / CrossOrgError /
//     PassphraseNotSetError) surface err.message
//   - the Instructions modal copy revision landed (drops "share separately"
//     wording; adds "your contact has shared with you" wording)
//
// The pattern of source-content pinning is consistent with the existing
// tests/main.test.js + tests/main/set-org-passphrase-policy.test.js shapes;
// a future Wave promoting openInviteClientModal to an exported view module
// would unlock more direct DOM-level testing (deferred per CLAUDE.md "Source
// layout target — post-Phase 4: views/* extraction" cleanup-ledger row).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(resolve("src/main.js"), "utf8");

// Extract the openInviteClientModal block: everything from the function
// declaration to the next top-level `function ` at the same indent. Mirrors
// the awk gate the plan's acceptance criteria use.
function extractFunctionBlock(/** @type {string} */ src, /** @type {string} */ name) {
  const lines = src.split(/\r?\n/);
  /** @type {string[]} */
  const out = [];
  let depth = 0;
  let started = false;
  for (const line of lines) {
    if (!started) {
      if (new RegExp(`function\\s+${name}\\s*\\(`).test(line)) {
        started = true;
        // estimate indent: count leading spaces of this line
        const m = line.match(/^(\s*)/);
        depth = m ? m[1].length : 0;
        out.push(line);
        continue;
      }
    } else {
      // Stop when the next sibling function declaration at the same indent is encountered
      const reEnd = new RegExp(`^\\s{0,${depth}}function\\s+`);
      if (reEnd.test(line) && !line.includes(name)) break;
      out.push(line);
    }
  }
  return out.join("\n");
}

const inviteModalBlock = extractFunctionBlock(SRC, "openInviteClientModal");
const instructionsModalBlock = extractFunctionBlock(SRC, "openInviteInstructionsModal");

describe("src/main.js — module imports (Phase 06.1 Wave 2)", () => {
  it("imports { inviteClient } from ./cloud/invite-admin.js", () => {
    expect(SRC).toMatch(
      /import\s+\{\s*inviteClient\s*\}\s+from\s+["']\.\/cloud\/invite-admin\.js["']/,
    );
  });

  it("imports AUTH-12 invite error classes from ./firebase/auth.js", () => {
    // All three classes referenced somewhere in main.js (import + catch checks).
    expect(SRC).toMatch(/PassphraseInvalidError/);
    expect(SRC).toMatch(/CrossOrgError/);
    expect(SRC).toMatch(/PassphraseNotSetError/);
  });
});

describe("openInviteClientModal — rewired submit path (Phase 06.1 Wave 2)", () => {
  it("mounts a password input with the 'Re-enter the company passphrase' placeholder", () => {
    expect(inviteModalBlock).toMatch(/Re-enter the company passphrase/);
    // Check it's a password-type input (security: passphrase not echoed)
    expect(inviteModalBlock).toMatch(/type:\s*["']password["']/);
  });

  it("calls inviteClient(...) via the wrapper", () => {
    expect(inviteModalBlock).toMatch(/await\s+inviteClient\s*\(/);
  });

  it("passes confirmReset:true on the second call (existed-user confirmation path)", () => {
    expect(inviteModalBlock).toMatch(/confirmReset:\s*true/);
  });

  it("handles PassphraseInvalidError / CrossOrgError / PassphraseNotSetError", () => {
    // Each class checked in catch branches (instanceof or comparable typed-error handling)
    expect(inviteModalBlock).toMatch(/PassphraseInvalidError/);
    expect(inviteModalBlock).toMatch(/CrossOrgError/);
    expect(inviteModalBlock).toMatch(/PassphraseNotSetError/);
  });

  it("does NOT carry the legacy findUserByEmail short-circuit", () => {
    expect(inviteModalBlock).not.toMatch(/findUserByEmail\s*\(/);
  });

  it("does NOT carry the legacy upsertUser(user) local-Firestore mutation", () => {
    expect(inviteModalBlock).not.toMatch(/upsertUser\s*\(/);
  });

  it("does NOT call the legacy setUserPassword path", () => {
    expect(inviteModalBlock).not.toMatch(/setUserPassword\s*\(/);
  });
});

describe("openInviteInstructionsModal — copy revision (Phase 06.1 Wave 2)", () => {
  it("drops the legacy '(I'll share this with you separately)' line", () => {
    expect(instructionsModalBlock).not.toMatch(/share this with you separately/);
  });

  it("adds the new 'your contact has shared with you' wording", () => {
    expect(instructionsModalBlock).toMatch(/your contact has shared with you/);
  });

  it("revises the descriptive paragraph to drop 'separately' wording", () => {
    // The phrase used to read: "share the company passphrase ... separately"
    // New copy: "via your usual secure channel"
    expect(instructionsModalBlock).toMatch(/via your usual secure channel/);
  });

  it("revised amber-banner mentions the min-12-char floor", () => {
    expect(instructionsModalBlock).toMatch(/min 12 characters/);
  });
});
