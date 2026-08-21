"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Circle, Settings2, Target, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ActivationPlan } from "@/lib/activation";
import { Button } from "@/components/ui";

type ActivationCardProps = {
  plan: ActivationPlan;
  firstRun?: boolean;
  onDismissed?: () => void;
};

export function ActivationCard({ plan, firstRun = false, onDismissed }: ActivationCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(plan.guidanceDismissed);

  if (dismissed || plan.activationStage === "activated") return null;

  async function dismissGuidance() {
    setSaving(true);
    try {
      const response = await fetch("/api/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "skipped", mode: "automatic", guideId: "getting_started" }),
      });
      if (!response.ok) throw new Error("Guidance could not be hidden.");
      setDismissed(true);
      onDismissed?.();
    } catch {
      // The activation card is useful but should never block normal workspace use.
    } finally {
      setSaving(false);
    }
  }

  const recommended = plan.recommendedAction;

  return (
    <section
      aria-label="Getting started"
      data-testid="activation-card"
      className={`overflow-hidden rounded-2xl border border-blue-400/40 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-600/10 ${firstRun ? "p-5 sm:p-6" : "p-4 sm:p-5"}`}
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
            <Target className="h-4 w-4" />
            Today · {plan.stageLabel}
          </div>
          <h2 className={`mt-2 font-black tracking-tight ${firstRun ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"}`}>
            {plan.goalLabel}
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-5 text-blue-100">{plan.outcome}</p>

          <div className="mt-4 max-w-xl rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-blue-700">
                <ChevronRight className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">Recommended next</p>
                {recommended ? (
                  <Link href={recommended.href} data-guide-target="activation-primary" className="mt-1 block text-sm font-black text-white hover:underline">
                    {recommended.label}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm font-black text-white">Review your workspace</p>
                )}
                <p className="mt-1 text-xs leading-4 text-blue-100">{recommended?.description || "Your useful context is ready for a quick review."}</p>
              </div>
            </div>
            {recommended && (
              <Link href={recommended.href} data-guide-target="activation-primary" className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-blue-700 hover:bg-blue-50">
                {recommended.label}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        <div className="min-w-0 xl:w-[360px]">
          <div className="flex items-center justify-between gap-3 text-xs font-bold">
            <span>{plan.completed} of {plan.total} steps complete</span>
            <span>{plan.percentage}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${plan.percentage}%` }} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {plan.milestones.map((item) => (
              <Link key={item.id} href={item.href} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-bold ring-1 ring-white/15 transition hover:bg-white/15">
                <span className="flex min-w-0 items-center gap-2">
                  {item.complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-200" /> : <Circle className="h-4 w-4 shrink-0 text-blue-100" />}
                  <span className="truncate">{item.label}</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-blue-100" />
              </Link>
            ))}
          </div>
          {plan.secondaryActions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {plan.secondaryActions.map((action) => (
                <Link key={action.id} href={action.href} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-blue-50 ring-1 ring-white/15 hover:bg-white/15">
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/15 pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => setDetailsOpen((value) => !value)} className="h-auto px-0 text-xs font-bold text-white hover:bg-transparent hover:text-blue-100">
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          {detailsOpen ? "Hide Getting Started" : "Open Getting Started"}
        </Button>
        <Link href="/onboarding?restart=1&focus=goal" className="text-xs font-bold text-blue-100 hover:text-white hover:underline">Change goal</Link>
        <Button type="button" variant="ghost" size="sm" onClick={() => void dismissGuidance()} disabled={saving} className="ml-auto h-auto px-0 text-xs font-bold text-blue-100 hover:bg-transparent hover:text-white">
          <X className="mr-1.5 h-3.5 w-3.5" />
          Hide setup guidance
        </Button>
      </div>

      {detailsOpen && (
        <div className="mt-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15" data-testid="getting-started-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-100">Getting Started</p>
              <p className="mt-1 text-sm font-bold text-white">Follow the highlighted step when you are ready. You can return here from the Overview.</p>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-blue-100">{plan.completed}/{plan.total}</span>
          </div>
          {plan.unresolvedImportIssues > 0 && (
            <Link href="/onboarding?restart=1&focus=import" className="mt-3 inline-flex text-xs font-bold text-amber-100 underline">
              {plan.unresolvedImportIssues} imported relationship{plan.unresolvedImportIssues === 1 ? "" : "s"} need review
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

export function FirstVisitNote({ children }: { children: ReactNode }) {
  return <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">{children}</p>;
}
