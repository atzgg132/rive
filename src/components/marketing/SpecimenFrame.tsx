"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** A document reproduced at reduced scale, like a catalogue specimen. The
 * child renders at a fixed document width inside a fluid plate; the frame
 * measures both so the plate is always exactly the scaled document's
 * height — nothing cropped, nothing padded. The reproduction is inert:
 * its links never enter the tab order and pointer events pass over it. */
export function SpecimenFrame({ children, docWidth = 1200 }: { children: ReactNode; docWidth?: number }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [docHeight, setDocHeight] = useState(0);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const doc = docRef.current;
    if (!frame || !doc) return;
    const measure = () => {
      const width = frame.clientWidth;
      if (width > 0) setScale(width / docWidth);
      const height = doc.scrollHeight;
      if (height > 0) setDocHeight(height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(doc);
    return () => observer.disconnect();
  }, [docWidth]);

  return (
    <div ref={frameRef} className="inst-specimen" style={{ height: scale && docHeight ? docHeight * scale : undefined, aspectRatio: scale && docHeight ? "auto" : undefined }} aria-hidden="true" inert>
      <div ref={docRef} className="inst-specimen__doc" style={{ width: docWidth, transform: `scale(${scale})`, visibility: scale ? undefined : "hidden" }}>
        {children}
      </div>
    </div>
  );
}
