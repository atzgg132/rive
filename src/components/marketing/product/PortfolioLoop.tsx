"use client";

import type { CSSProperties } from "react";
import { BookOpen, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRevealPhase } from "@/components/marketing/useRevealPhase";

export type PortfolioLoopProps = {
  kicker: string;
  summary: string;
  title: string;
  note: string;
  footer: string;
  reads: readonly { project: string; metric: string }[];
  enquiry: {
    from: string;
    company: string;
    received: string;
    message: string;
    source: string;
  };
};

/**
 * The outcome the Portfolio Studio scene does not show: the published site
 * being read, and an enquiry arriving with its source project attached. The
 * reads list settles in first; the enquiry lands last as the closing beat.
 */
export function PortfolioLoop({ kicker, summary, title, note, footer, reads, enquiry }: PortfolioLoopProps) {
  const { ref: rootRef, hidden } = useRevealPhase<HTMLDivElement>();

  return (
    <div
      ref={rootRef}
      data-testid="portfolio-loop"
      className="overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#0a0e16] shadow-[0_35px_100px_rgba(0,0,0,0.42)]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-3.5">
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-blue-300">{kicker}</p>
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-emerald-300/90">{summary}</p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <p className="text-xl font-black tracking-[-0.035em] text-white">{title}</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{note}</p>
        <div className="mt-6 rounded-xl border border-white/[0.07] bg-[#0d1220]">
          <p className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 font-mono text-[0.54rem] font-semibold uppercase tracking-[0.13em] text-slate-500">
            <BookOpen className="h-3 w-3 text-blue-300/80" aria-hidden="true" />
            What got read this month
          </p>
          {reads.map((read, index) => (
            <div
              key={read.project}
              className={cn(
                "flex items-baseline justify-between gap-4 border-b border-white/[0.06] px-4 py-2.5 transition-[opacity,transform] duration-500 ease-rive-out last:border-b-0",
                hidden ? "translate-x-3 opacity-0" : "translate-x-0 opacity-100",
              )}
              style={{ transitionDelay: hidden ? "0s" : `${0.1 + index * 0.09}s` } as CSSProperties}
            >
              <span className="text-sm font-bold tracking-[-0.02em] text-slate-100">{read.project}</span>
              <span className="font-mono text-[0.62rem] tabular-nums text-slate-500">{read.metric}</span>
            </div>
          ))}
        </div>
        <div
          className={cn(
            "mt-4 rounded-xl border border-blue-300/20 bg-[#0e1626] p-4 shadow-[0_0_35px_rgba(59,130,246,0.07)] transition-[opacity,transform] duration-500 ease-rive-out",
            hidden ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100",
          )}
          style={{ transitionDelay: hidden ? "0s" : "0.5s" } as CSSProperties}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-400/10 ring-1 ring-blue-300/25">
                <Mail className="h-3.5 w-3.5 text-blue-300" aria-hidden="true" />
              </span>
              <span className="text-sm font-bold tracking-[-0.02em] text-slate-100">{enquiry.from} · {enquiry.company}</span>
            </span>
            <span className="font-mono text-[0.58rem] text-slate-500">{enquiry.received}</span>
          </div>
          <p className="mt-3 text-[0.82rem] leading-6 text-slate-300">&ldquo;{enquiry.message}&rdquo;</p>
          <p className="mt-3 inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/[0.07] px-2.5 py-1 font-mono text-[0.54rem] font-semibold uppercase tracking-[0.12em] text-emerald-300/90">{enquiry.source}</p>
        </div>
        <p className="mt-5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{footer}</p>
      </div>
    </div>
  );
}
