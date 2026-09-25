/**
 * Pure domain logic for the Settings page (issue #66, PR 1).
 *
 * Kept dependency-free (no Prisma, no Next) so it can be unit tested directly
 * and imported from both API routes and client components without dragging
 * in server-only modules.
 */

import { BUSINESS_TYPES, type BusinessType } from "@/lib/domain-vocabulary";

/** Same shape the projects/invoices/contracts APIs already validate against — a generic ISO-ish 3-letter code, not the narrower display-currency picker list. */
export function isValidWorkspaceCurrency(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}

/**
 * Resolves the currency a *new* record (invoice, agreement, expense, import
 * row) should default to. A linked project's own currency always wins,
 * since that's the currency the client relationship was already set up in;
 * otherwise the workspace default (`User.currency`) applies.
 */
export function resolveRecordCurrency(input: { projectCurrency?: string | null; workspaceCurrency?: string | null }): string {
  const projectCurrency = input.projectCurrency?.trim().toUpperCase();
  if (projectCurrency && isValidWorkspaceCurrency(projectCurrency)) return projectCurrency;
  const workspaceCurrency = input.workspaceCurrency?.trim().toUpperCase();
  if (workspaceCurrency && isValidWorkspaceCurrency(workspaceCurrency)) return workspaceCurrency;
  return "USD";
}

/** Validates a requested set of business types against the shared vocabulary, deduplicating and rejecting anything unsupported or empty. */
export function validateBusinessTypes(values: unknown): BusinessType[] | null {
  if (!Array.isArray(values) || values.length === 0 || values.length > BUSINESS_TYPES.length) return null;
  const allowed = BUSINESS_TYPES as readonly string[];
  if (values.some((value) => typeof value !== "string" || !allowed.includes(value))) return null;
  const deduped = Array.from(new Set(values as BusinessType[]));
  return deduped.length ? deduped : null;
}

/** Default payment terms, in days, prefilled onto a new invoice's due date from its issue date. Optional — `null`/absent means "no default". */
export function isValidPaymentTermsDays(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 365;
}

/** Adds `days` to an ISO (YYYY-MM-DD) issue date, returning an ISO date string. Used to prefill a new invoice's due date from the workspace's default payment terms. */
export function addDaysToIsoDate(isoDate: string, days: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !Number.isFinite(days)) return null;
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
