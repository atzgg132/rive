"use client";

import { useEffect, useState } from "react";
import { FileText, Search } from "lucide-react";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

export function ProductCommandPalette({ query, results, placeholder }: { query: string; results: { title: string; meta: string }[]; placeholder: string }) {
  const reduceMotion = useMarketingReducedMotion();
  const [characters, setCharacters] = useState(reduceMotion ? query.length : 0);
  useEffect(() => {
    if (reduceMotion && characters < query.length) {
      const timeout = window.setTimeout(() => setCharacters(query.length), 0);
      return () => window.clearTimeout(timeout);
    }
    if (characters >= query.length) return;
    const timeout = window.setTimeout(() => setCharacters((value) => value + 1), 85);
    return () => window.clearTimeout(timeout);
  }, [characters, query.length, reduceMotion]);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_26px_80px_rgba(0,0,0,0.36)]">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3"><Search className="h-4 w-4 text-slate-600" /><span className="min-h-5 flex-1 text-xs text-slate-700">{query.slice(0, characters)}{characters === 0 ? <span className="text-slate-600">{placeholder}</span> : null}<span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-blue-600 align-middle" /></span><kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[0.48rem] text-slate-600">ESC</kbd></div>
      <div className="p-2"><p className="px-2 py-1 font-mono text-[0.48rem] font-bold uppercase tracking-[0.12em] text-slate-600">Invoices</p>{characters === query.length ? results.map((result, index) => <div key={result.title} className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 ${reduceMotion ? "" : "animate-fade-in-up"} ${index === 0 ? "bg-blue-50 text-blue-800" : "text-slate-700"}`} style={reduceMotion ? undefined : { animationDelay: `${index * 80}ms` }}><FileText className="h-4 w-4 shrink-0" /><span><span className="block text-xs font-bold">{result.title}</span><span className="mt-0.5 block text-[0.55rem] text-slate-600">{result.meta}</span></span></div>) : <div className="h-24" />}</div>
    </div>
  );
}
