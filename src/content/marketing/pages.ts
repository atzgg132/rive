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
  intro: "Rive is an operating workspace for independent professionals and digital service businesses. It is built by a small team in the same world: client promises, delivery pressure, invoices, follow-ups, and the need to make finished work earn its next opportunity.",
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
        { title: "Data that can leave", body: "Your records are not our leverage. Portability, clear ownership, and honest limits are part of the product." },
      ],
    },
    {
      eyebrow: "THE TEAM",
      title: "Three people. One operating problem.",
      cards: founders.map((founder) => ({ title: founder.name, meta: founder.role, body: founder.body })),
    },
  ],
  cta: { headline: "Put the context back in the work.", label: "Build your workspace", href: "/register", note: "Open beta. No invitation required." },
};

export const careersContent: MarketingPageContent = {
  eyebrow: "CAREERS AT RIVE",
  title: "Build software whose quiet details carry someone’s livelihood.",
  intro: "This is not productivity theatre. The work touches client trust, scope, deadlines, money, and public proof. We value people who can hold ambition and operational care at the same time.",
  sections: [
    {
      title: "Small team. Visible ownership.",
      cards: [
        { title: "Own the outcome", body: "The work does not stop at a handoff. You follow it through product judgement, implementation, and the edge cases users actually meet." },
        { title: "Write the truth", body: "We name limitations, show our reasoning, and prefer a precise no to a vague promise." },
        { title: "Make calm software", body: "Fast matters. So do recovery, accessibility, and the feeling that the product will not surprise you at the worst moment." },
      ],
    },
    {
      eyebrow: "OPEN CONVERSATIONS",
      title: "We hire for the work in front of us, not a permanent wall of roles.",
      body: "If you have unusually strong product engineering, product design, community, or service-business operating experience, send a concise note with the work you are proud of and the problem you want to own.",
    },
  ],
  cta: { headline: "The next hire should remove a real point of failure.", label: "Introduce yourself", href: "mailto:hello@rive.work", note: "Tell us what you would make true." },
};

export const communityContent: MarketingPageContent = {
  eyebrow: "RIVE COMMUNITY",
  title: "A product for independent work should be built in public with independent people.",
  intro: "The community is where operating reality reaches the roadmap: how you scope, recover a late payment, price cross-border work, migrate years of records, and turn delivery into the next introduction.",
  sections: [
    {
      title: "Bring the edge case, not the applause.",
      cards: [
        { title: "Workflow clinics", body: "Walk us through the moment where context breaks. We will map the records, decision, and recovery path with you." },
        { title: "Open-beta notes", body: "See what shipped, what changed after feedback, and what remains deliberately unfinished." },
        { title: "Peer operating patterns", body: "Share the concrete systems that make client work calmer—without turning them into universal advice." },
      ],
    },
  ],
  cta: { headline: "Bring us the handoff that keeps breaking.", label: "Send us your operating problem", href: "/contact", note: "Specific stories shape better software." },
};

export const pressContent: MarketingPageContent = {
  eyebrow: "PRESS ROOM",
  title: "The facts, without the launch fog.",
  intro: "Rive is an open-beta operating workspace for independent professionals and digital service businesses. It connects clients, projects, Agreements, invoices, expenses, calendars, imports, and public portfolio proof.",
  sections: [
    {
      title: "Company facts",
      bullets: ["Founded in 2026", "Open beta with open signup", "Built for independent professionals and digital service businesses", "Apple Calendar subscription feed available; Google Calendar pending approval", "No shipped Remit transfer product and no claimed AI co-pilot"],
    },
    {
      title: "Approved boilerplate",
      body: "Rive is an operating workspace for independent professionals and digital service businesses. It connects the client record to delivery, Agreements, invoices, expenses, calendars, data imports, and a public portfolio—so context moves with the work.",
    },
  ],
  cta: { headline: "Use the facts. Ask for the rest.", label: "Contact the team", href: "mailto:hello@rive.work", note: "Media, founder interviews, and verified product detail." },
};

export const roadmapContent: MarketingPageContent = {
  eyebrow: "ROADMAP",
  title: "Open beta is live. Next we make it dependable.",
  intro: "The roadmap is ordered by trust: make the connected loop reliable, make more of it portable, then extend it only where the product can keep its promises.",
  sections: [
    {
      eyebrow: "LIVE NOW",
      title: "The operating loop",
      bullets: ["Clients, projects, tasks, milestones, invoices, and expenses", "Agreement composer, review, recorded acceptance, and linked billing", "CSV and XLSX migration with review and relationship reconstruction", "Portfolio Studio, public portfolios, analytics, and enquiries", "Apple Calendar feed"],
    },
    {
      eyebrow: "NEXT",
      title: "Reliability before reach",
      bullets: ["Deeper export and portability", "More migration adapters and clearer recovery", "Tighter Agreement and invoice audit history", "Calendar connection work once Google approves the integration", "Faster, more legible product surfaces on small screens"],
    },
    {
      eyebrow: "LATER",
      title: "Only after the foundation earns it",
      body: "A public API, broader calendar connections, and new money movement surfaces require operational guarantees we will not fake in a marketing sentence.",
    },
  ],
  cta: { headline: "Judge the direction by what ships.", label: "Read what shipped", href: "/changelog" },
};

export const blogContent: MarketingPageContent = {
  eyebrow: "FIELD NOTES",
  title: "The systems behind independent work are part of the work.",
  intro: "Notes on client trust, operating context, product decisions, and the invisible coordination tax inside a service business.",
  sections: [
    {
      title: "From the build",
      cards: [
        { title: "The tax nobody put on the invoice", meta: "OPERATIONS · 6 MIN", body: "The real cost of eight disconnected tools is the context you reconstruct between them." },
        { title: "Why acceptance and automation are different things", meta: "AGREEMENTS · 7 MIN", body: "Connected workflows should remove re-entry without removing deliberate decisions." },
        { title: "An import is a trust exercise", meta: "MIGRATION · 5 MIN", body: "The honest migration engine knows when to stop guessing and ask." },
      ],
    },
  ],
  cta: { headline: "The ideas are only useful when the product proves them.", label: "See the product behind the notes", href: "/#product" },
};

export const changelogContent: MarketingPageContent = {
  eyebrow: "CHANGELOG",
  title: "Open beta",
  intro: "A factual record of what is live. “Latest” means shipped to the open beta—not announced, mocked, or waiting on an approval.",
  sections: [
    {
      eyebrow: "LATEST",
      title: "Connected work, with fewer dead ends",
      cards: [
        { title: "Portfolio Studio", meta: "Latest", body: "A work-first editor, public portfolio pages, practice views, analytics, media, and source-aware enquiries." },
        { title: "Agreements", meta: "Latest", body: "Composer, reusable clauses, review links, recorded acceptance, payment triggers, and linked draft invoices." },
        { title: "Migration Engine", meta: "Latest", body: "Multi-file CSV and XLSX profiling, deduplication, relationship review, idempotent commit, and rollback paths." },
        { title: "Guided activation", meta: "Latest", body: "Goal-aware guidance that points to real actions without masking or blocking the workspace." },
      ],
    },
  ],
  cta: { headline: "Every release should close another dead end.", label: "See what comes next", href: "/roadmap" },
};
