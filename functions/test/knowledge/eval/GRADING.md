# Grading the knowledge eval with Claude sub-agents

How to grade `out/results.json` with Claude Code sub-agents. The rubric is the same as `GRADING_RULES` in `report.eval.test.ts`, which the API fallback uses. If you change one, change the other.

## 1. Build the batches

From `functions/test/knowledge/eval/`:

```sh
python3 -I build_grade_batches.py "$PWD"
```

This writes `out/grade-batches/batch{1..5}.json`. Each file is a JSON list of client groups. There are 2 clients per batch and about 70 items:

```json
[
  {
    "client": "meridian",
    "forms": {
      "meridian__p1": { "label": "Pillar 1: ...; Week 1 - ...; 18/07/2026", "pillar": "1", "date": "18/07/2026", "text": "Session date: ...\nAttendees: ...\n{form content JSON}" },
      "meridian__p10__v2": { "label": "Pillar 10: ...; Week 22 - ...; 12/12/2026; later form (v2)", "...": "..." }
    },
    "items": [
      { "id": "meridian-p1-q2", "kind": "fact", "question": "...", "expectedFacts": ["..."], "oldPositions": [], "primaryForm": "meridian__p1", "answer": "..." }
    ]
  }
]
```

- `forms` holds ALL of the client's forms, including `__v2`, in date order. Each form starts with its session date and attendees line.
- `primaryForm` is the form the question was written from. It is the v2 form for `latest` questions, the v1 form for all others, and `null` for `out_of_scope` questions.
- `oldPositions` are positions that must not be given as current.

Do not overwrite `out/grade-batches/grades*.json` from an earlier run unless you mean to re-grade.

## 2. Spawn the graders

Spawn 5 fresh sub-agents in parallel, one per batch. Do not reuse the agents that wrote the forms. Give each one the prompt below, with `{k}` and the absolute eval path filled in.

> You are grading an AI assistant's answers to client questions about their consulting sessions. Read `<eval>/out/grade-batches/batch{k}.json`. It is a list of client groups, each `{client, forms, items}`. Grade every item in every group against that group's `forms`, using these rules:
>
> 1. Be strict and literal.
> 2. Expected facts come from the item's `primaryForm`. Use the client's other forms to check claims and later changes.
> 3. **Later sessions.** If the answer gives a different position from a form dated LATER than the primary form, on the same topic, and correctly presents it as the current one, count that expected fact as satisfied. Ideally the answer notes the change. When the question asks for a figure that changed, leaving out the earlier figure makes the answer `partial`, not `incorrect`. Giving an EARLIER position as current when a later form changed it is wrong.
> 4. `verdict`:
>    - `correct`: every expected fact is present (paraphrase is fine, or the fact is superseded by a later form as in rule 3), and nothing contradicts the forms.
>    - `partial`: some expected facts are present and none are contradicted.
>    - `incorrect`: expected facts are missing or contradicted, or an old or superseded position is given as current.
>    - `declined`: the answer says the topic has not been covered. For `out_of_scope` items (`primaryForm` null, no expected facts) this is the right answer.
> 5. `presentsOldPositionAsCurrent`: true if any `oldPositions` entry, or any position a later form changed, is given as the current position. Mentioning it as earlier or replaced is fine.
> 6. `missingFacts`: expected facts not in the answer and not superseded by a later form that the answer uses.
> 7. `unsupportedClaims`: specific claims (names, numbers, decisions, dates) that appear in NONE of the client's forms. The session date and attendees lines count as source, so job titles and dates there are supported. Do not flag a claim only because it is outside the primary form.
> 8. Agreed status: if the answer calls an item agreed, not agreed, pending or rejected when the form says otherwise, list it in `unsupportedClaims` prefixed `STATUS: `. Saying a NOT AGREED item "was not agreed" or "was rejected" is correct. Do not flag it.
> 9. `note`: one sentence explaining the verdict.
>
> Write `<eval>/out/grade-batches/grades{k}.json` as a single JSON object with one key for every item id in the batch:
>
> `{"<id>": {"verdict": "correct"|"partial"|"incorrect"|"declined", "missingFacts": [string], "presentsOldPositionAsCurrent": boolean, "unsupportedClaims": [string], "note": string}}`
>
> Use no other keys. Check that the count of ids matches the batch. Write only that file. Reply with the counts per verdict and the ids you were unsure about.

## 3. Merge and report

```sh
cd out && python3 -I -c "import json,glob; g={}; [g.update(json.load(open(f))) for f in sorted(glob.glob('grade-batches/grades*.json'))]; json.dump(g, open('grades.json','w'), indent=1); print(len(g))"
```

The count must equal the number of results (350). Then, from `functions/`:

```sh
KNOWLEDGE_EVAL_REPORT=1 npx vitest run test/knowledge/eval/report.eval.test.ts
```

It fails if any case is ungraded. Fact questions on a pillar with a v2 form are reported but not scored.

## 4. Review by hand

- **STATUS flags.** Graders over-flag correct "not agreed" / "you rejected it" wording. Read each STATUS flag against the form.
- **Later-session verdicts.** Spot-check `incorrect` verdicts whose note mentions a later form or a changed figure. Known cases from 17 Nov: `meridian-p1-q2` (the £45k fee was replaced by £35k base plus success fee in `meridian__p10__v2`, so correct), `brookvale-p3-q2` (pending in Week 3, agreed in `brookvale__p7`, so correct), `brookvale-p3-q1` (10 relationships in Week 3, 2 to 8 in Week 8; giving only the later figure is partial).
