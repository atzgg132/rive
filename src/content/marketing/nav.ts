export type MarketingNavItem = {
  label: string;
  href: string;
  description?: string;
};

export type MarketingNavGroup = {
  label: string;
  items: MarketingNavItem[];
};

const productItems: MarketingNavItem[] = [
  { label: "The connected loop", href: "/#product", description: "Client → Work → Money → Proof" },
  { label: "Agreements", href: "/#agreement-context", description: "Scope, review, acceptance, billing" },
  { label: "Bring your data", href: "/migrate-to-rive", description: "CSV and XLSX, previewed before import" },
  { label: "Portfolio", href: "/#portfolio-context", description: "Turn delivered work into proof" },
];

const companyItems: MarketingNavItem[] = [
  { label: "About", href: "/about", description: "Built by people who do the work" },
  { label: "Changelog", href: "/changelog", description: "What has actually shipped" },
  { label: "Roadmap", href: "/roadmap", description: "What we are earning next" },
];

export const marketingNav: MarketingNavGroup[] = [
  { label: "Product", items: productItems },
  { label: "Company", items: companyItems },
];

export const marketingHeaderLinks: MarketingNavItem[] = [
  { label: "Pricing", href: "/#pricing" },
];

export const footerNav: MarketingNavGroup[] = [
  {
    label: "Product",
    items: [...productItems, { label: "Pricing", href: "/#pricing" }],
  },
  { label: "Company", items: companyItems },
  {
    label: "Legal",
    items: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export const accountNav = {
  login: { label: "Log in", href: "/login" },
  signup: { label: "Build your workspace", href: "/register" },
} as const;

export const footerCopy = {
  description: "The client, the work, the money, and the proof—connected in one operating workspace.",
  status: "Open beta · Open signup",
  copyright: "Rive. Your work stays yours.",
} as const;

export const marketingRouteMetadata = [
  { path: "/", title: "Rive — Your business should not need you as middleware", description: "Connect clients, projects, Agreements, invoices, expenses, calendars, imports, and portfolio proof in one operating workspace.", priority: 1 },
  { path: "/about", title: "About Rive — Built from the work itself", description: "Meet the team building a connected operating workspace for independent professionals and digital service businesses.", priority: 0.7 },
  { path: "/changelog", title: "Rive changelog — What has shipped", description: "A factual record of what is live in the Rive open beta.", priority: 0.65 },
  { path: "/contact", title: "Contact Rive", description: "Bring Rive a question, support request, press inquiry, partnership, or broken operating handoff.", priority: 0.6 },
  { path: "/migrate-to-rive", title: "Migrate to Rive", description: "Preview a CSV or XLSX import of clients, projects, invoices, and expenses before anything is added.", priority: 0.8 },
  { path: "/cookies", title: "Rive cookie policy", description: "How Rive uses cookies and local storage.", priority: 0.2 },
  { path: "/privacy", title: "Rive privacy policy", description: "How Rive handles and protects personal and workspace data.", priority: 0.2 },
  { path: "/roadmap", title: "Rive roadmap", description: "What is live in open beta and the reliability, connection, and portability work ahead.", priority: 0.6 },
  { path: "/terms", title: "Rive terms of service", description: "The terms that apply when you use Rive.", priority: 0.2 },
] as const;

export const marketingPaths = marketingRouteMetadata.map((route) => route.path);
