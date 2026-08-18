"use client";

import { Button, PageHeader } from "@/components/ui";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, ExternalLink, Globe2, Inbox, Layers, LayoutTemplate, BarChart3, Sparkles, UserRound, FolderKanban, BriefcaseBusiness, Settings2 } from "lucide-react";
import type { PortfolioContent } from "@/utils/portfolio";
import PortfolioAnalyticsPanel from "@/components/portfolio/PortfolioAnalyticsPanel";
import PortfolioInquiriesPanel from "@/components/portfolio/PortfolioInquiriesPanel";
import PortfolioLivePreview, { type PreviewDevice } from "@/components/portfolio/PortfolioLivePreview";
import PortfolioNextSteps, { getPortfolioSteps, type StudioSection } from "@/components/portfolio/PortfolioNextSteps";
import StudioDesignSection from "@/components/portfolio/studio/StudioDesignSection";
import StudioPracticesSection from "@/components/portfolio/studio/StudioPracticesSection";
import StudioProfileSection from "@/components/portfolio/studio/StudioProfileSection";
import StudioServicesSection from "@/components/portfolio/studio/StudioServicesSection";
import StudioTestimonialsSection from "@/components/portfolio/studio/StudioTestimonialsSection";
import StudioWorkSection from "@/components/portfolio/studio/StudioWorkSection";
import { FirstVisitNote } from "@/components/dashboard/ActivationCard";
import { usePortfolioDraft } from "@/hooks/usePortfolioDraft";

function getPortfolioReadiness(content: PortfolioContent, seo: { title: string; description: string }, status: string) {
  const publicProjects = content.projects.filter((project) => project.visibility !== "private");
  const checks = [
    { label: "identity", complete: Boolean(content.name.trim()) },
    { label: "headline and introduction", complete: Boolean(content.headline.trim() && content.bio.trim()) },
    { label: "one public project", complete: publicProjects.some((project) => Boolean(project.title.trim())) },
    { label: "one service", complete: content.services.some((service) => Boolean(service.title.trim())) },
    { label: "contact details", complete: Boolean(content.contactEmail.trim() || content.location.trim()) },
    { label: "portfolio published", complete: status === "published" },
    { label: "search preview", complete: Boolean(seo.title.trim() && seo.description.trim()) },
  ];
  const completed = checks.filter((check) => check.complete).length;
  return { checks, completed, score: Math.round((completed / checks.length) * 100) };
}

