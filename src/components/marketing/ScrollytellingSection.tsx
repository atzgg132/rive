"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { MarketingChapter } from "@/content/marketing/home";
import { DeferredProductScene } from "@/components/marketing/product/DeferredProductScene";
import { cn } from "@/lib/utils";
import { useMarketingHydrated, useMarketingMediaQuery, useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

export function ScrollytellingSection({ chapters }: { chapters: readonly MarketingChapter[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Array<HTMLElement | null>>([]);
  const activeRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useMarketingReducedMotion();
  const hydrated = useMarketingHydrated();
  const desktop = useMarketingMediaQuery("(min-width: 1024px)");

  useLayoutEffect(() => {
    const root = rootRef.current;
    const blocks = chapterRefs.current.filter((node): node is HTMLElement => Boolean(node));
    if (!root || blocks.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (reduced || !desktop) {
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
        ScrollTrigger.create({
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          onUpdate: (self) => {
            const next = Math.min(chapters.length - 1, Math.floor(self.progress * chapters.length));
            if (next === activeRef.current) return;
            activeRef.current = next;
            setActiveIndex(next);
            gsap.to(blocks, {
              opacity: (index: number) => index === next ? 1 : 0.3,
              duration: 0.28,
              overwrite: true,
              ease: "power2.out",
            });
          },
        });
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

  const active = chapters[activeIndex] || chapters[0];

  return (
    <div ref={rootRef} data-testid="scrollytelling-section" className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 xl:gap-20">
      <div>
        {chapters.map((chapter, index) => (
          <article
            key={chapter.id}
            id={chapter.id}
            ref={(node) => { chapterRefs.current[index] = node; }}
            data-chapter-index={index}
            data-active={activeIndex === index ? "true" : "false"}
            className={cn("flex min-h-[70vh] scroll-mt-28 flex-col justify-center py-14 transition-opacity duration-200", reduceMotion || activeIndex === index ? "opacity-100" : "lg:opacity-30")}
          >
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">{chapter.eyebrow}</p>
            <h3 className="mt-5 max-w-xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl">{chapter.title}</h3>
            <p className="mt-6 max-w-lg text-base leading-8 text-slate-400">{chapter.body}</p>
            {chapter.metrics ? (
              <dl className="mt-8 grid max-w-md grid-cols-2 gap-3">
                {chapter.metrics.map((metric) => <div key={metric.label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><dd className="text-lg font-black text-white">{metric.value}</dd><dt className="mt-1 font-mono text-[0.58rem] uppercase tracking-[0.12em] text-slate-400">{metric.label}</dt></div>)}
              </dl>
            ) : null}
            {hydrated && (reduceMotion || !desktop) ? <DeferredProductScene className="mt-9" sceneKey={chapter.id} visual={chapter.visual} /> : null}
          </article>
        ))}
      </div>

      {hydrated && desktop && !reduceMotion ? (
        <div data-testid="scrollytelling-rail" className="sticky top-0 hidden h-screen min-w-0 place-items-center lg:grid">
          <div className="w-full">
            <DeferredProductScene sceneKey={active.id} visual={active.visual} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
