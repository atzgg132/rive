"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Loader2, Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { ago, Empty, fetchAdmin, humanBlocker, LoadError, Loading, Panel, STAGE_COPY, type FunnelDiagnosis, type UserFacets, type UserRow } from "./shared";

const STAGE_CHIPS = [
  { key: "all", label: "All" },
  { key: "registered", label: "Not qualified" },
  { key: "qualified", label: "Qualified" },
  { key: "activated", label: "Activated" },
  { key: "deeply_activated", label: "Deeply activated" },
] as const;

function stageLabel(user: UserRow) {
  if (user.deeplyActivated) return <span className="text-success">Deeply activated</span>;
  if (user.stage === "activated") return <span className="text-success">Activated</span>;
  if (user.stage === "qualified") return <span className="text-success">Qualified</span>;
  return <span className="text-muted-foreground">Registered{user.realData ? " · Has real data" : ""}</span>;
}

function deepSummary(diagnosis: FunnelDiagnosis): string {
  const deep = diagnosis.deepActivation;
  if (diagnosis.deeplyActivated && deep) return `Deeply activated — ${deep.moduleCount} modules · ${deep.activeDays} active days · workflow connected`;
  if (!diagnosis.activated) return "Not reached — the account has to activate in the funnel first";
  if (!deep) return "Not reached";
  const missing = [
    deep.moduleCount < 3 ? `${deep.moduleCount}/3 modules` : null,
    deep.activeDays < 2 ? `${deep.activeDays}/2 active days` : null,
    !deep.connectedWorkflow ? "no connected workflow" : null,
  ].filter(Boolean);
  return `Not reached — ${missing.join(", ")}`;
}

