"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Inbox, Info, RefreshCw, Users } from "lucide-react";
import { Badge, Button, EmptyState, Skeleton } from "@/components/ui";
import {
  PORTFOLIO_ANALYTICS_RANGES,
  type PortfolioAnalyticsPayload,
  type PortfolioAnalyticsRange,
} from "@/utils/portfolioAnalytics";

/**
 * Portfolio analytics as a decision surface.
 *
 * The old panel showed four counters and a bar chart, which told an owner their
 * portfolio was being visited but nothing about what to do next. The questions
 * this is built to answer are: is interest growing, which work is drawing it,
 * and is any of it turning into enquiries.
 */

const RANGE_LABELS: Record<PortfolioAnalyticsRange, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  all: "All time",
};

const numberFormat = new Intl.NumberFormat();

function formatDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Movement against the previous period, or nothing when there is nothing honest to show. */
function Movement({ change, suffix = "%", inverse = false }: { change: number | null; suffix?: string; inverse?: boolean }) {
  if (change === null) return <span className="text-xs text-muted-foreground">No comparison</span>;
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <ArrowRight className="h-3 w-3" /> No change
      </span>
    );
  }
  const positive = inverse ? change < 0 : change > 0;
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
    >
      <Icon className="h-3 w-3" />
      {change > 0 ? "+" : ""}
      {change}
      {suffix}
      <span className="font-medium text-muted-foreground">vs previous</span>
    </span>
  );
}

function KpiCard({
  label,
  value,
  hint,
  change,
  changeSuffix,
}: {
  label: string;
  value: string;
  hint: string;
  change?: number | null;
  changeSuffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2.5 text-3xl font-black tabular-nums text-foreground">{value}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        {change !== undefined ? <Movement change={change} suffix={changeSuffix} /> : null}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{hint}</p>
    </div>
  );
}

