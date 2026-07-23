import { ArrowUpRight, Check, Mail, MapPin, Play, Quote, Sparkles } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type {
  PortfolioContent,
  PortfolioProject,
  PortfolioService,
  PortfolioTheme,
} from "@/utils/portfolio";

/* Portfolio owners can supply validated data URLs and arbitrary HTTPS image hosts. */
/* eslint-disable @next/next/no-img-element */

type Props = {
  content: PortfolioContent;
  theme: PortfolioTheme;
  templateKey: string;
  portfolioSlug?: string;
  preview?: boolean;
};

type TemplateProfile = {
  eyebrow: string;
  workTitle: string;
  servicesTitle: string;
  heroClass: string;
  headlineClass: string;
  projectsClass: string;
  visual: boolean;
  numbered: boolean;
};

const TEMPLATE_PROFILES: Record<string, TemplateProfile> = {
  "minimal-pro": {
    eyebrow: "Independent practice",
    workTitle: "A considered selection of work.",
    servicesTitle: "How I create value.",
    heroClass: "lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]",
    headlineClass: "text-5xl sm:text-6xl lg:text-7xl",
    projectsClass: "md:grid-cols-2",
    visual: false,
    numbered: true,
  },
  "visual-studio": {
    eyebrow: "Selected visual practice",
    workTitle: "Stories, frames, and finished work.",
    servicesTitle: "Creative capabilities.",
    heroClass: "lg:grid-cols-[minmax(0,0.8fr)_minmax(420px,1.2fr)]",
    headlineClass: "text-5xl sm:text-7xl lg:text-8xl",
    projectsClass: "md:grid-cols-2 lg:grid-cols-12",
    visual: true,
    numbered: false,
  },
  "digital-builder": {
    eyebrow: "Designing and shipping",
    workTitle: "Products built to perform.",
    servicesTitle: "From idea to shipped outcome.",
    heroClass: "lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]",
    headlineClass: "text-5xl sm:text-6xl lg:text-7xl",
    projectsClass: "md:grid-cols-2",
    visual: false,
    numbered: true,
  },
  "expert-profile": {
    eyebrow: "Independent expertise",
    workTitle: "Experience applied to real outcomes.",
    servicesTitle: "Ways I can support you.",
    heroClass: "lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]",
    headlineClass: "text-5xl sm:text-6xl lg:text-7xl",
    projectsClass: "md:grid-cols-2",
    visual: false,
    numbered: false,
  },
  creator: {
    eyebrow: "Creator portfolio",
    workTitle: "Worth watching, reading, and sharing.",
    servicesTitle: "Ways we can collaborate.",
    heroClass: "lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]",
    headlineClass: "text-5xl sm:text-7xl lg:text-8xl",
    projectsClass: "md:grid-cols-2 lg:grid-cols-12",
    visual: true,
    numbered: false,
  },
  agency: {
    eyebrow: "Independent studio",
    workTitle: "Partnerships with measurable impact.",
    servicesTitle: "A focused team for ambitious work.",
    heroClass: "lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]",
    headlineClass: "text-5xl sm:text-6xl lg:text-7xl",
    projectsClass: "md:grid-cols-2",
    visual: false,
    numbered: true,
  },
};

function safeExternalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function SectionHeading({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--portfolio-accent)]">
          {eyebrow}
        </p>
        <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.04em] text-[var(--portfolio-ink)] sm:text-5xl">
          {title}
        </h2>
      </div>
      {aside && <div className="shrink-0 text-sm text-[var(--portfolio-muted)]">{aside}</div>}
    </div>
  );
}

