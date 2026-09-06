import { ArrowRight } from "lucide-react";
import { homeContent } from "@/content/marketing/home";
import { pricingContent } from "@/content/marketing/pricing";
import { CinematicHero } from "@/components/marketing/hero/CinematicHero";
import { MagneticButton } from "@/components/marketing/MagneticButton";
import { ScrollytellingSection } from "@/components/marketing/ScrollytellingSection";
import { FeatureList, GlassPanel, GlowingBadge, HairlineDivider, MarketingButton } from "@/components/marketing/primitives";
import { SectionShell } from "@/components/marketing/shells";

export function MarketingHome() {
  return (
    <>
      <CinematicHero />

      <section id="product" className="relative scroll-mt-[5.5rem] pb-20 lg:pb-8">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-8">
          <ScrollytellingSection problem={homeContent.tax} chapters={homeContent.scrolly.chapters} />
        </div>
      </section>

      <HairlineDivider />

      <SectionShell id="icp-anchor">
        <div className="max-w-4xl">
          <GlowingBadge>{"BUILT FOR YOUR PRACTICE"}</GlowingBadge>
          <h2 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
            {"For people whose name is on the work."}
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            {"Freelancers, studios, and small agencies managing 2–3+ clients at once. Rive replaces the morning reassembly with one operating workspace."}
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: "Stop re-entering the same context", body: "Clients, projects, agreements, invoices, and deadlines stay connected. Change one record and the rest already know." },
            { title: "Bill from the work, not from memory", body: "Accepted terms become draft invoices. Payments, expenses, and margins live in one financial view." },
            { title: "Turn delivery into the next deal", body: "Portfolio Studio publishes selected work into a public site with analytics and inbound enquiries." },
          ].map((card) => (
            <GlassPanel key={card.title} tier={2} className="flex h-full flex-col p-6 sm:p-7">
              <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{card.body}</p>
            </GlassPanel>
          ))}
        </div>
      </SectionShell>

      <HairlineDivider />

      <SectionShell id="pricing">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:gap-20">
          <div>
            <GlowingBadge>{pricingContent.eyebrow}</GlowingBadge>
            <h2 className="mt-6 text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-6xl">{pricingContent.title}</h2>
            <p className="mt-6 text-base leading-8 text-muted-foreground">{pricingContent.body}</p>
          </div>
          <GlassPanel tier={3} className="p-7 sm:p-10">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">{pricingContent.plan}</p>
            <div className="mt-5 flex items-end gap-3">
              <span className="text-6xl font-semibold tracking-[-0.05em] text-foreground">{pricingContent.price}</span>
              <span className="pb-2 text-sm text-muted-foreground">{pricingContent.cadence}</span>
            </div>
            <FeatureList items={pricingContent.features} className="mt-8" />
            <MagneticButton href={pricingContent.cta.href} className="mt-8 w-full">
              {pricingContent.cta.label} <ArrowRight className="ml-2 inline h-4 w-4" />
            </MagneticButton>
            <p className="mt-5 text-xs leading-6 text-muted-foreground">{pricingContent.footnote}</p>
          </GlassPanel>
        </div>
      </SectionShell>

      <HairlineDivider />

      <SectionShell id="faq">
        <div className="max-w-3xl">
          <GlowingBadge>{homeContent.faq.eyebrow}</GlowingBadge>
          <h2 className="mt-6 text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-6xl">{homeContent.faq.title}</h2>
        </div>
        <div data-testid="faq-grid" className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-[var(--stroke-hairline)] bg-[var(--stroke-hairline)] md:grid-cols-2">
          {homeContent.faq.items.map((item) => (
            <article key={item.question} className="bg-[var(--surface-void)] p-6 sm:p-8">
              <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">{item.question}</h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{item.answer}</p>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell>
        <GlassPanel tier={3} className="relative overflow-hidden p-8 text-center sm:p-14 lg:p-20">
          <div className="pointer-events-none absolute inset-0 bg-glow-radial opacity-60" />
          <div className="relative">
            <GlowingBadge pulse>{homeContent.finalCta.eyebrow}</GlowingBadge>
            <h2 className="mx-auto mt-7 max-w-4xl text-[clamp(2.25rem,5vw+1rem,4.5rem)] font-semibold leading-[1] tracking-[-0.04em] text-foreground">
              {homeContent.finalCta.title}
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground">{homeContent.finalCta.body}</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <MagneticButton href={homeContent.finalCta.primary.href}>{homeContent.finalCta.primary.label}</MagneticButton>
              <MarketingButton href={homeContent.finalCta.secondary.href} variant="secondary">{homeContent.finalCta.secondary.label}</MarketingButton>
            </div>
          </div>
        </GlassPanel>
      </SectionShell>
    </>
  );
}
