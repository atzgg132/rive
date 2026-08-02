"use client";

import { Button, Input, Textarea, Select } from "@/components/ui";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  X,
  Loader2,
  Trash2,
  CheckCircle,
  MoreVertical,
  Edit2,
  Send
} from "lucide-react";
import { toast } from "sonner";
import DropdownPortal from "@/components/ui/DropdownPortal";
import Portal from "@/components/ui/Portal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface InvoiceItemForm {
  description: string;
  quantity: string;
  unit_price: string;
}

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
  contract_id: string | null;
  contract_title: string | null;
  created_at: string;
  items: InvoiceItemForm[];
}

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  title: string;
  client_id: string | null;
  currency: string;
}

export default function RevenuePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  // Form Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [items, setItems] = useState<InvoiceItemForm[]>([{ description: "", quantity: "1", unit_price: "0" }]);
  const [saving, setSaving] = useState(false);
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState<string | null>(null);
  const invoiceQueryConsumed = useRef(false);

  const loadInvoices = async () => {
    try {
      const res = await fetch(`/api/workflow/invoices?search=${encodeURIComponent(debouncedSearch)}&status=${status}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setInvoices(data.invoices);
        }
      }
    } catch (err) {
      console.error("Error loading invoices:", err);
      toast.error("Failed to load invoices.");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInvoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSelectionData();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setClientId("");
    setProjectId("");
    setCurrency("USD");
    setTaxRate("0");
    setNotes("");
    setDueDate("");
    setIssueDate("");
    setItems([{ description: "", quantity: "1", unit_price: "0" }]);
    const nextNum = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, "0")}`;
    setInvoiceNumber(nextNum);
    setHighlightedInvoiceId(null);
    setDrawerOpen(true);
    setOpenDropdownId(null);
  };

  const openEdit = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setInvoiceNumber(invoice.invoice_number);
    setClientId(invoice.client_id || "");
    setProjectId(invoice.project_id || "");
    setCurrency(invoice.currency || "USD");
    setTaxRate(invoice.tax_rate || "0");
    setNotes(invoice.notes || "");
    setDueDate(invoice.due_date ? new Date(invoice.due_date).toISOString().split("T")[0] : "");
    setIssueDate(invoice.issue_date ? new Date(invoice.issue_date).toISOString().split("T")[0] : "");

    if (invoice.items && invoice.items.length > 0) {
      setItems(invoice.items.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price
      })));
    } else {
      setItems([{ description: "", quantity: "1", unit_price: "0" }]);
    }

    setDrawerOpen(true);
    setHighlightedInvoiceId(invoice.id);
    setOpenDropdownId(null);
  };

  useEffect(() => {
    if (loading || invoiceQueryConsumed.current || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const requestedInvoiceId = url.searchParams.get("invoiceId");
    if (!requestedInvoiceId) {
      invoiceQueryConsumed.current = true;
      return;
    }
    invoiceQueryConsumed.current = true;
    const requestedInvoice = invoices.find((invoice) => invoice.id === requestedInvoiceId);
    if (requestedInvoice) {
      // This consumes an external navigation intent once after async hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openEdit(requestedInvoice);
      toast.info(requestedInvoice.contract_id ? "Review the contract-generated draft before sending it." : "Invoice opened for review.");
    } else {
      toast.error("That invoice is unavailable or no longer matches this workspace.");
    }
    url.searchParams.delete("invoiceId");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [invoices, loading]);

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

  const handleDelete = async (id: string, invoiceNum: string) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invoiceNum}? This action cannot be undone.`)) {
      return;
    }

    setOpenDropdownId(null);
    const loadingToast = toast.loading(`Deleting invoice ${invoiceNum}...`);

    try {
      const res = await fetch(`/api/workflow/invoices?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Invoice deleted successfully.", { id: loadingToast });
        loadInvoices();
      } else {
        toast.error(data.message || "Failed to delete invoice.", { id: loadingToast });
      }
    } catch {
      toast.error("Network error. Try again.", { id: loadingToast });
    }
  };

  const handleMarkPaid = async (id: string, invoiceNum: string) => {
    setOpenDropdownId(null);
    const loadingToast = toast.loading(`Marking invoice ${invoiceNum} as paid...`);

    try {
      const res = await fetch("/api/workflow/invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "paid" })
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Invoice ${invoiceNum} marked as paid.`, { id: loadingToast });
        loadInvoices();
      } else {
        toast.error(data.message || "Failed to update invoice.", { id: loadingToast });
      }
    } catch {
      toast.error("Network error. Try again.", { id: loadingToast });
    }
  };

  const handleSendInvoice = async (id: string, invoiceNum: string) => {
    setOpenDropdownId(null);
    if (!window.confirm(`Review invoice ${invoiceNum}, then send it to the client?`)) return;
    const loadingToast = toast.loading(`Sending invoice ${invoiceNum}...`);
    try {
      const res = await fetch(`/api/workflow/invoices/${id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Invoice was not sent.");
      toast.success(data.message || "Invoice sent.", { id: loadingToast });
      loadInvoices();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invoice was not sent.", { id: loadingToast });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber || saving) return;

    // Validate items
    const invalidItem = items.some(item => !item.description || parseFloat(item.quantity) <= 0 || parseFloat(item.unit_price) < 0);
    if (invalidItem) {
      toast.error("Please check line item description, quantity and rates.");
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading(editingId ? "Updating invoice..." : "Generating invoice...");

    try {
      const url = "/api/workflow/invoices";
      const method = editingId ? "PUT" : "POST";
      const body = JSON.stringify({
        id: editingId,
        client_id: clientId || null,
        project_id: projectId || null,
        currency,
        invoice_number: invoiceNumber,
        status: editingId ? undefined : "draft", // every new invoice stays in review until explicitly sent
        tax_rate: taxRate,
        notes,
        due_date: dueDate || null,
        issue_date: issueDate || null,
        items
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Invoice ${editingId ? "updated" : "generated"} successfully!`, { id: loadingToast });
        setDrawerOpen(false);
        loadInvoices();
      } else {
        toast.error(data.message || "Failed to save invoice.", { id: loadingToast });
      }
    } catch {
      toast.error("Network error. Try again.", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid": return "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50";
      case "sent": return "bg-blue-50 dark:bg-blue-900/20 text-primary dark:text-blue-400 border-blue-100 dark:border-blue-900/50";
      case "overdue": return "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/50";
      default: return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  const formatCurrency = (val: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2
    }).format(val);
  };

  const currencyCodes = new Set(invoices.map((invoice) => invoice.currency).filter(Boolean));
  const summaryCurrency = currencyCodes.size === 1 ? [...currencyCodes][0] : null;
  const summaryValue = (value: number) => summaryCurrency ? formatCurrency(value, summaryCurrency) : currencyCodes.size ? "Multiple currencies" : "—";
  const paidRevenue = invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const outstandingRevenue = invoices.filter((invoice) => ["sent", "viewed", "overdue"].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const overdueInvoices = invoices.filter((invoice) => invoice.status === "overdue" || (invoice.due_date && new Date(invoice.due_date) < new Date() && !["paid", "cancelled"].includes(invoice.status)));
  const overdueRevenue = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.total), 0);
  const collectionRate = summaryCurrency && paidRevenue + outstandingRevenue > 0 ? Math.round((paidRevenue / (paidRevenue + outstandingRevenue)) * 100) : null;
  const editingInvoice = editingId ? invoices.find((invoice) => invoice.id === editingId) || null : null;

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground dark:text-slate-50 sm:text-3xl">Revenue & invoices</h1>
          <p className="text-sm text-muted-foreground dark:text-slate-400">Create invoices, follow collections, and understand how revenue moves through your business.</p>
        </div>
        <Button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 font-semibold text-xs transition-all shadow-[0_4px_10px_rgba(29,78,216,0.1)] dark:shadow-none self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Create new invoice</span>
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["collected", summaryValue(paidRevenue), "cash recognized"],
          ["outstanding", summaryValue(outstandingRevenue), "sent and awaiting payment"],
          ["overdue", summaryValue(overdueRevenue), `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? "" : "s"} need follow-up`],
          ["collection rate", collectionRate === null ? "—" : `${collectionRate}%`, "of issued value collected"],
        ].map(([label, value, detail]) => <div key={label} className="rounded-2xl border border-border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-2 text-xl font-black ${label === "overdue" && overdueRevenue > 0 ? "text-red-600 dark:text-red-400" : "text-foreground dark:text-white"}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>)}
      </section>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-border dark:border-slate-800">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-400" />
          <Input
            type="text"
            placeholder="Search by invoice number, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-muted-foreground dark:text-slate-400">Invoice state:</span>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-border dark:border-slate-700 rounded-lg text-xs font-semibold text-foreground dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All invoices</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="draft">Draft</option>
          </Select>
        </div>
      </div>

      {/* Invoices List Table */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-blue-500" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="glass p-12 text-center flex flex-col items-center justify-center bg-white/70 dark:bg-slate-900/70 border-dashed dark:border-slate-800">
          <FileText className="h-10 w-10 text-slate-400 dark:text-slate-500 mb-3" />
          <h3 className="font-bold text-sm text-foreground dark:text-slate-200 mb-1">No invoices found</h3>
          <p className="text-xs text-muted-foreground dark:text-slate-400 mb-4">Generate an invoice to start charging clients for your project services.</p>
          <Button
            onClick={openCreate}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-accent dark:bg-blue-900/30 text-primary dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 hover:bg-[#E2EAF4] dark:hover:bg-blue-900/50 transition-all"
          >
            build invoice
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border dark:border-slate-800 overflow-visible shadow-sm">
          <div className="overflow-x-auto overflow-y-visible pb-12">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-border dark:border-slate-800 text-[10px] font-bold text-muted-foreground dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Invoice number</th>
                  <th className="py-4 px-6">Client</th>
                  <th className="py-4 px-6">Linked project</th>
                  <th className="py-4 px-6">Issue date</th>
                  <th className="py-4 px-6">Due date</th>
                  <th className="py-4 px-6">Amount due</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2EAF4] dark:divide-slate-800 text-xs text-foreground dark:text-slate-200">
                {invoices.map((inv) => (
                  <tr key={inv.id} className={`transition-colors group ${highlightedInvoiceId === inv.id ? "bg-blue-50/80 ring-1 ring-inset ring-primary/20 dark:bg-blue-950/25" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"}`}>
                    <td className="py-4 px-6 font-bold text-primary dark:text-blue-400">{inv.invoice_number}</td>
                    <td className="py-4 px-6 font-semibold">{inv.client_name || "private client"}</td>
                    <td className="py-4 px-6 text-muted-foreground dark:text-slate-400"><span>{inv.project_title || "none"}</span>{inv.contract_id && inv.contract_title ? <Link href={`/workflow/contracts/${inv.contract_id}`} className="mt-1 block max-w-[220px] truncate text-[10px] font-semibold text-primary hover:underline">Contract: {inv.contract_title}</Link> : null}</td>
                    <td className="py-4 px-6">{new Date(inv.issue_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="py-4 px-6">
                      {inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "immediate"}
                    </td>
                    <td className="py-4 px-6 font-extrabold text-foreground dark:text-slate-100">{formatCurrency(parseFloat(inv.total), inv.currency)}</td>
                    <td className="py-4 px-6">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${getStatusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right relative">
                      {inv.status === "draft" ? <Button size="sm" variant="outline" className="mr-1" onClick={() => openEdit(inv)}><Edit2 className="h-3.5 w-3.5" /> Review</Button> : null}
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openDropdownId === inv.id) {
                            setOpenDropdownId(null);
                          } else {
                            setDropdownRect(e.currentTarget.getBoundingClientRect());
                            setOpenDropdownId(inv.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>

                      {openDropdownId === inv.id && (
                        <DropdownPortal triggerRect={dropdownRect} onClose={() => setOpenDropdownId(null)}>
                          <div className="w-40 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-50 py-1 animate-fade-in-up text-left">
                            {["draft", "overdue"].includes(inv.status) && (
                              <Button
                                onClick={() => handleSendInvoice(inv.id, inv.invoice_number)}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-primary dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center gap-2 transition-colors"
                              >
                                <Send className="h-3.5 w-3.5" /> review & send
                              </Button>
                            )}
                            {!['paid', 'cancelled', 'sending'].includes(inv.status) && (
                              <Button
                                onClick={() => { handleMarkPaid(inv.id, inv.invoice_number); setOpenDropdownId(null); }}
                                className="w-full text-left px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2 transition-colors"
                              >
                                <CheckCircle className="h-3.5 w-3.5" /> mark paid
                              </Button>
                            )}
                            <Button
                              onClick={async () => {
                                setOpenDropdownId(null);
                                const { downloadInvoicePDF } = await import("@/utils/pdfGenerator");
                                await downloadInvoicePDF(inv);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2 transition-colors"
                            >
                              <FileText className="h-3.5 w-3.5" /> download pdf
                            </Button>
                            {["draft", "overdue"].includes(inv.status) ? <Button
                              onClick={() => { openEdit(inv); setOpenDropdownId(null); }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2 transition-colors"
                            >
                              <Edit2 className="h-3.5 w-3.5" /> edit
                            </Button> : null}
                            {!inv.contract_id && !["sent", "paid"].includes(inv.status) ? <Button
                              onClick={() => { handleDelete(inv.id, inv.invoice_number); setOpenDropdownId(null); }}
                              className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> delete
                            </Button> : null}
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

      {/* Add/Edit Invoice Drawer */}
      {drawerOpen && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 h-full flex flex-col justify-between py-6 px-6 shadow-2xl border-l border-border dark:border-slate-800 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground dark:text-slate-200">{editingId ? "edit invoice" : "generate new invoice"}</h3>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">{editingInvoice?.contract_id ? "Generated from the signed payment plan. Confirm every detail before sending." : "Compile itemized work and apply any required tax adjustments."}</p>
                  </div>
                  <Button
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-muted-foreground dark:text-slate-400 hover:bg-background dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-4 max-h-[calc(100vh-16rem)] overflow-y-auto pr-1">
                  {editingInvoice?.contract_id ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100"><p className="font-bold">Contract-generated draft — not sent</p><p className="mt-0.5 text-blue-900/80 dark:text-blue-200/80">The amount and trigger came from {editingInvoice.contract_title || "the executed contract"}. Your edits affect this invoice only; the signed contract record stays unchanged.</p><Link href={`/workflow/contracts/${editingInvoice.contract_id}`} className="mt-1 inline-flex font-bold underline">Open source contract</Link></div> : null}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-foreground dark:text-slate-200 uppercase tracking-wider">Invoice number *</label>
                      <Input
                        type="text"
                        required
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400 font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-foreground dark:text-slate-200 uppercase tracking-wider">Issue date</label>
                      <Input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                        className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs focus:outline-none focus:border-blue-400 text-slate-600 dark:text-slate-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-foreground dark:text-slate-200 uppercase tracking-wider">Due date</label>
                      <Input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs focus:outline-none focus:border-blue-400 text-slate-600 dark:text-slate-300"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-foreground dark:text-slate-200 uppercase tracking-wider">Recipient client</label>
                      <Select
                        value={clientId}
                        onChange={(e) => { setClientId(e.target.value); setProjectId(""); }}
                        disabled={Boolean(editingInvoice?.contract_id)}
                        className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-border dark:border-slate-700 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none"
                      >
                        <option value="">Select client</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-foreground dark:text-slate-200 uppercase tracking-wider">Link project</label>
                      <Select
                        value={projectId}
                        onChange={(e) => { const value = e.target.value; setProjectId(value); const project = projects.find((item) => item.id === value); if (project?.currency) setCurrency(project.currency); }}
                        disabled={Boolean(editingInvoice?.contract_id)}
                        className="px-2.5 py-2 bg-white dark:bg-slate-950 border border-border dark:border-slate-700 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none"
                      >
                        <option value="">Select project (optional)</option>
                        {projects.filter((project) => !clientId || project.client_id === clientId).map(p => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-foreground dark:text-slate-200 uppercase tracking-wider">Currency</label>
                    <Input type="text" maxLength={3} value={currency} disabled={Boolean(editingInvoice?.contract_id)} onChange={(e) => setCurrency(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))} placeholder="USD" />
                  </div>

                  {/* Line Items List */}
                  <div className="flex flex-col gap-3.5 border-t border-b border-dashed border-border dark:border-slate-800 py-4 my-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-extrabold text-foreground dark:text-slate-200 uppercase tracking-wider">Invoice line items</span>
                      <Button
                        type="button"
                        onClick={handleAddItem}
                        disabled={Boolean(editingInvoice?.contract_id)}
                        className="text-[10px] font-bold text-primary dark:text-blue-400 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add item</span>
                      </Button>
                    </div>

                    <div className="flex flex-col gap-3 max-h-[180px] overflow-y-auto">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <Input
                            type="text"
                            required
                            placeholder="Item description..."
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                            className="flex-1 px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                          />
                          <Input
                            type="number"
                            required
                            disabled={Boolean(editingInvoice?.contract_id)}
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            className="w-14 px-2 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-center text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                          />
                          <Input
                            type="number"
                            required
                            disabled={Boolean(editingInvoice?.contract_id)}
                            placeholder="Rate"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(idx, "unit_price", e.target.value)}
                            className="w-20 px-2 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                          />
                          <Button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            disabled={items.length === 1 || Boolean(editingInvoice?.contract_id)}
                            className="p-2 text-muted-foreground dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-foreground dark:text-slate-200 uppercase tracking-wider">Tax rate (%)</label>
                      <Input
                        type="number"
                        placeholder="E.g. 5"
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value)}
                        className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1 bg-background dark:bg-slate-800 p-2.5 rounded-lg border border-border dark:border-slate-700 justify-between text-right">
                      <div className="flex justify-between text-[10px] font-bold text-muted-foreground dark:text-slate-400 uppercase">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(calculateSubtotal(), currency)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-black text-foreground dark:text-slate-200 border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1">
                        <span>Grand total:</span>
                        <span>{formatCurrency(calculateTotal(), currency)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-foreground dark:text-slate-200 uppercase tracking-wider">Payment notes</label>
                    <Textarea
                      rows={2}
                      placeholder="Add bank transfer instructions, terms..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400 resize-none"
                    />
                  </div>
                </form>
              </div>

              <div className="flex items-center gap-2 border-t border-border dark:border-slate-800 pt-4 mt-6">
                <Button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="w-1/3 py-2 border border-border dark:border-slate-700 rounded-xl text-xs font-semibold text-muted-foreground dark:text-slate-400 hover:bg-background dark:hover:bg-slate-800 transition-all"
                >
                  cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-2/3 py-2 bg-primary dark:bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 dark:hover:bg-blue-500 transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-70"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>{editingId ? "save reviewed draft" : "generate invoice"}</span>
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
