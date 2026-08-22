"use client";

import type { PointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AnimatedBentoCard({ children, className, spotlightLabel = "Interactive spotlight" }: { children: ReactNode; className?: string; spotlightLabel?: string }) {
  function updateSpotlight(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
    event.currentTarget.style.setProperty("--spotlight-opacity", "1");
    event.currentTarget.style.willChange = "transform";
  }

  function clearSpotlight(event: PointerEvent<HTMLElement>) {
    event.currentTarget.style.setProperty("--spotlight-opacity", "0");
    event.currentTarget.style.willChange = "auto";
  }

  return (
    <article
      className={cn("marketing-bento group isolate min-h-64 overflow-hidden rounded-[1.75rem] p-6 transition duration-300 ease-rive-out hover:-translate-y-1 sm:p-7", className)}
      onPointerMove={updateSpotlight}
      onPointerLeave={clearSpotlight}
    >
      <span
        className="pointer-events-none absolute inset-0 -z-[1] opacity-[var(--spotlight-opacity,0)] transition-opacity duration-300"
        style={{ background: "radial-gradient(340px circle at var(--spotlight-x,50%) var(--spotlight-y,50%), rgba(96,165,250,.13), transparent 66%)" }}
        aria-label={spotlightLabel}
        aria-hidden="true"
      />
      {children}
    </article>
  );
}
