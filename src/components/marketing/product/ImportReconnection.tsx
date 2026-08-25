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
      className="overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#0a0e16] shadow-[0_35px_100px_rgba(0,0,0,0.42)]"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-3.5">
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-emerald-300/90">{kicker}</p>
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{summary}</p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <p className="text-xl font-black tracking-[-0.035em] text-white">{title}</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{note}</p>
        <ol className="relative mt-6 border-y border-white/[0.06]">
          <span
            aria-hidden="true"
            className={cn(
              "absolute bottom-8 left-[0.5625rem] top-8 w-px origin-top bg-gradient-to-b from-emerald-300/45 via-emerald-300/25 to-amber-200/30 transition-transform duration-700 ease-rive-out",
              hidden ? "scale-y-0" : "scale-y-100",
            )}
            style={{ transitionDelay: hidden ? "0s" : "0.25s" } as CSSProperties}
          />
          {records.map((record, index) => (
            <li
              key={`${record.label}-${record.name}`}
              className={cn(
                "grid grid-cols-[1.25rem_4.5rem_1fr] items-start gap-3 border-b border-white/[0.06] py-3.5 transition-[opacity,transform] duration-500 ease-rive-out last:border-b-0 sm:grid-cols-[1.25rem_5rem_1fr_10.5rem]",
                hidden ? "translate-x-3 opacity-0" : "translate-x-0 opacity-100",
              )}
              style={{ transitionDelay: hidden ? "0s" : `${0.1 + index * 0.09}s` } as CSSProperties}
            >
              <span
                className={cn(
                  "relative mt-0.5 grid h-5 w-5 place-items-center rounded-full ring-1",
                  record.tone === "linked" ? "bg-emerald-400/10 ring-emerald-300/30" : "bg-amber-300/10 ring-amber-200/30",
                )}
              >
                {record.tone === "linked"
                  ? <Link2 className="h-3 w-3 text-emerald-300" aria-hidden="true" />
                  : <CircleDashed className="h-3 w-3 text-amber-200" aria-hidden="true" />}
              </span>
              <span className="mt-1 font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{record.label}</span>
              <span className="col-span-1 col-start-3">
                <span className="block text-sm font-bold tracking-[-0.02em] text-slate-100">{record.name}</span>
                <span className="mt-1 block text-[0.7rem] text-slate-500">{record.detail}</span>
              </span>
              <span
                className={cn(
                  "col-start-3 mt-1 font-mono text-[0.62rem] leading-5 sm:col-start-4 sm:mt-0.5 sm:text-right",
                  record.tone === "linked" ? "text-emerald-300/90" : "text-amber-200/80",
                )}
              >
                {record.status}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{footer}</p>
      </div>
    </div>
  );
}
