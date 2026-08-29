import { Activity, Briefcase, CircleDollarSign, Receipt, TrendingUp } from "lucide-react";
import { MetricTicker } from "@/components/marketing/MetricTicker";
import { ProductFrame } from "@/components/marketing/product/ProductFrame";
import { SvgChart } from "@/components/marketing/product/SvgChart";

export type ProductDashboardProps = {
  title: string;
  metrics: { label: string; value: string; tone: "emerald" | "blue" | "rose" | "violet" }[];
  activity: string[];
};

const toneClasses = {
  emerald: "bg-emerald-50 text-emerald-700",
  blue: "bg-blue-50 text-blue-700",
  rose: "bg-rose-50 text-rose-700",
  violet: "bg-violet-50 text-violet-700",
};

const metricIcons = [CircleDollarSign, Briefcase, Receipt, TrendingUp];

export function ProductDashboard({ title, metrics, activity }: ProductDashboardProps) {
  return (
    <ProductFrame title={title} eyebrow="Overview">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = metricIcons[index % metricIcons.length];
          const numeric = Number(metric.value);
          return (
            <div
              key={metric.label}
              className="marketing-mock-in rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[0.55rem] font-semibold text-slate-600">{metric.label}</p>
                <span className={`grid h-6 w-6 place-items-center rounded-md ${toneClasses[metric.tone]}`}>
                  <Icon className="h-3 w-3" />
                </span>
              </div>
              <p className="mt-3 text-base font-black tabular-nums text-slate-900">
                {Number.isFinite(numeric) ? <MetricTicker value={numeric} /> : metric.value}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-[0.62rem] font-bold text-slate-800">Paid invoices and expenses</p>
            <span className="font-mono text-[0.48rem] font-semibold uppercase tracking-[0.12em] text-slate-600">Six months</span>
          </div>
          <SvgChart values={[22, 28, 25, 42, 51, 47, 67, 74, 70, 88]} label="Revenue rising over six months" className="mt-2 w-full" />
        </div>
        <div className="hidden rounded-xl border border-slate-200 bg-white p-3 lg:block">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-blue-600" />
            <p className="text-[0.62rem] font-bold text-slate-800">Recent activity</p>
          </div>
          <div className="mt-3 grid gap-2">
            {activity.map((item, index) => (
              <div
                key={item}
                className="marketing-mock-in-x rounded-lg bg-slate-50 px-2.5 py-2 text-[0.55rem] font-semibold leading-4 text-slate-600"
                style={{ animationDelay: `${0.3 + index * 0.1}s` }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProductFrame>
  );
}
