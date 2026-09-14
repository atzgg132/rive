"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** A document reproduced at reduced scale, like a catalogue specimen. The
 * child renders at a fixed document width inside a fluid plate; the frame
 * measures both so the plate is always exactly the scaled document's
 * height — nothing cropped, nothing padded. The reproduction is inert:
 * its links never enter the tab order and pointer events pass over it. */
export function SpecimenFrame({ children, docWidth }: { children: ReactNode; docWidth?: number }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [docHeight, setDocHeight] = useState(0);
  const [width, setWidth] = useState(docWidth ?? 0);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const doc = docRef.current;
    if (!frame || !doc) return;
    const measure = () => {
      /* Media queries answer the viewport, not the frame — so the document
         is authored at a width whose layout matches the current viewport's
         breakpoint range (a mobile viewport gets the page's mobile layout
         at a natural phone width, not a stretched one). */
      const dw = docWidth ?? (window.innerWidth < 640 ? 400 : 1200);
      if (dw !== width) {
        setWidth(dw);
        return;
      }
      const frameWidth = frame.clientWidth;
      if (frameWidth > 0) setScale(frameWidth / dw);
      const height = doc.scrollHeight;
      if (height > 0) setDocHeight(height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(doc);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [docWidth, width]);

  return (
    <div ref={frameRef} className="inst-specimen" style={{ height: scale && docHeight ? docHeight * scale : undefined, aspectRatio: scale && docHeight ? "auto" : undefined }} aria-hidden="true" inert>
      <div ref={docRef} className="inst-specimen__doc" style={{ width: width || 1200, transform: `scale(${scale})`, visibility: scale ? undefined : "hidden" }}>
        {children}
      </div>
    </div>
  );
}
