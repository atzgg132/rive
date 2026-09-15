import { Button, Card, Kicker } from "@/components/ui";
import { Download } from "lucide-react";

/* The client's invoice page (/invoice/[token]), reproduced as an inert plate:
   ink header, bill-to block, amount due, line items, totals — same structure,
   same primitives, seeded names consistent with the workspace figures. */

const items = [
  { description: "Homepage design & build", quantity: "1", rate: "₹60,000", amount: "₹60,000" },
  { description: "CMS setup & handoff", quantity: "1", rate: "₹30,000", amount: "₹30,000" },
];

export function InvoiceDocument() {
  return (
    <div data-testid="invoice-doc" className="bg-background px-6 py-10 text-foreground" role="img" aria-label="The invoice a client receives">
      <Card className="mx-auto max-w-3xl overflow-hidden">
        <div className="inverse-block p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="mb-5 text-xl font-bold tracking-tight">Maya Rao Studio</p>
              <p className="text-sm opacity-80">maya@mayarao.design</p>
            </div>
            <div className="text-right">
              <Kicker className="text-background">Invoice</Kicker>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">INV-024</p>
              <p className="mt-2 font-mono text-sm tabular-nums opacity-80">Issued Aug 21</p>
              <p className="font-mono text-sm tabular-nums opacity-80">Due Aug 28</p>
              <Button nativeButton={false} variant="outline" size="sm" className="mt-4 gap-2 border-background/40 text-background" render={<a />}><Download className="h-3.5 w-3.5" />Download PDF</Button>
            </div>
          </div>
        </div>

        <div className="wp-cols-auto gap-8 px-6 py-8 wp-px10">
          <div>
            <Kicker tone="muted">Bill to</Kicker>
            <p className="mt-2 text-lg font-semibold">Aster House</p>
            <p className="text-sm text-muted-foreground">asterhouse.co</p>
            <p className="mt-5 text-sm text-muted-foreground">Project <span className="font-medium text-foreground">Website launch</span></p>
          </div>
          <div className="wp-minw-52 border border-border bg-muted p-6">
            <Kicker>Amount due</Kicker>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">₹90,000</p>
          </div>
        </div>

        <div className="wp-px10 px-6">
          <div className="rounded-none border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Rate</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-border">{items.map((item) => <tr key={item.description}><td className="px-4 py-4 font-medium">{item.description}</td><td className="px-4 py-4 text-right text-muted-foreground">{item.quantity}</td><td className="px-4 py-4 text-right font-mono tabular-nums text-muted-foreground">{item.rate}</td><td className="px-4 py-4 text-right font-mono font-semibold tabular-nums">{item.amount}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="ml-auto mt-6 max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono tabular-nums">₹90,000</span></div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-bold"><span>Total</span><span className="font-mono tabular-nums">₹90,000</span></div>
          </div>
        </div>

        <div className="wp-cols-2 gap-5 px-6 py-8 wp-px10">
          <div><Kicker tone="muted">Notes</Kicker><p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">Thank you — final files release on payment.</p></div>
          <div><Kicker tone="muted">Payment information</Kicker><p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">Bank transfer or UPI to maya@upi · reference INV-024.</p></div>
        </div>
        <div className="wp-px10 border-t border-border px-6 py-5 text-center text-xs text-muted-foreground">This invoice was shared securely by Maya Rao Studio. Verify payment details with the sender before transferring funds. · <span className="text-primary">rive.</span></div>
      </Card>
    </div>
  );
}
