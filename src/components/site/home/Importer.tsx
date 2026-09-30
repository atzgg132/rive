"use client";

import { useRef } from "react";
import { importer } from "@/content/site/home";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import styles from "./Importer.module.css";

/** Position of `el` inside `root`, from layout offsets only, so transforms
 * applied to the element (or the pinned stage) never skew the measurement. */
function centreIn(el: HTMLElement, root: HTMLElement) {
  let x = el.offsetWidth / 2;
  let y = el.offsetHeight / 2;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

export function Importer() {
  const ref = useRef<HTMLElement>(null);

  useSiteMotion(ref, ({ gsap, ScrollTrigger }, c, scope) => {
    const pin = scope.querySelector<HTMLElement>("[data-importer-pin]");
    const rows = gsap.utils.toArray<HTMLElement>("[data-importer-row]", scope);
    const cards = gsap.utils.toArray<HTMLElement>("[data-importer-record]", scope);
    const chip = scope.querySelector<HTMLElement>("[data-importer-chip]");
    const head = gsap.utils.toArray<HTMLElement>("[data-importer-head] > *", scope);
    const sheet = scope.querySelector<HTMLElement>("[data-importer-sheet]");
    if (!pin || !rows.length || rows.length !== cards.length || !sheet) return;

    if (c.reduce) {
      gsap.fromTo([...head, sheet, ...cards, chip], { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.04, immediateRender: true, clearProps: "opacity", scrollTrigger: { trigger: pin, start: "top 85%", once: true } });
      return;
    }

    gsap.from(head, { y: 36, opacity: 0, duration: 1, stagger: 0.09, immediateRender: true, scrollTrigger: { trigger: head[0], start: "top 88%", once: true } });

    const deltas = rows.map(() => ({ dx: 0, dy: 0 }));
    const measure = () => {
      rows.forEach((row, i) => {
        const from = centreIn(row, pin);
        const to = centreIn(cards[i], pin);
        deltas[i].dx = from.x - to.x;
        deltas[i].dy = from.y - to.y;
      });
    };
    measure();

    const place = (i: number, v: number) => {
      const { dx, dy } = deltas[i];
      const stacked = Math.abs(dy) > Math.abs(dx);
      const arc = (stacked ? 26 : Math.abs(dx) * 0.16 + 24) * (i % 2 ? 1 : -1);
      const bow = Math.sin(Math.PI * v) * arc;
      gsap.set(cards[i], {
        x: dx * (1 - v) + (stacked ? bow : 0),
        y: dy * (1 - v) + (stacked ? 0 : bow),
        rotation: (i % 2 ? 5 : -5) * Math.sin(Math.PI * v) * 1.2,
        scale: 0.86 + 0.14 * v,
        opacity: Math.min(1, v * 7),
        force3D: true,
      });
    };

    /* A viewport too short for the whole stage scrubs without pinning. */
    const fits = pin.offsetHeight <= window.innerHeight;
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: pin,
        start: fits ? "center center" : "top 70%",
        end: fits ? (c.desktop ? "+=100%" : "+=70%") : "bottom 30%",
        pin: fits,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    ScrollTrigger.addEventListener("refreshInit", measure);

    gsap.set(chip, { opacity: 0, y: 10, scale: 0.9 });
    cards.forEach((_, i) => place(i, 0));

    const step = 0.13;
    rows.forEach((row, i) => {
      const t = 0.05 + i * step;
      const proxy = { v: 0 };
      tl.to(row, { y: -7, scale: 1.02, duration: 0.1, ease: "power2.out", backgroundColor: "color-mix(in srgb, var(--s-accent) 14%, var(--s-card))", boxShadow: "0 14px 24px -14px rgb(9 17 31 / 0.4)" }, t);
      tl.to(proxy, { v: 1, duration: 0.5, ease: "power2.inOut", onUpdate: () => place(i, proxy.v) }, t + 0.08);
      tl.to(row, { y: 0, scale: 1, opacity: 0.28, boxShadow: "0 0 0 rgb(0 0 0 / 0)", duration: 0.25, ease: "power2.in" }, t + 0.16);
    });
    const end = 0.05 + (rows.length - 1) * step + 0.58;
    tl.to(chip, { opacity: 1, y: 0, scale: 1, duration: 0.18, ease: "back.out(2)" }, end - 0.1);
    tl.to({}, { duration: 0.12 }, end + 0.08);

    return () => ScrollTrigger.removeEventListener("refreshInit", measure);
  });

  return (
    <section ref={ref} id="import" data-importer className={`s-section ${styles.section}`} aria-labelledby="importer-title">
      <div className="s-container">
        <header className={styles.head} data-importer-head>
          <p className="s-kicker">{importer.kicker}</p>
          <h2 id="importer-title" className={`s-h2 ${styles.title}`}>{importer.title}</h2>
          <p className={`s-lead ${styles.body}`}>{importer.body}</p>
        </header>
      </div>

      <div className={styles.pin} data-importer-pin>
        <div className={`s-container ${styles.stage}`} aria-hidden="true">
          <div className={styles.sheet} data-importer-sheet>
            <div className={styles.bar}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5M9 13h6M9 17h6" />
              </svg>
              <span className={`s-mono ${styles.file}`}>{importer.file}</span>
              <span className={`s-sample-label ${styles.sample}`}>Sample data</span>
            </div>
            <div className={`${styles.grid} ${styles.cols}`}>
              {importer.columns.map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
            <div className={styles.sheetRows}>
              {importer.rows.map((row) => (
                <div key={row[0]} className={`${styles.grid} ${styles.row}`} data-importer-row>
                  <span className={styles.cellStrong}>{row[0]}</span>
                  <span>{row[1]}</span>
                  <span className="s-mono">{row[2]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.records}>
            <div className={styles.chipRow}>
              <span className={styles.chip} data-importer-chip>
                <i aria-hidden="true" />
                Review matches
              </span>
            </div>
            <ul className={styles.list}>
              {importer.rows.map((row) => (
                <li key={row[0]} className={styles.card} data-importer-record>
                  <span className={styles.mark}>{row[0].slice(0, 1)}</span>
                  <span className={styles.who}>
                    <strong>{row[0]}</strong>
                    <span>{row[1]}</span>
                  </span>
                  <span className={`s-mono ${styles.amount}`}>{row[2]}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
