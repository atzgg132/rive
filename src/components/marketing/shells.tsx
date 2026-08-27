import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { MarketingPageContent } from "@/content/marketing/pages";
import { cn } from "@/lib/utils";
import { GlassPanel, GlowingBadge, MarketingButton } from "@/components/marketing/primitives";

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
    <section id={id} className={cn("marketing-deferred-section relative py-20 sm:py-28 lg:py-32", id && "scroll-mt-[5.5rem]", className)}>
      <div className={cn("relative mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-8", clipX && "overflow-x-clip", innerClassName)}>{children}</div>
    </section>
  );
}

export function MarketingPage({ content }: { content: MarketingPageContent }) {
  return (
    <>
      <SectionShell className="pb-12 pt-32 sm:pb-16 sm:pt-40 lg:pb-20 lg:pt-40">
        <div className="mx-auto max-w-4xl">
          <GlowingBadge>{content.eyebrow}</GlowingBadge>
          <h1 className="mt-6 text-balance text-4xl font-black leading-[1.04] tracking-[-0.05em] text-foreground sm:text-5xl lg:text-6xl">{content.title}</h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl sm:leading-9">{content.intro}</p>
        </div>
      </SectionShell>
      {content.sections.map((section, sectionIndex) => {
        const cards = section.cards;
        const hasCards = Boolean(cards?.length);
        const cardColumns = cards?.length === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2";
        return (
          <SectionShell key={section.title} className={cn("py-14 sm:py-16 lg:py-20", sectionIndex % 2 ? "marketing-alt-band" : undefined)}>
            <div className="mx-auto max-w-4xl">
              {section.eyebrow ? <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">{section.eyebrow}</p> : null}
              <h2 className={cn("text-3xl font-black leading-tight tracking-[-0.04em] text-foreground sm:text-4xl", section.eyebrow ? "mt-3" : undefined)}>{section.title}</h2>
              {section.body ? <p className="mt-4 text-base leading-8 text-muted-foreground">{section.body}</p> : null}
              {hasCards ? (
                <div className={cn("mt-8 grid gap-4", cardColumns)}>
                  {cards!.map((card) => (
                    <GlassPanel key={card.title} tier={2} className="flex h-full flex-col p-6 sm:p-7">
                      {card.meta ? <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-primary">{card.meta}</p> : null}
                      <h3 className={cn("text-xl font-bold tracking-[-0.025em] text-foreground", card.meta ? "mt-3" : undefined)}>{card.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.body}</p>
                      {card.href ? <Link href={card.href} prefetch={false} className="marketing-focus mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80">Read more <ArrowRight className="h-4 w-4" /></Link> : null}
                    </GlassPanel>
                  ))}
                </div>
              ) : null}
              {section.bullets?.length ? (
                <ul className="mt-8 divide-y divide-[color:var(--stroke-hairline)] border-y border-[var(--stroke-hairline)]">
                  {section.bullets.map((bullet, index) => (
                    <li key={bullet} className="flex gap-4 py-4 text-base leading-7 text-muted-foreground sm:gap-5 sm:py-5">
                      <span className="w-8 shrink-0 font-mono text-xs text-primary">{String(index + 1).padStart(2, "0")}</span>
                      <span className="min-w-0">{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </SectionShell>
        );
      })}
      {content.cta ? (
        <SectionShell className="py-14 sm:py-16 lg:py-20">
          <div className="mx-auto max-w-4xl">
            <GlassPanel tier={3} className="overflow-hidden p-8 text-center sm:p-12">
              <p className="text-3xl font-black tracking-[-0.04em] text-foreground sm:text-4xl">{content.cta.headline}</p>
              {content.cta.note ? <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground">{content.cta.note}</p> : null}
              <MarketingButton href={content.cta.href} className="mt-8">{content.cta.label} <ArrowRight className="ml-2 h-4 w-4" /></MarketingButton>
            </GlassPanel>
          </div>
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
