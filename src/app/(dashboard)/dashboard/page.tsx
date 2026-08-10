"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { 
  DollarSign, 
  Briefcase, 
  Receipt, 
  Plus, 
  FileText,
  ChevronRight,
  TrendingUp,
  Activity,
  AlertTriangle,
  CalendarDays,
  Target,
  Upload,
  CheckCircle2,
} from "lucide-react";
import type { ChartData } from "@/components/dashboard/AnalyticsCharts";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { useCurrency } from "@/components/currency/CurrencyProvider";

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

interface Activation {
  counts: { clients: number; projects: number; invoices: number; expenses: number };
  completed: number;
  total: number;
  unresolvedImportIssues: number;
  next: { id: string; label: string; complete: boolean; href: string } | null;
  steps: { id: string; label: string; complete: boolean; href: string }[];
}

interface ProfileReadiness {
  completed: number;
  total: number;
  percentage: number;
  substantial: boolean;
  signals: { id: string; label: string; complete: boolean; href: string }[];
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
  "flex min-h-28 h-full flex-col rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-card transition-[border-color,box-shadow,transform]";

const AnalyticsCharts = dynamic(() => import("@/components/dashboard/AnalyticsCharts"), {
  loading: () => <div className="h-[380px] animate-pulse rounded-2xl border border-border bg-card" />,
});

export default function DashboardOverview() {
  const { displayCurrency, format } = useCurrency();
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
  const [activation, setActivation] = useState<Activation | null>(null);
  const [profileReadiness, setProfileReadiness] = useState<ProfileReadiness | null>(null);
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
        setProfileReadiness(data.profileReadiness || null);
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
        <section role="alert" className="w-full max-w-lg rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-red-900 shadow-sm dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
          <h1 className="text-lg font-black">Your workspace could not be loaded</h1>
          <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-200">Rive could not retrieve your dashboard data. Your account has not been treated as empty.</p>
          <p className="mt-3 break-words text-xs text-red-700/80 dark:text-red-200/80">{loadError}</p>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-5 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800">Retry dashboard</button>
        </section>
      </div>
    );
  }

  const statCards = [
    { title: "Revenue collected", value: formatCurrency(stats.totalPaid), sub: `Pending: ${formatCurrency(stats.totalPending)}`, icon: DollarSign, color: "text-[#059669] dark:text-emerald-300 bg-[#ECFDF5] dark:bg-emerald-950/60 ring-1 ring-emerald-100 dark:ring-emerald-800/60" },
    { title: "Active projects", value: stats.activeProjects, sub: "Currently in progress", icon: Briefcase, color: "text-primary dark:text-blue-300 bg-accent dark:bg-blue-950/60 ring-1 ring-blue-100 dark:ring-blue-800/60" },
    { title: "Expenses logged", value: formatCurrency(stats.totalExpenses), sub: "All categorized business costs", icon: Receipt, color: "text-[#DC2626] dark:text-red-300 bg-[#FEF2F2] dark:bg-red-950/60 ring-1 ring-red-100 dark:ring-red-800/60" },
    { title: "Net earnings", value: formatCurrency(stats.netEarnings), sub: "Collected revenue minus expenses", icon: TrendingUp, color: "text-[#7C3AED] dark:text-violet-300 bg-[#F5F3FF] dark:bg-violet-950/60 ring-1 ring-violet-100 dark:ring-violet-800/60" },
  ];
  const isFirstRun = Boolean(
    activation &&
    activation.counts.clients === 0 &&
    activation.counts.projects === 0 &&
    activation.counts.invoices === 0 &&
    activation.counts.expenses === 0 &&
    activities.length === 0,
  );

  return (
    <div className="dashboard-overview workspace-page gap-7 animate-fade-in">
      <PageHeader
        title="Your workspace overview"
        description="See the financial health, delivery status, and activity that need your attention."
        actions={!isFirstRun ? (
          <>
          <Link href="/workflow/projects" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-border dark:border-slate-700 hover:bg-background dark:hover:bg-slate-700 text-foreground dark:text-white transition-all">
            <Plus className="h-3.5 w-3.5" />
            <span>New project</span>
          </Link>
          <Link href="/workflow/revenue" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-blue-700 transition-all shadow-[0_4px_10px_rgba(29,78,216,0.1)]">
            <FileText className="h-3.5 w-3.5" />
            <span>New invoice</span>
          </Link>
          </>
        ) : null}
      />

      {currencyMeta && !currencyMeta.conversionAvailable && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          Exchange rates are temporarily unavailable, so mixed-currency financial totals are hidden to avoid showing a misleading sum.
        </div>
      )}

      {isFirstRun && activation && (
        <section className="overflow-hidden rounded-2xl border border-blue-400/40 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg shadow-blue-600/10 sm:p-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-blue-100"><Target className="h-4 w-4" /> Your first steps</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Welcome to Rive. Get your workspace ready.</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100">Start with the few pieces that make Rive useful: your profile, one client, and one piece of work. You can come back to the rest later.</p>
          </div>
          {profileReadiness && (
            <div className="mt-6 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
              <div className="flex items-center justify-between gap-3 text-xs font-bold"><span>Profile readiness</span><span>{profileReadiness.percentage}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${profileReadiness.percentage}%` }} /></div>
              <p className="mt-2 text-xs text-blue-100">{profileReadiness.completed} of {profileReadiness.total} useful signals complete. Optional details can wait.</p>
            </div>
          )}
          <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activation.steps.map((item) => (
              <Link key={item.id} href={item.href} className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-white/10 px-3.5 py-3 text-xs font-bold ring-1 ring-white/15 transition hover:bg-white/15">
                <span className="flex min-w-0 items-center gap-2">{item.complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" /> : <span className="h-4 w-4 shrink-0 rounded-full border border-white/50" />}<span className="truncate">{item.label}</span></span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-blue-100" />
              </Link>
            ))}
          </div>
          <Link href={activation.next?.href || "/onboarding?restart=1"} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-blue-700">{activation.next ? `Next: ${activation.next.label}` : "Review setup"}<ChevronRight className="h-3.5 w-3.5" /></Link>
        </section>
      )}

      {!isFirstRun && activation && activation.completed < activation.total && (
        <section className="overflow-hidden rounded-2xl border border-blue-400/40 bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg shadow-blue-600/10 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-blue-100"><Target className="h-4 w-4" /> Activation center</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight">{activation.completed === 0 ? "Bring your business into focus." : "Your operating system is taking shape."}</h2>
              <p className="mt-2 text-sm leading-6 text-blue-100">Complete the connected loop once—identity, clients, active work, money, schedule, and proof—and Rive can turn records into useful decisions.</p>
              {activation.unresolvedImportIssues > 0 && <Link href="/onboarding?restart=1" className="mt-3 inline-flex rounded-full bg-amber-300/20 px-3 py-1 text-[10px] font-black text-amber-100 ring-1 ring-amber-200/30">{activation.unresolvedImportIssues} imported relationship{activation.unresolvedImportIssues === 1 ? "" : "s"} need review</Link>}
            </div>
            <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:w-[460px]">
              {activation.steps.map((item) => <Link key={item.id} href={item.href} className="flex items-center justify-between rounded-xl bg-white/10 px-3.5 py-3 text-xs font-bold ring-1 ring-white/15 transition hover:bg-white/15"><span>{item.complete ? "✓" : "○"} {item.label}</span><ChevronRight className="h-3.5 w-3.5 text-blue-100" /></Link>)}
              <Link href={activation.next?.href || "/onboarding?restart=1"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-blue-700 sm:col-span-2"><Upload className="h-3.5 w-3.5" /> {activation.next ? `Next: ${activation.next.label}` : "Review setup"}</Link>
            </div>
          </div>
        </section>
      )}

      {/* Metrics Row */}
      {!isFirstRun && <div className={metricsGridClassName}>
        {statCards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <Card key={idx} className="flex min-h-36 flex-col p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <span className="text-xs font-semibold text-muted-foreground">{c.title}</span>
                <span className={`p-2 rounded-lg ${c.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-auto">
                <h3 className="mb-1 text-2xl font-black text-foreground">{currencyMeta?.conversionAvailable === false && idx !== 1 ? "—" : c.value}</h3>
                <p className="text-xs text-muted-foreground">{c.sub}</p>
              </div>
            </Card>
          );
        })}
      </div>}

      {!isFirstRun && insights && currencyMeta?.conversionAvailable !== false && (
        <section className={metricsGridClassName}>
          <Card className={insightCardClassName}>
            <p className="text-xs font-semibold text-muted-foreground">Collection health</p>
            <div className="mt-auto pt-2">
              <p className="text-xl font-black text-foreground">{insights.collectionRate}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Of issued value collected</p>
            </div>
          </Card>
          <Card className={insightCardClassName}>
            <p className="text-xs font-semibold text-muted-foreground">Profit margin</p>
            <div className="mt-auto pt-2">
              <p className={`text-xl font-black ${insights.profitMargin < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{insights.profitMargin}%</p>
              <p className="mt-1 text-xs text-muted-foreground">After logged expenses</p>
            </div>
          </Card>
          <Link href="/workflow/revenue" className={`${insightCardClassName} hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg dark:hover:border-amber-700`}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-warning" /> Overdue</p>
            <div className="mt-auto pt-2">
              <p className="text-xl font-black text-foreground">{formatCurrency(insights.overdueAmount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{insights.overdueCount} invoice{insights.overdueCount === 1 ? "" : "s"} {insights.overdueCount === 1 ? "needs" : "need"} attention</p>
            </div>
          </Link>
          <Link href="/calendar" className={`${insightCardClassName} hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:hover:border-blue-700`}>
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
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-base text-foreground dark:text-white">Recent activities</h3>
            </div>
            <Badge className="uppercase">
              Live activity
            </Badge>
          </div>

          <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-2">
            {activities.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-4 w-4" />}
                title="No activity yet"
                description="Add a client, create a project, or issue an invoice to begin building your timeline."
              />
            ) : (
              activities.map((a, idx) => {
                let badgeColor = "bg-blue-50 dark:bg-blue-950/50 text-primary dark:text-blue-300 border-blue-100 dark:border-blue-900/60";
                if (a.type === "client_added") badgeColor = "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/60";
                if (a.type === "invoice_created") badgeColor = "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/60";
                if (a.type === "expense_logged") badgeColor = "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900/60";

                return (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border border-border dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all bg-white dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wide ${badgeColor}`}>
                        {a.type.replace("_", " ")}
                      </span>
                      <span className="text-sm font-semibold text-foreground dark:text-white">{a.title}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground dark:text-slate-500">
                      {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Clients Ranking */}
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground dark:text-white">Top clients</h3>
            <Link href="/workflow/clients" className="text-xs text-primary dark:text-blue-400 font-bold hover:underline flex items-center">
              <span>View all</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {currencyMeta?.conversionAvailable === false ? (
              <div className="py-12 text-center text-xs text-muted-foreground">Client rankings will return when exchange rates are available.</div>
            ) : topClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground dark:text-slate-500 text-xs">
                No revenue metrics yet. Mark an invoice as paid to build this ranking.
              </div>
            ) : (
              topClients.map((client) => (
                <div key={client.id} className="flex items-center justify-between p-3 rounded-xl border border-border dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase"
                      style={{ backgroundColor: client.avatar_color }}
                    >
                      {client.name.substring(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-foreground dark:text-white">{client.name}</span>
                      <span className="text-[10px] text-muted-foreground dark:text-slate-500">{client.company || "Independent client"}</span>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-[#10B981]">
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
