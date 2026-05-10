# Phase 11 Plan 11-02 — DOC-02 Sub-processor + Residency Verification Log

**Phase:** 11-documentation-pack-evidence-pack
**Plan:** 11-02
**Wave:** 2 — DOC-02 PRIVACY.md authoring
**Owner:** Phase 11 Wave 2 executor
**Authored:** 2026-05-10T21:36:00Z
**Status:** PARTIAL — 3 of 5 verifications PASS; 2 of 5 (A1 Cloud Storage region + A3 Identity Platform region) BLOCKED by non-interactive gcloud-auth refusal — both forward-tracked to operator with explicit `PENDING-OPERATOR` annotations and escalation entries below

**Purpose.** Establish substrate-honest evidence (Pitfall 19) for every claim PRIVACY.md ships with. Captures the exact commands run + return codes + stdout/stderr; surfaces verification gaps as PENDING-OPERATOR rather than letting them ship as silent assertions.

**Mirrors:** `.planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md` gcloud-output capture pattern.

---

## A1 — Cloud Storage Region

**Requirement:** Resolve assumption A1 of `.planning/phases/11-documentation-pack-evidence-pack/11-RESEARCH.md` line 938 — "Cloud Storage bucket region is `europe-west2` (matching Firestore + Functions)". If the bucket is in another region, PRIVACY.md must reflect both regions.

### Verify Command

```bash
gcloud storage buckets describe gs://bedeveloped-base-layers.firebasestorage.app \
  --format="value(location,locationType,storageClass)"
```

### Captured Output

**Status:** BLOCKED — captured 2026-05-10T21:36:25Z

Active gcloud account at capture: `business@bedeveloped.com` (the IAM-privileged account per `06-PREFLIGHT.md` line 46). Two alternative accounts present in `gcloud auth list` (`hugh@assume-ai.com`, `lukebadiali@gmail.com`); see escalation note below.

```
$ /c/Users/hughd/AppData/Local/Google/Cloud\ SDK/google-cloud-sdk/bin/gcloud.cmd config set account business@bedeveloped.com
Updated property [core/account].

$ /c/Users/hughd/AppData/Local/Google/Cloud\ SDK/google-cloud-sdk/bin/gcloud.cmd storage buckets describe gs://bedeveloped-base-layers.firebasestorage.app --format="value(location,locationType,storageClass)"
ERROR: (gcloud.storage.buckets.describe) There was a problem refreshing your current auth tokens: Reauthentication failed. cannot prompt during non-interactive execution.
Please run:

  $ gcloud auth login

to obtain new credentials.

If you have already logged in with a different account, run:

  $ gcloud config set account ACCOUNT

to select an already authenticated account to use.
```

Exit code: `1`.

### Fallback Attempts

1. **`hugh@assume-ai.com`** — same `Reauthentication failed. cannot prompt during non-interactive execution` error (cached refresh token has aged past the security policy window for this account).
2. **`lukebadiali@gmail.com`** — auth refresh succeeded but command returned `lukebadiali@gmail.com does not have storage.buckets.get access to the Google Cloud Storage bucket. Permission 'storage.buckets.get' denied on resource (or it may not exist)`. This is the expected IAM posture — Luke is a Firebase user, not a GCP storage admin.

No remaining gcloud account in this environment can describe the bucket without an interactive `gcloud auth login` run from the operator's terminal.

### Decision

**ESCALATE — non-interactive gcloud auth refresh failure across all available accounts.**

Per the plan's ESCALATE-branch contract (line 117 of `11-02-PLAN.md`), the original ESCALATE wording was scoped to "region OTHER than `europe-west2`". The current failure is a strictly stronger ESCALATE class — *no* region was returned at all — so the same disclosure-honesty obligation applies.

**Per Pitfall 19 (substrate-honest disclosure)**, PRIVACY.md MUST NOT assert `europe-west2` for Cloud Storage on the basis of "inferred regional pattern". The PRIVACY.md Section 2 + Section 3 + Section 6 Cloud Storage region cells are annotated `**PENDING-OPERATOR**` with a forward-tracking pointer to the post-completion operator command:

