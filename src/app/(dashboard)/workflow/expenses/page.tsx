"use client";

import { Button, ContextualEmptyState, Input, PageHeader, Select } from "@/components/ui";

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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { DISPLAY_CURRENCIES } from "@/lib/currency";

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
  currency?: string;
}

export default function ExpensesPage() {
  const { displayCurrency, convert, format, formatConverted, ratesAsOf, ratesStatus } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
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
  const [currencyInput, setCurrencyInput] = useState<string>(displayCurrency);
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState("");
  const [isBillable, setIsBillable] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadExpenses = async () => {
    try {
      const res = await fetch(`/api/workflow/expenses?search=${encodeURIComponent(debouncedSearch)}&category=${category}`);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadExpenses();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, category]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProjects();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setDescription("");
    setCategoryInput("software");
    setAmount("");
    setCurrencyInput(displayCurrency);
    setProjectId("");
    setDate("");
    setIsBillable(false);
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

  const openEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setDescription(expense.description);
    setCategoryInput(expense.category);
    setAmount(expense.amount);
    setCurrencyInput(expense.currency || displayCurrency);
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
    } catch {
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
          currency: currencyInput,
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
    } catch {
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

  const formatCurrency = (val: number, currency: string = displayCurrency) => format(val, currency);

  const now = new Date();
  const monthExpenses = expenses.filter((expense) => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
  });
  const sumExpenses = (itemsToSum: Expense[]) => {
    let total = 0;
    for (const expense of itemsToSum) {
      const converted = convert(Number(expense.amount), expense.currency);
      if (converted === null) return null;
      total += converted;
    }
    return total;
  };
  const formatSummary = (value: number | null) => value === null ? (ratesStatus === "loading" ? "Converting…" : "Rates unavailable") : formatCurrency(value);
  const monthSpend = sumExpenses(monthExpenses);
  const billableOutstanding = sumExpenses(expenses.filter((expense) => expense.is_billable && !expense.is_reimbursed));
  const categoriesAvailable = expenses.every((expense) => convert(Number(expense.amount), expense.currency) !== null);
  const categoryTotals = expenses.reduce<Record<string, number>>((totals, expense) => {
    const converted = convert(Number(expense.amount), expense.currency);
    totals[expense.category] = (totals[expense.category] || 0) + (converted || 0);
    return totals;
  }, {});
  const topCategory = categoriesAvailable ? Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] || null : null;
  const linkedSpend = sumExpenses(expenses.filter((expense) => expense.project_id));

  return (
    <div className="workspace-page relative min-h-[calc(100vh-8rem)] animate-fade-in">
      <PageHeader
        title="Expenses"
        description={<>Track operating and project costs in {displayCurrency} while preserving each expense&apos;s original currency.</>}
        actions={<Button data-guide-target="expenses-create" onClick={openCreate}><Plus /> Log expense</Button>}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["this month", formatSummary(monthSpend), `${monthExpenses.length} logged cost${monthExpenses.length === 1 ? "" : "s"}`],
          ["billable, unreimbursed", formatSummary(billableOutstanding), "recoverable from clients"],
          ["largest category", topCategory?.[0] || "—", topCategory ? formatCurrency(topCategory[1]) : "categorize costs to reveal spend"],
          ["linked to projects", formatSummary(linkedSpend), "available for project profitability"],
        ].map(([label, value, detail]) => <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-card"><p className="text-xs font-semibold capitalize text-muted-foreground">{label}</p><p className="mt-2 truncate text-xl font-extrabold capitalize text-foreground">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>)}
      </section>

      <p className="-mt-3 text-[11px] text-muted-foreground">Original expense currencies remain unchanged. {ratesStatus === "ready" ? `Display conversions use indicative reference rates dated ${ratesAsOf || "the latest business day"}.` : ratesStatus === "loading" ? "Loading current reference rates…" : "Reference rates are temporarily unavailable; native expense amounts remain visible."}</p>

      {/* Filter and Search */}
      <div className="workspace-toolbar">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-400" />
          <Input
            type="text"
            placeholder="Search by description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-medium text-muted-foreground">Category</span>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="sm:w-auto"
          >
            <option value="all">All categories</option>
            <option value="software">Software</option>
            <option value="hardware">Hardware</option>
            <option value="travel">Travel</option>
            <option value="meals">Meals</option>
            <option value="office">Office</option>
            <option value="contractor">Contractor</option>
            <option value="other">Other</option>
          </Select>
        </div>
      </div>

      {/* Expense List Table */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-blue-500" />
        </div>
      ) : expenses.length === 0 ? (
        <ContextualEmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="See the cost of doing the work"
          description="Project-linked expenses contribute to profitability and net earnings."
          why="A small amount of cost context makes the financial summary more useful."
          next="Log one recent operating or project expense."
          after="Rive will include it in your expense and profitability views."
          action={<Button variant="secondary" size="sm" onClick={openCreate}>Log expense</Button>}
        />
      ) : (
        <div className="workspace-table">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted-foreground">
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Description</th>
                  <th className="py-4 px-6">Category</th>
                  <th className="py-4 px-6">Linked project</th>
                  <th className="py-4 px-6">Billable</th>
                  <th className="py-4 px-6">Amount</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm text-foreground">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="group transition-colors hover:bg-muted/35">
                    <td className="py-4 px-6">{new Date(exp.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="py-4 px-6 font-bold">{exp.description}</td>
                    <td className="py-4 px-6">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold capitalize ${getCategoryColor(exp.category)}`}>
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-muted-foreground">{exp.project_title || "None"}</td>
                    <td className="py-4 px-6">
                      {exp.is_billable ? (
                        <span className="rounded-md border border-success/20 bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">Yes</span>
                      ) : (
                        <span className="rounded-md border border-border bg-muted/60 px-2 py-1 text-[11px] font-semibold text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-bold text-destructive">
                      <span className="block">{formatConverted(parseFloat(exp.amount), exp.currency) || formatCurrency(parseFloat(exp.amount), exp.currency)}</span>
                      {exp.currency !== displayCurrency && <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">Originally {formatCurrency(parseFloat(exp.amount), exp.currency)}</span>}
                    </td>
                    <td className="py-4 px-6 text-right relative">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openDropdownId === exp.id) {
                            setOpenDropdownId(null);
                          } else {
                            setDropdownRect(e.currentTarget.getBoundingClientRect());
                            setOpenDropdownId(exp.id);
                          }
                        }}
                        aria-label={`Actions for ${exp.description}`}
                        title={`Actions for ${exp.description}`}
                        variant="ghost"
                        size="icon-sm"
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 focus:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>

                      {openDropdownId === exp.id && (
                        <DropdownPortal triggerRect={dropdownRect} onClose={() => setOpenDropdownId(null)}>
                          <div className="w-32 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-50 py-1 animate-fade-in-up text-left">
                            <Button
                              onClick={() => { openEdit(exp); setOpenDropdownId(null); }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2 transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button
                              onClick={() => { handleDelete(exp.id, exp.description); setOpenDropdownId(null); }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
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
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col justify-between py-6 px-6 shadow-2xl border-l border-border dark:border-slate-800 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground dark:text-slate-200">{editingId ? "Edit operating cost" : "Log operating cost"}</h3>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">Save receipt parameters and category classifications.</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close expense editor"
                    title="Close expense editor"
                    className="text-muted-foreground dark:text-slate-400 hover:bg-background dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-4 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Cost description *</label>
                    <Input
                      type="text"
                      required
                      placeholder="E.g. figma monthly, server fees, uber taxi"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Category</label>
                      <Select
                        value={categoryInput}
                        onChange={(e) => setCategoryInput(e.target.value)}
                        className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-border dark:border-slate-700 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none"
                      >
                        <option value="software">Software</option>
                        <option value="hardware">Hardware</option>
                        <option value="travel">Travel</option>
                        <option value="meals">Meals</option>
                        <option value="office">Office</option>
                        <option value="contractor">Contractor</option>
                        <option value="other">Other</option>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Amount *</label>
                      <Input
                        type="number"
                        required
                        step="0.01"
                        placeholder="E.g. 49.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Currency</label>
                      <Select value={currencyInput} onChange={(event) => setCurrencyInput(event.target.value)} className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-border dark:border-slate-700 rounded-lg text-xs font-bold text-foreground dark:text-slate-200">
                        {DISPLAY_CURRENCIES.map(({ code, label }) => <option key={code} value={code}>{code} · {label}</option>)}
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Date</label>
                      <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs focus:outline-none focus:border-blue-400 text-slate-600 dark:text-slate-300"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Link project</label>
                      <Select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-border dark:border-slate-700 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none"
                      >
                        <option value="">Not linked</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg border border-border dark:border-slate-700">
                    <Input
                      type="checkbox"
                      id="billable"
                      checked={isBillable}
                      onChange={(e) => setIsBillable(e.target.checked)}
                      className="h-4 w-4 text-primary dark:text-blue-500 focus:ring-blue-100 border-border dark:border-slate-600 rounded bg-white dark:bg-slate-900"
                    />
                    <div className="flex flex-col">
                      <label htmlFor="billable" className="text-xs font-bold text-foreground dark:text-slate-200 cursor-pointer">Billable to client</label>
                      <span className="text-[10px] text-muted-foreground dark:text-slate-400">Reclaim this expense via invoicing later.</span>
                    </div>
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
                  <span>{editingId ? "Update expense" : "Log expense"}</span>
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
