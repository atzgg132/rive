"use client";

import type { gsap as GsapType } from "gsap";

export type Gsap = typeof GsapType;
export type ScrollTriggerStatic = typeof import("gsap/ScrollTrigger").ScrollTrigger;
export type FlipStatic = typeof import("gsap/Flip").Flip;
export type SplitTextStatic = typeof import("gsap/SplitText").SplitText;

export type GsapKit = {
  gsap: Gsap;
  ScrollTrigger: ScrollTriggerStatic;
  Flip: FlipStatic;
  SplitText: SplitTextStatic;
};

let kitPromise: Promise<GsapKit> | null = null;

/** GSAP and every plugin the site uses, loaded once and registered once.
 * Callers await this after hydration, so no animation code is on the
 * critical path to first paint. */
export function loadGsap(): Promise<GsapKit> {
  if (kitPromise) return kitPromise;
  kitPromise = Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
    import("gsap/Flip"),
    import("gsap/SplitText"),
    import("gsap/DrawSVGPlugin"),
  ]).then(([core, st, flip, split, draw]) => {
    const gsap = core.gsap;
    gsap.registerPlugin(st.ScrollTrigger, flip.Flip, split.SplitText, draw.DrawSVGPlugin);
    gsap.defaults({ ease: "power3.out", duration: 0.9 });
    st.ScrollTrigger.config({ ignoreMobileResize: true });
    document.documentElement.classList.add("site-motion-ready");
    watchLayout(st.ScrollTrigger);
    return { gsap, ScrollTrigger: st.ScrollTrigger, Flip: flip.Flip, SplitText: split.SplitText };
  });
  kitPromise.catch(() => document.documentElement.classList.remove("site-motion"));
  return kitPromise;
}

/** Product plates, specimens and web fonts settle after triggers are first
 * measured, which leaves start/end positions stale. Re-measure once fonts
 * are ready and whenever the page height really changes (debounced; a
 * refresh that lands on the same height does not trigger another). */
function watchLayout(ScrollTrigger: ScrollTriggerStatic) {
  let measured = document.documentElement.scrollHeight;
  let timer = 0;
  const refresh = () => {
    ScrollTrigger.refresh();
    measured = document.documentElement.scrollHeight;
  };
  document.fonts?.ready.then(refresh).catch(() => undefined);
  const observer = new ResizeObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (Math.abs(document.documentElement.scrollHeight - measured) > 4) refresh();
    }, 250);
  });
  observer.observe(document.body);
}

/** The one set of media conditions every section animates against. */
export const MOTION_QUERIES = {
  motion: "(prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
  desktop: "(min-width: 1024px)",
  tablet: "(min-width: 640px) and (max-width: 1023.98px)",
  mobile: "(max-width: 639.98px)",
} as const;

export type MotionConditions = Record<keyof typeof MOTION_QUERIES, boolean>;
