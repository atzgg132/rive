"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Plus,
  FileText,
  ChevronRight,
  Activity,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import type { ChartData } from "@/components/dashboard/AnalyticsCharts";
import type { ChartPace } from "@/utils/financialChart";
import type { DashboardSignal } from "@/utils/signals";
import { Badge, Card, EmptyState, MetricCard, Movement, PageHeader } from "@/components/ui";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { ActivationCard } from "@/components/dashboard/ActivationCard";
import { WeeklySummaryOptInCard } from "@/components/dashboard/WeeklySummaryOptInCard";
import type { ActivationPlan } from "@/lib/activation";
import { useFeatureAvailability } from "@/components/FeatureAvailabilityContext";

interface Stats {
  totalPaid: number;
  totalPending: number;
  activeProjects: number;
  totalExpenses: number;
  netEarnings: number;
}

type PeriodKey = "month" | "sixMonths" | "all";

interface PeriodBlock {
  cashIn: number;
  expensesOut: number;
  net: number;
  prior?: { cashIn: number; expensesOut: number; net: number } | null;
  priorLabel?: string;
  dayOfMonth?: number;
}

type Periods = Partial<Record<PeriodKey, PeriodBlock>>;

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "sixMonths", label: "6 months" },
  { key: "all", label: "All time" },
];

interface TopClient {
  id: string;
  name: string;
  company: string;
  avatar_color: string;
  total_revenue: string;
  outstanding?: string;
}

interface Insights {
  collectionRate: number;
  profitMargin: number;
  overdueCount: number;
  overdueAmount: number;
  topExpenseCategory: string | null;
  topExpenseAmount: number;
  upcomingProjects: { id: string; title: string; dueDate: string | null }[];
}

interface CurrencyMeta {
  displayCurrency: string;
  ratesAsOf: string | null;
  conversionAvailable: boolean;
}

const metricsGridClassName =
  "grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-4";

const insightCardClassName =
  "flex min-h-28 h-full flex-col rounded-none border border-border bg-card p-4 text-card-foreground transition-[border-color,box-shadow,transform]";

const AnalyticsCharts = dynamic(() => import("@/components/dashboard/AnalyticsCharts"), {
  loading: () => <div className="h-[380px] animate-pulse rounded-none border border-border bg-card" />,
});

