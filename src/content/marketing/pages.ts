export type MarketingCard = {
  title: string;
  body: string;
  meta?: string;
  href?: string;
};

export type MarketingSection = {
  eyebrow?: string;
  title: string;
  body?: string;
  cards?: MarketingCard[];
  bullets?: string[];
};

export type MarketingPageContent = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: MarketingSection[];
  cta?: { headline: string; label: string; href: string; note?: string };
};

export const founders = [
  {
    initials: "AB",
    name: "Arnav Bhattacharya",
    role: "Founder · Product & Engineering · Bengaluru",
    body: "Arnav builds the product and the systems underneath it. He stays close to the unglamorous edge cases because independent work is only calm when the software is dependable.",
  },
  {
    initials: "AC",
    name: "Agnik Chakravorty",
    role: "Cofounder · Markets, Ops & Community",
    body: "Agnik studies how people and businesses actually operate—the handoffs, vendor decisions, and trust that never fit neatly inside a workflow diagram.",
  },
  {
    initials: "DB",
    name: "Druhin Basu",
    role: "Cofounder · Strategy & Growth",
    body: "Druhin turns market structure into a story people can use. He works across strategy, growth, and the difficult question behind every feature: why should this matter now?",
  },
] as const;

export const aboutContent: MarketingPageContent = {
  eyebrow: "BUILT FROM THE WORK",
  title: "We got tired of watching good work disappear into bad operations.",
  intro: "Rive is an operating workspace for independent professionals and digital service businesses. Open beta, open signup: the client, the delivery, the Agreement, the invoice, the calendar, the import, and the public proof live in one loop. It is built by a small team in the same world—client promises, delivery pressure, and the need to make finished work earn its next opportunity.",
  sections: [
    {
      eyebrow: "THE PREMISE",
      title: "Every tool was doing its job. We were doing the integration.",
      body: "A project manager could not see the Agreement. The invoice did not know the milestone. The portfolio started from a blank page after the real work was already complete. Rive began with a simpler question: what if the context moved with the work?",
    },
    {
      eyebrow: "HOW WE BUILD",
      title: "Truth before theatre.",
      cards: [
        { title: "Real workflows", body: "Features begin with an actual operating moment: a promise changes, a deadline moves, a payment lands, or a project becomes proof." },
        { title: "Deliberate actions", body: "Sending, accepting, publishing, and importing stay explicit. Connected does not mean automatic without consent." },
        { title: "Your data is yours", body: "Your records are not our leverage. Ownership stays with you. Export and portability are next on the roadmap—not a product we can hand you today." },
      ],
    },
    {
      eyebrow: "THE TEAM",
      title: "Three people. One operating problem.",
      cards: founders.map((founder) => ({ title: founder.name, meta: founder.role, body: founder.body })),
    },
  ],
  cta: { headline: "Put the context back in the work.", label: "Build your workspace", href: "/register", note: "Open beta. No invitation required. Free during beta." },
};

export const roadmapContent: MarketingPageContent = {
  eyebrow: "ROADMAP",
  title: "Open beta is live. Next we make it dependable.",
  intro: "The roadmap is ordered by trust: make the connected loop reliable, make more of it portable, then extend it only where the product can keep its promises.",
  sections: [
    {
      eyebrow: "LIVE NOW",
      title: "The operating loop",
      bullets: [
        "Clients, projects, tasks, milestones, invoices, and expenses",
        "Agreement composer, review, recorded acceptance, and linked billing",
        "Multi-currency display for invoices and expenses",
        "CSV and XLSX migration with review and relationship reconstruction",
        "Portfolio Studio, public portfolios, analytics, and enquiries",
        "Google Calendar two-way sync and a private Apple Calendar feed",
        "Open signup. Free during beta. One workspace.",
      ],
    },
    {
      eyebrow: "NEXT",
      title: "Reliability before reach",
      bullets: [
        "Deeper export and portability",
        "More migration adapters and clearer recovery",
        "Tighter Agreement and invoice audit history",
        "Public product docs when the surfaces are stable enough to document honestly",
      ],
    },
    {
      eyebrow: "LATER",
      title: "Only after the foundation earns it",
      bullets: [
        "Remit: payout follows the invoice. In development.",
        "A public API",
        "Broader calendar connections",
      ],
    },
  ],
  cta: { headline: "Judge the direction by what ships.", label: "Read what shipped", href: "/changelog" },
};

export const changelogContent: MarketingPageContent = {
  eyebrow: "CHANGELOG",
  title: "What has shipped",
  intro: "A factual record of the open beta. Everything here is live—not announced, mocked, or waiting on an approval.",
  sections: [
    {
      eyebrow: "ACCESS",
      title: "Open beta",
      body: "Signup is open. There is no waitlist and no invitation. Access is free during beta, with one complete workspace.",
    },
    {
      eyebrow: "THE LOOP",
      title: "Operating work, connected",
      cards: [
        { title: "Clients & delivery", body: "Clients, projects, tasks, and milestones keep briefs, dates, cost, and activity attached to the person they belong to." },
        { title: "Agreements", body: "Composer, reusable clauses, review links, recorded acceptance, payment triggers, and linked draft invoices." },
        { title: "Money", body: "Invoices and expenses remember the work. Native amounts stay intact, with a workspace display currency when money crossed borders. Sending and recording payment remain explicit." },
        { title: "Time", body: "Project deadlines and tasks share one calendar. Connect Google Calendar for two-way sync, or add a private Apple Calendar feed." },
      ],
    },
    {
      eyebrow: "MOMENTUM",
      title: "Proof, imports, and getting started",
      cards: [
        { title: "Migration Engine", body: "Multi-file CSV and XLSX profiling, deduplication, relationship review, and idempotent commit. Preview before commit; imported records are retained." },
        { title: "Portfolio Studio", body: "A work-first editor, public portfolio pages, practice views, analytics, media, and source-aware enquiries." },
        { title: "Help & Guides", body: "In-product Help & Guides and goal-aware activation that point to real actions without masking or blocking the workspace." },
      ],
    },
  ],
  cta: { headline: "Every release should close another dead end.", label: "See what comes next", href: "/roadmap" },
};
