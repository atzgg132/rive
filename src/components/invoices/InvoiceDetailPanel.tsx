"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Ban,
  CheckCircle,
  Download,
  ExternalLink,
  FileSignature,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Textarea } from "@/components/ui";
import Portal from "@/components/ui/Portal";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { formatMoney } from "@/lib/currency";
import {
  canRecordPayment,
  canSendInvoice,
  canVoidInvoice,
  invoiceEventLabel,
  invoiceStatusClass,
  invoiceStatusLabel,
} from "@/utils/invoiceStatus";

export type InvoiceDetail = {
  id: string;
  invoice_number: string;
  status: string;
  currency: string;
  subtotal: string;
  discount_amount: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  amount_paid: string;
  outstanding: string;
  issue_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  notes: string | null;
  client_id: string | null;
  client_name: string | null;
  client_company: string | null;
  client_email: string | null;
  project_id: string | null;
  project_title: string | null;
  contract_id: string | null;
  contract_title: string | null;
  items: Array<{ id: string; description: string; quantity: string; unit_price: string; amount: string }>;
  payments: Array<{ id: string; amount: string; method: string; reference: string | null; notes: string | null; paid_at: string }>;
  events: Array<{ id: string; event_type: string; created_at: string }>;
};

function dateLabel(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function dateTimeLabel(value: string): string {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function InvoiceDetailPanel({
  invoiceId,
  onClose,
  onChanged,
}: {
  invoiceId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { displayCurrency, formatConverted } = useCurrency();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/workflow/invoices/${invoiceId}`, { cache: "no-store", signal });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "This invoice could not be loaded.");
      setInvoice(data.invoice);
      setPaymentAmount(data.invoice.outstanding);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "This invoice could not be loaded.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  // Escape closes the panel, matching every other overlay in the workspace.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const money = (value: number, currency: string) => formatConverted(value, currency) || formatMoney(value, currency);

  const recordPayment = async () => {
    if (!invoice || busy) return;
    const amount = paymentAmount.trim();
    if (!/^(?:\d+\.?\d*|\.\d+)$/.test(amount) || Number(amount) <= 0) {
      toast.error("Enter a valid positive payment amount.");
      return;
    }
    if (Number(amount) > Number(invoice.outstanding)) {
      toast.error(`Payment cannot exceed the ${formatMoney(Number(invoice.outstanding), invoice.currency)} outstanding.`);
      return;
    }
    setBusy(true);
    const key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${invoice.id}-${amount}`;
    try {
      const response = await fetch(`/api/workflow/invoices/${invoice.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ amount, method: "manual", reference: paymentReference || undefined, notes: paymentNotes || undefined }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Payment could not be recorded.");
      toast.success(data.duplicate ? "That payment was already recorded." : "Payment recorded.");
      setPaymentOpen(false);
      setPaymentReference("");
      setPaymentNotes("");
      await load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment could not be recorded.");
    } finally {
      setBusy(false);
    }
  };

  const sendInvoice = async () => {
    if (!invoice || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/workflow/invoices/${invoice.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Invoice was not sent.");
      toast.success("Invoice sent and delivery recorded.");
      await load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invoice was not sent.");
    } finally {
      setBusy(false);
    }
  };

  const voidInvoice = async () => {
    if (!invoice || busy) return;
    if (!window.confirm(`Void ${invoice.invoice_number}? The client's copy stops resolving and this cannot be undone.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/workflow/invoices/${invoice.id}/void`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Invoice could not be voided.");
      toast.success("Invoice voided.");
      await load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invoice could not be voided.");
    } finally {
      setBusy(false);
    }
  };

  const outstanding = invoice ? Number(invoice.outstanding) : 0;
  const amountPaid = invoice ? Number(invoice.amount_paid) : 0;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={invoice ? `Invoice ${invoice.invoice_number}` : "Invoice detail"}
          className="relative flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl animate-fade-in-up dark:bg-slate-950"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-5">
            <div className="min-w-0">
              {loading && !invoice ? (
                <p className="text-sm text-muted-foreground">Loading invoice…</p>
              ) : invoice ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-bold">{invoice.invoice_number}</h2>
                    <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${invoiceStatusClass(invoice.status)}`}>
                      {invoiceStatusLabel(invoice.status)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {invoice.client_name || "No client"}
                    {invoice.project_title ? ` · ${invoice.project_title}` : ""}
                  </p>
                </>
              ) : (
                <h2 className="text-lg font-bold">Invoice</h2>
              )}
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close invoice detail" title="Close invoice detail">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {loading && !invoice ? (
              <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                <p className="font-semibold">{error}</p>
                <Button className="mt-3" size="sm" variant="outline" onClick={() => void load()}>Try again</Button>
              </div>
            ) : invoice ? (
              <div className="flex flex-col gap-6">
                <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="mt-1 text-lg font-bold tabular-nums">{money(Number(invoice.total), invoice.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paid</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{money(amountPaid, invoice.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className="mt-1 text-lg font-bold tabular-nums">{money(outstanding, invoice.currency)}</p>
                  </div>
                  {invoice.currency !== displayCurrency ? (
                    <p className="text-xs text-muted-foreground sm:col-span-3">Originally {formatMoney(Number(invoice.total), invoice.currency)}</p>
                  ) : null}
                </div>

                <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-3 sm:block">
                    <dt className="text-xs text-muted-foreground">Issued</dt>
                    <dd className="font-medium sm:mt-0.5">{dateLabel(invoice.issue_date)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 sm:block">
                    <dt className="text-xs text-muted-foreground">Due</dt>
                    <dd className="font-medium sm:mt-0.5">{dateLabel(invoice.due_date)}</dd>
                  </div>
                  {invoice.sent_at ? (
                    <div className="flex justify-between gap-3 sm:block">
                      <dt className="text-xs text-muted-foreground">Sent</dt>
                      <dd className="font-medium sm:mt-0.5">{dateLabel(invoice.sent_at)}</dd>
                    </div>
                  ) : null}
                  {invoice.paid_date ? (
                    <div className="flex justify-between gap-3 sm:block">
                      <dt className="text-xs text-muted-foreground">Paid</dt>
                      <dd className="font-medium sm:mt-0.5">{dateLabel(invoice.paid_date)}</dd>
                    </div>
                  ) : null}
                </dl>

                {invoice.client_id || invoice.project_id || invoice.contract_id ? (
                  <div className="flex flex-wrap gap-2">
                    {invoice.client_id ? (
                      <Link href={`/workflow/clients/${invoice.client_id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-primary/40 hover:text-primary">
                        <ExternalLink className="h-3.5 w-3.5" /> {invoice.client_name || "Client"}
                      </Link>
                    ) : null}
                    {invoice.project_id ? (
                      <Link href={`/workflow/projects/${invoice.project_id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-primary/40 hover:text-primary">
                        <ExternalLink className="h-3.5 w-3.5" /> {invoice.project_title || "Project"}
                      </Link>
                    ) : null}
                    {invoice.contract_id ? (
                      <Link href={`/workflow/contracts/${invoice.contract_id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:border-primary/40 hover:text-primary">
                        <FileSignature className="h-3.5 w-3.5" /> {invoice.contract_title || "Agreement"}
                      </Link>
                    ) : null}
                  </div>
                ) : null}

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Line items</h3>
                  <div className="mt-2 overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Description</th>
                          <th className="px-3 py-2 text-right font-semibold">Qty</th>
                          <th className="px-3 py-2 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {invoice.items.length ? invoice.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Number(item.quantity)}</td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney(Number(item.amount), invoice.currency)}</td>
                          </tr>
                        ) ) : (
                          <tr><td colSpan={3} className="px-3 py-4 text-center text-xs text-muted-foreground">No line items recorded.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatMoney(Number(invoice.subtotal), invoice.currency)}</dd></div>
                    {Number(invoice.discount_amount) > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{formatMoney(Number(invoice.discount_amount), invoice.currency)}</dd></div> : null}
                    {Number(invoice.tax_amount) > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Tax ({Number(invoice.tax_rate)}%)</dt><dd className="tabular-nums">{formatMoney(Number(invoice.tax_amount), invoice.currency)}</dd></div> : null}
                    <div className="flex justify-between border-t border-border pt-1 font-bold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(Number(invoice.total), invoice.currency)}</dd></div>
                  </dl>
                </section>

                {invoice.payments.length ? (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Payments</h3>
                    <ul className="mt-2 space-y-2">
                      {invoice.payments.map((payment) => (
                        <li key={payment.id} className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="font-semibold tabular-nums">{formatMoney(Number(payment.amount), invoice.currency)}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {dateTimeLabel(payment.paid_at)} · {payment.method}
                              {payment.reference ? ` · ${payment.reference}` : ""}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {invoice.notes ? (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Notes</h3>
                    <p className="mt-2 whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm">{invoice.notes}</p>
                  </section>
                ) : null}

                {invoice.events.length ? (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Activity</h3>
                    <ul className="mt-2 space-y-1.5">
                      {invoice.events.map((event) => (
                        <li key={event.id} className="flex items-baseline justify-between gap-3 text-xs">
                          <span className="font-medium">{invoiceEventLabel(event.event_type)}</span>
                          <span className="shrink-0 text-muted-foreground">{dateTimeLabel(event.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>

          {invoice && !error ? (
            <div className="shrink-0 border-t border-border p-4">
              {paymentOpen ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="payment-amount" className="text-xs font-bold">
                      Amount ({invoice.currency}) · {formatMoney(outstanding, invoice.currency)} outstanding
                    </label>
                    <Input
                      id="payment-amount"
                      inputMode="decimal"
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder={invoice.outstanding}
                    />
                  </div>
                  <Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Reference (optional)" maxLength={160} aria-label="Payment reference" />
                  <Textarea rows={2} value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} placeholder="Notes (optional)" aria-label="Payment notes" className="resize-none" />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => setPaymentOpen(false)}>Cancel</Button>
                    <Button size="sm" disabled={busy} onClick={() => void recordPayment()}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />} Record payment
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Link href={`/workflow/invoices/${invoice.id}`}>
                    <Button size="sm" variant="outline" className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Full invoice</Button>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => window.open(`/api/workflow/invoices/${invoice.id}/pdf`, "_blank", "noopener,noreferrer")} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </Button>
                  {invoice.status === "draft" ? (
                    <Link href={`/workflow/invoices/new?invoiceId=${encodeURIComponent(invoice.id)}`}>
                      <Button size="sm" variant="outline">Edit draft</Button>
                    </Link>
                  ) : null}
                  {canSendInvoice(invoice.status) ? (
                    <Button size="sm" disabled={busy} onClick={() => void sendInvoice()} className="gap-1.5">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
                    </Button>
                  ) : null}
                  {canRecordPayment(invoice.status) ? (
                    <Button size="sm" onClick={() => { setPaymentAmount(invoice.outstanding); setPaymentOpen(true); }} className="gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" /> Record payment
                    </Button>
                  ) : null}
                  {canVoidInvoice(invoice.status, amountPaid) ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void voidInvoice()} className="gap-1.5 text-red-700 dark:text-red-400">
                      <Ban className="h-3.5 w-3.5" /> Void
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Portal>
  );
}
