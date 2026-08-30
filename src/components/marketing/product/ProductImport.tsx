"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Link2 } from "lucide-react";
import { ProductFrame } from "@/components/marketing/product/ProductFrame";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

export type ProductImportProps = {
  filename: string;
  sources: string[];
  totals: { ready: number; review: number; skipped: number };
  matches: string[];
};

export function ProductImport({ filename, sources, totals, matches }: ProductImportProps) {
  const reduceMotion = useMarketingReducedMotion();
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setComplete(true), reduceMotion ? 0 : 1200);
    return () => window.clearTimeout(timeout);
  }, [reduceMotion]);

  return (
    <ProductFrame
      title="Bring your business data"
      eyebrow="Migration Engine"
      toolbar={
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[0.54rem] font-bold text-slate-600">
          <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
          {filename}
        </span>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[.78fr_1.22fr]">
        <div className="hidden rounded-xl border border-slate-200 bg-white p-3 lg:block">
          <p className="font-mono text-[0.48rem] font-bold uppercase tracking-[0.12em] text-slate-600">Detected records</p>
          <div className="mt-3 grid gap-2">
            {sources.map((source, index) => (
              <div
                key={source}
                className="marketing-mock-in-x flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <span className="text-[0.56rem] font-bold text-slate-700">{source}</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              </div>
            ))}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-[1100ms] motion-reduce:duration-0"
              style={{ width: complete ? "100%" : "64%" }}
            />
          </div>
          <p className="mt-2 text-[0.5rem] font-semibold text-slate-600">
            {complete ? "Profile complete. Ready for review." : "Profiling columns and values…"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-emerald-50 p-2.5">
              <p className="font-mono text-[0.45rem] font-bold uppercase text-emerald-700">Ready</p>
              <p className="mt-1 text-base font-black tabular-nums text-emerald-800">{totals.ready.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2.5">
              <p className="font-mono text-[0.45rem] font-bold uppercase text-amber-700">Review</p>
              <p className="mt-1 text-base font-black tabular-nums text-amber-800">{totals.review}</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2.5">
              <p className="font-mono text-[0.45rem] font-bold uppercase text-slate-700">Skipped</p>
              <p className="mt-1 text-base font-black tabular-nums text-slate-700">{totals.skipped}</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
            <p className="flex items-center gap-1.5 text-[0.54rem] font-bold text-amber-900">
              <AlertTriangle className="h-3 w-3" />
              Rows to confirm before import
            </p>
            <div className="mt-2 grid gap-1.5">
              {matches.map((match, index) => (
                <div
                  key={match}
                  className="marketing-mock-in flex min-w-0 items-center gap-1.5 rounded-md bg-white px-2 py-1.5 text-[0.5rem] font-semibold text-slate-600 ring-1 ring-amber-100"
                  style={{ animationDelay: `${0.35 + index * 0.12}s` }}
                >
                  <Link2 className="h-3 w-3 shrink-0 text-blue-600" />
                  <span className="min-w-0 truncate">{match}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ProductFrame>
  );
}
