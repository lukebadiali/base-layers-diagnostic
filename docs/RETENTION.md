# Retention & Threshold Policies

This document captures retention windows, throttling thresholds, and other
operational policies whose values are operator-tunable. Phase 11 (DOC-05)
owns the comprehensive retention manifest; earlier phases append the rows
they own as they land.

Every row below carries the same five-axis structure:

- **Retention period** — how long the data class persists in its primary store.
- **Basis** — the rationale (legal / operational / compliance).
- **Deletion mechanism** — how the data leaves the primary store (cascade /
  scheduled / manual / GDPR Art. 17 erasure / lifecycle transition).
- **Threat coverage** — the OWASP / ASVS / GDPR / STRIDE row this retention
  window mitigates.
- **Implementation cross-reference** — the code path(s) + test(s) where the
  retention behaviour is enforced and verified.

Cross-document anchors: see `PRIVACY.md § 4. Retention` for the customer-facing
summary; see `SECURITY.md § Data Lifecycle (Soft-Delete + Purge)`,
`SECURITY.md § GDPR (Export + Erasure)`, `SECURITY.md § Backups + DR + PITR +
Storage Versioning`, and `SECURITY.md § Audit Log Infrastructure` for the
upstream policy detail.

## Org + User data (Phase 8) — LIFE-02 + GDPR-02

**Retention period**: while the engagement is active (no fixed maximum); a
**30-day soft-delete** restore window starts when an operator soft-deletes an
org or a user soft-deletes their account; permanent deletion occurs on the
**Day-30 sweep** by the `permanentlyDeleteSoftDeleted` scheduled Cloud
Function, OR on operator-initiated `gdprEraseUser` callable (Phase 8 GDPR-02,
Art. 17) for an individual user erasure ahead of the 30-day window.

**Basis**: **operational** (active diagnostic engagement requires the data to
persist) + **compliance** (GDPR Art. 5(1)(e) storage-limitation requires a
defined maximum — the 30-day soft-delete restore window is that maximum once
the active-engagement basis ends; GDPR Art. 17 erasure-on-request supersedes
the 30-day window when invoked).

**Deletion mechanism**: cascade delete via Phase 8 soft-delete substrate —
`tombstoneStatus: "tombstoned"` set on the parent `orgs/{orgId}` doc, which
triggers the cascade transaction across `messages`, `comments`, `actions`,
`documents`, and `roadmaps` subcollections. The Day-30 sweep
(`permanentlyDeleteSoftDeleted` scheduled function) performs the final hard
delete + Cloud Storage object removal + audit-log record of the deletion event
(retained per the Audit Log row below — 12 months hot + 7 years archive).
GDPR Art. 17 erasure (`gdprEraseUser`) is functionally equivalent to a
soft-delete-with-immediate-Day-30-sweep on the affected user's data scope.

**Threat coverage**: GDPR Art. 5(1)(e) storage-limitation + GDPR Art. 17
right-to-erasure + OWASP ASVS L2 v5.0 V8.3 (Sensitive Data Lifecycle) + STRIDE
Information Disclosure mitigation (bounded retention reduces leak blast
radius).

**Implementation cross-reference**:

| Surface | File | Path |
|---------|------|------|
| Soft-delete callable | `functions/src/lifecycle/softDelete.ts` | `softDelete` |
| Scheduled Day-30 sweep | `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts` | `permanentlyDeleteSoftDeleted` |
| GDPR erasure callable | `functions/src/gdpr/eraseUser.ts` + `src/cloud/gdpr.js` | `gdprEraseUser` |
| Client wrapper | `src/cloud/gdpr.js` + `src/cloud/lifecycle.js` | `gdprEraseUser` / `softDelete` |
| Rules tombstone read-block | `firestore.rules` | `isTombstoned()` predicate |
| Tests | `tests/functions/lifecycle/*.test.js` + `functions/test/gdpr/eraseUser.unit.test.ts` | per-callable + cascade-transaction cells |

## Audit log (Phase 7) — AUDIT-01..06

**Retention period**: **12 months hot** in Firestore at `auditLog/{eventId}`;
**7 years archive** in BigQuery via the scheduled sink (Phase 7 § Audit Log
Infrastructure).

**Basis**: **compliance** (GDPR Art. 30 records-of-processing; ISO/IEC
27001:2022 Annex A.5.30 information security continuity; SOC 2 CC7.x security
monitoring) + **operational** (incident-response forensics — 24h+ audit-log
review is mandatory per `runbooks/ir-credential-compromise.md` Decision Tree
Step 4).

