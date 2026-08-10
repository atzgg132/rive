"use client";

import { Button, Input, PageHeader, Textarea, Select } from "@/components/ui";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, ExternalLink, Globe2, LayoutTemplate, Plus, Save, Trash2, BarChart3, Upload, Monitor, Smartphone, Tablet, Sparkles, UserRound, FolderKanban, BriefcaseBusiness, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_PORTFOLIO_CONTENT, DEFAULT_PORTFOLIO_THEME, mergePortfolioContent, normalizeSlug, PORTFOLIO_TEMPLATES, type PortfolioContent, type PortfolioProject, type PortfolioTheme } from "@/utils/portfolio";
import { uploadImage } from "@/utils/clientUploads";
import PortfolioProjectEditor from "@/components/portfolio/PortfolioProjectEditor";

/* Validated portfolio uploads and remote image hosts cannot use a static Next image allowlist. */
/* eslint-disable @next/next/no-img-element */

type PortfolioRecord = {
  id: string;
  slug: string;
  status: string;
  templateKey: string;
  content: PortfolioContent;
  theme: PortfolioTheme;
  seo: { title?: string; description?: string; indexable?: boolean } | null;
  revision: number;
};

type Analytics = {
  totalViews: number;
  uniqueVisitors: number;
  averageViewsPerDay: number;
  peakDay: string | null;
  timeline: { day: string; count: number }[];
  referrers: { source: string; count: number }[];
  devices: { device: string; count: number }[];
};

type SaveState = "loading" | "saved" | "dirty" | "saving" | "error";

type PortfolioDraftSnapshot = {
  revision: number;
  content: PortfolioContent;
  theme: PortfolioTheme;
  templateKey: string;
  slug: string;
  seo: { title: string; description: string; indexable: boolean };
};

type PortfolioDraftOverrides = Partial<Pick<PortfolioDraftSnapshot, "content" | "theme" | "templateKey" | "slug" | "seo">>;

const inputClass = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-blue-950";
const labelClass = "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-slate-400";

function id(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }

function CaseStudyFields({ project, onChange }: { project: PortfolioProject; onChange: (update: Partial<PortfolioProject>) => void }) {
  void project;
  void onChange;

  return null;
  /*
  return (
    <div className="sm:col-span-2 border-t border-slate-200 pt-5 dark:border-slate-700">
      <div className="mb-4"><p className="text-xs font-bold text-foreground dark:text-white">Case study details</p><p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">These fields power the dedicated public case-study page.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input className={inputClass} value={project.client || ""} placeholder="Client or independent project" onChange={(event) => onChange({ client: event.target.value })} />
        <Input className={inputClass} value={project.timeline || ""} placeholder="Timeline, e.g. 8 weeks" onChange={(event) => onChange({ timeline: event.target.value })} />
        <Input className={`${inputClass} sm:col-span-2`} value={(project.deliverables || []).join(", ")} placeholder="Deliverables (comma separated)" onChange={(event) => onChange({ deliverables: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[11px] font-bold text-foreground dark:text-white">Project gallery</p><p className="mt-0.5 text-[10px] text-slate-500">Up to 12 images · upload or paste an HTTPS URL</p></div>
        <div className="flex gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"><Upload className="h-3.5 w-3.5" /> Upload images<Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="sr-only" onChange={(event) => { uploadGalleryImages(event.target.files); event.currentTarget.value = ""; }} /></label>
          <Button type="button" onClick={addGalleryUrl} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-2 text-[10px] font-bold text-white"><Plus className="h-3.5 w-3.5" /> Image URL</Button>
        </div>
      </div>
      {(project.gallery || []).length > 0 && <div className="mt-4 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-700 dark:border-slate-700">{(project.gallery || []).map((image, imageIndex) => <div key={image.id} className="grid gap-3 py-3 sm:grid-cols-[56px_1fr_auto]">
        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg bg-slate-100 text-[10px] font-bold text-slate-400 dark:bg-slate-800">{image.url ? <img src={image.url} alt="" className="h-full w-full object-cover" /> : imageIndex + 1}</div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2"><Input className={`${inputClass} sm:col-span-2`} value={image.url.startsWith("data:") ? "uploaded image" : image.url} readOnly={image.url.startsWith("data:")} placeholder="https://example.com/image.jpg" onChange={(event) => updateGalleryImage(image.id, { url: event.target.value })} /><Input className={inputClass} value={image.alt} placeholder="Accessible description" onChange={(event) => updateGalleryImage(image.id, { alt: event.target.value })} /><Input className={inputClass} value={image.caption} placeholder="Caption (optional)" onChange={(event) => updateGalleryImage(image.id, { caption: event.target.value })} /></div>
        <Button type="button" title="Remove gallery image" onClick={() => onChange({ gallery: (project.gallery || []).filter((item) => item.id !== image.id) })} className="self-start rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></Button>
      </div>)}</div>}
    </div>
  );
  */
}

