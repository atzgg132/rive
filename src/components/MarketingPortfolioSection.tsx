"use client";

import { ArrowRight, BarChart3, FileUp, Globe2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

const benefits = [
  [Globe2, "A polished public URL"],
  [FileUp, "Images and files uploaded directly"],
  [Sparkles, "Templates you can make your own"],
  [BarChart3, "Views, engagement, and enquiries"],
] as const;

export default function MarketingPortfolioSection() {
  const router = useRouter();
  return (
    <section id="portfolio" className="relative overflow-hidden bg-[#edf4ff] py-20 dark:bg-[#0b172b] sm:py-28">
      <div className="pointer-events-none absolute -right-40 top-8 h-96 w-96 rounded-full bg-blue-400/15 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-blue-700 dark:text-blue-300">
            Your reputation, ready to share
          </p>
          <h2 className="mt-4 max-w-xl text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-slate-950 dark:text-white">
            Your best work should win your next client.
          </h2>
          <p className="mt-6 max-w-lg text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
            Turn completed projects into a portfolio that feels considered, tells the story behind your work,
            and gives prospects a clear reason to contact you.
          </p>

          <div className="mt-8 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {benefits.map(([Icon, label]) => (
              <div key={label} className="flex items-start gap-3 text-sm font-bold leading-6 text-slate-800 dark:text-slate-100">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-blue-100 dark:bg-slate-900 dark:text-blue-300 dark:ring-slate-800">
                  <Icon size={16} />
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => router.push("/register")}
            className="group mt-9 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
          >
            Build your portfolio
            <ArrowRight size={17} className="transition group-hover:translate-x-1" />
          </button>
        </div>

        <div className="relative mx-auto w-full max-w-2xl">
          <div className="absolute -bottom-5 right-5 z-20 hidden rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur sm:block dark:border-slate-700 dark:bg-slate-900/95">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">This month</p>
            <p className="mt-1 text-2xl font-black text-slate-950 dark:text-white">1,284 views</p>
            <p className="mt-1 text-xs font-bold text-emerald-600">+18% engagement</p>
          </div>

          <div className="overflow-hidden rounded-[28px] border-[10px] border-slate-950 bg-white shadow-[0_35px_90px_rgba(15,23,42,.28)] dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-6">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-[10px] font-black text-white">AB</div>
                <span className="text-xs font-black text-slate-900 dark:text-white">arnav.design</span>
              </div>
              <span className="rounded-full bg-slate-950 px-3 py-1.5 text-[9px] font-black text-white dark:bg-white dark:text-slate-950">Start a project</span>
            </div>

            <div className="p-5 sm:px-8 sm:pt-8 sm:pb-24">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Product designer + developer</p>
                  <h3 className="mt-3 max-w-md text-2xl font-black leading-[1.03] tracking-[-.045em] text-slate-950 dark:text-white sm:text-4xl">
                    I design and build digital products people enjoy using.
                  </h3>
                </div>
                <div className="hidden h-16 w-16 shrink-0 rounded-2xl bg-[linear-gradient(145deg,#2563eb,#0f172a)] sm:block" />
              </div>

              <div className="mt-7 flex flex-wrap gap-2">
                {["Product strategy", "UX/UI design", "Web development"].map((service) => (
                  <span key={service} className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {service}
                  </span>
                ))}
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f4f7fb] dark:border-slate-800 dark:bg-slate-900">
                  <div className="relative h-28 bg-[#1d4ed8] p-4 sm:h-36">
                    <div className="h-full rounded-xl border border-white/20 bg-white/10 p-3">
                      <div className="h-2 w-20 rounded bg-white/80" />
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="h-12 rounded bg-white/90" />
                        <div className="h-12 rounded bg-white/20" />
                        <div className="h-12 rounded bg-white/20" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-[9px] font-black uppercase tracking-wider text-blue-600">Product design</p>
                    <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">Rive workspace</p>
                  </div>
                </article>

                <article className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f4f7fb] dark:border-slate-800 dark:bg-slate-900">
                  <div className="relative h-28 bg-slate-950 p-4 sm:h-36">
                    <div className="flex h-full items-end rounded-xl bg-[radial-gradient(circle_at_70%_30%,#38bdf8_0,#1e3a8a_35%,#0f172a_70%)] p-3">
                      <div className="rounded-lg bg-white/95 px-3 py-2 text-[9px] font-black text-slate-950">Bookings, simplified.</div>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-[9px] font-black uppercase tracking-wider text-blue-600">Design + build</p>
                    <p className="mt-1 text-sm font-black text-slate-950 dark:text-white">Studio Katha booking</p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
