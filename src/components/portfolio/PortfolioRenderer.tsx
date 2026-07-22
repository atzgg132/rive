import type { CSSProperties } from "react";
import type { PortfolioContent, PortfolioProject, PortfolioService, PortfolioTheme } from "@/utils/portfolio";

type Props = {
  content: PortfolioContent;
  theme: PortfolioTheme;
  templateKey: string;
  preview?: boolean;
};

function ProjectCard({ project, visual }: { project: PortfolioProject; visual: boolean }) {
  return (
    <article className={`group overflow-hidden border border-[var(--portfolio-border)] bg-[var(--portfolio-card)] ${visual ? "rounded-[2rem]" : "rounded-2xl"}`}>
      {project.imageUrl ? (
        <img src={project.imageUrl} alt={project.title} className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="flex aspect-[16/10] items-end bg-[var(--portfolio-soft)] p-5">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--portfolio-muted)]">selected work</span>
        </div>
      )}
      <div className="p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--portfolio-muted)]">
          <span>{project.role || "project"}</span><span>{project.year}</span>
        </div>
        <h3 className="text-xl font-bold text-[var(--portfolio-ink)]">{project.title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--portfolio-muted)]">{project.description}</p>
        {(project.challenge || project.solution || project.outcome || (project.tools && project.tools.length > 0)) && <div className="mt-5 space-y-3 border-t border-[var(--portfolio-border)] pt-4 text-sm"><div className="grid gap-3 sm:grid-cols-3">{project.challenge && <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--portfolio-accent)]">challenge</p><p className="mt-1 leading-5 text-[var(--portfolio-muted)]">{project.challenge}</p></div>}{project.solution && <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--portfolio-accent)]">solution</p><p className="mt-1 leading-5 text-[var(--portfolio-muted)]">{project.solution}</p></div>}{project.outcome && <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--portfolio-accent)]">outcome</p><p className="mt-1 leading-5 text-[var(--portfolio-muted)]">{project.outcome}</p></div>}</div>{project.tools && project.tools.length > 0 && <div className="flex flex-wrap gap-2">{project.tools.map((tool) => <span key={tool} className="rounded-full bg-[var(--portfolio-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--portfolio-muted)]">{tool}</span>)}</div>}</div>}
        {project.url && <a href={project.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-bold text-[var(--portfolio-accent)] hover:underline">view project →</a>}
      </div>
    </article>
  );
}

function ServiceCard({ service }: { service: PortfolioService }) {
  return (
    <article className="rounded-2xl border border-[var(--portfolio-border)] bg-[var(--portfolio-card)] p-5 sm:p-6">
      <span className="mb-5 block text-sm font-bold text-[var(--portfolio-accent)]">✦</span>
      <h3 className="text-lg font-bold text-[var(--portfolio-ink)]">{service.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--portfolio-muted)]">{service.description}</p>
    </article>
  );
}