void CaseStudyFields;

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
  const [portfolio, setPortfolio] = useState<PortfolioRecord | null>(null);
  const [content, setContent] = useState<PortfolioContent>(DEFAULT_PORTFOLIO_CONTENT);
  const [theme, setTheme] = useState<PortfolioTheme>(DEFAULT_PORTFOLIO_THEME);
  const [templateKey, setTemplateKey] = useState("minimal-pro");
  const [slug, setSlug] = useState("");
  const [seo, setSeo] = useState({ title: "", description: "", indexable: true });
  const [tab, setTab] = useState<"edit" | "preview" | "analytics">("edit");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [saveError, setSaveError] = useState("");
  const [conflictState, setConflictState] = useState(false);
  const [recoveryDraft, setRecoveryDraft] = useState<PortfolioDraftSnapshot | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const contentRef = useRef(content);
  const themeRef = useRef(theme);
  const templateKeyRef = useRef(templateKey);
  const slugRef = useRef(slug);
  const seoRef = useRef(seo);
  const editVersionRef = useRef(0);
  const draftHydratedRef = useRef(false);
  const [editorSection, setEditorSection] = useState<"profile" | "work" | "services" | "proof" | "design">("profile");

  const savedPublicUrl = portfolio?.status === "published"
    ? (typeof window !== "undefined" ? `${window.location.origin}/p/${portfolio.slug}` : `/p/${portfolio.slug}`)
    : null;
  const readiness = getPortfolioReadiness(content, seo, portfolio?.status || "draft");
  const displayedSaveState: SaveState = saving ? "saving" : saveError ? "error" : dirty ? "dirty" : saveState === "loading" ? "loading" : "saved";

  useEffect(() => {
    contentRef.current = content;
    themeRef.current = theme;
    templateKeyRef.current = templateKey;
    slugRef.current = slug;
    seoRef.current = seo;
  }, [content, seo, slug, templateKey, theme]);

  const loadPortfolio = useCallback(async ({ preserveRecovery = true }: { preserveRecovery?: boolean } = {}) => {
    setLoading(true);
    setLoadError("");
    setSaveError("");
    try {
      let response = await fetch("/api/portfolio");
      let data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        throw new Error(data.message || "Could not load your portfolio.");
      }
      if (!data.portfolio) {
        response = await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
          throw new Error(data.message || "Could not create your portfolio.");
        }
      }
      if (!data.portfolio) throw new Error("Rive did not return a portfolio record.");
      const record = data.portfolio as PortfolioRecord;
      setPortfolio(record);
      setContent(mergePortfolioContent(record.content));
      setTheme({ ...DEFAULT_PORTFOLIO_THEME, ...(record.theme || {}) });
      setTemplateKey(record.templateKey);
      setSlug(record.slug);
      setSeo({ title: record.seo?.title || "", description: record.seo?.description || "", indexable: record.seo?.indexable !== false });
      setDirty(false);
      setConflictState(false);
      draftHydratedRef.current = true;
      if (preserveRecovery) {
        try {
          const stored = window.localStorage.getItem(`rive:portfolio-draft:${record.id}`);
          if (stored) {
            const parsed = JSON.parse(stored) as PortfolioDraftSnapshot;
            if (parsed && parsed.content && parsed.theme && parsed.seo && typeof parsed.slug === "string") {
              setRecoveryDraft(parsed);
            }
          }
        } catch {
          // Keep a recovery copy even if it cannot be parsed right now.
        }
      } else {
        window.localStorage.removeItem(`rive:portfolio-draft:${record.id}`);
        setRecoveryDraft(null);
      }
      setSaveState("saved");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load your portfolio.";
      setSaveState("error");
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadPortfolio();
    }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadPortfolio]);

  useEffect(() => {
    if (tab !== "analytics" || analytics) return;
    fetch("/api/portfolio/analytics").then((response) => response.json()).then((data) => {
      if (data.success) setAnalytics(data.analytics);
    }).catch(() => toast.error("could not load portfolio analytics"));
  }, [tab, analytics]);

  useEffect(() => {
    if (tab !== "preview") return;
    previewFrameRef.current?.contentWindow?.postMessage({
      type: "rive:portfolio-preview",
      payload: { content, theme, templateKey },
    }, window.location.origin);
  }, [content, previewDevice, tab, templateKey, theme]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const flushDraftSnapshot = useCallback((overrides: PortfolioDraftOverrides = {}) => {
    if (!portfolio || !draftHydratedRef.current) return;
    try {
      const snapshot: PortfolioDraftSnapshot = {
        revision: portfolio.revision,
        content: overrides.content ?? contentRef.current,
        theme: overrides.theme ?? themeRef.current,
        templateKey: overrides.templateKey ?? templateKeyRef.current,
        slug: overrides.slug ?? slugRef.current,
        seo: overrides.seo ?? seoRef.current,
      };
      window.localStorage.setItem(`rive:portfolio-draft:${portfolio.id}`, JSON.stringify(snapshot));
    } catch {
      // Local recovery is best-effort; the server remains the source of truth.
    }
  }, [portfolio]);

  useEffect(() => {
    if (!portfolio || !draftHydratedRef.current) return;
    const storageKey = `rive:portfolio-draft:${portfolio.id}`;
    if (!dirty && !recoveryDraft) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Recovery storage is best-effort.
      }
      return;
    }
    const timer = window.setTimeout(() => {
      flushDraftSnapshot();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [content, dirty, flushDraftSnapshot, portfolio, recoveryDraft, seo, slug, templateKey, theme]);

  const markDirty = (overrides: PortfolioDraftOverrides = {}) => {
    editVersionRef.current += 1;
    setDirty(true);
    setSaveState("dirty");
    setSaveError("");
    setConflictState(false);
    flushDraftSnapshot(overrides);
  };

  const updateSlug = (value: string) => {
    const nextSlug = normalizeSlug(value);
    slugRef.current = nextSlug;
    setSlug(nextSlug);
    markDirty({ slug: nextSlug });
  };

  const updateTheme = (update: Partial<PortfolioTheme>) => {
    const nextTheme = { ...themeRef.current, ...update };
    themeRef.current = nextTheme;
    setTheme(nextTheme);
    markDirty({ theme: nextTheme });
  };

  const updateSeo = (update: Partial<typeof seo>) => {
    const nextSeo = { ...seoRef.current, ...update };
    seoRef.current = nextSeo;
    setSeo(nextSeo);
    markDirty({ seo: nextSeo });
  };

  const chooseTemplate = (nextTemplateKey: string, accent: string) => {
    const nextTheme = { ...themeRef.current, accent };
    templateKeyRef.current = nextTemplateKey;
    themeRef.current = nextTheme;
    setTemplateKey(nextTemplateKey);
    setTheme(nextTheme);
    markDirty({ templateKey: nextTemplateKey, theme: nextTheme });
  };

  const updateContent = (update: Partial<PortfolioContent>) => {
    const nextContent = { ...contentRef.current, ...update };
    contentRef.current = nextContent;
    setContent(nextContent);
    markDirty({ content: nextContent });
  };

  const handleImageUpload = async (projectId: string, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("images must be 5 MB or smaller");
      return;
    }
    try {
      const imageUrl = await uploadImage(file);
      const nextContent = { ...contentRef.current, projects: contentRef.current.projects.map((item) => item.id === projectId ? { ...item, imageUrl } : item) };
      contentRef.current = nextContent;
      setContent(nextContent);
      markDirty({ content: nextContent });
      toast.success("image added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "could not upload image");
    }
  };

  async function save(
    nextStatus?: "draft" | "published",
    contentOverride?: PortfolioContent,
    successMessage?: string,
  ) {
    if (!portfolio) return;
    const submittedEditVersion = editVersionRef.current;
    const submittedContent = contentOverride ?? contentRef.current;
    setSaving(true);
    setSaveState("saving");
    setSaveError("");
    try {
      const response = await fetch("/api/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: portfolio.revision, content: submittedContent, theme: themeRef.current, templateKey: templateKeyRef.current, slug: slugRef.current, seo: seoRef.current, status: nextStatus }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && data.conflict) {
          setConflictState(true);
          throw new Error("This portfolio changed in another tab. Reload the latest version or keep your local draft.");
        }
        setConflictState(false);
        throw new Error(data.message || "could not save portfolio");
      }
      setPortfolio(data.portfolio);
      if (submittedEditVersion === editVersionRef.current) {
        setContent(mergePortfolioContent(data.portfolio.content));
        setTheme({ ...DEFAULT_PORTFOLIO_THEME, ...(data.portfolio.theme || {}) });
        setTemplateKey(data.portfolio.templateKey);
        setSlug(data.portfolio.slug);
        setSeo({ title: data.portfolio.seo?.title || "", description: data.portfolio.seo?.description || "", indexable: data.portfolio.seo?.indexable !== false });
        setDirty(false);
        setSaveState("saved");
        setRecoveryDraft(null);
        setConflictState(false);
        window.localStorage.removeItem(`rive:portfolio-draft:${data.portfolio.id}`);
      } else {
        setSaveState("dirty");
      }
      toast.success(successMessage || (nextStatus === "published" ? "portfolio published" : "portfolio saved"));
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "could not save portfolio");
      toast.error(error instanceof Error ? error.message : "could not save portfolio");
    } finally {
      setSaving(false);
    }
  }

  const reloadLatestPortfolio = async () => {
    if (portfolio) window.localStorage.removeItem(`rive:portfolio-draft:${portfolio.id}`);
    setRecoveryDraft(null);
    setDirty(false);
    await loadPortfolio({ preserveRecovery: false });
  };

  const reloadAndKeepLocalDraft = async () => {
    flushDraftSnapshot();
    await loadPortfolio({ preserveRecovery: true });
  };

  const restoreRecoveryDraft = () => {
    if (!recoveryDraft) return;
    const restoredContent = mergePortfolioContent(recoveryDraft.content);
    contentRef.current = restoredContent;
    themeRef.current = recoveryDraft.theme;
    templateKeyRef.current = recoveryDraft.templateKey;
    slugRef.current = recoveryDraft.slug;
    seoRef.current = recoveryDraft.seo;
    setContent(restoredContent);
    setTheme(recoveryDraft.theme);
    setTemplateKey(recoveryDraft.templateKey);
    setSlug(recoveryDraft.slug);
    setSeo(recoveryDraft.seo);
    setRecoveryDraft(null);
    markDirty(recoveryDraft);
  };

  const persistProfileImage = (profileImageUrl: string, message: string) => {
    const nextContent = { ...contentRef.current, profileImageUrl };
    contentRef.current = nextContent;
    setContent(nextContent);
    markDirty({ content: nextContent });
    void save(undefined, nextContent, message);
  };

  const handleProfileImageUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("choose a PNG, JPEG, or WebP image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("profile photos must be 2 MB or smaller");
      return;
    }
    try {
      persistProfileImage(await uploadImage(file), "profile photo saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "could not upload profile photo");
    }
  };

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
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 py-4 backdrop-blur">
        <PageHeader
          className="sm:flex-col xl:flex-row"
          title={<span className="flex items-center gap-2"><Globe2 className="h-6 w-6 text-primary" /> Portfolio Studio</span>}
          description="Build a portfolio that makes your work easy to understand and easy to hire."
          actions={<>
            {savedPublicUrl && <a href={savedPublicUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground shadow-sm hover:bg-accent"><ExternalLink className="h-4 w-4" /> View live site</a>}
            <div role="status" aria-live="polite" className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ${displayedSaveState === "error" ? "bg-destructive/10 text-destructive" : displayedSaveState === "saved" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}><span className={`h-1.5 w-1.5 rounded-full ${displayedSaveState === "error" ? "bg-destructive" : displayedSaveState === "saved" ? "bg-success" : displayedSaveState === "saving" ? "animate-pulse bg-primary" : "bg-warning"}`} /> {displayedSaveState === "saving" ? "Saving…" : displayedSaveState === "error" ? "Save failed" : displayedSaveState === "saved" ? "Saved" : "Unsaved changes"}</div>
            <Button variant="outline" onClick={() => save()} disabled={saving || !dirty}><Save /> {saving ? "Saving…" : "Save draft"}</Button>
            <Button onClick={() => save("published")} disabled={saving}><Check /> {portfolio?.status === "published" ? "Update live site" : "Publish portfolio"}</Button>
          </>}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border dark:border-slate-800">
        <div className="flex flex-wrap gap-1"><Button onClick={() => setTab("edit")} className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab === "edit" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><LayoutTemplate className="mr-1 inline h-4 w-4" /> Editor</Button><Button onClick={() => setTab("preview")} className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab === "preview" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><Eye className="mr-1 inline h-4 w-4" /> Preview</Button><Button onClick={() => setTab("analytics")} className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab === "analytics" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><BarChart3 className="mr-1 inline h-4 w-4" /> Analytics</Button></div>
        <div className="flex max-w-full flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span className={`h-2 w-2 rounded-full ${portfolio?.status === "published" ? "bg-emerald-500" : "bg-amber-500"}`} /> {portfolio?.status === "published" ? "Published" : "Draft — publish when you are ready"}{dirty && <span className="font-semibold text-amber-700 dark:text-amber-300">· Unsaved changes</span>}{savedPublicUrl && <><span className="hidden truncate sm:inline">· {savedPublicUrl}</span><Button onClick={copyUrl} className="shrink-0 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" title="Copy live portfolio URL" aria-label="Copy live portfolio URL">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</Button></>}</div>
      </div>

      {recoveryDraft && !dirty && <div role="status" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">We found unsaved changes from before this page was reloaded.</p><p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/80">Restore them to continue editing, or discard this local recovery copy.</p></div><div className="flex shrink-0 gap-2"><Button onClick={restoreRecoveryDraft} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white">Restore changes</Button><Button onClick={() => { window.localStorage.removeItem(`rive:portfolio-draft:${portfolio?.id}`); setRecoveryDraft(null); }} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 dark:border-amber-800 dark:text-amber-100">Discard</Button></div></div>}
      {saveError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"><span><strong>{conflictState ? "Your portfolio changed elsewhere." : "Could not save your changes."}</strong> {saveError}</span>{conflictState ? <div className="flex flex-wrap gap-2"><Button onClick={() => void reloadLatestPortfolio()} disabled={saving || loading} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-800 dark:border-red-800 dark:text-red-100">Reload latest</Button><Button onClick={() => void reloadAndKeepLocalDraft()} disabled={saving || loading} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">Keep my draft</Button></div> : <Button onClick={() => save()} disabled={saving || !dirty} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-800 dark:border-red-800 dark:text-red-100">Retry</Button>}</div>}

      {tab === "edit" && <div className="grid min-h-[680px] overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-muted/35 p-4 lg:border-b-0 lg:border-r">
            <nav data-portfolio-section-nav className="grid grid-cols-2 gap-2 sm:grid-cols-5 lg:sticky lg:top-5 lg:grid-cols-1">
            {([
              { key: "profile", label: "Profile", sub: "Identity and contact", icon: UserRound },
              { key: "work", label: "Selected work", sub: `${content.projects.length} projects`, icon: FolderKanban },
              { key: "services", label: "Services", sub: `${content.services.length} services`, icon: BriefcaseBusiness },
              { key: "proof", label: "Testimonials", sub: `${content.testimonials.length} added`, icon: Sparkles },
              { key: "design", label: "Appearance", sub: "Theme and visibility", icon: Settings2 },
            ] as const).map(({ key, label, sub, icon: Icon }) => (
              <Button data-portfolio-section={key} key={key} onClick={() => setEditorSection(key)} className={`grid min-h-14 w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${editorSection === key ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-blue-300 dark:ring-slate-700" : "text-slate-600 hover:bg-white/70 dark:text-slate-400 dark:hover:bg-slate-800/70"}`}>
                <Icon className="h-4 w-4 justify-self-center" />
                <span className="min-w-0"><span className="block truncate text-xs font-bold">{label}</span><span className="hidden truncate text-[10px] leading-4 text-slate-400 lg:block">{sub}</span></span>
              </Button>
            ))}
            <div className="col-span-2 mt-2 border-t border-slate-200 pt-3 dark:border-slate-700 sm:col-span-5 lg:col-span-1">
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"><Sparkles className="h-3.5 w-3.5 text-blue-500" /> Readiness</span><span className="text-xs font-black text-foreground dark:text-white">{readiness.score}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${readiness.score}%` }} /></div>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">{readiness.completed} of {readiness.checks.length} quality signals complete.</p>
            </div>
          </nav>
        </aside>
        <div className="portfolio-editor-panels flex min-w-0 flex-col gap-5 p-5 sm:p-7">
          <section className="hidden">
            <div className="grid gap-6 p-6 sm:grid-cols-[160px_1fr] sm:items-center">
              <div className="relative mx-auto grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(#60A5FA ${readiness.score}%, rgba(255,255,255,.12) 0)` }}>
                <div className="grid h-24 w-24 place-items-center rounded-full bg-[#0C1E36]">
                  <div className="text-center"><div className="text-3xl font-black">{readiness.score}%</div><div className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-200">Ready</div></div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-300"><Sparkles className="h-4 w-4" /> Portfolio readiness</div>
                <h2 className="mt-2 text-xl font-black text-white">{readiness.score === 100 ? "your portfolio has the essentials." : "a few focused changes will make it stronger."}</h2>
                <p className="mt-1 text-xs text-slate-300">{readiness.completed} of {readiness.checks.length} quality signals complete. This is guidance, not a publishing gate.</p>
                <div className="mt-4 flex flex-wrap gap-2">{readiness.checks.map((item) => <span key={item.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${item.complete ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"}`}><Check className={`h-3 w-3 ${item.complete ? "" : "opacity-30"}`} /> {item.label}</span>)}</div>
              </div>
            </div>
          </section>
          <section className={`rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${editorSection === "design" ? "" : "hidden"}`}><div className="mb-5"><h2 className="font-bold text-foreground dark:text-white">Choose your starting point</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Changing templates keeps your content and is always reversible.</p></div><div className="grid gap-3 sm:grid-cols-2">{PORTFOLIO_TEMPLATES.map((template) => <Button key={template.key} onClick={() => chooseTemplate(template.key, template.accent)} className={`h-full min-h-32 min-w-0 items-start rounded-xl border p-4 text-left !whitespace-normal transition ${templateKey === template.key ? "border-blue-500 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-950/30" : "border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-700"}`}><div className="mb-3 h-10 w-full rounded-lg" style={{ background: `linear-gradient(135deg, ${template.accent}, #0C1E36)` }} /><div className="text-sm font-bold text-foreground dark:text-slate-100">{template.name}</div><div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{template.description}</div></Button>)}</div></section>

          <section className={`rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${editorSection === "profile" ? "" : "hidden"}`}>
            <div className="mb-5"><h2 className="font-bold text-foreground dark:text-white">Basic profile</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">Add a name, headline, introduction, and contact email before you publish. Location and availability are optional.</p></div>
            <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 dark:border-slate-800 sm:flex-row sm:items-center">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-2xl font-black text-slate-400 dark:bg-slate-800">
                {content.profileImageUrl ? <img src={content.profileImageUrl} alt="" className="h-full w-full object-cover" /> : (content.name || "Y").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground dark:text-white">Profile photo</p>
                <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500 dark:text-slate-400">Used in your public portfolio hero and synced from onboarding. A square portrait with a simple background works best.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
                    <Upload className="h-3.5 w-3.5" /> Upload photo
                    <Input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { handleProfileImageUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                  </label>
                  {content.profileImageUrl && <Button type="button" onClick={() => persistProfileImage("", "profile photo removed")} disabled={saving} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Remove</Button>}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2"><span className={labelClass}>Display name</span><Input className={inputClass} value={content.name || ""} placeholder="Your name" onChange={(event) => updateContent({ name: event.target.value })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Public URL</span><div className="flex items-center"><span className="rounded-l-xl border border-r-0 border-border bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">/p/</span><Input className={`${inputClass} rounded-l-none`} value={slug} placeholder="your-name" onChange={(event) => updateSlug(event.target.value)} /></div></label><label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>Headline</span><Input className={inputClass} value={content.headline || ""} placeholder="e.g. product designer and developer building clear, useful products" onChange={(event) => updateContent({ headline: event.target.value })} /></label><label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>About</span><Textarea rows={4} className={inputClass} value={content.bio || ""} placeholder="Tell people what you do, who you help, and what makes your work different." onChange={(event) => updateContent({ bio: event.target.value })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Location</span><Input className={inputClass} value={content.location || ""} placeholder="e.g. Bengaluru, India · working worldwide" onChange={(event) => updateContent({ location: event.target.value })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Availability</span><Input className={inputClass} value={content.availability || ""} placeholder="e.g. available for select projects" onChange={(event) => updateContent({ availability: event.target.value })} /></label><label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>Contact email</span><Input type="email" className={inputClass} value={content.contactEmail || ""} onChange={(event) => updateContent({ contactEmail: event.target.value })} placeholder="you@example.com" /></label></div>
          </section>

          <section className={`rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${editorSection === "work" ? "" : "hidden"}`}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-bold text-foreground dark:text-white">Selected work</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">Show the work you want clients to remember. A title, role, short description, and cover image are enough to start.</p></div><Button type="button" onClick={() => updateContent({ projects: [...content.projects, { id: id("project"), title: "", description: "", role: "", year: String(new Date().getFullYear()), url: "", imageUrl: "", client: "", timeline: "", deliverables: [], gallery: [], visibility: "public", challenge: "", solution: "", outcome: "", tools: [] }] })} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> Add project</Button></div>
            <div className="flex flex-col gap-4">{content.projects.map((project, index) => <PortfolioProjectEditor key={project.id} project={project} index={index} onChange={(projectUpdate) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, ...projectUpdate } : item) })} onDelete={() => updateContent({ projects: content.projects.filter((item) => item.id !== project.id) })} onUploadCover={(file) => { void handleImageUpload(project.id, file); }} />)}</div>
          </section>

          <section className={`rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${editorSection === "proof" ? "" : "hidden"}`}>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-bold text-foreground dark:text-white">Testimonials</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">Add historical client quotes you have permission to share. These are imported testimonials, not Rive-verified reviews.</p></div><Button type="button" onClick={() => updateContent({ testimonials: [...content.testimonials, { id: id("testimonial"), quote: "", name: "", company: "", role: "", projectId: "", source: "", visibility: "public" }] })} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> Add testimonial</Button></div>
            {content.testimonials.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">No testimonials yet. Add one when you have a past client quote ready.</div> : <div className="flex flex-col gap-4">{content.testimonials.map((testimonial) => <div key={testimonial.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Historical testimonial</span><Button type="button" title="Remove testimonial" onClick={() => updateContent({ testimonials: content.testimonials.filter((item) => item.id !== testimonial.id) })} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button></div><div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>Quote <span className="text-blue-600">Required</span></span><Textarea className={inputClass} rows={4} value={testimonial.quote} placeholder="What did the client say about working with you?" onChange={(event) => updateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, quote: event.target.value } : item) })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Client name <span className="text-blue-600">Required</span></span><Input className={inputClass} value={testimonial.name} placeholder="Jordan Lee" onChange={(event) => updateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, name: event.target.value } : item) })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Role or company</span><Input className={inputClass} value={testimonial.role || testimonial.company || ""} placeholder="Founder, Acme" onChange={(event) => updateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, role: event.target.value, company: event.target.value } : item) })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Source or reference</span><Input className={inputClass} value={testimonial.source || ""} placeholder="Email, LinkedIn, project archive" onChange={(event) => updateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, source: event.target.value } : item) })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Associated project</span><Select className={inputClass} value={testimonial.projectId || ""} onChange={(event) => updateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, projectId: event.target.value } : item) })}><option value="">Not associated</option>{content.projects.map((project) => <option key={project.id} value={project.id}>{project.title || "Untitled project"}</option>)}</Select></label></div><label className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><Input type="checkbox" checked={testimonial.visibility !== "private"} onChange={(event) => updateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, visibility: event.target.checked ? "public" : "private" } : item) })} /> Show on public portfolio</label></div>)}</div>}
          </section>

          <section className={`rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${editorSection === "services" ? "" : "hidden"}`}><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-foreground dark:text-white">Services</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Turn your capabilities into clear client outcomes.</p></div><Button type="button" onClick={() => updateContent({ services: [...content.services, { id: id("service"), title: "", description: "" }] })} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> Add service</Button></div><div className="grid gap-3 sm:grid-cols-2">{content.services.map((service) => <div key={service.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="mb-3 flex justify-end"><Button type="button" onClick={() => updateContent({ services: content.services.filter((item) => item.id !== service.id) })} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button></div><Input className={`${inputClass} mb-3`} value={service.title || ""} placeholder="Service name" onChange={(event) => updateContent({ services: content.services.map((item) => item.id === service.id ? { ...item, title: event.target.value } : item) })} /><Textarea className={inputClass} rows={3} value={service.description || ""} placeholder="Describe the outcome clients can expect" onChange={(event) => updateContent({ services: content.services.map((item) => item.id === service.id ? { ...item, description: event.target.value } : item) })} /></div>)}</div></section>

          <section className={`rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900 ${editorSection === "design" ? "" : "hidden"}`}><h2 className="mb-5 font-bold text-foreground dark:text-white">Appearance & visibility</h2><div className="grid gap-4 sm:grid-cols-3"><label className="flex flex-col gap-2"><span className={labelClass}>Accent</span><Input type="color" className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-transparent dark:border-slate-700" value={theme.accent} onChange={(event) => updateTheme({ accent: event.target.value })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Site mode</span><Select className={inputClass} value={theme.mode} onChange={(event) => updateTheme({ mode: event.target.value as PortfolioTheme["mode"] })}><option value="light">Light</option><option value="dark">Dark</option></Select></label><label className="flex flex-col gap-2"><span className={labelClass}>Corners</span><Select className={inputClass} value={theme.radius} onChange={(event) => updateTheme({ radius: event.target.value as PortfolioTheme["radius"] })}><option value="soft">Soft</option><option value="sharp">Sharp</option></Select></label></div><div className="mt-6 border-t border-border pt-6"><h3 className="text-sm font-bold text-foreground dark:text-white">Search preview</h3><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Give search engines a useful title and description for your public portfolio.</p><div className="mt-4 grid gap-4"><label className="flex flex-col gap-2"><span className={labelClass}>Page title</span><Input className={inputClass} value={seo.title} maxLength={60} placeholder={content.name ? `${content.name} — your work and services` : "Your name — your work and services"} onChange={(event) => updateSeo({ title: event.target.value })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Description</span><Textarea className={inputClass} rows={3} value={seo.description} maxLength={160} placeholder="A concise description of what you do, who you help, and where to find your work." onChange={(event) => updateSeo({ description: event.target.value })} /></label></div></div><div className="mt-5 flex items-center gap-3"><Input id="about-visible" type="checkbox" checked={content.sections.find((section) => section.key === "about")?.visible ?? true} onChange={(event) => updateContent({ sections: content.sections.map((section) => section.key === "about" ? { ...section, visible: event.target.checked } : section) })} /><label htmlFor="about-visible" className="text-sm text-slate-600 dark:text-slate-300">Show about section publicly</label></div><div className="mt-3 flex items-center gap-3"><Input id="indexable" type="checkbox" checked={seo.indexable} onChange={(event) => updateSeo({ indexable: event.target.checked })} /><label htmlFor="indexable" className="text-sm text-slate-600 dark:text-slate-300">Allow search engines to index my portfolio</label></div></section>
        </div>
      </div>}

      {tab === "preview" && <div className="rounded-2xl border border-border bg-slate-100 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold text-foreground dark:text-white">Responsive preview</p><p className="mt-0.5 text-[10px] text-slate-500">Review the complete experience at common viewport sizes before publishing.</p></div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {([{ key: "desktop", label: "Desktop", icon: Monitor }, { key: "tablet", label: "Tablet", icon: Tablet }, { key: "mobile", label: "Mobile", icon: Smartphone }] as const).map(({ key, label, icon: Icon }) => <Button key={key} type="button" aria-label={`${label} preview`} aria-pressed={previewDevice === key} title={`${label} preview`} onClick={() => setPreviewDevice(key)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold ${previewDevice === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}><Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span></Button>)}
          </div>
        </div>
        <div className={`mx-auto overflow-hidden bg-white shadow-2xl transition-[max-width] duration-300 dark:bg-slate-900 ${previewDevice === "mobile" ? "max-w-[390px] rounded-[2rem]" : previewDevice === "tablet" ? "max-w-[820px] rounded-2xl" : "max-w-full rounded-xl"}`}>
          <iframe
            ref={previewFrameRef}
            src="/portfolio-preview"
            title={`${previewDevice} portfolio preview`}
            className="block h-[75vh] min-h-[680px] w-full border-0 bg-white"
            onLoad={() => previewFrameRef.current?.contentWindow?.postMessage({
              type: "rive:portfolio-preview",
              payload: { content, theme, templateKey },
            }, window.location.origin)}
          />
        </div>
      </div>}

      {tab === "analytics" && <AnalyticsPanel analytics={analytics} />}
    </div>
  );
}

function AnalyticsPanel({ analytics }: { analytics: Analytics | null }) {
  if (!analytics) return <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">Loading portfolio analytics...</div>;
  const max = Math.max(...analytics.timeline.map((day) => day.count), 1);
  return <div className="flex flex-col gap-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["total views", analytics.totalViews, "last 30 days"], ["unique visitors", analytics.uniqueVisitors, "privacy-preserving estimate"], ["avg. daily views", analytics.averageViewsPerDay, "last 30 days"], ["peak day", analytics.peakDay ? new Date(analytics.peakDay).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—", "highest traffic day"]].map(([label, value, sub]) => <div key={String(label)} className="rounded-2xl border border-border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</div><div className="mt-3 text-3xl font-black text-foreground dark:text-white">{value}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-500">{sub}</div></div>)}</div><div className="rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="mb-6"><h2 className="font-bold text-foreground dark:text-white">Portfolio reach</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Daily public visits over the last 30 days.</p></div><div className="flex h-48 items-end gap-1">{analytics.timeline.map((day) => <div key={day.day} className="group relative flex h-full flex-1 items-end"><div className="w-full rounded-t-md bg-blue-500/80 transition group-hover:bg-blue-400" style={{ height: `${Math.max((day.count / max) * 100, day.count ? 5 : 1)}%` }} title={`${day.day}: ${day.count} views`} /></div>)}</div><div className="mt-3 flex justify-between text-[10px] text-slate-500"><span>{analytics.timeline[0]?.day}</span><span>{analytics.timeline.at(-1)?.day}</span></div></div><div className="grid gap-6 lg:grid-cols-2"><Breakdown title="Top sources" rows={analytics.referrers.map((item) => [item.source, item.count])} /><Breakdown title="Devices" rows={analytics.devices.map((item) => [item.device, item.count])} /></div></div>;
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return <section className="rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold text-foreground dark:text-white">{title}</h2><div className="mt-5 flex flex-col gap-3">{rows.length ? rows.map(([label, count]) => <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800"><span className="truncate text-slate-600 dark:text-slate-300">{label}</span><span className="font-bold text-foreground dark:text-white">{count}</span></div>) : <p className="text-sm text-slate-500">No data yet</p>}</div></section>;
}
