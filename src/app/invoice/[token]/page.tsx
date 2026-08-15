"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";

type InvoiceSnapshot = {
  invoiceNumber: string;
  currency: string;
  subtotal: string;
  discountRate?: string;
  discountAmount?: string;
  taxRate: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  outstanding?: string;
  issueDate: string;
  dueDate: string | null;
  notes: string | null;
  client: { name: string; company: string | null; address: string | null };
  projectTitle: string | null;
  items: Array<{ description: string; quantity: string; unitPrice: string; amount: string }>;
  sender: { name: string; contactName: string | null; email: string; phone: string | null; address: string | null; taxId: string | null; logoUrl: string | null; paymentInstructions: string | null; defaultTerms: string | null };
};

export default function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const [snapshot, setSnapshot] = useState<InvoiceSnapshot | null>(null);
  const [token, setToken] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    void params.then(({ token: resolvedToken }) => { setToken(resolvedToken); return fetch(`/api/public/invoices/${encodeURIComponent(resolvedToken)}`, { cache: "no-store" }); })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success) throw new Error(data?.message || "Invoice link unavailable.");
        setSnapshot(data.invoice.snapshot as InvoiceSnapshot);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, [params]);

  if (state === "loading") return <div className="grid min-h-screen place-items-center bg-slate-50"><Loader2 className="h-7 w-7 animate-spin text-blue-600" /></div>;
  if (state === "error" || !snapshot) return <div className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm"><AlertCircle className="mx-auto h-8 w-8 text-red-500" /><h1 className="mt-4 text-xl font-semibold text-slate-900">Invoice link unavailable</h1><p className="mt-2 text-sm text-slate-500">The link may have expired, been voided, or been replaced. Contact the sender for a fresh copy.</p></div></div>;

  const formatMoney = (value: string | number) => new Intl.NumberFormat(undefined, { style: "currency", currency: snapshot.currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
  const outstanding = Math.max(Number(snapshot.outstanding ?? (Number(snapshot.total) - Number(snapshot.amountPaid))), 0);
  const isPaid = outstanding <= 0;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white sm:px-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              {snapshot.sender.logoUrl ? <img src={snapshot.sender.logoUrl} alt="" className="mb-5 h-10 max-w-40 object-contain object-left" /> : <p className="mb-5 text-xl font-bold tracking-tight">{snapshot.sender.name}</p>}
              <p className="text-sm text-blue-100">{snapshot.sender.email}{snapshot.sender.phone ? ` · ${snapshot.sender.phone}` : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Invoice</p>
              <p className="mt-2 text-2xl font-semibold">{snapshot.invoiceNumber}</p>
              <p className="mt-2 text-sm text-blue-100">Issued {new Date(snapshot.issueDate).toLocaleDateString()}</p>
              {snapshot.dueDate ? <p className="text-sm text-blue-100">Due {new Date(snapshot.dueDate).toLocaleDateString()}</p> : null}
              {token ? <a href={`/api/public/invoices/${encodeURIComponent(token)}/pdf`} className="mt-4 inline-flex rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10">Download PDF</a> : null}
            </div>
          </div>
        </div>

        <div className="grid gap-8 px-6 py-8 sm:grid-cols-[1fr_auto] sm:px-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Bill to</p>
            <p className="mt-2 text-lg font-semibold">{snapshot.client.name}</p>
            {snapshot.client.company ? <p className="text-sm text-slate-500">{snapshot.client.company}</p> : null}
            {snapshot.client.address ? <p className="mt-2 whitespace-pre-line text-sm text-slate-500">{snapshot.client.address}</p> : null}
            {snapshot.projectTitle ? <p className="mt-5 text-sm text-slate-500">Project <span className="font-medium text-slate-800">{snapshot.projectTitle}</span></p> : null}
          </div>
          <div className="rounded-2xl bg-blue-50 px-5 py-4 sm:min-w-52">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{isPaid ? "Paid in full" : "Amount due"}</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{formatMoney(outstanding)}</p>
            {Number(snapshot.amountPaid) > 0 ? <p className="mt-1 text-xs text-slate-600">Paid {formatMoney(snapshot.amountPaid)} of {formatMoney(snapshot.total)}</p> : null}
          </div>
        </div>

        <div className="px-6 sm:px-10">
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{snapshot.items.map((item) => <tr key={`${item.description}-${item.amount}`}><td className="px-4 py-4 font-medium">{item.description}</td><td className="px-4 py-4 text-right text-slate-500">{item.quantity}</td><td className="px-4 py-4 text-right text-slate-500">{formatMoney(item.unitPrice)}</td><td className="px-4 py-4 text-right font-semibold">{formatMoney(item.amount)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="ml-auto mt-6 max-w-xs space-y-2 text-sm"><div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatMoney(snapshot.subtotal)}</span></div>{Number(snapshot.discountAmount || 0) > 0 ? <div className="flex justify-between text-slate-500"><span>Discount{Number(snapshot.discountRate || 0) > 0 ? ` (${snapshot.discountRate}%)` : ""}</span><span>-{formatMoney(snapshot.discountAmount || "0")}</span></div> : null}{Number(snapshot.taxRate) > 0 ? <div className="flex justify-between text-slate-500"><span>Tax ({snapshot.taxRate}%)</span><span>{formatMoney(snapshot.taxAmount)}</span></div> : null}<div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold"><span>Total</span><span>{formatMoney(snapshot.total)}</span></div></div>
        </div>

        {snapshot.notes || snapshot.sender.paymentInstructions || snapshot.sender.defaultTerms ? <div className="grid gap-5 px-6 py-8 sm:grid-cols-2 sm:px-10"><div>{snapshot.notes ? <><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Notes</p><p className="mt-2 whitespace-pre-line text-sm text-slate-600">{snapshot.notes}</p></> : null}</div><div>{snapshot.sender.paymentInstructions || snapshot.sender.defaultTerms ? <><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Payment information</p><p className="mt-2 whitespace-pre-line text-sm text-slate-600">{snapshot.sender.paymentInstructions || snapshot.sender.defaultTerms}</p></> : null}</div></div> : null}
        <div className="border-t border-slate-100 px-6 py-5 text-center text-xs text-slate-400 sm:px-10">This invoice was shared securely by {snapshot.sender.name}. Verify payment details with the sender before transferring funds. · <Link href="/" className="text-blue-600 hover:underline">rive.</Link></div>
      </div>
    </main>
  );
}
