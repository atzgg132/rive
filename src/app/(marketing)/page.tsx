import { ArrowDown, ArrowRight, Braces, CalendarDays, CircleDollarSign, FileSignature, FileUp, Globe2, Link2, ShieldCheck } from "lucide-react";
import { homeContent } from "@/content/marketing/home";
import { pricingContent } from "@/content/marketing/pricing";
import { marketingMetadata } from "@/lib/marketingMetadata";
import { AnimatedBentoCard } from "@/components/marketing/AnimatedBentoCard";
import { BentoGrid, RevealOnScroll } from "@/components/marketing/RevealOnScroll";
import { CodeSnippetBlock } from "@/components/marketing/CodeSnippetBlock";
import { MagneticButton } from "@/components/marketing/MagneticButton";
import { ProductCommandPalette } from "@/components/marketing/product/ProductCommandPalette";
import { DeferredProductScene } from "@/components/marketing/product/DeferredProductScene";
import { ScrollytellingSection } from "@/components/marketing/ScrollytellingSection";
import { SpotlightCursor } from "@/components/marketing/SpotlightCursor";
import { FeatureList, GlassPanel, GlowingBadge, GradientText, HairlineDivider, LogoMarquee, MarketingButton } from "@/components/marketing/primitives";
import { SectionShell } from "@/components/marketing/shells";

export const metadata = marketingMetadata(
  "Rive — Your business should not need you as middleware",
  "Connect clients, projects, Agreements, invoices, expenses, calendars, imports, and portfolio proof in one operating workspace.",
  "/",
);

const bentoIcons = [Link2, FileSignature, CircleDollarSign, CalendarDays, FileUp, Globe2];

