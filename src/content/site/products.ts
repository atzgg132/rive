/* Copy for the v2 product pages. Same rule as home.ts: every claim is in
   docs/marketing/copy-truth-table.md. Visuals name real product components. */

export type ProductVisual =
  | { kind: "workspace"; view: "dashboard" | "clients" | "projects" | "agreements" | "revenue" | "calendar" | "portfolio" | "enquiries" }
  | { kind: "acceptance" }
  | { kind: "invoice" }
  | { kind: "portfolio-site"; templateKey: "minimal-pro" | "visual-studio" | "digital-builder" | "expert-profile" | "creator" | "agency" }
  | { kind: "import-steps" };

export type ProductChapter = { kicker: string; title: string; body: string; visual: ProductVisual };

export type ProductPageCopy = {
  slug: "clients-projects" | "agreements-invoices" | "portfolio" | "migrate";
  path: string;
  name: string;
  sections: { id: string; label: string }[];
  hero: { kicker: string; title: string; body: string; visual: ProductVisual };
  chapters: ProductChapter[];
  includes: string[];
  notYet: { title: string; body: string }[];
  next: { label: string; href: string; blurb: string };
};

export const productPages: Record<ProductPageCopy["slug"], ProductPageCopy> = {
  "clients-projects": {
    slug: "clients-projects",
    path: "/product/clients-projects",
    name: "Clients & projects",
    sections: [
      { id: "clients", label: "Clients" },
      { id: "projects", label: "Projects" },
      { id: "calendar", label: "Calendar" },
      { id: "included", label: "What's included" },
    ],
    hero: {
      kicker: "Clients & projects",
      title: "Every client, with the work attached.",
      body: "Client details, notes, projects, tasks, milestones and deadlines — kept together by the relationship they belong to.",
      visual: { kind: "workspace", view: "clients" },
    },
    chapters: [
      { kicker: "Clients", title: "Open a client. See the whole relationship.", body: "Contact details, notes and tags sit on the client record with every project, agreement and invoice connected to it.", visual: { kind: "workspace", view: "clients" } },
      { kicker: "Projects", title: "Break the work into what's next.", body: "Create projects with tasks, milestones, budgets and dates, and update progress as the engagement moves.", visual: { kind: "workspace", view: "projects" } },
      { kicker: "Calendar", title: "Deadlines where you already look.", body: "Project dates and tasks appear on Rive's calendar, with two-way Google Calendar sync and a private Apple Calendar feed.", visual: { kind: "workspace", view: "calendar" } },
    ],
    includes: ["Client records with notes and tags", "Projects, tasks and milestones", "Budgets and deadlines", "Two-way Google Calendar sync", "Private Apple Calendar feed"],
    notYet: [{ title: "Team access", body: "One operator per account. Shared workspaces and roles aren't available yet." }],
    next: { label: "Agreements & invoices", href: "/product/agreements-invoices", blurb: "Terms your client accepts, invoices drafted from them." },
  },
  "agreements-invoices": {
    slug: "agreements-invoices",
    path: "/product/agreements-invoices",
    name: "Agreements & invoices",
    sections: [
      { id: "agreement", label: "Agreement" },
      { id: "acceptance", label: "Acceptance" },
      { id: "invoice", label: "Invoice" },
      { id: "money", label: "Money" },
      { id: "included", label: "What's included" },
    ],
    hero: {
      kicker: "Agreements & invoices",
      title: "Terms accepted. Invoices drafted from them.",
      body: "Write the agreement, share it for review, record your client's acceptance, and let the agreed payment schedule draft the invoices.",
      visual: { kind: "acceptance" },
    },
    chapters: [
      { kicker: "Agreement", title: "Put the terms in writing.", body: "Define scope, terms and a payment schedule against the client and project you already have. Review every clause before you share it.", visual: { kind: "workspace", view: "agreements" } },
      { kicker: "Acceptance", title: "Your client accepts from their phone.", body: "A review link collects comments. A separate link records acceptance: the typed name, the time and the exact version.", visual: { kind: "acceptance" } },
      { kicker: "Invoice", title: "The schedule drafts the invoice.", body: "When a payment in the accepted agreement comes due, Rive drafts the invoice. You review it and send it.", visual: { kind: "invoice" } },
      { kicker: "Money", title: "Rive records payments. It doesn't move money.", body: "Record payments, pause reminders per invoice, log expenses and see revenue and margin across currencies.", visual: { kind: "workspace", view: "revenue" } },
    ],
    includes: ["Agreements with scope, terms and payment schedule", "Review link for comments", "Typed-name acceptance with version and timestamp", "Invoices drafted from the payment schedule", "Payment reminders you can pause", "Payments, expenses and profit margin"],
    notYet: [
      { title: "Payment collection", body: "Rive records payments. It does not collect or transfer money." },
      { title: "Guaranteed enforceability", body: "Recorded acceptance is not a guarantee of legal enforceability in every jurisdiction, and it isn't legal advice." },
    ],
    next: { label: "Portfolio", href: "/product/portfolio", blurb: "Publish your work and receive enquiries." },
  },
  portfolio: {
    slug: "portfolio",
    path: "/product/portfolio",
    name: "Portfolio",
    sections: [
      { id: "publish", label: "Publish" },
      { id: "templates", label: "Templates" },
      { id: "enquiries", label: "Enquiries" },
      { id: "included", label: "What's included" },
    ],
    hero: {
      kicker: "Portfolio",
      title: "A home for the work you want more of.",
      body: "Publish selected projects in one of six templates, present your services, and receive enquiries in the same workspace as your clients.",
      visual: { kind: "portfolio-site", templateKey: "minimal-pro" },
    },
    chapters: [
      { kicker: "Publish", title: "Choose what to show.", body: "Pick the projects worth showing and shape how they appear. Your portfolio is a public site you control from Rive.", visual: { kind: "workspace", view: "portfolio" } },
      { kicker: "Templates", title: "Six templates, one set of content.", body: "Switch between Minimal pro, Visual studio, Digital builder, Expert profile, Creator and Studio / agency without rewriting anything.", visual: { kind: "portfolio-site", templateKey: "visual-studio" } },
      { kicker: "Enquiries", title: "The next client writes in.", body: "Visitors enquire through your portfolio. Each enquiry lands in Rive and converts into a client in one step.", visual: { kind: "workspace", view: "enquiries" } },
    ],
    includes: ["Six templates", "Selected projects and services", "Enquiry form on your portfolio", "Enquiries that convert into clients", "Portfolio analytics"],
    notYet: [{ title: "Custom domains", body: "Not available yet." }],
    next: { label: "Import your data", href: "/migrate-to-rive", blurb: "Bring your clients and invoices from a spreadsheet." },
  },
  migrate: {
    slug: "migrate",
    path: "/migrate-to-rive",
    name: "Import your data",
    sections: [
      { id: "upload", label: "Upload" },
      { id: "review", label: "Review" },
      { id: "limits", label: "Limits" },
    ],
    hero: {
      kicker: "Import your data",
      title: "Bring your spreadsheet. Review before anything is saved.",
      body: "Import clients, projects, invoices and expenses from CSV or XLSX. Check the proposed records and relationships, then approve.",
      visual: { kind: "import-steps" },
    },
    chapters: [
      { kicker: "Upload", title: "Start with the files you have.", body: "Upload CSV or XLSX files containing supported business records — up to 10 files, 5 MB each, 20 MB and 20,000 rows in total.", visual: { kind: "import-steps" } },
      { kicker: "Review", title: "Nothing is added before you review it.", body: "Check proposed records, relationships, warnings and excluded rows. Resolve the review items, then approve the import.", visual: { kind: "workspace", view: "clients" } },
    ],
    includes: ["Clients, projects, invoices and expenses", "CSV and XLSX files", "Relationship and duplicate review", "Warnings and excluded rows shown before import"],
    notYet: [
      { title: "Direct integrations", body: "Importing isn't a direct integration with another tool, and vendor-specific compatibility isn't guaranteed." },
      { title: "Undo", body: "Imported records remain after you approve. Retrying an import isn't the same as undoing it." },
    ],
    next: { label: "Clients & projects", href: "/product/clients-projects", blurb: "Every client, with the work attached." },
  },
};

/** Shown on /migrate-to-rive when the import engine is switched off for the environment. */
export const migrateUnavailable = {
  title: "Start a workspace while importing is being validated.",
  body: "CSV and XLSX importing is not enabled right now. You can start free and add a client and project by hand.",
} as const;

/** Where "Start free" leads on /migrate-to-rive when importing is on. */
export const migrateSignupHref = "/register?goal=migrate&next=%2Fmigrate" as const;

export const productOrder: ProductPageCopy["slug"][] = ["clients-projects", "agreements-invoices", "portfolio", "migrate"];
