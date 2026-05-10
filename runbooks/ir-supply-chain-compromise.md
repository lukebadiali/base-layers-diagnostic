# Supply-Chain Compromise — Incident Response Runbook

> Phase 11 Wave 4 deliverable (DOC-06). Skeleton — operator fills detail at first use. Linked from `docs/IR_RUNBOOK.md ## Scenario 4`. The proactive detection layer is `runbooks/socket-bootstrap.md`; this runbook covers the response when detection fires.

**Trigger:** Socket.dev install-time alert (the proactive layer per `runbooks/socket-bootstrap.md`); OR gitleaks ping indicating a leaked secret in repo; OR an unexpected GitHub Actions run (workflow file change OR an unauthorised workflow_dispatch); OR a Shai-Hulud-style IOC match in the `node_modules/` install graph.

**Owner (default):** Hugh.

**Severity:** Default Critical until scope confirmed bounded — supply-chain compromise has the largest blast-radius surface (every developer machine + every CI runner + every production deploy could carry the compromised code).

**Last reviewed:** 2026-05-10 (Phase 11 Wave 4 — skeleton; operator fills on first use)

---

## Pre-conditions

- [ ] Operator can pause `main` deploys via GitHub Actions → workflow disable (immediate kill switch).
- [ ] Operator has access to Sentry org settings (DSN rotation), Slack workspace admin (webhook URL rotation), Firebase IAM + GCP IAM (OIDC binding rotation).
- [ ] Operator can run `npm ls` + inspect `node_modules/.package-lock.json` integrity locally.
- [ ] Operator has access to the Socket.dev dashboard (https://socket.dev/) for alert detail.

## Decision tree

1. **Halt CI deploys immediately.**
   ```bash
   gh workflow disable deploy.yml --repo bedeveloped/base-layers-diagnostic
   gh workflow disable hosting-deploy.yml --repo bedeveloped/base-layers-diagnostic
   ```
   Confirm with `gh workflow list`. **Capture** timestamp into the RCA template.

2. **Identify the suspect package.** From the Socket.dev alert payload OR the gitleaks line OR the unexpected Actions log. Pin down: exact package name + version + sub-dependency chain. Run:
   ```bash
   npm ls <suspect-package>
   ```
   to surface every transitive path that introduces it. Cross-reference Shai-Hulud IOC list (https://github.com/advisories?query=Shai-Hulud) if applicable.

3. **Audit `node_modules` integrity.**
   ```bash
   # Verify lockfile-against-registry parity
   npm ci --dry-run > /tmp/npm-ci-dry.log 2>&1
   # Compare resolved-tarball hashes against the published-on-registry hashes
   # (npm@10+ verifies this implicitly during npm ci — non-zero exit = mismatch)
   ```
   If integrity mismatch → the local install graph has been tampered (file or registry-poisoning). Quarantine `node_modules/` + `package-lock.json` for forensic capture; do NOT push.

4. **Revoke any potentially-exposed tokens.** Treat this as a fan-out — assume blast radius covers every secret the compromised package could see during its install or runtime:
   - **Sentry DSN.** Rotate via Sentry org settings → Project → Client Keys (DSN) → revoke + new. Push new DSN to GitHub Secrets → re-run deploy after Step 7.
   - **Slack `#ops` webhook URL.** Rotate via Slack workspace admin → Apps → Incoming Webhooks → Revoke + create new. Push new URL to Firebase Functions secrets via `firebase functions:secrets:set SLACK_WEBHOOK_URL`.
   - **GitHub OIDC bindings.** Inspect WIF identity pool bindings — see `runbooks/firebase-oidc-bootstrap.md` for the canonical layout. If the compromised package ran inside Actions, treat the OIDC token claim as potentially logged; rebind via service account if uncertain.
   - **GDPR_PSEUDONYM_SECRET.** Per SECURITY.md § Rotation Schedule — rotate annually and on-leak. If the supply-chain compromise had code-read access to Functions environment → rotate.
   - **Firebase Auth admin credentials.** No long-lived JSON service-account keys are used (per SECURITY.md § Rotation Schedule); WIF binding only. No rotation needed at this layer unless an alternative key was created out-of-band.

5. **Pivot — was the package executed in production?**
   - **No (dev-only / build-time):** Blast radius bounded to developer machines + CI runners. Cleanup focuses on local dev environments + CI cache invalidation.
   - **Yes (runtime):** Treat as a code-level compromise. Audit `src/` + `functions/src/` for unexpected egress endpoints (grep for new `fetch(` / `https://` calls against `git log` since the suspect package landed). Audit the deployed `dist/` bundle for the same.

6. **Replace the suspect package.**
   - **Reachable + maintained alternative exists:** `npm uninstall <suspect>` + `npm install <alternative>` + adapt callers.
   - **Reachable + no alternative + Critical:** fork the package locally to a `vendor/` directory + import from there (escape the npm distribution path for that lib until upstream cleans up).
   - **Unreachable / dev-only:** Remove the dependency entirely if possible; pin to last-known-clean version otherwise.

7. **Restart deploys + verify.** Re-enable workflows; trigger a manual deploy with the cleaned lockfile + rotated secrets:
   ```bash
   gh workflow enable deploy.yml
   gh workflow enable hosting-deploy.yml
   gh workflow run deploy.yml --ref main
   ```
   Confirm: deploy green + Sentry receives events from new DSN + Slack receives an authAnomalyAlert from new webhook URL (synthetic event per `runbooks/phase-9-monitors-bootstrap.md`).

8. **Forensic capture.** Quarantined `node_modules/` + `package-lock.json` from Step 3 → commit to a `docs/evidence/incidents/IR-<NN>-supply-chain-quarantine/` directory (git LFS or sized-down to lockfile + per-package READMEs). Submit to Socket.dev if novel IOC; submit to GitHub Advisory Database if not already listed.

## Failure-Mode Triage

| Failure | Cause | Recovery |
|---------|-------|----------|
| Can't disable workflow (lack permission) | Operator role insufficient | Escalate to repo admin (Luke / George) within 5 min; do NOT attempt manual deploy in meantime |
| `npm ci` reports lockfile mismatch on clean clone | Original lockfile was poisoned | Re-resolve from scratch: delete lockfile → `npm install` → manual diff package-lock.json vs prior known-clean version (last commit before suspect-package introduction) |
| Sentry DSN rotation breaks running app | Cached DSN in deployed bundle | Force rebuild + redeploy after rotation; check `dist/` hash differs |
| Slack webhook rotation breaks `authAnomalyAlert` | Secret not yet propagated to Functions | Re-run `firebase functions:secrets:set` + re-deploy the affected function |
| Multiple alerts from Socket.dev simultaneously | Bulk advisory day OR scanner over-fitted | Triage one-at-a-time; if 5+ unique packages → escalate Critical (potential targeted attack on this repo's dep tree) |
| Shai-Hulud-style IOC match but Socket.dev didn't catch it | Detection signature drift | File a Socket.dev support ticket with the IOC; document the gap in a Phase 11 forward-tracking row |

## Comms template

Internal-only at detection; if confirmed runtime execution + any data class affected → customer-facing per GDPR Art. 33 (72h notification window). See `docs/IR_RUNBOOK.md ## Comms templates`.

## RCA template

Full RCA per `docs/IR_RUNBOOK.md ## RCA template` is required for any supply-chain incident — even dev-only-bounded — because of the regulator-interest and the v2-prevention-loop value. Include an SBOM diff (suspect-package introduction commit → resolution commit) as an appendix.

## Citations

- SECURITY.md § Build & Supply Chain (Socket.dev + gitleaks + OIDC-only secrets)
- runbooks/socket-bootstrap.md (proactive install-time detection — the input to this runbook)
- runbooks/firebase-oidc-bootstrap.md (WIF binding canonical layout for rotation Step 4)
- runbooks/phase-9-monitors-bootstrap.md (alert verification synthetic event in Step 7)
- OWASP ASVS L2 v5.0 V14.2.x (Dependency management) + V14.1.x (Build pipeline integrity)
- ISO/IEC 27001:2022 Annex A.8.30 (Outsourced development controls) + A.5.21 (Information security in supplier relationships)
- SOC 2 CC8.1 (Change management)
- GDPR Art. 33 (Breach notification — 72-hour rule; applies only when personal data confirmed exfiltrated)
- CISA Software Bill of Materials (SBOM) guidance (https://www.cisa.gov/sbom)
