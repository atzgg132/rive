"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function AuroraGlow({ className, strength = 0.06 }: { className?: string; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let settleTimer = 0;
    const update = () => {
      frame = 0;
      node.style.willChange = "transform";
      node.style.transform = `translate3d(0, ${window.scrollY * strength}px, 0)`;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => { node.style.willChange = "auto"; }, 180);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); window.clearTimeout(settleTimer); node.style.willChange = "auto"; };
  }, [strength]);
  return <div ref={ref} className={cn("pointer-events-none absolute rounded-full bg-glow-radial blur-2xl", className)} aria-hidden="true" />;
}
