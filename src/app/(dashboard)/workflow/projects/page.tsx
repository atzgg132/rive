"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Briefcase, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  DollarSign, 
  AlertCircle, 
  X, 
  Loader2, 
  CheckCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  MoreVertical,
  Edit2,
  Trash2,
  GripVertical
} from "lucide-react";
import { toast } from "sonner";
import { DndContext, useDraggable, useDroppable, DragEndEvent, closestCorners } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import DropdownPortal from "@/components/ui/DropdownPortal";
import Portal from "@/components/ui/Portal";

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
}

interface Client {
  id: string;
  name: string;
  company: string | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
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
  const [saving, setSaving] = useState(false);

  const loadProjects = async () => {
    try {
      const res = await fetch(`/api/workflow/projects?search=${encodeURIComponent(search)}&status=${status}`);
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

  useEffect(() => {
    loadProjects();
  }, [search, status]);

  useEffect(() => {
    loadClients();
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
    setMilestonesInput(""); // Clear existing milestones for safe editing or let user add new ones
    setProjectStatus(project.status || "active");
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
    } catch (err) {
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
        start_date: startDate || null,
        due_date: dueDate || null,
        milestones: milestones.length > 0 ? milestones : undefined
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
        loadProjects();
      } else {
        toast.error(data.message || "Failed to save project.", { id: loadingToast });
      }
    } catch (err) {
      toast.error("Network error. Try again.", { id: loadingToast });
    } finally {
      setSaving(false);
    }
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
    } catch (err: any) {
      toast.error(err.message || "Error updating status. Reverting...");
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: oldStatus } : p));
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0C1E36] dark:text-slate-50">projects board</h1>
          <p className="text-sm text-[#4A5E78] dark:text-slate-400">track deliverables, manage milestone tasks, and view budget consumption.</p>
        </div>
        <button 
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1D4ED8] dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 font-semibold text-xs transition-all shadow-[0_4px_10px_rgba(29,78,216,0.1)] dark:shadow-none self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>create new project</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#E2EAF4] dark:border-slate-800">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78] dark:text-slate-400" />
          <input 
            type="text" 
            placeholder="search by title, description..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-[#4A5E78] dark:text-slate-400">status:</span>
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-[#E2EAF4] dark:border-slate-700 rounded-lg text-xs font-semibold text-[#0C1E36] dark:text-slate-200 focus:outline-none"
          >
            <option value="all">all status</option>
            <option value="active">in progress</option>
            <option value="paused">paused</option>
            <option value="completed">completed</option>
          </select>
        </div>
      </div>

      {/* Kanban Board Layout */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-[#1D4ED8] dark:text-blue-500" />
        </div>
      ) : projects.length === 0 ? (
        <div className="glass p-12 text-center flex flex-col items-center justify-center bg-white/70 dark:bg-slate-900/70 border-dashed dark:border-slate-800">
          <Briefcase className="h-10 w-10 text-slate-400 dark:text-slate-500 mb-3" />
          <h3 className="font-bold text-sm text-[#0C1E36] dark:text-slate-200 mb-1">no projects yet</h3>
          <p className="text-xs text-[#4A5E78] dark:text-slate-400 mb-4">log a project, assign it a budget, and link milestones.</p>
          <button 
            onClick={openCreate}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#EFF6FF] dark:bg-blue-900/30 text-[#1D4ED8] dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 hover:bg-[#E2EAF4] dark:hover:bg-blue-900/50 transition-all"
          >
            create project
          </button>
        </div>
      ) : (
        <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {kanbanColumns.map((col) => {
              const filteredProjects = projects.filter(p => p.status === col.id);
              return (
                <DroppableColumn key={col.id} id={col.id} title={col.title} color={col.color} count={filteredProjects.length}>
                  {filteredProjects.length === 0 ? (
                    <div className="text-center py-8 text-[11px] text-[#4A5E78] dark:text-slate-500 border border-dashed border-[#E2EAF4] dark:border-slate-700 rounded-xl bg-white/30 dark:bg-slate-900/30">
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
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col justify-between py-6 px-6 shadow-2xl border-l border-[#E2EAF4] dark:border-slate-800 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#0C1E36] dark:text-slate-200">{editingId ? "edit project" : "create new project"}</h3>
                    <p className="text-xs text-[#4A5E78] dark:text-slate-400">{editingId ? "update project details and parameters." : "launch a project tracker linked to an optional client profile."}</p>
                  </div>
                  <button 
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-[#4A5E78] dark:text-slate-400 hover:bg-[#F5F8FC] dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-4 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">project title *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. website redesign, mobile launch"
                      value={title} 
                      onChange={(e) => setTitle(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">description</label>
                    <textarea 
                      rows={2}
                      placeholder="describe the project parameters..."
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400 resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">link client</label>
                    <select 
                      value={clientId} 
                      onChange={(e) => setClientId(e.target.value)}
                      className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-[#E2EAF4] dark:border-slate-700 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none"
                    >
                      <option value="">select client (optional)</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">priority</label>
                      <select 
                        value={priority} 
                        onChange={(e) => setPriority(e.target.value)}
                        className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-[#E2EAF4] dark:border-slate-700 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none"
                      >
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                        <option value="urgent">urgent</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">status</label>
                      <select 
                        value={projectStatus} 
                        onChange={(e) => setProjectStatus(e.target.value)}
                        className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-[#E2EAF4] dark:border-slate-700 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none"
                      >
                        <option value="active">in progress</option>
                        <option value="paused">paused</option>
                        <option value="completed">completed</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">budget ($ USD)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 5000"
                      value={budget} 
                      onChange={(e) => setBudget(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">start date</label>
                      <input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs focus:outline-none focus:border-blue-400 text-slate-600 dark:text-slate-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">due date</label>
                      <input 
                        type="date" 
                        value={dueDate} 
                        onChange={(e) => setDueDate(e.target.value)}
                        className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs focus:outline-none focus:border-blue-400 text-slate-600 dark:text-slate-300"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">milestones / tasks (one per line)</label>
                    <textarea 
                      rows={3}
                      placeholder={editingId ? "Note: updating this replaces all incomplete milestones." : "e.g. wireframes signoff\ndraft contract\nfinal deployment"}
                      value={milestonesInput} 
                      onChange={(e) => setMilestonesInput(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400 resize-none font-sans"
                    />
                  </div>
                </form>
              </div>

              <div className="flex items-center gap-2 border-t border-[#E2EAF4] dark:border-slate-800 pt-4 mt-6">
                <button 
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-1/3 py-2 border border-[#E2EAF4] dark:border-slate-700 rounded-xl text-xs font-semibold text-[#4A5E78] dark:text-slate-400 hover:bg-[#F5F8FC] dark:hover:bg-slate-800 transition-all"
                >
                  cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="w-2/3 py-2 bg-[#1D4ED8] dark:bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 dark:hover:bg-blue-500 transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-70"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>{editingId ? "update project" : "launch project"}</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

function DroppableColumn({ id, title, color, count, children }: any) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`flex flex-col gap-4 p-4 rounded-2xl border min-h-[450px] transition-colors ${isOver ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50' : 'bg-slate-50/50 dark:bg-slate-800/30 border-[#E2EAF4] dark:border-slate-800'}`}>
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${color}`}></span>
          <h3 className="text-sm font-bold text-[#0C1E36] dark:text-slate-200">{title}</h3>
        </div>
        <span className="text-[10px] font-bold bg-white dark:bg-slate-800 border border-[#E2EAF4] dark:border-slate-700 px-1.5 py-0.5 rounded text-[#4A5E78] dark:text-slate-400">
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
}: any) {
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  
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
    <div ref={setNodeRef} style={style} className="glass bg-white dark:bg-slate-900 p-5 hover:shadow-md dark:hover:shadow-none hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col gap-4 group relative border border-[#E2EAF4] dark:border-slate-800 rounded-xl">
      {/* Dropdown Actions */}
      <div className="absolute top-4 right-4 z-10">
        <button 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (openDropdownId === project.id) {
              setOpenDropdownId(null);
            } else {
              setDropdownRect(e.currentTarget.getBoundingClientRect());
              setOpenDropdownId(project.id);
            }
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        
        {openDropdownId === project.id && (
          <DropdownPortal triggerRect={dropdownRect} onClose={() => setOpenDropdownId(null)}>
            <div className="w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-50 py-1 animate-fade-in-up">
              <button 
                onClick={(e) => { e.stopPropagation(); openEdit(project); setOpenDropdownId(null); }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2 transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5" /> edit
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDelete(project.id, project.title); setOpenDropdownId(null); }}
                className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> delete
              </button>
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
              <h4 className="text-xs font-bold text-[#0C1E36] dark:text-slate-200 line-clamp-1 group-hover:text-[#1D4ED8] dark:group-hover:text-blue-400 transition-colors hover:underline">{project.title}</h4>
            </Link>
          </div>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getPriorityColor(project.priority)}`}>
            {project.priority}
          </span>
        </div>
        <p className="text-[11px] text-[#4A5E78] dark:text-slate-400 line-clamp-2 leading-relaxed ml-6">{project.description || "no description provided."}</p>
      </div>

      {/* Progress bar */}
      {project.milestone_count > 0 && (
        <div className="flex flex-col gap-1.5 ml-6">
          <div className="flex justify-between text-[9px] font-bold text-[#4A5E78] dark:text-slate-400">
            <span>progress</span>
            <span>{pct}% ({project.completed_milestones}/{project.milestone_count})</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#1D4ED8] dark:bg-blue-500 rounded-full transition-all duration-500" 
              style={{ width: `${pct}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-col gap-1.5 border-t border-[#E2EAF4] dark:border-slate-800 pt-3 text-[10px] text-[#4A5E78] dark:text-slate-400 ml-6">
        {project.client_name && (
          <div className="flex items-center gap-1.5 truncate">
            <User className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-blue-400" />
            <span className="font-semibold text-[#0C1E36] dark:text-slate-200">{project.client_name}</span>
          </div>
        )}
        <div className="flex items-center justify-between mt-1">
          {project.due_date ? (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>due {new Date(project.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </span>
          ) : (
            <span>no due date</span>
          )}
          {project.budget && (
            <span className="font-extrabold text-[#10B981] dark:text-emerald-400 flex items-center">
              <DollarSign className="h-3 w-3" />
              <span>{parseFloat(project.budget).toLocaleString()}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
