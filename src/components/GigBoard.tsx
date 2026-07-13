"use client";

import { MapPin, Clock, DollarSign, ArrowRight, Sparkles } from "lucide-react";

const gigs = [
  {
    title: "Full-Stack SaaS MVP Development",
    budget: "$4,500 – $7,000",
    type: "Fixed Price",
    skills: ["React", "Node.js", "PostgreSQL"],
    posted: "2h ago",
    location: "Remote",
    urgency: "Urgent",
    urgencyColor: "red",
    aiMatch: "98% match",
  },
  {
    title: "Brand Identity Design for FinTech Startup",
    budget: "$1,200 – $2,400",
    type: "Fixed Price",
    skills: ["Figma", "Brand Design", "Logo"],
    posted: "5h ago",
    location: "Remote",
    urgency: "New",
    urgencyColor: "emerald",
    aiMatch: "91% match",
  },
  {
    title: "Monthly SEO & Content Strategy Retainer",
    budget: "$800/mo",
    type: "Monthly Retainer",
    skills: ["SEO", "Content Writing", "Analytics"],
    posted: "1d ago",
    location: "Remote",
    urgency: null,
    urgencyColor: "",
    aiMatch: "85% match",
  },
  {
    title: "Mobile App UI/UX Redesign",
    budget: "$2,000 – $3,500",
    type: "Fixed Price",
    skills: ["Figma", "iOS/Android", "Prototyping"],
    posted: "3h ago",
    location: "US Preferred",
    urgency: "Hot",
    urgencyColor: "amber",
    aiMatch: "79% match",
  },
];

const urgencyStyles: Record<string, string> = {
  red:     "bg-rose-50 text-rose-700 border border-rose-100/60",
  emerald: "bg-emerald-50 text-emerald-700 border border-emerald-100/60",
  amber:   "bg-amber-50 text-amber-700 border border-amber-100/60",
};

export default function GigBoard() {
  return (
    <section id="gig-board" className="relative bg-[#F5F8FC] py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-28 bg-gradient-to-b from-transparent via-blue-500/15 to-transparent" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-52 bg-blue-100/10 blur-[90px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-8">

        {/* ── Header ──────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
              <span style={{ fontFamily: "var(--font-body)" }}>Beta — Live Now</span>
            </div>
            <h2
              className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              The Gig Board
            </h2>
            <p
              className="text-slate-600 text-[1.05rem] max-w-lg leading-relaxed"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Find and post gigs — for freelancers and businesses alike. AI surfaces the
              best matches for your skills automatically.
            </p>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-blue-100 text-blue-600 text-sm font-semibold hover:bg-blue-50/50 transition-all duration-200 shrink-0"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Explore all gigs
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* ── AI banner ───────────────────────────────── */}
        <div className="mb-6 px-5 py-4 rounded-2xl bg-blue-50 border border-blue-100/60 flex items-center gap-4 shadow-sm shadow-blue-100/20">
          <div className="w-9 h-9 rounded-xl bg-blue-100/50 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-sm text-slate-700 leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
            <span className="text-blue-800 font-bold">rive. is currently indexing gigs</span> for our upcoming launch. 
            sign up to see your personalized board when we go live.
          </p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
            className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap transition-colors shrink-0"
            style={{ fontFamily: "var(--font-display)" }}
          >
            join waitlist →
          </button>
        </div>

        {/* ── Gig cards ───────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-4">
          {gigs.map((gig) => (
            <div
              key={gig.title}
              onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
              className="group relative p-6 rounded-2xl bg-white border border-slate-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/30 transition-all duration-300 cursor-pointer"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <h3
                  className="text-slate-800 font-bold text-[15px] leading-snug group-hover:text-blue-700 transition-colors flex-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {gig.title}
                </h3>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {gig.urgency && (
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${urgencyStyles[gig.urgencyColor]}`}
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {gig.urgency}
                    </span>
                  )}
                  <span
                    className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100/60"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {gig.aiMatch}
                  </span>
                </div>
              </div>

              {/* Skills */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {gig.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-[11px] px-2.5 py-0.5 rounded-md bg-slate-50 border border-slate-100 text-slate-500"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {skill}
                  </span>
                ))}
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-bold text-emerald-600">
                  <DollarSign className="w-3 h-3 shrink-0" />
                  <span style={{ fontFamily: "var(--font-display)" }}>{gig.budget}</span>
                </span>
                <span className="flex items-center gap-1" style={{ fontFamily: "var(--font-body)" }}>
                  <Clock className="w-3 h-3 shrink-0" />
                  {gig.posted}
                </span>
                <span className="flex items-center gap-1" style={{ fontFamily: "var(--font-body)" }}>
                  <MapPin className="w-3 h-3 shrink-0" />
                  {gig.location}
                </span>
                <span
                  className="ml-auto text-[10px] text-slate-400 border border-slate-100 px-2.5 py-0.5 rounded-lg shrink-0"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {gig.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
