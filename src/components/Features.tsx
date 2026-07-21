"use client";

import {
  FolderKanban,
  Users,
  DollarSign,
  Receipt,
  Sparkles,
  LayoutGrid,
  FileSignature,
  TrendingUp,
  Bot,
} from "lucide-react";

const features = [
  {
    icon: FolderKanban,
    title: "Project Management",
    description: "End-to-end tracking with milestones, tasks, and timelines. Never miss a deadline.",
    color: "blue",
    wide: false,
  },
  {
    icon: Users,
    title: "Client Management",
    description: "A powerful CRM built for freelancers. Track relationships, history, and communication.",
    color: "indigo",
    wide: false,
  },
  {
    icon: TrendingUp,
    title: "Income & Spends Tracker",
    description: "Personal-finance-style dashboard showing your real financial health at a glance.",
    color: "emerald",
    wide: false,
  },
  {
    icon: Bot,
    title: "AI Co-Pilot",
    description:
      "AI-assisted functions across every suite — with double confirmation for sensitive decisions. Your smartest team member.",
    color: "blue",
    wide: true,
    highlight: true,
  },
  {
    icon: DollarSign,
    title: "Revenue Management",
    description: "Invoice, billing, and revenue analytics tailored for your freelance business.",
    color: "emerald",
    wide: false,
  },
  {
    icon: Receipt,
    title: "Expense Management",
    description: "Track, categorize, and analyze spending. Know exactly where every dollar goes.",
    color: "amber",
    wide: false,
  },
  {
    icon: Sparkles,
    title: "Lead Gen Assistant",
    description: "AI-powered outreach that finds and qualifies leads so you spend time closing, not prospecting.",
    color: "rose",
    wide: false,
  },
  {
    icon: FileSignature,
    title: "Agreement Signing",
    description: "Sign gig agreements digitally — auto-transferred to your Project Management suite.",
    color: "indigo",
    wide: false,
  },
];

const colorMap: Record<string, { bg: string; border: string; icon: string; badgeBg: string }> = {
  blue:    { bg: "bg-blue-50/50",    border: "border-blue-100/60",    icon: "text-blue-600",    badgeBg: "bg-blue-100/50" },
  indigo:  { bg: "bg-indigo-50/50",  border: "border-indigo-100/60",  icon: "text-indigo-600",  badgeBg: "bg-indigo-100/50" },
  emerald: { bg: "bg-emerald-50/50", border: "border-emerald-100/60", icon: "text-emerald-600", badgeBg: "bg-emerald-100/50" },
  amber:   { bg: "bg-amber-50/50",   border: "border-amber-100/60",   icon: "text-amber-600",   badgeBg: "bg-amber-100/50" },
  rose:    { bg: "bg-rose-50/50",    border: "border-rose-100/60",    icon: "text-rose-600",    badgeBg: "bg-rose-100/50" },
};

export default function Features() {
  return (
    <section id="features" className="relative bg-[#F5F8FC] dark:bg-[#0B1120] py-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-100/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-100 bg-blue-50/50 text-xs font-semibold text-blue-600 mb-5">
            <LayoutGrid className="w-3 h-3 shrink-0" />
            <span style={{ fontFamily: "var(--font-body)" }}>Everything you need</span>
          </div>
          <h2
            className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-white mb-5 tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            One platform.{" "}
            <span className="bg-gradient-to-r from-blue-600 to-sky-500 bg-clip-text text-transparent">
              Infinite possibilities.
            </span>
          </h2>
          <p
            className="text-slate-600 dark:text-slate-300 text-lg max-w-lg mx-auto leading-relaxed"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Every tool a freelancer or business needs — deeply integrated and supercharged by AI.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => {
            const { icon: Icon, title, description, color, wide, highlight } = feature;
            const c = colorMap[color];
            return (
              <div
                key={title}
                onClick={() => window.dispatchEvent(new CustomEvent("open-modal", { detail: "waitlist" }))}
                className={`relative group rounded-2xl p-7 bg-white border border-slate-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-100/30 cursor-pointer ${
                  highlight ? "lg:col-span-2 border-blue-100" : ""
                }`}
              >
                {/* Highlight gradient background */}
                {highlight && (
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-50/40 to-sky-50/20 opacity-100 transition-opacity duration-300 pointer-events-none" />
                )}

                <div className="relative flex flex-col gap-4 h-full">
                  {/* Icon box */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.bg} border ${c.border} shrink-0`}>
                    <Icon className={`w-5 h-5 ${c.icon}`} />
                  </div>

                  {/* Text */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-2">
                      <h3
                        className="text-slate-800 font-bold text-[17px]"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {title}
                      </h3>
                      {highlight && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100/50 text-blue-700 font-semibold border border-blue-100/60"
                          style={{ fontFamily: "var(--font-body)" }}
                        >
                          AI-Powered
                        </span>
                      )}
                    </div>
                    <p
                      className="text-slate-500 text-sm leading-relaxed"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {description}
                    </p>
                  </div>

                  {/* Hover link */}
                  <div
                    className={`flex items-center gap-1 text-sm font-semibold ${c.icon} opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-1`}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Learn more
                    <span className="group-hover:translate-x-0.5 transition-transform inline-block">→</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
