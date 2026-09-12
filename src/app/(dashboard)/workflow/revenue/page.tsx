"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, ChevronRight, Download, FileText, MoreVertical, Plus, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AnchoredMenu, AnchoredMenuItem, AnchoredMenuSelect, Button, Input, Kicker, PageHeader, PaginationControls, StatusBadge } from "@/components/ui";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { formatMoney } from "@/lib/currency";
import type { PaginationMeta } from "@/lib/pagination";
import { buildCashTrend, buildMonthlyTrend } from "@/utils/revenueTrend";
import InvoiceDetailPanel from "@/components/invoices/InvoiceDetailPanel";
import { canSendInvoice } from "@/utils/invoiceStatus";

type Invoice = {
  id: string;
  client_id: string | null;
  project_id: string | null;
  invoice_number: string;
  status: string;
  currency: string;
  subtotal: string;
  discount_rate: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  amount_paid: string;
  outstanding: string;
  issue_date: string;
  due_date: string | null;
  paid_date: string | null;
  sent_at?: string | null;
  client_name: string | null;
  project_title: string | null;
  contract_id: string | null;
  contract_title: string | null;
  items: Array<{ description: string; quantity: string; unit_price: string; amount: string }>;
};

type CurrencySummary = { currency: string; issued: number; collected: number; outstanding: number; overdue: number; draft: number; invoiceCount: number; paidCount: number; collectionRate: number | null };
type AgingRow = { currency: string; current: number; days30: number; days60: number; days90: number; days90Plus: number; noDueDate: number };
type MonthlyRow = { month: string; currency: string; invoiced: number; collected: number };
type CashMonthRow = { month: string; currency: string; cashReceived: number };
type ClientBalanceRow = { clientId: string | null; client: string; currency: string; invoiced: number; collected: number; outstanding: number };
type AttentionRow = { id: string; invoiceNumber: string; currency: string; status: string; outstanding: number; dueDate: string | null; client: string | null; reason: string };

const INVOICE_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Drafts" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "overdue", label: "Overdue" },
  { value: "partially_paid", label: "Partly paid" },
  { value: "paid", label: "Paid" },
  { value: "voided", label: "Voided" },
] as const;

