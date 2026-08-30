export type MarketingVisualKind = "disconnection" | "dashboard" | "invoice" | "contract" | "portfolio" | "calendar" | "import";

export type MarketingHeroStage = {
  id: "client" | "work" | "agreement" | "invoice" | "proof";
  label: string;
  short: string;
};

export type MarketingChapter = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  visual: {
    kind: MarketingVisualKind;
    props: Record<string, unknown>;
  };
};

export const homeContent = {
  hero: {
    eyebrow: "OPEN BETA",
    title: "Your business should not need you as middleware.",
    body: "One workspace for the client, the work, the Agreement, the invoice, and the proof—so context moves without you rebuilding the story every morning.",
    primaryCta: { label: "Build your workspace", href: "/register" },
    secondaryCta: { label: "See the unpaid role", href: "#problem" },
    stages: [
      { id: "client", label: "CLIENT", short: "The relationship" },
      { id: "work", label: "WORK", short: "The delivery" },
      { id: "agreement", label: "AGREEMENT", short: "The promise" },
      { id: "invoice", label: "INVOICE", short: "The money" },
      { id: "proof", label: "PROOF", short: "The next client" },
    ] satisfies MarketingHeroStage[],
  },
  tax: {
    eyebrow: "THE WORK AROUND THE WORK",
    title: "There is an unpaid role inside every independent business.",
    body: "It remembers which promise became which task, which task should become an invoice, and which finished project should become proof. Today that role is you: copying context between tools that are each fine on their own.",
    close: "Disconnection is the bug. Not your discipline.",
    duties: [
      { label: "01", job: "Rebuild the client", gap: "Who is waiting is reconstructed from three apps." },
      { label: "02", job: "Re-enter the scope", gap: "The promise lives in a thread. The board does not have it." },
      { label: "03", job: "Invent the invoice", gap: "Billing starts when someone asks, from memory." },
      { label: "04", job: "Hunt the date", gap: "The deadline sits in a calendar that has never heard of the Agreement." },
      { label: "05", job: "Assemble the proof", gap: "The case study is a folder, after the work is already forgotten." },
    ],
    visual: {
      kind: "disconnection" as const,
      props: {
        kicker: "This morning's rebuild",
        title: "You are the integration layer",
        note: "None of these records know about each other.",
        records: [
          { label: "CLIENT", name: "Northstar Labs", place: "Contacts app", status: "No project attached" },
          { label: "WORK", name: "Product redesign", place: "Task board", status: "Scope still in the thread" },
          { label: "AGREEMENT", name: "Design terms", place: "Inbox", status: "Unsigned, unlinked" },
          { label: "INVOICE", name: "Milestone 1", place: "Not started", status: "Waiting on you" },
          { label: "PROOF", name: "Case study", place: "Screenshot folder", status: "Not a public site" },
        ],
      },
    },
  },
  bento: [
    { eyebrow: "CLIENT", title: "A relationship, not a row.", body: "Briefs, projects, Agreements, invoices, expenses, and activity stay attached to the person they belong to.", metric: "One context" },
    { eyebrow: "WORK", title: "Delivery knows the promise.", body: "Projects and milestones carry dates, scope, cost, and client context forward without a second setup ritual.", metric: "No re-entry" },
    { eyebrow: "MONEY", title: "Billing remembers the work.", body: "Accepted terms can become draft invoices. Paid invoices and logged expenses become the financial view.", metric: "Contract to cash" },
    { eyebrow: "TIME", title: "Dates stop hiding in tabs.", body: "Project deadlines and tasks share one calendar, with a private Apple Calendar subscription feed.", metric: "One timeline" },
    { eyebrow: "MOMENTUM", title: "Start with what already exists.", body: "CSV and XLSX imports deduplicate records, rebuild relationships, and pause ambiguous matches for review.", metric: "Bring history" },
    { eyebrow: "PROOF", title: "The work sells the next work.", body: "Portfolio Studio turns selected projects into a public site with analytics and inbound enquiries.", metric: "Close the loop" },
  ],
  scrolly: {
    eyebrow: "WHAT CONNECTED FEELS LIKE",
    title: "Change one thing. Everything downstream already knows.",
    body: "These are recognisable slices of the product—not an invented demo. Scroll through the same operating loop you use after signup.",
    chapters: [
      {
        id: "client-context",
        eyebrow: "01 / CLIENT",
        title: "A client becomes working context.",
        body: "The overview does not ask you to remember where attention belongs. Revenue, active work, deadlines, and recent movement arrive from the records underneath.",
        visual: {
          kind: "dashboard",
          props: {
            title: "Your business, at a glance",
            metrics: [
              { label: "Revenue collected", value: "₹4.82L", tone: "emerald" },
              { label: "Active projects", value: "7", tone: "blue" },
              { label: "Expenses logged", value: "₹1.16L", tone: "rose" },
              { label: "Net earnings", value: "₹3.66L", tone: "violet" },
            ],
            activity: ["Invoice INV-1042 paid", "Northstar redesign moved to delivery", "Travel expense linked to Atlas"],
          },
        },
      },
      {
        id: "agreement-context",
        eyebrow: "02 / AGREEMENT",
        title: "Scope stops living in the scrollback.",
        body: "The composer starts with the client and project it already knows. You review every clause and payment trigger before a draft is shared.",
        visual: {
          kind: "contract",
          props: {
            title: "Product design agreement — Northstar",
            client: "Northstar Labs",
            project: "Product redesign",
            amount: "₹2,40,000",
            steps: ["Parties & project", "Terms", "Payments & review"],
            clauses: ["Scope and deliverables", "Review and acceptance", "Payment schedule"],
          },
        },
      },
      {
        id: "invoice-context",
        eyebrow: "03 / MONEY",
        title: "The invoice already knows what came before.",
        body: "Client, project, Agreement, line items, due date, and currency arrive together. Accepted terms can become a draft invoice. Native amounts stay intact, with a workspace display currency when money crossed borders. Sending and recording payment remain explicit actions.",
        visual: {
          kind: "invoice",
          props: {
            number: "INV-1042",
            client: "Northstar Labs",
            project: "Product redesign",
            total: "₹1,20,000",
            issued: "Aug 14, 2026",
            due: "Aug 28, 2026",
            items: [
              { label: "Product design milestone", amount: "₹96,000" },
              { label: "Research synthesis", amount: "₹24,000" },
            ],
          },
        },
      },
      {
        id: "calendar-context",
        eyebrow: "04 / TIME",
        title: "The deadline lives where the work lives.",
        body: "Project milestones and tasks appear on one calendar. A private Apple Calendar feed carries Rive deadlines into the calendar you already check.",
        visual: {
          kind: "calendar",
          props: {
            month: "August 2026",
            days: ["Mon 17", "Tue 18", "Wed 19", "Thu 20", "Fri 21"],
            events: [
              { day: 0, start: 2, span: 2, label: "Northstar review", tone: "blue" },
              { day: 2, start: 5, span: 3, label: "Atlas milestone", tone: "violet" },
              { day: 4, start: 1, span: 2, label: "Invoice follow-up", tone: "emerald" },
            ],
          },
        },
      },
      {
        id: "import-context",
        eyebrow: "05 / MOMENTUM",
        title: "You already have the data.",
        body: "Import clients, projects, invoices, and expenses from CSV or XLSX. Rive deduplicates, fuzzy-matches, rebuilds relationships, and asks when certainty runs out.",
        visual: {
          kind: "import",
          props: {
            filename: "workspace-export.xlsx",
            sources: ["Clients", "Projects", "Invoices", "Expenses"],
            totals: { ready: 1247, review: 31, skipped: 6 },
            matches: ["Northstar Labs ↔ Northstar", "Atlas Website ↔ Atlas relaunch", "INV-1042 ↔ Product redesign"],
          },
        },
      },
      {
        id: "portfolio-context",
        eyebrow: "06 / PROOF",
        title: "Delivery becomes the next introduction.",
        body: "Select the work worth showing, publish it from Portfolio Studio, then see what prospective clients read and where enquiries begin.",
        visual: {
          kind: "portfolio",
          props: {
            name: "Maya Rao",
            tagline: "Independent product designer",
            headline: "Products people understand before anyone explains them.",
            projects: ["Northstar product system", "Atlas onboarding", "Fieldnote mobile"],
            views: [3, 5, 4, 8, 7, 12, 11, 16, 14, 22, 19, 27],
          },
        },
      },
    ] satisfies MarketingChapter[],
  },
  remitNext: {
    eyebrow: "Remit",
    title: "The payout should follow the invoice.",
    body: "Work is billed in the client's currency and lived in yours. Remit is the last hop of the operating loop: conversion you can see, destination you already know, payout from the same workspace as the invoice.",
    status: "In development",
    promises: [
      { label: "Invoice to payout", sub: "The billed amount, the conversion, and the destination stay attached to the client and Agreement you already have." },
      { label: "The currencies you actually use", sub: "USD, EUR, INR, and a mixed client book — without a separate payments product." },
      { label: "Conversion you can inspect", sub: "Live ECB mid-market rates, so the number is in front of you before anyone commits." },
    ],
    cta: { label: "See it on the roadmap", href: "/roadmap" },
  },
  faq: {
    eyebrow: "STRAIGHT ANSWERS",
    title: "Before you move the work that pays you.",
    items: [
      { question: "Can I bring my existing data into Rive?", answer: "Yes. Import CSV or XLSX files for clients, projects, invoices, and expenses. Rive previews duplicates and relationships before anything is committed." },
      { question: "Is Rive open to everyone?", answer: "Yes. Rive is in open beta with open signup. You do not need an invitation, and access is free during beta." },
      { question: "Does Rive send contracts for e-signature?", answer: "Rive supports an Agreement workflow from composer to review, recorded acceptance, and linked billing. You still review every version and deliberate send." },
      { question: "Which calendar integrations are live?", answer: "A private Apple Calendar subscription feed is live. Google Calendar is pending approval and is not presented as available." },
      { question: "Can Rive move money for me?", answer: "Not yet. Remit is in development. Today Rive records invoices, payments, expenses, and multi-currency context. Remit is how payouts will leave the workspace." },
      { question: "What happens to my data?", answer: "Your workspace data is yours. Rive does not sell it. We are building explicit export and portability into the product as the beta matures." },
    ],
  },
  finalCta: {
    eyebrow: "OPEN BETA",
    title: "Put the context back inside the work.",
    body: "Start with one client, or bring the history you already have. The next useful action should begin with context—not another setup ceremony.",
    primary: { label: "Create your Rive workspace", href: "/register" },
    secondary: { label: "See the connected loop", href: "/#product" },
  },
} as const;
