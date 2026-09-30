"use client";

import { useRef } from "react";
import type { ScrollTriggerStatic } from "@/components/site/motion/gsap";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import styles from "@/components/site/home/ThreadLine.module.css";

type V = [number, number];
type Node = { x: number; y: number; tin: V; tout: V };
type Placed = {
  name: string;
  x: number;
  y: number;
  /** Touch height at the start of the anchor's pin (equals `y` when unpinned). */
  rest: number;
  /** Height after the anchor's pin has released. */
  release: number;
  pinned: boolean;
  /** Horizontal extent of the anchor's box, and of its parent box. */
  x0: number;
  x1: number;
  p0: number;
  p1: number;
};
type Tier = "desktop" | "tablet" | "mobile";
type ST = InstanceType<ScrollTriggerStatic> & { spacer?: HTMLElement };
type Kit = {
  tier: Tier;
  width: number;
  reach: number;
  holdX: number;
  gutter: (side: "L" | "R") => number;
  side: "L" | "R";
};
type Spec = {
  /** Which resting state of the section the anchor is read in. */
  at: "start" | "end";
  side?: "L" | "R";
  build?: (a: Placed, k: Kit) => Node[];
};

const DOWN: V = [0, 1];
const node = (x: number, y: number, tin: V = DOWN, tout: V = DOWN): Node => ({ x, y, tin, tout });

/* The default meeting: the Thread runs down a gutter, swings in to the anchor
   and swings back out. Pinned sections keep it in the gutter while they hold. */
const dart = (a: Placed, k: Kit, tin: V = DOWN, tout: V = DOWN): Node[] => {
  const out: Node[] = [];
  if (a.pinned && a.rest < a.y - k.reach - 1) out.push(node(k.holdX, a.rest));
  out.push(node(k.holdX, a.y - k.reach), node(a.x, a.y, tin, tout), node(k.holdX, a.y + k.reach));
  return out;
};

/* Anchors that sit beside the gutter's content edge: the Thread docks at them
   from the upper left and leaves to the lower left, never along the text. */
const dock = (a: Placed, k: Kit): Node[] => {
  const reach = Math.min(k.reach, 150);
  const out: Node[] = [];
  if (a.pinned && a.rest < a.y - reach - 1) out.push(node(k.holdX, a.rest));
  out.push(node(k.holdX, a.y - reach), node(a.x, a.y, [0.9, 1], [-0.9, 1]), node(k.holdX, a.y + reach));
  return out;
};

const SPECS: Record<string, Spec> = {
  /* The underline's end: the Thread leaves it heading right, then drops into
     the right gutter. */
  hero: {
    at: "start",
    side: "R",
    build: (a, k) => [node(a.x, a.y, DOWN, [1, 0.14]), node(k.gutter("R"), a.y + k.reach * 0.9)],
  },
  /* The record card's left edge: down the gap beside the card. */
  fragments: {
    at: "end",
    side: "R",
    build: (a, k) => {
      if (k.tier !== "desktop" || !a.pinned) return dart(a, { ...k, holdX: k.gutter("L") }, [1, 0.4]);
      const run = 240;
      const out: Node[] = [];
      if (a.rest < a.y - run - k.reach - 1) out.push(node(k.holdX, a.rest));
      out.push(node(k.holdX, a.y - run - k.reach), node(a.x, a.y - run), node(a.x, a.y), node(a.x, a.y + 180));
      return out;
    },
  },
  /* The rail's first dot: docks as the stage arrives, then the rail fills. */
  stage: {
    at: "start",
    side: "L",
    build: dock,
  },
  /* The rule under the typed name: the Thread underlines it and returns. */
  agreements: {
    at: "end",
    build: (a, k) => {
      const d = k.side === "R" ? -1 : 1;
      const r = k.tier === "mobile" ? 14 : 22;
      const near = d === 1 ? a.x0 : a.x1;
      const far = d === 1 ? a.x1 : a.x0;
      const out: Node[] = [];
      if (a.pinned && a.rest < a.y - k.reach - 1) out.push(node(k.holdX, a.rest));
      out.push(
        node(k.holdX, a.y - k.reach),
        node(near - d * 6, a.y, [d, 0.3], [d, 0]),
        node(far + d * r, a.y + r, DOWN, DOWN),
        node(far, a.y + 2 * r, [-d, 0], [-d, 0.1]),
        node(k.holdX, a.y + 2 * r + k.reach * 0.8),
      );
      return out;
    },
  },
  money: { at: "end", side: "L", build: dock },
  portfolio: { at: "end", side: "L" },
  /* The wordmark's left baseline: the Thread runs along it and ends. */
  finale: {
    at: "end",
    side: "L",
    build: (a, k) => [
      node(k.holdX, a.y - k.reach),
      node(a.p0, a.y, [1, 0.35], [1, 0]),
      node(a.p1, a.y, [1, 0], [1, 0]),
    ],
  },
};

