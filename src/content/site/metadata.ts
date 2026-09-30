/* v2 titles lead with the category, because "Rive" alone also names an
   animation tool. Paths match marketingRouteMetadata in content/marketing/nav.ts. */
export const siteRouteMetadata = {
  "/": {
    title: "Rive — The workspace for freelancers & small studios",
    description: "Clients, projects, agreements, invoices, calendar and portfolio in one connected workspace for freelancers. Free during open beta, no credit card.",
  },
  "/product/clients-projects": {
    title: "Clients & projects — Rive, the workspace for freelancers",
    description: "Keep every client with their projects, tasks, milestones, budgets and deadlines in one place.",
  },
  "/product/agreements-invoices": {
    title: "Agreements & invoices — Rive, the workspace for freelancers",
    description: "Send agreements your client accepts from their phone, and draft invoices from the agreed payment schedule.",
  },
  "/product/portfolio": {
    title: "Portfolio — Rive, the workspace for freelancers",
    description: "Publish your work in one of six templates and receive enquiries in the same workspace as your clients.",
  },
  "/migrate-to-rive": {
    title: "Import your data — Rive, the workspace for freelancers",
    description: "Bring clients, projects, invoices and expenses from CSV or XLSX, with a review step before anything is saved.",
  },
  "/pricing": {
    title: "Pricing — Rive is free during open beta",
    description: "One complete workspace for freelancers, free during open beta. No credit card required.",
  },
} as const;