export default function DashboardOverview() {
  const { displayCurrency, format } = useCurrency();
  const { engagementFlow } = useFeatureAvailability();
  const [stats, setStats] = useState<Stats>({
    totalPaid: 0,
    totalPending: 0,
    activeProjects: 0,
    totalExpenses: 0,
    netEarnings: 0
  });
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [signals, setSignals] = useState<DashboardSignal[]>([]);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [periods, setPeriods] = useState<Periods | null>(null);
  const [chartPace, setChartPace] = useState<ChartPace | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [activation, setActivation] = useState<ActivationPlan | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [currencyMeta, setCurrencyMeta] = useState<CurrencyMeta | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setLoadError("");
      try {
        const res = await fetch("/api/workflow/dashboard");
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.message || "Could not load dashboard data.");
        setStats(data.stats);
        setTopClients(data.topClients || []);
        setSignals(data.signals || []);
        setPeriods(data.periods || null);
        setChartPace(data.chartPace || null);
        setChartData(data.chartData || []);
        setActivation(data.activation || null);
        setInsights(data.insights || null);
        setCurrencyMeta(data.currency || null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not load dashboard data.";
        console.error("Failed to load dashboard data:", err);
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [displayCurrency, reloadKey]);

  useEffect(() => {
    const onGuidanceChanged = (event: Event) => {
      const status = (event as CustomEvent<{ status?: string }>).detail?.status;
      if (status !== "dismissed" && status !== "completed") return;
      setActivation((current) => current ? {
        ...current,
        guidanceDismissed: status === "dismissed" ? true : current.guidanceDismissed,
        guidanceCompleted: status === "completed" ? true : current.guidanceCompleted,
        automaticGuidanceStatus: status,
      } : current);
    };
    window.addEventListener("rive:guidance-changed", onGuidanceChanged);
    return () => window.removeEventListener("rive:guidance-changed", onGuidanceChanged);
  }, []);

  const dashboardCurrency = currencyMeta?.displayCurrency || displayCurrency;
  const formatCurrency = (val: number) => format(val, dashboardCurrency);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading metrics...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-80 items-center justify-center px-4">
        <section role="alert" className="w-full max-w-lg rounded-none border border-destructive/25 bg-card p-6 text-center text-destructive">
          <h1 className="text-lg font-black">Your workspace could not be loaded</h1>
          <p className="mt-2 text-sm leading-6 text-destructive">Rive could not retrieve your dashboard data. Your account has not been treated as empty.</p>
          <p className="mt-3 break-words text-xs text-destructive/80">{loadError}</p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-5 rounded-none bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground hover:bg-destructive/90">Retry dashboard</button>
        </section>
      </div>
    );
  }

  /* Period-scoped cards fall back to the all-time stats when an older payload
     lacks `periods` — the toggle still renders, the numbers stay honest. */
  const activePeriod = periods?.[period] || null;
  const periodCashIn = activePeriod ? activePeriod.cashIn : stats.totalPaid;
  const periodExpenses = activePeriod ? activePeriod.expensesOut : stats.totalExpenses;
  const periodNet = activePeriod ? activePeriod.net : stats.netEarnings;
  const pctChange = (current: number, previous: number | null | undefined) =>
    previous === null || previous === undefined || previous === 0
      ? null
      : Math.round(((current - previous) / previous) * 1000) / 10;
  const comparisonLabel = period === "month"
    ? `vs ${activePeriod?.priorLabel || "last month"} to day ${activePeriod?.dayOfMonth || 1}`
    : "vs prior 6 months";
  const cashDelta = activePeriod?.prior ? pctChange(periodCashIn, activePeriod.prior.cashIn) : null;
  const expenseDelta = activePeriod?.prior ? pctChange(periodExpenses, activePeriod.prior.expensesOut) : null;
  const netDelta = activePeriod?.prior ? periodNet - activePeriod.prior.net : null;

  const statCards = [
    {
      title: "Cash collected",
      value: formatCurrency(periodCashIn),
      sub: activePeriod?.prior
        ? <span className="inline-flex flex-wrap items-center gap-x-1.5"><Movement change={cashDelta} comparison={comparisonLabel} /><span className="text-muted-foreground">· {formatCurrency(stats.totalPending)} still owed</span></span>
        : `All-time collected · ${formatCurrency(stats.totalPending)} still owed`,
    },
    { title: "Active projects", value: stats.activeProjects, sub: "Right now — unaffected by the period" },
    {
      title: period === "all" ? "Expenses logged" : "Expenses",
      value: formatCurrency(periodExpenses),
      sub: activePeriod?.prior ? <Movement change={expenseDelta} neutral comparison={comparisonLabel} /> : "All-time logged",
    },
    {
      title: "Net",
      value: formatCurrency(periodNet),
      sub: activePeriod?.prior
        ? <Movement change={netDelta} formatValue={(value) => formatCurrency(value)} comparison={comparisonLabel} />
        : "Cash received minus expenses",
    },
  ];
  const hasMeaningfulContext = activation?.hasMeaningfulContext ?? Boolean(
    activation && (
      activation.counts.clients > 0 ||
      activation.counts.projects > 0 ||
      activation.counts.invoices > 0 ||
      activation.counts.expenses > 0 ||
      signals.length > 0
    ),
  );
  const isFirstRun = Boolean(activation && !hasMeaningfulContext && !activation.guidanceDismissed);
  const showActivationGuidance = Boolean(
    activation &&
    !activation.guidanceDismissed &&
    activation.activationStage !== "activated",
  );

  return (
    <div className="dashboard-overview workspace-page gap-7 animate-panel-in">
      <PageHeader
        title={isFirstRun ? "Today" : "Overview"}
        description={isFirstRun ? (activation?.outcome || "Start with one useful piece of context.") : "Cash in, costs out, and the signals worth acting on."}
        actions={!isFirstRun ? (
          <>
          {/* The scope for the totals row below — grouped with the header so it
              does not spend a whole row of viewport on its own. */}
          <div role="group" aria-label="Dashboard totals period" className="flex flex-wrap gap-1 rounded-none border border-border bg-card p-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={period === option.key}
                onClick={() => setPeriod(option.key)}
                className={`rounded-none px-3 py-1.5 text-xs font-bold transition ${period === option.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {!showActivationGuidance ? (
            <>
            <Link href="/workflow/projects" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-none border border-border bg-card text-foreground hover:bg-muted transition-all">
              <Plus className="h-3.5 w-3.5" />
              <span>New project</span>
            </Link>
            <Link href="/workflow/revenue" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-none bg-primary text-primary-foreground hover:bg-primary-strong transition-all">
              <FileText className="h-3.5 w-3.5" />
              <span>New invoice</span>
            </Link>
            </>
          ) : null}
          </>
        ) : null}
      />

      {currencyMeta && !currencyMeta.conversionAvailable && (
        <div className="rounded-none border border-warning/25 bg-warning/10 p-4 text-sm text-foreground">
          Exchange rates are temporarily unavailable, so mixed-currency financial totals are hidden to avoid showing a misleading sum.
        </div>
      )}

      {showActivationGuidance && activation && (
        <ActivationCard
          plan={activation}
          firstRun={isFirstRun}
          engagementFlowEnabled={engagementFlow}
          onDismissed={() => setActivation((current) => current ? { ...current, guidanceDismissed: true } : current)}
        />
      )}

      {/* Opt-in prompt for the weekly business summary email. Never shown while
          guided-experience onboarding is still active, and shown at most once
          per account regardless — see WeeklySummaryOptInCard and
          `/api/workflow/weekly-summary/prompt`. */}
      {!showActivationGuidance && <WeeklySummaryOptInCard />}

      {/* Metrics Row */}
      {!isFirstRun && <div className={metricsGridClassName}>
        {statCards.map((c, idx) => (
          <MetricCard
            key={idx}
            label={c.title}
            value={currencyMeta?.conversionAvailable === false && idx !== 1 ? "—" : c.value}
            sub={c.sub}
          />
        ))}
      </div>}

      {!isFirstRun && insights && currencyMeta?.conversionAvailable !== false && (
        <section className={metricsGridClassName}>
          <Card className={insightCardClassName}>
            <p className="text-xs font-semibold text-muted-foreground">Collection rate</p>
            <div className="mt-auto pt-2">
              <p className="font-mono text-xl font-black tabular-nums text-foreground">{insights.collectionRate}%</p>
              <p className="mt-1 text-xs text-muted-foreground">All-time share of invoiced value collected</p>
            </div>
          </Card>
          <Card className={insightCardClassName}>
            <p className="text-xs font-semibold text-muted-foreground">Profit margin</p>
            <div className="mt-auto pt-2">
              <p className={`font-mono text-xl font-black tabular-nums ${insights.profitMargin < 0 ? "text-destructive" : "text-success"}`}>{insights.profitMargin}%</p>
              <p className="mt-1 text-xs text-muted-foreground">All time, after logged expenses</p>
            </div>
          </Card>
          <Link href="/workflow/revenue" className={`${insightCardClassName} hover:-translate-y-0.5 hover:border-warning`}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-warning" /> Overdue</p>
            <div className="mt-auto pt-2">
              <p className="font-mono text-xl font-black tabular-nums text-foreground">{formatCurrency(insights.overdueAmount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{insights.overdueCount} invoice{insights.overdueCount === 1 ? "" : "s"} {insights.overdueCount === 1 ? "needs" : "need"} attention</p>
            </div>
          </Link>
          <Link href="/calendar" className={`${insightCardClassName} hover:-translate-y-0.5 hover:border-primary`}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 text-primary" /> Next 14 days</p>
            <div className="mt-auto min-w-0 pt-2">
              <p className="truncate text-sm font-black text-foreground">{insights.upcomingProjects[0]?.title || "No project deadlines"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{insights.upcomingProjects.length ? `${insights.upcomingProjects.length} upcoming project${insights.upcomingProjects.length === 1 ? "" : "s"}` : "Calendar is clear"}</p>
            </div>
          </Link>
        </section>
      )}

      {/* Analytics Chart */}
      {!isFirstRun && currencyMeta?.conversionAvailable !== false && <AnalyticsCharts data={chartData} currency={dashboardCurrency} pace={chartPace} />}

      {/* Detail grids */}
      {!isFirstRun && <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Signals: things that happened to the work, not a log of clicks */}
        <div className="flex flex-col gap-5 rounded-none border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground">Signals</h3>
            <Badge>
              Updates automatically
            </Badge>
          </div>
          <p className="-mt-3 text-xs text-muted-foreground">What happened while you were away — an invoice opened, a payment landed, an enquiry arrived.</p>

          <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-2">
            {signals.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-4 w-4" />}
                title="No signals yet"
                description="When a client opens an invoice, a payment lands, or an enquiry comes in, it shows up here."
              />
            ) : (
              signals.map((signal, idx) => (
                <Link
                  key={`${signal.kind}-${signal.at}-${idx}`}
                  href={signal.href}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-none border border-border hover:border-primary transition-all bg-card"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge variant={signal.tone} className="uppercase">
                      {signal.tag}
                    </Badge>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{signal.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {signal.detail}
                        {signal.amount !== null ? ` · ${format(signal.amount, signal.currency || dashboardCurrency)}` : ""}
                      </span>
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {new Date(signal.at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Top Clients Ranking */}
        <div className="flex flex-col gap-5 rounded-none border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground">Top clients</h3>
            <Link href="/workflow/clients" className="text-xs text-primary font-bold hover:underline flex items-center">
              <span>View all</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {currencyMeta?.conversionAvailable === false ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Client rankings will return when exchange rates are available.</div>
            ) : topClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                No revenue metrics yet. Mark an invoice as paid to build this ranking.
              </div>
            ) : (
              topClients.map((client) => {
                const outstanding = Number(client.outstanding || 0);
                return (
                  <Link key={client.id} href={`/workflow/clients/${client.id}`} className="flex items-center justify-between p-3 rounded-none border border-border bg-card transition-all hover:border-primary">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs uppercase"
                        style={{ backgroundColor: client.avatar_color }}
                      >
                        {client.name.substring(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">{client.name}</span>
                        <span className="text-xs text-muted-foreground">{client.company || "Independent client"}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-xs font-extrabold tabular-nums text-success">
                        {formatCurrency(parseFloat(client.total_revenue))}
                      </span>
                      {outstanding > 0 ? (
                        <span className="mt-0.5 block font-mono text-[0.6875rem] tabular-nums text-warning">owes {formatCurrency(outstanding)}</span>
                      ) : null}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>}
    </div>
  );
}
