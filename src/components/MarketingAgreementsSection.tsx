"use client";

import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  FileSignature,
  MessageSquareText,
} from "lucide-react";

const outcomes = [
  {
    icon: FileCheck2,
    title: "Reuse the context you already have",
    description: "Start from the client and project records already in your workspace.",
  },
  {
    icon: MessageSquareText,
    title: "Review a specific version",
    description: "Share a purpose-specific link for comments and requested changes.",
  },
  {
    icon: CheckCircle2,
    title: "Record acceptance clearly",
    description: "Keep the accepted version and acceptance evidence attached to the work.",
  },
  {
    icon: CircleDollarSign,
    title: "Connect terms to billing",
    description: "Turn agreed payment terms into deliberate invoice triggers.",
  },
] as const;

const stages = ["Draft", "Review", "Acceptance", "Billing active"] as const;

export default function MarketingAgreementsSection() {
  return (
    <section id="agreements" className="relative overflow-hidden bg-white py-24 dark:bg-slate-950 sm:py-32">
      <div className="pointer-events-none absolute -left-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-blue-600/[0.06] blur-3xl dark:bg-blue-600/20" />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-black uppercase tracking-[.14em] text-blue-700 dark:border-blue-400/25 dark:bg-blue-400/10 dark:text-blue-200">
            <FileSignature className="h-3.5 w-3.5" />
            Contract to cash
          </div>

          <h2 className="mt-6 max-w-2xl text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-slate-950 dark:text-white">
            Scope, approval, and payment terms in one connected record.
          </h2>

          <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
            Create a contract from the client and project context you already have. Share it for review,
            collect recorded acceptance, and keep the next billing action connected to the terms everyone agreed to.
          </p>

          <div className="mt-9 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {outcomes.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 dark:border-white/10 dark:bg-white/[0.08] dark:text-blue-200">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
            className="group mt-10 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950 dark:shadow-black/20"
          >
            See the contract workflow
            <ArrowRight size={17} className="transition group-hover:translate-x-1" />
          </button>
        </div>

        <div className="relative mx-auto w-full max-w-2xl">
          <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-white/[0.07] dark:shadow-black/30 sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-white/10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-700 dark:text-blue-200">Contract workspace</p>
                <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white sm:text-2xl">Brand identity sprint</h3>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200">
                Accepted
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_0.82fr]">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-900/50">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Contract progress</p>
                  <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-300">4 of 4</p>
                </div>
                <div className="mt-5 space-y-3">
                  {stages.map((stage) => (
                    <div key={stage} className="flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{stage}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.06]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Client</p>
                  <p className="mt-2 text-sm font-black text-slate-950 dark:text-white">Studio Katha</p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Project context attached</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-300/15 dark:bg-blue-400/10">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-200">Next signal</p>
                  <p className="mt-2 text-sm font-black text-slate-950 dark:text-white">Milestone invoice ready</p>
                  <p className="mt-1 text-[11px] text-blue-700/70 dark:text-blue-100/70">Review before sending</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                <FileSignature className="h-4 w-4 text-blue-600 dark:text-blue-200" />
                Version 3 locked for acceptance
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Payment terms connected</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