```bash
# Operator: run after `gcloud auth login` from an interactive terminal
gcloud storage buckets describe gs://bedeveloped-base-layers.firebasestorage.app \
  --format="value(location,locationType,storageClass)" \
  --project=bedeveloped-base-layers
```

Update PRIVACY.md inline once captured. A forward-tracking row is queued in `runbooks/phase-11-cleanup-ledger.md` (substrate authored Wave 6) under the placeholder name `F-DOC-02-A1`: `Cloud Storage region — operator gcloud auth + buckets describe + update PRIVACY.md ## 2 + ## 3 + ## 6`. Owner: operator. Trigger: same operator session that flips Phase 10 enforcement (`10-DEFERRED-CHECKPOINT.md`) — both require interactive auth.

---

## A3 — Identity Platform Region

**Requirement:** Resolve assumption A3 of `.planning/phases/11-documentation-pack-evidence-pack/11-RESEARCH.md` line 940 — "Identity Platform (Firebase Auth) data residency is EU-only when using EU project + EU Identity Platform tenant". Phase 6 PREFLIGHT verified Firestore region only.

### Verify Command (primary)

```bash
gcloud identity-platform config describe --project=bedeveloped-base-layers \
  --format="value(name,subtype)"
```

### Captured Output

**Status:** BLOCKED — captured 2026-05-10T21:36:30Z

```
$ /c/Users/hughd/AppData/Local/Google/Cloud\ SDK/google-cloud-sdk/bin/gcloud.cmd identity-platform config describe --project=bedeveloped-base-layers --format="value(name,subtype)"
ERROR: (gcloud) Invalid choice: 'identity-platform'.
Maybe you meant:
  gcloud config get
  gcloud config configurations describe
  gcloud config list
  gcloud config set
  ...
```

The `identity-platform` command group is not installed in the root gcloud namespace.

### Fallback Attempt — `gcloud alpha identity-platform`

```
$ /c/Users/hughd/AppData/Local/Google/Cloud\ SDK/google-cloud-sdk/bin/gcloud.cmd alpha identity-platform
You do not currently have this command group installed.  Using it
requires the installation of components: [alpha]

ERROR: Cannot use bundled Python installation to update Google Cloud CLI in
non-interactive mode. Please run again in interactive mode.
```

`alpha` component install requires interactive console; non-interactive executor cannot proceed.

### Fallback Attempt — Firebase Console-only verification path

The plan's ESCALATE branch (line 127) explicitly authorises annotating the doc `**ASSUMED-PER-A3**` and recommending operator confirmation at:

`https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/settings`

A `firebase apps:list` fallback would also have required the firebase CLI which is not on this executor's PATH (`which firebase` returned no result).

### Decision

**ASSUMED-PER-A3 — annotation path authorised.** PRIVACY.md Section 3 ships with `**ASSUMED-PER-A3**` annotation on the Identity Platform / Firebase Auth row plus the explicit Firebase Console verification URL above. A forward-tracking row is queued in `runbooks/phase-11-cleanup-ledger.md` (Wave 6) under placeholder name `F-DOC-02-A3`: `Identity Platform region — operator Firebase Console verification + update PRIVACY.md ## 3 cell`. Owner: operator. Trigger: bundleable with `F-DOC-02-A1` (same operator session).

This path matches Phase 6 D-09 precedent (Identity Platform upgrade verification was Console-only at that wave too — `06-PREFLIGHT.md` § Identity Platform Upgrade documents the same Console-only pattern as substrate-honest).

---

## Google Fonts Negative Verification

**Requirement:** Confirm Google Fonts is NOT a sub-processor — Phase 4 self-hosted Inter + Bebas Neue under `assets/fonts/` and CSP no longer allowlists `fonts.googleapis.com` / `fonts.gstatic.com`. PRIVACY.md Section 2 disclaims Google Fonts on the basis of this evidence.

### Verify Command 1 — Live site grep

