import { EMBED_PROVIDERS, parseEmbedInput, type EmbedProvider } from "@/utils/portfolioEmbeds";
import { MANAGED_IMAGE_URL, MANAGED_MEDIA_URL, MAX_MEDIA_PER_PROJECT } from "@/utils/portfolioMedia";

export type PortfolioMediaKind = "image" | "video" | "audio" | "document" | "embed";

export type PortfolioMedia = {
  id: string;
  kind: PortfolioMediaKind;
  /** Managed asset path, HTTPS URL, or the embed source this app rebuilt. */
  url: string;
  alt: string;
  caption: string;
  /** Cover frame for video and audio. Captured in the browser at upload time. */
  posterUrl?: string;
  /** Human-facing provider link, for "watch on YouTube" style affordances. */
  sourceUrl?: string;
  provider?: EmbedProvider;
  durationSeconds?: number;
  /** Downsampled audio peaks, computed in the browser so playback needs no API. */
  peaks?: number[];
  aspectRatio?: number;
  embedHeight?: number;
  bytes?: number;
};

/** Legacy image-only gallery entries, kept readable forever. */
export type PortfolioGalleryImage = {
  id: string;
  url: string;
  alt: string;
  caption: string;
};

export type PortfolioProject = {
  id: string;
  title: string;
  description: string;
  role: string;
  year: string;
  url: string;
  imageUrl: string;
  client?: string;
  timeline?: string;
  deliverables?: string[];
  /** Superseded by `media`. Still read so existing portfolios keep rendering. */
  gallery?: PortfolioGalleryImage[];
  media?: PortfolioMedia[];
  visibility?: "public" | "private";
  challenge?: string;
  solution?: string;
  outcome?: string;
  tools?: string[];
  practiceId?: string;
};

export type PortfolioService = {
  id: string;
  title: string;
  description: string;
  practiceId?: string;
};

/** How media behaves on the public page and in preview. The editor never
 *  autoplays, so working on a portfolio stays quiet and cheap. */
export type PortfolioMediaSettings = {
  /** Play video when it scrolls into view. Always muted — browsers block
   *  audible autoplay, and this also pauses off-screen to limit egress.
   *  Ignored for audio, where muted autoplay would be pointless. */
  autoplayOnScroll: boolean;
  /** Loop autoplayed video. */
  loop: boolean;
  /** Play a video cover muted while the pointer rests on its card. */
  hoverPreview: boolean;
  /** Expand images to a full-screen viewer on click. */
  lightbox: boolean;
  /** How project media is arranged. */
  layout: "grid" | "masonry" | "carousel";
  /** "cover" fills and crops; "contain" preserves the whole frame. */
  fit: "cover" | "contain";
  showCaptions: boolean;
};

export const DEFAULT_PORTFOLIO_MEDIA_SETTINGS: PortfolioMediaSettings = {
  autoplayOnScroll: false,
  loop: false,
  hoverPreview: false,
  lightbox: true,
  layout: "grid",
  fit: "cover",
  showCaptions: true,
};

/** A distinct discipline within one portfolio: someone bakes and produces music. */
export type PortfolioPractice = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  accent?: string;
  coverMediaId?: string;
  order: number;
  visibility: "public" | "private";
};

export type PortfolioTestimonial = {
  id: string;
  quote: string;
  name: string;
  company: string;
  role?: string;
  projectId?: string;
  source?: string;
  visibility?: "public" | "private";
  practiceId?: string;
};

export type PortfolioContent = {
  name: string;
  profileImageUrl: string;
  /** The original uploaded image, kept privately so owners can recrop it later. */
  profileImageSourceUrl: string;
  showProfileImage: boolean;
  /**
   * The small line above the headline. Blank falls back to the template's own.
   *
   * It used to be template-only and unreachable, which meant a `visual-studio`
   * portfolio announced "SELECTED VISUAL PRACTICE" to its owner with no way to
   * change it and nothing saying where it came from — and, because Practices is
   * a real feature here meaning "a discipline you run", it read as a Practices
   * setting leaking onto the public page. It is not. It is now the owner's line.
   */
  tagline: string;
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
  practices: PortfolioPractice[];
  /** "unified" filters one page in place; "separate" gives each practice a route. */
  practiceLayout: "unified" | "separate";
  mediaSettings: PortfolioMediaSettings;
};

export type PortfolioTheme = {
  accent: string;
  mode: "light" | "dark" | "system";
  radius: "soft" | "sharp";
};

