"use client";

import React, { useState, useEffect } from "react";
import { 
  Receipt, 
  Plus, 
  Search, 
  X, 
  Loader2, 
  MoreVertical,
  Edit2,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import DropdownPortal from "@/components/ui/DropdownPortal";
import Portal from "@/components/ui/Portal";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  const [description, setDescription] = useState("");
  const [categoryInput, setCategoryInput] = useState("software");
  const [amount, setAmount] = useState("");
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState("");
  const [isBillable, setIsBillable] = useState(false);
  const [saving, setSaving] = useState(false);

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
      toast.error("Failed to load expenses");
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

  const openCreate = () => {
    setEditingId(null);
    setDescription("");
    setCategoryInput("software");
    setAmount("");
    setProjectId("");
    setDate("");
    setIsBillable(false);
    setDrawerOpen(true);
    setOpenDropdownId(null);
  };

  const openEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setDescription(expense.description);
    setCategoryInput(expense.category);
    setAmount(expense.amount);
    setProjectId(expense.project_id || "");
    setDate(expense.date ? new Date(expense.date).toISOString().split('T')[0] : "");
    setIsBillable(expense.is_billable);
    setDrawerOpen(true);
    setOpenDropdownId(null);
  };

  const handleDelete = async (id: string, merchant: string) => {
    if (!window.confirm(`Are you sure you want to delete ${merchant}? This action cannot be undone.`)) {
      return;
    }
    
    setOpenDropdownId(null);
    const loadingToast = toast.loading(`Deleting ${merchant}...`);
    
    try {
      const res = await fetch(`/api/workflow/expenses?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success(data.message || "Expense deleted successfully", { id: loadingToast });
        loadExpenses();
      } else {
        toast.error(data.message || "Failed to delete expense", { id: loadingToast });
      }
    } catch (err) {
      toast.error("Network error. Try again.", { id: loadingToast });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || saving) return;

    setSaving(true);
    const loadingToast = toast.loading(editingId ? "Updating expense..." : "Logging expense...");

    try {
      const method = editingId ? "PUT" : "POST";
      const res = await fetch("/api/workflow/expenses", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
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
        toast.success(data.message || `Expense ${editingId ? 'updated' : 'logged'} successfully!`, { id: loadingToast });
        setDrawerOpen(false);
        loadExpenses();
      } else {
        toast.error(data.message || "Failed to save expense.", { id: loadingToast });
      }
    } catch (err) {
      toast.error("Network error. Try again.", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "software": return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-900/50";
      case "hardware": return "bg-[#F5F3FF] dark:bg-purple-900/20 text-[#8B5CF6] dark:text-purple-400 border-purple-100 dark:border-purple-900/50";
      case "travel": return "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-100 dark:border-orange-900/50";
      case "meals": return "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50";
      case "contractor": return "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50";
      default: return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
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
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0C1E36] dark:text-slate-50">expenses & deductions</h1>
          <p className="text-sm text-[#4A5E78] dark:text-slate-400">track contractor payouts, software subscriptions, and billable project charges.</p>
        </div>
        <button 
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1D4ED8] dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 font-semibold text-xs transition-all shadow-[0_4px_10px_rgba(29,78,216,0.1)] dark:shadow-none self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>log new expense</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#E2EAF4] dark:border-slate-800">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78] dark:text-slate-400" />
          <input 
            type="text" 
            placeholder="search by description..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-[#4A5E78] dark:text-slate-400">category:</span>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-[#E2EAF4] dark:border-slate-700 rounded-lg text-xs font-semibold text-[#0C1E36] dark:text-slate-200 focus:outline-none"
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
          <Loader2 className="h-6 w-6 animate-spin text-[#1D4ED8] dark:text-blue-500" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="glass p-12 text-center flex flex-col items-center justify-center bg-white/70 dark:bg-slate-900/70 border-dashed dark:border-slate-800">
          <Receipt className="h-10 w-10 text-slate-400 dark:text-slate-500 mb-3" />
          <h3 className="font-bold text-sm text-[#0C1E36] dark:text-slate-200 mb-1">no expenses logged</h3>
          <p className="text-xs text-[#4A5E78] dark:text-slate-400 mb-4">log operating or project costs to keep accurate profitability margins.</p>
          <button 
            onClick={openCreate}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#EFF6FF] dark:bg-blue-900/30 text-[#1D4ED8] dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 hover:bg-[#E2EAF4] dark:hover:bg-blue-900/50 transition-all"
          >
            log expense
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#E2EAF4] dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-[#E2EAF4] dark:border-slate-800 text-[10px] font-bold text-[#4A5E78] dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">date</th>
                  <th className="py-4 px-6">description</th>
                  <th className="py-4 px-6">category</th>
                  <th className="py-4 px-6">linked project</th>
                  <th className="py-4 px-6">billable</th>
                  <th className="py-4 px-6">amount</th>
                  <th className="py-4 px-6 text-right">actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2EAF4] dark:divide-slate-800 text-xs text-[#0C1E36] dark:text-slate-200">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="py-4 px-6">{new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="py-4 px-6 font-bold">{exp.description}</td>
                    <td className="py-4 px-6">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${getCategoryColor(exp.category)}`}>
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#4A5E78] dark:text-slate-400">{exp.project_title || "none"}</td>
                    <td className="py-4 px-6">
                      {exp.is_billable ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 uppercase">yes</span>
                      ) : (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-[#4A5E78] dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase">no</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-extrabold text-[#EF4444] dark:text-red-400">{formatCurrency(parseFloat(exp.amount))}</td>
                    <td className="py-4 px-6 text-right relative">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openDropdownId === exp.id) {
                            setOpenDropdownId(null);
                          } else {
                            setDropdownRect(e.currentTarget.getBoundingClientRect());
                            setOpenDropdownId(exp.id);
                          }
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      
                      {openDropdownId === exp.id && (
                        <DropdownPortal triggerRect={dropdownRect} onClose={() => setOpenDropdownId(null)}>
                          <div className="w-32 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-50 py-1 animate-fade-in-up text-left">
                            <button 
                              onClick={() => { openEdit(exp); setOpenDropdownId(null); }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2 transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" /> edit
                            </button>
                            <button 
                              onClick={() => { handleDelete(exp.id, exp.description); setOpenDropdownId(null); }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> delete
                            </button>
                          </div>
                        </DropdownPortal>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Expense Drawer */}
      {drawerOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col justify-between py-6 px-6 shadow-2xl border-l border-[#E2EAF4] dark:border-slate-800 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#0C1E36] dark:text-slate-200">{editingId ? "edit operating cost" : "log operating cost"}</h3>
                    <p className="text-xs text-[#4A5E78] dark:text-slate-400">save receipt parameters and category classifications.</p>
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
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">cost description *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. figma monthly, server fees, uber taxi"
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">category</label>
                      <select 
                        value={categoryInput} 
                        onChange={(e) => setCategoryInput(e.target.value)}
                        className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-[#E2EAF4] dark:border-slate-700 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none"
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
                      <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">amount ($ USD) *</label>
                      <input 
                        type="number" 
                        required
                        step="0.01"
                        placeholder="e.g. 49.00"
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)}
                        className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">date</label>
                      <input 
                        type="date" 
                        value={date} 
                        onChange={(e) => setDate(e.target.value)}
                        className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs focus:outline-none focus:border-blue-400 text-slate-600 dark:text-slate-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">link project</label>
                      <select 
                        value={projectId} 
                        onChange={(e) => setProjectId(e.target.value)}
                        className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-[#E2EAF4] dark:border-slate-700 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none"
                      >
                        <option value="">not linked</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-[#E2EAF4] dark:border-slate-700">
                    <input 
                      type="checkbox" 
                      id="billable"
                      checked={isBillable}
                      onChange={(e) => setIsBillable(e.target.checked)}
                      className="h-4 w-4 text-[#1D4ED8] dark:text-blue-500 focus:ring-blue-100 border-[#E2EAF4] dark:border-slate-600 rounded bg-white dark:bg-slate-900"
                    />
                    <div className="flex flex-col">
                      <label htmlFor="billable" className="text-xs font-bold text-[#0C1E36] dark:text-slate-200 cursor-pointer">billable to client</label>
                      <span className="text-[10px] text-[#4A5E78] dark:text-slate-400">reclaim this expense via invoicing later.</span>
                    </div>
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
                  <span>{editingId ? "update expense" : "log expense"}</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
