"use client";

import { Button, ContextualEmptyState, Dialog, DialogContent, DialogDescription, DialogTitle, Input, PageHeader, PaginationControls, Textarea, Select } from "@/components/ui";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Briefcase,
  Plus,
  Search,
  User,
  X,
  Loader2,
  MoreVertical,
  Edit2,
  Trash2,
  FileSignature,
  ExternalLink,
  CircleSlash2,
  ArrowRight,
  ChevronDown,
  Check,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import DropdownPortal from "@/components/ui/DropdownPortal";
import Portal from "@/components/ui/Portal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFeatureAvailability } from "@/components/FeatureAvailabilityContext";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import type { PaginationMeta } from "@/lib/pagination";
import {
  DELIVERY_BUCKET_LABELS,
  deliveryStatus,
  groupByDeliveryBucket,
  milestoneProgress,
  type DeliveryBucket,
} from "@/utils/projectDelivery";

interface Project {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  budget: string | null;
  currency: string;
  tags: string[];
  client_name: string | null;
  client_company: string | null;
  milestone_count: number;
  completed_milestones: number;
  contract_coverage: "undecided" | "rive" | "external" | "none";
  external_contract_label: string | null;
  external_contract_url: string | null;
  contract_count: number;
  latest_contract: { id: string; title: string; status: string } | null;
}

interface Client {
  id: string;
  name: string;
  company: string | null;
}

type StatusCounts = { all: number; active: number; paused: number; completed: number; overdue: number };

