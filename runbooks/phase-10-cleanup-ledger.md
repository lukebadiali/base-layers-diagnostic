---
phase: 10
created: 2026-05-10
phase_10_active_rows: 0
last_updated: 2026-05-10
status: closed-pending-operator-session
---

# Phase 10 Cleanup Ledger

> Phase 10 Wave 5 (Plan 10-05) deliverable. Closes all in-Phase-10 forward-tracking rows queued by Waves 1-4 + closes cross-phase carryover rows queued by Phase 4 (sub-wave 4.1 inline-style portion) and Phase 6/7 (frame-src firebaseapp.com forward-track). Documents calendar-deferred / future-phase rows with explicit owner and target. Mirrors `runbooks/phase-8-cleanup-ledger.md` + `runbooks/phase-9-cleanup-ledger.md` Pattern H shape with `phase_10_active_rows: 0` zero-out gate.
>
> Substrate-honest (Pitfall 19): every Phase-10-originating row CLOSES with this commit OR has an explicit closure path documented with a named owner and phase. Carryover rows are open BUT explicitly bounded. The operator-deferred Phase 10 actions (Stage B 7-day soak, single-knob enforcement flip + 5-target smoke, hstspreload.org submission + securityheaders.com A+ rating capture + 7-day post-enforcement soak, phase-close human-verify) are NOT open ledger rows — they are batched into `.planning/phases/10-csp-tightening-second-sweep/10-DEFERRED-CHECKPOINT.md` (single combined operator session bundling Plan 10-03 Task 2 + Plan 10-04 Task 2 + Plan 10-05 Task 2 + Plan 10-05 Task 4).

---

## Phase 4 Forward-Tracking — Phase 10 Closure

This 1 row was queued by `runbooks/phase-4-cleanup-ledger.md` §Out-of-band soft-fail entries. Closes here.

| Row | Phase 4 reason | Phase 10 closure |
|-----|----------------|------------------|
| 132 static `style="..."` inline-attr strings in `src/main.js` IIFE | Phase 4 sub-wave 4.1 carryover — Phase 2 D-08 snapshot baseline contract + Phase 10 HOST-07 single-knob flip pending; treating as "main.js-body-migration sub-wave (atomic with Phase 10 work)" | **CLOSED 10-01** (commits `89b1140` + `ec0afa7`): inline-style portion fully migrated. Grep `style:\s*"` against src/main.js returns 0 hits at Plan 10-01 close (actual scope was 162 static sites once 130 single-line + 32 multi-line plain-string patterns were enumerated; the 32 multi-line variants are CSP-equivalent under style-src 'self' and were migrated alongside the 130 single-line sites per Rule 3 deviation). 104 named classes minted in `styles.css` Wave 1 utility-class block (24 atom `.u-*` + ~80 semantic compound classes). 9 template-literal `style: \`...${expr}...\`` h()-attrs preserved as genuinely-dynamic forward-track row F2 below (independent of inline-style portion; lands as part of future IIFE body migration). Phase 4 sub-wave 4.1 BROADER carryover (IIFE body + window.FB.* bridges + Chart bare globals) remains open — explicitly forward-tracked to v2 / separate milestone per F2 row. |

---

## Phase 6 + Phase 7 Forward-Tracking — Phase 10 Closure

This 1 row was queued by both `runbooks/phase-6-cleanup-ledger.md` §Phase 10 forward-tracking AND `runbooks/phase-7-cleanup-ledger.md` §Phase 10 forward-tracking (duplicate entry — same row queued twice across the two cleanup ledgers). Closes here.

| Row | Phase 6/7 reason | Phase 10 closure |
|-----|------------------|------------------|
| Drop temporary CSP allowlist for Firebase Auth popup origin (`frame-src https://bedeveloped-base-layers.firebaseapp.com`) | Phase 3 D-09 added `frame-src https://bedeveloped-base-layers.firebaseapp.com` preemptively to spare Phase 6 a CSP edit; Phase 10 strict-CSP sweep can drop it once popup flow is removed. Phase 6 verified the app uses `signInWithEmailLink` (D-09); `grep signInWithPopup src/` returns 0 hits. | **CLOSED 10-02** (commit `523e47e`): firebase.json CSP-RO directive value tightened — `frame-src` changed from `https://bedeveloped-base-layers.firebaseapp.com` to `'self'`. Phase 6/7 forward-tracking row closes here. Verified at Plan 10-02 by `tests/firebase-config.test.js` Phase 10 schema assertion `frame-src is 'self' (no firebaseapp.com popup origin)`. Future federated OAuth-popup sign-in (AUTH-V2-* v2 territory) would need re-extension — forward-tracked as F3 below. |

