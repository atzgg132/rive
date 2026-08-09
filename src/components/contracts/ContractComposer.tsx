"use client";

import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  CircleDollarSign,
  FileSignature,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export type ContractComposerClient = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  address: string | null;
  status?: string;
};

export type ContractComposerMilestone = {
  id: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
};

export type ContractComposerProject = {
  id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  currency: string;
  budget: string | null;
  milestones: ContractComposerMilestone[];
};

export type ContractComposerSource = {
  id: string;
  title: string;
  client: { name: string };
};

type ContractSection = {
  key: string;
  title: string;
  body: string;
  enabled: boolean;
  required?: boolean;
};

type PaymentDraft = {
  label: string;
  amount: string;
  triggerType: "on_signing" | "milestone_completed" | "milestone_due" | "fixed_date";
  triggerDate: string;
  milestoneId: string;
  dueDays: string;
  invoiceDescription: string;
};

type TemplateResponse = {
  title: string;
  currency: string;
  governing_law: string;
  jurisdiction: string;
  sections: ContractSection[];
  owner: { name: string; email: string };
  client: ContractComposerClient;
  project: {
    id: string;
    title: string;
    description: string | null;
    budget: string | null;
    currency: string;
    due_date: string | null;
    milestones: Array<{ id: string; title: string; due_date: string | null; completed: boolean }>;
  } | null;
  readiness: { can_share_for_review: boolean; can_start_signing: boolean; notices: string[] };
};

const blankPayment = (milestoneId = ""): PaymentDraft => ({
  label: "",
  amount: "",
  triggerType: milestoneId ? "milestone_completed" : "on_signing",
  triggerDate: "",
  milestoneId,
  dueDays: "7",
  invoiceDescription: "",
});

const stepLabels = ["Parties & project", "Terms", "Payments & review"];

