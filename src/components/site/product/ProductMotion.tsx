"use client";

import { useRef, type ReactNode } from "react";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";

/* Scroll choreography for the product page template. The page is rendered on
   the server as plain, fully readable HTML; this wrapper finds the pieces by
   data attribute and animates them. Nothing is pinned: every visual enters
   and leaves with depth (y, scale, rotateY), its inner content drifts, and
   consecutive chapters hand over as one leaves while the next arrives. */

const BLEED_POINTS = 56;

const wave = (x: number) => Math.sin(x) * 0.5 + 0.5;

/* Slow, low-frequency noise that drifts with scroll progress, so the seam
   between two bands reads as ink pooling and creeping rather than a zig-zag. */
function bleedFinger(i: number, progress: number, seed: number) {
  const n =
    wave(i * 0.15 + seed + progress * 2.4) * 0.56 +
    wave(i * 0.36 + seed * 2.1 + 1.7 - progress * 3.2) * 0.3 +
    wave(i * 0.8 + seed * 0.7 + progress * 4.4) * 0.14;
  return Math.min(1, Math.max(0, (n - 0.12) / 0.7));
}

/* The layer overhangs the band by `overhang` px. At progress 0 its top edge is
   straight along the seam; as progress grows, fingers reach up into the band
   above. `total` is band height + overhang. */
function bleedPolygon(progress: number, seed: number, overhang: number, total: number) {
  const pts: string[] = [];
  for (let i = 0; i <= BLEED_POINTS; i++) {
    const y = (overhang * (1 - progress * bleedFinger(i, progress, seed))) / total;
    pts.push(`${((i / BLEED_POINTS) * 100).toFixed(2)}% ${(y * 100).toFixed(3)}%`);
  }
  return `polygon(${pts.join(", ")}, 100% 100%, 0% 100%)`;
}

/** Bottom padding of whatever sits directly above a band, in px. */
function paddingAbove(band: HTMLElement) {
  let el: Element | null = band.previousElementSibling;
  while (el && !el.hasAttribute("data-band") && el.lastElementChild) el = el.lastElementChild;
  return el ? parseFloat(getComputedStyle(el).paddingBottom) || 0 : 0;
}