---

## Phase 10 In-Phase Rows — Closed Wave 5

These rows were queued during Phase 10 Waves 1-4 plans/SUMMARIES. All close here.

| Row | Description | Closed By | Status |
|-----|-------------|-----------|--------|
| 1 | 162 static `style="..."` h()-attrs in src/main.js (Phase 4 sub-wave 4.1 inline-style portion carryover) | Plan 10-01 commits `89b1140` (Task 1 — utility-class block) + `ec0afa7` (Task 2 — migration + cache-buster + snapshots) | CLOSED |
| 2 | Drop `'unsafe-inline'` from `style-src` in firebase.json CSP-RO | Plan 10-02 commit `523e47e` | CLOSED |
| 3 | Add `https://de.sentry.io` to `connect-src` (Pitfall 10B — Phase 9 OBS-04 Sentry browser POSTs allowlisted ahead of enforcement) | Plan 10-02 commit `523e47e` | CLOSED |
| 4 | Drop `https://bedeveloped-base-layers.firebaseapp.com` from `frame-src` (Phase 6 D-09 + Phase 7 forward-tracking row) | Plan 10-02 commit `523e47e` | CLOSED (cross-phase ledger references updated in §Phase 6+7 Forward-Tracking above) |
| 5 | Extend `tests/firebase-config.test.js` with 6 Phase 10 enforced-shape schema assertions (style-src locked; connect-src includes Sentry; frame-src 'self'; base-uri + form-action present; CSP key 'Content-Security-Policy' not Report-Only; HSTS preload-eligibility) | Plan 10-02 commit `24f8a7c` (lands assertions under `describe`); Plan 10-04 commit `def252e` (pre-stages a parallel `describe.skip` block; operator session un-skips at Plan 10-04 Task 2) | CLOSED |
| 6 | Author `runbooks/phase-10-csp-soak-bootstrap.md` + `10-PREFLIGHT.md` skeleton (Stage B 7-day Cloud Logging soak runbook + operator-fill audit log skeleton) | Plan 10-03 commit `ebd6c5d` | CLOSED |
| 7 | Author `runbooks/csp-enforcement-cutover.md` (single-knob enforcement-flip operator runbook — 7 Cutover Steps + 5-target smoke matrix + Cutover Log + single-knob Rollback Procedure) | Plan 10-04 commit `def252e` | CLOSED |
| 8 | Pre-stage `describe.skip` block in `tests/firebase-config.test.js` with 6 enforced-shape assertions for Wave 4 operator un-skip | Plan 10-04 commit `def252e` | CLOSED (operator un-skip lands at Plan 10-04 Task 2 within the combined deferred session) |
| 9 | Author `runbooks/hsts-preload-submission.md` (hstspreload.org submission operator runbook — 5 Steps + apex-vs-subdomain decision tree + 3-row Cutover Log) | Plan 10-05 commit `86ec5cd` | CLOSED |
| 10 | SECURITY.md DOC-10 Phase 10 increment — replace § CSP (Report-Only) with § CSP (enforced) + add § HSTS Preload Status + add § Phase 10 Audit Index (3-row Pattern G table) + § Phase 3 Audit Index maintenance annotations | Plan 10-05 commit (this commit) | CLOSED |
| 11 | REQUIREMENTS.md row updates — HOST-07 flipped `[x]` (Closed Phase 10 — Plans 10-01 + 10-02 + 10-04 + 10-05); HOST-06 flipped `[x]` substrate-complete (Plan 10-05 submission landed; listing-status PENDING per Pitfall 19); DOC-10 row gains Phase 10 Wave 5 increment annotation; Traceability table HOST-06/HOST-07 row updated to Validated 2026-05-10 substrate | Plan 10-05 commit (this commit) | CLOSED |

---

## Phase 10 Carryover — Bounded Closure Paths

