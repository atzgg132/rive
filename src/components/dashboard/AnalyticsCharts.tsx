"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { prepareFinancialChart, type ChartPace, type FinancialChartInput } from "@/utils/financialChart";
import { Kicker } from "@/components/ui";
import { localeForCurrency } from "@/lib/currency";

export type ChartData = FinancialChartInput;

function makeCurrencyFormatter(currency: string, compact: boolean): Intl.NumberFormat | null {
  try {
    return new Intl.NumberFormat(localeForCurrency(currency), {
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
  // A month with no activity is flat, not a loss. The minus glyph sat directly
  // against the amount and read as "-0.00".
  return null;
}

/** Break-even is neither good nor bad, so it gets neither colour. */
function netToneClass(value: number): string {
  if (value < 0) return "text-destructive";
  if (value > 0) return "text-success";
  return "text-muted-foreground";
}

export default function AnalyticsCharts({ data, currency = "USD", pace = null }: { data: ChartData[]; currency?: string; pace?: ChartPace | null }) {
  const chart = useMemo(() => prepareFinancialChart(data || []), [data]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = chart.points.find((point) => point.key === selectedKey)
    || chart.points.find((point) => point.key === chart.defaultPointKey)
    || null;
  const fullFormatter = useMemo(() => makeCurrencyFormatter(currency, false), [currency]);
  const compactFormatter = useMemo(() => makeCurrencyFormatter(currency, true), [currency]);
  const fullMoney = (value: number) => fullFormatter?.format(value) || `${currency} ${value.toLocaleString(localeForCurrency(currency), { maximumFractionDigits: 2 })}`;
  const compactMoney = (value: number) => compactFormatter?.format(value) || `${currency} ${value.toLocaleString(localeForCurrency(currency), { notation: "compact", maximumFractionDigits: 1 })}`;
  const { up, down } = chart.netExtent;
  const baselinePct = chart.baselineShare * 100;
  const netHeight = (value: number) => {
    // A 2px floor keeps a dwarfed month visible instead of rounding to nothing;
    // the exact value still lives in the label and the detail card.
    if (value > 0 && up > 0) return `max(0.125rem, ${(value / up) * baselinePct}%)`;
    if (value < 0 && down > 0) return `max(0.125rem, ${(-value / down) * (100 - baselinePct)}%)`;
    return "0%";
  };

  if (!chart.points.length) {
    return (
      <section className="flex min-h-72 items-center justify-center rounded-none border border-dashed border-border bg-card/60 px-6 text-center text-sm text-muted-foreground">
        Add a paid invoice or an expense to start the financial overview.
      </section>
    );
  }

  const paceDelta = pace ? pace.cashIn - pace.prior.cashIn : 0;

  return (
    <section className="w-full rounded-none border border-border bg-card p-5 sm:p-6" aria-labelledby="financial-overview-title">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <Kicker>Last six months</Kicker>
          <h2 id="financial-overview-title" className="mt-1 text-lg font-bold text-foreground">Net by month</h2>
          <p className="mt-1 text-xs text-muted-foreground">Cash received minus expenses logged, each month · <span className="font-mono">{currency}</span></p>
          {pace ? (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className={`font-bold ${netToneClass(pace.net)}`}>{pace.label} so far: {fullMoney(pace.cashIn)} in · {fullMoney(pace.expensesOut)} out</span>
              {" · "}
              {pace.prior.cashIn > 0 || pace.prior.expensesOut > 0
                ? <>{paceDelta >= 0 ? "ahead of" : "behind"} {pace.priorLabel}&apos;s {fullMoney(pace.prior.cashIn)} by day {pace.dayOfMonth}</>
                : `nothing received in ${pace.priorLabel} by day ${pace.dayOfMonth}`}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold" aria-label="Chart legend">
          <span className="inline-flex items-center gap-2 text-success"><span className="h-2.5 w-2.5 rounded-none bg-success" />Up month</span>
          <span className="inline-flex items-center gap-2 text-destructive"><span className="h-2.5 w-2.5 rounded-none bg-destructive" />Down month</span>
        </div>
      </div>

      {selected ? (
        <div className="mt-5 rounded-none border border-border bg-background/70 p-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-foreground">{selected.label}</p>
            <p className="text-xs text-muted-foreground">Hover, tap, or focus a month to inspect it</p>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            <div><dt className="text-xs text-muted-foreground">Cash received</dt><dd className="mt-0.5 font-mono text-base font-bold tabular-nums text-primary">{fullMoney(selected.revenue)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Expenses logged</dt><dd className="mt-0.5 font-mono text-base font-bold tabular-nums text-destructive">{fullMoney(selected.expenses)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Net for the month</dt><dd className={`mt-0.5 inline-flex items-center gap-1 font-mono text-base font-bold tabular-nums ${netToneClass(selected.net)}`}><NetIcon value={selected.net} />{fullMoney(selected.net)}</dd></div>
          </dl>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto pb-1">
        <div className="grid min-w-[26rem] grid-cols-[4rem_minmax(0,1fr)] gap-3 sm:min-w-[36rem] sm:grid-cols-[5.5rem_minmax(0,1fr)]">
          <div className="relative h-64 text-right font-mono text-[0.6875rem] tabular-nums text-muted-foreground" aria-hidden="true">
            {/* When one direction is crushed near zero, its extent label would
                collide with the $0 label — drop it (the detail card and aria
                labels still carry exact values) and nudge $0 just inside the
                track instead of half-off the edge. */}
            <div className="relative h-56">
              {up > 0 && baselinePct >= 12 ? <span className="absolute right-0 top-0 -translate-y-1/2 pt-2">{compactMoney(up)}</span> : null}
              <span
                className="absolute right-0"
                style={{
                  top: `${baselinePct}%`,
                  transform: baselinePct < 12 ? "translateY(0.2rem)" : baselinePct > 88 ? "translateY(calc(-100% - 0.2rem))" : "translateY(-50%)",
                }}
              >
                {compactMoney(0)}
              </span>
              {down > 0 && baselinePct <= 88 ? <span className="absolute bottom-0 right-0 translate-y-1/2 pb-2">-{compactMoney(down)}</span> : null}
            </div>
          </div>
          <div className="relative h-64">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-56" aria-hidden="true">
              <span className="absolute inset-x-0 top-0 border-t border-border" />
              <span className="absolute inset-x-0 border-t border-foreground/30" style={{ top: `${baselinePct}%` }} />
              {down > 0 ? <span className="absolute inset-x-0 bottom-0 border-t border-border" /> : null}
            </div>
            <div className="relative grid h-64 gap-2" style={{ gridTemplateColumns: `repeat(${chart.points.length}, minmax(0, 1fr))` }}>
              {chart.points.map((point) => {
                const active = point.key === (selected?.key || chart.defaultPointKey);
                const signedNet = `${point.net < 0 ? "-" : point.net > 0 ? "+" : ""}${fullMoney(Math.abs(point.net))}`;
                return (
                  <button
                    type="button"
                    key={point.key}
                    aria-label={`${point.label}: net ${signedNet}, ${fullMoney(point.revenue)} received, ${fullMoney(point.expenses)} expenses`}
                    aria-pressed={active}
                    className={`group flex h-64 min-w-0 flex-col rounded-none px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary/[0.045]" : "hover:bg-muted/[0.45]"}`}
                    onPointerEnter={() => setSelectedKey(point.key)}
                    onFocus={() => setSelectedKey(point.key)}
                    onClick={() => setSelectedKey(point.key)}
                  >
                    <span className="relative h-56 w-full" aria-hidden="true">
                      {point.net > 0 ? (
                        <span
                          className="absolute left-1/2 w-7 max-w-[70%] -translate-x-1/2 bg-success"
                          style={{ bottom: `${100 - baselinePct}%`, height: netHeight(point.net) }}
                        />
                      ) : null}
                      {point.net < 0 ? (
                        <span
                          className="absolute left-1/2 w-7 max-w-[70%] -translate-x-1/2 bg-destructive"
                          style={{ top: `${baselinePct}%`, height: netHeight(point.net) }}
                        />
                      ) : null}
                      {point.net === 0 ? (
                        <span
                          className="absolute left-1/2 h-0.5 w-4 -translate-x-1/2 -translate-y-1/2 bg-border"
                          style={{ top: `${baselinePct}%` }}
                        />
                      ) : null}
                    </span>
                    <span className={`flex h-8 items-end justify-center pb-0.5 text-xs font-semibold ${active ? "text-foreground" : "text-muted-foreground"}`}>{point.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!chart.hasActivity ? <p className="mt-3 rounded-none bg-muted/[0.55] px-4 py-3 text-sm text-muted-foreground">No paid invoices or expenses fall inside this six-month window yet.</p> : null}

      <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
        <div className="flex items-center justify-between gap-3 sm:block"><dt className="text-xs text-muted-foreground">Six-month cash received</dt><dd className="font-mono font-bold tabular-nums text-foreground sm:mt-1">{fullMoney(chart.totals.revenue)}</dd></div>
        <div className="flex items-center justify-between gap-3 sm:block"><dt className="text-xs text-muted-foreground">Six-month expenses</dt><dd className="font-mono font-bold tabular-nums text-foreground sm:mt-1">{fullMoney(chart.totals.expenses)}</dd></div>
        <div className="flex items-center justify-between gap-3 sm:block"><dt className="text-xs text-muted-foreground">Six-month net</dt><dd className={`font-mono font-bold tabular-nums sm:mt-1 ${netToneClass(chart.totals.net)}`}>{fullMoney(chart.totals.net)}</dd></div>
      </dl>
    </section>
  );
}
