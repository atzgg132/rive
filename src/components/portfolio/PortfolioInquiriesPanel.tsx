"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Ban,
  Check,
  CornerUpLeft,
  Inbox,
  Mail,
  MailOpen,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Input, Skeleton } from "@/components/ui";
import type {
  PortfolioInquiryDetail,
  PortfolioInquiryStatus,
  PortfolioInquirySummary,
} from "@/utils/portfolioInquiries";

/**
 * The enquiry inbox.
 *
 * Reading and triage only. Replies open the owner's own mail client, because a
 * message that lands in a prospective client's inbox from a real address is
 * worth more than one sent from an app — and because an outbound composer is a
 * much larger commitment than this tranche should make.
 */

type StatusFilter = PortfolioInquiryStatus | "all";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "Unread" },
  { key: "read", label: "Read" },
  { key: "replied", label: "Replied" },
  { key: "archived", label: "Archived" },
  { key: "spam", label: "Spam" },
];

const STATUS_BADGE: Record<PortfolioInquiryStatus, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
  new: { label: "Unread", variant: "default" },
  read: { label: "Read", variant: "secondary" },
  replied: { label: "Replied", variant: "success" },
  archived: { label: "Archived", variant: "secondary" },
  spam: { label: "Spam", variant: "destructive" },
};

