"use client";

import { useEffect, useState } from "react";
import * as m from "motion/react-m";
import { Check, FileSignature, Send } from "lucide-react";
import { ProductFrame } from "@/components/marketing/product/ProductFrame";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

export type ProductContractFlowProps = {
  title: string;
  client: string;
  project: string;
  amount: string;
};

const states = ["Draft", "Sent", "Signed"] as const;

export function ProductContractFlow(props: ProductContractFlowProps) {
  const reduceMotion = useMarketingReducedMotion();
  const [stateIndex, setStateIndex] = useState(0);
  useEffect(() => {
    if (reduceMotion) {
      const final = window.setTimeout(() => setStateIndex(2), 0);
      return () => window.clearTimeout(final);
    }
    const sent = window.setTimeout(() => setStateIndex(1), 850);
    const signed = window.setTimeout(() => setStateIndex(2), 1650);
    return () => { window.clearTimeout(sent); window.clearTimeout(signed); };
  }, [reduceMotion]);
  const state = states[stateIndex];

  return (
    <ProductFrame title={props.title} eyebrow="Agreement composer" toolbar={<m.span key={state} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.56rem] font-bold ${state === "Signed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : state === "Sent" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}>{state === "Signed" ? <Check className="h-3 w-3" /> : state === "Sent" ? <Send className="h-3 w-3" /> : <FileSignature className="h-3 w-3" />}{state}</m.span>}>
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="font-mono text-[0.5rem] font-bold uppercase tracking-[0.12em] text-slate-600">Draft summary</p>
        <dl className="mt-3 grid gap-2.5 text-[0.56rem]">
          <div><dt className="text-slate-600">Client</dt><dd className="mt-0.5 font-bold text-slate-800">{props.client}</dd></div>
          <div><dt className="text-slate-600">Project</dt><dd className="mt-0.5 font-bold text-slate-800">{props.project}</dd></div>
          <div className="border-t border-slate-100 pt-2.5"><dt className="text-slate-600">Agreement total</dt><dd className="mt-0.5 text-base font-black text-slate-900">{props.amount}</dd></div>
        </dl>
      </div>
    </ProductFrame>
  );
}
