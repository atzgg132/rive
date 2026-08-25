/**
 * Shared bot gate for unauthenticated public forms (contact, register,
 * forgot-password). There is no captcha vendor in this repo; these checks are
 * the free substitute: a honeypot field humans never see, plus a minimum
 * time-to-submit so JSON crawlers that POST the instant they load the
 * endpoint are dropped before mail or a user row is created.
 *
 * Failures are reported as distinct reasons so a route can answer the same
 * cheerful success a real submission would, and never teach a filler which
 * check caught it.
 */

export const PUBLIC_FORM_HONEYPOT_FIELD = "website";
export const PUBLIC_FORM_MIN_SUBMIT_MS = 2_000;
export const PUBLIC_FORM_MAX_SUBMIT_MS = 24 * 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;
const QUARTER_HOUR_MS = 15 * 60 * 1000;

/**
 * Durable windows for the three public mail-sending forms. IP and (where the
 * address is known) email are both capped; contact also has a global ceiling
 * because every message lands in the same inbox.
 */
export const PUBLIC_FORM_RATE_LIMITS = {
  contact: {
    global: { limit: 60, windowMs: HOUR_MS },
    ip: { limit: 5, windowMs: HOUR_MS },
    email: { limit: 3, windowMs: HOUR_MS },
  },
  register: {
    ip: { limit: 12, windowMs: HOUR_MS },
    email: { limit: 4, windowMs: 24 * HOUR_MS },
  },
  forgotPassword: {
    ip: { limit: 5, windowMs: QUARTER_HOUR_MS },
    email: { limit: 3, windowMs: QUARTER_HOUR_MS },
  },
} as const;

export type PublicFormGateReason = "honeypot" | "too_fast" | "stale";

export type PublicFormGateResult =
  | { ok: true }
  | { ok: false; reason: PublicFormGateReason };

function parseStartedAt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d{13}$/.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function honeypotValue(body: Record<string, unknown>): string {
  const value = body[PUBLIC_FORM_HONEYPOT_FIELD];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Decide whether a public-form POST is a person sitting with the page or an
 * automated filler. `now` is injectable so the domain tests can freeze time.
 */
export function evaluatePublicFormGate(body: unknown, now = Date.now()): PublicFormGateResult {
  const input = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};

  if (honeypotValue(input)) return { ok: false, reason: "honeypot" };

  const startedAt = parseStartedAt(input.startedAt);
  if (startedAt === null) return { ok: false, reason: "too_fast" };

  const elapsed = now - startedAt;
  if (elapsed < PUBLIC_FORM_MIN_SUBMIT_MS) return { ok: false, reason: "too_fast" };
  if (elapsed > PUBLIC_FORM_MAX_SUBMIT_MS) return { ok: false, reason: "stale" };
  return { ok: true };
}
