import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { MarketingPageContent } from "@/content/marketing/pages";
import { cn } from "@/lib/utils";
import { GlassPanel, GlowingBadge, HairlineDivider, MarketingButton } from "@/components/marketing/primitives";

export function SectionShell({
  children,
  id,
  className,
  innerClassName,
  clipX = true,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
  innerClassName?: string;
  clipX?: boolean;
}) {
  return (
    <section id={id} className={cn("marketing-deferred-section relative py-[clamp(3.5rem,7.5svh,8rem)]", className)}>
      <div className={cn("relative mx-auto w-full min-w-0 max-w-7xl px-5 sm:px-8", clipX && "overflow-x-clip", innerClassName)}>{children}</div>
    </section>
  );
}

export function MarketingPage({ content }: { content: MarketingPageContent }) {
  return (
    <>
      <SectionShell className="pb-16 pt-36 sm:pb-20 sm:pt-44">
        <div className="max-w-4xl">
          <GlowingBadge>{content.eyebrow}</GlowingBadge>
          <h1 className="mt-7 text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em] text-foreground sm:text-6xl lg:text-7xl">{content.title}</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-muted-foreground sm:text-xl sm:leading-9">{content.intro}</p>
        </div>
      </SectionShell>
      <HairlineDivider />
      {content.sections.map((section, sectionIndex) => {
        const cards = section.cards;
        const hasCards = Boolean(cards?.length);
        const hasBullets = Boolean(section.bullets?.length);
        const hasRail = hasCards || hasBullets;
        return (
          <SectionShell key={section.title} className={sectionIndex % 2 ? "marketing-alt-band" : undefined}>
            <div className={hasRail ? "grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20" : "max-w-3xl"}>
              <div>
                {section.eyebrow ? <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">{section.eyebrow}</p> : null}
                <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight tracking-[-0.04em] text-foreground sm:text-5xl">{section.title}</h2>
                {section.body ? <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground">{section.body}</p> : null}
              </div>
              {hasRail ? (
                <div className="min-w-0">
                  {cards?.length ? (
                    <div className={cn("grid gap-4", cards.length === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
                      {cards.map((card) => (
                        <GlassPanel key={card.title} tier={2} className="flex min-h-56 flex-col p-6 sm:p-7">
                          {card.meta ? <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-primary">{card.meta}</p> : null}
                          <h3 className="mt-auto pt-8 text-xl font-bold tracking-[-0.025em] text-foreground">{card.title}</h3>
                          <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.body}</p>
                          {card.href ? <Link href={card.href} prefetch={false} className="marketing-focus mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80">Read more <ArrowRight className="h-4 w-4" /></Link> : null}
                        </GlassPanel>
                      ))}
                    </div>
                  ) : null}
                  {section.bullets ? (
                    <ul className="divide-y divide-[color:var(--stroke-hairline)] border-y border-[var(--stroke-hairline)]">
                      {section.bullets.map((bullet, index) => <li key={bullet} className="flex gap-5 py-5 text-base leading-7 text-muted-foreground"><span className="font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</span><span>{bullet}</span></li>)}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          </SectionShell>
        );
      })}
      {content.cta ? (
        <SectionShell>
          <GlassPanel tier={3} className="overflow-hidden p-8 text-center sm:p-12 lg:p-16">
            <p className="mx-auto max-w-2xl text-3xl font-black tracking-[-0.04em] text-foreground sm:text-5xl">{content.cta.headline}</p>
            {content.cta.note ? <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground">{content.cta.note}</p> : null}
            <MarketingButton href={content.cta.href} className="mt-8">{content.cta.label} <ArrowRight className="ml-2 h-4 w-4" /></MarketingButton>
          </GlassPanel>
        </SectionShell>
      ) : null}
    </>
  );
}

export function IndexShell({ children, eyebrow, title, intro }: { children: ReactNode; eyebrow: string; title: string; intro: string }) {
  return (
    <>
      <SectionShell className="pb-14 pt-36 sm:pt-44">
        <GlowingBadge>{eyebrow}</GlowingBadge>
        <h1 className="mt-7 max-w-5xl text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em] text-foreground sm:text-7xl">{title}</h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-muted-foreground">{intro}</p>
      </SectionShell>
      <SectionShell className="pt-8" clipX={false}>{children}</SectionShell>
    </>
  );
}

export function ProseShell({ eyebrow, title, children, updated }: { eyebrow: string; title: string; children: ReactNode; updated?: string }) {
  return (
    <SectionShell className="pb-24 pt-36 sm:pt-44" clipX={false}>
      <div className="mx-auto max-w-4xl">
        <GlowingBadge>{eyebrow}</GlowingBadge>
        <h1 className="mt-7 text-5xl font-black tracking-[-0.05em] text-foreground sm:text-7xl">{title}</h1>
        {updated ? <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{updated}</p> : null}
        <GlassPanel tier={2} className="prose dark:prose-invert mt-12 max-w-none p-6 text-muted-foreground sm:p-10 [&_a]:text-primary [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-foreground [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-foreground [&_li]:my-2 [&_p]:leading-8 [&_strong]:text-foreground">
          {children}
        </GlassPanel>
      </div>
    </SectionShell>
  );
}

export function LegalToc({ items }: { items: readonly { id: string; label: string }[] }) {
  return (
    <>
      <nav aria-label="On this page" className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain pb-1 md:hidden">
        {items.map((item) => (
          <a key={item.id} href={`#${item.id}`} className="marketing-focus shrink-0 rounded-full border border-[var(--stroke-hairline)] bg-[var(--surface-glass)] px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {item.label}
          </a>
        ))}
      </nav>
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-28 rounded-2xl border border-[var(--stroke-hairline)] bg-[var(--surface-glass)] p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">On this page</p>
          <nav className="flex flex-col gap-2" aria-label="On this page">
            {items.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="marketing-focus rounded-md py-0.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