function ProjectCard({
  project,
  index,
  profile,
  portfolioSlug,
}: {
  project: PortfolioProject;
  index: number;
  profile: TemplateProfile;
  portfolioSlug?: string;
}) {
  const projectUrl = safeExternalUrl(project.url);
  const caseStudyUrl = portfolioSlug ? `/p/${portfolioSlug}/work/${encodeURIComponent(project.id)}` : null;
  const isFeature = profile.visual && index === 0;
  const cardClass = isFeature ? "lg:col-span-7" : profile.visual ? "lg:col-span-5" : "";

  return (
    <article
      className={`group relative overflow-hidden border border-[var(--portfolio-border)] bg-[var(--portfolio-card)] ${cardClass} ${
        profile.visual ? "rounded-[var(--portfolio-radius-large)]" : "rounded-[var(--portfolio-radius)]"
      }`}
    >
      <div className={`relative overflow-hidden ${isFeature ? "aspect-[4/3] sm:aspect-[16/10]" : "aspect-[16/10]"}`}>
        {project.imageUrl ? (
          <img
            src={project.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
          />
        ) : (
          <div className="absolute inset-0 overflow-hidden bg-[var(--portfolio-soft)]">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--portfolio-accent)] opacity-15 blur-3xl" />
            <div className="absolute bottom-6 left-6 text-7xl font-black tracking-[-0.08em] text-[var(--portfolio-border)] sm:text-8xl">
              {String(index + 1).padStart(2, "0")}
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-5">
          <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-md">
            {project.role || "Selected work"}
          </span>
          {project.year && (
            <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-md">
              {project.year}
            </span>
          )}
        </div>
        {profile.visual && projectUrl && (
          <div className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-white text-slate-950 shadow-xl">
            {profile.eyebrow === "Creator portfolio" ? <Play className="h-4 w-4 fill-current" /> : <ArrowUpRight className="h-4 w-4" />}
          </div>
        )}
      </div>

      <div className="p-5 sm:p-7">
        <div className="flex items-start gap-4">
          {profile.numbered && (
            <span className="mt-1 text-xs font-black text-[var(--portfolio-accent)]">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-2xl font-black tracking-[-0.025em] text-[var(--portfolio-ink)]">
              {project.title}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--portfolio-muted)]">
              {project.description}
            </p>
          </div>
        </div>

        {project.outcome && (
          <div className="mt-6 border-l-2 border-[var(--portfolio-accent)] pl-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--portfolio-accent)]">
              The impact
            </p>
            <p className="mt-1.5 text-sm font-semibold leading-6 text-[var(--portfolio-ink)]">{project.outcome}</p>
          </div>
        )}

        {(project.challenge || project.solution) && (
          <div className="mt-6 grid gap-4 border-t border-[var(--portfolio-border)] pt-5 sm:grid-cols-2">
            {project.challenge && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--portfolio-muted)]">Brief</p>
                <p className="mt-1.5 text-xs leading-5 text-[var(--portfolio-muted)]">{project.challenge}</p>
              </div>
            )}
            {project.solution && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--portfolio-muted)]">Approach</p>
                <p className="mt-1.5 text-xs leading-5 text-[var(--portfolio-muted)]">{project.solution}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {(project.tools || []).slice(0, 5).map((tool) => (
              <span
                key={tool}
                className="rounded-full border border-[var(--portfolio-border)] bg-[var(--portfolio-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--portfolio-muted)]"
              >
                {tool}
              </span>
            ))}
          </div>
          {caseStudyUrl ? (
            <a
              href={caseStudyUrl}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--portfolio-ink)] hover:text-[var(--portfolio-accent)]"
            >
              Read case study <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ) : projectUrl ? (
            <a
              href={projectUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--portfolio-ink)] hover:text-[var(--portfolio-accent)]"
            >
              Explore project <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ServiceCard({ service, index }: { service: PortfolioService; index: number }) {
  return (
    <article className="group border-t border-[var(--portfolio-border)] py-6 sm:py-8">
      <div className="flex gap-5">
        <span className="pt-1 text-xs font-black text-[var(--portfolio-accent)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <h3 className="text-xl font-black tracking-[-0.02em] text-[var(--portfolio-ink)] transition-transform group-hover:translate-x-1">
            {service.title}
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--portfolio-muted)]">{service.description}</p>
        </div>
      </div>
    </article>
  );
}

