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
  totals: { revenue: number; expenses: number; net: number };
  defaultPointKey: string | null;
  hasActivity: boolean;
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

  return {
    points,
    scaleMax: financialChartScale(largestValue),
    totals,
    defaultPointKey: lastActive?.key || points.at(-1)?.key || null,
    hasActivity: largestValue > 0,
  };
}
