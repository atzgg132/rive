"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Plus, Settings2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Input, Kicker, Select, Textarea } from "@/components/ui";
import { formatMoney } from "@/lib/currency";
import { addDaysToIsoDate } from "@/lib/settingsDomain";

/** A YYYY-MM-DD input value in the same short style as the invoice list and panel. */
function previewDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type LineItem = { description: string; quantity: string; unitPrice: string };
type Client = { id: string; name: string; email?: string | null };
type Project = { id: string; title: string; client_id: string | null; currency: string };

function money(value: number, currency: string): string {
  return formatMoney(Number.isFinite(value) ? value : 0, currency);
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState("0");
  const [discountRate, setDiscountRate] = useState("0");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: "1", unitPrice: "0" }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createdFromEngagement, setCreatedFromEngagement] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    const requestedId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("invoiceId") : null;
    const isEngagementHandoff = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("from") === "engagement";
    void Promise.all([
      fetch("/api/workflow/clients?mode=options&pageSize=100", { cache: "no-store" }),
      fetch("/api/workflow/projects?mode=options&pageSize=100", { cache: "no-store" }),
      requestedId ? fetch(`/api/workflow/invoices?id=${encodeURIComponent(requestedId)}`, { cache: "no-store" }) : Promise.resolve(null),
      fetch("/api/settings", { cache: "no-store" }),
    ]).then(async ([clientResponse, projectResponse, invoiceResponse, settingsResponse]) => {
      const clientData = await clientResponse.json().catch(() => null);
      const projectData = await projectResponse.json().catch(() => null);
      const settingsData = await settingsResponse.json().catch(() => null);
      if (cancelled) return;
      setCreatedFromEngagement(isEngagementHandoff);
      if (clientData?.success) setClients(clientData.clients || []);
      if (projectData?.success) setProjects(projectData.projects || []);
      const workspaceCurrency = /^[A-Z]{3}$/.test(settingsData?.user?.currency || "") ? settingsData.user.currency : "USD";
      if (settingsData?.success) {
        setBusinessName(settingsData.invoiceProfile?.businessName || "");
        setLogoUrl(settingsData.invoiceProfile?.logoUrl || "");
      }
      if (requestedId && invoiceResponse) {
        const invoiceData = await invoiceResponse.json().catch(() => null);
        const invoice = invoiceData?.invoices?.find((item: { id: string }) => item.id === requestedId);
        if (!invoice) throw new Error("That draft is unavailable or no longer belongs to this workspace.");
        setEditingId(invoice.id);
        setInvoiceNumber(invoice.invoice_number || "");
        setClientId(invoice.client_id || "");
        setProjectId(invoice.project_id || "");
        setCurrency(invoice.currency || "USD");
        setTaxRate(invoice.tax_rate || "0");
        setDiscountRate(invoice.discount_rate || "0");
        setIssueDate(invoice.issue_date ? new Date(invoice.issue_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
        setDueDate(invoice.due_date ? new Date(invoice.due_date).toISOString().slice(0, 10) : "");
        setNotes(invoice.notes || "");
        setItems((invoice.items || []).map((item: { description: string; quantity: string; unit_price: string }) => ({ description: item.description, quantity: item.quantity, unitPrice: item.unit_price })));
      } else {
        // A new invoice: no project chosen yet, so the workspace default
        // currency applies. Picking a project below still overrides this.
        setCurrency(workspaceCurrency);
        const defaultTermsDays = settingsData?.invoiceProfile?.defaultPaymentTermsDays;
        if (typeof defaultTermsDays === "number") {
          const todayIso = new Date().toISOString().slice(0, 10);
          const prefilledDueDate = addDaysToIsoDate(todayIso, defaultTermsDays);
          if (prefilledDueDate) setDueDate(prefilledDueDate);
        }
      }
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Invoice data could not be loaded.")).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const selectedClient = clients.find((client) => client.id === clientId);
  const selectedProject = projects.find((project) => project.id === projectId);
  const preview = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    const discount = subtotal * ((Number(discountRate) || 0) / 100);
    const taxable = Math.max(subtotal - discount, 0);
    const tax = taxable * ((Number(taxRate) || 0) / 100);
    return { subtotal, discount, taxable, tax, total: taxable + tax };
  }, [discountRate, items, taxRate]);

  const updateItem = (index: number, key: keyof LineItem, value: string) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!items.some((item) => item.description.trim() && Number(item.quantity) > 0 && Number(item.unitPrice) >= 0)) { toast.error("Add at least one valid line item."); return; }
    setSaving(true);
    try {
      const response = await fetch("/api/workflow/invoices", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId || undefined, client_id: clientId || null, project_id: projectId || null, currency, invoice_number: editingId ? invoiceNumber : undefined, tax_rate: taxRate, discount_rate: discountRate, issue_date: issueDate || null, due_date: dueDate || null, notes, items: items.map((item) => ({ description: item.description, quantity: item.quantity, unit_price: item.unitPrice })) }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "Invoice could not be saved.");
      toast.success(editingId ? "Draft updated." : `${data.invoice?.invoiceNumber || "Invoice"} saved as a draft.`);
      router.push("/workflow/revenue");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Invoice could not be saved."); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">Loading invoice workspace…</div>;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      {createdFromEngagement && <div className="rounded-none border border-success/25 bg-success/10 p-4 text-sm text-success"><p className="font-bold">Your engagement is connected and this invoice is still a private draft.</p><p className="mt-1 text-xs">Review the details below. Nothing is sent until you choose to send it.</p></div>}
      <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/workflow/revenue" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Revenue & invoices</Link><h1 className="mt-3 text-3xl font-bold tracking-tight">{editingId ? "Review draft invoice" : "Create a polished invoice"}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Build the draft on the left, then check the client-facing document on the right before sending it.</p></div><Link href="/settings#invoicing"><Button variant="outline" size="sm" className="gap-2"><Settings2 className="h-4 w-4" /> Invoice settings</Button></Link></div>
      <form onSubmit={submit} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
        <section data-guide-target="invoice-details" className="space-y-5">
          <div className="rounded-none border border-border bg-card p-5"><div className="mb-5"><h2 className="font-semibold">Invoice details</h2><p className="text-xs text-muted-foreground">Server totals, numbering, and sent snapshots are authoritative.</p></div><div className="grid gap-4 sm:grid-cols-2">{editingId ? <label className="text-xs font-semibold text-muted-foreground">Invoice number<Input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} className="mt-2 font-mono tabular-nums" /></label> : null}<label className="text-xs font-semibold text-muted-foreground">Client<Select value={clientId} onChange={(event) => { setClientId(event.target.value); setProjectId(""); }} className="mt-2"><option value="">Select a client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</Select></label><label className="text-xs font-semibold text-muted-foreground">Project <span className="font-normal">(optional)</span><Select value={projectId} onChange={(event) => { setProjectId(event.target.value); const project = projects.find((item) => item.id === event.target.value); if (project) setCurrency(project.currency); }} className="mt-2"><option value="">No project linked</option>{projects.filter((project) => !clientId || project.client_id === clientId).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}</Select></label><label className="text-xs font-semibold text-muted-foreground">Issue date<Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className="mt-2" /></label><label className="text-xs font-semibold text-muted-foreground">Due date <span className="font-normal">(optional)</span><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-2" /></label><label className="text-xs font-semibold text-muted-foreground">Currency<Input value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))} className="mt-2 uppercase" /></label></div></div>
          <div className="rounded-none border border-border bg-card p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold">Line items</h2><p className="text-xs text-muted-foreground">Use outcome-led descriptions clients can understand.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => [...current, { description: "", quantity: "1", unitPrice: "0" }])} className="gap-2"><Plus className="h-4 w-4" /> Add item</Button></div><div className="space-y-3">{items.map((item, index) => <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_125px_36px]"><Input value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder="e.g. Product strategy sprint" aria-label={`Line item ${index + 1} description`} /><Input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} aria-label={`Line item ${index + 1} quantity`} /><Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} aria-label={`Line item ${index + 1} rate`} /><Button type="button" variant="ghost" size="icon" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove line item"><Trash2 className="h-4 w-4 text-muted-foreground" /></Button></div>)}</div></div>
          <div className="grid gap-5 md:grid-cols-2"><div className="rounded-none border border-border bg-card p-5"><h2 className="font-semibold">Tax, discount & terms</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-muted-foreground">Discount (%)<Input type="number" min="0" max="100" step="0.01" value={discountRate} onChange={(event) => setDiscountRate(event.target.value)} className="mt-2" /></label><label className="text-xs font-semibold text-muted-foreground">Tax rate (%)<Input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} className="mt-2" /></label></div><label className="mt-4 block text-xs font-semibold text-muted-foreground">Client note<Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Payment instructions, context, or a thank-you note" className="mt-2 resize-none" /></label></div><div className="rounded-none border border-primary/15 bg-primary/[0.04] p-5"><Kicker>Draft safeguards</Kicker><ul className="mt-4 space-y-3 text-sm text-muted-foreground"><li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />Number is assigned atomically on save.</li><li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />Discount is applied before tax.</li><li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />Sending freezes the client-facing snapshot.</li></ul></div></div>
          <div className="flex justify-end gap-3"><Link href="/workflow/revenue"><Button type="button" variant="outline">Cancel</Button></Link><Button type="submit" disabled={saving}>{saving ? "Saving draft…" : editingId ? "Save reviewed draft" : "Save draft"}</Button></div>
        </section>
        <aside className="sticky top-24 rounded-none border border-border bg-card p-5"><div className="mb-5 flex items-center justify-between"><div><Kicker>Live preview</Kicker><h2 className="mt-1 text-lg font-bold">INVOICE</h2></div><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">DRAFT</span></div><div className="rounded-none inverse-block p-4"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-2">{logoUrl ? <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : null}<p className="text-lg font-bold tracking-tight">{businessName || "Your business name"}</p></div><div className="text-right"><p className="text-xs text-background/70">Invoice number</p><p className="mt-1 font-mono text-sm tabular-nums">{invoiceNumber || "Assigned on save"}</p></div></div></div><div className="mt-5 flex justify-between gap-4 text-sm"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill to</p><p className="mt-1 font-semibold">{selectedClient?.name || "Select a client"}</p><p className="text-xs text-muted-foreground">{selectedClient?.email || "Client email appears here"}</p></div><div className="text-right"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due</p><p className="mt-1 font-mono font-semibold tabular-nums">{dueDate ? previewDate(dueDate) : "On receipt"}</p></div></div>{selectedProject ? <p className="mt-4 rounded-none bg-muted px-3 py-2 text-xs text-muted-foreground">Project · <span className="font-semibold">{selectedProject.title}</span></p> : null}<div className="mt-5 overflow-hidden rounded-none border border-border"><div className="grid grid-cols-[1fr_auto] gap-3 bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><span>Description</span><span>Amount</span></div>{items.filter((item) => item.description.trim()).map((item, index) => <div key={index} className="flex justify-between gap-3 border-t border-border px-3 py-3 text-xs"><span className="min-w-0 truncate">{item.description}</span><span className="font-mono font-semibold tabular-nums">{money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), currency)}</span></div>)}{!items.some((item) => item.description.trim()) ? <p className="px-3 py-6 text-center text-xs text-muted-foreground">Line items will appear here.</p> : null}</div><div className="ml-auto mt-5 max-w-[240px] space-y-2 text-sm"><div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono tabular-nums">{money(preview.subtotal, currency)}</span></div>{preview.discount > 0 ? <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="font-mono tabular-nums">-{money(preview.discount, currency)}</span></div> : null}{preview.tax > 0 ? <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="font-mono tabular-nums">{money(preview.tax, currency)}</span></div> : null}<div className="flex justify-between border-t border-border pt-3 text-base font-bold"><span>Total</span><span className="font-mono tabular-nums">{money(preview.total, currency)}</span></div></div>{notes ? <p className="mt-6 whitespace-pre-line border-t border-border pt-4 text-xs leading-5 text-muted-foreground">{notes}</p> : null}</aside>
      </form>
    </div>
  );
}
