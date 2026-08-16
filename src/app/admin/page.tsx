"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Activity, AlertCircle, BarChart3, ChevronLeft, ChevronRight, Clock3, Loader2, LogOut, MessageSquare, RefreshCw, Search, Shield, Users, Zap } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import RiveLogo from "@/components/RiveLogo";
import PasswordInput from "@/components/PasswordInput";

type Funnel = {
  definitionVersion: string;
  generatedAt: string;
  signups: { total: number; verified: number; last24h: number; last7d: number; daily: Array<{ day: string; count: number }> };
  qualification: { qualified: number; rate: number | null; sourceBreakdown: Array<{ source: string; signups: number; qualified: number }> };
  activation: { activated: number; rate: number | null; native: number; migration: number; portfolio: number; pathBreakdown: Array<{ path: string; count: number }> };
  deepActivation: { deeplyActivated: number; rateAmongActivated: number | null; averageModules: number; usersWithTwoActiveDays: number; connectedWorkflows: number };
  realData: { users: number; records: number };
  activeUsers: { wau: number; mau: number };
  retention: { available: boolean; numerator: number; denominator: number; rate: number | null; definition: string };
  workflowDepth: { averageModules: number; buckets: Array<{ label: string; count: number }> };
  reliability: { productEvents24h: number; failedEmails24h: number; queuedEmails: number };
  quality: { schemaVersion: number; contractRejections24h: number; unknownEventNames24h: number; missingIdentityEvents24h: number; missingDataOriginEvents24h: number; unknownOriginRecords: number; latestEventAt: string | null; eventLagMinutes: number | null; uncapturedSignups: number; uncapturedSignupRate: number | null };
};

type UserRow = { id: string; email: string; name: string | null; createdAt: string; emailVerified: boolean; onboardingStatus: string; businessType: string | null; profession: string | null; goal: string | null; startingPath: string | null; qualified: boolean; realData: boolean; attribution: { firstTouchSource: string | null; lastTouchSource: string | null; firstTouchMedium: string | null; firstTouchCampaign: string | null; referralSource: string | null } | null; lastActivity: { at: string; eventName: string; module: string | null } | null };
type FeedbackRow = { id: string; promptKey: string | null; feedbackType: string; module: string | null; rating: number | null; body: string | null; contactAllowed: boolean; status: string; createdAt: string; user: { email: string; name: string | null } | null };
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

async function fetchAdmin(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The admin request timed out. Retry to continue.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function Loading({ label = "Loading admin data" }: { label?: string }) {
  return <div className="grid min-h-40 place-items-center gap-3 text-sm text-muted-foreground" role="status" aria-live="polite"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span>{label}</span></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>;
}

function Panel({ title, eyebrow, action, children }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4"><div>{eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p> : null}<h2 className="mt-1 text-base font-semibold text-card-foreground">{title}</h2></div>{action}</div><div className="p-5">{children}</div></section>;
}

function LoadError({ message, onRetry, loading = false }: { message: string; onRetry: () => void; loading?: boolean }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900" role="alert"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" /><div className="min-w-0"><p className="font-semibold">This admin data is temporarily unavailable.</p><p className="mt-1 text-sm text-red-800/80">{message}</p><Button type="button" variant="outline" size="sm" onClick={onRetry} disabled={loading} className="mt-4 border-red-200 bg-white text-red-800 hover:bg-red-100">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Try again</Button></div></div></div>;
}

function FunnelUnavailable({ message, retry, loading }: { message: string; retry: () => void; loading: boolean }) {
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">Product operations</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">The control room is online; funnel data needs a retry.</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">The session is valid, but the measurement query did not return a complete snapshot. Existing account and feedback tabs remain available.</p></div><LoadError message={message} onRetry={retry} loading={loading} /></div>;
}

function Login({ onLogin }: { onLogin: () => void }) {
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

  return <main className="grid min-h-screen place-items-center bg-background px-5 py-8"><div className="w-full max-w-sm"><div className="mb-8 flex justify-center"><RiveLogo height={38} /></div><form onSubmit={submit} className="rounded-3xl border border-border bg-card p-8 shadow-xl"><div className="mb-7 text-center"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Shield className="h-6 w-6" /></div><h1 className="text-2xl font-bold text-card-foreground">Admin workspace</h1><p className="mt-1 text-sm text-muted-foreground">Product operations and funnel quality</p></div><label className="mb-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Username<Input value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" autoFocus className="mt-2" /></label><label className="mb-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password<PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" className="mt-2" /></label>{error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}<Button type="submit" variant="default" size="lg" disabled={loading} className="w-full">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}{loading ? "Signing in…" : "Sign in securely"}</Button><p className="mt-5 text-center text-xs text-muted-foreground">Protected by an HttpOnly session cookie.</p></form><div className="mt-4 flex justify-end"><ThemeToggle /></div></div></main>;
}

