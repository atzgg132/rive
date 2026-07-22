"use client";
import PageShell from "@/components/PageShell";
import { FolderOpen, Globe, Zap, Users, Briefcase, BarChart3 } from "lucide-react";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const guides = [
  { icon: FolderOpen, title: "setting up your first project", color: "text-blue-600", bg: "bg-blue-50", darkBg: "dark:bg-blue-950/40", detail: "Create a client first, then add a project with a budget, dates, milestones, and priority." },
  { icon: Globe, title: "sending your first payment with remit", color: "text-emerald-600", bg: "bg-emerald-50", darkBg: "dark:bg-emerald-950/40", detail: "Use the Remit section to preview exchange rates and request access to cross-border transfers." },
  { icon: Zap, title: "using the ai co-pilot", color: "text-amber-600", bg: "bg-amber-50", darkBg: "dark:bg-amber-950/40", detail: "Use the assistant surfaces to organize repetitive workflow tasks while keeping final control." },
  { icon: Users, title: "managing clients and contracts", color: "text-purple-600", bg: "bg-purple-50", darkBg: "dark:bg-purple-950/40", detail: "Keep contact details, notes, tags, projects, and invoices together on each client profile." },
  { icon: Briefcase, title: "listing on the gig board", color: "text-sky-600", bg: "bg-sky-50", darkBg: "dark:bg-sky-950/40", detail: "Browse the board to understand the matching workflow and keep your profile ready for launch." },
  { icon: BarChart3, title: "invoice and revenue tracking", color: "text-rose-600", bg: "bg-rose-50", darkBg: "dark:bg-rose-950/40", detail: "Issue invoices, track payment status, record expenses, and review net earnings in the dashboard." },
];

export default function GuidesPage() {
  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[500px] h-[300px] bg-blue-100/15 rounded-full blur-[110px] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-8">

          {/* Header */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/40 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-5" style={font}>
            guides
          </div>
          <h1 className="text-6xl font-bold text-[#0C1E36] dark:text-white tracking-tight mb-4" style={fontD}>
            learn rive.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-14 max-w-lg leading-relaxed" style={font}>
            step-by-step guides to get the most out of every feature. launching alongside the platform.
          </p>

          {/* Grid */}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 mb-16">
            {guides.map(({ icon: Icon, title, color, bg, darkBg, detail }) => (
              <div key={title} className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-6 flex flex-col gap-4 hover:shadow-md dark:hover:shadow-blue-900/20 hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-200">
                <div className={`w-11 h-11 rounded-xl ${bg} ${darkBg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-[#0C1E36] dark:text-white text-sm leading-snug mb-3" style={fontD}>{title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed" style={font}>{detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-8 text-center max-w-md mx-auto transition-colors">
            <h3 className="text-xl font-bold text-[#0C1E36] dark:text-white mb-2" style={fontD}>be first to learn</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5" style={font}>
              join the waitlist and we&apos;ll send you guides as soon as they&apos;re published.
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all duration-200 shadow-lg shadow-blue-600/15"
              style={fontD}
            >
              join the waitlist →
            </button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
