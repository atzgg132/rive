"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { 
  ArrowLeft,
  Calendar,
  DollarSign,
  Tag,
  Loader2,
  FileText,
  Clock,
  CheckCircle,
  Briefcase
} from "lucide-react";
import { toast } from "sonner";

export default function ProjectProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProject() {
      try {
        const res = await fetch(`/api/workflow/projects/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setProject(data.project);
          } else {
            toast.error(data.message);
          }
        }
      } catch (err) {
        toast.error("Failed to load project profile");
      } finally {
        setLoading(false);
      }
    }
    loadProject();
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

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case "planning": return { label: "Planning", classes: "bg-slate-50 dark:bg-slate-800 text-[#4A5E78] dark:text-slate-400 border-[#E2EAF4] dark:border-slate-700" };
      case "in_progress": return { label: "In Progress", classes: "bg-blue-50 text-blue-700 border-blue-100" };
      case "completed": return { label: "Completed", classes: "bg-emerald-50 text-emerald-700 border-emerald-100" };
      case "archived": return { label: "Archived", classes: "bg-red-50 text-red-700 border-red-100" };
      default: return { label: status, classes: "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700" };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#1D4ED8]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h2 className="text-xl font-bold text-[#0C1E36] dark:text-white">Project not found</h2>
        <Link href="/workflow/projects" className="text-blue-600 mt-2 hover:underline">Return to projects</Link>
      </div>
    );
  }

  const s = getStatusDisplay(project.status);

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-12">
      {/* Header Breadcrumbs */}
      <div>
        <Link href="/workflow/projects" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A5E78] hover:text-[#1D4ED8] mb-4 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          back to projects
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#0C1E36] dark:text-white">{project.name}</h1>
            <p className="text-sm text-[#4A5E78] dark:text-slate-400 font-medium flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4" /> Started {formatDate(project.createdAt)}
            </p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border uppercase ${s.classes}`}>
            {s.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Project Meta & Client Info */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          
          {/* Client Info Card */}
          {project.client ? (
            <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-[#E2EAF4] dark:border-slate-700">
              <h3 className="text-xs font-bold text-[#4A5E78] mb-4 uppercase tracking-wider">Client</h3>
              <Link href={`/workflow/clients/${project.client.id}`} className="flex items-center gap-3 group">
                <div 
                  className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg uppercase shadow-sm group-hover:scale-105 transition-transform"
                  style={{ backgroundColor: project.client.avatarColor }}
                >
                  {project.client.name.substring(0, 2)}
                </div>
                <div className="flex flex-col">
              <h4 className="font-bold text-[#0C1E36] dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{project.client.name}</h4>
                  <span className="text-xs text-[#4A5E78] dark:text-slate-400">{project.client.company || "Private Client"}</span>
                </div>
              </Link>
            </div>
          ) : (
            <div className="glass bg-slate-50 dark:bg-slate-800/60 p-6 rounded-2xl border border-dashed border-[#E2EAF4] dark:border-slate-700 flex items-center justify-center text-[#4A5E78] dark:text-slate-400 text-sm">
              No client linked.
            </div>
          )}

          {/* Project Details */}
          <div className="glass bg-gradient-to-br from-[#0C1E36] to-[#1a2f4c] p-6 rounded-2xl border border-[#0C1E36] text-white shadow-lg">
            <h3 className="text-xs font-bold text-slate-300 mb-6 uppercase tracking-wider">Financial Overview</h3>
            
            <div className="flex flex-col gap-5">
              <div>
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Budget</div>
                <div className="text-2xl font-bold text-emerald-400">{project.budget ? formatCurrency(parseFloat(project.budget)) : "Unspecified"}</div>
              </div>
              
              <div className="h-px bg-slate-700/50 w-full" />

              <div>
                <div className="text-xs text-slate-400 mb-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Deadline</div>
                <div className="text-lg font-semibold">{project.dueDate ? formatDate(project.dueDate) : "No deadline"}</div>
              </div>
            </div>
          </div>
          
          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-[#E2EAF4] dark:border-slate-700">
              <h3 className="text-xs font-bold text-[#0C1E36] dark:text-slate-200 mb-3 uppercase tracking-wider">Project Tags</h3>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((t: string, idx: number) => (
                  <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                    <Tag className="h-2.5 w-2.5" />
                    <span>{t}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Description & Billing */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          
          {/* Project Description */}
          <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-[#E2EAF4] dark:border-slate-700">
            <h3 className="text-lg font-bold text-[#0C1E36] dark:text-slate-200 flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-blue-600" /> Project Brief
            </h3>
            {project.description ? (
              <p className="text-sm text-[#4A5E78] dark:text-slate-400 whitespace-pre-wrap leading-relaxed">{project.description}</p>
            ) : (
              <p className="text-sm text-slate-400 italic">No project description provided.</p>
            )}
          </div>

          {/* Linked Invoices */}
          <div className="glass bg-white/95 dark:bg-slate-800/95 p-6 rounded-2xl border border-[#E2EAF4] dark:border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#0C1E36] dark:text-slate-200 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" /> Linked Invoices
              </h3>
              <Link href="/workflow/revenue" className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                View all
              </Link>
            </div>

            {project.invoices && project.invoices.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#E2EAF4] dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm text-[#4A5E78] dark:text-slate-400">
                No invoices issued for this project yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {project.invoices && project.invoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl border border-[#E2EAF4] dark:border-slate-700 hover:border-blue-300 transition-all bg-white dark:bg-slate-800">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-[#0C1E36] dark:text-slate-200">{inv.number}</span>
                      <span className="text-xs text-[#4A5E78] dark:text-slate-400">Issued: {formatDate(inv.issueDate)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-extrabold text-sm text-[#0C1E36] dark:text-slate-200">{formatCurrency(Number(inv.total))}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                        inv.status === "paid" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        inv.status === "overdue" ? "bg-red-50 text-red-700 border-red-100" :
                        "bg-amber-50 text-amber-700 border-amber-100"
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
