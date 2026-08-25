"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

/**
 * One-time staggered-reveal driver for marketing panels. The server render and
 * no-JS browsers keep everything visible ("static"); once the element can be
 * observed, content hides ("ready") and reveals when scrolled into view
 * ("visible"). Reduced motion never leaves the static phase.
 */
export function useRevealPhase<T extends HTMLElement>(): { ref: RefObject<T | null>; hidden: boolean } {
  const reduceMotion = useMarketingReducedMotion();
  const ref = useRef<T>(null);
  const [phase, setPhase] = useState<"static" | "ready" | "visible">("static");

  useEffect(() => {
    const root = ref.current;
    if (!root || reduceMotion || !("IntersectionObserver" in window)) return;
    setPhase((current) => (current === "static" ? "ready" : current));
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setPhase("visible");
      observer.disconnect();
    }, { rootMargin: "0px 0px -12%", threshold: 0.25 });
    observer.observe(root);
    return () => observer.disconnect();
  }, [reduceMotion]);

  return { ref, hidden: phase === "ready" };
}
