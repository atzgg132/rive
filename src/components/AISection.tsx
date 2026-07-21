"use client";

import { Zap, Brain, Shield, MessageSquare, TrendingUp } from "lucide-react";

const aiCapabilities = [
  {
    icon: Brain,
    title: "Smart Gig Suggestions",
    description: "Personalized recommendations worth $X based on your skill set and earnings history.",
  },
  {
    icon: Shield,
    title: "Double Confirmation",
    description: "Sensitive financial actions require AI verification before executing — no costly mistakes.",
  },
  {
    icon: TrendingUp,
    title: "Revenue Forecasting",
    description: "AI predicts your income trajectory and flags potential gaps before they happen.",
  },
  {
    icon: MessageSquare,
    title: "Lead Gen Assistant",
    description: "AI drafts personalized outreach and surfaces qualified leads for your services.",
  },
];

export default function AISection() {
  return (
    <section className="relative bg-[#F5F8FC] dark:bg-[#0B1120] py-28 overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-[480px] h-[480px] bg-blue-500/[0.04] rounded-full blur-[130px] -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-sky-500/[0.03] rounded-full blur-[110px] -translate-y-1/2" />
      </div>

      <div className="max-w-7xl mx-auto px-8">
        <div className="grid lg:grid-cols-2 gap-20 items-center">

          {/* ── Left: Orb visual ─────────────────────── */}
          <div className="relative flex items-center justify-center order-2 lg:order-1 py-8">
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
                <div className="absolute -top-1 right-0 px-3 py-1.5 rounded-xl bg-white border border-slate-100 backdrop-blur-sm shadow-md shadow-slate-100/10 flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[11px] text-slate-500 font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    smart gig matching active
                  </p>
                </div>
                {/* Bottom-left */}
                <div className="absolute bottom-4 -left-4 px-3 py-1.5 rounded-xl bg-white border border-slate-100 backdrop-blur-sm shadow-md shadow-slate-100/10 flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-[11px] text-slate-500 font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    co-pilot engine: operational
                  </p>
                </div>
                {/* Right-center */}
                <div className="absolute top-1/2 -right-28 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-white border border-slate-100 backdrop-blur-sm shadow-md shadow-slate-100/10 flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <p className="text-[11px] text-slate-500 font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    verifying billing safety
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
              <span style={{ fontFamily: "var(--font-body)" }}>rive. AI Co-Pilot</span>
            </div>

            <h2
              className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight leading-[1.08]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              AI that works{" "}
              <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
                as hard as you do.
              </span>
            </h2>

            <p
              className="text-slate-600 dark:text-slate-300 text-[1.05rem] leading-relaxed"
              style={{ fontFamily: "var(--font-body)" }}
            >
              rive.&apos;s AI co-pilot is embedded across every suite — not bolted on as an afterthought.
              It learns your patterns, anticipates your needs, and handles the busywork.
            </p>

            <div className="flex flex-col gap-5 mt-2">
              {aiCapabilities.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex gap-4 group">
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/50 flex items-center justify-center group-hover:bg-blue-100/50 transition-colors duration-200 mt-0.5">
                    <Icon className="w-[18px] h-[18px] text-blue-600" />
                  </div>
                  <div>
                    <h3
                      className="text-slate-800 font-bold text-[15px] mb-1"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {title}
                    </h3>
                    <p
                      className="text-slate-500 text-sm leading-relaxed"
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
