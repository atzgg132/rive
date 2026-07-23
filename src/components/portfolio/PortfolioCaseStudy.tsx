import { ArrowLeft, ArrowUpRight, Check, Clock3, Mail, UserRound } from "lucide-react";
import type { CSSProperties } from "react";
import type { PortfolioContent, PortfolioProject, PortfolioTheme } from "@/utils/portfolio";

/* Portfolio owners can supply validated data URLs and arbitrary HTTPS image hosts. */
/* eslint-disable @next/next/no-img-element */

type Props = {
  content: PortfolioContent;
  project: PortfolioProject;
  portfolioSlug: string;
  theme: PortfolioTheme;
};

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function PortfolioCaseStudy({ content, project, portfolioSlug, theme }: Props) {
  const dark = theme.mode === "dark";
  const projectUrl = safeExternalUrl(project.url);
  const cssVars = {
    "--case-accent": theme.accent,
    "--case-bg": dark ? "#080b12" : "#f7f7f4",
    "--case-card": dark ? "#11151f" : "#ffffff",
    "--case-soft": dark ? "#181e2a" : "#eeeee9",
    "--case-border": dark ? "#2a3242" : "#dcded8",
    "--case-ink": dark ? "#f7f7f2" : "#111827",
    "--case-muted": dark ? "#a5adba" : "#5f6978",
    "--case-radius": theme.radius === "sharp" ? "0.25rem" : "1.5rem",
    "--case-radius-large": theme.radius === "sharp" ? "0.25rem" : "2rem",
  } as CSSProperties;

  return (
    <div style={cssVars} className="min-h-screen bg-[var(--case-bg)] text-[var(--case-ink)]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-10 lg:px-14">
        <a href={`/p/${portfolioSlug}`} className="inline-flex items-center gap-2 text-xs font-extrabold text-[var(--case-muted)] hover:text-[var(--case-accent)]">
          <ArrowLeft className="h-4 w-4" /> Back to {content.name}
        </a>
        {content.contactEmail && (
          <a href={`mailto:${content.contactEmail}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--case-border)] bg-[var(--case-card)] px-4 py-2.5 text-xs font-extrabold">
            Let&apos;s talk <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-5 pb-12 pt-12 sm:px-10 sm:pb-20 sm:pt-20 lg:px-14">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--case-accent)]">Case study · {project.year || "Selected work"}</p>
          <h1 className="mt-5 max-w-5xl text-5xl font-black leading-[0.94] tracking-[-0.065em] text-[var(--case-ink)] sm:text-7xl lg:text-8xl">{project.title}</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[var(--case-muted)] sm:text-xl">{project.description}</p>

          <div className="mt-10 grid border-y border-[var(--case-border)] sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: UserRound, label: "Role", value: project.role || "Independent professional" },
              { icon: UserRound, label: "Client", value: project.client || "Independent work" },
              { icon: Clock3, label: "Timeline", value: project.timeline || project.year || "Not specified" },
              { icon: Check, label: "Outcome", value: project.outcome || "Project delivered" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="border-b border-[var(--case-border)] py-6 sm:px-5 sm:first:pl-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
                <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--case-accent)]"><Icon className="h-3.5 w-3.5" /> {label}</div>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--case-ink)]">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 sm:px-10 lg:px-14">
          <div className="relative min-h-72 overflow-hidden rounded-[var(--case-radius-large)] bg-[var(--case-soft)] sm:min-h-[520px]">
            {project.imageUrl ? (
              <img src={project.imageUrl} alt={`${project.title} cover`} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <span className="text-8xl font-black tracking-[-0.08em] text-[var(--case-border)] sm:text-9xl">01</span>
              </div>
            )}
          </div>
        </section>

        {(project.challenge || project.solution || project.outcome) && (
          <section className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-10 sm:py-28 lg:grid-cols-[0.55fr_1.45fr] lg:px-14 lg:gap-24">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--case-accent)]">The story</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--case-ink)]">From brief to meaningful outcome.</h2>
            </div>
            <div className="space-y-12">
              {project.challenge && <StoryBlock number="01" title="The challenge" body={project.challenge} />}
              {project.solution && <StoryBlock number="02" title="The approach" body={project.solution} />}
              {project.outcome && <StoryBlock number="03" title="The result" body={project.outcome} accent />}
            </div>
          </section>
        )}

        {project.gallery && project.gallery.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 pb-20 sm:px-10 sm:pb-28 lg:px-14">
            <div className="mb-8 border-t border-[var(--case-border)] pt-10">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--case-accent)]">Project gallery</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--case-ink)] sm:text-5xl">A closer look at the work.</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {project.gallery.map((image, index) => (
                <figure key={image.id} className={`${index % 3 === 0 ? "md:col-span-2" : ""}`}>
                  <div className={`overflow-hidden rounded-[var(--case-radius)] bg-[var(--case-soft)] ${index % 3 === 0 ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
                    <img src={image.url} alt={image.alt || `${project.title} project image ${index + 1}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </div>
                  {image.caption && <figcaption className="mt-3 text-xs leading-5 text-[var(--case-muted)]">{image.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        {((project.deliverables && project.deliverables.length > 0) || (project.tools && project.tools.length > 0)) && (
          <section className="border-y border-[var(--case-border)] bg-[var(--case-card)]">
            <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-10 lg:grid-cols-2 lg:px-14">
              <ListBlock title="Deliverables" items={project.deliverables || []} />
              <ListBlock title="Tools and capabilities" items={project.tools || []} />
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-10 sm:py-28 lg:px-14">
          <div className="rounded-[var(--case-radius-large)] bg-[var(--case-accent)] p-7 text-white sm:p-12 lg:p-16">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/70">Like what you see?</p>
            <h2 className="mt-4 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl">Let&apos;s create the next strong case study together.</h2>
            <div className="mt-8 flex flex-wrap gap-3">
              {content.contactEmail && <a href={`mailto:${content.contactEmail}`} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-extrabold text-[var(--case-accent)]"><Mail className="h-4 w-4" /> Contact {content.name}</a>}
              {projectUrl && <a href={projectUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3.5 text-sm font-extrabold text-white">Visit live project <ArrowUpRight className="h-4 w-4" /></a>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StoryBlock({ number, title, body, accent = false }: { number: string; title: string; body: string; accent?: boolean }) {
  return (
    <article className={accent ? "rounded-[var(--case-radius)] bg-[var(--case-accent)] p-6 text-white sm:p-8" : "border-t border-[var(--case-border)] pt-7"}>
      <div className={`text-[10px] font-extrabold uppercase tracking-[0.18em] ${accent ? "text-white/65" : "text-[var(--case-accent)]"}`}>{number} · {title}</div>
      <p className={`mt-4 text-lg leading-8 sm:text-xl ${accent ? "font-semibold text-white" : "text-[var(--case-muted)]"}`}>{body}</p>
    </article>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--case-accent)]">{title}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {items.map((item) => <span key={item} className="rounded-full border border-[var(--case-border)] bg-[var(--case-soft)] px-3 py-2 text-xs font-bold text-[var(--case-muted)]">{item}</span>)}
      </div>
    </div>
  );
}
