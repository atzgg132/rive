"use client";

import type { PointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SpotlightCursor({ children, className }: { children: ReactNode; className?: string }) {
  function move(event: PointerEvent<HTMLDivElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--cursor-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--cursor-y", `${event.clientY - rect.top}px`);
  }
  return (
    <div onPointerMove={move} className={cn("relative", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_var(--cursor-x,50%)_var(--cursor-y,30%),rgba(59,130,246,.08),transparent_72%)]" aria-hidden="true" />
      <div className="relative">{children}</div>
    </div>
  );
}
