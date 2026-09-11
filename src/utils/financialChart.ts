export type FinancialChartInput = {
  month: string;
  period?: string;
  revenue: number;
  expenses: number;
};

export type FinancialChartPoint = {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  net: number;
};

export type FinancialChart = {
  points: FinancialChartPoint[];
  scaleMax: number;
  /**
   * Readable ceilings for the diverging net bars: `up` is the headroom above
   * the zero baseline, `down` below it. Either is 0 when no month nets that
   * way, so an all-positive chart keeps its baseline on the bottom edge.
   */
  netExtent: { up: number; down: number };
  /** Fraction of the bar track sitting above the zero baseline. */
  baselineShare: number;
  totals: { revenue: number; expenses: number; net: number };
  defaultPointKey: string | null;
  hasActivity: boolean;
};

/**
 * Month-to-date set against the same days of the month before it — comparing
 * "September so far" to all of August penalises the current month for days
 * that have not happened yet.
 */
export type ChartPace = {
  monthKey: string;
  label: string;
  dayOfMonth: number;
  daysInMonth: number;
  cashIn: number;
  expensesOut: number;
  net: number;
  prior: { cashIn: number; expensesOut: number; net: number };
  priorLabel: string;
};

function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Collapses negative zero to zero.
 *
 * Intl.NumberFormat renders -0 with its sign, so a break-even month printed as
 * "-$0.00". Nothing here can produce -0 today, but the formatting is one
 * subtraction away from it and the guard costs nothing.
 */
function normalizeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/** A readable ceiling that keeps the tallest bar below the very top edge. */
export function financialChartScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

export function prepareFinancialChart(data: FinancialChartInput[]): FinancialChart {
  const points = data.map((row, index) => {
    const revenue = nonNegativeFinite(Number(row.revenue));
    const expenses = nonNegativeFinite(Number(row.expenses));
    return {
      key: row.period || `${row.month}-${index}`,
      label: row.month || row.period || `Period ${index + 1}`,
      revenue,
      expenses,
      net: normalizeZero(revenue - expenses),
    };
  });

  const totals = points.reduce(
    (sum, point) => ({
      revenue: sum.revenue + point.revenue,
      expenses: sum.expenses + point.expenses,
      net: normalizeZero(sum.net + point.net),
    }),
    { revenue: 0, expenses: 0, net: 0 },
  );
  const lastActive = points.findLast((point) => point.revenue > 0 || point.expenses > 0);
  const largestValue = points.reduce((largest, point) => Math.max(largest, point.revenue, point.expenses), 0);
  const maxPositiveNet = points.reduce((largest, point) => Math.max(largest, point.net), 0);
  const maxNegativeNet = points.reduce((largest, point) => Math.max(largest, -point.net), 0);
  const up = maxPositiveNet > 0 ? financialChartScale(maxPositiveNet) : 0;
  const down = maxNegativeNet > 0 ? financialChartScale(maxNegativeNet) : 0;

  return {
    points,
    scaleMax: financialChartScale(largestValue),
    netExtent: { up, down },
    baselineShare: up + down > 0 ? up / (up + down) : 1,
    totals,
    defaultPointKey: lastActive?.key || points.at(-1)?.key || null,
    hasActivity: largestValue > 0,
  };
}
