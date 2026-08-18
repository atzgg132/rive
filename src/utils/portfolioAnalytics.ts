import { createHash } from "crypto";

const FIRST_PARTY_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/**
 * Portfolio analytics should report acquisition sources, not navigation inside
 * Rive. Keep only the external origin so paths from a portfolio or case study
 * cannot appear as separate "sources".
 */
export function normalizePortfolioReferrer(value: string | null | undefined): string | null {
  const input = value?.trim();
  if (!input) return null;

  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
    if (FIRST_PARTY_HOSTS.has(hostname) || hostname === "rive.work" || hostname.endsWith(".rive.work")) return null;

    return url.origin;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------- */
/* View attribution                                                          */
/* ------------------------------------------------------------------------- */

export const PORTFOLIO_VIEW_PAGE_TYPES = ["portfolio", "project"] as const;
export type PortfolioViewPageType = (typeof PORTFOLIO_VIEW_PAGE_TYPES)[number];

/**
 * A reload, a back-navigation, and the public JSON read that can follow a page
 * render are all the same visit. Collapsing repeats from one visitor on one
 * page inside this window keeps "views" a number an owner can reason about,
 * without pretending to track sessions.
 */
export const PORTFOLIO_VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000;

/**
 * Deliberately a short, boring list of self-identifying automated clients:
 * crawlers, link unfurlers, headless browsers, and scripted HTTP clients.
 * Nothing here fingerprints a real visitor, and anything that lies about its
 * user agent is out of scope by design — this exists to stop obvious
 * non-humans from being counted as interest in someone's work.
 */
const BOT_USER_AGENT_PATTERN =
  /(bot\b|bots\b|crawler|crawling|spider|scraper|slurp|archiver|monitoring|uptime|pingdom|preview|facebookexternalhit|whatsapp|telegram|discord|slackbot|twitterbot|linkedinbot|embedly|quora link|redditbot|applebot|bingpreview|yandex|baidu|duckduck|ahrefs|semrush|mj12|dotbot|petalbot|headlesschrome|phantomjs|puppeteer|playwright|lighthouse|chrome-lighthouse|gtmetrix|curl\/|wget\/|python-requests|python-urllib|httpie|axios\/|node-fetch|got\/|okhttp|java\/|go-http-client|libwww-perl|guzzle|postmanruntime|insomnia)/i;

export function isKnownBotUserAgent(userAgent: string | null | undefined): boolean {
  const input = userAgent?.trim();
  // An absent user agent is the signature of a scripted client, not a browser.
  if (!input) return true;
  return BOT_USER_AGENT_PATTERN.test(input);
}

/**
 * Tablets are checked before phones on purpose. An iPad reports both "iPad" and
 * a mobile token, so a single combined test silently filed every tablet under
 * "mobile" and made the device split wrong.
 */
export function deviceFromUserAgent(userAgent: string | null | undefined): string {
  const input = userAgent?.trim();
  if (!input) return "unknown";
  if (/ipad|tablet|playbook|silk|kindle|(android(?!.*mobile))/i.test(input)) return "tablet";
  if (/mobile|android|iphone|ipod|phone|blackberry|iemobile|opera mini/i.test(input)) return "mobile";
  return "desktop";
}

function visitorHashSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required to derive portfolio visitor identities in production.");
  }
  return "rive-portfolio-analytics-development-only-salt";
}

/**
 * A per-day, salted, one-way visitor identity. No raw address is ever stored.
 *
 * The salt matters: an unsalted digest of address plus user agent is reversible
 * by brute force, because the IPv4 space is small enough to enumerate. Mixing
 * in the server secret makes the stored value useless to anyone who obtains the
 * table. Rotating the day means an identity cannot be followed across dates,
 * which is also why unique-visitor figures are only ever an estimate.
 */
