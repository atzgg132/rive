"use client";

import { ExternalLink, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PortfolioMedia, PortfolioMediaSettings } from "@/utils/portfolio";
import { EMBED_PROVIDERS, embedSrcFor, parseEmbedInput } from "@/utils/portfolioEmbeds";
import { MEDIA_SURFACE, motionAllowed } from "./mediaShared";

/* Portfolio owners supply validated provider posters. */
/* eslint-disable @next/next/no-img-element */

type Props = {
  media: PortfolioMedia;
  settings: PortfolioMediaSettings;
  className?: string;
  fill?: boolean;
};

/** Providers whose player is a compact widget rather than a video frame. */
const AUDIO_ROLE = "audio";

/**
 * Three presentations, in escalating order of commitment:
 *
 *   poster  — a still image. No third-party code has loaded at all.
 *   ambient — muted, looping, chromeless. Entered on scroll when the owner
 *             enabled autoplay, so the page keeps its own character instead of
 *             wearing YouTube's.
 *   player  — full controls and sound. Only a deliberate click gets here.
 *
 * Audio widgets skip all of this: the widget is the player, so a stand-in would
 * be theatre, and muted audio autoplay would be pointless.
 */
export default function MediaEmbed({ media, settings, className = "", fill = false }: Props) {
  const [mode, setMode] = useState<"poster" | "ambient" | "player">("poster");
  const containerRef = useRef<HTMLDivElement>(null);

  /* Revalidate on render: a stored embed is only honoured while it still
     resolves to a provider on the allowlist.

     Parse `url` first, not `sourceUrl`. `url` is the field the server
     validates as an embed; `sourceUrl` is the human "watch on …" link and is
     only checked as a generic HTTPS URL. Reading sourceUrl first meant the
     weakly-validated field decided what actually rendered — and any sourceUrl
     that is not itself a recognisable provider link (a personal site, a
     shortener) made the whole embed disappear even though `url` was fine. */
  const parsed = parseEmbedInput(media.url) || parseEmbedInput(media.sourceUrl || "");
  const autoplayEnabled = settings.autoplayOnScroll;
  const isAudioWidget = parsed?.role === AUDIO_ROLE;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !autoplayEnabled || isAudioWidget || !motionAllowed()) return;

    const observer = new IntersectionObserver(([entry]) => {
      // Never downgrade a player the visitor deliberately opened.
      setMode((current) => (current === "player" ? current : entry.isIntersecting ? "ambient" : "poster"));
    }, { threshold: 0.5 });
    observer.observe(container);
    return () => observer.disconnect();
  }, [autoplayEnabled, isAudioWidget]);

  if (!parsed) return null;

  const provider = EMBED_PROVIDERS[parsed.provider];
  const poster = media.posterUrl || parsed.posterUrl;
  const title = media.alt || media.caption || `${provider.label} media`;

  if (isAudioWidget) {
    return (
      <figure className={className}>
        <div className="overflow-hidden rounded-[var(--portfolio-radius)] border border-[var(--portfolio-border)] bg-[var(--portfolio-card)]">
          <iframe
            src={parsed.embedUrl}
            title={title}
            loading="lazy"
            height={media.embedHeight || parsed.embedHeight || 166}
            className="w-full border-0"
            allow="encrypted-media; clipboard-write"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        {settings.showCaptions && media.caption && (
          <figcaption className="mt-3 text-xs leading-5 text-[var(--portfolio-muted)]">{media.caption}</figcaption>
        )}
      </figure>
    );
  }

  const frame = (
    <div
      ref={containerRef}
      className={fill ? "group absolute inset-0 overflow-hidden" : `group relative ${MEDIA_SURFACE}`}
      style={fill ? undefined : { aspectRatio: "16 / 9" }}
    >
      {mode === "poster" ? (
        <>
          {poster ? (
            <img src={poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[var(--portfolio-soft)]">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--portfolio-accent)] opacity-15 blur-3xl" />
            </div>
          )}
          <button
            type="button"
            onClick={() => setMode("player")}
            aria-label={`Play ${title} on ${provider.label}`}
            className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/50 via-transparent to-transparent"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-slate-950 shadow-2xl backdrop-blur transition duration-300 group-hover:scale-110">
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            </span>
          </button>
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur">
            {provider.label}
          </span>
        </>
      ) : (
        <>
          <iframe
            key={mode}
            src={embedSrcFor(parsed, mode === "ambient" ? "ambient" : "player")}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          {mode === "ambient" && (
            /* The ambient player has no controls of its own, so this overlay is
               both the affordance and the click target that promotes it. */
            <button
              type="button"
              onClick={() => setMode("player")}
              aria-label={`Play ${title} with sound on ${provider.label}`}
              className="absolute inset-0 flex items-end justify-start bg-gradient-to-t from-black/40 via-transparent to-transparent p-4 transition"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur transition group-hover:bg-black/70">
                <Volume2 className="h-3.5 w-3.5" /> Tap for sound
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );

  if (fill) return frame;

  return (
    <figure className={className}>
      {frame}
      {settings.showCaptions && (media.caption || parsed.pageUrl) && (
        <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-[var(--portfolio-muted)]">
          <span>{media.caption}</span>
          <a
            href={parsed.pageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-bold hover:text-[var(--portfolio-accent)]"
          >
            Watch on {provider.label} <ExternalLink className="h-3 w-3" />
          </a>
        </figcaption>
      )}
    </figure>
  );
}
