"use client";

import Link from "next/link";
import { useRef, type CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import { ClosingBand } from "@/components/site/pages/ClosingBand";
import { PageHero } from "@/components/site/pages/PageHero";
import { fadeOnly, inkBleed, splitHeadings } from "@/components/site/pages/pageMotion";
import { founders, type MarketingCard, type MarketingPageContent, type MarketingSection } from "@/content/marketing/pages";
import styles from "./ContentPage.module.css";

type Kind = "about" | "changelog" | "roadmap";

const ROADMAP_STATES = ["available", "working", "exploring"] as const;

function Tick({ state = "available" }: { state?: (typeof ROADMAP_STATES)[number] }) {
  return (
    <svg className={styles.tick} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle
        cx="10"
        cy="10"
        r="9.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray={state === "exploring" ? "2.6 2.6" : undefined}
        opacity={state === "exploring" ? 0.7 : 0.45}
      />
      {state === "available" ? (
        <path d="M6 10.4l2.8 2.8L14.2 7.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {state === "working" ? <path d="M10 5.2a4.8 4.8 0 0 1 0 9.6z" fill="currentColor" /> : null}
    </svg>
  );
}

function Card({ card }: { card: MarketingCard }) {
  const founder = founders.find((f) => f.name === card.title);
  const inner = (
    <>
      {founder ? (
        <span className={styles.avatar} aria-hidden="true">
          {founder.initials}
        </span>
      ) : null}
      {card.meta ? <p className={styles.cardMeta}>{card.meta}</p> : null}
      <h3 className={styles.cardTitle}>
        {card.href ? (
          <Link href={card.href} className={styles.cardLink}>
            {card.title}
            <ArrowUpRight aria-hidden="true" />
          </Link>
        ) : (
          card.title
        )}
      </h3>
      <p className={styles.cardBody}>{card.body}</p>
    </>
  );
  return (
    <article className={`${styles.card} ${founder ? styles.founder : ""} ${card.href ? styles.cardHasLink : ""}`} data-card data-reveal>
      {inner}
    </article>
  );
}

function Bullets({ items, state }: { items: readonly string[]; state?: (typeof ROADMAP_STATES)[number] }) {
  return (
    <ul className={styles.bullets}>
      {items.map((item) => (
        <li key={item} data-bullet data-reveal>
          <Tick state={state} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Block({ section, wideCards }: { section: MarketingSection; wideCards: boolean }) {
  const statement = section.body && !section.cards?.length && !section.bullets?.length;
  return (
    <div className={`${styles.block} ${wideCards ? styles.blockWide : ""}`}>
      <header className={styles.blockHead}>
        {section.eyebrow ? (
          <p className="s-kicker" data-fade data-reveal>
            {section.eyebrow}
          </p>
        ) : null}
        <h2 className={styles.h2} data-split data-reveal>
          {section.title}
        </h2>
      </header>
      <div className={styles.blockBody}>
        {section.body ? (
          <p className={statement ? styles.statement : styles.bodyText} data-fade data-reveal>
            {section.body}
          </p>
        ) : null}
        {section.cards?.length ? (
          <div className={`${styles.cards} ${wideCards ? styles.cardsWide : ""}`}>
            {section.cards.map((card) => (
              <Card key={card.title} card={card} />
            ))}
          </div>
        ) : null}
        {section.bullets?.length ? <Bullets items={section.bullets} /> : null}
      </div>
    </div>
  );
}

function isTeam(section: MarketingSection) {
  return !!section.cards?.length && section.cards.every((card) => founders.some((f) => f.name === card.title));
}

function Editorial({ content, kind }: { content: MarketingPageContent; kind: Kind }) {
  return (
    <>
      {content.sections.map((section, index) => {
        const team = kind === "about" && isTeam(section);
        const ink = team;
        return (
          <section
            key={section.title}
            className={`${styles.section} ${ink ? styles.inkSection : ""}`}
            data-theme={ink ? "ink" : undefined}
            data-ink={ink ? "" : undefined}
            aria-label={section.title}
            style={{ "--i": index } as CSSProperties}
          >
            <div className="s-container">
              <Block section={section} wideCards={team} />
            </div>
          </section>
        );
      })}
    </>
  );
}

function Timeline({ content }: { content: MarketingPageContent }) {
  return (
    <div className={`s-container ${styles.timelineWrap}`}>
      <div className={styles.timeline} data-timeline>
        <span className={styles.spine} aria-hidden="true">
          <span className={styles.spineFill} data-spine-fill />
        </span>
        {content.sections.map((section) => (
          <section key={section.title} className={styles.entry} data-entry aria-label={section.title}>
            <span className={styles.dot} data-dot aria-hidden="true" />
            <Block section={section} wideCards={false} />
          </section>
        ))}
      </div>
    </div>
  );
}

function Board({ content }: { content: MarketingPageContent }) {
  return (
    <section className={styles.boardSection} aria-label="Roadmap">
      <div className="s-container">
        <div className={styles.board} data-board>
          <span className={styles.rail} aria-hidden="true">
            <span className={styles.railFill} data-rail-fill />
          </span>
          {content.sections.map((section, index) => {
            const state = ROADMAP_STATES[index] ?? "exploring";
            return (
              <section key={section.title} className={styles.col} data-state={state} data-col aria-labelledby={`road-${index}`}>
                <span className={styles.node} data-node aria-hidden="true" />
                {section.eyebrow ? (
                  <p className="s-kicker" data-fade data-reveal>
                    {section.eyebrow}
                  </p>
                ) : null}
                <h2 id={`road-${index}`} className={styles.colTitle} data-split data-reveal>
                  {section.title}
                </h2>
                {section.bullets?.length ? <Bullets items={section.bullets} state={state} /> : null}
                {section.body ? (
                  <p className="s-note" data-fade data-reveal>
                    {section.body}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SiteContentPage({ content, kind }: { content: MarketingPageContent; kind: Kind }) {
  const ref = useRef<HTMLDivElement>(null);

  useSiteMotion(
    ref,
    (kit, c, scope) => {
      const { gsap, ScrollTrigger } = kit;
      const fades = "[data-fade], [data-card], [data-bullet], [data-split]";

      if (c.reduce) {
        fadeOnly(kit, scope, fades);
        return;
      }

      const cleanups: Array<() => void> = [];
      cleanups.push(splitHeadings(kit, scope));

      gsap.utils.toArray<HTMLElement>("[data-fade]", scope).forEach((el) => {
        gsap.from(el, { y: 22, opacity: 0, duration: 0.9, immediateRender: true, scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      });

      /* Cards rise out of depth, row by row. */
      const cards = gsap.utils.toArray<HTMLElement>("[data-card]", scope);
      if (cards.length) {
        gsap.set(cards, {
          opacity: 0,
          y: c.mobile ? 36 : 60,
          rotationX: c.mobile ? 0 : -9,
          scale: 0.965,
          transformPerspective: 900,
          transformOrigin: "50% 100%",
        });
        ScrollTrigger.batch(cards, {
          start: "top 90%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { opacity: 1, y: 0, rotationX: 0, scale: 1, duration: 1.1, stagger: 0.09, ease: "power3.out", overwrite: true, force3D: true }),
        });
      }

      const bullets = gsap.utils.toArray<HTMLElement>("[data-bullet]", scope);
      if (bullets.length) {
        gsap.set(bullets, { opacity: 0, x: c.mobile ? -12 : -24 });
        ScrollTrigger.batch(bullets, {
          start: "top 92%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, x: 0, duration: 0.85, stagger: 0.08, ease: "power3.out", overwrite: true }),
        });
      }

      gsap.utils.toArray<HTMLElement>("[data-ink]", scope).forEach((el) => cleanups.push(inkBleed(kit, el, c)));

      const thread = scope.querySelector<SVGPathElement>("[data-thread]");
      const closing = scope.querySelector<HTMLElement>("[data-closing]");
      if (thread && closing) {
        gsap.fromTo(
          thread,
          { drawSVG: "0% 0%" },
          { drawSVG: "0% 100%", ease: "none", scrollTrigger: { trigger: closing, start: "top 70%", end: "bottom 85%", scrub: 0.9 } },
        );
      }

      /* Changelog: the spine draws as you read; each entry's dot pops as the
         spine reaches it. */
      const timeline = scope.querySelector<HTMLElement>("[data-timeline]");
      const fill = scope.querySelector<HTMLElement>("[data-spine-fill]");
      if (timeline && fill) {
        gsap.fromTo(
          fill,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            transformOrigin: "50% 0%",
            force3D: true,
            scrollTrigger: { trigger: timeline, start: "top 62%", end: "bottom 62%", scrub: 0.8, invalidateOnRefresh: true },
          },
        );
        gsap.utils.toArray<HTMLElement>("[data-entry]", scope).forEach((entry) => {
          const dot = entry.querySelector<HTMLElement>("[data-dot]");
          if (!dot) return;
          gsap.fromTo(
            dot,
            { scale: 0 },
            { scale: 1, duration: 0.7, ease: "back.out(3)", immediateRender: true, scrollTrigger: { trigger: entry, start: "top 66%", toggleActions: "play none none reverse" } },
          );
        });
      }

      /* Roadmap: a connector draws across the three columns (down the page on
         narrow screens) and each stage's node lands as the line reaches it. */
      const board = scope.querySelector<HTMLElement>("[data-board]");
      const railFill = scope.querySelector<HTMLElement>("[data-rail-fill]");
      if (board && railFill) {
        const nodes = gsap.utils.toArray<HTMLElement>("[data-node]", board);
        const horizontal = c.desktop;
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: board,
            start: horizontal ? "top 78%" : "top 70%",
            end: horizontal ? "top 28%" : "bottom 62%",
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        });
        tl.fromTo(
          railFill,
          horizontal ? { scaleX: 0 } : { scaleY: 0 },
          { ...(horizontal ? { scaleX: 1, transformOrigin: "0% 50%" } : { scaleY: 1, transformOrigin: "50% 0%" }), force3D: true },
          0,
        );
        nodes.forEach((node, i) => {
          tl.fromTo(node, { scale: 0 }, { scale: 1, duration: 0.14, ease: "back.out(3)" }, nodes.length > 1 ? (i / (nodes.length - 1)) * 0.86 : 0);
        });
      }

      const onLoad = () => ScrollTrigger.refresh();
      let cancelled = false;
      document.fonts?.ready.then(() => {
        if (!cancelled) onLoad();
      });

      return () => {
        cancelled = true;
        cleanups.forEach((fn) => fn());
      };
    },
    [kind],
  );

  const cta = content.cta;
  return (
    <div ref={ref} className={styles.page} data-kind={kind}>
      <PageHero kicker={content.eyebrow} title={content.title} lead={content.intro} />
      {kind === "changelog" ? <Timeline content={content} /> : kind === "roadmap" ? <Board content={content} /> : <Editorial content={content} kind={kind} />}
      {cta ? <ClosingBand cta={cta} /> : null}
    </div>
  );
}
