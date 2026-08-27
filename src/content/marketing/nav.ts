export type MarketingNavItem = {
  label: string;
  href: string;
  description?: string;
};

export type MarketingNavGroup = {
  label: string;
  items: MarketingNavItem[];
};

export const marketingNav: MarketingNavGroup[] = [
  {
    label: "Product",
    items: [
      { label: "The connected loop", href: "/#product", description: "Client → Work → Money → Proof" },
      { label: "Agreements", href: "/#agreement-context", description: "Scope, review, acceptance, billing" },
      { label: "Bring your data", href: "/#import-context", description: "CSV and XLSX, reconstructed" },
      { label: "Portfolio", href: "/#portfolio-context", description: "Turn delivered work into proof" },
      { label: "Pricing", href: "/#pricing", description: "Open beta, no card required" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About", href: "/about", description: "Built by people who do the work" },
      { label: "Changelog", href: "/changelog", description: "What has actually shipped" },
      { label: "Roadmap", href: "/roadmap", description: "What we are earning next" },
      { label: "Careers", href: "/careers", description: "Join a small, accountable team" },
      { label: "Press", href: "/press", description: "Facts, assets, and contact" },
    ],
  },
  {
    label: "Learn",
    items: [
      { label: "Documentation", href: "/docs", description: "Start with a real workflow" },
      { label: "Guides", href: "/guides", description: "Outcome-led walkthroughs" },
      { label: "API reference", href: "/api-reference", description: "Workspace routes, honestly framed" },
      { label: "Blog", href: "/blog", description: "Forthcoming field notes" },
      { label: "Community", href: "/community", description: "Email a broken handoff" },
    ],
  },
];

export const footerNav: MarketingNavGroup[] = [
  ...marketingNav,
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
  { path: "/api-reference", title: "Rive application API reference", description: "An honest map of the authenticated routes that power Rive today, and what is not yet a public API.", priority: 0.45 },
  { path: "/blog", title: "Rive field notes", description: "Forthcoming notes on the systems, decisions, and hidden coordination cost behind independent client work.", priority: 0.55 },
  { path: "/careers", title: "Careers at Rive", description: "Help build dependable operating software for people whose name is on the work.", priority: 0.5 },
  { path: "/changelog", title: "Rive changelog — What shipped", description: "A factual record of what is live in the Rive open beta.", priority: 0.65 },
  { path: "/community", title: "Rive community", description: "Email a broken handoff via /contact so operating reality can reach the people shipping Rive. There is no live community product.", priority: 0.5 },
  { path: "/contact", title: "Contact Rive", description: "Bring Rive a question, support request, press inquiry, partnership, or broken operating handoff.", priority: 0.6 },
  { path: "/cookies", title: "Rive cookie policy", description: "How Rive uses cookies and local storage.", priority: 0.2 },
  { path: "/docs", title: "Rive documentation", description: "Start with a client and follow the connected path through work, money, and proof.", priority: 0.65 },
  { path: "/guides", title: "Rive guides", description: "Short, outcome-led guides grounded in the product that ships today.", priority: 0.65 },
  { path: "/press", title: "Rive press room", description: "Verified company facts, approved brand assets, boilerplate, and media contact.", priority: 0.4 },
  { path: "/privacy", title: "Rive privacy policy", description: "How Rive handles and protects personal and workspace data.", priority: 0.2 },
  { path: "/roadmap", title: "Rive roadmap", description: "What is live in open beta and the reliability, connection, and portability work ahead.", priority: 0.6 },
  { path: "/terms", title: "Rive terms of service", description: "The terms that apply when you use Rive.", priority: 0.2 },
] as const;

export const marketingPaths = marketingRouteMetadata.map((route) => route.path);