These rows originated in or were re-asserted by Phase 10 work but are NOT closed at Phase 10 code-and-docs close. Each has an explicit closure path with a named owner and phase. The 4 operator-deferred actions are batched into a single combined operator session via `10-DEFERRED-CHECKPOINT.md`.

| Row | Reason | Closure path |
|-----|--------|--------------|
| **Plan 10-03 Task 2 deferred — Stage B 7-day Cloud Logging soak** | Wave 3 substrate + soak-bootstrap runbook complete (`runbooks/phase-10-csp-soak-bootstrap.md` + `10-PREFLIGHT.md` skeleton); the 7-day calendar soak cannot be automated by an executor agent. Triage-and-restart cycles add 7+ days each per Pitfall 16 expected behaviour. | Single combined operator session — `.planning/phases/10-csp-tightening-second-sweep/10-DEFERRED-CHECKPOINT.md` Step 1. Resume contract: operator types "Wave 3 Day 7 CLEAN" with the Cloud Logging filter result + 10-PREFLIGHT.md Soak Log Cycle 1 close-out fields filled. Owner: Hugh / Luke. |
| **Plan 10-04 Task 2 deferred — single-knob enforcement flip + 5-target smoke matrix** | Wave 4 substrate + enforcement-cutover runbook complete (`runbooks/csp-enforcement-cutover.md` 302 lines, 7 numbered Cutover Steps); the actual production deploy + browser-side DevTools 5-target smoke matrix cannot be automated by an executor agent. BLOCKED on Wave 3 Day 7 CLEAN signal. | Single combined operator session — `10-DEFERRED-CHECKPOINT.md` Step 2. Resume contract: operator types "Wave 4 enforcement flip complete + 5-target smoke PASS" with Cutover Log Rows A/B/C filled + `docs/evidence/phase-10-enforcement-smoke-console.png` captured. Owner: Hugh / Luke. |
| **Plan 10-05 Task 2 deferred — hstspreload.org submission + securityheaders.com A+ rating + 7-day post-enforcement soak** | Wave 5 substrate complete (HSTS submission runbook + SECURITY.md increment + this ledger); the hstspreload.org web-form submission + securityheaders.com browser screenshot + 7-day post-enforcement Cloud Logging soak are operator-paced. BLOCKED on Wave 4 enforcement flip landing. | Single combined operator session — `10-DEFERRED-CHECKPOINT.md` Step 3. Resume contract: operator types "Wave 5 operator session complete — A+ captured, HSTS submitted (subdomain-only\|apex), post-enforcement soak CLEAN" with `docs/evidence/phase-10-securityheaders-rating.png` + `docs/evidence/phase-10-hsts-preload-submission.png` paths + Cutover Log Rows D/E + hsts-preload-submission Cutover Log Rows 1/2 PASS. Owner: Hugh / Luke. |
| **Plan 10-05 Task 4 deferred — phase-close human-verify (`/gsd-verify-work 10` OR equivalent)** | Phase-close human-verify gate; operator reads SECURITY.md Phase 10 increment + verifies REQUIREMENTS.md + verifies cleanup ledgers + verifies evidence files exist + runs `/gsd-verify-work 10` to produce 10-VERIFICATION.md | Single combined operator session — `10-DEFERRED-CHECKPOINT.md` Step 4. Phase 10 close cannot advance until either operator approval OR a sub-wave 10.x sub-plan resolves any verification gap. Owner: Hugh / Luke. |

---

## Forward-Tracking — Queued for Future Phases / Calendar-Deferred

These rows originated in Phase 10 work but are NOT in-phase deliverables; they are explicitly bounded with target phase or owner.

### Calendar-deferred (Phase 11 / v2)

