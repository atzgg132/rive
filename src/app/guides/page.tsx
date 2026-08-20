"use client";

import { Button } from "@/components/ui";
import PageShell from "@/components/PageShell";
import { FolderOpen, FileSignature, Globe2, Users, Sparkles, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const guides = [
  { icon: FolderOpen, title: "Setting up your first project", color: "text-blue-600", bg: "bg-blue-50", darkBg: "dark:bg-blue-950/40", detail: "Create a client first, then add a project with a budget, dates, milestones, and priority." },
  { icon: Users, title: "Managing clients and contracts", color: "text-purple-600", bg: "bg-purple-50", darkBg: "dark:bg-purple-950/40", detail: "Keep contact details, notes, tags, projects, and invoices together on each client profile." },
  { icon: FileSignature, title: "Reviewing and recording an Agreement", color: "text-indigo-600", bg: "bg-indigo-50", darkBg: "dark:bg-indigo-950/40", detail: "Draft from existing client and project context, share a review link, collect recorded acceptance, and connect payment terms to invoice triggers." },
  { icon: BarChart3, title: "Invoice and revenue tracking", color: "text-rose-600", bg: "bg-rose-50", darkBg: "dark:bg-rose-950/40", detail: "Issue invoices, track payment status, record expenses, and review net earnings in the dashboard." },
  { icon: Sparkles, title: "Publishing a portfolio", color: "text-amber-600", bg: "bg-amber-50", darkBg: "dark:bg-amber-950/40", detail: "Turn completed work into a public site with case studies, media, inquiries, and privacy-conscious analytics." },
  { icon: Globe2, title: "Bringing existing data in", color: "text-emerald-600", bg: "bg-emerald-50", darkBg: "dark:bg-emerald-950/40", detail: "Import CSV or XLSX exports, subscribe to an Apple Calendar feed, and use the Migration Engine to preview, match, and roll back." },
];

export default function GuidesPage() {
  const router = useRouter();
  return (
    <PageShell>
      <section className="relative py-24 overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[500px] h-[300px] bg-blue-100/15 rounded-full blur-[110px] pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-8">

          {/* Header */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/40 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-5" style={font}>
            Guides
          </div>
          <h1 className="text-6xl font-bold text-foreground dark:text-white tracking-tight mb-4" style={fontD}>
            Learn Rive.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg mb-14 max-w-lg leading-relaxed" style={font}>
            Practical starting points for the workspace that is live in open beta.
          </p>

          {/* Grid */}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 mb-16">
            {guides.map(({ icon: Icon, title, color, bg, darkBg, detail }) => (
              <div key={title} className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-6 flex flex-col gap-4 hover:shadow-md dark:hover:shadow-blue-900/20 hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-200">
                <div className={`w-11 h-11 rounded-xl ${bg} ${darkBg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground dark:text-white text-sm leading-snug mb-3" style={fontD}>{title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed" style={font}>{detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm dark:shadow-none p-8 text-center max-w-md mx-auto transition-colors">
            <h3 className="text-xl font-bold text-foreground dark:text-white mb-2" style={fontD}>Use the workspace</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5" style={font}>
              Create a free account and learn by doing. These cards describe workflows that already exist in the product.
            </p>
            <Button
              onClick={() => router.push("/register")}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-bold text-sm hover:from-blue-700 hover:to-sky-600 transition-all duration-200 shadow-lg shadow-blue-600/15"
              style={fontD}
            >
              Create a free account →
            </Button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
