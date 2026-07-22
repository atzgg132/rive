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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/40 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-5" style={font}>product roadmap</div>
          <h1 className="text-6xl font-bold text-[#0C1E36] dark:text-white tracking-tight mb-4" style={fontD}>where we&apos;re headed.</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-16 max-w-xl leading-relaxed" style={font}>our public roadmap. we build transparently with our community.</p>

          {/* Phase grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {phases.map((phase) => (
              <div key={phase.quarter} className={`rounded-2xl p-7 border flex flex-col gap-5 transition-colors ${phase.status === "active" ? "bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800/80 shadow-lg dark:shadow-none" : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1" style={font}>{phase.quarter}</p>
                    <h3 className="text-2xl font-bold text-[#0C1E36] dark:text-white" style={fontD}>{phase.label}</h3>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${phase.status === "active" ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" : "bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-400"}`} style={font}>
                    <span className={`w-1.5 h-1.5 rounded-full ${phase.status === "active" ? "bg-blue-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600"}`} />
                    {phase.status === "active" ? "in progress" : "upcoming"}
                  </div>
                </div>
                <ul className="flex flex-col gap-3">
                  {phase.items.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm" style={font}>
                      <Check className={`w-4 h-4 shrink-0 ${phase.status === "active" ? "text-blue-500 dark:text-blue-400" : "text-slate-300 dark:text-slate-600"}`} />
                      <span className={phase.status === "active" ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-400"}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Suggest feature */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-8 max-w-xl mx-auto text-center transition-colors">
            <h3 className="text-xl font-bold text-[#0C1E36] dark:text-white mb-2" style={fontD}>suggest a feature</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6" style={font}>have an idea? we read every submission.</p>
            {sent ? (
              <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-semibold" style={font}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                thanks for the suggestion!
              </div>
            ) : (
              <form onSubmit={handleSuggest} className="flex gap-3">
                <input type="text" value={suggestion} onChange={e => setSuggestion(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400 transition-all" style={font} placeholder="e.g. multi-currency invoicing" required />
                <button type="submit" className="px-5 py-3 rounded-xl bg-blue-600 dark:bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all shrink-0" style={font}>submit</button>
              </form>
            )}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
