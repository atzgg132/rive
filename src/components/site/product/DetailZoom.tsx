"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import styles from "./DetailZoom.module.css";

/** A close-up of a real product view: the children render at their normal
 * size, then are scaled up inside a clipped frame so the card that contains
 * `target` fills it, with a highlight ring around that card. Nothing here
 * changes the copy; it only reframes the same component. */
export function DetailZoom({ target, children }: { target: string; children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const inner = innerRef.current;
    const ring = ringRef.current;
    if (!frame || !inner || !ring) return;

    const measure = () => {
      const label = Array.from(inner.querySelectorAll<HTMLElement>("*")).find((el) => el.children.length === 0 && el.textContent?.trim() === target);
      const card = label?.closest<HTMLElement>(".wp-cards > *") ?? label?.parentElement?.parentElement?.parentElement;
      if (!card) return;
      const fw = frame.clientWidth;
      const fh = frame.clientHeight;
      const ir = inner.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      const s0 = scaleRef.current;
      const x = (cr.left - ir.left) / s0;
      const y = (cr.top - ir.top) / s0;
      const w = cr.width / s0;
      const h = cr.height / s0;
      const k = Math.max(1.25, Math.min((fw * 0.78) / w, (fh * 0.7) / h, 3.2));
      const tx = Math.min(0, Math.max(fw - fw * k, fw / 2 - (x + w / 2) * k));
      const ty = Math.min(0, Math.max(fh - inner.offsetHeight * k, fh * 0.46 - (y + h / 2) * k));
      scaleRef.current = k;
      inner.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
      const pad = 10;
      ring.style.cssText = `left:${tx + x * k - pad}px;top:${ty + y * k - pad}px;width:${w * k + pad * 2}px;height:${h * k + pad * 2}px;opacity:1`;
    };

    measure();
    const observer = new ResizeObserver(() => {
      scaleRef.current = 1;
      inner.style.transform = "none";
      measure();
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={frameRef} className={styles.frame}>
      <div ref={innerRef} className={styles.inner}>
        {children}
      </div>
      <div ref={ringRef} className={styles.ring} aria-hidden="true" />
    </div>
  );
}
