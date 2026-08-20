"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import PortfolioRenderer from "@/components/portfolio/PortfolioRenderer";
import { PORTFOLIO_TEMPLATES, type PortfolioContent, type PortfolioTheme } from "@/utils/portfolio";
import { miniatureContent } from "@/utils/portfolioMiniature";

/**
 * Choosing a look, by comparing rather than guessing.
 *
 * Six gradient swatches told you the accent colour and nothing else — not which
 * template leads with an image, which numbers the work, which sets the headline
 * at 96px. So each card renders the actual portfolio renderer, with the owner's
 * actual projects, at the template it is offering.
 *
 * All six renderers are mounted on arrival so the appearance choices are
 * immediately comparable. The content is intentionally cheap — see
 * `miniatureContent`, which strips media before any of this happens — and each
 * miniature is inert because it is a picture of a layout, not a page to use.
 */

/** The viewport each miniature is rendered at before being scaled to the card. */
const MINIATURE_WIDTH = 1280;
const MINIATURE_HEIGHT = 860;

function useCardWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return [ref, width] as const;
}

function TemplateCard({
  template,
  content,
  theme,
  selected,
  onSelect,
}: {
  template: (typeof PORTFOLIO_TEMPLATES)[number];
  content: PortfolioContent;
  theme: PortfolioTheme;
  selected: boolean;
  onSelect: () => void;
}) {
  const [ref, width] = useCardWidth();
  const scale = width > 0 ? width / MINIATURE_WIDTH : 0;

  return (
    /* A div, not a button. The miniature below is an entire portfolio — anchors,
       buttons, a contact form — and interactive elements cannot legally nest
       inside a button. The click target is the overlaid button at the end. */
    <div
      data-portfolio-template={template.key}
      className={`group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border text-left transition ${
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50"
      }`}
    >
      <div ref={ref} className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {scale > 0 ? (
          /* Inert on purpose: this is a picture of a layout, not a page to use.
             It is hidden from assistive technology because the card's own name
             and description already say what it is, and a screen reader does not
             want an entire portfolio read out six times. */
          <div
            aria-hidden
            /* `inert`, not just `aria-hidden` and `pointer-events-none`. Neither
               of those takes anything out of the tab order, and a miniature is a
               whole portfolio: without this, tabbing through Appearance walks
               the keyboard into six hidden copies of the owner's nav links,
               project links and contact form. */
            inert
            className="pointer-events-none absolute left-0 top-0 origin-top-left select-none"
            style={{
              width: `${MINIATURE_WIDTH}px`,
              height: `${MINIATURE_HEIGHT}px`,
              transform: `scale(${scale})`,
            }}
          >
            <PortfolioRenderer
              content={content}
              theme={{ ...theme, accent: template.accent }}
              templateKey={template.key}
            />
          </div>
        ) : (
          <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${template.accent}, #0C1E36)` }} />
        )}
        {selected && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-bold text-primary-foreground shadow">
            <Check className="h-3 w-3" /> In use
          </span>
        )}
      </div>
      <div className="min-w-0 p-4">
        <div className="text-sm font-bold text-foreground dark:text-slate-100">{template.name}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{template.description}</div>
      </div>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`Use the ${template.name} template — ${template.description}`}
        className="absolute inset-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      />
    </div>
  );
}

export default function PortfolioTemplateGallery({
  content,
  theme,
  templateKey,
  onChooseTemplate,
}: {
  content: PortfolioContent;
  theme: PortfolioTheme;
  templateKey: string;
  onChooseTemplate: (templateKey: string, accent: string) => void;
}) {
  const miniature = useMemo(() => miniatureContent(content), [content]);
  const hasWork = content.projects.some((project) => project.title.trim());

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PORTFOLIO_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.key}
            template={template}
            content={miniature}
            theme={theme}
            selected={templateKey === template.key}
            onSelect={() => onChooseTemplate(template.key, template.accent)}
          />
        ))}
      </div>
      {!hasWork && (
        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
          These fill in with your own work as you add it. Add a project under Selected work to see how each template treats it.
        </p>
      )}
    </div>
  );
}
