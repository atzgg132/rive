import { ArrowDown, ArrowRight } from "lucide-react";
import { homeContent } from "@/content/marketing/home";
import { HeroPipeline } from "@/components/marketing/HeroPipeline";
import { MagneticButton } from "@/components/marketing/MagneticButton";
import { SmoothAnchor } from "@/components/marketing/SmoothAnchor";
import { GlowingBadge } from "@/components/marketing/primitives";
import { LoopConstellation } from "@/components/marketing/hero/LoopConstellation";

export function CinematicHero() {
  return (
    <section
      data-testid="marketing-hero"
      className="marketing-hero relative flex min-h-[100svh] items-center overflow-x-clip pb-10 pt-20 sm:pb-16 sm:pt-28 lg:pb-20"
    >
      <div className="pointer-events-none absolute inset-0 -z-[5]" aria-hidden="true">
        <LoopConstellation className="h-full w-full opacity-60" />
      </div>
      <div className="marketing-hero-inner relative z-10 mx-auto flex max-w-[80rem] flex-col items-center px-4 text-center sm:px-8">
        <GlowingBadge pulse className="hero-eyebrow px-3 py-1.5 text-xs tracking-[0.12em] sm:text-[0.71rem]">
          {homeContent.hero.eyebrow}
        </GlowingBadge>
        <h1 className="mt-5 text-[clamp(2.5rem,1.6rem+5.2vw,7rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-foreground sm:mt-7">
          <span className="block animate-hero-line-in" style={{ animationDelay: "0ms" }}>
            One workspace
          </span>
          <span className="block animate-hero-line-in" style={{ animationDelay: "90ms" }}>
            for every{" "}
            <span className="hero-word-gradient">moving part.</span>
          </span>
        </h1>
        <p className="marketing-hero-body mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:mt-7 sm:text-xl sm:leading-9">
          {homeContent.hero.body}
        </p>
        <div className="marketing-hero-ctas mt-7 flex w-full flex-col justify-center gap-3 sm:mt-9 sm:w-auto sm:flex-row sm:items-center">
          <MagneticButton href={homeContent.hero.primaryCta.href} className="w-full text-base sm:w-auto">
            {homeContent.hero.primaryCta.label} <ArrowRight className="ml-2 inline h-4 w-4" aria-hidden="true" />
          </MagneticButton>
          <SmoothAnchor
            href={homeContent.hero.secondaryCta.href}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--stroke-hairline)] bg-[var(--surface-glass)] px-5 text-sm font-semibold text-foreground transition duration-200 ease-rive-out hover:-translate-y-0.5 hover:border-primary/25 hover:bg-foreground/[0.07] sm:w-auto"
          >
            {homeContent.hero.secondaryCta.label} <ArrowDown className="ml-2 h-4 w-4" aria-hidden="true" />
          </SmoothAnchor>
        </div>
        <div className="marketing-hero-rail mt-10 w-full sm:mt-16">
          <HeroPipeline />
        </div>
      </div>
    </section>
  );
}
