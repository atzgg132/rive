"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CalendarDays, Check, Copy, ExternalLink, RefreshCw, Settings2 } from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";

// Shared Google Calendar + Apple feed connections UI, used by both the
// Calendar page's "Calendar connections" modal and Settings -> Integrations.
// Self-contained: it loads and mutates its own state so either caller can
// mount it without threading calendar-page-local state through props.

type Connection = {
  id: string;
  provider: string;
  accountEmail: string | null;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
  externalCalendars: Array<{ id: string; name: string; color: string | null; selected: boolean; accessRole: string | null }>;
};

type SyncOutboxSummary = { pending: number; failed: number };

function connectionStatusLabel(status: string): string {
  if (status === "connected") return "Connected";
  if (status === "needs_reconnect") return "Reconnect needed";
  return "Sync error";
}

function connectionStatusVariant(status: string): "success" | "warning" | "destructive" {
  if (status === "connected") return "success";
  if (status === "needs_reconnect") return "warning";
  return "destructive";
}

export function CalendarConnectionsPanel({ onChange }: { onChange?: () => void } = {}) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [outbox, setOutbox] = useState<SyncOutboxSummary>({ pending: 0, failed: 0 });
  const [googleCalendarAvailable, setGoogleCalendarAvailable] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const connectionResponse = await fetch("/api/calendar/connections", { cache: "no-store" });
      const connectionData = await connectionResponse.json();
      setConnections(connectionData.connections || []);
      setOutbox(connectionData.outbox || { pending: 0, failed: 0 });
      setGoogleCalendarAvailable(connectionData.connectorAvailability?.googleCalendar === true);
    } catch {
      toast.error("Calendar connections could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const googleConnections = connections.filter((connection) => connection.provider === "google");

  async function syncGoogle(connectionId: string) {
    setSyncing(true);
    try {
      const response = await fetch("/api/calendar/connections/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Synchronization failed.");
      toast.success("Google Calendar is up to date.");
      await load();
      onChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Synchronization failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectConnection(connection: Connection) {
    const label = connection.accountEmail || "this Google account";
    if (!window.confirm(`Disconnect ${label}? Calendars and events imported from it are removed from rive. Your Google Calendar itself is unchanged.`)) return;
    const response = await fetch(`/api/calendar/connections?id=${encodeURIComponent(connection.id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message || "The connection could not be removed.");
    toast.success("Google account disconnected.");
    await load();
    onChange?.();
  }

  async function toggleExternalCalendar(externalCalendarId: string, selected: boolean) {
    const response = await fetch("/api/calendar/connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalCalendarId, selected }),
    });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message || "Calendar selection could not be changed.");
    toast.success(selected ? "Calendar added to rive." : "Calendar hidden from rive.");
    await load();
    onChange?.();
  }

  async function createAppleFeed() {
    const response = await fetch("/api/calendar/subscription", { method: "POST" });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message || "Apple feed could not be created.");
    setFeedUrl(data.webcalUrl);
    toast.success("Private Apple Calendar feed created.");
  }

  async function copyFeed() {
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function revokeAppleFeed() {
    const response = await fetch("/api/calendar/subscription", { method: "DELETE" });
    if (!response.ok) return toast.error("Apple Calendar feed could not be revoked.");
    setFeedUrl("");
    toast.success("Private Apple Calendar feed revoked.");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading calendar connections…</p>;

  return (
    <div className="space-y-4">
      {googleCalendarAvailable && <section className="rounded-none border border-border p-4">
        <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="grid h-10 w-10 place-items-center rounded-none border border-border bg-card"><RefreshCw className="h-5 w-5 text-primary" /></div><div><p className="text-sm font-black text-foreground">Google calendar</p><p className="mt-1 text-xs text-muted-foreground">Two-way events, continuous updates, and calendar discovery.</p></div></div><a href="/api/calendar/connections/google/start" className="rounded-none bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">{googleConnections.length ? "Add account" : "Connect"}</a></div>
        {googleConnections.map((connection) => <div key={connection.id} className="mt-4 rounded-none bg-muted p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="flex flex-wrap items-center gap-2 text-xs font-bold text-foreground"><span className="truncate">{connection.accountEmail}</span><Badge variant={connectionStatusVariant(connection.status)}>{connectionStatusLabel(connection.status)}</Badge></p><p className="mt-0.5 text-xs text-muted-foreground">{connection.lastSyncedAt ? `Synced ${new Date(connection.lastSyncedAt).toLocaleString()}` : "Initial sync pending"}</p></div><div className="flex shrink-0 items-center gap-2">{connection.status !== "connected" && <a href="/api/calendar/connections/google/start" className="rounded-none bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground">Reconnect</a>}<Button variant="outline" size="sm" onClick={() => void syncGoogle(connection.id)} disabled={syncing} className="inline-flex items-center gap-1.5"><RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />Sync now</Button><Button variant="outline" size="sm" onClick={() => void disconnectConnection(connection)} className="text-destructive hover:bg-destructive/10">Disconnect</Button></div></div>{connection.externalCalendars.length > 0 && <div className="mt-3 grid gap-1 border-t border-border pt-2">{connection.externalCalendars.map((calendar) => <label key={calendar.id} className="flex cursor-pointer items-center gap-2 rounded-none px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[.05]"><Input type="checkbox" checked={calendar.selected} onChange={(event) => void toggleExternalCalendar(calendar.id, event.target.checked)} /><span className="h-2.5 w-2.5 rounded-full" style={{ background: calendar.color || "#4285F4" }} /><span className="min-w-0 flex-1 truncate">{calendar.name}</span><span className="text-xs uppercase text-muted-foreground">{calendar.accessRole}</span></label>)}</div>}{connection.lastError && <div className="mt-2 flex gap-2 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{connection.lastError}</div>}</div>)}
        {outbox.failed > 0 && <p className="mt-3 flex gap-2 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{outbox.failed} calendar {outbox.failed === 1 ? "change" : "changes"} could not reach Google and stopped retrying. Reconnect the account or sync again.</p>}
        {outbox.pending > 0 && <p className="mt-2 text-xs text-muted-foreground">{outbox.pending} calendar {outbox.pending === 1 ? "change is" : "changes are"} waiting to sync to Google.</p>}
      </section>}
      <section className="rounded-none border border-border p-4">
        <div className="flex gap-3"><div className="grid h-10 w-10 place-items-center rounded-none bg-foreground text-background"><CalendarDays className="h-5 w-5" /></div><div><p className="text-sm font-black text-foreground">Apple calendar</p><p className="mt-1 text-xs text-muted-foreground">Subscribe to a private, read-only feed of rive. events and deadlines.</p></div></div>
        {!feedUrl ? <Button variant="outline" onClick={() => void createAppleFeed()} className="mt-4 w-full text-xs font-bold">Create private apple feed</Button> : <div className="mt-4"><div className="flex gap-2"><Input readOnly value={feedUrl} className="min-w-0 flex-1 font-mono text-xs tabular-nums" /><Button variant="outline" size="sm" onClick={() => void copyFeed()} className="px-3">{copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}</Button><a href={feedUrl} className="grid place-items-center rounded-none bg-foreground px-3 text-background"><ExternalLink className="h-4 w-4" /></a></div><div className="mt-2 flex items-start justify-between gap-3"><p className="text-xs leading-4 text-muted-foreground">Treat this URL like a password. Regenerating it revokes the previous feed.</p><Button onClick={() => void revokeAppleFeed()} className="shrink-0 text-xs font-bold text-destructive hover:underline">Revoke feed</Button></div></div>}
      </section>
      <div className="rounded-none border border-warning/25 bg-warning/10 p-3 text-xs leading-4 text-warning"><Settings2 className="mr-1 inline h-3.5 w-3.5" />Full Apple two-way sync requires encrypted iCloud CalDAV credentials or the future native companion app. The subscription feed is deliberately read-only.</div>
    </div>
  );
}
