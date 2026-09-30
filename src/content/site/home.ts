/* Copy for the v2 homepage. Every product claim here is provable in code —
   see docs/marketing/copy-truth-table.md for the claim → source map. Do not
   add claims (or numbers) that are not in that table. Figures are sample
   data from the fictional studio used across the site, labelled as sample. */

export const hero = {
  eyebrow: "For freelancers & small studios · Free during beta",
  titleLines: ["From first", "enquiry to", "final invoice."],
  title: "From first enquiry to final invoice.",
  body: "Rive is the workspace for freelancers that connects your clients, projects, agreements, invoices, calendar and portfolio — so every job carries its own history.",
  secondary: { label: "Watch it work", href: "#how-it-works" },
  sampleLabel: "Sample studio · the real app",
} as const;

export const fragments = {
  kicker: "Before Rive",
  title: "Seven tabs. One client.",
  body: "Every tool knows one piece. None of them know the job.",
  items: [
    { kind: "Inbox", title: "Re: scope for the rebrand", meta: "12 messages" },
    { kind: "Scope doc", title: "Aster House — scope v3", meta: "Edited 4 days ago" },
    { kind: "Spreadsheet", title: "clients-2026.xlsx", meta: "Sheet 3 of 5" },
    { kind: "Invoice PDF", title: "INV-018.pdf", meta: "Sent? Check sent mail" },
    { kind: "Calendar", title: "Review call · Thu 14:00", meta: "No link to the project" },
    { kind: "Notes", title: "Deposit agreed??", meta: "Untitled note" },
    { kind: "Chat", title: "“Can you resend the invoice?”", meta: "Unread" },
  ],
  record: {
    kicker: "In Rive",
    name: "Aster House",
    domain: "asterhouse.co",
    tag: "Retainer",
    rows: [
      { label: "Projects", value: "2 active" },
      { label: "Agreement", value: "Accepted" },
      { label: "Paid", value: "₹1,80,000" },
      { label: "Outstanding", value: "₹90,000" },
      { label: "Next date", value: "Launch · Thu" },
    ],
    caption: "One record. Everything about the job, attached.",
    sampleLabel: "Sample client",
  },
} as const;

export type StageView = "enquiries" | "clients" | "projects" | "acceptance" | "invoice" | "revenue" | "portfolio";

export const stage = {
  id: "how-it-works",
  kicker: "One job, start to finish",
  title: "Follow one job through Rive.",
  body: "The same sample job, from the first message to the next one. Every step is the real app.",
  steps: [
    {
      view: "enquiries",
      label: "Enquiry",
      title: "An enquiry arrives.",
      body: "Someone reads your portfolio and writes in. The enquiry lands in Rive, not in an inbox.",
    },
    {
      view: "clients",
      label: "Client",
      title: "It becomes a client.",
      body: "Convert the enquiry into a client in one step. Their details come with it.",
    },
    {
      view: "projects",
      label: "Plan",
      title: "The work gets planned.",
      body: "Projects, tasks, milestones and dates attach to the client they belong to.",
    },
    {
      view: "acceptance",
      label: "Agreement",
      title: "The terms are accepted.",
      body: "Your client reads the agreement on their phone and accepts by typing their name. Rive records who, when and which version.",
    },
    {
      view: "invoice",
      label: "Invoice",
      title: "The invoice is drafted from the terms.",
      body: "When a payment in the agreement comes due, Rive drafts the invoice for you to review and send.",
    },
    {
      view: "revenue",
      label: "Paid",
      title: "The payment is recorded.",
      body: "Mark what was paid. Revenue, expenses and margin update, in every currency you bill in.",
    },
    {
      view: "portfolio",
      label: "Publish",
      title: "The work goes public.",
      body: "Publish the project to your portfolio. The next enquiry lands in the same workspace.",
    },
  ] satisfies { view: StageView; label: string; title: string; body: string }[],
} as const;

