---
phase: 11-documentation-pack-evidence-pack
plan: 05
subsystem: documentation
tags: [docs, doc-08, security-txt, rfc-9116, vite-publicdir, firebase-hosting-headers, pitfall-3-security-txt-expires-drift, tdd-build-shape]
dependency-graph:
  requires:
    - "Phase 11 Plan 11-01 close — SECURITY.md Vulnerability Disclosure Policy section provides the URL target for security.txt Policy field"
    - "Phase 11 Plan 11-04 — DOC-06 docs/IR_RUNBOOK.md indirectly cross-referenced via SECURITY.md disclosure-policy paragraph that security.txt points to"
  provides:
    - "DOC-08 RFC 9116 vulnerability disclosure metadata served from production at https://baselayers.bedeveloped.com/.well-known/security.txt"
    - "firebase.json /.well-known/** Cache-Control max-age=86400 (24h) headers entry — overrides the existing wildcard immutable rule for the well-known prefix so yearly Expires rotation propagates within a day"
    - "tests/build/security-txt-fresh.test.js (5 cases) — Pitfall 3 mitigation: fails the build BEFORE security.txt drifts within 30 days of Expires"
    - "tests/build/security-txt-served.test.js (3 cases) — gates the public-to-dist copy + firebase.json shape, mirroring tests/build/source-map-gate.test.js Phase 9 pattern"
    - "Forward-tracking row for Wave 6 cleanup-ledger: rotate security.txt Expires field by 2027-04-10 (11 months from authoring; 30-day buffer ahead of Wave-5-set 2027-05-10 expiry)"
  affects:
    - public/.well-known/security.txt (new, 11 lines, 410 bytes)
    - firebase.json (modified — new headers entry appended; preserves existing 3 entries unchanged)
    - tests/build/security-txt-fresh.test.js (new, 50 lines after prettier)
    - tests/build/security-txt-served.test.js (new, 42 lines after prettier)
tech-stack:
  added: []
  patterns:
    - "regex-over-file-body build-shape tests (mirrors tests/build/source-map-gate.test.js Phase 9 Wave 2 pattern)"
    - "Vite default publicDir behaviour for static file shipping (zero vite.config.js modifications; public/* -> dist/* at build time)"
    - "firebase.json source-pattern Cache-Control override (later entry's max-age=86400 takes precedence over wildcard max-age=31536000 immutable for files under /.well-known/)"
    - "Pitfall 3 mitigation via test gate: Expires field drift caught at build-time 30 days before expiry rather than discovered post-expiry by an auditor"
key-files:
  created:
    - public/.well-known/security.txt
    - tests/build/security-txt-fresh.test.js
    - tests/build/security-txt-served.test.js
    - .planning/phases/11-documentation-pack-evidence-pack/11-05-SUMMARY.md
  modified:
    - firebase.json
