"use client";

import type { CSSProperties } from "react";
import { CircleDashed, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRevealPhase } from "@/components/marketing/useRevealPhase";

export type ImportReconnectionRecord = {
  label: string;
  name: string;
  detail: string;
  status: string;
  tone: "linked" | "review";
};

export type ImportReconnectionProps = {
  kicker: string;
  summary: string;
  title: string;
  note: string;
  footer: string;
  records: readonly ImportReconnectionRecord[];
};

/**
 * The resolution of the problem section's disconnection panel: the same kind of
 * scattered records, now committed and linked after an import. Renders visible
 * by default (no-JS keeps every word) and opts into a one-time staggered
 * reveal only once the panel can be observed.
 */
export function ImportReconnection({ kicker, summary, title, note, footer, records }: ImportReconnectionProps) {
  const { ref: rootRef, hidden } = useRevealPhase<HTMLDivElement>();

  return (
    <div
      ref={rootRef}
      data-testid="import-reconnection"
      className="overflow-hidden rounded-[1.45rem] border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] shadow-overlay"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--stroke-hairline)] px-5 py-3">
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-success">{kicker}</p>
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{summary}</p>
      </div>
      <div className="px-5 py-4 sm:px-6">
        <p className="text-lg font-black tracking-[-0.035em] text-foreground">{title}</p>
        <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{note}</p>
        <ol className="relative mt-4 border-y border-[var(--stroke-hairline)]">
          <span
            aria-hidden="true"
            className={cn(
              "absolute bottom-8 left-[0.5625rem] top-8 w-px origin-top bg-gradient-to-b from-success/45 via-success/25 to-warning/30 transition-transform duration-700 ease-rive-out",
              hidden ? "scale-y-0" : "scale-y-100",
            )}
            style={{ transitionDelay: hidden ? "0s" : "0.25s" } as CSSProperties}
          />
          {records.map((record, index) => (
            <li
              key={`${record.label}-${record.name}`}
              className={cn(
                "grid grid-cols-[1.25rem_1fr] items-start gap-3 border-b border-[var(--stroke-hairline)] py-3 transition-[opacity,transform] duration-500 ease-rive-out last:border-b-0",
                hidden ? "translate-x-3 opacity-0" : "translate-x-0 opacity-100",
              )}
              style={{ transitionDelay: hidden ? "0s" : `${0.1 + index * 0.09}s` } as CSSProperties}
            >
              <span
                className={cn(
                  "relative mt-0.5 grid h-5 w-5 place-items-center rounded-full ring-1",
                  record.tone === "linked" ? "bg-success/10 ring-success/30" : "bg-warning/10 ring-warning/30",
                )}
              >
                {record.tone === "linked"
                  ? <Link2 className="h-3 w-3 text-success" aria-hidden="true" />
                  : <CircleDashed className="h-3 w-3 text-warning" aria-hidden="true" />}
              </span>
              <span>
                <span className="block text-sm font-bold tracking-[-0.02em] text-foreground">{record.name}</span>
                <span className={cn("mt-1 block font-mono text-[0.62rem] leading-5", record.tone === "linked" ? "text-success" : "text-warning")}>
                  {record.status}
                </span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}