const STATUS_TABS = [
  { value: "all", label: "All work" },
  { value: "active", label: "In progress" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
] as const;

// Only the three states a project can be moved between from this page;
// "archived" is excluded by the list endpoint and is not a destination here.
const STATUS_CHOICES = [
  { value: "active", label: "In progress", dot: "bg-blue-500", pill: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300" },
  { value: "paused", label: "Paused", dot: "bg-amber-500", pill: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300" },
  { value: "completed", label: "Completed", dot: "bg-emerald-500", pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-300" },
] as const;

const SORT_OPTIONS = [
  { value: "due_date", label: "Deadline first" },
  { value: "recent", label: "Recently updated" },
  { value: "title", label: "Title A–Z" },
  { value: "budget", label: "Largest budget" },
] as const;

const DELIVERY_ACCENT: Record<DeliveryBucket, string> = {
  overdue: "text-red-700 dark:text-red-400",
  this_week: "text-amber-700 dark:text-amber-400",
  later: "text-muted-foreground",
  no_deadline: "text-muted-foreground",
};

function statusChoice(status: string) {
  return STATUS_CHOICES.find((choice) => choice.value === status) || STATUS_CHOICES[0];
}

// useSearchParams needs a suspense boundary for this route to keep its static
// shell; the inner component owns every query-driven piece of state.
export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="workspace-page min-h-[calc(100vh-8rem)]" />}>
      <ProjectsWorkspace />
    </Suspense>
  );
}

function ProjectsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { agreements } = useFeatureAvailability();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState("all");
  // Read from the live query string. A useState initializer only runs on mount,
  // so arriving here from an in-app link that only changes the query left the
  // filter stuck at its previous value.
  const clientFilter = searchParams.get("clientId") || "";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<string>("due_date");
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [counts, setCounts] = useState<StatusCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  // Form state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [milestonesInput, setMilestonesInput] = useState("");
  const [projectStatus, setProjectStatus] = useState("active");
  const [workspaceCurrency, setWorkspaceCurrency] = useState("USD");
  const [projectCurrency, setProjectCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [contractPrompt, setContractPrompt] = useState<{ id: string; title: string; clientId: string | null; clientName: string | null } | null>(null);
  const [savingCoverage, setSavingCoverage] = useState(false);
  const [externalCoverageOpen, setExternalCoverageOpen] = useState(false);
  const [externalCoverageLabel, setExternalCoverageLabel] = useState("Contract handled outside Rive");
  const [externalCoverageUrl, setExternalCoverageUrl] = useState("");

  const loadProjects = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workflow/projects?search=${encodeURIComponent(debouncedSearch)}&status=${status}&clientId=${encodeURIComponent(clientFilter)}&page=${page}&pageSize=${pageSize}&sort=${encodeURIComponent(sort)}`, { signal });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setProjects(data.projects);
          // buildPagination clamps an out-of-range page server-side. Without
          // adopting that clamp the local page counter drifts, and the Next
          // button then re-requests a page the list is already showing.
          setPagination(data.pagination || null);
          if (data.pagination && data.pagination.page !== page) setPage(data.pagination.page);
          setCounts(data.counts || null);
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      console.error("Error loading projects:", err);
      toast.error("Failed to load projects");
    } finally {
      // A superseded request must not clear the spinner the live one is using.
      if (!signal?.aborted) setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const res = await fetch("/api/workflow/clients?mode=options&pageSize=100");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setClients(data.clients);
        }
      }
    } catch (err) {
      console.error("Error loading clients:", err);
    }
  };

  const loadWorkspaceCurrency = async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const data = await response.json();
      if (response.ok && data.success && /^[A-Z]{3}$/.test(data.user?.currency || "")) {
        setWorkspaceCurrency(data.user.currency);
        setProjectCurrency((current) => current === "USD" ? data.user.currency : current);
      }
    } catch {
      // The projects API still applies the workspace currency as its server-side default.
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, status, sort]);

  useEffect(() => {
    // Changing a filter also resets the page, so two loads are queued in the
    // same commit. Aborting the superseded one keeps a slow first response
    // from overwriting the newer page rows.
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProjects(controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, page, pageSize, sort, clientFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClients();
    void loadWorkspaceCurrency();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setClientId("");
    setPriority("medium");
    setBudget("");
    setStartDate("");
    setDueDate("");
    setMilestonesInput("");
    setProjectStatus("active");
    setProjectCurrency(workspaceCurrency);
    setDrawerOpen(true);
    setOpenDropdownId(null);
  };

  useEffect(() => {
    if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("new") !== "true") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openCreate();
    window.history.replaceState({}, "", window.location.pathname);
    // The intent is consumed once on mount; re-running when the drawer callback changes would reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (project: Project) => {
    setEditingId(project.id);
    setTitle(project.title);
    setDescription(project.description || "");
    setClientId(project.client_id || "");
    setPriority(project.priority || "medium");
    setBudget(project.budget || "");
    setStartDate(project.start_date ? project.start_date.split("T")[0] : "");
    setDueDate(project.due_date ? project.due_date.split("T")[0] : "");
    setMilestonesInput("");
    setProjectStatus(project.status || "active");
    setProjectCurrency(project.currency || workspaceCurrency);
    setDrawerOpen(true);
    setOpenDropdownId(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }

    setOpenDropdownId(null);
    const loadingToast = toast.loading(`Deleting ${name}...`);

    try {
      const res = await fetch(`/api/workflow/projects?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Project deleted successfully", { id: loadingToast });
        loadProjects();
      } else {
        toast.error(data.message || "Failed to delete project", { id: loadingToast });
      }
    } catch {
      toast.error("Network error. Try again.", { id: loadingToast });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || saving) return;

    setSaving(true);
    const loadingToast = toast.loading(editingId ? "Updating project..." : "Creating project...");

    try {
      // Parse milestones
      const milestones = milestonesInput
        .split("\n")
        .map(t => t.trim())
        .filter(Boolean)
        .map(m => ({ title: m, completed: false }));

      const url = "/api/workflow/projects";
      const method = editingId ? "PUT" : "POST";
      const body = JSON.stringify({
        id: editingId,
        title,
        description,
        client_id: clientId || null,
        status: projectStatus,
        priority,
        budget: budget ? parseFloat(budget) : null,
        currency: projectCurrency,
        start_date: startDate || null,
        due_date: dueDate || null,
        ...(editingId
          ? { new_milestones: milestones.length > 0 ? milestones : undefined }
          : { milestones: milestones.length > 0 ? milestones : undefined })
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Project ${editingId ? 'updated' : 'created'} successfully!`, { id: loadingToast });
        setDrawerOpen(false);
        await loadProjects();
        if (agreements && !editingId && data.project?.id) {
          const selectedClient = clients.find((client) => client.id === clientId);
          setContractPrompt({
            id: data.project.id,
            title: data.project.title || title,
            clientId: data.project.client_id || clientId || null,
            clientName: selectedClient?.name || null,
          });
          setExternalCoverageOpen(false);
          setExternalCoverageLabel("Contract handled outside Rive");
          setExternalCoverageUrl("");
        }
      } else {
        toast.error(data.message || "Failed to save project.", { id: loadingToast });
      }
    } catch {
      toast.error("Network error. Try again.", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const saveContractCoverage = async (coverage: "external" | "none" | "undecided") => {
    if (!contractPrompt || savingCoverage) return;
    setSavingCoverage(true);
    try {
      const response = await fetch(`/api/workflow/projects/${contractPrompt.id}/contract-coverage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverage, ...(coverage === "external" ? { externalLabel: externalCoverageLabel, externalUrl: externalCoverageUrl } : {}) }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to save the contract decision.");
      toast.success(data.message);
      setContractPrompt(null);
      setExternalCoverageOpen(false);
      await loadProjects();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the contract decision.");
    } finally {
      setSavingCoverage(false);
    }
  };

  const startProjectContract = () => {
    if (!contractPrompt?.clientId) return;
    const search = new URLSearchParams({ new: "1", projectId: contractPrompt.id, clientId: contractPrompt.clientId });
    setContractPrompt(null);
    router.push(`/workflow/contracts?${search.toString()}`);
  };

  const getPriorityColor = (prio: string) => {
    switch (prio) {
      case "high": return "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-900/50";
      case "urgent": return "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/50";
      case "low": return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/50";
      default: return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  // Deadline copy is derived once per render pass so every row in a paint
  // compares against the same instant.
  const now = new Date();
  const sections = sort === "due_date"
    ? groupByDeliveryBucket(projects, (project) => deliveryStatus(project.due_date, project.status, now))
    : [{ bucket: null as DeliveryBucket | null, items: projects }];

  const updateStatus = async (projectId: string, newStatus: string) => {
    setStatusMenuId(null);
    const project = projects.find((p) => p.id === projectId);
    if (!project || project.status === newStatus || pendingStatusId) return;

    const oldStatus = project.status;
    setPendingStatusId(projectId);
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p)));

    try {
      const res = await fetch("/api/workflow/projects/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, status: newStatus }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to update status");

      // The row no longer belongs in this view, and every status tally just
      // moved, so refetch rather than leaving a stale row and stale counts.
      await loadProjects();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error updating status. Reverting...");
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, status: oldStatus } : p)));
    } finally {
      setPendingStatusId(null);
    }
  };

  return (
    <div className="workspace-page relative min-h-[calc(100vh-8rem)] animate-fade-in">
      <PageHeader
        title="Projects"
        description="Keep delivery moving with clear milestones, budgets, tasks, and deadlines."
        actions={<Button data-guide-target="projects-create" onClick={openCreate} aria-label="Create new project"><Plus /> Create project</Button>}
      />

      {/* Filter and Search */}
      <div className="workspace-toolbar">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-400" />
          <Input
            type="text"
            placeholder="Search by title, description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <label htmlFor="projects-sort" className="text-xs font-medium text-muted-foreground">Sort</label>
          <Select
            id="projects-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="sm:w-auto"
          >
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </div>
      </div>

      {/* Status filters. The tallies come from the server so they describe the
          whole workspace rather than whichever rows landed on this page. */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = status === tab.value;
          const count = counts ? counts[tab.value] : null;
          return (
            <Button
              key={tab.value}
              type="button"
              size="sm"
              variant={isActive ? "default" : "outline"}
              aria-pressed={isActive}
              onClick={() => setStatus(tab.value)}
              className="gap-2"
            >
              {tab.label}
              {count !== null ? <span className={`rounded px-1.5 py-0.5 text-[0.6875rem] font-bold tabular-nums ${isActive ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"}`}>{count}</span> : null}
            </Button>
          );
        })}
        {counts && counts.overdue > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => { setStatus("active"); setSort("due_date"); }}
            className="gap-1.5 font-bold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <TriangleAlert className="h-3.5 w-3.5" />
            {counts.overdue} overdue
          </Button>
        ) : null}
      </div>

      {loading && projects.length === 0 ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-blue-500" />
        </div>
      ) : projects.length === 0 && (debouncedSearch || status !== "all") ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <Briefcase className="h-6 w-6 text-muted-foreground/60" />
          <div>
            <p className="text-sm font-bold text-foreground">No projects match this view</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a different status, or clear the search to see everything.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatus("all"); }}>Clear filters</Button>
        </div>
      ) : projects.length === 0 ? (
        <ContextualEmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="Turn client work into a project"
          description="Projects connect client work, deadlines, financials, and proof of work."
          why="A project gives Rive something meaningful to organize."
          next={clients.length === 0 ? "Add a client first, then create the project." : "Create the project you are working on now."}
          after="Its deadlines and budget can flow into Calendar and Revenue."
          action={clients.length === 0 ? <Link href="/workflow/clients?new=true" className="inline-flex items-center rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Add client first</Link> : <Button variant="secondary" size="sm" onClick={openCreate}>Create project</Button>}
        />
      ) : (<>
        <div className={`flex flex-col gap-6 transition-opacity ${loading ? "opacity-60" : "opacity-100"}`} aria-busy={loading}>
          {sections.map((section) => (
            <section key={section.bucket || "all"} className="flex flex-col gap-2.5">
              {section.bucket ? (
                <h2 className="px-1 text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {DELIVERY_BUCKET_LABELS[section.bucket]}
                </h2>
              ) : null}
              {section.items.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  now={now}
                  openDropdownId={openDropdownId}
                  setOpenDropdownId={setOpenDropdownId}
                  statusMenuId={statusMenuId}
                  setStatusMenuId={setStatusMenuId}
                  pendingStatusId={pendingStatusId}
                  updateStatus={updateStatus}
                  openEdit={openEdit}
                  handleDelete={handleDelete}
                  getPriorityColor={getPriorityColor}
                />
              ))}
            </section>
          ))}
        </div>
        {pagination ? (
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <PaginationControls pagination={pagination} loading={loading} label="projects" onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
          </div>
        ) : null}
      </>)}

      {/* Add/Edit Project Drawer */}
      {drawerOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col justify-between py-6 px-6 shadow-2xl border-l border-border dark:border-slate-800 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground dark:text-slate-200">{editingId ? "Edit project" : "Create new project"}</h3>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">{editingId ? "Update project details and parameters." : "Launch a project tracker linked to an optional client profile."}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close project editor"
                    title="Close project editor"
                    className="text-muted-foreground dark:text-slate-400 hover:bg-background dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-4 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Project title *</label>
                    <Input
                      type="text"
                      required
                      placeholder="E.g. website redesign, mobile launch"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Description</label>
                    <Textarea
                      rows={2}
                      placeholder="Describe the project parameters..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400 resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Link client</label>
                    <Select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-border dark:border-slate-700 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none"
                    >
                      <option value="">Select client (optional)</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</option>
                      ))}
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Priority</label>
                      <Select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-border dark:border-slate-700 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Status</label>
                      <Select
                        value={projectStatus}
                        onChange={(e) => setProjectStatus(e.target.value)}
                        className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-border dark:border-slate-700 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none"
                      >
                        <option value="active">In progress</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Project budget</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="E.g. 5000"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Currency</label>
                      <Input value={projectCurrency} onChange={(event) => setProjectCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))} maxLength={3} className="text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Start date</label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs focus:outline-none focus:border-blue-400 text-slate-600 dark:text-slate-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Due date</label>
                      <Input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs focus:outline-none focus:border-blue-400 text-slate-600 dark:text-slate-300"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">{editingId ? "Add milestones" : "Milestones"} (one per line)</label>
                    <Textarea
                      rows={3}
                      placeholder={editingId ? "Existing milestones stay unchanged. Add one new milestone per line." : "e.g. wireframes signoff\ndraft contract\nfinal deployment"}
                      value={milestonesInput}
                      onChange={(e) => setMilestonesInput(e.target.value)}
                      className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400 resize-none font-sans"
                    />
                  </div>
                </form>
              </div>

              <div className="flex items-center gap-2 border-t border-border dark:border-slate-800 pt-4 mt-6">
                <Button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  variant="outline"
                  size="default"
                  className="w-1/3"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  variant="default"
                  size="default"
                  className="w-2/3"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>{editingId ? "Update project" : "Launch project"}</span>
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      <Dialog open={Boolean(contractPrompt)} onOpenChange={(open) => { if (!open && !savingCoverage) { setContractPrompt(null); setExternalCoverageOpen(false); } }}>
        <DialogContent className="max-w-xl" showClose={!savingCoverage}>
          <div className="flex flex-col gap-5">
            <div className="pr-8">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileSignature className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-extrabold">How is this project covered?</DialogTitle>
              <DialogDescription className="mt-1.5 text-sm leading-6 text-muted-foreground">
                {contractPrompt?.title} can continue without a Rive contract. Recording the decision now keeps the project, milestones, invoices, and legal record aligned.
              </DialogDescription>
            </div>

            {contractPrompt?.clientId ? (
              <button type="button" onClick={startProjectContract} className="group flex w-full items-center gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left transition hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><FileSignature className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold">Create a Rive contract</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Prefill {contractPrompt.clientName || "the client"}, project brief, currency, and milestones. You review everything before sharing.</span></span>
                <ArrowRight className="h-4 w-4 shrink-0 text-primary transition group-hover:translate-x-0.5" />
              </button>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                Link a client to this project before creating a Rive contract. You can edit the project and return to this decision later.
              </div>
            )}

            {externalCoverageOpen ? <div className="rounded-2xl border border-border bg-muted/25 p-4">
              <div className="flex items-center gap-2"><ExternalLink className="h-4 w-4 text-primary" /><p className="text-sm font-bold">Record the external contract</p></div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">The label and link are internal references only. Rive will not alter or sign the external document.</p>
              <div className="mt-3 grid gap-3">
                <label className="text-xs font-semibold">Label<Input className="mt-1" value={externalCoverageLabel} onChange={(event) => setExternalCoverageLabel(event.target.value)} maxLength={180} placeholder="Client MSA in Drive" /></label>
                <label className="text-xs font-semibold">Link (optional)<Input className="mt-1" type="url" value={externalCoverageUrl} onChange={(event) => setExternalCoverageUrl(event.target.value)} placeholder="https://…" /></label>
              </div>
              <div className="mt-3 flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" disabled={savingCoverage} onClick={() => setExternalCoverageOpen(false)}>Back</Button><Button type="button" size="sm" disabled={savingCoverage} onClick={() => void saveContractCoverage("external")}>{savingCoverage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />} Save external record</Button></div>
            </div> : <div className="grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 px-4 py-3 text-left" disabled={savingCoverage} onClick={() => setExternalCoverageOpen(true)}>
                <ExternalLink className="h-4 w-4 shrink-0" />
                <span><span className="block text-sm">Handled elsewhere</span><span className="block text-xs font-normal text-muted-foreground">Record external coverage</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 px-4 py-3 text-left" disabled={savingCoverage} onClick={() => void saveContractCoverage("none")}>
                <CircleSlash2 className="h-4 w-4 shrink-0" />
                <span><span className="block text-sm">No contract needed</span><span className="block text-xs font-normal text-muted-foreground">Record an intentional exception</span></span>
              </Button>
            </div>}

            <Button type="button" variant="ghost" disabled={savingCoverage} onClick={() => void saveContractCoverage("undecided")}>
              Decide later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ProjectRowProps = {
  project: Project;
  now: Date;
  openDropdownId: string | null;
  setOpenDropdownId: (id: string | null) => void;
  statusMenuId: string | null;
  setStatusMenuId: (id: string | null) => void;
  pendingStatusId: string | null;
  updateStatus: (projectId: string, status: string) => void;
  openEdit: (project: Project) => void;
  handleDelete: (id: string, name: string) => void;
  getPriorityColor: (priority: string) => string;
};