function Metric({ label, value, detail, tone = "blue" }: { label: string; value: string | number; detail: string; tone?: "blue" | "green" | "amber" | "purple" }) {
  const colors = { blue: "text-blue-600 bg-blue-50 border-blue-100", green: "text-emerald-600 bg-emerald-50 border-emerald-100", amber: "text-amber-600 bg-amber-50 border-amber-100", purple: "text-violet-600 bg-violet-50 border-violet-100" };
  return <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className={`mb-5 grid h-10 w-10 place-items-center rounded-xl border ${colors[tone]}`}><Activity className="h-5 w-5" /></div><p className="text-3xl font-bold tracking-tight text-card-foreground">{value}</p><p className="mt-1 text-sm font-semibold text-card-foreground">{label}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function Overview({ funnel, refresh, loading, error }: { funnel: Funnel | null; refresh: () => void; loading: boolean; error: string }) {
  if (!funnel) return <FunnelUnavailable message={error} retry={refresh} loading={loading} />;
  const stages = [["Registered", funnel.signups.total, "100%"], ["Qualified", funnel.qualification.qualified, rate(funnel.qualification.rate)], ["Activated", funnel.activation.activated, rate(funnel.activation.rate)], ["Deeply activated", funnel.deepActivation.deeplyActivated, rate(funnel.deepActivation.rateAmongActivated)]] as Array<[string, number, string]>;
  return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-primary">Product operations / open beta</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Know where the product is earning trust.</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Qualified users show intent. Activated users complete a real value path. Deep activation requires repeat, cross-module behavior.</p></div><Button type="button" variant="outline" size="sm" onClick={refresh} disabled={loading} className="gap-2">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Refresh</Button></div>{error ? <LoadError message={error} onRetry={refresh} loading={loading} /> : null}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Signups" value={fmt(funnel.signups.total)} detail={`+${funnel.signups.last24h} today · +${funnel.signups.last7d} this week`} /><Metric label="Qualified" value={fmt(funnel.qualification.qualified)} detail={`${rate(funnel.qualification.rate)} of signups`} tone="purple" /><Metric label="Activated" value={fmt(funnel.activation.activated)} detail={`${rate(funnel.activation.rate)} of qualified`} tone="green" /><Metric label="Deeply activated" value={fmt(funnel.deepActivation.deeplyActivated)} detail={`${rate(funnel.deepActivation.rateAmongActivated)} of activated`} tone="amber" /><Metric label="Real-data users" value={fmt(funnel.realData.users)} detail={`${fmt(funnel.realData.records)} classified records`} /></div><div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><Panel title="The north-star funnel" eyebrow="Union-based cutover metrics"><div className="space-y-4">{stages.map(([label, value, detail], index) => <div key={label} className="flex items-center gap-4"><div className="w-28 text-sm font-medium text-card-foreground">{label}</div><div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${["bg-slate-400", "bg-blue-500", "bg-emerald-500", "bg-violet-500"][index]}`} style={{ width: `${funnel.signups.total ? Math.max(2, value / funnel.signups.total * 100) : 0}%` }} /></div><div className="w-28 text-right text-sm font-semibold text-card-foreground">{fmt(value)} <span className="text-xs font-normal text-muted-foreground">{detail}</span></div></div>)}</div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">WAU / MAU</p><p className="mt-1 text-lg font-bold text-card-foreground">{funnel.activeUsers.wau} / {funnel.activeUsers.mau}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">W1 retention</p><p className="mt-1 text-lg font-bold text-card-foreground">{funnel.retention.available ? rate(funnel.retention.rate) : "Not available"}</p></div><div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Avg modules</p><p className="mt-1 text-lg font-bold text-card-foreground">{funnel.deepActivation.averageModules}</p></div></div></Panel><Panel title="Activation paths" eyebrow="Union, not additive"><div className="space-y-4">{funnel.activation.pathBreakdown.length ? funnel.activation.pathBreakdown.map((item) => <div key={item.path} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"><span className="capitalize text-sm font-medium text-card-foreground">{item.path}</span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{item.count}</span></div>) : <Empty text="No qualified users have activated yet." />}</div></Panel></div><p className="text-xs text-muted-foreground">Definition contract {funnel.definitionVersion} · generated {new Date(funnel.generatedAt).toLocaleString()}.</p></div>;
}

function FunnelTab({ funnel, retry, loading, error }: { funnel: Funnel | null; retry: () => void; loading: boolean; error: string }) {
  if (!funnel) return <FunnelUnavailable message={error} retry={retry} loading={loading} />;
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">Funnel and cohort diagnostics</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Find the leak before adding more features.</h1></div><div className="grid gap-6 xl:grid-cols-2"><Panel title="Acquisition source → qualification"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Source</th><th className="pb-3">Signups</th><th className="pb-3">Qualified</th><th className="pb-3">Rate</th></tr></thead><tbody className="divide-y divide-border">{funnel.qualification.sourceBreakdown.map((row) => <tr key={row.source}><td className="py-3 font-medium text-card-foreground">{row.source}</td><td className="py-3">{row.signups}</td><td className="py-3">{row.qualified}</td><td className="py-3 font-semibold">{rate(row.signups ? Math.round(row.qualified / row.signups * 1000) / 10 : null)}</td></tr>)}</tbody></table>{!funnel.qualification.sourceBreakdown.length ? <Empty text="No acquisition data yet." /> : null}</div></Panel><Panel title="Workflow depth"><div className="space-y-4">{funnel.workflowDepth.buckets.map((bucket) => <div key={bucket.label}><div className="mb-1 flex justify-between text-sm"><span>{bucket.label}</span><span className="font-semibold">{bucket.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-blue-500" style={{ width: `${funnel.qualification.qualified ? bucket.count / funnel.qualification.qualified * 100 : 0}%` }} /></div></div>)}<p className="pt-2 text-xs text-muted-foreground">Deep activation requires 3+ meaningful modules, 2 active days, and a connected workflow.</p></div></Panel><Panel title="Retention and activity"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">WAU</p><p className="mt-1 text-2xl font-bold">{funnel.activeUsers.wau}</p></div><div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">MAU</p><p className="mt-1 text-2xl font-bold">{funnel.activeUsers.mau}</p></div><div className="rounded-xl border border-border p-4 sm:col-span-2"><p className="text-xs text-muted-foreground">W1 retention</p><p className="mt-1 text-2xl font-bold">{funnel.retention.available ? rate(funnel.retention.rate) : "Cohort not mature"}</p><p className="mt-1 text-xs text-muted-foreground">{funnel.retention.definition}</p></div></div></Panel><Panel title="Activation path breakdown"><div className="space-y-3">{[["Native workflow", funnel.activation.native], ["Migration", funnel.activation.migration], ["Portfolio", funnel.activation.portfolio]].map(([label, value]) => <div key={String(label)} className="flex justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm"><span>{label}</span><span className="font-bold">{value}</span></div>)}</div></Panel></div></div>;
}

function UsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<UserRow | null>(null);
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

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const open = async (user: UserRow) => {
    setSelected(user);
    setTimeline([]);
    setTimelineLoading(true);
    try {
      const response = await fetchAdmin(`/api/admin/users/${user.id}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Timeline could not be loaded.");
      setTimeline(data.timeline || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Timeline could not be loaded.");
    } finally {
      setTimelineLoading(false);
    }
  };

  return <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">User explorer</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Inspect the journey, not just the count.</h1></div><Panel title="Accounts" action={<div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search accounts" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search email or name" className="w-56 pl-9" /></div>}>{error ? <div className="mb-4"><LoadError message={error} onRetry={load} loading={loading} /></div> : null}{loading ? <Loading label="Loading accounts" /> : <><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Account</th><th className="pb-3">Source</th><th className="pb-3">Qualification</th><th className="pb-3">Real data</th><th className="pb-3">Last activity</th></tr></thead><tbody className="divide-y divide-border">{users.map((user) => <tr key={user.id} className="cursor-pointer hover:bg-muted/40" tabIndex={0} onClick={() => void open(user)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void open(user); } }}><td className="py-3"><p className="font-semibold text-card-foreground">{user.name || "Unnamed"}</p><p className="text-xs text-muted-foreground">{user.email}</p></td><td className="py-3">{user.attribution?.firstTouchSource || user.attribution?.lastTouchSource || "uncaptured"}</td><td className="py-3">{user.qualified ? <span className="text-emerald-600">Qualified</span> : <span className="text-muted-foreground">Not yet</span>}</td><td className="py-3">{user.realData ? <span className="text-blue-600">Yes</span> : "No"}</td><td className="py-3">{ago(user.lastActivity?.at)}</td></tr>)}</tbody></table>{!users.length ? <Empty text="No users match this search." /> : null}</div><div className="mt-5 flex items-center justify-between text-xs text-muted-foreground"><span>{total} accounts</span><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><span>Page {page}</span><Button type="button" variant="outline" size="sm" disabled={page * 25 >= total} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div></>}</Panel>{selected ? <Panel title={selected.email} eyebrow="User timeline" action={<Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>Close</Button>}><div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><div className="space-y-2 text-sm"><p><span className="text-muted-foreground">Goal:</span> {selected.goal || "Not recorded"}</p><p><span className="text-muted-foreground">Starting path:</span> {selected.startingPath || "Not recorded"}</p><p><span className="text-muted-foreground">Source:</span> {selected.attribution?.firstTouchSource || "Not recorded"}</p><p><span className="text-muted-foreground">Verified:</span> {selected.emailVerified ? "Yes" : "No"}</p></div><div className="max-h-80 space-y-2 overflow-y-auto">{timelineLoading ? <Loading label="Loading timeline" /> : timeline.map((event) => <div key={event.id} className="rounded-xl border border-border px-3 py-2"><div className="flex justify-between gap-3"><span className="text-sm font-medium">{event.type}</span><span className="text-xs text-muted-foreground">{ago(event.at)}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.module || event.kind}</p></div>)}{!timelineLoading && !timeline.length ? <Empty text="No timeline events yet." /> : null}</div></div></Panel> : null}</div>;
}

function FeedbackTab() {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchAdmin(`/api/admin/feedback?status=${status}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Feedback could not be loaded.");
      setItems(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feedback could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const update = async (id: string, next: string) => {
    try {
      const response = await fetchAdmin("/api/admin/feedback", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id, status: next }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Feedback status could not be updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feedback status could not be updated.");
    }
  };

  return <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">Voice of customer</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Feedback that can become product decisions.</h1><p className="mt-2 text-sm text-muted-foreground">Triage signal by workflow and intent; this is not a generic survey warehouse.</p></div><Panel title="Inbox" action={<Select aria-label="Feedback status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="new">New</option><option value="reviewing">Reviewing</option><option value="planned">Planned</option><option value="closed">Closed</option></Select>}>{error ? <div className="mb-4"><LoadError message={error} onRetry={load} loading={loading} /></div> : null}{loading ? <Loading label="Loading feedback" /> : <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-2xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">{item.user?.name || item.user?.email || "Anonymous account"}</p><p className="mt-1 text-xs text-muted-foreground">{item.promptKey || item.feedbackType} · {item.module || "workspace"} · {ago(item.createdAt)}</p></div><div className="flex items-center gap-2">{item.rating ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">{item.rating}/5</span> : null}<Select aria-label={`Status for ${item.user?.email || "feedback"}`} value={item.status} onChange={(event) => void update(item.id, event.target.value)}><option value="new">New</option><option value="reviewing">Reviewing</option><option value="planned">Planned</option><option value="closed">Closed</option></Select></div></div>{item.body ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-foreground/80">{item.body}</p> : null}<p className="mt-3 text-xs text-muted-foreground">{item.contactAllowed ? "Contact permitted" : "No contact permission"}</p></article>)}{!items.length ? <Empty text="No feedback has arrived yet." /> : null}</div>}</Panel></div>;
}

function Reliability({ funnel, retry, loading, error }: { funnel: Funnel | null; retry: () => void; loading: boolean; error: string }) {
  if (!funnel) return <FunnelUnavailable message={error} retry={retry} loading={loading} />;
  const quality = funnel.quality;
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-primary">Reliability and instrumentation</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">A free product still needs operational truth.</h1></div>{error ? <LoadError message={error} onRetry={retry} loading={loading} /> : null}<div className="grid gap-4 sm:grid-cols-3"><Metric label="Product events / 24h" value={funnel.reliability.productEvents24h} detail="Append-only analytics writes" /><Metric label="Failed emails / 24h" value={funnel.reliability.failedEmails24h} detail="Delivery needs attention" tone="amber" /><Metric label="Queued email jobs" value={funnel.reliability.queuedEmails} detail="Outbox backlog" tone="purple" /></div><Panel title="Cohort-quality monitoring" eyebrow={`Event envelope schema v${quality.schemaVersion}`}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Contract rejects / 24h</p><p className="mt-1 text-2xl font-bold">{quality.contractRejections24h}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Unknown event names / 24h</p><p className="mt-1 text-2xl font-bold">{quality.unknownEventNames24h}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Uncaptured signup source</p><p className="mt-1 text-2xl font-bold">{quality.uncapturedSignups} <span className="text-sm font-normal text-muted-foreground">({rate(quality.uncapturedSignupRate)})</span></p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Missing event identity / 24h</p><p className="mt-1 text-2xl font-bold">{quality.missingIdentityEvents24h}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Missing data origin / 24h</p><p className="mt-1 text-2xl font-bold">{quality.missingDataOriginEvents24h}</p></div><div className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Event freshness</p><p className="mt-1 text-2xl font-bold">{quality.eventLagMinutes === null ? "No events" : `${quality.eventLagMinutes}m`}</p></div></div><p className="mt-4 text-xs text-muted-foreground">Unknown-origin business records: {quality.unknownOriginRecords}. Latest event: {quality.latestEventAt ? ago(quality.latestEventAt) : "not recorded"}.</p></Panel><Panel title="Operating rules"><div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2"><p className="rounded-xl bg-muted/50 p-4">Analytics failures never make a successful business mutation fail. Inspect event freshness and contract rejects before trusting a percentage.</p><p className="rounded-xl bg-muted/50 p-4">New records carry data origin. Unknown-origin legacy rows stay excluded until explicitly classified.</p><p className="rounded-xl bg-muted/50 p-4">Verification is enforced for new accounts with a verification-required timestamp; existing accounts remain usable.</p><p className="rounded-xl bg-muted/50 p-4">Invoice sends freeze a snapshot and append delivery, view, and payment history.</p></div></Panel></div>;
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
  return <div className="space-y-6"><div><p className="text-sm font-semibold text-muted-foreground">Historical compatibility</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Legacy waitlist archive</h1><p className="mt-2 text-sm text-muted-foreground">No new visitors enter this funnel. Keep it for audit, migration, and old links.</p></div><Panel title="Archived entries">{error ? <LoadError message={error} onRetry={load} loading={loading} /> : loading ? <Loading label="Loading legacy archive" /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Email</th><th className="pb-3">Original source</th><th className="pb-3">Status</th><th className="pb-3">Created</th></tr></thead><tbody className="divide-y divide-border">{items.map((item) => <tr key={item.id}><td className="py-3">{item.email}</td><td className="py-3">{item.type}</td><td className="py-3">{item.registered ? "Registered" : item.status}</td><td className="py-3">{ago(item.created_at)}</td></tr>)}</tbody></table>{!items.length ? <Empty text="No legacy entries." /> : null}</div>}</Panel></div>;
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
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
      if (response.status === 401) {
        onLogout();
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
  }, [onLogout]);

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
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [sessionError, setSessionError] = useState("");

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
    setAuthenticated(false);
  }, []);

  if (sessionError) return <main className="grid min-h-screen place-items-center bg-background px-5"><div className="w-full max-w-md"><RiveLogo height={38} /><div className="mt-6"><LoadError message={sessionError} onRetry={() => void checkSession()} /></div></div></main>;
  if (authenticated === null) return <Loading label="Checking admin session" />;
  return authenticated ? <Dashboard onLogout={handleLogout} /> : <Login onLogin={() => setAuthenticated(true)} />;
}
