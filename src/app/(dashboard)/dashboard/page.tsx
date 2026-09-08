"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { 
  WalletCards,
  Briefcase, 
  Receipt, 
  Plus, 
  FileText,
  ChevronRight,
  TrendingUp,
  Activity,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import type { ChartData } from "@/components/dashboard/AnalyticsCharts";
import { Badge, Card, EmptyState, MetricCard, PageHeader } from "@/components/ui";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { ActivationCard } from "@/components/dashboard/ActivationCard";
import type { ActivationPlan } from "@/lib/activation";
import { useFeatureAvailability } from "@/components/FeatureAvailabilityContext";

interface Stats {
  totalPaid: number;
  totalPending: number;
  activeProjects: number;
  totalExpenses: number;
  netEarnings: number;
}

interface TopClient {
  id: string;
  name: string;
  company: string;
  avatar_color: string;
  total_revenue: string;
}

interface RecentActivity {
  type: string;
  title: string;
  created_at: string;
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
  const [activities, setActivities] = useState<RecentActivity[]>([]);
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
        setActivities(data.recentActivity || []);
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

  const statCards = [
    { title: "Revenue collected", value: formatCurrency(stats.totalPaid), sub: `Outstanding: ${formatCurrency(stats.totalPending)}`, icon: WalletCards, tone: "success" as const },
    { title: "Active projects", value: stats.activeProjects, sub: "Currently in progress", icon: Briefcase, tone: "info" as const },
    { title: "Expenses logged", value: formatCurrency(stats.totalExpenses), sub: "All categorized business costs", icon: Receipt, tone: "destructive" as const },
    { title: "Net earnings", value: formatCurrency(stats.netEarnings), sub: "Collected revenue minus expenses", icon: TrendingUp, tone: "violet" as const },
  ];
  const hasMeaningfulContext = activation?.hasMeaningfulContext ?? Boolean(
    activation && (
      activation.counts.clients > 0 ||
      activation.counts.projects > 0 ||
      activation.counts.invoices > 0 ||
      activation.counts.expenses > 0 ||
      activities.length > 0
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
        title={isFirstRun ? "Today" : "Your business, at a glance"}
        description={isFirstRun ? (activation?.outcome || "Start with one useful piece of context.") : "See what is moving, what is due, and where your attention will make the biggest difference."}
        actions={!isFirstRun && !showActivationGuidance ? (
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

      {/* Metrics Row */}
      {!isFirstRun && <div className={metricsGridClassName}>
        {statCards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <MetricCard
              key={idx}
              label={c.title}
              value={currencyMeta?.conversionAvailable === false && idx !== 1 ? "—" : c.value}
              sub={c.sub}
              tone={c.tone}
              icon={<Icon className="h-4 w-4" strokeWidth={1.75} />}
            />
          );
        })}
      </div>}

      {!isFirstRun && insights && currencyMeta?.conversionAvailable !== false && (
        <section className={metricsGridClassName}>
          <Card className={insightCardClassName}>
            <p className="text-xs font-semibold text-muted-foreground">Collection rate</p>
            <div className="mt-auto pt-2">
              <p className="font-mono text-xl font-black tabular-nums text-foreground">{insights.collectionRate}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Share of invoiced value collected</p>
            </div>
          </Card>
          <Card className={insightCardClassName}>
            <p className="text-xs font-semibold text-muted-foreground">Profit margin</p>
            <div className="mt-auto pt-2">
              <p className={`font-mono text-xl font-black tabular-nums ${insights.profitMargin < 0 ? "text-destructive" : "text-success"}`}>{insights.profitMargin}%</p>
              <p className="mt-1 text-xs text-muted-foreground">After logged expenses</p>
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
      {!isFirstRun && currencyMeta?.conversionAvailable !== false && <AnalyticsCharts data={chartData} currency={dashboardCurrency} />}

      {/* Detail grids */}
      {!isFirstRun && <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent activity stream */}
        <div className="flex flex-col gap-5 rounded-none border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-base text-foreground">Recent activity</h3>
            </div>
            <Badge>
              Updates automatically
            </Badge>
          </div>

          <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-2">
            {activities.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-4 w-4" />}
                title="No activity yet"
                description="Add a client, create a project, or send an invoice. New updates will appear here automatically."
              />
            ) : (
              activities.map((a, idx) => {
                let badgeTone: "info" | "success" | "warning" | "destructive" = "info";
                if (a.type === "client_added") badgeTone = "success";
                if (a.type === "invoice_created") badgeTone = "warning";
                if (a.type === "expense_logged") badgeTone = "destructive";

                return (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-none border border-border hover:border-primary transition-all bg-card">
                    <div className="flex items-center gap-3">
                      <Badge variant={badgeTone} className="uppercase">
                        {a.type.replace("_", " ")}
                      </Badge>
                      <span className="text-sm font-semibold text-foreground">{a.title}</span>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
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
              topClients.map((client) => (
                <div key={client.id} className="flex items-center justify-between p-3 rounded-none border border-border bg-card">
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
                  <span className="font-mono text-xs font-extrabold tabular-nums text-success">
                    {formatCurrency(parseFloat(client.total_revenue))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>}
    </div>
  );
}
