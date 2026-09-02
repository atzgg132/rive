"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronRight, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, Select, Textarea } from "@/components/ui";

type PlanMilestone = { key: string; existingId: string | null; title: string; dueDate: string | null };
type PlanTask = { key: string; title: string; dueDate: string | null; milestoneKey: string | null; milestoneId: string | null };
type WorkSetupPlan = {
  project: { mode: "create" | "reuse"; projectId: string | null; title: string; description: string | null; startDate: string | null; dueDate: string | null };
  milestones: PlanMilestone[];
  tasks: PlanTask[];
};
type WorkSetupRecord = {
  status: string;
  preview_plan: WorkSetupPlan | null;
  preview_hash: string | null;
  result_ids: { projectId?: string; milestoneIds?: string[]; taskIds?: string[] } | null;
  error: string | null;
};
type Project = {
  id: string;
  title: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  milestones?: Array<{ id: string; title: string; dueDate: string | null; completed: boolean }>;
} | null;

type Props = {
  contractId: string;
  project: Project;
  acceptedContent: { projectTitle?: string | null; projectDescription?: string | null } | undefined;
  setup: WorkSetupRecord;
  onRefresh: () => Promise<void>;
};

type FormState = {
  title: string;
  description: string;
  startDate: string;
  dueDate: string;
  milestones: PlanMilestone[];
  tasks: PlanTask[];
};

