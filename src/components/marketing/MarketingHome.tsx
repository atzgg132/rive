import { ArrowDown, ArrowRight, ShieldCheck } from "lucide-react";
import { homeContent } from "@/content/marketing/home";
import { pricingContent } from "@/content/marketing/pricing";
import { ConnectedSignalField } from "@/components/marketing/ConnectedSignalField";
import { HeroPipeline } from "@/components/marketing/HeroPipeline";
import { MagneticButton } from "@/components/marketing/MagneticButton";
import { RemitPreview } from "@/components/marketing/RemitPreview";
import { ScrollytellingSection } from "@/components/marketing/ScrollytellingSection";
import { SmoothAnchor } from "@/components/marketing/SmoothAnchor";
import { SpotlightCursor } from "@/components/marketing/SpotlightCursor";
import { FeatureList, GlassPanel, GlowingBadge, HairlineDivider, MarketingButton } from "@/components/marketing/primitives";
import { SectionShell } from "@/components/marketing/shells";

export function MarketingHome() {
  return (
    <>
      <SpotlightCursor>
        <section
          data-testid="marketing-hero"
          className="marketing-hero relative flex min-h-[100svh] items-center overflow-x-clip pb-10 pt-20 sm:pb-16 sm:pt-28 lg:pb-20"
        >
          <ConnectedSignalField className="opacity-55" />
          <div className="marketing-hero-inner relative z-10 mx-auto flex max-w-[76rem] flex-col items-center px-4 text-center sm:px-8">
            <GlowingBadge pulse>{homeContent.hero.eyebrow}</GlowingBadge>
            <h1 className="mt-5 text-[clamp(2.35rem,1.4rem+5vw,6.5rem)] font-black leading-[0.94] tracking-[-0.05em] text-foreground sm:mt-6">
              <span className="block animate-hero-line-in" style={{ animationDelay: "0ms" }}>Your business</span>
              <span className="block animate-hero-line-in" style={{ animationDelay: "80ms" }}>should not need</span>
              <span className="block animate-hero-line-in" style={{ animationDelay: "160ms" }}>
                you as{" "}
                <span className="hero-word-gradient">middleware.</span>
              </span>
            </h1>
            <p className="marketing-hero-body mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:mt-6 sm:text-xl sm:leading-9">{homeContent.hero.body}</p>
            <div className="marketing-hero-ctas mt-6 flex w-full flex-col justify-center gap-3 sm:mt-8 sm:w-auto sm:flex-row sm:items-center">
              <MagneticButton href={homeContent.hero.primaryCta.href} className="w-full sm:w-auto">{homeContent.hero.primaryCta.label} <ArrowRight className="ml-2 inline h-4 w-4" aria-hidden="true" /></MagneticButton>
              <SmoothAnchor
                href={homeContent.hero.secondaryCta.href}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--stroke-hairline)] bg-[var(--surface-glass)] px-5 text-sm font-bold text-foreground transition duration-200 ease-rive-out hover:-translate-y-0.5 hover:border-primary/25 hover:bg-foreground/[0.07] sm:w-auto"
              >
                {homeContent.hero.secondaryCta.label} <ArrowDown className="ml-2 h-4 w-4" aria-hidden="true" />
              </SmoothAnchor>
            </div>
            <div aria-label="Proof points" className="marketing-hero-proof mt-5 flex flex-col items-center gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-3">
              {homeContent.hero.proof.map((item) => (
                <span key={item} className="inline-flex items-center gap-2 font-mono text-[0.64rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
            <div className="marketing-hero-rail mt-10 w-full sm:mt-14">
              <HeroPipeline />
            </div>
          </div>
        </section>
      </SpotlightCursor>

      <section id="product" className="relative scroll-mt-[5.5rem] pb-20 lg:pb-8">
        <div className="mx-auto max-w-[90rem] px-4 sm:px-8">
          <ScrollytellingSection problem={homeContent.tax} chapters={homeContent.scrolly.chapters} />
        </div>
      </section>

      <HairlineDivider />

      <SectionShell id="pricing">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:gap-20">
          <div><GlowingBadge>{pricingContent.eyebrow}</GlowingBadge><h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-foreground sm:text-6xl">{pricingContent.title}</h2><p className="mt-6 text-base leading-8 text-muted-foreground">{pricingContent.body}</p></div>
          <GlassPanel tier={3} className="p-7 sm:p-10">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">{pricingContent.plan}</p>
            <div className="mt-5 flex items-end gap-3"><span className="text-6xl font-black tracking-[-0.06em] text-foreground">{pricingContent.price}</span><span className="pb-2 text-sm text-muted-foreground">{pricingContent.cadence}</span></div>
            <FeatureList items={pricingContent.features} className="mt-8" />
            <MagneticButton href={pricingContent.cta.href} className="mt-8 w-full">{pricingContent.cta.label} <ArrowRight className="ml-2 inline h-4 w-4" /></MagneticButton>
            <p className="mt-5 text-xs leading-6 text-muted-foreground">{pricingContent.footnote}</p>
          </GlassPanel>
        </div>
      </SectionShell>

      <HairlineDivider />

      <SectionShell id="faq">
        <div className="max-w-3xl"><GlowingBadge>{homeContent.faq.eyebrow}</GlowingBadge><h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-foreground sm:text-6xl">{homeContent.faq.title}</h2></div>
        <div data-testid="faq-grid" className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[var(--stroke-hairline)] bg-[var(--stroke-hairline)] md:grid-cols-2">
          {homeContent.faq.items.map((item) => <article key={item.question} className="bg-[var(--surface-void)] p-6 sm:p-8"><h3 className="text-lg font-black tracking-[-0.025em] text-foreground">{item.question}</h3><p className="mt-4 text-sm leading-7 text-muted-foreground">{item.answer}</p></article>)}
        </div>
      </SectionShell>

      <SectionShell id="remit-transfers" className="marketing-alt-band">
        <GlassPanel tier={2} className="relative overflow-hidden p-8 sm:p-12">
          <div data-testid="remit-next-section" className="grid gap-10 lg:grid-cols-[.95fr_1.05fr] lg:items-center lg:gap-16">
            <div data-testid="remit-next-story">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-sm font-black tracking-[-0.03em] text-foreground">{homeContent.remitNext.eyebrow}</span>
                <span
                  data-testid="remit-next-status"
                  className="inline-flex items-center rounded-full border border-[var(--stroke-hairline)] bg-[var(--surface-glass)] px-2.5 py-0.5 text-[0.68rem] font-medium tracking-[-0.01em] text-muted-foreground"
                >
                  {homeContent.remitNext.status}
                </span>
              </div>
              <h2 className="mt-5 text-3xl font-black leading-[1.04] tracking-[-0.045em] text-foreground sm:text-5xl">{homeContent.remitNext.title}</h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground">{homeContent.remitNext.body}</p>
              <dl className="mt-8 divide-y divide-[color:var(--stroke-hairline)] border-y border-[var(--stroke-hairline)]">
                {homeContent.remitNext.promises.map((promise) => (
                  <div key={promise.label} className="py-3.5">
                    <dt className="text-sm font-bold tracking-[-0.02em] text-foreground">{promise.label}</dt>
                    <dd className="mt-1 text-sm leading-6 text-muted-foreground">{promise.sub}</dd>
                  </div>
                ))}
              </dl>
              <MarketingButton href={homeContent.remitNext.cta.href} variant="secondary" className="mt-8">{homeContent.remitNext.cta.label} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /></MarketingButton>
            </div>
            <RemitPreview />
          </div>
        </GlassPanel>
      </SectionShell>

      <SectionShell>
        <GlassPanel tier={3} className="relative overflow-hidden p-8 text-center sm:p-14 lg:p-20">
          <div className="pointer-events-none absolute inset-0 bg-glow-radial opacity-60" />
          <div className="relative"><GlowingBadge pulse>{homeContent.finalCta.eyebrow}</GlowingBadge><h2 className="mx-auto mt-7 max-w-4xl text-[clamp(2.25rem,5vw+1rem,4.5rem)] font-black leading-[1] tracking-[-0.05em] text-foreground">{homeContent.finalCta.title}</h2><p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground">{homeContent.finalCta.body}</p><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><MagneticButton href={homeContent.finalCta.primary.href}>{homeContent.finalCta.primary.label}</MagneticButton><MarketingButton href={homeContent.finalCta.secondary.href} variant="secondary">{homeContent.finalCta.secondary.label}</MarketingButton></div></div>
        </GlassPanel>
      </SectionShell>
    </>
  );
}
