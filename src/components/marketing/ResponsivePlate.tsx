"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AppWindowFrame } from "@/components/marketing/AppWindowFrame";

/* A public-surface plate — a client-facing page (acceptance, invoice,
   published site) rendered at fixed document geometry inside an
   AppWindowFrame. Picks wide or narrow geometry by the plate's own width,
   so the document keeps its desktop layout in wide plates and its mobile
   layout in narrow ones. */

type PlateGeometry = { w: number; h: number };

export function ResponsivePlate({
  children,
  wide,
  narrow,
  breakpoint = 560,
  className = "",
}: {
  children: ReactNode;
  wide: PlateGeometry;
  narrow: PlateGeometry;
  breakpoint?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setIsNarrow(el.clientWidth < breakpoint);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [breakpoint]);

  const geometry = isNarrow ? narrow : wide;
  return (
    <div ref={wrapRef} className={className}>
      <AppWindowFrame docWidth={geometry.w} docHeight={geometry.h}>
        {children}
      </AppWindowFrame>
    </div>
  );
}
