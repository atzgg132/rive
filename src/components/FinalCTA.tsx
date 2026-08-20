"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-background py-32 dark:bg-background">
      <div className="pointer-events-none absolute inset-0"><div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 via-transparent to-sky-50/15" /><div className="absolute left-1/2 top-1/2 h-[450px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-100/10 blur-[130px]" /></div>
      <div className="pointer-events-none absolute inset-0 opacity-[0.3]" style={{ backgroundImage: "linear-gradient(rgba(29,78,216,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(29,78,216,0.03) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/50 px-4 py-1.5 text-xs font-semibold text-blue-600"><span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />Open beta is live</div>
        <h2 className="max-w-4xl font-bold leading-[0.98] tracking-[-0.045em] text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(2.75rem, 7vw, 5.75rem)" }}>Less work around the work.<span className="mt-2 block text-blue-700 dark:text-blue-400">More time on the work that bills.</span></h2>
        <p className="max-w-xl text-lg font-medium leading-relaxed text-slate-600 dark:text-slate-300">Invoices, follow-ups, and admin stay attached to the client work, so they stop eating the week.</p>
        <Link href="/register" className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/15 transition hover:-translate-y-px hover:from-blue-700 hover:to-sky-600">Create a free account <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
        <p className="text-sm font-medium text-slate-400">Free during open beta · no credit card required · email verification keeps your workspace secure</p>
      </div>
    </section>
  );
}
