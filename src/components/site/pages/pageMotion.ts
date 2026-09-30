import type { GsapKit } from "@/components/site/motion/gsap";
import type { MotionConditions } from "@/components/site/motion/gsap";

/** Deterministic pseudo-noise: the ink edge is organic but identical on the
 * server, the client and every resize. */
function noise(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const POINTS = 44;
const DELAYS = Array.from({ length: POINTS + 1 }, (_, i) => noise(i + 3) * 0.42);
const LEAN = Array.from({ length: POINTS + 1 }, (_, i) => (noise(i * 2.3 + 9) - 0.5) * 2);

/** An ink section bleeds up out of the paper above it: its top edge is an
 * organic curve whose points travel at slightly different times and flatten
 * as the section arrives. Returns a cleanup. */
export function inkBleed({ gsap }: GsapKit, el: HTMLElement, c: MotionConditions) {
  const reach = c.mobile ? 0.9 : 1.15;
  const state = { p: 0 };
  const paint = () => {
    const vh = window.innerHeight;
    const amp = (c.mobile ? 70 : 150) * (1 - state.p * 0.5);
    const pts: string[] = [];
    for (let i = 0; i <= POINTS; i++) {
      const local = Math.min(1, Math.max(0, (state.p - DELAYS[i] * 0.6) / (1 - 0.42 * 0.6)));
      const eased = 1 - Math.pow(1 - local, 2.2);
      const y =
        (1 - eased) * (vh * 0.06) -
        eased * vh * reach -
        Math.sin(local * Math.PI) * LEAN[i] * amp +
        (1 - local) * LEAN[i] * amp * 0.4;
      pts.push(`${((i / POINTS) * 100).toFixed(2)}% ${y.toFixed(1)}px`);
    }
    el.style.clipPath = `polygon(${pts.join(",")},100% 200000px,0% 200000px)`;
  };
  paint();
  gsap.to(state, {
    p: 1,
    ease: "none",
    onUpdate: paint,
    scrollTrigger: { trigger: el, start: "top 98%", end: "top 8%", scrub: 1, invalidateOnRefresh: true },
  });
  return () => {
    el.style.clipPath = "";
  };
}

/** Masked line reveal for every `[data-split]` heading in scope, re-split when
 * fonts load or the width changes. Returns the splits' cleanup. */
export function splitHeadings({ gsap, SplitText }: GsapKit, scope: HTMLElement, start = "top 84%") {
  const splits: { revert: () => void }[] = [];
  gsap.utils.toArray<HTMLElement>("[data-split]", scope).forEach((el) => {
    let tween: gsap.core.Tween | undefined;
    const split = SplitText.create(el, {
      type: "lines",
      mask: "lines",
      linesClass: "s-line",
      autoSplit: true,
      onSplit: (self) => {
        tween?.revert();
        tween = gsap.from(self.lines, {
          yPercent: 125,
          duration: 1.1,
          stagger: 0.1,
          ease: "power4.out",
          immediateRender: true,
          scrollTrigger: { trigger: el, start, once: true },
        });
        return tween;
      },
    });
    splits.push(split);
  });
  return () => splits.forEach((s) => s.revert());
}

/** Reduced motion: everything the page would animate simply fades in once.
 * The end value is explicit: a global reduced-motion rule puts a near-zero
 * transition on every element, so a computed opacity read right after the
 * boot class flips can still be the hidden starting value. */
export function fadeOnly({ gsap }: GsapKit, scope: HTMLElement, selector: string) {
  gsap.utils.toArray<HTMLElement>(selector, scope).forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.4,
        immediateRender: true,
        scrollTrigger: { trigger: el, start: "top 92%", once: true },
      },
    );
  });
}
