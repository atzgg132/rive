"use client";

import { useEffect } from "react";

/** Same-page links get a staged scroll: a short counter-move upward — the
 * wind-up — a beat of hold, then the eased travel down to the target.
 * Interruptible by wheel, touch, or keys; disabled under reduced motion. */

const LIFT_PX = 34;
const WINDUP_MS = 300;
const HOLD_MS = 120;

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);

export function SmoothAnchors() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const stop = () => cancelAnimationFrame(raf);

    /* Capture phase: next/link preventDefaults during its own handling, so a
       bubble listener would never see the click. Intercepting in capture both
       suppresses Next's instant hash jump and hands the scroll to us. */
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href^='#']");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.classList.contains("inst-skip-link")) return;
      const id = anchor.getAttribute("href")?.slice(1);
      if (!id) return;
      const target = document.getElementById(decodeURIComponent(id));
      if (!target) return;

      event.preventDefault();
      stop();

      const startY = window.scrollY;
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const endY = Math.max(0, target.getBoundingClientRect().top + startY - margin);
      const liftY = Math.max(0, startY - LIFT_PX);
      const travelMs = Math.min(1500, 650 + Math.abs(endY - liftY) * 0.3);
      const total = WINDUP_MS + HOLD_MS + travelMs;
      const t0 = performance.now();

      const tick = (now: number) => {
        const elapsed = now - t0;
        if (elapsed < WINDUP_MS) {
          window.scrollTo(0, startY + (liftY - startY) * easeOutQuart(elapsed / WINDUP_MS));
        } else if (elapsed < WINDUP_MS + HOLD_MS) {
          window.scrollTo(0, liftY);
        } else if (elapsed < total) {
          const t = (elapsed - WINDUP_MS - HOLD_MS) / travelMs;
          window.scrollTo(0, liftY + (endY - liftY) * easeInOutQuart(t));
        } else {
          window.scrollTo(0, endY);
          history.pushState(null, "", `#${id}`);
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    document.addEventListener("click", onClick, true);
    // Mirrors the auth forms' data-hydrated: tells tests the listener is armed.
    document.documentElement.dataset.smoothAnchors = "ready";
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    return () => {
      document.removeEventListener("click", onClick, true);
      delete document.documentElement.dataset.smoothAnchors;
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
      stop();
    };
  }, []);

  return null;
}
