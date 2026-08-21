"use client";

import { ArrowRight, BarChart3, Clock3, FileSignature, FolderOpen, Globe2, Sparkles, Users, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import PageShell from "@/components/PageShell";
import { GUIDE_CATALOG, type GuideId } from "@/lib/guides";

type PublicGuideId = GuideId | "agreements";

// Agreements remain a useful public workflow guide, but they are not an
// activation goal, so they stay out of the adaptive in-workspace catalogue.
const PUBLIC_GUIDES = [
  ...GUIDE_CATALOG,
  {
    id: "agreements" as const,
    label: "Reviewing and recording an Agreement",
    description: "Draft from client and project context, share a review link, and connect accepted terms to billing.",
    outcome: "Client → agreement → invoice, with the decision recorded.",
    duration: "4 min",
    stepCount: 3,
    goal: "organize" as const,
    flow: ["Client", "Agreement", "Invoice"],
  },
];

const font = { fontFamily: "var(--font-body)" };
const fontD = { fontFamily: "var(--font-display)" };

const ICON_BY_GUIDE: Partial<Record<PublicGuideId, LucideIcon>> = {
  getting_started: FolderOpen,
  orientation: Sparkles,
  organize: Users,
  calendar: Clock3,
  get_paid: FileSignature,
  understand_finances: BarChart3,
  publish_portfolio: Globe2,
  migrate: FolderOpen,
  agreements: FileSignature,
};

const COLOR_BY_GUIDE: Partial<Record<PublicGuideId, { color: string; bg: string; darkBg: string }>> = {
  getting_started: { color: "text-blue-600", bg: "bg-blue-50", darkBg: "dark:bg-blue-950/40" },
  orientation: { color: "text-violet-600", bg: "bg-violet-50", darkBg: "dark:bg-violet-950/40" },
  organize: { color: "text-purple-600", bg: "bg-purple-50", darkBg: "dark:bg-purple-950/40" },
  calendar: { color: "text-indigo-600", bg: "bg-indigo-50", darkBg: "dark:bg-indigo-950/40" },
  get_paid: { color: "text-rose-600", bg: "bg-rose-50", darkBg: "dark:bg-rose-950/40" },
  understand_finances: { color: "text-emerald-600", bg: "bg-emerald-50", darkBg: "dark:bg-emerald-950/40" },
  publish_portfolio: { color: "text-amber-600", bg: "bg-amber-50", darkBg: "dark:bg-amber-950/40" },
  migrate: { color: "text-teal-600", bg: "bg-teal-50", darkBg: "dark:bg-teal-950/40" },
  agreements: { color: "text-indigo-600", bg: "bg-indigo-50", darkBg: "dark:bg-indigo-950/40" },
};

export default function GuidesPage() {
  const router = useRouter();

  return (
    <PageShell>
      <section className="relative overflow-hidden py-24">
        <div className="pointer-events-none absolute left-1/3 top-0 h-[300px] w-[500px] rounded-full bg-blue-100/15 blur-[110px]" />
        <div className="relative mx-auto max-w-5xl px-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/50 px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-400" style={font}>
            Learn by doing
          </div>
          <h1 className="mb-4 text-6xl font-bold tracking-tight text-foreground dark:text-white" style={fontD}>
            Learn Rive through your work.
          </h1>
          <p className="mb-14 max-w-xl text-lg leading-relaxed text-slate-500 dark:text-slate-400" style={font}>
            Choose the outcome you care about. Rive will help you connect the real client, work, money, and proof behind it.
          </p>

          <div className="mb-16 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
            {PUBLIC_GUIDES.map((guide) => {
              const Icon = ICON_BY_GUIDE[guide.id] || Sparkles;
              const colors = COLOR_BY_GUIDE[guide.id] || COLOR_BY_GUIDE.orientation!;
              return (
                <article key={guide.id} className="group flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-200 hover:border-slate-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:shadow-none dark:hover:border-slate-700 dark:hover:shadow-blue-900/20">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors.bg} ${colors.darkBg}`}>
                    <Icon className={`h-5 w-5 ${colors.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h2 className="text-sm font-bold leading-snug text-foreground dark:text-white" style={fontD}>{guide.label}</h2>
                      <span className="shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500">{guide.duration}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400" style={font}>{guide.description}</p>
                    <p className="mt-3 text-xs font-semibold leading-relaxed text-foreground dark:text-slate-200" style={font}>{guide.outcome}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/register?goal=${encodeURIComponent(guide.goal || "organize")}`)}
                    className="w-full justify-between"
                  >
                    Start with this outcome
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </article>
              );
            })}
          </div>

          <div className="mx-auto max-w-xl rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
            <h2 className="mb-2 text-xl font-bold text-foreground dark:text-white" style={fontD}>Already have an account?</h2>
            <p className="mb-5 text-sm text-slate-500 dark:text-slate-400" style={font}>
              Open Help &amp; guides inside your workspace to resume a guide with your own data.
            </p>
            <Button
              type="button"
              onClick={() => router.push("/login")}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/15 transition-all duration-200 hover:from-blue-700 hover:to-sky-600"
              style={fontD}
            >
              Open your workspace <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