export function UsersTab() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stage = searchParams.get("stage") || "all";
  const verified = searchParams.get("verified") || "";
  const realData = searchParams.get("realData") === "true";
  const source = searchParams.get("source") || "";
  const search = searchParams.get("search") || "";

  const [users, setUsers] = useState<UserRow[]>([]);
  const [facets, setFacets] = useState<UserFacets | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [diagnosis, setDiagnosis] = useState<FunnelDiagnosis | null>(null);
  const [timeline, setTimeline] = useState<Array<{ id: string; kind: string; type: string; module: string | null; at: string }>>([]);
  const [calendarConnections, setCalendarConnections] = useState<Array<{ id: string; provider: string; accountEmail: string | null; status: string; lastSyncedAt: string | null; lastError: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState("");
  const detailRef = useRef<HTMLDivElement>(null);
  // Rapid row clicks race: without a sequence guard the slower response wins
  // and shows one user's timeline under another user's email.
  const openSeq = useRef(0);

  // Filters live in the URL so Overview drill-downs, reloads and shared links
  // all land on the same cohort. Every filter change also resets pagination.
  const updateParams = useCallback((updates: Record<string, string>) => {
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "users");
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value); else params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const filterQuery = useCallback((includePaging: boolean) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (stage !== "all") params.set("stage", stage);
    if (verified) params.set("verified", verified);
    if (realData) params.set("realData", "true");
    if (source) params.set("source", source);
    if (includePaging) {
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
    }
    return params.toString();
  }, [search, stage, verified, realData, source, page, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchAdmin(`/api/admin/users?${filterQuery(true)}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Accounts could not be loaded.");
      setUsers(data.data || []);
      setTotal(data.total || 0);
      setHasMore(Boolean(data.hasMore));
      setFacets(data.facets || null);
      setSources(data.sources || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accounts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filterQuery]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) updateParams({ search: next });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, updateParams]);

  // Adjust state during render (not in an effect) when the URL changes outside
  // this component — a drill-down link, a shared URL or browser back/forward.
  const filtersKey = `${stage}|${verified}|${realData}|${source}|${search}`;
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (prevFiltersKey !== filtersKey) {
    setPrevFiltersKey(filtersKey);
    setSearchInput(search);
    setPage(1);
  }

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const open = async (user: UserRow) => {
    const seq = ++openSeq.current;
    setSelected(user);
    setDiagnosis(null);
    setTimeline([]);
    setDetailError("");
    setTimelineLoading(true);
    try {
      const response = await fetchAdmin(`/api/admin/users/${user.id}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (seq !== openSeq.current) return;
      if (!response.ok || !data?.success) throw new Error(data?.message || "Timeline could not be loaded.");
      setTimeline(data.timeline || []);
      setDiagnosis(data.funnel || null);
      setCalendarConnections(data.calendarConnections || []);
    } catch (err) {
      if (seq === openSeq.current) setDetailError(err instanceof Error ? err.message : "Timeline could not be loaded.");
    } finally {
      if (seq === openSeq.current) setTimelineLoading(false);
    }
  };

  // The diagnosis panel renders below the table, so a row click that does not
  // also scroll it into view reads as "nothing happened" — the exact report
  // from the prod walkthrough.
  useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const copyEmails = async () => {
    setCopying(true);
    setCopied("");
    try {
      const response = await fetchAdmin(`/api/admin/users?export=emails&${filterQuery(false)}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Emails could not be exported.");
      await navigator.clipboard.writeText((data.emails || []).join("\n"));
      setCopied(`Copied ${data.emails.length} email${data.emails.length === 1 ? "" : "s"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Emails could not be exported.");
    } finally {
      setCopying(false);
    }
  };

  const filtered = Boolean(search) || stage !== "all" || Boolean(verified) || realData || Boolean(source);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary">Users</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Who has signed up</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Every customer account with its acquisition source, funnel stage and last recorded activity. Select a row for that user&rsquo;s event timeline.</p>
      </div>
      <Panel
        title="Accounts"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search accounts" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search email or name" className="w-56 pl-9" /></div>
            <Button type="button" variant="outline" size="sm" onClick={() => void copyEmails()} disabled={copying || !total} className="gap-2">
              {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              {copied || `Copy ${total} email${total === 1 ? "" : "s"}`}
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter accounts by funnel stage">
          {STAGE_CHIPS.map((option) => {
            const count = facets?.[option.key as keyof UserFacets] ?? 0;
            return (
              <Button key={option.key} type="button" variant={stage === option.key ? "default" : "outline"} size="sm" aria-pressed={stage === option.key} onClick={() => updateParams({ stage: option.key === "all" ? "" : option.key })} className="rounded-full">
                {option.label}
                {count > 0 ? <span className="ml-1.5 tabular-nums opacity-70">{count}</span> : null}
              </Button>
            );
          })}
          <Button type="button" variant={verified === "false" ? "default" : "outline"} size="sm" aria-pressed={verified === "false"} onClick={() => updateParams({ verified: verified === "false" ? "" : "false" })} className="rounded-full">
            Unverified
            {facets && facets.unverified > 0 ? <span className="ml-1.5 tabular-nums opacity-70">{facets.unverified}</span> : null}
          </Button>
          <Button type="button" variant={realData ? "default" : "outline"} size="sm" aria-pressed={realData} onClick={() => updateParams({ realData: realData ? "" : "true" })} className="rounded-full">
            Has real data
            {facets && facets.realData > 0 ? <span className="ml-1.5 tabular-nums opacity-70">{facets.realData}</span> : null}
          </Button>
          <Select aria-label="Filter by acquisition source" value={source || "all"} onChange={(event) => updateParams({ source: event.target.value === "all" ? "" : event.target.value })} className="ml-1">
            <option value="all">All sources</option>
            {sources.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </div>
        {error ? <div className="mb-4"><LoadError message={error} onRetry={load} loading={loading} /></div> : null}
        {loading ? <Loading label="Loading accounts" /> : (
          <>
            <div className="overflow-x-auto">
              <div className="workspace-table">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Account</th><th className="pb-3">Source</th><th className="pb-3">Stage</th><th className="pb-3">Real data</th><th className="pb-3">Last activity</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {users.map((user) => (
                      <tr key={user.id} className="cursor-pointer hover:bg-muted/40" tabIndex={0} onClick={() => void open(user)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void open(user); } }}>
                        <td className="py-3"><p className="font-semibold text-card-foreground">{user.name || "Unnamed"}</p><p className="text-xs text-muted-foreground">{user.email}</p></td>
                        <td className="py-3">{user.attribution?.firstTouchSource || user.attribution?.lastTouchSource || "uncaptured"}</td>
                        <td className="py-3">{stageLabel(user)}</td>
                        <td className="py-3">{user.realData ? <span className="text-primary">Yes</span> : "No"}</td>
                        <td className="py-3 font-mono tabular-nums">{ago(user.lastActivity?.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!users.length ? <Empty text={filtered ? "No accounts match these filters." : "No users match this search."} /> : null}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{total} {filtered ? "matching" : ""} account{total === 1 ? "" : "s"}</span>
              <div className="flex items-center gap-2">
                <Select aria-label="Rows per page" value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                  <option value="25">25 / page</option>
                  <option value="50">50 / page</option>
                </Select>
                <Button type="button" variant="outline" size="sm" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
                <span>Page {page}</span>
                <Button type="button" variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => setPage((value) => value + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </>
        )}
      </Panel>
      {selected ? (
        <div ref={detailRef}>
          <Panel title={selected.email} eyebrow="Funnel diagnosis" action={<Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)} autoFocus>Close</Button>}>
            {detailError ? <div className="mb-4"><LoadError message={detailError} onRetry={() => void open(selected)} loading={timelineLoading} /></div> : null}
            <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Funnel stage:</span> {diagnosis ? (diagnosis.deeplyActivated ? "Deeply activated" : STAGE_COPY[diagnosis.stage] || diagnosis.stage) : "Loading"}</p>
                <p><span className="text-muted-foreground">Deep activation:</span> {diagnosis ? deepSummary(diagnosis) : "Loading"}</p>
                <p><span className="text-muted-foreground">Product guidance:</span> {diagnosis?.productGuidanceStage || "—"} <span className="text-xs text-muted-foreground">(in-app milestones, not the funnel)</span></p>
                {diagnosis?.qualificationBlockers.length ? <p>Missing for qualification: {diagnosis.qualificationBlockers.map(humanBlocker).join(", ")}</p> : null}
                {diagnosis && !diagnosis.qualified && diagnosis.activation.native ? <p>Native path would already count</p> : null}
                {diagnosis?.activation.blockers.length && diagnosis.qualified ? <p>Missing for activation: {diagnosis.activation.blockers.map(humanBlocker).join(", ")}</p> : null}
                {diagnosis ? <p><span className="text-muted-foreground">Workspace:</span> {diagnosis.workspace.clients} clients · {diagnosis.workspace.projects} projects · {diagnosis.workspace.invoices} invoices · {diagnosis.workspace.expenses} expenses · {diagnosis.workspace.calendarEvents} calendar</p> : null}
                <p><span className="text-muted-foreground">Goal:</span> {selected.goal || "Not recorded"}</p>
                <p><span className="text-muted-foreground">Starting path:</span> {selected.startingPath || "Not recorded"}</p>
                <p><span className="text-muted-foreground">Source:</span> {selected.attribution?.firstTouchSource || "Not recorded"}</p>
                <p><span className="text-muted-foreground">Verified:</span> {selected.emailVerified ? "Yes" : "No"}</p>
                {calendarConnections.length ? (
                  <div>
                    <p className="text-muted-foreground">Calendar connections:</p>
                    <ul className="mt-1 space-y-1">
                      {calendarConnections.map((connection) => (
                        <li key={connection.id} className="rounded-none border border-border px-2 py-1.5 text-xs">
                          <span className="font-medium">{connection.accountEmail || connection.provider}</span>
                          <span className={`ml-2 font-bold ${connection.status === "connected" ? "text-success" : "text-destructive"}`}>{connection.status}</span>
                          <span className="ml-2 text-muted-foreground">{connection.lastSyncedAt ? `synced ${ago(connection.lastSyncedAt)}` : "never synced"}</span>
                          {connection.lastError ? <p className="mt-0.5 text-destructive">{connection.lastError}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto">
                {timelineLoading ? <Loading label="Loading timeline" /> : timeline.map((event) => <div key={event.id} className="rounded-none border border-border px-3 py-2"><div className="flex justify-between gap-3"><span className="text-sm font-medium">{event.type}</span><span className="text-xs text-muted-foreground">{ago(event.at)}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.module || event.kind}</p></div>)}
                {!timelineLoading && !timeline.length ? <Empty text="No timeline events yet." /> : null}
              </div>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
