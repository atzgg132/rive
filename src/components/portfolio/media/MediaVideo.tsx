"use client";

import { Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PortfolioMedia, PortfolioMediaSettings } from "@/utils/portfolio";
import { MEDIA_SURFACE, formatDuration, motionAllowed } from "./mediaShared";

type Props = {
  media: PortfolioMedia;
  settings: PortfolioMediaSettings;
  className?: string;
  /** Fill an existing framed slot instead of bringing its own aspect and border. */
  fill?: boolean;
};

/**
 * Nothing is fetched until the visitor shows intent. The poster stands in for
 * the video, and `preload="none"` keeps the source untouched until play is
 * pressed, autoplay-on-scroll brings it into view, or a hover preview starts.
 */
export default function MediaVideo({ media, settings, className = "", fill = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Whether the visitor has committed to this video. Drives both hiding the
   *  poster overlay and handing over to the element's native controls. */
  const [started, setStarted] = useState(false);
  const duration = formatDuration(media.durationSeconds);
  const aspect = media.aspectRatio && media.aspectRatio > 0 ? media.aspectRatio : 16 / 9;

  const play = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    try {
      await video.play();
    } catch {
      // A blocked play attempt has to put the poster back. Setting `started`
      // before awaiting is what lets the overlay disappear at the moment of
      // the click rather than after the first frame decodes, so the failure
      // path is the one that has to undo it — otherwise a rejected play left
      // the visitor looking at a stalled, controls-only frame with no way to
      // retry.
      setStarted(false);
    }
  }, []);

  /* Depend on the flag itself, not the settings object. Callers build that
     object inline, so using it as a dependency tore the observer down and
     rebuilt it on every render. */
  const autoplayEnabled = settings.autoplayOnScroll;

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video || !autoplayEnabled || !motionAllowed()) return;

    // Playing only while visible keeps an off-screen video from streaming.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Same contract as `play`: only claim the video started once it
          // actually did, so a refused autoplay keeps the poster and its
          // play button instead of showing bare controls over a still frame.
          setStarted(true);
          video.play().catch(() => setStarted(false));
        } else if (!video.paused) {
          video.pause();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [autoplayEnabled]);

  const previewOn = () => {
    if (!settings.hoverPreview || started) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    void video.play().catch(() => undefined);
  };

  const previewOff = () => {
    if (!settings.hoverPreview || started) return;
    const video = videoRef.current;
    if (!video || video.paused) return;
    video.pause();
    video.currentTime = 0;
  };

  const frame = (
    <div
      ref={containerRef}
      className={fill ? "group absolute inset-0 overflow-hidden" : `group relative ${MEDIA_SURFACE}`}
      style={fill ? undefined : { aspectRatio: String(aspect) }}
      onPointerEnter={previewOn}
      onPointerLeave={previewOff}
    >
        <video
          ref={videoRef}
          src={media.url}
          poster={media.posterUrl || undefined}
          preload="none"
          playsInline
          loop={settings.loop || settings.autoplayOnScroll}
          muted={settings.autoplayOnScroll || settings.hoverPreview}
          controls={started}
          aria-label={media.alt || media.caption || "Project video"}
          className={`h-full w-full ${settings.fit === "contain" ? "object-contain" : "object-cover"}`}
        />

        {!started && (
          <button
            type="button"
            onClick={() => void play()}
            aria-label={`Play ${media.alt || media.caption || "video"}`}
            className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/45 via-transparent to-transparent transition"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-slate-950 shadow-2xl backdrop-blur transition duration-300 group-hover:scale-110">
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            </span>
          </button>
        )}

        {/* A pause overlay used to sit here with `opacity-0 pointer-events-none`
            and no hover rule to reveal it: invisible, unclickable, and still
            announced by screen readers as an actionable "Pause video" control.
            Once playback starts the element renders native `controls`, which is
            the real pause affordance for both pointer and assistive users. */}

      {duration && !started && (
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold tabular-nums text-white backdrop-blur">
          {duration}
        </span>
      )}
    </div>
  );

  if (fill) return frame;

  return (
    <figure className={className}>
      {frame}
      {settings.showCaptions && media.caption && (
        <figcaption className="mt-3 text-xs leading-5 text-[var(--portfolio-muted)]">{media.caption}</figcaption>
      )}
    </figure>
  );
}
