"use client";

import Link from "next/link";
import type { PointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MagneticButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  function move(event: PointerEvent<HTMLAnchorElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) * 0.13;
    const y = (event.clientY - rect.top - rect.height / 2) * 0.18;
    event.currentTarget.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    event.currentTarget.style.setProperty("--trail-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--trail-y", `${event.clientY - rect.top}px`);
  }

  function reset(event: PointerEvent<HTMLAnchorElement>) {
    event.currentTarget.style.transform = "translate3d(0,0,0)";
  }

  return (
    <Link href={href} prefetch={false} onPointerMove={move} onPointerLeave={reset} className={cn("marketing-focus relative inline-flex min-h-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 text-sm font-bold text-white shadow-[0_16px_40px_rgba(37,99,235,0.26)] transition-transform duration-300 ease-rive-out", className)}>
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120px_circle_at_var(--trail-x,50%)_var(--trail-y,50%),rgba(255,255,255,.22),transparent_70%)]" />
      <span className="relative">{children}</span>
    </Link>
  );
}
