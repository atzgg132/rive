"use client";

import { useState } from "react";
import InvoiceRemindersSettings from "@/components/settings/InvoiceRemindersSettings";
import { toast } from "sonner";
import { Button, Input, Textarea } from "@/components/ui";
import { uploadImage } from "@/utils/clientUploads";

export type InvoiceProfileData = {
  businessName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  logoUrl: string | null;
  invoicePrefix: string;
  paymentInstructions: string | null;
  defaultTerms: string | null;
  defaultPaymentTermsDays: number | null;
};

export function BusinessInvoicingSection({ data }: { data: InvoiceProfileData }) {
  const [form, setForm] = useState({
    businessName: data.businessName || "",
    contactName: data.contactName || "",
    email: data.email || "",
    phone: data.phone || "",
    address: data.address || "",
    taxId: data.taxId || "",
    logoUrl: data.logoUrl || "",
    invoicePrefix: data.invoicePrefix || "INV",
    paymentInstructions: data.paymentInstructions || "",
    defaultTerms: data.defaultTerms || "",
    defaultPaymentTermsDays: data.defaultPaymentTermsDays === null ? "" : String(data.defaultPaymentTermsDays),
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const onPickLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      update("logoUrl", url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logo could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/settings/invoicing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, defaultPaymentTermsDays: form.defaultPaymentTermsDays === "" ? null : Number(form.defaultPaymentTermsDays) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.message || "Business & invoicing settings could not be saved.");
      toast.success("Business & invoicing settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Business & invoicing settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="invoicing" className="scroll-mt-24 rounded-none border border-border bg-card p-5">
      <h2 className="font-semibold">Business & invoicing</h2>
      <p className="mt-1 text-xs text-muted-foreground">These details appear on future invoice snapshots. Existing sent invoices remain immutable.</p>
      <form onSubmit={save} className="mt-5 space-y-5">
        <div className="flex items-center gap-4">
          {form.logoUrl ? <img src={form.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-none border border-border object-contain bg-muted" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-none border border-dashed border-border text-xs text-muted-foreground">Logo</div>}
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-none border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-accent">
              {uploading ? "Uploading…" : "Change logo"}
              <input type="file" accept="image/*" className="hidden" onChange={(event) => void onPickLogo(event)} disabled={uploading} />
            </label>
            {form.logoUrl ? <Button type="button" variant="ghost" size="sm" className="ml-2 text-muted-foreground" onClick={() => update("logoUrl", "")}>Remove</Button> : null}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted-foreground">Business name<Input value={form.businessName} onChange={(e) => update("businessName", e.target.value)} className="mt-2" /></label>
          <label className="text-xs font-semibold text-muted-foreground">Contact name<Input value={form.contactName} onChange={(e) => update("contactName", e.target.value)} className="mt-2" /></label>
          <label className="text-xs font-semibold text-muted-foreground">Invoice email<Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className="mt-2" /></label>
          <label className="text-xs font-semibold text-muted-foreground">Phone<Input value={form.phone} onChange={(e) => update("phone", e.target.value)} className="mt-2" /></label>
          <label className="text-xs font-semibold text-muted-foreground sm:col-span-2">Business address<Textarea rows={3} value={form.address} onChange={(e) => update("address", e.target.value)} className="mt-2 resize-none" /></label>
          <label className="text-xs font-semibold text-muted-foreground">Tax ID / GSTIN<Input value={form.taxId} onChange={(e) => update("taxId", e.target.value)} className="mt-2" /></label>
          <label className="text-xs font-semibold text-muted-foreground">Invoice prefix<Input value={form.invoicePrefix} onChange={(e) => update("invoicePrefix", e.target.value)} maxLength={16} className="mt-2" /></label>
          <label className="text-xs font-semibold text-muted-foreground">Default payment terms (days) <span className="font-normal">(optional)</span><Input type="number" min="0" max="365" value={form.defaultPaymentTermsDays} onChange={(e) => update("defaultPaymentTermsDays", e.target.value)} placeholder="e.g. 15" className="mt-2" /></label>
          <label className="text-xs font-semibold text-muted-foreground sm:col-span-2">Payment instructions<Textarea rows={3} value={form.paymentInstructions} onChange={(e) => update("paymentInstructions", e.target.value)} className="mt-2 resize-none" placeholder="Bank details or payment instructions" /></label>
          <label className="text-xs font-semibold text-muted-foreground sm:col-span-2">Default terms<Textarea rows={3} value={form.defaultTerms} onChange={(e) => update("defaultTerms", e.target.value)} className="mt-2 resize-none" placeholder="Payment due within…" /></label>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || uploading}>{saving ? "Saving…" : "Save business & invoicing"}</Button>
        </div>
      </form>
      {/* Saves on its own, so it sits outside the form's submit. */}
      <div className="mt-6 border-t border-border pt-5">
        <InvoiceRemindersSettings />
      </div>
    </section>
  );
}
