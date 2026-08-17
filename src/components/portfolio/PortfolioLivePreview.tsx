"use client";

import { useEffect, useRef } from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { Button } from "@/components/ui";
import type { PortfolioContent, PortfolioTheme } from "@/utils/portfolio";

/**
 * The portfolio as it will actually look, while you edit it.
 *
 * Editing and seeing used to be separate tabs, so every judgement about how
 * something looked cost a context switch — pick a template, switch, look,
 * switch back, change it. The preview already accepted live content over
 * `postMessage`; it simply was not on screen at the same time as the controls.
 *
 * Updates are debounced rather than sent per keystroke: an iframe re-rendering
 * a whole portfolio on every character felt worse than the tab it replaced.
 */

export type PreviewDevice = "desktop" | "tablet" | "mobile";

const DEVICES: { key: PreviewDevice; label: string; icon: typeof Monitor }[] = [
  { key: "desktop", label: "Desktop", icon: Monitor },
  { key: "tablet", label: "Tablet", icon: Tablet },
  { key: "mobile", label: "Mobile", icon: Smartphone },
];

const FRAME_WIDTH: Record<PreviewDevice, string> = {
  desktop: "max-w-full rounded-xl",
  tablet: "max-w-[820px] rounded-2xl",
  mobile: "max-w-[390px] rounded-[2rem]",
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
  const readyRef = useRef(false);

  const post = () => {
    frameRef.current?.contentWindow?.postMessage(
      { type: "rive:portfolio-preview", payload: { content, theme, templateKey } },
      window.location.origin,
    );
  };

  /* Debounced so a burst of typing produces one re-render rather than one per
     character. The frame only receives anything once it has loaded, which the
     ref tracks — posting into a frame that has not finished loading is silently
     dropped, which is how the preview used to arrive blank on first open. */
  useEffect(() => {
    if (!readyRef.current) return;
    const timer = window.setTimeout(post, 220);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, theme, templateKey, device]);

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {showDeviceControls && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Live preview</p>
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

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-muted/40 p-2 sm:p-3">
        <div className={`mx-auto h-full overflow-hidden bg-white shadow-xl transition-[max-width] duration-300 dark:bg-slate-900 ${FRAME_WIDTH[device]}`}>
          <iframe
            ref={frameRef}
            src="/portfolio-preview"
            title={`${device} portfolio preview`}
            className={`block w-full border-0 bg-white ${frameClassName}`}
            onLoad={() => {
              readyRef.current = true;
              post();
            }}
          />
        </div>
      </div>
    </div>
  );
}
