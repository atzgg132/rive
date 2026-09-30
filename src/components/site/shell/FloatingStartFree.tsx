"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { StartFree } from "@/components/site/StartFree";
import { loadGsap } from "@/components/site/motion/gsap";
import styles from "./FloatingStartFree.module.css";

const SUPPRESS_SELECTOR = '[data-cta-placement="finale"], [data-cta-placement="pricing"], [data-site-footer]';

function inView(el: Element) {
  const rect = el.getBoundingClientRect();
  return rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
}

/** A compact pill that offers the one call to action once the hero is behind
 * you — and steps aside wherever a bigger CTA is on screen. */
export function FloatingStartFree() {
  const pathname = usePathname();
  const pillRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    let frame = 0;
    const compute = () => {
      frame = 0;
      const hero = document.querySelector("[data-hero]");
      const pastHero = hero ? hero.getBoundingClientRect().bottom < 0 : window.scrollY > window.innerHeight * 0.8;
      const crowded = Array.from(document.querySelectorAll(SUPPRESS_SELECTOR)).some(inView);
      const menuOpen = document.documentElement.hasAttribute("data-site-menu");
      setVisible(pastHero && !crowded && !menuOpen);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(compute);
    };

    schedule();
    const settle = [150, 800].map((ms) => window.setTimeout(schedule, ms));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const attrs = new MutationObserver(schedule);
    attrs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-site-menu"] });
    const main = document.getElementById("main-content");
    const content = new MutationObserver(schedule);
    if (main) content.observe(main, { childList: true, subtree: true });
    return () => {
      window.cancelAnimationFrame(frame);
      settle.forEach(window.clearTimeout);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      attrs.disconnect();
      content.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    if (visible === shown.current) return;
    shown.current = visible;
    let cancelled = false;
    loadGsap()
      .then(({ gsap }) => {
        if (cancelled) return;
        gsap.killTweensOf(pill);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
          gsap.to(pill, { autoAlpha: visible ? 1 : 0, y: 0, scale: 1, duration: 0.25 });
        } else if (visible) {
          gsap.fromTo(
            pill,
            { autoAlpha: 0, y: 28, scale: 0.9 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.9, ease: "back.out(1.7)", force3D: true },
          );
        } else {
          gsap.to(pill, { autoAlpha: 0, y: 18, scale: 0.94, duration: 0.3, ease: "power2.in", force3D: true });
        }
      })
      .catch(() => {
        pill.style.visibility = visible ? "visible" : "hidden";
        pill.style.opacity = visible ? "1" : "0";
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <div className={styles.dock}>
      <div ref={pillRef} className={styles.pill} role="region" aria-label="Start free" inert={!visible}>
        <p className={styles.note}>Free during beta</p>
        <StartFree placement="pill" className={styles.cta} />
      </div>
    </div>
  );
}
