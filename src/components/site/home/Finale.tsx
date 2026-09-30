"use client";

import { useRef } from "react";
import { finale } from "@/content/site/home";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import { ASSURANCE, StartFree } from "@/components/site/StartFree";
import RiveLogo from "@/components/RiveLogo";
import styles from "./Finale.module.css";

export function Finale() {
  const ref = useRef<HTMLElement>(null);

  useSiteMotion(ref, ({ gsap, SplitText }, c, scope) => {
    const title = scope.querySelector<HTMLElement>("[data-finale-title]");
    const cta = gsap.utils.toArray<HTMLElement>("[data-finale-cta] > *", scope);
    const logo = scope.querySelector<HTMLElement>("[data-finale-logo]");
    const stage = scope.querySelector<HTMLElement>("[data-finale-stage]");
    const glow = scope.querySelector<HTMLElement>("[data-finale-glow]");
    const svg = logo?.querySelector("svg");
    const glyphs = svg ? Array.from(svg.querySelectorAll<SVGPathElement>("g > path")) : [];
    const dot = svg ? svg.querySelector<SVGPathElement>(":scope > path") : null;
    if (!title || !logo || !stage) return;

    if (c.reduce) {
      gsap.fromTo([title, ...cta, logo], { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.06, immediateRender: true, clearProps: "opacity", scrollTrigger: { trigger: scope, start: "top 60%", once: true } });
      return;
    }

    const split = SplitText.create(title, { type: "lines", mask: "lines", linesClass: "s-line" });
    const settle = c.mobile ? "108%" : "124%";
    const enter = gsap.timeline({ scrollTrigger: { trigger: title, start: "top 82%", once: true } });
    enter.from(split.lines, { yPercent: 110, fontStretch: settle, duration: 1.4, stagger: 0.12, ease: "power4.out", immediateRender: true }, 0);
    enter.from(cta, { y: 22, opacity: 0, duration: 0.9, stagger: 0.1, immediateRender: true }, 0.6);

    /* The wordmark assembles as it rises into view, scrubbed. */
    const build = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: stage, start: "top 95%", end: "bottom 96%", scrub: 1, invalidateOnRefresh: true },
    });
    build.fromTo(logo, { y: c.mobile ? 60 : 140, scale: 0.9, transformOrigin: "0% 100%" }, { y: 0, scale: 1, duration: 1 }, 0);
    if (glyphs.length) {
      const drop = c.mobile ? 160 : 260;
      gsap.set(glyphs, { opacity: 0, y: drop });
      build.fromTo(glyphs, { opacity: 0, y: drop }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.12, ease: "power3.out", immediateRender: true }, 0);
    }
    if (dot) {
      const rest = Number(gsap.getProperty(dot, "y"));
      build.fromTo(dot, { opacity: 0, y: rest - 520 }, { opacity: 1, y: rest, duration: 0.5, ease: "bounce.out", immediateRender: true }, 0.55);
    }
    build.to({}, { duration: 0.25 });
    if (glow) {
      gsap.fromTo(glow, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, ease: "none", scrollTrigger: { trigger: stage, start: "top 100%", end: "bottom 80%", scrub: 1 } });
    }

    return () => split.revert();
  });

  return (
    <section ref={ref} id="finale" data-finale data-theme="ink" className={styles.section} aria-labelledby="finale-title">
      <div className={styles.glow} data-finale-glow aria-hidden="true" />
      <div className={`s-container ${styles.inner}`}>
        <h2 id="finale-title" className={styles.title} data-finale-title>
          {finale.title} <span className={styles.after}>{finale.titleAfter}</span>
        </h2>
        <div className={styles.cta} data-finale-cta>
          <StartFree placement="finale" size="lg" />
          <p className="s-assurance">{ASSURANCE}</p>
        </div>
        <div className={styles.logoWrap} data-finale-stage aria-hidden="true">
          <div className={styles.logo} data-finale-logo>
            <RiveLogo color="#f1eee6" accentColor="#7aa3ff" height={300} />
            <span className={styles.anchor} data-thread-anchor="finale" />
          </div>
        </div>
      </div>
    </section>
  );
}
