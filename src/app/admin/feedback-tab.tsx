"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { ago, Empty, fetchAdmin, LoadError, Loading, Panel, type FeedbackRow, type FeedbackSummary } from "./shared";

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
          className={`h-1.5 w-1.5 rounded-full ${value <= rating ? (rating >= 4 ? "bg-success" : rating === 3 ? "bg-warning" : "bg-destructive") : "bg-border"}`}
        />
      ))}
      <span className={`ml-1 text-xs font-bold tabular-nums ${rating >= 4 ? "text-success" : rating === 3 ? "text-warning" : "text-destructive"}`}>{rating}</span>
    </span>
  );
}

function FeedbackStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-none border border-border bg-card px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-card-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FeedbackTab() {
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
                <article key={item.id} className={`rounded-none border p-4 transition ${item.status === "new" ? "border-primary/30 bg-primary/[0.03]" : "border-border"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-card-foreground">{item.user?.name || item.user?.email || "Anonymous account"}</p>
                        {item.rating ? <RatingDots rating={item.rating} /> : null}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                        <span className="rounded-none bg-muted px-1.5 py-0.5 font-medium">{item.module || "workspace"}</span>
                        <span>{item.promptKey || item.feedbackType}</span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString()} className="font-mono tabular-nums">{ago(item.createdAt)}</time>
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
                    <p className="mt-3 whitespace-pre-line text-sm leading-6 text-card-foreground/[0.85]">{item.body}</p>
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
