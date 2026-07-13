"use client";

import { useState } from "react";
import { ArrowRight, Play, Zap, BarChart3, Users, Shield, Loader2, Clock } from "lucide-react";

import { submitToWaitlist } from "@/utils/api";

const floatingStats = [
  { icon: Shield,   label: "keep 100% of your earnings. no service fees or commissions.", value: "no commissions" },
  { icon: Users,    label: "your client list and contracts belong to you. no lock-in.", value: "privacy first" },
  { icon: BarChart3, label: "built transparently with our open community roadmap.", value: "fully open" },
  { icon: Zap,      label: "ai built native to your dashboard, not bolted-on.", value: "native ai" },
];

export default function Hero() {
  const [email, setEmail]   = useState("");
  const [formState, setFormState] = useState<"idle" | "loading" | "success" | "already-joined">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || formState === "loading") return;
    setFormState("loading");
    const res = await submitToWaitlist(email, "waitlist");
    if (res.alreadyJoined) {
      setFormState("already-joined");
    } else if (res.success) {
      setFormState("success");
    } else {
      setFormState("idle");
    }
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#F5F8FC] pt-28 pb-20">

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
          in active development — get early access
        </span>
      </div>

      {/* ── Headline ────────────────────────────────── */}
      <h1
        className="relative text-center leading-none tracking-wide max-w-5xl px-8 mb-7 text-slate-900"
        style={{ fontFamily: "var(--font-hero)", fontSize: "clamp(3.5rem, 10vw, 8rem)" }}
      >
        <span>Your entire </span>
        <span className="relative inline-block">
          <span style={{
            background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            freelance OS
          </span>
          {/* Underline */}
          <svg
            className="absolute -bottom-1 left-0 w-full"
            viewBox="0 0 400 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M2 7 Q100 2 200 5 Q300 8 398 3"
              stroke="url(#ug)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="ug" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#1D4ED8" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>
            </defs>
          </svg>
        </span>
        <span>,</span>
        <br />
        <span>powered by AI.</span>
      </h1>

      {/* ── Subheadline ─────────────────────────────── */}
      <p
        className="relative text-center text-slate-600 max-w-xl px-8 mb-10 leading-relaxed"
        style={{ fontFamily: "var(--font-body)", fontSize: "clamp(1rem, 2vw, 1.2rem)" }}
      >
        Manage projects, clients, revenue, and gigs — all in one place. Let
        rive.&apos;s AI co-pilot handle the heavy lifting so you can focus on the
        work you love.
      </p>

      {/* ── CTA row ─────────────────────────────────── */}
      <div className="relative flex flex-col sm:flex-row items-center gap-4 px-8 mb-16 w-full max-w-lg">
        {formState === "idle" || formState === "loading" ? (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={formState === "loading"}
              className="flex-1 min-w-0 px-4 py-3 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none transition-all duration-200 disabled:opacity-60"
              style={{
                fontFamily: "var(--font-body)",
                background: "#ffffff",
                border: "1px solid rgba(12, 30, 54, 0.12)",
                boxShadow: "0 2px 8px rgba(12, 30, 54, 0.02)",
              }}
              onFocus={e => { e.target.style.borderColor = "rgba(29,78,216,0.4)"; e.target.style.boxShadow = "0 2px 12px rgba(29,78,216,0.06)"; }}
              onBlur={e => { e.target.style.borderColor = "rgba(12, 30, 54, 0.12)"; e.target.style.boxShadow = "0 2px 8px rgba(12, 30, 54, 0.02)"; }}
            />
            <button
              type="submit"
              disabled={formState === "loading"}
              className="group inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 hover:-translate-y-px whitespace-nowrap shrink-0 disabled:opacity-75"
              style={{
                fontFamily: "var(--font-display)",
                background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                boxShadow: "0 8px 30px rgba(29,78,216,0.18)",
              }}
            >
              {formState === "loading" ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>checking...</span></>
              ) : (
                <>Get Early Access <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
              )}
            </button>
          </form>
        ) : formState === "success" ? (
          <div className="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-emerald-700 font-medium text-sm animate-fade-in"
            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            you&apos;re on the list! we&apos;ll be in touch when your batch opens.
          </div>
        ) : (
          <div className="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl text-blue-700 font-medium text-sm animate-fade-in"
            style={{ background: "rgba(29,78,216,0.07)", border: "1px solid rgba(29,78,216,0.15)" }}>
            <Clock className="w-4 h-4 shrink-0 text-blue-500" />
            already on the list — we&apos;ll notify you when your batch is ready.
          </div>
        )}
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "demo" }))}
          className="inline-flex items-center gap-2.5 text-sm text-slate-500 hover:text-slate-800 transition-colors group shrink-0"
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 group-hover:border-[rgba(29,78,216,0.2)]"
            style={{ border: "1px solid rgba(12, 30, 54, 0.1)", background: "#ffffff" }}>
            <Play className="w-3 h-3 fill-current ml-0.5 text-slate-600" />
          </div>
          Watch Demo
        </button>
      </div>

      {/* ── Stats bar ───────────────────────────────── */}
      <div className="relative w-full max-w-4xl px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {floatingStats.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="group flex flex-col items-center gap-2.5 p-5 rounded-2xl transition-all duration-300 cursor-default"
              style={{ background: "#ffffff", border: "1px solid rgba(12, 30, 54, 0.05)", boxShadow: "0 4px 15px rgba(12,30,54,0.02)" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(29,78,216,0.03)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(29,78,216,0.12)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "#ffffff";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(12, 30, 54, 0.05)";
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: "rgba(29,78,216,0.06)" }}>
                <Icon className="w-[18px] h-[18px]" style={{ color: "#1D4ED8" }} />
              </div>
              <div className="text-xl font-bold text-slate-800" style={{ fontFamily: "var(--font-display)" }}>
                {value}
              </div>
              <div className="text-[11px] text-slate-500 text-center leading-tight" style={{ fontFamily: "var(--font-body)" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Dashboard preview ───────────────────────── */}
      <div className="relative w-full max-w-6xl px-8 mt-16">
        <div className="relative rounded-2xl overflow-hidden shadow-xl shadow-slate-200/50"
          style={{ border: "1px solid rgba(12,30,54,0.08)" }}>

          {/* Browser chrome bar */}
          <div className="flex items-center gap-2 px-5 py-3 border-b"
            style={{ background: "#F1F5F9", borderColor: "rgba(12,30,54,0.06)" }}>
            <div className="flex gap-1.5 shrink-0">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1 mx-6">
              <div className="w-44 h-5 rounded-md mx-auto flex items-center justify-center"
                style={{ background: "#ffffff", border: "1px solid rgba(12,30,54,0.06)" }}>
                <span className="text-[10px] text-slate-400 font-medium" style={{ fontFamily: "var(--font-body)" }}>
                  app.rive.app
                </span>
              </div>
            </div>
          </div>

          {/* Dashboard body */}
          <div className="flex gap-0 min-h-[340px]" style={{ background: "#F8FAFC" }}>

            {/* Sidebar */}
            <div className="hidden md:flex flex-col gap-0.5 w-48 shrink-0 p-4 bg-white"
              style={{ borderRight: "1px solid rgba(12,30,54,0.06)" }}>
              <div className="flex items-center gap-2 mb-5 px-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #1D4ED8, #3B82F6)" }}>
                  <span className="text-white font-bold text-[10px]" style={{ fontFamily: "var(--font-hero)" }}>R</span>
                </div>
                <span className="text-slate-800 text-xs font-semibold" style={{ fontFamily: "var(--font-display)" }}>rive.</span>
              </div>
              {["Dashboard", "Projects", "Clients", "Revenue", "Gig Board", "AI Assistant"].map((item, i) => (
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
                  <div key={label} className="p-3 rounded-xl bg-white border border-slate-100"
                    style={{ boxShadow: "0 2px 8px rgba(12,30,54,0.01)" }}>
                    <p className="text-[10px] text-slate-400 mb-1" style={{ fontFamily: "var(--font-body)" }}>{label}</p>
                    <p className="text-base font-bold text-slate-800" style={{ fontFamily: "var(--font-display)" }}>{value}</p>
                    <p className="text-[10px] mt-0.5 font-medium" style={{ fontFamily: "var(--font-body)", color: accent }}>{change}</p>
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-5 gap-3 flex-1">
                <div className="col-span-3 p-3 rounded-xl bg-white border border-slate-100 flex flex-col"
                  style={{ boxShadow: "0 2px 8px rgba(12,30,54,0.01)" }}>
                  <p className="text-[10px] text-slate-400 mb-3" style={{ fontFamily: "var(--font-body)" }}>Revenue — Last 6 months</p>
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
                <div className="col-span-2 p-3 rounded-xl flex flex-col gap-2.5 bg-blue-50/50 border border-blue-100/50">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(29,78,216,0.1)" }}>
                      <Zap className="w-2.5 h-2.5 text-blue-600" />
                    </div>
                    <p className="text-[10px] font-bold text-blue-600" style={{ fontFamily: "var(--font-display)" }}>AI Insight</p>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium" style={{ fontFamily: "var(--font-body)" }}>
                    3 gigs matching your skills worth{" "}
                    <span className="font-semibold text-emerald-600">$2,400</span> are live on the Gig Board.
                  </p>
                  <button 
                    onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
                    className="text-[10px] font-bold mt-auto text-left text-blue-600 hover:text-blue-800 transition-colors" 
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    View Gigs →
                  </button>
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