function key(prefix: string, index: number): string {
  return `${prefix}-${Date.now().toString(36)}-${index}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80);
}

function initialForm(project: Project, acceptedContent: Props["acceptedContent"], plan: WorkSetupPlan | null): FormState {
  const plannedProject = plan?.project;
  return {
    title: plannedProject ? plannedProject.title : project?.title || acceptedContent?.projectTitle || "",
    description: plannedProject ? plannedProject.description || "" : project?.description || acceptedContent?.projectDescription || "",
    startDate: plannedProject ? plannedProject.startDate || "" : project?.startDate?.slice(0, 10) || "",
    dueDate: plannedProject ? plannedProject.dueDate || "" : project?.dueDate?.slice(0, 10) || "",
    milestones: plan ? plan.milestones : [],
    tasks: plan ? plan.tasks : [],
  };
}

function toPlan(project: Project, form: FormState): WorkSetupPlan {
  return {
    project: {
      mode: project ? "reuse" : "create",
      projectId: project?.id || null,
      title: form.title.trim(),
      description: form.description.trim() || null,
      startDate: form.startDate || null,
      dueDate: form.dueDate || null,
    },
    milestones: form.milestones.map((milestone) => ({ ...milestone, title: milestone.title.trim(), dueDate: milestone.dueDate || null })),
    tasks: form.tasks.map((task) => ({ ...task, title: task.title.trim(), dueDate: task.dueDate || null })),
  };
}

export default function ContractWorkSetupCard({ contractId, project, acceptedContent, setup, onRefresh }: Props) {
  const [form, setForm] = useState(() => initialForm(project, acceptedContent, setup.preview_plan));
  const [busy, setBusy] = useState<"preview" | "confirm" | null>(null);
  const [error, setError] = useState("");
  const [previewHash, setPreviewHash] = useState(setup.preview_hash);
  const confirmKeyRef = useRef<string | null>(null);

  const updateForm = (patch: Partial<FormState>) => {
    setPreviewHash(null);
    setForm((current) => ({ ...current, ...patch }));
  };
  const updateMilestone = (index: number, patch: Partial<PlanMilestone>) => updateForm({ milestones: form.milestones.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  const updateTask = (index: number, patch: Partial<PlanTask>) => updateForm({ tasks: form.tasks.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });

  const preview = async () => {
    setBusy("preview");
    setError("");
    try {
      const response = await fetch(`/api/workflow/contracts/${encodeURIComponent(contractId)}/work-setup/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: toPlan(project, form) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to preview work setup.");
      confirmKeyRef.current = null;
      setPreviewHash(data.previewHash || null);
      if (data.plan) setForm(initialForm(project, acceptedContent, data.plan));
      toast.success("Work setup preview saved.");
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to preview work setup.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const confirm = async () => {
    if (!previewHash) {
      setError("Preview the work setup before confirming it.");
      return;
    }
    setBusy("confirm");
    setError("");
    try {
      const key = confirmKeyRef.current || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `work-setup-${Date.now()}-confirm`);
      confirmKeyRef.current = key;
      const response = await fetch(`/api/workflow/contracts/${encodeURIComponent(contractId)}/work-setup/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ previewHash }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to confirm work setup.");
      toast.success("Work setup created. Review the Project and billing triggers.");
      await onRefresh();
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Unable to confirm work setup.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  if (setup.status === "succeeded" && setup.result_ids?.projectId) {
    return (
      <Card id="work-setup" className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Check className="h-5 w-5 text-emerald-600" /> Work is set up</CardTitle><CardDescription className="mt-1">The accepted Agreement is connected to the Project and its billing triggers.</CardDescription></div><Badge variant="success">Complete</Badge></div></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 pt-0 sm:pt-0">
          <Link href={`/workflow/projects/${encodeURIComponent(setup.result_ids.projectId)}`} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:opacity-90">Review the Project <ChevronRight className="h-4 w-4" /></Link>
          {setup.result_ids.milestoneIds?.length ? <span className="text-xs text-muted-foreground">{setup.result_ids.milestoneIds.length} milestone{setup.result_ids.milestoneIds.length === 1 ? "" : "s"}</span> : null}
          {setup.result_ids.taskIds?.length ? <span className="text-xs text-muted-foreground">{setup.result_ids.taskIds.length} task{setup.result_ids.taskIds.length === 1 ? "" : "s"}</span> : null}
        </CardContent>
      </Card>
    );
  }

  const existingMilestones = project?.milestones || [];
  const previewSaved = Boolean(previewHash);
  return (
    <Card id="work-setup" className="border-primary/25 bg-primary/[0.035]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" /> Set up the work</CardTitle><CardDescription className="mt-1 max-w-2xl">Acceptance is recorded. Choose the operational Project, optional milestones, and dated Tasks before Rive activates the accepted billing plan.</CardDescription></div>
          <Badge variant={setup.status === "failed" ? "destructive" : previewSaved ? "default" : "warning"}>{setup.status.replaceAll("_", " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-0 sm:pt-0">
        {project ? <Alert variant="info"><LockIcon /><div><p className="font-bold">Reuse the linked Project</p><p className="mt-1 text-xs leading-5">The accepted Agreement already points to <Link className="font-bold underline" href={`/workflow/projects/${encodeURIComponent(project.id)}`}>{project.title}</Link>. Its identity and client stay locked; you can add planning dates, milestones, and tasks.</p></div></Alert> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField className="sm:col-span-2" label={project ? "Linked Project" : "Project title"} required>
            <Input value={form.title} disabled={Boolean(project)} onChange={(event) => updateForm({ title: event.target.value })} maxLength={200} />
          </FormField>
          {!project ? <FormField className="sm:col-span-2" label="Project description"><Textarea value={form.description} onChange={(event) => updateForm({ description: event.target.value })} maxLength={2_000} rows={3} /></FormField> : null}
          <FormField label="Start date"><Input type="date" value={form.startDate} onChange={(event) => updateForm({ startDate: event.target.value })} /></FormField>
          <FormField label="Due date"><Input type="date" value={form.dueDate} onChange={(event) => updateForm({ dueDate: event.target.value })} /></FormField>
        </div>

        <section className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Optional milestones</h3><p className="mt-1 text-xs text-muted-foreground">Only milestones you add here are created or connected.</p></div><Button type="button" size="sm" variant="outline" onClick={() => updateForm({ milestones: [...form.milestones, { key: key("milestone", form.milestones.length + 1), existingId: null, title: "", dueDate: null }] })}><Plus className="h-3.5 w-3.5" /> Add</Button></div>
          {form.milestones.length > 0 ? <div className="mt-3 flex flex-col gap-2">{form.milestones.map((milestone, index) => <div key={milestone.key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_auto]"><Input aria-label={`Milestone ${index + 1} title`} value={milestone.title} placeholder="Milestone title" onChange={(event) => updateMilestone(index, { title: event.target.value })} /><Input aria-label={`Milestone ${index + 1} due date`} type="date" value={milestone.dueDate || ""} onChange={(event) => updateMilestone(index, { dueDate: event.target.value || null })} /><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove milestone ${index + 1}`} onClick={() => updateForm({ milestones: form.milestones.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></Button></div>)}</div> : <p className="mt-3 text-xs text-muted-foreground">No milestones will be added.</p>}
        </section>

        <section className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold">Optional dated Tasks</h3><p className="mt-1 text-xs text-muted-foreground">Tasks stay in Rive’s planning queue; every task you add needs a due date.</p></div><Button type="button" size="sm" variant="outline" onClick={() => updateForm({ tasks: [...form.tasks, { key: key("task", form.tasks.length + 1), title: "", dueDate: null, milestoneKey: null, milestoneId: null }] })}><Plus className="h-3.5 w-3.5" /> Add</Button></div>
          {form.tasks.length > 0 ? <div className="mt-3 flex flex-col gap-2">{form.tasks.map((task, index) => <div key={task.key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)_10rem_auto]"><Input aria-label={`Task ${index + 1} title`} value={task.title} placeholder="Task title" onChange={(event) => updateTask(index, { title: event.target.value })} /><Select aria-label={`Task ${index + 1} milestone`} value={task.milestoneId ? `existing:${task.milestoneId}` : task.milestoneKey ? `plan:${task.milestoneKey}` : ""} onChange={(event) => { const value = event.target.value; updateTask(index, value.startsWith("existing:") ? { milestoneId: value.slice(9), milestoneKey: null } : value.startsWith("plan:") ? { milestoneKey: value.slice(5), milestoneId: null } : { milestoneKey: null, milestoneId: null }); }}><option value="">Project task</option>{existingMilestones.map((milestone) => <option key={`existing-${milestone.id}`} value={`existing:${milestone.id}`}>{milestone.title}</option>)}{form.milestones.map((milestone) => <option key={`plan-${milestone.key}`} value={`plan:${milestone.key}`}>{milestone.title || "New milestone"}</option>)}</Select><Input aria-label={`Task ${index + 1} due date`} type="date" required value={task.dueDate || ""} onChange={(event) => updateTask(index, { dueDate: event.target.value || null })} /><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove task ${index + 1}`} onClick={() => updateForm({ tasks: form.tasks.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></Button></div>)}</div> : <p className="mt-3 text-xs text-muted-foreground">No Tasks will be added.</p>}
        </section>

        {(error || setup.error) ? <Alert variant="destructive"><div><p className="font-bold">Work setup needs attention</p><p className="mt-1 text-xs leading-5">{error || setup.error}</p></div></Alert> : null}
        {previewSaved ? <p className="text-xs text-muted-foreground">Preview saved. Confirming will activate the accepted payment plan; invoice drafting remains a separate post-commit step.</p> : null}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void preview()}>{busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Preview plan</Button><Button type="button" disabled={Boolean(busy) || !previewSaved} onClick={() => void confirm()}>{busy === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm and create work</Button></div>
      </CardContent>
    </Card>
  );
}

function LockIcon() {
  return <span aria-hidden className="mt-0.5 text-primary">🔒</span>;
}
