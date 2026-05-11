# Phase 8 — Restore Drill Quarterly Cadence

> **Requirement:** BACKUP-06 — quarterly restore-drill cadence documented in runbooks/
> **Phase:** 8 — Data Lifecycle (Soft-Delete + GDPR + Backups)
> **Authored:** 2026-05-10 (Phase 8 Wave 6 close)
> **Owner:** Hugh Dawson + Luke Badiali (BeDeveloped)

---

## Purpose

This document establishes the mandatory quarterly cadence for Firestore restore drills. The first drill was performed on 2026-05-13 (see `runbooks/restore-drill-2026-05-13.md`). Subsequent drills follow the schedule below. Each drill produces a new runbook file.

The cadence satisfies BACKUP-06 and keeps BACKUP-07 evidence current. Without quarterly drills, backup coverage is theoretical, not demonstrated — which is insufficient for the compliance-credible posture this milestone targets (see `.planning/PROJECT.md` "Compliance bar").

---

## Drill Schedule

| Drill | Target date | Status |
|-------|-------------|--------|
| Q2-2026 (milestone close) | 2026-05-13 | See `runbooks/restore-drill-2026-05-13.md` |
| Q3-2026 | 2026-08-13 | Scheduled |
| Q4-2026 | 2026-11-13 | Scheduled |
| Q1-2027 | 2027-02-13 | Scheduled |
| Q2-2027 | 2027-05-13 | Scheduled |

Subsequent drills: every 90 days from the prior drill date. Adjust for bank holidays or operator availability by ±7 days; document the adjustment in the drill runbook header.

---

## Trigger

1. Calendar reminder set on `business@bedeveloped.com` Google Calendar for each scheduled date above (owner: Hugh Dawson).
2. Paired review: Hugh and Luke are both present (or both review the output). Neither operator conducts a solo drill — the two-person requirement ensures independent spot-check of the restored data.
3. If neither operator is available within ±7 days of a scheduled date, escalate (see §Escalation below).

---

## Procedure

Repeat the steps in `runbooks/restore-drill-2026-05-13.md`. Specifically:

1. **Verify pre-conditions** — PITR still enabled; backups bucket has ≥ 1 export within the last 7 days; operators have `roles/datastore.owner`.
2. **Choose snapshot timestamp** — a whole-minute timestamp ≤ 7 days old.
3. **Trigger PITR clone** (Path A) or GCS export → staging import (Path B if staging project exists). Time the operation.
4. **Spot-check restored data** — count orgs/messages/documents; verify structure matches production at snapshot time.
5. **Re-redaction step (GDPR-05)** — read `redactionList/{*}` from production; for each entry, re-apply tombstones to the clone; run `scripts/post-erasure-audit/run.js` against the clone to confirm zero residual PII.
6. **Delete drill database** — confirm production untouched.
7. **Author runbook** — create `runbooks/restore-drill-<YYYY-MM-DD>.md` from the template in `runbooks/restore-drill-2026-05-13.md`, filling in actual timings + outputs + gaps found.
8. **Commit and push** — commit the new runbook file with message `docs: restore-drill-<YYYY-MM-DD> BACKUP-07 evidence`.

---

## Required Outcomes Per Drill

Each quarterly drill must achieve ALL of the following to count as PASS:

- [ ] PITR clone or GCS import succeeds: exit code 0
- [ ] Elapsed time from clone-start to data-confirmed ≤ 60 minutes (RTO target)
- [ ] Spot-check confirms ≥ 1 org document with expected structure
- [ ] Re-redaction step executed: either NO-OP (redactionList empty) or tombstones re-applied and post-erasure audit script exits 0 against the clone
- [ ] Drill database deleted post-drill
- [ ] Runbook authored + committed to main with ISO-8601 timestamps (no `<TBD>` placeholders)
- [ ] Both operators reviewed and signed off in the runbook

---

## Escalation

If a scheduled drill is missed (no runbook committed within 7 days of the due date):

1. **Treat as a P1 incident** — open an issue in the GitHub repo tagged `compliance-gap`.
2. **Root-cause** — identify why the drill was missed (operator unavailable, PITR disabled, bucket missing, etc.).
3. **Re-drill within 7 days** — execute the drill as soon as the blocking condition is resolved.
4. **Document the gap** — include a "Missed drill" section in the recovered drill's runbook noting original due date, actual date, root cause, and gap window.
5. **Assess control coverage** — if PITR was disabled or the backups bucket had no export, assess whether any data recovery coverage gap occurred and document it as a potential incident.

The escalation path is: Hugh → Luke → (future BeDeveloped ops lead if headcount grows).

---

## Path B — GCS Export → Staging

When `bedeveloped-base-layers-staging` project is provisioned (Phase 11 or later):

1. Identify most recent backup: `gcloud storage ls gs://bedeveloped-base-layers-backups/firestore/ | tail -1`
2. Import into staging: `gcloud firestore import gs://<most-recent-dir> --project=bedeveloped-base-layers-staging`
3. Spot-check + re-redaction + cleanup as in Path A.

Path B exercises the GCS export pipeline (BACKUP-01, BACKUP-02) in addition to PITR (BACKUP-03). Rotate between Path A and Path B across quarterly drills once staging exists — alternating confirms both recovery paths work.

---

## GDPR-05 Re-Redaction Reference

After restore, the cloned database reflects state at the snapshot timestamp. Users erased after that timestamp have no tombstones in the clone. To prevent a restored database from being used with un-erased PII:

1. Read all docs from `redactionList` in production (default DB).
2. For each `{userId, tombstoneToken}` entry, re-apply the tombstone to the clone using the same field patch map as `eraseCascade.ts` (see `functions/src/gdpr/eraseCascade.ts`).
3. Run `scripts/post-erasure-audit/run.js --uid=<userId>` (modified to target clone DB) for each entry; expect exit 0.
4. If `post-erasure-audit` exits 1 (residual PII found), treat as P1 incident.

The operator MAY skip re-redaction ONLY IF redactionList is verifiably empty at drill time AND documented as NO-OP in the runbook.

---

## Citations

- BACKUP-06 — Quarterly restore-drill cadence documented in runbooks/
- BACKUP-07 — One restore drill performed and documented; each quarterly drill refreshes this evidence
- GDPR-05 — Erasure propagation to backups; re-redaction step above
- 08-RESEARCH.md §Pattern 3 — PITR clone commands
- Pitfall 10 — Backup substrate must be live before GDPR erasure runs; drill confirms substrate is operational
- Pitfall 19 — Substrate-honest disclosure: only claim the drill was done when the runbook + commit exist
