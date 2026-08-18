"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Maximize2, Monitor, Smartphone, Tablet, X } from "lucide-react";
import { Button } from "@/components/ui";
import type { PortfolioContent, PortfolioTheme } from "@/utils/portfolio";

/**
 * The portfolio as it will actually look, while you edit it.
 *
 * Two questions, two modes. "Is this roughly right as I type?" is answered
 * inline, beside the controls, by a phone-width frame at 1:1 — the only device
 * that fits a 416px column life-sized. "Does my desktop layout actually work?"
 * is answered by an overlay that takes the whole window, because desktop
 * squeezed into that column renders at 27%, which is honest and useless.
 *
 * Each device renders at its true width and is scaled to fit. That matters
 * because an iframe's viewport *is* its CSS width: constraining the frame with
 * `max-width` made "desktop" render the portfolio's mobile breakpoint while the
 * label said otherwise. Media queries now fire against a real 1440px viewport.
 *
 * Height is load-bearing and was briefly wrong. `frameClassName` carries the
 * pane height, and it used to sit on the iframe, an in-flow child that gave the
 * column its size. Moving the frame to `position: absolute` removed the only
 * in-flow content, and `flex-1` — `flex: 1 1 0%` — then beat the height property
 * for the item's main size in a column whose own height is auto: base size zero,
 * no free space, collapse to a 26px strip. So the inline pane never flexes. It
 * only flexes inside the overlay, where the column has a definite height to
 * divide up.
 *
 * There is exactly one iframe, and that is structural rather than intended. The
 * overlay is the same element tree with different classes — `display: contents`
 * when inline, `position: fixed` when inspecting — so React never unmounts the
 * frame and the preview route is never loaded twice. Rendering the overlay as
 * its own subtree would have put a second frame in the DOM, reloaded the route,
 * and made every `iframe[title$="portfolio preview"]` selector ambiguous.
 */

export type PreviewDevice = "desktop" | "tablet" | "mobile";

