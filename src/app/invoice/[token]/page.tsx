"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button, Card, Kicker } from "@/components/ui";
import { formatMoney } from "@/lib/currency";

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

/** The invoice's calendar dates in a short, unambiguous style ("26 Sept 2026" / "Sep 26, 2026"), read as UTC so the day never shifts. */
function invoiceDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

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

  if (state === "loading") return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (state === "error" || !snapshot) return <div className="grid min-h-screen place-items-center bg-background p-6"><div className="max-w-sm rounded-none border border-border bg-card p-7 text-center"><AlertCircle className="mx-auto h-8 w-8 text-destructive" /><h1 className="mt-4 text-xl font-semibold text-foreground">Invoice link unavailable</h1><p className="mt-2 text-sm text-muted-foreground">The link may have expired, been voided, or been replaced. Contact the sender for a fresh copy.</p></div></div>;

  const money = (value: string | number) => formatMoney(Number(value) || 0, snapshot.currency);
  const outstanding = Math.max(Number(snapshot.outstanding ?? (Number(snapshot.total) - Number(snapshot.amountPaid))), 0);
  const isPaid = outstanding <= 0;

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:px-8">
      <Card className="mx-auto max-w-3xl overflow-hidden">
        <div className="inverse-block p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              {snapshot.sender.logoUrl ? <Image loader={({ src }) => src} unoptimized src={snapshot.sender.logoUrl} width={160} height={40} alt="" className="mb-3 h-10 max-w-40 object-contain object-left" /> : null}
              <p className="mb-2 text-xl font-bold tracking-tight">{snapshot.sender.name}</p>
              {snapshot.sender.address ? <p className="whitespace-pre-line text-sm opacity-80">{snapshot.sender.address}</p> : null}
              <p className="text-sm opacity-80">{snapshot.sender.email}{snapshot.sender.phone ? ` · ${snapshot.sender.phone}` : ""}</p>
              {snapshot.sender.taxId ? <p className="text-sm opacity-80">Tax ID: {snapshot.sender.taxId}</p> : null}
            </div>
            <div className="text-right">
              <Kicker className="text-background">Invoice</Kicker>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{snapshot.invoiceNumber}</p>
              <p className="mt-2 text-sm font-mono tabular-nums opacity-80">Issued {invoiceDate(snapshot.issueDate)}</p>
              {snapshot.dueDate ? <p className="text-sm font-mono tabular-nums opacity-80">Due {invoiceDate(snapshot.dueDate)}</p> : null}
              {token ? <Button nativeButton={false} variant="outline" size="sm" className="mt-4 border-background/40 text-background hover:border-background hover:bg-background hover:text-foreground" render={<a href={`/api/public/invoices/${encodeURIComponent(token)}/pdf`} />}>Download PDF</Button> : null}
            </div>
          </div>
        </div>

        <div className="grid gap-8 px-6 py-8 sm:grid-cols-[1fr_auto] sm:px-10">
          <div>
            <Kicker tone="muted">Bill to</Kicker>
            <p className="mt-2 text-lg font-semibold">{snapshot.client.name}</p>
            {snapshot.client.company ? <p className="text-sm text-muted-foreground">{snapshot.client.company}</p> : null}
            {snapshot.client.address ? <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{snapshot.client.address}</p> : null}
            {snapshot.projectTitle ? <p className="mt-5 text-sm text-muted-foreground">Project <span className="font-medium text-foreground">{snapshot.projectTitle}</span></p> : null}
          </div>
          <div className="border border-border bg-muted p-6 sm:min-w-52">
            <Kicker>{isPaid ? "Paid in full" : "Amount due"}</Kicker>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{money(outstanding)}</p>
            {Number(snapshot.amountPaid) > 0 ? <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">Paid {money(snapshot.amountPaid)} of {money(snapshot.total)}</p> : null}
          </div>
        </div>

        <div className="px-6 sm:px-10">
          <div className="table-scroll-region rounded-none border border-border">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-border">{snapshot.items.map((item) => <tr key={`${item.description}-${item.amount}`}><td className="px-4 py-4 font-medium">{item.description}</td><td className="px-4 py-4 text-right text-muted-foreground">{item.quantity}</td><td className="px-4 py-4 text-right font-mono tabular-nums text-muted-foreground">{money(item.unitPrice)}</td><td className="px-4 py-4 text-right font-mono font-semibold tabular-nums">{money(item.amount)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="ml-auto mt-6 max-w-xs space-y-2 text-sm"><div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono tabular-nums">{money(snapshot.subtotal)}</span></div>{Number(snapshot.discountAmount || 0) > 0 ? <div className="flex justify-between text-muted-foreground"><span>Discount{Number(snapshot.discountRate || 0) > 0 ? ` (${snapshot.discountRate}%)` : ""}</span><span className="font-mono tabular-nums">-{money(snapshot.discountAmount || "0")}</span></div> : null}{Number(snapshot.taxRate) > 0 ? <div className="flex justify-between text-muted-foreground"><span>Tax ({snapshot.taxRate}%)</span><span className="font-mono tabular-nums">{money(snapshot.taxAmount)}</span></div> : null}<div className="flex justify-between border-t border-border pt-3 text-base font-bold"><span>Total</span><span className="font-mono tabular-nums">{money(snapshot.total)}</span></div></div>
        </div>

        {snapshot.notes || snapshot.sender.paymentInstructions || snapshot.sender.defaultTerms ? <div className="grid gap-5 px-6 py-8 sm:grid-cols-2 sm:px-10"><div>{snapshot.notes ? <><Kicker tone="muted">Notes</Kicker><p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{snapshot.notes}</p></> : null}</div><div>{snapshot.sender.paymentInstructions || snapshot.sender.defaultTerms ? <><Kicker tone="muted">Payment information</Kicker>{snapshot.sender.paymentInstructions ? <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{snapshot.sender.paymentInstructions}</p> : null}{snapshot.sender.defaultTerms ? <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{snapshot.sender.defaultTerms}</p> : null}</> : null}</div></div> : null}
        <div className="border-t border-border px-6 py-5 text-center text-xs text-muted-foreground sm:px-10">This invoice was shared securely by {snapshot.sender.name}. Verify payment details with the sender before transferring funds. · <Link href="/" className="text-primary hover:underline">rive.</Link></div>
      </Card>
    </main>
  );
}
