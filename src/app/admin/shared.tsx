"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { Activity, AlertCircle, BarChart3, Clock3, Loader2, MessageSquare, RefreshCw, Users, Zap } from "lucide-react";
import { Button, Kicker } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { FunnelQualityAlert } from "@/lib/analytics/funnelQuality";

export { trailingTrend } from "@/lib/analytics/adminMetricsMath";

export type Funnel = {
  definitionVersion: string;
  generatedAt: string;
  signups: { total: number; verified: number; last24h: number; last7d: number; daily: Array<{ day: string; count: number }> };
  qualification: { qualified: number; rate: number | null; sourceBreakdown: Array<{ source: string; signups: number; qualified: number }> };
  activation: { activated: number; rate: number | null; native: number; migration: number; portfolio: number; pathBreakdown: Array<{ path: string; count: number }> };
  engagement?: { prospectiveSince: string | null; createdUsers: number; createdFlows: number; medianHoursToCreate: number | null; p75HoursToCreate: number | null; timedUsers?: number; firstSession: { completed: number; started: number; rate: number | null }; sevenDay: { completed: number; eligible: number; rate: number | null }; followThrough: { users: number; eligible: number; rate: number | null }; steps: Array<{ step: string; users: number; flows: number }>; failures: Array<{ code: string; entryPoint: string; count: number }> };
  deepActivation: { deeplyActivated: number; rateAmongActivated: number | null; averageModules: number; usersWithTwoActiveDays: number; connectedWorkflows: number };
  realData: { users: number; records: number };
  activeUsers: { wau: number; mau: number };
  retention: { available: boolean; numerator: number; denominator: number; rate: number | null; definition: string };
  workflowDepth: { averageModules: number; buckets: Array<{ label: string; count: number }> };
  reliability: {
    productEvents24h: number;
    productEvents7d?: number;
    failedEmails24h: number;
    queuedEmails: number;
    migration: {
      sessions24h: number; sessions7d: number; completionRate24h: number | null; completionRate7d: number | null;
      failed24h: number; recoveredRetries7d: number; staleJobs: number; assistanceBacklog: number;
      p50AnalysisMinutes: number | null; p95AnalysisMinutes: number | null; p50CommitMinutes: number | null; p95CommitMinutes: number | null;
      dlqMessages: number | null; failures: Array<{ phase: string; code: string; count: number }>;
    };
  };
  window?: { label: string; signupSparklineDays: number; activationWindowDays: number; deepActivationWindowDays: number };
  dropOff?: { unqualified: number; qualifiedNotActivated: number; blockerCounts: Array<{ blocker: string; count: number }> };
  quality: { schemaVersion: number; contractRejections24h: number; unknownEventNames24h: number; missingIdentityEvents24h: number; missingDataOriginEvents24h: number; unknownOriginRecords: number; latestEventAt: string | null; eventLagMinutes: number | null; uncapturedSignups: number; uncapturedSignupRate: number | null; alerts: FunnelQualityAlert[] };
};

export type UserRow = {
  id: string;
  accountType?: string;
  email: string;
  name: string | null;
  createdAt: string;
  emailVerified: boolean;
  onboardingStatus: string;
  businessType: string | null;
  profession: string | null;
  goal: string | null;
  startingPath: string | null;
  qualified: boolean;
  activated?: boolean;
  deeplyActivated?: boolean;
  deepActivation?: { moduleCount: number; activeDays: number; connectedWorkflow: boolean } | null;
  stage?: "registered" | "qualified" | "activated";
  realData: boolean;
  qualificationBlockers?: string[];
  activationPaths?: string[];
  source?: string;
  attribution: { firstTouchSource: string | null; lastTouchSource: string | null; firstTouchMedium: string | null; firstTouchCampaign: string | null; referralSource: string | null } | null;
  lastActivity: { at: string; eventName: string; module: string | null } | null;
};

export type UserFacets = {
  all: number;
  registered: number;
  qualified: number;
  activated: number;
  deeply_activated: number;
  unverified: number;
  realData: number;
  internal?: number;
};

export type FunnelDiagnosis = {
  stage: string;
  qualified: boolean;
  activated: boolean;
  deeplyActivated?: boolean;
  deepActivation?: { moduleCount: number; activeDays: number; connectedWorkflow: boolean } | null;
  realData: boolean;
  productGuidanceStage: string;
  qualificationBlockers: string[];
  activation: { native: boolean; migration: boolean; portfolio: boolean; paths: string[]; blockers: string[] };
  workspace: { clients: number; projects: number; invoices: number; expenses: number; calendarEvents: number; publishedPortfolios: number };
};

export type FeedbackRow = { id: string; promptKey: string | null; feedbackType: string; module: string | null; rating: number | null; body: string | null; contactAllowed: boolean; status: string; createdAt: string; user: { email: string; name: string | null } | null };
export type FeedbackSummary = { counts: Record<string, number>; averageRating: number | null; ratedCount: number; contactable: number };
export type LegacyRow = { id: number; email: string; type: string; status: string; created_at: string; registered: boolean };
export type Tab = "overview" | "funnel" | "users" | "feedback" | "reliability" | "migration" | "legacy";

