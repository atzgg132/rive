"use client";

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
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
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
    try {
      const res = await fetch(`/api/workflow/clients?search=${encodeURIComponent(search)}&status=${status}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setClients(data.clients);
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
    loadClients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative min-h-[calc(100vh-8rem)]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0C1E36] dark:text-slate-50">clients directory</h1>
          <p className="text-sm text-[#4A5E78] dark:text-slate-400">manage your client relationships, contact profiles, and linked portfolios.</p>
        </div>
        <button 
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1D4ED8] dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500 font-semibold text-xs transition-all shadow-[0_4px_10px_rgba(29,78,216,0.1)] dark:shadow-none self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>add new client</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#E2EAF4] dark:border-slate-800">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78] dark:text-slate-400" />
          <input 
            type="text" 
            placeholder="search by name, email, company..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-[#4A5E78] dark:text-slate-400">filter status:</span>
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-[#E2EAF4] dark:border-slate-700 rounded-lg text-xs font-semibold text-[#0C1E36] dark:text-slate-200 focus:outline-none"
          >
            <option value="all">all clients</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
      </div>

      {/* Client List Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-[#1D4ED8] dark:text-blue-500" />
        </div>
      ) : clients.length === 0 ? (
        <div className="glass p-12 text-center flex flex-col items-center justify-center bg-white/70 dark:bg-slate-900/70 border-dashed dark:border-slate-800">
          <Users className="h-10 w-10 text-slate-400 dark:text-slate-500 mb-3" />
          <h3 className="font-bold text-sm text-[#0C1E36] dark:text-slate-200 mb-1">no clients found</h3>
          <p className="text-xs text-[#4A5E78] dark:text-slate-400 mb-4">create your first client to start linking projects and tracking invoices.</p>
          <button 
            onClick={openCreate}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#EFF6FF] dark:bg-blue-900/30 text-[#1D4ED8] dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 hover:bg-[#E2EAF4] dark:hover:bg-blue-900/50 transition-all"
          >
            add client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((c) => (
            <div key={c.id} className="glass bg-white/95 dark:bg-slate-900/95 p-6 flex flex-col justify-between hover:shadow-md dark:hover:shadow-none hover:border-blue-300 dark:hover:border-blue-700 transition-all group relative border-[#E2EAF4] dark:border-slate-800">
              
              {/* Dropdown Actions */}
              <div className="absolute top-4 right-4 z-10">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (openDropdownId === c.id) {
                      setOpenDropdownId(null);
                    } else {
                      setDropdownRect(e.currentTarget.getBoundingClientRect());
                      setOpenDropdownId(c.id);
                    }
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 transition-all"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                
                {openDropdownId === c.id && (
                  <DropdownPortal triggerRect={dropdownRect} onClose={() => setOpenDropdownId(null)}>
                    <div className="w-36 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-50 py-1 animate-fade-in-up">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEdit(c); setOpenDropdownId(null); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-2 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> edit
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(c.id, c.name); setOpenDropdownId(null); }}
                        className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> delete
                      </button>
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
                      <Link href={`/workflow/clients/${c.id}`} className="text-sm font-bold text-[#0C1E36] dark:text-slate-200 truncate hover:text-[#1D4ED8] dark:hover:text-blue-400 hover:underline">{c.name}</Link>
                      <span className="text-[10px] text-[#4A5E78] dark:text-slate-400 truncate">{c.company || "private client"}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase ${
                    c.status === "active" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-800 text-[#4A5E78] dark:text-slate-400 border-[#E2EAF4] dark:border-slate-700"
                  }`}>
                    {c.status}
                  </span>
                </div>

                {/* Tags */}
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {c.tags.map((t, idx) => (
                      <span key={idx} className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 text-[#4A5E78] dark:text-slate-400 border border-[#E2EAF4] dark:border-slate-700 flex items-center gap-1">
                        <Tag className="h-2 w-2" />
                        <span>{t}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Details list */}
                <div className="flex flex-col gap-2 border-t border-[#E2EAF4] dark:border-slate-800 pt-4 mb-4">
                  {c.email && (
                    <div className="flex items-center gap-2 text-xs text-[#4A5E78] dark:text-slate-400">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2 text-xs text-[#4A5E78] dark:text-slate-400">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.website && (
                    <div className="flex items-center gap-2 text-xs text-[#4A5E78] dark:text-slate-400">
                      <Globe className="h-3.5 w-3.5" />
                      <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-[#1D4ED8] dark:hover:text-blue-400 truncate">
                        {c.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Aggregations */}
              <div className="flex justify-between items-center border-t border-[#E2EAF4] dark:border-slate-800 pt-4 text-xs font-semibold">
                <span className="flex items-center gap-1 text-[#4A5E78] dark:text-slate-400">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{c.project_count} projects</span>
                </span>
                <span className="flex items-center gap-1 text-[#10B981] dark:text-emerald-400">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>{formatCurrency(parseFloat(c.total_revenue))} paid</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Right Slideout Modal Drawer for adding/editing a Client */}
      {drawerOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 h-full flex flex-col justify-between py-6 px-6 shadow-2xl border-l border-[#E2EAF4] dark:border-slate-800 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#0C1E36] dark:text-slate-200">{editingId ? "edit client profile" : "create new client"}</h3>
                    <p className="text-xs text-[#4A5E78] dark:text-slate-400">{editingId ? "update client details and information." : "setup direct client details for project coordination."}</p>
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
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">client name *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. acme corp, jane smith"
                      value={name} 
                      onChange={(e) => setName(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">company name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. acme industries"
                      value={company} 
                      onChange={(e) => setCompany(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">email</label>
                      <input 
                        type="email" 
                        placeholder="client@domain.com"
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                        className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">phone</label>
                      <input 
                        type="text" 
                        placeholder="+1 (555) 000-0000"
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)}
                        className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">website</label>
                    <input 
                      type="text" 
                      placeholder="www.clientwebsite.com"
                      value={website} 
                      onChange={(e) => setWebsite(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">address</label>
                    <textarea 
                      rows={2}
                      placeholder="billing or office address..."
                      value={address} 
                      onChange={(e) => setAddress(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400 resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">tags (comma separated)</label>
                    <input 
                      type="text" 
                      placeholder="vip, monthly, design"
                      value={tagsInput} 
                      onChange={(e) => setTagsInput(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] dark:text-slate-200 uppercase tracking-wider">private notes</label>
                    <textarea 
                      rows={3}
                      placeholder="private client instructions, milestones..."
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-xs text-[#0C1E36] dark:text-slate-200 focus:outline-none focus:border-blue-400 resize-none"
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
                  <span>{editingId ? "update client" : "save client"}</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
