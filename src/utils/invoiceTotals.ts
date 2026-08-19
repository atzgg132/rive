/**
 * One definition of what an invoice is worth, shared by the Overview tiles and
 * the revenue workspace.
 *
 * The two screens each carried their own rule and agreed on every invoice
 * except the one case where the rules differ: a partly paid one. The Overview
 * summed gross invoice value, so an invoice with money already banked against
 * it was reported in full as still needing attention — the same rupees counted
 * once as collected revenue and again as money to chase, two clicks apart under
 * the same word.
 *
 * The rule these figures are built from: money already received is
 * `collected`, money still owed is `outstanding`, and gross invoice value is
 * only ever the sum of the pair.
 */

/** Statuses where the client has actually been billed. A draft has not been. */
export const ISSUED_STATUSES = ["sent", "viewed", "overdue", "partially_paid", "paid"] as const;

/**
 * Issued invoices that can still be collected on. `partially_paid` belongs
 * here: the lifecycle refresh only rewrites it to `overdue` when someone loads
 * a screen that calls it, so a rule that omits it silently drops real invoices
 * depending on which page was opened last.
 */
export const OPEN_STATUSES = ["sent", "viewed", "overdue", "partially_paid"] as const;

const ISSUED: ReadonlySet<string> = new Set(ISSUED_STATUSES);
const OPEN: ReadonlySet<string> = new Set(OPEN_STATUSES);

export function isIssuedStatus(status: string): boolean {
  return ISSUED.has(status);
}

export function isOpenStatus(status: string): boolean {
  return OPEN.has(status);
}

/**
 * Money received. Clamped at both ends so a negative or overlarge
 * `amountPaid` cannot invent revenue or a negative balance.
 *
 * Callers holding a pre-summed group rather than single invoices may pass the
 * group's totals: the payment route refuses a payment above the outstanding
 * balance, so `amountPaid <= total` holds per invoice and therefore across any
 * sum of them.
 */
export function collectedAmount(total: number, amountPaid: number): number {
  return Math.min(Math.max(amountPaid, 0), Math.max(total, 0));
}

/** Money still owed — what "outstanding" and "overdue" both mean. */
export function outstandingAmount(total: number, amountPaid: number): number {
  return Math.max(Math.max(total, 0) - collectedAmount(total, amountPaid), 0);
}

/**
 * Whether an invoice is past due, judged on the due date rather than on the
 * status string. An invoice is overdue because its date passed, not because a
 * background refresh has got around to relabelling it yet.
 */
export function isPastDue(dueDate: Date | string | null | undefined, now: Date): boolean {
  if (!dueDate) return false;
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  return Number.isFinite(due.getTime()) && due < now;
}
