# Org-Level Diagnostic + Client Action Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One diagnostic answer sheet per organisation per round (account dimension removed), org/account picker clicks land on the dashboard, and clients can toggle action completion via a rules-safe actions subcollection.

**Architecture:** Local model drops the account key: `org.responses[roundId][pillarId][idx]`. Firestore responses become one doc per `(round, pillar)`; old 3-part docs are ignored (clean wipe). Actions move from the org doc's array to `orgs/{orgId}/actions/{id}` docs with per-field rules so clients may only flip completion fields. Views keep their current look minus the Team-responses panel and "respondents" stats.

**Tech Stack:** Vanilla JS (IIFE in `src/main.js` + `domain/*` modules), Firebase JS SDK v12, Vitest 4 (jsdom view tests, emulator rules tests via `npm run test:rules` — needs Java on PATH: `~/scoop/apps/temurin-lts-jdk/current/bin`).

## Global Constraints

- Conventional Commits; no emojis in commits or source.
- `domain/*` imports nothing from Firebase (lint-enforced).
- Diagnostic writes stay internal-only; clients view-only. Client action writes limited to `done`, `completedAt`, `completedBy` on non-internal actions.
- Snapshot fixture is `tests/fixtures/snapshot-org.json`; view snapshots under `tests/__snapshots__/views/`.
- Run `npx eslint <changed files>` + `npm run typecheck` before each commit (pre-commit hook covers lint only).
- Sequencing: rules + code land in ONE squash PR (CI deploys hosting+rules together).

---

### Task 1: Domain layer — org-level keying

**Files:**
- Modify: `src/domain/scoring.js` (pillarScoreForRound loses `userId` param; delete `respondentsForRound`, `answeredCount`)
- Modify: `src/domain/completion.js` (delete `userCompletionPct` if `grep -rn userCompletionPct src tests` shows no live use)
- Test: `tests/domain/scoring.test.js` (reshape fixtures)

**Interfaces:**
- Produces: `pillarScoreForRound(org, roundId, pillarId, DATA, questionMeta)` — reads `org.responses[roundId][pillarId][idx].score`; returns number|null. `pillarScore` unchanged signature minus account. `answerSummaryForPillar` (wherever defined — locate with `grep -n "function answerSummaryForPillar"`) becomes `(org, pillarId)` reading the same shape.

- [ ] Reshape `tests/domain/scoring.test.js` fixtures from `responses[round][user][pillar]` to `responses[round][pillar]`; drop respondents tests; run — expect FAIL.
- [ ] `pillarScoreForRound`: `const perPillar = (org.responses || {})[roundId] || {}; const perQ = perPillar[pillarId] || {};` then the existing per-question normalize loop (delete the `perUsers` aggregation).
- [ ] Run `npx vitest run tests/domain/` — PASS. Commit `refactor(domain): org-level response keying in scoring/completion`.

### Task 2: main.js response paths + fixtures + view tests

**Files:**
- Modify: `src/main.js` — sites (line numbers at branch point 2957f47): wrappers ~459–472; dashboard tile read ~1979 + `respondentsForRound` ~1466; `answerSummaryForPillar` calls ~1590, ~2722 area; `renderQuestion` ~2192; team panel ~2122 + `renderTeamResponses` ~2247 (delete both); `renderScoreBlock` ~2284; `setResponse` ~2325; report respondents ~2721; admin respondents ~2939; `viewedAccountId`/`firstAccountId` ~921–938 (delete; KEEP `accountsForOrg`); `cloudPushResponse` ~3286; responses listener ~3372.
- Modify: `tests/fixtures/snapshot-org.json`, `tests/__snapshots__/views/*.html`
- Modify: `tests/views/diagnostic-new-org.test.js`, `tests/views/diagnostic-client-readonly.test.js`
- Create: `tests/views/diagnostic-org-level.test.js`

**Interfaces:**
- Produces: `setResponse(user, org, pillarId, idx, patch)` (user kept for audit fields only); `cloudPushResponse(orgId, roundId, pillarId, idx, value)`, respId `` `${roundId}__${pillarId}` ``, doc `{ orgId, roundId, pillarId, values, updatedAt }` (no `userId`).
- Listener mapping: 2-part id parse; `if (data.userId || parts.length === 3) return;` — that skip IS the wipe.

- [ ] New test `diagnostic-org-level.test.js` (boot pattern from `diagnostic-client-readonly.test.js`): (a) internal user with `state.accountId` set to each of two accounts sees the SAME `sel` highlights; (b) `startNewRound`-equivalent (click "+ New" round button) yields blank likert while old round data remains in localStorage under its roundId. Run — FAIL.
- [ ] Apply main.js edits: read path `((org.responses[activeRoundId(org)] || {})[p.id] || {})[idx]`; write path drops acct level; delete team panel + respondents UI ("Respondents" report row and admin "· N respondents" suffix removed entirely).
- [ ] Reshape fixture: `"responses": { "r_round-1": { "1": {...} }, "r_round-2": {...} }` — move `u_client-a`'s buckets up one level; delete other account buckets.
- [ ] `npx vitest run tests/views/ tests/domain/` — snapshot diffs expected: review that diffs are ONLY team-panel/respondents removals, then `npx vitest run tests/views -u`. PASS. Commit `feat(diagnostic): one org-level answer sheet per round`.

### Task 3: Scope picker — org row click navigates

**Files:**
- Modify: `src/ui/chrome.js` (~line 313 `scope-org-btn` onclick — currently only toggles flyout)
- Test: `tests/ui/chrome.test.js`

