/**
 * Canonical vocabularies for Rive's workflow records.
 *
 * These were previously declared inline in individual API routes, which let the
 * onboarding importer drift (it wrote a `on_hold` project status the projects
 * API rejects). Migration must validate against exactly the same rules the
 * product enforces, so the sets live here and both sides import them.
 */

// Shared with onboarding (`src/app/api/onboarding/route.ts`) and Settings'
// profile section (`src/app/api/settings/profile/route.ts`) — both write
// `User.businessType` / `User.businessTypes` and must accept exactly the
// same values.
export const BUSINESS_TYPES = ["freelancer", "contractor", "studio", "consultant", "creator", "small_business"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const PROJECT_STATUSES = ["active", "paused", "completed", "archived"] as const;
export const PROJECT_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
// `partially_paid` and `voided` are written by the payment and void routes but
// were missing here, so migration validation rejected them and the importer
// fell back to "draft" — a voided invoice came back across as an open draft.
export const INVOICE_STATUSES = ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "voided", "cancelled"] as const;
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

// Invoice reminder schedule presets (#66 PR 2). Order is the send order:
// one pre-due nudge, then three post-due follow-ups. `InvoiceProfile.reminderSchedule`
// and `sendDueInvoiceReminders` (src/utils/invoiceReminders.ts) both validate
// against this set so a stored step can never drift from what the sender understands.
export const INVOICE_REMINDER_STEPS = ["due_minus_3", "due_plus_1", "due_plus_7", "due_plus_14"] as const;
export const DEFAULT_INVOICE_REMINDER_SCHEDULE: string[] = [...INVOICE_REMINDER_STEPS];
/** Calendar-day offset from the due date for each step; negative is before due. */
export const INVOICE_REMINDER_STEP_OFFSET_DAYS: Record<(typeof INVOICE_REMINDER_STEPS)[number], number> = {
  due_minus_3: -3,
  due_plus_1: 1,
  due_plus_7: 7,
  due_plus_14: 14,
};
/** Per-invoice send ceiling — at most one email per step, at most one step per day. */
export const MAX_INVOICE_REMINDERS_PER_INVOICE = 4;
/** Per-owner daily ceiling across all of their invoices, to bound a single runaway sender. */
export const MAX_INVOICE_REMINDERS_PER_USER_PER_DAY = 50;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type InvoiceReminderStep = (typeof INVOICE_REMINDER_STEPS)[number];

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
export const INVOICE_REMINDER_STEP_SET: ReadonlySet<string> = new Set(INVOICE_REMINDER_STEPS);
