"use client";

import { X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";
import type { PortfolioMedia, PortfolioMediaSettings } from "@/utils/portfolio";
import { MEDIA_SURFACE } from "./mediaShared";

/* Portfolio owners supply validated data URLs and arbitrary HTTPS image hosts. */
/* eslint-disable @next/next/no-img-element */

type Props = {
  media: PortfolioMedia;
  settings: PortfolioMediaSettings;
  className?: string;
};

export default function MediaImage({ media, settings, className = "" }: Props) {
  const [expanded, setExpanded] = useState(false);
  const aspect = media.aspectRatio && media.aspectRatio > 0 ? media.aspectRatio : undefined;

  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    // Holding the background still while the viewer is open avoids the page
    // scrolling behind it on touch devices.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [expanded]);

  const image = (
    <img
      src={media.url}
      alt={media.alt || ""}
      loading="lazy"
      decoding="async"
      className={`h-full w-full ${settings.fit === "contain" ? "object-contain" : "object-cover"} transition-transform duration-700 ease-out group-hover:scale-[1.03]`}
    />
  );

  return (
    <figure className={className}>
      <div className={`group relative ${MEDIA_SURFACE}`} style={aspect ? { aspectRatio: String(aspect) } : { aspectRatio: "4 / 3" }}>
        {settings.lightbox ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label={`Expand ${media.alt || "image"}`}
            className="absolute inset-0 h-full w-full cursor-zoom-in"
          >
            {image}
            <span className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
              <ZoomIn className="h-4 w-4" />
            </span>
          </button>
        ) : (
          image
        )}
      </div>

      {settings.showCaptions && media.caption && (
        <figcaption className="mt-3 text-xs leading-5 text-[var(--portfolio-muted)]">{media.caption}</figcaption>
      )}

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={media.alt || "Expanded image"}
          onClick={() => setExpanded(false)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-4 sm:p-10"
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Close image"
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={media.url}
            alt={media.alt || ""}
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full object-contain"
          />
          {media.caption && (
            <p className="absolute inset-x-0 bottom-5 mx-auto max-w-2xl px-6 text-center text-xs leading-5 text-white/70">
              {media.caption}
            </p>
          )}
        </div>
      )}
    </figure>
  );
}