**Deletion mechanism**: scheduled — `auditLogTtlSweep` Cloud Function purges
Firestore docs older than 365 days. BigQuery sink table has a partition expiry
of 7 years; once a partition crosses that boundary it is dropped by BigQuery's
managed lifecycle (no manual action required). Audit-log events covering
deletion-of-personal-data (cf. the Org + User data row above) are themselves
retained at this 12mo+7y window — they are NOT erased by `gdprEraseUser`
because they document the erasure act for compliance evidence (Pitfall 11
carve-out per Phase 8).

**Threat coverage**: GDPR Art. 30 + GDPR Art. 32(1)(d) regular testing of
controls (audit log enables this) + OWASP ASVS L2 v5.0 V7.x (Error Handling
and Logging) + STRIDE Repudiation mitigation.

**Implementation cross-reference**:

| Surface | File | Path |
|---------|------|------|
| Audit-event writer (server-side) | `functions/src/audit/writeAuditEvent.ts` | `writeAuditEvent` |
| TTL sweep | `functions/src/audit/auditLogTtlSweep.ts` | `auditLogTtlSweep` |
| BigQuery sink | `functions/src/audit/auditLogBigQuerySink.ts` + `scripts/setup-bigquery-sink/run.js` | `auditLogBigQuerySink` |
| Redaction registry | `functions/src/audit/redaction.ts` + `redactionList` collection | `applyRedaction` |
| Tests | `functions/test/audit/*.test.ts` + `tests/rules/audit-log.test.js` | TTL + sink + redaction cells |

## Firestore export backups (Phase 8) — BACKUP-01

**Retention period**: **30 days Standard** storage class → transition to
**Nearline at 30 days** → transition to **Archive at 365 days**. No further
deletion — archive class persists indefinitely until manually pruned at the
operator-defined retention cap (currently no cap; Phase 11 forward-tracking
row queued for v2 audit-cycle review).

**Basis**: **compliance** (ISO/IEC 27001:2022 Annex A.8.13 information backup
+ A.5.30 continuity) + **operational** (disaster-recovery RPO ≤ 24 hours via
daily Firestore export; **PITR** provides seconds-level RPO for the trailing
7-day window separately).

**Deletion mechanism**: lifecycle transition (Standard → Nearline → Archive)
managed by Cloud Storage object-lifecycle rules on
`gs://bedeveloped-base-layers-backups/firestore/`; transitions are scheduled,
not manual. Operator action only required if the retention cap is later set
(currently none).

**Threat coverage**: GDPR Art. 32(1)(c) ability to restore + ISO/IEC
27001:2022 Annex A.8.13 + STRIDE Denial of Service mitigation (corrupted-data
recovery path).

**Implementation cross-reference**:

| Surface | File | Path |
|---------|------|------|
| Daily Firestore export job | Cloud Scheduler → `scheduledFirestoreExport` | `firebase-schedule-scheduledFirestoreExport-europe-west2` |
| Lifecycle rules | `runbooks/phase-8-backup-setup.md` | gcloud `lifecycle.json` body |
| Restore drill cadence | `runbooks/phase-8-restore-drill-cadence.md` + `runbooks/restore-drill-2026-05-13.md` | quarterly + ad-hoc |
| Tests | `functions/test/backup/scheduledFirestoreExport.unit.test.ts` | export-job invariants |

## Cloud Storage object versions (Phase 8) — BACKUP-02

**Retention period**: **90 days post-deletion** for non-current object
versions (Cloud Storage versioning enabled on
`gs://bedeveloped-base-layers.firebasestorage.app`).

**Basis**: **operational** (90-day window covers the soft-delete restore
window with 60-day buffer; protects against accidental client-side delete
where the soft-delete substrate doesn't apply, e.g., raw Storage object
overwrite by a buggy client).

**Deletion mechanism**: scheduled — Cloud Storage lifecycle rule
`noncurrentTimeBefore: 90 days` triggers automatic deletion of non-current
versions older than 90 days. No manual operator action required.

**Threat coverage**: GDPR Art. 32(1)(c) restoration ability + OWASP ASVS L2
v5.0 V8.3 (sensitive data lifecycle) + STRIDE Tampering mitigation
(version-history audit trail).

**Implementation cross-reference**:

| Surface | File | Path |
|---------|------|------|
| Storage versioning enablement | `runbooks/phase-8-backup-setup.md` | gcloud `versioning` block |
| Lifecycle rule | `runbooks/phase-8-backup-setup.md` | `noncurrentTimeBefore: 90` lifecycle action |
| Tests | `tests/rules/storage.test.js` | storage-rules + versioning interplay cells |

## Chat messages + comments (Phase 8) — LIFE-04

**Retention period**: lifecycle is **bound to the parent org**; messages and
comments persist while the parent `orgs/{orgId}` doc persists, and
cascade-delete via the soft-delete substrate when the parent is soft-deleted
(Day-30 sweep finalises).