export function ContractComposer({
  open,
  onOpenChange,
  clients,
  projects,
  sourceContracts,
  initialClientId = "",
  initialProjectId = "",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ContractComposerClient[];
  projects: ContractComposerProject[];
  sourceContracts: ContractComposerSource[];
  initialClientId?: string;
  initialProjectId?: string;
  onCreated: (contractId: string) => void;
}) {
  const wasOpen = useRef(false);
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [governingLaw, setGoverningLaw] = useState("India");
  const [jurisdiction, setJurisdiction] = useState("");
  const [sections, setSections] = useState<ContractSection[]>([]);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [template, setTemplate] = useState<TemplateResponse | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attemptedStep, setAttemptedStep] = useState(false);

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId) || null, [clients, clientId]);
  const availableProjects = useMemo(() => projects.filter((project) => !clientId || project.client_id === clientId), [projects, clientId]);
  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId) || null, [projects, projectId]);
  const enabledSections = useMemo(() => sections.filter((section) => section.enabled), [sections]);
  const total = useMemo(() => payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0), [payments]);
  const projectBudget = Number(selectedProject?.budget || template?.project?.budget || 0);
  const budgetDelta = projectBudget > 0 ? total - projectBudget : 0;

  useEffect(() => {
    if (open && !wasOpen.current) {
      const initialProject = projects.find((project) => project.id === initialProjectId);
      setStep(0);
      setClientId(initialProject?.client_id || initialClientId || "");
      setProjectId(initialProjectId || "");
      setTitle("");
      setCurrency(initialProject?.currency || "USD");
      setGoverningLaw("India");
      setJurisdiction("");
      setSections([]);
      setPayments([]);
      setTemplate(null);
      setSourceId("");
      setAttemptedStep(false);
    }
    wasOpen.current = open;
  }, [open, initialClientId, initialProjectId, projects]);

  useEffect(() => {
    if (!open || !clientId) return;
    const controller = new AbortController();
    const loadTemplate = async () => {
      setTemplateLoading(true);
      try {
        const search = new URLSearchParams({ clientId });
        if (projectId) search.set("projectId", projectId);
        const response = await fetch(`/api/workflow/contracts/template?${search.toString()}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to prepare this draft.");
        const next = payload.template as TemplateResponse;
        setTemplate(next);
        setTitle(next.title);
        setCurrency(next.currency);
        setGoverningLaw(next.governing_law || "India");
        setJurisdiction(next.jurisdiction || "");
        setSections(next.sections);
        setPayments([]);
        setSourceId("");
      } catch (error) {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "Unable to prepare this draft.");
      } finally {
        if (!controller.signal.aborted) setTemplateLoading(false);
      }
    };
    void loadTemplate();
    return () => controller.abort();
  }, [open, clientId, projectId]);

  const updateSection = (index: number, patch: Partial<ContractSection>) => {
    setSections((current) => current.map((section, itemIndex) => itemIndex === index ? { ...section, ...patch } : section));
  };

  const addCustomClause = () => {
    setSections((current) => [
      ...current,
      {
        key: `custom-${Date.now()}-${current.length}`,
        title: "Custom clause",
        body: "Describe the term both parties should agree to.",
        enabled: true,
      },
    ]);
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    setSections((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const reuseClauses = async () => {
    if (!sourceId || sourceLoading) return;
    setSourceLoading(true);
    try {
      const response = await fetch(`/api/workflow/contracts/${sourceId}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to load clauses.");
      const content = payload.contract?.versions?.[0]?.content;
      if (!Array.isArray(content?.sections)) throw new Error("That Agreement has no reusable clauses.");
      setSections(content.sections);
      if (typeof content.governingLaw === "string") setGoverningLaw(content.governingLaw);
      if (typeof content.jurisdiction === "string") setJurisdiction(content.jurisdiction);
      toast.success("Clauses copied. Client, project, and payments were left unchanged.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load clauses.");
    } finally {
      setSourceLoading(false);
    }
  };

  const addMilestonePayments = (splitBudget: boolean) => {
    const milestones = selectedProject?.milestones || [];
    if (!milestones.length) return;
    const totalCents = splitBudget && projectBudget > 0 ? Math.round(projectBudget * 100) : 0;
    const baseCents = totalCents ? Math.floor(totalCents / milestones.length) : 0;
    let remainder = totalCents ? totalCents - baseCents * milestones.length : 0;
    setPayments(milestones.map((milestone) => {
      const cents = baseCents + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return {
        ...blankPayment(milestone.id),
        label: milestone.title,
        amount: cents ? (cents / 100).toFixed(2) : "",
        invoiceDescription: milestone.title,
      };
    }));
  };

  const updatePayment = (index: number, patch: Partial<PaymentDraft>) => {
    setPayments((current) => current.map((payment, itemIndex) => itemIndex === index ? { ...payment, ...patch } : payment));
  };

  const stepProblem = useMemo(() => {
    if (step === 0) {
      if (!clientId) return "Choose the client who will be the other acceptance party.";
      if (!title.trim()) return "Add a clear Agreement title.";
      if (!/^[A-Z]{3}$/.test(currency)) return "Use a valid three-letter currency code.";
      if (!governingLaw.trim()) return "Confirm the governing law before continuing.";
    }
    if (step === 1) {
      if (!enabledSections.length) return "Keep at least one Agreement clause enabled.";
      const incomplete = enabledSections.find((section) => !section.title.trim() || !section.body.trim());
      if (incomplete) return "Every enabled clause needs a title and complete wording.";
    }
    if (step === 2) {
      for (let index = 0; index < payments.length; index += 1) {
        const payment = payments[index];
        if (!payment.label.trim()) return `Payment ${index + 1} needs a label.`;
        if (!Number.isFinite(Number(payment.amount)) || Number(payment.amount) <= 0) return `Payment ${index + 1} needs a positive amount.`;
        const dueDays = Number(payment.dueDays);
        if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 365) return `Payment ${index + 1} needs a due period from 0 to 365 days.`;
        if (payment.triggerType === "fixed_date" && !payment.triggerDate) return `Payment ${index + 1} needs a trigger date.`;
        if (payment.triggerType.startsWith("milestone") && !payment.milestoneId) return `Payment ${index + 1} needs a milestone.`;
        if (payment.triggerType === "milestone_due") {
          const milestone = selectedProject?.milestones.find((item) => item.id === payment.milestoneId);
          if (!milestone?.dueDate) return `Payment ${index + 1} needs a milestone with a due date.`;
        }
      }
    }
    return null;
  }, [clientId, currency, enabledSections, governingLaw, payments, selectedProject?.milestones, step, title]);

  const continueStep = () => {
    setAttemptedStep(true);
    if (stepProblem) return;
    setAttemptedStep(false);
    setStep((current) => Math.min(2, current + 1));
  };

  const submit = async () => {
    setAttemptedStep(true);
    if (stepProblem || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/workflow/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          clientId,
          projectId: projectId || null,
          currency,
          governingLaw: governingLaw.trim(),
          jurisdiction: jurisdiction.trim() || null,
          sections,
          paymentPlan: payments.map((payment) => ({
            ...payment,
            amount: Number(payment.amount),
            currency,
            dueDays: Number(payment.dueDays),
            triggerDate: payment.triggerDate || null,
            milestoneId: payment.milestoneId || null,
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to create the Agreement draft.");
      toast.success("Agreement draft created. Review it before sharing.");
      onOpenChange(false);
      onCreated(payload.contractId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create the Agreement draft.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) onOpenChange(nextOpen); }}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-5xl flex-col overflow-hidden p-0" showClose={!saving}>
        <div className="shrink-0 border-b border-border px-5 py-4 pr-14 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileSignature className="h-5 w-5" /></div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Agreement composer</p>
              <DialogTitle className="mt-0.5 text-xl font-extrabold">Create a reviewable first draft</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">Rive pre-fills what it already knows. You control every legal and payment term before anything is shared.</DialogDescription>
            </div>
          </div>
          <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Agreement creation progress">
            {stepLabels.map((label, index) => (
              <li key={label} className="min-w-0">
                <div className={`h-1 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`} />
                <p className={`mt-1.5 truncate text-[10px] font-bold sm:text-xs ${index === step ? "text-foreground" : "text-muted-foreground"}`}>{index + 1}. {label}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {step === 0 ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
              <div className="grid content-start gap-4 sm:grid-cols-2">
                <FormField label="Client" required>
                  <Select value={clientId} onChange={(event) => { const nextClientId = event.target.value; setClientId(nextClientId); setProjectId(""); setAttemptedStep(false); if (!nextClientId) { setTemplate(null); setSections([]); setPayments([]); setTitle(""); } }} disabled={templateLoading}>
                    <option value="">Choose a client</option>
                    {clients.filter((client) => client.status !== "archived").map((client) => <option key={client.id} value={client.id}>{client.name}{client.email ? ` · ${client.email}` : " · email missing"}</option>)}
                  </Select>
                </FormField>
                <FormField label="Project" hint="Optional. Linking it reuses the brief, currency, budget, and milestones.">
                  <Select value={projectId} onChange={(event) => { const next = projects.find((project) => project.id === event.target.value); setProjectId(event.target.value); if (next?.client_id && next.client_id !== clientId) setClientId(next.client_id); setAttemptedStep(false); }} disabled={!clientId || templateLoading}>
                    <option value="">No linked project</option>
                    {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                  </Select>
                </FormField>
                <FormField className="sm:col-span-2" label="Agreement title" required>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Design services agreement — Acme" maxLength={180} disabled={templateLoading} />
                </FormField>
                <FormField label="Currency" required hint="All automated invoices use this currency.">
                  <Input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))} maxLength={3} />
                </FormField>
                <FormField label="Governing law" required hint="Confirm this with counsel for cross-border work.">
                  <Input value={governingLaw} onChange={(event) => setGoverningLaw(event.target.value)} placeholder="India" maxLength={160} />
                </FormField>
                <FormField className="sm:col-span-2" label="Jurisdiction / venue" hint="Optional, but often useful for dispute clauses.">
                  <Input value={jurisdiction} onChange={(event) => setJurisdiction(event.target.value)} placeholder="e.g. Bengaluru, Karnataka" maxLength={160} />
                </FormField>

                {sourceContracts.length > 0 ? (
                  <div className="sm:col-span-2 rounded-2xl border border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-primary" /><h3 className="text-sm font-bold">Reuse clauses you already negotiated</h3></div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Only clause wording and venue are copied. Parties, project details, and payments stay specific to this engagement.</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <Select value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="min-w-0 flex-1">
                        <option value="">Choose an earlier Agreement</option>
                        {sourceContracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.title} · {contract.client.name}</option>)}
                      </Select>
                      <Button type="button" variant="outline" disabled={!sourceId || sourceLoading} onClick={() => void reuseClauses()}>{sourceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Reuse clauses</Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <aside className="flex flex-col gap-4">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h3 className="text-sm font-bold">Parties and source data</h3></div>
                  {templateLoading ? <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparing the draft…</p> : selectedClient ? (
                    <dl className="mt-3 space-y-3 text-xs">
                      <div><dt className="font-semibold text-muted-foreground">Client</dt><dd className="mt-0.5 font-medium">{selectedClient.name}{selectedClient.company ? ` · ${selectedClient.company}` : ""}</dd><dd className="text-muted-foreground">{selectedClient.email || "Email not recorded"}</dd></div>
                      {selectedProject ? <div><dt className="font-semibold text-muted-foreground">Project snapshot</dt><dd className="mt-0.5 font-medium">{selectedProject.title}</dd><dd className="text-muted-foreground">{selectedProject.milestones.length} milestones{selectedProject.budget ? ` · ${selectedProject.currency} ${Number(selectedProject.budget).toLocaleString()}` : ""}</dd></div> : null}
                    </dl>
                  ) : <p className="mt-3 text-xs leading-5 text-muted-foreground">Choose a client to pull in the named parties and prepare the terms.</p>}
                </div>
                {template?.readiness.notices?.length ? (
                  <Alert variant="warning" className="text-xs">
                    <AlertTriangle className="h-4 w-4" />
                    <div><p className="font-bold">Before this reaches recorded acceptance</p><ul className="mt-1.5 list-disc space-y-1 pl-4 text-muted-foreground">{template.readiness.notices.map((notice) => <li key={notice}>{notice}</li>)}</ul></div>
                  </Alert>
                ) : null}
              </aside>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div><h3 className="text-base font-extrabold">Customize the actual agreement</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Required execution terms stay enabled. Optional and custom clauses can be rewritten, reordered, or removed.</p></div>
                <Button type="button" variant="outline" onClick={addCustomClause}><Plus className="h-4 w-4" /> Add custom clause</Button>
              </div>
              <div className="space-y-3">
                {sections.map((section, index) => (
                  <article key={section.key} className={`rounded-2xl border p-4 ${section.enabled ? "border-border bg-card" : "border-border/60 bg-muted/30"}`}>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={section.enabled} disabled={section.required} onChange={(event) => updateSection(index, { enabled: event.target.checked })} aria-label={`Include ${section.title}`} className="mt-3 h-4 w-4 shrink-0 accent-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input value={section.title} onChange={(event) => updateSection(index, { title: event.target.value })} disabled={!section.enabled} className="font-semibold" maxLength={160} />
                          <div className="flex shrink-0 items-center gap-1">
                            {section.required ? <Badge variant="secondary">Required</Badge> : null}
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move clause up" disabled={index === 0} onClick={() => moveSection(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move clause down" disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                            {!section.required ? <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove clause" className="text-destructive" onClick={() => setSections((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-3.5 w-3.5" /></Button> : null}
                          </div>
                        </div>
                        <Textarea value={section.body} onChange={(event) => updateSection(index, { body: event.target.value })} disabled={!section.enabled} rows={4} maxLength={20_000} className="mt-2 leading-6" />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                  <div><h3 className="text-base font-extrabold">Connect fees to invoice triggers</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Invoices are generated as drafts only. You always review and explicitly send them.</p></div>
                  <Button type="button" variant="outline" onClick={() => setPayments((current) => [...current, blankPayment()])}><Plus className="h-4 w-4" /> Add payment</Button>
                </div>

                {selectedProject?.milestones.length ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="mr-auto text-xs font-medium">Build a schedule from {selectedProject.milestones.length} existing project milestones.</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => addMilestonePayments(false)}>Add milestones</Button>
                    {projectBudget > 0 ? <Button type="button" variant="secondary" size="sm" onClick={() => addMilestonePayments(true)}>Split {currency} {projectBudget.toLocaleString()}</Button> : null}
                  </div>
                ) : null}

                {payments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center"><CircleDollarSign className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-bold">No automatic invoice schedule</p><p className="mt-1 text-xs text-muted-foreground">That is valid. You can invoice manually or add payment triggers here.</p></div>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment, index) => (
                      <article key={`${index}-${payment.milestoneId}`} className="rounded-2xl border border-border bg-card p-4">
                        <div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-sm font-bold">Payment {index + 1}</h4><Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setPayments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-3.5 w-3.5" /> Remove</Button></div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FormField label="Label" required><Input value={payment.label} onChange={(event) => updatePayment(index, { label: event.target.value })} placeholder="Kickoff deposit" maxLength={160} /></FormField>
                          <FormField label={`Amount (${currency})`} required><Input type="number" min="0.01" max="1000000000" step="0.01" value={payment.amount} onChange={(event) => updatePayment(index, { amount: event.target.value })} placeholder="0.00" /></FormField>
                          <FormField label="Generate draft invoice"><Select value={payment.triggerType} onChange={(event) => updatePayment(index, { triggerType: event.target.value as PaymentDraft["triggerType"], milestoneId: "", triggerDate: "" })}><option value="on_signing">When both parties record acceptance</option><option value="milestone_completed">When a milestone completes</option><option value="milestone_due">When a milestone becomes due</option><option value="fixed_date">On a fixed date</option></Select></FormField>
                          {payment.triggerType === "fixed_date" ? <FormField label="Trigger date" required><Input type="date" value={payment.triggerDate} onChange={(event) => updatePayment(index, { triggerDate: event.target.value })} /></FormField> : payment.triggerType.startsWith("milestone") ? <FormField label="Milestone" required><Select value={payment.milestoneId} onChange={(event) => { const milestone = selectedProject?.milestones.find((item) => item.id === event.target.value); updatePayment(index, { milestoneId: event.target.value, ...(!payment.label && milestone ? { label: milestone.title, invoiceDescription: milestone.title } : {}) }); }}><option value="">Choose milestone</option>{selectedProject?.milestones.map((milestone) => <option key={milestone.id} value={milestone.id} disabled={payment.triggerType === "milestone_due" && !milestone.dueDate}>{milestone.title}{milestone.completed ? " · completed" : ""}{payment.triggerType === "milestone_due" && !milestone.dueDate ? " · add a due date first" : ""}</option>)}</Select></FormField> : <FormField label="Invoice due" htmlFor={`payment-${index}-due-days`}><div className="flex items-center gap-2"><Input id={`payment-${index}-due-days`} type="number" min="0" max="365" value={payment.dueDays} onChange={(event) => updatePayment(index, { dueDays: event.target.value })} /><span className="shrink-0 text-xs text-muted-foreground">days</span></div></FormField>}
                          {payment.triggerType !== "on_signing" ? <FormField label="Invoice due" htmlFor={`payment-${index}-due-days`}><div className="flex items-center gap-2"><Input id={`payment-${index}-due-days`} type="number" min="0" max="365" value={payment.dueDays} onChange={(event) => updatePayment(index, { dueDays: event.target.value })} /><span className="shrink-0 text-xs text-muted-foreground">days</span></div></FormField> : null}
                          <FormField className={payment.triggerType === "on_signing" ? "sm:col-span-2" : ""} label="Invoice line description" hint="Optional"><Input value={payment.invoiceDescription} onChange={(event) => updatePayment(index, { invoiceDescription: event.target.value })} placeholder={payment.label || "Work covered by this payment"} maxLength={240} /></FormField>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <aside className="flex flex-col gap-4">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <h3 className="text-sm font-bold">Draft summary</h3>
                  <dl className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Parties</dt><dd className="text-right font-semibold">You + {selectedClient?.name || "client"}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Clauses</dt><dd className="font-semibold">{enabledSections.length} included</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Payments</dt><dd className="font-semibold">{payments.length}</dd></div>
                    <div className="flex justify-between gap-3 border-t border-border pt-2"><dt className="font-semibold">Agreement total</dt><dd className="font-extrabold">{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd></div>
                    {projectBudget > 0 ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Project budget</dt><dd className="font-semibold">{currency} {projectBudget.toLocaleString()}</dd></div> : null}
                  </dl>
                  {projectBudget > 0 && Math.abs(budgetDelta) >= 0.01 ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">The payment schedule is {currency} {Math.abs(budgetDelta).toLocaleString(undefined, { minimumFractionDigits: 2 })} {budgetDelta > 0 ? "above" : "below"} the project budget. That can be intentional—confirm it before saving.</p> : null}
                </div>
                <Alert variant="info" className="text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                  <div><p className="font-bold">Nothing is sent yet</p><p className="mt-1 leading-5 text-muted-foreground">Saving creates an editable version. Review sharing, finalization, recorded acceptance, and every generated invoice remain separate deliberate actions.</p></div>
                </Alert>
              </aside>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:px-7">
          <div className="min-h-5 flex-1 text-xs" aria-live="polite">
            {attemptedStep && stepProblem ? <span className="inline-flex items-center gap-1.5 font-semibold text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> {stepProblem}</span> : step === 2 && !selectedClient?.email ? <span className="text-amber-700 dark:text-amber-300">You can save this draft, but add the client email before review or recorded acceptance.</span> : <span className="text-muted-foreground">Step {step + 1} of 3</span>}
          </div>
          <div className="flex items-center justify-end gap-2">
            {step > 0 ? <Button type="button" variant="outline" disabled={saving} onClick={() => { setStep((current) => current - 1); setAttemptedStep(false); }}><ArrowLeft className="h-4 w-4" /> Back</Button> : <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>}
            {step < 2 ? <Button type="button" disabled={templateLoading} onClick={continueStep}>Continue <ArrowRight className="h-4 w-4" /></Button> : <Button type="button" disabled={saving} onClick={() => void submit()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save editable draft</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
