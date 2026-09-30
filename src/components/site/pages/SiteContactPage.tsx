"use client";

import { useRef } from "react";
import { ArrowUpRight, Mail } from "lucide-react";
import { ContactForm } from "@/components/marketing/ContactForm";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import { PageHero } from "@/components/site/pages/PageHero";
import { fadeOnly } from "@/components/site/pages/pageMotion";
import { contactContent } from "@/content/marketing/resources";
import styles from "./Contact.module.css";

export function SiteContactPage() {
  const ref = useRef<HTMLDivElement>(null);

  useSiteMotion(ref, (kit, c, scope) => {
    const { gsap } = kit;
    const card = scope.querySelector<HTMLElement>("[data-contact-card]");
    const aside = scope.querySelector<HTMLElement>("[data-contact-aside]");
    if (!card || !aside) return;

    if (c.reduce) {
      fadeOnly(kit, scope, "[data-contact-card], [data-contact-aside]");
      return;
    }

    const fields = Array.from(card.querySelectorAll<HTMLElement>("form > *")).filter((el) => !el.classList.contains("hidden"));
    const enter = gsap.timeline({ scrollTrigger: { trigger: card, start: "top 90%", once: true } });
    enter.from(card, { y: c.mobile ? 40 : 70, opacity: 0, scale: 0.98, duration: 1.2, ease: "power4.out", immediateRender: true, force3D: true }, 0);
    enter.from(fields, { y: 18, opacity: 0, duration: 0.8, stagger: 0.07, immediateRender: true, clearProps: "transform,opacity" }, 0.3);
    enter.from(aside, c.desktop ? { x: 56, opacity: 0, duration: 1.2, ease: "power4.out", immediateRender: true } : { y: 40, opacity: 0, duration: 1.1, ease: "power4.out", immediateRender: true }, 0.15);
    enter.from(aside.querySelectorAll("[data-aside-part]"), { y: 16, opacity: 0, duration: 0.8, stagger: 0.08, immediateRender: true }, 0.5);
  });

  return (
    <div ref={ref} className={styles.page}>
      <PageHero kicker={contactContent.eyebrow} title={contactContent.title} lead={contactContent.intro} />

      <section className={styles.body} aria-label="Contact">
        <div className={`s-container ${styles.grid}`}>
          <div className={styles.formCard} data-contact-card data-reveal>
            <ContactForm copy={contactContent.form} />
          </div>

          <aside className={styles.aside} data-theme="ink" data-contact-aside data-reveal>
            <p className="s-kicker" data-aside-part>
              Direct line
            </p>
            <Mail className={styles.mail} aria-hidden="true" data-aside-part />
            <h2 className={styles.asideTitle} data-aside-part>
              {contactContent.asideTitle}
            </h2>
            <a href={`mailto:${contactContent.email}`} className={styles.email} data-aside-part>
              <span>{contactContent.email}</span>
              <ArrowUpRight aria-hidden="true" />
            </a>
            <p className={styles.asideBody} data-aside-part>
              {contactContent.asideBody}
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
