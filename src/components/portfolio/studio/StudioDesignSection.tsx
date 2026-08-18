"use client";

import { Button, Input, Select, Textarea } from "@/components/ui";
import { PORTFOLIO_TEMPLATES, type PortfolioContent, type PortfolioMediaSettings, type PortfolioTheme } from "@/utils/portfolio";
import type { PortfolioSeo } from "@/utils/portfolioDraft";
import { inputClass, labelClass, sectionClass } from "@/components/portfolio/studio/studioStyles";

type Props = {
  content: PortfolioContent;
  theme: PortfolioTheme;
  templateKey: string;
  seo: PortfolioSeo;
  hasProjectMedia: boolean;
  onChooseTemplate: (templateKey: string, accent: string) => void;
  onUpdateTheme: (update: Partial<PortfolioTheme>) => void;
  onUpdateMediaSettings: (update: Partial<PortfolioMediaSettings>) => void;
  onUpdateSeo: (update: Partial<PortfolioSeo>) => void;
  onUpdateContent: (update: Partial<PortfolioContent>) => void;
};

export default function StudioDesignSection({
  content,
  theme,
  templateKey,
  seo,
  hasProjectMedia,
  onChooseTemplate,
  onUpdateTheme,
  onUpdateMediaSettings,
  onUpdateSeo,
  onUpdateContent,
}: Props) {
  return (
    <>
      <section className={sectionClass}>
        <div className="mb-5">
          <h2 className="font-bold text-foreground dark:text-white">Choose your starting point</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Changing templates keeps your content and is always reversible.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PORTFOLIO_TEMPLATES.map((template) => (
            <Button key={template.key} onClick={() => onChooseTemplate(template.key, template.accent)} className={`h-full min-h-32 min-w-0 items-start rounded-xl border p-4 text-left !whitespace-normal transition ${templateKey === template.key ? "border-blue-500 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-950/30" : "border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-700"}`}>
              <div className="mb-3 h-10 w-full rounded-lg" style={{ background: `linear-gradient(135deg, ${template.accent}, #0C1E36)` }} />
              <div className="text-sm font-bold text-foreground dark:text-slate-100">{template.name}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{template.description}</div>
            </Button>
          ))}
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="mb-5 font-bold text-foreground dark:text-white">Appearance & visibility</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2"><span className={labelClass}>Accent</span><Input type="color" className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-transparent dark:border-slate-700" value={theme.accent} onChange={(event) => onUpdateTheme({ accent: event.target.value })} /></label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Site mode</span>
            <Select className={inputClass} value={theme.mode} onChange={(event) => onUpdateTheme({ mode: event.target.value as PortfolioTheme["mode"] })}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </Select>
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Corners</span>
            <Select className={inputClass} value={theme.radius} onChange={(event) => onUpdateTheme({ radius: event.target.value as PortfolioTheme["radius"] })}>
              <option value="soft">Soft</option>
              <option value="sharp">Sharp</option>
            </Select>
          </label>
        </div>
        <div className="mt-6 border-t border-border pt-6">
          <h3 className="text-sm font-bold text-foreground dark:text-white">Media playback</h3>
          {!hasProjectMedia ? (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">These settings appear once a project has images, video, or audio attached. Add media under Selected work and the playback controls will show up here.</p>
          ) : (
            <>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">Applies to your public portfolio and the preview, never to this editor.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Media layout</span>
                  <Select className={inputClass} value={content.mediaSettings.layout} onChange={(event) => onUpdateMediaSettings({ layout: event.target.value as PortfolioMediaSettings["layout"] })}>
                    <option value="grid">Grid</option>
                    <option value="masonry">Masonry</option>
                    <option value="carousel">Carousel</option>
                  </Select>
                </label>
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Image framing</span>
                  <Select className={inputClass} value={content.mediaSettings.fit} onChange={(event) => onUpdateMediaSettings({ fit: event.target.value as PortfolioMediaSettings["fit"] })}>
                    <option value="cover">Fill the frame (crops)</option>
                    <option value="contain">Show the whole image</option>
                  </Select>
                </label>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                {([
                  { key: "autoplayOnScroll", label: "Play video automatically as visitors scroll", hint: "Always muted, because browsers block sound that starts on its own. Paused while off screen, and skipped for visitors who ask for reduced motion or are saving data. Audio never autoplays." },
                  { key: "loop", label: "Loop video and audio", hint: "Restart a clip when it reaches the end." },
                  { key: "hoverPreview", label: "Preview video on hover", hint: "Plays a video cover muted while the pointer rests on its card." },
                  { key: "lightbox", label: "Let visitors expand images", hint: "Clicking an image opens it full screen." },
                  { key: "showCaptions", label: "Show captions under media", hint: "Hide these for a cleaner, more visual page." },
                ] as const).map(({ key, label, hint }) => (
                  <label key={key} className="flex gap-3">
                    <Input id={`media-${key}`} type="checkbox" className="mt-1 shrink-0" checked={content.mediaSettings[key]} onChange={(event) => onUpdateMediaSettings({ [key]: event.target.checked })} />
                    <span>
                      <span className="block text-sm text-slate-700 dark:text-slate-200">{label}</span>
                      <span className="mt-0.5 block text-xs leading-4 text-slate-500 dark:text-slate-400">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {content.mediaSettings.autoplayOnScroll && <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Autoplay starts downloading each video as it scrolls into view, which uses your visitors&apos; data and your storage bandwidth. Embedded video is served by its platform, so it costs you nothing.</p>}
            </>
          )}
        </div>
        <div className="mt-6 border-t border-border pt-6">
          <h3 className="text-sm font-bold text-foreground dark:text-white">Search preview</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Give search engines a useful title and description for your public portfolio.</p>
          <div className="mt-4 grid gap-4">
            <label className="flex flex-col gap-2"><span className={labelClass}>Page title</span><Input className={inputClass} value={seo.title} maxLength={60} placeholder={content.name ? `${content.name} — your work and services` : "Your name — your work and services"} onChange={(event) => onUpdateSeo({ title: event.target.value })} /></label>
            <label className="flex flex-col gap-2"><span className={labelClass}>Description</span><Textarea className={inputClass} rows={3} value={seo.description} maxLength={160} placeholder="A concise description of what you do, who you help, and where to find your work." onChange={(event) => onUpdateSeo({ description: event.target.value })} /></label>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Input id="about-visible" type="checkbox" checked={content.sections.find((section) => section.key === "about")?.visible ?? true} onChange={(event) => onUpdateContent({ sections: content.sections.map((section) => section.key === "about" ? { ...section, visible: event.target.checked } : section) })} />
          <label htmlFor="about-visible" className="text-sm text-slate-600 dark:text-slate-300">Show about section publicly</label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Input id="indexable" type="checkbox" checked={seo.indexable} onChange={(event) => onUpdateSeo({ indexable: event.target.checked })} />
          <label htmlFor="indexable" className="text-sm text-slate-600 dark:text-slate-300">Allow search engines to index my portfolio</label>
        </div>
      </section>
    </>
  );
}
