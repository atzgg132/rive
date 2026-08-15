"use client";

import { ArrowRight, CalendarDays, CheckCircle2, FileSpreadsheet, Rss } from "lucide-react";

type MarketingConnectionsSectionProps = {
  googleCalendarEnabled: boolean;
};

export default function MarketingConnectionsSection({ googleCalendarEnabled }: MarketingConnectionsSectionProps) {
  const connections = [
    {
      icon: FileSpreadsheet,
      title: "CSV and XLSX imports",
      status: "Available now",
      description: "Bring clients, projects, invoices, and expenses over from the exports you already have.",
    },
    {
      icon: Rss,
      title: "Apple Calendar feed",
      status: "Available now",
      description: "Subscribe to a private, read-only feed of Rive deadlines, tasks, and scheduled work.",
    },
    ...(googleCalendarEnabled
      ? [{
          icon: CalendarDays,
          title: "Google Calendar",
          status: "Available now",
          description: "Discover calendars, import events, and sync new Rive events back to Google.",
        }]
      : []),
  ];

  return (
    <section id="connections" className="relative overflow-hidden border-y border-slate-200/80 bg-slate-50 py-24 dark:border-slate-800 dark:bg-slate-900/40 sm:py-32">
      <div className="pointer-events-none absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700 dark:text-cyan-300">Bring your work with you</p>
            <h2 className="mt-4 max-w-xl text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-slate-900 dark:text-white">
              Start with the data you already have.
            </h2>
          </div>
          <p className="max-w-xl text-lg leading-8 text-slate-500 dark:text-slate-400">
            Rive gives you a practical way in: import exports, connect calendars, and keep the records that matter linked to the workflows they power. Direct accounting connections stay gated until their import and recovery paths are ready for production.
          </p>
        </div>

        <div className={`mt-14 grid gap-4 ${connections.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {connections.map(({ icon: Icon, title, status, description }) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> {status}
                </span>
              </div>
              <h3 className="mt-12 text-2xl font-black text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{description}</p>
            </article>
          ))}
        </div>

        <button
          type="button"
          onClick={() => { window.location.href = "/register"; }}
          className="group mt-10 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950"
        >
          Bring your work into Rive
          <ArrowRight size={17} className="transition group-hover:translate-x-1" />
        </button>
      </div>
    </section>
  );
}
