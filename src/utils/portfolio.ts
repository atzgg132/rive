export type PortfolioProject = {
  id: string;
  title: string;
  description: string;
  role: string;
  year: string;
  url: string;
  imageUrl: string;
  visibility?: "public" | "private";
  challenge?: string;
  solution?: string;
  outcome?: string;
  tools?: string[];
};

export type PortfolioService = {
  id: string;
  title: string;
  description: string;
};

export type PortfolioTestimonial = {
  id: string;
  quote: string;
  name: string;
  company: string;
};

export type PortfolioContent = {
  name: string;
  headline: string;
  bio: string;
  location: string;
  availability: string;
  contactEmail: string;
  social: { label: string; url: string }[];
  projects: PortfolioProject[];
  services: PortfolioService[];
  testimonials: PortfolioTestimonial[];
  sections: { key: "about" | "projects" | "services" | "testimonials" | "contact"; visible: boolean }[];
};

export type PortfolioTheme = {
  accent: string;
  mode: "light" | "dark" | "system";
  radius: "soft" | "sharp";
};

export const PORTFOLIO_TEMPLATES = [
  { key: "minimal-pro", name: "minimal pro", description: "A crisp, editorial portfolio for any independent professional.", accent: "#2563EB" },
  { key: "visual-studio", name: "visual studio", description: "Media-first storytelling for photographers, filmmakers, and designers.", accent: "#DB2777" },
  { key: "digital-builder", name: "digital builder", description: "Case-study focused for developers, product designers, and makers.", accent: "#7C3AED" },
  { key: "expert-profile", name: "expert profile", description: "Trust-first presentation for consultants, CAs, coaches, and advisors.", accent: "#059669" },
  { key: "creator", name: "creator", description: "A bold home for creators, YouTubers, and independent media brands.", accent: "#EA580C" },
  { key: "agency", name: "studio / agency", description: "Structured service and case-study pages for small teams.", accent: "#0891B2" },
] as const;

export const DEFAULT_PORTFOLIO_CONTENT: PortfolioContent = {
  name: "your name",
  headline: "independent creative building useful things.",
  bio: "Tell people what you do, who you help, and what makes your work different.",
  location: "available worldwide",
  availability: "available for select projects",
  contactEmail: "",
  social: [],
  projects: [
    { id: "project-1", title: "your first project", description: "Add a concise project story, your role, and the result you created.", role: "your role", year: "2026", url: "", imageUrl: "", visibility: "public", challenge: "", solution: "", outcome: "", tools: [] },
  ],
  services: [
    { id: "service-1", title: "your first service", description: "Describe the outcome clients can expect when they work with you." },
  ],
  testimonials: [],
  sections: [
    { key: "about", visible: true },
    { key: "projects", visible: true },
    { key: "services", visible: true },
    { key: "testimonials", visible: false },
    { key: "contact", visible: true },
  ],
};

export const DEFAULT_PORTFOLIO_THEME: PortfolioTheme = {
  accent: "#2563EB",
  mode: "light",
  radius: "soft",
};

type PortfolioSeedData = {
  name?: string | null;
  email: string;
  projects?: Array<{
    id: string;
    title: string;
    description: string | null;
    tags: string[];
    startDate: Date | null;
    updatedAt: Date;
  }>;
};

