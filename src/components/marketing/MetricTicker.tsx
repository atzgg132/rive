"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

export function MetricTicker({ value, prefix = "", suffix = "", decimals = 0, duration = 900, className }: { value: number; prefix?: string; suffix?: string; decimals?: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useMarketingReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduceMotion) {
      const timeout = window.setTimeout(() => setShown(value), 0);
      return () => window.clearTimeout(timeout);
    }
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        setShown(value * (1 - Math.pow(1 - progress, 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      observer.disconnect();
    }, { threshold: 0.4 });
    observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [duration, reduceMotion, value]);

  return <span ref={ref} className={cn("tabular-nums", className)}>{prefix}{shown.toFixed(decimals)}{suffix}</span>;
}
