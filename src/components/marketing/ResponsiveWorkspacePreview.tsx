"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { WorkspacePreview, type WorkspacePreviewView } from "@/components/marketing/WorkspacePreview";
import { WorkspacePreviewCompact } from "@/components/marketing/WorkspacePreviewCompact";
import { AppWindowFrame } from "@/components/marketing/AppWindowFrame";

/* Fixed-geometry app windows, scaled to the plate. The variant follows the
   plate's own width — not the viewport — matching the app's own breakpoints:
   a narrow plate gets the real mobile shell, a mid plate the real tablet
   layout (sidebar in, lg: grids collapsed), a wide plate the full desktop
   window. Heights are per view so the identifying content — metric row,
   first table rows, today's events — lands inside the window. */

const DESKTOP_GEOMETRY: Record<WorkspacePreviewView, { w: number; h: number }> = {
  dashboard: { w: 1440, h: 880 },
  revenue: { w: 1440, h: 950 },
  calendar: { w: 1440, h: 680 },
  clients: { w: 1440, h: 700 },
  projects: { w: 1440, h: 780 },
  agreements: { w: 1440, h: 760 },
  portfolio: { w: 1440, h: 720 },
  enquiries: { w: 1440, h: 780 },
};

/* 920px doc — the app's real tablet layout: the desktop shell stays, but
   lg:/xl: grids collapse the way they do on a small laptop. */
const MID_GEOMETRY: Record<WorkspacePreviewView, { w: number; h: number }> = {
  dashboard: { w: 920, h: 960 },
  revenue: { w: 920, h: 1040 },
  calendar: { w: 920, h: 720 },
  clients: { w: 920, h: 780 },
  projects: { w: 920, h: 860 },
  agreements: { w: 920, h: 840 },
  portfolio: { w: 920, h: 780 },
  enquiries: { w: 920, h: 840 },
};

const COMPACT_GEOMETRY: Record<WorkspacePreviewView, { w: number; h: number }> = {
  dashboard: { w: 390, h: 760 },
  revenue: { w: 390, h: 780 },
  calendar: { w: 390, h: 740 },
  clients: { w: 390, h: 720 },
  projects: { w: 390, h: 740 },
  agreements: { w: 390, h: 700 },
  portfolio: { w: 390, h: 720 },
  enquiries: { w: 390, h: 640 },
};

const COMPACT_MAX_WIDTH = 480;
const MID_MAX_WIDTH = 1024;

export function ResponsiveWorkspacePreview({ view, className = "" }: { view: WorkspacePreviewView; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<"compact" | "mid" | "desktop">("desktop");

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setTier(w < COMPACT_MAX_WIDTH ? "compact" : w < MID_MAX_WIDTH ? "mid" : "desktop");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const geometry = (tier === "compact" ? COMPACT_GEOMETRY : tier === "mid" ? MID_GEOMETRY : DESKTOP_GEOMETRY)[view];
  return (
    <div ref={wrapRef} className={className}>
      <AppWindowFrame docWidth={geometry.w} docHeight={geometry.h}>
        {tier === "compact" ? <WorkspacePreviewCompact view={view} /> : <WorkspacePreview view={view} />}
      </AppWindowFrame>
    </div>
  );
}
