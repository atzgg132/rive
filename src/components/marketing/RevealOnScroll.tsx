"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function RevealOnScroll({ children, className, delay = 0, y = 22 }: { children: ReactNode; className?: string; delay?: number; y?: number }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      root.dataset.revealVisible = "true";
      return;
    }

    root.dataset.revealReady = "true";
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      root.dataset.revealVisible = "true";
      observer.disconnect();
    }, { rootMargin: "0px 0px -10%", threshold: 0.18 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn("marketing-reveal", className)}
      style={{
        "--marketing-reveal-delay": `${delay}s`,
        "--marketing-reveal-y": `${y}px`,
      } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function BentoGrid({ children, className }: { children: ReactNode[]; className?: string }) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {children.map((child, index) => <RevealOnScroll key={index} delay={Math.min(index * 0.06, 0.3)}>{child}</RevealOnScroll>)}
    </div>
  );
}
