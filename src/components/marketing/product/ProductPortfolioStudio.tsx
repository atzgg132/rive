"use client";

import * as m from "motion/react-m";
import { BarChart3, Eye } from "lucide-react";
import { ProductFrame } from "@/components/marketing/product/ProductFrame";
import { SvgChart } from "@/components/marketing/product/SvgChart";

export type ProductPortfolioStudioProps = {
  name: string;
  tagline: string;
  project: string;
  views: number[];
};

export function ProductPortfolioStudio(props: ProductPortfolioStudioProps) {
  return (
    <ProductFrame title="Portfolio Studio" eyebrow="Proof">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#f7f7f4] shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <span className="text-[0.58rem] font-black text-slate-900">{props.name}<span className="text-blue-600">.</span></span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[0.46rem] font-bold text-slate-600"><Eye className="h-2.5 w-2.5 text-blue-600" />Public preview</span>
        </div>
        <div className="p-3">
          <p className="font-mono text-[0.46rem] font-bold uppercase tracking-[0.12em] text-blue-600">{props.tagline}</p>
          <m.div className="mt-2.5 min-w-0 rounded-lg bg-white p-2.5 ring-1 ring-slate-200" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <div className="h-16 rounded-md bg-gradient-to-br from-blue-800 to-blue-400" />
            <p className="mt-2 text-[0.52rem] font-bold text-slate-700">{props.project}</p>
          </m.div>
          <div className="mt-2.5 rounded-lg border border-slate-200 bg-white p-2.5">
            <p className="flex items-center gap-1 text-[0.5rem] font-bold text-slate-700"><BarChart3 className="h-3 w-3 text-blue-600" />Portfolio views</p>
            <SvgChart values={props.views} label="Portfolio view trend" className="mt-1 h-12 w-full" />
          </div>
        </div>
      </div>
    </ProductFrame>
  );
}
