"use client";

import Link from "next/link";
import { useRef } from "react";
import { RiveLogo } from "@/components/RiveLogo";
import { StartFree } from "@/components/site/StartFree";
import { useSiteMotion } from "@/components/site/motion/useSiteMotion";
import { setMotionPaused, useMotionPaused } from "@/components/site/motion/pause";
import { siteFooterCopy, siteFooterGroups, siteLogin } from "@/content/site/nav";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  const footerRef = useRef<HTMLElement>(null);
  const paused = useMotionPaused();

  useSiteMotion(footerRef, ({ gsap }, c, scope) => {
    const mark = scope.querySelector<HTMLElement>("[data-footer-mark]");
    const inner = scope.querySelector<HTMLElement>("[data-footer-mark-inner]");
    const cols = scope.querySelectorAll<HTMLElement>("[data-footer-col]");
    if (!mark || !inner) return;

    if (c.reduce) {
      gsap.fromTo(mark, { opacity: 0 }, { opacity: 1, duration: 0.4, scrollTrigger: { trigger: mark, start: "top 95%", once: true } });
      return;
    }

    gsap.fromTo(
      inner,
      { yPercent: c.mobile ? 62 : 48 },
      {
        yPercent: 0,
        ease: "none",
        force3D: true,
        scrollTrigger: {
          trigger: mark,
          start: () => `top bottom+=${c.mobile ? 160 : 260}`,
          end: "bottom bottom+=2",
          scrub: 0.9,
          invalidateOnRefresh: true,
        },
      },
    );
    gsap.from(cols, {
      y: 28,
      opacity: 0,
      duration: 0.9,
      stagger: 0.07,
      immediateRender: true,
      ease: "power3.out",
      scrollTrigger: { trigger: scope.querySelector("[data-footer-groups]"), start: "top 92%", once: true },
    });
  }, []);

  return (
    <footer ref={footerRef} className={styles.footer} data-theme="ink" data-site-footer>
      <div className={styles.wrap}>
        <p className={styles.statement}>{siteFooterCopy.line}</p>

        <nav className={styles.groups} aria-label="Footer" data-footer-groups>
          {siteFooterGroups.map((group) => (
            <div key={group.label} className={styles.group} data-footer-col>
              <p className={styles.groupTitle} id={`footer-${group.label.toLowerCase()}`}>
                {group.label}
              </p>
              <ul className={styles.list} aria-labelledby={`footer-${group.label.toLowerCase()}`}>
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={styles.link}>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className={styles.group} data-footer-col>
            <p className={styles.groupTitle} id="footer-account">
              Account
            </p>
            <ul className={styles.list} aria-labelledby="footer-account">
              <li>
                <Link href={siteLogin.href} className={styles.link}>
                  <span>{siteLogin.label}</span>
                </Link>
              </li>
              <li className={styles.signup}>
                <StartFree placement="footer" />
              </li>
            </ul>
          </div>
        </nav>

        <div className={styles.bar}>
          <p className={styles.status}>{siteFooterCopy.status}</p>
          <p className={styles.copy}>
            © {new Date().getFullYear()} {siteFooterCopy.copyright}
          </p>
          <button
            type="button"
            className={styles.pause}
            aria-pressed={paused}
            onClick={() => setMotionPaused(!paused)}
          >
            <span className={styles.pauseSwitch} aria-hidden="true" />
            Pause motion
          </button>
        </div>
      </div>

      <div className={styles.mark} data-footer-mark aria-hidden="true">
        <div className={styles.markInner} data-footer-mark-inner>
          <RiveLogo height={100} className={styles.logo} />
        </div>
      </div>
    </footer>
  );
}
