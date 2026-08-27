"use client";

import type { CSSProperties } from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRevealPhase } from "@/components/marketing/useRevealPhase";

export type ContractToCashStage = {
  label: string;
  name: string;
  detail: string;
  status: string;
  carries: string | null;
};

export type ContractToCashProps = {
  kicker: string;
  summary: string;
  title: string;
  note: string;
  footer: string;
  stages: readonly ContractToCashStage[];
};

/**
 * The half of the Agreement story the scrollytelling composer scene does not
 * show: recorded acceptance carrying forward into a draft invoice. Visible by
 * default; reveals the two-line handoff on scroll.
 */
export function ContractToCash({ kicker, summary, title, note, footer, stages }: ContractToCashProps) {
  const { ref: rootRef, hidden } = useRevealPhase<HTMLDivElement>();
  const accepted = stages[0];
  const invoice = stages[stages.length - 1];

  return (
    <div
      ref={rootRef}
      data-testid="contract-to-cash"
      className="overflow-hidden rounded-[1.45rem] border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] shadow-overlay"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--stroke-hairline)] px-5 py-3">
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-primary">{kicker}</p>
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{summary}</p>
      </div>
      <div className="px-5 py-4 sm:px-6">
        <p className="text-lg font-black tracking-[-0.035em] text-foreground">{title}</p>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{note}</p>
        {accepted && invoice ? (
          <div className="mt-5">
            <div
              className={cn(
                "rounded-xl border border-[var(--stroke-hairline)] px-4 py-3 transition-[opacity,transform] duration-500 ease-rive-out",
                hidden ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100",
              )}
              style={{ transitionDelay: hidden ? "0s" : "0.1s" } as CSSProperties}
            >
              <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{accepted.label}</p>
              <p className="mt-1 text-sm font-bold tracking-[-0.02em] text-foreground">{accepted.name}</p>
            </div>
            <div
              className={cn(
                "flex items-center gap-2.5 py-2 pl-4 transition-opacity duration-500 ease-rive-out",
                hidden ? "opacity-0" : "opacity-100",
              )}
              style={{ transitionDelay: hidden ? "0s" : "0.22s" } as CSSProperties}
            >
              <ArrowDown className="h-3 w-3 shrink-0 text-primary/70" aria-hidden="true" />
              <p className="font-mono text-[0.56rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{accepted.carries ?? "becomes"}</p>
            </div>
            <div
              className={cn(
                "rounded-xl border border-[var(--stroke-hairline)] px-4 py-3 transition-[opacity,transform] duration-500 ease-rive-out",
                hidden ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100",
              )}
              style={{ transitionDelay: hidden ? "0s" : "0.28s" } as CSSProperties}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-bold tracking-[-0.02em] text-foreground">{invoice.name}</p>
                <p className="font-mono text-[0.62rem] leading-5 text-success">{invoice.status}</p>
              </div>
            </div>
          </div>
        ) : null}
        <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}