function ProjectRow({
  project,
  now,
  openDropdownId,
  setOpenDropdownId,
  statusMenuId,
  setStatusMenuId,
  pendingStatusId,
  updateStatus,
  openEdit,
  handleDelete,
  getPriorityColor,
}: ProjectRowProps) {
  const [actionsRect, setActionsRect] = useState<DOMRect | null>(null);
  const [statusRect, setStatusRect] = useState<DOMRect | null>(null);
  const { agreements } = useFeatureAvailability();
  const { displayCurrency, format, formatConverted } = useCurrency();

  const choice = statusChoice(project.status);
  const delivery = deliveryStatus(project.due_date, project.status, now);
  const pct = milestoneProgress(project.completed_milestones, project.milestone_count);
  const budgetAmount = project.budget === null ? null : Number(project.budget);
  const convertedBudget = budgetAmount === null ? null : formatConverted(budgetAmount, project.currency);
  const busy = pendingStatusId === project.id;

  return (
    <article className="group relative rounded-xl border border-border bg-card py-4 pl-5 pr-4 shadow-sm transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-card">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 rounded-l-xl ${choice.dot}`} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/workflow/projects/${project.id}`} className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary hover:underline">{project.title}</h3>
            </Link>
            <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold capitalize ${getPriorityColor(project.priority)}`}>
              {project.priority}
            </span>
          </div>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {project.client_name ? (
              <>
                <User className="h-3.5 w-3.5 shrink-0 text-primary dark:text-blue-400" />
                <span className="shrink-0 font-semibold text-foreground dark:text-slate-200">{project.client_name}</span>
              </>
            ) : (
              <span className="shrink-0">No client linked</span>
            )}
            {project.description ? <span className="truncate">· {project.description}</span> : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            aria-haspopup="menu"
            aria-expanded={statusMenuId === project.id}
            aria-label={`Change status of ${project.title}, currently ${choice.label}`}
            className={`gap-1.5 px-2.5 font-semibold ${choice.pill}`}
            onClick={(e) => {
              e.stopPropagation();
              if (statusMenuId === project.id) {
                setStatusMenuId(null);
              } else {
                setStatusRect(e.currentTarget.getBoundingClientRect());
                setStatusMenuId(project.id);
                setOpenDropdownId(null);
              }
            }}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <span aria-hidden="true" className={`h-2 w-2 rounded-full ${choice.dot}`} />}
            {choice.label}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>

          {statusMenuId === project.id && (
            <DropdownPortal triggerRect={statusRect} onClose={() => setStatusMenuId(null)}>
              <div role="menu" aria-label={`Status for ${project.title}`} className="w-44 rounded-xl border border-border bg-card p-1 shadow-xl animate-fade-in-up">
                {STATUS_CHOICES.map((option) => (
                  <Button
                    key={option.value}
                    role="menuitem"
                    variant="ghost"
                    className="w-full justify-start gap-2 px-3 py-2 text-xs font-medium"
                    onClick={(e) => { e.stopPropagation(); updateStatus(project.id, option.value); }}
                  >
                    <span aria-hidden="true" className={`h-2 w-2 rounded-full ${option.dot}`} />
                    {option.label}
                    {option.value === project.status ? <Check className="ml-auto h-3.5 w-3.5 text-primary" /> : null}
                  </Button>
                ))}
              </div>
            </DropdownPortal>
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${project.title}`}
            title={`Actions for ${project.title}`}
            className="text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            onClick={(e) => {
              e.stopPropagation();
              if (openDropdownId === project.id) {
                setOpenDropdownId(null);
              } else {
                setActionsRect(e.currentTarget.getBoundingClientRect());
                setOpenDropdownId(project.id);
                setStatusMenuId(null);
              }
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>

          {openDropdownId === project.id && (
            <DropdownPortal triggerRect={actionsRect} onClose={() => setOpenDropdownId(null)}>
              <div className="w-36 rounded-xl border border-slate-100 bg-white py-1 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-fade-in-up">
                <Button
                  data-guide-target={!project.due_date ? "projects-deadline" : undefined}
                  onClick={(e) => { e.stopPropagation(); openEdit(project); setOpenDropdownId(null); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); handleDelete(project.id, project.title); setOpenDropdownId(null); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </DropdownPortal>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-xs">
        <span className={`inline-flex items-center gap-1.5 font-semibold ${DELIVERY_ACCENT[delivery.bucket]}`}>
          {delivery.tone === "overdue" ? <TriangleAlert className="h-3.5 w-3.5" /> : null}
          {delivery.label}
        </span>

        {!project.due_date ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-guide-target="projects-deadline"
            aria-label={`Add deadline to ${project.title}`}
            onClick={(e) => { e.stopPropagation(); openEdit(project); }}
            className="h-6 px-2 text-xs font-bold text-primary hover:bg-primary/10"
          >
            Add deadline
          </Button>
        ) : null}

        {project.milestone_count > 0 ? (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="block h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span className="block h-full rounded-full bg-primary transition-all duration-500 dark:bg-blue-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="font-medium text-muted-foreground">{project.completed_milestones}/{project.milestone_count} milestones</span>
          </span>
        ) : (
          <span className="text-muted-foreground">No milestones</span>
        )}

        {budgetAmount !== null ? (
          <span className="font-extrabold text-[#10B981] dark:text-emerald-400">
            {convertedBudget || format(budgetAmount, project.currency)}
            {project.currency !== displayCurrency && convertedBudget ? (
              <span className="ml-1 font-medium text-muted-foreground">Originally {format(budgetAmount, project.currency)}</span>
            ) : null}
          </span>
        ) : null}

        {agreements ? (
          <span className="inline-flex items-center gap-1.5">
            {project.contract_coverage === "rive" && project.latest_contract ? (
              <>
                <FileSignature className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">Rive contract · {project.latest_contract.status.replaceAll("_", " ")}</span>
                <Link href={`/workflow/contracts/${project.latest_contract.id}`} className="font-bold text-primary hover:underline">Open</Link>
              </>
            ) : project.contract_coverage === "external" ? (
              <>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300" />
                <span className="font-semibold text-slate-600 dark:text-slate-300">Contract handled elsewhere</span>
              </>
            ) : project.contract_coverage === "none" ? (
              <>
                <CircleSlash2 className="h-3.5 w-3.5 shrink-0 text-slate-600 dark:text-slate-300" />
                <span className="font-semibold text-slate-600 dark:text-slate-300">No contract required</span>
              </>
            ) : (
              <>
                <FileSignature className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" />
                <span className="font-semibold text-amber-700 dark:text-amber-300">Contract undecided</span>
                <Link
                  href={project.client_id ? `/workflow/contracts?new=1&projectId=${encodeURIComponent(project.id)}&clientId=${encodeURIComponent(project.client_id)}` : `/workflow/projects/${project.id}`}
                  className="font-bold text-primary hover:underline"
                >
                  {project.client_id ? "Create" : "Review"}
                </Link>
              </>
            )}
          </span>
        ) : null}
      </div>
    </article>
  );
}