export function ProductMotion({ className, sectionIds, children }: { className?: string; sectionIds: string[]; children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useSiteMotion(
    rootRef,
    ({ gsap, ScrollTrigger, SplitText }, c, scope) => {
      const all = <T extends Element = HTMLElement>(sel: string, root: ParentNode = scope) => Array.from(root.querySelectorAll<T>(sel));
      const one = <T extends Element = HTMLElement>(sel: string, root: ParentNode = scope) => root.querySelector<T>(sel);
      const splits: { revert: () => void }[] = [];
      const bleeds = all("[data-bleed]");

      /* ── Sub-bar: active section and paper/ink tone (state, not motion) ── */
      const bar = one("[data-subbar]");
      const list = one("[data-sub-list]");
      const links = all<HTMLAnchorElement>("[data-sub-link]");
      const setActive = (id: string | null) => {
        links.forEach((link) => {
          const on = link.dataset.subLink === id;
          if (on) {
            link.setAttribute("data-active", "");
            link.setAttribute("aria-current", "location");
          } else {
            link.removeAttribute("data-active");
            link.removeAttribute("aria-current");
          }
        });
        const active = links.find((l) => l.dataset.subLink === id);
        if (active && list && list.scrollWidth > list.clientWidth) {
          const target = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
          list.scrollTo({ left: Math.max(0, target), behavior: c.reduce ? "auto" : "smooth" });
        }
      };
      sectionIds.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        ScrollTrigger.create({
          trigger: el,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => {
            if (self.isActive) setActive(id);
          },
          onLeaveBack: () => {
            if (i === 0) setActive(null);
          },
        });
      });
      all("[data-band]").forEach((band) => {
        if (band.dataset.theme !== "ink" || !bar) return;
        ScrollTrigger.create({
          trigger: band,
          start: "top 60px",
          end: "bottom 60px",
          onEnter: () => bar.setAttribute("data-tone", "ink"),
          onEnterBack: () => bar.setAttribute("data-tone", "ink"),
          onLeave: () => bar.setAttribute("data-tone", "paper"),
          onLeaveBack: () => bar.setAttribute("data-tone", "paper"),
        });
      });

      let cancelled = false;
      document.fonts?.ready.then(() => {
        if (!cancelled) ScrollTrigger.refresh();
      });

      /* ── Reduced motion: everything is already visible; fade in only ── */
      if (c.reduce) {
        all("[data-reveal]").forEach((el) => {
          gsap.from(el, { opacity: 0, duration: 0.4, ease: "none", scrollTrigger: { trigger: el, start: "top 94%", once: true } });
        });
        return () => {
          cancelled = true;
          setActive(null);
        };
      }

      const T = c.desktop
        ? { heroRot: 18, heroScale: 0.86, heroY: 90, enterY: 130, enterScale: 0.86, rotY: 16, rotX: 6, exitY: -90, exitScale: 0.93, exitRotY: 9, par: 7 }
        : c.tablet
          ? { heroRot: 13, heroScale: 0.9, heroY: 60, enterY: 90, enterScale: 0.9, rotY: 0, rotX: 10, exitY: -50, exitScale: 0.95, exitRotY: 0, par: 5 }
          : { heroRot: 10, heroScale: 0.93, heroY: 36, enterY: 60, enterScale: 0.93, rotY: 0, rotX: 8, exitY: -30, exitScale: 0.97, exitRotY: 0, par: 4 };

      /* ── Hero visual: tilts up out of the page and settles flat ── */
      const heroStage = one("[data-hero-stage]");
      const heroFrame = one("[data-hero-frame]");
      const heroGlow = one("[data-hero-glow]");
      if (heroStage && heroFrame) {
        gsap.fromTo(
          heroFrame,
          { rotateX: T.heroRot, scale: T.heroScale, y: T.heroY, transformPerspective: 1500, transformOrigin: "50% 100%", force3D: true },
          {
            rotateX: 0,
            scale: 1,
            y: 0,
            ease: "none",
            scrollTrigger: { trigger: heroStage, start: "top 96%", end: "top 30%", scrub: 0.9, invalidateOnRefresh: true },
          },
        );
        if (heroGlow) {
          gsap.fromTo(heroGlow, { opacity: 0.25, scale: 0.85 }, { opacity: 1, scale: 1, ease: "none", scrollTrigger: { trigger: heroStage, start: "top 96%", end: "top 20%", scrub: 0.9 } });
        }
        const par = one("[data-par]", heroFrame);
        if (par) driftInner(par, heroStage, T.par);
      }

      function driftInner(par: HTMLElement, trigger: HTMLElement, amount: number) {
        const scroll = par.dataset.par === "scroll";
        const scrollTrigger = { trigger, start: "top bottom", end: "bottom top", scrub: 1 };
        if (scroll) {
          gsap.fromTo(par, { yPercent: 0 }, { yPercent: -(amount * 3.2), ease: "none", scrollTrigger });
        } else {
          gsap.fromTo(par, { scale: 1 + amount / 100, yPercent: amount * 0.6 }, { scale: 1, yPercent: -amount * 0.6, ease: "none", scrollTrigger });
        }
      }

      /* ── Thread: the single blue line through the chapters ── */
      const chapters = one("[data-chapters]");
      const thread = one("[data-thread]");
      if (chapters && thread) {
        gsap.fromTo(thread, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: chapters, start: "top 70%", end: "bottom 70%", scrub: 0.6 } });
      }

      /* ── Ink bleed between bands ── */
      bleeds.forEach((bleed, i) => {
        const band = bleed.parentElement as HTMLElement;
        const seed = i * 3.7 + 1;
        const state = { p: 0 };
        let overhang = 0;
        let total = 1;
        const measure = () => {
          overhang = Math.max(24, Math.min(c.mobile ? 64 : 120, paddingAbove(band) - 10));
          total = band.offsetHeight + overhang;
          bleed.style.top = `${-overhang}px`;
        };
        const apply = () => {
          bleed.style.clipPath = bleedPolygon(state.p, seed, overhang, total);
        };
        measure();
        apply();
        gsap.to(state, {
          p: 1,
          ease: "none",
          onUpdate: apply,
          scrollTrigger: {
            trigger: band,
            start: "top 98%",
            end: c.mobile ? "top 50%" : "top 38%",
            scrub: 0.8,
            onRefresh: () => {
              measure();
              apply();
            },
          },
        });
      });

      /* ── Chapters ── */
      all("[data-chapter]").forEach((chapter) => {
        const kicker = one("[data-kicker]", chapter);
        const h2 = one("[data-h2]", chapter);
        const body = one("[data-body]", chapter);
        const stage = one("[data-vis-stage]", chapter);
        const frame = one("[data-vis-frame]", chapter);
        const glow = one("[data-vis-glow]", chapter);
        const side = frame?.dataset.side === "left" ? -1 : 1;
        const startAt = "top 86%";

        if (kicker) gsap.from(kicker, { opacity: 0, y: 16, duration: 0.8, scrollTrigger: { trigger: kicker, start: startAt, once: true } });
        if (h2) splitLines(h2, startAt);
        if (body) gsap.from(body, { opacity: 0, y: 26, duration: 1, delay: 0.15, scrollTrigger: { trigger: body, start: "top 90%", once: true } });

        if (stage && frame) {
          gsap.fromTo(
            frame,
            { y: T.enterY, scale: T.enterScale, rotateY: side * -T.rotY, rotateX: T.rotX, opacity: 0.001, transformPerspective: 1600, transformOrigin: side > 0 ? "0% 50%" : "100% 50%", force3D: true },
            {
              y: 0,
              scale: 1,
              rotateY: 0,
              rotateX: 0,
              opacity: 1,
              ease: "none",
              scrollTrigger: { trigger: stage, start: "top 96%", end: "top 48%", scrub: 0.8, invalidateOnRefresh: true },
            },
          );
          gsap.to(stage, {
            y: T.exitY,
            scale: T.exitScale,
            rotateY: side * T.exitRotY,
            transformPerspective: 1600,
            ease: "none",
            scrollTrigger: { trigger: stage, start: "bottom 58%", end: "bottom -5%", scrub: 0.8, invalidateOnRefresh: true },
          });
          const par = one("[data-par]", frame);
          if (par) driftInner(par, stage, T.par);
          if (glow) gsap.fromTo(glow, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, ease: "none", scrollTrigger: { trigger: stage, start: "top 96%", end: "top 40%", scrub: 0.8 } });
        }
      });

      /* ── Import illustration: rows flow into review cards, then approve ── */
      all("[data-import]").forEach((root) => {
        const trigger = { trigger: root, start: c.mobile ? "top 88%" : "top 80%", end: c.mobile ? "bottom 40%" : "bottom 52%", scrub: 1, invalidateOnRefresh: true };
        if (root.dataset.import === "upload") {
          const files = all("[data-file]", root);
          const fills = all("[data-file-fill]", root);
          const tl = gsap.timeline({ scrollTrigger: trigger, defaults: { ease: "none" } });
          tl.from(files, { y: 26, opacity: 0, stagger: 0.16, duration: 0.5 }, 0);
          tl.from(fills, { scaleX: 0, stagger: 0.18, duration: 0.6 }, 0.35);
          return;
        }
        const rows = all("[data-row]", root);
        const cards = all("[data-rcard]", root);
        const packets = all("[data-packet]", root);
        const conns = all("[data-conn]", root);
        const checks = all("[data-check]", root);
        const approve = one("[data-approve]", root);
        const grid = one("[data-grid]", root) as HTMLElement;
        const center = (el: HTMLElement) => {
          const g = grid.getBoundingClientRect();
          const r = el.getBoundingClientRect();
          return { x: r.left - g.left + r.width / 2, y: r.top - g.top + r.height / 2, left: r.left - g.left, right: r.right - g.left };
        };
        const tl = gsap.timeline({ scrollTrigger: trigger, defaults: { ease: "none" } });
        tl.from(rows, { x: -22, opacity: 0, stagger: 0.08, duration: 0.3 }, 0);
        tl.from(cards, { opacity: 0, scale: 0.9, y: 14, stagger: 0.1, duration: 0.3 }, 0.5);
        tl.from(conns[0], { "--p": 0, duration: 0.25 }, 0.25);
        tl.from(conns[1], { "--p": 0, duration: 0.25 }, 0.7);
        packets.forEach((packet, i) => {
          const row = rows[i];
          const card = cards[i];
          if (!row || !card) return;
          tl.fromTo(
            packet,
            { x: () => center(row).x, y: () => center(row).y, opacity: 0, scale: 0.7 },
            { x: () => center(card).x, y: () => center(card).y, opacity: 1, scale: 1, duration: 0.42, immediateRender: false },
            0.18 + i * 0.1,
          );
          tl.to(packet, { opacity: 0, scale: 0.4, duration: 0.14 }, 0.6 + i * 0.1);
        });
        tl.from(checks, { opacity: 0, x: -14, stagger: 0.1, duration: 0.25 }, 0.82);
        if (approve) tl.from(approve, { opacity: 0, y: 12, scale: 0.94, duration: 0.25 }, 1.15);
      });

      /* ── What's included ── */
      const incList = one("[data-inc-list]");
      if (incList) {
        const items = all("[data-inc-item]", incList);
        gsap.from(items, { opacity: 0, y: 28, duration: 0.9, stagger: 0.09, scrollTrigger: { trigger: incList, start: "top 84%", once: true } });
        gsap.from(all("[data-tick-path]", incList), { drawSVG: "0%", duration: 0.6, stagger: 0.09, delay: 0.25, ease: "power2.out", scrollTrigger: { trigger: incList, start: "top 84%", once: true } });
      }
      const notYet = all("[data-notyet]");
      if (notYet.length) {
        gsap.from(notYet, { opacity: 0, y: 24, duration: 0.9, stagger: 0.12, scrollTrigger: { trigger: notYet[0], start: "top 88%", once: true } });
      }

      /* ── Next product ── */
      const nextLabel = one("[data-next-label]");
      const next = one("[data-next]");
      if (nextLabel && next) {
        gsap.fromTo(nextLabel, { xPercent: c.mobile ? -3 : -6 }, { xPercent: 0, ease: "none", scrollTrigger: { trigger: next, start: "top 95%", end: "top 45%", scrub: 0.8 } });
      }

      /* ── Closing band ── */
      const ctaGlow = one("[data-cta-glow]");
      if (ctaGlow) {
        gsap.fromTo(ctaGlow, { opacity: 0.2, yPercent: 20 }, { opacity: 1, yPercent: 0, ease: "none", scrollTrigger: { trigger: ctaGlow.parentElement, start: "top 90%", end: "bottom bottom", scrub: 0.8 } });
      }
      const ctaActions = one("[data-cta-actions]");
      if (ctaActions) gsap.from(ctaActions, { opacity: 0, y: 24, duration: 0.9, delay: 0.25, scrollTrigger: { trigger: ctaActions, start: "top 92%", once: true } });

      function splitLines(el: HTMLElement, start: string) {
        const split = SplitText.create(el, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, { yPercent: 112, duration: 1.15, stagger: 0.1, ease: "power4.out", scrollTrigger: { trigger: el, start, once: true } }),
        });
        splits.push(split);
      }
      all("[data-h2]").forEach((h2) => {
        if (!h2.closest("[data-chapter]")) splitLines(h2, "top 88%");
      });

      return () => {
        cancelled = true;
        splits.forEach((s) => s.revert());
        bleeds.forEach((b) => {
          b.style.clipPath = "";
          b.style.top = "";
        });
        setActive(null);
        bar?.setAttribute("data-tone", "paper");
      };
    },
    [sectionIds.join("|")],
  );

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
