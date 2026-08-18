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
 * Not six on arrival, though: six renderers is six portfolios rendering, on a
 * page that already has a live preview in it. Only the chosen template renders
 * at first; the others wake on hover or keyboard focus, and having woken they
 * stay mounted rather than being torn down on the way out.
 *
 * That is a deliberate trade, and it does mean someone who runs the pointer
 * across every card ends up with all six mounted. Unmounting on exit was worse:
 * it threw away the painted frame, so moving back over a card you had already
 * seen flashed white and re-rendered. Cheap content is what makes it affordable
 * — see `miniatureContent`, which strips the media before any of this happens.
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
  render,
  onSelect,
  onWake,
}: {
  template: (typeof PORTFOLIO_TEMPLATES)[number];
  content: PortfolioContent;
  theme: PortfolioTheme;
  selected: boolean;
  /** Mount the real renderer. Stays true once woken, so crossing back over a
   *  row already seen shows the painted frame instead of flashing white. */
  render: boolean;
  onSelect: () => void;
  onWake: () => void;
}) {
  const [ref, width] = useCardWidth();
  const scale = width > 0 ? width / MINIATURE_WIDTH : 0;

  return (
    /* A div, not a button. The miniature below is an entire portfolio — anchors,
       buttons, a contact form — and interactive elements cannot legally nest
       inside a button. The click target is the overlaid button at the end. */
    <div
      onMouseEnter={onWake}
      data-portfolio-template={template.key}
      className={`group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border text-left transition ${
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50"
      }`}
    >
      <div ref={ref} className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {render && scale > 0 ? (
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
        onFocus={onWake}
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
  /* Which cards have ever been shown live. Tracked here, in the handlers that
     cause it, rather than in an effect reacting to it. */
  const [awakened, setAwakened] = useState<Set<string>>(() => new Set([templateKey]));
  const miniature = useMemo(() => miniatureContent(content), [content]);
  const hasWork = content.projects.some((project) => project.title.trim());

  const wake = (key: string) => setAwakened((current) => (current.has(key) ? current : new Set(current).add(key)));

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
            render={templateKey === template.key || awakened.has(template.key)}
            onSelect={() => {
              wake(template.key);
              onChooseTemplate(template.key, template.accent);
            }}
            onWake={() => wake(template.key)}
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
