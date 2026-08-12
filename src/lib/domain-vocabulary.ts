/**
 * Canonical vocabularies for Rive's workflow records.
 *
 * These were previously declared inline in individual API routes, which let the
 * onboarding importer drift (it wrote a `on_hold` project status the projects
 * API rejects). Migration must validate against exactly the same rules the
 * product enforces, so the sets live here and both sides import them.
 */

export const PROJECT_STATUSES = ["active", "paused", "completed", "archived"] as const;
export const PROJECT_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const INVOICE_STATUSES = ["draft", "sent", "viewed", "paid", "overdue", "cancelled"] as const;
export const CLIENT_STATUSES = ["active", "inactive"] as const;
export const EXPENSE_CATEGORIES = [
  "software",
  "hardware",
  "travel",
  "meals",
  "office",
  "contractor",
  "other",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Field length ceilings enforced by the workflow APIs. */
export const FIELD_LIMITS = {
  clientName: 160,
  clientEmail: 254,
  clientPhone: 80,
  clientCompany: 160,
  clientWebsite: 500,
  clientAddress: 1_000,
  clientNotes: 2_000,
  projectTitle: 200,
  projectDescription: 2_000,
  invoiceNumber: 80,
  invoiceNotes: 2_000,
  expenseDescription: 500,
  expenseCategory: 80,
  tagsPerRecord: 20,
} as const;

/** Monetary ceiling implied by the schema's `Decimal(12, 2)` columns. */
export const MAX_MONETARY_VALUE = 9_999_999_999.99;

export const PROJECT_STATUS_SET: ReadonlySet<string> = new Set(PROJECT_STATUSES);
export const PROJECT_PRIORITY_SET: ReadonlySet<string> = new Set(PROJECT_PRIORITIES);
export const INVOICE_STATUS_SET: ReadonlySet<string> = new Set(INVOICE_STATUSES);
export const CLIENT_STATUS_SET: ReadonlySet<string> = new Set(CLIENT_STATUSES);
export const EXPENSE_CATEGORY_SET: ReadonlySet<string> = new Set(EXPENSE_CATEGORIES);