decisions:
  - id: D-11-05-01
    decision: "security.txt body replaces the RESEARCH.md verbatim en-dash glyph (U+2014 in '# RFC 9116 — A File Format ...') with two ASCII hyphens '--'"
    rationale: "RESEARCH.md §'Code Examples' provides the security.txt body as a paste-ready template, but the heading line carries an em-dash (—, U+2014, byte sequence 0xE2 0x80 0x94) inherited from the IETF reference text. The plan's must_have line 18 says 'security.txt is ASCII-only (no emojis, no non-ASCII characters per RFC 9116)' AND Test 4 of tests/build/security-txt-fresh.test.js asserts charCodeAt(0) < 128 for every character in the file. Shipping the verbatim em-dash would fail Test 4 (em-dash decomposes to a 3-byte UTF-8 sequence with every byte >= 0x80). RFC 9116 §2.1 says 'security.txt files MUST be a UTF-8 encoded text file' so technically the em-dash is valid encoding, but RFC 9116 §2.2 further says 'fields and field values MUST NOT contain octets >= 0x80' for the field-value lines themselves; the comment lines are unrestricted. We chose strict ASCII for the entire file (including comments) because (a) Test 4 enforces it as plan-must-have, (b) the plan's threat model T-11-05-02 explicitly mitigates 'ASCII drift (emoji or non-ASCII char inserted)' via Test 5/charCode-<128 assertion, (c) auditors scanning for RFC 9116 compliance often check ASCII-only as a sloppy-test simplification, (d) the comment-line text remains semantically intact with two ASCII hyphens. Substantive intent preserved (file-shape contract); only the glyph form normalised."
  - id: D-11-05-02
    decision: "Test 1 of tests/build/security-txt-fresh.test.js uses readFileSync at describe scope (not beforeAll) so module-load failure with ENOENT is the canonical RED signal for 'file does not exist yet'"
    rationale: "11-RESEARCH.md §'Code Examples' provides the test body with readFileSync at describe scope. This mirrors Wave 2 PRIVACY.md + Wave 3 THREAT_MODEL.md + Wave 4 IR_RUNBOOK.md doc-shape test RED patterns where the test file fails at module load with ENOENT before any it() blocks fire. Alternative (readFileSync inside a beforeAll + skipIf existsSync) would convert the RED signal from 'test file fails at load' to 'all tests skip' which is less obvious to a reviewer scanning Vitest output. Module-load failure is the more honest signal: 'no, the file does not exist; this is RED.'"
  - id: D-11-05-03
    decision: "firebase.json new entry uses source pattern '/.well-known/**' (single asterisk after the prefix slash) NOT '**/.well-known/**' (recursive wildcard from any depth)"
    rationale: "Firebase Hosting glob patterns: '/.well-known/**' matches files like /.well-known/security.txt and /.well-known/openpgp-key.txt at the root well-known directory; '**/.well-known/**' would also match arbitrary subdirectories containing a .well-known segment (which is non-canonical for RFC 9116). The plan <interfaces> line 76 specifies '/.well-known/**' and the served test predicate /\\/\\.well-known/ matches both patterns equivalently. Choosing the more restrictive prefix-anchored pattern means a hypothetical future /assets/something/.well-known/ subdirectory wouldn't accidentally inherit 24h cache. RFC 9116 §3 anchors security.txt to the URL path '/.well-known/security.txt' (root-relative); the restrictive pattern aligns."
metrics:
  duration: "207 seconds (~3m 27s)"
  duration-iso: "PT3M27S"
  start: "2026-05-10T22:21:46Z"
  end: "2026-05-10T22:25:12Z"
  tasks-completed: 2
  files-created: 4
  files-modified: 1
  commits: 2
  test-cases-added: 8
  test-cases-passing: "539 passed + 6 skipped (full suite); was 531 + 6 pre-Wave-5 (+8 from new build tests; zero regressions across 75 prior test files)"
  security-txt-bytes: 410
  security-txt-fields: "5 (Contact + Expires + Preferred-Languages + Canonical + Policy)"
  security-txt-expires: "2027-05-10T00:00:00Z"
  security-txt-expires-buffer-days: 365
  security-txt-expires-buffer-vs-30-day-gate: "335 days margin"
  security-txt-ascii-only: true
  security-txt-bom: false
  security-txt-non-ascii-bytes: 0
  firebase-json-new-entry-source: "/.well-known/**"
  firebase-json-new-entry-cache-control: "public, max-age=86400"
  firebase-json-existing-entries-preserved: 3
  vite-dist-copy-verified: true
  vite-dist-bytes: 410
  vite-dist-byte-equality-vs-public: true
  completed: "2026-05-10"
---

# Phase 11 Plan 05: /.well-known/security.txt (DOC-08) + firebase.json /.well-known/** Cache-Control + 2 Build Tests Summary

DOC-08 substrate landed: `public/.well-known/security.txt` shipped with 5 RFC 9116 fields + ASCII-only body + Expires 2027-05-10T00:00:00Z (365 days from authoring; 335 days margin over the 30-day-buffer test gate). `firebase.json` gains a new `/.well-known/**` headers entry with `Cache-Control: public, max-age=86400` (24h, NOT immutable — yearly Expires rotation must propagate within a day) plus `Content-Type: text/plain; charset=utf-8`. Vite default `publicDir` behaviour confirmed copying file to `dist/.well-known/security.txt` byte-for-byte at build time. 8-case TDD build-shape gate (5 freshness + 3 served-from-dist) locks the structural contract — Pitfall 3 mitigation: build fails BEFORE security.txt drifts within 30 days of Expires, fires loudly during routine CI rather than silently in production.

## One-liner

