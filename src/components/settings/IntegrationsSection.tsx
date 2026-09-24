"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { CalendarConnectionsPanel } from "@/components/settings/CalendarConnectionsPanel";

type ZohoConnection = {
  id: string;
  provider: string;
  accountLabel: string | null;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};

function statusVariant(status: string): "success" | "warning" | "destructive" {
  if (status === "connected") return "success";
  if (status === "needs_reconnect") return "warning";
  return "destructive";
}

function ZohoBooksPanel({ available }: { available: boolean }) {
  const [connections, setConnections] = useState<ZohoConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/connectors", { cache: "no-store" });
      const data = await response.json();
      setConnections((data.connections || []).filter((connection: ZohoConnection) => connection.provider === "zoho_books"));
    } catch {
      toast.error("Zoho Books connections could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!available) return null;

  const sync = async (connectionId: string) => {
    setSyncingId(connectionId);
    try {
      const response = await fetch("/api/connectors/zoho-books/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Sync failed.");
      toast.success("Zoho Books sync started.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setSyncingId(null);
    }
  };

  const disconnect = async (connectionId: string) => {
    if (!window.confirm("Disconnect Zoho Books? Nothing already imported into rive. is removed.")) return;
    const response = await fetch(`/api/connectors?id=${encodeURIComponent(connectionId)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) return toast.error(data.message || "The connection could not be removed.");
    toast.success("Zoho Books disconnected.");
    await load();
  };

  return (
    <section className="rounded-none border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-none border border-border bg-card"><RefreshCw className="h-5 w-5 text-primary" /></div>
          <div><p className="text-sm font-black text-foreground">Zoho Books</p><p className="mt-1 text-xs text-muted-foreground">Bring clients, invoices, and payments into rive.</p></div>
        </div>
        {!loading && connections.length === 0 ? <a href="/api/connectors/zoho-books/start" className="rounded-none bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Connect</a> : null}
      </div>
      {connections.map((connection) => (
        <div key={connection.id} className="mt-4 rounded-none bg-muted p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-foreground"><span className="truncate">{connection.accountLabel || "Zoho Books"}</span><Badge variant={statusVariant(connection.status)}>{connection.status === "connected" ? "Connected" : connection.status === "needs_reconnect" ? "Reconnect needed" : "Sync error"}</Badge></p>
              <p className="mt-0.5 text-xs text-muted-foreground">{connection.lastSyncedAt ? `Synced ${new Date(connection.lastSyncedAt).toLocaleString()}` : "Not synced yet"}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void sync(connection.id)} disabled={syncingId === connection.id} className="inline-flex items-center gap-1.5"><RefreshCw className={`h-3.5 w-3.5 ${syncingId === connection.id ? "animate-spin" : ""}`} />Sync now</Button>
              <Button variant="outline" size="sm" onClick={() => void disconnect(connection.id)} className="text-destructive hover:bg-destructive/10">Disconnect</Button>
            </div>
          </div>
          {connection.lastError ? <div className="mt-2 flex gap-2 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5 shrink-0" />{connection.lastError}</div> : null}
        </div>
      ))}
    </section>
  );
}

export function IntegrationsSection({ zohoBooksAvailable }: { zohoBooksAvailable: boolean }) {
  return (
    <section id="integrations" className="scroll-mt-24 rounded-none border border-border bg-card p-5">
      <h2 className="font-semibold">Integrations</h2>
      <p className="mt-1 text-xs text-muted-foreground">Google Calendar, Apple Calendar, and Zoho Books in one place.</p>
      <div className="mt-5 space-y-4">
        <CalendarConnectionsPanel />
        <ZohoBooksPanel available={zohoBooksAvailable} />
      </div>
    </section>
  );
}
