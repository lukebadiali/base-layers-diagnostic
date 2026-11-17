# Knowledge agent: client isolation check

An end-to-end check, run as real signed-in client logins, that a client can reach only their own organisation's knowledge. It runs against the **local emulators only**. Nothing in it talks to production.

## What it checks (16 checks)

As a client of org A:

1. With client access off (the production default), asking is refused.
2. With it on, asking about their own material is answered from org A's forms, with no list of sources.
3. Sending org B's `orgId` is refused ("Not your organisation").
4. A prompt-injection question that asks for other clients gets none of org B's facts.
5. The all-clients mode is refused (staff only).
6. Upload, the upload log, coverage and archive are all refused (staff only).
7. Reading the knowledge collections directly with the client's login is denied, for org B's data, for the client's own data, for records and for the question log.

Also:

- A client login with an unverified email is treated as signed out.
- A call with no login is refused.
- A client of org B asking org A's question gets none of org A's facts.

The script leaves client access **off** when it finishes.

## Running it

1. Start the emulators and upload forms for two orgs through the staff panel. See `docs/client-knowledge-agent/HANDOFF.md` §7 (local browser testing). The defaults assume `org_fernhill` with `fernhill__p1.docx` and `org_westbourne` with `westbourne__p1.docx`, both from `functions/test/knowledge/eval/out/forms/`.
2. From the repo root, on Node 22:

   ```sh
   NODE_PATH=functions/node_modules node scripts/knowledge-client-isolation/run.cjs
   ```

   It exits 0 when all checks pass and 1 otherwise.

To use other orgs, set `ORG_A`, `ORG_B`, `ORG_A_Q` and `ORG_B_Q` (a question each org's forms answer), plus `ORG_A_FACT` and `ORG_B_FACT` (regexes for facts that appear only in that org's forms).

## Last run

17 Nov 2026: 16/16 passed, against the deployed code (`9dd40a2`).
