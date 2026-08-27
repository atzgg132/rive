"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const paths = [
  "M-40 172 C170 112 260 250 444 214 S742 76 930 184 S1212 330 1480 170",
  "M-50 356 C172 298 278 402 470 342 S750 214 944 326 S1220 454 1490 326",
  "M-30 548 C164 454 332 584 506 526 S790 398 976 510 S1250 624 1490 500",
  "M154 42 C194 210 128 332 250 474 S434 670 382 902",
  "M612 -30 C550 172 670 306 588 452 S520 702 664 930",
  "M1086 -32 C1010 152 1122 286 1034 438 S930 704 1094 930",
] as const;

const nodes = [
  [112, 151], [252, 226], [444, 214], [612, 134], [782, 122], [930, 184], [1128, 286], [1350, 210],
  [170, 324], [470, 342], [718, 248], [944, 326], [1242, 418],
  [118, 510], [330, 558], [506, 526], [790, 398], [976, 510], [1260, 590],
] as const;

export function ConnectedSignalField({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<SVGGElement>(null);
  const railRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const network = networkRef.current;
    const rail = railRef.current;
    if (!root || !network || !rail || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const section = root.closest("section");
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height * 0.78, 1)));
      network.style.transform = `translate3d(0, ${progress * 88}px, 0) scaleY(${1 + progress * 0.08})`;
      network.style.opacity = `${0.78 - progress * 0.42}`;
      rail.style.opacity = `${0.08 + progress * 0.42}`;
      rail.style.transform = `translate3d(0, ${24 - progress * 24}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn("connected-signal-field pointer-events-none absolute inset-0 overflow-hidden", className)}
      data-testid="connected-signal-field"
      aria-hidden="true"
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="signal-path-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#60a5fa" stopOpacity="0" />
            <stop offset="0.28" stopColor="#60a5fa" stopOpacity="0.34" />
            <stop offset="0.7" stopColor="#22d3ee" stopOpacity="0.2" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="signal-node-gradient">
            <stop offset="0" stopColor="#dbeafe" />
            <stop offset="0.38" stopColor="#60a5fa" />
            <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
          </radialGradient>
          <filter id="signal-soft-glow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <g ref={networkRef} className="connected-signal-network">
          {paths.map((path, index) => (
            <path
              key={path}
              d={path}
              className={index > 2 ? "signal-detail" : undefined}
              fill="none"
              stroke="url(#signal-path-gradient)"
              strokeWidth={index > 2 ? 0.7 : 0.9}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {[0, 1, 2].map((pathIndex) => (
            <path
              key={`signal-${pathIndex}`}
              d={paths[pathIndex]}
              className={`connected-signal-pulse connected-signal-pulse-${pathIndex + 1}`}
              fill="none"
              pathLength="100"
              stroke="#7dd3fc"
              strokeLinecap="round"
              strokeWidth="1.35"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {nodes.map(([cx, cy], index) => (
            <g key={`${cx}-${cy}`} className={index % 3 === 1 ? "signal-detail" : undefined}>
              <circle cx={cx} cy={cy} r="8" fill="url(#signal-node-gradient)" opacity="0.2" filter="url(#signal-soft-glow)" />
              <circle className="connected-signal-node" cx={cx} cy={cy} r={index % 4 === 0 ? 1.8 : 1.25} fill={index % 4 === 0 ? "#bfdbfe" : "#60a5fa"} />
            </g>
          ))}
        </g>

        <g ref={railRef} className="connected-signal-rail">
          <path d="M90 812 C390 780 1050 780 1350 812" fill="none" stroke="url(#signal-path-gradient)" strokeWidth="1" />
          {[260, 520, 720, 920, 1180].map((cx) => <circle key={cx} cx={cx} cy={cx === 720 ? 790 : 797} r="1.4" fill="#60a5fa" />)}
        </g>
      </svg>
      <div className="connected-signal-vignette absolute inset-0" />
    </div>
  );
}