function formatWhen(value: string) {
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PortfolioInquiriesPanel({ onUnreadChange }: { onUnreadChange?: (unread: number) => void }) {
  const [inquiries, setInquiries] = useState<PortfolioInquirySummary[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [notificationFailures, setNotificationFailures] = useState(0);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<PortfolioInquiryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState("");

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status, page: String(page) });
      if (search) params.set("search", search);
      const response = await fetch(`/api/portfolio/inquiries?${params.toString()}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Could not load your enquiries.");
      setInquiries(data.inquiries as PortfolioInquirySummary[]);
      setCounts(data.counts as Record<string, number>);
      setTotal(data.total as number);
      setHasMore(Boolean(data.hasMore));
      setNotificationFailures(data.notificationFailures as number);
      onUnreadChange?.(data.unread as number);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load your enquiries.");
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange, page, search, status]);

  // Deferred by a tick for the same reason as the analytics panel: the fetch
  // sets its own loading state, which must not happen in the effect body.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openInquiry = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/portfolio/inquiries/${id}`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Could not open this enquiry.");
      const detail = data.inquiry as PortfolioInquiryDetail;
      setSelected(detail);
      // Opening a message marks it read, the way an inbox does. The list is
      // refreshed so the badge and filter counts follow immediately.
      if (detail.status === "new") {
        const marked = await fetch(`/api/portfolio/inquiries/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "read" }),
        });
        const markedData = await marked.json().catch(() => null);
        if (marked.ok && markedData?.success) setSelected(markedData.inquiry as PortfolioInquiryDetail);
        void load();
      }
    } catch (openError) {
      toast.error(openError instanceof Error ? openError.message : "Could not open this enquiry.");
    } finally {
      setDetailLoading(false);
    }
  }, [load]);

  const act = useCallback(
    async (id: string, action: string, successMessage: string) => {
      setPendingAction(action);
      try {
        const response = await fetch(`/api/portfolio/inquiries/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) throw new Error(data?.message || "Could not update this enquiry.");
        setSelected(data.inquiry as PortfolioInquiryDetail);
        toast.success(successMessage);
        await load();
      } catch (actionError) {
        toast.error(actionError instanceof Error ? actionError.message : "Could not update this enquiry.");
      } finally {
        setPendingAction("");
      }
    },
    [load],
  );

  const mailtoHref = useMemo(() => {
    if (!selected) return "";
    const subject = `Re: ${selected.projectType}`;
    const body = `Hi ${selected.name.split(/\s+/)[0] || "there"},\n\n`;
    return `mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [selected]);

  const filters = (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter enquiries by status">
      {STATUS_FILTERS.map((filter) => {
        const count = counts[filter.key === "all" ? "all" : filter.key] || 0;
        return (
          <Button
            key={filter.key}
            type="button"
            aria-pressed={status === filter.key}
            onClick={() => {
              setStatus(filter.key);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${status === filter.key ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {filter.label}
            {count > 0 && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
          </Button>
        );
      })}
    </div>
  );

  if (selected) {
    const badge = STATUS_BADGE[selected.status];
    return (
      <div className="flex flex-col gap-4">
        <Button
          type="button"
          onClick={() => setSelected(null)}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to all enquiries
        </Button>

        <article className="rounded-2xl border border-border bg-card shadow-sm">
          <header className="flex flex-col gap-3 border-b border-border p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-black text-foreground">{selected.projectType}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{selected.name}</span>{" "}
                  <a className="underline underline-offset-2 hover:text-foreground" href={`mailto:${selected.email}`}>{selected.email}</a>
                </p>
              </div>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
            <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
              <div className="flex gap-1.5"><dt className="font-semibold">Received</dt><dd>{formatWhen(selected.createdAt)}</dd></div>
              {selected.sourceProjectTitle && (
                <div className="flex gap-1.5"><dt className="font-semibold">Was reading</dt><dd>{selected.sourceProjectTitle}</dd></div>
              )}
              {selected.sourceProjectId && !selected.sourceProjectTitle && (
                <div className="flex gap-1.5"><dt className="font-semibold">Was reading</dt><dd>A project no longer in your portfolio</dd></div>
              )}
              <div className="flex gap-1.5"><dt className="font-semibold">Source</dt><dd>{selected.referrer || "Direct"}</dd></div>
              {selected.deviceType && <div className="flex gap-1.5"><dt className="font-semibold">Device</dt><dd>{selected.deviceType}</dd></div>}
              {selected.repliedAt && <div className="flex gap-1.5"><dt className="font-semibold">Replied</dt><dd>{formatWhen(selected.repliedAt)}</dd></div>}
            </dl>
          </header>

          {selected.notificationStatus === "failed" && (
            <p role="alert" className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3.5 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 sm:px-6">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong className="font-bold">This enquiry never reached your email.</strong> Rive kept the message here, so nothing was lost.
                {selected.notificationError ? ` Reason: ${selected.notificationError}` : ""}
              </span>
            </p>
          )}
          {selected.notificationStatus === "queued" && (
            <p className="border-b border-border bg-muted/40 px-5 py-3 text-[11px] text-muted-foreground sm:px-6">
              The email notification for this enquiry is still queued for delivery.
            </p>
          )}

          <div className="p-5 sm:p-6">
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{selected.message}</p>
          </div>

          <footer className="flex flex-wrap gap-2 border-t border-border p-5 sm:p-6">
            <a
              href={mailtoHref}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              <CornerUpLeft className="h-3.5 w-3.5" /> Reply by email
            </a>
            {selected.status !== "replied" && (
              <Button
                type="button"
                disabled={Boolean(pendingAction)}
                onClick={() => void act(selected.id, "replied", "Marked as replied")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" /> Mark replied
              </Button>
            )}
            <Button
              type="button"
              disabled={Boolean(pendingAction)}
              onClick={() => void act(selected.id, selected.status === "new" ? "read" : "unread", selected.status === "new" ? "Marked as read" : "Marked as unread")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground disabled:opacity-60"
            >
              {selected.status === "new" ? <MailOpen className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
              {selected.status === "new" ? "Mark read" : "Mark unread"}
            </Button>
            {selected.status === "archived" || selected.status === "spam" ? (
              <Button
                type="button"
                disabled={Boolean(pendingAction)}
                onClick={() => void act(selected.id, "restore", "Moved back to your inbox")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground disabled:opacity-60"
              >
                <Inbox className="h-3.5 w-3.5" /> Move to inbox
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void act(selected.id, "archived", "Archived")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground disabled:opacity-60"
                >
                  <Archive className="h-3.5 w-3.5" /> Archive
                </Button>
                <Button
                  type="button"
                  disabled={Boolean(pendingAction)}
                  onClick={() => void act(selected.id, "spam", "Marked as spam")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-destructive disabled:opacity-60"
                >
                  <Ban className="h-3.5 w-3.5" /> Mark spam
                </Button>
              </>
            )}
          </footer>
        </article>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="font-bold text-foreground">Enquiries</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every message from your public portfolio, saved here whether or not the email notification arrived.
          </p>
        </div>
        <label className="relative w-full lg:w-72">
          <span className="sr-only">Search enquiries</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, email, or message"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary"
          />
        </label>
      </div>

      {filters}

      {notificationFailures > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {notificationFailures} enquiry notification{notificationFailures === 1 ? "" : "s"} could not be delivered to your email address. Nothing was
          lost — {notificationFailures === 1 ? "the message is" : "those messages are"} listed here.
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((index) => (
            <div key={index} className="rounded-2xl border border-border bg-card p-4">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : error ? (
        <section role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <h3 className="text-sm font-bold text-destructive">Your enquiries could not be loaded</h3>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">{error}</p>
          <Button onClick={() => void load()} className="mt-4 rounded-xl bg-destructive px-4 py-2 text-xs font-bold text-white">
            <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" /> Try again
          </Button>
        </section>
      ) : inquiries.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-4 w-4" />}
          title={search || status !== "all" ? "No enquiries match this view" : "No enquiries yet"}
          description={
            search || status !== "all"
              ? "Try a different status filter, or clear your search."
              : "When someone uses the contact form on your published portfolio, their message appears here — and stays here even if the email notification fails."
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {inquiries.map((inquiry) => {
              const badge = STATUS_BADGE[inquiry.status];
              return (
                <li key={inquiry.id}>
                  <Button
                    type="button"
                    disabled={detailLoading}
                    onClick={() => void openInquiry(inquiry.id)}
                    className={`w-full items-start rounded-2xl border p-4 text-left !whitespace-normal transition hover:border-primary/50 disabled:opacity-60 ${inquiry.status === "new" ? "border-primary/30 bg-primary/[0.04]" : "border-border bg-card"}`}
                  >
                    <div className="flex w-full min-w-0 flex-col gap-1.5">
                      <div className="flex w-full flex-wrap items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`truncate text-sm ${inquiry.status === "new" ? "font-black text-foreground" : "font-bold text-foreground"}`}>
                            {inquiry.name}
                          </span>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                          {inquiry.notificationStatus === "failed" && <Badge variant="warning">Email not delivered</Badge>}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{formatWhen(inquiry.createdAt)}</span>
                      </div>
                      <span className="truncate text-xs font-semibold text-primary">{inquiry.projectType}</span>
                      <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{inquiry.excerpt}</span>
                    </div>
                  </Button>
                </li>
              );
            })}
          </ul>

          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-[11px] text-muted-foreground">
                Page {page} · {total} enquir{total === 1 ? "y" : "ies"}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={page === 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground disabled:opacity-40"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  disabled={!hasMore || loading}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground disabled:opacity-40"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
