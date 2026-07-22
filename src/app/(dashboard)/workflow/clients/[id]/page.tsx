"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { 
  ArrowLeft,
  Mail,
  Phone,
  Globe,
  Briefcase,
  DollarSign,
  Tag,
  Loader2,
  Calendar,
  FileText
} from "lucide-react";
import { toast } from "sonner";

export default function ClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [client, setClient] = useState<any>(null);
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
      } catch (err) {
        toast.error("Failed to load client profile");
      } finally {
        setLoading(false);
      }
    }
    loadClient();
  }, [id]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#1D4ED8]" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h2 className="text-xl font-bold text-[#0C1E36] dark:text-white">Client not found</h2>
        <Link href="/workflow/clients" className="text-blue-600 mt-2 hover:underline">Return to directory</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-12">
      {/* Header Breadcrumbs */}
      <div>
        <Link href="/workflow/clients" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A5E78] hover:text-[#1D4ED8] mb-4 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          back to directory
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div 
              className="h-16 w-16 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl uppercase shadow-sm"
              style={{ backgroundColor: client.avatarColor }}
            >
              {client.name.substring(0, 2)}
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#0C1E36] dark:text-white">{client.name}</h1>
              <p className="text-sm text-[#4A5E78] dark:text-slate-400 font-medium">{client.company || "Private Client"} • Added {formatDate(client.createdAt)}</p>
            </div>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border uppercase ${
            client.status === "active" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50" : "bg-slate-50 dark:bg-slate-800 text-[#4A5E78] dark:text-slate-400 border-[#E2EAF4] dark:border-slate-700"
          }`}>
            {client.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Client Meta */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Contact Card */}
          <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-[#E2EAF4] dark:border-slate-700">
            <h3 className="text-sm font-bold text-[#0C1E36] dark:text-white mb-4">Contact Details</h3>
            <div className="flex flex-col gap-3 text-sm text-[#4A5E78] dark:text-slate-400">
              {client.email && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Mail className="h-4 w-4" /></div>
                  <a href={`mailto:${client.email}`} className="hover:text-blue-600 truncate">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Phone className="h-4 w-4" /></div>
                  <span>{client.phone}</span>
                </div>
              )}
              {client.website && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Globe className="h-4 w-4" /></div>
                  <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 truncate">
                    {client.website}
                  </a>
                </div>
              )}
              {!client.email && !client.phone && !client.website && (
                <span className="text-xs text-slate-400 italic">No contact details provided.</span>
              )}
            </div>

            {client.tags && client.tags.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[#E2EAF4] dark:border-slate-700">
                <h3 className="text-xs font-bold text-[#0C1E36] dark:text-white mb-3 uppercase tracking-wider">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {client.tags.map((t: string, idx: number) => (
                    <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-700 text-[#4A5E78] dark:text-slate-400 border border-[#E2EAF4] dark:border-slate-600 flex items-center gap-1">
                      <Tag className="h-2.5 w-2.5" />
                      <span>{t}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* LTV & Stats */}
          <div className="glass bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl border border-blue-800 text-white shadow-lg">
            <h3 className="text-xs font-bold text-blue-100 mb-1 uppercase tracking-wider">Lifetime Value (LTV)</h3>
            <div className="text-3xl font-extrabold mb-6 tracking-tight">{formatCurrency(client.ltv)}</div>
            
            <div className="grid grid-cols-2 gap-4 border-t border-blue-500/30 pt-4">
              <div>
                <div className="text-xs text-blue-200 mb-0.5 font-medium">Projects</div>
                <div className="text-xl font-bold">{client.projects.length}</div>
              </div>
              <div>
                <div className="text-xs text-blue-200 mb-0.5 font-medium">Invoices</div>
                <div className="text-xl font-bold">{client.invoices.length}</div>
              </div>
            </div>
          </div>
          
          {/* Notes */}
          {client.notes && (
            <div className="glass bg-amber-50/50 p-6 rounded-2xl border border-amber-200">
              <h3 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Private Notes
              </h3>
              <p className="text-sm text-amber-800 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column: Projects & Invoices */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          
          {/* Active Projects */}
          <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-[#E2EAF4] dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#0C1E36] dark:text-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" /> Linked Projects
              </h3>
              <Link href="/workflow/projects" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-3 py-1.5 rounded-lg transition-colors">
                View all
              </Link>
            </div>

            {client.projects.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#E2EAF4] dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-[#4A5E78] dark:text-slate-500">
                No projects linked to this client yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {client.projects.map((proj: any) => (
                  <Link key={proj.id} href={`/workflow/projects`} className="flex items-center justify-between p-4 rounded-xl border border-[#E2EAF4] dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all group bg-white dark:bg-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-slate-50 dark:bg-slate-700 border border-[#E2EAF4] dark:border-slate-600 rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 transition-colors">
                        <Briefcase className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#0C1E36] dark:text-white">{proj.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-[#4A5E78] dark:text-slate-500">
                          <Calendar className="h-3 w-3" />
                          <span>Due {formatDate(proj.dueDate)}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                      proj.status === "completed" ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/60" :
                      proj.status === "in_progress" ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/60" :
                      "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/60"
                    }`}>
                      {proj.status.replace("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Recent Invoices */}
          <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-[#E2EAF4] dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#0C1E36] dark:text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" /> Billing History
              </h3>
              <Link href="/workflow/revenue" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-3 py-1.5 rounded-lg transition-colors">
                View all
              </Link>
            </div>

            {client.invoices.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#E2EAF4] dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-[#4A5E78] dark:text-slate-500">
                No invoices issued to this client yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E2EAF4] text-xs font-bold text-[#4A5E78] uppercase tracking-wider">
                      <th className="pb-3 pr-4">Invoice</th>
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Amount</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.invoices.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-[#E2EAF4] hover:bg-[#F5F8FC] transition-colors">
                        <td className="py-3 pr-4 text-sm font-semibold text-[#0C1E36] dark:text-slate-200">{inv.number}</td>
                        <td className="py-3 pr-4 text-xs text-[#4A5E78]">{formatDate(inv.issueDate)}</td>
                        <td className="py-3 pr-4 text-sm font-bold text-[#0C1E36] dark:text-slate-200">{formatCurrency(Number(inv.total))}</td>
                        <td className="py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                            inv.status === "paid" ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/60" :
                            inv.status === "overdue" ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900/60" :
                            "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/60"
                          }`}>
                            {inv.status}
                          </span>
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
