"use client";

import { Button } from "@/components/ui";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Zap, BarChart3, Users, Shield } from "lucide-react";

const floatingStats = [
  { icon: Shield, label: "Projects, deadlines, and next actions in one delivery view.", value: "Deliver on time" },
  { icon: Users, label: "Every client, conversation, project, and payment stays connected.", value: "Know your clients" },
  { icon: BarChart3, label: "Revenue, invoices, expenses, and margins without another spreadsheet.", value: "Own your numbers" },
  { icon: Zap, label: "Turn completed work into a portfolio that helps win the next client.", value: "Show your best work" },
];

export default function Hero() {
  const router = useRouter();
  return (
    <section className="relative flex flex-col items-center overflow-hidden bg-background px-4 pb-16 pt-32 dark:bg-background sm:px-6 sm:pb-20 sm:pt-36">

      {/* ── Background orbs ─────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[550px] rounded-full blur-[130px]"
          style={{ background: "rgba(59,130,246,0.08)" }} />
        <div className="absolute top-1/2 left-1/4 w-[380px] h-[380px] rounded-full blur-[100px]"
          style={{ background: "rgba(29,78,216,0.05)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[80px]"
          style={{ background: "rgba(96,165,250,0.05)" }} />
      </div>

      {/* ── Subtle grid ─────────────────────────────── */}
      <div
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(29,78,216,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(29,78,216,0.035) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* ── Badge ───────────────────────────────────── */}
      <div className="relative mb-7 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border backdrop-blur-sm"
        style={{ borderColor: "rgba(29,78,216,0.15)", background: "rgba(29,78,216,0.04)" }}>
        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
        <span
          className="text-xs font-medium tracking-wide"
          style={{ fontFamily: "var(--font-body)", color: "#1D4ED8" }}
        >
          Open beta is live
        </span>
      </div>

      {/* ── Headline ────────────────────────────────── */}
      <h1
        className="relative mb-6 max-w-5xl text-center font-bold leading-[0.94] tracking-[-0.055em] text-slate-900 dark:text-white"
        style={{ fontFamily: "var(--font-hero)", fontSize: "clamp(3rem, 7vw, 6.4rem)" }}
      >
        <span>Run your services </span>
        <span className="inline text-blue-700 dark:text-blue-400">
          without the chaos
        </span>
        <span>.</span>
      </h1>

      {/* ── Subheadline ─────────────────────────────── */}
      <p
        className="relative mb-10 max-w-xl text-center leading-relaxed text-slate-600 dark:text-slate-300"
        style={{ fontFamily: "var(--font-body)", fontSize: "clamp(1rem, 2vw, 1.2rem)" }}
      >
        Clients, projects, revenue, expenses, and planning—connected in one workspace.
      </p>

      {/* ── CTA row ─────────────────────────────────── */}
      <div className="relative mb-12 flex w-full max-w-xl flex-col items-center gap-4">
        <Link href="/register" className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_8px_30px_rgba(29,78,216,0.18)] transition hover:-translate-y-px sm:w-auto">
          Create a free account <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Open signup · no invitation required · verify your email to start</p>
      </div>

      {/* ── Stats bar ───────────────────────────────── */}
      <div className="relative w-full max-w-4xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {floatingStats.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="group flex min-w-0 cursor-default flex-col items-center gap-2.5 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm transition-[border-color,background-color] duration-300 hover:border-blue-200 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900 dark:hover:bg-slate-800 sm:p-5"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: "rgba(29,78,216,0.06)" }}>
                <Icon className="w-[18px] h-[18px]" style={{ color: "#1D4ED8" }} />
              </div>
              <div className="text-center text-base font-bold text-slate-800 dark:text-slate-100 sm:text-xl" style={{ fontFamily: "var(--font-display)" }}>
                {value}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-tight" style={{ fontFamily: "var(--font-body)" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Dashboard preview ───────────────────────── */}
      <div className="relative mt-12 w-full max-w-6xl sm:mt-16 animate-hero-preview-in">
        <div className="relative overflow-hidden rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/30"
          style={{ border: "1px solid rgba(12,30,54,0.08)" }}>

          {/* Panel header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[11px] font-medium text-slate-400" style={{ fontFamily: "var(--font-body)" }}>
              www.rive.work
            </span>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
              Overview
            </span>
          </div>

          {/* Dashboard body */}
          <div className="flex gap-0 min-h-[340px] bg-slate-50 dark:bg-slate-950 transition-colors">

            {/* Sidebar */}
            <div className="hidden md:flex flex-col gap-0.5 w-48 shrink-0 p-4 bg-white dark:bg-slate-900 border-r border-[#0C1E36]/[0.06] dark:border-slate-800 transition-colors">
              <div className="flex items-center gap-2 mb-5 px-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #1D4ED8, #3B82F6)" }}>
                  <span className="text-white font-bold text-[10px]" style={{ fontFamily: "var(--font-hero)" }}>R</span>
                </div>
                <span className="text-slate-800 dark:text-slate-200 text-xs font-semibold" style={{ fontFamily: "var(--font-display)" }}>rive.</span>
              </div>
              {["Overview", "Calendar", "Projects", "Clients", "Contracts", "Revenue", "Portfolio"].map((item, i) => (
                <div
                  key={item}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                  style={{
                    fontFamily: "var(--font-body)",
                    background: i === 0 ? "rgba(29,78,216,0.06)" : "transparent",
                    color: i === 0 ? "#1D4ED8" : "#475569",
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: i === 0 ? "#1D4ED8" : "#94a3b8" }} />
                  {item}
                </div>
              ))}
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col gap-3 p-4">

              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Revenue",    value: "$18,420", change: "+12.4%",      accent: "#10b981" },
                  { label: "Active Projects",  value: "7",       change: "+2 this week", accent: "#1D4ED8" },
                  { label: "Pending Invoices", value: "$3,200",  change: "2 due soon",   accent: "#f59e0b" },
                ].map(({ label, value, change, accent }) => (
                  <div key={label} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 transition-colors"
                    style={{ boxShadow: "0 2px 8px rgba(12,30,54,0.01)" }}>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1" style={{ fontFamily: "var(--font-body)" }}>{label}</p>
                    <p className="text-base font-bold text-slate-800 dark:text-slate-100" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
                    <p className="text-[10px] mt-0.5 font-medium" style={{ fontFamily: "var(--font-body)", color: accent }}>{change}</p>
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-5 gap-3 flex-1">
                <div className="col-span-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col transition-colors"
                  style={{ boxShadow: "0 2px 8px rgba(12,30,54,0.01)" }}>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-3" style={{ fontFamily: "var(--font-body)" }}>Revenue — Last 6 months</p>
                  <div className="flex items-end gap-1.5 flex-1">
                    {[40, 65, 45, 80, 60, 95].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{
                          height: `${h}%`,
                          background: "linear-gradient(to top, #1D4ED8, #60A5FA)",
                          opacity: 0.8 + i * 0.04,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="col-span-2 p-3 rounded-xl flex flex-col gap-2.5 bg-blue-50/50 dark:bg-blue-950/40 border border-blue-100/50 dark:border-blue-900/50 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(29,78,216,0.1)" }}>
                      <Zap className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400" style={{ fontFamily: "var(--font-display)" }}>Next action</p>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium" style={{ fontFamily: "var(--font-body)" }}>
                    One invoice is overdue, and two project deadlines are approaching.
                  </p>
                  <Button
                    onClick={() => router.push("/register")}
                    className="text-[10px] font-bold mt-auto text-left text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Review workspace →
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Inset ring */}
          <div className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-inset ring-black/[0.03]" />
        </div>

        {/* Shadow glow */}
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-2/3 h-16 rounded-full pointer-events-none blur-3xl opacity-30"
          style={{ background: "rgba(29,78,216,0.08)" }} />
      </div>
    </section>
  );
}
