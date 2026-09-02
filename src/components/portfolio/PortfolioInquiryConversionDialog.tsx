"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Check, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Select } from "@/components/ui";
import type { PortfolioInquiryDetail } from "@/utils/portfolioInquiries";

type ClientOption = { id: string; name: string; email: string | null };

type Props = {
  inquiry: PortfolioInquiryDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: () => void | Promise<void>;
};

export default function PortfolioInquiryConversionDialog({ inquiry, open, onOpenChange, onConverted }: Props) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [clientMode, setClientMode] = useState<"existing" | "new">("new");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState(inquiry.name);
  const [clientEmail, setClientEmail] = useState(inquiry.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/workflow/clients?mode=options&pageSize=100", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled && data?.success && Array.isArray(data.clients)) setClients(data.clients as ClientOption[]);
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setClientsLoaded(true); });
    return () => { cancelled = true; };
  }, [open]);

  const matchingClient = useMemo(
    () => clients.find((client) => client.email?.toLowerCase() === inquiry.email.toLowerCase()) || null,
    [clients, inquiry.email],
  );

  const submit = async () => {
    if (busy) return;
    if (clientMode === "existing" && !clientId) {
      setError("Choose the existing client you want to connect.");
      return;
    }
    if (clientMode === "new" && !clientName.trim()) {
      setError("Client name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portfolio/inquiries/${encodeURIComponent(inquiry.id)}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: clientMode === "existing"
            ? { mode: "existing", id: clientId }
            : { mode: "new", name: clientName, email: clientEmail },
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.message || "The enquiry could not be converted.");
      toast.success(data.replayed ? "This enquiry was already converted." : "Client and follow-up Task created.");
      onOpenChange(false);
      await onConverted();
      router.push(data.nextAction.href);
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "The enquiry could not be converted.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!busy) onOpenChange(nextOpen); }}>
      <DialogContent className="max-w-2xl">
        <div className="flex flex-col gap-5">
          <div className="pr-8">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div>
            <DialogTitle className="text-xl font-extrabold">Turn this enquiry into work</DialogTitle>
            <DialogDescription className="mt-1.5 leading-6">Choose exactly which Client should own this relationship. Rive will create one unscheduled follow-up Task, then open Start Engagement for the Project, milestone, and optional Agreement or invoice.</DialogDescription>
          </div>

          <div className="rounded-2xl border border-border bg-muted/35 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Visitor message · read-only</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{inquiry.message}</p>
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-black"><UserRound className="h-4 w-4 text-primary" /> Client</div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1" role="group" aria-label="Client choice">
              <Button type="button" variant={clientMode === "new" ? "default" : "ghost"} onClick={() => setClientMode("new")}><UserRound className="h-3.5 w-3.5" /> New client</Button>
              <Button type="button" variant={clientMode === "existing" ? "default" : "ghost"} onClick={() => setClientMode("existing")}><Check className="h-3.5 w-3.5" /> Existing client</Button>
            </div>
            {clientMode === "existing" ? (
              <label className="block text-sm font-bold">Choose a saved client
                  <Select className="mt-2" value={clientId} onChange={(event) => setClientId(event.target.value)} disabled={!clientsLoaded}>
                  <option value="">Select a client</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.email ? ` · ${client.email}` : ""}</option>)}
                </Select>
              </label>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">Client name<Input className="mt-2" value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={160} /></label>
                <label className="text-sm font-bold">Client email<Input className="mt-2" type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} maxLength={320} /></label>
              </div>
            )}
            {matchingClient && clientMode === "new" ? <p className="text-xs leading-5 text-muted-foreground">A saved client has this email. Rive will not choose it automatically; select Existing client if that is the same relationship.</p> : null}
          </section>

          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" disabled={busy} onClick={() => void submit()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BriefcaseBusiness className="h-4 w-4" />} Create Client &amp; follow-up Task</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
