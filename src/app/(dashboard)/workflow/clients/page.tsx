"use client";

import { Button, ContextualEmptyState, Input, PageHeader, PaginationControls, Textarea, Select } from "@/components/ui";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Globe,
  Briefcase,
  DollarSign,
  X,
  Loader2,
  Tag,
  MoreVertical,
  Edit2,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import DropdownPortal from "@/components/ui/DropdownPortal";
import Portal from "@/components/ui/Portal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import type { PaginationMeta } from "@/lib/pagination";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
  address: string | null;
  avatar_color: string;
  notes: string | null;
  tags: string[];
  status: string;
  project_count: number;
  total_revenue: string;
  revenue_by_currency: Record<string, number>;
}

export default function ClientsPage() {
  const { displayCurrency, convert, format } = useCurrency();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  // Drawer & Form state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [saving, setSaving] = useState(false);

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workflow/clients?search=${encodeURIComponent(debouncedSearch)}&status=${status}&page=${page}&pageSize=25`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setClients(data.clients);
          setPagination(data.pagination || null);
        }
      }
    } catch (err) {
      console.error("Error loading clients:", err);
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, page]);

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setWebsite("");
    setAddress("");
    setNotes("");
    setTagsInput("");
    setDrawerOpen(true);
  };

  useEffect(() => {
    if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("new") !== "true") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openCreate();
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const openEdit = (client: Client) => {
    setEditingId(client.id);
    setName(client.name);
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setCompany(client.company || "");
    setWebsite(client.website || "");
    setAddress(client.address || "");
    setNotes(client.notes || "");
    setTagsInput(client.tags.join(", "));
    setDrawerOpen(true);
    setOpenDropdownId(null);
  };

  const handleDelete = async (id: string, clientName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${clientName}? This action cannot be undone.`)) {
      return;
    }

    setOpenDropdownId(null);
    const loadingToast = toast.loading(`Deleting ${clientName}...`);

    try {
      const res = await fetch(`/api/workflow/clients?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Client deleted successfully", { id: loadingToast });
        loadClients();
      } else {
        toast.error(data.message || "Failed to delete client", { id: loadingToast });
      }
    } catch {
      toast.error("Network error. Try again.", { id: loadingToast });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || saving) return;

    setSaving(true);
    const loadingToast = toast.loading(editingId ? "Updating client..." : "Creating client...");

    try {
      const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);

      const url = "/api/workflow/clients";
      const method = editingId ? "PUT" : "POST";
      const body = JSON.stringify({
        id: editingId,
        name,
        email,
        phone,
        company,
        website,
        address,
        notes,
        tags
      });

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Client ${editingId ? 'updated' : 'created'} successfully!`, { id: loadingToast });
        setDrawerOpen(false);
        loadClients();
      } else {
        toast.error(data.message || "Failed to save client.", { id: loadingToast });
      }
    } catch {
      toast.error("Network error. Try again.", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const formatClientRevenue = (client: Client) => {
    let total = 0;
    for (const [currency, amount] of Object.entries(client.revenue_by_currency || {})) {
      const converted = convert(amount, currency);
      if (converted === null) return "Rates unavailable";
      total += converted;
    }
    return format(total, displayCurrency);
  };

  return (
    <div className="workspace-page relative min-h-[calc(100vh-8rem)] animate-fade-in">
      <PageHeader
        title="Clients"
        description="Keep contact details, projects, invoices, and relationship history together."
        actions={<Button data-guide-target="clients-create" onClick={openCreate}><Plus /> Add client</Button>}
      />

      {/* Filter bar */}
      <div className="workspace-toolbar">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-400" />
          <Input
            type="text"
            placeholder="Search by name, email, company..."
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
            <option value="all">All clients</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </div>

      {/* Client List Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-blue-500" />
        </div>
      ) : clients.length === 0 ? (
        <ContextualEmptyState
          icon={<Users className="h-6 w-6" />}
          title="Start with a client relationship"
          description="Clients connect projects, invoices, and relationship history."
          why="This is the context Rive reuses across the rest of your workspace."
          next="Add one client you are actively working with."
          after="Your projects and invoices can reuse these details."
          action={<Button variant="secondary" size="sm" onClick={openCreate}>Add client</Button>}
        />
      ) : (<>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <div key={c.id} className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-card transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-lg">

              {/* Dropdown Actions */}
              <div className="absolute top-4 right-4 z-10">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (openDropdownId === c.id) {
                      setOpenDropdownId(null);
                    } else {
                      setDropdownRect(e.currentTarget.getBoundingClientRect());
                      setOpenDropdownId(c.id);
                    }
                  }}
                  aria-label={`Actions for ${c.name}`}
                  title={`Actions for ${c.name}`}
                  variant="ghost"
                  size="icon-sm"
                  className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {openDropdownId === c.id && (
                  <DropdownPortal triggerRect={dropdownRect} onClose={() => setOpenDropdownId(null)}>
                    <div className="w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-50 py-1 animate-fade-in-up">
                      <Button
                        onClick={(e) => { e.stopPropagation(); openEdit(c); setOpenDropdownId(null); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleDelete(c.id, c.name); setOpenDropdownId(null); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </DropdownPortal>
                )}
              </div>

              <div>
                <div className="flex justify-between items-start gap-4 mb-4 pr-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm uppercase shadow-sm group-hover:scale-105 transition-all"
                      style={{ backgroundColor: c.avatar_color }}
                    >
                      {c.name.substring(0, 2)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <Link href={`/workflow/clients/${c.id}`} className="text-sm font-bold text-foreground dark:text-slate-200 truncate hover:text-primary dark:hover:text-blue-400 hover:underline">{c.name}</Link>
                      <span className="truncate text-xs text-muted-foreground">{c.company || "Private client"}</span>
                    </div>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold capitalize ${
                    c.status === "active" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-800 text-muted-foreground dark:text-slate-400 border-border dark:border-slate-700"
                  }`}>
                    {c.status}
                  </span>
                </div>

                {/* Tags */}
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {c.tags.map((t, idx) => (
                      <span key={idx} className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
                        <Tag className="h-2 w-2" />
                        <span>{t}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Details list */}
                <div className="flex flex-col gap-2 border-t border-border dark:border-slate-800 pt-4 mb-4">
                  {c.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-slate-400">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-slate-400">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.website && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-slate-400">
                      <Globe className="h-3.5 w-3.5" />
                      <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-primary dark:hover:text-blue-400 truncate">
                        {c.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Aggregations */}
              <div className="flex justify-between items-center border-t border-border dark:border-slate-800 pt-4 text-xs font-semibold">
                <span className="flex items-center gap-1 text-muted-foreground dark:text-slate-400">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{c.project_count} projects</span>
                </span>
                <span className="flex items-center gap-1 text-[#10B981] dark:text-emerald-400">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>{formatClientRevenue(c)} paid</span>
                </span>
              </div>
            </div>
          ))}
        </div>
        {pagination ? <PaginationControls pagination={pagination} loading={loading} label="clients" onPageChange={setPage} /> : null}
      </>)}

      {/* Right Slideout Modal Drawer for adding/editing a Client */}
      {drawerOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col justify-between py-6 px-6 shadow-2xl border-l border-border dark:border-slate-800 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground dark:text-slate-200">{editingId ? "Edit client profile" : "Create new client"}</h3>
                    <p className="text-xs text-muted-foreground dark:text-slate-400">{editingId ? "Update client details and information." : "Set up direct client details for project coordination."}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close client editor"
                    title="Close client editor"
                    className="text-muted-foreground dark:text-slate-400 hover:bg-background dark:hover:bg-slate-800"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <form onSubmit={handleSave} className="flex flex-col gap-4 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Client name *</label>
                    <Input
                      type="text"
                      required
                      placeholder="E.g. acme corp, jane smith"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Company name</label>
                    <Input
                      type="text"
                      placeholder="E.g. acme industries"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Email</label>
                      <Input
                        type="email"
                        placeholder="client@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Phone</label>
                      <Input
                        type="text"
                        placeholder="+1 (555) 000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Website</label>
                    <Input
                      type="text"
                      placeholder="Www.clientwebsite.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Address</label>
                    <Textarea
                      rows={2}
                      placeholder="Billing or office address..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400 resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Tags (comma separated)</label>
                    <Input
                      type="text"
                      placeholder="Vip, monthly, design"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      className="px-3 py-2 border border-border dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-foreground dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Private notes</label>
                    <Textarea
                      rows={3}
                      placeholder="Private client instructions, milestones..."
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
                  <span>{editingId ? "Update client" : "Save client"}</span>
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
