"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Badge, Kicker } from "@/components/ui";
import { statusTone } from "@/lib/status-tone";
import {
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Briefcase,
  Loader2,
  Calendar,
  FileSignature
} from "lucide-react";
import { toast } from "sonner";
import { useCurrency } from "@/components/currency/CurrencyProvider";
import { useFeatureAvailability } from "@/components/FeatureAvailabilityContext";

type ClientProject = { id: string; title: string; dueDate: string | null; status: string };
type ClientInvoice = { id: string; invoiceNumber: string; issueDate: string; total: number | string; currency: string; status: string };
type ClientContract = { id: string; title: string; status: string; currency: string; executedAt: string | null; updatedAt: string; projectId: string | null };
type ClientDetails = { id: string; name: string; company: string | null; avatarColor: string; createdAt: string; status: string; email: string | null; phone: string | null; website: string | null; tags: string[]; ltv: number; paid_revenue_by_currency: Record<string, number>; related_counts: { projects: number; invoices: number; contracts: number }; notes: string | null; projects: ClientProject[]; invoices: ClientInvoice[]; contracts: ClientContract[] };

export default function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { displayCurrency, convert, format, formatConverted } = useCurrency();
  const { agreements } = useFeatureAvailability();
  const { id } = use(params);
  const [client, setClient] = useState<ClientDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClient() {
      try {
        const res = await fetch(`/api/workflow/clients/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setClient(data.client);
          } else {
            toast.error(data.message);
          }
        }
      } catch {
        toast.error("Failed to load client profile");
      } finally {
        setLoading(false);
      }
    }
    loadClient();
  }, [id]);

  const formatCurrency = (val: number, currency: string = displayCurrency) => format(val, currency);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h2 className="text-xl font-bold text-foreground">Client not found</h2>
        <Link href="/workflow/clients" className="text-primary mt-2 hover:underline">Return to directory</Link>
      </div>
    );
  }

  const convertedLtv = Object.entries(client.paid_revenue_by_currency).reduce<number | null>((total, [currency, amount]) => {
    if (total === null) return null;
    const converted = convert(amount, currency);
    return converted === null ? null : total + converted;
  }, 0);

  return (
    <div className="flex flex-col gap-8 animate-panel-in pb-12">
      {/* Header Breadcrumbs */}
      <div>
        <Link href="/workflow/clients" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          back to directory
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="h-16 w-16 rounded-full flex items-center justify-center text-primary-foreground font-extrabold text-2xl uppercase"
              style={{ backgroundColor: client.avatarColor }}
            >
              {client.name.substring(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{client.name}</h1>
              <p className="text-sm text-muted-foreground font-medium">{client.company || "Private Client"} • Added {formatDate(client.createdAt)}</p>
            </div>
          </div>
          <Badge variant={statusTone("client", client.status)} dot className="uppercase">
            {client.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Client Meta */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Contact Card */}
          <div className="bg-card p-6 rounded-none border border-border">
            <h3 className="text-sm font-bold text-foreground mb-4">Contact Details</h3>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              {client.email && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-info/10 rounded-none text-info"><Mail className="h-4 w-4" /></div>
                  <a href={`mailto:${client.email}`} className="hover:text-primary truncate">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-info/10 rounded-none text-info"><Phone className="h-4 w-4" /></div>
                  <span>{client.phone}</span>
                </div>
              )}
              {client.website && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-info/10 rounded-none text-info"><Globe className="h-4 w-4" /></div>
                  <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary truncate">
                    {client.website}
                  </a>
                </div>
              )}
              {!client.email && !client.phone && !client.website && (
                <span className="text-xs text-muted-foreground italic">No contact details provided.</span>
              )}
            </div>

            {client.tags && client.tags.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border">
                <Kicker tone="muted" dot={false} className="mb-3">Tags</Kicker>
                <div className="flex flex-wrap gap-2">
                  {client.tags.map((t: string, idx: number) => (
                    <span key={idx} className="text-xs font-bold px-2 py-0.5 rounded-none bg-muted text-muted-foreground border border-border">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* LTV & Stats */}
          <div className="inverse-block p-6 rounded-none border border-foreground">
            <Kicker dot={false} className="mb-1 text-background/80">Lifetime Value (LTV)</Kicker>
            <div className="text-3xl font-extrabold mb-1 tracking-tight font-mono tabular-nums">{convertedLtv === null ? "Rates unavailable" : formatCurrency(convertedLtv)}</div>
            <p className="mb-6 text-xs font-semibold text-background/80">Paid invoices shown in {displayCurrency}</p>

            <div className="grid grid-cols-3 gap-3 border-t border-background/20 pt-4">
              <div>
                <div className="text-xs text-background/70 mb-0.5 font-medium">Projects</div>
                <div className="text-xl font-bold">{client.related_counts.projects}</div>
              </div>
              <div>
                <div className="text-xs text-background/70 mb-0.5 font-medium">Invoices</div>
                <div className="text-xl font-bold">{client.related_counts.invoices}</div>
              </div>
              {agreements && <div>
                <div className="text-xs text-background/70 mb-0.5 font-medium">Contracts</div>
                <div className="text-xl font-bold">{client.related_counts.contracts}</div>
              </div>}
            </div>
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="bg-warning/[0.08] p-6 rounded-none border border-border">
              <h3 className="text-sm font-bold text-foreground mb-3">Private Notes</h3>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column: Projects & Invoices */}
        <div className="flex flex-col gap-6 lg:col-span-2">

          {/* Active Projects */}
          <div className="bg-card p-6 rounded-none border border-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground">Linked Projects</h3>
              <Link href={`/workflow/projects?clientId=${encodeURIComponent(client.id)}`} className="text-xs font-semibold text-primary hover:bg-accent px-3 py-1.5 rounded-none transition-colors">
                View all
              </Link>
            </div>

            {client.projects.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-none bg-muted/40 text-sm text-muted-foreground">
                No projects linked to this client yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {client.projects.map((proj) => (
                  <Link key={proj.id} href={`/workflow/projects/${proj.id}`} className="flex items-center justify-between p-4 rounded-none border border-border hover:border-primary transition-all group bg-card">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-muted border border-border rounded-none flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-accent transition-colors">
                        <Briefcase className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{proj.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Due {proj.dueDate ? formatDate(proj.dueDate) : "No due date"}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant={statusTone("project", proj.status)} dot className="uppercase">
                      {proj.status.replace("_", " ")}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {agreements && <>
          {/* Linked Contracts */}
          <div className="bg-card p-6 rounded-none border border-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground">Contracts</h3>
              <Link href={`/workflow/contracts?clientId=${encodeURIComponent(client.id)}`} className="text-xs font-semibold text-primary hover:bg-accent px-3 py-1.5 rounded-none transition-colors">
                View all
              </Link>
            </div>
            {client.contracts.length === 0 ? (
              <div className="flex flex-col items-center rounded-none border border-dashed border-border bg-muted/30 px-5 py-8 text-center">
                <FileSignature className="h-7 w-7 text-muted-foreground" />
                <p className="mt-3 text-sm font-bold">No Rive contracts for this client</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Start a standalone agreement or link one of this client’s projects inside the composer.</p>
                <Link href={`/workflow/contracts?new=1&clientId=${encodeURIComponent(client.id)}`} className="mt-4 inline-flex h-9 items-center justify-center rounded-none bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Create contract</Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {client.contracts.map((item) => (
                  <Link key={item.id} href={`/workflow/contracts/${item.id}`} className="flex items-center justify-between gap-4 p-4 rounded-none border border-border hover:border-primary transition-all group bg-card">
                    <div className="min-w-0">
                      <h4 className="truncate font-bold text-sm text-foreground">{item.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">{item.currency} · Updated {formatDate(item.updatedAt)}</p>
                    </div>
                    <Badge variant={statusTone("contract", item.status)} dot className="uppercase">{item.status.replaceAll("_", " ")}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          </>}

          {/* Recent Invoices */}
          <div className="bg-card p-6 rounded-none border border-border">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground">Billing History</h3>
              <Link href={`/workflow/revenue?clientId=${encodeURIComponent(client.id)}`} className="text-xs font-semibold text-primary hover:bg-accent px-3 py-1.5 rounded-none transition-colors">
                View all
              </Link>
            </div>

            {client.invoices.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border rounded-none bg-muted/40 text-sm text-muted-foreground">
                No invoices issued to this client yet.
              </div>
            ) : (
              <div className="table-scroll-region">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <th className="pb-3 pr-4">Invoice</th>
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Amount</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-border hover:bg-background transition-colors">
                        <td className="py-3 pr-4 text-sm font-semibold text-foreground">
                          <Link
                            href={`/workflow/invoices/${inv.id}`}
                            aria-label={`View invoice ${inv.invoiceNumber}`}
                            className="rounded-none font-mono tabular-nums hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                          >
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground font-mono tabular-nums">{formatDate(inv.issueDate)}</td>
                        <td className="py-3 pr-4 text-sm font-bold text-foreground font-mono tabular-nums">
                          <span className="block">{formatConverted(Number(inv.total), inv.currency) || formatCurrency(Number(inv.total), inv.currency)}</span>
                          {inv.currency !== displayCurrency && <span className="block text-xs font-medium text-muted-foreground">Originally {formatCurrency(Number(inv.total), inv.currency)}</span>}
                        </td>
                        <td className="py-3">
                          <Badge variant={statusTone("invoice", inv.status)} dot>
                            {inv.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
