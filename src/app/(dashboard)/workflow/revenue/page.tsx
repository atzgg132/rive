"use client";

import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  DollarSign, 
  X, 
  Loader2, 
  Trash2, 
  Eye, 
  CheckCircle, 
  Clock, 
  Tag
} from "lucide-react";

interface Invoice {
  id: string;
  client_id: string | null;
  project_id: string | null;
  invoice_number: string;
  status: string;
  currency: string;
  subtotal: string;
  tax_rate: string;
  tax_amount: string;
  total: string;
  issue_date: string;
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  client_name: string | null;
  project_title: string | null;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  title: string;
  client_id: string | null;
}

interface InvoiceItemForm {
  description: string;
  quantity: string;
  unit_price: string;
}

export default function RevenuePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  // Form Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<InvoiceItemForm[]>([{ description: "", quantity: "1", unit_price: "0" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadInvoices = async () => {
    try {
      const res = await fetch(`/api/workflow/invoices?search=${encodeURIComponent(search)}&status=${status}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setInvoices(data.invoices);
        }
      }
    } catch (err) {
      console.error("Error loading invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectionData = async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        fetch("/api/workflow/clients"),
        fetch("/api/workflow/projects")
      ]);
      
      if (cRes.ok) {
        const cData = await cRes.json();
        if (cData.success) setClients(cData.clients);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.success) setProjects(pData.projects);
      }
    } catch (err) {
      console.error("Error loading selection lists:", err);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [search, status]);

  useEffect(() => {
    loadSelectionData();
  }, []);

  // Update invoice number dynamically on open
  useEffect(() => {
    if (drawerOpen) {
      // Auto generate a next invoice number based on invoice count
      const nextNum = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`;
      setInvoiceNumber(nextNum);
    }
  }, [drawerOpen, invoices.length]);

  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: "1", unit_price: "0" }]);
  };

  const handleRemoveItem = (idx: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: keyof InvoiceItemForm, value: string) => {
    const nextItems = [...items];
    nextItems[idx][field] = value;
    setItems(nextItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((acc, curr) => {
      const q = parseFloat(curr.quantity) || 0;
      const p = parseFloat(curr.unit_price) || 0;
      return acc + (q * p);
    }, 0);
  };

  const calculateTotal = () => {
    const sub = calculateSubtotal();
    const rate = parseFloat(taxRate) || 0;
    return sub + (sub * (rate / 100));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber || saving) return;

    // Validate items
    const invalidItem = items.some(item => !item.description || parseFloat(item.quantity) <= 0 || parseFloat(item.unit_price) < 0);
    if (invalidItem) {
      setError("Please check line item description, quantity and rates.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/workflow/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId || null,
          project_id: projectId || null,
          invoice_number: invoiceNumber,
          status: "sent", // default to sent
          tax_rate: taxRate,
          notes,
          due_date: dueDate || null,
          items
        }),
      });

      const data = await res.json();
      if (data.success) {
        setDrawerOpen(false);
        setClientId("");
        setProjectId("");
        setTaxRate("0");
        setNotes("");
        setDueDate("");
        setItems([{ description: "", quantity: "1", unit_price: "0" }]);
        loadInvoices();
      } else {
        setError(data.message || "Failed to generate invoice.");
      }
    } catch (err) {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "sent": return "bg-blue-50 text-[#1D4ED8] border-blue-100";
      case "overdue": return "bg-red-50 text-red-700 border-red-100";
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
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0C1E36]">revenue & billing</h1>
          <p className="text-sm text-[#4A5E78]">track customer invoices, compile invoice schedules, and verify revenue flow.</p>
        </div>
        <button 
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white hover:bg-blue-700 font-semibold text-xs transition-all shadow-[0_4px_10px_rgba(29,78,216,0.1)] self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>create new invoice</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-[#E2EAF4]">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78]" />
          <input 
            type="text" 
            placeholder="search by invoice number, client..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E2EAF4] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-[#4A5E78]">invoice state:</span>
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[#E2EAF4] rounded-lg text-xs font-semibold text-[#0C1E36] focus:outline-none"
          >
            <option value="all">all invoices</option>
            <option value="sent">sent</option>
            <option value="paid">paid</option>
            <option value="overdue">overdue</option>
            <option value="draft">draft</option>
          </select>
        </div>
      </div>

      {/* Invoices List Table */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-[#1D4ED8]" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="glass p-12 text-center flex flex-col items-center justify-center bg-white/70 border-dashed">
          <FileText className="h-10 w-10 text-slate-400 mb-3" />
          <h3 className="font-bold text-sm text-[#0C1E36] mb-1">no invoices found</h3>
          <p className="text-xs text-[#4A5E78] mb-4">generate an invoice to start charging clients for your project services.</p>
          <button 
            onClick={() => setDrawerOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-blue-100 hover:bg-[#E2EAF4] transition-all"
          >
            build invoice
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E2EAF4] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#E2EAF4] text-[10px] font-bold text-[#4A5E78] uppercase tracking-wider">
                  <th className="py-4 px-6">invoice number</th>
                  <th className="py-4 px-6">client</th>
                  <th className="py-4 px-6">linked project</th>
                  <th className="py-4 px-6">issue date</th>
                  <th className="py-4 px-6">due date</th>
                  <th className="py-4 px-6">amount due</th>
                  <th className="py-4 px-6">status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2EAF4] text-xs text-[#0C1E36]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-bold text-[#1D4ED8]">{inv.invoice_number}</td>
                    <td className="py-4 px-6 font-semibold">{inv.client_name || "private client"}</td>
                    <td className="py-4 px-6 text-[#4A5E78]">{inv.project_title || "none"}</td>
                    <td className="py-4 px-6">{new Date(inv.issue_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="py-4 px-6">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "immediate"}
                    </td>
                    <td className="py-4 px-6 font-extrabold text-[#0C1E36]">{formatCurrency(parseFloat(inv.total))}</td>
                    <td className="py-4 px-6">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${getStatusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Invoice Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
          <div className="relative w-full max-w-lg bg-white h-full flex flex-col justify-between py-6 px-6 shadow-2xl border-l border-[#E2EAF4] animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#0C1E36]">generate new invoice</h3>
                  <p className="text-xs text-[#4A5E78]">compile itemized tasks and apply tax adjustments to client bills.</p>
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

              <form onSubmit={handleCreate} className="flex flex-col gap-4 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">invoice number *</label>
                    <input 
                      type="text" 
                      required 
                      value={invoiceNumber} 
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400 font-mono"
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">recipient client</label>
                    <select 
                      value={clientId} 
                      onChange={(e) => setClientId(e.target.value)}
                      className="px-2.5 py-2 bg-white border border-[#E2EAF4] rounded-lg text-xs text-[#0C1E36] focus:outline-none"
                    >
                      <option value="">select client</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">link project</label>
                    <select 
                      value={projectId} 
                      onChange={(e) => setProjectId(e.target.value)}
                      className="px-2.5 py-2 bg-white border border-[#E2EAF4] rounded-lg text-xs text-[#0C1E36] focus:outline-none"
                    >
                      <option value="">select project (optional)</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Line Items List */}
                <div className="flex flex-col gap-3.5 border-t border-b border-dashed border-[#E2EAF4] py-4 my-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-extrabold text-[#0C1E36] uppercase tracking-wider">invoice line items</span>
                    <button 
                      type="button"
                      onClick={handleAddItem}
                      className="text-[10px] font-bold text-[#1D4ED8] hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      <span>add item</span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 max-h-[180px] overflow-y-auto">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          required
                          placeholder="item description..."
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                          className="flex-1 px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                        />
                        <input 
                          type="number" 
                          required
                          placeholder="qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          className="w-14 px-2 py-2 border border-[#E2EAF4] rounded-lg text-xs text-center focus:outline-none focus:border-blue-400"
                        />
                        <input 
                          type="number" 
                          required
                          placeholder="rate"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, "unit_price", e.target.value)}
                          className="w-20 px-2 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                        />
                        <button 
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={items.length === 1}
                          className="p-2 text-[#4A5E78] hover:text-red-600 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">tax rate (%)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 5"
                      value={taxRate} 
                      onChange={(e) => setTaxRate(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1 bg-[#F5F8FC] p-2.5 rounded-lg border border-[#E2EAF4] justify-between text-right">
                    <div className="flex justify-between text-[10px] font-bold text-[#4A5E78] uppercase">
                      <span>subtotal:</span>
                      <span>{formatCurrency(calculateSubtotal())}</span>
                    </div>
                    <div className="flex justify-between text-xs font-black text-[#0C1E36] border-t border-slate-200 pt-1.5 mt-1">
                      <span>grand total:</span>
                      <span>{formatCurrency(calculateTotal())}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">payment notes</label>
                  <textarea 
                    rows={2}
                    placeholder="add bank transfer instructions, terms..."
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)}
                    className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400 resize-none"
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
                <span>generate invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