/** Build a useful first draft without exposing private client or financial data. */
export function buildPrefilledPortfolioContent(user: PortfolioSeedData): PortfolioContent {
  const projects = (user.projects || []).slice(0, 12).map((project) => ({
    id: `project-${project.id}`,
    title: project.title,
    description: project.description || "Add the outcome, your contribution, and what made this work successful.",
    role: "independent professional",
    year: String((project.startDate || project.updatedAt).getFullYear()),
    url: "",
    imageUrl: "",
  }));

  const serviceNames = Array.from(new Set((user.projects || []).flatMap((project) => project.tags))).slice(0, 6);
  const services = serviceNames.map((name, index) => ({
    id: `service-${index + 1}`,
    title: name,
    description: "Describe the outcome clients can expect when they work with you.",
  }));

  return {
    ...DEFAULT_PORTFOLIO_CONTENT,
    name: user.name?.trim() || user.email.split("@")[0] || DEFAULT_PORTFOLIO_CONTENT.name,
    headline: projects.length > 0 ? "independent professional delivering meaningful work." : DEFAULT_PORTFOLIO_CONTENT.headline,
    bio: projects.length > 0
      ? `A selection of work, projects, and services by ${user.name?.trim() || user.email.split("@")[0] || "me"}.`
      : DEFAULT_PORTFOLIO_CONTENT.bio,
    location: "",
    contactEmail: user.email,
    projects: projects.length > 0 ? projects : DEFAULT_PORTFOLIO_CONTENT.projects,
    services: services.length > 0 ? services : DEFAULT_PORTFOLIO_CONTENT.services,
  };
}

export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function mergePortfolioContent(value: unknown): PortfolioContent {
  const input = (value && typeof value === "object" ? value : {}) as Partial<PortfolioContent>;
  return {
    ...DEFAULT_PORTFOLIO_CONTENT,
    ...input,
    social: Array.isArray(input.social) ? input.social : DEFAULT_PORTFOLIO_CONTENT.social,
    projects: Array.isArray(input.projects) ? input.projects : DEFAULT_PORTFOLIO_CONTENT.projects,
    services: Array.isArray(input.services) ? input.services : DEFAULT_PORTFOLIO_CONTENT.services,
    testimonials: Array.isArray(input.testimonials) ? input.testimonials : DEFAULT_PORTFOLIO_CONTENT.testimonials,
    sections: Array.isArray(input.sections) ? input.sections : DEFAULT_PORTFOLIO_CONTENT.sections,
  };
}

const MAX_INLINE_IMAGE_LENGTH = 7_000_000;
const HTTP_URL = /^https?:\/\/[^\s<>]+$/i;
const INLINE_IMAGE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

function isSafePortfolioUrl(value: unknown): boolean {
  return typeof value === "string" && value.length <= 2_000 && HTTP_URL.test(value);
}

/** Validate all user-controlled portfolio URLs and inline uploads on the server. */
export function validatePortfolioContent(value: unknown): string | null {
  if (!value || typeof value !== "object") return "Portfolio content must be an object.";
  const input = value as Partial<PortfolioContent>;
  if (input.projects !== undefined) {
    if (!Array.isArray(input.projects) || input.projects.length > 30) return "Add up to 30 projects.";
    for (const project of input.projects) {
      if (!project || typeof project !== "object") return "Each project must be valid.";
      const item = project as Partial<PortfolioProject>;
      if (item.imageUrl) {
        if (typeof item.imageUrl !== "string" || item.imageUrl.length > MAX_INLINE_IMAGE_LENGTH) return "Project images are too large.";
        if (!INLINE_IMAGE.test(item.imageUrl) && !isSafePortfolioUrl(item.imageUrl)) return "Project images must be HTTPS URLs or supported image uploads.";
      }
      if (item.url && !isSafePortfolioUrl(item.url)) return "Project links must use HTTPS URLs.";
      if (item.tools && (!Array.isArray(item.tools) || item.tools.length > 30 || item.tools.some((tool) => typeof tool !== "string" || tool.length > 80))) return "Project tools are invalid.";
    }
  }
  if (input.social !== undefined) {
    if (!Array.isArray(input.social) || input.social.length > 12) return "Add up to 12 social links.";
    for (const social of input.social) {
      if (!social || typeof social !== "object" || !isSafePortfolioUrl((social as { url?: unknown }).url)) return "Social links must use HTTPS URLs.";
    }
  }
  if (input.contactEmail !== undefined && (typeof input.contactEmail !== "string" || input.contactEmail.length > 320 || (input.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)))) return "Enter a valid contact email.";
  return null;
}

export function isPortfolioPublished(status: string): boolean {
  return status === "published";
}