export default function PortfolioDashboardPage() {
  const {
    portfolio,
    content,
    theme,
    templateKey,
    slug,
    seo,
    loading,
    loadError,
    saving,
    saveError,
    conflictState,
    loadPortfolio,
    persist,
    updateContent,
    updateSlug,
    updateTheme,
    updateSeo,
    updateMediaSettings,
    chooseTemplate,
    handleImageUpload,
    handleProfileImageUpload,
    persistProfileImage,
    reloadLatestPortfolio,
    reloadAndKeepLocalDraft,
  } = usePortfolioDraft();

  const [tab, setTab] = useState<"edit" | "preview" | "analytics" | "inquiries">("edit");
  const [unreadInquiries, setUnreadInquiries] = useState(0);
  const [copied, setCopied] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("mobile");
  /* Tracked in JS rather than hidden with CSS: a `hidden` pane still mounts its
     iframe, which would put two previews in the DOM, load /portfolio-preview
     twice on every visit, and make any selector matching the frame ambiguous. */
  const [wideEnoughForSidePreview, setWideEnoughForSidePreview] = useState(false);
  /* Opens on the work, because the work is the portfolio. The old default was
     the profile form, which put the least differentiating screen first. */
  const [editorSection, setEditorSection] = useState<StudioSection>("work");

  const savedPublicUrl = portfolio?.status === "published"
    ? (typeof window !== "undefined" ? `${window.location.origin}/p/${portfolio.slug}` : `/p/${portfolio.slug}`)
    : null;
  const readiness = getPortfolioReadiness(content, seo, portfolio?.status || "draft");
  const steps = getPortfolioSteps(content, seo, portfolio?.status || "draft");
  /* Playback controls stay out of the way until there is media for them to
     govern — seven toggles are noise on a portfolio with no video in it. */
  const hasProjectMedia = content.projects.some((project) => (project.media || []).length > 0);

  /* The unread count is loaded up front so the tab can carry a badge without
     the owner having to open it first. A failure here is silent: an absent
     badge is a far smaller problem than a toast on every studio visit. */
  useEffect(() => {
    let active = true;
    fetch("/api/portfolio/inquiries?status=new&pageSize=1")
      .then((response) => response.json())
      .then((data) => {
        if (active && data?.success) setUnreadInquiries(data.unread || 0);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  /* Preview delivery lives in PortfolioLivePreview, which debounces it. This
     only decides whether the side-by-side pane exists at all. */
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1536px)");
    const sync = () => setWideEnoughForSidePreview(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const copyUrl = async () => {
    if (!savedPublicUrl) return;
    await navigator.clipboard.writeText(savedPublicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (loading) return <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground dark:text-slate-400">Loading portfolio studio...</div>;

  if (loadError || !portfolio) {
    return (
      <div className="flex min-h-80 items-center justify-center px-4">
        <section role="alert" className="w-full max-w-lg rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-red-900 shadow-sm dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
          <h1 className="text-lg font-black">Your portfolio could not be loaded</h1>
          <p className="mt-2 text-sm leading-6 text-red-800 dark:text-red-200">Rive has not opened the editor because your saved portfolio is unavailable. Retry when your connection is ready. Any local recovery copy will remain untouched.</p>
          {loadError && <p className="mt-3 break-words text-xs text-red-700/80 dark:text-red-200/80">{loadError}</p>}
          <Button onClick={() => void loadPortfolio()} disabled={loading} className="mt-5 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">Retry loading portfolio</Button>
        </section>
      </div>
    );
  }

  return (
    <div className="portfolio-editor-panels workspace-page gap-5">
      <PageHeader
        className="sm:flex-col xl:flex-row"
        title={<span className="flex items-center gap-2"><Globe2 className="h-6 w-6 text-primary" /> Portfolio Studio</span>}
        description="Build a portfolio that makes your work easy to understand and easy to hire."
        actions={savedPublicUrl ? <a href={savedPublicUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-accent"><ExternalLink className="h-4 w-4" /> View live site</a> : undefined}
      />

      <div data-portfolio-sticky-actions className="sticky -top-3 z-20 flex min-h-12 flex-wrap items-center justify-end gap-2 border-y border-border bg-background px-1 py-2 sm:-top-4 sm:px-2 md:-top-6 xl:-top-8">
        <Button data-guide-target="portfolio-publish" onClick={() => void persist({ status: "published" })} disabled={saving} className="h-9 px-3 text-xs"><Check className="h-3.5 w-3.5" /> {portfolio?.status === "published" ? "Update live site" : "Publish portfolio"}</Button>
      </div>

      {portfolio.status !== "published" && readiness.score < 100 && (
        <FirstVisitNote>
          Your profile and selected projects become public proof of work. Fill the essentials first; optional case-study detail can wait.
        </FirstVisitNote>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border dark:border-slate-800">
        <div className="flex flex-wrap gap-1">
          {([
            { key: "edit", label: "Editor", icon: LayoutTemplate },
            { key: "preview", label: "Preview", icon: Eye },
            { key: "analytics", label: "Analytics", icon: BarChart3 },
            { key: "inquiries", label: "Enquiries", icon: Inbox },
          ] as const).map(({ key, label, icon: Icon }) => (
            <Button key={key} onClick={() => setTab(key)} aria-current={tab === key ? "page" : undefined} className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
              <Icon className="mr-1 inline h-4 w-4" /> {label}
              {key === "inquiries" && unreadInquiries > 0 && (
                <span aria-label={`${unreadInquiries} unread`} className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-black tabular-nums text-primary-foreground">
                  {unreadInquiries > 99 ? "99+" : unreadInquiries}
                </span>
              )}
            </Button>
          ))}
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span className={`h-2 w-2 rounded-full ${portfolio?.status === "published" ? "bg-emerald-500" : "bg-amber-500"}`} /> {portfolio?.status === "published" ? "Published" : "Draft — publish when you are ready"}{savedPublicUrl && <><span className="hidden truncate sm:inline">· {savedPublicUrl}</span><Button onClick={copyUrl} className="shrink-0 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" title="Copy live portfolio URL" aria-label="Copy live portfolio URL">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</Button></>}</div>
      </div>

      {saveError && <div data-portfolio-save-alert role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"><span><strong>{conflictState ? "Your portfolio changed elsewhere." : "Could not save your changes."}</strong> {saveError}</span>{conflictState ? <div className="flex flex-wrap gap-2"><Button onClick={() => void reloadLatestPortfolio()} disabled={saving || loading} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-800 dark:border-red-800 dark:text-red-100">Reload latest</Button><Button onClick={() => void reloadAndKeepLocalDraft()} disabled={saving || loading} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">Keep my draft</Button></div> : <Button onClick={() => void persist()} disabled={saving} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-800 dark:border-red-800 dark:text-red-100">Retry</Button>}</div>}

      {/* Above the shell, not inside a panel: what to do next is true of the
          whole portfolio, not of whichever section happens to be open. */}
      {tab === "edit" && <PortfolioNextSteps steps={steps} onGoTo={setEditorSection} />}

      {tab === "edit" && <div className="grid min-h-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div data-portfolio-editor-shell className="grid min-h-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-muted/35 p-4 lg:border-b-0 lg:border-r">
            <nav data-portfolio-section-nav className="grid grid-cols-2 gap-2 sm:grid-cols-6 lg:sticky lg:top-5 lg:grid-cols-1">
            {/* Work leads: it is the thing a portfolio is for. Practices keeps a
                permanent slot because running two disciplines from one portfolio
                is a genuine differentiator, but its label says plainly who it is
                for so the majority with one discipline can skip it. */}
            {([
              { key: "work", label: "Selected work", sub: `${content.projects.length} projects`, icon: FolderKanban },
              { key: "profile", label: "Profile", sub: "Identity and contact", icon: UserRound },
              { key: "practices", label: "Practices", sub: content.practices.length > 0 ? `${content.practices.length} practices` : "Two disciplines?", icon: Layers },
              { key: "services", label: "Services", sub: `${content.services.length} services`, icon: BriefcaseBusiness },
              { key: "proof", label: "Testimonials", sub: `${content.testimonials.length} added`, icon: Sparkles },
              { key: "design", label: "Appearance", sub: "Theme and visibility", icon: Settings2 },
            ] as const).map(({ key, label, sub, icon: Icon }) => (
              <Button data-guide-target={key === "profile" ? "portfolio-profile" : key === "work" ? "portfolio-project" : undefined} data-portfolio-section={key} key={key} onClick={() => setEditorSection(key)} className={`grid min-h-14 w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${editorSection === key ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-blue-300 dark:ring-slate-700" : "text-slate-600 hover:bg-white/70 dark:text-slate-400 dark:hover:bg-slate-800/70"}`}>
                <Icon className="h-4 w-4 justify-self-center" />
                <span className="min-w-0"><span className="block truncate text-xs font-bold">{label}</span><span className="hidden truncate text-xs leading-4 text-slate-400 lg:block">{sub}</span></span>
              </Button>
            ))}
            <div className="col-span-2 mt-2 border-t border-slate-200 pt-3 dark:border-slate-700 sm:col-span-6 lg:col-span-1">
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-500"><Sparkles className="h-3.5 w-3.5 text-blue-500" /> Readiness</span><span className="text-xs font-black text-foreground dark:text-white">{readiness.score}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${readiness.score}%` }} /></div>
              <p className="mt-2 text-xs leading-4 text-slate-500">{readiness.completed} of {readiness.checks.length} signals complete. The worklist above says which.</p>
            </div>
          </nav>
        </aside>
        <div className="portfolio-editor-panels flex min-w-0 flex-col gap-5 p-5 sm:p-7">
          {editorSection === "profile" && (
            <StudioProfileSection
              content={content}
              slug={slug}
              templateKey={templateKey}
              saving={saving}
              onUpdateContent={updateContent}
              onUpdateSlug={updateSlug}
              onUploadProfileImage={(file) => { void handleProfileImageUpload(file); }}
              onPersistProfileImage={persistProfileImage}
            />
          )}
          {editorSection === "work" && (
            <StudioWorkSection
              content={content}
              onUpdateContent={updateContent}
              onUploadCover={handleImageUpload}
            />
          )}
          {editorSection === "practices" && (
            <StudioPracticesSection content={content} slug={slug} onUpdateContent={updateContent} />
          )}
          {editorSection === "proof" && (
            <StudioTestimonialsSection content={content} onUpdateContent={updateContent} />
          )}
          {editorSection === "services" && (
            <StudioServicesSection content={content} onUpdateContent={updateContent} />
          )}
          {editorSection === "design" && (
            <StudioDesignSection
              content={content}
              theme={theme}
              templateKey={templateKey}
              seo={seo}
              hasProjectMedia={hasProjectMedia}
              onChooseTemplate={chooseTemplate}
              onUpdateTheme={updateTheme}
              onUpdateMediaSettings={updateMediaSettings}
              onUpdateSeo={updateSeo}
              onUpdateContent={updateContent}
            />
          )}
        </div>
      </div>
      {/* Beside the editor on a wide screen, so a change to the accent or the
          template is seen where it is made. Narrower screens keep the Preview
          tab, which is the same thing at full width. */}
      {wideEnoughForSidePreview && (
        <aside>
          <div className="sticky top-5">
            <PortfolioLivePreview
              content={content}
              theme={theme}
              templateKey={templateKey}
              device={previewDevice}
              onDeviceChange={setPreviewDevice}
              frameClassName="h-[calc(100vh-12rem)]"
              liveSiteUrl={savedPublicUrl}
            />
          </div>
        </aside>
      )}
      </div>}

      {tab === "preview" && <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-5">
        <div className="mb-4">
          <p className="text-xs font-bold text-foreground dark:text-white">Responsive preview</p>
          <p className="mt-0.5 text-xs text-slate-500">Review the complete experience at common viewport sizes before publishing.</p>
        </div>
        <PortfolioLivePreview
          content={content}
          theme={theme}
          templateKey={templateKey}
          device={previewDevice}
          onDeviceChange={setPreviewDevice}
          frameClassName="h-[75vh]"
        />
      </div>}

      {tab === "analytics" && <PortfolioAnalyticsPanel published={portfolio.status === "published"} />}

      {tab === "inquiries" && <PortfolioInquiriesPanel onUnreadChange={setUnreadInquiries} />}
    </div>
  );
}