export function buildPortfolioVisitorHash(input: { ip: string; userAgent: string; at?: Date }): string {
  const day = (input.at ?? new Date()).toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${visitorHashSecret()}:portfolio-visitor:${input.ip}:${input.userAgent}:${day}`)
    .digest("hex");
}

/* ------------------------------------------------------------------------- */
/* Ranges                                                                    */
/* ------------------------------------------------------------------------- */

export const PORTFOLIO_ANALYTICS_RANGES = ["7d", "30d", "90d", "all"] as const;
export type PortfolioAnalyticsRange = (typeof PORTFOLIO_ANALYTICS_RANGES)[number];
export const DEFAULT_PORTFOLIO_ANALYTICS_RANGE: PortfolioAnalyticsRange = "30d";

const RANGE_DAYS: Record<Exclude<PortfolioAnalyticsRange, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** Returns null for a value that was supplied but is not a supported range. */
export function parsePortfolioAnalyticsRange(value: string | null | undefined): PortfolioAnalyticsRange | null {
  const input = value?.trim().toLowerCase();
  if (!input) return DEFAULT_PORTFOLIO_ANALYTICS_RANGE;
  return (PORTFOLIO_ANALYTICS_RANGES as readonly string[]).includes(input)
    ? (input as PortfolioAnalyticsRange)
    : null;
}

export type PortfolioAnalyticsWindow = {
  range: PortfolioAnalyticsRange;
  /** Null for "all": there is no lower bound to apply. */
  since: Date | null;
  until: Date;
  /** Whole days covered, or null when the range is open-ended. */
  days: number | null;
  /** The equally sized window immediately before this one, when one exists. */
  previous: { since: Date; until: Date } | null;
};

/**
 * "all" has no comparable previous period, so it reports no movement rather
 * than inventing a baseline. Every other range compares against the window of
 * the same length directly before it.
 */
export function resolvePortfolioAnalyticsWindow(
  range: PortfolioAnalyticsRange,
  now: Date = new Date(),
): PortfolioAnalyticsWindow {
  const until = new Date(now);
  if (range === "all") return { range, since: null, until, days: null, previous: null };

  const days = RANGE_DAYS[range];
  const spanMs = days * 24 * 60 * 60 * 1000;
  const since = new Date(until.getTime() - spanMs);
  return {
    range,
    since,
    until,
    days,
    previous: { since: new Date(since.getTime() - spanMs), until: since },
  };
}

/** Inclusive list of UTC day keys covering the window, for a gap-free timeline. */
export function portfolioTimelineDays(window: PortfolioAnalyticsWindow, earliest: Date | null): string[] {
  const start = window.since ?? earliest;
  if (!start) return [];
  const first = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const last = Date.UTC(window.until.getUTCFullYear(), window.until.getUTCMonth(), window.until.getUTCDate());
  const days: string[] = [];
  // An unbounded range on an old portfolio could otherwise produce a chart with
  // thousands of columns; past this point the timeline stops being readable.
  const MAX_DAYS = 400;
  for (let day = first; day <= last && days.length < MAX_DAYS; day += 86_400_000) {
    days.push(new Date(day).toISOString().slice(0, 10));
  }
  return days;
}

/* ------------------------------------------------------------------------- */
/* Derived figures                                                           */
/* ------------------------------------------------------------------------- */

/**
 * Percentage movement against the previous period. Null when there is nothing
 * honest to say: no previous period, or a previous total of zero (growth from
 * nothing is not a percentage).
 */
export function percentageChange(current: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Share of project attention, as a percentage of all project views. */
export function attentionShare(views: number, totalProjectViews: number): number {
  if (totalProjectViews <= 0) return 0;
  return Math.round((views / totalProjectViews) * 1000) / 10;
}

export function conversionRate(inquiries: number, views: number): number {
  if (views <= 0) return 0;
  return Math.round((inquiries / views) * 1000) / 10;
}

/**
 * Whether a project is worth flagging as "seen but never enquired about".
 *
 * Guarded so the dashboard only draws that conclusion when the data supports
 * it. A project with three views and no enquiries is not a signal, it is a
 * small number, and telling an owner otherwise would be worse than silence.
 */
export const PROJECT_ATTENTION_MIN_VIEWS = 15;

export function isUnconvertedProject(input: {
  views: number;
  inquiries: number;
  totalInquiries: number;
}): boolean {
  return (
    input.views >= PROJECT_ATTENTION_MIN_VIEWS &&
    input.inquiries === 0 &&
    // With no enquiries anywhere, the absence tells us nothing about this
    // project specifically — the form itself is what is not converting.
    input.totalInquiries > 0
  );
}

/* ------------------------------------------------------------------------- */
/* API contract                                                              */
/* ------------------------------------------------------------------------- */

/**
 * Labels for the figures that are estimates rather than counts, so the dashboard
 * cannot present a privacy-preserving approximation as a hard number.
 */
export const PORTFOLIO_ANALYTICS_ESTIMATE_NOTE =
  "Estimated from salted daily visitor hashes. Rive stores no raw IP addresses and no cross-day identity, so a visitor returning on another day counts again.";

export type PortfolioAnalyticsTotals = {
  views: number;
  /** Estimate. See PORTFOLIO_ANALYTICS_ESTIMATE_NOTE. */
  estimatedVisitors: number;
  portfolioViews: number;
  projectViews: number;
  inquiries: number;
  /** Enquiries per 100 views, as a percentage. */
  conversionRate: number;
};

/** Null wherever a previous period does not exist or would divide by zero. */
export type PortfolioAnalyticsChanges = {
  views: number | null;
  estimatedVisitors: number | null;
  inquiries: number | null;
  /** Percentage-point movement, not a percentage of a percentage. */
  conversionRatePoints: number | null;
};

export type PortfolioAnalyticsProject = {
  projectId: string;
  /** Current title, or a placeholder when the project no longer exists. */
  title: string;
  /** False once the project has been removed from the portfolio content. */
  exists: boolean;
  views: number;
  estimatedVisitors: number;
  attentionShare: number;
  /** Percentage movement against the previous period, when meaningful. */
  change: number | null;
  inquiries: number;
  /** Only true when the view count is high enough to support the claim. */
  unconverted: boolean;
};

export type PortfolioAnalyticsPayload = {
  range: PortfolioAnalyticsRange;
  generatedAt: string;
  window: { since: string | null; until: string; days: number | null; comparable: boolean };
  totals: PortfolioAnalyticsTotals;
  changes: PortfolioAnalyticsChanges;
  timeline: { day: string; views: number }[];
  referrers: { source: string; views: number }[];
  devices: { device: string; views: number }[];
  projects: PortfolioAnalyticsProject[];
  inquiries: {
    /** Everything ever received, independent of the selected range. */
    total: number;
    unread: number;
    inRange: number;
    latestAt: string | null;
    byStatus: Record<string, number>;
    /** Notification deliveries the outbox gave up on. */
    notificationFailures: number;
  };
  estimateNote: string;
};
