// Fictional clients and pillar definitions for the Client Knowledge Agent
// evaluation. Every company and person here is invented; none is a
// BeDeveloped client. They mirror Luke's real book (Hugh, 17 Nov 2026: mostly
// PE houses and consultancies), 4 PE and 6 consultancies, each different
// enough that an answer drifting to another client is easy to spot.

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
    id: "ashcombe",
    name: "Ashcombe Capital Partners",
    profile: "Lower mid-market private equity house, London, 18 staff, £300m fund, buy-and-build in UK business services; wants a stronger proprietary deal-origination engine instead of relying on corporate finance advisers.",
    people: ["James Whitlow (Managing Partner)", "Sophie Archer (Head of Origination)"],
  },
  {
    id: "fernhill",
    name: "Fernhill Growth Equity",
    profile: "Growth equity investor, Manchester, 12 staff, minority stakes of £5m to £20m in founder-led software and tech-enabled services businesses; competing with larger funds for the same founders.",
    people: ["Daniel Reese (Partner)", "Amira Khan (Investment Director)"],
  },
  {
    id: "calder",
    name: "Calder Bridge Investments",
    profile: "Regional private equity firm, Leeds, 25 staff, backs management buy-outs of £10m to £50m enterprise value in the North; portfolio operating team wants a repeatable commercial playbook for its companies.",
    people: ["Helen Brooks (Operating Partner)", "Mark Lyons (Portfolio Director)"],
  },
  {
    id: "westbourne",
    name: "Westbourne Equity",
    profile: "Mid-market private equity sponsor, London and Edinburgh, 40 staff, sector focus on healthcare services and education; raising Fund III and needs a clearer LP and intermediary narrative.",
    people: ["Richard Hale (Senior Partner)", "Natalie Grieve (Investor Relations Director)"],
  },
  {
    id: "meridian",
    name: "Meridian Operations Consulting",
    profile: "Operations and performance-improvement consultancy, Birmingham, 35 consultants, works mainly with PE-backed manufacturers; most work comes from three PE houses and partner referrals.",
    people: ["Chris Barlow (Managing Director)", "Leanne Morris (Business Development Director)"],
  },
  {
    id: "thornbury",
    name: "Thornbury Procurement Advisory",
    profile: "Procurement and supplier cost-reduction consultancy, Reading, 22 consultants, gain-share and fixed-fee engagements with mid-size corporates and PE portfolio companies.",
    people: ["Paul Ingram (Founder)", "Rebecca Shaw (Client Director)"],
  },
  {
    id: "larkspur",
    name: "Larkspur People Consulting",
    profile: "HR and organisational design consultancy, Bristol, 15 consultants, leadership assessment and post-deal people integration; wants to move from one-off projects to retained advisory.",
    people: ["Joanna Pike (Managing Partner)", "Oliver Grant (Head of Practice)"],
  },
  {
    id: "harcourt",
    name: "Harcourt Digital Advisory",
    profile: "Technology due diligence and IT strategy consultancy, London, 28 consultants, sells tech DD to PE deal teams and 100-day plans to portfolio companies.",
    people: ["Simon Clarke (CEO)", "Priya Natarajan (Partner, Private Equity)"],
  },
  {
    id: "elmstead",
    name: "Elmstead Change Partners",
    profile: "Change management and transformation consultancy, Leeds, 40 consultants, public sector and regulated industries; pipeline lumpy because work is tender-led.",
    people: ["Andrew Fenwick (Managing Director)", "Kate Rowley (Sales Director)"],
  },
  {
    id: "brookvale",
    name: "Brookvale Commercial Due Diligence",
    profile: "Commercial due diligence boutique, London, 20 consultants, vendor and buy-side CDD for mid-market PE; win rates falling as larger firms discount.",
    people: ["Thomas Avery (Founding Partner)", "Grace Lindqvist (Director)"],
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
  { client: "ashcombe", pillar: "1" },
  { client: "fernhill", pillar: "2" },
  { client: "meridian", pillar: "10" },
  { client: "thornbury", pillar: "4" },
  { client: "brookvale", pillar: "9" },
];

/** BeDeveloped staff who run sessions, split so "who did I discuss X with" has a real answer. */
export function leadFor(clientIndex: number, pillar: Exclude<PillarKey, "review">): string {
  return (clientIndex + Number(pillar)) % 2 === 0 ? "Luke Badiali" : "George Berrington";
}
