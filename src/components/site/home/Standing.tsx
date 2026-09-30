"use client";

import { useRef } from "react";
import { standing } from "@/content/site/home";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import { ResponsiveWorkspacePreview } from "@/components/marketing/ResponsiveWorkspacePreview";
import styles from "./Standing.module.css";

/* Each callout names an area of the dashboard by the labels the preview
   itself prints. The preview reflows with its width (and drops cards below
   the fold on narrow layouts), so targets are found in the DOM and the first
   one that is inside the frame wins. Words only: no new figures. */
const CALLOUTS = [
  { key: "due", label: "What's due", targets: ["Overdue", "Next 14 days"], side: (compact: boolean) => (compact ? "top" : "bottom") },
  { key: "agreed", label: "What's agreed", targets: ["Active projects"], side: () => "top" },
  { key: "outstanding", label: "What's outstanding", targets: ["Cash collected"], side: () => "bottom" },
] as const;

type Rect = { x: number; y: number; w: number; h: number };

/** Layout-space rect of `el` inside `root`, from offsets only, so the frame's
 * scale and tilt never skew it. */
function rectIn(el: HTMLElement, root: HTMLElement): Rect {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight };
}

function findLabel(root: HTMLElement, label: string) {
  const all = root.querySelectorAll<HTMLElement>("*");
  for (const el of all) {
    let own = "";
    for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) own += node.textContent ?? "";
    if (own.trim() === label) return el;
  }
  return null;
}

/** The card a label sits in: climb until the parent stops looking like a card. */
function cardOf(el: HTMLElement, frameW: number, frameH: number) {
  let node = el;
  for (let i = 0; i < 6; i++) {
    const parent = node.parentElement;
    if (!parent) break;
    if (parent.offsetWidth > frameW * 0.45 || parent.offsetHeight > frameH * 0.3) break;
    node = parent;
  }
  return node;
}

