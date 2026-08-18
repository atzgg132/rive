"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { prepareFinancialChart, type FinancialChartInput } from "@/utils/financialChart";

export type ChartData = FinancialChartInput;

function makeCurrencyFormatter(currency: string, compact: boolean): Intl.NumberFormat | null {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
    });
  } catch {
    return null;
  }
}

function NetIcon({ value }: { value: number }) {
  if (value > 0) return <ArrowUpRight className="h-4 w-4" aria-hidden="true" />;
  if (value < 0) return <ArrowDownRight className="h-4 w-4" aria-hidden="true" />;
  return <Minus className="h-4 w-4" aria-hidden="true" />;
}

export default function AnalyticsCharts({ data, currency = "USD" }: { data: ChartData[]; currency?: string }) {
  const chart = useMemo(() => prepareFinancialChart(data || []), [data]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = chart.points.find((point) => point.key === selectedKey)
    || chart.points.find((point) => point.key === chart.defaultPointKey)
    || null;
  const fullFormatter = useMemo(() => makeCurrencyFormatter(currency, false), [currency]);
  const compactFormatter = useMemo(() => makeCurrencyFormatter(currency, true), [currency]);
  const fullMoney = (value: number) => fullFormatter?.format(value) || `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const compactMoney = (value: number) => compactFormatter?.format(value) || `${currency} ${value.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 })}`;
  const barHeight = (value: number) => value > 0 ? `${Math.max(2, (value / chart.scaleMax) * 100)}%` : "0%";

  if (!chart.points.length) {
    return (
      <section className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 text-center text-sm text-muted-foreground">
        Add a paid invoice or an expense to start the financial overview.
      </section>
    );
  }

  return (
    <section className="w-full rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" aria-labelledby="financial-overview-title">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Last six months</p>
          <h2 id="financial-overview-title" className="mt-1 text-lg font-bold text-foreground">Paid invoices and expenses</h2>
          <p className="mt-1 text-xs text-muted-foreground">Each pair compares fully paid invoice value with expenses logged in that month · {currency}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold" aria-label="Chart legend">
          <span className="inline-flex items-center gap-2 text-blue-700 dark:text-blue-300"><span className="h-2.5 w-2.5 rounded-sm bg-blue-600 dark:bg-blue-400" />Paid invoices</span>
          <span className="inline-flex items-center gap-2 text-rose-700 dark:text-rose-300"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />Expenses</span>
        </div>
      </div>

      {selected ? (
        <div className="mt-5 rounded-xl border border-border bg-background/70 p-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-foreground">{selected.label}</p>
            <p className="text-xs text-muted-foreground">Hover, tap, or focus a month to inspect it</p>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">Paid invoice value</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-blue-700 dark:text-blue-300">{fullMoney(selected.revenue)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Expenses logged</dt><dd className="mt-0.5 text-base font-bold tabular-nums text-rose-700 dark:text-rose-300">{fullMoney(selected.expenses)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Net for the month</dt><dd className={`mt-0.5 inline-flex items-center gap-1 text-base font-bold tabular-nums ${selected.net < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}><NetIcon value={selected.net} />{fullMoney(selected.net)}</dd></div>
          </dl>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto pb-1">
        <div className="grid min-w-[42rem] grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
          <div className="h-64 text-right text-[0.6875rem] tabular-nums text-muted-foreground" aria-hidden="true">
            <div className="flex h-56 flex-col justify-between py-0.5">
              <span>{compactMoney(chart.scaleMax)}</span>
              <span>{compactMoney(chart.scaleMax / 2)}</span>
              <span>{compactMoney(0)}</span>
            </div>
          </div>
          <div className="relative h-64">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-56" aria-hidden="true">
              <span className="absolute inset-x-0 top-0 border-t border-border" />
              <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
              <span className="absolute inset-x-0 bottom-0 border-t border-border" />
            </div>
            <div className="relative grid h-64 grid-cols-6 gap-2">
              {chart.points.map((point) => {
                const active = point.key === (selected?.key || chart.defaultPointKey);
                return (
                  <button
                    type="button"
                    key={point.key}
                    aria-label={`${point.label}: ${fullMoney(point.revenue)} paid invoice value, ${fullMoney(point.expenses)} expenses, ${fullMoney(point.net)} net`}
                    aria-pressed={active}
                    className={`group flex h-64 min-w-0 flex-col rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary/[0.045]" : "hover:bg-muted/45"}`}
                    onPointerEnter={() => setSelectedKey(point.key)}
                    onFocus={() => setSelectedKey(point.key)}
                    onClick={() => setSelectedKey(point.key)}
                  >
                    <span className="flex h-56 w-full items-end justify-center gap-1.5" aria-hidden="true">
                      <span className="w-4 rounded-t bg-blue-600 dark:bg-blue-400" style={{ height: barHeight(point.revenue) }} />
                      <span className="w-4 rounded-t bg-rose-500" style={{ height: barHeight(point.expenses) }} />
                    </span>
                    <span className={`flex h-8 items-end justify-center pb-0.5 text-xs font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>{point.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!chart.hasActivity ? <p className="mt-3 rounded-xl bg-muted/55 px-4 py-3 text-sm text-muted-foreground">No paid invoices or expenses fall inside this six-month window yet.</p> : null}

      <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
        <div className="flex items-center justify-between gap-3 sm:block"><dt className="text-xs text-muted-foreground">Six-month paid invoices</dt><dd className="font-bold tabular-nums text-foreground sm:mt-1">{fullMoney(chart.totals.revenue)}</dd></div>
        <div className="flex items-center justify-between gap-3 sm:block"><dt className="text-xs text-muted-foreground">Six-month expenses</dt><dd className="font-bold tabular-nums text-foreground sm:mt-1">{fullMoney(chart.totals.expenses)}</dd></div>
        <div className="flex items-center justify-between gap-3 sm:block"><dt className="text-xs text-muted-foreground">Six-month net</dt><dd className={`font-bold tabular-nums sm:mt-1 ${chart.totals.net < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>{fullMoney(chart.totals.net)}</dd></div>
      </dl>
    </section>
  );
}
