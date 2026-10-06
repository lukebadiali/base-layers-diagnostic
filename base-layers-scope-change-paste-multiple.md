# Base Layers: Scope Change Request

**Client:** BeDeveloped (Luke Badiali, Director)
**Product:** Base Layers portal
**Source:** Email thread "Base Layers function", 10–11 August 2026
**Prepared:** 11 August 2026
**Status:** Accepted verbally by Hugh ("I will implement the change and sort the rest", 11 Aug)

---

## 1. Summary

Luke has asked for a **"paste multiple"** bulk-entry function on the **Actions tab**, mirroring the equivalent function that already exists and works well on the **Plan** tab. A second, smaller item has attached itself to the request during the exchange: a **blank option in the pillar dropdown**.

Luke attempted the work himself and pushed no changes, so the build starts from the current `main`. There is no work in progress to pick up.

---

## 2. What Luke has actually asked for

### 2.1 Paste multiple on the Actions tab (the headline request)

> "One function we were looking to add was 'paste multiple' on actions tab. There is the function on the plan and would be great to multi upload."

**The problem being solved:** BeDeveloped routinely have a list of ten or so client actions (his examples: "Document ICP", "Build top 50 hit list", "improve the properties on HubSpot"). At present these must be entered one by one, which is slow when the list is long.

> "Issue is we're having to put them in one more one and if it's a long list it can take time."

**The reference implementation:** Luke sent a screenshot of the existing bulk-paste on the Plan section and confirmed it as the model:

> "Ok cool, this is the one on the plan part that works well."

**Acceptance:** a user can paste a list of items into the Actions tab in one operation and have each item created as a separate action, with behaviour consistent with the Plan tab.

### 2.2 Blank option in the pillar dropdown (a second, smaller change)

> "We also need to have a blank pillar in the drop down in case its not relevant to the 10 pillars."

This is a distinct change and easy to lose in the noise of the main request. It implies actions may exist unassigned to any of the ten pillars, which has consequences beyond the dropdown itself (see section 5).

---

## 3. Implementation decision still open

Hugh offered two approaches on 10 August:

| Option | Description | Assessment |
|---|---|---|
| **A. Delimiter split** | Paste a delimited list; each item becomes a separate action. | Recommended by Hugh. Cheap, deterministic, no running cost. |
| **B. AI paragraph split** | An LLM splits free-form prose into discrete points. | "More costly and complex, but more versatile." |

Luke did not choose between them. He responded by pointing at the existing Plan-tab function and saying it "works well", which should be read as **an implicit vote for parity with Plan rather than for either option in the abstract**. The safest reading of the brief is: *do what Plan already does*.

**A challenge to the comma proposal.** Comma separation is the weaker half of Option A and Luke's own examples demonstrate why: "improve the properties on hubspot" is fine, but real consultancy actions routinely contain commas ("Document ICP, including firmographics and triggers"). A comma delimiter will silently shred such an item into fragments, and the user will not notice until they review the list. **Line breaks are the better delimiter** — they match how people actually copy lists out of Word, Notion or an email, and they survive commas inside items. If the Plan tab already splits on line breaks, this decision is made for us and should simply be mirrored.

---

## 4. Scope of work

1. Add bulk paste to the Actions tab, matching the Plan tab's pattern and interaction model.
2. Confirm and implement the delimiter rule (recommend newline, with trimming of blank lines and whitespace).
3. Add a blank / "no pillar" option to the pillar dropdown, and handle unassigned actions throughout the views.
4. Test with a realistic ten-item list, including items containing commas.
5. Deploy and confirm to Luke.

**Out of scope unless separately agreed:** editing pasted items in bulk before commit, deduplication against existing actions, CSV or spreadsheet import, assigning different pillars per row on paste, and any AI-based splitting (Option B).

---

## 5. Consequences worth weighing before proceeding

**Second order.** A blank pillar makes pillar assignment optional. Anything downstream that groups, filters, reports or scores by pillar must now handle a null case: unassigned actions will either vanish from pillar-grouped views or need an "Unassigned" bucket. If they vanish silently, users will lose actions and blame the paste feature. Decide expressly which behaviour you want and state it to Luke.

**Second order.** Bulk entry removes the friction that was implicitly rationing action creation. Expect action volume per client to rise sharply. Any list, notification, digest or progress calculation built on the assumption of a handful of actions will feel the strain first.

**Second order.** Every pasted item arrives with default metadata: no pillar, no owner, no due date. The tool becomes faster at producing low-quality records. If action quality matters to BeDeveloped's delivery, the paste flow should push users towards completing the fields, not away from it.

**Third order.** Luke is now attempting changes himself with Claude rather than routing everything through you. That is a good outcome for his velocity and a mixed one for yours: each attempt he cannot finish returns to you as an unscheduled support request rather than a scoped piece of work. Worth deciding deliberately whether you want to make the repository safe for him to work in unaided, or keep changes flowing through AssumeAI and price them.

**Third order, and the one to watch.** No price has been named for this work. Precedent has already been set: the May tweaks and the July portal fixes were both absorbed free of charge. A pattern of free work following each invoice makes the next request harder to bill, and the relationship is commercially significant well beyond Base Layers (referral agreement, ecosystem agreement, business plan review, podcast). **State expressly whether this build is chargeable.** Silence will be read as free.

**Reversibility.** The paste feature is low-risk and easily reversed. The blank pillar is the sticky one: once unassigned actions exist in client data, removing the option later means migrating or re-tagging live records. Get the null-handling right the first time.

---

## 6. Open questions for Luke

1. Delimiter: line breaks (recommended) or commas?
2. Should pasted actions all take one pillar chosen before pasting, or all default to blank?
3. Where should actions with no pillar appear in pillar-grouped views?
4. Is the paste dialogue expected on the client-facing side, the admin side, or both?
5. Is this build chargeable, or absorbed?
