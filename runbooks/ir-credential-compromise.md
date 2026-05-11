# Credential Compromise — Incident Response Runbook

> Phase 11 Wave 4 deliverable (DOC-06). Skeleton — operator fills detail at first use. The structure below is the same shape as `runbooks/phase6-mfa-recovery-drill.md` (Tier-1 / Tier-2 / Failure-Mode Triage / Citations). Linked from `docs/IR_RUNBOOK.md ## Scenario 1`.

**Trigger:** Slack alert from `authAnomalyAlert` Rule 1 (auth-fail burst) OR Rule 3 (role escalation), OR direct report from internal user, OR Sentry error spike on `auth.*` events.

**Owner (default):** Hugh (BeDeveloped on-call). Escalation: notify Luke + George within 1 hour.

**Severity:** Critical if admin account; High if internal non-admin; Medium if anonymous-bound.

**Last reviewed:** 2026-05-10 (Phase 11 Wave 4 — skeleton; operator fills on first use)

---

## Pre-conditions

- [ ] Operator has `firebase` CLI authenticated to `bedeveloped-base-layers` project (`firebase use bedeveloped-base-layers` returns green; `firebase login:list` shows current user).
- [ ] Operator has Firebase Console access at https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/users (admin role).
- [ ] Operator has Cloud Logging access at https://console.cloud.google.com/logs/query?project=bedeveloped-base-layers (Logs Viewer role minimum; Logs Configuration Writer for retention queries).
- [ ] Operator can paste-ready issue an OOB identity-verification call to the locked-out / suspected-compromised user (voice or video; per Pitfall 7).
- [ ] Slack `#ops` channel access for status updates.

## Decision tree

1. **Confirm compromise.** Review the Slack alert payload + the underlying audit-log entries from `authAnomalyAlert`. Confirming signals: anomalous source IP (geolocation outside operator pattern), off-hours role escalation, MFA disenrol followed by sensitive action within 10 minutes, multiple auth-fail bursts from same IP across multiple UIDs. If multiple confirming signals → continue; if single weak signal → record + monitor + escalate to Luke if it recurs within 1h.

2. **Disable affected user.** Via Firebase Console → Authentication → Users → row → Disable user. For batch (multiple UIDs) issue `firebase auth:export users-snap.json` → mark disabled in JSON → `firebase auth:import users-snap.json --hash-algo=<algo>`. **Capture:** UID + disable timestamp into the RCA template Timeline.

3. **Revoke all sessions.** `firebase auth:revoke-tokens <uid>` — invalidates all refresh tokens. Client app will force re-sign-in on next ID-token refresh (max 1h window per Firebase default; see `src/firebase/auth.js` for the project's idTokenChanged handler). For an immediate-effect scenario, also delete the `users/{uid}` Firestore doc's session-bound state (currently no such field — but if added in v2, clear here).

4. **Audit-log review (24h prior).**
   ```bash
   gcloud logging read 'jsonPayload.event=~"role|mfa|gdpr|delete" AND jsonPayload.actorUid="<UID>"' \
       --project=bedeveloped-base-layers \
       --freshness=24h --limit=200 --format=json > /tmp/compromise-audit.json
   ```
   Review for: role-escalation events (Phase 9 Anomaly Rule 3), MFA disenrol followed by sensitive action, cross-org reads, document downloads, GDPR export/erase callable invocations. **Capture:** event-IDs + counts into the RCA template Blast Radius.

5. **Re-enable + re-issue credentials.** Per Phase 6 D-07 supersession: email-link recovery is the canonical path (see `runbooks/phase6-mfa-recovery-drill.md` Tier 1). If email itself is compromised → Tier 2 Admin SDK un-enrol via `scripts/admin-mfa-unenroll/run.js`. Generate fresh email-link with new MFA enrolment requirement.

6. **Post-incident.** Capture full timeline; fill the RCA template (see `docs/IR_RUNBOOK.md ## RCA template`); update this runbook's "lessons learned" section if any decision-tree step needed manual judgement.

## Failure-Mode Triage

| Failure | Cause | Recovery |
|---------|-------|----------|
| `auth:revoke-tokens` returns "user not found" | UID typo or already deleted | Verify with `firebase auth:export` |
| Slack webhook delivered but operator missed the alert | Slack channel notification routing | Check `runbooks/phase-9-monitors-bootstrap.md` Step 4; escalate to phone/SMS pager in v2 |
| Disable user via Console fails with permission error | Operator lacks Firebase Auth Admin role | Switch operator account; verify via `firebase login:list` |
| Audit-log query returns zero results | actorUid spelling drift OR retention window exceeded | Re-query without actorUid filter; if 12mo+ check BigQuery archive sink |
| Cannot identify the entry point (auth-fail burst with no successful auth) | Pure probing, no actual compromise | Demote severity from Critical to Medium; document IOC; route to F-OBS-ROT row for IP-block list |

## Comms template

See `docs/IR_RUNBOOK.md ## Comms templates`. Internal (Slack `#ops`) message at confirmation; customer-facing (GDPR Art. 33 — 72h window) ONLY if personal-data was confirmed exfiltrated.

## RCA template

See `docs/IR_RUNBOOK.md ## RCA template`. Fill within 30 days of containment; commit to `docs/evidence/incidents/IR-<NN>-rca.md` (PII redacted per the template guidance).

## Citations

- SECURITY.md § Authentication & Sessions (per-user Firebase Auth Email/Password + claims-based authorisation)
- SECURITY.md § Multi-Factor Authentication (TOTP enrolment baseline)
- SECURITY.md § Anomaly Alerting (OBS-05 — `authAnomalyAlert` 3-rule wiring)
- SECURITY.md § Audit Log Infrastructure (12-month hot retention + 7-year BigQuery archive)
- runbooks/phase6-mfa-recovery-drill.md (Tier 2 Admin SDK un-enrol script)
- runbooks/phase-9-monitors-bootstrap.md (alert wiring — Slack webhook + filter rules)
- OWASP ASVS L2 v5.0 V2.x (Authentication) + V7.x (Logging)
- ISO/IEC 27001:2022 Annex A.5.24 (incident management) + A.5.25 (assessment + decision)
- SOC 2 CC7.3 (Security incident response)
- GDPR Art. 33 (Breach notification — 72-hour rule; applies only when personal data is confirmed exfiltrated)
