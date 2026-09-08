"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, Circle, Settings2, Target, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { ActivationPlan } from "@/lib/activation";
import { Button, Kicker } from "@/components/ui";

type ActivationCardProps = {
  plan: ActivationPlan;
  firstRun?: boolean;
  engagementFlowEnabled?: boolean;
  onDismissed?: () => void;
};

export function ActivationCard({ plan, firstRun = false, engagementFlowEnabled = false, onDismissed }: ActivationCardProps) {
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

  const recommended = engagementFlowEnabled && (plan.counts.clients === 0 || plan.counts.projects === 0)
    ? {
        id: "start_engagement",
        label: "New client work",
        description: "Create the client, work, and optional billing draft together.",
        href: "/workflow/start-engagement",
      }
    : plan.recommendedAction;

  return (
    <section
      aria-label="Getting started"
      data-testid="activation-card"
      className={`overflow-hidden rounded-none border border-primary-strong bg-primary text-primary-foreground ${firstRun ? "p-5 sm:p-6" : "p-4 sm:p-5"}`}
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 max-w-2xl">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <Kicker className="text-primary-foreground">Today · {plan.stageLabel}</Kicker>
          </div>
          <h2 className={`mt-2 font-black tracking-tight ${firstRun ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"}`}>
            {plan.goalLabel}
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-5 text-primary-foreground/80">{plan.outcome}</p>

          <div className="mt-4 max-w-xl rounded-none bg-primary-foreground/10 p-3 ring-1 ring-primary-foreground/15">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-none bg-primary-foreground text-primary">
                <ChevronRight className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <Kicker className="text-primary-foreground">Recommended next</Kicker>
                {recommended ? (
                  <Link href={recommended.href} data-guide-target="activation-primary" className="mt-1 block text-sm font-black text-primary-foreground hover:underline">
                    {recommended.label}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm font-black text-primary-foreground">Review your workspace</p>
                )}
                <p className="mt-1 text-xs leading-4 text-primary-foreground/80">{recommended?.description || "Your useful context is ready for a quick review."}</p>
              </div>
            </div>
            {recommended && (
              <Link href={recommended.href} data-guide-target="activation-primary" className="mt-2 inline-flex items-center gap-2 rounded-none bg-primary-foreground px-3.5 py-2 text-xs font-black text-primary hover:bg-primary-foreground/90">
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
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-none bg-primary-foreground/20">
            <div className="h-full rounded-none bg-primary-foreground transition-[width]" style={{ width: `${plan.percentage}%` }} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {plan.milestones.map((item) => (
              <Link key={item.id} href={item.href} className="flex min-h-11 items-center justify-between gap-3 rounded-none bg-primary-foreground/10 px-3 py-2.5 text-xs font-bold ring-1 ring-primary-foreground/15 transition hover:bg-primary-foreground/15">
                <span className="flex min-w-0 items-center gap-2">
                  {item.complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-foreground" /> : <Circle className="h-4 w-4 shrink-0 text-primary-foreground/60" />}
                  <span className="truncate">{item.label}</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary-foreground/60" />
              </Link>
            ))}
          </div>
          {plan.secondaryActions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {plan.secondaryActions.map((action) => (
                <Link key={action.id} href={action.href} className="rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-bold text-primary-foreground ring-1 ring-primary-foreground/15 hover:bg-primary-foreground/15">
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-primary-foreground/15 pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => setDetailsOpen((value) => !value)} className="h-auto px-0 text-xs font-bold text-primary-foreground hover:bg-transparent hover:text-primary-foreground/80">
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          {detailsOpen ? "Hide Getting Started" : "Open Getting Started"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => window.dispatchEvent(new Event("rive:open-help"))}
          className="h-auto px-0 text-xs font-bold text-primary-foreground/80 hover:bg-transparent hover:text-primary-foreground hover:underline"
        >
          Explore another guide
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void dismissGuidance()} disabled={saving} className="ml-auto h-auto px-0 text-xs font-bold text-primary-foreground/80 hover:bg-transparent hover:text-primary-foreground">
          <X className="mr-1.5 h-3.5 w-3.5" />
          Hide setup guidance
        </Button>
      </div>

      {detailsOpen && (
        <div className="mt-4 rounded-none bg-primary-foreground/10 p-4 ring-1 ring-primary-foreground/15" data-testid="getting-started-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Kicker className="text-primary-foreground">Getting Started</Kicker>
              <p className="mt-1 text-sm font-bold text-primary-foreground">Follow the highlighted step when you are ready. You can return here from the Overview.</p>
            </div>
            <span className="rounded-full bg-primary-foreground/10 px-2.5 py-1 text-xs font-bold text-primary-foreground">{plan.completed}/{plan.total}</span>
          </div>
          {plan.unresolvedImportIssues > 0 && (
            <Link href="/migrate" className="mt-3 inline-flex text-xs font-bold text-primary-foreground underline">
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
