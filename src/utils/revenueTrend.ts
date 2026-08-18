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
