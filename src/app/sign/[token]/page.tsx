"use client";

import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@/components/ui";
import { AlertTriangle, CheckCircle2, Download, FileSignature, Loader2, LockKeyhole, ShieldCheck, XCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type SignData = {
  mode: "sign" | "waiting" | "signed" | "completed";
  contract: {
    title: string;
    status: string;
    governing_law: string;
    jurisdiction: string | null;
    content: {
      ownerName?: string;
      ownerEmail?: string;
      clientName?: string;
      clientCompany?: string | null;
      clientAddress?: string | null;
      projectTitle?: string | null;
      projectDescription?: string | null;
      governingLaw?: string;
      jurisdiction?: string | null;
      sections?: Array<{ key: string; title: string; body: string; enabled: boolean }>;
      paymentPlan?: { items: Array<{ label: string; amount: string; currency: string; triggerType: string; triggerDate: string | null; milestoneTitle: string | null; dueDays: number }> };
    };
    version: { number: number; hash: string };
    expires_at: string;
    executed_at: string | null;
  };
  signer: { role: string; name: string; email: string; status: string; sequence: number };
  consent: { version: string; text: string };
  downloadUrl: string | null;
};

export default function ContractSignPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [data, setData] = useState<SignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typedName, setTypedName] = useState("");
  const [consent, setConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      const response = await fetch(`/api/public/contracts/sign/${encodeURIComponent(token)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "This acceptance link is unavailable.");
      setData(payload);
      setDownloadUrl(payload.downloadUrl);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "This acceptance link is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  // load is deliberately rerun only when the bearer token changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const sign = async () => {
    if (!token || signing) return;
    setSigning(true);
    try {
      const response = await fetch(`/api/public/contracts/sign/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typedName, consentAccepted: consent }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to record acceptance.");
      setDownloadUrl(payload.downloadUrl || null);
      toast.success(payload.message);
      await load();
    } catch (signError) {
      toast.error(signError instanceof Error ? signError.message : "Unable to record acceptance.");
    } finally {
      setSigning(false);
    }
  };

  const decline = async () => {
    if (!token || declining || declineReason.trim().length < 5) return;
    setDeclining(true);
    try {
      const response = await fetch(`/api/public/contracts/sign/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", reason: declineReason }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to request changes.");
      toast.success(payload.message);
      setData(null);
      setError("You requested changes to this acceptance request. The sender has been notified and must issue a revised version.");
    } catch (declineError) {
      toast.error(declineError instanceof Error ? declineError.message : "Unable to request changes.");
    } finally {
      setDeclining(false);
    }
  };

  if (loading) return <Centered><Loader2 className="h-6 w-6 animate-spin text-primary" /><span>Loading acceptance page…</span></Centered>;
  if (error || !data) return <Centered><AlertTriangle className="h-8 w-8 text-amber-500" /><h1 className="text-xl font-bold">Acceptance request closed</h1><p className="max-w-md text-center text-sm text-muted-foreground">{error || "Ask the sender to reissue it."}</p></Centered>;

  const sections = (data.contract.content.sections || []).filter((section) => section.enabled);
  const waiting = data.mode === "waiting";
  const completed = data.mode === "completed" || data.mode === "signed";
  const governingLaw = data.contract.content.governingLaw || data.contract.governing_law;
  const jurisdiction = data.contract.content.jurisdiction ?? data.contract.jurisdiction;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
          <div className="text-2xl font-black tracking-tight">rive<span className="text-primary">.</span></div>
          <div className="text-right text-xs text-muted-foreground">Recorded acceptance page<br />Link expires {new Date(data.contract.expires_at).toLocaleDateString()}</div>
        </header>

        <section>
          <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{completed ? "Acceptance recorded" : waiting ? "Waiting for prior party" : "Acceptance requested"}</p><Badge variant="outline">Version {data.contract.version.number}</Badge></div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{data.contract.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">You are recording acceptance as <strong className="text-foreground dark:text-slate-200">{data.signer.role}</strong>: {data.signer.name} · {data.signer.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">Governing law: {governingLaw}{jurisdiction ? ` · ${jurisdiction}` : ""}</p>
        </section>

        {waiting ? (
          <Alert variant="info">
            <LockKeyhole className="h-5 w-5" />
            <div><p className="font-bold">The client accepts first</p><p className="mt-1 text-sm text-muted-foreground">This owner link unlocks automatically after the client records acceptance.</p></div>
          </Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5 text-primary" /> Read before recording acceptance</CardTitle>
              <CardDescription>Document hash: <span className="break-all font-mono text-[10px]">{data.contract.version.hash}</span></CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {data.contract.content.projectTitle ? (
                <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <h2 className="text-sm font-bold">Project brief snapshot</h2>
                  <p className="mt-1 text-xs font-semibold text-primary">{data.contract.content.projectTitle}</p>
                  {data.contract.content.projectDescription ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{data.contract.content.projectDescription}</p> : null}
                </section>
              ) : null}
              {sections.map((section) => (
                <section key={section.key} className="border-b border-border pb-5 last:border-0 last:pb-0">
                  <h2 className="mb-2 text-sm font-bold">{section.title}</h2>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{section.body}</p>
                </section>
              ))}
              <section>
                <h2 className="mb-2 text-sm font-bold">Payment plan</h2>
                {data.contract.content.paymentPlan?.items?.length ? (
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {data.contract.content.paymentPlan.items.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="grid gap-1 p-3 text-sm sm:grid-cols-[1fr_auto]">
                        <div><p className="font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{formatTrigger(item)} · invoice due in {item.dueDays} days</p></div>
                        <p className="font-bold">{item.currency} {item.amount}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No automatic payment plan attached.</p>}
              </section>
            </CardContent>
          </Card>

          <aside className="flex flex-col gap-6">
            <Card>
              <CardHeader><CardTitle>{completed ? "Acceptance recorded" : "Your recorded acceptance"}</CardTitle><CardDescription>{completed ? "Keep the accepted Agreement with your records." : "Only the named client and owner record acceptance for this exact version."}</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-4">
                {completed ? (
                  <>
                    <Alert variant="success"><CheckCircle2 className="h-5 w-5" /><p className="text-sm">{data.contract.status === "executed" ? "Both parties have recorded acceptance." : "Your acceptance is recorded. The next party can continue."}</p></Alert>
                    {downloadUrl && data.contract.status === "executed" ? <a href={downloadUrl} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" download><Download className="h-4 w-4" /> Download accepted PDF</a> : null}
                  </>
                ) : waiting ? <p className="text-sm text-muted-foreground">The acceptance form unlocks after the prior party records acceptance.</p> : (
                  <>
                    <label><span className="mb-1.5 block text-xs font-bold">Type your full name</span><Input value={typedName} onChange={(event) => setTypedName(event.target.value)} placeholder={data.signer.name} autoComplete="name" /></label>
                    <label className="flex gap-3 text-xs leading-5 text-muted-foreground"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-primary" /><span>{data.consent.text}<span className="mt-1 block font-mono text-[10px]">Consent version {data.consent.version}</span></span></label>
                    <Button onClick={() => void sign()} disabled={signing || !typedName.trim() || !consent}>{signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Record acceptance</Button>
                    <Button type="button" variant="ghost" className="text-destructive" onClick={() => setDeclineOpen((current) => !current)}><XCircle className="h-4 w-4" /> Request changes instead</Button>
                    {declineOpen ? (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                        <label><span className="mb-1.5 block text-xs font-bold">What needs to change?</span><Textarea rows={3} value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} placeholder="Explain the issue so the sender can prepare a corrected version." maxLength={2_000} /></label>
                        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">Requesting changes stops this acceptance request and notifies the sender. It does not mark the Agreement accepted.</p>
                        <Button type="button" variant="destructive" className="mt-3 w-full" disabled={declining || declineReason.trim().length < 5} onClick={() => void decline()}>{declining ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Request changes</Button>
                      </div>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>

            <Card><CardContent className="flex flex-col gap-3 p-5 text-xs leading-5 text-muted-foreground"><div className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" /><p>The acceptance record links this typed-name acceptance to the version hash, named party, timestamp, consent text, and request metadata. It is not an OTP or independent identity-verification result.</p></div><p>Review the parties, terms, and payment plan above before recording acceptance.</p></CardContent></Card>
          </aside>
        </div>
        <p className="text-center text-xs text-muted-foreground">Never share an acceptance link. If you were not expecting this request, close this page and contact the sender through a trusted channel.</p>
      </div>
    </main>
  );
}

function formatTrigger(item: { triggerType: string; triggerDate: string | null; milestoneTitle: string | null }): string {
  if (item.triggerType === "on_signing") return "When both parties record acceptance";
  if (item.triggerType === "fixed_date") return item.triggerDate ? `On ${new Date(item.triggerDate).toLocaleDateString()}` : "On a fixed date";
  if (item.triggerType === "milestone_due") return `${item.milestoneTitle ? `When ${item.milestoneTitle} is due` : "When the milestone is due"}${item.triggerDate ? ` on ${new Date(item.triggerDate).toLocaleDateString()}` : ""}`;
  return `${item.triggerType === "milestone_completed" ? "When complete" : "When due"}${item.milestoneTitle ? ` · ${item.milestoneTitle}` : ""}`;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">{children}</main>;
}
