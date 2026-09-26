"use client";

import { AnchoredMenu, AnchoredMenuItem, AnchoredMenuSelect, Badge, Button, ContextualEmptyState, Input, PageHeader, PaginationControls, Textarea, useConfirm } from "@/components/ui";
import { statusTone } from "@/lib/status-tone";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Globe,
  X,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import Portal from "@/components/ui/Portal";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import type { PaginationMeta } from "@/lib/pagination";
import { useFeatureAvailability } from "@/components/FeatureAvailabilityContext";

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

const CLIENT_STATUS_OPTIONS = [
  { value: "all", label: "All clients" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

export default function ClientsPage() {
  const router = useRouter();
  const { engagementFlow } = useFeatureAvailability();
  const { displayCurrency, convert, format } = useCurrency();
  const [confirm, confirmDialog] = useConfirm();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  // Drawer & Form state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [saving, setSaving] = useState(false);

  const loadClients = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workflow/clients?search=${encodeURIComponent(debouncedSearch)}&status=${status}&page=${page}&pageSize=${pageSize}`, { signal });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setClients(data.clients);
          // buildPagination clamps an out-of-range page server-side. Without
          // adopting that clamp the local page counter drifts, and the Next
          // button then re-requests a page the list is already showing.
          setPagination(data.pagination || null);
          if (data.pagination && data.pagination.page !== page) setPage(data.pagination.page);
        }
      }
    } catch (err) {
      if (signal?.aborted) return;
      console.error("Error loading clients:", err);
      toast.error("Failed to load clients");
    } finally {
      // A superseded request must not clear the spinner the live one is using.
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedSearch, status]);

  useEffect(() => {
    // Changing a filter also resets the page, so two loads are queued in the
    // same commit. Aborting the superseded one keeps a slow first response
    // from overwriting the newer page's rows.
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadClients(controller.signal);
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, status, page, pageSize]);

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
    if (!(await confirm({ title: `Delete ${clientName}?`, description: "This can't be undone.", confirmLabel: "Delete client", destructive: true }))) {
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
    <div className="workspace-page relative min-h-[calc(100vh-8rem)] animate-panel-in">
      <PageHeader
        title="Clients"
        description="Keep contact details, projects, invoices, and relationship history together."
        actions={<div className="flex flex-wrap items-center gap-2">{engagementFlow ? <Button variant="secondary" onClick={() => router.push("/workflow/start-engagement")}><Plus /> New client work</Button> : null}<Button data-guide-target="clients-create" onClick={openCreate}><Plus /> Add client</Button></div>}
      />

      {/* Filter bar */}
      <div className="workspace-toolbar">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex w-full items-center justify-end sm:w-auto">
          <AnchoredMenuSelect label="Status" value={status} options={CLIENT_STATUS_OPTIONS} onChange={setStatus} className="min-w-[11rem]" />
        </div>
      </div>

      {/* Client List Grid */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : clients.length === 0 ? (
        <ContextualEmptyState
          icon={<Users className="h-6 w-6" />}
          title="Start with a client relationship"
          description="Clients connect projects, invoices, and relationship history."
          why="This is the context Rive reuses across the rest of your workspace."
          next="Add one client you are actively working with."
          after="Your projects and invoices can reuse these details."
          action={engagementFlow ? <Link href="/workflow/start-engagement" className="inline-flex items-center rounded-none bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">New client work</Link> : <Button variant="secondary" size="sm" onClick={openCreate}>Add client</Button>}
        />
      ) : (<>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <div key={c.id} className="group relative flex flex-col justify-between rounded-none border border-border bg-card p-5 transition-[border-color] hover:border-primary/25">

              {/* Dropdown Actions */}
              <div className="absolute top-4 right-4 z-10">
                <AnchoredMenu
                  open={openDropdownId === c.id}
                  onOpenChange={(open) => setOpenDropdownId(open ? c.id : null)}
                  aria-label={`Actions for ${c.name}`}
                  trigger={
                    <Button
                      aria-label={`Actions for ${c.name}`}
                      title={`Actions for ${c.name}`}
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground hover:bg-foreground/[.05]"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  }
                >
                  <AnchoredMenuItem onClick={(e) => { e.stopPropagation(); openEdit(c); setOpenDropdownId(null); }}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </AnchoredMenuItem>
                  <AnchoredMenuItem
                    className="text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(c.id, c.name); setOpenDropdownId(null); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </AnchoredMenuItem>
                </AnchoredMenu>
              </div>

              <div>
                <div className="flex justify-between items-start gap-4 mb-4 pr-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-primary-foreground font-extrabold text-sm uppercase group-hover:scale-105 transition-all"
                      style={{ backgroundColor: c.avatar_color }}
                    >
                      {c.name.substring(0, 2)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <Link href={`/workflow/clients/${c.id}`} className="text-sm font-bold text-foreground truncate hover:text-primary hover:underline">{c.name}</Link>
                      <span className="truncate text-xs text-muted-foreground">{c.company || "Private client"}</span>
                    </div>
                  </div>
                  <Badge variant={statusTone("client", c.status)} dot className="uppercase">
                    {c.status}
                  </Badge>
                </div>

                {/* Tags */}
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {c.tags.map((t, idx) => (
                      <span key={idx} className="rounded-none border border-border bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">{t}</span>
                    ))}
                  </div>
                )}

                {/* Details list */}
                <div className="flex flex-col gap-2 border-t border-border pt-4 mb-4">
                  {c.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{c.phone}</span>
                    </div>
                  )}
                  {c.website && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Globe className="h-3.5 w-3.5" />
                      <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-primary truncate">
                        {c.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Aggregations */}
              <div className="flex justify-between items-center border-t border-border pt-4 text-xs font-semibold">
                <span className="text-muted-foreground">{c.project_count} projects</span>
                <span className="font-mono tabular-nums text-success">
                  {formatClientRevenue(c)} paid
                </span>
              </div>
            </div>
          ))}
        </div>
        {pagination ? <PaginationControls pagination={pagination} loading={loading} label="clients" onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} /> : null}
      </>)}

      {/* Right Slideout Modal Drawer for adding/editing a Client */}
      {drawerOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex justify-end bg-foreground/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)}>
            <div className="relative w-full max-w-md bg-card h-full flex flex-col justify-between py-6 px-6 shadow-overlay border-l border-border animate-panel-in" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{editingId ? "Edit client profile" : "Create new client"}</h3>
                    <p className="text-xs text-muted-foreground">{editingId ? "Update client details and information." : "Set up direct client details for project coordination."}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close client editor"
                    title="Close client editor"
                    className="text-muted-foreground hover:bg-background"
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
                      className="px-3 py-2 border border-border bg-card rounded-none text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Company name</label>
                    <Input
                      type="text"
                      placeholder="E.g. acme industries"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="px-3 py-2 border border-border bg-card rounded-none text-xs text-foreground focus:outline-none focus:border-primary"
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
                        className="px-3 py-2 border border-border bg-card rounded-none text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-foreground">Phone</label>
                      <Input
                        type="text"
                        placeholder="+1 (555) 000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="px-3 py-2 border border-border bg-card rounded-none text-xs text-foreground focus:outline-none focus:border-primary"
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
                      className="px-3 py-2 border border-border bg-card rounded-none text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Address</label>
                    <Textarea
                      rows={2}
                      placeholder="Billing or office address..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="px-3 py-2 border border-border bg-card rounded-none text-xs text-foreground focus:outline-none focus:border-primary resize-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Tags (comma separated)</label>
                    <Input
                      type="text"
                      placeholder="Vip, monthly, design"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      className="px-3 py-2 border border-border bg-card rounded-none text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-foreground">Private notes</label>
                    <Textarea
                      rows={3}
                      placeholder="Private client instructions, milestones..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="px-3 py-2 border border-border bg-card rounded-none text-xs text-foreground focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                </form>
              </div>

              <div className="flex items-center gap-2 border-t border-border pt-4 mt-6">
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
      {confirmDialog}
    </div>
  );
}