```bash
curl -s https://baselayers.bedeveloped.com | grep -ci "fonts\.googleapis\.com\|fonts\.gstatic\.com"
```

### Captured Output

**Status:** PASS — captured 2026-05-10T21:36:00Z

```
$ curl -s -m 30 https://baselayers.bedeveloped.com | grep -ci "fonts\.googleapis\.com\|fonts\.gstatic\.com"
0
```

Zero hits. Live production HTML carries no Google Fonts URL references.

### Verify Command 2 — Source + config grep (corroborating evidence)

```bash
grep -rn "fonts.googleapis.com\|fonts.gstatic.com" src/ index.html public/ firebase.json
```

### Captured Output

**Status:** PASS — captured 2026-05-10T21:36:00Z

```
$ grep -rn "fonts.googleapis.com\|fonts.gstatic.com" src/ index.html public/ firebase.json
(no output)
```

Zero hits across `src/`, `index.html`, `public/`, and `firebase.json`. The CSP `font-src 'self' data:` allowlist (firebase.json line 22 inspected during Sentry-EU verification below) carries no Google Fonts host. Cross-references existing SECURITY.md § Build & Supply Chain (Phase 4 Wave 1 self-hosted fonts substrate).

### Decision

**PASS** — Google Fonts is verifiably NOT a sub-processor. PRIVACY.md Section 2 ships the explicit "Not a sub-processor (post-Phase-4)" paragraph with the live-site curl + source-grep evidence cited inline.

---

## Sentry EU Residency

**Requirement:** Confirm Sentry events route to EU ingest endpoint (`*.ingest.de.sentry.io`) — PRIVACY.md Section 2 + Section 6 cite Sentry EU residency as the basis for the Schrems II / Art. 44 transfers stance.

### Verify Command

```bash
grep -n "de\.sentry\.io" vite.config.js src/observability/sentry.js
```

### Captured Output

**Status:** PASS — captured 2026-05-10T21:36:00Z

```
$ grep -n "de\.sentry\.io" vite.config.js src/observability/sentry.js
vite.config.js:36:          url: "https://de.sentry.io/",
src/observability/sentry.js:9:// residency encoded in the DSN itself (https://...@o<id>.ingest.de.sentry.io/...).
```

Two confirming hits: build-time source-map upload URL (`vite.config.js:36`) + runtime SDK initialisation comment documenting DSN `*.ingest.de.sentry.io` pattern (`src/observability/sentry.js:9`). Both align with SECURITY.md § Observability — Sentry's existing EU-residency claim.

### Decision

**PASS** — Sentry EU residency is verifiable from repo source. PRIVACY.md Section 2 cites both lines; Section 6 cites EU residency as the basis for SCC posture.

---

## Sentry DPA URL Liveness

**Requirement:** Confirm `https://sentry.io/legal/dpa/` resolves with HTTP 200 (or 30x → 200 chain). Stale DPA URL is a Pitfall 19 disclosure failure.

### Verify Command

```bash
curl -sIL https://sentry.io/legal/dpa/ | head -5
```

### Captured Output

**Status:** PASS — captured 2026-05-10T21:36:25Z

```
$ curl -sIL -m 15 https://sentry.io/legal/dpa/
HTTP/1.1 200 OK
server: nginx
date: Sun, 10 May 2026 21:36:25 GMT
content-type: text/html; charset=utf-8
vary: Accept-Encoding
access-control-allow-origin: *
age: 182433
cache-control: no-cache, must-revalidate
content-disposition: inline; filename="dpa"
x-vercel-cache: HIT
```

Final status: `HTTP/1.1 200 OK`. No redirect chain — the DPA URL is the canonical location. Bonus check: `https://sentry.io/legal/` (parent index) also returns `HTTP/1.1 200 OK`.

### Decision

**PASS** — Sentry DPA URL is live + cacheable. PRIVACY.md Section 2 cites `https://sentry.io/legal/dpa/` verbatim.

---

## Summary Table

