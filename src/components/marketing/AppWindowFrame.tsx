"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** An app window reproduced at reduced scale inside a fluid plate. Unlike
 * SpecimenFrame — a document measured to its last pixel — a window has fixed
 * geometry: the child renders at docWidth×docHeight and clips at the frame,
 * the way real UI clips at the viewport. The reproduction is inert. */
export function AppWindowFrame({
  children,
  docWidth,
  docHeight,
  className = "",
}: {
  children: ReactNode;
  docWidth: number;
  docHeight: number;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const w = frame.clientWidth;
      if (w > 0) setScale(w / docWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [docWidth]);

  return (
    <div
      ref={frameRef}
      className={`app-window ${className}`}
      style={{ aspectRatio: `${docWidth} / ${docHeight}` }}
      aria-hidden="true"
      inert
    >
      <div
        className="app-window__doc"
        style={{
          width: docWidth,
          height: docHeight,
          transform: `scale(${scale})`,
          visibility: scale ? undefined : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** A window whose document fills the frame at real size — no scaling. The
 * doc is a size container, so the wp-* rules inside lay out against the
 * doc's own width. The aspect ratio sets how much of the view is in-frame. */
export function FluidAppWindow({
  children,
  aspect,
  className = "",
}: {
  children: ReactNode;
  aspect: number;
  className?: string;
}) {
  return (
    <div className={`app-window ${className}`} style={{ aspectRatio: String(aspect) }} aria-hidden="true" inert>
      <div className="app-window__fluid-doc">{children}</div>
    </div>
  );
}