Phase 11 Wave 5 — DOC-08 RFC 9116 /.well-known/security.txt (5 fields + ASCII-only + Expires 2027-05-10) + firebase.json /.well-known/** Cache-Control max-age=86400 (24h not 1y, preserves existing 3 entries) + 8-case TDD build-shape gate (Pitfall 3 30-day Expires drift gate fires at CI build before silent production expiry).

## What Landed

### `public/.well-known/security.txt` — DOC-08 RFC 9116 metadata file (commit `29f6bb2`, 410 bytes, 11 lines)

5 RFC 9116 fields in canonical order:

| Field | Value | RFC 9116 status |
|-------|-------|------------------|
| `Contact:` | `mailto:security@bedeveloped.com` | REQUIRED (one or more) |
| `Expires:` | `2027-05-10T00:00:00Z` | REQUIRED (exactly one) |
| `Preferred-Languages:` | `en` | OPTIONAL — adds English-only signal |
| `Canonical:` | `https://baselayers.bedeveloped.com/.well-known/security.txt` | RECOMMENDED when served at canonical location |
| `Policy:` | `https://baselayers.bedeveloped.com/SECURITY.md` | OPTIONAL — links to Phase 11 Wave 1 Vulnerability Disclosure Policy section |

Plus 4 comment lines at the head citing RFC 9116 + IETF source URL. Body is ASCII-only (zero non-ASCII bytes verified by `node -e ...`); no BOM (first 3 bytes 0x23 0x20 0x2f = `# /`). Expires gives 365 days from authoring → 335 days margin over the 30-day-buffer Test 2 gate. ASCII-only deviation from RESEARCH.md verbatim template documented as D-11-05-01 (em-dash in heading comment replaced with two ASCII hyphens; Test 4 charCode<128 assertion would have RED'd the verbatim glyph).

### `firebase.json` — new /.well-known/** Cache-Control headers entry (commit `29f6bb2`, +7 lines)

```diff
       {
         "source": "**/*.@(js|css|png|svg|woff2|ico)",
         "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
+      },
+      {
+        "source": "/.well-known/**",
+        "headers": [
+          { "key": "Cache-Control", "value": "public, max-age=86400" },
+          { "key": "Content-Type", "value": "text/plain; charset=utf-8" }
+        ]
       }
     ],