**Basis**: **operational** (engagement-life data lifecycle is the
parent-document lifecycle) + **compliance** (PII-scrubbed via shared
`PII_KEYS` allowlist pre-write per Phase 9 § Observability — Sentry; cascades
on parent erasure per GDPR Art. 17).

**Deletion mechanism**: cascade — same path as the Org + User data row
(`permanentlyDeleteSoftDeleted` Day-30 sweep). PII-scrubbing is **pre-write**
(producing data; Phase 9 Sentry PII scrubber re-checks at observability
egress), not at retention boundary; retention boundary is purely cascade.

**Threat coverage**: GDPR Art. 5(1)(c) data-minimisation (PII scrub) + Art. 17
right-to-erasure (cascade) + OWASP ASVS L2 v5.0 V8.3 + STRIDE Information
Disclosure mitigation.

**Implementation cross-reference**:

| Surface | File | Path |
|---------|------|------|
| Message data wrapper | `src/data/messages.js` | `addMessage` |
| Comment data wrapper | `src/data/comments.js` | `addComment` |
| PII scrub (pre-write) | shared `PII_KEYS` per Phase 9 + Sentry beforeSend | `scrubPii` |
| Cascade callable | `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts` | `permanentlyDeleteSoftDeleted` |
| Tests | `tests/data/messages.test.js` + `tests/data/comments.test.js` + `tests/rules/messages.test.js` | per-collection cells |

## Documents (Phase 8) — LIFE-05

**Retention period**: lifecycle is **bound to the parent org** (same as Chat
+ Comments above) — documents in `gs://bedeveloped-base-layers.firebasestorage.app/orgs/{orgId}/...`
persist while the parent `orgs/{orgId}` Firestore doc persists. Storage
object versioning preserves prior versions for 90 days post-deletion (see
Cloud Storage object versions row above).

**Basis**: **operational** (engagement-life document lifecycle is the
parent-document lifecycle).

**Deletion mechanism**: cascade — Storage object deletion is invoked by the
`permanentlyDeleteSoftDeleted` Day-30 sweep via Admin SDK Storage client;
non-current versions then enter the 90-day Storage lifecycle window above
before final removal.

**Threat coverage**: GDPR Art. 5(1)(e) + ASVS V8.3 + STRIDE Information
Disclosure mitigation.

**Implementation cross-reference**:

| Surface | File | Path |
|---------|------|------|
| Document upload wrapper | `src/data/documents.js` | `uploadDocument` |
| Storage rules (scoping) | `storage.rules` | `match /orgs/{orgId}/documents/{path=**}` block |
| Cascade callable | `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts` | Storage-side cascade in the sweep |
| Tests | `tests/data/documents.test.js` + `tests/rules/storage.test.js` | per-surface cells |

## Authentication failure counters (Phase 9) — OBS-05

**Retention period**: per-uid + IP-hashed buckets at
`authFailureCounters/{uid|ipHash}` are **auto-purged via the window-tick
inside the bucket writer** — each bucket carries a `windowStart` field and
the writer drops buckets older than the active window on every increment
(rolling 5-minute window per Phase 9 § Anomaly Alerting).

**Basis**: **operational** (anomaly-detection signal lifetime matches the
alert-rule evaluation window; longer retention provides no signal value) +
**compliance** (data-minimisation — keep no more than needed per GDPR Art.
5(1)(c)).

**Deletion mechanism**: scheduled per-write — counters older than the active
window are dropped on the next increment; no separate sweep needed. If
write-traffic to a particular bucket key stops, the bucket persists
indefinitely until manually pruned (Phase 11 forward-tracking row queued for
a TTL-based sweep in v2).

**Threat coverage**: STRIDE Denial of Service mitigation (auth-fail burst
detection feeds `authAnomalyAlert` Rule 1) + OWASP ASVS L2 v5.0 V11.1
(Business Logic abuse-resistance) + GDPR Art. 5(1)(c) data-minimisation.

**Implementation cross-reference**:

| Surface | File | Path |
|---------|------|------|
| Counter writer | `functions/src/observability/authAnomalyAlert.ts` | `incrementCounter` |
| Anomaly rule evaluator | `functions/src/observability/authAnomalyAlert.ts` | `authAnomalyAlert` (Rule 1 / 2 / 3) |
| Tests | `functions/test/observability/authAnomalyAlert.unit.test.ts` | per-rule + window-tick cells |

## redactionList entries (Phase 7) — AUDIT-06

**Retention period**: **7 years** — same as the BigQuery audit-log archive
(redaction tokens are referenced by archived audit-log rows; orphaned tokens
would render historical rows unreadable for compliance review).

