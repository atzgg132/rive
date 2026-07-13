"use client";
import PageShell from "@/components/PageShell";
import { useState } from "react";
import { Check } from "lucide-react";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const phases = [
  {
    quarter: "Q3 2026", label: "alpha", status: "active",
    items: ["gig board live", "client management", "ai co-pilot beta", "remit payments v1", "alpha waitlist rollout"],
  },
  {
    quarter: "Q4 2026", label: "beta", status: "upcoming",
    items: ["project management", "invoicing suite", "portfolio pages", "mobile app (ios & android)", "public beta launch"],
  },
  {
    quarter: "2027", label: "launch", status: "future",
    items: ["teams & agencies", "api access", "integrations marketplace", "white-label offering", "enterprise tier"],
  },
];

export default function RoadmapPage() {
  const [suggestion, setSuggestion] = useState("");
  const [sent, setSent] = useState(false);

  const handleSuggest = (e: React.FormEvent) => {
    e.preventDefault();
    setSuggestion("");
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[500px] h-[300px] bg-blue-100/15 rounded-full blur-[110px] pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5" style={font}>product roadmap</div>
          <h1 className="text-6xl font-bold text-[#0C1E36] tracking-tight mb-4" style={fontD}>where we&apos;re headed.</h1>
          <p className="text-slate-500 text-lg mb-16 max-w-xl leading-relaxed" style={font}>our public roadmap. we build transparently with our community.</p>

          {/* Phase grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {phases.map((phase) => (
              <div key={phase.quarter} className={`rounded-2xl p-7 border flex flex-col gap-5 ${phase.status === "active" ? "bg-white border-blue-200 shadow-lg shadow-blue-100/30" : "bg-white border-slate-100 shadow-sm"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1" style={font}>{phase.quarter}</p>
                    <h3 className="text-2xl font-bold text-[#0C1E36]" style={fontD}>{phase.label}</h3>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${phase.status === "active" ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"}`} style={font}>
                    <span className={`w-1.5 h-1.5 rounded-full ${phase.status === "active" ? "bg-blue-500 animate-pulse" : "bg-slate-300"}`} />
                    {phase.status === "active" ? "in progress" : "upcoming"}
                  </div>
                </div>
                <ul className="flex flex-col gap-3">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm" style={font}>
                      <Check className={`w-4 h-4 shrink-0 ${phase.status === "active" ? "text-blue-500" : "text-slate-300"}`} />
                      <span className={phase.status === "active" ? "text-slate-700" : "text-slate-400"}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Suggest feature */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 max-w-xl mx-auto text-center">
            <h3 className="text-xl font-bold text-[#0C1E36] mb-2" style={fontD}>suggest a feature</h3>
            <p className="text-slate-500 text-sm mb-6" style={font}>have an idea? we read every submission.</p>
            {sent ? (
              <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-semibold" style={font}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                thanks for the suggestion!
              </div>
            ) : (
              <form onSubmit={handleSuggest} className="flex gap-3">
                <input required value={suggestion} onChange={e => setSuggestion(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" style={font} placeholder="describe your idea..." />
                <button type="submit" className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all shadow-lg shadow-blue-600/15 whitespace-nowrap" style={fontD}>submit</button>
              </form>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