function dateLabel(value: string | null): string {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// useSearchParams needs a suspense boundary for this route to keep its static
// shell; the inner component owns every query-driven piece of state.
export default function RevenuePage() {
  return (
    <Suspense fallback={<div className="workspace-page min-h-[calc(100vh-8rem)]" />}>
      <RevenueWorkspace />
    </Suspense>
  );
}

function RevenueWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { displayCurrency, convert, formatConverted, ratesStatus } = useCurrency();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summaries, setSummaries] = useState<CurrencySummary[]>([]);
  const [aging, setAging] = useState<AgingRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [cashByMonth, setCashByMonth] = useState<CashMonthRow[]>([]);
  const [clientBalances, setClientBalances] = useState<ClientBalanceRow[]>([]);
  const [attention, setAttention] = useState<AttentionRow[]>([]);
  const [trendMode, setTrendMode] = useState<"cohort" | "cash">("cohort");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // Read from the live query string rather than a useState initializer. The
  // initializer only ran on mount, so clicking an attention row — a client-side
  // navigation to this same route — changed the URL and nothing else.
  const selectedInvoiceId = searchParams.get("invoiceId") || "";
  const clientFilter = searchParams.get("clientId") || "";
  const projectFilter = searchParams.get("projectId") || "";

  const setSelectedInvoice = (id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("invoiceId", id);
    else params.delete("invoiceId");
    const query = params.toString();
    // replace, not push: the panel is transient UI and should not bury the
    // previous page behind a stack of open/close history entries.
    router.replace(query ? `/workflow/revenue?${query}` : "/workflow/revenue", { scroll: false });
  };
  const debouncedSearch = useDebouncedValue(search);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const relatedParams = new URLSearchParams();
      // Deliberately no `id` here. Selecting an invoice opens the detail panel;
      // it must not also collapse the table to a single row.
      if (clientFilter) relatedParams.set("clientId", clientFilter);
      if (projectFilter) relatedParams.set("projectId", projectFilter);
      const relatedQuery = relatedParams.toString();
      const summaryParams = new URLSearchParams();
      if (clientFilter) summaryParams.set("clientId", clientFilter);
      if (projectFilter) summaryParams.set("projectId", projectFilter);
      const summaryQuery = summaryParams.toString();
      const [invoiceResponse, summaryResponse] = await Promise.all([
        fetch(`/api/workflow/invoices?search=${encodeURIComponent(debouncedSearch)}&status=${encodeURIComponent(status)}&page=${page}&pageSize=${pageSize}${relatedQuery ? `&${relatedQuery}` : ""}`, { cache: "no-store", signal }),
        fetch(`/api/workflow/revenue/summary${summaryQuery ? `?${summaryQuery}` : ""}`, { cache: "no-store", signal }),
      ]);
      const invoiceData = await invoiceResponse.json().catch(() => null);
      const summaryData = await summaryResponse.json().catch(() => null);
      if (!invoiceResponse.ok || !invoiceData?.success) throw new Error(invoiceData?.message || "Invoices could not be loaded.");
      setInvoices(invoiceData.invoices || []);
      // buildPagination clamps an out-of-range page server-side. Without
      // adopting that clamp the local page counter drifts, and the Next
      // button then re-requests a page the list is already showing.
      setPagination(invoiceData.pagination || null);
      if (invoiceData.pagination && invoiceData.pagination.page !== page) setPage(invoiceData.pagination.page);
      if (summaryResponse.ok && summaryData?.success) {
        setSummaries(summaryData.currencies || []);
        setAging(summaryData.aging || []);
        setMonthly(summaryData.monthlyRevenue || []);
        setCashByMonth(summaryData.cashByMonth || []);
        setClientBalances(summaryData.byClient || []);
        setAttention(summaryData.attention || []);
      }
    } catch (error) {
      if (signal?.aborted) return;
      toast.error(error instanceof Error ? error.message : "Revenue data could not be loaded.");
    } finally {
      // A superseded request must not clear the spinner the live one is using.
      if (!signal?.aborted) setLoading(false);
    }
  };

  // This effect intentionally refreshes server state when the query controls
  // change; the async loader owns the resulting state updates.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [debouncedSearch, status]);
  // Changing a filter also resets the page, so two loads are queued in the same
  // commit. Aborting the superseded one keeps a slow first response from
  // overwriting the newer page's rows.
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, page, pageSize, clientFilter, projectFilter]);

  const convertedTotal = (field: "issued" | "collected" | "outstanding" | "overdue" | "draft") => {
    let total = 0;
    for (const summary of summaries) {
      const value = convert(summary[field], summary.currency);
      if (value === null) return null;
      total += value;
    }
    return total;
  };
  const invoiced = convertedTotal("issued");
  const collected = convertedTotal("collected");
  const outstanding = convertedTotal("outstanding");
  const overdue = convertedTotal("overdue");
  const drafts = convertedTotal("draft");
  const collectionRate = invoiced !== null && invoiced > 0 && collected !== null ? Math.round((collected / invoiced) * 1000) / 10 : null;
  /* Grouped by month, not by month-and-currency: a trend with two rows for July
     is not a trend, and pairing a currency code with a converted amount printed
     "INR — $12.55". Everything else on this page is already in the display
     currency, so this is too. */
  const monthlyTrend = useMemo(() => buildMonthlyTrend(monthly, convert), [monthly, convert]);
  /* The dated-cash sibling: receipts grouped by payment month. Billed and
     banked answer different questions, so both stay one toggle apart. */
  const cashTrend = useMemo(() => buildCashTrend(cashByMonth, convert), [cashByMonth, convert]);
  const trendIncomplete = trendMode === "cash" ? !cashTrend.complete : !monthlyTrend.complete;

  /* `byClient` arrives per (client, currency) — roll currencies up so a client
     billed in two of them still reads as one row in the owed list. */
  const outstandingByClient = useMemo(() => {
    const merged = new Map<string, { clientId: string | null; client: string; outstanding: number }>();
    for (const row of clientBalances) {
      if (row.outstanding <= 0) continue;
      const converted = convert(row.outstanding, row.currency);
      if (converted === null) continue;
      const key = row.clientId || row.client;
      const entry = merged.get(key) || { clientId: row.clientId, client: row.client, outstanding: 0 };
      entry.outstanding += converted;
      merged.set(key, entry);
    }
    return [...merged.entries()]
      .map(([key, entry]) => ({ key, ...entry }))
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5);
  }, [clientBalances, convert]);

  const refresh = () => { void load(); };

  const sendInvoice = async (invoice: Invoice) => {
    if (!window.confirm(`Send ${invoice.invoice_number} to ${invoice.client_name || "the client"}?`)) return;
    try {
      const response = await fetch(`/api/workflow/invoices/${invoice.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Invoice was not sent.");
      if (!data.delivered && data.publicUrl) {
        await navigator.clipboard.writeText(data.publicUrl).catch(() => undefined);
        toast.success(data.message, { description: `Public link: ${data.publicUrl}` });
      } else {
        toast.success(data.message || "Invoice sent and delivery recorded.");
      }
      refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Invoice was not sent."); }
  };

  const deleteInvoice = async (invoice: Invoice) => {
    if (!window.confirm(`Delete draft ${invoice.invoice_number}?`)) return;
    const response = await fetch(`/api/workflow/invoices?id=${encodeURIComponent(invoice.id)}`, { method: "DELETE" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) toast.error(data?.message || "Invoice could not be deleted.");
    else { toast.success("Draft deleted."); refresh(); }
  };

  const openPdf = (invoice: Invoice) => {
    window.open(`/api/workflow/invoices/${invoice.id}/pdf`, "_blank", "noopener,noreferrer");
  };

  const summaryCards = [
    { label: "Total invoiced", value: invoiced },
    { label: "Collected", value: collected },
    { label: "Outstanding", value: outstanding },
    { label: "Overdue", value: overdue, icon: AlertTriangle, tone: "bg-destructive/10 text-destructive" },
    { label: "Draft pipeline", value: drafts },
  ];

  return (
    <div className="workspace-page min-h-[calc(100vh-8rem)] space-y-7 animate-panel-in">
      <PageHeader title="Revenue & invoices" description="A reliable view of what has been invoiced, collected, and needs attention across every currency." actions={<Link href="/workflow/invoices/new"><Button data-guide-target="revenue-create" variant="default"><Plus className="h-4 w-4" /> Create invoice</Button></Link>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-none border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><Kicker tone="muted" dot={false}>{label}</Kicker>{Icon ? <span className={`grid h-8 w-8 place-items-center rounded-none ${tone}`}><Icon className="h-4 w-4" /></span> : null}</div><p className="mt-4 font-mono text-2xl font-bold tabular-nums tracking-tight">{value === null ? (ratesStatus === "loading" ? "Converting…" : "—") : formatMoney(value, displayCurrency)}</p></div>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-none border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><Kicker>Collection health</Kicker><h2 className="mt-1 text-xl font-semibold">{collectionRate === null ? "—" : `${collectionRate}%`} collected</h2><p className="mt-1 text-sm text-muted-foreground">Collected against issued invoice value, using server-side payment ledger totals.</p></div><Link href="/workflow/invoice-settings" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Invoice settings <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          <div className="mt-6 h-3 overflow-hidden rounded-none bg-muted"><div className="h-full rounded-none bg-success transition-all" style={{ width: `${Math.min(collectionRate || 0, 100)}%` }} /></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">{summaries.map((summary) => <div key={summary.currency} className="rounded-none border border-border/70 bg-background p-3"><div className="flex justify-between text-xs text-muted-foreground"><span>{summary.currency}</span><span>{summary.invoiceCount} invoices</span></div><p className="mt-2 font-mono text-sm font-semibold tabular-nums">{formatConverted(summary.collected, summary.currency) || `${summary.currency} ${summary.collected.toFixed(2)}`}</p><p className="mt-1 text-xs text-muted-foreground">{summary.collectionRate === null ? "No issued value" : `${summary.collectionRate}% collection rate`}</p></div>)}</div>
        </section>
        <section className="rounded-none border border-border bg-card p-5"><Kicker>A/R aging</Kicker><h2 className="mt-1 text-xl font-semibold">Where outstanding money sits</h2><div className="mt-5 space-y-3">{aging.length ? aging.map((row) => {
          const rowOverdue = row.days30 + row.days60 + row.days90 + row.days90Plus;
          const buckets = [
            { label: "1–30", value: row.days30, tone: "bg-warning/50" },
            { label: "31–60", value: row.days60, tone: "bg-warning" },
            { label: "61–90", value: row.days90, tone: "bg-destructive/60" },
            { label: "90+", value: row.days90Plus, tone: "bg-destructive" },
          ];
          const notYetDue = row.current + row.noDueDate;
          return <div key={row.currency} className="rounded-none border border-border/70 p-3"><div className="flex justify-between text-xs font-semibold"><span>{row.currency}</span><span>{formatConverted(rowOverdue, row.currency) || "—"} overdue</span></div>{rowOverdue > 0 ? <div className="mt-3 flex h-2 overflow-hidden rounded-none bg-muted" aria-hidden="true">{buckets.map((bucket) => bucket.value > 0 ? <span key={bucket.label} className={bucket.tone} style={{ width: `${(bucket.value / rowOverdue) * 100}%` }} /> : null)}</div> : null}<div className="mt-3 grid grid-cols-4 gap-2 whitespace-nowrap text-xs text-muted-foreground">{buckets.map((bucket) => <span key={bucket.label}>{bucket.label}<br /><strong className="font-mono tabular-nums text-foreground">{bucket.value.toFixed(0)}</strong></span>)}</div>{notYetDue > 0 ? <p className="mt-2 text-[11px] text-muted-foreground">{formatConverted(notYetDue, row.currency) || `${row.currency} ${notYetDue.toFixed(2)}`} not yet due</p> : null}</div>;
        }) : <p className="rounded-none bg-success/10 p-4 text-sm text-success">No outstanding balances have aged yet.</p>}{outstandingByClient.length ? <div className="border-t border-border/70 pt-3"><h3 className="text-xs font-bold text-foreground">Owed to you, by client</h3><ul className="mt-2 space-y-1">{outstandingByClient.map((row) => <li key={row.key} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-muted-foreground">{row.clientId ? <Link href={`/workflow/revenue?clientId=${row.clientId}`} className="font-medium transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{row.client}</Link> : <span className="font-medium">{row.client}</span>}</span><span className="shrink-0 font-mono font-bold tabular-nums text-warning">{formatMoney(row.outstanding, displayCurrency)}</span></li>)}</ul></div> : null}</div></section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-none border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Kicker>Trend</Kicker>
              <h2 className="mt-1 text-xl font-semibold">{trendMode === "cohort" ? "Monthly invoice activity" : "Monthly cash received"}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {trendMode === "cohort" ? "Invoices grouped by issue month" : "Receipts grouped by payment month"} · last 6 recorded months · {displayCurrency}
              </p>
            </div>
            <div role="group" aria-label="Trend view" className="flex gap-1 rounded-none border border-border p-1">
              {([{ key: "cohort", label: "Billed" }, { key: "cash", label: "Cash received" }] as const).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={trendMode === option.key}
                  onClick={() => setTrendMode(option.key)}
                  className={`rounded-none px-2.5 py-1 text-xs font-bold transition ${trendMode === option.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          {trendMode === "cohort" ? (
            <>
              {/* Two quantities, two lengths, both labelled. The bar compares this
                  month's invoiced value against the largest month in the window;
                  the solid part of it is what has actually been collected. */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-primary/25" /> Invoiced, relative to the busiest month</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-success" /> Paid so far, of that month&apos;s invoices</span>
              </div>
              {monthlyTrend.points.length ? (
                <div className="mt-5 space-y-4">
                  {monthlyTrend.points.map((point) => (
                    <div key={point.month}>
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="text-sm font-semibold">{point.label}</span>
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          <strong className="font-mono font-semibold tabular-nums text-foreground">{formatMoney(point.invoiced, displayCurrency)}</strong> invoiced
                          {point.collectionRate !== null ? ` · ${point.collectionRate}% paid` : ""}
                        </span>
                      </div>
                      <div
                        className="h-2.5 overflow-hidden rounded-none bg-muted"
                        role="img"
                        aria-label={`${point.label}: ${formatMoney(point.invoiced, displayCurrency)} invoiced, ${point.collectionRate === null ? "nothing billed" : `${point.collectionRate}% of it paid`}${point.currencies.length > 1 ? `, across ${point.currencies.join(" and ")}` : ""}`}
                      >
                        {/* A visible sliver for a month that had activity but is
                            dwarfed by another — zero-width would read as no data. */}
                        <div className="h-full rounded-none bg-primary/25" style={{ width: `${point.invoiced > 0 ? Math.max(2, point.share * 100) : 0}%` }}>
                          <div className="h-full rounded-none bg-success" style={{ width: `${point.invoiced > 0 ? Math.min(100, (point.collected / point.invoiced) * 100) : 0}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {!monthlyTrend.complete && <p className="pt-1 text-xs text-muted-foreground">Some months are still converting to {displayCurrency} and are not shown yet.</p>}
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">{ratesStatus === "loading" && monthly.length ? `Converting to ${displayCurrency}…` : "Your monthly trend will appear after the first invoice."}</p>
              )}
            </>
          ) : cashTrend.points.length ? (
            <div className="mt-5 space-y-4">
              {cashTrend.points.map((point) => (
                <div key={point.month}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-sm font-semibold">{point.label}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      <strong className="font-mono font-semibold tabular-nums text-foreground">{formatMoney(point.received, displayCurrency)}</strong> received
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-none bg-muted"
                    role="img"
                    aria-label={`${point.label}: ${formatMoney(point.received, displayCurrency)} received${point.currencies.length > 1 ? `, across ${point.currencies.join(" and ")}` : ""}`}
                  >
                    <div className="h-full rounded-none bg-success" style={{ width: `${point.received > 0 ? Math.max(2, point.share * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
              {trendIncomplete && <p className="pt-1 text-xs text-muted-foreground">Some months are still converting to {displayCurrency} and are not shown yet.</p>}
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">No dated receipts yet — cash appears here when payments are recorded.</p>
          )}
        </section>
        <section className="rounded-none border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <Kicker>Attention queue</Kicker>
              <h2 className="mt-1 text-xl font-semibold">Next best actions</h2>
            </div>
            {attention.length ? <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs font-bold tabular-nums text-muted-foreground">{attention.length}</span> : null}
          </div>
          {/* Every item is reachable. This used to render the first five of up
              to twelve with nothing to indicate the rest existed. */}
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            {attention.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedInvoice(item.id)}
                className="flex w-full items-center justify-between gap-3 rounded-none border border-border/70 px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono text-sm font-semibold tabular-nums">{item.invoiceNumber} · {item.client || "No client"}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.reason} · {dateLabel(item.dueDate)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 font-mono text-sm font-semibold tabular-nums">
                  {formatConverted(item.outstanding, item.currency) || `${item.currency} ${item.outstanding.toFixed(2)}`}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </span>
              </button>
            ))}
            {!attention.length ? <p className="rounded-none bg-success/10 p-4 text-sm text-success">Nothing urgent in the invoice queue.</p> : null}
          </div>
        </section>
      </div>

      <section className="rounded-none border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <Kicker>Invoice workspace</Kicker>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">All invoices</h2>
              {clientFilter || projectFilter ? <Link href="/workflow/revenue" className="text-xs font-semibold text-primary hover:underline">Clear filter</Link> : null}
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <label className="relative flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoices, clients…" className="w-full pl-9 sm:w-56" aria-label="Search invoices" />
            </label>
            <AnchoredMenuSelect label="Status" value={status} options={INVOICE_STATUS_OPTIONS} onChange={setStatus} className="min-w-[11rem]" />
          </div>
        </div>
        {loading ? <div className="p-10 text-center text-sm text-muted-foreground">Loading invoices…</div> : !invoices.length ? <div className="p-10 text-center"><FileText className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 font-semibold">No invoices match this view</p><p className="mt-1 text-sm text-muted-foreground">Create a draft in the invoice workspace to get started.</p><Link href="/workflow/invoices/new" className="mt-4 inline-flex"><Button className="gap-2" variant="default"><Plus className="h-4 w-4" /> Create invoice</Button></Link></div> : <div className="table-scroll-region"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Client / project</th><th className="px-5 py-3">Due</th><th className="px-5 py-3 text-right">Amount due</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border">{invoices.map((invoice) => <tr id={`invoice-${invoice.id}`} key={invoice.id} className="transition hover:bg-muted/20"><td className="px-5 py-4"><button type="button" onClick={() => setSelectedInvoice(invoice.id)} className="text-left font-mono font-semibold tabular-nums text-foreground transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{invoice.invoice_number}</button><p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">Issued {dateLabel(invoice.issue_date)}</p></td><td className="px-5 py-4"><p className="font-medium">{invoice.client_name || "No client"}</p><p className="mt-1 text-xs text-muted-foreground">{invoice.project_title || "General services"}</p></td><td className="px-5 py-4 font-mono tabular-nums text-muted-foreground">{dateLabel(invoice.due_date)}</td><td className="px-5 py-4 text-right"><p className="font-mono font-semibold tabular-nums">{formatConverted(Number(invoice.outstanding), invoice.currency) || `${invoice.currency} ${Number(invoice.outstanding).toFixed(2)}`}</p>{Number(invoice.amount_paid) > 0 ? <p className="mt-1 font-mono text-xs tabular-nums text-success">{formatConverted(Number(invoice.amount_paid), invoice.currency) || `${invoice.currency} ${Number(invoice.amount_paid).toFixed(2)}`} paid</p> : null}{invoice.currency !== displayCurrency ? <p className="mt-1 text-xs font-medium text-muted-foreground">Originally {formatMoney(Number(invoice.total), invoice.currency)}</p> : null}</td><td className="px-5 py-4"><StatusBadge kind="invoice" value={invoice.status} /></td><td className="relative px-5 py-4 text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setSelectedInvoice(invoice.id)}>Open</Button><AnchoredMenu
  open={openMenu === invoice.id}
  onOpenChange={(open) => setOpenMenu(open ? invoice.id : null)}
  aria-label={"Actions for " + invoice.invoice_number}
  trigger={
    <Button data-guide-target={canSendInvoice(invoice.status) ? "revenue-send" : undefined} variant="ghost" size="icon-sm" aria-label={"Actions for " + invoice.invoice_number}>
      <MoreVertical className="h-4 w-4" />
    </Button>
  }
>
  <AnchoredMenuItem onClick={() => { openPdf(invoice); setOpenMenu(null); }}>
    <Download className="h-4 w-4" /> Download PDF
  </AnchoredMenuItem>
  {canSendInvoice(invoice.status) ? (
    <AnchoredMenuItem className="text-info data-[highlighted]:bg-info/10 data-[highlighted]:text-info" onClick={() => { setOpenMenu(null); void sendInvoice(invoice); }}>
      <Send className="h-4 w-4" /> Send invoice
    </AnchoredMenuItem>
  ) : null}
  {invoice.status === "draft" && !invoice.contract_id ? (
    <AnchoredMenuItem className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive" onClick={() => { setOpenMenu(null); void deleteInvoice(invoice); }}>
      <Trash2 className="h-4 w-4" /> Delete draft
    </AnchoredMenuItem>
  ) : null}
</AnchoredMenu>
</div></td></tr>)}</tbody></table></div>}
        {pagination && pagination.total > 0 ? <PaginationControls pagination={pagination} loading={loading} label="invoices" onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} /> : null}
      </section>

      {selectedInvoiceId ? (
        <InvoiceDetailPanel
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoice(null)}
          onChanged={refresh}
        />
      ) : null}

      <p className="text-center text-xs text-muted-foreground">All totals are calculated from the server-side invoice and payment ledger. {ratesStatus === "ready" ? `Converted to ${displayCurrency} for display.` : "Original currencies are shown while exchange rates load."}</p>
    </div>
  );
}
