# scripts/internal-account-status

**Read-only.** Diagnoses what state a staff account is actually in, across all
four places that hold account truth. No writes of any kind — safe to run
against production at any time, including mid-incident.

## Why

An account's state is spread across four surfaces that can disagree:

| Surface | Holds | Written by |
| --- | --- | --- |
| Firebase Auth record | sign-in, `disabled`, custom claims, MFA factors | `inviteInternal`, `deleteInternal`, `gdprEraseUser`, Console |
| `users/{uid}` | the profile the admin panel renders | `inviteInternal`, `deleteInternal`, GDPR cascade |
| `redactionList/{uid}` | GDPR erasure record, replayed over restored backups | `gdprEraseUser` |
| `internalAllowlist/{email}` | break-glass entitlement; re-claims on Console re-create | `seed-internal-allowlist` only |

When they disagree, a person can be **invisible in the admin panel and
un-recreatable at the same time** — the panel reads `/users`, so they're gone
from the list, while Auth still holds their email, so `inviteInternal` refuses
with "an account with this email already exists". Nothing in the product
explained that, and there is no soft-delete for accounts to restore from
(`SOFT_DELETABLE_TYPES` covers `action`, `comment`, `document`, `message`,
`funnelComment`, `folder` — not `user`).

This script reads all four and prints the verdict plus the remedy.

## Prerequisites

- `gcloud auth application-default login` (D-20 / Pitfall 13 — no
  service-account JSON in source).
- The operator's account needs `Cloud Datastore User` and
  `Firebase Authentication Admin` on `bedeveloped-base-layers`.
- `cd functions && npm run build` — the script imports the classifier from
  `functions/lib/` so it and the `inviteInternal` callable can never drift into
  disagreeing about what a state means.

## Usage

```sh
cd functions && node ../scripts/internal-account-status/run.js george@bedeveloped.com
cd functions && node ../scripts/internal-account-status/run.js --all-staff
```

`--all-staff` sweeps every `internalAllowlist` email plus every `admin`/
`internal` row in `/users`. Note the gap it prints: an erased account has a
nulled email in `/users`, so it is only discoverable this way if it still has
an allowlist row. Pass the address explicitly when you know it.

## The states

| Verdict | Means | Fix |
| --- | --- | --- |
| `free` | no Auth record for this email | normal **+ Add internal member** |
| `HEALTHY` | enabled, staff claims, intact profile | nothing — re-inviting would reset a live colleague's password |
| `DISABLED` | Auth record exists but disabled. Where `gdprEraseUser` leaves people (it disables rather than deletes), and where a Console disable lands | **Reactivate this account** in the add-member modal |
| `ERASED` | GDPR cascade ran — `redactionList` row and/or `erasedAt` tombstone | **Reactivate** — but see the warning below |
| `ORPHANED` | Auth record survives, `/users` profile does not | **Reactivate** — rebuilds the profile against the existing record |
| `CLIENT` | role is `client`, not staff | wrong tool; use the client flow or change the role deliberately |

## Reactivation, and what it does not undo

Reactivation revives the account **in place, on the original uid**, so
everything already keyed to it — authored messages and comments, uploads,
audit rows — stays attached. A fresh account would orphan all of it.

It re-enables the record, issues a new one-time temporary password, clears MFA
enrolment (the old authenticator went with the access), re-sets claims with
`firstRun: true` so the member must set their own password and re-enrol TOTP,
overwrites the profile so no erasure tombstone survives, and deletes the
`redactionList` row — that last one is load-bearing, because the row is
replayed over restored backups and would otherwise silently re-erase the
account after the next restore drill.

It does **not** undo a GDPR erasure's other effects. Content that was
pseudonymised stays pseudonymised and Storage objects that were deleted stay
deleted. Both are irreversible by design (`gdprEraseUser` → `eraseCascade`).

Reversing an erasure is deliberate and audited: the first call always returns
the diagnosis and refuses, the admin confirms, and the resulting
`auth.internal.invite` audit row carries `reclaimed: true`,
`reclaimedFrom: <state>` and `redactionRowCleared`.
