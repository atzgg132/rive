"use client";

import {
  FolderKanban,
  Users,
  DollarSign,
  Receipt,
  Sparkles,
  LayoutGrid,
  FileSignature,
  CalendarDays,
  TrendingUp,
  Bot,
} from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: FolderKanban,
    title: "Project delivery",
    description: "Plan projects, milestones, tasks, priorities, budgets, and deadlines without losing context.",
  },
  {
    icon: Users,
    title: "Client relationships",
    description: "Keep contact details, project history, invoices, notes, and lifetime value in one client record.",
  },
  {
    icon: TrendingUp,
    title: "Business overview",
    description: "Understand revenue, expenses, receivables, margins, and upcoming work at a glance.",
  },
  {
    icon: Bot,
    title: "Connected calendar",
    description:
      "See meetings, project deadlines, milestones, invoice due dates, and scheduled focus blocks on one timeline.",
    highlight: true,
  },
  {
    icon: DollarSign,
    title: "Invoicing and revenue",
    description: "Create invoices, track payment status, monitor collections, and understand who drives your revenue.",
  },
  {
    icon: Receipt,
    title: "Expense tracking",
    description: "Categorize costs, link expenses to projects, and separate billable spending from overhead.",
  },
  {
    icon: Sparkles,
    title: "Public portfolio",
    description: "Turn your work into a polished, shareable portfolio with case studies and privacy-conscious analytics.",
  },
  {
    icon: FileSignature,
    title: "Contracts & acceptance",
    description: "Create versioned contracts, collect recorded acceptance, and connect payment terms to deliberate invoice triggers.",
  },
  {
    icon: CalendarDays,
    title: "Imports and onboarding",
    description: "Bring in CSV/XLSX exports, subscribe to an Apple Calendar feed, and start with a guided first workflow instead of an empty session.",
  },
];

export default function Features({ agreementsEnabled = true }: { agreementsEnabled?: boolean }) {
  const visibleFeatures = agreementsEnabled
    ? features
    : features.filter((feature) => feature.title !== "Contracts & acceptance");
  return (
    <section id="features" className="relative bg-background dark:bg-background py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-100/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/40 text-xs font-semibold text-blue-600 dark:text-blue-400 mb-5">
            <LayoutGrid className="w-3 h-3 shrink-0" />
            <span style={{ fontFamily: "var(--font-body)" }}>One connected workspace</span>
          </div>
          <h2
            className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-slate-900 dark:text-white mb-5"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Everything your service business needs, <br />
            <span className="text-blue-700 dark:text-blue-400">working as one system.</span>
          </h2>
          <p
            className="text-slate-600 dark:text-slate-300 text-lg max-w-xl mx-auto font-normal leading-relaxed"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Client management, project delivery, financial control, scheduling, and business development—connected without enterprise complexity.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleFeatures.map((feature) => {
            const { icon: Icon, title, description, highlight } = feature;
            return (
              <div
                key={title}
                className={`relative group rounded-2xl p-7 border transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:shadow-blue-900/20 ${
                  highlight
                    ? "bg-blue-50/50 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900/40"
                    : "bg-white border-slate-100 dark:bg-slate-900/90 dark:border-slate-800/80"
                }`}
              >
                <div className="flex flex-col gap-4 h-full">
                  {/* Icon box */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-blue-50 dark:bg-blue-950/40 border border-blue-100/60 dark:border-blue-900/40 shrink-0">
                    <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>

                  {/* Text */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-2">
                      <h3
                        className="text-slate-800 dark:text-white font-bold text-[17px]"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {title}
                      </h3>
                      {highlight && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100/50 text-blue-700 font-semibold border border-blue-100/60"
                          style={{ fontFamily: "var(--font-body)" }}
                        >
                          Connected
                        </span>
                      )}
                    </div>
                    <p
                      className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/15 transition hover:-translate-y-px hover:from-blue-700 hover:to-sky-600"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Create a free account
          </Link>
        </div>
      </div>
    </section>
  );
}
