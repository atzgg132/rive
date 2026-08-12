"use client";

import { Zap, Brain, Shield, MessageSquare, TrendingUp } from "lucide-react";

const connectedCapabilities = [
  {
    icon: Brain,
    title: "Shared business context",
    description: "Clients, projects, tasks, invoices, expenses, and calendar events remain meaningfully linked.",
  },
  {
    icon: Shield,
    title: "Know what needs attention",
    description: "Upcoming deadlines, unpaid invoices, and unfinished work surface before they become surprises.",
  },
  {
    icon: TrendingUp,
    title: "Decisions, not raw data",
    description: "Collections, margins, overdue invoices, project deadlines, and cost patterns become useful signals.",
  },
  {
    icon: MessageSquare,
    title: "A client-ready presence",
    description: "Turn the work already in your workspace into a polished portfolio with detailed case studies.",
  },
];

export default function AISection() {
  return (
    <section className="relative bg-background dark:bg-background py-28 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-[480px] h-[480px] bg-blue-500/[0.04] rounded-full blur-[130px] -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-sky-500/[0.03] rounded-full blur-[110px] -translate-y-1/2" />
      </div>

      <div className="max-w-7xl mx-auto px-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:items-stretch">

          {/* ── Left: Orb visual ─────────────────────── */}
          <div className="relative flex min-h-[420px] items-center justify-center order-2 rounded-3xl border border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30 lg:order-1">
            {/* Outer ring */}
            <div
              className="absolute w-72 h-72 rounded-full border border-blue-500/[0.12]"
              style={{ animation: "spin 22s linear infinite" }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]" />
            </div>

            {/* Middle ring */}
            <div
              className="absolute w-52 h-52 rounded-full border border-sky-500/[0.14]"
              style={{ animation: "spin 15s linear infinite reverse" }}
            >
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 rounded-full bg-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.4)]" />
            </div>

            {/* Core orb */}
            <div className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_4px_30px_rgba(37,99,235,0.2)] flex items-center justify-center">
              <div className="w-[4.5rem] h-[4.5rem] rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
                <Zap className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Floating chips — positioned relative to the 288px orb container */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-72 h-72">
                {/* Top-right */}
                <div className="absolute -top-1 right-0 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-100 dark:border-slate-800 backdrop-blur-sm shadow-md dark:shadow-none flex items-center gap-1.5 whitespace-nowrap transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[11px] text-slate-500 dark:text-slate-300 font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    Project deadlines linked
                  </p>
                </div>
                {/* Bottom-left */}
                <div className="absolute bottom-4 -left-4 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-100 dark:border-slate-800 backdrop-blur-sm shadow-md dark:shadow-none flex items-center gap-1.5 whitespace-nowrap transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-[11px] text-slate-500 dark:text-slate-300 font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    Workspace sync active
                  </p>
                </div>
                {/* Right-center */}
                <div className="absolute top-1/2 -right-28 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-100 dark:border-slate-800 backdrop-blur-sm shadow-md dark:shadow-none flex items-center gap-1.5 whitespace-nowrap transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <p className="text-[11px] text-slate-500 dark:text-slate-300 font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    Payments needing attention
                  </p>
                </div>
              </div>
            </div>

            {/* Ambient glow behind orb */}
            <div className="absolute w-40 h-40 bg-blue-600/[0.1] rounded-full blur-3xl pointer-events-none" />
          </div>

          {/* ── Right: Content ───────────────────────── */}
          <div className="order-1 lg:order-2 flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 w-fit">
              <Zap className="w-3 h-3 shrink-0" />
              <span style={{ fontFamily: "var(--font-body)" }}>Connected by design</span>
            </div>

            <h2
              className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-slate-900 dark:text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              One record.{" "}
              <span className="text-blue-700 dark:text-blue-400">Every workflow in sync.</span>
            </h2>

            <p
              className="text-slate-600 dark:text-slate-300 text-[1.05rem] leading-relaxed"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Rive is built around shared context. Update something once and it stays useful
              everywhere, from project plans and payment dates to your calendar and dashboard.
            </p>

            <div className="flex flex-col gap-5 mt-2">
              {connectedCapabilities.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex gap-4 group">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100/50 dark:border-blue-900/60 flex items-center justify-center group-hover:bg-blue-100/50 dark:group-hover:bg-blue-900/60 transition-colors duration-200 mt-0.5">
                    <Icon className="w-[18px] h-[18px] text-blue-600" />
                  </div>
                  <div>
                    <h3
                      className="text-slate-800 dark:text-white font-bold text-[15px] mb-1"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {title}
                    </h3>
                    <p
                      className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
