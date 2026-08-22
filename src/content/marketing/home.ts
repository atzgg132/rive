export type MarketingVisualKind = "dashboard" | "invoice" | "contract" | "portfolio" | "calendar" | "import";

export type MarketingChapter = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  metrics?: { label: string; value: string }[];
  visual: {
    kind: MarketingVisualKind;
    props: Record<string, unknown>;
  };
};

export const homeContent = {
  hero: {
    eyebrow: "OPEN BETA · CLIENT → WORK → MONEY → PROOF",
    title: "Your business should not need you as middleware.",
    body: "The client, the work, the Agreement, the invoice, and the proof belong to one story. Rive keeps that story connected—so context moves without you rebuilding it every morning.",
    primaryCta: { label: "Build your workspace", href: "/register" },
    secondaryCta: { label: "See the connected loop", href: "#product" },
    proof: ["Open signup", "Free during beta", "Your data stays yours"],
  },
  tax: {
    eyebrow: "THE WORK AROUND THE WORK",
    title: "There is an unpaid role inside every independent business.",
    body: "It remembers which promise became which task, which task should become an invoice, and which finished project should become proof. Today, that role is you—copying context between tools that are each fine on their own.",
    close: "Disconnection is the bug. Not your discipline.",
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
        metrics: [{ label: "context rebuilt", value: "0×" }, { label: "active projects", value: "7" }],
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
        metrics: [{ label: "parties", value: "2" }, { label: "deliberate sends", value: "1" }],
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
        body: "Client, project, Agreement, line items, due date, and currency arrive together. Sending and recording payment remain explicit actions.",
        metrics: [{ label: "duplicate entry", value: "none" }, { label: "outstanding", value: "₹0" }],
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
        metrics: [{ label: "calendar", value: "one" }, { label: "missed context", value: "0" }],
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
        metrics: [{ label: "records ready", value: "1,284" }, { label: "silent guesses", value: "0" }],
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
        metrics: [{ label: "selected work", value: "06" }, { label: "loop", value: "closed" }],
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
  import: {
    eyebrow: "START WITH MOMENTUM",
    title: "An empty state is not a fresh start. It is another migration project.",
    body: "Bring the records you already trust. Rive profiles the files, previews relationships, flags uncertainty, and commits only after review.",
    facts: ["CSV and XLSX imports", "Deduplication and fuzzy matching", "Relationship reconstruction", "Review before commit"],
  },
  remit: {
    eyebrow: "MONEY ACROSS CURRENCIES",
    title: "Know what crossed the books—even when money crossed borders.",
    body: "Rive keeps each invoice and expense in its native currency, then gives the workspace a chosen display currency for a comparable view. Remit transfers are not presented as a shipped product.",
    promises: ["Native amounts stay intact", "Conversion dates stay visible", "No transfer claim hidden in the maths"],
    calculator: { from: "USD 2,400", to: "INR 1,99,200", rate: "1 USD = 83 INR", note: "Illustrative workspace display" },
  },
  portfolio: {
    eyebrow: "THE LOOP CLOSES",
    title: "The work should sell the next work.",
    body: "Portfolio Studio reuses selected project context to publish a site that still feels like yours. Analytics show what gets read. Enquiries arrive with the source project attached.",
  },
  faq: {
    eyebrow: "STRAIGHT ANSWERS",
    title: "Before you move the work that pays you.",
    items: [
      { question: "Can I bring my existing data into Rive?", answer: "Yes. Import CSV or XLSX files for clients, projects, invoices, and expenses. Rive previews duplicates and relationships before anything is committed." },
      { question: "Is Rive open to everyone?", answer: "Yes. Rive is in open beta with open signup. You do not need an invitation, and access is free during beta." },
      { question: "Does Rive send contracts for e-signature?", answer: "Rive supports an Agreement workflow from composer to review, recorded acceptance, and linked billing. You still review every version and deliberate send." },
      { question: "Which calendar integrations are live?", answer: "A private Apple Calendar subscription feed is live. Google Calendar is pending approval and is not presented as available." },
      { question: "Can Rive move money for me?", answer: "No. Remit transfers are not shipped. Rive currently records invoices, payments, expenses, and multi-currency financial context." },
      { question: "What happens to my data?", answer: "Your workspace data is yours. Rive does not sell it. We are building explicit export and portability into the product as the beta matures." },
    ],
  },
  finalCta: {
    eyebrow: "OPEN BETA",
    title: "Put the context back inside the work.",
    body: "Start with one client, or bring the history you already have. The next useful action should begin with context—not another setup ceremony.",
    primary: { label: "Create your Rive workspace", href: "/register" },
    secondary: { label: "Read the docs", href: "/docs" },
  },
} as const;
