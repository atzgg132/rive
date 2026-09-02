"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  FileSignature,
  Loader2,
  ReceiptText,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Select, Textarea } from "@/components/ui";

type ClientOption = { id: string; name: string; email?: string | null };
export type StartEngagementInquiry = {
  id: string;
  name: string;
  email: string;
  projectType: string;
  message: string;
  convertedClient: { id: string; name: string; email: string | null };
};
type CreatedResult = {
  records: { clientId: string; projectId: string; milestoneId?: string; contractId?: string; invoiceId?: string };
  nextAction: { kind: "agreement_review" | "invoice_review" | "milestone_plan" | "inquiry_project"; href: string; label: string };
};

type Props = {
  entryPoint: "onboarding" | "workspace" | "inquiry";
  currency: string;
  agreementsAvailable: boolean;
  clients?: ClientOption[];
  inquiry?: StartEngagementInquiry;
  onCreated?: (result: CreatedResult) => void;
};

const STEPS = [
  { id: "client", label: "Client", icon: UserRound },
  { id: "work", label: "Work", icon: BriefcaseBusiness },
  { id: "setup", label: "Set up", icon: Sparkles },
] as const;

function readSessionId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)rive_analytics_session=([^;]+)/);
  return match ? decodeURIComponent(match[1] || "") : null;
}

