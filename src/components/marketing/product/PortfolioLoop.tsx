"use client";

import type { CSSProperties } from "react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRevealPhase } from "@/components/marketing/useRevealPhase";

export type PortfolioLoopProps = {
  kicker: string;
  summary: string;
  title: string;
  note: string;
  footer: string;
  enquiry: {
    from: string;
    company: string;
    received: string;
    message: string;
    source: string;
  };
};

/**
 * The outcome the Portfolio Studio scene does not show: an enquiry arriving
 * with its source project attached, after the published site has been read.
 */
export function PortfolioLoop({ kicker, summary, title, note, footer, enquiry }: PortfolioLoopProps) {
  const { ref: rootRef, hidden } = useRevealPhase<HTMLDivElement>();

  return (
    <div
      ref={rootRef}
      data-testid="portfolio-loop"
      className="overflow-hidden rounded-[1.45rem] border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] shadow-overlay"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--stroke-hairline)] px-5 py-3">
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-primary">{kicker}</p>
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-success">{summary}</p>
      </div>
      <div className="px-5 py-4 sm:px-6">
        <p className="text-lg font-black tracking-[-0.035em] text-foreground">{title}</p>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{note}</p>
        <div
          className={cn(
            "mt-5 rounded-xl border border-primary/20 bg-[var(--surface-raised)] p-4 shadow-[0_0_35px_rgb(var(--brand-accent)_/_0.07)] transition-[opacity,transform] duration-500 ease-rive-out",
            hidden ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100",
          )}
          style={{ transitionDelay: hidden ? "0s" : "0.12s" } as CSSProperties}
        >
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/25">
                <Mail className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              </span>
              <span className="text-sm font-bold tracking-[-0.02em] text-foreground">{enquiry.from} · {enquiry.company}</span>
            </span>
            <span className="font-mono text-[0.58rem] text-muted-foreground">{enquiry.received}</span>
          </div>
          <p className="mt-3 text-[0.82rem] leading-6 text-muted-foreground">&ldquo;{enquiry.message}&rdquo;</p>
          <p className="mt-3 inline-flex rounded-full border border-success/20 bg-success/10 px-2.5 py-1 font-mono text-[0.54rem] font-semibold uppercase tracking-[0.12em] text-success">{enquiry.source}</p>
        </div>
        <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}
