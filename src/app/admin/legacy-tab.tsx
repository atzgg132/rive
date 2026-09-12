"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { ago, Empty, fetchAdmin, LoadError, Loading, Panel, type LegacyRow } from "./shared";

const PAGE_LIMIT = 50;

export function LegacyTab() {
  const [items, setItems] = useState<LegacyRow[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
      if (search) params.set("search", search);
      const response = await fetchAdmin(`/api/admin/waitlist?${params.toString()}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "The legacy archive could not be loaded.");
      setItems(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The legacy archive could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const hasMore = page * PAGE_LIMIT < total;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary">Legacy archive</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Pre-launch waitlist</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Read-only. Nobody new enters this list; it is kept so old signups stay traceable and old links keep resolving. These entries are excluded from every metric on the other tabs.</p>
      </div>
      <Panel
        title="Archived entries"
        action={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search archived entries" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search email" className="w-56 pl-9" />
          </div>
        }
      >
        {error ? <div className="mb-4"><LoadError message={error} onRetry={load} loading={loading} /></div> : null}
        {loading ? <Loading label="Loading legacy archive" /> : (
          <>
            <div className="overflow-x-auto">
              <div className="workspace-table">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="pb-3">Email</th><th className="pb-3">Original source</th><th className="pb-3">Status</th><th className="pb-3">Created</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item) => <tr key={item.id}><td className="py-3">{item.email}</td><td className="py-3">{item.type}</td><td className="py-3">{item.registered ? "Registered" : item.status}</td><td className="py-3 font-mono tabular-nums">{ago(item.created_at)}</td></tr>)}
                  </tbody>
                </table>
              </div>
              {!items.length ? <Empty text={search ? "No archived entries match this search." : "No legacy entries."} /> : null}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{total} {search ? "matching" : ""} entr{total === 1 ? "y" : "ies"}</span>
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