- [ ] Test: clicking `.scope-org-btn` for an org sets `state.orgId`, `state.route === "dashboard"`, `state.scopeOpen === false`, `state.accountId === null`. Chevron element retains a separate handler that ONLY toggles the flyout (add `.scope-chevron` click stopPropagation handler). Account-click test already exists (asserts dashboard) — keep. Run — FAIL.
- [ ] Implement: org label click = `{ state.orgId = o.id; state.accountId = null; state.viewRoundId = null; state.route = "dashboard"; state.scopeOpen = false; render(); }`; chevron click = `(e) => { e.stopPropagation(); /* toggle this org's flyout-open state */ }` (flyout open-state: reuse existing active-org flyout logic — flyout shows for the active/hovered org; keep CSS as-is).
- [ ] `npx vitest run tests/ui/chrome.test.js` PASS. Commit `feat(chrome): org row click selects org and opens dashboard`.

### Task 4: Actions subcollection + client completion

**Files:**
- Modify: `src/main.js`: `addAction` ~2348, `updateAction` ~2369, `deleteAction` ~2376, `renderActionRow` ~2450 (client-mode: checkbox enabled; title/owner/due inputs read-only; delete button internal-only — check current markup first), org hydrate site (where `_subscribeOrg` callback lands org docs, ~4365) for one-shot migration, new `cloudPushAction`/`cloudDeleteAction`/`subscribeActions` next to `cloudPushResponse`/responses listener.
- Test: `tests/views/actions-client-toggle.test.js` (new)

**Interfaces:**
- Produces: action doc `{ orgId, pillarId, title, owner, due, done, internal, createdAt, createdBy, completedAt, completedBy }` at `orgs/{orgId}/actions/{actionId}`; `updateAction(id, patch)` unchanged signature — internally routes client patches as `{done, completedAt: iso()|null, completedBy: user.id|null}` merge only.
- Migration: in `_subscribeOrg` onData — `if (isInternalSession && Array.isArray(orgDoc.actions) && orgDoc.actions.length) { orgDoc.actions.forEach(a => setDoc(actions/{a.id}, {...a, orgId})); updateDoc(org, { actions: firestore.deleteField() }); }` — array presence is the one-shot guard; setDoc by stable `a.id` makes re-runs idempotent.
- Client reads: query `where("internal", "==", false)`; internal: whole collection. Listener rebuilds `org.actions` sorted `createdAt` desc (preserves current unshift-newest ordering).

- [ ] Test (jsdom, FB stubbed off): client boot → Action plan → click checkbox → row moves to Completed section and localStorage org reflects `done: true`; title input has `disabled`; no delete button. Internal boot → full edit still works. Run — FAIL.
- [ ] Implement local + cloud paths and render changes. New actions written on `addAction` must set `internal` explicitly (`false` default) so the client query matches.
- [ ] `npx vitest run tests/views/` PASS (snapshot review if action markup changed → `-u` after eyeballing). Commit `feat(actions): client done-toggle; actions move to subcollection`.

### Task 5: firestore.rules + emulator tests

**Files:**
- Modify: `firestore.rules` responses block (lines ~69–85) + new actions block after it
- Modify: `tests/rules/responses.test.js`; Create: `tests/rules/actions.test.js`

Responses block replacement:
```
match /responses/{respId} {
  allow read:   if inOrg(orgId);
  allow create: if isInternal()
                && request.resource.data.orgId == orgId;
  allow update: if isInternal()
                && immutable("orgId")
                && mutableOnly(["values", "updatedAt"]);
  allow delete: if false;
}
```

Actions block (new):
```
match /actions/{actionId} {
  allow read:   if inOrg(orgId)
                && (isInternal() || resource.data.internal == false);
  allow create: if isInternal()
                && request.resource.data.orgId == orgId;
  allow update: if (isInternal()
                    && immutable("orgId")
                    && immutable("createdAt"))
                || (inOrg(orgId)
                    && resource.data.internal == false
                    && mutableOnly(["done", "completedAt", "completedBy"]));
  allow delete: if isInternal();
}
```

- [ ] `responses.test.js`: retarget to 2-part respId/no-userId shape (internal create/update allowed; client write denied; cross-org internal? follow existing test's tenancy cases). `actions.test.js`: client toggle done on non-internal action ALLOWED; client title change DENIED; client toggle on `internal: true` action DENIED; client create DENIED; client read of internal action DENIED (and list query without `internal == false` filter DENIED); internal full edit ALLOWED.
- [ ] `$env:PATH = "$HOME\scoop\apps\temurin-lts-jdk\current\bin;$env:PATH"; npm run test:rules` — PASS (re-run once if rate-limit.test.js minute-rollover flake hits). Commit `feat(rules): org-level responses shape; actions subcollection with client done-toggle`.

### Task 6: Verification + ship

- [ ] Full targeted sweep: `npx vitest run tests/domain tests/views tests/ui`; `npm run lint`; `npm run typecheck`; `npm run test:rules`.
- [ ] Push `feat/org-level-diagnostic`; `gh pr create` (base main, reviewer lukebadiali, body summarising spec; note clean-wipe + follow-up purge script). Watch checks (`gh pr checks --watch`).

## Self-Review Notes

- Spec coverage: data model→T1/T2/T5; navbar→T3; actions→T4/T5; wipe→T2 listener skip + T5 rules; testing section→each task + T6. Out-of-scope items have no tasks (correct).
- Line numbers are anchors at 2957f47, not gospel — re-grep before editing.
- `startNewRound` already creates blank `responses[roundId] = {}` — round independence needs no code change, only the T2 test proving it.
