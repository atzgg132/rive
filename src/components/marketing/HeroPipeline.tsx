"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CircleDollarSign,
  FileSignature,
  Globe2,
  Users,
} from "lucide-react";
import { homeContent } from "@/content/marketing/home";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

const stages = homeContent.hero.stages;

const STAGE_ICONS = {
  client: Users,
  work: BriefcaseBusiness,
  agreement: FileSignature,
  invoice: CircleDollarSign,
  proof: Globe2,
} as const satisfies Record<(typeof stages)[number]["id"], LucideIcon>;

const STAGE_ADVANCE_MS = 2500;

export function HeroPipeline() {
  const reducedMotion = useMarketingReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const active = stages[activeIndex];
  const targetIndex = (activeIndex + 1) % stages.length;
  const wrapping = targetIndex === 0;

  useEffect(() => {
    if (reducedMotion || !autoAdvance) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % stages.length);
    }, STAGE_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [reducedMotion, autoAdvance]);

  const selectStage = (index: number) => {
    setAutoAdvance(false);
    setActiveIndex(index);
  };

  return (
    <div data-testid="hero-pipeline" className="relative mx-auto w-full max-w-5xl min-w-0 overflow-x-hidden px-1 animate-hero-preview-in sm:px-2">
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[10%] right-[10%] top-3 h-px bg-gradient-to-r from-blue-400/50 via-cyan-300/35 to-emerald-300/30 sm:top-4 [container-type:inline-size]"
        >
          {!reducedMotion && autoAdvance ? (
            <div
              aria-hidden
              className="absolute top-0 h-full w-10"
              style={{
                marginLeft: "-1.25rem",
                background:
                  "linear-gradient(90deg, transparent, rgb(125 211 252 / 0.9), transparent)",
                filter: "drop-shadow(0 0 3px rgb(125 211 252 / 0.5))",
                opacity: wrapping ? 0 : 1,
                transform: `translateX(${targetIndex * 25}cqi)`,
                transition: wrapping
                  ? "none"
                  : `transform ${STAGE_ADVANCE_MS}ms cubic-bezier(0.77, 0, 0.175, 1), opacity 300ms ease-out`,
              }}
            />
          ) : null}
        </div>

        <div className="relative grid grid-cols-5 gap-0.5 sm:gap-2">
          {stages.map((stage, index) => {
            const Icon = STAGE_ICONS[stage.id];
            const selected = index === activeIndex;
            return (
              <button
                key={stage.id}
                type="button"
                data-testid={`hero-stage-${stage.id}`}
                aria-pressed={selected}
                onClick={() => selectStage(index)}
                className="marketing-focus group relative flex min-h-11 min-w-0 flex-col items-center gap-1.5 rounded-xl px-0.5 py-1 text-center transition duration-300 ease-rive-out"
              >
                <span
                  className={`relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-lg ring-1 transition duration-300 ease-rive-out sm:h-8 sm:w-8 ${
                    selected
                      ? "bg-primary/20 text-primary ring-primary/40 shadow-[0_0_18px_rgba(59,130,246,0.25)]"
                      : "bg-[var(--surface-raised)] text-muted-foreground ring-[var(--stroke-hairline)] group-hover:text-primary"
                  }`}
                >
                  <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 w-full">
                  <span
                    className={`block truncate font-mono text-[0.56rem] font-bold uppercase tracking-[0.1em] sm:tracking-[0.16em] ${
                      selected ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {stage.label}
                  </span>
                  <span
                    className={`mt-0.5 hidden truncate text-[0.78rem] font-bold tracking-[-0.01em] sm:block ${
                      selected ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {stage.short}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div key={active.id} className="mt-3 text-center motion-safe:animate-hero-detail-in sm:mt-4">
        <p className="mx-auto max-w-2xl text-balance text-[0.78rem] font-semibold leading-5 text-muted-foreground sm:text-[0.8rem] sm:leading-6">
          {active.detail}
        </p>
        <p className="mt-1.5 flex items-center justify-center gap-1.5 font-mono text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-primary">
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
          {active.carries}
        </p>
      </div>
    </div>
  );
}
