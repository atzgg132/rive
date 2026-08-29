"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { MarketingChapter } from "@/content/marketing/home";
import { homeContent } from "@/content/marketing/home";
import { DeferredProductScene } from "@/components/marketing/product/DeferredProductScene";
import { MotionProductScene } from "@/components/marketing/product/MotionProductScene";
import { ProblemDisconnection, type ProblemDisconnectionProps } from "@/components/marketing/product/ProblemDisconnection";
import { cn } from "@/lib/utils";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

type ProblemBeat = typeof homeContent.tax;

function activeFromScroll(blocks: HTMLElement[]) {
  const line = window.innerHeight * 0.18;
  let next = 0;
  blocks.forEach((block, index) => {
    if (block.getBoundingClientRect().top <= line) next = index;
  });
  return next;
}

export function ScrollytellingSection({
  problem,
  chapters,
}: {
  problem: ProblemBeat;
  chapters: readonly MarketingChapter[];
}) {
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);
  const activeRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useMarketingReducedMotion();

  /* A scroll listener, not ScrollTrigger, and one rule at every width. The
     active chapter decides what the rail renders, so it must not wait on a
     dynamic gsap import. A chunk that never arrived froze the rail on the first
     mock for a whole page. The old desktop and mobile split read matchMedia
     once at mount, so a window grown past 1024px kept the mobile observer.
     Dimming is Tailwind's `lg:opacity-30`, which follows the live media query
     instead of an inline style written at mount. */
  useLayoutEffect(() => {
    const blocks = chapterRefs.current.filter((node): node is HTMLElement => Boolean(node));
    if (blocks.length === 0) return;

    let frame = 0;
    const sync = () => {
      frame = 0;
      const next = activeFromScroll(blocks);
      if (next === activeRef.current) return;
      activeRef.current = next;
      setActiveIndex(next);
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(sync);
    };

    sync();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [chapters.length]);

  const railChapter = activeIndex <= 0 ? null : chapters[activeIndex - 1];
  const railVisual = railChapter ? railChapter.visual : problem.visual as MarketingChapter["visual"];
  const railKey = railChapter ? railChapter.id : "problem";

  return (
    <div data-testid="scrollytelling-section" className="scrollytelling-section grid gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-12 xl:gap-20">
      <div>
        <article
          id="problem"
          ref={(node) => { chapterRefs.current[0] = node; }}
          data-chapter-index="0"
          data-active={activeIndex === 0 ? "true" : "false"}
          className={cn(
            "relative scroll-mt-[5.5rem] transition-opacity duration-200",
            reduceMotion || activeIndex === 0 ? "opacity-100" : "lg:opacity-30",
          )}
        >
          <span id="features" className="absolute top-0" aria-hidden="true" />
          <div
            data-testid="marketing-problem"
            className="py-16 sm:py-20"
          >
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-warning">{problem.eyebrow}</p>
            <h2 className="mt-4 max-w-xl text-[1.85rem] font-black leading-[1.08] tracking-[-0.045em] text-foreground sm:text-4xl">{problem.title}</h2>
            <p className="mt-4 max-w-lg text-[0.95rem] leading-7 text-muted-foreground">{problem.body}</p>
            <ol className="mt-6 max-w-lg divide-y divide-[color:var(--stroke-hairline)] border-y border-[var(--stroke-hairline)]">
              {problem.duties.map((duty) => (
                <li key={duty.label} className="grid grid-cols-[2rem_1fr] gap-3 py-2.5">
                  <span className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{duty.label}</span>
                  <span>
                    <span className="block text-sm font-bold tracking-[-0.02em] text-foreground">{duty.job}</span>
                    <span className="mt-0.5 block text-[0.78rem] leading-5 text-muted-foreground">{duty.gap}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 max-w-lg text-lg font-black tracking-[-0.035em] text-foreground sm:text-xl">{problem.close}</p>
            <div className="scrollytelling-inline-visual mt-9">
              <ProblemDisconnection {...(problem.visual.props as unknown as ProblemDisconnectionProps)} />
            </div>
          </div>
        </article>

        {chapters.map((chapter, index) => (
          <article
            key={chapter.id}
            id={chapter.id}
            ref={(node) => { chapterRefs.current[index + 1] = node; }}
            data-chapter-index={index + 1}
            data-active={activeIndex === index + 1 ? "true" : "false"}
            className={cn("flex min-h-[70vh] scroll-mt-[5.5rem] flex-col justify-center py-14 transition-opacity duration-200", reduceMotion || activeIndex === index + 1 ? "opacity-100" : "lg:opacity-30")}
          >
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">{index === 0 ? homeContent.scrolly.eyebrow : chapter.eyebrow}</p>
            <h3 className="mt-5 max-w-xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl">{index === 0 ? homeContent.scrolly.title : chapter.title}</h3>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">{chapter.body}</p>
            <DeferredProductScene className="scrollytelling-inline-visual mt-9" sceneKey={chapter.id} visual={chapter.visual} />
          </article>
        ))}
        {/* Sticky scene unsticks when this column's bottom hits the fold.
            Chapters are 70vh, not 100vh (no shutter). Without a tail the last
            beat never crosses the 18% activation line, so 06 / PROOF copy
            shows while the scene stays on 05 / MOMENTUM. */}
        <div
          aria-hidden="true"
          data-testid="scrollytelling-tail"
          className="pointer-events-none hidden h-[60vh] lg:block motion-reduce:hidden"
        />
      </div>

      <aside
        data-testid="scrollytelling-scene"
        className="scrollytelling-scene sticky top-[5.5rem] z-0 min-w-0 self-start"
      >
        <div className="w-full">
          <MotionProductScene key={railKey} sceneKey={railKey} visual={railVisual} />
        </div>
      </aside>
    </div>
  );
}