export function StartEngagementComposer({ entryPoint, currency, agreementsAvailable, clients: suppliedClients, inquiry, onCreated }: Props) {
  const router = useRouter();
  const [flowId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingClients, setLoadingClients] = useState(suppliedClients === undefined && !inquiry);
  const [clients, setClients] = useState<ClientOption[]>(suppliedClients || []);
  const [clientMode, setClientMode] = useState<"new" | "existing">(inquiry ? "existing" : "new");
  const [clientId, setClientId] = useState(inquiry?.convertedClient.id || "");
  const [clientName, setClientName] = useState(inquiry?.convertedClient.name || "");
  const [clientEmail, setClientEmail] = useState(inquiry?.convertedClient.email || "");
  const [projectTitle, setProjectTitle] = useState(inquiry?.projectType || "");
  const [scope, setScope] = useState("");
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [scopeMode, setScopeMode] = useState<"project" | "agreement">("project");
  const [includeInvoice, setIncludeInvoice] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const viewedSteps = useRef(new Set<string>());
  const started = useRef(false);

  const sessionId = useMemo(() => readSessionId(), []);
  const selectedClient = clients.find((client) => client.id === clientId) || inquiry?.convertedClient;
  const currentStep = STEPS[step];

  function track(eventName: string, stepId?: string) {
    void fetch("/api/engagement-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        flowId,
        sessionId,
        entryPoint,
        step: stepId,
        scopeMode,
        billingIncluded: includeInvoice,
      }),
    }).catch(() => undefined);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    track("engagement_flow_started");
    // The flow ID is stable for this mounted composer; tracking is best effort.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stepId = currentStep.id;
    if (viewedSteps.current.has(stepId)) return;
    viewedSteps.current.add(stepId);
    track("engagement_step_viewed", stepId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep.id]);

  useEffect(() => {
    if (entryPoint === "inquiry" || suppliedClients !== undefined) return;
    let cancelled = false;
    void fetch("/api/workflow/clients?mode=options&pageSize=100", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data?.success && Array.isArray(data.clients)) setClients(data.clients);
      })
      .catch(() => toast.error("Existing clients could not be loaded. You can still add a new one."))
      .finally(() => { if (!cancelled) setLoadingClients(false); });
    return () => { cancelled = true; };
  }, [entryPoint, suppliedClients]);

  function validateStep(): string | null {
    if (step === 0) {
      if (inquiry && (clientMode !== "existing" || clientId !== inquiry.convertedClient.id)) return "The converted Client is locked to this enquiry.";
      if (clientMode === "existing" && !clientId) return "Choose an existing client.";
      if (clientMode === "new" && !clientName.trim()) return "Add the client name.";
      if (clientMode === "new" && clientEmail.trim() && !/^\S+@\S+\.\S+$/.test(clientEmail.trim())) return "Use a valid client email.";
    }
    if (step === 1) {
      if (!projectTitle.trim()) return "Add the project name.";
      if (inquiry && !scope.trim()) return "Write the working scope before continuing.";
      if (!milestoneTitle.trim()) return "Add the first milestone.";
      if (!milestoneDueDate) return "Choose when the first milestone is due.";
    }
    if (step === 2 && includeInvoice) {
      if (!(Number(invoiceAmount) > 0)) return "Add a positive invoice amount.";
      if (!invoiceDueDate) return "Choose the invoice due date.";
    }
    return null;
  }

  function continueStep() {
    const problem = validateStep();
    if (problem) return toast.error(problem);
    track("engagement_step_completed", currentStep.id);
    setStep((value) => Math.min(2, value + 1));
  }

  async function createEngagement() {
    if (saving) return;
    const problem = validateStep();
    if (problem) return toast.error(problem);
    setSaving(true);
    try {
      track("engagement_step_completed", currentStep.id);
      const response = await fetch("/api/workflow/start-engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": flowId },
        body: JSON.stringify({
          flowId,
          sessionId,
          entryPoint,
          ...(entryPoint === "inquiry" && inquiry ? { sourceInquiryId: inquiry.id } : {}),
          client: clientMode === "existing"
            ? { mode: "existing", id: clientId }
            : { mode: "new", name: clientName, email: clientEmail },
          project: { title: projectTitle, scope },
          milestone: { title: milestoneTitle, dueDate: milestoneDueDate },
          scopeMode,
          ...(includeInvoice ? { invoice: { amount: invoiceAmount, dueDate: invoiceDueDate } } : {}),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "The engagement could not be created.");
      const result = data as CreatedResult;
      toast.success("Engagement created. Your records are connected.");
      if (onCreated) onCreated(result);
      else router.push(result.nextAction.href);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The engagement could not be created. Nothing was changed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="start-engagement-heading" className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
      <div className="border-b border-border bg-primary/[0.035] px-5 py-5 sm:px-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">One connected workflow</p>
            <h1 id="start-engagement-heading" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Start a client engagement</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Add the relationship and the first real piece of work. Rive connects the records behind the scenes.</p>
          </div>
          <p className="shrink-0 text-xs font-bold text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
        </div>
        <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Engagement progress">
          {STEPS.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.id} className={`flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${index === step ? "border-primary/30 bg-primary/10 text-primary" : index < step ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-border bg-background text-muted-foreground"}`}>
                {index < step ? <Check className="h-4 w-4 shrink-0" /> : <Icon className="h-4 w-4 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="p-5 sm:p-7">
        {step === 0 ? (
          <div className="space-y-5">
            {inquiry ? (
              <div className="rounded-2xl border border-primary/20 bg-primary/[0.035] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Converted Client</p>
                <p className="mt-2 text-sm font-black text-foreground">{inquiry.convertedClient.name}</p>
                {inquiry.convertedClient.email ? <p className="mt-1 text-xs text-muted-foreground">{inquiry.convertedClient.email}</p> : null}
                <p className="mt-3 text-xs leading-5 text-muted-foreground">This Client is locked to the enquiry. The relationship was chosen in the conversion step and cannot be changed here.</p>
              </div>
            ) : clients.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1" role="group" aria-label="Client source">
                <Button type="button" variant={clientMode === "existing" ? "default" : "ghost"} onClick={() => setClientMode("existing")}>Existing client</Button>
                <Button type="button" variant={clientMode === "new" ? "default" : "ghost"} onClick={() => setClientMode("new")}>New client</Button>
              </div>
            ) : null}
            {!inquiry && clientMode === "existing" && clients.length > 0 ? (
              <label className="block text-sm font-bold">Client<Select className="mt-2" value={clientId} onChange={(event) => setClientId(event.target.value)} disabled={loadingClients}><option value="">Choose a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></label>
            ) : !inquiry ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">Client name <span className="text-destructive">*</span><Input className="mt-2" autoFocus value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={160} placeholder="Northstar Labs" /></label>
                <label className="text-sm font-bold">Client email <span className="font-medium text-muted-foreground">optional</span><Input className="mt-2" type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} maxLength={320} placeholder="hello@northstar.example" /></label>
              </div>
            ) : null}
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <p className="font-bold text-foreground">Why start here?</p>
              <p className="mt-1 leading-6">The client becomes shared context for the project, Agreement, invoice, calendar, and future portfolio proof.</p>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {inquiry ? <div className="sm:col-span-2 rounded-2xl border border-border bg-muted/35 p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Visitor message · read-only</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{inquiry.message}</p></div> : null}
            <label className="text-sm font-bold sm:col-span-2">Project name <span className="text-destructive">*</span><Input className="mt-2" autoFocus value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} maxLength={180} placeholder="Website redesign" /></label>
            <label className="text-sm font-bold sm:col-span-2">Scope summary {inquiry ? <span className="text-destructive">*</span> : <span className="font-medium text-muted-foreground">optional</span>}<Textarea className="mt-2 resize-none" rows={4} value={scope} onChange={(event) => setScope(event.target.value)} maxLength={20_000} placeholder={inquiry ? "Write the scope you will own..." : "What will you deliver, and what does done look like?"} /></label>
            <label className="text-sm font-bold">First milestone <span className="text-destructive">*</span><Input className="mt-2" value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} maxLength={180} placeholder="Design approval" /></label>
                <label className="text-sm font-bold">Milestone due date <span className="text-destructive">*</span><Input className="mt-2" type="date" value={milestoneDueDate} onChange={(event) => setMilestoneDueDate(event.target.value)} /></label>
            <div className="sm:col-span-2 flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 text-sm">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="leading-6 text-muted-foreground">The milestone date also becomes the project deadline, so it appears in the existing Calendar and attention views without a duplicate event.</p>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-black">How should Rive keep the scope?</p>
              <div className={`mt-3 grid gap-3 ${agreementsAvailable ? "sm:grid-cols-2" : ""}`}>
                <button type="button" onClick={() => setScopeMode("project")} className={`rounded-2xl border p-4 text-left transition ${scopeMode === "project" ? "border-primary bg-primary/[0.05] ring-2 ring-primary/10" : "border-border hover:border-primary/30"}`}>
                  <BriefcaseBusiness className="h-5 w-5 text-primary" /><p className="mt-3 text-sm font-black">Keep scope with project</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Fastest start. You can decide on an Agreement later.</p>
                </button>
                {agreementsAvailable ? <button type="button" onClick={() => setScopeMode("agreement")} className={`rounded-2xl border p-4 text-left transition ${scopeMode === "agreement" ? "border-primary bg-primary/[0.05] ring-2 ring-primary/10" : "border-border hover:border-primary/30"}`}>
                  <FileSignature className="h-5 w-5 text-primary" /><p className="mt-3 text-sm font-black">Create editable Agreement draft</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Nothing is shared or finalized. You review every term next.</p>
                </button> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border p-4 sm:p-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={includeInvoice} onChange={(event) => setIncludeInvoice(event.target.checked)} className="mt-1 h-4 w-4 rounded border-border accent-primary" />
                <span><span className="flex items-center gap-2 text-sm font-black"><ReceiptText className="h-4 w-4 text-primary" /> Create a draft invoice</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Optional. The invoice remains private until you review and send it.</span></span>
              </label>
              {includeInvoice ? <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <label className="text-sm font-bold">Amount ({currency}) <span className="text-destructive">*</span><Input className="mt-2" type="number" min="0.01" max="1000000000" step="0.01" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} /></label>
                <label className="text-sm font-bold">Invoice due date <span className="text-destructive">*</span><Input className="mt-2" type="date" min={new Date().toISOString().slice(0, 10)} value={invoiceDueDate} onChange={(event) => setInvoiceDueDate(event.target.value)} /></label>
              </div> : null}
            </div>

            <div className="rounded-2xl bg-slate-950 p-5 text-white dark:bg-slate-900">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-300">Rive will create</p>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {clientMode === "existing" ? selectedClient?.name || "Selected client" : clientName || "New client"}</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {projectTitle || "Project"}</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> {milestoneTitle || "First milestone"}</li>
                {scopeMode === "agreement" ? <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Editable Agreement draft</li> : null}
                {includeInvoice ? <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Draft invoice</li> : null}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        {step > 0 ? <Button type="button" variant="ghost" disabled={saving} onClick={() => setStep((value) => value - 1)}><ArrowLeft className="h-4 w-4" /> Back</Button> : <span />}
        {step < 2
          ? <Button type="button" onClick={continueStep}>Continue <ArrowRight className="h-4 w-4" /></Button>
          : <Button type="button" disabled={saving} onClick={() => void createEngagement()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Start engagement</Button>}
      </div>
    </section>
  );
}