const DEVICES: { key: PreviewDevice; label: string; icon: typeof Monitor }[] = [
  { key: "desktop", label: "Desktop", icon: Monitor },
  { key: "tablet", label: "Tablet", icon: Tablet },
  { key: "mobile", label: "Mobile", icon: Smartphone },
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

/**
 * Under this, picking a device in the side pane opens the overlay instead of
 * shrinking the frame into the column. Type at 27% cannot be judged, and a
 * control that silently produces something unreadable is a control that lies.
 * Above it — the Preview tab, a wide window — the inline frame is legible and
 * promoting would be an interruption.
 */
const INLINE_LEGIBLE_SCALE = 0.6;

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function PortfolioLivePreview({
  content,
  theme,
  templateKey,
  device,
  onDeviceChange,
  className = "",
  frameClassName = "h-[70vh]",
  showDeviceControls = true,
  liveSiteUrl,
}: {
  content: PortfolioContent;
  theme: PortfolioTheme;
  templateKey: string;
  device: PreviewDevice;
  onDeviceChange: (device: PreviewDevice) => void;
  className?: string;
  frameClassName?: string;
  showDeviceControls?: boolean;
  /** Offered inside the overlay: even full screen scales 1440px down on a laptop,
   *  and the published site is the only genuinely 1:1 desktop view. */
  liveSiteUrl?: string | null;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  /* The inline width, remembered while inline, so the promote-or-not decision
     is made against the column even when the overlay is what is measured. */
  const inlineWidthRef = useRef(0);
  const [shellWidth, setShellWidth] = useState(0);
  const [inspecting, setInspecting] = useState(false);

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

  /* Only the width is measured. The height comes from CSS below, so a resized
     window re-fits the frame during layout rather than a frame later. */
  useEffect(() => {
    const element = shellRef.current;
    if (!element) return;
    const measure = () => setShellWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inspecting) inlineWidthRef.current = shellWidth;
  }, [inspecting, shellWidth]);

  /* Everything a full-screen layer owes the keyboard: focus goes in, stays in,
     Escape gets out, and the control that opened it gets focus back. The page
     behind is scroll-locked so a wheel over the backdrop does not move it. */
  useEffect(() => {
    if (!inspecting) return;
    const overlay = overlayRef.current;
    if (!overlay) return;

    const restoreTo = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => element.offsetParent !== null);
    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setInspecting(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !overlay.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreTo?.focus?.();
    };
  }, [inspecting]);

  const deviceWidth = DEVICE_WIDTH[device];
  // Never scale up: a 390px phone in a 900px pane should stay life-sized rather
  // than becoming a blurry billboard.
  const scale = shellWidth > 0 ? Math.min(1, shellWidth / deviceWidth) : 1;
  const scaledWidth = deviceWidth * scale;
  const percent = Math.round(scale * 100);

  const chooseDevice = (next: PreviewDevice) => {
    onDeviceChange(next);
    if (inspecting) return;
    const inlineWidth = inlineWidthRef.current || shellWidth;
    if (inlineWidth > 0 && inlineWidth / DEVICE_WIDTH[next] < INLINE_LEGIBLE_SCALE) setInspecting(true);
  };

  const controls = (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${inspecting ? "shrink-0" : "mb-3"}`}>
      <p className={`flex items-baseline gap-2 text-xs font-bold uppercase tracking-[0.12em] ${inspecting ? "text-white/80" : "text-muted-foreground"}`}>
        {inspecting ? "Inspecting" : "Live preview"}
        {/* Say so when it is not life-sized, rather than letting someone judge
            type size from a 29% rendering. */}
        {percent < 100 && <span className="font-semibold normal-case tracking-normal opacity-70">{percent}% · {deviceWidth}px wide</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className={`flex rounded-xl border p-1 ${inspecting ? "border-white/20 bg-white/10" : "border-border bg-card"}`} role="group" aria-label="Preview size">
          {DEVICES.map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              type="button"
              aria-label={`${label} preview`}
              aria-pressed={device === key}
              title={`${label} preview`}
              onClick={() => chooseDevice(key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                device === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : inspecting
                    ? "text-white/70 hover:text-white"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>
        {inspecting && liveSiteUrl && (
          <a
            href={liveSiteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-2.5 py-2 text-xs font-bold text-white hover:bg-white/20"
          >
            <ExternalLink className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Open live site</span>
          </a>
        )}
        <Button
          type="button"
          data-portfolio-preview-inspect
          onClick={() => setInspecting(!inspecting)}
          aria-label={inspecting ? "Close the full-screen preview" : "Inspect the preview full screen"}
          title={inspecting ? "Close (Esc)" : "Inspect full screen"}
          aria-expanded={inspecting}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold ${
            inspecting ? "border-white/20 bg-white/10 text-white hover:bg-white/20" : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          {inspecting ? <X className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{inspecting ? "Close" : "Inspect"}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div
        ref={overlayRef}
        {...(inspecting ? { role: "dialog" as const, "aria-modal": true, "aria-label": "Full-screen portfolio preview" } : {})}
        /* `contents` inline, so the controls and pane stay direct children of the
           column exactly as before; `fixed` when inspecting. Same element either
           way, which is what keeps the one iframe mounted across the change. */
        className={inspecting ? "fixed inset-0 z-[130] flex flex-col gap-3 bg-slate-950/70 p-3 backdrop-blur-md sm:p-6" : "contents"}
      >
        {/* The backdrop is a sibling behind the content so a click on it closes,
            while a click on the controls or the frame does not. */}
        {inspecting && (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden
            onClick={() => setInspecting(false)}
            className="absolute inset-0 -z-10 cursor-default"
          />
        )}
        {showDeviceControls && controls}
        <div
          data-portfolio-preview-pane
          /* Inline: a definite height, never `flex-1` — that is the collapse.
             Inspecting: `flex-1` is safe, because the fixed column above it has
             a definite height for the free space to come from. */
          className={
            inspecting
              ? "min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/15 bg-slate-900/40 p-2 sm:p-3"
              : `overflow-hidden rounded-2xl border border-border bg-muted/40 p-2 sm:p-3 ${frameClassName}`
          }
        >
          <div ref={shellRef} className="relative h-full w-full overflow-hidden">
            <div
              className={`absolute top-0 origin-top-left overflow-hidden bg-white shadow-xl dark:bg-slate-900 ${FRAME_RADIUS[device]}`}
              style={{
                width: `${deviceWidth}px`,
                /* Divided by the scale so the frame still fills the pane once
                   shrunk — a scaled-down desktop shows more page, not a
                   letterbox. A percentage rather than measured pixels, so it
                   stays correct between a resize and the observer firing. */
                height: `${100 / scale}%`,
                transform: `scale(${scale})`,
                left: `${Math.max(0, (shellWidth - scaledWidth) / 2)}px`,
              }}
            >
              <iframe
                ref={frameRef}
                src="/portfolio-preview"
                title={`${device} portfolio preview`}
                /* Out of the tab order on purpose. It is a preview: letting Tab
                   walk into another document would strand the keyboard inside a
                   frame whose Escape key cannot reach this overlay. The live
                   site, one click away, is the thing to explore properly. */
                tabIndex={-1}
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

      {/* Holds the column open while its contents are fixed, so nothing behind
          the backdrop reflows and the page does not jump on close. */}
      {inspecting && (
        <div aria-hidden className={`pointer-events-none ${frameClassName}`} />
      )}
    </div>
  );
}
