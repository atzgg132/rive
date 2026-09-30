"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDown,
  CalendarDays,
  FileText,
  Mail,
  MessageCircle,
  Receipt,
  StickyNote,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import { fragments } from "@/content/site/home";
import styles from "./Fragments.module.css";

type Kind = (typeof fragments.items)[number]["kind"];

/** Where each tool lands in the scattered field. `fx`/`fy` run from -1 to 1
 * across the area a card can occupy without leaving the field; `depth`
 * (0 far, 1 near) sets scale, layering and how fast it drifts. */
type Scatter = { fx: number; fy: number; depth: number; rot: number };
type Layout = "wide" | "narrow";

const SCATTER: Record<Layout, Record<Kind, Scatter>> = {
  wide: {
    Inbox: { fx: -0.82, fy: -0.8, depth: 0.55, rot: -7 },
    "Scope doc": { fx: 0.05, fy: -0.95, depth: 0.05, rot: 5 },
    Spreadsheet: { fx: 0.92, fy: -0.55, depth: 0.85, rot: 6 },
    Notes: { fx: -0.3, fy: -0.05, depth: 1, rot: -3 },
    "Invoice PDF": { fx: 0.62, fy: 0.2, depth: 0.25, rot: 8 },
    Calendar: { fx: -0.85, fy: 0.75, depth: 0.7, rot: 4 },
    Chat: { fx: 0.2, fy: 0.95, depth: 0.42, rot: -6 },
  },
  narrow: {
    Inbox: { fx: -0.85, fy: -0.92, depth: 0.5, rot: -6 },
    "Scope doc": { fx: 0.85, fy: -0.7, depth: 0.05, rot: 6 },
    Spreadsheet: { fx: -0.25, fy: -0.36, depth: 0.85, rot: 4 },
    Notes: { fx: 0.85, fy: -0.02, depth: 1, rot: -5 },
    "Invoice PDF": { fx: -0.9, fy: 0.3, depth: 0.25, rot: 7 },
    Calendar: { fx: 0.3, fy: 0.55, depth: 0.7, rot: -4 },
    Chat: { fx: -0.5, fy: 0.95, depth: 0.42, rot: 5 },
  },
};

/** Static tilts for the reduced-motion / pre-script grid. */
const TILT: Record<Kind, string> = {
  Inbox: "-1.4deg",
  "Scope doc": "1deg",
  Spreadsheet: "-0.6deg",
  "Invoice PDF": "1.6deg",
  Calendar: "-1.2deg",
  Notes: "-2.4deg",
  Chat: "1.1deg",
};

function Art({ kind }: { kind: Kind }): ReactNode {
  switch (kind) {
    case "Inbox":
      return (
        <div className={styles.inbox}>
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className={styles.inboxRow}
              data-unread={row === 0 ? "" : undefined}
            >
              <span className={styles.dot} data-tone={row} />
              <span
                className={styles.bar}
                style={{ width: ["78%", "58%", "68%"][row] }}
              />
            </div>
          ))}
        </div>
      );
    case "Scope doc":
      return (
        <div className={styles.doc}>
          <span className={styles.docHead} />
          <span className={styles.bar} style={{ width: "100%" }} />
          <span className={styles.bar} style={{ width: "92%" }} />
          <span className={styles.bar} style={{ width: "97%" }} />
          <span className={styles.bar} style={{ width: "60%" }} />
        </div>
      );
    case "Spreadsheet":
      return (
        <div className={styles.sheet}>
          {Array.from({ length: 20 }, (_, i) => (
            <span
              key={i}
              className={styles.cell}
              data-head={i < 5 ? "" : undefined}
              data-hot={i === 12 ? "" : undefined}
            />
          ))}
        </div>
      );
    case "Invoice PDF":
      return (
        <div className={styles.invoice}>
          <span className={styles.pdf}>PDF</span>
          <span className={styles.bar} style={{ width: "46%" }} />
          <span className={styles.bar} style={{ width: "70%" }} />
          <span className={styles.total}>
            <span className={styles.bar} style={{ width: "34%" }} />
            <span className={styles.totalBar} />
          </span>
        </div>
      );
    case "Calendar":
      return (
        <div className={styles.day}>
          <span className={styles.dayHead}>Thu</span>
          <span className={styles.dayGrid}>
            <span className={styles.event} />
          </span>
        </div>
      );
    case "Notes":
      return (
        <div className={styles.scribble}>
          <span className={styles.bar} style={{ width: "86%" }} />
          <span className={styles.bar} style={{ width: "52%" }} />
        </div>
      );
    case "Chat":
      return (
        <div className={styles.chat}>
          <span className={styles.dot} data-tone={1} />
          <span className={styles.typing}>
            <i />
            <i />
            <i />
          </span>
        </div>
      );
  }
}