export default function PortfolioRenderer({ content, theme, templateKey, preview = false }: Props) {
  const visual = templateKey === "visual-studio" || templateKey === "creator";
  const dark = theme.mode === "dark";
  const visible = (key: PortfolioContent["sections"][number]["key"]) => content.sections.find((section) => section.key === key)?.visible ?? true;
  const cssVars = {
    "--portfolio-accent": theme.accent,
    "--portfolio-bg": dark ? "#0b1120" : "#f8fafc",
    "--portfolio-card": dark ? "#111827" : "#ffffff",
    "--portfolio-soft": dark ? "#1e293b" : "#eef4fb",
    "--portfolio-border": dark ? "#263449" : "#e2e8f0",
    "--portfolio-ink": dark ? "#f8fafc" : "#0c1e36",
    "--portfolio-muted": dark ? "#94a3b8" : "#52627a",
  } as CSSProperties;

  return (
    <div style={cssVars} className="min-h-full bg-[var(--portfolio-bg)] text-[var(--portfolio-ink)] transition-colors">
      {preview && <div className="sticky top-0 z-20 bg-[var(--portfolio-accent)] px-4 py-2 text-center text-xs font-bold text-white">preview mode · only you can see this</div>}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <a href="#top" className="font-black tracking-tight text-[var(--portfolio-ink)]">{content.name || "your portfolio"}<span className="text-[var(--portfolio-accent)]">.</span></a>
        <nav className="hidden items-center gap-6 text-xs font-semibold text-[var(--portfolio-muted)] sm:flex">
          {visible("projects") && <a href="#work" className="hover:text-[var(--portfolio-accent)]">work</a>}
          {visible("services") && <a href="#services" className="hover:text-[var(--portfolio-accent)]">services</a>}
          {visible("contact") && <a href="#contact" className="hover:text-[var(--portfolio-accent)]">contact</a>}
        </nav>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-6 pb-20 sm:px-10">
        <section className={`grid gap-10 py-16 sm:py-24 ${visual ? "lg:grid-cols-[1.25fr_0.75fr]" : "lg:grid-cols-[1fr_0.6fr]"}`}>
          <div className="self-end">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--portfolio-accent)]">{content.availability}</p>
            <h1 className={`max-w-4xl font-black tracking-[-0.05em] text-[var(--portfolio-ink)] ${visual ? "text-5xl sm:text-7xl" : "text-5xl sm:text-6xl"}`}>{content.headline}</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--portfolio-muted)]">{content.bio}</p>
            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm font-semibold">
              {visible("contact") && content.contactEmail && <a href={`mailto:${content.contactEmail}`} className="rounded-full bg-[var(--portfolio-accent)] px-5 py-3 text-white shadow-lg shadow-black/10">let&apos;s work together →</a>}
              {content.location && <span className="text-[var(--portfolio-muted)]">{content.location}</span>}
            </div>
          </div>
          <div className={`min-h-56 bg-[var(--portfolio-soft)] ${visual ? "rounded-[2rem]" : "rounded-3xl"} p-8 sm:min-h-72`}>
            <div className="flex h-full flex-col justify-between">
              <span className="text-5xl font-black text-[var(--portfolio-accent)]">✦</span>
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--portfolio-muted)]">{templateKey.replaceAll("-", " ")}</p><p className="mt-2 text-sm text-[var(--portfolio-muted)]">a portfolio by {content.name}</p></div>
            </div>
          </div>
        </section>

        {visible("about") && <section className="border-t border-[var(--portfolio-border)] py-12"><p className="max-w-3xl text-2xl font-semibold leading-10 text-[var(--portfolio-ink)]">{content.bio}</p></section>}

        {visible("projects") && content.projects.filter((project) => project.visibility !== "private").length > 0 && <section id="work" className="border-t border-[var(--portfolio-border)] py-12"><div className="mb-7 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--portfolio-accent)]">selected work</p><h2 className="mt-2 text-3xl font-black text-[var(--portfolio-ink)]">projects that made an impact.</h2></div><span className="text-sm text-[var(--portfolio-muted)]">{content.projects.filter((project) => project.visibility !== "private").length} projects</span></div><div className="grid gap-5 md:grid-cols-2">{content.projects.filter((project) => project.visibility !== "private").map((project) => <ProjectCard key={project.id} project={project} visual={visual} />)}</div></section>}

        {visible("services") && content.services.length > 0 && <section id="services" className="border-t border-[var(--portfolio-border)] py-12"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--portfolio-accent)]">services</p><h2 className="mt-2 text-3xl font-black text-[var(--portfolio-ink)]">ways I can help.</h2><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{content.services.map((service) => <ServiceCard key={service.id} service={service} />)}</div></section>}

        {visible("testimonials") && content.testimonials.length > 0 && <section className="border-t border-[var(--portfolio-border)] py-12"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--portfolio-accent)]">kind words</p><div className="mt-7 grid gap-5 md:grid-cols-2">{content.testimonials.map((testimonial) => <blockquote key={testimonial.id} className="rounded-2xl border border-[var(--portfolio-border)] bg-[var(--portfolio-card)] p-6"><p className="text-lg leading-8 text-[var(--portfolio-ink)]">“{testimonial.quote}”</p><footer className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--portfolio-muted)]">{testimonial.name}{testimonial.company && ` · ${testimonial.company}`}</footer></blockquote>)}</div></section>}

        {visible("contact") && <section id="contact" className="mt-4 rounded-3xl bg-[var(--portfolio-accent)] p-8 text-white sm:p-12"><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">have a project in mind?</p><h2 className="mt-3 max-w-2xl text-4xl font-black tracking-tight">let&apos;s make something worth sharing.</h2>{content.contactEmail && <a href={`mailto:${content.contactEmail}`} className="mt-7 inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-[var(--portfolio-accent)]">email {content.contactEmail}</a>}</section>}
      </main>
      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-[var(--portfolio-border)] px-6 py-8 text-xs text-[var(--portfolio-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-10"><span>made with rive.</span><div className="flex gap-4">{content.social.map((social) => <a key={social.label} href={social.url} target="_blank" rel="noreferrer" className="hover:text-[var(--portfolio-accent)]">{social.label}</a>)}</div></footer>
    </div>
  );
}
