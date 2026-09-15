"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { WorkspacePreview, type WorkspacePreviewView } from "@/components/marketing/WorkspacePreview";
import { WorkspacePreviewCompact } from "@/components/marketing/WorkspacePreviewCompact";
import { FluidAppWindow } from "@/components/marketing/AppWindowFrame";

/* Fluid app windows — the document renders at the plate's real width and
   its internals answer to that width via container queries. The only choice
   made here is the shell: below the app's own md boundary the plate gets
   the real mobile header, above it the sidebar + topbar. Aspect ratios are
   per view so the identifying content — metric row, first rows, today's
   events — lands inside the window. */

const COMPACT_MAX_WIDTH = 768;

/* Window aspect per view, bucketed by the doc's real width. Each band picks
   an aspect at or just above width/content-height, so the window clips the
   view like a real viewport instead of leaving dead paper below the UI. */
const ASPECTS: Record<WorkspacePreviewView, { max: number; aspect: number }[]> = {
  dashboard: [{ max: 560, aspect: 0.5 }, { max: 768, aspect: 1.1 }, { max: Infinity, aspect: 1.55 }],
  revenue: [{ max: 560, aspect: 0.5 }, { max: 768, aspect: 0.6 }, { max: Infinity, aspect: 1.5 }],
  calendar: [{ max: 560, aspect: 0.55 }, { max: 768, aspect: 0.95 }, { max: Infinity, aspect: 1.45 }],
  clients: [{ max: 560, aspect: 0.55 }, { max: 768, aspect: 0.9 }, { max: Infinity, aspect: 1.6 }],
  projects: [{ max: 560, aspect: 0.5 }, { max: 768, aspect: 0.9 }, { max: Infinity, aspect: 1.5 }],
  agreements: [{ max: 560, aspect: 0.55 }, { max: 768, aspect: 0.7 }, { max: Infinity, aspect: 1.6 }],
  portfolio: [{ max: 560, aspect: 0.5 }, { max: 768, aspect: 1.0 }, { max: Infinity, aspect: 1.5 }],
  enquiries: [{ max: 560, aspect: 0.52 }, { max: 768, aspect: 1.05 }, { max: Infinity, aspect: 1.6 }],
};

function aspectFor(view: WorkspacePreviewView, width: number) {
  return ASPECTS[view].find((band) => width < band.max)?.aspect ?? 1.5;
}

export function ResponsiveWorkspacePreview({ view, className = "" }: { view: WorkspacePreviewView; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const compact = width > 0 && width < COMPACT_MAX_WIDTH;
  return (
    <div ref={wrapRef} className={className}>
      <FluidAppWindow aspect={aspectFor(view, width)}>
        {compact ? <WorkspacePreviewCompact view={view} /> : <WorkspacePreview view={view} />}
      </FluidAppWindow>
    </div>
  );
}