const ICON: Record<Kind, LucideIcon> = {
  Inbox: Mail,
  "Scope doc": FileText,
  Spreadsheet: Table2,
  "Invoice PDF": Receipt,
  Calendar: CalendarDays,
  Notes: StickyNote,
  Chat: MessageCircle,
};

const CARD_CLASS: Record<Kind, string> = {
  Inbox: styles.kInbox,
  "Scope doc": styles.kDoc,
  Spreadsheet: styles.kSheet,
  "Invoice PDF": styles.kInvoice,
  Calendar: styles.kCalendar,
  Notes: styles.kNotes,
  Chat: styles.kChat,
};

export function Fragments() {
  const rootRef = useRef<HTMLElement>(null);

  useSiteMotion(
    rootRef,
    ({ gsap, SplitText }, c, scope) => {
      const $ = <T extends Element = HTMLElement>(sel: string) =>
        gsap.utils.toArray<T>(sel, scope);
      const one = <T extends Element = HTMLElement>(sel: string) =>
        scope.querySelector<T>(sel)!;

      const kicker = one("[data-fx='kicker']");
      const title = one("[data-fx='title']");
      const lead = one("[data-fx='lead']");
      const field = one("[data-fx='field']");
      const items = $("[data-fx='item']");
      const faces = $("[data-fx='card']");
      const record = one("[data-fx='record']");
      const rows = $("[data-fx='row']");
      const chip = one("[data-fx='chip']");
      const caption = one("[data-fx='caption']");
      const ring = one("[data-fx='ring']");
      const anchor = one("[data-fx='anchor']");
      const bridge = one("[data-fx='bridge']");

      // Not enough height to hold the whole stage in view (e.g. 200% zoom on a
      // laptop): behave like reduced motion so nothing is ever cut off.
      const cramped = window.innerHeight < 500;

      if (c.reduce || cramped) {
        const fade = (
          targets: Element | Element[],
          trigger: Element,
          stagger = 0,
        ) =>
          gsap.fromTo(
            targets,
            { opacity: 0 },
            {
              opacity: 1,
              duration: 0.4,
              stagger,
              ease: "none",
              scrollTrigger: { trigger, start: "top 88%", once: true },
            },
          );
        fade([kicker, title, lead], kicker, 0.08);
        fade(items, items[0], 0.05);
        fade([bridge, record], bridge);
        return;
      }

      scope.setAttribute("data-fragments-stage", "on");
      const layout: Layout = c.desktop ? "wide" : c.tablet ? "wide" : "narrow";
      const scatter = SCATTER[layout];
      const kinds = fragments.items.map((f) => f.kind);
      const pinVh = c.desktop ? 1.8 : c.tablet ? 1.4 : 1.2;
      const driftX = c.desktop ? 18 : c.tablet ? 14 : 7;
      const liftFar = c.desktop ? 22 : c.tablet ? 16 : 8;
      const liftNear = c.desktop ? 92 : c.tablet ? 64 : 30;
      const scaleOf = (depth: number) => 0.72 + 0.43 * depth;

      // Free space each card may roam: the field minus half its own footprint.
      const reach = (i: number, axis: "x" | "y") => {
        const el = items[i];
        const s = scaleOf(scatter[kinds[i]].depth);
        const half = axis === "x" ? el.offsetWidth : el.offsetHeight;
        const total = axis === "x" ? field.clientWidth : field.clientHeight;
        return Math.max(0, total / 2 - (half * s) / 2 - 2);
      };
      const startX = (i: number) => scatter[kinds[i]].fx * reach(i, "x");
      const startY = (i: number) => scatter[kinds[i]].fy * reach(i, "y");
      const driftedX = (i: number) => startX(i) + scatter[kinds[i]].fx * driftX;
      const driftedY = (i: number) => {
        const d = scatter[kinds[i]].depth;
        return startY(i) - (liftFar + (liftNear - liftFar) * d);
      };
      // Cards keep a small fan in the stack so it reads as many sheets, not one.
      const fan = (i: number) => i - (items.length - 1) / 2;

      // ── Entrances (played once as the section scrolls into view) ──────────
      const enter = { trigger: scope, start: "top 72%", once: true } as const;
      gsap.from([kicker, lead], {
        opacity: 0,
        y: 18,
        duration: 0.9,
        stagger: 0.12,
        scrollTrigger: enter,
      });
      const split = SplitText.create(title, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.lines, {
            yPercent: 112,
            duration: 1.05,
            stagger: 0.12,
            ease: "power4.out",
            immediateRender: true,
            scrollTrigger: enter,
          }),
      });
      gsap.from(faces, {
        opacity: 0,
        y: c.mobile ? 36 : 64,
        scale: 0.86,
        duration: 1.05,
        stagger: { each: 0.08, from: "random" },
        ease: "power3.out",
        immediateRender: true,
        scrollTrigger: enter,
      });

      // ── The pinned choreography ───────────────────────────────────────────
      gsap.set([...items, record], { xPercent: -50, yPercent: -50 });
      // The record shrinks to fit when the stage is short, never the other way.
      const fit = () =>
        Math.min(
          1,
          field.clientHeight / record.offsetHeight,
          field.clientWidth / record.offsetWidth,
        );
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: scope,
          start: "top top",
          end: () => "+=" + Math.round(window.innerHeight * pinVh),
          pin: true,
          anticipatePin: 1,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });

      // Phase 1: chaos. Cards start scattered at different depths and drift
      // apart, near ones faster than far ones.
      tl.fromTo(
        items,
        {
          x: startX,
          y: startY,
          scale: (i) => scaleOf(scatter[kinds[i]].depth),
          rotation: (i) => scatter[kinds[i]].rot,
          opacity: 1,
          transformOrigin: "50% 50%",
        },
        {
          x: driftedX,
          y: driftedY,
          scale: (i) =>
            scaleOf(scatter[kinds[i]].depth) *
            (1 + 0.05 * scatter[kinds[i]].depth),
          rotation: (i) => scatter[kinds[i]].rot * 1.35,
          duration: 2.2,
        },
        0,
      );

      // Phase 2: everything is pulled to one point and stacks up.
      tl.to(
        items,
        {
          x: (i) => fan(i) * 3,
          y: (i) => fan(i) * -4,
          scale: 0.6,
          rotation: (i) => fan(i) * 1.1,
          duration: 2.4,
          ease: "power3.inOut",
          stagger: { each: 0.14, from: "start" },
        },
        2.2,
      );
      tl.to(
        items,
        {
          opacity: 0,
          duration: 1.3,
          ease: "power1.in",
          stagger: { each: 0.09, from: "end" },
        },
        4.6,
      );

      // Phase 3: the client record assembles out of the stack.
      tl.fromTo(
        record,
        { scale: 0.42, opacity: 0, y: 10 },
        { scale: fit, opacity: 1, y: 0, duration: 2.5, ease: "power3.out" },
        5.2,
      );
      tl.fromTo(
        rows,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.7, ease: "power2.out", stagger: 0.28 },
        6.6,
      );
      tl.fromTo(
        chip,
        { scale: 0.4, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.55, ease: "back.out(2.6)" },
        6.3,
      );
      tl.fromTo(
        anchor,
        { scale: 0 },
        { scale: 1, duration: 0.5, ease: "back.out(3)" },
        7.4,
      );
      tl.fromTo(
        caption,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
        8,
      );
      tl.fromTo(
        ring,
        { opacity: 0, scale: 0.97 },
        { opacity: 0.75, scale: 1, duration: 0.5, ease: "power2.out" },
        8.1,
      );
      tl.to(
        ring,
        { opacity: 0, scale: 1.045, duration: 0.9, ease: "power1.out" },
        8.6,
      );
      tl.to({}, { duration: 1.2 }, 9);

      return () => {
        split.revert();
        scope.removeAttribute("data-fragments-stage");
      };
    },
    [],
  );

  const record = fragments.record;

  return (
    <section
      ref={rootRef}
      className={styles.root}
      data-fragments
      aria-labelledby="fragments-title"
    >
      <div className={`${styles.inner} s-container`}>
        <header className={styles.head}>
          <p className="s-kicker" data-fx="kicker" data-reveal>
            {fragments.kicker}
          </p>
          <h2
            id="fragments-title"
            className={`s-h2 ${styles.title}`}
            data-fx="title"
            data-reveal
          >
            {fragments.title}
          </h2>
          <p className={`s-lead ${styles.lead}`} data-fx="lead" data-reveal>
            {fragments.body}
          </p>
        </header>

        <div className={styles.field} data-fx="field">
          <ul className={styles.cards} role="list">
            {fragments.items.map((item) => {
              const Icon = ICON[item.kind];
              return (
                <li
                  key={item.kind}
                  className={`${styles.item} ${CARD_CLASS[item.kind]}`}
                  style={
                    {
                      "--tilt": TILT[item.kind],
                      "--z": Math.round(SCATTER.wide[item.kind].depth * 10),
                      "--depth": SCATTER.wide[item.kind].depth,
                    } as CSSProperties
                  }
                  data-fx="item"
                >
                  <div className={styles.card} data-fx="card" data-reveal>
                    <span className={styles.kind}>
                      <Icon aria-hidden="true" />
                      {item.kind}
                    </span>
                    <div className={styles.art} aria-hidden="true">
                      <Art kind={item.kind} />
                    </div>
                    <p className={styles.itemTitle}>{item.title}</p>
                    <p className={styles.meta}>{item.meta}</p>
                    <span className={styles.veil} aria-hidden="true" />
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            className={styles.bridge}
            data-fx="bridge"
            aria-hidden="true"
            data-reveal
          >
            <span className={styles.bridgeLine} />
            <span className={styles.bridgeArrow}>
              <ArrowDown strokeWidth={1.75} />
            </span>
            <span className={styles.bridgeLine} />
          </div>

          <article
            className={styles.record}
            data-fx="record"
            aria-labelledby="fragments-record-name"
            data-reveal
          >
            <span className={styles.ring} data-fx="ring" aria-hidden="true" />
            <span
              className={styles.anchor}
              data-fx="anchor"
              data-thread-anchor="fragments"
              aria-hidden="true"
            />
            <div className={styles.recordFace} data-fx="record-face">
              <div className={styles.recordTop}>
                <span className="s-kicker">{record.kicker}</span>
                <span className={styles.chip} data-fx="chip">
                  {record.tag}
                </span>
              </div>
              <h3 id="fragments-record-name" className={styles.recordName}>
                {record.name}
              </h3>
              <p className={`s-mono ${styles.domain}`}>{record.domain}</p>
              <dl className={styles.rows}>
                {record.rows.map((row) => (
                  <div key={row.label} className={styles.row} data-fx="row">
                    <dt>{row.label}</dt>
                    <dd className="s-mono">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className={styles.caption} data-fx="caption">
                {record.caption}
              </p>
              <span className={`s-sample-label ${styles.sample}`}>
                {fragments.record.sampleLabel}
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
