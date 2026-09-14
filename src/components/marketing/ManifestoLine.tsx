"use client";

import { useEffect, useRef } from "react";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

/** The manifesto line — paper-colored text prints over a ghosted base as
 * the band crosses the viewport, driven by a --manifesto-fill percentage.
 * Reduced motion renders the filled layer flat. */
export function ManifestoLine({ text }: { text: string }) {
  const lineRef = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useMarketingReducedMotion();

  useEffect(() => {
    const line = lineRef.current;
    if (!line || reducedMotion) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = line.getBoundingClientRect();
      const viewport = window.innerHeight;
      // Fill begins when the line enters the lower viewport and completes
      // by the time it reaches the optical middle.
      const start = viewport * 0.9;
      const end = viewport * 0.38;
      const progress = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
      line.style.setProperty("--manifesto-fill", `${Math.round(progress * 100)}%`);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reducedMotion]);

  return (
    <h2 ref={lineRef} className="inst-manifesto__line" aria-label={text}>
      <span className="inst-manifesto__base" aria-hidden="true">{text}</span>
      <span className="inst-manifesto__fill" aria-hidden="true">{text}</span>
    </h2>
  );
}
