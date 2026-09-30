"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { RiveLogo } from "@/components/RiveLogo";
import { StartFree } from "@/components/site/StartFree";
import { loadGsap } from "@/components/site/motion/gsap";
import { NavPreview } from "@/components/site/shell/NavPreview";
import { siteHeaderLinks, siteLogin, siteProductLinks } from "@/content/site/nav";
import styles from "./SiteNav.module.css";

const MENU_ATTR = "data-site-menu";
const DESKTOP_QUERY = "(min-width: 900px)";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
const FOCUSABLE = "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])";
const HIDE_AFTER = 200;

const mobileMoreLinks = [
  ...siteHeaderLinks,
  { label: "About", href: "/about" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Contact", href: "/contact" },
];

function reducedMotion() {
  return window.matchMedia(REDUCE_QUERY).matches;
}

function isVisible(el: HTMLElement) {
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
}

export function SiteNav() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const productRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openedBy = useRef<"hover" | "click">("click");
  const hoverTimer = useRef<number>(0);

  const [productOpen, setProductOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tone, setTone] = useState<"paper" | "ink">("paper");

  const closeProduct = useCallback((returnFocus = false) => {
    window.clearTimeout(hoverTimer.current);
    setProductOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  const openMobile = useCallback(() => {
    closeProduct();
    setSheetMounted(true);
    setMobileOpen(true);
  }, [closeProduct]);

  const closeMobile = useCallback((returnFocus = false) => {
    setMobileOpen(false);
    if (returnFocus) menuButtonRef.current?.focus();
  }, []);

  /* Scroll: hairline, hide on scroll down / show on scroll up, and the ink
     variant while the bar sits over a `data-theme="ink"` section. */
  useEffect(() => {
    let frame = 0;
    let lastY = window.scrollY;
    let down = 0;
    let up = 0;

    const measure = () => {
      frame = 0;
      const header = headerRef.current;
      if (!header) return;
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      lastY = y;
      if (delta > 0) {
        down += delta;
        up = 0;
      } else if (delta < 0) {
        up -= delta;
        down = 0;
      }
      setScrolled(y > 12);
      if (y < HIDE_AFTER || reducedMotion() || header.querySelector(":focus-visible")) setHidden(false);
      else if (down > 8) setHidden(true);
      else if (up > 8) setHidden(false);

      const line = header.getBoundingClientRect().height / 2;
      let ink = false;
      document.querySelectorAll<HTMLElement>('[data-theme="ink"]').forEach((section) => {
        if (ink || header.contains(section)) return;
        const rect = section.getBoundingClientRect();
        if (rect.top <= line && rect.bottom > line) ink = true;
      });
      setTone(ink ? "ink" : "paper");
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    schedule();
    const settle = [120, 700].map((ms) => window.setTimeout(schedule, ms));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      settle.forEach(window.clearTimeout);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [pathname]);

  /* A route change closes everything. */
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setProductOpen(false);
    setMobileOpen(false);
  }

  /* Product panel: clip reveal, staggered items, scrim. */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    let cancelled = false;
    loadGsap()
      .then(({ gsap }) => {
        if (cancelled) return;
        const items = panel.querySelectorAll("[data-nav-item]");
        gsap.killTweensOf([panel, items]);
        const reduce = reducedMotion();
        if (productOpen) {
          gsap.set(panel, { visibility: "visible" });
          if (reduce) {
            gsap.set(items, { clearProps: "all" });
            gsap.fromTo(panel, { clipPath: "inset(0% 0% 0% 0%)", opacity: 0 }, { opacity: 1, duration: 0.2 });
            return;
          }
          gsap.fromTo(
            panel,
            { clipPath: "inset(0% 0% 100% 0%)", opacity: 1 },
            { clipPath: "inset(0% 0% 0% 0%)", duration: 0.6, ease: "power4.out" },
          );
          gsap.fromTo(
            items,
            { y: 18, autoAlpha: 0 },
            { y: 0, autoAlpha: 1, duration: 0.65, stagger: 0.06, delay: 0.1, ease: "power3.out", force3D: true },
          );
        } else {
          gsap.to(panel, {
            clipPath: reduce ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
            opacity: reduce ? 0 : 1,
            duration: reduce ? 0.15 : 0.32,
            ease: "power3.in",
            onComplete: () => {
              gsap.set(panel, { visibility: "hidden", clipPath: "inset(0% 0% 100% 0%)", opacity: 1 });
            },
          });
        }
      })
      .catch(() => {
        panel.style.visibility = productOpen ? "visible" : "hidden";
        panel.style.clipPath = "none";
      });
    return () => {
      cancelled = true;
    };
  }, [productOpen]);

  /* Product panel: Escape, outside click. */
  useEffect(() => {
    if (!productOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const active = document.activeElement;
      const inside = !active || active === document.body || productRef.current?.contains(active);
      closeProduct(Boolean(inside));
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!productRef.current?.contains(event.target as Node)) closeProduct();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [productOpen, closeProduct]);

  /* Mobile sheet: clip reveal, masked link stagger, bottom actions. */
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    let cancelled = false;
    const showStatic = () => {
      sheet.style.clipPath = mobileOpen ? "none" : "inset(0% 0% 100% 0%)";
      if (!mobileOpen) setSheetMounted(false);
    };
    loadGsap()
      .then(({ gsap }) => {
        if (cancelled) return;
        const masks = sheet.querySelectorAll("[data-m]");
        const fades = sheet.querySelectorAll("[data-f]");
        gsap.killTweensOf([sheet, masks, fades]);
        const reduce = reducedMotion();
        if (mobileOpen) {
          if (reduce) {
            gsap.set([masks, fades], { clearProps: "all" });
            gsap.fromTo(sheet, { clipPath: "inset(0% 0% 0% 0%)", opacity: 0 }, { opacity: 1, duration: 0.25 });
            return;
          }
          gsap.set(sheet, { opacity: 1 });
          gsap.set(masks, { yPercent: 115 });
          gsap.set(fades, { autoAlpha: 0, y: 16 });
          gsap
            .timeline({ defaults: { force3D: true } })
            .fromTo(
              sheet,
              { clipPath: "inset(0% 0% 100% 0%)" },
              { clipPath: "inset(0% 0% 0% 0%)", duration: 0.7, ease: "power4.inOut" },
            )
            .to(masks, { yPercent: 0, duration: 0.85, ease: "power4.out", stagger: 0.04 }, 0.3)
            .to(fades, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.05 }, 0.42);
        } else {
          gsap.to(sheet, {
            clipPath: reduce ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
            opacity: reduce ? 0 : 1,
            duration: reduce ? 0.18 : 0.45,
            ease: "power3.inOut",
            onComplete: () => setSheetMounted(false),
          });
        }
      })
      .catch(showStatic);
    return () => {
      cancelled = true;
    };
  }, [mobileOpen]);

  /* Mobile sheet: scroll lock, inert page, Escape, Tab trap, breakpoint. */
  useEffect(() => {
    if (!mobileOpen) return;
    const root = document.documentElement;
    const header = headerRef.current;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    root.setAttribute(MENU_ATTR, "open");

    const inerted: Element[] = [];
    Array.from(header?.parentElement?.children ?? []).forEach((el) => {
      if (el === header || el === sheetRef.current || el.tagName === "SCRIPT" || el.hasAttribute("inert")) return;
      el.setAttribute("inert", "");
      inerted.push(el);
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobile(true);
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = [
        ...(header?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
        ...(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
      ].filter(isVisible);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !nodes.includes(active as HTMLElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !nodes.includes(active as HTMLElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const media = window.matchMedia(DESKTOP_QUERY);
    const onMedia = () => {
      if (media.matches) closeMobile();
    };
    document.addEventListener("keydown", onKey);
    media.addEventListener("change", onMedia);
    return () => {
      root.style.overflow = previousOverflow;
      root.removeAttribute(MENU_ATTR);
      inerted.forEach((el) => el.removeAttribute("inert"));
      document.removeEventListener("keydown", onKey);
      media.removeEventListener("change", onMedia);
    };
  }, [mobileOpen, closeMobile]);

  const onTriggerClick = () => {
    if (productOpen && openedBy.current === "hover") {
      openedBy.current = "click";
      return;
    }
    openedBy.current = "click";
    if (productOpen) closeProduct();
    else setProductOpen(true);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    openedBy.current = "click";
    setProductOpen(true);
    window.requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("a")?.focus());
  };

  const onProductEnter = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(hoverTimer.current);
    if (!productOpen) {
      openedBy.current = "hover";
      setProductOpen(true);
    }
  };

  const onProductLeave = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse" || openedBy.current !== "hover") return;
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => closeProduct(), 140);
  };

  const onProductBlur = (event: FocusEvent<HTMLLIElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && !event.currentTarget.contains(next)) closeProduct();
  };

  const barOpaque = productOpen || mobileOpen;

  return (
    <>
      <header
        ref={headerRef}
        className={styles.header}
        data-testid="site-header"
        data-tone={mobileOpen ? "paper" : tone}
        data-scrolled={scrolled && !mobileOpen ? "" : undefined}
        data-hidden={hidden && !barOpaque ? "" : undefined}
        data-solid={barOpaque ? "" : undefined}
        data-menu={mobileOpen ? "open" : undefined}
        onFocusCapture={() => setHidden(false)}
      >
        <div className={styles.bar}>
          <Link href="/" className={styles.logo} aria-label="Rive home" onClick={() => closeMobile()}>
            <RiveLogo height={22} />
          </Link>

          <nav className={styles.nav} aria-label="Primary">
            <ul className={styles.navList}>
              <li
                ref={productRef}
                className={styles.productItem}
                onPointerEnter={onProductEnter}
                onPointerLeave={onProductLeave}
                onBlur={onProductBlur}
              >
                <button
                  ref={triggerRef}
                  type="button"
                  className={styles.link}
                  aria-expanded={productOpen}
                  aria-controls="site-product-menu"
                  onClick={onTriggerClick}
                  onKeyDown={onTriggerKeyDown}
                >
                  <span>Product</span>
                  <ChevronDown className={styles.chevron} aria-hidden="true" />
                </button>
                <div
                  ref={panelRef}
                  id="site-product-menu"
                  className={styles.panel}
                  role="group"
                  aria-label="Product"
                  inert={!productOpen}
                >
                  <ul className={styles.panelInner}>
                    {siteProductLinks.map((item) => (
                      <li key={item.href} data-nav-item>
                        <Link href={item.href} className={styles.item} onClick={() => closeProduct()}>
                          <NavPreview kind={item.preview} active={productOpen} />
                          <span className={styles.itemLabel}>
                            {item.label}
                            <ArrowUpRight aria-hidden="true" />
                          </span>
                          <span className={styles.itemDesc}>{item.description}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
              {siteHeaderLinks.map((item) => (
                <li key={item.href} className={styles.navItem}>
                  <Link href={item.href} className={styles.link} aria-current={pathname === item.href ? "page" : undefined}>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.actions}>
            <Link href={siteLogin.href} className={`${styles.link} ${styles.login}`}>
              <span>{siteLogin.label}</span>
            </Link>
            <StartFree placement="nav" className={styles.cta} />
            <button
              ref={menuButtonRef}
              type="button"
              className={styles.menuButton}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="site-mobile-menu"
              onClick={() => (mobileOpen ? closeMobile() : openMobile())}
            >
              <span className={styles.menuIcon} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className={styles.scrim} data-open={productOpen ? "" : undefined} aria-hidden="true" />

      {sheetMounted ? (
        <div ref={sheetRef} id="site-mobile-menu" className={styles.sheet}>
          <nav className={styles.sheetInner} aria-label="Mobile">
            <p className={styles.sheetKicker} data-f>
              Product
            </p>
            <ul className={styles.sheetProducts}>
              {siteProductLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={styles.sheetProduct} onClick={() => closeMobile()}>
                    <span className={styles.mask}>
                      <span className={styles.maskInner} data-m>
                        {item.label}
                      </span>
                    </span>
                    <span className={styles.sheetDesc} data-f>
                      {item.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <hr className={styles.sheetRule} data-f />
            <ul className={styles.sheetMore}>
              {mobileMoreLinks.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={styles.sheetLink} onClick={() => closeMobile()}>
                    <span className={styles.mask}>
                      <span className={styles.maskInner} data-m>
                        {item.label}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.sheetFoot} data-f>
            <Link href={siteLogin.href} className={`s-btn s-btn--ghost ${styles.sheetLogin}`} onClick={() => closeMobile()}>
              {siteLogin.label}
            </Link>
            <StartFree placement="nav_mobile" size="lg" className={styles.sheetCta} />
          </div>
        </div>
      ) : null}
    </>
  );
}
