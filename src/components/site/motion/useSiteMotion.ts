"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { loadGsap, MOTION_QUERIES, type GsapKit, type MotionConditions } from "@/components/site/motion/gsap";

type Setup = (kit: GsapKit, conditions: MotionConditions, scope: HTMLElement) => void | (() => void);

/** Runs a section's GSAP setup inside `gsap.matchMedia`, scoped to one
 * element. Everything created inside is reverted when the media conditions
 * change (resize across a breakpoint, reduced-motion toggled) and when the
 * component unmounts on a route change.
 *
 * Reduced motion: setups receive `conditions.reduce` and must show all
 * content with fades only — no pinning and no scroll-linked scrubbing. */
export function useSiteMotion(scopeRef: RefObject<HTMLElement | null>, setup: Setup, deps: unknown[] = []) {
  const setupRef = useRef(setup);
  useLayoutEffect(() => {
    setupRef.current = setup;
  });

  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    let cancelled = false;
    let revert: (() => void) | undefined;

    loadGsap().then((kit) => {
      if (cancelled) return;
      const mm = kit.gsap.matchMedia(scope);
      mm.add(MOTION_QUERIES, (context) => {
        const conditions = context.conditions as MotionConditions;
        return setupRef.current(kit, conditions, scope);
      });
      revert = () => mm.revert();
      scope.setAttribute("data-motion-ready", "");
    });

    return () => {
      cancelled = true;
      revert?.();
      scope.removeAttribute("data-motion-ready");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
