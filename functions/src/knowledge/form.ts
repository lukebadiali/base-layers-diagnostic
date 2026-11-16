// Parses a BeDeveloped Session Capture Form (the Pillar 1 (ICP) template
// Luke sent on 28 Oct 2026) into structured fields. The other pillars'
// forms are expected to share this layout with their own Area rows.
//
// Section 4 (Actions) is read past and dropped: action tags were removed at
// sign-off because Base Layers tracks actions separately.

import type { DocxBlock } from "./docx";
import type { AgreedStatus, ParsedForm, PillarKey } from "./types";

export class FormError extends Error {}

type Section = "details" | "summary" | "discussion" | "recommendations" | "actions" | "next" | null;

function sectionFor(heading: string): Section | undefined {
  const h = heading.trim().toLowerCase();
  if (h === "session details") return "details";
  if (/^1\.\s*summary/.test(h)) return "summary";
  if (/^2\./.test(h)) return "discussion";
  if (/^3\./.test(h)) return "recommendations";
  if (/^4\./.test(h)) return "actions";
  if (/^5\./.test(h)) return "next";
  return undefined;
}

/** Template placeholders such as "[Name]" count as empty. */
function clean(s: string | undefined): string {
  const t = (s ?? "").trim();
  return /^\[[^\]]*\]$/.test(t) ? "" : t;
}

function keyValues(rows: string[][]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) if (r.length >= 2) m.set(r[0].trim().toLowerCase(), clean(r[1]));
  return m;
}

export function parsePillar(raw: string): { pillar: PillarKey; pillarName: string } {
  const t = raw.trim();
  if (/^review\b/i.test(t)) return { pillar: "review", pillarName: t.replace(/^review\s*[:\-–]?\s*/i, "") || "Review" };
  const m = /^pillar\s*(\d{1,2})\s*[:\-–]?\s*(.*)$/i.exec(t);
  const n = m ? Number(m[1]) : NaN;
  if (!m || n < 1 || n > 10) throw new FormError(`Pillar field not recognised: "${raw}"`);
  return { pillar: String(n) as PillarKey, pillarName: m[2].trim() };
}

/** DD/MM/YYYY (or with - or .) to YYYY-MM-DD. Empty stays empty. */
export function parseUkDate(raw: string, field: string): string {
  const t = clean(raw);
  if (!t) return "";
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (!m) throw new FormError(`${field} must be DD/MM/YYYY, got "${raw}"`);
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new FormError(`${field} is not a real date: "${raw}"`);
  }
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseAgreed(raw: string): AgreedStatus {
  const t = clean(raw).toLowerCase();
  if (!t) return "unspecified";
  const first = t.split(/[\s,.;:!-]+/)[0];
  if (["y", "yes", "agreed", "\u2713", "\u2714"].includes(first)) return "yes";
  if (["n", "no", "declined", "rejected"].includes(first) || t.startsWith("not agreed")) return "no";
  return "pending";
}

function splitList(raw: string): string[] {
  return clean(raw)
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseSessionForm(blocks: DocxBlock[]): ParsedForm {
  const tables: Partial<Record<Exclude<Section, null>, string[][][]>> = {};
  let section: Section = null;
  for (const b of blocks) {
    if (b.kind === "p") {
      const s = sectionFor(b.text);
      if (s !== undefined) section = s;
    } else if (section) {
      (tables[section] ??= []).push(b.rows);
    }
  }

  const details = keyValues((tables.details ?? []).flat());
  const pillarRaw = details.get("pillar") ?? "";
  if (!pillarRaw) throw new FormError("Session Details has no Pillar field; is this a Session Capture Form?");
  const { pillar, pillarName } = parsePillar(pillarRaw);

  const client = details.get("client") ?? "";
  if (!client) throw new FormError("Client field is empty");
  const sessionDate = parseUkDate(details.get("date") ?? "", "Date");
  if (!sessionDate) throw new FormError("Date field is empty");

  const summary = keyValues((tables.summary ?? []).flat()).get("summary") ?? "";

  const discussion: ParsedForm["discussion"] = [];
  for (const rows of tables.discussion ?? []) {
    for (const r of rows.slice(1)) {
      const topic = clean(r[0]);
      const keyPoints = clean(r[1]);
      if (topic || keyPoints) discussion.push({ topic, keyPoints });
    }
  }

  // A row with no recommendation was not discussed: it is skipped, never stored as blank advice.
  const recommendations: ParsedForm["recommendations"] = [];
  for (const rows of tables.recommendations ?? []) {
    for (const r of rows.slice(1)) {
      const recommendation = clean(r[1]);
      if (recommendation) recommendations.push({ area: clean(r[0]), recommendation, agreed: parseAgreed(r[2] ?? "") });
    }
  }

  const next = keyValues((tables.next ?? []).flat());

  return {
    pillar,
    pillarName,
    client,
    sessionDate,
    sessionName: details.get("session") ?? "",
    attendees: splitList(details.get("attendees") ?? ""),
    capturedBy: details.get("captured by") ?? "",
    summary,
    discussion,
    recommendations,
    nextSession: {
      date: parseUkDate(next.get("date") ?? "", "Next session date"),
      focus: next.get("focus") ?? "",
      preparation: next.get("preparation needed") ?? "",
    },
  };
}

/** Case, spacing and punctuation-insensitive comparison for the Client check. */
export function sameClient(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return norm(a) === norm(b);
}

/**
 * Staff who attended: a full-name match, or a first-name match on an
 * attendee line that also says BeDeveloped (so a client's own "Luke" is not
 * mistaken for Luke Badiali).
 */
export function bedevelopedLeads(attendees: string[], staff: string[]): string[] {
  const lines = attendees.map((a) => a.toLowerCase());
  return staff.filter((name) => {
    const full = name.toLowerCase();
    const first = full.split(" ")[0];
    return lines.some(
      (l) => l.includes(full) || (new RegExp(`\\b${first}\\b`).test(l) && l.includes("bedeveloped")),
    );
  });
}
