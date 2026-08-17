import { ArrowUpRight, FileText } from "lucide-react";
import type { PortfolioMedia, PortfolioMediaSettings } from "@/utils/portfolio";

type Props = {
  media: PortfolioMedia;
  settings: PortfolioMediaSettings;
  className?: string;
  /** Case-study pages have room to render the document itself. */
  inline?: boolean;
};

function formatBytes(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(Math.round(bytes / 1024), 1)} KB`;
}

export default function MediaDocument({ media, settings, className = "", inline = false }: Props) {
  const title = media.alt || media.caption || "Document";
  const size = formatBytes(media.bytes);

  return (
    <figure className={className}>
      {inline ? (
        <div className="overflow-hidden rounded-[var(--portfolio-radius)] border border-[var(--portfolio-border)] bg-[var(--portfolio-card)]">
          {/* An iframe, not an <object>: the app's CSP sets object-src 'none',
              which blocked the viewer outright and left every inline document
              showing its fallback. Documents are served from this origin (see
              isProxiedAssetKind) so frame-src 'self' covers them. */}
          {/* Deliberately not sandboxed: `sandbox` without `allow-scripts`
              stops the built-in PDF viewer from rendering at all, and adding
              `allow-scripts` would give away more than it buys. What makes
              this safe is upstream — the asset route pins Content-Type to
              application/pdf from the key's extension and sends nosniff, so
              even a file whose bytes are not a PDF can never be parsed as
              markup, and PDF script runs in the viewer's own sandbox. */}
          <iframe
            src={media.url}
            title={title}
            className="h-[70vh] min-h-96 w-full"
            loading="lazy"
          />
          {/* Browsers without an inline PDF viewer show an empty frame, so the
              direct link stays visible rather than sitting inside the frame as
              unreachable fallback content. */}
          <div className="border-t border-[var(--portfolio-border)] px-5 py-3 text-center">
            <a href={media.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--portfolio-accent)]">
              Open {title} <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      ) : (
        <a
          href={media.url}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-4 rounded-[var(--portfolio-radius)] border border-[var(--portfolio-border)] bg-[var(--portfolio-card)] p-5 transition hover:border-[var(--portfolio-accent)]"
        >
          <span className="grid h-14 w-12 shrink-0 place-items-center rounded-lg bg-[var(--portfolio-soft)] text-[var(--portfolio-accent)]">
            <FileText className="h-6 w-6" strokeWidth={1.5} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold text-[var(--portfolio-ink)]">{title}</span>
            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--portfolio-muted)]">
              PDF{size ? ` · ${size}` : ""}
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--portfolio-muted)] transition group-hover:text-[var(--portfolio-accent)]" />
        </a>
      )}
      {settings.showCaptions && media.caption && media.caption !== title && (
        <figcaption className="mt-3 text-xs leading-5 text-[var(--portfolio-muted)]">{media.caption}</figcaption>
      )}
    </figure>
  );
}
