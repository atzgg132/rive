import { ArrowUpRight, BarChart3, Eye, Sparkles } from "lucide-react";
import { ProductFrame } from "@/components/marketing/product/ProductFrame";
import { SvgChart } from "@/components/marketing/product/SvgChart";

export type ProductPortfolioStudioProps = {
  name: string;
  tagline: string;
  headline: string;
  projects: string[];
  views: number[];
};

export function ProductPortfolioStudio(props: ProductPortfolioStudioProps) {
  return (
    <ProductFrame title="Portfolio Studio" eyebrow="Proof">
      <div className="grid gap-3 lg:grid-cols-[.62fr_1.38fr]">
        <div className="hidden rounded-xl border border-slate-200 bg-white p-3 lg:block">
          <p className="font-mono text-[0.5rem] font-bold uppercase tracking-[0.12em] text-slate-600">Sections</p>
          <div className="mt-3 grid gap-2">
            {["Identity", "Selected work", "Services", "About", "Contact"].map((item, index) => (
              <div
                key={item}
                className={`marketing-mock-in-x flex items-center justify-between rounded-lg px-2.5 py-2 text-[0.56rem] font-bold ${
                  index === 1 ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100" : "bg-slate-50 text-slate-600"
                }`}
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <span>{item}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${index < 4 ? "bg-emerald-400" : "bg-slate-300"}`} />
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-slate-900 p-2.5 text-white">
            <div className="flex items-center gap-1.5">
              <Eye className="h-3 w-3 text-blue-300" />
              <span className="text-[0.54rem] font-bold">Public preview</span>
            </div>
            <p className="mt-1 text-[0.48rem] text-slate-400">Changes stay private until publish.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-[#f7f7f4] shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
            <span className="text-[0.58rem] font-black text-slate-900">
              {props.name}
              <span className="text-blue-600">.</span>
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[0.46rem] font-bold text-slate-600">Let&apos;s talk</span>
          </div>
          <div className="p-4">
            <p className="flex items-center gap-1 font-mono text-[0.46rem] font-bold uppercase tracking-[0.12em] text-blue-600">
              <Sparkles className="h-2.5 w-2.5" />
              {props.tagline}
            </p>
            <p className="mt-2 max-w-sm text-xl font-black leading-[0.98] tracking-[-0.055em] text-slate-900">{props.headline}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {props.projects.map((project, index) => (
                <div
                  key={project}
                  className="marketing-mock-in min-w-0 rounded-lg bg-white p-2 ring-1 ring-slate-200"
                  style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                >
                  <div
                    className={`h-12 rounded-md ${
                      index === 0
                        ? "bg-gradient-to-br from-blue-700 to-cyan-400"
                        : index === 1
                          ? "bg-gradient-to-br from-indigo-700 to-blue-300"
                          : "bg-gradient-to-br from-slate-800 to-blue-600"
                    }`}
                  />
                  <p className="mt-2 truncate text-[0.48rem] font-bold text-slate-700">{project}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
              <div>
                <p className="flex items-center gap-1 text-[0.5rem] font-bold text-slate-700">
                  <BarChart3 className="h-3 w-3 text-blue-600" />
                  Portfolio views
                </p>
                <SvgChart values={props.views} label="Portfolio view trend" className="mt-1 h-14 w-full" />
              </div>
              <span className="inline-flex items-center gap-1 text-[0.5rem] font-bold text-blue-700">
                Analytics <ArrowUpRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </ProductFrame>
  );
}