export default function PortfolioRenderer({ content, theme, templateKey, portfolioSlug, preview = false }: Props) {
  const profile = TEMPLATE_PROFILES[templateKey] || TEMPLATE_PROFILES["minimal-pro"];
  const dark = theme.mode === "dark";
  const publicProjects = content.projects.filter((project) => project.visibility !== "private");
  const featuredProject = publicProjects.find((project) => project.imageUrl) || publicProjects[0];
  const visible = (key: PortfolioContent["sections"][number]["key"]) =>
    content.sections.find((section) => section.key === key)?.visible ?? true;
  const contactHref = content.contactEmail ? `mailto:${content.contactEmail}` : null;
  const cssVars = {
    "--portfolio-accent": theme.accent,
    "--portfolio-bg": dark ? "#080b12" : "#f7f7f4",
    "--portfolio-card": dark ? "#11151f" : "#ffffff",
    "--portfolio-soft": dark ? "#181e2a" : "#eeeee9",
    "--portfolio-border": dark ? "#2a3242" : "#dcded8",
    "--portfolio-ink": dark ? "#f7f7f2" : "#111827",
    "--portfolio-muted": dark ? "#a5adba" : "#5f6978",
    "--portfolio-radius": theme.radius === "sharp" ? "0.25rem" : "1.5rem",
    "--portfolio-radius-large": theme.radius === "sharp" ? "0.25rem" : "2rem",
  } as CSSProperties;

  return (
    <div style={cssVars} className="min-h-full overflow-hidden bg-[var(--portfolio-bg)] text-[var(--portfolio-ink)]">
      {preview && (
        <div className="sticky top-0 z-30 bg-[var(--portfolio-accent)] px-4 py-2 text-center text-[10px] font-extrabold uppercase tracking-[0.16em] text-white">
          Private preview · only you can see this
        </div>
      )}

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-10 lg:px-14">
        <a href="#top" className="text-base font-black tracking-[-0.03em] text-[var(--portfolio-ink)]">
          {content.name || "Your portfolio"}
          <span className="text-[var(--portfolio-accent)]">.</span>
        </a>
        <nav aria-label="Portfolio navigation" className="flex items-center gap-3 sm:gap-7">
          <div className="hidden items-center gap-7 text-xs font-bold text-[var(--portfolio-muted)] sm:flex">
            {visible("projects") && publicProjects.length > 0 && <a href="#work">Work</a>}
            {visible("services") && content.services.length > 0 && <a href="#services">Services</a>}
            {visible("about") && <a href="#about">About</a>}
          </div>
          {visible("contact") && contactHref && (
            <a
              href={contactHref}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--portfolio-border)] bg-[var(--portfolio-card)] px-4 py-2.5 text-xs font-extrabold text-[var(--portfolio-ink)] shadow-sm"
            >
              Let&apos;s talk <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </nav>
      </header>

      <main id="top">
        <section className={`relative mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-12 sm:px-10 sm:pb-24 sm:pt-20 lg:px-14 ${profile.heroClass}`}>
          <div className="relative z-10 self-center">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--portfolio-accent)]">
                <Sparkles className="h-3.5 w-3.5" /> {profile.eyebrow}
              </span>
              {content.availability && (
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--portfolio-border)] bg-[var(--portfolio-card)] px-3 py-1.5 text-[10px] font-bold text-[var(--portfolio-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {content.availability}
                </span>
              )}
            </div>
            <h1 className={`max-w-5xl font-black leading-[0.94] tracking-[-0.065em] text-[var(--portfolio-ink)] ${profile.headlineClass}`}>
              {content.headline}
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-[var(--portfolio-muted)] sm:text-lg sm:leading-8">{content.bio}</p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              {visible("contact") && contactHref && (
                <a
                  href={contactHref}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--portfolio-accent)] px-5 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-black/10"
                >
                  Start a conversation <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
              {content.location && (
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--portfolio-muted)]">
                  <MapPin className="h-4 w-4 text-[var(--portfolio-accent)]" /> {content.location}
                </span>
              )}
            </div>
          </div>

          <div className="relative min-h-72 self-stretch sm:min-h-96">
            <div className="absolute inset-0 translate-x-5 translate-y-5 rounded-[var(--portfolio-radius-large)] border border-[var(--portfolio-border)]" />
            <div className="relative h-full min-h-72 overflow-hidden rounded-[var(--portfolio-radius-large)] bg-[var(--portfolio-soft)] sm:min-h-96">
              {featuredProject?.imageUrl ? (
                <>
                  <img src={featuredProject.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Featured work</p>
                    <p className="mt-2 text-2xl font-black tracking-tight">{featuredProject.title}</p>
                    {featuredProject.outcome && <p className="mt-2 max-w-sm text-sm leading-6 text-white/75">{featuredProject.outcome}</p>}
                  </div>
                </>
              ) : (
                <div className="flex h-full min-h-72 flex-col justify-between p-7 sm:min-h-96 sm:p-9">
                  <div className="flex items-start justify-between">
                    <Sparkles className="h-9 w-9 text-[var(--portfolio-accent)]" strokeWidth={1.5} />
                    <span className="text-xs font-bold text-[var(--portfolio-muted)]">{new Date().getFullYear()}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--portfolio-muted)]">Portfolio of</p>
                    <p className="mt-3 text-4xl font-black tracking-[-0.055em] text-[var(--portfolio-ink)] sm:text-5xl">{content.name}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="border-y border-[var(--portfolio-border)] bg-[var(--portfolio-card)]">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-[var(--portfolio-border)] px-5 sm:px-10 lg:grid-cols-4 lg:px-14">
            {[
              [String(publicProjects.length).padStart(2, "0"), publicProjects.length === 1 ? "Selected project" : "Selected projects"],
              [String(content.services.length).padStart(2, "0"), content.services.length === 1 ? "Core service" : "Core services"],
              [content.location || "Worldwide", "Where I work"],
              [content.availability || "Open to work", "Current status"],
            ].map(([value, label]) => (
              <div key={label} className="px-4 py-6 first:pl-0 sm:px-6 lg:py-8">
                <p className="truncate text-lg font-black text-[var(--portfolio-ink)]">{value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--portfolio-muted)]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-5 sm:px-10 lg:px-14">
          {visible("projects") && publicProjects.length > 0 && (
            <section id="work" className="py-20 sm:py-28">
              <SectionHeading eyebrow="Selected work" title={profile.workTitle} aside={`${publicProjects.length} project${publicProjects.length === 1 ? "" : "s"}`} />
              <div className={`grid gap-5 sm:gap-7 ${profile.projectsClass}`}>
                {publicProjects.map((project, index) => (
                  <ProjectCard key={project.id} project={project} index={index} profile={profile} portfolioSlug={portfolioSlug} />
                ))}
              </div>
            </section>
          )}

          {visible("services") && content.services.length > 0 && (
            <section id="services" className="border-t border-[var(--portfolio-border)] py-20 sm:py-28">
              <div className="grid gap-10 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)] lg:gap-20">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--portfolio-accent)]">Services</p>
                  <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--portfolio-ink)] sm:text-5xl">{profile.servicesTitle}</h2>
                  {visible("contact") && contactHref && (
                    <a href={contactHref} className="mt-7 inline-flex items-center gap-2 text-sm font-extrabold text-[var(--portfolio-accent)]">
                      Discuss your project <ArrowUpRight className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <div>
                  {content.services.map((service, index) => <ServiceCard key={service.id} service={service} index={index} />)}
                </div>
              </div>
            </section>
          )}

          {visible("testimonials") && content.testimonials.length > 0 && (
            <section className="border-t border-[var(--portfolio-border)] py-20 sm:py-28">
              <SectionHeading eyebrow="Client perspective" title="The work matters. So does the experience." />
              <div className="grid gap-5 md:grid-cols-2">
                {content.testimonials.map((testimonial) => (
                  <blockquote key={testimonial.id} className="rounded-[var(--portfolio-radius)] border border-[var(--portfolio-border)] bg-[var(--portfolio-card)] p-6 sm:p-8">
                    <Quote className="h-7 w-7 text-[var(--portfolio-accent)]" />
                    <p className="mt-6 text-lg font-semibold leading-8 text-[var(--portfolio-ink)]">“{testimonial.quote}”</p>
                    <footer className="mt-7 border-t border-[var(--portfolio-border)] pt-5">
                      <p className="text-sm font-extrabold text-[var(--portfolio-ink)]">{testimonial.name}</p>
                      {testimonial.company && <p className="mt-1 text-xs text-[var(--portfolio-muted)]">{testimonial.company}</p>}
                    </footer>
                  </blockquote>
                ))}
              </div>
            </section>
          )}

          {visible("about") && (
            <section id="about" className="border-t border-[var(--portfolio-border)] py-20 sm:py-28">
              <div className="grid gap-8 lg:grid-cols-[0.55fr_1.45fr] lg:gap-20">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--portfolio-accent)]">About the practice</p>
                <div>
                  <p className="max-w-4xl text-2xl font-semibold leading-10 tracking-[-0.025em] text-[var(--portfolio-ink)] sm:text-4xl sm:leading-[1.25]">{content.bio}</p>
                  <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-xs font-semibold text-[var(--portfolio-muted)]">
                    {content.location && <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[var(--portfolio-accent)]" /> {content.location}</span>}
                    {content.availability && <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[var(--portfolio-accent)]" /> {content.availability}</span>}
                  </div>
                </div>
              </div>
            </section>
          )}

          {visible("contact") && (
            <section id="contact" className="pb-8 pt-10 sm:pb-12">
              <div className="relative overflow-hidden rounded-[var(--portfolio-radius-large)] bg-[var(--portfolio-accent)] p-7 text-white sm:p-12 lg:p-16">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/20" />
                <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border border-white/20" />
                <div className="relative z-10">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/70">Have a project in mind?</p>
                  <h2 className="mt-4 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl">
                    Let&apos;s turn the next good idea into meaningful work.
                  </h2>
                  {contactHref ? (
                    <a href={contactHref} className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-extrabold text-[var(--portfolio-accent)] shadow-xl">
                      <Mail className="h-4 w-4" /> {content.contactEmail}
                    </a>
                  ) : (
                    <p className="mt-7 text-sm text-white/75">Contact details coming soon.</p>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-xs text-[var(--portfolio-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-14">
        <span>© {new Date().getFullYear()} {content.name}. Built with Rive.</span>
        <div className="flex flex-wrap gap-5">
          {content.social.map((social) => {
            const socialUrl = safeExternalUrl(social.url);
            return socialUrl ? <a key={`${social.label}-${socialUrl}`} href={socialUrl} target="_blank" rel="noreferrer" className="font-bold hover:text-[var(--portfolio-accent)]">{social.label}</a> : null;
          })}
        </div>
      </footer>
    </div>
  );
}
