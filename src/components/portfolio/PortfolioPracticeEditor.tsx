"use client";

import { Button, Input, Textarea } from "@/components/ui";
import { ArrowDown, ArrowUp, Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { normalizeSlug, RESERVED_PRACTICE_SLUGS, type PortfolioContent, type PortfolioPractice } from "@/utils/portfolio";

const inputClass = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-blue-950";
const labelClass = "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-slate-400";

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
          <h2 className="font-bold text-foreground dark:text-white">Practices</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
            Do more than one thing? Give each its own space. A baker who also produces music can keep both on one portfolio without either looking like a side note. Leave this empty and your portfolio stays exactly as it is.
          </p>
        </div>
        <Button
          type="button"
          onClick={add}
          className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
        >
          <Plus className="h-3.5 w-3.5" /> Add practice
        </Button>
      </div>

      {practices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
          <Layers className="mx-auto h-6 w-6 text-slate-400" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-bold text-foreground dark:text-white">One portfolio, one focus</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500 dark:text-slate-400">
            Add a practice only if you want to present separate disciplines. Everything you have already published stays where it is.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold text-foreground dark:text-white">How visitors move between them</p>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                {content.practiceLayout === "separate"
                  ? `Each practice gets its own page, like /p/${slug || "you"}/${practices[0]?.slug || "practice"}.`
                  : "All practices share one page, grouped into sections a visitor can jump between."}
              </p>
            </div>
            <div className="flex shrink-0 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
              {([
                { key: "unified", label: "One page" },
                { key: "separate", label: "Separate pages" },
              ] as const).map(({ key, label }) => (
                <Button
                  key={key}
                  type="button"
                  onClick={() => onChange({ practiceLayout: key })}
                  aria-pressed={content.practiceLayout === key}
                  className={`rounded-lg px-3 py-2 text-[11px] font-bold transition ${
                    content.practiceLayout === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-500"
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
                <article key={practice.id} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Practice {index + 1}</p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {used.projects} project{used.projects === 1 ? "" : "s"} · {used.services} service{used.services === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button type="button" title="Move up" aria-label="Move practice up" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-lg p-2 text-slate-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button type="button" title="Move down" aria-label="Move practice down" disabled={index === practices.length - 1} onClick={() => move(index, 1)} className="rounded-lg p-2 text-slate-400 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800">
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button type="button" title="Remove practice" aria-label="Remove practice" onClick={() => remove(practice)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>Name <span className="text-blue-600">Required</span></span>
                      <Input className={inputClass} value={practice.name} placeholder="e.g. Baking" onChange={(event) => update(practice.id, { name: event.target.value })} />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>Web address</span>
                      <div className="flex items-center">
                        <span className="truncate rounded-l-xl border border-r-0 border-border bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">/p/{slug || "you"}/</span>
                        <Input className={`${inputClass} rounded-l-none`} value={practice.slug} placeholder={normalizeSlug(practice.name) || "baking"} onChange={(event) => update(practice.id, { slug: normalizeSlug(event.target.value) })} />
                      </div>
                      {reserved && <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">“{derivedSlug}” is reserved. Pick another address.</span>}
                      {duplicate && <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">Another practice already uses this address.</span>}
                      {unusableSlug && (
                        <span className="text-[11px] font-semibold text-red-600 dark:text-red-400">
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
                    <label className="flex flex-col gap-2">
                      <span className={labelClass}>Accent colour</span>
                      <Input
                        type="color"
                        className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-transparent dark:border-slate-700"
                        value={practice.accent || "#2563EB"}
                        onChange={(event) => update(practice.id, { accent: event.target.value })}
                      />
                    </label>
                    <label className="flex items-center gap-2 self-end pb-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
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
