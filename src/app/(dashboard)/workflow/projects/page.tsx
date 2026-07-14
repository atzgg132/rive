"use client";

import React, { useState, useEffect } from "react";
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
  TrendingUp
} from "lucide-react";

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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [milestonesInput, setMilestonesInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || saving) return;

    setSaving(true);
    setError("");

    try {
      // Parse milestones
      const milestones = milestonesInput
        .split("\n")
        .map(t => t.trim())
        .filter(Boolean)
        .map(m => ({ title: m, completed: false }));

      const res = await fetch("/api/workflow/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          client_id: clientId || null,
          priority,
          budget: budget ? parseFloat(budget) : null,
          start_date: startDate || null,
          due_date: dueDate || null,
          milestones
        }),
      });

      const data = await res.json();
      if (data.success) {
        setDrawerOpen(false);
        setTitle("");
        setDescription("");
        setClientId("");
        setPriority("medium");
        setBudget("");
        setStartDate("");
        setDueDate("");
        setMilestonesInput("");
        loadProjects();
      } else {
        setError(data.message || "Failed to create project.");
      }
    } catch (err) {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const getPriorityColor = (prio: string) => {
    switch (prio) {
      case "high": return "bg-orange-50 text-orange-700 border-orange-100";
      case "urgent": return "bg-red-50 text-red-700 border-red-100";
      case "low": return "bg-blue-50 text-blue-700 border-blue-100";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
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

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0C1E36]">projects board</h1>
          <p className="text-sm text-[#4A5E78]">track deliverables, manage milestone tasks, and view budget consumption.</p>
        </div>
        <button 
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white hover:bg-blue-700 font-semibold text-xs transition-all shadow-[0_4px_10px_rgba(29,78,216,0.1)] self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>create new project</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-[#E2EAF4]">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78]" />
          <input 
            type="text" 
            placeholder="search by title, description..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E2EAF4] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-[#4A5E78]">status:</span>
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[#E2EAF4] rounded-lg text-xs font-semibold text-[#0C1E36] focus:outline-none"
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
          <Loader2 className="h-6 w-6 animate-spin text-[#1D4ED8]" />
        </div>
      ) : projects.length === 0 ? (
        <div className="glass p-12 text-center flex flex-col items-center justify-center bg-white/70 border-dashed">
          <Briefcase className="h-10 w-10 text-slate-400 mb-3" />
          <h3 className="font-bold text-sm text-[#0C1E36] mb-1">no projects yet</h3>
          <p className="text-xs text-[#4A5E78] mb-4">log a project, assign it a budget, and link milestones.</p>
          <button 
            onClick={() => setDrawerOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-blue-100 hover:bg-[#E2EAF4] transition-all"
          >
            create project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {kanbanColumns.map((col) => {
            const filteredProjects = projects.filter(p => p.status === col.id);
            return (
              <div key={col.id} className="flex flex-col gap-4 bg-slate-50/50 p-4 rounded-2xl border border-[#E2EAF4] min-h-[450px]">
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${col.color}`}></span>
                    <h3 className="text-sm font-bold text-[#0C1E36]">{col.title}</h3>
                  </div>
                  <span className="text-[10px] font-bold bg-white border border-[#E2EAF4] px-1.5 py-0.5 rounded text-[#4A5E78]">
                    {filteredProjects.length}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {filteredProjects.length === 0 ? (
                    <div className="text-center py-8 text-[11px] text-[#4A5E78] border border-dashed border-[#E2EAF4] rounded-xl bg-white/30">
                      no projects in this state
                    </div>
                  ) : (
                    filteredProjects.map((p) => {
                      const pct = getProgressPercent(p);
                      return (
                        <div key={p.id} className="glass bg-white p-5 hover:shadow-md hover:border-blue-300 transition-all flex flex-col gap-4 group">
                          <div>
                            <div className="flex justify-between items-start gap-3 mb-2">
                              <h4 className="text-xs font-bold text-[#0C1E36] line-clamp-1 group-hover:text-[#1D4ED8] transition-colors">{p.title}</h4>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getPriorityColor(p.priority)}`}>
                                {p.priority}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#4A5E78] line-clamp-2 leading-relaxed">{p.description || "no description provided."}</p>
                          </div>

                          {/* Progress bar */}
                          {p.milestone_count > 0 && (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between text-[9px] font-bold text-[#4A5E78]">
                                <span>progress</span>
                                <span>{pct}% ({p.completed_milestones}/{p.milestone_count})</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-[#1D4ED8] rounded-full transition-all duration-500" 
                                  style={{ width: `${pct}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          <div className="flex flex-col gap-1.5 border-t border-[#E2EAF4] pt-3 text-[10px] text-[#4A5E78]">
                            {p.client_name && (
                              <div className="flex items-center gap-1.5 truncate">
                                <User className="h-3.5 w-3.5 text-[#1D4ED8]" />
                                <span className="font-semibold text-[#0C1E36]">{p.client_name}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-1">
                              {p.due_date ? (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>due {new Date(p.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                </span>
                              ) : (
                                <span>no due date</span>
                              )}
                              {p.budget && (
                                <span className="font-extrabold text-[#10B981] flex items-center">
                                  <DollarSign className="h-3 w-3" />
                                  <span>{parseFloat(p.budget).toLocaleString()}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Project Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
          <div className="relative w-full max-w-md bg-white h-full flex flex-col justify-between py-6 px-6 shadow-2xl border-l border-[#E2EAF4] animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#0C1E36]">create new project</h3>
                  <p className="text-xs text-[#4A5E78]">launch a project tracker linked to an optional client profile.</p>
                </div>
                <button 
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-[#4A5E78] hover:bg-[#F5F8FC]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-xs font-semibold border border-red-100">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreate} className="flex flex-col gap-4 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">project title *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. website redesign, mobile launch"
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">description</label>
                  <textarea 
                    rows={2}
                    placeholder="describe the project parameters..."
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">link client</label>
                  <select 
                    value={clientId} 
                    onChange={(e) => setClientId(e.target.value)}
                    className="px-2.5 py-2 bg-white border border-[#E2EAF4] rounded-lg text-xs text-[#0C1E36] focus:outline-none"
                  >
                    <option value="">select client (optional)</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">priority</label>
                    <select 
                      value={priority} 
                      onChange={(e) => setPriority(e.target.value)}
                      className="px-2.5 py-2 bg-white border border-[#E2EAF4] rounded-lg text-xs text-[#0C1E36] focus:outline-none"
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="urgent">urgent</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">budget ($ USD)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 5000"
                      value={budget} 
                      onChange={(e) => setBudget(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">start date</label>
                    <input 
                      type="date" 
                      value={startDate} 
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400 text-slate-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">due date</label>
                    <input 
                      type="date" 
                      value={dueDate} 
                      onChange={(e) => setDueDate(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400 text-slate-600"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">milestones / tasks (one per line)</label>
                  <textarea 
                    rows={3}
                    placeholder="e.g. wireframes signoff&#10;draft contract&#10;final deployment"
                    value={milestonesInput} 
                    onChange={(e) => setMilestonesInput(e.target.value)}
                    className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400 resize-none font-sans"
                  />
                </div>
              </form>
            </div>

            <div className="flex items-center gap-2 border-t border-[#E2EAF4] pt-4 mt-6">
              <button 
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-1/3 py-2 border border-[#E2EAF4] rounded-xl text-xs font-semibold text-[#4A5E78] hover:bg-[#F5F8FC] transition-all"
              >
                cancel
              </button>
              <button 
                onClick={handleCreate}
                disabled={saving}
                className="w-2/3 py-2 bg-[#1D4ED8] text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-70"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>launch project</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
