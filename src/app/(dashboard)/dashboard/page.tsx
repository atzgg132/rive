"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  DollarSign, 
  Briefcase, 
  Receipt, 
  ArrowUpRight, 
  Plus, 
  PlusCircle,
  FileText,
  UserPlus,
  ChevronRight,
  TrendingUp,
  Activity
} from "lucide-react";

interface Stats {
  totalPaid: number;
  totalPending: number;
  activeProjects: number;
  totalExpenses: number;
  netEarnings: number;
}

interface TopClient {
  id: string;
  name: string;
  company: string;
  avatar_color: string;
  total_revenue: string;
}

interface RecentActivity {
  type: string;
  title: string;
  created_at: string;
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats>({
    totalPaid: 0,
    totalPending: 0,
    activeProjects: 0,
    totalExpenses: 0,
    netEarnings: 0
  });
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/workflow/dashboard");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setStats(data.stats);
            setTopClients(data.topClients);
            setActivities(data.recentActivity);
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2
    }).format(val);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-pulse text-[#4A5E78]">loading metrics...</div>
      </div>
    );
  }

  const statCards = [
    { title: "revenue collected", value: formatCurrency(stats.totalPaid), sub: `pending: ${formatCurrency(stats.totalPending)}`, icon: DollarSign, color: "text-[#10B981] bg-[#ECFDF5]" },
    { title: "active projects", value: stats.activeProjects, sub: "on track & ongoing", icon: Briefcase, color: "text-[#1D4ED8] bg-[#EFF6FF]" },
    { title: "expenses logged", value: formatCurrency(stats.totalExpenses), sub: "all categorized costs", icon: Receipt, color: "text-[#EF4444] bg-[#FEF2F2]" },
    { title: "net earnings", value: formatCurrency(stats.netEarnings), sub: "revenue minus expenses", icon: TrendingUp, color: "text-[#8B5CF6] bg-[#F5F3FF]" },
  ];

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#0C1E36]">your workspace overview</h1>
          <p className="text-sm text-[#4A5E78]">real-time financial health, projects, and recent activity updates.</p>
        </div>

        {/* Quick action group */}
        <div className="flex items-center gap-2">
          <Link href="/workflow/projects" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-[#E2EAF4] hover:bg-[#F5F8FC] text-[#0C1E36] transition-all">
            <Plus className="h-3.5 w-3.5" />
            <span>new project</span>
          </Link>
          <Link href="/workflow/revenue" className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-[#1D4ED8] text-white hover:bg-blue-700 transition-all shadow-[0_4px_10px_rgba(29,78,216,0.1)]">
            <FileText className="h-3.5 w-3.5" />
            <span>new invoice</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <div key={idx} className="glass p-6 bg-white/90 shadow-[0_4px_20px_-2px_rgba(12,30,54,0.02)]">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-bold text-[#4A5E78] uppercase tracking-wider">{c.title}</span>
                <span className={`p-2 rounded-lg ${c.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <h3 className="text-2xl font-black text-[#0C1E36] mb-1">{c.value}</h3>
              <p className="text-xs text-[#4A5E78]">{c.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Detail grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent activity stream */}
        <div className="lg:col-span-2 glass bg-white/95 p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#1D4ED8]" />
              <h3 className="font-bold text-base text-[#0C1E36]">recent activities</h3>
            </div>
            <span className="text-[10px] bg-[#EFF6FF] text-[#1D4ED8] font-bold px-2 py-0.5 rounded-full border border-blue-100 uppercase">
              live log
            </span>
          </div>

          <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-2">
            {activities.length === 0 ? (
              <div className="text-center py-12 text-[#4A5E78] text-xs">
                no activities logged yet. try adding a client, project, or invoice to get started!
              </div>
            ) : (
              activities.map((a, idx) => {
                let badgeColor = "bg-blue-50 text-[#1D4ED8] border-blue-100";
                if (a.type === "client_added") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                if (a.type === "invoice_created") badgeColor = "bg-amber-50 text-amber-700 border-amber-100";
                if (a.type === "expense_logged") badgeColor = "bg-red-50 text-red-700 border-red-100";

                return (
                  <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border border-[#E2EAF4] hover:border-blue-200 transition-all bg-white">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wide ${badgeColor}`}>
                        {a.type.replace("_", " ")}
                      </span>
                      <span className="text-sm font-semibold text-[#0C1E36]">{a.title}</span>
                    </div>
                    <span className="text-[10px] text-[#4A5E78]">
                      {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Top Clients Ranking */}
        <div className="glass bg-white/95 p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-[#0C1E36]">top clients</h3>
            <Link href="/workflow/clients" className="text-xs text-[#1D4ED8] font-bold hover:underline flex items-center">
              <span>view all</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {topClients.length === 0 ? (
              <div className="text-center py-12 text-[#4A5E78] text-xs">
                no revenue metrics. mark some invoices as paid!
              </div>
            ) : (
              topClients.map((client) => (
                <div key={client.id} className="flex items-center justify-between p-3 rounded-xl border border-[#E2EAF4] bg-white">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs uppercase"
                      style={{ backgroundColor: client.avatar_color }}
                    >
                      {client.name.substring(0, 2)}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#0C1E36]">{client.name}</span>
                      <span className="text-[10px] text-[#4A5E78]">{client.company || "private client"}</span>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-[#10B981]">
                    {formatCurrency(parseFloat(client.total_revenue))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
