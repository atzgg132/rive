"use client";

import { useSyncExternalStore } from "react";
import { ArrowRight, Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui";
import type { PortfolioContent } from "@/utils/portfolio";

/**
 * What to do next, rather than how complete you are.
 *
 * The studio knew exactly what was missing and reported it as "71%". A grade
 * tells someone they are being marked; it does not tell them where to go. Each
 * item here names the gap in plain words and moves the editor to the field that
 * closes it.
 *
 * Split into two groups on purpose. Everything under "essentials" is the
 * difference between a portfolio that works and one that reads as unfinished;
 * everything under "worth doing" genuinely can wait, and saying so stops the
 * list feeling like six equal obligations.
 */

export type StudioSection = "profile" | "work" | "practices" | "services" | "proof" | "design";

export type PortfolioStep = {
  id: string;
  label: string;
  done: boolean;
  section: StudioSection;
  essential: boolean;
};

export function getPortfolioSteps(
  content: PortfolioContent,
  seo: { title: string; description: string },
  status: string,
): PortfolioStep[] {
  const publicProjects = content.projects.filter((project) => project.visibility !== "private");
  const namedProject = publicProjects.find((project) => project.title.trim());
  const projectWithoutCover = publicProjects.find(
    (project) => project.title.trim() && !project.imageUrl.trim() && !(project.media || []).some((item) => item.kind === "image"),
  );

  return [
    { id: "name", label: "Add your name", done: Boolean(content.name.trim()), section: "profile", essential: true },
    {
      id: "headline",
      label: "Write a headline and short introduction",
      done: Boolean(content.headline.trim() && content.bio.trim()),
      section: "profile",
      essential: true,
    },
    { id: "project", label: "Add one project you want to be hired for", done: Boolean(namedProject), section: "work", essential: true },
    {
      id: "cover",
      // Named, because "add a cover image" is useless when you have four projects.
      label: projectWithoutCover ? `Add a cover image to ${projectWithoutCover.title.trim()}` : "Give every project a cover image",
      done: Boolean(namedProject) && !projectWithoutCover,
      section: "work",
      essential: true,
    },
    {
      id: "contact",
      label: "Add a contact email so people can reach you",
      done: Boolean(content.contactEmail.trim()),
      section: "profile",
      essential: true,
    },
    {
      id: "service",
      label: "Describe at least one service you offer",
      done: content.services.some((service) => Boolean(service.title.trim())),
      section: "services",
      essential: false,
    },
    {
      id: "proof",
      label: "Add a testimonial from past work",
      done: content.testimonials.some((item) => Boolean(item.quote.trim())),
      section: "proof",
      essential: false,
    },
    {
      id: "seo",
      label: "Write the title and description search engines will show",
      done: Boolean(seo.title.trim() && seo.description.trim()),
      section: "design",
      essential: false,
    },
    { id: "publish", label: "Publish your portfolio", done: status === "published", section: "profile", essential: true },
  ];
}

/* Dismissal is keyed by what the list currently says, not by a flag. Put the
   congratulations away and it stays away for the session — but the moment the
   advice changes, because a new project needs a cover or the portfolio went back
   to draft, the key no longer matches and the card returns. Session storage, so
   a later visit starts clean: this is "not now", not "never again". */
const DISMISS_KEY = "rive:portfolio-worklist-dismissed";

/* Session storage read through `useSyncExternalStore` rather than an effect.
   The server has no storage, so the first paint must assume nothing is
   dismissed; this is the one hook that hydrates from an outside source without
   a setState-in-effect cascade, and it re-renders every mounted card when one
   of them is dismissed. */
let dismissedCache: string | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function getDismissedSnapshot(): string | null {
  if (!hydrated) {
    hydrated = true;
    try {
      dismissedCache = window.sessionStorage.getItem(DISMISS_KEY);
    } catch {
      dismissedCache = null;
    }
  }
  return dismissedCache;
}

function subscribeToDismissed(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function rememberDismissed(signature: string) {
  dismissedCache = signature;
  hydrated = true;
  try {
    window.sessionStorage.setItem(DISMISS_KEY, signature);
  } catch {
    /* Private mode or a full quota: the card still closes for this render. */
  }
  for (const listener of listeners) listener();
}

export default function PortfolioNextSteps({
  steps,
  onGoTo,
}: {
  steps: PortfolioStep[];
  onGoTo: (section: StudioSection) => void;
}) {
  const outstanding = steps.filter((step) => !step.done);
  const essentials = outstanding.filter((step) => step.essential);
  const optional = outstanding.filter((step) => !step.essential);
  const done = steps.length - outstanding.length;
  const signature = outstanding.length === 0 ? "complete" : outstanding.map((step) => step.id).join(",");

  const dismissedSignature = useSyncExternalStore(subscribeToDismissed, getDismissedSnapshot, () => null);

  if (dismissedSignature === signature) return null;

  const dismissButton = (
    <Button
      type="button"
      onClick={() => rememberDismissed(signature)}
      aria-label="Hide this for now"
      title="Hide this for now"
      data-portfolio-worklist-dismiss
      className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );

  if (outstanding.length === 0) {
    return (
      <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Your portfolio has everything it needs.</p>
          <p className="mt-0.5 text-xs leading-5 text-emerald-800/80 dark:text-emerald-200/80">
            Keep it current as new work lands — that matters more than anything left on a checklist.
          </p>
        </div>
        {dismissButton}
      </section>
    );
  }

  /* Only the first two essentials are shown. A list of nine things to fix is a
     wall; the next one or two is a next move. */
  const shown = (essentials.length ? essentials : optional).slice(0, 2);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {essentials.length ? "Next up" : "Worth doing"}
        </p>
        <div className="flex items-center gap-1">
          <p className="text-[11px] text-muted-foreground">
            {done} of {steps.length} done
            {essentials.length === 0 && " · essentials complete"}
          </p>
          {dismissButton}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {shown.map((step) => (
          <li key={step.id}>
            <Button
              type="button"
              onClick={() => onGoTo(step.section)}
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5 text-left !whitespace-normal transition hover:border-primary/50"
            >
              <span className="min-w-0 text-sm font-semibold text-foreground">{step.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </Button>
          </li>
        ))}
      </ul>

      {essentials.length > shown.length && (
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          {essentials.length - shown.length} more essential{essentials.length - shown.length === 1 ? "" : "s"} after this.
        </p>
      )}
    </section>
  );
}
