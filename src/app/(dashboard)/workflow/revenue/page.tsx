"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle, Clock3, Download, FileText, MoreVertical, Plus, Search, Send, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, PageHeader, Select } from "@/components/ui";
import DropdownPortal from "@/components/ui/DropdownPortal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { formatMoney } from "@/lib/currency";
import { buildMonthlyTrend } from "@/utils/revenueTrend";

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
type AttentionRow = { id: string; invoiceNumber: string; currency: string; status: string; outstanding: number; dueDate: string | null; client: string | null; reason: string };

function statusClass(status: string): string {
  if (status === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["sent", "viewed", "partially_paid"].includes(status)) return "border-blue-200 bg-blue-50 text-blue-700";
  if (["overdue", "voided"].includes(status)) return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function dateLabel(value: string | null): string {
  if (!value) return "No due date";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function RevenuePage() {
  const { displayCurrency, convert, formatConverted, ratesStatus } = useCurrency();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summaries, setSummaries] = useState<CurrencySummary[]>([]);
  const [aging, setAging] = useState<AgingRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [attention, setAttention] = useState<AttentionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const load = async () => {
    setLoading(true);
    try {
      const [invoiceResponse, summaryResponse] = await Promise.all([
        fetch(`/api/workflow/invoices?search=${encodeURIComponent(debouncedSearch)}&status=${encodeURIComponent(status)}`, { cache: "no-store" }),
        fetch("/api/workflow/revenue/summary", { cache: "no-store" }),
      ]);
      const invoiceData = await invoiceResponse.json().catch(() => null);
      const summaryData = await summaryResponse.json().catch(() => null);
      if (!invoiceResponse.ok || !invoiceData?.success) throw new Error(invoiceData?.message || "Invoices could not be loaded.");
      setInvoices(invoiceData.invoices || []);
      if (summaryResponse.ok && summaryData?.success) {
        setSummaries(summaryData.currencies || []);
        setAging(summaryData.aging || []);
        setMonthly(summaryData.monthlyRevenue || []);
        setAttention(summaryData.attention || []);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Revenue data could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  // This effect intentionally refreshes server state when the query controls
  // change; the async loader owns the resulting state updates.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [debouncedSearch, status]);

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

  const refresh = () => { void load(); };

  const recordPayment = async (invoice: Invoice) => {
    const amount = window.prompt(`Record a payment for ${invoice.invoice_number}. Outstanding: ${invoice.outstanding} ${invoice.currency}`, invoice.outstanding);
    if (!amount) return;
    const key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${invoice.id}-${Date.now()}`;
    try {
      const response = await fetch(`/api/workflow/invoices/${invoice.id}/payment`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ amount, method: "manual" }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Payment could not be recorded.");
      toast.success(data.duplicate ? "That payment was already recorded." : "Payment recorded.");
      refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Payment could not be recorded."); }
  };

  const sendInvoice = async (invoice: Invoice) => {
    if (!window.confirm(`Send ${invoice.invoice_number} to ${invoice.client_name || "the client"}?`)) return;
    try {
      const response = await fetch(`/api/workflow/invoices/${invoice.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Invoice was not sent.");
      toast.success("Invoice sent and delivery recorded.");
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
    { label: "Total invoiced", value: invoiced, icon: FileText, tone: "text-blue-600 bg-blue-50" },
    { label: "Collected", value: collected, icon: WalletCards, tone: "text-emerald-600 bg-emerald-50" },
    { label: "Outstanding", value: outstanding, icon: Clock3, tone: "text-amber-600 bg-amber-50" },
    { label: "Overdue", value: overdue, icon: AlertTriangle, tone: "text-red-600 bg-red-50" },
    { label: "Draft pipeline", value: drafts, icon: FileText, tone: "text-slate-600 bg-slate-100" },
  ];

  return (
    <div className="workspace-page min-h-[calc(100vh-8rem)] space-y-7 animate-fade-in">
      <PageHeader title="Revenue & invoices" description="A reliable view of what has been invoiced, collected, and needs attention across every currency." actions={<Link href="/workflow/invoices/new"><Button data-guide-target="revenue-create" className="gap-2"><Plus className="h-4 w-4" /> Create invoice</Button></Link>} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p><span className={`grid h-8 w-8 place-items-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span></div><p className="mt-4 text-2xl font-bold tracking-tight">{value === null ? (ratesStatus === "loading" ? "Converting…" : "—") : formatMoney(value, displayCurrency)}</p></div>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Collection health</p><h2 className="mt-1 text-xl font-semibold">{collectionRate === null ? "—" : `${collectionRate}%`} collected</h2><p className="mt-1 text-sm text-muted-foreground">Collected against issued invoice value, using server-side payment ledger totals.</p></div><Link href="/workflow/invoice-settings" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Invoice settings <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(collectionRate || 0, 100)}%` }} /></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">{summaries.map((summary) => <div key={summary.currency} className="rounded-xl border border-border/70 bg-background p-3"><div className="flex justify-between text-xs text-muted-foreground"><span>{summary.currency}</span><span>{summary.invoiceCount} invoices</span></div><p className="mt-2 text-sm font-semibold">{formatConverted(summary.collected, summary.currency) || `${summary.currency} ${summary.collected.toFixed(2)}`}</p><p className="mt-1 text-xs text-muted-foreground">{summary.collectionRate === null ? "No issued value" : `${summary.collectionRate}% collection rate`}</p></div>)}</div>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">A/R aging</p><h2 className="mt-1 text-xl font-semibold">Where outstanding money sits</h2><div className="mt-5 space-y-3">{aging.length ? aging.map((row) => <div key={row.currency} className="rounded-xl border border-border/70 p-3"><div className="flex justify-between text-xs font-semibold"><span>{row.currency}</span><span>{formatConverted(row.days30 + row.days60 + row.days90 + row.days90Plus, row.currency) || "—"} overdue</span></div><div className="mt-3 grid grid-cols-4 gap-2 text-xs text-muted-foreground"><span>1–30<br /><strong className="text-foreground">{row.days30.toFixed(0)}</strong></span><span>31–60<br /><strong className="text-foreground">{row.days60.toFixed(0)}</strong></span><span>61–90<br /><strong className="text-foreground">{row.days90.toFixed(0)}</strong></span><span>90+<br /><strong className="text-foreground">{row.days90Plus.toFixed(0)}</strong></span></div></div>) : <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">No outstanding balances have aged yet.</p>}</div></section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Trend</p>
              <h2 className="mt-1 text-xl font-semibold">Monthly invoice activity</h2>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">Last 6 recorded months · {displayCurrency}</span>
          </div>
          {/* Two quantities, two lengths, both labelled. The bar compares this
              month's invoiced value against the largest month in the window;
              the solid part of it is what has actually been collected. */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-primary/25" /> Invoiced, relative to the busiest month</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-emerald-500" /> Paid so far, of that month&apos;s invoices</span>
          </div>
          {monthlyTrend.points.length ? (
            <div className="mt-5 space-y-4">
              {monthlyTrend.points.map((point) => (
                <div key={point.month}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-sm font-semibold">{point.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      <strong className="font-semibold text-foreground">{formatMoney(point.invoiced, displayCurrency)}</strong> invoiced
                      {point.collectionRate !== null ? ` · ${point.collectionRate}% paid` : ""}
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${point.label}: ${formatMoney(point.invoiced, displayCurrency)} invoiced, ${point.collectionRate === null ? "nothing billed" : `${point.collectionRate}% of it paid`}${point.currencies.length > 1 ? `, across ${point.currencies.join(" and ")}` : ""}`}
                  >
                    {/* A visible sliver for a month that had activity but is
                        dwarfed by another — zero-width would read as no data. */}
                    <div className="h-full rounded-full bg-primary/25" style={{ width: `${point.invoiced > 0 ? Math.max(2, point.share * 100) : 0}%` }}>
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${point.invoiced > 0 ? Math.min(100, (point.collected / point.invoiced) * 100) : 0}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {!monthlyTrend.complete && <p className="pt-1 text-xs text-muted-foreground">Some months are still converting to {displayCurrency} and are not shown yet.</p>}
            </div>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">{ratesStatus === "loading" && monthly.length ? `Converting to ${displayCurrency}…` : "Your monthly trend will appear after the first invoice."}</p>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-600">Attention queue</p><h2 className="mt-1 text-xl font-semibold">Next best actions</h2><div className="mt-4 space-y-2">{attention.slice(0, 5).map((item) => <Link key={item.id} href={item.status === "draft" ? `/workflow/invoices/new?invoiceId=${encodeURIComponent(item.id)}` : `/workflow/revenue#invoice-${encodeURIComponent(item.id)}`} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3 transition hover:border-primary/40 hover:bg-primary/[0.03]"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.invoiceNumber} · {item.client || "No client"}</p><p className="mt-1 text-xs text-muted-foreground">{item.reason} · {dateLabel(item.dueDate)}</p></div><span className="shrink-0 text-sm font-semibold">{formatConverted(item.outstanding, item.currency) || `${item.currency} ${item.outstanding.toFixed(2)}`}</span></Link>)}{!attention.length ? <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">Nothing urgent in the invoice queue.</p> : null}</div></section>
      </div>

      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Invoice workspace</p><h2 className="mt-1 text-xl font-semibold">All invoices</h2></div><div className="flex flex-wrap gap-2"><label className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoices, clients…" className="w-56 pl-9" aria-label="Search invoices" /></label><Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-36"><option value="all">All statuses</option><option value="draft">Drafts</option><option value="sent">Sent</option><option value="overdue">Overdue</option><option value="partially_paid">Partial</option><option value="paid">Paid</option></Select></div></div>
        {loading ? <div className="p-10 text-center text-sm text-muted-foreground">Loading invoices…</div> : !invoices.length ? <div className="p-10 text-center"><FileText className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 font-semibold">No invoices match this view</p><p className="mt-1 text-sm text-muted-foreground">Create a draft in the invoice workspace to get started.</p><Link href="/workflow/invoices/new" className="mt-4 inline-flex"><Button className="gap-2"><Plus className="h-4 w-4" /> Create invoice</Button></Link></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Client / project</th><th className="px-5 py-3">Due</th><th className="px-5 py-3 text-right">Amount due</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border">{invoices.map((invoice) => <tr id={`invoice-${invoice.id}`} key={invoice.id} className="transition hover:bg-muted/20"><td className="px-5 py-4"><p className="font-semibold">{invoice.invoice_number}</p><p className="mt-1 text-xs text-muted-foreground">Issued {dateLabel(invoice.issue_date)}</p></td><td className="px-5 py-4"><p className="font-medium">{invoice.client_name || "No client"}</p><p className="mt-1 text-xs text-muted-foreground">{invoice.project_title || "General services"}</p></td><td className="px-5 py-4 text-muted-foreground">{dateLabel(invoice.due_date)}</td><td className="px-5 py-4 text-right"><p className="font-semibold">{formatConverted(Number(invoice.outstanding), invoice.currency) || `${invoice.currency} ${Number(invoice.outstanding).toFixed(2)}`}</p>{Number(invoice.amount_paid) > 0 ? <p className="mt-1 text-xs text-emerald-600">{formatConverted(Number(invoice.amount_paid), invoice.currency) || `${invoice.currency} ${Number(invoice.amount_paid).toFixed(2)}`} paid</p> : null}{invoice.currency !== displayCurrency ? <p className="mt-1 text-xs font-medium text-muted-foreground">Originally {formatMoney(Number(invoice.total), invoice.currency)}</p> : null}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(invoice.status)}`}>{statusLabel(invoice.status)}</span></td><td className="relative px-5 py-4 text-right"><div className="flex justify-end gap-2">{invoice.status === "draft" ? <Link href={`/workflow/invoices/new?invoiceId=${encodeURIComponent(invoice.id)}`}><Button size="sm" variant="outline">Review</Button></Link> : null}<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${invoice.invoice_number}`} onClick={(event) => { setMenuRect(event.currentTarget.getBoundingClientRect()); setOpenMenu(openMenu === invoice.id ? null : invoice.id); }}><MoreVertical className="h-4 w-4" /></Button></div>{openMenu === invoice.id ? <DropdownPortal triggerRect={menuRect} onClose={() => setOpenMenu(null)}><div className="w-48 rounded-xl border border-border bg-card p-1 shadow-xl"><Button className="w-full justify-start gap-2" variant="ghost" onClick={() => { openPdf(invoice); setOpenMenu(null); }}><Download className="h-4 w-4" /> Download PDF</Button>{["sent", "viewed", "overdue", "partially_paid"].includes(invoice.status) ? <Button className="w-full justify-start gap-2 text-emerald-700" variant="ghost" onClick={() => { setOpenMenu(null); void recordPayment(invoice); }}><CheckCircle className="h-4 w-4" /> Record payment</Button> : null}{["draft", "overdue"].includes(invoice.status) ? <Button className="w-full justify-start gap-2 text-blue-700" variant="ghost" onClick={() => { setOpenMenu(null); void sendInvoice(invoice); }}><Send className="h-4 w-4" /> Send invoice</Button> : null}{invoice.status === "draft" && !invoice.contract_id ? <Button className="w-full justify-start gap-2 text-red-700" variant="ghost" onClick={() => { setOpenMenu(null); void deleteInvoice(invoice); }}><Trash2 className="h-4 w-4" /> Delete draft</Button> : null}</div></DropdownPortal> : null}</td></tr>)}</tbody></table></div>}
      </section>

      <p className="text-center text-xs text-muted-foreground">All totals are calculated from the server-side invoice and payment ledger. {ratesStatus === "ready" ? `Converted to ${displayCurrency} for display.` : "Original currencies are shown while exchange rates load."}</p>
    </div>
  );
}
