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
    <section
      id="agreements"
      className="relative overflow-hidden bg-slate-950 py-24 text-white dark:bg-[#060d1c] sm:py-32"
    >
      <div className="pointer-events-none absolute -left-40 top-1/4 h-[28rem] w-[28rem] rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[24rem] w-[24rem] rounded-full bg-violet-600/15 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/25 bg-blue-400/10 px-3.5 py-1.5 text-xs font-black uppercase tracking-[.14em] text-blue-200">
            <FileSignature className="h-3.5 w-3.5" />
            Contract to cash
          </div>

          <h2 className="mt-6 max-w-2xl text-4xl font-black leading-[1.02] tracking-[-.045em] sm:text-6xl">
            Scope, approval, and payment terms in one connected record.
          </h2>

          <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
            Create a contract from the client and project context you already have. Share it for review,
            collect recorded acceptance, and keep the next billing action connected to the terms everyone agreed to.
          </p>

          <div className="mt-9 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {outcomes.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.08] text-blue-200">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-black text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
            className="group mt-10 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20 transition hover:-translate-y-0.5"
          >
            See the contract workflow
            <ArrowRight size={17} className="transition group-hover:translate-x-1" />
          </button>
        </div>

        <div className="relative mx-auto w-full max-w-2xl">
          <div className="absolute -inset-5 rounded-[34px] bg-gradient-to-br from-blue-500/20 via-transparent to-violet-500/15 blur-2xl" />
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-black/30 backdrop-blur sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-200">Contract workspace</p>
                <h3 className="mt-2 text-xl font-black text-white sm:text-2xl">Brand identity sprint</h3>
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black text-emerald-200">
                Accepted
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_0.82fr]">
              <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-300">Contract progress</p>
                  <p className="text-[10px] font-black text-emerald-300">4 of 4</p>
                </div>
                <div className="mt-5 space-y-3">
                  {stages.map((stage) => (
                    <div key={stage} className="flex items-center gap-3">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-xs font-bold text-slate-200">{stage}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Client</p>
                  <p className="mt-2 text-sm font-black text-white">Studio Katha</p>
                  <p className="mt-1 text-[11px] text-slate-400">Project context attached</p>
                </div>
                <div className="rounded-2xl border border-blue-300/15 bg-blue-400/10 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-200">Next signal</p>
                  <p className="mt-2 text-sm font-black text-white">Milestone invoice ready</p>
                  <p className="mt-1 text-[11px] text-blue-100/70">Review before sending</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <FileSignature className="h-4 w-4 text-blue-200" />
                Version 3 locked for acceptance
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Payment terms connected</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
