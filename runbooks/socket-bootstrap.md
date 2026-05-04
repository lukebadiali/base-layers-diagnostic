# Socket.dev GitHub App Bootstrap Runbook

> One-shot UI step. No CLI/API path in Phase 1 scope. Closes TOOL-11.

## Prerequisites

- Repository admin access on `github.com/lukebadiali/base-layers-diagnostic`

## Steps

1. Visit https://github.com/apps/socket-security
2. Click "Configure"
3. Choose `lukebadiali` → select "Only select repositories" → choose
   `base-layers-diagnostic` → click "Install".
4. Wait for the "Installed" confirmation page.
5. Open any open or closed PR on the repo (or push a small change to `main`).
   Confirm a "Socket Security" check appears in the checks list with one of:
   passing / pending / failing-with-findings.

## Evidence

Take a screenshot of the Socket Security check appearing on a PR + the
GitHub Apps "Installed" confirmation page. Save BOTH images to:

    docs/evidence/socket-install.png

(Use a single composite image if needed — the goal is one file in the
evidence pack proving the App is installed and active.)

## Re-evaluation

If Socket.dev's behavioural rules surface false positives that block PRs
without a clear "fix it" path, document them in
`runbooks/phase-4-cleanup-ledger.md` and revisit at milestone close. Until
then, treat Socket.dev signals as advisory — they do NOT block merges
unless branch protection is configured to require the Socket Security
check (it is NOT required by `runbooks/branch-protection-bootstrap.md`;
required checks are limited to: `Lint`, `Typecheck`, `Test`,
`Security Audit`, `Build`).

## Threat model coverage

- **T-1-01 (Tampering / Supply Chain — npm production deps):** Socket.dev provides install-time behavioural detection on every dependency-update PR (post-Shai-Hulud-class supply chain attacks: detects packages that ship malicious post-install scripts, exfiltrate env vars, or reach unexpected network endpoints during install). Final layer on top of Wave 3 (npm audit + OSV-Scanner) and Wave 4 (Dependabot weekly). ASVS V14.2.1, V14.2.4. ISO 27001 A.8.8, A.8.30. SOC 2 CC8.1.

## Compliance citation

- TOOL-11 closure: install-time behavioural malicious-package detection. Socket.dev's "Supply Chain Security" model — https://docs.socket.dev/docs/about-socket