export const tabs: Array<{ id: Tab; label: string; icon: typeof BarChart3 }> = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "funnel", label: "Funnel", icon: Zap },
  { id: "users", label: "Users", icon: Users },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "reliability", label: "Reliability", icon: AlertCircle },
  { id: "migration", label: "Migration reliability", icon: Activity },
  { id: "legacy", label: "Legacy archive", icon: Clock3 },
];

export const fmt = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
export const rate = (value: number | null) => value === null ? "Not available" : `${value}%`;
export const ago = (value: string | null | undefined) => {
  if (!value) return "Not recorded";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export const STAGE_COPY: Record<string, string> = { registered: "Registered", qualified: "Qualified", activated: "Activated" };
export const BLOCKER_COPY: Record<string, string> = {
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
export function humanBlocker(value: string) {
  const key = value.replace(/^(qualification|activation):/, "");
  return BLOCKER_COPY[key] || key.replace(/_/g, " ");
}

export async function fetchAdmin(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
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
export function useCanonicalHost(): void {
  useEffect(() => {
    // Match the apex exactly. Anything broader would rewrite dev.rive.work into
    // www.dev.rive.work and strand the environment on a host that does not exist.
    if (window.location.hostname !== "rive.work") return;
    window.location.replace(`https://www.rive.work${window.location.pathname}${window.location.search}`);
  }, []);
}

export function Loading({ label = "Loading admin data" }: { label?: string }) {
  return <div className="grid min-h-40 place-items-center gap-3 text-sm text-muted-foreground" role="status" aria-live="polite"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span>{label}</span></div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

export function Panel({ title, eyebrow, action, children }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-none border border-border bg-card"><div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4"><div>{eyebrow ? <Kicker>{eyebrow}</Kicker> : null}<h2 className="mt-1 text-base font-semibold text-card-foreground">{title}</h2></div>{action}</div><div className="p-5">{children}</div></section>;
}

export function LoadError({ message, onRetry, loading = false }: { message: string; onRetry: () => void; loading?: boolean }) {
  return <div className="rounded-none border border-destructive/25 bg-destructive/10 p-5 text-destructive" role="alert"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><div className="min-w-0"><p className="font-semibold">This admin data is temporarily unavailable.</p><p className="mt-1 text-sm text-destructive/80">{message}</p><Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={loading} className="mt-4 border-destructive/25 text-destructive hover:bg-destructive/10">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Try again</Button></div></div></div>;
}

// Every metrics tab renders this while it has no snapshot. Until a request has
// actually failed that is a first load, not an outage — showing the error card
// during the first second read as "the dashboard is broken" on every visit.
export function FunnelUnavailable({ message, retry, loading, section = "Overview" }: { message: string; retry: () => void; loading: boolean; section?: string }) {
  if (loading || !message) return <Loading label="Loading metrics" />;
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">{section}</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Metrics unavailable</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">You are still signed in — only the metrics query failed. The Users, Feedback and Legacy archive tabs read from different queries and should still work.</p></div><LoadError message={message} onRetry={retry} loading={loading} /></div>;
}

export function Delta({ change, previous }: { change: number | null; previous: number }) {
  // A zero prior week is a real comparison with no defined percentage.
  if (change === null) return <span className="text-xs text-muted-foreground">{previous} in prior 7d</span>;
  const flat = Math.abs(change) < 0.05;
  const tone = flat ? "text-muted-foreground" : change > 0 ? "text-success" : "text-destructive";
  return <span className={`text-xs font-semibold ${tone}`}>{flat ? "flat" : `${change > 0 ? "+" : ""}${change}%`} <span className="font-normal text-muted-foreground">vs {previous} prior 7d</span></span>;
}

export function Sparkline({ daily }: { daily: Array<{ day: string; count: number }> }) {
  if (daily.length < 2) return null;
  const peak = Math.max(...daily.map((day) => day.count), 1);
  const step = 100 / (daily.length - 1);
  const points = daily.map((day, index) => `${index * step},${28 - (day.count / peak) * 26}`).join(" ");
  return <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-8 w-full" role="img" aria-label={`Daily signups over ${daily.length} days, peak ${peak}`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="text-primary" /></svg>;
}

export function Metric({ label, value, detail, tone = "blue", footer, href }: { label: string; value: ReactNode; detail: string; tone?: "blue" | "green" | "amber" | "purple" | "red"; footer?: ReactNode; href?: string }) {
  const colors = { blue: "text-primary bg-primary/10 border-primary/25", green: "text-success bg-success/10 border-success/25", amber: "text-warning bg-warning/10 border-warning/25", purple: "text-accent-foreground bg-accent border-accent", red: "text-destructive bg-destructive/10 border-destructive/25" };
  const card = (
    <div className={cn("rounded-none border border-border bg-card p-5", href && "h-full transition-colors hover:border-primary/50")}>
      <div className={`mb-5 grid h-10 w-10 place-items-center rounded-none border ${colors[tone]}`}><Activity className="h-5 w-5" /></div>
      <p className="font-mono text-3xl font-bold tracking-tight tabular-nums text-card-foreground">{value}</p>
      <p className="mt-1 text-sm font-semibold text-card-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      {footer ? <div className="mt-3 border-t border-border pt-3">{footer}</div> : null}
    </div>
  );
  if (!href) return card;
  return <Link href={href} className="block rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40" title={`Open ${label} in Users`}>{card}</Link>;
}
