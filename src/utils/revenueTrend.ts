/**
 * Monthly invoice activity, as a comparison rather than a list.
 *
 * The chart this replaces drew each bar from `collected / invoiced` while its
 * label read "invoiced" — two different quantities in one row, neither of them
 * labelled as what it was — and clamped the width to a minimum of 8%, so six
 * months of very different sizes rendered as six identical stubs. It also kept
 * one row per currency per month, which meant a "monthly trend" could show July
 * twice, and printed a converted display-currency amount next to the original
 * currency's code, so an INR row read "INR — $12.55".
 *
 * A month is a month. Values are converted once, summed across currencies, and
 * the bar length is that month's share of the largest month, which is the only
 * thing that makes a row worth comparing to the row above it.
 */

export type MonthlyInvoiceRow = {
  /** `YYYY-MM`, as the API returns it. */
  month: string;
  currency: string;
  invoiced: number;
  collected: number;
};

export type MonthlyTrendPoint = {
  month: string;
  label: string;
  /** Display currency. */
  invoiced: number;
  collected: number;
  /** Percentage, one decimal. Null when nothing was invoiced that month. */
  collectionRate: number | null;
  /** The original currencies that were summed into this point. */
  currencies: string[];
  /** 0–1 against the largest month in the window. Drives bar length. */
  share: number;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-03` → `Mar 2026`. Deterministic rather than locale-dependent, so the
 *  label cannot differ between a server render and the browser that hydrates it. */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const index = Number(match[2]) - 1;
  if (index < 0 || index > 11) return month;
  return `${MONTH_NAMES[index]} ${match[1]}`;
}

/**
 * `convert` returns null when a rate is not available yet. A month is only
 * plotted when every one of its rows converted: half a month, silently drawn as
 * a whole one, is worse than an honest "converting…".
 */
export function buildMonthlyTrend(
  rows: MonthlyInvoiceRow[],
  convert: (value: number, currency: string) => number | null,
  months = 6,
): { points: MonthlyTrendPoint[]; complete: boolean } {
  const byMonth = new Map<string, { invoiced: number; collected: number; currencies: Set<string> }>();
  const dropped = new Set<string>();

  for (const row of rows) {
    const invoiced = convert(row.invoiced, row.currency);
    const collected = convert(row.collected, row.currency);
    if (invoiced === null || collected === null) {
      dropped.add(row.month);
      continue;
    }
    const entry = byMonth.get(row.month) || { invoiced: 0, collected: 0, currencies: new Set<string>() };
    entry.invoiced += invoiced;
    entry.collected += collected;
    entry.currencies.add(row.currency);
    byMonth.set(row.month, entry);
  }

  for (const month of dropped) byMonth.delete(month);

  const ordered = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-months);
  const largest = ordered.reduce((max, [, entry]) => Math.max(max, entry.invoiced), 0);

  const points = ordered.map(([month, entry]) => ({
    month,
    label: monthLabel(month),
    invoiced: entry.invoiced,
    collected: entry.collected,
    collectionRate: entry.invoiced > 0 ? Math.round((entry.collected / entry.invoiced) * 1000) / 10 : null,
    currencies: [...entry.currencies].sort(),
    share: largest > 0 ? entry.invoiced / largest : 0,
  }));

  return { points, complete: dropped.size === 0 };
}

/** The shape the monthly cohort needs from an invoice. */
export type CohortInvoice = {
  currency: string;
  total: number;
  amountPaid: number;
  issueDate: Date;
};

/** `YYYY-MM` in UTC, so a month does not shift with the reader's timezone. */
export function monthKeyUtc(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * One row per month and currency, both figures belonging to the same cohort:
 * what was billed that month, and how much of *that* has been paid.
 *
 * This is the rule that was wrong. `invoiced` was keyed by issue date while
 * `collected` was keyed by payment date, so a row held two unrelated
 * quantities — money billed in March beside cash received in March — and their
 * ratio was not a rate at all. It also read zero everywhere in practice,
 * because collection came from payment records while the collection rates in
 * the summary cards came from `amountPaid`; an invoice can be settled without a
 * payment row existing, and the two disagreed.
 *
 * Taking both from the invoice means each month reconciles with the totals
 * shown above it, which is the property the tests pin down.
 */
export function monthlyCohortRows(invoices: CohortInvoice[]): MonthlyInvoiceRow[] {
  const rows = new Map<string, MonthlyInvoiceRow>();

  for (const invoice of invoices) {
    const currency = invoice.currency.toUpperCase();
    const month = monthKeyUtc(invoice.issueDate);
    const key = `${month}:${currency}`;
    // Never more than was billed, never less than nothing: an overpayment or a
    // correction must not push a month past 100% or below zero.
    const paid = Math.min(Math.max(invoice.amountPaid, 0), Math.max(invoice.total, 0));

    const row = rows.get(key) || { month, currency, invoiced: 0, collected: 0 };
    row.invoiced += invoice.total;
    row.collected += paid;
    rows.set(key, row);
  }

  return [...rows.values()].sort((a, b) => a.month.localeCompare(b.month));
}
