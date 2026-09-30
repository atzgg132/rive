"use client";

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ASSURANCE, StartFree } from "@/components/site/StartFree";
import { PhoneAcceptance, StageContent, INVOICE_TOTAL } from "@/components/site/home/stage/StageViews";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import { hero, stage } from "@/content/site/home";
import styles from "./ThreadStage.module.css";

const STEPS = stage.steps;
const LAST = STEPS.length - 1;
const TITLE_ID = "stage-title";
const stepId = (i: number) => `stage-step-${i}`;
const panelId = (i: number) => `stage-panel-${i}`;
const pad = (i: number) => String(i + 1).padStart(2, "0");
const PHONE_INDEX = STEPS.findIndex((s) => s.view === "acceptance");
const INVOICE_INDEX = STEPS.findIndex((s) => s.view === "invoice");

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
/* Where a pinned stage cannot show a screen and its text at once (a phone in
   landscape, a 200% zoom), the same steps stack instead. */
const SHORT_QUERY = "(max-height: 499px), ((max-width: 1023.98px) and (max-height: 559px))";

function useMediaFlag(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Pinned-stage timeline length in step-widths: six transitions plus a hold
 * on the last step in which the call to action arrives. */
const TAIL = 0.7;
const TIMELINE = LAST + TAIL;
/** Scroll progress at which each step rests, plus the end of the hold. */
const STOPS = [...STEPS.map((_, i) => i / TIMELINE), 1];

/* ── One layer of the screen ─────────────────────────────────── */

const Layer = memo(function Layer({ index, mounted }: { index: number; mounted: boolean }) {
  const step = STEPS[index];
  if (step.view === "acceptance") return null;
  return (
    <div className={styles.layer} data-layer={index}>
      <div className={styles.layerInner} data-inner>
        {mounted ? <StageContent view={step.view} /> : null}
      </div>
    </div>
  );
});

function Caption({ hidden }: { hidden?: boolean }) {
  return (
    <p className={`s-sample-label ${styles.caption}`} data-hidden={hidden ? "" : undefined}>
      {hero.sampleLabel}
    </p>
  );
}

function Screen({ mountedCount, phoneOn }: { mountedCount: number; phoneOn: boolean }) {
  return (
    <div className={styles.screen} data-screen>
      <div className={styles.stageArea}>
        <div className={styles.frame}>
          <div className={styles.glow} data-glow aria-hidden="true" />
          <div className={styles.base} data-base aria-hidden="true">
            {STEPS.map((_, i) => (
              <Layer key={i} index={i} mounted={i < mountedCount} />
            ))}
            <div className={styles.sweep} data-sweep />
          </div>
          <Caption hidden={phoneOn} />
        </div>
        <div className={styles.phoneLayer} data-layer={PHONE_INDEX} data-phone aria-hidden="true">
          {PHONE_INDEX < mountedCount ? <PhoneAcceptance /> : null}
        </div>
      </div>
    </div>
  );
}

/* ── Reduced motion: one panel per step, mounted as it nears ─── */

function LazyMount({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "60% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={styles.lazy} data-near={near ? "" : undefined}>
      {near ? children : null}
    </div>
  );
}

function StackedPanel({ index }: { index: number }) {
  const step = STEPS[index];
  return (
    <article id={panelId(index)} className={styles.panel} aria-labelledby={`${panelId(index)}-title`}>
      <div className={styles.panelText}>
        <p className={styles.stepMeta}>
          <span className={styles.stepNum}>{pad(index)}</span>
          <span>{step.label}</span>
        </p>
        <h3 id={`${panelId(index)}-title`} className={styles.stepTitle}>
          {step.title}
        </h3>
        <p className={styles.stepBody}>{step.body}</p>
      </div>
      <div className={styles.panelView}>
        <div className={styles.screen}>
          <div className={styles.stageArea}>
            <div className={styles.frame}>
              <div className={styles.glow} aria-hidden="true" />
              <div className={styles.base} aria-hidden="true">
                {step.view !== "acceptance" ? (
                  <div className={styles.layer} data-static>
                    <div className={styles.layerInner}>
                      <LazyMount>
                        <StageContent view={step.view} />
                      </LazyMount>
                    </div>
                  </div>
                ) : null}
              </div>
              <Caption />
            </div>
            {step.view === "acceptance" ? (
              <div className={styles.phoneLayer} data-static aria-hidden="true">
                <LazyMount>
                  <PhoneAcceptance />
                </LazyMount>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ── The section ─────────────────────────────────────────────── */

export function ThreadStage() {
  const rootRef = useRef<HTMLElement>(null);
  const stRef = useRef<{ start: number; end: number } | null>(null);
  const reduced = useMediaFlag(REDUCE_QUERY);
  const short = useMediaFlag(SHORT_QUERY);
  const stacked = reduced || short;
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(1);
  const activeRef = useRef(0);
  const navRef = useRef<{ progress: number; until: number } | null>(null);

  const goTo = useCallback(
    (index: number) => {
      const range = stRef.current;
      if (!range) {
        document.getElementById(stepId(index))?.scrollIntoView({ block: "center" });
        return;
      }
      const top = range.start + ((range.end - range.start) * index) / TIMELINE;
      navRef.current = { progress: index / TIMELINE, until: Date.now() + 2500 };
      const instant = window.matchMedia(REDUCE_QUERY).matches;
      window.scrollTo({ top, behavior: instant ? "auto" : "smooth" });
    },
    [],
  );

  /* Views are heavy React trees: mount the first two when the section is
     near, then the rest one at a time while the browser is idle. */
  useEffect(() => {
    if (stacked) return;
    const el = rootRef.current;
    if (!el) return;
    let cancelled = false;
    let timer = 0;
    const idle = (fn: () => void) => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(fn, { timeout: 800 });
      else fn();
    };
    let count = 2;
    const next = () => {
      timer = window.setTimeout(() => {
        idle(() => {
          if (cancelled) return;
          count += 1;
          setMounted(count);
          if (count < STEPS.length) next();
        });
      }, 380);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        setMounted((m) => Math.max(m, 2));
        next();
      },
      { rootMargin: "200% 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, [stacked]);

  const mountedCount = Math.min(STEPS.length, Math.max(mounted, active > 0 ? active + 2 : 1));

  useSiteMotion(
    rootRef,
    ({ gsap, ScrollTrigger, SplitText }, c, scope) => {
      let bleedCleanup: (() => void) | undefined;
      const q = <T extends Element>(sel: string) => scope.querySelector<T>(sel);
      const qa = <T extends Element>(sel: string) => Array.from(scope.querySelectorAll<T>(sel));

      const kicker = q<HTMLElement>("[data-intro-kicker]");
      const title = q<HTMLElement>("[data-intro-title]");
      const lead = q<HTMLElement>("[data-intro-lead]");

      if (c.reduce) {
        if (scope.dataset.mode !== "stacked") return;
        gsap.from([kicker, title, lead].filter(Boolean), { opacity: 0, duration: 0.4, stagger: 0.08, ease: "none", immediateRender: true });
        return;
      }

      /* Intro: masked line reveal of the heading. */
      if (kicker) gsap.from(kicker, { opacity: 0, y: 14, duration: 0.8, immediateRender: true, scrollTrigger: { trigger: scope, start: "top 34%", once: true } });
      if (lead) gsap.from(lead, { opacity: 0, y: 22, duration: 1, delay: 0.15, immediateRender: true, scrollTrigger: { trigger: scope, start: "top 34%", once: true } });
      if (title) {
        SplitText.create(title, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.lines, {
              yPercent: 112,
              duration: 1.1,
              stagger: 0.09,
              ease: "power4.out",
              immediateRender: true,
              scrollTrigger: { trigger: scope, start: "top 34%", once: true },
            });
          },
        });
      }

      /* The paper→ink transition, kept inside this section: a paper band at
         its top that the ink floods up through along a soft wave. */
      const bleed = q<HTMLElement>("[data-bleed]");
      const intro = q<HTMLElement>("[data-intro]");
      if (bleed && intro) {
        const SAMPLES = 72;
        const seed = 0.37;
        const wave = (x: number, t: number) => {
          const a = Math.sin(Math.PI * 2 * (1.3 * x + seed) + t * 1.4);
          const b = Math.sin(Math.PI * 2 * (2.9 * x + seed * 2.3) - t * 2.1 + 1.7);
          const c2 = Math.sin(Math.PI * 2 * (5.3 * x + seed * 0.7) + t * 2.9 + 0.4);
          return 0.5 + 0.5 * (0.55 * a + 0.3 * b + 0.15 * c2);
        };
        let band = 0;
        let amp = 0;
        const measure = () => {
          amp = window.innerHeight * (c.mobile ? 0.022 : 0.035);
          band = intro.offsetTop + intro.offsetHeight + amp;
          bleed.style.height = `${band}px`;
        };
        const proxy = { p: 0 };
        const draw = () => {
          const p = proxy.p;
          const pts: string[] = [];
          const swell = 0.7 + 0.3 * Math.sin(Math.PI * Math.min(1, p));
          for (let i = 0; i <= SAMPLES; i++) {
            const x = i / SAMPLES;
            const y = (band + amp) * (1 - p) + amp * swell * (wave(x, p * 2.4) - 1);
            pts.push(`${(x * 100).toFixed(2)}% ${y.toFixed(1)}px`);
          }
          bleed.style.clipPath = `polygon(0% 0%,100% 0%,${pts.reverse().join(",")})`;
        };
        measure();
        draw();
        const onRefresh = () => {
          measure();
          draw();
        };
        ScrollTrigger.addEventListener("refreshInit", onRefresh);
        gsap.to(proxy, {
          p: 1,
          ease: "none",
          onUpdate: draw,
          scrollTrigger: { trigger: scope, start: "top bottom", end: "top 35%", scrub: 0.6, invalidateOnRefresh: true },
        });
        bleedCleanup = () => ScrollTrigger.removeEventListener("refreshInit", onRefresh);
      }

      if (scope.dataset.mode !== "pinned") return;

      /* The pinned stage. */
      const pin = q<HTMLElement>("[data-pin]");
      const screen = q<HTMLElement>("[data-screen]");
      const base = q<HTMLElement>("[data-base]");
      const left = q<HTMLElement>("[data-left]");
      const wheel = q<HTMLElement>("[data-wheel]");
      const steps = q<HTMLElement>("[data-steps]");
      const fill = q<HTMLElement>("[data-rail-fill]");
      const railTrack = q<HTMLElement>("[data-rail-track]");
      const sweep = q<HTMLElement>("[data-sweep]");
      const glow = q<HTMLElement>("[data-glow]");
      const cta = q<HTMLElement>("[data-cta]");
      const amountEl = q<HTMLElement>("[data-amount]");
      const paper = q<HTMLElement>("[data-paper]");
      const chip = q<HTMLElement>("[data-amount-chip]");
      const phone = q<HTMLElement>("[data-phone]");
      const layers = STEPS.map((_, i) => (i === PHONE_INDEX ? phone : q<HTMLElement>(`[data-layer="${i}"]`)));
      if (!pin || !screen || !base || !left || !fill || !railTrack || !sweep || !glow || !cta || !phone) return;
      const items = qa<HTMLElement>("[data-step]");
      const inners = layers.map((el) => el?.querySelector<HTMLElement>("[data-inner]") ?? null);

      const unitVh = c.desktop ? 70 : c.tablet ? 60 : 55;
      const railEnd = (i: number) => (c.mobile ? i / LAST : i === LAST ? 1 : i / STEPS.length);
      const D = 0.8;

      const wheelY = (i: number) => {
        if (!wheel || !items[i]) return 0;
        return Math.round((wheel.clientHeight - items[i].offsetHeight) / 2 - items[i].offsetTop);
      };

      gsap.set(layers.filter((_, i) => i > 0), { autoAlpha: 0 });
      gsap.set(cta, { opacity: 0 });

      /* Before the pin: the stage assembles as it rises into place. */
      const enter = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: pin, start: "top 92%", end: "top top", scrub: 0.8 },
      });
      enter.fromTo(screen, { y: c.mobile ? 60 : 120, scale: 0.9, rotateX: 10, transformPerspective: 1400, transformOrigin: "50% 100%" }, { y: 0, scale: 1, rotateX: 0 }, 0);
      enter.fromTo(left, { y: 70, opacity: 0.001 }, { y: 0, opacity: 1 }, 0.05);
      enter.fromTo(railTrack, { scaleX: 0 }, { scaleX: 1 }, 0);

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: pin,
          start: "top top",
          end: () => `+=${Math.round((TIMELINE * unitVh * window.innerHeight) / 100)}`,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: 0.8,
          invalidateOnRefresh: true,
          snap: {
            directional: false,
            inertia: false,
            snapTo: (value: number, self?: { direction: number }) => {
              const nav = navRef.current;
              if (nav && Date.now() < nav.until) return nav.progress;
              const nearest = STOPS.reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
              if (Math.abs(nearest - value) < 0.004) return nearest;
              const dir = self?.direction ?? 0;
              if (dir > 0) return STOPS.find((p) => p >= value) ?? 1;
              if (dir < 0) return [...STOPS].reverse().find((p) => p <= value) ?? 0;
              return nearest;
            },
            duration: { min: 0.25, max: 0.6 },
            delay: 0.06,
            ease: "power2.inOut",
          },
          onToggle: (self) => pin.toggleAttribute("data-live", self.isActive),
          onUpdate: (self) => {
            const t = self.progress * TIMELINE;
            const idx = Math.min(LAST, Math.max(0, Math.floor(t + 0.5)));
            if (idx !== activeRef.current) {
              activeRef.current = idx;
              setActive(idx);
            }
            cta.toggleAttribute("data-on", t > LAST + TAIL * 0.4);
          },
        },
      });
      const st = tl.scrollTrigger!;
      stRef.current = { get start() { return st.start; }, get end() { return st.end; } };

      gsap.set(fill, { scaleX: 0, transformOrigin: "0 50%" });

      for (let i = 1; i <= LAST; i++) {
        const t0 = i - 1 + 0.08;
        const view = STEPS[i].view;
        const prevView = STEPS[i - 1].view;
        const into = layers[i]!;
        const out = layers[i - 1]!;

        /* Progress rail. */
        tl.fromTo(fill, { scaleX: railEnd(i - 1) }, { scaleX: railEnd(i), duration: 1, immediateRender: i === 1 }, i - 1);

        /* Text column (desktop: the wheel of steps turns). */
        if (c.desktop && steps) {
          const tween = { y: () => wheelY(i), duration: D, ease: "power2.inOut" };
          if (i === 1) tl.fromTo(steps, { y: () => wheelY(0) }, tween, t0);
          else tl.to(steps, tween, t0);
        }

        /* Outgoing view: recedes in z, shrinks and fades. */
        if (view === "acceptance") {
          tl.to(out, { scale: 0.93, z: -140, opacity: 0.3, duration: D, ease: "power2.inOut" }, t0);
        } else if (prevView === "acceptance") {
          tl.to(out, { rotateY: 62, xPercent: -18, scale: 0.9, transformPerspective: 1400, autoAlpha: 0, duration: D * 0.85, ease: "power3.in" }, t0);
          const backdrop = layers[i - 2];
          if (backdrop) tl.to(backdrop, { scale: 0.88, z: -260, autoAlpha: 0, duration: D * 0.7, ease: "power2.in" }, t0 + 0.05);
        } else {
          tl.to(out, { scale: 0.91, z: -220, duration: D, ease: "power2.in" }, t0);
          tl.to(out, { autoAlpha: 0, duration: D * 0.35 }, t0 + D * 0.65);
        }

        /* Incoming view. */
        if (view === "acceptance") {
          tl.fromTo(
            into,
            { rotateY: -78, xPercent: 16, scale: 0.86, autoAlpha: 0, transformPerspective: 1400 },
            { rotateY: 0, xPercent: 0, scale: 1, autoAlpha: 1, duration: D + 0.15, ease: "power3.out" },
            t0 + 0.05,
          );
        } else {
          tl.set(into, { autoAlpha: 1 }, t0);
          tl.fromTo(
            into,
            { clipPath: "inset(0% 0% 0% 100%)", scale: 1.07, z: 90 },
            { clipPath: "inset(0% 0% 0% 0%)", scale: 1, z: 0, duration: D, ease: "power3.inOut" },
            t0,
          );
          const inner = inners[i];
          if (inner) tl.fromTo(inner, { xPercent: 9 }, { xPercent: 0, duration: D + 0.15, ease: "power3.out" }, t0);
        }

        /* Light sweep and glow on every change. */
        tl.fromTo(sweep, { xPercent: 0 }, { xPercent: 300, duration: D * 1.1, ease: "power2.inOut" }, t0);
        tl.fromTo(glow, { scale: 0.92, opacity: 0.55 }, { scale: 1.1, opacity: 1, duration: D * 0.5, ease: "power2.out" }, t0);
        tl.to(glow, { scale: 0.97, opacity: 0.65, duration: D * 0.5, ease: "power2.in" }, t0 + D * 0.5);

        /* Invoice: the paper settles and the total counts up. */
        if (i === INVOICE_INDEX && paper && chip && amountEl) {
          tl.fromTo(paper, { y: 80, rotate: -5, scale: 0.92 }, { y: 0, rotate: -1.4, scale: 1, duration: D + 0.2, ease: "power3.out" }, t0 + 0.05);
          tl.fromTo(chip, { y: 34, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out" }, t0 + 0.4);
          const counter = { v: 0 };
          const fmt = new Intl.NumberFormat("en-IN");
          tl.fromTo(
            counter,
            { v: 0 },
            {
              v: INVOICE_TOTAL,
              duration: D,
              ease: "power2.out",
              onUpdate: () => {
                const text = `₹${fmt.format(Math.round(counter.v))}`;
                const node = amountEl.firstChild;
                if (node) node.nodeValue = text;
                else amountEl.textContent = text;
              },
            },
            t0 + 0.25,
          );
        }
      }

      /* Hold on the last step; the call to action arrives. */
      tl.fromTo(fill, { scaleX: railEnd(LAST) }, { scaleX: c.mobile ? 1 : 1, duration: TAIL * 0.6 }, LAST);
      tl.fromTo(cta, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: TAIL * 0.45, ease: "power2.out" }, LAST + TAIL * 0.25);
      tl.to({}, { duration: 0.0001 }, TIMELINE - 0.0001);

      /* Keyboard: the call to action is always reachable. */
      const onCtaFocus = () => {
        if (tl.progress() < 0.97) window.scrollTo({ top: st.end, behavior: "instant" });
      };
      cta.addEventListener("focusin", onCtaFocus);

      const onRefresh = () => {
        if (c.desktop) gsap.set(steps, { y: wheelY(activeRef.current) });
      };
      ScrollTrigger.addEventListener("refreshInit", onRefresh);

      return () => {
        bleedCleanup?.();
        cta.removeEventListener("focusin", onCtaFocus);
        ScrollTrigger.removeEventListener("refreshInit", onRefresh);
        stRef.current = null;
        activeRef.current = 0;
        setActive(0);
      };
    },
    [stacked],
  );

  return (
    <section
      ref={rootRef}
      id={stage.id}
      className={styles.stage}
      data-stage
      data-theme="ink"
      data-mode={stacked ? "stacked" : "pinned"}
      aria-labelledby={TITLE_ID}
    >
      {reduced ? null : <div className={styles.bleed} data-bleed aria-hidden="true" />}

      <div className={`s-container ${styles.intro}`} data-intro>
        <div>
          <p className="s-kicker" data-intro-kicker data-reveal>
            {stage.kicker}
          </p>
          <h2 id={TITLE_ID} className={`s-h2 ${styles.title}`} data-intro-title data-reveal>
            {stage.title}
          </h2>
        </div>
        <p className={`s-lead ${styles.lead}`} data-intro-lead data-reveal>
          {stage.body}
        </p>
      </div>

      {stacked ? (
        <div className={`s-container ${styles.stacked}`}>
          <nav aria-label="Steps in the job" className={styles.staticRail}>
            <ol>
              {STEPS.map((s, i) => (
                <li key={s.view}>
                  <a href={`#${panelId(i)}`}>
                    <span className={styles.stepNum}>{pad(i)}</span>
                    <span>{s.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          {STEPS.map((_, i) => (
            <StackedPanel key={i} index={i} />
          ))}
          <div className={styles.ctaStatic}>
            <StartFree placement="stage" size="lg" />
            <p className="s-assurance">{ASSURANCE}</p>
          </div>
        </div>
      ) : (
        <div className={styles.pin} data-pin>
          <div className={styles.inner}>
            <nav aria-label="Steps in the job" className={styles.rail}>
              <div className={styles.railTrack} data-rail-track aria-hidden="true">
                <i className={styles.railFill} data-rail-fill />
              </div>
              <ol className={styles.railList}>
                {STEPS.map((s, i) => (
                  <li key={s.view}>
                    <button
                      type="button"
                      className={styles.railBtn}
                      aria-controls={stepId(i)}
                      aria-current={active === i ? "step" : undefined}
                      data-state={i < active ? "done" : i === active ? "active" : "todo"}
                      onClick={() => goTo(i)}
                    >
                      <span className={styles.railDot} aria-hidden="true" {...(i === 0 ? { "data-thread-anchor": "stage" } : {})} />
                      <span className={styles.railText}>
                        <span className={styles.stepNum}>{pad(i)}</span>
                        <span className={styles.railLabel}>{s.label}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            <div className={styles.cols}>
              <div className={styles.left} data-left>
                <div className={styles.wheel} data-wheel>
                  <ol className={styles.steps} data-steps>
                    {STEPS.map((s, i) => (
                      <li key={s.view} id={stepId(i)} className={styles.step} data-step={i} data-active={active === i ? "" : undefined}>
                        <p className={styles.stepMeta}>
                          <span className={styles.stepNum}>{pad(i)}</span>
                          <span>{s.label}</span>
                        </p>
                        <h3 className={styles.stepTitle}>{s.title}</h3>
                        <p className={styles.stepBody}>{s.body}</p>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className={styles.cta} data-cta>
                  <StartFree placement="stage" size="lg" />
                  <p className="s-assurance">{ASSURANCE}</p>
                </div>
              </div>

              <div className={styles.right}>
                <Screen mountedCount={mountedCount} phoneOn={active === PHONE_INDEX} />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
