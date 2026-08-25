"use client";

import type { CSSProperties } from "react";
import { ArrowDown, FileCheck2, ReceiptText, Signature } from "lucide-react";
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

const stageIcons = [Signature, FileCheck2, ReceiptText];

/**
 * The half of the Agreement story the scrollytelling composer scene does not
 * show: recorded acceptance carrying forward into an approved payment trigger
 * and a draft invoice. Visible by default; reveals stage by stage on scroll.
 */
export function ContractToCash({ kicker, summary, title, note, footer, stages }: ContractToCashProps) {
  const { ref: rootRef, hidden } = useRevealPhase<HTMLDivElement>();

  return (
    <div
      ref={rootRef}
      data-testid="contract-to-cash"
      className="overflow-hidden rounded-[1.45rem] border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] shadow-overlay"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--stroke-hairline)] px-5 py-3.5">
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-primary">{kicker}</p>
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{summary}</p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <p className="text-xl font-black tracking-[-0.035em] text-foreground">{title}</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{note}</p>
        <ol className="mt-6 grid gap-0">
          {stages.map((stage, index) => {
            const Icon = stageIcons[index % stageIcons.length];
            return (
              <li key={stage.label}>
                <div
                  className={cn(
                    "rounded-xl border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] p-4 transition-[opacity,transform] duration-500 ease-rive-out",
                    hidden ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100",
                  )}
                  style={{ transitionDelay: hidden ? "0s" : `${0.1 + index * 0.16}s` } as CSSProperties}
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-2.5">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/25">
                        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      </span>
                      <span className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{stage.label}</span>
                    </span>
                    <span className="font-mono text-[0.62rem] leading-5 text-success">{stage.status}</span>
                  </div>
                  <p className="mt-2.5 text-sm font-bold tracking-[-0.02em] text-foreground">{stage.name}</p>
                  <p className="mt-1 text-[0.78rem] leading-5 text-muted-foreground">{stage.detail}</p>
                </div>
                {stage.carries ? (
                  <div
                    className={cn(
                      "flex items-center gap-2.5 py-2 pl-4 transition-opacity duration-500 ease-rive-out",
                      hidden ? "opacity-0" : "opacity-100",
                    )}
                    style={{ transitionDelay: hidden ? "0s" : `${0.22 + index * 0.16}s` } as CSSProperties}
                  >
                    <ArrowDown className="h-3 w-3 shrink-0 text-primary/70" aria-hidden="true" />
                    <p className="font-mono text-[0.56rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{stage.carries}</p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
        <p className="mt-5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}
