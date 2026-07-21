"use client";

import React from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ChartData {
  month: string;
  revenue: number;
  expenses: number;
}

export default function AnalyticsCharts({ data }: { data: ChartData[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center border border-dashed border-[#E2EAF4] dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50 text-[#4A5E78] dark:text-slate-400 text-sm">
        No data available for charts yet.
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value}`;
  };

  return (
    <div className="glass bg-white dark:bg-[#111827] p-6 rounded-2xl border border-[#E2EAF4] dark:border-slate-800 w-full animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-[#0C1E36] dark:text-white">Financial Overview</h3>
          <p className="text-xs text-[#4A5E78] dark:text-slate-400">Revenue vs Expenses (Last 6 Months)</p>
        </div>
        <div className="flex items-center gap-4 mt-2 sm:mt-0 text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-[#1D4ED8] dark:text-blue-400">
            <span className="h-2.5 w-2.5 rounded-full bg-[#1D4ED8] dark:bg-blue-400"></span>
            <span>Revenue</span>
          </div>
          <div className="flex items-center gap-1.5 text-[#EF4444] dark:text-red-400">
            <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444] dark:bg-red-400"></span>
            <span>Expenses</span>
          </div>
        </div>
      </div>
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2EAF4" className="dark:opacity-10" />
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#4A5E78" }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#4A5E78" }}
              tickFormatter={formatCurrency}
              dx={-10}
            />
            <Tooltip 
              contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)", background: "rgba(255, 255, 255, 0.95)" }}
              itemStyle={{ fontSize: "14px", fontWeight: "bold" }}
              labelStyle={{ color: "#4A5E78", marginBottom: "4px", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase" }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
            />
            <Area type="monotone" dataKey="revenue" stroke="#1D4ED8" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
