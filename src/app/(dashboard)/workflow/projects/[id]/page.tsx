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
} from "lucide-react";
import { toast } from "sonner";
import { Button, Input, buttonVariants } from "@/components/ui";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useFeatureAvailability } from "@/components/FeatureAvailabilityContext";

type ProjectInvoice = { id: string; invoiceNumber: string; issueDate: string; total: number | string; currency: string; status: string };
type ProjectClient = { id: string; name: string; company: string | null; avatarColor: string };
type ProjectMilestone = { id: string; title: string; dueDate: string | null; completed: boolean; completedAt: string | null };
type ProjectContract = { id: string; title: string; status: string; currency: string; executedAt: string | null; updatedAt: string };
type ProjectDetails = { id: string; title: string; status: string; createdAt: string; budget: string | null; currency: string; dueDate: string | null; tags: string[]; description: string | null; contractCoverage: "undecided" | "rive" | "external" | "none"; externalContractLabel: string | null; externalContractUrl: string | null; contractDecisionAt: string | null; related_counts?: { invoices: number; milestones: number; contracts: number }; client: ProjectClient | null; invoices: ProjectInvoice[]; milestones: ProjectMilestone[]; contracts: ProjectContract[] };

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

  useEffect(() => {
    async function loadProject() {
      try {
        const res = await fetch(`/api/workflow/projects/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setProject(data.project);
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

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case "planning": return { label: "Planning", classes: "bg-slate-50 dark:bg-slate-800 text-muted-foreground dark:text-slate-400 border-border dark:border-slate-700" };
      case "in_progress": return { label: "In Progress", classes: "bg-blue-50 text-blue-700 border-blue-100" };
      case "completed": return { label: "Completed", classes: "bg-emerald-50 text-emerald-700 border-emerald-100" };
      case "archived": return { label: "Archived", classes: "bg-red-50 text-red-700 border-red-100" };
      default: return { label: status, classes: "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700" };
    }
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
        <h2 className="text-xl font-bold text-foreground dark:text-white">Project not found</h2>
        <Link href="/workflow/projects" className="text-blue-600 mt-2 hover:underline">Return to projects</Link>
      </div>
    );
  }

  const s = getStatusDisplay(project.status);
  const budgetAmount = project.budget === null ? null : Number(project.budget);
  const convertedBudget = budgetAmount === null ? null : formatConverted(budgetAmount, project.currency);

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-12">
      {/* Header Breadcrumbs */}
      <div>
        <Link href="/workflow/projects" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          back to projects
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground dark:text-white sm:text-3xl">{project.title}</h1>
            <p className="text-sm text-muted-foreground dark:text-slate-400 font-medium flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4" /> Started {formatDate(project.createdAt)}
            </p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border uppercase ${s.classes}`}>
            {s.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Project Meta & Client Info */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          
          {/* Client Info Card */}
          {project.client ? (
            <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-border dark:border-slate-700">
              <h3 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">Client</h3>
              <Link href={`/workflow/clients/${project.client.id}`} className="flex items-center gap-3 group">
                <div 
                  className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg uppercase shadow-sm group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: project.client.avatarColor }}
                >
                  {project.client.name.substring(0, 2)}
                </div>
                <div className="flex flex-col">
              <h4 className="font-bold text-foreground dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{project.client.name}</h4>
                  <span className="text-xs text-muted-foreground dark:text-slate-400">{project.client.company || "Private Client"}</span>
                </div>
              </Link>
            </div>
          ) : (
            <div className="glass bg-slate-50 dark:bg-slate-800/60 p-6 rounded-2xl border border-dashed border-border dark:border-slate-700 flex items-center justify-center text-muted-foreground dark:text-slate-400 text-sm">
              No client linked.
            </div>
          )}

          {/* Project Details */}
          <div className="glass bg-gradient-to-br from-[#0C1E36] to-[#1a2f4c] p-6 rounded-2xl border border-[#0C1E36] text-white shadow-lg">
            <h3 className="text-xs font-bold text-slate-300 mb-6 uppercase tracking-wider">Financial Overview</h3>
            
            <div className="flex flex-col gap-5">
              <div>
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Budget</div>
                <div className="text-2xl font-bold text-emerald-400">{budgetAmount === null ? "Unspecified" : convertedBudget || formatCurrency(budgetAmount, project.currency)}</div>
                {budgetAmount !== null && project.currency !== displayCurrency && convertedBudget && <div className="mt-1 text-xs font-medium text-slate-400">Originally {formatCurrency(budgetAmount, project.currency)}</div>}
              </div>
              
              <div className="h-px bg-slate-700/50 w-full" />

              <div>
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Deadline</div>
                <div className="text-lg font-semibold">{project.dueDate ? formatDate(project.dueDate) : "No deadline"}</div>
              </div>
            </div>
          </div>
          
          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-border dark:border-slate-700">
              <h3 className="text-xs font-bold text-foreground dark:text-slate-200 mb-3 uppercase tracking-wider">Project Tags</h3>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((t: string, idx: number) => (
                  <span key={idx} className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                    <Tag className="h-2.5 w-2.5" />
                    <span>{t}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Description & Billing */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          
          {/* Project Description */}
          <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-border dark:border-slate-700">
            <h3 className="text-lg font-bold text-foreground dark:text-slate-200 flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-blue-600" /> Project Brief
            </h3>
            {project.description ? (
              <p className="text-sm text-muted-foreground dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{project.description}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">No project description provided.</p>
            )}
          </div>

          {/* Milestones */}
          <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-border dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground dark:text-slate-200 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" /> Milestones
              </h3>
              <span className="text-xs text-muted-foreground">{project.milestones.filter((item) => item.completed).length}/{project.related_counts?.milestones ?? project.milestones.length} complete</span>
            </div>
            {project.milestones.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-muted-foreground dark:text-slate-400">No milestones recorded for this project.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {project.milestones.map((milestone) => (
                  <div key={milestone.id} className="flex items-center justify-between gap-4 rounded-xl border border-border dark:border-slate-700 p-4">
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${milestone.completed ? "text-emerald-700 dark:text-emerald-300" : "text-foreground dark:text-slate-200"}`}>{milestone.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">Due {milestone.dueDate ? formatDate(milestone.dueDate) : "No due date"}</p>
                    </div>
                    <Button size="sm" variant={milestone.completed ? "secondary" : "outline"} disabled={milestoneBusy === milestone.id} onClick={() => void updateMilestone(milestone)}>{milestoneBusy === milestone.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : milestone.completed ? "Completed" : "Mark complete"}</Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {agreements && <>
          {/* Linked Agreements */}
          <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-border dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground dark:text-slate-200 flex items-center gap-2"><FileSignature className="h-5 w-5 text-blue-600" /> Agreements</h3>
              <Link href={`/workflow/contracts?projectId=${encodeURIComponent(project.id)}`} className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">View all</Link>
            </div>
            {project.contracts.length === 0 ? project.contractCoverage === "external" ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="flex items-start gap-3"><ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">{project.externalContractLabel || "Agreement handled outside Rive"}</p><p className="mt-1 text-xs leading-5 text-emerald-800/80 dark:text-emerald-200/80">This project intentionally has no Rive Agreement. Milestones and invoices continue to work normally.</p>{project.externalContractUrl ? <a href={project.externalContractUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-800 underline dark:text-emerald-200">Open external record <ExternalLink className="h-3 w-3" /></a> : null}</div><Button size="sm" variant="ghost" disabled={coverageBusy} onClick={() => void updateContractCoverage("undecided")}>Change</Button></div>
              </div>
            ) : project.contractCoverage === "none" ? (
              <div className="rounded-xl border border-border bg-muted/40 p-4"><div className="flex items-start gap-3"><CircleSlash2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-sm font-bold">No contract required</p><p className="mt-1 text-xs leading-5 text-muted-foreground">This is an intentional project decision, not a missing setup step.</p></div><Button size="sm" variant="ghost" disabled={coverageBusy} onClick={() => void updateContractCoverage("undecided")}>Change</Button></div></div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                <div className="flex items-start gap-3"><FileSignature className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-amber-950 dark:text-amber-100">Agreement coverage is undecided</p><p className="mt-1 text-xs leading-5 text-amber-900/80 dark:text-amber-200/80">A Rive Agreement is optional, but record how this engagement is covered so it does not look accidentally incomplete.</p></div></div>
                <div className="mt-4 flex flex-wrap gap-2">{project.client ? <Link className={buttonVariants({ variant: "default", size: "sm" })} href={`/workflow/contracts?new=1&projectId=${encodeURIComponent(project.id)}&clientId=${encodeURIComponent(project.client.id)}`}><FileSignature className="h-3.5 w-3.5" /> Create Rive Agreement</Link> : <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Link a client before creating a Rive Agreement.</p>}<Button size="sm" variant="outline" disabled={coverageBusy} onClick={() => setExternalFormOpen((current) => !current)}><ExternalLink className="h-3.5 w-3.5" /> Handled elsewhere</Button><Button size="sm" variant="ghost" disabled={coverageBusy} onClick={() => void updateContractCoverage("none")}><CircleSlash2 className="h-3.5 w-3.5" /> Not needed</Button></div>
                {externalFormOpen ? <div className="mt-3 grid gap-2 rounded-xl border border-amber-300/70 bg-white/60 p-3 dark:border-amber-800 dark:bg-slate-950/30"><p className="text-xs font-bold text-amber-950 dark:text-amber-100">External Agreement reference</p><Input value={externalLabel} onChange={(event) => setExternalLabel(event.target.value)} maxLength={180} placeholder="Client MSA in Drive" /><Input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="Optional https:// link" /><div className="flex justify-end"><Button size="sm" disabled={coverageBusy} onClick={() => void updateContractCoverage("external")}>{coverageBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />} Save reference</Button></div></div> : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {project.contracts.map((item) => (
                  <Link key={item.id} href={`/workflow/contracts/${item.id}`} className="flex items-center justify-between gap-4 rounded-xl border border-border dark:border-slate-700 p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground dark:text-slate-200">{item.title}</p><p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">{item.currency} · Updated {formatDate(item.updatedAt)}</p></div>
                    <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border uppercase text-muted-foreground dark:text-slate-400">{item.status.replaceAll("_", " ")}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          </>}

          {/* Linked Invoices */}
          <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-border dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground dark:text-slate-200 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" /> Linked Invoices
              </h3>
              <Link href={`/workflow/revenue?projectId=${encodeURIComponent(project.id)}`} className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                View all
              </Link>
            </div>

            {project.invoices && project.invoices.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-muted-foreground dark:text-slate-400">
                No invoices issued for this project yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {project.invoices && project.invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl border border-border dark:border-slate-700 hover:border-blue-300 transition-all bg-white dark:bg-slate-800">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground dark:text-slate-200">{inv.invoiceNumber}</span>
                      <span className="text-xs text-muted-foreground dark:text-slate-400">Issued: {formatDate(inv.issueDate)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-right font-extrabold text-sm text-foreground dark:text-slate-200">
                        <span className="block">{formatConverted(Number(inv.total), inv.currency) || formatCurrency(Number(inv.total), inv.currency)}</span>
                        {inv.currency !== displayCurrency && <span className="block text-xs font-medium text-muted-foreground">Originally {formatCurrency(Number(inv.total), inv.currency)}</span>}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border uppercase ${
                         inv.status === "paid" ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/60" :
                         inv.status === "overdue" ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900/60" :
                         "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/60"
                      }`}>
                        {inv.status}
                      </span>
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