```

- Existing 3 headers entries preserved unchanged (`**` wildcard with 9 baseline security headers + CSP-Report-Only; `index.html` no-cache; `**/*.@(js|css|png|svg|woff2|ico)` immutable wildcard).
- The new entry's `Cache-Control: public, max-age=86400` (24h) takes precedence over the immutable wildcard for files under `/.well-known/` per Firebase Hosting later-entry-wins rule (verified by Test 3 of `tests/build/security-txt-served.test.js` which asserts `max-age=86400` present + `immutable` absent).
- Explicit `Content-Type: text/plain; charset=utf-8` aligns with RFC 9116 §2.1 MIME recommendation; the wildcard `**` rule already covers security headers (HSTS / X-Content-Type-Options / Referrer-Policy / Permissions-Policy / COOP / COEP / CORP / Reporting-Endpoints / CSP-Report-Only).
- Source pattern `/.well-known/**` (prefix-anchored, single recursive wildcard) chosen over `**/.well-known/**` (D-11-05-03 — restrictive root-anchored matches RFC 9116 §3 canonical URL anchor).

Production deploy of this firebase.json change is **operator-pending** — bundle with the Phase 10 `10-DEFERRED-CHECKPOINT.md` enforcement deploy session (Step 3 of that document already covers `firebase deploy --only hosting`; this new entry rides the same deploy). Wave 6 close-out will reference the deploy SHA when the operator session resolves. No new operator interrupt introduced.

### `tests/build/security-txt-fresh.test.js` — RFC 9116 freshness gate (commit `6f24818`, 50 lines after prettier)

5 cases mirroring 11-RESEARCH.md §"Code Examples" + Test 5 (Policy field) added per plan <behavior> line 120:

1. Contact: field present with canonical mailto.
2. Expires: field at least 30 days in the future (Pitfall 3 mitigation — fails the build BEFORE silent production expiry).
3. Canonical: field equals canonical production URL.
4. ASCII-only — every charCode < 128 (no emoji, no non-ASCII).
5. Policy: field present with canonical SECURITY.md URL.

`readFileSync` at describe scope per D-11-05-02 — module-load failure with ENOENT is the canonical "file does not exist yet" RED signal mirroring Wave 2/3/4 patterns.

### `tests/build/security-txt-served.test.js` — build-output gate (commit `6f24818`, 42 lines after prettier)

3 cases analogous to `tests/build/source-map-gate.test.js` Phase 9 OBS-04 pattern:

1. `public/.well-known/security.txt` exists (static-source assertion).
2. `dist/.well-known/security.txt` matches public source byte-for-byte after build (skipped when dist/ absent so the test stays CI-clean before build; converts to firing assertion after `npm run build`).
3. `firebase.json` declares a `/.well-known/**` headers entry with `Cache-Control: max-age=86400` and NOT `immutable`.

`it.skipIf(!existsSync(distPath))` pattern keeps the test green when dist/ is absent (e.g., fresh checkout); after `npm run build`, the test fires and was verified GREEN with byte-equality 410 bytes vs 410 bytes.

## TDD Gate Compliance

- **RED gate** (commit `6f24818`): Both test files authored with NO `public/.well-known/security.txt` + NO firebase.json `/.well-known/**` entry. `npx vitest run tests/build/security-txt-fresh.test.js tests/build/security-txt-served.test.js` produced **2 failed test files / 2 failed + 1 skipped (3)** — `security-txt-fresh.test.js` fails at module load with ENOENT (canonical "file does not exist yet" RED signal); `security-txt-served.test.js` Test 1 fails (publicPath existsSync false) + Test 3 fails (no /.well-known headers entry); Test 2 (byte-equality) correctly skipped via `it.skipIf` because dist/.well-known/security.txt also absent at RED.
- **GREEN gate** (commit `29f6bb2`): Both files authored (security.txt + firebase.json edit). Re-run produced **2 passed / 7 passed + 1 skipped (8)** before `npm run build`; **2 passed / 8 passed (8)** after `npm run build` populates dist/.well-known/security.txt (byte-equality test fires as 410 bytes vs 410 bytes byte-identical). firebase-config baseline `npx vitest run tests/firebase-config.test.js`: **24 passed | 6 skipped (30)** — Phase 10 schema invariants preserved. Full suite `npx vitest run`: **539 passed + 6 skipped** (was 531 + 6 pre-Wave-5; +8 from new build tests; zero regressions across 75 prior test files).

Conventional Commits prefixes: `test(11-05)` for the RED commit, `docs(11-05)` for the GREEN commit.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Both build tests GREEN (post-build) | `npx vitest run tests/build/security-txt-fresh.test.js tests/build/security-txt-served.test.js` | 8/8 PASS (5 + 3) |
| firebase-config baseline preserved | `npx vitest run tests/firebase-config.test.js` | 24 passed \| 6 skipped (30) |
| Full suite zero regressions | `npx vitest run` | 539 passed \| 6 skipped (was 531 + 6) |
| public/.well-known/security.txt exists with Contact field | `grep -c "Contact: mailto:security@bedeveloped.com" public/.well-known/security.txt` | 1 |
| Expires field >= 30 days from now | Test 2 of security-txt-fresh.test.js | GREEN — 365-day-from-authoring buffer; 335 days margin over 30-day gate |
| security.txt ASCII-only | Node script `for-of-loop charCodeAt<128` | 0 non-ASCII bytes; 0 BOM |
| security.txt byte size | `wc -c public/.well-known/security.txt` | 410 |
| firebase.json /.well-known/** entry present | `grep -c "/.well-known/" firebase.json` | 1 (gate: >= 1) |
| firebase.json existing 3 entries unchanged | git diff before/after Wave 5 | 0 lines mutated in existing entries (only append) |
| Vite copies to dist/.well-known/ | `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=placeholder npm run build && ls -la dist/.well-known/security.txt` | -rw-r--r-- 410 bytes (byte-identical to public/) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] ASCII glyph normalisation in security.txt heading comment**

- **Found during:** Task 2 authoring.
- **Issue:** RESEARCH.md §"Code Examples" provides the security.txt body verbatim, but the heading comment carries an em-dash (`—`, U+2014) inherited from IETF reference text. Plan must_have line 18 says "ASCII-only (no emojis, no non-ASCII characters per RFC 9116)" AND Test 4 of `tests/build/security-txt-fresh.test.js` asserts `charCodeAt(0) < 128` for every character in the file. Shipping the verbatim glyph would have RED'd Test 4 (em-dash → 3-byte UTF-8 sequence with every byte >= 0x80).
- **Fix:** Replaced the em-dash with two ASCII hyphens (`--`) in the heading comment. Substantive intent preserved (the file-shape contract); only the glyph form normalised. Strict ASCII enforced for the entire file (comments + field values) because Test 4 enforces it as plan-must-have and the threat model T-11-05-02 explicitly mitigates "ASCII drift (emoji or non-ASCII char inserted)".
- **Files modified:** `public/.well-known/security.txt`.
- **Commit:** `29f6bb2`.
- Documented as D-11-05-01.

**2. [Rule 3 - Build environment] VITE_RECAPTCHA_ENTERPRISE_SITE_KEY required for `npm run build` verification**

- **Found during:** Task 2 verify step (Step 3 — `npm run build && ls -la dist/.well-known/security.txt`).
- **Issue:** Phase 7 Wave 3 (FN-07) added a fail-closed build-time guard in `vite.config.js:21-23` that throws if `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` is unset on production build. This blocks the plan-specified verification command on a fresh executor environment without the secret.
- **Fix:** Ran `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=placeholder-for-build-verification npm run build` for the Wave 5 dist-copy verification only. The placeholder satisfies the FN-07 presence check without affecting Vite static-file copying (Vite copies publicDir before any application module imports). Build completed successfully (1.05s); `dist/.well-known/security.txt` populated at 410 bytes byte-identical to public/. The placeholder value is NOT committed; the verification was a local-only run. Production build is operator-driven via CI which carries the real secret.
- **Files modified:** none (the placeholder was a local env var, not a code change).
- **Commit:** n/a (verification-environment fix only; nothing committed).

### Architectural decisions

None — Rule 4 not triggered.

### Out-of-scope discoveries

**Forward-tracking row for Wave 6 cleanup-ledger:** Rotate `security.txt` Expires field by 2027-04-10 (11 months from authoring; 30-day buffer ahead of the Wave-5-set 2027-05-10 expiry). Pitfall 3 mitigation already in place via Test 2 (build fails when Expires < 30 days from now), but the operator-facing reminder lifts the rotation from a build-RED surprise to a calendar-scheduled task. Per RESEARCH.md §Pitfall 3 line 500 — "Add a forward-tracking row to `runbooks/phase-11-cleanup-ledger.md` for 11 months from now: 'rotate `security.txt` Expires field'." This row queues for Wave 6 (Plan 11-06) when the cleanup-ledger zero-out gate fires.

**Operator-pending deploy:** Production deploy of the new `firebase.json` `/.well-known/**` entry is bundled into the existing Phase 10 `10-DEFERRED-CHECKPOINT.md` operator session (Step 3 already covers `firebase deploy --only hosting`; the new entry rides that same deploy without introducing a new operator interrupt). Plan <action> line 261 explicitly contracts this path — "Production deploy of the new firebase.json hosting config is NOT a Phase 11 Wave 5 in-scope action ... DOCUMENT in the SUMMARY but do NOT attempt the deploy in this task." No checkpoint returned; deploy reference threaded through here.

## Authentication Gates

None reached during execution. No external API calls, no auth flows triggered — Wave 5 is purely static-file authoring + JSON edit + Vitest assertions + a single offline `npm run build`.

## Known Stubs

None. The `Acknowledgments:` and `Encryption:` RFC 9116 fields are intentionally OMITTED rather than stubbed — RESEARCH.md line 551 documents both as v2-deferred ("no acknowledgement page yet — v2; no PGP key — v2") and RFC 9116 marks them OPTIONAL. Their omission is not a stub but a substrate-honest scope decision aligned with the "credible, not certified" project compliance posture: rather than ship empty/placeholder fields, omit them entirely and document the deferral. Wave 6 cleanup-ledger forward-tracking row F-DOC-08-v2 captures the v2 review for whether to add Acknowledgments + Encryption as the project matures.

## Threat Flags

None. Documentation-only static file addition + a Cache-Control header tightening that is strictly more restrictive than the existing wildcard (24h vs 1y immutable; reduces blast radius of a stale-cache regression). No new network endpoints; no new auth paths; no schema changes; no new operator-system trust boundaries.

## Plan Threat Register Mitigation Status

Per plan `<threat_model>` STRIDE register (5 threats, all `mitigate` disposition):

| Threat ID | Category | Mitigation in this plan | Status |
|-----------|----------|--------------------------|--------|
| T-11-05-01 | Repudiation (Expires drift / RFC 9116 non-compliance after expiry) | tests/build/security-txt-fresh.test.js Test 2 (Expires >= 30 days from now); Wave 6 cleanup-ledger forward-tracking row F-DOC-08-rotate queued | LANDED + QUEUED |
| T-11-05-02 | Repudiation (ASCII drift / emoji or non-ASCII inserted) | tests/build/security-txt-fresh.test.js Test 4 (charCodeAt < 128 for every character); D-11-05-01 ASCII-glyph normalisation applied to the verbatim template heading | LANDED |
| T-11-05-03 | Repudiation (Cache-Control max-age=immutable serving stale content after Expires update) | firebase.json new /.well-known/** headers entry overrides immutable wildcard with 24h max-age | LANDED |
| T-11-05-04 | Tampering (Vite build pipeline drops public/.well-known/ contents) | tests/build/security-txt-served.test.js Test 1 (publicPath existsSync) + Test 2 (dist matches public byte-for-byte after build) | LANDED |
| T-11-05-05 | Information Disclosure (wrong Policy URL directs reporters to wrong page) | tests/build/security-txt-fresh.test.js Test 5 (Policy field equals canonical SECURITY.md URL) | LANDED |

All 5 mitigations LANDED; one forward-tracking row queued for Wave 6.

## Commits

| Task | Description | Hash | Files |
|------|-------------|------|-------|
| 1 | TDD RED — author 8-case security.txt freshness + served-from-dist tests (Pitfall 3 mitigation) | `6f24818` | `tests/build/security-txt-fresh.test.js` (new, 50 lines after prettier); `tests/build/security-txt-served.test.js` (new, 42 lines after prettier) |
| 2 | TDD GREEN — ship /.well-known/security.txt + firebase.json /.well-known/** headers (DOC-08) | `29f6bb2` | `public/.well-known/security.txt` (new, 410 bytes); `firebase.json` (modified, +7 lines) |

## Output (per plan `<output>` block)

- **security.txt field count:** 5 RFC 9116 fields (Contact + Expires + Preferred-Languages + Canonical + Policy) + 4 comment lines.
- **Expires date:** 2027-05-10T00:00:00Z (365 days from authoring; 335 days margin over the 30-day-buffer Test 2 gate).
- **firebase.json change diff:** new `/.well-known/**` headers entry appended after the existing 3 entries; +7 lines net; existing 3 entries preserved unchanged byte-for-byte.
- **dist file size + post-build verification:** 410 bytes; byte-identical to `public/.well-known/security.txt` (verified by `diff` returning zero output AND test 2 of `security-txt-served.test.js` byte-equality assertion firing GREEN).
- **Deploy-pending operator pointer:** Bundle the `firebase deploy --only hosting` for the new `/.well-known/**` headers entry into the existing Phase 10 `10-DEFERRED-CHECKPOINT.md` Step 3 (`firebase deploy --only hosting --project bedeveloped-base-layers`). The operator session already covers the production hosting deploy; this Wave 5 change rides the same deploy without a new operator interrupt. Alternative: queue as a Wave 6 cleanup-ledger row if Phase 10 session resolves before Phase 11 close — both routes preserve Pitfall 8 selective-deploy boundary (zero functions/ touched; only hosting redeployed).
- **Commit SHAs:** `6f24818` (RED — test) + `29f6bb2` (GREEN — docs).

## Self-Check: PASSED

- `public/.well-known/security.txt` — FOUND (410 bytes, ASCII-only, 5 RFC 9116 fields)
- `tests/build/security-txt-fresh.test.js` — FOUND
- `tests/build/security-txt-served.test.js` — FOUND
- `firebase.json` — FOUND (contains `/.well-known/` pattern, 1 hit; existing 3 entries preserved)
- `.planning/phases/11-documentation-pack-evidence-pack/11-05-SUMMARY.md` — FOUND (this file)
- commit `6f24818` — FOUND in git log (RED gate — test)
- commit `29f6bb2` — FOUND in git log (GREEN gate — docs)
- `npx vitest run tests/build/security-txt-fresh.test.js tests/build/security-txt-served.test.js` — 8/8 PASS (post-build) / 7 pass + 1 skipped (pre-build, byte-equality gracefully skipped)
- `npx vitest run tests/firebase-config.test.js` — 24 passed | 6 skipped (Phase 10 baseline preserved)
- `npx vitest run` (full suite) — 539 passed + 6 skipped (was 531 + 6 pre-Wave-5; +8 from new build tests; zero regressions across 75 prior test files)
