// Splits one described form into retrieval chunks. Every chunk opens with
// a context line (client, pillar, session, date, BeDeveloped lead) so a
// chunk read on its own still says where it came from.

import { topicAreasFor, type Chunk, type Description, type ParsedForm } from "./types";

// Spelled out so the answerer cannot blur them: on 17 Nov "Not agreed" was
// read as a ban in force and "Pending" as "agreed in principle".
export const AGREED_LABEL = {
  yes: "AGREED (the client accepted this)",
  no: "NOT AGREED (the client rejected this; it is not in force)",
  pending: "PENDING (not yet decided)",
  unspecified: "status not recorded",
};

function bullets(title: string, items: string[]): string {
  return items.length ? `${title}:\n${items.map((i) => `- ${i}`).join("\n")}` : "";
}

function join(...parts: string[]): string {
  return parts.filter((p) => p && p.trim()).join("\n\n");
}

export function buildChunks(form: ParsedForm, desc: Description, leads: string[]): Chunk[] {
  const pillarLabel = form.pillar === "review" ? "Review" : `Pillar ${form.pillar}: ${form.pillarName}`;
  const header = [
    `Client: ${form.client}`,
    pillarLabel,
    form.sessionName && `Session: ${form.sessionName}`,
    `Date: ${form.sessionDate}`,
    leads.length ? `With: ${leads.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const chunks: Chunk[] = [];

  chunks.push({
    kind: "session",
    text: join(
      header,
      form.summary && `Session summary: ${form.summary}`,
      form.attendees.length ? `Attendees: ${form.attendees.join("; ")}` : "",
      desc.clientContext && `Client context: ${desc.clientContext}`,
    ),
    tags: {},
  });

  chunks.push({
    kind: "overview",
    text: join(
      header,
      bullets("Main points", desc.mainPoints),
      bullets(`${form.pillarName || "Pillar"} key points`, desc.pillarKeyPoints),
      ...desc.topicAreaKeyPoints.map((t) => bullets(`${t.area} key points`, t.points)),
      bullets("Key decisions", desc.keyDecisions),
      bullets("Key takeaways", desc.keyTakeaways),
      bullets("Common themes", desc.commonThemes),
      // Taken from the form's own Pending rows, never from the describer's
      // openQuestions (which it invented for every record on 17 Nov).
      bullets(
        "Still pending",
        form.recommendations
          .filter((r) => r.agreed === "pending")
          .map((r) => (r.area ? `${r.area}: ${r.recommendation}` : r.recommendation)),
      ),
    ),
    tags: {},
  });

  form.discussion.forEach((d, i) => {
    const extra = desc.discussion.find((x) => x.index === i);
    chunks.push({
      kind: "discussion",
      text: join(
        header,
        `Discussion topic: ${d.topic || "(untitled)"}`,
        d.keyPoints,
        bullets("Client views", extra?.clientViews ?? []),
        bullets("Challenges raised", extra?.challengesRaised ?? []),
      ),
      tags: {
        discussionTopic: d.topic,
        keyPoint: d.keyPoints,
        clientView: extra?.clientViews ?? [],
        challengeRaised: extra?.challengesRaised ?? [],
        topicArea: extra?.topicArea ?? "Other",
      },
    });
  });

  const known = topicAreasFor(form.pillar).map((a) => a.toLowerCase());
  form.recommendations.forEach((r, i) => {
    const area = known.includes(r.area.toLowerCase())
      ? r.area
      : (desc.recommendationAreas.find((x) => x.index === i)?.topicArea ?? "Other");
    chunks.push({
      kind: "recommendation",
      text: join(header, `Recommendation on ${area}. Status: ${AGREED_LABEL[r.agreed]}.\n${r.recommendation}`),
      tags: { topicArea: area, recommendation: r.recommendation, agreedStatus: r.agreed },
    });
  });

  const n = form.nextSession;
  if (n.date || n.focus || n.preparation) {
    chunks.push({
      kind: "next_session",
      text: join(
        header,
        n.date && `Next session date: ${n.date}`,
        n.focus && `Next session focus: ${n.focus}`,
        n.preparation && `Preparation needed: ${n.preparation}`,
      ),
      tags: { nextSessionDate: n.date, nextSessionFocus: n.focus, preparationNeeded: n.preparation },
    });
  }

  // A chunk that is only the context line (e.g. an empty overview) carries nothing to retrieve.
  return chunks.filter((c) => c.text.trim() !== header);
}
