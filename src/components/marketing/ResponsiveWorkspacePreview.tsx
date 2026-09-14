"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { WorkspacePreview, type WorkspacePreviewView } from "@/components/marketing/WorkspacePreview";
import { WorkspacePreviewCompact } from "@/components/marketing/WorkspacePreviewCompact";
import { AppWindowFrame } from "@/components/marketing/AppWindowFrame";

/* Fixed-geometry app windows, scaled to the plate. The variant follows the
   plate's own width — not the viewport — so a full-width plate always gets
   the desktop shell (even on short laptops) and a narrow plate gets the
   mobile shell (even inside a wide page). Heights are per view so the
   identifying content — metric row, first table rows, today's events —
   lands inside the window. */

const DESKTOP_GEOMETRY: Record<WorkspacePreviewView, { w: number; h: number }> = {
  dashboard: { w: 1440, h: 880 },
  revenue: { w: 1440, h: 950 },
  calendar: { w: 1440, h: 680 },
  clients: { w: 1440, h: 700 },
  projects: { w: 1440, h: 780 },
  agreements: { w: 1440, h: 760 },
  portfolio: { w: 1440, h: 720 },
};

const COMPACT_GEOMETRY: Record<WorkspacePreviewView, { w: number; h: number }> = {
  dashboard: { w: 390, h: 760 },
  revenue: { w: 390, h: 780 },
  calendar: { w: 390, h: 740 },
  clients: { w: 390, h: 720 },
  projects: { w: 390, h: 740 },
  agreements: { w: 390, h: 700 },
  portfolio: { w: 390, h: 720 },
};

const COMPACT_MAX_WIDTH = 560;

export function ResponsiveWorkspacePreview({ view, className = "" }: { view: WorkspacePreviewView; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setCompact(el.clientWidth < COMPACT_MAX_WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const geometry = (compact ? COMPACT_GEOMETRY : DESKTOP_GEOMETRY)[view];
  return (
    <div ref={wrapRef} className={className}>
      <AppWindowFrame docWidth={geometry.w} docHeight={geometry.h}>
        {compact ? <WorkspacePreviewCompact view={view} /> : <WorkspacePreview view={view} />}
      </AppWindowFrame>
    </div>
  );
}
