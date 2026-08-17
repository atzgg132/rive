"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui";
import type { PortfolioContent, PortfolioTheme } from "@/utils/portfolio";

/**
 * The portfolio as it will actually look, while you edit it.
 *
 * Editing and seeing used to be separate tabs, so every judgement about how
 * something looked cost a context switch. The preview already accepted live
 * content over `postMessage`; it simply was never on screen beside the controls.
 *
 * The device switcher used to constrain the frame with `max-width`, which was
 * two bugs at once. In a 416px side pane, "desktop" (`max-w-full`) and "tablet"
 * (`max-w-[820px]`) both resolved to 416px, so two of the three buttons were
 * indistinguishable. Worse, an iframe's viewport *is* its CSS width, so the
 * "desktop" preview was rendering the portfolio's mobile breakpoint — the label
 * was telling you the opposite of what you were looking at.
 *
 * Each device now renders at its true width and is scaled down to fit. Media
 * queries inside the frame fire against a real 1440px viewport, and what you
 * see is the desktop layout, just smaller.
 */

export type PreviewDevice = "desktop" | "tablet" | "mobile";

const DEVICES: { key: PreviewDevice; label: string; icon: typeof Monitor; width: number }[] = [
  { key: "desktop", label: "Desktop", icon: Monitor, width: 1440 },
  { key: "tablet", label: "Tablet", icon: Tablet, width: 834 },
  { key: "mobile", label: "Mobile", icon: Smartphone, width: 390 },
];

const DEVICE_WIDTH: Record<PreviewDevice, number> = {
  desktop: 1440,
  tablet: 834,
  mobile: 390,
};

const FRAME_RADIUS: Record<PreviewDevice, string> = {
  desktop: "rounded-lg",
  tablet: "rounded-xl",
  mobile: "rounded-[1.75rem]",
};

export default function PortfolioLivePreview({
  content,
  theme,
  templateKey,
  device,
  onDeviceChange,
  className = "",
  frameClassName = "h-[70vh]",
  showDeviceControls = true,
}: {
  content: PortfolioContent;
  theme: PortfolioTheme;
  templateKey: string;
  device: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
  className?: string;
  frameClassName?: string;
  showDeviceControls?: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const [shell, setShell] = useState({ width: 0, height: 0 });

  const post = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: "rive:portfolio-preview", payload: { content, theme, templateKey } },
      window.location.origin,
    );
  }, [content, theme, templateKey]);

  /* Debounced so a burst of typing produces one re-render rather than one per
     character, and gated on load: posting into a frame that has not finished
     loading is silently dropped, which is how the preview used to open blank. */
  useEffect(() => {
    if (!readyRef.current) return;
    const timer = window.setTimeout(post, 220);
    return () => window.clearTimeout(timer);
  }, [post, device]);

  // The scale depends on how much room the pane actually has, which changes
  // with the window, the tab, and the side pane appearing.
  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;
    const measure = () => setShell({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const deviceWidth = DEVICE_WIDTH[device];
  // Never scale up: a 390px phone in a 900px pane should stay life-sized rather
  // than becoming a blurry billboard.
  const scale = shell.width > 0 ? Math.min(1, shell.width / deviceWidth) : 1;
  const scaledWidth = deviceWidth * scale;
  const percent = Math.round(scale * 100);

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {showDeviceControls && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-baseline gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Live preview
            {/* Say so when it is not life-sized, rather than letting someone
                judge type size from a 29% rendering. */}
            {percent < 100 && <span className="font-semibold normal-case tracking-normal opacity-70">{percent}% · {deviceWidth}px wide</span>}
          </p>
          <div className="flex rounded-xl border border-border bg-card p-1" role="group" aria-label="Preview size">
            {DEVICES.map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                type="button"
                aria-label={`${label} preview`}
                aria-pressed={device === key}
                title={`${label} preview`}
                onClick={() => onDeviceChange(key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${device === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className={`min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-muted/40 p-2 sm:p-3 ${frameClassName}`}>
        <div ref={shellRef} className="relative h-full w-full overflow-hidden">
          <div
            className={`absolute top-0 origin-top-left overflow-hidden bg-white shadow-xl dark:bg-slate-900 ${FRAME_RADIUS[device]}`}
            style={{
              width: `${deviceWidth}px`,
              // Divided by the scale so the frame still fills the pane once
              // shrunk — a scaled-down desktop shows more page, not a letterbox.
              height: shell.height > 0 ? `${shell.height / scale}px` : "100%",
              transform: `scale(${scale})`,
              left: `${Math.max(0, (shell.width - scaledWidth) / 2)}px`,
            }}
          >
            <iframe
              ref={frameRef}
              src="/portfolio-preview"
              title={`${device} portfolio preview`}
              className="block h-full w-full border-0 bg-white"
              onLoad={() => {
                readyRef.current = true;
                post();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
