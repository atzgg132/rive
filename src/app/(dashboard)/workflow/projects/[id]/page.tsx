"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Tag,
  Loader2,
  FileText,
  Clock,
  CheckCircle,
  FileSignature,
  ExternalLink,
  CircleSlash2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Input, Kicker, StatusBadge, buttonVariants } from "@/components/ui";
import { statusTone, type StatusKind } from "@/lib/status-tone";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useFeatureAvailability } from "@/components/FeatureAvailabilityContext";

type ProjectInvoice = { id: string; invoiceNumber: string; issueDate: string; total: number | string; currency: string; status: string };
type ProjectClient = { id: string; name: string; company: string | null; avatarColor: string };
type ProjectMilestone = { id: string; title: string; dueDate: string | null; completed: boolean; completedAt: string | null };
type ProjectTask = { id: string; title: string; status: string; dueDate: string | null; sourceInquiryId: string | null };
type ProjectContract = { id: string; title: string; status: string; currency: string; executedAt: string | null; updatedAt: string };
type ProjectDetails = { id: string; title: string; status: string; createdAt: string; budget: string | null; currency: string; dueDate: string | null; tags: string[]; description: string | null; contractCoverage: "undecided" | "rive" | "external" | "none"; externalContractLabel: string | null; externalContractUrl: string | null; contractDecisionAt: string | null; proof_offer: { projectId: string; caseStudyId: string; href: string; label: string } | null; related_counts?: { invoices: number; milestones: number; contracts: number }; client: ProjectClient | null; invoices: ProjectInvoice[]; milestones: ProjectMilestone[]; tasks: ProjectTask[]; contracts: ProjectContract[] };

const chipTone = (kind: StatusKind, value: string) => {
  const tone = statusTone(kind, value);
  return tone === "primary" ? "default" : tone;
};

