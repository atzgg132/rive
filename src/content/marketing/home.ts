export type MarketingVisualKind = "disconnection" | "dashboard" | "invoice" | "contract" | "portfolio" | "calendar" | "import";

export type MarketingHeroStage = {
  id: "client" | "work" | "agreement" | "invoice" | "proof";
  label: string;
  short: string;
  detail: string;
  carries: string;
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
    proof: ["Open signup", "Free during beta", "Your data stays yours"],
    stages: [
      {
        id: "client",
        label: "CLIENT",
        short: "The relationship",
        detail: "Clients give the rest of the workspace a place to belong. Work, Agreements, invoices, and activity stay in that context.",
        carries: "Context flows into the work",
      },
      {
        id: "work",
        label: "WORK",
        short: "The delivery",
        detail: "Projects and milestones carry scope, dates, cost, and client context forward without a second setup ritual.",
        carries: "The promise flows into the Agreement",
      },
      {
        id: "agreement",
        label: "AGREEMENT",
        short: "The promise",
        detail: "Review the terms and payment triggers before a draft is shared. The next step starts with what was agreed.",
        carries: "Accepted terms flow into billing",
      },
      {
        id: "invoice",
        label: "INVOICE",
        short: "The money",
        detail: "Approved payment triggers can become draft invoices. Sending and recording payment remain explicit actions.",
        carries: "Finished work flows into proof",
      },
      {
        id: "proof",
        label: "PROOF",
        short: "The next client",
        detail: "Selected projects can become public portfolio proof, so the value created does not disappear when delivery ends.",
        carries: "Proof begins the next relationship",
      },
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
        body: "Client, project, Agreement, line items, due date, and currency arrive together. Sending and recording payment remain explicit actions.",
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
  import: {
    eyebrow: "START WITH MOMENTUM",
    title: "An empty state is not a fresh start. It is another migration project.",
    body: "Bring the records you already trust. Rive profiles the files, previews relationships, flags uncertainty, and commits only after review.",
    facts: ["CSV and XLSX imports", "Deduplication and fuzzy matching", "Relationship reconstruction", "Review before commit"],
    visual: {
      kicker: "The same morning, after one import",
      summary: "5 records, 4 links",
      title: "The scattered records, reconnected",
      note: "workspace-export.xlsx, profiled and matched. Nothing committed until you reviewed it.",
      footer: "Nothing retyped. Nothing rebuilt from memory.",
      records: [
        { label: "CLIENT", name: "Northstar Labs", detail: "Merged from two duplicate contact rows", status: "In the workspace", tone: "linked" as const },
        { label: "WORK", name: "Product redesign", detail: "Scope arrived with the file", status: "Linked to Northstar Labs", tone: "linked" as const },
        { label: "INVOICE", name: "INV-1042", detail: "Milestone 1, still unpaid", status: "Linked to Product redesign", tone: "linked" as const },
        { label: "EXPENSE", name: "EXP-388", detail: "Travel, native currency intact", status: "Linked to Atlas", tone: "linked" as const },
        { label: "WORK", name: "Atlas Website ↔ Atlas relaunch", detail: "Fuzzy match, certainty ran out", status: "Paused for your review", tone: "review" as const },
      ],
    },
  },
  agreement: {
    eyebrow: "CONTRACT TO CASH",
    title: "A promise should not disappear before the invoice.",
    body: "The Agreement begins with client and project context, moves through deliberate review and recorded acceptance, then carries approved payment triggers into draft billing.",
    tags: ["Contracts & acceptance", "Contract to cash"],
    visual: {
      kicker: "One agreement, carried forward",
      summary: "Accepted to billed",
      title: "The promise becomes the invoice",
      note: "Product design agreement — Northstar. Each step below started from the one before it.",
      footer: "Sending and recording payment stay explicit actions.",
      stages: [
        {
          label: "ACCEPTED",
          name: "Design terms recorded",
          detail: "Reviewed clause by clause. Acceptance recorded Aug 12 with the terms it covers.",
          status: "On the record",
          carries: "Accepted terms carry the payment schedule forward",
        },
        {
          label: "TRIGGER",
          name: "Milestone 1 approved",
          detail: "₹1,20,000 payment trigger, straight from the accepted schedule.",
          status: "Approved for billing",
          carries: "The approved trigger becomes a draft invoice",
        },
        {
          label: "INVOICE",
          name: "INV-1042 drafted",
          detail: "Client, project, line items, due date, and currency arrived together.",
          status: "Waiting for you to send",
          carries: null,
        },
      ],
    },
  },
  remit: {
    eyebrow: "MONEY ACROSS CURRENCIES",
    title: "Know what crossed the books—even when money crossed borders.",
    body: "Rive keeps each invoice and expense in its native currency, then gives the workspace a chosen display currency for a comparable view. Remit transfers are not presented as a shipped product.",
    promises: ["Native amounts stay intact", "Conversion dates stay visible", "No transfer claim hidden in the maths"],
    ledger: {
      label: "Workspace display · INR",
      note: "Illustrative workspace display",
      rows: [
        { record: "INV-1042", kind: "Invoice", native: "USD 2,400", rate: "83.00 · Aug 14", display: "₹1,99,200" },
        { record: "EXP-388", kind: "Expense", native: "EUR 180", rate: "90.40 · Aug 09", display: "₹16,272" },
        { record: "INV-1037", kind: "Invoice", native: "INR 85,000", rate: "Native", display: "₹85,000" },
      ],
      totals: [
        { label: "Invoiced, in display currency", value: "₹2,84,200" },
        { label: "Spent, in display currency", value: "₹16,272" },
      ],
    },
  },
  portfolio: {
    eyebrow: "THE LOOP CLOSES",
    title: "The work should sell the next work.",
    body: "Portfolio Studio reuses selected project context to publish a site that still feels like yours. Analytics show what gets read. Enquiries arrive with the source project attached.",
    visual: {
      kicker: "After publishing",
      summary: "1 new enquiry",
      title: "The next client arrives with context",
      note: "The published site is doing quiet work: what got read, and who wrote back.",
      footer: "Proof begins the next relationship.",
      reads: [
        { project: "Northstar product system", metric: "412 reads" },
        { project: "Atlas onboarding", metric: "268 reads" },
        { project: "Fieldnote mobile", metric: "144 reads" },
      ],
      enquiry: {
        from: "Priya Menon",
        company: "Juniper Health",
        received: "Today, 9:41 AM",
        message: "We read the Northstar case study twice. We need the same clarity for our clinician tools — are you taking projects in October?",
        source: "Via Northstar product system",
      },
    },
  },
  remitNext: {
    eyebrow: "NEXT: REMIT",
    title: "Know the payout before you send it.",
    body: "Remit is next: international payouts that live next to the invoice, so getting paid across a border stops meaning a third app that has never heard of the work. The preview uses live ECB rates. No money moves yet.",
    status: "In development",
    promises: [
      { label: "Tied to the invoice", sub: "Payouts should follow the Agreement, not a separate app." },
      { label: "The rate is the rate", sub: "No hidden FX markup. This preview uses ECB mid-market." },
      { label: "Built for client work", sub: "Designed around invoices and clients, not consumer cash pickup." },
    ],
    cta: { label: "Follow the roadmap", href: "/roadmap" },
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
