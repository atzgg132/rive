import { ArrowDown, ArrowRight, Braces, CircleDollarSign, ShieldCheck } from "lucide-react";
import { homeContent } from "@/content/marketing/home";
import { pricingContent } from "@/content/marketing/pricing";
import { RevealOnScroll } from "@/components/marketing/RevealOnScroll";
import { ConnectedSignalField } from "@/components/marketing/ConnectedSignalField";
import { ImportReconnection } from "@/components/marketing/product/ImportReconnection";
import { ContractToCash } from "@/components/marketing/product/ContractToCash";
import { PortfolioLoop } from "@/components/marketing/product/PortfolioLoop";
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
          <div className="relative z-10 mx-auto flex max-w-[76rem] flex-col items-center px-5 text-center sm:px-8">
            <GlowingBadge pulse>{homeContent.hero.eyebrow}</GlowingBadge>
            <h1 className="mt-5 text-[clamp(3.25rem,7.5vw,6.5rem)] font-black leading-[0.94] tracking-[-0.05em] text-foreground sm:mt-6">
              <span className="block animate-hero-line-in" style={{ animationDelay: "0ms" }}>Your business</span>
              <span className="block animate-hero-line-in" style={{ animationDelay: "80ms" }}>should not need</span>
              <span className="block animate-hero-line-in" style={{ animationDelay: "160ms" }}>
                you as{" "}
                <span className="hero-word-gradient">middleware.</span>
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:mt-6 sm:text-xl sm:leading-9">{homeContent.hero.body}</p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:mt-8 sm:flex-row sm:items-center">
              <MagneticButton href={homeContent.hero.primaryCta.href}>{homeContent.hero.primaryCta.label} <ArrowRight className="ml-2 inline h-4 w-4" aria-hidden="true" /></MagneticButton>
              <SmoothAnchor
                href={homeContent.hero.secondaryCta.href}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--stroke-hairline)] bg-[var(--surface-glass)] px-5 text-sm font-bold text-foreground transition duration-200 ease-rive-out hover:-translate-y-0.5 hover:border-primary/25 hover:bg-foreground/[0.07]"
              >
                {homeContent.hero.secondaryCta.label} <ArrowDown className="ml-2 h-4 w-4" aria-hidden="true" />
              </SmoothAnchor>
            </div>
            <div aria-label="Proof points" className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 sm:mt-8 sm:gap-x-6 sm:gap-y-3">
              {homeContent.hero.proof.map((item) => (
                <span key={item} className="inline-flex items-center gap-2 font-mono text-[0.64rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-10 w-full sm:mt-14">
              <HeroPipeline />
            </div>
          </div>
        </section>
      </SpotlightCursor>

      <section id="product" className="relative overflow-x-clip pb-20 lg:pb-8">
        <div className="mx-auto max-w-[90rem] px-5 sm:px-8">
          <ScrollytellingSection problem={homeContent.tax} chapters={homeContent.scrolly.chapters} />
        </div>
      </section>

      <HairlineDivider />

      <SectionShell id="import">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
          <RevealOnScroll>
            <GlowingBadge>{homeContent.import.eyebrow}</GlowingBadge>
            <h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-foreground sm:text-6xl">{homeContent.import.title}</h2>
            <p className="mt-6 text-base leading-8 text-muted-foreground">{homeContent.import.body}</p>
            <FeatureList items={homeContent.import.facts} className="mt-8" />
          </RevealOnScroll>
          <ImportReconnection {...homeContent.import.visual} />
        </div>
      </SectionShell>

      <SectionShell id="agreements" className="marketing-alt-band">
        <div data-testid="marketing-agreements-section" className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
          <RevealOnScroll>
            <GlowingBadge>{homeContent.agreement.eyebrow}</GlowingBadge>
            <h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-foreground sm:text-6xl">{homeContent.agreement.title}</h2>
            <p className="mt-6 text-base leading-8 text-muted-foreground">{homeContent.agreement.body}</p>
            <p className="mt-8 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary"><span>{homeContent.agreement.tags[0]}</span><span aria-hidden="true"> · </span><span>{homeContent.agreement.tags[1]}</span></p>
          </RevealOnScroll>
          <ContractToCash {...homeContent.agreement.visual} />
        </div>
      </SectionShell>

      <SectionShell id="remit">
        <div data-testid="remit-section" className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-start lg:gap-16">
          <div data-testid="remit-story">
            <GlowingBadge>{homeContent.remit.eyebrow}</GlowingBadge>
            <h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-foreground sm:text-6xl">{homeContent.remit.title}</h2>
            <p className="mt-6 text-base leading-8 text-muted-foreground">{homeContent.remit.body}</p>
            <div className="mt-8 grid gap-3">
              {homeContent.remit.promises.map((promise) => <div key={promise} data-testid="remit-promise" className="flex items-center gap-3 rounded-xl border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] p-3 text-sm font-semibold text-muted-foreground"><CircleDollarSign className="h-4 w-4 text-primary" />{promise}</div>)}
            </div>
          </div>
          <GlassPanel tier={3} className="min-w-0 p-6 sm:p-8 lg:min-w-[28rem]">
            <div data-testid="remit-calculator">
              <div className="flex items-center justify-between"><p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-primary">{homeContent.remit.ledger.label}</p><Braces className="h-4 w-4 text-muted-foreground" /></div>
              <div className="mt-6 overflow-hidden rounded-xl border border-[var(--stroke-hairline)]">
                <div className="hidden grid-cols-[1.15fr_1fr_1fr_1fr] gap-3 border-b border-[var(--stroke-hairline)] bg-[var(--surface-glass)] px-4 py-2.5 sm:grid">
                  {["Record", "Native amount", "Rate · date", "Display"].map((column, index) => (
                    <span key={column} className={index === 0 ? "font-mono text-[0.54rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground" : "text-right font-mono text-[0.54rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground"}>{column}</span>
                  ))}
                </div>
                {homeContent.remit.ledger.rows.map((row) => (
                  <div key={row.record} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-b border-[var(--stroke-hairline)] px-4 py-3 last:border-b-0 sm:grid-cols-[1.15fr_1fr_1fr_1fr] sm:items-baseline">
                    <span>
                      <span className="block text-sm font-bold tracking-[-0.02em] text-foreground">{row.record}</span>
                      <span className="mt-0.5 block text-[0.66rem] text-muted-foreground">{row.kind}</span>
                    </span>
                    <span className="text-right font-mono text-xs font-semibold tabular-nums text-foreground">{row.native}</span>
                    <span className="col-start-1 font-mono text-[0.62rem] tabular-nums text-muted-foreground sm:col-start-3 sm:text-right">{row.rate}</span>
                    <span className="col-start-2 text-right font-mono text-xs font-semibold tabular-nums text-primary sm:col-start-4">{row.display}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {homeContent.remit.ledger.totals.map((total, index) => (
                  <div key={total.label} className={index === 0 ? "rounded-xl border border-primary/15 bg-[var(--surface-raised)] p-4" : "rounded-xl border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] p-4"}>
                    <p className={index === 0 ? "font-mono text-[0.56rem] uppercase tracking-[0.12em] text-primary" : "font-mono text-[0.56rem] uppercase tracking-[0.12em] text-muted-foreground"}>{total.label}</p>
                    <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{total.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[var(--stroke-hairline)] p-4 text-sm"><span className="text-muted-foreground">Status</span><span className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-warning">{homeContent.remit.ledger.note}</span></div>
            </div>
          </GlassPanel>
        </div>
      </SectionShell>

      <SectionShell id="portfolio" className="marketing-alt-band">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
          <RevealOnScroll><GlowingBadge>{homeContent.portfolio.eyebrow}</GlowingBadge><h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-foreground sm:text-6xl">{homeContent.portfolio.title}</h2><p className="mt-6 text-base leading-8 text-muted-foreground">{homeContent.portfolio.body}</p></RevealOnScroll>
          <PortfolioLoop {...homeContent.portfolio.visual} />
        </div>
      </SectionShell>

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
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <GlowingBadge>{homeContent.remitNext.eyebrow}</GlowingBadge>
                <span className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-warning">{homeContent.remitNext.status}</span>
              </div>
              <h2 className="mt-6 text-3xl font-black leading-[1.04] tracking-[-0.045em] text-foreground sm:text-5xl">{homeContent.remitNext.title}</h2>
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
          <div className="relative"><GlowingBadge pulse>{homeContent.finalCta.eyebrow}</GlowingBadge><h2 className="mx-auto mt-7 max-w-4xl text-4xl font-black leading-[1] tracking-[-0.05em] text-foreground sm:text-7xl">{homeContent.finalCta.title}</h2><p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground">{homeContent.finalCta.body}</p><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><MagneticButton href={homeContent.finalCta.primary.href}>{homeContent.finalCta.primary.label}</MagneticButton><MarketingButton href={homeContent.finalCta.secondary.href} variant="secondary">{homeContent.finalCta.secondary.label}</MarketingButton></div></div>
        </GlassPanel>
      </SectionShell>
    </>
  );
}
