"use client";

import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

function hashId(href: string) {
  if (href.startsWith("/#")) return href.slice(2);
  if (href.startsWith("#")) return href.slice(1);
  return null;
}

function headerOffsetPx() {
  const header = document.querySelector<HTMLElement>('[data-testid="site-header"]');
  const bar = header?.firstElementChild;
  const height = bar instanceof HTMLElement
    ? bar.getBoundingClientRect().height
    : header?.getBoundingClientRect().height;
  return Math.ceil(height ?? 88);
}

export function SmoothAnchor({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const id = hashId(href);
    const target = id ? document.getElementById(id) : null;
    if (!id || !target) {
      onClick?.(event);
      return;
    }
    event.preventDefault();
    onClick?.(event);
    history.pushState(null, "", `#${id}`);

    const offsetY = headerOffsetPx();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const top = target.getBoundingClientRect().top + window.scrollY - offsetY;
      window.scrollTo({ top, behavior: "auto" });
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
      scrollTo: { y: target, offsetY, autoKill: true },
    });
  }

  return (
    <a href={href} onClick={handleClick} className={cn("marketing-focus", className)}>
      {children}
    </a>
  );
}
