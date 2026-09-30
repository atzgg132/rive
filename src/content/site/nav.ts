export type SiteProductLink = {
  label: string;
  href: string;
  description: string;
  preview: "clients" | "agreements" | "portfolio" | "import";
};

export const siteProductLinks: SiteProductLink[] = [
  { label: "Clients & projects", href: "/product/clients-projects", description: "Every client, with the work attached", preview: "clients" },
  { label: "Agreements & invoices", href: "/product/agreements-invoices", description: "Terms accepted, invoices drafted from them", preview: "agreements" },
  { label: "Portfolio", href: "/product/portfolio", description: "Publish your work, receive enquiries", preview: "portfolio" },
  { label: "Import your data", href: "/migrate-to-rive", description: "Bring clients and invoices from CSV or XLSX", preview: "import" },
];

export const siteHeaderLinks = [
  { label: "Pricing", href: "/pricing" },
  { label: "Changelog", href: "/changelog" },
] as const;

export const siteLogin = { label: "Log in", href: "/login" } as const;

export const siteFooterGroups = [
  { label: "Product", items: [...siteProductLinks.map(({ label, href }) => ({ label, href })), { label: "Pricing", href: "/pricing" }] },
  {
    label: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Changelog", href: "/changelog" },
      { label: "Roadmap", href: "/roadmap" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    label: "Legal",
    items: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
] as const;

export const siteFooterCopy = {
  line: "The workspace for freelancers and small studios.",
  status: "Open beta · Free to start",
  copyright: "Rive. Your work stays yours.",
} as const;
