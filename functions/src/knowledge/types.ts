// Client Knowledge Agent: shared types and the signed-off tag set.
//
// Tags signed off by Luke Badiali (email "tags for RAG", 9 Nov 2026): the
// 39 proposed tags minus Action, Action owner and Action due date, which
// Base Layers already tracks elsewhere. 36 tags remain.
//
// Overwrite rule (Hugh, 12 Nov 2026): one record per client per pillar form.
// A new upload for the same client and pillar replaces the previous one.

export type PillarKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "review";

export type DocumentType = "session_form" | "pillar_document" | "review" | "delivery_framework";

export type AgreedStatus = "yes" | "no" | "pending" | "unspecified";

export type KnowledgeStatus = "current" | "archived";

/** What the parser reads from a Session Capture Form. Actions are not read. */
export interface ParsedForm {
  pillar: PillarKey;
  pillarName: string;
  client: string;
  /** ISO date, YYYY-MM-DD. */
  sessionDate: string;
  sessionName: string;
  attendees: string[];
  capturedBy: string;
  summary: string;
  discussion: Array<{ topic: string; keyPoints: string }>;
  recommendations: Array<{ area: string; recommendation: string; agreed: AgreedStatus }>;
  nextSession: { date: string; focus: string; preparation: string };
}

/** What the describer adds. Every field is an AI tag from the signed-off list. */
export interface Description {
  // AI, from the text
  jobTitles: string[];
  targetOrganisations: string[];
  competitors: string[];
  positionChanges: string[];
  proofPoints: string[];
  // AI overview
  mainPoints: string[];
  keyTakeaways: string[];
  commonThemes: string[];
  keyDecisions: string[];
  pillarKeyPoints: string[];
  topicAreaKeyPoints: Array<{ area: string; points: string[] }>;
  openQuestions: string[];
  clientContext: string;
  // Per-row tags for form section 2 and section 3
  discussion: Array<{ index: number; clientViews: string[]; challengesRaised: string[]; topicArea: string }>;
  recommendationAreas: Array<{ index: number; topicArea: string }>;
}

export interface UploadMeta {
  orgId: string;
  /** The client name as held on the org record; the form's Client field must match it. */
  clientName: string;
  documentType: DocumentType;
  uploadedBy: string;
  /** ISO timestamp. */
  uploadedAt: string;
  sourceFileName: string;
}

export type ChunkKind = "session" | "overview" | "discussion" | "recommendation" | "next_session";

export interface Chunk {
  kind: ChunkKind;
  /** The text that is embedded and returned to the agent. */
  text: string;
  /** Chunk-level tags. Document-level tags are added at write time. */
  tags: Record<string, string | string[]>;
}

/**
 * Topic areas per pillar, for matching rows to areas. Pillar 1 comes from
 * Luke's form and is confirmed; Pillars 2-10 are drafts until his forms
 * for those pillars arrive.
 */
export const TOPIC_AREAS: Record<Exclude<PillarKey, "review">, string[]> = {
  "1": [
    "Ideal Customer Profile",
    "Market segmentation",
    "Positioning and differentiation",
    "Category framing",
    "Competitive landscape",
    "Commercial strategy",
    "Pricing and value",
  ],
  "2": [
    "Value proposition",
    "Commercial narrative",
    "Messaging architecture",
    "Differentiation and point of view",
    "Cost of inaction",
    "Proof and outcomes",
  ],
  "3": [
    "Channel mix",
    "Outbound",
    "Inbound",
    "Events",
    "Cadences and sequences",
    "Behavioural drivers",
    "Lead quality and volume",
  ],
  "4": [
    "Sales process",
    "Discovery",
    "Qualification",
    "Solution selling",
    "Objection handling",
    "Negotiation and closing",
    "Proposals and procurement",
    "Enablement and coaching",
  ],
  "5": ["Stages and exit criteria", "Conversion rates", "Velocity and cycle time", "Pipeline coverage", "Stalled deals"],
  "6": ["CRM", "Data quality", "Playbooks", "Forecasting", "Funnel metrics", "Reporting and dashboards"],
  "7": [
    "Campaign planning",
    "Content strategy",
    "Brand and thought leadership",
    "Founder brand",
    "Case studies and social proof",
    "Campaign measurement",
  ],
  "8": [
    "Partner strategy",
    "Channel partners",
    "Alliances and joint ventures",
    "Referral networks",
    "Partner enablement",
    "Industry presence",
  ],
  "9": [
    "Onboarding",
    "Retention and churn",
    "Upsell and cross-sell",
    "Key accounts",
    "Advocacy",
    "Customer satisfaction",
    "Renewals",
  ],
  "10": [
    "Pricing strategy",
    "Margins",
    "Cost of acquisition",
    "Lifetime value",
    "Unit economics",
    "Sales and marketing ROI",
    "Revenue scenarios",
  ],
};

export function topicAreasFor(pillar: PillarKey): string[] {
  return pillar === "review" ? [] : TOPIC_AREAS[pillar];
}

/** BeDeveloped staff, for the "BeDeveloped lead" tag. */
export const BEDEVELOPED_STAFF = ["Luke Badiali", "George Berrington"];

export const EMBEDDING_DIMENSIONS = 1536;
export const CHUNKS_COLLECTION = "knowledgeChunks";
export const RECORDS_COLLECTION = "knowledgeRecords";
