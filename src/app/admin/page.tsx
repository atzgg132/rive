"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Activity, AlertCircle, BarChart3, ChevronLeft, ChevronRight, Clock3, Loader2, LogOut, MessageSquare, RefreshCw, Search, Shield, Users, Zap } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import RiveLogo from "@/components/RiveLogo";
import PasswordInput from "@/components/PasswordInput";
import type { FunnelQualityAlert } from "@/lib/analytics/funnelQuality";

type Funnel = {
  definitionVersion: string;
  generatedAt: string;
  signups: { total: number; verified: number; last24h: number; last7d: number; daily: Array<{ day: string; count: number }> };
  qualification: { qualified: number; rate: number | null; sourceBreakdown: Array<{ source: string; signups: number; qualified: number }> };
  activation: { activated: number; rate: number | null; native: number; migration: number; portfolio: number; pathBreakdown: Array<{ path: string; count: number }> };
  engagement?: { prospectiveSince: string | null; createdUsers: number; createdFlows: number; medianHoursToCreate: number | null; p75HoursToCreate: number | null; firstSession: { completed: number; started: number; rate: number | null }; sevenDay: { completed: number; eligible: number; rate: number | null }; followThrough: { users: number; eligible: number; rate: number | null }; steps: Array<{ step: string; users: number; flows: number }>; failures: Array<{ code: string; entryPoint: string; count: number }> };
  deepActivation: { deeplyActivated: number; rateAmongActivated: number | null; averageModules: number; usersWithTwoActiveDays: number; connectedWorkflows: number };
  realData: { users: number; records: number };
  activeUsers: { wau: number; mau: number };
  retention: { available: boolean; numerator: number; denominator: number; rate: number | null; definition: string };
  workflowDepth: { averageModules: number; buckets: Array<{ label: string; count: number }> };
  reliability: { productEvents24h: number; failedEmails24h: number; queuedEmails: number };
  window?: { label: string; signupSparklineDays: number; activationWindowDays: number; deepActivationWindowDays: number };
  dropOff?: { unqualified: number; qualifiedNotActivated: number; blockerCounts: Array<{ blocker: string; count: number }> };
  quality: { schemaVersion: number; contractRejections24h: number; unknownEventNames24h: number; missingIdentityEvents24h: number; missingDataOriginEvents24h: number; unknownOriginRecords: number; latestEventAt: string | null; eventLagMinutes: number | null; uncapturedSignups: number; uncapturedSignupRate: number | null; alerts: FunnelQualityAlert[] };
};

type UserRow = { id: string; email: string; name: string | null; createdAt: string; emailVerified: boolean; onboardingStatus: string; businessType: string | null; profession: string | null; goal: string | null; startingPath: string | null; qualified: boolean; activated?: boolean; stage?: "registered" | "qualified" | "activated"; realData: boolean; qualificationBlockers?: string[]; activationPaths?: string[]; attribution: { firstTouchSource: string | null; lastTouchSource: string | null; firstTouchMedium: string | null; firstTouchCampaign: string | null; referralSource: string | null } | null; lastActivity: { at: string; eventName: string; module: string | null } | null };
type FunnelDiagnosis = { stage: string; qualified: boolean; activated: boolean; realData: boolean; productGuidanceStage: string; qualificationBlockers: string[]; activation: { native: boolean; migration: boolean; portfolio: boolean; paths: string[]; blockers: string[] }; workspace: { clients: number; projects: number; invoices: number; expenses: number; calendarEvents: number; publishedPortfolios: number } };
type FeedbackRow = { id: string; promptKey: string | null; feedbackType: string; module: string | null; rating: number | null; body: string | null; contactAllowed: boolean; status: string; createdAt: string; user: { email: string; name: string | null } | null };
type FeedbackSummary = { counts: Record<string, number>; averageRating: number | null; ratedCount: number; contactable: number };
type LegacyRow = { id: number; email: string; type: string; status: string; created_at: string; registered: boolean };
type Tab = "overview" | "funnel" | "users" | "feedback" | "reliability" | "legacy";

const tabs: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "funnel", label: "Funnel", icon: Zap },
  { id: "users", label: "Users", icon: Users },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "reliability", label: "Reliability", icon: AlertCircle },
  { id: "legacy", label: "Legacy archive", icon: Clock3 },
];

