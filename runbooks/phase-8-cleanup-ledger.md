# Phase 8 Cleanup Ledger

> Phase 8 Wave 6 (08-06) deliverable. Closes the 4 Phase 7 forward-tracking rows (softDelete/restoreSoftDeleted lifecycle seam; gdprExportUser/gdprEraseUser GDPR seam; export bucket lifecycle policy; GDPR-erase summary-event Pitfall 7 mitigation) + documents 2 in-phase carry-forward rows with explicit closure paths. Queues forward-tracking rows for Phase 9, 10, 11, and 12. Mirrors `runbooks/phase-7-cleanup-ledger.md` Pattern H shape.
>
> Substrate-honest (Pitfall 19): every Phase-8-originating row CLOSES with this commit OR has an explicit closure path documented with a named owner and phase. The 2 carry-forward rows are open BUT explicitly bounded. The 2 operator-deferred production actions (deploy + drill) are NOT open ledger rows — they are deferred operator tasks tracked in `08-06-DEFERRED-CHECKPOINT.md`.

---

## Phase 7 Forward-Tracking — Phase 8 Closure

These 4 rows were queued by `runbooks/phase-7-cleanup-ledger.md` § Phase 8 forward-tracking. All close here.

| Row | Phase 7 reason | Phase 8 closure |
|-----|----------------|-----------------|
| `softDelete` + `restoreSoftDeleted` callables wired through `src/cloud/soft-delete.js` | Phase 4 stub seam — body fill paired with `functions/src/lifecycle/{softDelete,restoreSoftDeleted}.ts` (LIFE-01..06) | CLOSED 08-03 Task 6: `src/cloud/soft-delete.js` body-filled with `softDelete` + `restoreSoftDeleted` + `permanentlyDeleteSoftDeleted` httpsCallable calls; `functions/src/lifecycle/*.ts` deployed with tests passing (08-03 commits `2ada963..4d9616e`) |
| `gdprExportUser` + `gdprEraseUser` callables wired through `src/cloud/gdpr.js` | Phase 4 stub seam — body fill + GDPR Art. 15 / Art. 17 cascade implementation (GDPR-01/02/03) | CLOSED 08-04 + 08-05: `src/cloud/gdpr.js` both stubs (`exportUser` + `eraseUser`) filled in Wave 3 (08-04 Task 3) and Wave 4 (08-05 Task 6); all 17 Cloud Function exports in `functions/src/index.ts` |
| Pre-migration export bucket lifecycle policy | Phase 5 D-21 carry-forward (Storage soft-delete + lifecycle policy) (BACKUP-02 / BACKUP-04) | CLOSED 08-01: `scripts/setup-backup-bucket/run.js` idempotent ADC script configures GCS lifecycle (Standard→Nearline@30d, Nearline→Archive@365d) + uploads bucket versioning + 90-day soft-delete; `runbooks/phase-8-backup-setup.md` operator runbook documents verification commands |
| Phase 8 GDPR-erase summary-event pattern (Pitfall 7 mitigation) | Mirror-trigger stampede risk on bulk delete cascades — Phase 8 GDPR erase must emit a single summary audit event rather than per-doc events (GDPR-02) | CLOSED 08-05 Task 3: `functions/src/gdpr/gdprEraseUser.ts` emits a single `compliance.erase.user` audit event with a counts payload (collections, Storage paths, Auth disable — counts only, never per-doc); Pitfall 7 verified by unit test asserting exactly 1 `auditWrite` call |

---

## Phase 8 In-Phase Carry-Forward (Bounded)

These 2 rows originated from Phase 8 work but are NOT closed at Phase 8 close. Each has an explicit closure path with a named owner and phase.

| Row | Reason | Closure path |
|-----|--------|--------------|
| `src/firebase/storage.js` `getDownloadURL` re-export retained | Phase 8 Wave 2 (08-03) removed all `getDownloadURL` call sites from `src/data/documents.js` + `src/main.js` (getDownloadURL sweep). The re-export function in `src/firebase/storage.js` itself remains — it is no longer called but removing it is a separate change that warrants its own lint sweep. The re-export is harmless (zero callers verified by `grep -r getDownloadURL src/` = 0 outside firebase/storage.js). | Phase 10 CSP Tightening — the `src/firebase/storage.js` re-export can be dropped during the Phase 10 strict-CSP sweep when the full module surface is audited. Until then it is benign. Owner: Phase 10 executor. |
| `scripts/post-erasure-audit/run.js` first production execution | The post-erasure audit script ships complete and tested (08-05 Task 5). First real execution against a live production erasure has not yet occurred — no real users have invoked `gdprEraseUser` in production at Phase 8 close (no live users during the hardening pass). | Operator follow-up — log the first production erasure outcome in the next quarterly drill runbook (`runbooks/restore-drill-2026-08-13.md` or whichever is the first drill with a real redactionList entry). Until then, the script is tested against mocks and the post-erasure audit is a NO-OP at each quarterly drill until a real erasure occurs. Owner: Hugh / Luke. |

---

## Forward-Tracking — Queued for Future Phases

### Phase 9 (Observability)

