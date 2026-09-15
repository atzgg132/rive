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
  { label: "Clients & projects", href: "/product/clients-projects", description: "Keep every client and deadline in view" },
  { label: "Agreements & invoices", href: "/product/agreements-invoices", description: "Keep the terms and the money with the work" },
  { label: "Portfolio", href: "/product/portfolio", description: "Publish the work you want more of" },
  { label: "Import your data", href: "/migrate-to-rive", description: "Bring supported CSV and XLSX records" },
];

const companyItems: MarketingNavItem[] = [
  { label: "About", href: "/about" },
  { label: "Changelog", href: "/changelog" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Contact", href: "/contact" },
];

export const marketingNav: MarketingNavGroup[] = [
  {
    label: "Product",
    items: [...productItems, { label: "Pricing", href: "/pricing", description: "Free during open beta" }],
  },
  { label: "Company", items: companyItems },
];

export type MarketingNavEntry =
  | MarketingNavItem
  | { label: string; items: MarketingNavItem[] };

export const marketingHeaderNav: MarketingNavEntry[] = [
  { label: "Product", items: productItems },
  { label: "Pricing", href: "/pricing" },
  { label: "Institution", items: companyItems },
];

export const footerNav: MarketingNavGroup[] = [
  { label: "Product", items: [...productItems, { label: "Pricing", href: "/pricing" }] },
  { label: "Company", items: companyItems },
  {
    label: "Legal",
    items: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Log in", href: "/login" },
      { label: "Start free", href: "/register" },
    ],
  },
];

export const accountNav = {
  login: { label: "Log in", href: "/login" },
  signup: { label: "Start free", href: "/register" },
} as const;

export const footerCopy = {
  description: "Rive brings clients, projects, agreements, invoices, and expenses into one workspace for independent businesses.",
  status: "Open beta · Free to start",
  copyright: "Rive. Your work stays yours.",
} as const;

export const marketingRouteMetadata = [
  { path: "/", title: "Rive — Multiple clients. One clear picture.", description: "Manage clients, projects, agreements, invoices, and expenses in one workspace built for independent service businesses.", priority: 1 },
  { path: "/product/clients-projects", title: "Client and project management for independent businesses | Rive", description: "Manage client details, projects, tasks, milestones, and deadlines in Rive.", priority: 0.85 },
  { path: "/product/agreements-invoices", title: "Agreements and invoices for client work | Rive", description: "Prepare agreements, record acceptance, and manage invoices alongside the client work they belong to.", priority: 0.85 },
  { path: "/product/portfolio", title: "Publish your client work with Portfolio Studio | Rive", description: "Build a public portfolio, present your services, and receive enquiries with Rive.", priority: 0.8 },
  { path: "/pricing", title: "Rive pricing — Free during open beta", description: "Create a Rive account without a credit card and use one complete workspace free during open beta.", priority: 0.85 },
  { path: "/about", title: "About Rive — Built for the business behind client work", description: "Meet the small team building practical software for independent service businesses.", priority: 0.65 },
  { path: "/changelog", title: "Rive changelog — What is new", description: "Product updates, improvements, and fixes published when they become available.", priority: 0.6 },
  { path: "/contact", title: "Contact Rive", description: "Ask a product question, get help, or share feedback with the people building Rive.", priority: 0.55 },
  { path: "/migrate-to-rive", title: "Import business records into Rive", description: "Bring supported clients, projects, invoices, and expenses from CSV or XLSX with review before import.", priority: 0.75 },
  { path: "/roadmap", title: "Rive roadmap — Where the product goes next", description: "See what is available, what is being improved, and what Rive is exploring.", priority: 0.55 },
  { path: "/cookies", title: "Rive cookie policy", description: "How Rive uses cookies and local storage.", priority: 0.2 },
  { path: "/privacy", title: "Rive privacy policy", description: "How Rive handles personal and workspace information.", priority: 0.2 },
  { path: "/terms", title: "Rive terms of service", description: "The terms that apply when you use Rive.", priority: 0.2 },
] as const;

export const marketingPaths = marketingRouteMetadata.map((route) => route.path);
