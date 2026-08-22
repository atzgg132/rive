import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { MarketingPageContent } from "@/content/marketing/pages";
import { cn } from "@/lib/utils";
import { GlassPanel, GlowingBadge, HairlineDivider, MarketingButton } from "@/components/marketing/primitives";

export function SectionShell({ children, id, className, innerClassName }: { children: ReactNode; id?: string; className?: string; innerClassName?: string }) {
  return (
    <section id={id} className={cn("marketing-deferred-section relative overflow-x-clip py-20 sm:py-28 lg:py-32", className)}>
      <div className={cn("relative mx-auto w-full max-w-7xl px-5 sm:px-8", innerClassName)}>{children}</div>
    </section>
  );
}

export function MarketingPage({ content }: { content: MarketingPageContent }) {
  return (
    <>
      <SectionShell className="pb-16 pt-36 sm:pb-20 sm:pt-44">
        <div className="max-w-4xl">
          <GlowingBadge>{content.eyebrow}</GlowingBadge>
          <h1 className="mt-7 text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">{content.title}</h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl sm:leading-9">{content.intro}</p>
        </div>
      </SectionShell>
      <HairlineDivider />
      {content.sections.map((section, sectionIndex) => (
        <SectionShell key={section.title} className={sectionIndex % 2 ? "bg-white/[0.012]" : undefined}>
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              {section.eyebrow ? <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">{section.eyebrow}</p> : null}
              <h2 className="mt-3 max-w-xl text-3xl font-black leading-tight tracking-[-0.04em] text-white sm:text-5xl">{section.title}</h2>
              {section.body ? <p className="mt-5 max-w-xl text-base leading-8 text-slate-400">{section.body}</p> : null}
            </div>
            <div>
              {section.cards ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {section.cards.map((card) => (
                    <GlassPanel key={card.title} tier={2} className="flex min-h-56 flex-col p-6 sm:p-7">
                      {card.meta ? <p className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-blue-300">{card.meta}</p> : null}
                      <h3 className="mt-auto pt-8 text-xl font-bold tracking-[-0.025em] text-white">{card.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-400">{card.body}</p>
                      {card.href ? <Link href={card.href} prefetch={false} className="marketing-focus mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-300">Read more <ArrowRight className="h-4 w-4" /></Link> : null}
                    </GlassPanel>
                  ))}
                </div>
              ) : null}
              {section.bullets ? (
                <ul className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
                  {section.bullets.map((bullet, index) => <li key={bullet} className="flex gap-5 py-5 text-base leading-7 text-slate-300"><span className="font-mono text-xs text-blue-300">{String(index + 1).padStart(2, "0")}</span><span>{bullet}</span></li>)}
                </ul>
              ) : null}
            </div>
          </div>
        </SectionShell>
      ))}
      {content.cta ? (
        <SectionShell>
          <GlassPanel tier={3} className="overflow-hidden p-8 text-center sm:p-12 lg:p-16">
            <p className="mx-auto max-w-2xl text-3xl font-black tracking-[-0.04em] text-white sm:text-5xl">{content.cta.headline}</p>
            {content.cta.note ? <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-400">{content.cta.note}</p> : null}
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
        <h1 className="mt-7 max-w-5xl text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-7xl">{title}</h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300">{intro}</p>
      </SectionShell>
      <SectionShell className="pt-8">{children}</SectionShell>
    </>
  );
}

export function ProseShell({ eyebrow, title, children, updated }: { eyebrow: string; title: string; children: ReactNode; updated?: string }) {
  return (
    <SectionShell className="pb-24 pt-36 sm:pt-44">
      <div className="mx-auto max-w-4xl">
        <GlowingBadge>{eyebrow}</GlowingBadge>
        <h1 className="mt-7 text-5xl font-black tracking-[-0.05em] text-white sm:text-7xl">{title}</h1>
        {updated ? <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-slate-400">{updated}</p> : null}
        <GlassPanel tier={2} className="prose prose-invert mt-12 max-w-none p-6 text-slate-300 sm:p-10 [&_a]:text-blue-300 [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-white [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-white [&_li]:my-2 [&_p]:leading-8 [&_strong]:text-white">
          {children}
        </GlassPanel>
      </div>
    </SectionShell>
  );
}