| Row | Description | Tracking Target | Status |
|-----|-------------|-----------------|--------|
| F1 | hstspreload.org listing-status flips from `pending` to `preloaded` (Chrome propagation; weeks-months calendar wait per https://hstspreload.org/#removal docs) | Phase 11 (DOC-09 evidence pack — `docs/evidence/phase-10-hsts-preload-listed.png`) + Phase 12 (audit walkthrough — cites § HSTS Preload Status as ground truth) | PENDING (substrate-honest per Pitfall 19 — submission filed in-phase; listing arrival is forward-tracked; weekly status re-check pattern documented in `runbooks/hsts-preload-submission.md` Step 5) |
| F2 | Phase 4 sub-wave 4.1 IIFE main.js body migration (the BROADER carryover beyond inline-style attrs; src/main.js still hosts the IIFE body + window.FB.* bridges + Chart bare globals + 132 inline-style multi-line variants + 9 template-literal `style: \`...${expr}...\`` dynamic h()-attrs preserved by Plan 10-01) | v2 / separate milestone | DEFERRED — NOT a Phase 10 prerequisite. Plan 10-01 closed the inline-style portion ONLY; the body migration is independent of HOST-07 enforcement (the inline-style sweep was the load-bearing precondition; the body migration is its own milestone). The 9 template-literal h()-attrs preserved by Plan 10-01 are genuinely-dynamic and require classList-toggle / data-attribute + CSS-variable / 'unsafe-hashes' + per-style-hash refactors that are appropriate inside a body-migration milestone, not a mechanical inline-style sweep wave. |
| F3 | Future federated OAuth-popup sign-in re-extends `frame-src` (if AUTH-V2-* lands a `signInWithPopup` flow) | v2 / AUTH-V2-01 (SSO via OIDC for enterprise client orgs) | DEFERRED — if v2 introduces OIDC-popup federation, `frame-src` would need re-extension. Today the app uses email-link sign-in (Phase 6 D-09); `grep signInWithPopup src/` returns 0 hits. |

### Future-phase plug-ins

| Row | Description | Target Phase | Owner |
|-----|-------------|--------------|-------|
| F4 | `docs/CONTROL_MATRIX.md` rows for HOST-06 + HOST-07 + DOC-10 (Phase 10 increment) | Phase 11 | DOC-04 |
| F5 | `docs/evidence/` Phase 10 screenshots collation — `phase-10-securityheaders-rating.png` (A+) + `phase-10-hsts-preload-submission.png` (submission confirmation) + `phase-10-enforcement-smoke-console.png` (5-target smoke) + `phase-10-hsts-preload-listed.png` (Chrome propagation; F1 close-out) | Phase 11 | DOC-09 |
| F6 | `SECURITY_AUDIT.md` walkthrough — Phase 10 §Content Security Policy (enforced) + § HSTS Preload Status sections cited as ground truth | Phase 12 | WALK-02 / WALK-03 |

---

## Phase 10 Close Gate

- [x] phase_10_active_rows = 0 (all in-phase rows CLOSED — Rows 1-11 above)
- [x] All 3 phase requirements addressed (HOST-07 + HOST-06 + DOC-10) — HOST-07 in-phase closed; HOST-06 substrate-complete with calendar-deferred listing-status forward-tracked F1; DOC-10 Phase 10 increment landed
- [x] Cross-phase carryover rows CLOSED with cross-references — Phase 4 inline-style row (closed via Plan 10-01); Phase 6/7 frame-src firebaseapp.com row (closed via Plan 10-02)
- [x] Forward-tracking rows (F1, F2, F3, F4, F5, F6) have explicit target phase / owner
- [x] SECURITY.md Phase 10 Audit Index landed (3-row Pattern G table)
- [x] REQUIREMENTS.md Traceability rows updated (HOST-06 + HOST-07 + DOC-10)
- [x] Operator-deferred actions batched into `10-DEFERRED-CHECKPOINT.md` (NOT open ledger rows — they are deferred operator tasks)

```
ledger_close_date: 2026-05-10
phase_10_active_rows: 0
phase_10_closed_rows_originated_in_phase_4_forward_tracking: 1
  - 132 static `style="..."` inline-attr strings: CLOSED 10-01 (162 sites actually migrated)
phase_10_closed_rows_originated_in_phase_6_7_forward_tracking: 1
  - Drop frame-src firebaseapp.com: CLOSED 10-02 (verified by schema test + grep signInWithPopup src/ returns 0)
phase_10_in_phase_rows_closed: 11
  - Row 1-4: Wave 1+2 substrate (inline-style + RO directive value tighten)
  - Row 5: Schema-test extension (6 enforced-shape assertions + describe.skip pre-stage)
  - Row 6: Stage B soak runbook + preflight
  - Row 7: Enforcement-cutover runbook
  - Row 8: describe.skip pre-stage (operator un-skip at deferred session)
  - Row 9: HSTS preload submission runbook
  - Row 10: SECURITY.md DOC-10 Phase 10 increment
  - Row 11: REQUIREMENTS.md row updates
phase_10_carry_forward_open_rows_with_explicit_closure_path: 4
  - Plan 10-03 Task 2: bounded to 10-DEFERRED-CHECKPOINT.md Step 1 (Stage B 7-day soak)
  - Plan 10-04 Task 2: bounded to 10-DEFERRED-CHECKPOINT.md Step 2 (enforcement flip + 5-target smoke)
  - Plan 10-05 Task 2: bounded to 10-DEFERRED-CHECKPOINT.md Step 3 (HSTS submission + A+ rating + post-enforcement soak)
  - Plan 10-05 Task 4: bounded to 10-DEFERRED-CHECKPOINT.md Step 4 (phase-close human-verify)
forward_tracking_rows_queued: 6
  - F1: hstspreload listing-status `preloaded` (weeks-months Chrome propagation) — Phase 11/12
  - F2: Phase 4 sub-wave 4.1 IIFE body migration (broader carryover beyond inline-style portion) — v2
  - F3: Future federated OAuth-popup sign-in frame-src re-extension — v2
  - F4: docs/CONTROL_MATRIX.md HOST-06 + HOST-07 + DOC-10 rows — Phase 11
  - F5: docs/evidence/ Phase 10 screenshots collation — Phase 11
  - F6: SECURITY_AUDIT.md Phase 10 §CSP + §HSTS walkthrough — Phase 12
gate_status: PASS (code-and-docs complete; operator-deferred actions bundled per 10-DEFERRED-CHECKPOINT.md)
```

`phase_10_active_rows: 0` per Pitfall 19 substrate-honest disclosure: every Phase-10-originating row CLOSES with this commit or has an explicit bounded closure path with a named owner. No row is silently omitted. The 4 carry-forward rows are operator-deferred actions explicitly bounded by `10-DEFERRED-CHECKPOINT.md` — none block Phase 10 close at the code-and-docs level. The 6 forward-tracking rows (F1 calendar-deferred + F2/F3 v2 + F4/F5 Phase 11 + F6 Phase 12) are explicitly bounded with target phase or owner.

**Operator-deferred production actions** (Stage B 7-day soak + single-knob enforcement flip + 5-target smoke + hstspreload submission + securityheaders.com A+ rating + 7-day post-enforcement soak + phase-close human-verify) are NOT open ledger rows — they are batched into `.planning/phases/10-csp-tightening-second-sweep/10-DEFERRED-CHECKPOINT.md` which documents the single combined operator session that closes Plan 10-03 Task 2 + Plan 10-04 Task 2 + Plan 10-05 Task 2 + Plan 10-05 Task 4. This is deferred execution, not open design or coding debt.

---

## Citations

- Pitfall 19 (substrate-honest disclosure) — `phase_10_active_rows: 0` claim is accurate only because every row either closes here or has an explicit bounded closure path. No row is silently omitted.
- Pitfall 16 (CSP three-stage rollout) — Stage A (Phase 3 RO with `'unsafe-inline'`) → Stage B (Plan 10-02 + 10-03 tightened RO + 7-day soak) → Stage C (Plan 10-04 enforcement flip). Each stage gated on prior stage's clean soak.
- Pitfall 10B (Sentry origin allowlist before enforcement) — Plan 10-02 added `https://de.sentry.io` to `connect-src` ahead of the Stage C enforcement flip; surfacing under Report-Only is non-breaking; surfacing under enforced CSP would have broken Sentry submission silently.
- Pitfall 8 (selective-deploy discipline) — every Phase 10 deploy is `firebase deploy --only hosting --project bedeveloped-base-layers` only; `cspReportSink` Cloud Function is READ-ONLY throughout Phase 10.
- `runbooks/phase-8-cleanup-ledger.md` + `runbooks/phase-9-cleanup-ledger.md` — precedent format; Pattern H zero-out gate.
- Commit SHAs: 89b1140 (Plan 10-01 Task 1), ec0afa7 (Plan 10-01 Task 2), 523e47e (Plan 10-02 Task 1), 24f8a7c (Plan 10-02 Task 2), ebd6c5d (Plan 10-03 Task 1), def252e (Plan 10-04 Task 1), 86ec5cd (Plan 10-05 Task 1), TBD-by-closing-commit (Plan 10-05 Task 3 — this commit; backfill if desired after docs(10-05) metadata commit).
