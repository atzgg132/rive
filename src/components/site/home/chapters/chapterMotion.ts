import type { GsapKit, MotionConditions } from "@/components/site/motion/gsap";

type Cleanup = () => void;

/* Height of the wavy silhouette the incoming chapter carries above its own
   top edge. The bleed layer extends this far above the section (see CSS). */
export const BLEED_TOP = 28;

const SAMPLES = 44;

function wave(x: number, t: number, seed: number) {
  const a = Math.sin(Math.PI * 2 * (1.3 * x + seed) + t * 1.4);
  const b = Math.sin(Math.PI * 2 * (2.9 * x + seed * 2.3) - t * 2.1 + 1.7);
  const c = Math.sin(Math.PI * 2 * (5.3 * x + seed * 0.7) + t * 2.9 + 0.4);
  return 0.5 + 0.5 * (0.55 * a + 0.3 * b + 0.15 * c);
}

/** Ink-bleed: the incoming chapter's own colour floods down over the outgoing
 * one from a wavy hem, scrubbed across ~60vh of scroll. Only the `[data-bleed]`
 * layer is clipped, so the section content is never masked and the layout
 * never moves. The hem stays organic once the wipe is done. */
export function bleedIn({ gsap }: GsapKit, scope: HTMLElement, c: MotionConditions): Cleanup | void {
  const layer = scope.querySelector<HTMLElement>("[data-bleed]");
  if (!layer) return;

  const seed = (scope.dataset.chapter?.length ?? 5) * 0.173;
  const tops: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) tops.push((1 - wave(i / SAMPLES, 0, seed)) * BLEED_TOP);

  const render = (p: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) pts.push(`${((i / SAMPLES) * 100).toFixed(2)}% ${tops[i].toFixed(1)}px`);
    if (p >= 0.998) {
      pts.push("100% 100%", "0% 100%");
    } else {
      const vh = window.innerHeight;
      const reach = vh * 1.12 + BLEED_TOP;
      const amp = vh * 0.15 * Math.pow(Math.sin(Math.PI * p), 0.75);
      for (let i = SAMPLES; i >= 0; i--) {
        const x = i / SAMPLES;
        const drip = Math.pow(wave(x, p * 2.4, seed + 0.31), 1.7);
        pts.push(`${(x * 100).toFixed(2)}% ${(tops[i] + reach * p + amp * drip).toFixed(1)}px`);
      }
    }
    layer.style.clipPath = `polygon(${pts.join(",")})`;
  };

  if (c.reduce) {
    render(1);
    return () => {
      layer.style.clipPath = "";
    };
  }

  render(0);
  const state = { p: 0 };
  gsap.to(state, {
    p: 1,
    ease: "none",
    onUpdate: () => render(state.p),
    scrollTrigger: {
      trigger: scope,
      start: "top 55%",
      end: "top -5%",
      scrub: 0.8,
      invalidateOnRefresh: true,
    },
  });
  return () => {
    layer.style.clipPath = "";
  };
}

/** Kicker, masked-line title, lead and staggered points, each revealed when it
 * enters. Fades only under reduced motion. */
export function revealText({ gsap, SplitText }: GsapKit, scope: HTMLElement, c: MotionConditions): Cleanup | void {
  const one = (sel: string) => scope.querySelector<HTMLElement>(sel);
  const title = one("[data-ch-title]");
  const kicker = one("[data-ch-kicker]");
  const lead = one("[data-ch-lead]");
  const points = gsap.utils.toArray<HTMLElement>("[data-ch-point]", scope);
  const extras = gsap.utils.toArray<HTMLElement>("[data-ch-extra]", scope);
  const at = (trigger: Element, start = "top 88%") => ({ trigger, start, once: true });

  if (c.reduce) {
    [kicker, title, lead, ...points, ...extras].forEach((el) => {
      if (el) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "none", scrollTrigger: at(el, "top 92%") });
    });
    return;
  }

  let split: { revert: () => void } | undefined;
  if (kicker) gsap.from(kicker, { opacity: 0, y: 14, duration: 0.8, scrollTrigger: at(kicker) });
  if (title) {
    split = SplitText.create(title, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 112,
          duration: 1.15,
          stagger: 0.09,
          ease: "power4.out",
          delay: 0.08,
          scrollTrigger: at(title),
        }),
    });
  }
  if (lead) gsap.from(lead, { opacity: 0, y: 22, duration: 0.9, scrollTrigger: at(lead, "top 90%") });
  points.forEach((point, i) => {
    const tick = point.querySelector("[data-ch-tick]");
    const st = at(point, "top 93%");
    gsap.from(point, { opacity: 0, y: 22, duration: 0.8, delay: i * 0.08, scrollTrigger: st });
    if (tick) gsap.from(tick, { scaleX: 0, transformOrigin: "left center", duration: 0.7, delay: 0.2 + i * 0.08, ease: "power3.inOut", scrollTrigger: st });
  });
  extras.forEach((el) => gsap.from(el, { opacity: 0, y: 18, duration: 0.8, scrollTrigger: at(el, "top 93%") }));
  return () => split?.revert();
}
