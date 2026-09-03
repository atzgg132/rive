"use client";

import { AlertTriangle, ArrowRight, Check, Globe2, X } from "lucide-react";
import { Button } from "@/components/ui";
import StudioOverlay from "@/components/portfolio/StudioOverlay";
import type { PortfolioStep, StudioSection } from "@/components/portfolio/PortfolioNextSteps";
import type { PortfolioContent } from "@/utils/portfolio";

/**
 * Publishing, as a decision rather than a button.
 *
 * Publish used to fire on the first click, which is a strange amount of trust to
 * ask for from the one action that puts someone's name in front of clients. It
 * also meant the studio knew perfectly well that a project had no cover image
 * and said nothing until after the page was live.
 *
 * So the click opens a review: what is about to become public, and what is
 * still missing. Blockers do not block — this is the owner's site and they may
 * have good reasons — but they are named, and each one goes straight to the
 * field that closes it, which is more useful than a warning that only tuts.
 */

export default function PortfolioPublishReview({
  steps,
  content,
  publicUrl,
  published,
  publishing,
  error,
  errorSection,
  onGoTo,
  onConfirm,
  onClose,
}: {
  steps: PortfolioStep[];
  content: PortfolioContent;
  publicUrl: string;
  published: boolean;
  publishing: boolean;
  /** The save rejection from the last confirm attempt, if it maps to a section. */
  error?: string | null;
  errorSection?: StudioSection | null;
  onGoTo: (section: StudioSection) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  /* "Publish your portfolio" is itself a step, and listing it as a thing to fix
     inside the publish dialog would be a small joke at the owner's expense. */
  const outstanding = steps.filter((step) => !step.done && step.id !== "publish");
  const blockers = outstanding.filter((step) => step.essential);
  const polish = outstanding.filter((step) => !step.essential);

  const publicProjects = content.projects.filter((project) => project.visibility !== "private" && project.title.trim());
  const hiddenProjects = content.projects.filter((project) => project.visibility === "private" && project.title.trim());
  const services = content.services.filter((service) => service.title.trim());

  return (
    <StudioOverlay label={published ? "Update your live site" : "Publish your portfolio"} onClose={onClose} className="items-center justify-center p-4">
      <div
        data-portfolio-publish-review
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <Globe2 className="h-3.5 w-3.5" /> {published ? "Update live site" : "Publish"}
            </p>
            <h2 className="mt-1 text-xl font-semibold">{published ? "Push your changes live" : "Make your portfolio public"}</h2>
            <p className="mt-1 break-words text-sm text-muted-foreground">{publicUrl}</p>
          </div>
          <Button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></Button>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">What goes public</p>
          <ul className="mt-2.5 flex flex-col gap-1.5 text-sm">
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> {publicProjects.length} project{publicProjects.length === 1 ? "" : "s"}{hiddenProjects.length > 0 && <span className="text-muted-foreground">· {hiddenProjects.length} kept private</span>}</li>
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> {services.length} service{services.length === 1 ? "" : "s"}</li>
            {content.practices.length > 0 && (
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> {content.practices.length} practice{content.practices.length === 1 ? "" : "s"}</li>
            )}
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> {content.contactEmail.trim() ? "Enquiries go to your inbox" : "No contact email — visitors cannot reach you"}</li>
          </ul>
        </div>

        {blockers.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
            <p className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {blockers.length} thing{blockers.length === 1 ? "" : "s"} worth fixing first
            </p>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {blockers.map((step) => (
                <li key={step.id}>
                  <Button
                    type="button"
                    onClick={() => { onClose(); onGoTo(step.section); }}
                    className="group flex w-full items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-left !whitespace-normal text-sm font-semibold text-amber-950 hover:bg-white dark:bg-amber-900/30 dark:text-amber-50"
                  >
                    {step.label}
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-xs leading-5 text-amber-900/80 dark:text-amber-100/80">
              You can publish without these. It is your site — this is a heads-up, not a gate.
            </p>
          </div>
        )}

        {blockers.length === 0 && polish.length > 0 && (
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Everything essential is done. {polish.length} optional improvement{polish.length === 1 ? "" : "s"} can wait until after you publish.
          </p>
        )}

        {blockers.length === 0 && polish.length === 0 && (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <Check className="h-4 w-4" /> Nothing outstanding.
          </p>
        )}

        {error && (
          <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            <span><strong>Could not publish.</strong> {error}</span>
            {errorSection && (
              <Button type="button" onClick={() => { onClose(); onGoTo(errorSection); }} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold">Fix this</Button>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted">Not yet</Button>
          <Button
            type="button"
            data-portfolio-publish-confirm
            onClick={onConfirm}
            disabled={publishing}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <Check className="h-4 w-4" />
            {publishing ? "Publishing…" : blockers.length > 0 ? "Publish anyway" : published ? "Update live site" : "Publish portfolio"}
          </Button>
        </div>
      </div>
    </StudioOverlay>
  );
}
