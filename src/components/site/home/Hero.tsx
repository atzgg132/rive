"use client";

import { Fragment, useRef, type CSSProperties } from "react";
import { ArrowDown, Pause, Play } from "lucide-react";
import { ResponsiveWorkspacePreview } from "@/components/marketing/ResponsiveWorkspacePreview";
import { ASSURANCE, StartFree } from "@/components/site/StartFree";
import { setMotionPaused, useMotionPaused } from "@/components/site/motion/pause";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import { InkField, type InkFieldHandle } from "@/components/site/webgl/InkField";
import { hero } from "@/content/site/home";
import styles from "@/components/site/home/Hero.module.css";

/* Distance the product takes to rise and flatten, as a share of the viewport
   height. The pin lasts exactly as long as the scrub. */
const SCRUB = { desktop: 0.9, tablet: 0.8, mobile: 0.6 } as const;
const NAV_CLEARANCE = { desktop: 84, tablet: 76, mobile: 68 } as const;

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const inkRef = useRef<InkFieldHandle>(null);
  const paused = useMotionPaused();

  useSiteMotion(heroRef, ({ gsap, ScrollTrigger }, c, scope) => {
    const ink = inkRef.current;
    const copy = scope.querySelector<HTMLElement>("[data-hero-copy]");
    const stage = scope.querySelector<HTMLElement>("[data-hero-stage]");
    const frame = scope.querySelector<HTMLElement>("[data-hero-frame]");
    if (!copy || !stage || !frame) return;

    if (c.reduce) {
      const settle = () => {
        const h = scope.offsetHeight || 1;
        const edge = 1 - (copy.offsetHeight + 14) / h - 0.03;
        ink?.setCalm(edge + 0.03);
        ink?.setHorizon(edge, edge);
      };
      ink?.setProgress(0.3);
      settle();
      const observer = new ResizeObserver(settle);
      observer.observe(scope);
      return () => observer.disconnect();
    }

    const tier = c.desktop ? "desktop" : c.tablet ? "tablet" : "mobile";
    const perspective = c.mobile ? 1000 : 1400;
    const tilt = c.mobile ? 20 : 24;
    const startScale = c.mobile ? 0.92 : 0.9;
    const proxy = { p: 0 };

    const restingTop = () => stage.offsetTop + frame.offsetTop;
    const flatTop = () => NAV_CLEARANCE[tier] + 12;

    const placeInk = () => {
      const h = scope.offsetHeight || 1;
      const clear = 1 - (copy.offsetHeight + 14) / h - 0.03;
      ink?.setCalm(1 - (copy.offsetHeight + 10) / h);
      ink?.setHorizon(Math.min(1 - restingTop() / h - 0.01, clear), 1 - flatTop() / h + 0.02);
    };
    placeInk();

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: scope,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * SCRUB[tier])}`,
        pin: true,
        anticipatePin: 1,
        scrub: 0.8,
        invalidateOnRefresh: true,
        onRefresh: placeInk,
      },
    });

    tl.fromTo(
      frame,
      { y: 0, rotationX: tilt, scale: startScale, transformPerspective: perspective },
      {
        y: () => flatTop() - restingTop(),
        rotationX: 0,
        scale: 1,
        transformPerspective: perspective,
        ease: "power1.inOut",
        force3D: true,
      },
      0,
    );
    tl.to(copy, { yPercent: -12, opacity: 0.35, force3D: true, ease: "power1.in" }, 0);
    tl.to(
      proxy,
      { p: 1, ease: "power1.inOut", onUpdate: () => ink?.setProgress(proxy.p) },
      0,
    );

    const st = tl.scrollTrigger;
    const onFocusIn = () => {
      if (st && st.progress > 0.02) window.scrollTo({ top: st.start, behavior: "instant" });
    };
    copy.addEventListener("focusin", onFocusIn);

    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });

    return () => {
      cancelled = true;
      copy.removeEventListener("focusin", onFocusIn);
      ink?.setProgress(0);
    };
  }, []);

  return (
    <section ref={heroRef} data-hero aria-labelledby="hero-title" className={styles.hero}>
      <InkField ref={inkRef} className={styles.ink} />

      <div className={styles.content} data-hero-copy>
        <div className={styles.inner}>
          <p className={`s-kicker ${styles.kicker}`}>{hero.eyebrow}</p>
          <div className={styles.grid}>
            <h1 id="hero-title" className={styles.title} aria-label={hero.title}>
              {hero.titleLines.map((line, index) => {
                const last = index === hero.titleLines.length - 1;
                const text = (
                  <span className={styles.line} aria-hidden="true" style={{ "--i": index } as CSSProperties}>
                    <span className={styles.lineInner}>{line}</span>
                  </span>
                );
                return (
                  <Fragment key={line}>
                    {last ? (
                      <span className={styles.lastLine}>
                        {text}
                        <svg
                          className={styles.underline}
                          viewBox="0 0 600 26"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path
                            d="M3 17 C 84 7, 168 23, 258 14 S 424 6, 520 15 S 580 13, 597 7"
                            pathLength={1}
                            fill="none"
                            stroke="var(--s-accent)"
                            strokeLinecap="round"
                            strokeWidth="1"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                        <span className={styles.threadEnd} data-thread-anchor="hero" aria-hidden="true" />
                      </span>
                    ) : (
                      text
                    )}{" "}
                  </Fragment>
                );
              })}
            </h1>

            <div className={styles.aside}>
              <p className={`s-lead ${styles.lead}`}>{hero.body}</p>
              <div className={styles.actions}>
                <StartFree placement="hero" size="lg" />
                <a href={hero.secondary.href} className="s-btn s-btn--ghost s-btn--lg">
                  <span>{hero.secondary.label}</span>
                  <ArrowDown aria-hidden="true" />
                </a>
              </div>
              <p className={`s-assurance ${styles.assurance}`}>{ASSURANCE}</p>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.stage} data-hero-stage>
        <div className={styles.frame} data-hero-frame>
          <p className={`s-sample-label ${styles.sample}`}>{hero.sampleLabel}</p>
          <div className={styles.surface}>
            <ResponsiveWorkspacePreview view="dashboard" />
          </div>
        </div>
      </div>

      <button
        type="button"
        className={styles.pause}
        aria-pressed={paused}
        aria-label="Pause motion"
        title={paused ? "Play motion" : "Pause motion"}
        onClick={() => setMotionPaused(!paused)}
      >
        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      </button>
    </section>
  );
}