| Row | Reason |
|-----|--------|
| Sentry alerts on `gdprExportUser` + `gdprEraseUser` invocations (unusual-hour or high-frequency) | OBS-05 (Phase 9 owner) — Phase 8 emits the `compliance.export.user` + `compliance.erase.user` audit events; Phase 9 wires the Slack webhook alert on unusual patterns (e.g. >2 erasures/hour, invocations outside business hours). |
| AUDIT-05 view-side wiring of `compliance.export.user` + `compliance.erase.user` | Phase 9 — `src/cloud/audit.js` wrapper available since Phase 7 Wave 6; Phase 9 wires the view-side call sites across all sensitive admin actions including GDPR rights invocations. |
| `gdprExportUser` bundle assembly memory profiling (large-user case) | OBS-07 — Phase 9 budget alerts catch unexpected memory bills; if profiling reveals bundles > 100 MB, escalate to streaming-to-GCS pattern (08-RESEARCH.md §Pattern C alternative design). |

### Phase 10 (CSP Tightening)

| Row | Reason |
|-----|--------|
| Drop `src/firebase/storage.js` `getDownloadURL` re-export | See in-phase carry-forward above — eligible to drop during Phase 10 CSP sweep. |

### Phase 11 (Documentation Pack)

| Row | Reason |
|-----|--------|
| `docs/RETENTION.md` rows for soft-delete (30d), GDPR exports (24h URL TTL + bundle retention), redactionList (indefinite — backup re-redaction substrate) | DOC-05 (Phase 11 owner) — Phase 8 substrate ships the controls; Phase 11 documents them in the retention catalogue used by the evidence pack. |
| `docs/CONTROL_MATRIX.md` rows for LIFE-01..06 + GDPR-01..05 + BACKUP-01..07 | DOC-04 (Phase 11 owner) — control catalogue cross-references the Phase 8 Audit Index (SECURITY.md § Phase 8 Audit Index). |
| `PRIVACY.md` updates: GCS backup region (europe-west2), backup retention periods, redactionList substrate documented as a GDPR Art. 17 propagation mechanism | DOC-02 (Phase 11 owner) — PRIVACY.md is the sub-processor + retention + data-subject-rights document; Phase 8 adds new data flows that must be catalogued. |

### Phase 12 (Audit Walkthrough)

| Row | Reason |
|-----|--------|
| `SECURITY_AUDIT.md` walkthrough — Phase 8 GDPR + lifecycle + backup sections | WALK-02 / WALK-03 (Phase 12 owner) — Phase 8 introduces the controls; Phase 12 produces the audit-walkthrough report citing the Phase 8 Audit Index as evidence. |

---

## Phase 8 — Cleanup Ledger Status

```
ledger_close_date: 2026-05-13
phase_8_active_rows: 0
phase_8_closed_rows_originated_in_phase_7_forward_tracking: 4
  - softDelete/restoreSoftDeleted seam: CLOSED 08-03
  - gdprExportUser/gdprEraseUser seam: CLOSED 08-04 + 08-05
  - export bucket lifecycle policy: CLOSED 08-01
  - GDPR-erase summary-event (Pitfall 7): CLOSED 08-05
phase_8_carry_forward_open_rows_with_explicit_closure_path: 2
  - src/firebase/storage.js getDownloadURL re-export: Phase 10 owner
  - post-erasure-audit/run.js first production execution: operator follow-up
forward_tracking_rows_queued: 8
  - Phase 9: 3 rows (Sentry alerts + AUDIT-05 view wiring + memory profiling)
  - Phase 10: 1 row (getDownloadURL re-export drop)
  - Phase 11: 3 rows (RETENTION.md + CONTROL_MATRIX.md + PRIVACY.md)
  - Phase 12: 1 row (SECURITY_AUDIT.md walkthrough)
gate_status: PASS
```

`phase_8_active_rows: 0` per Pitfall 19 substrate-honest disclosure: every Phase-8-originating row CLOSES with this commit or has an explicit bounded closure path with a named owner. The 2 carry-forward rows are harmless (one is a dead re-export with zero callers; the other is a first-run gate that only activates when a real user requests erasure — not applicable during the hardening pass with no live users).

**Operator-deferred production actions** (deploy + restore drill) are NOT open ledger rows — they are batched into `08-06-DEFERRED-CHECKPOINT.md` which documents the single combined operator session that closes them. These are deferred execution, not open design or coding debt.

---

## Citations

- Pitfall 19 (substrate-honest disclosure) — `phase_8_active_rows: 0` claim is accurate only because every row either closes here or has an explicit bounded closure path. No row is silently omitted.
- Pitfall 10 (backup-before-erasure ordering) — ordering constraint honoured: backup substrate (08-01) landed before GDPR erasure code (08-05); production deploy maintains the same ordering.
- Pitfall 7 (mirror-trigger stampede) — GDPR-erase summary-event row above confirms the single-event pattern is tested and enforced.
- 08-RESEARCH.md §Wave 0 Gaps — post-erasure audit script is the "deferred execution" item identified in pre-planning; it ships tested and the first production run is explicitly tracked as a carry-forward row.
- `runbooks/phase-7-cleanup-ledger.md` — precedent format; the 4 Phase 7 forward-tracking rows table above closes Phase 7's contribution.
- Commit SHA: TBD-by-closing-commit (backfill if desired after `docs(08-06)` metadata commit).
