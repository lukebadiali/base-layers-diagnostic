# Handover: Client Knowledge Agent (Base Layers)

**Written:** 17 Nov 2026, end of session. **Branch:** `feat/client-knowledge-agent` (PR #103, ready for review). **Repo:** `base-layers-diagnostic`.

Start here: read this file, then `functions/src/knowledge/` and `functions/test/knowledge/eval/`. Section 5 is the next task.

---

## 1. What this is

BeDeveloped (Luke Badiali, George Berrington) won a per-client RAG agent on Base Layers on 29 Oct 2026. Pilot with Luke and George before December; rollout January 2027.

Consultants upload a **Session Capture Form** (Luke's Word template, one per pillar session). The agent answers each client's questions from only that client's delivered material.

### Requirements

The sources are:
- the Drive doc "Baselayers Agent"
- Fireflies calls 23 Oct (`01M5FMWGV0W4EZVEYCHNF2Y7FS`) and 27 Oct (`01M5SYF9BYBK6BB143CPE5DXHS`)
- the Gmail thread "AI template" (Luke's Pillar 1 form)
- the Gmail thread "tags for RAG": 36 tags signed off by Luke on 9 Nov; the Action, Action owner and Action due date tags were dropped

What they ask for:
- One agent per client, with strict isolation.
- Admin-only ingestion, using one record per client per pillar (Hugh's rule): a new upload replaces the old.
- Concise answers in which the latest form wins.
- Access ends with the engagement, by archiving.
- Every question logged, for a weekly usage report.
- No voice.

### Decisions (Hugh)

**Models**

| Job | Model |
|---|---|
| Embeddings | OpenAI `text-embedding-3-small` (1536 dimensions) |
| Describer (AI tags) | DeepSeek V4.1 Flash via OpenRouter, US providers only, no fallback (not GPT) |
| Answerer | same DeepSeek route as the describer |

- **Evaluation work:** test-data generation and grading use Claude on Hugh's Claude Code allowance (sub-agents), not an API key. There is no `ANTHROPIC_API_KEY`, and Hugh doesn't want one.
- **No client-facing widget until the agent is good.** The staff panel is the only UI.
- **Test clients:** Luke's book is mostly PE houses and consultancies. Keep test clients realistic, nothing whimsical.

---

## 2. Where it stands

### Code

The code is in `functions/src/knowledge/`, on branch `feat/client-knowledge-agent`:

| File | Role |
|---|---|
| `docx.ts`, `form.ts` | Parse Luke's form. `sameClient` ignores Ltd, PLC, LLP, Inc, LLC and Corp suffixes. |
| `describer.ts` | DeepSeek writes the AI tags. |
| `chunker.ts` | Builds passages. Each opens with a line naming client, pillar, session, date and lead. |
| `embedder.ts`, `store.ts` | Firestore vector store. `knowledgeRecords/{orgId}__{pillar}` plus `knowledgeChunks`. `orgCoverage`, `setOrgKnowledgeStatus`. |
| `retrieve.ts` | `findNearest`, filtered by `orgId` and `status == current`. |
| `answer.ts` | DeepSeek answer. JSON `{answered, answer}`. `MAX_ANSWER_TOKENS` 1500, one retry. |
| `ask.ts` | Ask pipeline. If no knowledge exists, it returns `NOTHING_YET` without calling a model. |
| `handlers.ts` | Access rules: staff for upload, uploads and coverage; admin for archive and restore; client for own-org ask, only if `knowledgeConfig/access {clientAccess: true}`. |
| `logs.ts` | `knowledgeUploads` and `knowledgeQueries`. |
| `callables.ts` | Callables: `knowledgeIngest`, `knowledgeAsk`, `knowledgeUploads`, `knowledgeSetStatus`, `knowledgeCoverage`. Trigger: `knowledgeOnOrgDelete` (archives). All in `europe-west2`, exported from `functions/src/index.ts`. |

### Staff panel

The panel is in `src/views/knowledge-admin.js` and `src/cloud/knowledge.js`, wired in `src/main.js` `renderAdmin`. It has:
- client picker (follows the top-bar org, locked during an upload)
- upload
- "What the agent knows" (10 pillars)
- archive / restore (admin only, confirm in place)
- upload log (Live / Replaced / Archived / Failed)
- test question (bullets, "Drew on" sources, "Not covered" marker)

Visibility: the panel shows only when the build sets `VITE_KNOWLEDGE_ADMIN=1`, which CI now sets in the build, deploy and preview jobs. It is one instance, reused across re-renders, and keeps focus.

### Production

The project is `bedeveloped-base-layers`:
- **Secrets:** `OPENAI_API_KEY` and `OPENROUTER_API_KEY` are in Secret Manager (v1, same values as `.env.local`).
- **Indexes:** two vector indexes on `knowledgeChunks`, plus `knowledgeUploads (orgId, startedAt)`.
- **Deployed 16 Nov:** `knowledgeIngest`, `knowledgeAsk`, `knowledgeUploads`, `knowledgeSetStatus`, `knowledgeOnOrgDelete`.
- **Deployed 17 Nov:** `knowledgeCoverage` (new) and `knowledgeIngest` again.
- Every deploy passed the IAM / IdP gate, and the diff showed **nothing lost**.
- **Warning: the deployed `knowledgeAsk` predates the 17 Nov fix.** It still has the 600-token cap that truncates JSON answers (about 3% of questions fail with "couldn't answer"), and it has zod 4.4.3. Redeploy it with the fixes below.
- **Not live yet:** the hosting rewrites and the staff panel go live only when PR #103 merges. CI deploys hosting from `main`, and `main` needs a reviewer.
- **Clients:** they cannot ask. `knowledgeConfig/access` does not exist, which means off.

### PRs

| PR | State |
|---|---|
| #103 | Knowledge agent and the eval. CI fully green. **Blocked only on review approval.** Hugh can't approve his own PR and has no admin rights to bypass, so Luke or George must approve. Merging deploys the panel. |
| #102 | Internal-account reactivation and GDPR erasure deleting the Auth record. Ready, needs review. Its server half needs a functions deploy. |
| #99 | October handover doc. Open, needs review. |
| #101 | MFA Verify spinner. Merged. |

---

## 3. Evaluation (17 Nov): how to run it and what it found

### Harness

The harness is in `functions/test/knowledge/eval/`, and every step is skipped unless its env flag is set.

| File | What it does |
|---|---|
| `clients.ts` | 10 fictional clients: Ashcombe Capital Partners, Fernhill Growth Equity, Calder Bridge Investments and Westbourne Equity (PE); Meridian Operations Consulting, Thornbury Procurement Advisory, Larkspur People Consulting, Harcourt Digital Advisory, Elmstead Change Partners and Brookvale Commercial Due Diligence (consultancies). Also pillar names, the lead per session (`leadFor`), and `V2_FORMS` (5 client/pillar pairs with a later, changed form). |
| `data/specs/*.content.json` | 105 form contents written by Claude sub-agents. They are validated: areas match each pillar, there is a No/Pending on every form, and expected facts are grounded in the form. |
| `generate.eval.test.ts` (`KNOWLEDGE_EVAL_GENERATE=1`) | Assembles the cell specs plus `data/cases.json` (350 questions: 300 fact, 20 who, 20 out_of_scope, 10 latest). It calls no model when every content file exists. |
| `run.eval.test.ts` (`KNOWLEDGE_EVAL=1`) | Builds the .docx forms with `tools/fill_form.py` and `fixtures/pillar-1-template.docx`, uploads all 105 into the **Firestore emulator** through `handleIngest`, asks every case as the client, and writes `out/results.json`. `KNOWLEDGE_EVAL_REUSE=1` re-asks without re-uploading. |
| `report.eval.test.ts` (`KNOWLEDGE_EVAL_REPORT=1`) | Merges `out/grades.json` with the results, adds a deterministic cross-client name check, and writes `out/report.md` and `out/report.json`. Fact questions on superseded (v2) pillars are reported but not scored. |
| `forms.unit.test.ts` | No-model round trip proving every pillar's form builds and parses. Runs in the normal suite. |

`out/` is gitignored. It holds the forms, results, grades and report from 17 Nov.

### Commands

The Firestore emulator needs Java, which is at `~/.local/jre`:

```sh
export JAVA_HOME=$HOME/.local/jre/Contents/Home PATH=$HOME/.local/jre/Contents/Home/bin:$PATH
export CLOUDSDK_CONFIG=<an empty dir>
npx -y firebase-tools@15.16.0 emulators:start --only firestore --project demo-knowledge-eval
```

Then, from `functions/`, on Node 22:

```sh
set -a; eval "$(grep -E '^(OPENAI_API_KEY|OPENROUTER_API_KEY)=' ../.env.local)"; set +a
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-knowledge-eval KNOWLEDGE_EVAL=1 \
  npx vitest run test/knowledge/eval/run.eval.test.ts
```

The upload run takes about 10 minutes. The re-ask run (`REUSE=1`) takes about 2.

### Grading

Grading uses Claude sub-agents. **Follow `functions/test/knowledge/eval/GRADING.md`**: it has the build command, the batch format, the exact sub-agent prompt, the `grades{k}.json` schema, the merge step and what to review by hand.

1. `build_grade_batches.py` writes 5 batches grouped by client (2 clients each). Each group is `{client, forms, items}`: `forms` holds ALL of that client's forms (including `__v2`) with session date and attendees, and each item names its `primaryForm`.
2. Graders check expected facts against the primary form but may accept a position from a LATER-dated form that the answer presents as current. Claims are unsupported only if they appear in none of the client's forms. This fixes answers drawn from later sessions being marked wrong in the 17 Nov runs (for example `meridian-p1-q2`, `brookvale-p3-q2`).
3. `GRADING_RULES` and `formSource` in `report.eval.test.ts` (the API fallback) use the same rules and all of the client's forms.
4. Graders over-flag "not agreed" / "you rejected it", which is correct wording, so review `STATUS:` flags by hand.

### Results, 17 Nov

The headline: **94% pass on 335 scored questions**.

| Question type | Pass |
|---|---|
| Fact (285) | 95% |
| Who ran the session (20) | 100% |
| Latest wins (10) | 100%; an old position was never given as current |
| Out of scope (20) | 100%; declined and logged as unanswered |

- **By pillar:** 90% (Pillar 1) to 100% (Pillars 7, 9 and 10).
- **Cross-client leaks:** 0 of 350.
- **Errors:** 0, after the answer-cap fix. Before it, 10 of 350 failed.
- **Uploads:** all 105 succeeded. p50 11s, p90 31s, max 37s.
- **Answers:** p50 1.8s, p90 3.1s.
- **Verdicts:** 302 correct, 7 partial, 5 incorrect, 21 declined (20 correct out-of-scope declines plus 1 false decline). 2 covered questions were marked unanswered.

---

### Results, 17 Nov, after the section 5 fixes

The headline: **96% pass on 335 scored questions** (was 94%). Fact 96% (was 95%); who, latest and out of scope all 100%. Leaks 0, errors 0, uploads 105/105.

- **Invented open questions:** 3 graded answers flagged, down from 25.
- **Agreed status:** 15 STATUS flags. Reviewed by hand, about 5 are real: a NOT AGREED item described as "still unresolved", "not settled" or "still needs agreement" (`meridian-p7-q1`, `thornbury-p2-q3`, `thornbury-p7-q1`, `larkspur-p2-q1`, arguably `calder-p2-q3`). Down from about 10. The rest say "not agreed" / "rejected", which is right.
- **Pillar 1** is still the weakest at 86%.
- **Latency:** p50 2.1s, p90 3.6s (was 1.8s / 3.1s), from 12 retrieved chunks instead of 8.
- **Missed targets:** fact over 97% (got 96%), status errors close to 0 (about 5), p90 under about 3s (3.6s).

### Results, 17 Nov, after the Pillar 1, grader and wording fixes

This run tested three changes. None is committed or deployed yet.

1. Pillar 1 retrieval re-rank, with the retrieved chunks now recorded per question (`out/p1-diagnosis.md`).
2. Graders now see all of a client's forms (`GRADING.md`).
3. New NOT AGREED and attribution wording in `answer.ts` (`out/p3-check/results.md`).

The run was a full re-upload (`KNOWLEDGE_EVAL=1`, no filters), graded by 5 fresh sub-agents. The earlier outputs are archived in `out/before-p123/`.

The headline: **335 of 335 scored questions pass (100%)**, up from 323 of 335 (96.4%).

`passRate` in `report.eval.test.ts` used to divide by all 350 results, including the 15 unscored superseded ones, so the 17 Nov "96%" was 336 of 350. It now divides by the 335 scored questions, like the per-kind and per-pillar figures.

| | 17 Nov baseline | Now |
|---|---|---|
| Scored pass | 323/335 (96%) | 335/335 (100%) |
| Fact (285) | 96% | 100% |
| Who / latest / out of scope | 100% / 100% / 100% | 100% / 100% / 100% |
| Pillar 1 (29) | 86% (25) | 100% (29) |
| Pillars 2, 3, 7, 8 | 93%, 93%, 93%, 97% | 100% each |
| STATUS flags (raw / real after review) | 15 / about 5 | 2 / 1 |
| Answers with unsupported claims | 157 | 41 (not comparable: graders now see all forms) |
| Leaks / errors / uploads | 0 / 0 / 105 of 105 | 0 / 0 / 105 of 105 |
| Uploads p50 / p90 / max | 15s / 35s / 55s | 15s / 35s / 56s |
| Answers p50 / p90 / max | 2.1s / 3.6s / n/a | 2.2s / 3.6s / 8.2s |

**The 12 cases that failed on 17 Nov now all pass:**

| Case | Fixed by | Answer now |
|---|---|---|
| `fernhill-p1-q1` | retrieval | £3m to £15m revenue, growing 30% or more |
| `westbourne-p1-q1` | retrieval | £15m to £40m tickets, over £2bn AUM |
| `calder-p1-q3` | retrieval | 10-week completion commitment, pending, above 7x EBITDA |
| `larkspur-p2-q1`, `meridian-p7-q1`, `thornbury-p7-q1` | wording | gives the agreed item; no NOT AGREED item is called open |
| `thornbury-p2-q3` | wording | "BeDeveloped recommended … you decided not to go ahead with it" |
| `thornbury-p8-q2` | wording | "No. BeDeveloped recommended … at £12k; you decided not to go ahead" |
| `westbourne-p3-q3` | wording | pending; "in March" stays on the Edinburgh LP day |
| `meridian-p1-q2` | grader | the £35k base plus success fee from Week 22 is given as current, replacing the £45k fee |
| `brookvale-p3-q2` | grader | the briefing itself is still pending; the Week 7 campaign plan is built on it |
| `brookvale-p3-q1` | answer and grader | gives both the Week 3 target (10 relationships) and the Week 8 target (2 to 8 recommenders). It wrongly calls the second "the later figure", as if it replaced the first; a stricter grader would mark it partial. |

**Regressions:** none among scored questions. One unscored superseded question went from correct to partial: `fernhill-p2-q2` leaves out the replaced £4m to £11m figure. `fernhill-p2-q3` (also unscored) says nothing links the point of view to £20m. That is expected: the v2 upload overwrote the v1 Pillar 2 form, so the £20m wording is no longer stored.

**Hand review:**
- **STATUS flags.**
  - `brookvale-p8-q3` is real. It invents an agreed action, "keep CDD and FDD offers separate".
  - `meridian-p10-q1` is unscored, and not a real error. The Week 10 form was overwritten by v2, so the answer can't know Week 10 agreed the fee.
  - The same kind of invented "you agreed to …" appears, unflagged, in `elmstead-p5-q1` and `elmstead-p5-q3`.
  - No recommendation's own status was misreported.
- **Unsupported claims are mostly the describer's text, not the form's.**
  - About 25 of the 41 are "takeaways", quoted aims or challenges, or reasons ("declined on cost"). The grader prompt mentions none of these, so they very likely come from the overview and discussion chunks. Those chunks embed `keyDecisions`, `keyTakeaways` and `challengesRaised` from the describer (`chunker.ts:56-57`, `:80`). This is the same pattern as the `openQuestions` problem that fix 1 removed.
  - About 8 are false flags: next-session and check-in dates. These come from the form's next-session date cell (`5,0,1`), which `build_grade_batches.py` doesn't pass to graders.
- **Grader leniency.** Verdicts were 315 correct and 0 partial, against 303 and 6 on 17 Nov. Part of the gain is the new grading rule (`meridian-p1-q2`, `brookvale-p3-q2`). Unit-level checks in `p1-diagnosis.md` and `p3-check/results.md` back the retrieval and wording fixes independently.

## 4. Known weaknesses (as of the 17 Nov re-run after the Pillar 1, grader and wording fixes)

Fixed since the first 17 Nov eval:
- Invented open questions: fix 1.
- Agreed status blurred: fix 2, plus the new `answer.ts` wording. No recommendation's status was misreported in the latest run.
- Retrieval misses: fix 3 plus the Pillar 1 re-rank. Pillar 1 is now 29 of 29.

Still open:

1. **The describer's interpretations are presented as fact.**
   - The overview and discussion chunks embed `keyDecisions`, `keyTakeaways`, `commonThemes`, `clientViews` and `challengesRaised` from the describer (`chunker.ts:53-58`, `:79-80`).
   - About 25 answers repeat these as if the form said them. Examples: "declined on cost" (`thornbury-p8-q2`), and invented agreed actions in `brookvale-p8-q3` and `elmstead-p5-q3`.
   - No graded answer fails because of it, but it is the main remaining source of wrong claims. It is the same pattern as `openQuestions`.
2. **Padding.** Many answers add accurate points from the client's other sessions. That's fine, but it gives the item above more chances to show up.
3. **Grader blind spots.**
   - `build_grade_batches.py` doesn't pass the form's next-session date cell (`5,0,1`), so correct next-session and check-in dates are flagged as unsupported.
   - Graders gave 0 partials this run, so treat the 100% as a ceiling. `brookvale-p3-q1` is arguably partial.
4. **Latency.** p90 is 3.6s against a target of about 3s, unchanged from the 12-chunk retrieval.

---

## 5. Next task: commit, redeploy, then de-risk the describer text

1. **Commit** the three changes (retrieval re-rank, all-forms grading, answer wording) to `feat/client-knowledge-agent` and update the PR #103 body with the results above. Before merging, fix or waive the 7 pre-existing `npm run lint` errors in non-knowledge files: `auth/deleteClient.ts`, `backup/scheduledFirestoreExport.ts`, `gdpr/gdprEraseUser.ts`, `gdpr/gdprExportUser.ts` and `lifecycle/scheduledPurge.ts`.
2. **Redeploy** `knowledgeIngest` and `knowledgeAsk` with the safe procedure (section 6). This needs Hugh's approval. Forms already uploaded keep their old chunk text until they are re-uploaded.
3. **Describer text.** Stop embedding describer-written decisions, takeaways and challenges as statements. Either drop them from chunk text, as was done for `openQuestions`, or label them "BeDeveloped's summary (not recorded in the form)". Then add a prompt rule: say a decision was agreed only if a recommendation's Status says so. Re-run, and count the "takeaway" and invented-decision unsupported claims; the target is close to 0.
4. **Small eval fixes** (in `report.eval.test.ts` and `build_grade_batches.py`): compute `passRate` over the scored set, and include the next-session date in the grader's form text.
5. **Optional:** bring p90 under 3s, for example with a smaller answer model or fewer, shorter overview chunks.

---

## 6. Deploy procedure (functions): do not skip

From `runbooks/v6-functions-deploy.md`:
- `firebase deploy --only functions` tries to bind `allUsers` invoker; org policy blocks that. On this project, a failed IAM set once wiped the identity-toolkit invoker on the **blocking auth handlers**, which takes sign-in down platform-wide.
- So: always deploy **named functions only**, snapshot before and after, and never write IAM automatically.

### Steps

1. **Logins expire about daily.** Hugh re-auths with `!` commands, which need a browser:
   ```
   ! export CLOUDSDK_PYTHON="$HOME/.local/pythons/python/bin/python3" PATH="$HOME/google-cloud-sdk/bin:$PATH"; gcloud auth application-default login
   ! export CLOUDSDK_PYTHON="$HOME/.local/pythons/python/bin/python3" PATH="$HOME/google-cloud-sdk/bin:$PATH"; gcloud auth application-default set-quota-project bedeveloped-base-layers
   ! npx -y firebase-tools@15.16.0 login --reauth     # sign in as business@bedeveloped.com
   ```
2. **Snapshot and gate.**
   - **Run under `bash -c`.** zsh doesn't word-split `$WATCH`, and it treats `$s:getIamPolicy` as a modifier, which gives a fake "unreadable" gate failure.
   - Write to a **new** folder. The safety check blocks `rm` on old snapshots.
   - Use the loop from `scripts/v6-functions-deploy/run.sh` with:
     ```
     WATCH="auditwrite softdelete restoresoftdeleted permanentlydeletesoftdeleted getdocumentsignedurl beforeusercreatedhandler beforeusersignedinhandler knowledgeingest knowledgeask knowledgeuploads knowledgesetstatus knowledgecoverage"
     ```
   - Then `python3 scripts/v6-functions-deploy/report.py "$SNAP" before --gate $WATCH`. Proceed only on exit 0.
3. **Build.** In `functions/`: `npm ci && npm run build && npm test`, on Node 22.
4. **Deploy.**
   ```
   npx -y firebase-tools@15.16.0 deploy --only functions:knowledgeIngest,functions:knowledgeAsk --project bedeveloped-base-layers --non-interactive
   ```
   The auto-mode classifier may block this. Hugh has authorised these deploys in chat before, but ask him first.
5. **After-snapshot.** Run `report.py "$SNAP" after --diff $WATCH`. It must say "nothing lost".
6. **Smoke test.** `curl -X POST https://knowledgeask-xs3tweoexa-nw.a.run.app -H 'content-type: application/json' -d '{"data":{"question":"x"}}'` should return `UNAUTHENTICATED`.

Snapshots so far are in `~/Desktop/knowledge-deploy-snapshot`, `…-2` and `…-3`.

---

## 7. Local browser testing (staff panel)

- **Config:** `firebase.local-test.json` is the repo `firebase.json` plus an auth emulator, with `firestore.host = "::"`. It is git-excluded via `.git/info/exclude`.
- **Keys:** the functions emulator reads them from `functions/.secret.local`, which is git-excluded. Delete it after use.
- **Start the emulators:** `--config firebase.local-test.json --only auth,firestore,functions,storage --project bedeveloped-base-layers`, with `CLOUDSDK_CONFIG` set to an empty directory so no production credentials are found.
- **Start the dev server:** `VITE_USE_EMULATORS=1 VITE_KNOWLEDGE_ADMIN=1 npx vite`.
- **Test users:** seed them with the Admin SDK and set claims. The auth emulator **can't do TOTP**, so sign in, then add an SMS factor with the Admin SDK (`enrolledFactors: [{uid, phoneNumber, factorId: "phone"}]`) and reload.
- **Known issue:** the web app's Firestore stream sometimes won't connect to the emulator. The panel doesn't need it, so seed `orgs/{id}` with the Admin SDK instead.

---

## 8. Other open items

### Needs a decision

- **Overwrite rule vs history.** The 23 Oct call said historical recommendations should stay visible next to updated ones. One-record-per-pillar loses that unless the new form mentions the change. Raise it with Hugh and Luke.
- **Sign-in check after functions deploys.** Hugh was asked to sign out and back in (with MFA) on the live site after the 16 and 17 Nov deploys. Not confirmed.

### Waiting on Luke

- Real completed forms for Pillars 2–10. Run them through `forms.unit`-style parsing first. The topic areas for Pillars 2–10 in `types.ts` are drafts.
- George's term library (the "associated terms" tag is empty until then).

### Not built yet

- Client-facing widget (Hugh: not until the agent is good).
- Weekly usage report email.
- Admin and client guides.
- Document types other than the Session Capture Form (review doc, internal delivery framework).
- Editing titles or tags after upload.

### Elsewhere

- **Procurement-partners mailbox:** Miles's Claude (#118, #119) proposed a split. Hugh takes the Maybourne / ART / BRC ingestion fixes A1–A5 and C1–C2 before the 18 Nov send; Miles takes the Price Viewer. That belongs to a Procurement-partners session, not this repo.
- **Local tools installed this session:** gitleaks 8.30.1 in `~/.local/bin`, Temurin 21 JRE in `~/.local/jre`.
- **Memory:** `~/.claude/projects/-Users-hughdowling-Desktop-base-layers-diagnostic/memory/client-knowledge-agent.md` holds the running record.
