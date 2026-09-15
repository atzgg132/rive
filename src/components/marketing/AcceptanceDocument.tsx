import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Kicker } from "@/components/ui";
import { Check, FileSignature, ShieldCheck, XCircle } from "lucide-react";

/* The client's acceptance page (/sign/[token]), reproduced as an inert plate:
   the document to read, the payment plan it carries, and the recorded
   acceptance card — same structure, same primitives, seeded names. */

const sections = [
  { title: "Scope of work", body: "Complete brand identity for Northline Studio: logo suite, typography, color system, and a brand guidelines document. Two revision rounds included." },
  { title: "Timeline", body: "Work begins within one week of acceptance. Final delivery within six weeks of the start date." },
];

const paymentPlan = [
  { label: "Booking", detail: "When both parties record acceptance · invoice due in 7 days", amount: "₹48,000" },
  { label: "Final delivery", detail: "When Handoff is due · invoice due in 14 days", amount: "₹48,000" },
];

export function AcceptanceDocument() {
  return (
    <div data-testid="acceptance-doc" className="flex flex-col gap-6 bg-background px-8 py-8 text-foreground" role="img" aria-label="The client's acceptance page for an agreement">
      <header className="flex items-center justify-between gap-3">
        <div className="text-2xl font-black tracking-tight">rive<span className="text-primary">.</span></div>
        <div className="text-right text-xs text-muted-foreground">Recorded acceptance page<br />Link expires Sep 05</div>
      </header>

      <section>
        <div className="flex flex-wrap items-center gap-2"><Kicker>Acceptance requested</Kicker><Badge variant="outline">Version 1</Badge></div>
        <p className="mt-2 text-3xl font-extrabold tracking-tight">Brand system terms</p>
        <p className="mt-2 text-sm text-muted-foreground">You are recording acceptance as <strong className="text-foreground">client</strong>: Rhea Kapoor · rhea@northline.studio</p>
        <p className="mt-1 text-xs text-muted-foreground">Governing law: India</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5 text-primary" /> Read before recording acceptance</CardTitle>
            <CardDescription>Document hash: <span className="break-all font-mono text-[10px]">9f2c…a47b…e1d0</span></CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <section className="rounded-none border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-bold">Project brief snapshot</p>
              <p className="mt-1 text-xs font-semibold text-primary">Brand system · Northline Studio</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">A full identity refresh ahead of the October relaunch — mark, type, color, and the guidelines to keep it consistent.</p>
            </section>
            {sections.map((section) => (
              <section key={section.title} className="border-b border-border pb-5">
                <p className="mb-2 text-sm font-bold">{section.title}</p>
                <p className="text-sm leading-6 text-muted-foreground">{section.body}</p>
              </section>
            ))}
            <section>
              <p className="mb-2 text-sm font-bold">Payment plan</p>
              <div className="divide-y divide-border rounded-none border border-border">
                {paymentPlan.map((item) => (
                  <div key={item.label} className="grid gap-1 p-3 text-sm sm:grid-cols-[1fr_auto]">
                    <div><p className="font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{item.detail}</p></div>
                    <p className="font-mono font-bold tabular-nums">{item.amount}</p>
                  </div>
                ))}
              </div>
            </section>
          </CardContent>
        </Card>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Your recorded acceptance</CardTitle><CardDescription>Only the named client and owner record acceptance for this exact version.</CardDescription></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <label><span className="mb-1.5 block text-xs font-bold">Type your full name</span><Input value="Rhea Kapoor" readOnly /></label>
              <label className="flex gap-3 text-xs leading-5 text-muted-foreground"><span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span><span>I agree that typing my name records my acceptance of this version.<span className="mt-1 block font-mono text-[10px]">Consent version v1</span></span></label>
              <Button><FileSignature className="h-4 w-4" /> Record acceptance</Button>
              <Button variant="ghost" className="text-destructive"><XCircle className="h-4 w-4" /> Request changes instead</Button>
            </CardContent>
          </Card>

          <Card><CardContent className="flex flex-col gap-3 p-5 text-xs leading-5 text-muted-foreground"><div className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /><p>The acceptance record links this typed-name acceptance to the version hash, named party, timestamp, consent text, and request metadata.</p></div></CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
