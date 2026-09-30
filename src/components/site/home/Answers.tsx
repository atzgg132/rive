"use client";

import Link from "next/link";
import { Fragment, useRef } from "react";
import { answers } from "@/content/site/home";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import styles from "./Answers.module.css";

const CHANGELOG_WORD = "changelog";

const POINTS = 64;
/* Long, low swells: the ink edge rises as a soft wave. Higher frequencies or
   a wider spread turn it into spikes on narrow screens. */
const DELAYS = Array.from({ length: POINTS + 1 }, (_, i) => {
  const x = i / POINTS;
  const wave = 0.5 + 0.32 * Math.sin(x * Math.PI * 2 * 1.1 + 1) + 0.14 * Math.sin(x * Math.PI * 2 * 2.3 + 2.4);
  return Math.min(1, Math.max(0, wave));
});
const SPREAD = 0.1;

function Tick() {
  return (
    <svg className={styles.tick} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
      <path d="M6 10.4l2.8 2.8L14.2 7.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Answers() {
  const ref = useRef<HTMLElement>(null);
  const [beforeBeta, afterBeta] = answers.beta.split(CHANGELOG_WORD);

  useSiteMotion(ref, ({ gsap, SplitText }, c, scope) => {
    const head = gsap.utils.toArray<HTMLElement>("[data-answers-head] > *", scope);
    const does = gsap.utils.toArray<HTMLElement>("[data-answers-does]", scope);
    const not = gsap.utils.toArray<HTMLElement>("[data-answers-not]", scope);
    const panels = gsap.utils.toArray<HTMLElement>("[data-answers-col]", scope);
    const beta = scope.querySelector<HTMLElement>("[data-answers-beta]");
    const titleEl = scope.querySelector<HTMLElement>("[data-answers-title]");

    if (c.reduce) {
      gsap.fromTo([...head, ...panels, beta], { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.05, immediateRender: true, clearProps: "opacity", scrollTrigger: { trigger: scope, start: "top 60%", once: true } });
      return;
    }

    /* Ink bleeds up from the paper section above. The clip's top edge is an
       organic curve whose points travel at slightly different times, so the
       edge rises through the section like ink soaking into paper. */
    const state = { p: 0 };
    const paint = () => {
      const reach = window.innerHeight * (c.mobile ? 0.85 : 0.95) + 200;
      const pts: string[] = [];
      for (let i = 0; i <= POINTS; i++) {
        const local = Math.min(1, Math.max(0, (state.p - DELAYS[i] * SPREAD) / (1 - SPREAD)));
        const eased = local * local * (3 - 2 * local) * 0.35 + local * 0.65;
        const y = reach * (1 - eased) - eased * 260;
        pts.push(`${((i / POINTS) * 100).toFixed(2)}% ${y.toFixed(1)}px`);
      }
      scope.style.clipPath = `polygon(${pts.join(",")},100% 200000px,0% 200000px)`;
    };
    paint();
    gsap.to(state, {
      p: 1,
      ease: "none",
      onUpdate: paint,
      scrollTrigger: { trigger: scope, start: "top bottom", end: "top top", scrub: 1, invalidateOnRefresh: true },
    });

    let split: { revert: () => void } | undefined;
    if (titleEl) {
      const s = SplitText.create(titleEl, { type: "lines", mask: "lines", linesClass: "s-line" });
      split = s;
      gsap.from(s.lines, { yPercent: 105, duration: 1.1, stagger: 0.1, ease: "power4.out", immediateRender: true, scrollTrigger: { trigger: titleEl, start: "top 80%", once: true } });
    }
    gsap.from(head.filter((el) => el !== titleEl), { y: 24, opacity: 0, duration: 0.9, stagger: 0.08, immediateRender: true, scrollTrigger: { trigger: head[0], start: "top 78%", once: true } });

    const items = c.mobile ? { y: 22, x: 0 } : { y: 26, x: 0 };
    panels.forEach((panel, index) => {
      const set = index === 0 ? does : not;
      gsap.from(panel, { opacity: 0, y: 40, duration: 1, immediateRender: true, scrollTrigger: { trigger: panel, start: "top 88%", once: true } });
      gsap.from(set, { ...items, opacity: 0, duration: 0.8, stagger: 0.07, ease: "power3.out", immediateRender: true, scrollTrigger: { trigger: panel, start: "top 80%", once: true } });
    });
    if (beta) gsap.from(beta, { opacity: 0, y: 16, duration: 0.9, immediateRender: true, scrollTrigger: { trigger: beta, start: "top 92%", once: true } });

    return () => {
      split?.revert();
      scope.style.clipPath = "";
    };
  });

  return (
    <section ref={ref} id="answers" data-answers data-theme="ink" className={`s-section ${styles.section}`} aria-labelledby="answers-title">
      <div className="s-container">
        <header className={styles.head} data-answers-head>
          <p className="s-kicker">{answers.kicker}</p>
          <h2 id="answers-title" data-answers-title className={`s-h2 ${styles.title}`}>{answers.title}</h2>
        </header>

        <div className={styles.cols}>
          <div className={styles.does} data-answers-col>
            <h3 className={styles.colTitle}>Rive does</h3>
            <ul className={styles.doesList}>
              {answers.does.map((item) => (
                <li key={item} data-answers-does>
                  <Tick />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.not} data-answers-col>
            <h3 className={styles.colTitle}>Not yet</h3>
            <ul className={styles.notList}>
              {answers.doesNot.map((item) => (
                <li key={item.title} data-answers-not>
                  <span className={styles.dash} aria-hidden="true" />
                  <div>
                    <h4 className={styles.notTitle}>{item.title}</h4>
                    <p className={styles.notBody}>{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className={styles.beta} data-answers-beta>
          {afterBeta === undefined ? (
            answers.beta
          ) : (
            <Fragment>
              {beforeBeta}
              <Link href="/changelog">{CHANGELOG_WORD}</Link>
              {afterBeta}
            </Fragment>
          )}
        </p>
      </div>
    </section>
  );
}