export default function ProjectProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { displayCurrency, format, formatConverted } = useCurrency();
  const { agreements } = useFeatureAvailability();
  const { id } = use(params);
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [milestoneBusy, setMilestoneBusy] = useState<string | null>(null);
  const [coverageBusy, setCoverageBusy] = useState(false);
  const [externalFormOpen, setExternalFormOpen] = useState(false);
  const [externalLabel, setExternalLabel] = useState("Agreement handled outside Rive");
  const [externalUrl, setExternalUrl] = useState("");
  const [createdFromEngagement, setCreatedFromEngagement] = useState(false);
  const [createdFromInquiry, setCreatedFromInquiry] = useState(false);

  useEffect(() => {
    async function loadProject() {
      try {
        const res = await fetch(`/api/workflow/projects/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setProject(data.project);
            const query = new URLSearchParams(window.location.search);
            if (query.get("from") === "engagement") {
              setCreatedFromEngagement(true);
              const milestoneId = query.get("milestoneId");
              if (milestoneId) window.setTimeout(() => document.getElementById(`milestone-${milestoneId}`)?.focus(), 0);
            }
            if (query.get("from") === "inquiry") setCreatedFromInquiry(true);
          } else {
            toast.error(data.message);
          }
        }
      } catch {
        toast.error("Failed to load project profile");
      } finally {
        setLoading(false);
      }
    }
    loadProject();
  }, [id]);

  const formatCurrency = (val: number, currency: string = displayCurrency) => format(val, currency);

  const updateMilestone = async (milestone: ProjectMilestone) => {
    setMilestoneBusy(milestone.id);
    try {
      const response = await fetch(`/api/workflow/milestones/${milestone.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: !milestone.completed }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to update milestone.");
      setProject((current) => current ? { ...current, milestones: current.milestones.map((item) => item.id === milestone.id ? { ...item, completed: data.milestone.completed, completedAt: data.milestone.completed_at } : item) } : current);
      toast.success(milestone.completed ? "Milestone reopened." : "Milestone completed. Billing checks updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update milestone.");
    } finally {
      setMilestoneBusy(null);
    }
  };

  const updateContractCoverage = async (coverage: "external" | "none" | "undecided") => {
    if (coverageBusy) return;
    setCoverageBusy(true);
    try {
      const response = await fetch(`/api/workflow/projects/${id}/contract-coverage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverage, ...(coverage === "external" ? { externalLabel, externalUrl } : {}) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to update contract coverage.");
      setProject((current) => current ? {
        ...current,
        contractCoverage: data.coverage.status,
        externalContractLabel: data.coverage.external_label,
        externalContractUrl: data.coverage.external_url,
        contractDecisionAt: data.coverage.decided_at,
      } : current);
      toast.success(data.message);
      setExternalFormOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update contract coverage.");
    } finally {
      setCoverageBusy(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h2 className="text-xl font-bold text-foreground">Project not found</h2>
        <Link href="/workflow/projects" className="text-primary mt-2 hover:underline">Return to projects</Link>
      </div>
    );
  }

  const budgetAmount = project.budget === null ? null : Number(project.budget);
  const convertedBudget = budgetAmount === null ? null : formatConverted(budgetAmount, project.currency);

  return (
    <div className="flex flex-col gap-8 animate-panel-in pb-12">
      {createdFromEngagement && (
        <div className="rounded-none border border-success/25 bg-success/10 p-4 text-sm text-foreground">
          <p className="font-bold">Your client, project, and first milestone are connected.</p>
          <p className="mt-1 text-xs">Plan the milestone below; its due date is already available to Calendar.</p>
        </div>
      )}
      {createdFromInquiry && (
        <div className="rounded-none border border-success/25 bg-success/10 p-4 text-sm text-foreground">
          <p className="font-bold">This Project came from a portfolio enquiry.</p>
          <p className="mt-1 text-xs leading-5">The visitor message stays with the enquiry. Your follow-up Task is ready below; write the working scope here.</p>
        </div>
      )}
      {/* Header Breadcrumbs */}
      <div>
        <Link href="/workflow/projects" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          back to projects
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{project.title}</h1>
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4" /> Started {formatDate(project.createdAt)}
            </p>
          </div>
          <StatusBadge kind="project" value={project.status} className="uppercase" />
        </div>
      </div>

      {project.proof_offer ? (
        <div className="flex flex-col gap-3 rounded-none border border-primary/25 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-none bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span><div><p className="text-sm font-bold">Turn this completed work into proof</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Create or open a private case study draft. Nothing becomes public until you confirm it.</p></div></div>
          <Link href={project.proof_offer.href} className="inline-flex shrink-0 items-center justify-center rounded-none bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:opacity-90">{project.proof_offer.label}</Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Project Meta & Client Info */}
        <div className="flex flex-col gap-6 lg:col-span-1">

          {/* Client Info Card */}
          {project.client ? (
            <div className="bg-card p-6 rounded-none border border-border">
              <Kicker tone="muted" dot={false} className="mb-4">Client</Kicker>
              <Link href={`/workflow/clients/${project.client.id}`} className="flex items-center gap-3 group">
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg uppercase group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: project.client.avatarColor }}
                >
                  {project.client.name.substring(0, 2)}
                </div>
                <div className="flex flex-col">
              <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{project.client.name}</h4>
                  <span className="text-xs text-muted-foreground">{project.client.company || "Private Client"}</span>
                </div>
              </Link>
            </div>
          ) : (
            <div className="bg-muted p-6 rounded-none border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">
              No client linked.
            </div>
          )}

          {/* Project Details */}
          <div className="inverse-block p-6 rounded-none border border-foreground">
            <Kicker tone="muted" dot={false} className="mb-6 text-background/70">Financial Overview</Kicker>

            <div className="flex flex-col gap-5">
              <div>
                <div className="text-xs text-background/60 mb-1 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Budget</div>
                <div className="text-2xl font-mono font-semibold tabular-nums text-background">{budgetAmount === null ? "Unspecified" : convertedBudget || formatCurrency(budgetAmount, project.currency)}</div>
                {budgetAmount !== null && project.currency !== displayCurrency && convertedBudget && <div className="mt-1 text-xs font-medium font-mono tabular-nums text-background/60">Originally {formatCurrency(budgetAmount, project.currency)}</div>}
              </div>

              <div className="h-px bg-background/20 w-full" />

              <div>
                <div className="text-xs text-background/60 mb-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Deadline</div>
                <div className="text-lg font-semibold font-mono tabular-nums">{project.dueDate ? formatDate(project.dueDate) : "No deadline"}</div>
              </div>
            </div>
          </div>

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="bg-card p-6 rounded-none border border-border">
              <Kicker tone="muted" dot={false} className="mb-3">Project Tags</Kicker>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((t: string, idx: number) => (
                  <Badge key={idx} variant="info">
                    <Tag className="h-2.5 w-2.5" />
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Description & Billing */}
        <div className="flex flex-col gap-6 lg:col-span-2">

          {/* Project Description */}
          <div className="bg-card p-6 rounded-none border border-border">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" /> Project Brief
            </h3>
            {project.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{project.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No project description provided.</p>
            )}
            {project.contractCoverage === "undecided" && project.description ? (
              <p className="mt-4 rounded-none border border-warning/25 bg-warning/10 px-3 py-2 text-xs leading-5 text-foreground">Scope is saved with this project. The Agreement decision remains open; this brief is not a legal contract.</p>
            ) : null}
          </div>

          {project.tasks?.length > 0 ? (
            <div className="bg-card p-6 rounded-none border border-border">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4"><Clock className="h-5 w-5 text-primary" /> Follow-up Tasks</h3>
              <div className="flex flex-col gap-2">{project.tasks.map((task) => <div id={`follow-up-task-${task.id}`} key={task.id} className="flex items-center justify-between gap-3 rounded-none border border-border p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.status.replaceAll("_", " ")} · {task.dueDate ? `Due ${formatDate(task.dueDate)}` : "Unscheduled"}</p></div><span className="shrink-0 rounded-full border border-primary/20 px-2 py-1 text-[10px] font-bold uppercase text-primary">From enquiry</span></div>)}</div>
            </div>
          ) : null}

          {/* Milestones */}
          <div className="bg-card p-6 rounded-none border border-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" /> Milestones
              </h3>
              <span className="text-xs text-muted-foreground">{project.milestones.filter((item) => item.completed).length}/{project.related_counts?.milestones ?? project.milestones.length} complete</span>
            </div>
            {project.milestones.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-none bg-muted/40 text-sm text-muted-foreground">No milestones recorded for this project.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {project.milestones.map((milestone) => (
                  <div id={`milestone-${milestone.id}`} tabIndex={-1} key={milestone.id} className="flex items-center justify-between gap-4 rounded-none border border-border p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${milestone.completed ? "text-success" : "text-foreground"}`}>{milestone.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Due {milestone.dueDate ? formatDate(milestone.dueDate) : "No due date"}</p>
                    </div>
                    <Button size="sm" variant={milestone.completed ? "secondary" : "outline"} disabled={milestoneBusy === milestone.id} onClick={() => void updateMilestone(milestone)}>{milestoneBusy === milestone.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : milestone.completed ? "Completed" : "Mark complete"}</Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {agreements && <>
          {/* Linked Agreements */}
          <div className="bg-card p-6 rounded-none border border-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><FileSignature className="h-5 w-5 text-primary" /> Agreements</h3>
              <Link href={`/workflow/contracts?projectId=${encodeURIComponent(project.id)}`} className="text-xs font-semibold text-primary hover:bg-accent px-3 py-1.5 rounded-none transition-colors">View all</Link>
            </div>
            {project.contracts.length === 0 ? project.contractCoverage === "external" ? (
              <div className="rounded-none border border-success/25 bg-success/10 p-4">
                <div className="flex items-start gap-3"><ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-success" /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">{project.externalContractLabel || "Agreement handled outside Rive"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">This project intentionally has no Rive Agreement. Milestones and invoices continue to work normally.</p>{project.externalContractUrl ? <a href={project.externalContractUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-success underline">Open external record <ExternalLink className="h-3 w-3" /></a> : null}</div><Button size="sm" variant="ghost" disabled={coverageBusy} onClick={() => void updateContractCoverage("undecided")}>Change</Button></div>
              </div>
            ) : project.contractCoverage === "none" ? (
              <div className="rounded-none border border-border bg-muted/40 p-4"><div className="flex items-start gap-3"><CircleSlash2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-bold">No contract required</p><p className="mt-1 text-xs leading-5 text-muted-foreground">This is an intentional project decision, not a missing setup step.</p></div><Button size="sm" variant="ghost" disabled={coverageBusy} onClick={() => void updateContractCoverage("undecided")}>Change</Button></div></div>
            ) : (
              <div className="rounded-none border border-warning/25 bg-warning/10 p-4">
                <div className="flex items-start gap-3"><FileSignature className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-foreground">Agreement coverage is undecided</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A Rive Agreement is optional, but record how this engagement is covered so it does not look accidentally incomplete.</p></div></div>
                <div className="mt-4 flex flex-wrap gap-2">{project.client ? <Link className={buttonVariants({ variant: "default", size: "sm" })} href={`/workflow/contracts?new=1&projectId=${encodeURIComponent(project.id)}&clientId=${encodeURIComponent(project.client.id)}`}><FileSignature className="h-3.5 w-3.5" /> Create Rive Agreement</Link> : <p className="text-xs font-semibold text-muted-foreground">Link a client before creating a Rive Agreement.</p>}<Button size="sm" variant="outline" disabled={coverageBusy} onClick={() => setExternalFormOpen((current) => !current)}><ExternalLink className="h-3.5 w-3.5" /> Handled elsewhere</Button><Button size="sm" variant="ghost" disabled={coverageBusy} onClick={() => void updateContractCoverage("none")}><CircleSlash2 className="h-3.5 w-3.5" /> Not needed</Button></div>
                {externalFormOpen ? <div className="mt-3 grid gap-2 rounded-none border border-warning/25 bg-card p-3"><p className="text-xs font-bold text-foreground">External Agreement reference</p><Input value={externalLabel} onChange={(event) => setExternalLabel(event.target.value)} maxLength={180} placeholder="Client MSA in Drive" /><Input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="Optional https:// link" /><div className="flex justify-end"><Button size="sm" disabled={coverageBusy} onClick={() => void updateContractCoverage("external")}>{coverageBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />} Save reference</Button></div></div> : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {project.contracts.map((item) => (
                  <Link key={item.id} href={`/workflow/contracts/${item.id}`} className="flex items-center justify-between gap-4 rounded-none border border-border p-4 hover:border-primary transition-all">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.currency} · Updated {formatDate(item.updatedAt)}</p></div>
                    <Badge variant={chipTone("contract", item.status)} dot className="shrink-0 uppercase">{item.status.replaceAll("_", " ")}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          </>}

          {/* Linked Invoices */}
          <div className="bg-card p-6 rounded-none border border-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" /> Linked Invoices
              </h3>
              <Link href={`/workflow/revenue?projectId=${encodeURIComponent(project.id)}`} className="text-xs font-semibold text-primary hover:bg-accent px-3 py-1.5 rounded-none transition-colors">
                View all
              </Link>
            </div>

            {project.invoices && project.invoices.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-none bg-muted/40 text-sm text-muted-foreground">
                No invoices issued for this project yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {project.invoices && project.invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-4 rounded-none border border-border hover:border-primary transition-all bg-card">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm font-mono tabular-nums text-foreground">{inv.invoiceNumber}</span>
                      <span className="text-xs text-muted-foreground">Issued: {formatDate(inv.issueDate)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-right font-extrabold text-sm text-foreground">
                        <span className="block font-mono tabular-nums">{formatConverted(Number(inv.total), inv.currency) || formatCurrency(Number(inv.total), inv.currency)}</span>
                        {inv.currency !== displayCurrency && <span className="block text-xs font-medium font-mono tabular-nums text-muted-foreground">Originally {formatCurrency(Number(inv.total), inv.currency)}</span>}
                      </span>
                      <Badge variant={chipTone("invoice", inv.status)} dot className="uppercase">{inv.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