/**
 * `eyebrow` is the default for `content.tagline` — the line above the headline.
 *
 * None of them say "practice" any more. That word already means something
 * specific in this product, and two of these defaults were using it in the
 * generic professional sense on the owner's own public page.
 */
export const PORTFOLIO_TEMPLATES = [
  { key: "minimal-pro", name: "Minimal pro", description: "A crisp, editorial portfolio for any independent professional.", accent: "#2563EB", eyebrow: "Independent professional" },
  { key: "visual-studio", name: "Visual studio", description: "Media-first storytelling for photographers, filmmakers, and designers.", accent: "#DB2777", eyebrow: "Selected visual work" },
  { key: "digital-builder", name: "Digital builder", description: "Case-study focused for developers, product designers, and makers.", accent: "#7C3AED", eyebrow: "Designing and shipping" },
  { key: "expert-profile", name: "Expert profile", description: "Trust-first presentation for consultants, CAs, coaches, and advisors.", accent: "#059669", eyebrow: "Independent expertise" },
  { key: "creator", name: "Creator", description: "A bold home for creators, YouTubers, and independent media brands.", accent: "#EA580C", eyebrow: "Creator portfolio" },
  { key: "agency", name: "Studio / agency", description: "Structured service and case-study pages for small teams.", accent: "#0891B2", eyebrow: "Independent studio" },
] as const;

/** The tagline a portfolio shows when its owner has not written one. */
export function templateEyebrow(templateKey: string): string {
  return (PORTFOLIO_TEMPLATES.find((template) => template.key === templateKey) || PORTFOLIO_TEMPLATES[0]).eyebrow;
}

export const DEFAULT_PORTFOLIO_CONTENT: PortfolioContent = {
  name: "",
  profileImageUrl: "",
  profileImageSourceUrl: "",
  showProfileImage: false,
  tagline: "",
  headline: "",
  bio: "",
  location: "",
  availability: "",
  contactEmail: "",
  social: [],
  projects: [
    { id: "project-1", title: "", description: "", role: "", year: "2026", url: "", imageUrl: "", client: "", timeline: "", deliverables: [], gallery: [], media: [], visibility: "public", challenge: "", solution: "", outcome: "", tools: [] },
  ],
  services: [
    { id: "service-1", title: "", description: "" },
  ],
  testimonials: [],
  sections: [
    { key: "about", visible: true },
    { key: "projects", visible: true },
    { key: "services", visible: true },
    { key: "testimonials", visible: false },
    { key: "contact", visible: true },
  ],
  practices: [],
  practiceLayout: "unified",
  mediaSettings: DEFAULT_PORTFOLIO_MEDIA_SETTINGS,
};

export const DEFAULT_PORTFOLIO_THEME: PortfolioTheme = {
  accent: "#2563EB",
  mode: "light",
  radius: "soft",
};

/** The profile photo is rendered in the same square slot at every breakpoint. */
export const PROFILE_IMAGE_ASPECT_RATIO = 1;
export const MAX_PROFILE_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;

