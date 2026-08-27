"use client";

import { useEffect, useState } from "react";
import * as m from "motion/react-m";
import { AlertTriangle, FileSpreadsheet, Link2 } from "lucide-react";
import { ProductFrame } from "@/components/marketing/product/ProductFrame";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

export type ProductImportProps = {
  filename: string;
  review: number;
  match: string;
};

export function ProductImport({ filename, review, match }: ProductImportProps) {
  const reduceMotion = useMarketingReducedMotion();
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setComplete(true), reduceMotion ? 0 : 1200);
    return () => window.clearTimeout(timeout);
  }, [reduceMotion]);

  return (
    <ProductFrame title="Bring your business data" eyebrow="Migration Engine" toolbar={<span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[0.54rem] font-bold text-slate-600"><FileSpreadsheet className="h-3 w-3 text-emerald-600" />{filename}</span>}>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2.5">
          <p className="text-sm font-black tabular-nums text-amber-900">{complete ? `${review} to review` : "Profiling…"}</p>
        </div>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
          <p className="flex items-center gap-1.5 text-[0.54rem] font-bold text-amber-900"><AlertTriangle className="h-3 w-3" />Relationship to confirm</p>
          <m.div className="mt-2 flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 text-[0.5rem] font-semibold text-slate-600 ring-1 ring-amber-100" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
            <Link2 className="h-3 w-3 shrink-0 text-blue-600" />
            {match}
          </m.div>
        </div>
      </div>
    </ProductFrame>
  );
}
