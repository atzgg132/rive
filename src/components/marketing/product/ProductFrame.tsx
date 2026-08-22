import type { ReactNode } from "react";
import { Bell, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductFrame({ title, eyebrow, children, className, toolbar }: { title: string; eyebrow: string; children: ReactNode; className?: string; toolbar?: ReactNode }) {
  return (
    <div data-product-frame className={cn("overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#f5f8fc] text-[#0c1e36] shadow-[0_35px_100px_rgba(0,0,0,0.48)]", className)}>
      <div className="flex h-11 items-center gap-2 border-b border-slate-200/80 bg-white px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-2 font-mono text-[0.55rem] font-bold uppercase tracking-[0.14em] text-slate-600">rive.work</span>
        <div className="ml-auto flex items-center gap-1.5 text-slate-600"><Search className="h-3.5 w-3.5" /><Bell className="h-3.5 w-3.5" /></div>
      </div>
      <div className="flex min-h-[27rem]">
        <aside className="hidden w-[4.25rem] shrink-0 border-r border-slate-200 bg-white py-4 sm:block" aria-hidden="true">
          <div className="mx-auto grid h-7 w-7 place-items-center rounded-lg bg-[#0c1e36] text-[0.6rem] font-black text-white">r.</div>
          <div className="mx-auto mt-6 grid w-8 gap-2">
            {[0, 1, 2, 3, 4].map((item) => <span key={item} className={`h-7 rounded-lg ${item === 0 ? "bg-blue-50 ring-1 ring-blue-100" : "bg-slate-100/80"}`} />)}
          </div>
        </aside>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[0.55rem] font-bold uppercase tracking-[0.14em] text-blue-600">{eyebrow}</p>
              <p className="mt-1 text-lg font-black leading-tight tracking-[-0.03em] text-slate-900">{title}</p>
            </div>
            {toolbar || <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[0.58rem] font-bold text-slate-600">View details <ChevronRight className="h-3 w-3" /></span>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