export function Standing() {
  const ref = useRef<HTMLElement>(null);

  useSiteMotion(ref, ({ gsap, ScrollTrigger }, c, scope) => {
    const head = gsap.utils.toArray<HTMLElement>("[data-standing-head] > *", scope);
    const pin = scope.querySelector<HTMLElement>("[data-standing-pin]");
    const slot = scope.querySelector<HTMLElement>("[data-standing-slot]");
    const frame = scope.querySelector<HTMLElement>("[data-standing-frame]");
    const overlay = scope.querySelector<HTMLElement>("[data-standing-overlay]");
    const svg = scope.querySelector<SVGSVGElement>("[data-standing-lines]");
    const chips = gsap.utils.toArray<HTMLElement>("[data-standing-chip]", scope);
    const lines = gsap.utils.toArray<SVGLineElement>("[data-standing-line]", scope);
    const dots = gsap.utils.toArray<HTMLElement>("[data-standing-dot]", scope);
    if (!pin || !slot || !frame || !overlay || !svg) return;

    /* Places every chip, dot and leader line from the preview's live layout. */
    const layout = () => {
      const W = frame.offsetWidth;
      const H = frame.offsetHeight;
      if (!W || !H) return;
      const compact = W < 768;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      const placed = CALLOUTS.map((callout, i) => {
        let rect: Rect | null = null;
        for (const target of callout.targets) {
          const el = findLabel(frame, target);
          if (!el) continue;
          const card = rectIn(cardOf(el, W, H), frame);
          if (card.y + Math.min(card.h, 24) < H - 4) {
            rect = card;
            break;
          }
        }
        /* A callout only points at a card that says what the label says; if
           that card is below the fold of a compact layout, the callout sits out. */
        const hide = rect ? "" : "hidden";
        chips[i].style.visibility = hide;
        dots[i].style.visibility = hide;
        lines[i].style.visibility = hide;
        const anchor = rect ?? { x: W * 0.5, y: H * 0.4, w: 0, h: 0 };
        const upper = anchor.y + anchor.h / 2 < H * 0.42;
        const side = callout.key === "due" && upper ? "top" : callout.side(compact);
        const tx = Math.min(W - 14, Math.max(14, anchor.x + Math.min(anchor.w, 220) / 2));
        const ty = side === "top" ? anchor.y : Math.min(H - 10, anchor.y + anchor.h);
        return { i, side, tx, ty, width: chips[i].offsetWidth, cx: tx };
      });
      for (const side of ["top", "bottom"] as const) {
        const row = placed.filter((p) => p.side === side).sort((a, b) => a.tx - b.tx);
        const gap = 10;
        let edge = -6;
        for (const p of row) {
          p.cx = Math.max(p.tx, edge + p.width / 2);
          edge = p.cx + p.width / 2 + gap;
        }
        let limit = W + 6;
        for (const p of [...row].reverse()) {
          p.cx = Math.min(p.cx, limit - p.width / 2);
          limit = p.cx - p.width / 2 - gap;
        }
      }
      for (const p of placed) {
        const cy = p.side === "top" ? -26 : H + 26;
        gsap.set(chips[p.i], { left: p.cx, top: cy });
        gsap.set(dots[p.i], { left: p.tx, top: p.ty });
        lines[p.i].setAttribute("x1", String(p.cx));
        lines[p.i].setAttribute("y1", String(cy));
        lines[p.i].setAttribute("x2", String(p.tx));
        lines[p.i].setAttribute("y2", String(p.ty));
      }
      overlay.setAttribute("data-placed", "");
    };

    layout();
    const watch = new ResizeObserver(layout);
    watch.observe(frame);
    const mutations = new MutationObserver(() => requestAnimationFrame(layout));
    mutations.observe(frame, { childList: true, subtree: true });
    document.fonts?.ready.then(layout);
    ScrollTrigger.addEventListener("refreshInit", layout);
    const stop = () => {
      watch.disconnect();
      mutations.disconnect();
      ScrollTrigger.removeEventListener("refreshInit", layout);
      overlay.removeAttribute("data-placed");
    };

    if (c.reduce) {
      gsap.fromTo([...head, frame, ...chips, ...dots], { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.04, immediateRender: true, clearProps: "opacity", scrollTrigger: { trigger: pin, start: "top 85%", once: true } });
      return stop;
    }

    gsap.from(head, { y: 36, opacity: 0, duration: 1, stagger: 0.09, immediateRender: true, scrollTrigger: { trigger: head[0], start: "top 88%", once: true } });

    gsap.set(frame, { transformPerspective: 1600, transformOrigin: "50% 55%", force3D: true });
    gsap.set(chips, { opacity: 0, scale: 0.9 });
    gsap.set(lines, { drawSVG: "0%" });
    gsap.set(dots, { opacity: 0, scale: 0 });

    /* A viewport too short for the whole frame scrubs without pinning. */
    const fits = pin.offsetHeight <= window.innerHeight;
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: pin,
        start: fits ? "center center" : "top 75%",
        end: fits ? (c.desktop ? "+=110%" : "+=85%") : "top 15%",
        pin: fits,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    tl.fromTo(
      frame,
      { scale: c.mobile ? 0.62 : 0.5, rotationX: c.mobile ? 22 : 28, rotationZ: c.mobile ? -3 : -4, y: c.mobile ? 30 : 60, borderRadius: 40 },
      { scale: 1, rotationX: 0, rotationZ: 0, y: 0, borderRadius: 24, duration: 0.5, ease: "power2.inOut" },
      0,
    );
    chips.forEach((chip, i) => {
      const at = 0.5 + i * 0.13;
      tl.to(chip, { opacity: 1, scale: 1, duration: 0.1, ease: "back.out(1.8)" }, at);
      tl.to(lines[i], { drawSVG: "100%", duration: 0.12, ease: "power2.out" }, at + 0.05);
      tl.to(dots[i], { opacity: 1, scale: 1, duration: 0.06, ease: "back.out(3)" }, at + 0.15);
    });
    tl.to({}, { duration: 0.12 });

    return stop;
  });

  return (
    <section ref={ref} id="standing" data-standing className={`s-section ${styles.section}`} aria-labelledby="standing-title">
      <div className="s-container">
        <header className={styles.head} data-standing-head>
          <p className="s-kicker">{standing.kicker}</p>
          <h2 id="standing-title" className={`s-h2 ${styles.title}`}>{standing.title}</h2>
          <p className={`s-lead ${styles.body}`}>{standing.body}</p>
        </header>
      </div>

      <div className={styles.pin} data-standing-pin>
        <div className={styles.slot} data-standing-slot>
          <div className={styles.frame} data-standing-frame>
            <ResponsiveWorkspacePreview view="dashboard" />
          </div>
          <div className={styles.overlay} data-standing-overlay aria-hidden="true">
            <svg className={styles.lines} data-standing-lines preserveAspectRatio="none" focusable="false">
              {CALLOUTS.map((callout) => (
                <line key={callout.key} className={styles.line} data-standing-line />
              ))}
            </svg>
            {CALLOUTS.map((callout) => (
              <span key={callout.key} className={styles.dot} data-standing-dot />
            ))}
            {CALLOUTS.map((callout) => (
              <span key={callout.key} className={styles.chip} data-standing-chip>
                {callout.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
