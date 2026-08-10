"use client";

import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, EmptyState, Input, PageHeader, Textarea, Select } from "@/components/ui";

import React, { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Plus,
  Search,
  Calendar,
  User,
  DollarSign,
  X,
  Loader2,
  MoreVertical,
  Edit2,
  Trash2,
  GripVertical,
  FileSignature,
  ExternalLink,
  CircleSlash2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { DndContext, useDraggable, useDroppable, DragEndEvent, closestCorners } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import DropdownPortal from "@/components/ui/DropdownPortal";
import Portal from "@/components/ui/Portal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useFeatureAvailability } from "@/components/FeatureAvailabilityContext";

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

export default function ProjectsPage() {
  const router = useRouter();
  const { agreements } = useFeatureAvailability();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

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

  const loadProjects = async () => {
    try {
      const res = await fetch(`/api/workflow/projects?search=${encodeURIComponent(debouncedSearch)}&status=${status}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setProjects(data.projects);
        }
      }
    } catch (err) {
      console.error("Error loading projects:", err);
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const loadClients = async () => {
    try {
      const res = await fetch("/api/workflow/clients");
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
    loadProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status]);

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

  const getProgressPercent = (project: Project) => {
    if (project.milestone_count === 0) return 0;
    return Math.round((project.completed_milestones / project.milestone_count) * 100);
  };

  // Group projects for Kanban columns
  const kanbanColumns = [
    { id: "active", title: "in progress", color: "bg-blue-600" },
    { id: "paused", title: "paused", color: "bg-amber-500" },
    { id: "completed", title: "completed", color: "bg-emerald-500" }
  ];

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const projectId = active.id as string;
    const newStatus = over.id as string;

    const project = projects.find(p => p.id === projectId);
    if (!project || project.status === newStatus) return;

    const oldStatus = project.status;

    // Optimistic update
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));

    try {
      const res = await fetch('/api/workflow/projects/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: projectId, status: newStatus })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to update status");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error updating status. Reverting...");
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: oldStatus } : p));
    }
  };

  return (
    <div className="workspace-page relative min-h-[calc(100vh-8rem)] animate-fade-in">
      <PageHeader
        title="Projects"
        description="Plan delivery, connect milestones and tasks, and keep budgets and deadlines visible."
        actions={<Button onClick={openCreate} aria-label="Create new project"><Plus /> Create project</Button>}
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
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="sm:w-auto"
          >
            <option value="all">All status</option>
            <option value="active">In progress</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </Select>
        </div>
      </div>

      {/* Kanban Board Layout */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-blue-500" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="No projects yet"
          description="Log a project, assign it a budget, and link milestones."
          action={<Button variant="secondary" size="sm" onClick={openCreate}>Create project</Button>}
        />
      ) : (
        <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {kanbanColumns.map((col) => {
              const filteredProjects = projects.filter(p => p.status === col.id);
              return (
                <DroppableColumn key={col.id} id={col.id} title={col.title} color={col.color} count={filteredProjects.length}>
                  {filteredProjects.length === 0 ? (
                    <div className="text-center py-8 text-[11px] text-muted-foreground dark:text-slate-500 border border-dashed border-border dark:border-slate-700 rounded-xl bg-white/30 dark:bg-slate-900/30">
                      no projects in this state
                    </div>
                  ) : (
                    filteredProjects.map((p) => (
                      <DraggableProjectCard
                        key={p.id}
                        project={p}
                        openDropdownId={openDropdownId}
                        setOpenDropdownId={setOpenDropdownId}
                        openEdit={openEdit}
                        handleDelete={handleDelete}
                        getPriorityColor={getPriorityColor}
                        getProgressPercent={getProgressPercent}
                      />
                    ))
                  )}
                </DroppableColumn>
              );
            })}
          </div>
        </DndContext>
      )}

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
                <span><span className="block text-sm">Handled elsewhere</span><span className="block text-[11px] font-normal text-muted-foreground">Record external coverage</span></span>
              </Button>
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 px-4 py-3 text-left" disabled={savingCoverage} onClick={() => void saveContractCoverage("none")}>
                <CircleSlash2 className="h-4 w-4 shrink-0" />
                <span><span className="block text-sm">No contract needed</span><span className="block text-[11px] font-normal text-muted-foreground">Record an intentional exception</span></span>
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

function DroppableColumn({ id, title, color, count, children }: { id: string; title: string; color: string; count: number; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex min-h-[450px] flex-col gap-4 rounded-2xl border p-4 transition-colors ${isOver ? "border-primary/35 bg-primary/[0.06]" : "border-border bg-muted/30"}`}>
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${color}`}></span>
          <h3 className="text-sm font-semibold capitalize text-foreground">{title}</h3>
        </div>
        <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3 min-h-[100px]">
        {children}
      </div>
    </div>
  );
}

function DraggableProjectCard({
  project,
  openDropdownId,
  setOpenDropdownId,
  openEdit,
  handleDelete,
  getPriorityColor,
  getProgressPercent
}: { project: Project; openDropdownId: string | null; setOpenDropdownId: (id: string | null) => void; openEdit: (project: Project) => void; handleDelete: (id: string, name: string) => void; getPriorityColor: (priority: string) => string; getProgressPercent: (project: Project) => number }) {
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const { agreements } = useFeatureAvailability();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: project
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const pct = getProgressPercent(project);

  return (
    <div ref={setNodeRef} style={style} className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-card">
      {/* Dropdown Actions */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          onClick={(e) => {
            e.stopPropagation();
            if (openDropdownId === project.id) {
              setOpenDropdownId(null);
            } else {
              setDropdownRect(e.currentTarget.getBoundingClientRect());
              setOpenDropdownId(project.id);
            }
          }}
          variant="ghost"
          size="icon-sm"
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label={`Actions for ${project.title}`}
          title={`Actions for ${project.title}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>

        {openDropdownId === project.id && (
          <DropdownPortal triggerRect={dropdownRect} onClose={() => setOpenDropdownId(null)}>
            <div className="w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-50 py-1 animate-fade-in-up">
              <Button
                onClick={(e) => { e.stopPropagation(); openEdit(project); setOpenDropdownId(null); }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2 transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                onClick={(e) => { e.stopPropagation(); handleDelete(project.id, project.title); setOpenDropdownId(null); }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </DropdownPortal>
        )}
      </div>

      <div>
        <div className="flex justify-between items-start gap-3 mb-2 pr-6">
          <div className="flex items-center gap-2">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400">
              <GripVertical className="h-4 w-4" />
            </div>
            <Link href={`/workflow/projects/${project.id}`}>
              <h4 className="line-clamp-1 text-sm font-semibold text-foreground transition-colors group-hover:text-primary hover:underline">{project.title}</h4>
            </Link>
          </div>
          <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold capitalize ${getPriorityColor(project.priority)}`}>
            {project.priority}
          </span>
        </div>
        <p className="ml-6 line-clamp-2 text-xs leading-5 text-muted-foreground">{project.description || "No description provided."}</p>
      </div>

      {/* Progress bar */}
      {project.milestone_count > 0 && (
        <div className="flex flex-col gap-1.5 ml-6">
          <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
            <span>Progress</span>
            <span>{pct}% ({project.completed_milestones}/{project.milestone_count})</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary dark:bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="ml-6 flex flex-col gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
        {project.client_name && (
          <div className="flex items-center gap-1.5 truncate">
            <User className="h-3.5 w-3.5 text-primary dark:text-blue-400" />
            <span className="font-semibold text-foreground dark:text-slate-200">{project.client_name}</span>
          </div>
        )}
        <div className="flex items-center justify-between mt-1">
          {project.due_date ? (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>due {new Date(project.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </span>
          ) : (
            <span>No due date</span>
          )}
          {project.budget && (
            <span className="font-extrabold text-[#10B981] dark:text-emerald-400 flex items-center">
              <DollarSign className="h-3 w-3" />
              <span>{parseFloat(project.budget).toLocaleString()}</span>
            </span>
          )}
        </div>
      </div>

      {agreements && <div className="ml-6 flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2 text-[11px]">
        {project.contract_coverage === "rive" && project.latest_contract ? (
          <>
            <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><FileSignature className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Rive contract · {project.latest_contract.status.replaceAll("_", " ")}</span></span>
            <Link href={`/workflow/contracts/${project.latest_contract.id}`} className="shrink-0 font-bold text-primary hover:underline">Open</Link>
          </>
        ) : project.contract_coverage === "external" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300"><ExternalLink className="h-3.5 w-3.5" /> Contract handled elsewhere</span>
        ) : project.contract_coverage === "none" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300"><CircleSlash2 className="h-3.5 w-3.5" /> No contract required</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300"><FileSignature className="h-3.5 w-3.5" /> Contract undecided</span>
            <Link
              href={project.client_id ? `/workflow/contracts?new=1&projectId=${encodeURIComponent(project.id)}&clientId=${encodeURIComponent(project.client_id)}` : `/workflow/projects/${project.id}`}
              className="shrink-0 font-bold text-primary hover:underline"
            >
              {project.client_id ? "Create" : "Review"}
            </Link>
          </>
        )}
      </div>}
    </div>
  );
}