type PortfolioSeedData = {
  name?: string | null;
  avatarUrl?: string | null;
  profession?: string | null;
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
    description: project.description || "",
    role: "",
    year: String((project.startDate || project.updatedAt).getFullYear()),
    url: "",
    imageUrl: "",
  }));

  const serviceNames = Array.from(new Set((user.projects || []).flatMap((project) => project.tags))).slice(0, 6);
  const services = serviceNames.map((name, index) => ({
    id: `service-${index + 1}`,
    title: name,
    description: "",
  }));

  return {
    ...DEFAULT_PORTFOLIO_CONTENT,
    name: user.name?.trim() || user.email.split("@")[0] || DEFAULT_PORTFOLIO_CONTENT.name,
    profileImageUrl: user.avatarUrl || "",
    // An account avatar may already be the owner's chosen source image. Keep
    // it private so the first crop does not make every later recrop start from
    // an already-cropped derivative.
    profileImageSourceUrl: user.avatarUrl || "",
    headline: user.profession?.trim()
      ? `${user.profession.trim()} delivering thoughtful, dependable work.`
      : projects.length > 0
        ? "Digital service professional delivering meaningful work."
        : DEFAULT_PORTFOLIO_CONTENT.headline,
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

const LEGACY_PORTFOLIO_STARTER_COPY = new Set([
  "your name",
  "independent creative building useful things.",
  "tell people what you do, who you help, and what makes your work different.",
  "available worldwide",
  "available for select projects",
  "your first project",
  "add a concise project story, your role, and the result you created.",
  "your role",
  "your first service",
  "describe the outcome clients can expect when they work with you.",
]);

function clearLegacyStarterCopy(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return LEGACY_PORTFOLIO_STARTER_COPY.has(trimmed.toLowerCase()) ? "" : value;
}

function isPortfolioMediaKind(value: unknown): value is PortfolioMediaKind {
  return value === "image" || value === "video" || value === "audio" || value === "document" || value === "embed";
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Resolve a project's media, upgrading the image-only gallery that portfolios
 *  created before mixed media still carry. Identifiers are derived, never
 *  generated, so repeated normalization stays stable. */
function normalizeProjectMedia(project: Partial<PortfolioProject>): PortfolioMedia[] {
  if (Array.isArray(project.media)) {
    return project.media
      .filter((item): item is PortfolioMedia => Boolean(item && typeof item === "object"))
      .map((item, index) => ({
        ...item,
        id: text(item.id) || `media-${index + 1}`,
        kind: isPortfolioMediaKind(item.kind) ? item.kind : "image",
        url: text(item.url),
        alt: text(item.alt),
        caption: text(item.caption),
      }));
  }
  if (!Array.isArray(project.gallery)) return [];
  return project.gallery
    .filter((image): image is PortfolioGalleryImage => Boolean(image && typeof image === "object"))
    .map((image, index) => ({
      id: text(image.id) || `gallery-${index + 1}`,
      kind: "image" as const,
      url: text(image.url),
      alt: text(image.alt),
      caption: text(image.caption),
    }));
}

function normalizePractice(practice: Partial<PortfolioPractice>, index: number): PortfolioPractice {
  return {
    ...practice,
    id: text(practice.id) || `practice-${index + 1}`,
    slug: normalizeSlug(text(practice.slug) || text(practice.name)),
    name: text(practice.name),
    tagline: text(practice.tagline),
    description: text(practice.description),
    order: Number.isFinite(practice.order) ? Number(practice.order) : index,
    visibility: practice.visibility === "private" ? "private" : "public",
  };
}

export function mergePortfolioContent(value: unknown): PortfolioContent {
  const input = (value && typeof value === "object" ? value : {}) as Partial<PortfolioContent>;
  return {
    ...DEFAULT_PORTFOLIO_CONTENT,
    ...input,
    name: clearLegacyStarterCopy(input.name),
    profileImageUrl: text(input.profileImageUrl),
    profileImageSourceUrl: text(input.profileImageSourceUrl),
    showProfileImage: input.showProfileImage === true,
    tagline: text(input.tagline),
    headline: clearLegacyStarterCopy(input.headline),
    bio: clearLegacyStarterCopy(input.bio),
    location: clearLegacyStarterCopy(input.location),
    availability: clearLegacyStarterCopy(input.availability),
    social: Array.isArray(input.social) ? input.social : DEFAULT_PORTFOLIO_CONTENT.social,
    projects: Array.isArray(input.projects)
      ? input.projects.map((project) => {
          const media = normalizeProjectMedia(project);
          return {
            ...project,
            title: clearLegacyStarterCopy(project.title),
            description: clearLegacyStarterCopy(project.description),
            role: clearLegacyStarterCopy(project.role),
            deliverables: Array.isArray(project.deliverables) ? project.deliverables : [],
            media,
            // Mirrored so anything still reading the image-only shape keeps working.
            gallery: media
              .filter((item) => item.kind === "image")
              .map(({ id, url, alt, caption }) => ({ id, url, alt, caption })),
          };
        })
      : DEFAULT_PORTFOLIO_CONTENT.projects,
    services: Array.isArray(input.services)
      ? input.services.map((service) => ({
          ...service,
          title: clearLegacyStarterCopy(service.title),
          description: clearLegacyStarterCopy(service.description),
        }))
      : DEFAULT_PORTFOLIO_CONTENT.services,
    testimonials: Array.isArray(input.testimonials) ? input.testimonials : DEFAULT_PORTFOLIO_CONTENT.testimonials,
    sections: Array.isArray(input.sections) ? input.sections : DEFAULT_PORTFOLIO_CONTENT.sections,
    practices: Array.isArray(input.practices) ? input.practices.map(normalizePractice) : DEFAULT_PORTFOLIO_CONTENT.practices,
    practiceLayout: input.practiceLayout === "separate" ? "separate" : "unified",
    mediaSettings: { ...DEFAULT_PORTFOLIO_MEDIA_SETTINGS, ...(input.mediaSettings || {}) },
  };
}

/**
 * Has this portfolio been started at all?
 *
 * A freshly provisioned portfolio is not empty in the `=== null` sense: it
 * arrives with one blank project and one blank service already in it, so
 * `projects.length` is 1 before anyone has typed a word. Asking "is there
 * anything here" has to mean "is there anything a visitor would see", which is
 * why this looks at the text rather than the arrays.
 *
 * The first-run path keys off this, so it must not linger once someone has
 * genuinely started: a name alone is enough to count as begun.
 */
export function isPortfolioUnstarted(content: PortfolioContent): boolean {
  const hasIdentity = Boolean(content.name.trim() || content.headline.trim() || content.bio.trim());
  const hasWork = content.projects.some((project) => project.title.trim() || project.description.trim());
  const hasServices = content.services.some((service) => service.title.trim());
  return !hasIdentity && !hasWork && !hasServices;
}

/** Practices a visitor may see, in the owner's chosen order. */
export function getVisiblePractices(content: PortfolioContent): PortfolioPractice[] {
  return content.practices
    .filter((practice) => practice.visibility !== "private" && practice.slug && practice.name.trim())
    .sort((a, b) => a.order - b.order);
}

/** Items with no practice are shared across every practice, so they always show. */
export function belongsToPractice(item: { practiceId?: string }, practiceId: string | null): boolean {
  if (!item.practiceId) return true;
  return practiceId === null || item.practiceId === practiceId;
}

/**
 * The best still image a project can offer, most deliberate choice first.
 *
 * "Cover" used to mean literally `imageUrl`, so a project that had photos in
 * its media but no explicit cover was treated as having no image at all — the
 * card reached past the photos for a video or embed, and the case study fell
 * back to a placeholder numeral. An embed is the worst possible cover: it is a
 * third-party iframe that cannot be cropped and usually arrives wearing someone
 * else's play button and branding.
 *
 * Order: the cover the owner set, then a photo they uploaded, then a poster
 * frame captured from a video. Managed media URLs are already stored as
 * servable paths, so every one of these can go straight into an `img` tag.
 *
 * `allowPosterFrame` exists for the card, which prefers to mount the player
 * itself over showing that player's poster as a flat image.
 */
export function resolveProjectCoverImage(
  project: Pick<PortfolioProject, "imageUrl" | "media">,
  options: { allowPosterFrame?: boolean } = {},
): string {
  const explicit = project.imageUrl?.trim();
  if (explicit) return explicit;

  const media = (project.media || []).filter((item) => item?.url?.trim());
  const photo = media.find((item) => item.kind === "image");
  if (photo) return photo.url.trim();

  if (options.allowPosterFrame === false) return "";
  const posterFrame = media.find(
    (item) => (item.kind === "video" || item.kind === "embed") && item.posterUrl?.trim(),
  );
  return posterFrame?.posterUrl?.trim() || "";
}

/**
 * The media item a card should mount a player for, once it is established that
 * no still cover exists. Native video is preferred over an embed: it is ours to
 * size and mute, where an embed is an iframe that behaves however its provider
 * decides to.
 */
export function resolveProjectPlayableCover(
  project: Pick<PortfolioProject, "media">,
): PortfolioMedia | undefined {
  const media = (project.media || []).filter((item) => item?.url?.trim());
  return media.find((item) => item.kind === "video") || media.find((item) => item.kind === "embed");
}

/** Return only content that is intentionally visible on a published portfolio. */
export function getPublicPortfolioContent(value: unknown): PortfolioContent {
  const content = mergePortfolioContent(value);
  const practices = getVisiblePractices(content);
  const visiblePracticeIds = new Set(practices.map((practice) => practice.id));
  /* Items assigned to a hidden practice are hidden with it. Unassigned items
     are shared across the portfolio and stay public. */
  const inVisiblePractice = (item: { practiceId?: string }) => !item.practiceId || visiblePracticeIds.has(item.practiceId);
  return {
    ...content,
    // A hidden profile photo is an account asset, not public portfolio content.
    profileImageUrl: content.showProfileImage ? content.profileImageUrl : "",
    profileImageSourceUrl: "",
    showProfileImage: content.showProfileImage && Boolean(content.profileImageUrl),
    practices,
    projects: content.projects.filter((project) => project.visibility !== "private" && inVisiblePractice(project)),
    services: content.services.filter(inVisiblePractice),
    testimonials: content.testimonials.filter((testimonial) => testimonial.visibility !== "private" && inVisiblePractice(testimonial)),
  };
}

const MAX_INLINE_IMAGE_LENGTH = 7_000_000;
const MAX_TEXT_LENGTH = 5_000;
export const MAX_TAGLINE_LENGTH = 80;
/* HTTPS only. This accepted http:// while every rejection message promised
   HTTPS, and the app's own CSP allows only `https:` for img-src and media-src —
   so an http:// link saved cleanly and then silently failed to load on the
   published page, with nothing to explain why. */
const HTTP_URL = /^https:\/\/[^\s<>]+$/i;
const INLINE_IMAGE = /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
const MANAGED_IMAGE = MANAGED_IMAGE_URL;
const ONBOARDING_INLINE_IMAGE = /^data:image\/(?:png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/i;
const ONBOARDING_HTTPS_IMAGE = /^https:\/\/[^\s<>]+$/i;
const MAX_ONBOARDING_INLINE_IMAGE_BYTES = Math.floor(1.8 * 1024 * 1024);
const MAX_ONBOARDING_IMAGE_URL_LENGTH = 2_517_000;

export function isManagedPortfolioImageUrl(value: unknown): boolean {
  return typeof value === "string" && MANAGED_IMAGE.test(value);
}

/** Any managed asset, including video, audio, and documents. */
export function isManagedPortfolioMediaUrl(value: unknown): boolean {
  return typeof value === "string" && MANAGED_MEDIA_URL.test(value);
}

/* Practice slugs share the /p/[slug]/... namespace with static routes. Next
   resolves a static segment before a dynamic one, so a practice named "work"
   would be silently unreachable behind the case-study route. */
export const RESERVED_PRACTICE_SLUGS = new Set(["work", "about", "contact", "services", "api", "_next", "p"]);

/** Validate the profile image formats accepted during onboarding. */
export function isValidOnboardingAvatarUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value || value.length > MAX_ONBOARDING_IMAGE_URL_LENGTH) return false;
  if (isManagedPortfolioImageUrl(value) || ONBOARDING_HTTPS_IMAGE.test(value)) return true;

  const match = value.match(ONBOARDING_INLINE_IMAGE);
  if (!match) return false;
  const base64 = match[1];
  if (base64.length === 0 || base64.length % 4 !== 0) return false;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const decodedBytes = (base64.length / 4) * 3 - padding;
  return decodedBytes > 0 && decodedBytes <= MAX_ONBOARDING_INLINE_IMAGE_BYTES;
}

function isSafePortfolioUrl(value: unknown): boolean {
  return typeof value === "string" && value.length <= 2_000 && HTTP_URL.test(value);
}

/** Media may be a managed upload, an HTTPS URL, or an embed this app can still
 *  rebuild from its provider allowlist. Embeds are re-parsed rather than
 *  trusted, so a stored URL that no longer resolves to a known provider is
 *  rejected instead of being rendered. */
function validateProjectMedia(media: unknown): string | null {
  if (media === undefined) return null;
  if (!Array.isArray(media) || media.length > MAX_MEDIA_PER_PROJECT) return `Add up to ${MAX_MEDIA_PER_PROJECT} media items per project.`;
  for (const entry of media) {
    if (!entry || typeof entry !== "object") return "Each media item must be valid.";
    const item = entry as Partial<PortfolioMedia>;
    if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 120) return "Each media item needs a valid identifier.";
    if (!isPortfolioMediaKind(item.kind)) return "Media items need a supported type.";
    if (typeof item.alt !== "string" || item.alt.length > 300) return "Media descriptions are too long.";
    if (typeof item.caption !== "string" || item.caption.length > 500) return "Media captions are too long.";
    if (typeof item.url !== "string" || item.url.length > MAX_INLINE_IMAGE_LENGTH) return "Media links are invalid.";
    // A blank entry is a row the owner has not filled in yet.
    if (!item.url) continue;

    if (item.kind === "embed") {
      const parsed = parseEmbedInput(item.url);
      if (!parsed) return "Embeds must come from a supported provider.";
      if (item.provider !== undefined && item.provider !== parsed.provider) return "Embed provider does not match its link.";
      /* `sourceUrl` is the "watch on …" link the renderer shows beside the
         player. Pinning it to the same provider and identifier as the embed
         keeps the two fields from describing different things — otherwise the
         visible link could point somewhere unrelated to what is playing. */
      if (item.sourceUrl) {
        const source = parseEmbedInput(item.sourceUrl);
        if (!source || source.provider !== parsed.provider || source.providerId !== parsed.providerId) {
          return "An embed's source link must point at the same media as the embed.";
        }
      }
    } else if (item.kind === "image") {
      if (!INLINE_IMAGE.test(item.url) && !isManagedPortfolioImageUrl(item.url) && !isSafePortfolioUrl(item.url)) return "Images must be HTTPS URLs or supported uploads.";
    } else if (!isManagedPortfolioMediaUrl(item.url) && !isSafePortfolioUrl(item.url)) {
      return "Video, audio, and documents must be uploads or HTTPS URLs.";
    }

    if (item.posterUrl && !isManagedPortfolioImageUrl(item.posterUrl) && !isSafePortfolioUrl(item.posterUrl) && !INLINE_IMAGE.test(item.posterUrl)) return "Media covers must be HTTPS URLs or supported uploads.";
    if (item.sourceUrl && !isSafePortfolioUrl(item.sourceUrl)) return "Media source links must use HTTPS URLs.";
    if (item.provider !== undefined && !Object.prototype.hasOwnProperty.call(EMBED_PROVIDERS, String(item.provider))) return "Media provider is not supported.";
    if (item.durationSeconds !== undefined && (typeof item.durationSeconds !== "number" || !Number.isFinite(item.durationSeconds) || item.durationSeconds < 0 || item.durationSeconds > 86_400)) return "Media duration is invalid.";
    if (item.peaks !== undefined && (!Array.isArray(item.peaks) || item.peaks.length > 400 || item.peaks.some((peak) => typeof peak !== "number" || !Number.isFinite(peak) || peak < 0 || peak > 1))) return "Audio waveform data is invalid.";
    if (item.aspectRatio !== undefined && (typeof item.aspectRatio !== "number" || !Number.isFinite(item.aspectRatio) || item.aspectRatio <= 0 || item.aspectRatio > 10)) return "Media aspect ratio is invalid.";
    if (item.embedHeight !== undefined && (typeof item.embedHeight !== "number" || !Number.isFinite(item.embedHeight) || item.embedHeight < 60 || item.embedHeight > 1_200)) return "Embed height is invalid.";
  }
  return null;
}

