"use client";

import { useSyncExternalStore } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui";
import type { StudioSection } from "@/components/portfolio/PortfolioNextSteps";

/**
 * The order to do things in, for someone who has nothing.
 *
 * Most people never see this: a portfolio is provisioned already prefilled from
 * what Rive knows — name, avatar, contact, and any projects already tracked
 * (`buildPrefilledPortfolioContent`). This is for the account that has none of
 * that yet, which otherwise opens onto a grid of empty forms with no indication
 * of which one matters.
 *
 * Three steps, in the order that gets to something publishable fastest: say who
 * you are, add one piece of work, choose how it looks. It replaces the worklist
 * rather than sitting above it, because two competing lists of what to do next
 * is worse than either alone. Skippable, and gone for good once anything has
 * been typed — `isPortfolioUnstarted` decides that, not this component.
 *
 * The worked example is shown, never inserted. Nobody's portfolio should
 * silently acquire claims about work they did not do.
 */

const DISMISS_KEY = "rive:portfolio-first-run-dismissed";

let dismissed = false;
let hydrated = false;
const listeners = new Set<() => void>();

function getSnapshot() {
  if (!hydrated) {
    hydrated = true;
    try {
      dismissed = window.sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
  }
  return dismissed;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function dismiss() {
  dismissed = true;
  hydrated = true;
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* Private mode: it still closes for this render. */
  }
  for (const listener of listeners) listener();
}

const STEPS: { id: string; title: string; detail: string; section: StudioSection; cta: string }[] = [
  {
    id: "who",
    title: "Say who you are",
    detail: "A name, one line on what you do, and an email people can reach you at.",
    section: "profile",
    cta: "Add your details",
  },
  {
    id: "work",
    title: "Add one piece of work",
    detail: "One project you would want to be hired for beats five you are lukewarm about.",
    section: "work",
    cta: "Add a project",
  },
  {
    id: "look",
    title: "Choose how it looks",
    detail: "Each template is shown with your own work, and switching keeps everything.",
    section: "design",
    cta: "Pick a template",
  },
];

export default function PortfolioFirstRun({ onGoTo }: { onGoTo: (section: StudioSection) => void }) {
  const isDismissed = useSyncExternalStore(subscribe, getSnapshot, () => false);
  if (isDismissed) return null;

  return (
    <section data-portfolio-first-run className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Start here
          </p>
          <h2 className="mt-1 text-xl font-semibold">Three steps to a portfolio worth sending</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Nothing here is required, and you can jump around. This is just the order that gets you to something you would actually send a client.
          </p>
        </div>
        <Button
          type="button"
          onClick={dismiss}
          aria-label="Hide this for now"
          title="Hide this for now"
          data-portfolio-first-run-dismiss
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.id} className="flex flex-col rounded-xl border border-border bg-background p-4">
            <span className="text-xs font-bold tabular-nums text-primary">{index + 1}</span>
            <span className="mt-1 text-sm font-semibold text-foreground">{step.title}</span>
            <span className="mt-1 flex-1 text-xs leading-5 text-muted-foreground">{step.detail}</span>
            <Button
              type="button"
              onClick={() => onGoTo(step.section)}
              className="group mt-3 inline-flex items-center gap-1.5 self-start rounded-lg text-xs font-bold text-primary hover:underline"
            >
              {step.cta} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </Button>
          </li>
        ))}
      </ol>

      {/* Shown as an example, never written into their content. */}
      <details className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
        <summary className="cursor-pointer text-xs font-bold text-foreground">What a strong project entry reads like</summary>
        <dl className="mt-3 grid gap-2.5 text-xs leading-5 sm:grid-cols-2">
          <div><dt className="font-semibold text-foreground">Title</dt><dd className="text-muted-foreground">A calmer checkout for Acme</dd></div>
          <div><dt className="font-semibold text-foreground">Your role</dt><dd className="text-muted-foreground">Product designer, solo</dd></div>
          <div className="sm:col-span-2"><dt className="font-semibold text-foreground">What you did</dt><dd className="text-muted-foreground">Rebuilt a three-step checkout that was losing people at payment. Cut it to one screen and made errors recoverable. Abandonment fell by a third in the first month.</dd></div>
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          The pattern: what it was, what you changed, what happened. Numbers if you have them, plain language if you do not.
        </p>
      </details>
    </section>
  );
}
