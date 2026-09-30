"use client";

import { useRef, type ReactNode } from "react";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import type { GsapKit, MotionConditions } from "@/components/site/motion/gsap";
import { bleedIn, revealText } from "@/components/site/home/chapters/chapterMotion";
import css from "@/components/site/home/chapters/Chapter.module.css";

export type ChapterMotion = (kit: GsapKit, c: MotionConditions, scope: HTMLElement) => void | (() => void);

/** The frame every chapter shares: theme, the ink-bleed hem, the text reveal,
 * and a hook for the chapter's own signature scroll moment. `from` is the
 * theme of the section above, which the incoming colour bleeds over. */
export function ChapterSection({
  chapter,
  theme,
  from,
  labelledBy,
  onMotion,
  children,
}: {
  chapter: string;
  theme: "paper" | "ink";
  from: "paper" | "ink";
  labelledBy: string;
  onMotion?: ChapterMotion;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useSiteMotion(ref, (kit, c, scope) => {
    const cleanups: (void | (() => void))[] = [];
    cleanups.push(bleedIn(kit, scope, c));
    cleanups.push(revealText(kit, scope, c));
    if (onMotion) cleanups.push(onMotion(kit, c, scope));

    /* Product plates, specimens and fonts settle after the triggers above are
       measured, so re-measure whenever this chapter's height changes. */
    let last = scope.offsetHeight;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const next = scope.offsetHeight;
        if (Math.abs(next - last) > 2) {
          last = next;
          kit.ScrollTrigger.refresh();
        }
      }, 120);
    });
    observer.observe(scope);
    document.fonts?.ready.then(() => kit.ScrollTrigger.refresh());
    cleanups.push(() => {
      window.clearTimeout(timer);
      observer.disconnect();
    });
    return () => cleanups.forEach((fn) => fn?.());
  }, []);

  return (
    <section
      ref={ref}
      className={css.section}
      data-chapter={chapter}
      data-theme={theme === "ink" ? "ink" : undefined}
      data-bleed-from={from}
      aria-labelledby={labelledBy}
    >
      <div className={css.bg} data-bleed aria-hidden="true" />
      {children}
    </section>
  );
}
