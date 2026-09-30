"use client";

import { useRef } from "react";
import { Answers } from "@/components/site/home/Answers";
import { Faq } from "@/components/site/home/Faq";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import { PageHero } from "@/components/site/pages/PageHero";
import { fadeOnly, splitHeadings } from "@/components/site/pages/pageMotion";
import { ASSURANCE, StartFree } from "@/components/site/StartFree";
import { pricing } from "@/content/site/home";
import styles from "./Pricing.module.css";

function Tick() {
  return (
    <svg className={styles.tick} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4.5 10.6l3.6 3.6 7.4-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SitePricingPage() {
  const ref = useRef<HTMLDivElement>(null);
  const currency = pricing.price.slice(0, 1);
  const amount = pricing.price.slice(1);

  useSiteMotion(ref, (kit, c, scope) => {
    const { gsap } = kit;
    const card = scope.querySelector<HTMLElement>("[data-price-card]");
    const parts = gsap.utils.toArray<HTMLElement>("[data-price-part]", scope);
    const glyphs = gsap.utils.toArray<HTMLElement>("[data-price-glyph]", scope);
    const items = gsap.utils.toArray<HTMLElement>("[data-price-item]", scope);
    const faq = gsap.utils.toArray<HTMLElement>("[data-faq-item]", scope);
    const faqHead = gsap.utils.toArray<HTMLElement>("[data-faq-head] > [data-fade]", scope);
    if (!card) return;

    if (c.reduce) {
      fadeOnly(kit, scope, "[data-price-card], [data-faq-head] > *, [data-faq-item]");
      return;
    }

    const cleanup = splitHeadings(kit, scope);

    gsap.set(card, { transformPerspective: 1400, transformOrigin: "50% 100%" });
    const enter = gsap.timeline({ scrollTrigger: { trigger: card, start: "top 86%", once: true } });
    enter.from(
      card,
      { y: c.mobile ? 50 : 90, opacity: 0, rotationX: c.mobile ? 0 : 10, scale: 0.97, duration: 1.3, ease: "power4.out", immediateRender: true, force3D: true },
      0,
    );
    enter.from(parts, { y: 20, opacity: 0, duration: 0.9, stagger: 0.07, immediateRender: true }, 0.3);
    enter.fromTo(
      glyphs,
      { rotationX: -95, yPercent: 30, opacity: 0, transformOrigin: "50% 100%", transformPerspective: 700 },
      { rotationX: 0, yPercent: 0, opacity: 1, duration: 1.3, stagger: 0.14, ease: "back.out(1.5)", immediateRender: true },
      0.4,
    );
    enter.from(items, { x: c.mobile ? -14 : -26, opacity: 0, duration: 0.85, stagger: 0.08, immediateRender: true }, 0.55);

    gsap.from(faqHead, { y: 22, opacity: 0, duration: 0.9, stagger: 0.08, immediateRender: true, scrollTrigger: { trigger: faqHead[0], start: "top 88%", once: true } });
    if (faq.length) {
      gsap.from(faq, { y: 26, opacity: 0, duration: 0.85, stagger: 0.07, immediateRender: true, scrollTrigger: { trigger: faq[0], start: "top 92%", once: true } });
    }

    let detach: (() => void) | undefined;
    if (c.desktop && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const rx = gsap.quickTo(card, "rotationX", { duration: 1.1, ease: "power3.out" });
      const ry = gsap.quickTo(card, "rotationY", { duration: 1.1, ease: "power3.out" });
      const move = (event: PointerEvent) => {
        const rect = card.getBoundingClientRect();
        const nx = (event.clientX - rect.left) / rect.width - 0.5;
        const ny = (event.clientY - rect.top) / rect.height - 0.5;
        ry(gsap.utils.clamp(-3.5, 3.5, nx * 7));
        rx(gsap.utils.clamp(-3.5, 3.5, -ny * 7));
        card.style.setProperty("--mx", `${((nx + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty("--my", `${((ny + 0.5) * 100).toFixed(1)}%`);
      };
      const leave = () => {
        rx(0);
        ry(0);
      };
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerleave", leave);
      detach = () => {
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerleave", leave);
        card.style.removeProperty("--mx");
        card.style.removeProperty("--my");
      };
    }

    return () => {
      cleanup();
      detach?.();
    };
  });

  return (
    <div ref={ref} className={styles.page}>
      <PageHero kicker={pricing.kicker} title={pricing.title} lead={pricing.body} />

      <section className={styles.priceSection} aria-label="What is included">
        <div className="s-container">
          <div className={styles.card} data-price-card data-reveal>
            <div className={styles.left}>
              <p className={styles.price}>
                <span className="sr-only">{pricing.price}</span>
                <span className={styles.glyph} data-price-glyph aria-hidden="true">
                  {currency}
                </span>
                <span className={styles.glyph} data-price-glyph aria-hidden="true">
                  {amount}
                </span>
              </p>
              <p className={`s-mono ${styles.cadence}`} data-price-part>
                {pricing.cadence}
              </p>
              <div className={styles.cta} data-price-part>
                <StartFree placement="pricing" size="lg" />
                <p className="s-assurance">{ASSURANCE}</p>
              </div>
            </div>
            <div className={styles.right}>
              <p className={styles.includedLabel} data-price-part>
                Included
              </p>
              <ul className={styles.included}>
                {pricing.included.map((item) => (
                  <li key={item} data-price-item>
                    <Tick />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Answers />

      <section className={styles.faqSection} aria-labelledby="pricing-faq-title">
        <div className={`s-container ${styles.faqGrid}`}>
          <header className={styles.faqHead} data-faq-head>
            <p className="s-kicker" data-fade data-reveal>
              FAQ
            </p>
            <h2 id="pricing-faq-title" className={styles.faqTitle} data-split data-reveal>
              Frequently asked questions
            </h2>
          </header>
          <Faq items={pricing.faq} label="Pricing questions" />
        </div>
      </section>
    </div>
  );
}
