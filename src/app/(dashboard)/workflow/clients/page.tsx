"use client";

import React, { useState, useEffect } from "react";
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
  Tag
} from "lucide-react";

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
  
  // Create client form state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [search, status]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || saving) return;

    setSaving(true);
    setError("");

    try {
      const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
      const res = await fetch("/api/workflow/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, company, website, address, notes, tags }),
      });

      const data = await res.json();
      if (data.success) {
        setDrawerOpen(false);
        // Reset inputs
        setName("");
        setEmail("");
        setPhone("");
        setCompany("");
        setWebsite("");
        setAddress("");
        setNotes("");
        setTagsInput("");
        loadClients();
      } else {
        setError(data.message || "Failed to create client.");
      }
    } catch (err) {
      setError("Network error. Try again.");
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
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0C1E36]">clients directory</h1>
          <p className="text-sm text-[#4A5E78]">manage your client relationships, contact profiles, and linked portfolios.</p>
        </div>
        <button 
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1D4ED8] text-white hover:bg-blue-700 font-semibold text-xs transition-all shadow-[0_4px_10px_rgba(29,78,216,0.1)] self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>add new client</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-xl border border-[#E2EAF4]">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#4A5E78]" />
          <input 
            type="text" 
            placeholder="search by name, email, company..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E2EAF4] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-[#4A5E78]">filter status:</span>
          <select 
            value={status} 
            onChange={(e) => setStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-[#E2EAF4] rounded-lg text-xs font-semibold text-[#0C1E36] focus:outline-none"
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
          <Loader2 className="h-6 w-6 animate-spin text-[#1D4ED8]" />
        </div>
      ) : clients.length === 0 ? (
        <div className="glass p-12 text-center flex flex-col items-center justify-center bg-white/70 border-dashed">
          <Users className="h-10 w-10 text-slate-400 mb-3" />
          <h3 className="font-bold text-sm text-[#0C1E36] mb-1">no clients found</h3>
          <p className="text-xs text-[#4A5E78] mb-4">create your first client to start linking projects and tracking invoices.</p>
          <button 
            onClick={() => setDrawerOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#EFF6FF] text-[#1D4ED8] border border-blue-100 hover:bg-[#E2EAF4] transition-all"
          >
            add client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((c) => (
            <div key={c.id} className="glass bg-white/95 p-6 flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all group">
              <div>
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm uppercase shadow-sm group-hover:scale-105 transition-all"
                      style={{ backgroundColor: c.avatar_color }}
                    >
                      {c.name.substring(0, 2)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <h3 className="text-sm font-bold text-[#0C1E36] truncate">{c.name}</h3>
                      <span className="text-[10px] text-[#4A5E78] truncate">{c.company || "private client"}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase ${
                    c.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-[#4A5E78] border-[#E2EAF4]"
                  }`}>
                    {c.status}
                  </span>
                </div>

                {/* Tags */}
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {c.tags.map((t, idx) => (
                      <span key={idx} className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-50 text-[#4A5E78] border border-[#E2EAF4] flex items-center gap-1">
                        <Tag className="h-2 w-2" />
                        <span>{t}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Details list */}
                <div className="flex flex-col gap-2 border-t border-[#E2EAF4] pt-4 mb-4">
                  {c.email && (
                    <div className="flex items-center gap-2 text-xs text-[#4A5E78]">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2 text-xs text-[#4A5E78]">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.website && (
                    <div className="flex items-center gap-2 text-xs text-[#4A5E78]">
                      <Globe className="h-3.5 w-3.5" />
                      <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-[#1D4ED8] truncate">
                        {c.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Aggregations */}
              <div className="flex justify-between items-center border-t border-[#E2EAF4] pt-4 text-xs font-semibold">
                <span className="flex items-center gap-1 text-[#4A5E78]">
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{c.project_count} projects</span>
                </span>
                <span className="flex items-center gap-1 text-[#10B981]">
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>{formatCurrency(parseFloat(c.total_revenue))} paid</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Right Slideout Modal Drawer for adding a Client */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
          <div className="relative w-full max-w-md bg-white h-full flex flex-col justify-between py-6 px-6 shadow-2xl border-l border-[#E2EAF4] animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#0C1E36]">create new client profile</h3>
                  <p className="text-xs text-[#4A5E78]">setup direct client details for project coordination.</p>
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
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">client name *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. acme corp, jane smith"
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">company name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. acme industries"
                    value={company} 
                    onChange={(e) => setCompany(e.target.value)}
                    className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">email</label>
                    <input 
                      type="email" 
                      placeholder="client@domain.com"
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">phone</label>
                    <input 
                      type="text" 
                      placeholder="+1 (555) 000-0000"
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)}
                      className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">website</label>
                  <input 
                    type="text" 
                    placeholder="www.clientwebsite.com"
                    value={website} 
                    onChange={(e) => setWebsite(e.target.value)}
                    className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">address</label>
                  <textarea 
                    rows={2}
                    placeholder="billing or office address..."
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)}
                    className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">tags (comma separated)</label>
                  <input 
                    type="text" 
                    placeholder="vip, monthly, design"
                    value={tagsInput} 
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="px-3 py-2 border border-[#E2EAF4] rounded-lg text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-[#0C1E36] uppercase tracking-wider">private notes</label>
                  <textarea 
                    rows={3}
                    placeholder="private client instructions, milestones..."
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
                <span>save client</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
