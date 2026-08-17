"use client";

import { AudioLines, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { PortfolioMedia, PortfolioMediaSettings } from "@/utils/portfolio";
import { formatDuration } from "./mediaShared";
import { claimPortfolioPlayback, onOtherPortfolioPlayback } from "./mediaPlayback";

type Props = {
  media: PortfolioMedia;
  settings: PortfolioMediaSettings;
  className?: string;
};

/** A flat fallback shape for audio uploaded before peaks were captured. */
function fallbackPeaks(seed: string, count = 120): number[] {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  return Array.from({ length: count }, (_, index) => {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const wave = Math.sin((index / count) * Math.PI);
    return 0.25 + wave * 0.45 * (0.6 + ((hash % 1000) / 1000) * 0.4);
  });
}

/**
 * A designed player rather than a bare <audio> tag. The waveform comes from
 * peaks measured in the browser at upload time, so drawing it costs no server
 * work and no extra request.
 *
 * Audio is never autoplayed: browsers only permit muted autoplay, and muted
 * audio is pointless.
 */
export default function MediaAudio({ media, settings, className = "" }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceId = useId();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const peaks = useMemo(
    () => (media.peaks && media.peaks.length > 0 ? media.peaks : fallbackPeaks(media.id)),
    [media.id, media.peaks],
  );
  const total = formatDuration(media.durationSeconds);
  const position = formatDuration(elapsed) || "0:00";

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setProgress(0);
    setElapsed(0);
  }, []);

  useEffect(() => onOtherPortfolioPlayback(instanceId, stop), [instanceId, stop]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.2) stop();
    }, { threshold: 0.2 });
    observer.observe(container);
    return () => observer.disconnect();
  }, [stop]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setElapsed(audio.currentTime);
      if (audio.duration && Number.isFinite(audio.duration)) setProgress(audio.currentTime / audio.duration);
    };
    const onEnd = () => { setProgress(0); setElapsed(0); };
    /* Track the element's own play state rather than setting it alongside each
       call. Playback also stops for reasons this component never initiates —
       the OS taking audio focus, headphones being unplugged, another player on
       the page — and mirroring the events is the only way the button does not
       end up showing Pause on audio that is already stopped. This is also what
       MediaVideo does, via its onPlay/onPause props. */
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      claimPortfolioPlayback(instanceId);
      audio.loop = false;
      void audio.play().catch(() => undefined);
    }
    else audio.pause();
  };

  /** Nothing is preloaded, so the first scrub has no duration to seek within.
   *  Load metadata on demand rather than ignoring the click — scrubbing is the
   *  most natural gesture this waveform invites. */
  const seekTo = async (clientX: number, element: HTMLElement) => {
    const audio = audioRef.current;
    if (!audio) return;
    const bounds = element.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1);
    setProgress(ratio);

    if (!Number.isFinite(audio.duration) || audio.duration === 0) {
      const loaded = await new Promise<boolean>((resolve) => {
        const done = (value: boolean) => {
          audio.removeEventListener("loadedmetadata", onLoaded);
          audio.removeEventListener("error", onError);
          window.clearTimeout(timer);
          resolve(value);
        };
        const onLoaded = () => done(true);
        const onError = () => done(false);
        const timer = window.setTimeout(() => done(false), 8_000);
        audio.addEventListener("loadedmetadata", onLoaded);
        audio.addEventListener("error", onError);
        audio.load();
      });
      if (!loaded || !Number.isFinite(audio.duration)) return;
    }

    audio.currentTime = ratio * audio.duration;
    setElapsed(audio.currentTime);
  };

  const title = media.alt || media.caption || "Untitled track";

  return (
    <figure className={className}>
      <div ref={containerRef} className="overflow-hidden rounded-[var(--portfolio-radius)] border border-[var(--portfolio-border)] bg-[var(--portfolio-card)]">
        <div className="flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? `Pause ${title}` : `Play ${title}`}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--portfolio-accent)] text-white shadow-lg transition hover:scale-105 sm:h-14 sm:w-14"
          >
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-extrabold text-[var(--portfolio-ink)]">{title}</p>
              <span className="shrink-0 text-[10px] font-bold tabular-nums text-[var(--portfolio-muted)]">
                {position}{total ? ` / ${total}` : ""}
              </span>
            </div>

            <div
              role="slider"
              tabIndex={0}
              aria-label={`Seek within ${title}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              onClick={(event) => { void seekTo(event.clientX, event.currentTarget); }}
              onKeyDown={(event) => {
                const audio = audioRef.current;
                if (!audio || !audio.duration) return;
                if (event.key === "ArrowRight") audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
                if (event.key === "ArrowLeft") audio.currentTime = Math.max(audio.currentTime - 5, 0);
                if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggle(); }
              }}
              className="mt-2.5 flex h-12 cursor-pointer items-center gap-[2px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--portfolio-accent)]"
            >
              {peaks.map((peak, index) => {
                // Strictly less-than, so at rest no bar reads as already
                // played. `<=` lit the first bar before playback started.
                const played = index / peaks.length < progress;
                return (
                  <span
                    key={index}
                    aria-hidden
                    className="flex-1 rounded-full transition-colors"
                    style={{
                      height: `${Math.max(peak * 100, 8)}%`,
                      backgroundColor: played ? "var(--portfolio-accent)" : "var(--portfolio-border)",
                    }}
                  />
                );
              })}
            </div>
          </div>

          <AudioLines className="hidden h-5 w-5 shrink-0 text-[var(--portfolio-muted)] sm:block" />
        </div>

        <audio ref={audioRef} src={media.url} preload="none" />
      </div>
      {settings.showCaptions && media.caption && media.caption !== title && (
        <figcaption className="mt-3 text-xs leading-5 text-[var(--portfolio-muted)]">{media.caption}</figcaption>
      )}
    </figure>
  );
}
