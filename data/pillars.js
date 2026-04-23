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
    "The goal is not a perfect plan. The goal is a living operating model the client's own team can run without us."
  ],

  engagementStages: [
    {
      id: "diagnosed",
      name: "Diagnose",
      summary: "Assess the business against all ten pillars. Fast, evidence-based, interview-led. Finds the real constraints — rarely where the client first assumed.",
      checklist: [
        "All ten pillars scored with evidence",
        "Diagnostic interviews completed with commercial leadership",
        "Closed-won and closed-lost data reviewed",
        "Top 3 constraints identified and agreed",
        "Written diagnostic report delivered"
      ]
    },
    {
      id: "designed",
      name: "Design",
      summary: "Design the future state for the in-scope pillars. Tailored to the client's buying motion, segment and stage. Artefacts built to be operated, not admired.",
      checklist: [
        "Target operating model documented for in-scope pillars",
        "Every artefact has a named owner",
        "Operating rhythm defined (weekly, monthly, quarterly)",
        "Success measures agreed per pillar",
        "Design signed off by client leadership"
      ]
    },
    {
      id: "deployed",
      name: "Deploy",
      summary: "Deploy alongside the client's team. CRM changes, process roll out, enablement content, manager training, first cycles of operating cadence.",
      checklist: [
        "CRM changes live",
        "Processes rolled out to the team",
        "Enablement content delivered",
        "Managers trained and coaching in cadence",
        "Adoption measured alongside outcome"
      ]
    },
    {
      id: "developed",
      name: "BeDeveloped",
      summary: "Handover. A self-sustaining operating model the client's team can run. Internal owners coached, measurement rhythm installed, exit checkpoints agreed.",
      checklist: [
        "Internal owners coached to run each pillar",
        "Measurement rhythm running without us",
        "Handover pack delivered",
        "Checkpoints agreed for ongoing review",
        "BeDeveloped team stood down"
      ]
    }
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
    10: "Extremely confident"
  },

  pillars: [
    {
      id: 1,
      name: "Strategy & Market Positioning",
      shortName: "Strategy & Positioning",
      tagline: "The foundation. Target market, value proposition, pricing, competitive position.",
      dashDescription: "Defines the foundation of your commercial strategy by clarifying who you sell to, the problem you solve, and why your solution matters now. Many early-stage sales challenges stem from unclear positioning rather than poor execution.",
      dashAchieve: "A clearly defined and validated ideal customer profile, a compelling value proposition, and differentiated messaging that every seller can confidently articulate and defend in live conversations.",
      overview: "Sales output is downstream of strategic clarity. Before a CRM is deployed or a cadence is written, a business must be able to articulate, in a sentence, who it sells to, what problem it helps them change, and why that buyer should act now. Most early-stage sales problems are misdiagnosed as execution problems when they are, in fact, positioning problems.",
      components: [
        "Target market definition (ICP — ideal customer profile)",
        "Value proposition (why you vs competitors)",
        "Pricing & packaging",
        "Competitive positioning"
      ],
      objectives: [
        "Define and validate the ideal customer profile and the buying committee within it.",
        "Articulate the value proposition, the cost of inaction, and the differentiated point of view.",
        "Set pricing and packaging in a way that matches segment, deal size and buyer psychology.",
        "Establish competitive positioning that every seller can defend in a live call."
      ],
      diagnostics: [
        "How confident are you that your current business development processes are documented and accessible?",
        {
          text: "How regularly do you update strategy based on market and customer feedback?",
          scale: 5,
          anchors: { low: "Yearly", high: "Monthly" },
          labels: { 1: "Yearly", 3: "6-monthly", 5: "Monthly" }
        },
        "How clearly defined is your sales funnel?",
        "How clearly defined is your Ideal Customer Profile (ICP)?",
        "How differentiated is your value proposition?",
        "How well defined is your pricing and packaging strategy?",
        "How strong is your competitive positioning?",
        "How well aligned is your offering with current market demand?",
        "How confident are you in your market segmentation approach?",
        "How clearly do you understand why customers choose you over competitors?"
      ],
      whatWeDo: [
        "ICP workshops with commercial leadership, validated against closed won and closed lost data.",
        "Messaging architecture: problem statement, point of view, proof, proposition.",
        "Pricing and packaging review against segment, deal size and buying committee.",
        "Competitive positioning playbook with objection handling and proof points."
      ],
      outcomes: [
        "A single-page positioning statement every seller can recite and defend.",
        "A validated ICP and buying committee map that drives list building and qualification.",
        "A measurable lift in qualification quality and win rate against the right segment."
      ]
    },
    {
      id: 2,
      name: "Lead Generation",
      shortName: "Lead Generation",
      tagline: "Getting in front of the right people consistently. Volume and quality of opportunities.",
      dashDescription: "Focuses on building a consistent flow of high-quality opportunities by selecting and executing the right channels for your market. Rather than spreading efforts too thin, this pillar emphasises focus, coordination, and repeatability.",
      dashAchieve: "A predictable top-of-funnel engine driven by the right mix of outbound, inbound, and other channels, generating both volume and quality pipeline.",
      overview: "Lead generation is about getting in front of the right people consistently, and doing so with enough volume and quality to keep pipeline predictable. Most early-stage teams either lean on a single channel until it breaks, or scatter across every channel and master none. The job here is to pick, concentrate and operate.",
      components: [
        "Outbound (email, LinkedIn, cold calling)",
        "Inbound (content, SEO, paid ads)",
        "Events, partnerships, referrals"
      ],
      objectives: [
        "Select the channels that fit the ICP and buying motion, and double down on them.",
        "Build outbound, inbound and event motions that operate as a coordinated system.",
        "Establish the cadences, content and targeting that drive both volume and quality.",
        "Create enough signal to separate channel decay from message decay."
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
        "How effectively do you test and improve new lead channels?"
      ],
      whatWeDo: [
        "Channel diagnostic mapping pipeline source, cost and conversion by stage.",
        "Outbound cadence and sequence design grounded in positioning work from Pillar 1.",
        "Inbound and content orchestration, coordinated with Pillar 8 on brand.",
        "Event, community and referral programmes sized to the opportunity."
      ],
      outcomes: [
        "A concentrated channel mix with a targeted approach.",
        "Cross-channel buyer journeys that reinforce rather than confuse.",
        "A predictable top-of-funnel engine instead of a lumpy one."
      ]
    },
    {
      id: 3,
      name: "Relationship Building & Networking",
      shortName: "Relationships",
      tagline: "Strategic relationships, long-term nurture, industry credibility.",
      dashDescription: "Treats relationships as long-term commercial assets that drive revenue over time, not just immediate deals. Particularly in B2B environments, many opportunities originate from trust built well before a sales cycle begins.",
      dashAchieve: "A steady contribution to pipeline from relationships, referrals, and industry presence, with relationship knowledge embedded in the business rather than held by individuals.",
      overview: "In B2B, and especially at higher deal sizes, a large share of revenue originates in relationships that were built months or years before the deal cycle began. This pillar is about treating relationships as a long-dated asset. It is often the most underinvested pillar in early-stage teams, and almost always the most underappreciated when it works.",
      components: [
        "Strategic relationships",
        "Long-term nurturing",
        "Industry presence / credibility"
      ],
      objectives: [
        "Identify and invest in the strategic relationships that most influence the buying committee.",
        "Build long-term nurture motions for contacts who are not in an active cycle.",
        "Establish an industry presence that creates credibility and warm introductions.",
        "Encode relationship discipline in the CRM so it survives a rep leaving."
      ],
      diagnostics: [
        "How complete is your list of strategic relationships?",
        {
          text: "How consistently do you nurture long-term relationships?",
          scale: 5,
          anchors: { low: "Rarely", high: "Monthly" },
          labels: { 1: "Rarely", 3: "6-monthly", 5: "Monthly" }
        },
        "How strong is your industry presence and credibility?",
        "How effective is your referral generation approach?",
        "How often do relationships convert into opportunities over time?",
        "How strong is your network within target accounts?",
        "How well do you maintain relationships with non-active buyers?",
        "How effectively do you engage key stakeholders outside of active sales cycles?",
        "How intentional is your networking strategy?",
        "How strong is your reputation within your industry?"
      ],
      whatWeDo: [
        "Relationship map and targeting plan at account and industry level.",
        "Nurture cadence design across email, social, events and executive outreach.",
        "Advisory board, community and hosted event programmes where appropriate.",
        "CRM capture of relationship context so it becomes an asset of the business."
      ],
      outcomes: [
        "A stable pipeline contribution from relationships and referrals, not just outbound.",
        "An industry footprint proportionate to the company's stage and ambition.",
        "Relationships retained at the company level, not only the individual level."
      ]
    },
    {
      id: 4,
      name: "Sales Execution",
      shortName: "Sales Execution",
      tagline: "Disciplined discovery, qualification, solution selling, objection handling, closing.",
      dashDescription: "Covers how opportunities are progressed and converted into revenue through structured, repeatable sales processes. This includes discovery, qualification, solution selling, and closing discipline.",
      dashAchieve: "A consistent and scalable sales motion that improves win rates, increases average deal size, and reduces performance variability across the team.",
      overview: "Sales execution is the repeatable motion that turns qualified opportunity into revenue. Strategy tells you what to sell and to whom. Lead generation puts you in front of the right people. Execution is what happens on a live call on a Tuesday morning. Most early-stage businesses under-invest here, and it is one of the places BeDeveloped adds the most compounding value.",
      components: [
        "Discovery & qualification",
        "Solution selling",
        "Objection handling",
        "Negotiation & closing"
      ],
      objectives: [
        "Install a disciplined discovery and qualification approach calibrated to your buyer.",
        "Equip sellers with solution selling, objection handling and negotiation skills.",
        "Codify the closing motion, including proposal, pricing and procurement navigation.",
        "Reduce variance between sellers so performance becomes a system outcome."
      ],
      diagnostics: [
        "How well defined is your end-to-end sales process?",
        "How confident are you in your discovery process?",
        "How effective is your qualification methodology?",
        "How strong is your solution selling capability?",
        "How effectively do you handle objections?",
        "How confident are you in negotiation and closing?",
        "How consistent is your sales execution across the team?",
        "How well do you progress deals through the pipeline?",
        "How strong is your win rate consistency?",
        "How effectively do you tailor proposals to client needs?"
      ],
      whatWeDo: [
        "Discovery and qualification design, with buyer-verifiable evidence at each stage.",
        "Solution selling, objection handling and negotiation enablement, including role play and call review.",
        "Proposal, pricing and procurement playbook built for your deal profile.",
        "Deal review cadence that develops sellers as it progresses deals."
      ],
      outcomes: [
        "A process any seller can run and any manager can coach to.",
        "Higher win rate and larger average deal size, from execution rather than discounting.",
        "A culture of deal discipline replacing a culture of heroics."
      ]
    },
    {
      id: 5,
      name: "Partnerships & Alliances",
      shortName: "Partnerships",
      tagline: "Channel partners, strategic alliances, referral networks, joint ventures.",
      dashDescription: "Builds partnerships into a deliberate and measurable growth channel, rather than an ad hoc or opportunistic effort. This includes identifying the right partners and enabling them to represent your business effectively.",
      dashAchieve: "A partner ecosystem that generates meaningful pipeline, accelerates deal flow, and creates strategic differentiation in the market.",
      overview: "Done well, partnerships outperform entire sales teams. Done badly, they absorb management attention without producing pipeline. This pillar treats partnerships as a deliberate growth engine, with the same rigour of targeting, enablement and measurement that is applied to direct sales.",
      components: [
        "Channel partners",
        "Strategic alliances",
        "Referral networks",
        "Joint ventures"
      ],
      objectives: [
        "Define the partner archetypes that fit the buying motion.",
        "Target, recruit and onboard the partners most likely to move the needle.",
        "Enable partners with the proposition, narrative and tools they need to represent you credibly.",
        "Measure partner-influenced and partner-sourced pipeline as a first-class number."
      ],
      diagnostics: [
        "How clearly defined is your partner strategy?",
        "How effective are your channel partners in generating revenue?",
        "How strong are your strategic alliances?",
        "How structured is your referral partner network?",
        "How successful are your joint ventures?",
        "How well do you onboard and enable partners?",
        "How effectively do partners deliver qualified opportunities?",
        "How consistently do partnerships contribute to pipeline?",
        "How actively are partnerships managed and developed?",
        "How well aligned are partners with your ideal customer profile?"
      ],
      whatWeDo: [
        "Partner archetype design and prioritisation based on buyer trust and reach.",
        "Recruitment motion with target list, outreach and onboarding playbook.",
        "Partner enablement kit: narrative, proof, tools, joint selling motion.",
        "Measurement and governance, including partner-influenced pipeline in the CRM."
      ],
      outcomes: [
        "A partner channel that contributes a known, growing share of pipeline.",
        "Faster time to first transacted deal for new partners.",
        "Strategic alliances that create competitive differentiation, not just pipeline."
      ]
    },
    {
      id: 6,
      name: "Customer Success & Retention",
      shortName: "Customer Success",
      tagline: "Onboarding, retention, expansion, advocacy. Key Account Management.",
      dashDescription: "Extends the commercial function beyond acquisition to focus on delivering value post-sale. Retention and expansion often provide a higher return than new customer acquisition when managed effectively.",
      dashAchieve: "Strong customer retention, predictable expansion revenue, and a base of satisfied customers who actively contribute to referrals and advocacy.",
      overview: "Business development is not only the pursuit of new logos. Once a customer base exists, retention and expansion almost always offer a higher return on effort than new acquisition. This pillar connects the go-to-market motion to the post-sale experience, so the commercial function is accountable for growth inside accounts, not only the acquisition of them.",
      components: [
        "Onboarding experience",
        "Retention strategies",
        "Expansion (upsell / cross-sell)",
        "Customer advocacy"
      ],
      objectives: [
        "Design an onboarding experience that accelerates time to value.",
        "Install retention motions that identify risk early and act on it deliberately.",
        "Build a structured approach to expansion: upsell, cross-sell and account planning.",
        "Convert satisfied customers into advocates who drive referrals, case studies and references."
      ],
      diagnostics: [
        "How effective is your onboarding process?",
        "How strong are your retention strategies?",
        "How effective is your upsell and cross-sell execution?",
        "How strong is your customer advocacy generation?",
        "How well do you manage key accounts post-sale?",
        "How proactively do you prevent churn?",
        "How satisfied are your customers with ongoing support?",
        "How effectively do you measure customer satisfaction through a scoring system? (Like NPS)",
        "How strong is your renewal process?",
        "How well do customers understand value delivered?"
      ],
      whatWeDo: [
        "Onboarding programme design with clear value milestones.",
        "Retention operating model, including health scoring, risk playbooks and executive sponsorship.",
        "Expansion motion with account planning, upsell triggers and cross-sell pathways.",
        "Advocacy programme covering case studies, references and community."
      ],
      outcomes: [
        "Measurable improvement in gross and net retention.",
        "A predictable expansion number alongside the new business number.",
        "A customer base that actively generates pipeline through advocacy."
      ]
    },
    {
      id: 7,
      name: "Revenue Operations",
      shortName: "Revenue Ops",
      tagline: "CRM, pipeline, playbooks, forecasting, data. The engine behind scale.",
      dashDescription: "Provides the infrastructure that supports the entire commercial engine, including CRM, pipeline management, forecasting, and reporting. Without strong operations, even the best strategies fail.",
      dashAchieve: "A reliable single source of truth with clean data, clear processes, and accurate forecasting that enables better decision-making at every level of the business.",
      overview: "Revenue operations is the engine behind everything else. It is the CRM that is trusted, the pipeline that is clean, the forecast that is believed, and the data that informs every decision from coaching to capital allocation. Where RevOps works, every other pillar compounds. Where it does not, the best strategy in the world is undone by bad data.",
      components: [
        "CRM and pipeline management",
        "Sales processes & playbooks",
        "Forecasting",
        "Data tracking (conversion rates, funnel from leads to conversion)"
      ],
      objectives: [
        "Establish a single source of truth for pipeline, accounts and activity in the CRM.",
        "Install sales processes and playbooks that mirror the real deal journey.",
        "Build a forecasting rhythm the leadership team actually believes.",
        "Track the commercial metrics that matter: conversion by stage, cycle time, CAC, LTV, cohort performance."
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
        "How effectively do you track funnel conversion metrics?"
      ],
      whatWeDo: [
        "CRM audit and redesign against the operating process, not against a feature list.",
        "Pipeline stages with explicit entry and exit criteria and required-field discipline.",
        "Forecasting model and rhythm: weekly pipeline, monthly roll-up, quarterly commit.",
        "Reporting and dashboard design for leaders, managers and individual sellers."
      ],
      outcomes: [
        "A CRM that is the first and last tool a seller touches every day.",
        "Forecast accuracy improved through clean stage logic and activity truth.",
        "A data foundation clean enough to support coaching, executive reporting and AI."
      ]
    },
    {
      id: 8,
      name: "Brand & Thought Leadership",
      shortName: "Brand & Thought",
      tagline: "Content, personal brand, case studies, social proof.",
      dashDescription: "Positions your company and its leaders as credible, trusted voices in the market. Strong brand and thought leadership reduce friction in the sales process and improve both inbound and outbound effectiveness.",
      dashAchieve: "A recognisable and trusted market presence that improves lead quality, supports sales conversations, and compounds over time.",
      overview: "Brand and thought leadership sit at the intersection of marketing and business development. They reduce sales friction before a call ever starts, improve inbound quality, and give sellers and partners credible material to reference in market. In early-stage businesses, this pillar is most effectively built through founders and senior leaders, not only through a marketing department.",
      components: [
        "Content strategy",
        "Personal branding (especially founders / sales leaders)",
        "Case studies & social proof"
      ],
      objectives: [
        "Establish a clear editorial point of view that reinforces positioning.",
        "Build the personal brand of founders and senior sellers in the spaces where buyers gather.",
        "Package case studies, social proof and customer stories as a sales asset.",
        "Measure the commercial impact of brand and thought leadership, not just reach."
      ],
      diagnostics: [
        "How integrated is marketing with business development?",
        "How strong is your campaign planning process?",
        "How consistent is your messaging across channels?",
        "How clearly defined is your target audience?",
        "How effectively do you track campaign performance?",
        "How strong is your content strategy?",
        "How effective is your personal or founder brand?",
        "How strong is your case study and social proof library?",
        "How consistently do you publish thought leadership content?",
        "How effectively does marketing generate inbound leads?"
      ],
      whatWeDo: [
        "Editorial and content strategy aligned to positioning and ICP.",
        "Personal brand programme for founders and commercial leaders.",
        "Case study and proof asset production and maintenance.",
        "Measurement framework linking content to pipeline and revenue."
      ],
      outcomes: [
        "Higher quality inbound and warmer outbound conversations.",
        "A library of proof that accelerates deals across every stage of the funnel.",
        "A recognisable market voice that compounds over time."
      ]
    },
    {
      id: 9,
      name: "Product / Market Feedback Loop",
      shortName: "Product Feedback",
      tagline: "Customer feedback into product, market signal into positioning, continuous iteration.",
      dashDescription: "Ensures that insights from customer interactions, lost deals, and market signals are captured and fed back into product, messaging, and strategy. This creates a continuous improvement cycle.",
      dashAchieve: "A business that evolves based on real market feedback, leading to sharper positioning, better product alignment, and faster response to market changes.",
      overview: "The best business development functions do not only sell the product. They shape it. Customer conversations, lost-deal patterns and market signals are some of the richest sources of product and positioning insight a business has, and they are routinely wasted. This pillar installs a deliberate loop from the field back into product, positioning and pricing.",
      components: [
        "Customer feedback into product",
        "Market insights into positioning",
        "Continuous iteration"
      ],
      objectives: [
        "Capture customer feedback, lost-deal reasons and market signals in a structured, reusable form.",
        "Create a regular, governed flow of insight from commercial teams into product and marketing.",
        "Use market and buyer signal to continuously refine positioning and messaging.",
        "Make the loop visible, so contributors can see their input influence decisions."
      ],
      diagnostics: [
        "How effectively is customer feedback captured?",
        "How well is feedback integrated into product development?",
        "How well do you use market insights to refine positioning?",
        "How quickly do you iterate based on feedback?",
        "How strong is communication between sales and product teams?",
        "How well do you identify emerging customer needs?",
        "How effectively do you test new propositions?",
        "How aligned is product development with market demand?",
        "How structured is your feedback collection process?",
        {
          text: "How often does market insight influence strategy?",
          scale: 10,
          anchors: { low: "Not at all", high: "All the time" }
        }
      ],
      whatWeDo: [
        "Structured capture of win/loss, customer feedback and market signal.",
        "Operating cadence between commercial, product and marketing leadership.",
        "Insight-to-action tracker, so contributions are visible and accountable.",
        "Refresh rhythm for ICP, positioning and messaging as the market shifts."
      ],
      outcomes: [
        "A product and positioning that sharpen over time instead of drifting.",
        "Faster recognition of market shifts, before they appear in the forecast.",
        "A commercial team that feels heard by product, and a product team that trusts commercial input."
      ]
    },
    {
      id: 10,
      name: "Financial & Commercial Modelling",
      shortName: "Commercial Model",
      tagline: "Pricing, margin, CAC, LTV. The discipline that makes growth profitable.",
      dashDescription: "Aligns commercial activity with financial outcomes by connecting pipeline performance to profitability and unit economics. This pillar ensures growth is sustainable and defensible.",
      dashAchieve: "Clear visibility into key metrics such as CAC, LTV, and margin, enabling the business to scale profitably and make informed strategic decisions.",
      overview: "Growth that is not profitable is not really growth, it is a financing strategy in disguise. This pillar puts commercial discipline around the framework, so every other pillar is optimised against unit economics rather than vanity metrics. It is where the business development function proves its value to the board, not just to the pipeline review.",
      components: [
        "Pricing strategy",
        "Margins",
        "Cost of acquisition",
        "Lifetime value"
      ],
      objectives: [
        "Model pricing strategy against segment, value delivered and competitive context.",
        "Understand and actively manage margin by product, segment and channel.",
        "Track cost of acquisition rigorously by channel and segment, not only in aggregate.",
        "Measure lifetime value cohorts and connect them back to acquisition decisions."
      ],
      diagnostics: [
        "How strong is your pricing strategy?",
        "How well do you manage margins?",
        "How accurately do you calculate CAC (Customer acquisition cost)?",
        "How clearly defined is your LTV (lifetime value)?",
        "How confident are you in ROI from sales and marketing spend?",
        "How well do you model revenue growth scenarios?",
        "How disciplined is your commercial decision making?",
        "How well do you understand unit economics?",
        "How effectively do you optimise pricing over time?",
        "How strong is your profitability management?"
      ],
      whatWeDo: [
        "Unit economics model covering pricing, margin, CAC and LTV by segment and channel.",
        "Pricing strategy aligned to value and willingness to pay, not only to cost-plus logic.",
        "Commercial scorecard that sits alongside the pipeline scorecard in every review.",
        "Scenario model connecting commercial decisions to cash, runway and valuation."
      ],
      outcomes: [
        "Growth that is demonstrably profitable and defensible to investors.",
        "A commercial team that can articulate the economics of its own pipeline.",
        "Earlier, cheaper detection of unprofitable segments and channels."
      ]
    }
  ]
};
