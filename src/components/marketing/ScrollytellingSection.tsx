"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { MarketingChapter } from "@/content/marketing/home";
import { homeContent } from "@/content/marketing/home";
import { DeferredProductScene } from "@/components/marketing/product/DeferredProductScene";
import { MarketingProductScene } from "@/components/marketing/product/SceneRegistry";
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
  const rootRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);
  const activeRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useMarketingReducedMotion();

  useLayoutEffect(() => {
    const root = rootRef.current;
    const blocks = chapterRefs.current.filter((node): node is HTMLElement => Boolean(node));
    if (!root || blocks.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (reduced || !isDesktop) {
      blocks.forEach((block) => { block.style.opacity = "1"; });
      const observer = new IntersectionObserver((entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const next = Number((visible.target as HTMLElement).dataset.chapterIndex || 0);
        if (next !== activeRef.current) {
          activeRef.current = next;
          setActiveIndex(next);
        }
      }, { rootMargin: "-28% 0px -38%", threshold: [0.2, 0.45, 0.7] });
      blocks.forEach((block) => observer.observe(block));
      return () => observer.disconnect();
    }

    let cancelled = false;
    let context: { revert: () => void } | undefined;
    let resizeTimer = 0;
    let removeResize: () => void = () => undefined;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([gsapModule, scrollModule]) => {
      if (cancelled) return;
      const gsap = gsapModule.gsap;
      const ScrollTrigger = scrollModule.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });
      context = gsap.context(() => {
        gsap.set(blocks, { opacity: 0.3 });
        gsap.set(blocks[0], { opacity: 1 });

        const applyActive = (next: number) => {
          if (next === activeRef.current) return;
          activeRef.current = next;
          setActiveIndex(next);
          gsap.to(blocks, {
            opacity: (index: number) => (index === next ? 1 : 0.3),
            duration: 0.18,
            overwrite: true,
            ease: "power2.out",
          });
        };

        ScrollTrigger.create({
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          onUpdate: () => applyActive(activeFromScroll(blocks)),
          onRefresh: () => applyActive(activeFromScroll(blocks)),
        });
        applyActive(activeFromScroll(blocks));
      }, root);

      const onResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => ScrollTrigger.refresh(), 160);
      };
      window.addEventListener("resize", onResize, { passive: true });
      removeResize = () => window.removeEventListener("resize", onResize);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(resizeTimer);
      removeResize();
      context?.revert();
    };
  }, [chapters.length]);

  const railChapter = activeIndex <= 0 ? null : chapters[activeIndex - 1];
  const railVisual = railChapter ? railChapter.visual : problem.visual as MarketingChapter["visual"];
  const railKey = railChapter ? railChapter.id : "problem";

  return (
    <div ref={rootRef} data-testid="scrollytelling-section" className="scrollytelling-section grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 xl:gap-20">
      <div>
        <article
          id="problem"
          ref={(node) => { chapterRefs.current[0] = node; }}
          data-chapter-index="0"
          data-active={activeIndex === 0 ? "true" : "false"}
          className={cn(
            "relative scroll-mt-0",
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
            className={cn("flex min-h-[70vh] scroll-mt-0 flex-col justify-center py-14 transition-opacity duration-200", reduceMotion || activeIndex === index + 1 ? "opacity-100" : "lg:opacity-30")}
          >
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-primary">{index === 0 ? homeContent.scrolly.eyebrow : chapter.eyebrow}</p>
            <h3 className="mt-5 max-w-xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-foreground sm:text-5xl">{index === 0 ? homeContent.scrolly.title : chapter.title}</h3>
            <p className="mt-6 max-w-lg text-base leading-8 text-muted-foreground">{chapter.body}</p>
            <DeferredProductScene className="scrollytelling-inline-visual mt-9" sceneKey={chapter.id} visual={chapter.visual} />
          </article>
        ))}
        {/* Sticky rail unsticks when this column's bottom hits the fold.
            Chapters are 70vh, not 100vh (no shutter). Without a tail the last
            beat never crosses the 18% activation line, so 06 / PROOF copy
            shows while the rail stays on 05 / MOMENTUM. */}
        <div
          aria-hidden="true"
          data-testid="scrollytelling-tail"
          className="pointer-events-none hidden h-[60vh] lg:block motion-reduce:hidden"
        />
      </div>

      <div data-testid="scrollytelling-rail" className="scrollytelling-rail sticky top-0 h-screen min-w-0 place-items-center">
        <div className="w-full" key={railKey}>
          <MarketingProductScene visual={railVisual} />
        </div>
      </div>
    </div>
  );
}
