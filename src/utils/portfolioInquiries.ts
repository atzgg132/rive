import { createHash } from "crypto";

/**
 * Validation, abuse limits, and lifecycle rules for portfolio enquiries.
 *
 * Kept free of database and request imports so the rules can be exercised
 * directly. The route composes them; nothing here decides policy on its own.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Rejected before the body is read, let alone parsed. The largest legitimate
 * submission is a 5,000-character message plus four short fields, so this leaves
 * generous headroom while refusing to spend memory on anything absurd.
 */
export const MAX_INQUIRY_BODY_BYTES = 16 * 1024;

export const INQUIRY_FIELD_LIMITS = {
  name: { min: 2, max: 120 },
  email: { max: 320 },
  projectType: { min: 2, max: 120 },
  message: { min: 10, max: 5_000 },
} as const;

export const INQUIRY_STATUSES = ["new", "read", "replied", "archived", "spam"] as const;
export type PortfolioInquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_NOTIFICATION_STATUSES = ["queued", "sent", "failed"] as const;
export type PortfolioInquiryNotificationStatus = (typeof INQUIRY_NOTIFICATION_STATUSES)[number];

export function isInquiryStatus(value: unknown): value is PortfolioInquiryStatus {
  return typeof value === "string" && (INQUIRY_STATUSES as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------------- */
/* Submission validation                                                     */
/* ------------------------------------------------------------------------- */

export type InquirySubmission = {
  name: string;
  email: string;
  projectType: string;
  message: string;
  sourceProjectId: string | null;
};

export type InquiryValidation =
  | { ok: true; value: InquirySubmission }
  | { ok: false; reason: "honeypot" }
  | { ok: false; reason: "invalid" };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A honeypot hit is reported separately from a validation failure because the
 * two must behave differently: an obvious bot gets a cheerful 200 and no record
 * at all, while a real person gets told which field to fix.
 */
export function validateInquirySubmission(body: unknown): InquiryValidation {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  // Hidden field no human sees. Anything in it means a form filler.
  if (text(input.website)) return { ok: false, reason: "honeypot" };

  const name = text(input.name);
  const email = text(input.email).toLowerCase();
  const projectType = text(input.projectType);
  const message = text(input.message);
  const sourceProjectId = text(input.sourceProjectId);

  if (
    name.length < INQUIRY_FIELD_LIMITS.name.min ||
    name.length > INQUIRY_FIELD_LIMITS.name.max ||
    !EMAIL_PATTERN.test(email) ||
    email.length > INQUIRY_FIELD_LIMITS.email.max ||
    projectType.length < INQUIRY_FIELD_LIMITS.projectType.min ||
    projectType.length > INQUIRY_FIELD_LIMITS.projectType.max ||
    message.length < INQUIRY_FIELD_LIMITS.message.min ||
    message.length > INQUIRY_FIELD_LIMITS.message.max
  ) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    value: {
      name,
      email,
      projectType,
      message,
      // Attribution only. An unknown identifier is stored as-is and simply
      // resolves to no project later, which is also what happens after a
      // project is deleted.
      sourceProjectId: sourceProjectId && sourceProjectId.length <= 120 ? sourceProjectId : null,
    },
  };
}

/* ------------------------------------------------------------------------- */
/* Abuse limits                                                              */
/* ------------------------------------------------------------------------- */

const HOUR_MS = 60 * 60 * 1000;

/**
 * Five overlapping windows, because each one alone has a hole:
 *
 * - visitor+portfolio stops one person hammering one owner
 * - sender+portfolio stops the same address rotating through proxies
 * - portfolio caps how much mail any single owner can be sent, whatever the
 *   sender looks like — the limit that actually protects the recipient
 * - global caps what the whole surface can emit during a distributed run
 * - fingerprint catches identical payloads sprayed across addresses and hosts
 *
 * All durable and counted in Postgres, so they hold across restarts and any
 * number of instances.
 */
export const INQUIRY_RATE_LIMITS = {
  visitor: { limit: 4, windowMs: HOUR_MS },
  sender: { limit: 3, windowMs: HOUR_MS },
  portfolio: { limit: 20, windowMs: HOUR_MS },
  global: { limit: 200, windowMs: HOUR_MS },
  fingerprint: { limit: 2, windowMs: HOUR_MS },
} as const;

export type InquiryRateLimitScope = keyof typeof INQUIRY_RATE_LIMITS;

/**
 * Every key component that could identify a person is hashed by the caller
 * before it reaches here, so the rate-limit table never holds an address, an
 * email, or a message body.
 */
export function inquiryRateLimitKey(scope: InquiryRateLimitScope, ...parts: string[]): string {
  return ["portfolio-inquiry", scope, ...parts].join(":");
}

/**
 * A stable digest of what was submitted, used to spot the same message being
 * replayed with a different sender or from a different address. Normalized so
 * trivial whitespace and casing edits do not produce a fresh fingerprint.
 *
 * Fields are joined on NUL because normalization has already collapsed every
 * run of whitespace: a printable separator would let a sender straddle the
 * boundary and mint a different fingerprint for the same message.
 */
export function inquiryPayloadFingerprint(input: {
  slug: string;
  projectType: string;
  message: string;
}): string {
  const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256")
    .update(`${input.slug}\0${normalize(input.projectType)}\0${normalize(input.message)}`)
    .digest("hex");
}

/* ------------------------------------------------------------------------- */
/* Lifecycle                                                                 */
/* ------------------------------------------------------------------------- */

export type InquiryStatusTransition = {
  status: PortfolioInquiryStatus;
  readAt?: Date | null;
  repliedAt?: Date | null;
  archivedAt?: Date | null;
};

/**
 * Resolves an owner action into the exact field changes it implies.
 *
 * Timestamps are set on first entry and left alone afterwards, so re-reading a
 * message does not keep moving its "read" time, and un-archiving does not erase
 * the fact that a reply was sent.
 */
export function inquiryStatusTransition(
  action: "read" | "unread" | "replied" | "archived" | "spam" | "restore",
  current: { status: string; readAt: Date | null; repliedAt: Date | null },
  now: Date = new Date(),
): InquiryStatusTransition {
  switch (action) {
    case "read":
      return { status: "read", readAt: current.readAt ?? now };
    case "unread":
      // Deliberately clears the read timestamp: the owner is asserting they have
      // not dealt with this yet, and the unread badge has to agree with them.
      return { status: "new", readAt: null };
    case "replied":
      return { status: "replied", readAt: current.readAt ?? now, repliedAt: current.repliedAt ?? now };
    case "archived":
      return { status: "archived", readAt: current.readAt ?? now, archivedAt: now };
    case "spam":
      return { status: "spam", readAt: current.readAt ?? now, archivedAt: now };
    case "restore":
      // Back to the inbox at the furthest point it had genuinely reached.
      return {
        status: current.repliedAt ? "replied" : current.readAt ? "read" : "new",
        archivedAt: null,
      };
  }
}

/* ------------------------------------------------------------------------- */
/* Owner-facing shape                                                        */
/* ------------------------------------------------------------------------- */

export type PortfolioInquirySummary = {
  id: string;
  name: string;
  email: string;
  projectType: string;
  /** Trimmed for the list; the detail view returns the whole message. */
  excerpt: string;
  status: PortfolioInquiryStatus;
  notificationStatus: PortfolioInquiryNotificationStatus;
  createdAt: string;
  readAt: string | null;
  repliedAt: string | null;
};

export type PortfolioInquiryDetail = PortfolioInquirySummary & {
  message: string;
  notificationError: string | null;
  sourceProjectId: string | null;
  sourceProjectTitle: string | null;
  referrer: string | null;
  deviceType: string | null;
};

export const INQUIRY_EXCERPT_LENGTH = 180;

export function inquiryExcerpt(message: string): string {
  const collapsed = message.replace(/\s+/g, " ").trim();
  return collapsed.length > INQUIRY_EXCERPT_LENGTH
    ? `${collapsed.slice(0, INQUIRY_EXCERPT_LENGTH - 1)}…`
    : collapsed;
}

export const INQUIRY_PAGE_SIZE = 20;
export const INQUIRY_MAX_PAGE_SIZE = 50;

export function parseInquiryPageSize(value: string | null | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed) || parsed < 1) return INQUIRY_PAGE_SIZE;
  return Math.min(parsed, INQUIRY_MAX_PAGE_SIZE);
}
