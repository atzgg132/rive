"use client";

import { useEffect, useState } from "react";
import * as m from "motion/react-m";
import { CheckCircle2, FileSignature } from "lucide-react";
import { ProductFrame } from "@/components/marketing/product/ProductFrame";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

export type ProductInvoiceFlowProps = {
  number: string;
  client: string;
  project: string;
  total: string;
  issued: string;
  due: string;
  items: { label: string; amount: string }[];
};

export function ProductInvoiceFlow(props: ProductInvoiceFlowProps) {
  const reduceMotion = useMarketingReducedMotion();
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setPaid(true), reduceMotion ? 0 : 1250);
    return () => window.clearTimeout(timeout);
  }, [reduceMotion]);

  return (
    <ProductFrame title={props.number} eyebrow="Revenue & invoices" toolbar={<m.span key={paid ? "paid" : "pending"} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.58rem] font-bold ${paid ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{paid ? <CheckCircle2 className="h-3 w-3" /> : null}{paid ? "Paid" : "Pending"}</m.span>}>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div><p className="text-sm font-black text-slate-900">{props.client}</p><p className="mt-1 text-[0.58rem] text-slate-600">{props.project}</p></div>
          <div className="text-right"><p className="font-mono text-[0.5rem] font-semibold uppercase tracking-[0.12em] text-slate-600">Total</p><p className="mt-1 text-lg font-black tabular-nums text-slate-900">{props.total}</p></div>
        </div>
        <dl className="grid grid-cols-2 gap-3 border-b border-slate-100 py-3 text-[0.58rem]"><div><dt className="text-slate-600">Issued</dt><dd className="mt-1 font-bold text-slate-700">{props.issued}</dd></div><div><dt className="text-slate-600">Due</dt><dd className="mt-1 font-bold text-slate-700">{props.due}</dd></div></dl>
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-[1fr_auto] bg-slate-50 px-3 py-2 font-mono text-[0.48rem] font-bold uppercase tracking-[0.1em] text-slate-600"><span>Description</span><span>Amount</span></div>
          {props.items.map((item, index) => <m.div key={item.label} className="grid grid-cols-[1fr_auto] gap-3 border-t border-slate-100 px-3 py-2.5 text-[0.6rem]" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.12 }}><span className="font-semibold text-slate-700">{item.label}</span><span className="font-bold tabular-nums text-slate-900">{item.amount}</span></m.div>)}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[0.55rem] font-bold text-slate-600"><FileSignature className="h-3 w-3" /> Linked Agreement</span>
          <m.span animate={paid ? { scale: [1, 1.04, 1] } : {}} className={`rounded-lg px-3 py-2 text-[0.58rem] font-black ${paid ? "bg-emerald-700 text-white" : "bg-blue-700 text-white"}`}>{paid ? "Payment recorded" : "Record payment"}</m.span>
        </div>
      </div>
    </ProductFrame>
  );
}
