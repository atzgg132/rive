"use client";

import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { Delta, Empty, fmt, FunnelUnavailable, Metric, Panel, rate, Sparkline, trailingTrend, type Funnel } from "./shared";

export function Overview({ funnel, refresh, loading, error }: { funnel: Funnel | null; refresh: () => void; loading: boolean; error: string }) {
  if (!funnel) return <FunnelUnavailable message={error} retry={refresh} loading={loading} />;
  const stages: Array<[string, number, string, string]> = [
    ["Registered", funnel.signups.total, "100%", "/admin?tab=users"],
    ["Qualified", funnel.qualification.qualified, rate(funnel.qualification.rate), "/admin?tab=users&stage=qualified"],
    ["Activated", funnel.activation.activated, rate(funnel.activation.rate), "/admin?tab=users&stage=activated"],
    ["Deeply activated", funnel.deepActivation.deeplyActivated, rate(funnel.deepActivation.rateAmongActivated), "/admin?tab=users&stage=deeply_activated"],
  ];
  const trend = trailingTrend(funnel.signups.daily);
  const unverified = funnel.signups.total - funnel.signups.verified;
  const emailBroken = funnel.reliability.failedEmails24h > 0;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">Overview</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">All customer accounts</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Counts are accounts, not events. Percentages always show their denominator so a small number cannot read as a large rate. The sparkline is the last 14 signup days. Activation is measured in the 7 days after each signup. Select a metric to open that cohort in Users.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh</Button>
      </div>
      {error ? <LoadErrorStrip message={error} onRetry={refresh} loading={loading} /> : null}
      {emailBroken ? <div className="rounded-none border border-destructive/25 bg-destructive/10 p-4 text-destructive" role="alert"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><div><p className="font-semibold">{funnel.reliability.failedEmails24h} email{funnel.reliability.failedEmails24h === 1 ? "" : "s"} failed to send in the last 24 hours.</p><p className="mt-1 text-sm text-destructive/80">Password resets and verification links are delivered on this path. Check the SMTP credentials before assuming signups are simply slow.</p></div></div></div> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Signups" value={fmt(funnel.signups.total)} detail={`${funnel.signups.last24h} in rolling 24h · ${funnel.signups.last7d} in 7 days`} href="/admin?tab=users" footer={<div className="space-y-2"><Sparkline daily={funnel.signups.daily} /><Delta change={trend.change} previous={trend.previous} /></div>} />
        <Metric label="Qualified" value={fmt(funnel.qualification.qualified)} detail={`${funnel.qualification.qualified} of ${funnel.signups.total} signups · ${rate(funnel.qualification.rate)}`} tone="purple" href="/admin?tab=users&stage=qualified" />
        <Metric label="Activated" value={fmt(funnel.activation.activated)} detail={`${funnel.activation.activated} of ${funnel.qualification.qualified} qualified · ${rate(funnel.activation.rate)}`} tone="green" href="/admin?tab=users&stage=activated" />
        <Metric label="Deeply activated" value={fmt(funnel.deepActivation.deeplyActivated)} detail={`${funnel.deepActivation.deeplyActivated} of ${funnel.activation.activated} activated · ${rate(funnel.deepActivation.rateAmongActivated)}`} tone="amber" href="/admin?tab=users&stage=deeply_activated" />
        <Metric label="Unverified email" value={fmt(unverified)} detail={`${funnel.signups.verified} of ${funnel.signups.total} verified`} tone={unverified > funnel.signups.verified ? "red" : "blue"} href="/admin?tab=users&verified=false" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Signup to deep activation" eyebrow="Each stage is a subset of the one above">
          <div className="space-y-4">
            {stages.map(([label, value, detail, href], index) => (
              <Link key={label} href={href} className="group flex items-center gap-4 rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40" title={`Open ${label} in Users`}>
                <div className="w-28 text-sm font-medium text-card-foreground group-hover:text-primary">{label}</div>
                <div className="h-1 flex-1 overflow-hidden rounded-none bg-muted"><div className={cn("h-full rounded-none", ["bg-muted-foreground", "bg-primary", "bg-success", "bg-foreground"][index])} style={{ width: `${funnel.signups.total ? Math.max(2, value / funnel.signups.total * 100) : 0}%` }} /></div>
                <div className="w-28 text-right text-sm font-semibold text-card-foreground">{fmt(value)} <span className="text-xs font-normal text-muted-foreground">{detail}</span></div>
              </Link>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-none bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Weekly / monthly active</p><p className="mt-1 font-mono text-lg font-bold tabular-nums text-card-foreground">{funnel.activeUsers.wau} / {funnel.activeUsers.mau}</p><p className="mt-1 text-xs text-muted-foreground">{funnel.activeUsers.mau ? `${Math.round((funnel.activeUsers.wau / funnel.activeUsers.mau) * 100)}% of monthly return weekly` : "No active users yet"}</p></div>
            <div className="rounded-none bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Week-one retention</p><p className="mt-1 font-mono text-lg font-bold tabular-nums text-card-foreground">{funnel.retention.available ? `${funnel.retention.numerator} / ${funnel.retention.denominator}` : "Not available"}</p><p className="mt-1 text-xs text-muted-foreground">{funnel.retention.available ? `${rate(funnel.retention.rate)} · cohorts 14+ days old` : "No cohort is 14 days old yet"}</p></div>
            <div className="rounded-none bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Modules per activated user</p><p className="mt-1 font-mono text-lg font-bold tabular-nums text-card-foreground">{funnel.deepActivation.averageModules}</p><p className="mt-1 text-xs text-muted-foreground">{funnel.deepActivation.connectedWorkflows} connected a workflow end to end</p></div>
          </div>
        </Panel>
        <Panel title="How activated users got there" eyebrow="A user can appear in more than one path">
          <div className="space-y-4">{funnel.activation.pathBreakdown.length ? funnel.activation.pathBreakdown.map((item) => <div key={item.path} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"><span className="capitalize text-sm font-medium text-card-foreground">{item.path}</span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{item.count}</span></div>) : <Empty text="No qualified users have activated yet." />}</div>
        </Panel>
      </div>
      <Panel title="What these words mean" eyebrow="Read this before quoting a number">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-none bg-muted/50 p-4"><dt className="font-semibold text-card-foreground">Qualified</dt><dd className="mt-1 text-muted-foreground">Finished onboarding with enough detail to be a real prospect. Internal and test accounts are excluded everywhere on this page.</dd></div>
          <div className="rounded-none bg-muted/50 p-4"><dt className="font-semibold text-card-foreground">Activated</dt><dd className="mt-1 text-muted-foreground">Completed a genuine value path — native workflow, migration, or a published portfolio — within 7 days of signing up. This is not the in-app “workspace activated” checklist.</dd></div>
          <div className="rounded-none bg-muted/50 p-4"><dt className="font-semibold text-card-foreground">Deeply activated</dt><dd className="mt-1 text-muted-foreground">Used 3+ modules across 2+ separate days and connected a workflow, all within 14 days. This is the number that predicts retention.</dd></div>
          <div className="rounded-none bg-muted/50 p-4"><dt className="font-semibold text-card-foreground">Real data</dt><dd className="mt-1 text-muted-foreground">Records the product classified as genuine business data rather than demo or imported placeholders. {fmt(funnel.realData.users)} users, {fmt(funnel.realData.records)} records.</dd></div>
        </dl>
      </Panel>
      <p className="text-xs text-muted-foreground">Definitions {funnel.definitionVersion} · calculated {new Date(funnel.generatedAt).toLocaleString()} · cached for 30 seconds.</p>
    </div>
  );
}

function LoadErrorStrip({ message, onRetry, loading }: { message: string; onRetry: () => void; loading: boolean }) {
  return <div className="rounded-none border border-destructive/25 bg-destructive/10 p-5 text-destructive" role="alert"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><div className="min-w-0"><p className="font-semibold">This admin data is temporarily unavailable.</p><p className="mt-1 text-sm text-destructive/80">{message}</p><Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={loading} className="mt-4 border-destructive/25 text-destructive hover:bg-destructive/10">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Try again</Button></div></div></div>;
}
