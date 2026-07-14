"use client";

import React, { useState, useEffect } from "react";
import { 
  Receipt, 
  Plus, 
  Search, 
  Calendar, 
  Briefcase, 
  DollarSign, 
  X, 
  Loader2, 
  Tag, 
  CheckSquare, 
  AlertCircle
} from "lucide-react";

interface Expense {
  id: string;
  project_id: string | null;
  category: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  receipt_url: string | null;
  is_billable: boolean;
  is_reimbursed: boolean;
  project_title: string | null;
  created_at: string;
}

interface Project {
  id: string;
  title: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  // Form Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [categoryInput, setCategoryInput] = useState("software");
  const [amount, setAmount] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState("");
  const [isBillable, setIsBillable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadExpenses = async () => {
    try {
      const res = await fetch(`/api/workflow/expenses?search=${encodeURIComponent(search)}&category=${category}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setExpenses(data.expenses);
        }
      }
    } catch (err) {
      console.error("Error loading expenses:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await fetch("/api/workflow/projects");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setProjects(data.projects);
        }
      }
    } catch (err) {
      console.error("Error loading projects:", err);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [search, category]);

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || saving) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/workflow/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId || null,
          category: categoryInput,
          description,
          amount: parseFloat(amount),
          date: date || new Date().toISOString().split("T")[0],
          is_billable: isBillable
        }),
      });

      const data = await res.json();
      if (data.success) {
        setDrawerOpen(false);
        setDescription("");
        setCategoryInput("software");
        setAmount("");
        setProjectId("");
        setDate("");
        setIsBillable(false);
        loadExpenses();
      } else {
        setError(data.message || "Failed to log expense.");
      }
    } catch (err) {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "software": return "bg-blue-50 text-blue-700 border-blue-100";
      case "hardware": return "bg-[#F5F3FF] text-[#8B5CF6] border-purple-100";
      case "travel": return "bg-orange-50 text-orange-700 border-orange-100";
      case "meals": return "bg-amber-50 text-amber-700 border-amber-100";
      case "contractor": return "bg-emerald-50 text-emerald-700 border-emerald-100";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2
    }).format(val);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0C1E36]">expenses & deductions</h1>
          <p className="text-sm text-[#4A5E78]">track contractor payouts, software subscriptions, and billable project charges.</p>
        </div>
        <button 
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white hover:bg-blue-700 font-semibold text-xs transition-all shadow-[0_4px_10px_rgba(29,78,216,0.1)] self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>log new expense</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-[#E2EAF4]">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78]" />
          <input 
            type="text" 
            placeholder="search by description..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E2EAF4] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-[#4A5E78]">category:</span>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[#E2EAF4] rounded-lg text-xs font-semibold text-[#0C1E36] focus:outline-none"
          >
            <option value="all">all categories</option>
            <option value="software">software</option>
            <option value="hardware">hardware</option>
            <option value="travel">travel</option>
            <option value="meals">meals</option>
            <option value="office">office</option>
            <option value="contractor">contractor</option>
            <option value="other">other</option>
          </select>
        </div>
      </div>

      {/* Expense List Table */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-[#1D4ED8]" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="glass p-12 text-center flex flex-col items-center justify-center bg-white/70 border-dashed">
          <Receipt className="h-10 w-10 text-slate-400 mb-3" />
          <h3 className="font-bold text-sm text-[#0C1E36] mb-1">no expenses logged</h3>
          <p className="text-xs text-[#4A5E78] mb-4">log operating or project costs to keep accurate profitability margins.</p>
          <button 
            onClick={() => setDrawerOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-blue-100 hover:bg-[#E2EAF4] transition-all"
          >
            log expense
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2EAF4] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2EAF4] text-[10px] font-bold text-[#4A5E78] uppercase tracking-wider">
                  <th className="py-4 px-6">date</th>
                  <th className="py-4 px-6">description</th>
                  <th className="py-4 px-6">category</th>
                  <th className="py-4 px-6">linked project</th>
                  <th className="py-4 px-6">billable</th>
                  <th className="py-4 px-6">amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2EAF4] text-xs text-[#0C1E36]">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">{new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="py-4 px-6 font-bold">{exp.description}</td>
                    <td className="py-4 px-6">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${getCategoryColor(exp.category)}`}>
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#4A5E78]">{exp.project_title || "none"}</td>
                    <td className="py-4 px-6">
                      {exp.is_billable ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">yes</span>
                      ) : (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-50 text-[#4A5E78] border border-slate-200 uppercase">no</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-extrabold text-[#EF4444]">{formatCurrency(parseFloat(exp.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Expense Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
          <div className="relative w-full max-w-md bg-white h-full flex flex-col justify-between py-6 px-6 shadow-2xl border-l border-[#E2EAF4] animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#0C1E36]">log operating cost</h3>
                  <p className="text-xs text-[#4A5E78]">save receipt parameters and category classifications.</p>
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
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">cost description *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. figma monthly, server fees, uber taxi"
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)}
                    className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">category</label>
                    <select 
                      value={categoryInput} 
                      onChange={(e) => setCategoryInput(e.target.value)}
                      className="px-2.5 py-2 bg-white border border-[#E2EAF4] rounded-lg text-xs text-[#0C1E36] focus:outline-none"
                    >
                      <option value="software">software</option>
                      <option value="hardware">hardware</option>
                      <option value="travel">travel</option>
                      <option value="meals">meals</option>
                      <option value="office">office</option>
                      <option value="contractor">contractor</option>
                      <option value="other">other</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">amount ($ USD) *</label>
                    <input 
                      type="number" 
                      required
                      placeholder="e.g. 49.00"
                      value={amount} 
                      onChange={(e) => setAmount(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">date</label>
                    <input 
                      type="date" 
                      value={date} 
                      onChange={(e) => setDate(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400 text-slate-600"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">link project</label>
                    <select 
                      value={projectId} 
                      onChange={(e) => setProjectId(e.target.value)}
                      className="px-2.5 py-2 bg-white border border-[#E2EAF4] rounded-lg text-xs text-[#0C1E36] focus:outline-none"
                    >
                      <option value="">not linked</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 bg-slate-50 p-3 rounded-lg border border-[#E2EAF4]">
                  <input 
                    type="checkbox" 
                    id="billable"
                    checked={isBillable}
                    onChange={(e) => setIsBillable(e.target.checked)}
                    className="h-4 w-4 text-[#1D4ED8] focus:ring-blue-100 border-[#E2EAF4] rounded"
                  />
                  <div className="flex flex-col">
                    <label htmlFor="billable" className="text-xs font-bold text-[#0C1E36] cursor-pointer">billable to client</label>
                    <span className="text-[10px] text-[#4A5E78]">reclaim this expense via invoicing later.</span>
                  </div>
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
                <span>log expense</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