const fmt = (n: number) => Math.round(n * 10) / 10;

function buildPath(nodes: Node[]) {
  let d = `M${fmt(nodes[0].x)} ${fmt(nodes[0].y)}`;
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1];
    const b = nodes[i];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.max(0, b.y - a.y);
    const c1x = a.x + a.tout[0] * 0.55 * dx;
    const c1y = a.y + a.tout[1] * 0.55 * dy;
    const c2x = b.x - b.tin[0] * 0.55 * dx;
    const c2y = b.y - b.tin[1] * 0.55 * dy;
    d += ` C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(b.x)} ${fmt(b.y)}`;
  }
  return d;
}

export function ThreadLine() {
  const ref = useRef<HTMLDivElement>(null);

  useSiteMotion(
    ref,
    ({ gsap, ScrollTrigger }, c, root) => {
      const home = root.parentElement;
      const path = root.querySelector<SVGPathElement>("[data-thread-path]");
      const head = root.querySelector<SVGGElement>("[data-thread-head]");
      if (!home || !path || !head) return;

      const tier: Tier = c.desktop ? "desktop" : c.tablet ? "tablet" : "mobile";
      /* Sampled path: `qs` is the scroll-height each length is drawn at. It
         follows the path's own y, except on the closing run along the
         baseline, which is spread over the last stretch of the page. */
      let xs = new Float32Array(0);
      let ys = new Float32Array(0);
      let qs = new Float32Array(0);
      let lens = new Float32Array(0);
      let total = 0;
      let height = 0;
      let mine: ST | undefined;
      const intro = { v: c.reduce ? 1 : 0 };
      const setDraw = gsap.quickSetter(path, "drawSVG") as (v: string) => void;

      const measure = () => {
        const sts = (ScrollTrigger.getAll() as ST[]).filter((st) => st !== mine);
        const anims = Array.from(new Set(sts.map((st) => st.animation).filter((a): a is gsap.core.Animation => !!a && a.duration() > 0)));
        const saved = anims.map((a) => a.progress());
        const scrollY = window.scrollY;
        const box = home.getBoundingClientRect();
        const top0 = box.top + scrollY;
        const anchors = Array.from(home.querySelectorAll<HTMLElement>("[data-thread-anchor]")).filter((a) => a.getClientRects().length > 0);

        const read = (a: HTMLElement) => {
          const r = a.getBoundingClientRect();
          const pr = a.parentElement?.getBoundingClientRect() ?? r;
          const cy = r.top + r.height / 2;
          const base = { x: (r.width > 24 ? r.left : r.left + r.width / 2) - box.left, x0: r.left - box.left, x1: r.right - box.left, p0: pr.left - box.left, p1: pr.right - box.left };
          const st = sts.find((s) => s.pin && s.spacer && s.pin.contains(a));
          if (!st || !st.pin || !st.spacer) {
            const y = cy + scrollY - top0;
            return { ...base, y, rest: y, release: y, pinned: false };
          }
          const pin = st.pin.getBoundingClientRect();
          const spacer = st.spacer.getBoundingClientRect();
          const rest = spacer.top + scrollY - top0 + (cy - pin.top);
          const dist = Math.max(0, st.spacer.offsetHeight - (st.pin as HTMLElement).offsetHeight);
          return { ...base, y: rest + dist, rest, release: rest + dist, pinned: dist > 24 };
        };

        anims.forEach((a) => a.progress(0, true));
        const atStart = anchors.map(read);
        anims.forEach((a) => a.progress(1, true));
        const atEnd = anchors.map(read);
        const sections = Array.from(home.querySelectorAll<HTMLElement>("section"))
          .filter((s) => !s.parentElement?.closest("section"))
          .map((s) => {
            const st = sts.find((t) => t.pin === s && t.spacer);
            return (st?.spacer ?? s).getBoundingClientRect().top + scrollY - top0;
          });
        anims.forEach((a, i) => a.progress(saved[i], true));

        const placed: Placed[] = anchors.map((a, i) => {
          const name = a.dataset.threadAnchor ?? "";
          if (SPECS[name]?.at === "start") {
            const s = atStart[i];
            return { name, ...s, y: s.rest, release: atEnd[i].release, pinned: atEnd[i].pinned };
          }
          return { name, ...atEnd[i] };
        });
        placed.sort((p, q) => p.y - q.y);
        return { placed, sections: sections.sort((p, q) => p - q), width: box.width, height: home.offsetHeight };
      };

      const layout = ({ placed, sections, width }: ReturnType<typeof measure>) => {
        const mobile = tier === "mobile";
        const gutterW = mobile ? 8 : 9;
        const reach = mobile ? 90 : tier === "tablet" ? 140 : 210;
        const half = mobile ? 40 : 70;
        const gutter = (s: "L" | "R") => (s === "L" ? gutterW : width - gutterW);
        const nodes: Node[] = [];

        placed.forEach((a) => {
          const spec = SPECS[a.name] ?? { at: "end" as const };
          const side = mobile ? "L" : (spec.side ?? (a.x < width / 2 ? "L" : "R"));
          const kit: Kit = { tier, width, reach, holdX: gutter(side), gutter, side };
          const own = (spec.build ?? dart)(a, kit) as Node[];
          const last = own[own.length - 1];
          if (a.release > last.y + 1) own.push(node(last.x, a.release));

          const prev = nodes[nodes.length - 1];
          if (prev && Math.abs(prev.x - own[0].x) > 8) {
            const lo = prev.y + half;
            const hi = own[0].y - half;
            let yb = (prev.y + own[0].y) / 2;
            const inside = sections.filter((s) => s >= lo && s <= hi);
            if (inside.length) yb = inside[0];
            const room = Math.max(4, Math.min(half, (own[0].y - prev.y) / 2 - 4));
            nodes.push(node(prev.x, yb - room), node(own[0].x, yb + room));
          }
          nodes.push(...own);
        });

        for (let i = 1; i < nodes.length; i++) if (nodes[i].y < nodes[i - 1].y) nodes[i].y = nodes[i - 1].y;
        return nodes;
      };

      const sample = (closing: { y: number } | null) => {
        total = path.getTotalLength();
        const step = 6;
        const n = Math.ceil(total / step) + 1;
        xs = new Float32Array(n);
        ys = new Float32Array(n);
        qs = new Float32Array(n);
        lens = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const l = Math.min(total, i * step);
          const pt = path.getPointAtLength(l);
          lens[i] = l;
          xs[i] = pt.x;
          ys[i] = pt.y;
          qs[i] = pt.y;
        }
        if (!closing) return;
        let i0 = n - 1;
        while (i0 > 0 && ys[i0 - 1] >= closing.y - 0.5) i0--;
        if (n - i0 < 8) return;
        const span = Math.max(120, window.innerHeight * 0.45);
        for (let i = i0; i < n; i++) qs[i] = ys[i0] + ((i - i0) / (n - 1 - i0)) * span;
      };

      const tipAtQ = (q: number) => {
        const n = qs.length;
        if (!n) return { len: 0, x: 0, y: 0 };
        if (q <= qs[0]) return { len: 0, x: xs[0], y: ys[0] };
        if (q >= qs[n - 1]) return { len: total, x: xs[n - 1], y: ys[n - 1] };
        let lo = 0;
        let hi = n - 1;
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (qs[mid] <= q) lo = mid;
          else hi = mid;
        }
        const t = (q - qs[lo]) / (qs[hi] - qs[lo] || 1);
        return {
          len: lens[lo] + (lens[hi] - lens[lo]) * t,
          x: xs[lo] + (xs[hi] - xs[lo]) * t,
          y: ys[lo] + (ys[hi] - ys[lo]) * t,
        };
      };

      const proxy = { p: 0 };
      const render = () => {
        if (!total) return;
        const vh = window.innerHeight;
        const p = proxy.p;
        const scrolled = mine ? p * Math.max(0, mine.end - mine.start) : 0;
        /* Tall hero underlines sit below 62% of the viewport: the tip always
           starts a little past the first anchor. */
        const lead = ys[0] + 130 * Math.max(0, 1 - scrolled / 260);
        const tipY = Math.max(lead, scrolled + vh * 0.62);
        const tip = tipAtQ(tipY);
        const len = tip.len * intro.v;
        setDraw(`0% ${((len / total) * 100).toFixed(3)}%`);
        const pt = intro.v < 1 ? path.getPointAtLength(len) : tip;
        head.setAttribute("transform", `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
        head.style.opacity = String(Math.min(1, intro.v * 1.5));
      };

      const compute = () => {
        const m = measure();
        if (!m.placed.length) {
          path.setAttribute("d", "");
          total = 0;
          return;
        }
        height = m.height;
        root.style.height = `${height}px`;
        const nodes = layout(m);
        path.setAttribute("d", buildPath(nodes));
        const finale = m.placed.find((a) => a.name === "finale");
        sample(finale ? { y: finale.y } : null);
        if (c.reduce) setDraw("0% 100%");
        else render();
      };

      let timer = 0;
      const schedule = (delay = 140) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(compute, delay);
      };

      compute();
      const observer = new ResizeObserver(() => schedule());
      observer.observe(home);
      const onRefresh = () => schedule(60);
      const onSettled = () => schedule(120);
      ScrollTrigger.addEventListener("refresh", onRefresh);
      document.addEventListener("animationend", onSettled, true);
      window.addEventListener("load", onSettled);
      const settle = [500, 1600, 3200].map((ms) => window.setTimeout(compute, ms));
      let cancelled = false;
      document.fonts?.ready.then(() => {
        if (!cancelled) schedule(200);
      });

      if (c.reduce) {
        head.style.display = "none";
      } else {
        const scrolled = window.scrollY > 120;
        gsap.to(intro, { v: 1, duration: 1.1, delay: scrolled ? 0.1 : 1.5, ease: "power2.out", onUpdate: render });
        const tween = gsap.to(proxy, {
          p: 1,
          ease: "none",
          onUpdate: render,
          /* Runs to the end of the document, so the closing run along the wordmark
             is drawn while the wordmark is on screen. Refreshed after every pinned
             section, whose spacers set the page height. */
          scrollTrigger: { trigger: home, start: "top top", end: () => ScrollTrigger.maxScroll(window), scrub: 0.6, invalidateOnRefresh: true, refreshPriority: -1 },
        });
        mine = tween.scrollTrigger as ST;
      }

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        settle.forEach((t) => window.clearTimeout(t));
        observer.disconnect();
        ScrollTrigger.removeEventListener("refresh", onRefresh);
        document.removeEventListener("animationend", onSettled, true);
        window.removeEventListener("load", onSettled);
        path.setAttribute("d", "");
        head.style.display = "";
      };
    },
    [],
  );

  return (
    <div ref={ref} className={styles.thread} aria-hidden="true">
      <svg className={styles.svg} focusable="false">
        <defs>
          <radialGradient id="thread-halo">
            <stop offset="0" className={styles.haloStop} stopOpacity="0.5" />
            <stop offset="0.45" className={styles.haloStop} stopOpacity="0.18" />
            <stop offset="1" className={styles.haloStop} stopOpacity="0" />
          </radialGradient>
        </defs>
        <path className={styles.line} data-thread-path d="" />
        <g className={styles.head} data-thread-head>
          <circle className={styles.halo} r="16" />
          <circle className={styles.dot} r="4" />
        </g>
      </svg>
    </div>
  );
}
