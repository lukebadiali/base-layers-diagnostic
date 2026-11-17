// Fictional clients and pillar definitions for the Client Knowledge Agent
// evaluation. Every company and person here is invented; none is a
// BeDeveloped client. Varied on purpose (sector, size, buyer, situation) so
// an answer that drifts to another client is easy to spot.

import { TOPIC_AREAS, type PillarKey } from "../../../src/knowledge/types";

export interface EvalClient {
  id: string;
  name: string;
  profile: string;
  /** Client-side attendees, "Name (Role)". */
  people: string[];
}

export const EVAL_CLIENTS: EvalClient[] = [
  {
    id: "harbourline",
    name: "Harbourline Marine Insurance",
    profile: "Specialist marine cargo insurer, Southampton, 140 staff, selling through brokers and wanting to win direct accounts with shipping lines.",
    people: ["Fiona Marsh (Managing Director)", "Owen Pryce (Head of Distribution)"],
  },
  {
    id: "kestrel",
    name: "Kestrel Robotics",
    profile: "Warehouse picking-robot maker, Coventry, 60 staff, Series A funded, long sales cycles with 3PL operators.",
    people: ["Dev Malhotra (CEO and co-founder)", "Hannah Lowe (Commercial Director)"],
  },
  {
    id: "brightwell",
    name: "Brightwell Payroll Services",
    profile: "Outsourced payroll bureau for UK charities and housing associations, Leeds, 85 staff, price pressure from software-only rivals.",
    people: ["Martin Okafor (Founder)", "Claire Dunn (Sales Manager)"],
  },
  {
    id: "oakmere",
    name: "Oakmere Architectural Glazing",
    profile: "Manufacturer of fire-rated glazing systems, Stoke-on-Trent, 220 staff, sells to main contractors and specifiers on commercial builds.",
    people: ["Gareth Wynn (Sales Director)", "Priti Desai (Marketing Lead)"],
  },
  {
    id: "lumen",
    name: "Lumen Clinical Data",
    profile: "SaaS for clinical-trial data capture, Cambridge, 45 staff, selling to mid-size CROs and biotech sponsors in UK and EU.",
    people: ["Dr Anna Kowalski (CEO)", "Sam Turner (VP Sales)"],
  },
  {
    id: "redfern",
    name: "Redfern Facilities Group",
    profile: "Integrated facilities management (cleaning, security, M&E) for universities and NHS trusts, Bristol, 900 staff, bid-driven.",
    people: ["Rachel Odell (Chief Executive)", "Tom Bassey (Bid Director)"],
  },
  {
    id: "quillstone",
    name: "Quillstone Legal Tech",
    profile: "Contract review software for in-house legal teams, London, 30 staff, founder-led sales, wants first dedicated sales hire.",
    people: ["Imogen Clarke (Founder)", "Ravi Shah (Head of Customer Success)"],
  },
  {
    id: "northgate",
    name: "Northgate Industrial Coatings",
    profile: "Protective coatings for steel structures and pipelines, Middlesbrough, 120 staff, distributor-led, exploring direct key accounts in energy.",
    people: ["Alan Pierce (Managing Director)", "Joanne Kerr (Technical Sales Manager)"],
  },
  {
    id: "tidewater",
    name: "Tidewater Learning",
    profile: "Corporate e-learning content studio, Brighton, 25 staff, project-based revenue, wants recurring subscription income.",
    people: ["Ellie Grant (Co-founder)", "Marcus Hale (Co-founder)"],
  },
  {
    id: "vantage",
    name: "Vantage Fleet Telematics",
    profile: "Vehicle tracking and driver-behaviour telematics for UK haulage and bus operators, Warrington, 160 staff, renewals slipping.",
    people: ["Karen Doyle (Chief Commercial Officer)", "Liam Foster (Customer Success Director)"],
  },
];

/** Official pillar names, as the app names them. */
export const PILLAR_NAMES: Record<Exclude<PillarKey, "review">, string> = {
  "1": "Strategy, ICP & Market Positioning",
  "2": "Value Proposition & Commercial Narrative",
  "3": "Demand Generation & Behavioural Drivers",
  "4": "Sales Execution & Enablement",
  "5": "Pipeline Architecture & Conversion",
  "6": "Revenue Operations & Systems",
  "7": "Aligning Marketing Campaigning",
  "8": "Partnerships & Channel Development",
  "9": "Customer Success, Retention & Expansion",
  "10": "Financial & Commercial Modelling",
};

export const PILLARS = Object.keys(PILLAR_NAMES) as Array<Exclude<PillarKey, "review">>;

export function topicAreas(p: Exclude<PillarKey, "review">): string[] {
  return TOPIC_AREAS[p];
}

/** Which client gets a later, changed second form for which pillar (tests that the newer form wins). */
export const V2_FORMS: Array<{ client: string; pillar: Exclude<PillarKey, "review"> }> = [
  { client: "harbourline", pillar: "1" },
  { client: "kestrel", pillar: "2" },
  { client: "brightwell", pillar: "10" },
  { client: "lumen", pillar: "4" },
  { client: "vantage", pillar: "9" },
];

/** BeDeveloped staff who run sessions, split so "who did I discuss X with" has a real answer. */
export function leadFor(clientIndex: number, pillar: Exclude<PillarKey, "review">): string {
  return (clientIndex + Number(pillar)) % 2 === 0 ? "Luke Badiali" : "George Berrington";
}