const fmt = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
const rate = (value: number | null) => value === null ? "Not available" : `${value}%`;
const ago = (value: string | null | undefined) => {
  if (!value) return "Not recorded";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const STAGE_COPY: Record<string, string> = { registered: "Registered", qualified: "Qualified", activated: "Activated" };
const BLOCKER_COPY: Record<string, string> = {
  internal: "Internal account",
  email_not_ready: "Email not verified",
  onboarding_incomplete: "Onboarding incomplete",
  missing_business_type: "No business type",
  missing_profession: "No profession",
  missing_goal: "No primary goal",
  missing_starting_path: "No starting path",
  uncaptured_source: "No acquisition source",
  no_client_in_window: "No client in 7 days",
  no_linked_project_in_window: "No client-linked project in 7 days",
  no_connected_outcome: "No connected outcome in 7 days",
  migration_incomplete: "Migration incomplete",
  portfolio_incomplete: "Portfolio incomplete",
};
function humanBlocker(value: string) {
  const key = value.replace(/^(qualification|activation):/, "");
  return BLOCKER_COPY[key] || key.replace(/_/g, " ");
}
async function fetchAdmin(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The admin request timed out. Retry to continue.");
    }
    // fetch rejects with a bare TypeError for anything that never reached the
    // route: offline, DNS, or — the case that actually bit us — a page left open
    // on a host that now redirects elsewhere, which turns same-origin calls into
    // blocked cross-origin ones. "Failed to fetch" tells nobody what to do.
    if (error instanceof TypeError) {
      throw new Error("The admin API could not be reached. If this tab was open before a deploy, reload the page.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

// Sessions are host-scoped, so an admin left open on a non-canonical hostname
// makes every API call cross-origin and every panel fail at once. Send the page
// to the host the API actually answers on instead of rendering six error cards.
function useCanonicalHost(): void {
  useEffect(() => {
    // Match the apex exactly. Anything broader would rewrite dev.rive.work into
    // www.dev.rive.work and strand the environment on a host that does not exist.
    if (window.location.hostname !== "rive.work") return;
    window.location.replace(`https://www.rive.work${window.location.pathname}${window.location.search}`);
  }, []);
}

function Loading({ label = "Loading admin data" }: { label?: string }) {
  return <div className="grid min-h-40 place-items-center gap-3 text-sm text-muted-foreground" role="status" aria-live="polite"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span>{label}</span></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function Panel({ title, eyebrow, action, children }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4"><div>{eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p> : null}<h2 className="mt-1 text-base font-semibold text-card-foreground">{title}</h2></div>{action}</div><div className="p-5">{children}</div></section>;
}

function LoadError({ message, onRetry, loading = false }: { message: string; onRetry: () => void; loading?: boolean }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /><div className="min-w-0"><p className="font-semibold">This admin data is temporarily unavailable.</p><p className="mt-1 text-sm text-red-800/80">{message}</p><Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={loading} className="mt-4 border-red-200 bg-white text-red-800 hover:bg-red-100">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Try again</Button></div></div></div>;
}

function FunnelUnavailable({ message, retry, loading }: { message: string; retry: () => void; loading: boolean }) {
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">Overview</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Metrics unavailable</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">You are still signed in — only the metrics query failed. The Users, Feedback and Legacy archive tabs read from different queries and should still work.</p></div><LoadError message={message} onRetry={retry} loading={loading} /></div>;
}

function Login({ onLogin, notice = "" }: { onLogin: () => void; notice?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetchAdmin("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }), credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Invalid credentials.");
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-background px-5 py-8"><div className="w-full max-w-sm"><div className="mb-8 flex justify-center"><RiveLogo height={38} /></div><form onSubmit={submit} className="rounded-3xl border border-border bg-card p-8 shadow-xl"><div className="mb-7 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Shield className="h-6 w-6" /></div><h1 className="text-2xl font-bold text-card-foreground">Admin workspace</h1><p className="mt-1 text-sm text-muted-foreground">Product operations and funnel quality</p></div>{notice && !error ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status" data-testid="admin-session-notice">{notice}</p> : null}<label className="mb-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Username<Input value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" autoFocus className="mt-2" /></label><label className="mb-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password<PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="mt-2" /></label>{error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" data-testid="admin-login-error">{error}</p> : null}<Button type="submit" variant="default" size="lg" disabled={loading} className="w-full">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}{loading ? "Signing in…" : "Sign in securely"}</Button><p className="mt-5 text-center text-xs text-muted-foreground">Protected by an HttpOnly session cookie.</p></form><div className="mt-4 flex justify-end"><ThemeToggle /></div></div></main>;
}

// Trend over the trailing 7 days against the 7 before it. The daily series is
// 14 days long, which is exactly one comparison and no more — say so plainly
// rather than implying a longer baseline than the data supports.
function trailingTrend(daily: Array<{ day: string; count: number }>): { current: number; previous: number; change: number | null } {
  const recent = daily.slice(-7).reduce((sum, day) => sum + day.count, 0);
  const prior = daily.slice(-14, -7).reduce((sum, day) => sum + day.count, 0);
  return { current: recent, previous: prior, change: prior > 0 ? Math.round(((recent - prior) / prior) * 1000) / 10 : null };
}

function Delta({ change, previous }: { change: number | null; previous: number }) {
  if (change === null) return <span className="text-xs text-muted-foreground">no prior week to compare</span>;
  const flat = Math.abs(change) < 0.05;
  const tone = flat ? "text-muted-foreground" : change > 0 ? "text-emerald-600" : "text-red-600";
  return <span className={`text-xs font-semibold ${tone}`}>{flat ? "flat" : `${change > 0 ? "+" : ""}${change}%`} <span className="font-normal text-muted-foreground">vs {previous} prior 7d</span></span>;
}

function Sparkline({ daily }: { daily: Array<{ day: string; count: number }> }) {
  if (daily.length < 2) return null;
  const peak = Math.max(...daily.map((day) => day.count), 1);
  const step = 100 / (daily.length - 1);
  const points = daily.map((day, index) => `${index * step},${28 - (day.count / peak) * 26}`).join(" ");
  return <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-8 w-full" role="img" aria-label={`Daily signups over ${daily.length} days, peak ${peak}`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="text-primary" /></svg>;
}

function Metric({ label, value, detail, tone = "blue", footer }: { label: string; value: string | number; detail: string; tone?: "blue" | "green" | "amber" | "purple" | "red"; footer?: ReactNode }) {
  const colors = { blue: "text-blue-600 bg-blue-50 border-blue-100", green: "text-emerald-600 bg-emerald-50 border-emerald-100", amber: "text-amber-600 bg-amber-50 border-amber-100", purple: "text-violet-600 bg-violet-50 border-violet-100", red: "text-red-600 bg-red-50 border-red-100" };
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className={`mb-5 grid h-10 w-10 place-items-center rounded-xl border ${colors[tone]}`}><Activity className="h-5 w-5" /></div><p className="text-3xl font-bold tracking-tight tabular-nums text-card-foreground">{value}</p><p className="mt-1 text-sm font-semibold text-card-foreground">{label}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p>{footer ? <div className="mt-3 border-t border-border pt-3">{footer}</div> : null}</div>;
}

function Overview({ funnel, refresh, loading, error }: { funnel: Funnel | null; refresh: () => void; loading: boolean; error: string }) {
  if (!funnel) return <FunnelUnavailable message={error} retry={refresh} loading={loading} />;
  const stages = [["Registered", funnel.signups.total, "100%"], ["Qualified", funnel.qualification.qualified, rate(funnel.qualification.rate)], ["Activated", funnel.activation.activated, rate(funnel.activation.rate)], ["Deeply activated", funnel.deepActivation.deeplyActivated, rate(funnel.deepActivation.rateAmongActivated)]] as Array<[string, number, string]>;
  const trend = trailingTrend(funnel.signups.daily);
  const unverified = funnel.signups.total - funnel.signups.verified;
  const emailBroken = funnel.reliability.failedEmails24h > 0;
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-primary">Overview</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">All customer accounts</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Counts are accounts, not events. Percentages always show their denominator so a small number cannot read as a large rate. The sparkline is the last 14 signup days. Activation is measured in the 7 days after each signup.</p></div><Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh</Button></div>{error ? <LoadError message={error} onRetry={refresh} loading={loading} /> : null}{emailBroken ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900" role="alert"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /><div><p className="font-semibold">{funnel.reliability.failedEmails24h} email{funnel.reliability.failedEmails24h === 1 ? "" : "s"} failed to send in the last 24 hours.</p><p className="mt-1 text-sm text-red-800/80">Password resets and verification links are delivered on this path. Check the SMTP credentials before assuming signups are simply slow.</p></div></div></div> : null}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Signups" value={fmt(funnel.signups.total)} detail={`${funnel.signups.last24h} in rolling 24h · ${funnel.signups.last7d} in 7 days`} footer={<div className="space-y-2"><Sparkline daily={funnel.signups.daily} /><Delta change={trend.change} previous={trend.previous} /></div>} /><Metric label="Qualified" value={fmt(funnel.qualification.qualified)} detail={`${funnel.qualification.qualified} of ${funnel.signups.total} signups · ${rate(funnel.qualification.rate)}`} tone="purple" /><Metric label="Activated" value={fmt(funnel.activation.activated)} detail={`${funnel.activation.activated} of ${funnel.qualification.qualified} qualified · ${rate(funnel.activation.rate)}`} tone="green" /><Metric label="Deeply activated" value={fmt(funnel.deepActivation.deeplyActivated)} detail={`${funnel.deepActivation.deeplyActivated} of ${funnel.activation.activated} activated · ${rate(funnel.deepActivation.rateAmongActivated)}`} tone="amber" /><Metric label="Unverified email" value={fmt(unverified)} detail={`${funnel.signups.verified} of ${funnel.signups.total} verified`} tone={unverified > funnel.signups.verified ? "red" : "blue"} /></div><div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><Panel title="Signup to deep activation" eyebrow="Each stage is a subset of the one above"><div className="space-y-4">{stages.map(([label, value, detail], index) => <div key={label} className="flex items-center gap-4"><div className="w-28 text-sm font-medium text-card-foreground">{label}</div><div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${["bg-slate-400", "bg-blue-500", "bg-emerald-500", "bg-violet-500"][index]}`} style={{ width: `${funnel.signups.total ? Math.max(2, value / funnel.signups.total * 100) : 0}%` }} /></div><div className="w-28 text-right text-sm font-semibold text-card-foreground">{fmt(value)} <span className="text-xs font-normal text-muted-foreground">{detail}</span></div></div>)}</div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Weekly / monthly active</p><p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">{funnel.activeUsers.wau} / {funnel.activeUsers.mau}</p><p className="mt-1 text-xs text-muted-foreground">{funnel.activeUsers.mau ? `${Math.round((funnel.activeUsers.wau / funnel.activeUsers.mau) * 100)}% of monthly return weekly` : "No active users yet"}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Week-one retention</p><p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">{funnel.retention.available ? `${funnel.retention.numerator} / ${funnel.retention.denominator}` : "Not available"}</p><p className="mt-1 text-xs text-muted-foreground">{funnel.retention.available ? `${rate(funnel.retention.rate)} · cohorts 14+ days old` : "No cohort is 14 days old yet"}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Modules per activated user</p><p className="mt-1 text-lg font-bold tabular-nums text-card-foreground">{funnel.deepActivation.averageModules}</p><p className="mt-1 text-xs text-muted-foreground">{funnel.deepActivation.connectedWorkflows} connected a workflow end to end</p></div></div></Panel><Panel title="How activated users got there" eyebrow="A user can appear in more than one path"><div className="space-y-4">{funnel.activation.pathBreakdown.length ? funnel.activation.pathBreakdown.map((item) => <div key={item.path} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"><span className="capitalize text-sm font-medium text-card-foreground">{item.path}</span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{item.count}</span></div>) : <Empty text="No qualified users have activated yet." />}</div></Panel></div><Panel title="What these words mean" eyebrow="Read this before quoting a number"><dl className="grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-xl bg-muted/50 p-4"><dt className="font-semibold text-card-foreground">Qualified</dt><dd className="mt-1 text-muted-foreground">Finished onboarding with enough detail to be a real prospect. Internal and test accounts are excluded everywhere on this page.</dd></div><div className="rounded-xl bg-muted/50 p-4"><dt className="font-semibold text-card-foreground">Activated</dt><dd className="mt-1 text-muted-foreground">Completed a genuine value path — native workflow, migration, or a published portfolio — within 7 days of signing up. This is not the in-app “workspace activated” checklist.</dd></div><div className="rounded-xl bg-muted/50 p-4"><dt className="font-semibold text-card-foreground">Deeply activated</dt><dd className="mt-1 text-muted-foreground">Used 3+ modules across 2+ separate days and connected a workflow, all within 14 days. This is the number that predicts retention.</dd></div><div className="rounded-xl bg-muted/50 p-4"><dt className="font-semibold text-card-foreground">Real data</dt><dd className="mt-1 text-muted-foreground">Records the product classified as genuine business data rather than demo or imported placeholders. {fmt(funnel.realData.users)} users, {fmt(funnel.realData.records)} records.</dd></div></dl></Panel><p className="text-xs text-muted-foreground">Definitions {funnel.definitionVersion} · calculated {new Date(funnel.generatedAt).toLocaleString()} · cached for 30 seconds.</p></div>;
}


function emptyEngagement(): NonNullable<Funnel["engagement"]> {
  return {
    prospectiveSince: null,
    createdUsers: 0,
    createdFlows: 0,
    medianHoursToCreate: null,
    p75HoursToCreate: null,
    firstSession: { completed: 0, started: 0, rate: null },
    sevenDay: { completed: 0, eligible: 0, rate: null },
    followThrough: { users: 0, eligible: 0, rate: null },
    steps: [],
    failures: [],
  };
}

function EngagementFunnelPanel({ engagement }: { engagement: NonNullable<Funnel["engagement"]> }) {
  return <Panel title="Start a client engagement" eyebrow={engagement.prospectiveSince ? `Prospective since ${new Date(engagement.prospectiveSince).toLocaleDateString()}` : "Waiting for the first instrumented flow"}><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Connected engagements" value={engagement.createdFlows} detail={`${engagement.createdUsers} unique users`} tone="green" /><Metric label="Time to engagement" value={engagement.medianHoursToCreate === null ? "Not available" : `${engagement.medianHoursToCreate}h`} detail={engagement.p75HoursToCreate === null ? "No completed flows yet" : `P75 ${engagement.p75HoursToCreate}h`} /><Metric label="First-session completion" value={rate(engagement.firstSession.rate)} detail={`${engagement.firstSession.completed} of ${engagement.firstSession.started} started sessions`} tone="purple" /><Metric label="7-day completion" value={rate(engagement.sevenDay.rate)} detail={`${engagement.sevenDay.completed} of ${engagement.sevenDay.eligible} eligible accounts`} tone="blue" /></div><div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]"><div><p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Composer conversion</p><div className="space-y-3">{engagement.steps.map((item) => <div key={item.step} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 text-sm"><span className="capitalize">{item.step}</span><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${engagement.steps[0]?.flows ? Math.max(2, item.flows / engagement.steps[0].flows * 100) : 0}%` }} /></div><span className="text-xs font-semibold tabular-nums">{item.flows} flows · {item.users} users</span></div>)}</div></div><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Second meaningful action</p><p className="mt-2 text-2xl font-bold">{rate(engagement.followThrough.rate)}</p><p className="mt-1 text-xs text-muted-foreground">{engagement.followThrough.users} of {engagement.followThrough.eligible} users acted within 7 days after their first real client.</p>{engagement.failures.length ? <div className="mt-4 space-y-2">{engagement.failures.slice(0, 5).map((failure) => <div key={`${failure.code}-${failure.entryPoint}`} className="flex justify-between text-xs"><span>{failure.code} · {failure.entryPoint}</span><span className="font-bold">{failure.count}</span></div>)}</div> : <p className="mt-4 text-xs text-muted-foreground">No creation failures recorded.</p>}</div></div></Panel>;
}

function FunnelTab({ funnel, retry, loading, error }: { funnel: Funnel | null; retry: () => void; loading: boolean; error: string }) {
  if (!funnel) return <FunnelUnavailable message={error} retry={retry} loading={loading} />;
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">Funnel</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Where users stop</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">The same accounts as Overview, split by acquisition source and depth of use. A source with a high signup count and a low qualification rate is sending the wrong traffic.</p></div><EngagementFunnelPanel engagement={funnel.engagement ?? emptyEngagement()} /><div className="grid gap-6 xl:grid-cols-2"><Panel title="Qualification by acquisition source"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Source</th><th className="pb-3">Signups</th><th className="pb-3">Qualified</th><th className="pb-3">Rate</th></tr></thead><tbody className="divide-y divide-border">{funnel.qualification.sourceBreakdown.map((row) => <tr key={row.source}><td className="py-3 font-medium text-card-foreground">{row.source}</td><td className="py-3">{row.signups}</td><td className="py-3">{row.qualified}</td><td className="py-3 font-semibold">{rate(row.signups ? Math.round(row.qualified / row.signups * 1000) / 10 : null)}</td></tr>)}</tbody></table>{!funnel.qualification.sourceBreakdown.length ? <Empty text="No acquisition data yet." /> : null}</div></Panel><Panel title="Workflow depth"><div className="space-y-4">{funnel.workflowDepth.buckets.map((bucket) => <div key={bucket.label}><div className="mb-1 flex justify-between text-sm"><span>{bucket.label}</span><span className="font-semibold">{bucket.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-blue-500" style={{ width: `${funnel.qualification.qualified ? bucket.count / funnel.qualification.qualified * 100 : 0}%` }} /></div></div>)}<p className="pt-2 text-xs text-muted-foreground">Deep activation requires 3+ meaningful modules, 2 active days, and a connected workflow.</p></div></Panel><Panel title="Retention and activity"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">WAU</p><p className="mt-1 text-2xl font-bold">{funnel.activeUsers.wau}</p></div><div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">MAU</p><p className="mt-1 text-2xl font-bold">{funnel.activeUsers.mau}</p></div><div className="rounded-xl border border-border p-4 sm:col-span-2"><p className="text-xs text-muted-foreground">W1 retention</p><p className="mt-1 text-2xl font-bold">{funnel.retention.available ? rate(funnel.retention.rate) : "Cohort not mature"}</p><p className="mt-1 text-xs text-muted-foreground">{funnel.retention.definition}</p></div></div></Panel><Panel title="Activation path breakdown"><div className="space-y-3">{[["Native workflow", funnel.activation.native], ["Migration", funnel.activation.migration], ["Portfolio", funnel.activation.portfolio]].map(([label, value]) => <div key={String(label)} className="flex justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm"><span>{label}</span><span className="font-bold">{value}</span></div>)}</div></Panel><Panel title="Why they stop"><p className="mb-3 text-sm text-muted-foreground">{funnel.dropOff ? `${funnel.dropOff.unqualified} not qualified · ${funnel.dropOff.qualifiedNotActivated} qualified but not activated` : `${funnel.qualification.qualified - funnel.activation.activated} qualified but not activated`}</p><div className="space-y-2">{(funnel.dropOff?.blockerCounts || []).map((row) => <div key={row.blocker} className="flex justify-between text-sm"><span>{humanBlocker(row.blocker)}</span><span className="font-semibold tabular-nums">{row.count}</span></div>)}{!funnel.dropOff?.blockerCounts.length ? <Empty text="No drop-off reasons yet." /> : null}</div></Panel></div></div>;
}

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [diagnosis, setDiagnosis] = useState<FunnelDiagnosis | null>(null);
  const [timeline, setTimeline] = useState<Array<{ id: string; kind: string; type: string; module: string | null; at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timelineLoading, setTimelineLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchAdmin(`/api/admin/users?page=${page}&search=${encodeURIComponent(search)}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Accounts could not be loaded.");
      setUsers(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accounts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const open = async (user: UserRow) => {
    setSelected(user);
    setDiagnosis(null);
    setTimeline([]);
    setTimelineLoading(true);
    try {
      const response = await fetchAdmin(`/api/admin/users/${user.id}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Timeline could not be loaded.");
      setTimeline(data.timeline || []);
      setDiagnosis(data.funnel || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Timeline could not be loaded.");
    } finally {
      setTimelineLoading(false);
    }
  };

  return <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">Users</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Who has signed up</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Every customer account with its acquisition source, qualification state and last recorded activity. Select a row for that user&rsquo;s event timeline.</p></div><Panel title="Accounts" action={<div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search accounts" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search email or name" className="w-56 pl-9" /></div>}>{error ? <div className="mb-4"><LoadError message={error} onRetry={load} loading={loading} /></div> : null}{loading ? <Loading label="Loading accounts" /> : <><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Account</th><th className="pb-3">Source</th><th className="pb-3">Stage</th><th className="pb-3">Real data</th><th className="pb-3">Last activity</th></tr></thead><tbody className="divide-y divide-border">{users.map((user) => <tr key={user.id} className="cursor-pointer hover:bg-muted/40" tabIndex={0} onClick={() => void open(user)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void open(user); } }}><td className="py-3"><p className="font-semibold text-card-foreground">{user.name || "Unnamed"}</p><p className="text-xs text-muted-foreground">{user.email}</p></td><td className="py-3">{user.attribution?.firstTouchSource || user.attribution?.lastTouchSource || "uncaptured"}</td><td className="py-3">{user.stage === "activated" ? <span className="text-emerald-600">Activated</span> : user.stage === "qualified" ? <span className="text-emerald-600">Qualified</span> : <span className="text-muted-foreground">Registered{user.realData ? " · Has real data" : ""}</span>}</td><td className="py-3">{user.realData ? <span className="text-blue-600">Yes</span> : "No"}</td><td className="py-3">{ago(user.lastActivity?.at)}</td></tr>)}</tbody></table>{!users.length ? <Empty text="No users match this search." /> : null}</div><div className="mt-5 flex items-center justify-between text-xs text-muted-foreground"><span>{total} accounts</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><span>Page {page}</span><Button type="button" variant="outline" size="sm" disabled={page * 25 >= total} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div></>}</Panel>{selected ? <Panel title={selected.email} eyebrow="Funnel diagnosis" action={<Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>Close</Button>}><div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]"><div className="space-y-2 text-sm"><p><span className="text-muted-foreground">Funnel stage:</span> {diagnosis ? STAGE_COPY[diagnosis.stage] || diagnosis.stage : "Loading"}</p><p><span className="text-muted-foreground">Product guidance:</span> {diagnosis?.productGuidanceStage || "—"} <span className="text-xs text-muted-foreground">(in-app milestones, not the funnel)</span></p>{diagnosis?.qualificationBlockers.length ? <p>Missing for qualification: {diagnosis.qualificationBlockers.map(humanBlocker).join(", ")}</p> : null}{diagnosis && !diagnosis.qualified && diagnosis.activation.native ? <p>Native path would already count</p> : null}{diagnosis?.activation.blockers.length && diagnosis.qualified ? <p>Missing for activation: {diagnosis.activation.blockers.map(humanBlocker).join(", ")}</p> : null}{diagnosis ? <p><span className="text-muted-foreground">Workspace:</span> {diagnosis.workspace.clients} clients · {diagnosis.workspace.projects} projects · {diagnosis.workspace.invoices} invoices · {diagnosis.workspace.expenses} expenses · {diagnosis.workspace.calendarEvents} calendar</p> : null}<p><span className="text-muted-foreground">Goal:</span> {selected.goal || "Not recorded"}</p><p><span className="text-muted-foreground">Starting path:</span> {selected.startingPath || "Not recorded"}</p><p><span className="text-muted-foreground">Source:</span> {selected.attribution?.firstTouchSource || "Not recorded"}</p><p><span className="text-muted-foreground">Verified:</span> {selected.emailVerified ? "Yes" : "No"}</p></div><div className="max-h-80 space-y-2 overflow-y-auto">{timelineLoading ? <Loading label="Loading timeline" /> : timeline.map((event) => <div key={event.id} className="rounded-xl border border-border px-3 py-2"><div className="flex justify-between gap-3"><span className="text-sm font-medium">{event.type}</span><span className="text-xs text-muted-foreground">{ago(event.at)}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.module || event.kind}</p></div>)}{!timelineLoading && !timeline.length ? <Empty text="No timeline events yet." /> : null}</div></div></Panel> : null}</div>;
}

const FEEDBACK_STATUSES = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "reviewing", label: "Reviewing" },
  { key: "planned", label: "Planned" },
  { key: "closed", label: "Closed" },
] as const;

/** A 1–5 rating read at a glance rather than parsed from "3/5". */
function RatingDots({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`Rated ${rating} out of 5`}>
      <span className="sr-only">Rated {rating} out of 5</span>
      {[1, 2, 3, 4, 5].map((value) => (
        <span
          key={value}
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${value <= rating ? (rating >= 4 ? "bg-emerald-500" : rating === 3 ? "bg-amber-500" : "bg-red-500") : "bg-border"}`}
        />
      ))}
      <span className={`ml-1 text-xs font-bold tabular-nums ${rating >= 4 ? "text-emerald-600" : rating === 3 ? "text-amber-600" : "text-red-600"}`}>{rating}</span>
    </span>
  );
}

function FeedbackStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FeedbackTab() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status, page: String(page) });
      if (search) params.set("search", search);
      const response = await fetchAdmin(`/api/admin/feedback?${params.toString()}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Feedback could not be loaded.");
      setItems(data.data || []);
      setSummary(data.summary || null);
      setTotal(data.total || 0);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feedback could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const update = async (id: string, next: string) => {
    setSaving(id);
    try {
      const response = await fetchAdmin("/api/admin/feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id, status: next }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Feedback status could not be updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feedback status could not be updated.");
    } finally {
      setSaving("");
    }
  };

  const filtered = Boolean(search) || status !== "all";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary">Feedback</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Submitted feedback</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every entry keeps the module it came from, the rating, and whether the person agreed to be contacted. Status changes save
          immediately. Accounts may send one entry a day, so this is a queue of distinct voices rather than a firehose.
        </p>
      </div>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FeedbackStat label="Total" value={String(summary.counts.all || 0)} hint="All time" />
          <FeedbackStat label="Awaiting triage" value={String(summary.counts.new || 0)} hint="Status is still New" />
          <FeedbackStat
            label="Average rating"
            value={summary.averageRating === null ? "—" : `${summary.averageRating}`}
            hint={summary.ratedCount ? `${summary.ratedCount} rated` : "No ratings yet"}
          />
          <FeedbackStat label="Contactable" value={String(summary.contactable)} hint="Agreed to follow-up" />
        </div>
      ) : null}

      <Panel
        title="Inbox"
        action={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search feedback"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search notes, people, modules"
              className="w-64 pl-9"
            />
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter feedback by status">
          {FEEDBACK_STATUSES.map((option) => {
            const count = summary?.counts[option.key] ?? 0;
            return (
              <Button
                key={option.key}
                type="button"
                variant={status === option.key ? "default" : "outline"}
                size="sm"
                aria-pressed={status === option.key}
                onClick={() => { setStatus(option.key); setPage(1); }}
                className="rounded-full"
              >
                {option.label}
                {count > 0 ? <span className="ml-1.5 tabular-nums opacity-70">{count}</span> : null}
              </Button>
            );
          })}
        </div>

        {error ? <div className="mb-4"><LoadError message={error} onRetry={load} loading={loading} /></div> : null}

        {loading ? (
          <Loading label="Loading feedback" />
        ) : items.length === 0 ? (
          <Empty text={filtered ? "No feedback matches this view. Try another status, or clear the search." : "No feedback has arrived yet."} />
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => (
                <article key={item.id} className={`rounded-2xl border p-4 transition ${item.status === "new" ? "border-primary/30 bg-primary/[0.03]" : "border-border"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-card-foreground">{item.user?.name || item.user?.email || "Anonymous account"}</p>
                        {item.rating ? <RatingDots rating={item.rating} /> : null}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{item.module || "workspace"}</span>
                        <span>{item.promptKey || item.feedbackType}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()}>{ago(item.createdAt)}</time>
                      </p>
                    </div>
                    <Select
                      aria-label={`Status for feedback from ${item.user?.email || "an anonymous account"}`}
                      value={item.status}
                      disabled={saving === item.id}
                      onChange={(event) => void update(item.id, event.target.value)}
                    >
                      <option value="new">New</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="planned">Planned</option>
                      <option value="closed">Closed</option>
                    </Select>
                  </div>

                  {item.body ? (
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-card-foreground/85">{item.body}</p>
                  ) : (
                    <p className="mt-3 text-sm italic text-muted-foreground">Rating only — no note left.</p>
                  )}

                  {/* Contact permission is only useful next to a way to act on it. */}
                  <div className="mt-3 border-t border-border pt-3 text-xs">
                    {item.contactAllowed && item.user?.email ? (
                      <a className="font-semibold text-primary hover:underline" href={`mailto:${item.user.email}?subject=${encodeURIComponent("Your Rive feedback")}`}>
                        Reply to {item.user.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{item.contactAllowed ? "Contact permitted" : "No contact permission"}</span>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{total} {filtered ? "matching" : ""} entr{total === 1 ? "y" : "ies"}</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
                <span>Page {page}</span>
                <Button type="button" variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function Reliability({ funnel, retry, loading, error }: { funnel: Funnel | null; retry: () => void; loading: boolean; error: string }) {
  if (!funnel) return <FunnelUnavailable message={error} retry={retry} loading={loading} />;
  const quality = funnel.quality;
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">Reliability</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Is the product actually working</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Delivery and instrumentation health. If email is failing here, signups look slow on every other tab for a reason that has nothing to do with demand.</p></div>{error ? <LoadError message={error} onRetry={retry} loading={loading} /> : null}<div className="grid gap-4 sm:grid-cols-3"><Metric label="Failed emails / 24h" value={funnel.reliability.failedEmails24h} detail={funnel.reliability.failedEmails24h > 0 ? "Password resets and verification links are affected" : "Delivery is healthy"} tone={funnel.reliability.failedEmails24h > 0 ? "red" : "green"} /><Metric label="Queued email jobs" value={funnel.reliability.queuedEmails} detail={funnel.reliability.queuedEmails > 0 ? "Waiting in the outbox to be retried" : "Outbox is empty"} tone={funnel.reliability.queuedEmails > 0 ? "amber" : "blue"} /><Metric label="Product events / 24h" value={funnel.reliability.productEvents24h} detail={funnel.quality.eventLagMinutes === null ? "No events recorded yet" : `Most recent ${funnel.quality.eventLagMinutes}m ago`} tone={funnel.reliability.productEvents24h === 0 ? "amber" : "blue"} /></div><Panel title="Action queue" eyebrow={quality.alerts.length ? `${quality.alerts.length} active signal${quality.alerts.length === 1 ? "" : "s"}` : "No active threshold breaches"}>{quality.alerts.length ? <div className="space-y-3">{quality.alerts.map((item) => <div key={item.fingerprint} className={`rounded-xl border p-4 ${item.severity === "critical" ? "border-red-200 bg-red-50 text-red-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{item.title}</p><span className="rounded-full bg-white/70 px-2 py-1 text-xs font-bold uppercase tracking-wide">{item.severity}</span></div><p className="mt-2 text-sm opacity-80">{item.detail}</p><p className="mt-2 text-xs font-semibold opacity-90">Next: {item.action}</p></div>)}</div> : <p className="text-sm text-muted-foreground">The scheduled funnel-quality check has no active threshold breaches.</p>}</Panel><Panel title="Cohort-quality monitoring" eyebrow={`Event envelope schema v${quality.schemaVersion}`}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Contract rejects / 24h</p><p className="mt-1 text-2xl font-bold">{quality.contractRejections24h}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Unknown event names / 24h</p><p className="mt-1 text-2xl font-bold">{quality.unknownEventNames24h}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Uncaptured signup source</p><p className="mt-1 text-2xl font-bold">{quality.uncapturedSignups} <span className="text-sm font-normal text-muted-foreground">({rate(quality.uncapturedSignupRate)})</span></p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Missing event identity / 24h</p><p className="mt-1 text-2xl font-bold">{quality.missingIdentityEvents24h}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Missing data origin / 24h</p><p className="mt-1 text-2xl font-bold">{quality.missingDataOriginEvents24h}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Event freshness</p><p className="mt-1 text-2xl font-bold">{quality.eventLagMinutes === null ? "No events" : `${quality.eventLagMinutes}m`}</p></div></div><p className="mt-4 text-xs text-muted-foreground">Unknown-origin business records: {quality.unknownOriginRecords}. Latest event: {quality.latestEventAt ? ago(quality.latestEventAt) : "not recorded"}.</p></Panel><Panel title="When not to trust these numbers"><ul className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2"><li className="rounded-xl bg-muted/50 p-4"><span className="font-semibold text-card-foreground">Event freshness is stale.</span> Analytics writes never block a business action, so a broken pipeline shows up as flat metrics rather than errors. Check freshness above before reading a drop as real.</li><li className="rounded-xl bg-muted/50 p-4"><span className="font-semibold text-card-foreground">Contract rejects are non-zero.</span> Rejected events are discarded, so the funnel undercounts by roughly that amount.</li><li className="rounded-xl bg-muted/50 p-4"><span className="font-semibold text-card-foreground">Uncaptured signup source is high.</span> Those users are counted in totals but cannot be attributed, so the source breakdown understates every channel.</li><li className="rounded-xl bg-muted/50 p-4"><span className="font-semibold text-card-foreground">Emails are failing.</span> Unverified accounts stall before qualifying, which depresses every downstream rate for a delivery reason, not a product one.</li></ul></Panel></div>;
}

function LegacyTab() {
  const [items, setItems] = useState<LegacyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchAdmin("/api/admin/waitlist?page=1&limit=50", { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "The legacy archive could not be loaded.");
      setItems(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The legacy archive could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">Legacy archive</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Pre-launch waitlist</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Read-only. Nobody new enters this list; it is kept so old signups stay traceable and old links keep resolving. These entries are excluded from every metric on the other tabs.</p></div><Panel title="Archived entries">{error ? <LoadError message={error} onRetry={load} loading={loading} /> : loading ? <Loading label="Loading legacy archive" /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Email</th><th className="pb-3">Original source</th><th className="pb-3">Status</th><th className="pb-3">Created</th></tr></thead><tbody className="divide-y divide-border">{items.map((item) => <tr key={item.id}><td className="py-3">{item.email}</td><td className="py-3">{item.type}</td><td className="py-3">{item.registered ? "Registered" : item.status}</td><td className="py-3">{ago(item.created_at)}</td></tr>)}</tbody></table>{!items.length ? <Empty text="No legacy entries." /> : null}</div>}</Panel></div>;
}

function Dashboard({ onLogout, onSessionExpired }: { onLogout: () => void; onSessionExpired: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchAdmin("/api/admin/analytics", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      // A 401 here means the session itself died, so hand the user back to the
      // login form with a reason instead of revoking again and re-rendering the
      // dashboard, which is what turned one expiry into a redirect loop.
      if (response.status === 401) {
        onSessionExpired();
        return;
      }
      if (!response.ok || !data?.success) throw new Error(data?.message || "Funnel metrics could not be loaded.");
      if (!data.data?.productFunnel) throw new Error("The data snapshot is incomplete. Check the Reliability tab after retrying.");
      setFunnel(data.data.productFunnel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Funnel metrics could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const content = tab === "overview"
    ? <Overview funnel={funnel} refresh={load} loading={loading} error={error} />
    : tab === "funnel"
      ? <FunnelTab funnel={funnel} retry={load} loading={loading} error={error} />
      : tab === "users"
        ? <UsersTab />
        : tab === "feedback"
          ? <FeedbackTab />
          : tab === "reliability"
            ? <Reliability funnel={funnel} retry={load} loading={loading} error={error} />
            : <LegacyTab />;

  return <div className="min-h-screen bg-background"><header className="sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4"><div className="flex items-center gap-5"><RiveLogo height={28} /><span className="hidden h-5 w-px bg-border sm:block" /><span className="hidden text-sm font-semibold text-muted-foreground sm:block">Admin workspace</span></div><div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:block">Open beta</span><Button type="button" variant="ghost" size="sm" onClick={onLogout} className="gap-2"><LogOut className="h-4 w-4" /> Sign out</Button></div></div></header><div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-8 lg:flex-row"><aside className="lg:w-52 lg:shrink-0"><nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto lg:flex-col">{tabs.map(({ id, label, icon: Icon }) => <Button type="button" key={id} variant={tab === id ? "default" : "ghost"} size="sm" onClick={() => setTab(id)} className="justify-start whitespace-nowrap"><Icon className="h-4 w-4" />{label}</Button>)}</nav></aside><main className="min-w-0 flex-1">{content}</main></div></div>;
}

export default function AdminPage() {
  useCanonicalHost();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [notice, setNotice] = useState("");

  const checkSession = useCallback(async () => {
    setSessionError("");
    try {
      const response = await fetchAdmin("/api/admin/session", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (!response.ok) throw new Error("The admin session could not be checked.");
      setAuthenticated(true);
    } catch (err) {
      setAuthenticated(null);
      setSessionError(err instanceof Error ? err.message : "The admin session could not be checked.");
    }
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void checkSession(), 0); return () => window.clearTimeout(timer); }, [checkSession]);

  const handleLogout = useCallback(async () => {
    await fetchAdmin("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    setNotice("You have been signed out.");
    setAuthenticated(false);
  }, []);

  // Expiry is not a sign-out: the cookie is already dead, so re-POSTing logout
  // only adds a failing request between the user and the login form.
  const handleSessionExpired = useCallback(() => {
    setNotice("Your admin session expired. Sign in again to continue.");
    setAuthenticated(false);
  }, []);

  if (sessionError) return <main className="grid min-h-screen place-items-center bg-background px-5"><div className="w-full max-w-md"><RiveLogo height={38} /><div className="mt-6"><LoadError message={sessionError} onRetry={() => void checkSession()} /></div></div></main>;
  if (authenticated === null) return <Loading label="Checking admin session" />;
  return authenticated
    ? <Dashboard onLogout={handleLogout} onSessionExpired={handleSessionExpired} />
    : <Login notice={notice} onLogin={() => { setNotice(""); setAuthenticated(true); }} />;
}
