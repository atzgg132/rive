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
    return { gsap, ScrollTrigger: st.ScrollTrigger, Flip: flip.Flip, SplitText: split.SplitText };
  });
  kitPromise.catch(() => document.documentElement.classList.remove("site-motion"));
  return kitPromise;
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
