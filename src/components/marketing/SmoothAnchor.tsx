"use client";

import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SmoothAnchor({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  async function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!href.startsWith("#")) return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    event.preventDefault();
    history.pushState(null, "", href);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      target.scrollIntoView();
      return;
    }

    const [gsapModule, scrollModule] = await Promise.all([
      import("gsap"),
      import("gsap/ScrollToPlugin"),
    ]);
    const gsap = gsapModule.gsap;
    gsap.registerPlugin(scrollModule.ScrollToPlugin);
    gsap.to(window, {
      duration: 0.85,
      ease: "power3.out",
      overwrite: true,
      scrollTo: { y: target, autoKill: true },
    });
  }

  return (
    <a href={href} onClick={onClick} className={cn("marketing-focus", className)}>
      {children}
    </a>
  );
}
