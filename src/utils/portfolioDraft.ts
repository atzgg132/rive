import {
  DEFAULT_PORTFOLIO_THEME,
  mergePortfolioContent,
  type PortfolioContent,
  type PortfolioProject,
  type PortfolioService,
  type PortfolioTestimonial,
  type PortfolioTheme,
} from "@/utils/portfolio";

export type PortfolioSeo = {
  title: string;
  description: string;
  indexable: boolean;
};

export type PortfolioRecord = {
  id: string;
  slug: string;
  status: string;
  templateKey: string;
  content: PortfolioContent;
  theme: PortfolioTheme;
  seo: { title?: string; description?: string; indexable?: boolean } | null;
  revision: number;
};

export type PortfolioDraftSnapshot = {
  revision: number;
  content: PortfolioContent;
  theme: PortfolioTheme;
  templateKey: string;
  slug: string;
  seo: PortfolioSeo;
};

export type PortfolioDraftOverrides = Partial<
  Pick<PortfolioDraftSnapshot, "content" | "theme" | "templateKey" | "slug" | "seo">
>;

export type LocalDraftAction = "none" | "restore" | "conflict";

export const PORTFOLIO_AUTOSAVE_DELAY_MS = 700;

export function portfolioDraftStorageKey(portfolioId: string) {
  return `rive:portfolio-draft:${portfolioId}`;
}

export function createStudioId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createStudioProject(): PortfolioProject {
  return {
    id: createStudioId("project"),
    title: "",
    description: "",
    role: "",
    year: String(new Date().getFullYear()),
    url: "",
    imageUrl: "",
    client: "",
    timeline: "",
    deliverables: [],
    gallery: [],
    visibility: "public",
    challenge: "",
    solution: "",
    outcome: "",
    tools: [],
  };
}

export function createStudioService(): PortfolioService {
  return { id: createStudioId("service"), title: "", description: "" };
}

export function createStudioTestimonial(): PortfolioTestimonial {
  return {
    id: createStudioId("testimonial"),
    quote: "",
    name: "",
    company: "",
    role: "",
    projectId: "",
    source: "",
    visibility: "public",
  };
}

export function seoFromRecord(record: Pick<PortfolioRecord, "seo">): PortfolioSeo {
  return {
    title: record.seo?.title || "",
    description: record.seo?.description || "",
    indexable: record.seo?.indexable !== false,
  };
}

export function themeFromRecord(record: Pick<PortfolioRecord, "theme">): PortfolioTheme {
  return { ...DEFAULT_PORTFOLIO_THEME, ...(record.theme || {}) };
}

export function parsePortfolioDraftSnapshot(raw: string | null): PortfolioDraftSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PortfolioDraftSnapshot>;
    if (
      parsed &&
      parsed.content &&
      parsed.theme &&
      parsed.seo &&
      typeof parsed.slug === "string" &&
      typeof parsed.templateKey === "string"
    ) {
      return {
        revision: typeof parsed.revision === "number" ? parsed.revision : Number.NaN,
        content: parsed.content,
        theme: parsed.theme,
        templateKey: parsed.templateKey,
        slug: parsed.slug,
        seo: {
          title: parsed.seo.title || "",
          description: parsed.seo.description || "",
          indexable: parsed.seo.indexable !== false,
        },
      };
    }
  } catch {
    // Keep a recovery copy even if it cannot be parsed right now.
  }
  return null;
}

/**
 * A local draft at the same revision is unsaved work from this generation.
 * A local draft at any other revision means another tab (or device) wrote
 * first — a human has to choose, or we silently lose one of the two.
 */
export function classifyLocalDraft(
  serverRevision: number,
  stored: PortfolioDraftSnapshot | null,
): LocalDraftAction {
  if (!stored) return "none";
  if (Number.isFinite(stored.revision) && stored.revision !== serverRevision) return "conflict";
  return "restore";
}

export function shouldApplyServerSnapshot(submittedEditVersion: number, currentEditVersion: number) {
  return submittedEditVersion === currentEditVersion;
}

export function buildPortfolioPersistBody(input: {
  revision: number;
  content: PortfolioContent;
  theme: PortfolioTheme;
  templateKey: string;
  slug: string;
  /** The slug the server last confirmed. Omit to always send the slug. */
  savedSlug?: string;
  seo: PortfolioSeo;
  status?: "draft" | "published";
}) {
  const body: {
    revision: number;
    content: PortfolioContent;
    theme: PortfolioTheme;
    templateKey: string;
    slug?: string;
    seo: PortfolioSeo;
    status?: "draft" | "published";
  } = {
    revision: input.revision,
    content: input.content,
    theme: input.theme,
    templateKey: input.templateKey,
    seo: input.seo,
  };
  /* The public URL travels only when it actually changed. It used to ride on
     every autosave, and the endpoint answers a taken slug with a 409 — so one
     unavailable URL sitting in the field failed every unrelated save, and the
     writing someone did afterwards was never stored. A rejected URL should
     cost them the URL, not the work. */
  if (input.savedSlug === undefined || input.slug !== input.savedSlug) body.slug = input.slug;
  if (input.status) body.status = input.status;
  return body;
}

export function isQuietPersistFailure(error: unknown, online: boolean) {
  if (!online) return true;
  return error instanceof TypeError;
}

export function snapshotFromDraft(input: {
  revision: number;
  content: PortfolioContent;
  theme: PortfolioTheme;
  templateKey: string;
  slug: string;
  seo: PortfolioSeo;
}): PortfolioDraftSnapshot {
  return {
    revision: input.revision,
    content: input.content,
    theme: input.theme,
    templateKey: input.templateKey,
    slug: input.slug,
    seo: input.seo,
  };
}

export function contentFromRecord(record: Pick<PortfolioRecord, "content">): PortfolioContent {
  return mergePortfolioContent(record.content);
}

/**
 * Move one item to a new index, returning a new array.
 *
 * Project order is not decoration: it is the order visitors read the work in on
 * the public page. Until now the only way to change it was to delete a project
 * and retype it, which meant the first thing someone saw was whichever project
 * they happened to add first.
 *
 * Out-of-range indices clamp rather than throw. Callers include drag handlers,
 * where a drop can land past the end of the list, and "move up" on the first
 * item, which should be a no-op rather than an error.
 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items;
  const target = Math.max(0, Math.min(items.length - 1, to));
  if (target === from) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}
