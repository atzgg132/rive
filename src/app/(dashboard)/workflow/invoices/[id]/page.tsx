"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/currency";
import {
  invoiceEventLabel,
  invoiceStatusClass,
  invoiceStatusLabel,
} from "@/utils/invoiceStatus";
import type { InvoiceDetail } from "@/components/invoices/InvoiceDetailPanel";

function dateLabel(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * A full-page, printable rendering of one invoice.
 *
 * The detail panel on the revenue workspace is for acting on an invoice
 * quickly. This is for reading it end to end, printing it, or sending someone
 * a durable link — so it is a document, not a control surface.
 */
export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/workflow/invoices/${id}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) throw new Error(data?.message || "This invoice could not be loaded.");
        setInvoice(data.invoice);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "This invoice could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [id]);

  if (loading) {
    return (
      <div className="workspace-page flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="workspace-page min-h-[calc(100vh-8rem)]">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <p className="font-semibold">{error || "Invoice not found."}</p>
          <Link href="/workflow/revenue" className="mt-3 inline-flex">
            <Button size="sm" variant="outline"><ArrowLeft className="h-4 w-4" /> Back to revenue</Button>
          </Link>
        </div>
      </div>
    );
  }

  const total = Number(invoice.total);
  const amountPaid = Number(invoice.amount_paid);
  const outstanding = Number(invoice.outstanding);

  return (
    <div className="workspace-page min-h-[calc(100vh-8rem)]">
      {/* Controls are excluded from print so the sheet carries only the invoice. */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/workflow/revenue" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Revenue &amp; invoices
        </Link>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(`/api/workflow/invoices/${invoice.id}/pdf`, "_blank", "noopener,noreferrer")}>
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      <article className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8 print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{invoice.invoice_number}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Issued {dateLabel(invoice.issue_date)} · Due {dateLabel(invoice.due_date)}
            </p>
          </div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${invoiceStatusClass(invoice.status)}`}>
            {invoiceStatusLabel(invoice.status)}
          </span>
        </header>

        <section className="grid gap-6 border-b border-border py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Billed to</p>
            <p className="mt-2 font-semibold">{invoice.client_name || "No client"}</p>
            {invoice.client_company ? <p className="text-sm text-muted-foreground">{invoice.client_company}</p> : null}
            {invoice.client_email ? <p className="text-sm text-muted-foreground">{invoice.client_email}</p> : null}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Amount due</p>
            <p className="mt-2 text-2xl font-bold tabular-nums">{formatMoney(outstanding, invoice.currency)}</p>
            {amountPaid > 0 ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{formatMoney(amountPaid, invoice.currency)} paid of {formatMoney(total, invoice.currency)}</p>
            ) : null}
            {invoice.project_title ? <p className="mt-2 text-sm text-muted-foreground">{invoice.project_title}</p> : null}
          </div>
        </section>

        <section className="py-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-3 font-semibold">Description</th>
                  <th className="pb-3 text-right font-semibold">Qty</th>
                  <th className="pb-3 text-right font-semibold">Unit price</th>
                  <th className="pb-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.items.length ? invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-3">{item.description}</td>
                    <td className="py-3 text-right tabular-nums text-muted-foreground">{Number(item.quantity)}</td>
                    <td className="py-3 text-right tabular-nums text-muted-foreground">{formatMoney(Number(item.unit_price), invoice.currency)}</td>
                    <td className="py-3 text-right font-medium tabular-nums">{formatMoney(Number(item.amount), invoice.currency)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No line items recorded.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto mt-6 max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{formatMoney(Number(invoice.subtotal), invoice.currency)}</dd></div>
            {Number(invoice.discount_amount) > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{formatMoney(Number(invoice.discount_amount), invoice.currency)}</dd></div> : null}
            {Number(invoice.tax_amount) > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Tax ({Number(invoice.tax_rate)}%)</dt><dd className="tabular-nums">{formatMoney(Number(invoice.tax_amount), invoice.currency)}</dd></div> : null}
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(total, invoice.currency)}</dd></div>
            {amountPaid > 0 ? <div className="flex justify-between text-emerald-700 dark:text-emerald-300"><dt>Paid</dt><dd className="tabular-nums">−{formatMoney(amountPaid, invoice.currency)}</dd></div> : null}
            <div className="flex justify-between border-t border-border pt-1.5 font-bold"><dt>Amount due</dt><dd className="tabular-nums">{formatMoney(outstanding, invoice.currency)}</dd></div>
          </dl>
        </section>

        {invoice.notes ? (
          <section className="border-t border-border py-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{invoice.notes}</p>
          </section>
        ) : null}

        {invoice.payments.length ? (
          <section className="border-t border-border py-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Payments received</p>
            <ul className="mt-3 space-y-2">
              {invoice.payments.map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {dateLabel(payment.paid_at)} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ""}
                  </span>
                  <span className="font-semibold tabular-nums">{formatMoney(Number(payment.amount), invoice.currency)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {invoice.events.length ? (
          <section className="border-t border-border py-6 print:hidden">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Activity</p>
            <ul className="mt-3 space-y-1.5">
              {invoice.events.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-medium">{invoiceEventLabel(event.event_type)}</span>
                  <span className="text-muted-foreground">{new Date(event.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </div>
  );
}
