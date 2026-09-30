"use client";

import { useLayoutEffect, useRef } from "react";
import { Check } from "lucide-react";
import { AcceptanceDocument } from "@/components/marketing/AcceptanceDocument";
import css from "@/components/site/home/chapters/ChapterAgreements.module.css";

/** The authored width of the acceptance page inside the phone. The page is
 * laid out at this width and scaled to the screen, so its type and spacing
 * keep the proportions of a real phone viewport at any phone size. */
const DOC_WIDTH = 360;

/** A CSS device showing the client's acceptance page. The page, the typed-name
 * overlay and the stamp carry data attributes the chapter's timeline drives. */
export function PhoneAcceptance() {
  const screenRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const screen = screenRef.current;
    if (!screen) return;
    const apply = () => screen.style.setProperty("--doc-scale", String(screen.clientWidth / DOC_WIDTH));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(screen);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={css.phone} data-phone>
      <span className={css.button} aria-hidden="true" />
      <div className={css.screen} ref={screenRef} data-screen>
        <div className={css.statusBar} aria-hidden="true">
          <span className={css.island} />
        </div>
        <div className={css.viewport}>
          <div className={css.scaler} style={{ width: DOC_WIDTH }} data-scaler>
            <div className={css.scroll} data-doc-scroll>
              <div className={css.doc}>
                <AcceptanceDocument />
              </div>
              <div className={css.typed} data-typed aria-hidden="true">
                <span className={css.typedText} data-typed-text />
                <span className={css.caret} data-typed-caret />
                <i className={css.rule} data-thread-anchor="agreements" />
              </div>
            </div>
          </div>
        </div>
        <div className={css.stamp} data-stamp aria-hidden="true">
          <span className={css.stampIcon}>
            <Check strokeWidth={3} />
          </span>
          <span className={css.stampBody}>
            <strong>Accepted</strong>
            <span className="s-mono">v1 · 9f2c…e1d0 · Sep 02, 14:32</span>
          </span>
        </div>
      </div>
    </div>
  );
}
