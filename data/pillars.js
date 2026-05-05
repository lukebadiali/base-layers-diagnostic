// BeDeveloped Base Layers — pillar content
// Source: BeDeveloped Base Layers Sales Framework

window.BASE_LAYERS = {
  principles: [
    "Early-stage sales is a function, not a personality. Process beats heroics, and repeatability beats charisma.",
    "Business development is a system. Strategy, CRM, cadences, content, partnerships, comp and coaching are components of a single operating model.",
    "Growth is not just new business. Retention and expansion are usually the highest return growth levers in a mature book.",
    "Sales and marketing must operate as one revenue team. Aligned, or invisible to each other.",
    "Partnerships and community compound over years. Treat them as long-dated assets, not short-dated campaigns.",
    "What gets measured gets managed, but only the right things. Activity without outcome is noise; outcome without activity is luck.",
    "Feedback from customers and the market is a product input, not just a sales talking point.",
    "People grow inside systems that trust them. KPIs exist to accelerate development, not to police it.",
    "Growth must be profitable. Unit economics are a commercial control, not a finance afterthought.",
    "The goal is not a perfect plan. The goal is a living operating model the client's own team can run without us.",
  ],

  engagementStages: [
    {
      id: "diagnosed",
      name: "Diagnose",
      summary:
        "Assess the business against all ten pillars. Fast, evidence-based, interview-led. Finds the real constraints - rarely where the client first assumed.",
      checklist: [
        "All ten pillars scored with evidence",
        "Diagnostic interviews completed with commercial leadership",
        "Closed-won and closed-lost data reviewed",
        "Top 3 constraints identified and agreed",
        "Written diagnostic report delivered",
      ],
    },
    {
      id: "designed",
      name: "Design",
      summary:
        "Design the future state for the in-scope pillars. Tailored to the client's buying motion, segment and stage. Artefacts built to be operated, not admired.",
      checklist: [
        "Target operating model documented for in-scope pillars",
        "Every artefact has a named owner",
        "Operating rhythm defined (weekly, monthly, quarterly)",
        "Success measures agreed per pillar",
        "Design signed off by client leadership",
      ],
    },
    {
      id: "deployed",
      name: "Deploy",
      summary:
        "Deploy alongside the client's team. CRM changes, process roll out, enablement content, manager training, first cycles of operating cadence.",
      checklist: [
        "CRM changes live",
        "Processes rolled out to the team",
        "Enablement content delivered",
        "Managers trained and coaching in cadence",
        "Adoption measured alongside outcome",
      ],
    },
    {
      id: "developed",
      name: "BeDeveloped",
      summary:
        "Operational Excellence. A fully embedded, self-sustaining model the team confidently runs. Clear ownership, consistent measurement cadence, and ongoing optimisation built in.",
      checklist: [
        "Internal owners coached to run each pillar",
        "Measurement rhythm running without us",
        "Handover pack delivered",
        "Checkpoints agreed for ongoing review",
        "BeDeveloped team to scope for future improvements",
      ],
    },
  ],

  // 1-10 confidence scale: 1 = Not confident, 10 = Extremely confident.
  scoreLabels: {
    1: "Not confident",
    2: "Very low",
    3: "Low",
    4: "Somewhat low",
    5: "Moderate",
    6: "Somewhat confident",
    7: "Confident",
    8: "Very confident",
    9: "Highly confident",
    10: "Extremely confident",
  },

  pillars: [
    {
      id: 1,
      name: "Strategy, ICP & Market Positioning",
      shortName: "Strategy & ICP",
      tagline: "The foundation. Target market, ideal customer profile, value proposition, pricing, competitive position.",
      dashDescription:
        "Defines the foundation of your commercial strategy by clarifying who you sell to, the problem you solve, and why your solution matters now. Many early-stage sales challenges stem from unclear positioning rather than poor execution.",
      dashAchieve:
        "A clearly defined and validated ideal customer profile, a compelling value proposition, and differentiated messaging that every seller can confidently articulate and defend in live conversations.",
      overview:
        "Sales output is downstream of strategic clarity. Before a CRM is deployed or a cadence is written, a business must be able to articulate, in a sentence, who it sells to, what problem it helps them change, and why that buyer should act now. Most early-stage sales problems are misdiagnosed as execution problems when they are, in fact, positioning problems.",
      components: [
        "Target market definition (ICP - ideal customer profile)",
        "Value proposition (why you vs competitors)",
        "Pricing & packaging",
        "Competitive positioning",
      ],
      objectives: [
        "Define and validate the ideal customer profile and the buying committee within it.",
        "Articulate the value proposition, the cost of inaction, and the differentiated point of view.",
        "Set pricing and packaging in a way that matches segment, deal size and buyer psychology.",
        "Establish competitive positioning that every seller can defend in a live call.",
      ],
      diagnostics: [
        "How confident are you that your current business development processes are documented and accessible?",
        {
          text: "How regularly do you update strategy based on market and customer feedback?",
          scale: 5,
          anchors: { low: "Yearly", high: "Monthly" },
          labels: { 1: "Yearly", 3: "6-monthly", 5: "Monthly" },
        },
        "How clearly defined is your sales funnel?",
        "How clearly defined is your Ideal Customer Profile (ICP)?",
        "How differentiated is your value proposition?",
        "How well defined is your pricing and packaging strategy?",
        "How strong is your competitive positioning?",
        "How well aligned is your offering with current market demand?",
        "How confident are you in your market segmentation approach?",
        "How clearly do you understand why customers choose you over competitors?",
      ],
      whatWeDo: [
        "ICP workshops with commercial leadership, validated against closed won and closed lost data.",
        "Messaging architecture: problem statement, point of view, proof, proposition.",
        "Pricing and packaging review against segment, deal size and buying committee.",
        "Competitive positioning playbook with objection handling and proof points.",
      ],
      outcomes: [
        "A single-page positioning statement every seller can recite and defend.",
        "A validated ICP and buying committee map that drives list building and qualification.",
        "A measurable lift in qualification quality and win rate against the right segment.",
      ],
    },
    {
      id: 2,
      name: "Value Proposition & Commercial Narrative",
      shortName: "Value Proposition",
      tagline: "How you express the problem, the answer and the proof. The story that earns the meeting and closes the deal.",
      dashDescription:
        "Translates strategy into a sharp, persuasive narrative that every seller can deliver and every buyer can understand. A clear, repeatable value proposition is the difference between a polite no and a sale.",
      dashAchieve:
        "A consistent commercial narrative that articulates problem, value and proof in a way that wins meetings, accelerates buying decisions, and is delivered the same way by every seller.",
      overview:
        "If positioning is what you stand for, the commercial narrative is how you say it. The strongest sales teams do not improvise the story - they have a shared way of describing the problem the buyer is in, the change they help create, and the proof that they can be trusted to deliver it. Where this is missing, every seller tells a slightly different story, and buyers feel the inconsistency before they hear it named.",
      components: [
        "Value proposition",
        "Commercial narrative & messaging architecture",
        "Differentiation & point of view",
        "Proof, outcome statements & references",
      ],
      objectives: [
        "Translate the positioning into a clear, repeatable value proposition for each segment.",
        "Build a commercial narrative covering problem, change, proof and proposition.",
        "Equip every seller to articulate the narrative the same way, in their own voice.",
        "Validate the narrative against buyer feedback and win/loss patterns.",
      ],
      diagnostics: [
        "How clearly articulated is your core value proposition?",
        "How well does your value proposition differentiate you from competitors?",
        "How specifically tailored is your messaging to your ideal customer profile?",
        "How effectively does your commercial narrative communicate the cost of inaction?",
        "How consistently is your value proposition delivered across the team?",
        "How well does your messaging connect to the buyer's strategic priorities?",
        "How clearly do you communicate measurable outcomes that customers can expect?",
        "How strong is your point of view on the market your buyers operate in?",
        "How well validated is your messaging with real customer and prospect feedback?",
        "How effectively does your commercial narrative move buyers from interest to commitment?",
      ],
      whatWeDo: [
        "Messaging architecture workshop with commercial and marketing leadership.",
        "Narrative framework: problem, point of view, proof, proposition - mapped to ICP.",
        "Outcome and proof asset library covering case stories, metrics and references.",
        "Narrative testing and refinement against live buyer conversations and lost deals.",
      ],
      outcomes: [
        "A single value proposition every seller can recite and tailor to the buyer in front of them.",
        "A commercial narrative that creates urgency rather than describing features.",
        "Higher conversion at first-meeting and proposal stages, from a story buyers recognise themselves in.",
      ],
    },
    {
      id: 3,
      name: "Demand Generation & Behavioural Drivers",
      shortName: "Demand Generation",
      tagline:
        "Getting in front of the right people consistently. Volume, quality and the behavioural triggers that earn attention.",
      dashDescription:
        "Focuses on building a consistent flow of high-quality opportunities by selecting and executing the right channels for your market. Rather than spreading efforts too thin, this pillar emphasises focus, coordination and behavioural relevance.",
      dashAchieve:
        "A predictable top-of-funnel engine driven by the right mix of outbound, inbound and other channels, generating both volume and quality pipeline by reaching buyers when they are most likely to act.",
      overview:
        "Demand generation is about getting in front of the right people consistently, with enough volume and quality to keep pipeline predictable, and with messaging tuned to the behavioural drivers that actually move buyers. Most early-stage teams either lean on a single channel until it breaks, or scatter across every channel and master none. The job here is to pick, concentrate and operate.",
      components: [
        "Outbound (email, LinkedIn, cold calling)",
        "Inbound (content, SEO, paid ads)",
        "Events, partnerships, referrals",
      ],
      objectives: [
        "Select the channels that fit the ICP and buying motion, and double down on them.",
        "Build outbound, inbound and event motions that operate as a coordinated system.",
        "Establish the cadences, content and targeting that drive both volume and quality.",
        "Create enough signal to separate channel decay from message decay.",
      ],
      diagnostics: [
        "How well structured is your lead generation process?",
        "How effective are your multi-channel lead generation efforts?",
        "How effective is bespoke outbound outreach?",
        "How effective is automated or AI-assisted outreach?",
        "How strong is your inbound lead generation performance?",
        "How well balanced is your mix of outbound, inbound, partnerships and events?",
        "How effectively do you convert leads into opportunities?",
        "How consistently do you hit lead generation targets?",
        "How strong is your lead quality versus volume balance?",
        "How effectively do you test and improve new lead channels?",
      ],
      whatWeDo: [
        "Channel diagnostic mapping pipeline source, cost and conversion by stage.",
        "Outbound cadence and sequence design grounded in positioning and narrative work.",
        "Inbound and content orchestration, coordinated with marketing alignment.",
        "Event, community and referral programmes sized to the opportunity.",
      ],
      outcomes: [
        "A concentrated channel mix with a targeted approach.",
        "Cross-channel buyer journeys that reinforce rather than confuse.",
        "A predictable top-of-funnel engine instead of a lumpy one.",
      ],
    },
    {
      id: 4,
      name: "Sales Execution & Enablement",
      shortName: "Sales Execution",
      tagline:
        "Disciplined discovery, qualification, solution selling, objection handling, closing - and the enablement that makes it repeatable.",
      dashDescription:
        "Covers how opportunities are progressed and converted into revenue through structured, repeatable sales processes, supported by the enablement that gets every seller there. This includes discovery, qualification, solution selling and closing discipline.",
      dashAchieve:
        "A consistent and scalable sales motion that improves win rates, increases average deal size, and reduces performance variability across the team.",
      overview:
        "Sales execution is the repeatable motion that turns qualified opportunity into revenue. Strategy tells you what to sell and to whom. Demand generation puts you in front of the right people. Execution is what happens on a live call on a Tuesday morning. Most early-stage businesses under-invest here, and it is one of the places BeDeveloped adds the most compounding value - through a combination of process, enablement and coaching cadence.",
      components: [
        "Discovery & qualification",
        "Solution selling",
        "Objection handling",
        "Negotiation & closing",
        "Enablement & coaching",
      ],
      objectives: [
        "Install a disciplined discovery and qualification approach calibrated to your buyer.",
        "Equip sellers with solution selling, objection handling and negotiation skills.",
        "Codify the closing motion, including proposal, pricing and procurement navigation.",
        "Reduce variance between sellers so performance becomes a system outcome.",
      ],
      diagnostics: [
        "How well defined is your end-to-end sales process?",
        "How confident are you in your discovery process?",
        "How effective is your qualification methodology?",
        "How strong is your solution selling capability?",
        "How effectively do you and the team handle objections from prospects?",
        "How confident are you in negotiation and closing?",
        "How consistent is your sales execution across the team?",
        "How well do you progress deals through the pipeline?",
        "How strong is your win rate consistency?",
        "How effectively do you tailor proposals to client needs?",
      ],
      whatWeDo: [
        "Discovery and qualification design, with buyer-verifiable evidence at each stage.",
        "Solution selling, objection handling and negotiation enablement, including role play and call review.",
        "Proposal, pricing and procurement playbook built for your deal profile.",
        "Deal review cadence that develops sellers as it progresses deals.",
      ],
      outcomes: [
        "A process any seller can run and any manager can coach to.",
        "Higher win rate and larger average deal size, from execution rather than discounting.",
        "A culture of deal discipline replacing a culture of heroics.",
      ],
    },
    {
      id: 5,
      name: "Pipeline Architecture & Conversion",
      shortName: "Pipeline & Conversion",
      tagline:
        "Stages, criteria, conversion rates and velocity. The geometry of how deals actually move.",
      dashDescription:
        "Designs the structure of your pipeline so deals progress predictably and conversion can be measured and improved at every stage. Without this discipline, forecasts are guesswork and coaching is reactive.",
      dashAchieve:
        "A pipeline with clear stage definitions, measurable conversion rates, predictable cycle times, and the ability to spot risk early enough to act on it.",
      overview:
        "Sales execution is what happens inside a deal. Pipeline architecture is what governs how deals move between stages. Without explicit entry and exit criteria, conversion rates are unmeasurable, forecasts are unreliable, and stalled deals hide in plain sight. This pillar installs the geometry that makes the rest of the commercial engine measurable.",
      components: [
        "Pipeline stages & exit criteria",
        "Stage-to-stage conversion rates",
        "Deal velocity & cycle time",
        "Pipeline coverage & forecast hygiene",
      ],
      objectives: [
        "Define clear, buyer-verifiable entry and exit criteria for every stage.",
        "Measure conversion rate and cycle time at each stage as a leading indicator.",
        "Build pipeline coverage discipline against quota and revenue targets.",
        "Surface stalled deals early enough to coach, recover or close-lost cleanly.",
      ],
      diagnostics: [
        "How clearly defined are the entry and exit criteria for each pipeline stage?",
        "How accurately do you measure stage-to-stage conversion rates?",
        "How clearly do you understand the average length of your sales cycle?",
        "How well do you track deal velocity through the pipeline?",
        "How disciplined is the team at progressing deals through defined stages?",
        "How effectively do you identify and unblock stalled deals?",
        "How strong is your pipeline coverage relative to quota or revenue targets?",
        "How reliably do deals close in their expected stage and timeframe?",
        "How clearly do you understand where deals are most commonly lost in the pipeline?",
        "How effectively do you forecast pipeline conversion across stages?",
      ],
      whatWeDo: [
        "Pipeline stage redesign aligned to the real buying motion, with explicit exit criteria.",
        "Conversion and velocity reporting at stage and cohort level.",
        "Coverage and inspection cadence: weekly pipeline, monthly roll-up, quarterly commit.",
        "Stalled-deal protocol so dormant pipeline is acted on, not ignored.",
      ],
      outcomes: [
        "A pipeline that reflects reality, not optimism.",
        "Stage-by-stage diagnosis of where to invest coaching and process change.",
        "Forecast accuracy improved by structure rather than instinct.",
      ],
    },
    {
      id: 6,
      name: "Revenue Operations & Systems",
      shortName: "Revenue Ops",
      tagline: "CRM, pipeline, playbooks, forecasting, data. The engine and systems behind scale.",
      dashDescription:
        "Provides the infrastructure that supports the entire commercial engine, including CRM, pipeline management, forecasting and reporting. Without strong operations and systems, even the best strategies fail.",
      dashAchieve:
        "A reliable single source of truth with clean data, clear processes, and accurate forecasting that enables better decision-making at every level of the business.",
      overview:
        "Revenue operations is the engine behind everything else. It is the CRM that is trusted, the pipeline that is clean, the forecast that is believed, and the data that informs every decision from coaching to capital allocation. Where RevOps works, every other pillar compounds. Where it does not, the best strategy in the world is undone by bad data.",
      components: [
        "CRM and pipeline management",
        "Sales processes & playbooks",
        "Forecasting",
        "Data tracking (conversion rates, funnel from leads to conversion)",
      ],
      objectives: [
        "Establish a single source of truth for pipeline, accounts and activity in the CRM.",
        "Install sales processes and playbooks that mirror the real deal journey.",
        "Build a forecasting rhythm the leadership team actually believes.",
        "Track the commercial metrics that matter: conversion by stage, cycle time, CAC, LTV, cohort performance.",
      ],
      diagnostics: [
        "How effective is your CRM usage?",
        "How well integrated is CRM with sales and marketing?",
        "How strong is your data quality management?",
        "How effectively do you use data for decision-making?",
        "How well trained is your team on CRM systems?",
        "How accurate is your pipeline data?",
        "How customised is your CRM to your business needs?",
        "How reliable is your forecasting process?",
        "How well defined are your sales playbooks?",
        "How effectively do you track funnel conversion metrics?",
      ],
      whatWeDo: [
        "CRM audit and redesign against the operating process, not against a feature list.",
        "Pipeline stages with explicit entry and exit criteria and required-field discipline.",
        "Forecasting model and rhythm: weekly pipeline, monthly roll-up, quarterly commit.",
        "Reporting and dashboard design for leaders, managers and individual sellers.",
      ],
      outcomes: [
        "A CRM that is the first and last tool a seller touches every day.",
        "Forecast accuracy improved through clean stage logic and activity truth.",
        "A data foundation clean enough to support coaching, executive reporting and AI.",
      ],
    },
    {
      id: 7,
      name: "Aligning Marketing Campaigning",
      shortName: "Marketing Alignment",
      tagline: "Campaign planning, content, brand and the marketing motion that compounds with sales.",
      dashDescription:
        "Aligns marketing planning, campaigns and content with the commercial engine so the two functions compound rather than collide. Strong alignment reduces friction in the sales process and improves both inbound and outbound effectiveness.",
      dashAchieve:
        "A marketing function that operates in lockstep with sales: campaigns tied to pipeline, messaging consistent across channels, and a content programme that supports every stage of the deal cycle.",
      overview:
        "Marketing and business development must operate as one revenue team. Where they are aligned, campaigns warm the audience, content arms the seller, and brand reduces friction before a call ever starts. Where they are not, marketing measures reach while sales measures revenue, and neither can explain the gap. This pillar installs shared planning, shared metrics and a single buyer journey across both functions.",
      components: [
        "Campaign planning & integration with sales",
        "Content strategy",
        "Brand & thought leadership (founders, leaders, company)",
        "Case studies & social proof",
      ],
      objectives: [
        "Align campaign planning, targeting and measurement with the commercial pipeline.",
        "Establish a clear editorial point of view that reinforces positioning.",
        "Build the personal brand of founders and senior sellers in the spaces where buyers gather.",
        "Package case studies, social proof and customer stories as a sales asset.",
      ],
      diagnostics: [
        "How integrated is marketing with business development?",
        "How strong is your campaign planning process?",
        "How consistent is your messaging across channels?",
        "How clearly defined is your brand for your target audience?",
        "How effectively do you track campaign performance?",
        "How strong is your content strategy?",
        "How effective is your personal or founder brand?",
        "How strong is your case study and social proof library?",
        "How consistently do you publish thought leadership content as an SLT and company page?",
        "How effectively does marketing generate inbound leads?",
      ],
      whatWeDo: [
        "Joint campaign planning between marketing and commercial leadership.",
        "Editorial and content strategy aligned to positioning, ICP and pipeline goals.",
        "Personal brand programme for founders and commercial leaders.",
        "Case study and proof asset production, with measurement linking content to pipeline.",
      ],
      outcomes: [
        "Marketing and sales operating from a shared plan and a shared scoreboard.",
        "Higher quality inbound and warmer outbound conversations.",
        "A library of proof and a recognisable market voice that compound deal momentum.",
      ],
    },
    {
      id: 8,
      name: "Partnerships & Channel Development",
      shortName: "Partnerships",
      tagline:
        "Channel partners, alliances, referral networks and the strategic relationships that influence buying decisions.",
      dashDescription:
        "Builds partnerships and strategic relationships into a deliberate growth channel rather than an opportunistic effort. Includes channel partners, alliances, referrers and the strategic relationships that influence buying decisions over time.",
      dashAchieve:
        "A partner ecosystem and relationship network that contributes a known and growing share of pipeline, with influence inside target accounts that compounds over time.",
      overview:
        "Done well, partnerships and high-trust relationships outperform entire sales teams. Done badly, they absorb management attention without producing pipeline. This pillar treats both as deliberate growth assets - channel partners, alliances and referrers managed with the rigour of direct sales, alongside the strategic relationships that quietly influence buying decisions over months and years.",
      components: [
        "Channel partners",
        "Strategic alliances & joint ventures",
        "Referral networks",
        "Strategic relationships & industry presence",
      ],
      objectives: [
        "Define partner archetypes and strategic relationships that fit the buying motion.",
        "Recruit, onboard and enable partners to represent the proposition credibly.",
        "Build a referral motion across both formal partners and informal advocates.",
        "Measure partner-influenced and partner-sourced pipeline as first-class numbers.",
      ],
      diagnostics: [
        "How clearly defined is your partner strategy?",
        "How effective are your channel partners in generating revenue?",
        "How strong are your strategic alliances?",
        "How structured is your referral partner network?",
        "How successful are your joint ventures?",
        "How well do you onboard and enable partners?",
        "How effectively do partners deliver qualified opportunities?",
        "How well aligned are partners with your ideal customer profile?",
        "How effective is your referral generation approach?",
        "How strong is your industry presence and credibility, compared to similar firms?",
      ],
      whatWeDo: [
        "Partner archetype design and prioritisation by buyer trust and reach.",
        "Recruitment, onboarding and enablement playbook (narrative, proof, joint selling motion).",
        "Referral programme covering formal partners and informal champions.",
        "Relationship and account-level mapping to surface influence inside target buyers.",
      ],
      outcomes: [
        "A channel that contributes a known, growing share of pipeline.",
        "Faster time to first transacted deal for new partners.",
        "Influence and credibility inside target accounts before the buying cycle starts.",
      ],
    },
    {
      id: 9,
      name: "Customer Success, Retention & Expansion",
      shortName: "Customer Success",
      tagline: "Onboarding, retention, expansion, advocacy. Key Account Management.",
      dashDescription:
        "Extends the commercial function beyond acquisition to focus on delivering value post-sale. Retention and expansion often provide a higher return than new customer acquisition when managed effectively.",
      dashAchieve:
        "Strong customer retention, predictable expansion revenue, and a base of satisfied customers who actively contribute to referrals and advocacy.",
      overview:
        "Business development is not only the pursuit of new logos. Once a customer base exists, retention and expansion almost always offer a higher return on effort than new acquisition. This pillar connects the go-to-market motion to the post-sale experience, so the commercial function is accountable for growth inside accounts, not only the acquisition of them.",
      components: [
        "Onboarding experience",
        "Retention strategies",
        "Expansion (upsell / cross-sell)",
        "Customer advocacy",
      ],
      objectives: [
        "Design an onboarding experience that accelerates time to value.",
        "Install retention motions that identify risk early and act on it deliberately.",
        "Build a structured approach to expansion: upsell, cross-sell and account planning.",
        "Convert satisfied customers into advocates who drive referrals, case studies and references.",
      ],
      diagnostics: [
        "How effective is your client onboarding process? Process is documented.",
        "How strong are your retention strategies?",
        "How effective is your upsell and cross-sell execution?",
        "How strong is your customer advocacy generation?",
        "How well do you manage key accounts post-sale?",
        "How proactively do you prevent churn?",
        "How satisfied are your customers with ongoing support?",
        "How effectively do you measure customer satisfaction through a scoring system? (Like NPS)",
        "How strong is your renewal process?",
        "How well do customers understand value delivered?",
      ],
      whatWeDo: [
        "Onboarding programme design with clear value milestones.",
        "Retention operating model, including health scoring, risk playbooks and executive sponsorship.",
        "Expansion motion with account planning, upsell triggers and cross-sell pathways.",
        "Advocacy programme covering case studies, references and community.",
      ],
      outcomes: [
        "Measurable improvement in gross and net retention.",
        "A predictable expansion number alongside the new business number.",
        "A customer base that actively generates pipeline through advocacy.",
      ],
    },
    {
      id: 10,
      name: "Financial & Commercial Modelling",
      shortName: "Commercial Model",
      tagline: "Pricing, margin, CAC, LTV. The discipline that makes growth profitable.",
      dashDescription:
        "Aligns commercial activity with financial outcomes by connecting pipeline performance to profitability and unit economics. This pillar ensures growth is sustainable and defensible.",
      dashAchieve:
        "Clear visibility into key metrics such as CAC, LTV, and margin, enabling the business to scale profitably and make informed strategic decisions.",
      overview:
        "Growth that is not profitable is not really growth, it is a financing strategy in disguise. This pillar puts commercial discipline around the framework, so every other pillar is optimised against unit economics rather than vanity metrics. It is where the business development function proves its value to the board, not just to the pipeline review.",
      components: ["Pricing strategy", "Margins", "Cost of acquisition", "Lifetime value"],
      objectives: [
        "Model pricing strategy against segment, value delivered and competitive context.",
        "Understand and actively manage margin by product, segment and channel.",
        "Track cost of acquisition rigorously by channel and segment, not only in aggregate.",
        "Measure lifetime value cohorts and connect them back to acquisition decisions.",
      ],
      diagnostics: [
        "How strong is your pricing strategy?",
        {
          text: "What is your current margins on average?",
          scale: 5,
          anchors: { low: "<10%", high: "50%+" },
          labels: { 1: "<10%", 2: "11-25%", 3: "25-35%", 4: "36-50%", 5: "50%+" },
        },
        "How accurately do you calculate CAC (Customer acquisition cost)?",
        "How clearly defined is your LTV (lifetime value)?",
        "How confident are you in ROI from sales and marketing spend?",
        "How well do you model revenue growth scenarios?",
        "How disciplined is your commercial decision making?",
        "How well do you understand unit economics? i.e biggest costs",
        "How effectively do you optimise pricing over time?",
        "How strong is your profitability management?",
      ],
      whatWeDo: [
        "Unit economics model covering pricing, margin, CAC and LTV by segment and channel.",
        "Pricing strategy aligned to value and willingness to pay, not only to cost-plus logic.",
        "Commercial scorecard that sits alongside the pipeline scorecard in every review.",
        "Scenario model connecting commercial decisions to cash, runway and valuation.",
      ],
      outcomes: [
        "Growth that is demonstrably profitable and defensible to investors.",
        "A commercial team that can articulate the economics of its own pipeline.",
        "Earlier, cheaper detection of unprofitable segments and channels.",
      ],
    },
  ],
};
