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
  { initials: "AB", name: "Arnav Bhattacharya", role: "Founder · Product & Engineering", body: "Arnav builds the product and the systems underneath it, staying close to the operational details that make independent work dependable." },
  { initials: "AC", name: "Agnik Chakravorty", role: "Cofounder · Markets, Operations & Community", body: "Agnik studies how independent businesses actually operate: the handoffs, decisions, and trust behind the visible work." },
  { initials: "DB", name: "Druhin Basu", role: "Cofounder · Strategy & Growth", body: "Druhin works across strategy and growth, connecting what Rive builds to the practical reasons it should matter." },
] as const;

export const aboutContent: MarketingPageContent = {
  eyebrow: "About Rive",
  title: "Built for the business behind the client work.",
  intro: "Rive is a small team building software for independent service businesses. We focus on the practical work of managing clients, delivering projects, keeping agreements, and tracking invoices and expenses.",
  sections: [
    { eyebrow: "Our focus", title: "Independent does not have to mean improvised.", body: "Independent businesses need more than a task list. Rive brings the operational parts of client work into one workspace, without asking you to become a large company to use it." },
    { eyebrow: "The team", title: "Three people, close to the details.", cards: founders.map((founder) => ({ title: founder.name, meta: founder.role, body: founder.body })) },
    { eyebrow: "Open beta", title: "See the work, not a promise deck.", body: "Rive is in open beta. You can inspect the current product, recent releases, and planned work before deciding whether it fits your business.", cards: [
      { title: "What is available", body: "Read a factual record of the capabilities currently in Rive.", href: "/changelog" },
      { title: "Where it goes next", body: "See planned areas of work without invented delivery dates.", href: "/roadmap" },
    ] },
  ],
  cta: { headline: "Put Rive to work on one client.", label: "Start free", href: "/register", note: "Free during beta. No credit card required." },
};

export const roadmapContent: MarketingPageContent = {
  eyebrow: "Roadmap",
  title: "Where Rive goes next.",
  intro: "A view of current capabilities and planned work. Planned features are not available until they appear in the product and changelog.",
  sections: [
    { eyebrow: "Available", title: "The current workspace", bullets: [
      "Clients, projects, tasks, and milestones",
      "Agreements, review, and recorded acceptance",
      "Invoices, payment records, expenses, and multi-currency display",
      "Calendar with Google Calendar sync and a private Apple Calendar feed",
      "Portfolio publishing, analytics, and enquiries",
    ] },
    { eyebrow: "Being worked on", title: "Trust before breadth", bullets: [
      "Reliability across connected business records",
      "Data portability and clearer export paths",
      "Import review and recovery improvements",
      "Stronger agreement and invoice audit history",
    ] },
    { eyebrow: "Exploring", title: "Only after the foundation earns it", bullets: [
      "Additional calendar and workflow integrations",
      "A public API",
      "Payment-related capabilities",
    ], body: "Priorities may change. This page is not a delivery-date commitment." },
  ],
  cta: { headline: "See what is already in the product.", label: "Read the changelog", href: "/changelog" },
};

export const changelogContent: MarketingPageContent = {
  eyebrow: "Changelog",
  title: "What’s new in Rive.",
  intro: "Product capabilities currently available in open beta. Future release entries will be published with dates when the corresponding changes ship.",
  sections: [
    { eyebrow: "Open beta", title: "One workspace for the person running the business.", body: "Signup is open, access is free during beta, and no credit card or invitation is required. Rive currently supports one operator per account." },
    { eyebrow: "Client work", title: "Clients, projects, and the work between them.", cards: [
      { title: "Clients & delivery", body: "Manage clients, projects, tasks, and milestones with the dates and records connected to the work." },
      { title: "Agreements", body: "Prepare agreements, share them for review, record acceptance, and connect supported billing actions." },
      { title: "Invoices & expenses", body: "Create invoices, record payments, log expenses, and preserve native amounts across currencies." },
      { title: "Calendar", body: "Review project and task dates in Rive, keep them in sync with Google Calendar, or subscribe through a private Apple Calendar feed." },
    ] },
    { eyebrow: "Starting and showing", title: "Bring records in. Put selected work out.", cards: [
      { title: "Import", body: "Preview supported CSV and XLSX records, with relationship review before approval." },
      { title: "Portfolio Studio", body: "Build a public portfolio, publish selected work, review analytics, and receive enquiries." },
    ] },
  ],
  cta: { headline: "Try the current product with real work.", label: "Start free", href: "/register", note: "Free during beta. No credit card required." },
};
