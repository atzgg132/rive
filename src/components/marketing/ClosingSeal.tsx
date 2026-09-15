"use client";

import { useEffect, useRef } from "react";
import { useMarketingReducedMotion } from "@/components/marketing/useMarketingReducedMotion";

/* The closing emblem — an abstract orrery of the register's marks. No words:
   concentric hairline rings on the ink field, the five glyphs orbiting at
   different speeds and directions around a blue core, a shuttle gliding the
   ledger rail through the middle. The entrance is scroll-scrubbed via --p —
   rings draw, marks fly out to their orbits — then .is-sealed hands it to
   perpetual drift. Reduced motion renders it complete and still. */

const MARK_SHAPES = {
  circle: <circle r="9" />,
  square: <rect x="-8" y="-8" width="16" height="16" />,
  triangle: <path d="M 0 -10 L 9.5 7.5 L -9.5 7.5 Z" />,
  diamond: <path d="M 0 -11 L 9 0 L 0 11 L -9 0 Z" />,
  semi: <path d="M -10 6 A 10 10 0 0 1 10 6 Z" />,
} as const;

type MarkKey = keyof typeof MARK_SHAPES;

const ORBITS: { r: number; dur: number; reverse?: boolean; marks: { mark: MarkKey; angle: number; accent?: boolean }[] }[] = [
  { r: 186, dur: 96, marks: [{ mark: "semi", angle: 18, accent: true }] },
  { r: 148, dur: 64, reverse: true, marks: [{ mark: "triangle", angle: 130 }, { mark: "circle", angle: 300 }] },
  { r: 110, dur: 44, marks: [{ mark: "diamond", angle: 60, accent: true }, { mark: "square", angle: 236 }] },
];

export function ClosingSeal({ className = "" }: { className?: string }) {
  const sealRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useMarketingReducedMotion();

  useEffect(() => {
    const seal = sealRef.current;
    if (!seal) return;
    if (reducedMotion) {
      seal.style.setProperty("--p", "1");
      seal.classList.add("is-sealed");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = seal.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const progress = Math.min(1, Math.max(0, (vh * 0.88 - rect.top) / (vh * 0.55)));
      seal.style.setProperty("--p", progress.toFixed(4));
      seal.classList.toggle("is-sealed", progress >= 0.999);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reducedMotion]);

  return (
    <div
      ref={sealRef}
      className={`inst-seal ${className}`}
      role="img"
      aria-label="Abstract emblem: the register's five marks orbiting concentric rings around a blue core."
    >
      <span className="inst-seal__glow" aria-hidden="true" />
      <svg className="inst-seal__svg" viewBox="0 0 400 400" aria-hidden="true">
        {/* ledger rail through the middle */}
        <line className="inst-seal__rail" x1="8" y1="200" x2="392" y2="200" pathLength={100} />
        <circle className="inst-seal__ticks" cx="200" cy="200" r="168" pathLength={120} />
        <circle className="inst-seal__guide" cx="200" cy="200" r="186" />
        <circle className="inst-seal__guide" cx="200" cy="200" r="148" />
        <circle className="inst-seal__guide" cx="200" cy="200" r="110" />
        {ORBITS.map((orbit, i) => (
          <g key={i} className={`inst-seal__ring-set${orbit.reverse ? " inst-seal__ring-set--rev" : ""}`} style={{ "--dur": `${orbit.dur}s` } as React.CSSProperties}>
            <circle className="inst-seal__ring" cx="200" cy="200" r={orbit.r} pathLength={100} />
            {orbit.marks.map((m, j) => (
              <g key={j} transform={`rotate(${m.angle} 200 200)`}>
                <g transform={`translate(200 ${200 - orbit.r})`} className={`inst-seal__orbit-mark${m.accent ? " inst-seal__orbit-mark--accent" : ""}`} style={{ "--d": `${0.12 + i * 0.09 + j * 0.05}` } as React.CSSProperties}>
                  {MARK_SHAPES[m.mark]}
                </g>
              </g>
            ))}
          </g>
        ))}
        <g className="inst-seal__core">
          <circle cx="200" cy="200" r="26" className="inst-seal__core-halo" />
          <circle cx="200" cy="200" r="7" className="inst-seal__core-dot" />
        </g>
        <rect className="inst-seal__shuttle" x="-4" y="-4" width="8" height="8" />
        <rect className="inst-seal__shuttle inst-seal__shuttle--rev" x="-3" y="-3" width="6" height="6" />
      </svg>
    </div>
  );
}
