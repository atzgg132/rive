"use client";

import { Button, Input, Textarea } from "@/components/ui";
import { ArrowDown, ArrowUp, Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AccentColorField from "@/components/portfolio/studio/AccentColorField";
import { inputClass, labelClass } from "@/components/portfolio/studio/studioStyles";
import { normalizeSlug, RESERVED_PRACTICE_SLUGS, type PortfolioContent, type PortfolioPractice } from "@/utils/portfolio";

const MAX_PRACTICES = 8;

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

type Props = {
  content: PortfolioContent;
  slug: string;
  onChange: (update: Partial<PortfolioContent>) => void;
};

/**
 * Practices split one portfolio into the distinct things a person does — the
 * baker who also produces music. Adding none keeps the portfolio exactly as it
 * was, so this is entirely opt-in.
 */
export default function PortfolioPracticeEditor({ content, slug, onChange }: Props) {
  const practices = content.practices;

  const counts = (practiceId: string) => ({
    projects: content.projects.filter((project) => project.practiceId === practiceId).length,
    services: content.services.filter((service) => service.practiceId === practiceId).length,
  });

  const add = () => {
    if (practices.length >= MAX_PRACTICES) {
      toast.error(`You can add up to ${MAX_PRACTICES} practices.`);
      return;
    }
    onChange({
      practices: [...practices, {
        id: id("practice"),
        slug: "",
        name: "",
        tagline: "",
        description: "",
        order: practices.length,
        visibility: "public",
      }],
    });
  };

  const update = (practiceId: string, patch: Partial<PortfolioPractice>) => {
    onChange({ practices: practices.map((item) => (item.id === practiceId ? { ...item, ...patch } : item)) });
  };

  const remove = (practice: PortfolioPractice) => {
    // Content keeps existing; it simply returns to being shared across the
    // whole portfolio rather than scoped to a practice that no longer exists.
    onChange({
      practices: practices.filter((item) => item.id !== practice.id).map((item, index) => ({ ...item, order: index })),
      projects: content.projects.map((project) => (project.practiceId === practice.id ? { ...project, practiceId: undefined } : project)),
      services: content.services.map((service) => (service.practiceId === practice.id ? { ...service, practiceId: undefined } : service)),
      testimonials: content.testimonials.map((testimonial) => (testimonial.practiceId === practice.id ? { ...testimonial, practiceId: undefined } : testimonial)),
    });
  };

  const move = (index: number, delta: number) => {
    const next = [...practices];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ practices: next.map((item, position) => ({ ...item, order: position })) });
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-bold text-foreground">Practices</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            Do more than one thing? Give each its own space. A baker who also produces music can keep both on one portfolio without either looking like a side note. Leave this empty and your portfolio stays exactly as it is.
          </p>
        </div>
        <Button
          type="button"
          onClick={add}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-none bg-primary/10 px-2.5 py-2 text-xs font-bold text-primary"
        >
          <Plus className="h-3.5 w-3.5" /> Add practice
        </Button>
      </div>

      {practices.length === 0 ? (
        <div className="rounded-none border border-dashed border-border px-4 py-10 text-center">
          <Layers className="mx-auto h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-bold text-foreground">One portfolio, one focus</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
            Add a practice only if you want to present separate disciplines. Everything you have already published stays where it is.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 rounded-none bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">How visitors move between them</p>
              <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                {content.practiceLayout === "separate"
                  ? `Each practice gets its own page, like /p/${slug || "you"}/${practices[0]?.slug || "practice"}.`
                  : "All practices share one page, grouped into sections a visitor can jump between."}
              </p>
            </div>
            <div className="flex shrink-0 rounded-none border border-border bg-card p-1">
              {([
                { key: "unified", label: "One page" },
                { key: "separate", label: "Separate pages" },
              ] as const).map(({ key, label }) => (
                <Button
                  key={key}
                  type="button"
                  onClick={() => onChange({ practiceLayout: key })}
                  aria-pressed={content.practiceLayout === key}
                  className={`rounded-none px-3 py-2 text-xs font-bold transition ${
                    content.practiceLayout === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {practices.map((practice, index) => {
              const derivedSlug = normalizeSlug(practice.slug || practice.name);
              const reserved = Boolean(derivedSlug) && RESERVED_PRACTICE_SLUGS.has(derivedSlug);
              const duplicate = practices.some((other, otherIndex) =>
                otherIndex !== index && normalizeSlug(other.slug || other.name) === derivedSlug && Boolean(derivedSlug));
              /* normalizeSlug keeps only a-z0-9, so a name written entirely in
                 non-Latin script derives to an empty address. The server
                 refuses that on save; without this the refusal arrived as a
                 single banner with no indication of which practice caused it.
                 A practice nobody has started yet is exempt, matching the
                 server's own rule that a blank row stays saveable. */
              const started = Boolean(practice.name.trim() || practice.slug.trim());
              const unusableSlug = started && !derivedSlug;
              const used = counts(practice.id);

              return (
                <article key={practice.id} className="rounded-none border border-border p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Practice {index + 1}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {used.projects} project{used.projects === 1 ? "" : "s"} · {used.services} service{used.services === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" title="Move up" aria-label="Move practice up" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-none p-2 text-muted-foreground disabled:opacity-30 hover:bg-muted">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" title="Move down" aria-label="Move practice down" disabled={index === practices.length - 1} onClick={() => move(index, 1)} className="rounded-none p-2 text-muted-foreground disabled:opacity-30 hover:bg-muted">
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" title="Remove practice" aria-label="Remove practice" onClick={() => remove(practice)} className="rounded-none p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>Name <span className="text-primary">Required</span></span>
                      <Input className={inputClass} value={practice.name} placeholder="e.g. Baking" onChange={(event) => update(practice.id, { name: event.target.value })} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>Web address</span>
                      <div className="flex items-center">
                        <span className="truncate rounded-none border border-r-0 border-input bg-muted px-3 py-2.5 text-xs text-muted-foreground">/p/{slug || "you"}/</span>
                        <Input className={`${inputClass} rounded-l-none`} value={practice.slug} placeholder={normalizeSlug(practice.name) || "baking"} onChange={(event) => update(practice.id, { slug: normalizeSlug(event.target.value) })} />
                      </div>
                      {reserved && <span className="text-xs font-semibold text-destructive">“{derivedSlug}” is reserved. Pick another address.</span>}
                      {duplicate && <span className="text-xs font-semibold text-destructive">Another practice already uses this address.</span>}
                      {unusableSlug && (
                        <span className="text-xs font-semibold text-destructive">
                          This name has no letters or numbers a web address can use. Type one here.
                        </span>
                      )}
                    </label>
                    <label className="flex flex-col gap-2 sm:col-span-2">
                      <span className={labelClass}>Tagline</span>
                      <Input className={inputClass} value={practice.tagline} placeholder="One line describing this side of your work" onChange={(event) => update(practice.id, { tagline: event.target.value })} />
                    </label>
                    <label className="flex flex-col gap-2 sm:col-span-2">
                      <span className={labelClass}>Introduction</span>
                      <Textarea rows={3} className={inputClass} value={practice.description} placeholder="Shown in place of your main introduction when someone views this practice." onChange={(event) => update(practice.id, { description: event.target.value })} />
                    </label>
                    <AccentColorField
                      label="Accent colour"
                      value={practice.accent || "#2563EB"}
                      onChange={(accent) => update(practice.id, { accent })}
                    />
                    <label className="flex items-center gap-2 self-end pb-2.5 text-xs font-semibold text-muted-foreground">
                      <Input type="checkbox" checked={practice.visibility !== "private"} onChange={(event) => update(practice.id, { visibility: event.target.checked ? "public" : "private" })} />
                      Show this practice publicly
                    </label>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
