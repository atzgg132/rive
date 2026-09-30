"use client";

import { useRef } from "react";
import { pricing } from "@/content/site/home";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import { ASSURANCE, StartFree } from "@/components/site/StartFree";
import { Faq } from "@/components/site/home/Faq";
import styles from "./Pricing.module.css";

function Tick() {
  return (
    <svg className={styles.tick} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4.5 10.6l3.6 3.6 7.4-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Pricing() {
  const ref = useRef<HTMLElement>(null);
  const currency = pricing.price.slice(0, 1);
  const amount = pricing.price.slice(1);

  useSiteMotion(ref, ({ gsap }, c, scope) => {
    const head = gsap.utils.toArray<HTMLElement>("[data-pricing-head] > *", scope);
    const card = scope.querySelector<HTMLElement>("[data-pricing-card]");
    const cardParts = gsap.utils.toArray<HTMLElement>("[data-pricing-part]", scope);
    const glyphs = gsap.utils.toArray<HTMLElement>("[data-pricing-glyph]", scope);
    const faqItems = gsap.utils.toArray<HTMLElement>("[data-faq-item]", scope);
    if (!card) return;

    if (c.reduce) {
      gsap.fromTo([...head, card, ...faqItems], { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.04, immediateRender: true, clearProps: "opacity", scrollTrigger: { trigger: card, start: "top 85%", once: true } });
      return;
    }

    gsap.from(head, { y: 32, opacity: 0, duration: 1, stagger: 0.09, immediateRender: true, scrollTrigger: { trigger: head[0], start: "top 88%", once: true } });

    const enter = gsap.timeline({ scrollTrigger: { trigger: card, start: "top 82%", once: true } });
    enter.from(card, { y: 70, opacity: 0, duration: 1.1, ease: "power4.out", immediateRender: true }, 0);
    enter.from(cardParts, { y: 18, opacity: 0, duration: 0.8, stagger: 0.06, immediateRender: true }, 0.25);
    enter.fromTo(
      glyphs,
      { rotationX: -95, yPercent: 30, opacity: 0, transformOrigin: "50% 100%", transformPerspective: 600 },
      { rotationX: 0, yPercent: 0, opacity: 1, duration: 1.2, stagger: 0.14, ease: "back.out(1.5)", immediateRender: true },
      0.35,
    );
    gsap.from(faqItems, { y: 24, opacity: 0, duration: 0.8, stagger: 0.07, immediateRender: true, scrollTrigger: { trigger: faqItems[0], start: "top 90%", once: true } });

    /* A slow tilt toward the pointer: fine-pointer desktops only. */
    if (c.desktop && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      gsap.set(card, { force3D: true });
      const rx = gsap.quickTo(card, "rotationX", { duration: 1.1, ease: "power3.out" });
      const ry = gsap.quickTo(card, "rotationY", { duration: 1.1, ease: "power3.out" });
      const move = (event: PointerEvent) => {
        const rect = card.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width - 0.5;
        const ny = (event.clientY - rect.top) / rect.height - 0.5;
        ry(gsap.utils.clamp(-4, 4, nx * 8));
        rx(gsap.utils.clamp(-4, 4, -ny * 8));
      };
      const leave = () => {
        rx(0);
        ry(0);
      };
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerleave", leave);
      return () => {
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerleave", leave);
      };
    }
  });

  return (
    <section ref={ref} id="pricing" data-pricing className={`s-section ${styles.section}`} aria-labelledby="pricing-title">
      <div className="s-container">
        <header className={styles.head} data-pricing-head>
          <p className="s-kicker">{pricing.kicker}</p>
          <h2 id="pricing-title" className={`s-h2 ${styles.title}`}>{pricing.title}</h2>
        </header>

        <div className={styles.layout}>
          <div className={styles.cardWrap}>
            <div className={styles.card} data-pricing-card>
              <div className={styles.priceRow} data-pricing-part>
                <p className={styles.price}>
                  <span className={styles.glyph} data-pricing-glyph>{currency}</span>
                  <span className={styles.glyph} data-pricing-glyph>{amount}</span>
                </p>
                <p className={`s-mono ${styles.cadence}`}>{pricing.cadence}</p>
              </div>
              <p className={styles.body} data-pricing-part>{pricing.body}</p>
              <ul className={styles.included} data-pricing-part>
                {pricing.included.map((item) => (
                  <li key={item}>
                    <Tick />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.cta} data-pricing-part>
                <StartFree placement="pricing" size="lg" />
                <p className="s-assurance">{ASSURANCE}</p>
              </div>
            </div>
          </div>

          <div className={styles.faqCol}>
            <Faq items={pricing.faq} label="Pricing questions" />
          </div>
        </div>
      </div>
    </section>
  );
}