export const chapters = {
  clients: {
    kicker: "Clients & projects",
    title: "Every client, with everything attached.",
    body: "Open a client and the whole relationship is there: contact details, notes, projects, tasks, milestones, budgets and every invoice.",
    points: ["Client records with notes and tags", "Projects with tasks, milestones and budgets", "Deadlines that show up on your calendar"],
  },
  agreements: {
    kicker: "Agreements",
    title: "Terms your client can accept from their phone.",
    body: "Draft the agreement from the project. Share a review link for comments, then a separate link to accept. Acceptance is recorded against the exact version.",
    points: ["Review link for comments", "Typed-name acceptance with timestamp and version", "Payment schedule that drafts the invoices"],
    note: "Recorded acceptance is not a guarantee of legal enforceability in every jurisdiction.",
  },
  money: {
    kicker: "Money",
    title: "Rive records payments. It doesn't move money.",
    body: "Invoices, payments and expenses stay linked to the client and project they belong to, so revenue and margin are always current.",
    points: ["Invoices in your client's currency", "Payment reminders you can pause per invoice", "Expenses, revenue and profit margin in one view"],
    figures: [
      { label: "Collected", value: 284500, prefix: "₹", format: "en-IN" },
      { label: "Outstanding", value: 90000, prefix: "₹", format: "en-IN" },
      { label: "Profit margin", value: 82, suffix: "%", format: "plain" },
    ],
    figuresLabel: "Sample studio figures",
  },
  calendarPortfolio: {
    kicker: "Calendar & portfolio",
    title: "Your dates in view. Your work in public.",
    body: "Project dates and tasks sit on one calendar, with two-way Google Calendar sync and a private Apple Calendar feed. Publish finished work to a portfolio in one of six templates, and receive enquiries in the same workspace.",
    points: ["Two-way Google Calendar sync", "Private Apple Calendar feed", "Six portfolio templates, enquiries included"],
  },
} as const;

export const importer = {
  kicker: "Bring your spreadsheet",
  title: "Start with the history you already have.",
  body: "Import clients, projects, invoices and expenses from CSV or XLSX. Rive shows matches and duplicates for review before anything is saved.",
  file: "clients-2026.csv",
  rows: [
    ["Aster House", "Brand refresh", "₹1,80,000"],
    ["Northline Studio", "Brand system", "₹96,000"],
    ["Field Notes", "Editorial site", "₹72,000"],
    ["Meridian Labs", "Product launch", "₹36,500"],
    ["Solace Health", "Care app UI", "₹58,000"],
  ],
  columns: ["Client", "Project", "Invoiced"],
} as const;

export const standing = {
  kicker: "Every morning",
  title: "Open Rive. Know where you stand.",
  body: "What's due, what's agreed and what's outstanding — on one screen, before you open anything else.",
} as const;

export const answers = {
  kicker: "Straight answers",
  title: "What Rive does, and what it doesn't yet.",
  does: [
    "Clients, projects, tasks and milestones",
    "Agreements with recorded, typed-name acceptance",
    "Invoices drafted from agreed payment schedules",
    "Payment records, expenses and profit margin",
    "Multi-currency invoices and reporting",
    "Two-way Google Calendar sync and an Apple Calendar feed",
    "Portfolio publishing with enquiries",
    "CSV and XLSX import with review",
  ],
  doesNot: [
    { title: "Collect or transfer money", body: "Rive records payments. Your clients still pay you the way they do today." },
    { title: "Team accounts", body: "One operator per account. Shared team access isn't available yet." },
    { title: "Guarantee enforceability", body: "Acceptance is recorded, but whether it's legally binding depends on your jurisdiction." },
    { title: "Full workspace export", body: "Not available yet. Check this before moving essential records." },
  ],
  beta: "Rive is in open beta. Features will change as it develops — the changelog records every release.",
} as const;

export const pricing = {
  kicker: "Pricing",
  title: "Free during beta.",
  body: "One complete workspace, with no credit card. Paid pricing will be published before beta ends, so a change never arrives as a surprise.",
  price: "₹0",
  cadence: "during open beta",
  included: [
    "Clients, projects, milestones and calendar",
    "Agreements and recorded acceptance",
    "Invoices, payments, expenses and margin",
    "Portfolio publishing and enquiries",
    "CSV and XLSX import",
  ],
  faq: [
    { question: "What does Rive cost?", answer: "Rive is free during the open beta. No credit card is required to start." },
    { question: "Does Rive collect payments for me?", answer: "No. Rive records invoices, payments and expenses. It does not collect or transfer money." },
    { question: "Is an accepted agreement legally binding?", answer: "Rive records the terms and the acceptance. Whether that is enforceable depends on your jurisdiction." },
    { question: "Can my team use one account?", answer: "Not yet. Rive supports one operator per account." },
    { question: "Can I bring my existing data?", answer: "Yes. Import clients, projects, invoices and expenses from CSV or XLSX, with a review step before anything is saved." },
    { question: "What happens when beta ends?", answer: "Paid pricing will be published before beta ends. Nothing changes without notice." },
  ],
} as const;

export const finale = {
  title: "Your next client deserves a better system.",
  titleAfter: "So do you.",
} as const;