export default function MarketingHomePage() {
  return (
    <>
      <SpotlightCursor>
        <section className="relative flex min-h-[100svh] items-center overflow-x-clip pb-20 pt-32 sm:pt-36">
          <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:gap-16">
            <div className="relative z-10">
              <GlowingBadge pulse>{homeContent.hero.eyebrow}</GlowingBadge>
              <h1 className="mt-7 max-w-5xl text-balance text-[clamp(3.3rem,8vw,6.8rem)] font-black leading-[0.88] tracking-[-0.07em] text-white">
                Your business should not need you as <GradientText>middleware.</GradientText>
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl sm:leading-9">{homeContent.hero.body}</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <MagneticButton href={homeContent.hero.primaryCta.href}>{homeContent.hero.primaryCta.label} <ArrowRight className="ml-2 inline h-4 w-4" /></MagneticButton>
                <MarketingButton href={homeContent.hero.secondaryCta.href} variant="secondary">{homeContent.hero.secondaryCta.label} <ArrowDown className="ml-2 h-4 w-4" /></MarketingButton>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
                {homeContent.hero.proof.map((item) => <span key={item} className="inline-flex items-center gap-2 font-mono text-[0.64rem] font-semibold uppercase tracking-[0.13em] text-slate-400"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />{item}</span>)}
              </div>
            </div>

            <div className="relative z-10 lg:translate-y-8">
              <div className="absolute -inset-16 -z-10 bg-glow-radial opacity-80 blur-2xl" aria-hidden="true" />
              <ProductCommandPalette
                query="INV-1042"
                placeholder="Search clients, projects, or invoices…"
                results={[
                  { title: "INV-1042", meta: "Northstar Labs · Product redesign · Paid" },
                  { title: "INV-1039", meta: "Atlas Studio · Research sprint · Sent" },
                ]}
              />
              <div className="mx-auto mt-4 grid max-w-[34rem] grid-cols-3 gap-2">
                {["Client", "Work", "Money"].map((item, index) => <div key={item} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-center"><p className="font-mono text-[0.52rem] uppercase tracking-[0.12em] text-slate-400">0{index + 1}</p><p className="mt-1 text-xs font-bold text-slate-200">{item}</p></div>)}
              </div>
            </div>
          </div>
        </section>
      </SpotlightCursor>

      <div className="border-y border-white/[0.055] py-5">
        <LogoMarquee label="The connected Rive operating loop" items={["CLIENT CONTEXT", "PROJECT DELIVERY", "AGREEMENTS", "INVOICES", "EXPENSES", "CALENDAR", "IMPORTS", "PORTFOLIO PROOF"]} />
      </div>

      <SectionShell id="features">
        <div className="grid gap-10 lg:grid-cols-[.78fr_1.22fr] lg:items-end lg:gap-20">
          <div><GlowingBadge>{homeContent.tax.eyebrow}</GlowingBadge><h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl">{homeContent.tax.title}</h2></div>
          <div><p className="text-lg leading-8 text-slate-300">{homeContent.tax.body}</p><p className="mt-8 text-2xl font-black tracking-[-0.035em] text-white">{homeContent.tax.close}</p></div>
        </div>
        <BentoGrid className="mt-16">
          {homeContent.bento.map((item, index) => {
            const Icon = bentoIcons[index];
            return (
              <AnimatedBentoCard key={item.title} className={index === 0 || index === 5 ? "lg:col-span-2" : undefined}>
                <div className="flex items-start justify-between gap-5"><span className="grid h-10 w-10 place-items-center rounded-xl border border-blue-300/15 bg-blue-400/[0.07] text-blue-300"><Icon className="h-[1.125rem] w-[1.125rem]" /></span><span className="font-mono text-[0.58rem] font-bold uppercase tracking-[0.14em] text-slate-400">{item.metric}</span></div>
                <p className="mt-12 font-mono text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-blue-300">{item.eyebrow}</p>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">{item.title}</h3>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400">{item.body}</p>
              </AnimatedBentoCard>
            );
          })}
        </BentoGrid>
      </SectionShell>

      <HairlineDivider />

      <SectionShell id="product" innerClassName="max-w-[90rem]">
        <div className="mx-auto mb-8 max-w-7xl px-0 sm:mb-12">
          <GlowingBadge>{homeContent.scrolly.eyebrow}</GlowingBadge>
          <h2 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl">{homeContent.scrolly.title}</h2>
          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-400">{homeContent.scrolly.body}</p>
        </div>
        <ScrollytellingSection chapters={homeContent.scrolly.chapters} />
      </SectionShell>

      <HairlineDivider />

      <SectionShell id="import">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20">
          <RevealOnScroll>
            <GlowingBadge>{homeContent.import.eyebrow}</GlowingBadge>
            <h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl">Start with the data you already have.</h2>
            <p className="mt-6 text-base leading-8 text-slate-400">{homeContent.import.body}</p>
            <FeatureList items={homeContent.import.facts} className="mt-8" />
          </RevealOnScroll>
          <RevealOnScroll delay={0.12}>
            <CodeSnippetBlock
              label="relationship-review.json"
              language="migration preview"
              typewriter
              code={`{\n  "source": "workspace-export.xlsx",\n  "ready": 1247,\n  "needsReview": 31,\n  "relationships": [\n    "Northstar → Product redesign → INV-1042",\n    "Atlas → Website relaunch → EXP-388"\n  ],\n  "commit": "waiting_for_you"\n}`}
            />
          </RevealOnScroll>
        </div>
      </SectionShell>

      <SectionShell id="agreements" className="bg-white/[0.012]">
        <div data-testid="marketing-agreements-section" className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-center lg:gap-16">
          <div>
            <GlowingBadge>CONTRACT TO CASH</GlowingBadge>
            <h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl">A promise should not disappear before the invoice.</h2>
            <p className="mt-6 text-base leading-8 text-slate-400">The Agreement begins with client and project context, moves through deliberate review and recorded acceptance, then carries approved payment triggers into draft billing.</p>
            <p className="mt-8 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-blue-300"><span>Contracts &amp; acceptance</span><span aria-hidden="true"> · </span><span>Contract to cash</span></p>
          </div>
          <RevealOnScroll delay={0.1}>
            <DeferredProductScene sceneKey="agreement-preview" visual={homeContent.scrolly.chapters[1].visual} />
          </RevealOnScroll>
        </div>
      </SectionShell>

      <SectionShell id="remit">
        <div data-testid="remit-section" className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-start lg:gap-16">
          <div data-testid="remit-story">
            <GlowingBadge>{homeContent.remit.eyebrow}</GlowingBadge>
            <h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl">{homeContent.remit.title}</h2>
            <p className="mt-6 text-base leading-8 text-slate-400">{homeContent.remit.body}</p>
            <div className="mt-8 grid gap-3">
              {homeContent.remit.promises.map((promise) => <div key={promise} data-testid="remit-promise" className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-[#0a0e16] p-3 text-sm font-semibold text-slate-300"><CircleDollarSign className="h-4 w-4 text-blue-300" />{promise}</div>)}
            </div>
          </div>
          <GlassPanel tier={3} className="min-w-0 p-6 sm:p-8 lg:min-w-[28rem]">
            <div data-testid="remit-calculator">
              <div className="flex items-center justify-between"><p className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-blue-300">Workspace display</p><Braces className="h-4 w-4 text-slate-400" /></div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/[0.08] bg-[#101722] p-4"><p className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-slate-400">Native amount</p><p className="mt-2 text-2xl font-black text-white">{homeContent.remit.calculator.from}</p></div><div className="rounded-xl border border-blue-300/15 bg-[#101a2c] p-4"><p className="font-mono text-[0.56rem] uppercase tracking-[0.12em] text-blue-300">Display amount</p><p className="mt-2 text-2xl font-black text-white">{homeContent.remit.calculator.to}</p></div></div>
              <div className="mt-4 rounded-xl border border-white/[0.07] p-4"><div className="flex items-center justify-between gap-4 text-sm"><span className="text-slate-400">Rate used</span><span className="font-mono text-xs font-semibold text-slate-200">{homeContent.remit.calculator.rate}</span></div><div className="mt-3 flex items-center justify-between gap-4 text-sm"><span className="text-slate-400">Status</span><span className="font-mono text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-amber-300">{homeContent.remit.calculator.note}</span></div></div>
            </div>
          </GlassPanel>
        </div>
      </SectionShell>

      <SectionShell id="portfolio" className="bg-white/[0.012]">
        <div className="grid gap-12 lg:grid-cols-[.72fr_1.28fr] lg:items-center lg:gap-16">
          <div><GlowingBadge>{homeContent.portfolio.eyebrow}</GlowingBadge><h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl">{homeContent.portfolio.title}</h2><p className="mt-6 text-base leading-8 text-slate-400">{homeContent.portfolio.body}</p></div>
          <RevealOnScroll delay={0.1}><DeferredProductScene sceneKey="portfolio-preview" visual={homeContent.scrolly.chapters[5].visual} /></RevealOnScroll>
        </div>
      </SectionShell>

      <SectionShell id="pricing">
        <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:gap-20">
          <div><GlowingBadge>{pricingContent.eyebrow}</GlowingBadge><h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl">{pricingContent.title}</h2><p className="mt-6 text-base leading-8 text-slate-400">{pricingContent.body}</p></div>
          <GlassPanel tier={3} className="p-7 sm:p-10">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">{pricingContent.plan}</p>
            <div className="mt-5 flex items-end gap-3"><span className="text-6xl font-black tracking-[-0.06em] text-white">{pricingContent.price}</span><span className="pb-2 text-sm text-slate-400">{pricingContent.cadence}</span></div>
            <FeatureList items={pricingContent.features} className="mt-8" />
            <MagneticButton href={pricingContent.cta.href} className="mt-8 w-full">{pricingContent.cta.label} <ArrowRight className="ml-2 inline h-4 w-4" /></MagneticButton>
            <p className="mt-5 text-xs leading-6 text-slate-400">{pricingContent.footnote}</p>
          </GlassPanel>
        </div>
      </SectionShell>

      <HairlineDivider />

      <SectionShell id="faq">
        <div className="max-w-3xl"><GlowingBadge>{homeContent.faq.eyebrow}</GlowingBadge><h2 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white sm:text-6xl">{homeContent.faq.title}</h2></div>
        <div data-testid="faq-grid" className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] md:grid-cols-2">
          {homeContent.faq.items.map((item) => <article key={item.question} className="bg-[#070a11] p-6 sm:p-8"><h3 className="text-lg font-black tracking-[-0.025em] text-white">{item.question}</h3><p className="mt-4 text-sm leading-7 text-slate-400">{item.answer}</p></article>)}
        </div>
      </SectionShell>

      <SectionShell>
        <GlassPanel tier={3} className="relative overflow-hidden p-8 text-center sm:p-14 lg:p-20">
          <div className="pointer-events-none absolute inset-0 bg-glow-radial opacity-60" />
          <div className="relative"><GlowingBadge pulse>{homeContent.finalCta.eyebrow}</GlowingBadge><h2 className="mx-auto mt-7 max-w-4xl text-4xl font-black leading-[1] tracking-[-0.05em] text-white sm:text-7xl">{homeContent.finalCta.title}</h2><p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-400">{homeContent.finalCta.body}</p><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><MagneticButton href={homeContent.finalCta.primary.href}>{homeContent.finalCta.primary.label}</MagneticButton><MarketingButton href={homeContent.finalCta.secondary.href} variant="secondary">{homeContent.finalCta.secondary.label}</MarketingButton></div></div>
        </GlassPanel>
      </SectionShell>
    </>
  );
}