**Basis**: **compliance** (GDPR Art. 30 records-of-processing — historical
audit-log readability requires the redaction-token map to outlive the audit
log's hot retention; ISO/IEC 27001:2022 Annex A.5.34 PII protection).

**Deletion mechanism**: manual — operator-only writes to the `redactionList/`
collection at audit-log redaction time; no scheduled sweep is currently
defined (Phase 11 forward-tracking row queued for v2 review of whether the
7-year boundary should be enforced by a `redactionListTtlSweep` analogous to
the audit log).

**Threat coverage**: GDPR Art. 30 + ISO/IEC 27001:2022 Annex A.5.34 + STRIDE
Information Disclosure mitigation.

**Implementation cross-reference**:

| Surface | File | Path |
|---------|------|------|
| Redaction registry callable | `functions/src/audit/redaction.ts` | `applyRedaction` |
| Rules read-block | `firestore.rules` | `match /redactionList/{tokenId}` block (operator-only writes) |
| Tests | `functions/test/audit/redaction.unit.test.ts` + `tests/rules/redaction-list.test.js` | per-surface cells |

## Rate Limiting (FN-09) — Phase 7 Wave 4

**Threshold**: 30 writes per 60-second sliding window per user, combined
across `orgs/{orgId}/messages` and `orgs/{orgId}/comments` collections.

**Bucket retention**: `rateLimits/{uid}/buckets/{windowStart}` docs persist
beyond the window for observability + audit. Operator may run a scheduled
cleanup function in Phase 8+ to age out buckets older than 7 days. Phase 7
does NOT auto-purge. Bucket docs are tiny (`{ uid: string, count: number }`)
so storage cost is negligible.

**Adjustability**:

- **Without redeploy**: NO — the threshold is hardcoded in `firestore.rules`
  `rateLimitOk(uid)` predicate (`bucket.count < 30`) and in the
  `rateLimits/{uid}/buckets/{windowStart}` `update` predicate
  (`request.resource.data.count <= 30`). To change, edit both predicates and
  redeploy `firestore:rules` via the CI deploy chain (Phase 6 D-12 substrate)
  or manual `firebase deploy --only firestore:rules`.
- **Operator hot-swap**: The `checkRateLimit` callable
  (`functions/src/ratelimit/checkRateLimit.ts`) is deployed but NOT live-wired
  in Phase 7 (Pattern 5b — fallback seam). To activate, ship
  `src/cloud/checkRateLimit.js` wrapper + replace `incrementBucketAndWrite`
  with the callable in `src/data/messages.js` + `src/data/comments.js`.
  Threshold then becomes runtime-tunable via env var or secret without a
  rules-redeploy. Operator decision (Wave 6 cleanup-ledger candidate).

**Pitfall avoidance**: Threshold (30/60s) is conservative-but-non-disruptive
for a chat-style SaaS use case (Open Question #3 in
`.planning/phases/07-cloud-functions-app-check-trusted-server-layer/07-RESEARCH.md`).
Revisit at engagement re-start if BeDeveloped consultancy use-case has bursts
(e.g., paste-from-clipboard of multiple comment items).

**Threat coverage**: OWASP A04:2021 (Insecure Design — rate limiting) +
ASVS V11.1 (Business Logic abuse-resistance) + STRIDE Denial of Service
mitigation per `07-04-PLAN.md` `<threat_model>` row T-07-04-05.

**Test coverage**: `tests/rules/rate-limit.test.js` — 15 cells:
bucket-direct (anonymous deny, self-read allow, cross-uid deny, current-window
create with count==1, future/past window deny, monotonic +1 update, count<=30
cap, no-delete, cross-uid update deny) + composed-predicate (30-message burst,
31st denies — Phase 7 SC#5 evidence, new-window resumption, shared bucket
across messages+comments).

**Implementation cross-reference**:

| Surface | File | Path |
|---------|------|------|
| Rules predicate (primary) | `firestore.rules` | `rateLimitOk(uid)` + `rateLimits/{uid}/buckets/{windowStart}` block |
| Client transactional helper | `src/data/rate-limit.js` | `incrementBucketAndWrite` |
| Wired callers | `src/data/messages.js`, `src/data/comments.js` | `addMessage` / `addComment` |
| Fallback callable (seam) | `functions/src/ratelimit/checkRateLimit.ts` | `checkRateLimit` (deployed, not wired) |
| Rules-unit-test | `tests/rules/rate-limit.test.js` | 15 cells |
| Helper unit-test | `tests/data/rate-limit.test.js` | 6 cells |
| Callable unit-test | `functions/test/ratelimit/checkRateLimit.unit.test.ts` | 10 cells |