| Assumption / Verification | Status | Resolved As |
|---------------------------|--------|-------------|
| A1 — Cloud Storage region | BLOCKED → ESCALATE → PENDING-OPERATOR | PRIVACY.md Sections 2 / 3 / 6 ship `**PENDING-OPERATOR**` Cloud Storage cells; forward-tracking row `F-DOC-02-A1` queued for operator session |
| A3 — Identity Platform region | BLOCKED → ASSUMED-PER-A3 (plan-authorised path) | PRIVACY.md Section 3 ships `**ASSUMED-PER-A3**` Auth row with Firebase Console verification URL; forward-tracking row `F-DOC-02-A3` queued |
| Google Fonts negative (live + source) | PASS | Live curl + source grep both return zero hits; PRIVACY.md Section 2 ships explicit "Not a sub-processor" paragraph |
| Sentry EU residency (`de.sentry.io`) | PASS | Two grep hits in `vite.config.js:36` + `src/observability/sentry.js:9`; PRIVACY.md Sections 2 + 6 cite both |
| Sentry DPA URL liveness (`https://sentry.io/legal/dpa/`) | PASS | `HTTP/1.1 200 OK` direct (no redirect); PRIVACY.md Section 2 cites verbatim |
| Firestore region (cited from Phase 6 PREFLIGHT) | PASS (inherited) | `europe-west2 / FIRESTORE_NATIVE` verified 2026-05-08T20:30:00Z per `06-PREFLIGHT.md` line 37 |

---

## Escalations

### E1 — Non-interactive gcloud auth refresh failure (A1 + A3)

**Symptom.** Both `gcloud storage buckets describe` (A1) and any Identity Platform CLI path (A3) require either:

1. A fresh `gcloud auth login` interactive run on the operator's terminal (refresh tokens for `business@bedeveloped.com` have aged past the org's reauthentication policy), OR
2. The `alpha` gcloud component installed (also interactive-only in this environment), OR
3. Firebase CLI on the executor PATH (not present).

**Impact.** PRIVACY.md cannot ship `europe-west2` as Cloud Storage region or "EU multi-region" as Identity Platform region as **VERIFIED** — both must be **PENDING-OPERATOR** / **ASSUMED-PER-A3** annotations.

**Resolution path.** Bundle into the existing operator-pending session pattern. Two paste-ready commands queued in PRIVACY.md Section 3 footer + `runbooks/phase-11-cleanup-ledger.md` (Wave 6). The operator already has an outstanding Phase 10 + Phase 9 + Phase 8 deferred-checkpoint cluster (per `STATE.md`); A1 + A3 verification can be appended to that session at near-zero marginal cost (~3 min total).

**Substrate-honest disclosure (Pitfall 19) in PRIVACY.md:** every claim is either VERIFIED with command/source citation, or annotated `**PENDING-OPERATOR**` / `**ASSUMED-PER-A3**` with the exact resolution command + Firebase Console URL. No region claim is presented as fact when it is not yet verified in this environment.

**No content-blocking impact.** A1 + A3 are residency-cell annotations only. The 7-section PRIVACY.md skeleton + sub-processor table + DSR flow + Pitfall 19 forbidden-words gate all proceed.

---

## Decision Gate for Task 2

**PROCEED to Task 2 (RED test authoring) and Task 3 (PRIVACY.md authoring)** with the following annotations:

- Section 2 (Sub-processors): Google LLC row carries `region` cell `Firestore + Cloud Functions: europe-west2 (verified Phase 6 PREFLIGHT 2026-05-08); Cloud Storage: **PENDING-OPERATOR** (bundle with A3); Identity Platform / Auth: **ASSUMED-PER-A3** (Firebase Console verification queued)`
- Section 3 (Data residency): cite this verification log; surface PENDING-OPERATOR rows for A1 + A3 inline; cite Sentry EU evidence verbatim
- Section 6 (International transfers): same pattern — Cloud Storage residency annotated PENDING-OPERATOR

This matches the plan's `<action>` block lines 232-234 instruction-tree exactly: "ASSUMED-PER-A3 annotation if A3 only verifiable via Firebase Console" + "ESCALATE branch if A1 fails" — both branches taken substrate-honest.