function Breakdown({ title, subtitle, rows, empty }: { title: string; subtitle: string; rows: { label: string; views: number }[]; empty: string }) {
  const max = Math.max(...rows.map((row) => row.views), 1);
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h3 className="font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2.5">
          {rows.map((row) => (
            <li key={row.label} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-muted-foreground">{row.label}</span>
                <span className="shrink-0 font-bold tabular-nums text-foreground">{numberFormat.format(row.views)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max((row.views / max) * 100, 2)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function PortfolioAnalyticsPanel({ published }: { published: boolean }) {
  const [range, setRange] = useState<PortfolioAnalyticsRange>("30d");
  const [analytics, setAnalytics] = useState<PortfolioAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextRange: PortfolioAnalyticsRange) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/portfolio/analytics?range=${nextRange}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Could not load portfolio analytics.");
      setAnalytics(data.analytics as PortfolioAnalyticsPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load portfolio analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Deferred by a tick so the fetch's own loading state is not set during the
  // effect body, matching how the studio kicks off its initial portfolio load.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(range);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, range]);

  const rangeControls = (
    <div role="group" aria-label="Analytics date range" className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
      {PORTFOLIO_ANALYTICS_RANGES.map((option) => (
        <Button
          key={option}
          type="button"
          aria-pressed={range === option}
          onClick={() => setRange(option)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${range === option ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          {RANGE_LABELS[option]}
        </Button>
      ))}
    </div>
  );

  if (loading && !analytics) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">{rangeControls}</div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="rounded-2xl border border-border bg-card p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-8 w-20" />
              <Skeleton className="mt-3 h-3 w-32" />
            </div>
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">{rangeControls}</div>
        <section role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h3 className="text-sm font-bold text-destructive">Analytics could not be loaded</h3>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">{error}</p>
          <Button onClick={() => void load(range)} className="mt-4 rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-white">
            <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" /> Try again
          </Button>
        </section>
      </div>
    );
  }

  if (!analytics) return null;

  const { totals, changes, projects, timeline, inquiries } = analytics;
  const hasViews = totals.views > 0;
  const timelineMax = Math.max(...timeline.map((day) => day.views), 1);
  const unconverted = projects.filter((project) => project.unconverted);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-bold text-foreground">Portfolio performance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {analytics.window.days ? `Last ${analytics.window.days} days` : "Everything recorded so far"}
            {loading ? " · refreshing…" : ""}
          </p>
        </div>
        {rangeControls}
      </div>

      {!published && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Your portfolio is not published yet, so these figures cover past traffic only. Publishing is what starts new visits.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Views"
          value={numberFormat.format(totals.views)}
          change={changes.views}
          hint={`${numberFormat.format(totals.portfolioViews)} on your portfolio, ${numberFormat.format(totals.projectViews)} on case studies.`}
        />
        <KpiCard
          label="Estimated visitors"
          value={numberFormat.format(totals.estimatedVisitors)}
          change={changes.estimatedVisitors}
          hint="An estimate, not a count — Rive stores no raw IP addresses."
        />
        <KpiCard
          label="Enquiries"
          value={numberFormat.format(totals.inquiries)}
          change={changes.inquiries}
          hint={inquiries.latestAt ? `Most recent ${new Date(inquiries.latestAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.` : "No enquiries received yet."}
        />
        <KpiCard
          label="Conversion"
          value={`${totals.conversionRate}%`}
          change={changes.conversionRatePoints}
          changeSuffix="pts"
          hint="Share of views that became an enquiry."
        />
      </div>

      {unconverted.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
          <h3 className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Drawing attention, but no enquiries
          </h3>
          <p className="text-xs leading-5 text-amber-800 dark:text-amber-200">
            {unconverted.map((project) => project.title).join(", ")}{" "}
            {unconverted.length === 1 ? "has" : "have"} been read enough times to be worth a second look, while other work is
            producing enquiries. A clearer outcome or a direct call to action on {unconverted.length === 1 ? "that case study" : "those case studies"} is usually what closes the gap.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="font-bold text-foreground">Traffic over time</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Daily views across your portfolio and case studies.</p>
          </div>
        </div>
        {!hasViews ? (
          <EmptyState
            icon={<BarChart3 className="h-4 w-4" />}
            title="No views in this range"
            description={published ? "Share your portfolio link to start seeing traffic here." : "Publish your portfolio so visitors can reach it."}
          />
        ) : (
          <>
            <div className="flex h-40 items-end gap-px sm:h-48 sm:gap-1" role="img" aria-label={`Daily views: ${numberFormat.format(totals.views)} in total`}>
              {timeline.map((day) => (
                <div key={day.day} className="group relative flex h-full min-w-0 flex-1 items-end">
                  <div
                    className="w-full rounded-t bg-primary/70 transition group-hover:bg-primary"
                    style={{ height: `${Math.max((day.views / timelineMax) * 100, day.views ? 4 : 1)}%` }}
                    title={`${formatDay(day.day)}: ${day.views} view${day.views === 1 ? "" : "s"}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
              <span>{timeline[0] ? formatDay(timeline[0].day) : ""}</span>
              <span>{timeline.at(-1) ? formatDay(timeline.at(-1)!.day) : ""}</span>
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border p-5 sm:p-6">
          <div>
            <h3 className="font-bold text-foreground">Top projects</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Which case studies are actually being read.</p>
          </div>
          <span className="text-[11px] text-muted-foreground">{numberFormat.format(totals.projectViews)} case-study views</span>
        </div>
        {projects.length === 0 ? (
          <div className="p-5 sm:p-6">
            <EmptyState
              icon={<BarChart3 className="h-4 w-4" />}
              title="No case-study views yet"
              description="Case studies are counted separately from your portfolio page. Link to one directly, or give a project a full write-up to draw readers in."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  <th scope="col" className="px-5 py-3 sm:px-6">Project</th>
                  <th scope="col" className="px-3 py-3 text-right">Views</th>
                  <th scope="col" className="px-3 py-3 text-right">Visitors</th>
                  <th scope="col" className="px-3 py-3 text-right">Attention</th>
                  <th scope="col" className="px-5 py-3 text-right sm:px-6">Trend</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.projectId} className="border-b border-border last:border-0">
                    <th scope="row" className="max-w-0 px-5 py-3.5 text-left font-semibold sm:px-6">
                      <span className="block truncate text-foreground">{project.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {!project.exists && <Badge variant="secondary">No longer in your portfolio</Badge>}
                        {project.inquiries > 0 && (
                          <Badge variant="success">
                            {project.inquiries} enquir{project.inquiries === 1 ? "y" : "ies"}
                          </Badge>
                        )}
                        {project.unconverted && <Badge variant="warning">No enquiries</Badge>}
                      </span>
                    </th>
                    <td className="px-3 py-3.5 text-right font-bold tabular-nums text-foreground">{numberFormat.format(project.views)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-muted-foreground">{numberFormat.format(project.estimatedVisitors)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-muted-foreground">{project.attentionShare}%</td>
                    <td className="px-5 py-3.5 text-right sm:px-6"><Movement change={project.change} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Breakdown
          title="Where visitors come from"
          subtitle="External sources only. Navigation inside your own portfolio is not a source."
          rows={analytics.referrers.map((row) => ({ label: row.source, views: row.views }))}
          empty="No traffic recorded in this range."
        />
        <Breakdown
          title="Devices"
          subtitle="Worth checking your portfolio on whichever leads."
          rows={analytics.devices.map((row) => ({ label: row.device, views: row.views }))}
          empty="No traffic recorded in this range."
        />
      </div>

      <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3.5 py-3 text-[11px] leading-4 text-muted-foreground">
        <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          <strong className="font-semibold text-foreground">Visitor figures are estimates.</strong> {analytics.estimateNote}
        </span>
      </p>

      {inquiries.notificationFailures > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <Inbox className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {inquiries.notificationFailures} enquiry notification{inquiries.notificationFailures === 1 ? "" : "s"} could not be emailed to you. The
          {inquiries.notificationFailures === 1 ? " enquiry is" : " enquiries are"} safely saved — open the Enquiries tab to read {inquiries.notificationFailures === 1 ? "it" : "them"}.
        </p>
      )}
    </div>
  );
}