/** A practice the owner added but has not filled in yet. Saving a draft must
 *  not fail on one, the same way a blank media row does not block a save. */
function isUnstartedPractice(practice: Partial<PortfolioPractice>): boolean {
  return !String(practice.name ?? "").trim() && !String(practice.slug ?? "").trim();
}

function validatePractices(practices: unknown): string | null {
  if (practices === undefined) return null;
  if (!Array.isArray(practices) || practices.length > 8) return "Add up to 8 practices.";
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  for (const entry of practices) {
    if (!entry || typeof entry !== "object") return "Each practice must be valid.";
    const practice = entry as Partial<PortfolioPractice>;
    if (typeof practice.id !== "string" || !practice.id.trim() || practice.id.length > 120) return "Each practice needs a valid identifier.";
    if (seenIds.has(practice.id)) return "Practice identifiers must be unique.";
    seenIds.add(practice.id);
    if (practice.name !== undefined && (typeof practice.name !== "string" || practice.name.length > 80)) return "Practice names must be under 80 characters.";
    for (const field of ["tagline", "description"] as const) {
      const fieldValue = practice[field];
      if (fieldValue !== undefined && (typeof fieldValue !== "string" || fieldValue.length > MAX_TEXT_LENGTH)) return `Practice ${field} is too long.`;
    }
    if (practice.accent !== undefined && (typeof practice.accent !== "string" || !/^#[0-9a-f]{6}$/i.test(practice.accent))) return "Practice accent colours must be hex values.";
    if (practice.visibility !== undefined && practice.visibility !== "public" && practice.visibility !== "private") return "Practice visibility is invalid.";

    // Address rules apply once the practice has been given an identity. An
    // untouched one stays saveable and simply never renders publicly.
    if (isUnstartedPractice(practice)) continue;
    const slug = normalizeSlug(typeof practice.slug === "string" && practice.slug ? practice.slug : String(practice.name ?? ""));
    if (!slug) return "Each practice needs a usable web address.";
    if (RESERVED_PRACTICE_SLUGS.has(slug)) return `"${slug}" is reserved. Choose a different practice name or address.`;
    if (seenSlugs.has(slug)) return "Practice web addresses must be unique.";
    seenSlugs.add(slug);
  }
  return null;
}

function validateMediaSettings(settings: unknown): string | null {
  if (settings === undefined) return null;
  if (!settings || typeof settings !== "object") return "Media settings must be an object.";
  const input = settings as Partial<PortfolioMediaSettings>;
  for (const flag of ["autoplayOnScroll", "loop", "hoverPreview", "lightbox", "showCaptions"] as const) {
    if (input[flag] !== undefined && typeof input[flag] !== "boolean") return `Media setting ${flag} must be true or false.`;
  }
  if (input.layout !== undefined && !["grid", "masonry", "carousel"].includes(input.layout)) return "Media layout is invalid.";
  if (input.fit !== undefined && input.fit !== "cover" && input.fit !== "contain") return "Media fit is invalid.";
  return null;
}

/** Validate all user-controlled portfolio URLs and inline uploads on the server. */
export function validatePortfolioContent(value: unknown): string | null {
  if (!value || typeof value !== "object") return "Portfolio content must be an object.";
  const input = value as Partial<PortfolioContent>;
  if (input.showProfileImage !== undefined && typeof input.showProfileImage !== "boolean") return "Profile photo display preference is invalid.";
  if (input.profileImageUrl) {
    if (typeof input.profileImageUrl !== "string" || input.profileImageUrl.length > MAX_INLINE_IMAGE_LENGTH) return "Profile image is too large.";
    if (!INLINE_IMAGE.test(input.profileImageUrl) && !isManagedPortfolioImageUrl(input.profileImageUrl) && !isSafePortfolioUrl(input.profileImageUrl)) return "Profile image must be an HTTPS URL or supported image upload.";
  }
  if (input.profileImageSourceUrl) {
    if (typeof input.profileImageSourceUrl !== "string" || input.profileImageSourceUrl.length > MAX_INLINE_IMAGE_LENGTH) return "Original profile image is too large.";
    if (!INLINE_IMAGE.test(input.profileImageSourceUrl) && !isManagedPortfolioImageUrl(input.profileImageSourceUrl) && !isSafePortfolioUrl(input.profileImageSourceUrl)) return "Original profile image must be an HTTPS URL or supported image upload.";
  }
  if (input.projects !== undefined) {
    if (!Array.isArray(input.projects) || input.projects.length > 30) return "Add up to 30 projects.";
    for (const project of input.projects) {
      if (!project || typeof project !== "object") return "Each project must be valid.";
      const item = project as Partial<PortfolioProject>;
      if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 120) return "Each project needs a valid identifier.";
      for (const field of ["title", "description", "role", "year", "client", "timeline", "challenge", "solution", "outcome"] as const) {
        const fieldValue = item[field];
        if (fieldValue !== undefined && (typeof fieldValue !== "string" || fieldValue.length > MAX_TEXT_LENGTH)) return `Project ${field} is too long.`;
      }
      if (item.imageUrl) {
        if (typeof item.imageUrl !== "string" || item.imageUrl.length > MAX_INLINE_IMAGE_LENGTH) return "Project images are too large.";
        if (!INLINE_IMAGE.test(item.imageUrl) && !isManagedPortfolioImageUrl(item.imageUrl) && !isSafePortfolioUrl(item.imageUrl)) return "Project images must be HTTPS URLs or supported image uploads.";
      }
      if (item.url && !isSafePortfolioUrl(item.url)) return "Project links must use HTTPS URLs.";
      if (item.tools && (!Array.isArray(item.tools) || item.tools.length > 30 || item.tools.some((tool) => typeof tool !== "string" || tool.length > 80))) return "Project tools are invalid.";
      if (item.deliverables && (!Array.isArray(item.deliverables) || item.deliverables.length > 30 || item.deliverables.some((deliverable) => typeof deliverable !== "string" || deliverable.length > 120))) return "Project deliverables are invalid.";
      if (item.gallery) {
        if (!Array.isArray(item.gallery) || item.gallery.length > MAX_MEDIA_PER_PROJECT) return `Add up to ${MAX_MEDIA_PER_PROJECT} gallery images per project.`;
        for (const image of item.gallery) {
          if (!image || typeof image !== "object" || typeof image.id !== "string" || image.id.length > 120) return "Gallery images are invalid.";
          if (typeof image.url !== "string" || image.url.length > MAX_INLINE_IMAGE_LENGTH) return "Gallery images must be HTTPS URLs or supported image uploads.";
          // A blank row is a gallery entry the owner has not filled in yet.
          if (image.url && !INLINE_IMAGE.test(image.url) && !isManagedPortfolioImageUrl(image.url) && !isSafePortfolioUrl(image.url)) return "Gallery images must be HTTPS URLs or supported image uploads.";
          if (typeof image.alt !== "string" || image.alt.length > 300 || typeof image.caption !== "string" || image.caption.length > 500) return "Gallery image details are too long.";
        }
      }
      const mediaError = validateProjectMedia(item.media);
      if (mediaError) return mediaError;
    }
  }
  const practiceError = validatePractices(input.practices);
  if (practiceError) return practiceError;
  if (input.practiceLayout !== undefined && input.practiceLayout !== "unified" && input.practiceLayout !== "separate") {
    return "Portfolio practice layout is invalid.";
  }
  const mediaSettingsError = validateMediaSettings(input.mediaSettings);
  if (mediaSettingsError) return mediaSettingsError;
  const practiceIds = Array.isArray(input.practices)
    ? new Set(input.practices.filter((practice): practice is PortfolioPractice => Boolean(practice && typeof practice === "object" && typeof practice.id === "string")).map((practice) => practice.id))
    : new Set<string>();
  for (const group of [input.projects, input.services, input.testimonials]) {
    if (!Array.isArray(group)) continue;
    for (const item of group) {
      const practiceId = (item as { practiceId?: unknown })?.practiceId;
      if (practiceId === undefined || practiceId === "") continue;
      if (typeof practiceId !== "string" || !practiceIds.has(practiceId)) return "Items must belong to a practice in this portfolio.";
    }
  }
  if (input.social !== undefined) {
    if (!Array.isArray(input.social) || input.social.length > 12) return "Add up to 12 social links.";
    for (const social of input.social) {
      if (!social || typeof social !== "object" || !isSafePortfolioUrl((social as { url?: unknown }).url)) return "Social links must use HTTPS URLs.";
    }
  }
  const projectIds = Array.isArray(input.projects)
    ? new Set(input.projects.filter((project): project is PortfolioProject => Boolean(project && typeof project === "object" && typeof project.id === "string")).map((project) => project.id))
    : null;
  if (input.testimonials !== undefined) {
    if (!Array.isArray(input.testimonials) || input.testimonials.length > 20) return "Add up to 20 testimonials.";
    for (const testimonial of input.testimonials) {
      if (!testimonial || typeof testimonial !== "object") return "Each testimonial must be valid.";
      const item = testimonial as Partial<PortfolioTestimonial>;
      if (typeof item.id !== "string" || !item.id.trim() || item.id.length > 120) return "Each testimonial needs a valid identifier.";
      if (typeof item.quote !== "string" || !item.quote.trim() || item.quote.length > 2_000) return "Testimonials need a quote under 2,000 characters.";
      if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 160) return "Testimonials need the client or person’s name.";
      for (const field of ["company", "role", "source"] as const) {
        const fieldValue = item[field];
        if (fieldValue !== undefined && (typeof fieldValue !== "string" || fieldValue.length > 240)) return `Testimonial ${field} is too long.`;
      }
      if (item.projectId !== undefined && (typeof item.projectId !== "string" || item.projectId.length > 120)) return "Testimonial project links are invalid.";
      if (item.projectId && projectIds && !projectIds.has(item.projectId)) return "Testimonial project links must reference a project in this portfolio.";
      if (item.visibility !== undefined && item.visibility !== "public" && item.visibility !== "private") return "Testimonial visibility is invalid.";
    }
  }
  if (input.contactEmail !== undefined && (typeof input.contactEmail !== "string" || input.contactEmail.length > 320 || (input.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)))) return "Enter a valid contact email.";
  /* A short, uppercased, letter-spaced line in the hero. Capped tightly because
     the constraint here is the layout, not storage — a paragraph in this slot
     wraps over the headline on every template. */
  if (input.tagline !== undefined && (typeof input.tagline !== "string" || input.tagline.length > MAX_TAGLINE_LENGTH)) return `Keep the tagline under ${MAX_TAGLINE_LENGTH} characters.`;
  return null;
}

/** Drafts may be incomplete; publishing needs the small set of fields that
 * makes a public page understandable and contactable. Optional case-study,
 * media, SEO, and social fields remain optional. */
export function validatePortfolioForPublish(value: unknown): string | null {
  const content = mergePortfolioContent(value);
  if (!content.name.trim()) return "Add your display name before publishing.";
  if (!content.headline.trim()) return "Add a headline before publishing.";
  if (!content.bio.trim()) return "Add a short introduction before publishing.";
  if (!content.contactEmail.trim()) return "Add a contact email before publishing.";
  // A half-added practice is fine in a draft, but it would be invisible on the
  // live site, so publishing should say so rather than silently drop it.
  if (content.practices.some((practice) => !practice.name.trim())) {
    return "Name every practice, or remove the empty one, before publishing.";
  }
  return null;
}

export function isPortfolioPublished(status: string): boolean {
  return status === "published";
}
