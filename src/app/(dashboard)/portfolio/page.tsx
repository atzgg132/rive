"use client";

import { Button, Input, Textarea, Select } from "@/components/ui";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, ExternalLink, Globe2, LayoutTemplate, Plus, Save, Trash2, BarChart3, Upload, Monitor, Smartphone, Tablet, Sparkles, UserRound, FolderKanban, BriefcaseBusiness, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_PORTFOLIO_CONTENT, DEFAULT_PORTFOLIO_THEME, mergePortfolioContent, normalizeSlug, PORTFOLIO_TEMPLATES, type PortfolioContent, type PortfolioProject, type PortfolioTheme } from "@/utils/portfolio";

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

const inputClass = "w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground dark:text-slate-400";

function id(prefix: string) { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }

function CaseStudyFields({ project, onChange }: { project: PortfolioProject; onChange: (update: Partial<PortfolioProject>) => void }) {
  const addGalleryUrl = () => {
    if ((project.gallery || []).length >= 12) {
      toast.error("add up to 12 gallery images");
      return;
    }
    onChange({ gallery: [...(project.gallery || []), { id: id("gallery"), url: "", alt: "", caption: "" }] });
  };

  const uploadGalleryImages = (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = 12 - (project.gallery || []).length;
    const selected = Array.from(files).slice(0, remaining);
    if (selected.some((file) => !file.type.startsWith("image/"))) {
      toast.error("gallery files must be images");
      return;
    }
    if (selected.some((file) => file.size > 1.5 * 1024 * 1024)) {
      toast.error("gallery images must be 1.5 MB or smaller");
      return;
    }
    Promise.all(selected.map((file) => new Promise<NonNullable<PortfolioProject["gallery"]>[number]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string"
        ? resolve({ id: id("gallery"), url: reader.result, alt: file.name.replace(/\.[^.]+$/, ""), caption: "" })
        : reject(new Error("could not read image"));
      reader.onerror = () => reject(new Error("could not read image"));
      reader.readAsDataURL(file);
    }))).then((images) => {
      onChange({ gallery: [...(project.gallery || []), ...images] });
      toast.success(`${images.length} gallery image${images.length === 1 ? "" : "s"} added`);
    }).catch(() => toast.error("could not add gallery images"));
  };

  const updateGalleryImage = (imageId: string, update: Partial<NonNullable<PortfolioProject["gallery"]>[number]>) => {
    onChange({ gallery: (project.gallery || []).map((image) => image.id === imageId ? { ...image, ...update } : image) });
  };

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
}

function getPortfolioReadiness(content: PortfolioContent, seo: { title: string; description: string }) {
  const publicProjects = content.projects.filter((project) => project.visibility !== "private");
  const checks = [
    { label: "clear headline", complete: content.headline.trim().length >= 20 },
    { label: "strong introduction", complete: content.bio.trim().length >= 60 },
    { label: "three public projects", complete: publicProjects.length >= 3 },
    { label: "project imagery", complete: publicProjects.some((project) => Boolean(project.imageUrl)) },
    { label: "proof of outcomes", complete: publicProjects.some((project) => Boolean(project.outcome?.trim())) },
    { label: "client contact", complete: Boolean(content.contactEmail.trim()) },
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
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const previewFrameRef = useRef<HTMLIFrameElement>(null);
  const [editorSection, setEditorSection] = useState<"profile" | "work" | "services" | "design">("profile");

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${slug}` : `/p/${slug}`;
  const readiness = getPortfolioReadiness(content, seo);

  useEffect(() => {
    async function load() {
      try {
        let response = await fetch("/api/portfolio");
        let data = await response.json();
        if (!data.portfolio) {
          response = await fetch("/api/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          data = await response.json();
        }
        if (!data.success || !data.portfolio) throw new Error(data.message || "could not load portfolio");
        const record = data.portfolio as PortfolioRecord;
        setPortfolio(record);
        setContent(mergePortfolioContent(record.content));
        setTheme({ ...DEFAULT_PORTFOLIO_THEME, ...(record.theme || {}) });
        setTemplateKey(record.templateKey);
        setSlug(record.slug);
        setSeo({ title: record.seo?.title || "", description: record.seo?.description || "", indexable: record.seo?.indexable !== false });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "could not load portfolio");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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

  const updateContent = (update: Partial<PortfolioContent>) => {
    setContent((current) => ({ ...current, ...update }));
    setDirty(true);
  };

  const handleImageUpload = (projectId: string, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("images must be 5 MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const imageUrl = typeof reader.result === "string" ? reader.result : "";
      if (!imageUrl) return;
      updateContent({ projects: content.projects.map((item) => item.id === projectId ? { ...item, imageUrl } : item) });
      toast.success("image added");
    };
    reader.readAsDataURL(file);
  };

  async function save(
    nextStatus?: "draft" | "published",
    contentOverride: PortfolioContent = content,
    successMessage?: string,
  ) {
    if (!portfolio) return;
    setSaving(true);
    try {
      const response = await fetch("/api/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: portfolio.revision, content: contentOverride, theme, templateKey, slug, seo, status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "could not save portfolio");
      setPortfolio(data.portfolio);
      setContent(mergePortfolioContent(data.portfolio.content));
      setSlug(data.portfolio.slug);
      setDirty(false);
      toast.success(successMessage || (nextStatus === "published" ? "portfolio published" : "portfolio saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "could not save portfolio");
    } finally {
      setSaving(false);
    }
  }

  const persistProfileImage = (profileImageUrl: string, message: string) => {
    const nextContent = { ...content, profileImageUrl };
    setContent(nextContent);
    setDirty(true);
    void save(undefined, nextContent, message);
  };

  const handleProfileImageUpload = (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("choose a PNG, JPEG, or WebP image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("profile photos must be 2 MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      persistProfileImage(reader.result, "profile photo saved");
    };
    reader.onerror = () => toast.error("could not read that image");
    reader.readAsDataURL(file);
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (loading) return <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground dark:text-slate-400">Loading portfolio studio...</div>;

  return (
    <div className="flex flex-col gap-5 pb-10">
      <div className="flex flex-col gap-4 border-b border-border pb-5 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400"><Globe2 className="h-4 w-4" /> Portfolio studio</div><h1 className="text-2xl font-black tracking-tight text-foreground dark:text-white">Shape your public presence</h1><p className="mt-1 text-xs text-muted-foreground dark:text-slate-400">Edit with focus, then review the complete experience before publishing.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {portfolio?.status === "published" && <a href={`/p/${slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ExternalLink className="h-3.5 w-3.5" /> Open public</a>}
          <Button onClick={() => save()} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><Save className="h-3.5 w-3.5" /> {saving ? "saving..." : "save draft"}</Button>
          <Button onClick={() => save("published")} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60"><Check className="h-3.5 w-3.5" /> {portfolio?.status === "published" ? "update live site" : "publish portfolio"}</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border dark:border-slate-800">
        <div className="flex flex-wrap gap-1"><Button onClick={() => setTab("edit")} className={`border-b-2 px-3 py-2.5 text-xs font-bold ${tab === "edit" ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500"}`}><LayoutTemplate className="mr-1 inline h-3.5 w-3.5" /> Editor</Button><Button onClick={() => setTab("preview")} className={`border-b-2 px-3 py-2.5 text-xs font-bold ${tab === "preview" ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500"}`}><Eye className="mr-1 inline h-3.5 w-3.5" /> Full preview</Button><Button onClick={() => setTab("analytics")} className={`border-b-2 px-3 py-2.5 text-xs font-bold ${tab === "analytics" ? "border-blue-600 text-blue-700 dark:text-blue-300" : "border-transparent text-slate-500"}`}><BarChart3 className="mr-1 inline h-3.5 w-3.5" /> Analytics</Button></div>
        <div className="flex max-w-full items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span className={`h-2 w-2 rounded-full ${portfolio?.status === "published" ? "bg-emerald-500" : "bg-amber-500"}`} /> {portfolio?.status === "published" ? "live" : "draft"} · <span className="truncate">{publicUrl}</span><Button onClick={copyUrl} className="shrink-0 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" title="Copy public URL">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</Button></div>
      </div>

      {tab === "edit" && <div className="grid min-h-[680px] overflow-hidden rounded-xl border border-border bg-white dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 lg:border-b-0 lg:border-r">
          <nav className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:sticky lg:top-5 lg:grid-cols-1">
            {([
              { key: "profile", label: "profile", sub: "identity & contact", icon: UserRound },
              { key: "work", label: "selected work", sub: `${content.projects.length} projects`, icon: FolderKanban },
              { key: "services", label: "services", sub: `${content.services.length} offers`, icon: BriefcaseBusiness },
              { key: "design", label: "design & SEO", sub: "template & visibility", icon: Settings2 },
            ] as const).map(({ key, label, sub, icon: Icon }) => (
              <Button key={key} onClick={() => setEditorSection(key)} className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition ${editorSection === key ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-blue-300 dark:ring-slate-700" : "text-slate-600 hover:bg-white/70 dark:text-slate-400 dark:hover:bg-slate-800/70"}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0"><span className="block truncate text-xs font-bold">{label}</span><span className="hidden truncate text-[10px] text-slate-400 lg:block">{sub}</span></span>
              </Button>
            ))}
            <div className="col-span-2 mt-2 border-t border-slate-200 pt-3 dark:border-slate-700 sm:col-span-4 lg:col-span-1">
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"><Sparkles className="h-3.5 w-3.5 text-blue-500" /> Readiness</span><span className="text-xs font-black text-foreground dark:text-white">{readiness.score}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${readiness.score}%` }} /></div>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">{readiness.completed} of {readiness.checks.length} quality signals complete.</p>
            </div>
          </nav>
        </aside>
        <div className="portfolio-editor-panels flex min-w-0 flex-col gap-5 p-5 sm:p-7" data-editor-section={editorSection}>
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
          <section className="rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="mb-5"><h2 className="font-bold text-foreground dark:text-white">Choose your starting point</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Changing templates keeps your content and is always reversible.</p></div><div className="grid gap-3 sm:grid-cols-2">{PORTFOLIO_TEMPLATES.map((template) => <Button key={template.key} onClick={() => { setTemplateKey(template.key); setTheme((current) => ({ ...current, accent: template.accent })); setDirty(true); }} className={`rounded-xl border p-4 text-left transition ${templateKey === template.key ? "border-blue-500 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-950/30" : "border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-700"}`}><div className="mb-3 h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${template.accent}, #0C1E36)` }} /><div className="text-sm font-bold text-foreground dark:text-slate-100">{template.name}</div><div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{template.description}</div></Button>)}</div></section>

          <section className="rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-5 font-bold text-foreground dark:text-white">Identity</h2>
            <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 dark:border-slate-800 sm:flex-row sm:items-center">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-2xl font-black text-slate-400 dark:bg-slate-800">
                {content.profileImageUrl ? <img src={content.profileImageUrl} alt="" className="h-full w-full object-cover" /> : (content.name || "Y").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground dark:text-white">Profile photo</p>
                <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500 dark:text-slate-400">Used in your public portfolio hero and synced from onboarding. A square portrait with a simple background works best.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
                    <Upload className="h-3.5 w-3.5" /> upload photo
                    <Input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { handleProfileImageUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                  </label>
                  {content.profileImageUrl && <Button type="button" onClick={() => persistProfileImage("", "profile photo removed")} disabled={saving} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Remove</Button>}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2"><span className={labelClass}>Display name</span><Input className={inputClass} value={content.name} onChange={(event) => updateContent({ name: event.target.value })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Public URL</span><div className="flex items-center"><span className="rounded-l-xl border border-r-0 border-border bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">/P/</span><Input className={`${inputClass} rounded-l-none`} value={slug} onChange={(event) => { setSlug(normalizeSlug(event.target.value)); setDirty(true); }} /></div></label><label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>Headline</span><Input className={inputClass} value={content.headline} onChange={(event) => updateContent({ headline: event.target.value })} /></label><label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>About</span><Textarea rows={4} className={inputClass} value={content.bio} onChange={(event) => updateContent({ bio: event.target.value })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Location</span><Input className={inputClass} value={content.location} onChange={(event) => updateContent({ location: event.target.value })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Availability</span><Input className={inputClass} value={content.availability} onChange={(event) => updateContent({ availability: event.target.value })} /></label><label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>Contact email</span><Input type="email" className={inputClass} value={content.contactEmail} onChange={(event) => updateContent({ contactEmail: event.target.value })} placeholder="you@example.com" /></label></div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-foreground dark:text-white">Selected work</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Show proof of work with context, craft, and outcomes. Private projects stay in your editor.</p></div><Button onClick={() => updateContent({ projects: [...content.projects, { id: id("project"), title: "new project", description: "", role: "", year: "2026", url: "", imageUrl: "", client: "", timeline: "", deliverables: [], gallery: [], visibility: "public", challenge: "", solution: "", outcome: "", tools: [] }] })} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> Add</Button></div><div className="flex flex-col gap-4">{content.projects.map((project, index) => <div key={project.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-slate-400">project {index + 1}</span><Button onClick={() => updateContent({ projects: content.projects.filter((item) => item.id !== project.id) })} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button></div><div className="grid gap-3 sm:grid-cols-2"><Input className={inputClass} value={project.title} placeholder="Title" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, title: event.target.value } : item) })} /><Input className={inputClass} value={project.role} placeholder="Your role" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, role: event.target.value } : item) })} /><Textarea className={`${inputClass} sm:col-span-2`} rows={2} value={project.description} placeholder="What did you make and what changed?" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, description: event.target.value } : item) })} /><div className="sm:col-span-2 grid gap-3 sm:grid-cols-3"><Textarea className={inputClass} rows={3} value={project.challenge || ""} placeholder="Challenge / brief" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, challenge: event.target.value } : item) })} /><Textarea className={inputClass} rows={3} value={project.solution || ""} placeholder="Solution / approach" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, solution: event.target.value } : item) })} /><Textarea className={inputClass} rows={3} value={project.outcome || ""} placeholder="Outcome / result" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, outcome: event.target.value } : item) })} /></div><Input className={inputClass} value={(project.tools || []).join(", ")} placeholder="Tools / skills (comma separated)" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, tools: event.target.value.split(",").map((tool) => tool.trim()).filter(Boolean) } : item) })} /><div className="flex items-center gap-2"><label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><Upload className="h-3.5 w-3.5" /> Upload<Input type="file" accept="image/*" className="sr-only" onChange={(event) => { handleImageUpload(project.id, event.target.files?.[0]); event.currentTarget.value = ""; }} /></label><Input className={inputClass} value={project.imageUrl.startsWith("data:") ? "uploaded image" : project.imageUrl} placeholder="Or paste image URL" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, imageUrl: event.target.value } : item) })} /></div><Input className={inputClass} value={project.url} placeholder="Project URL (optional)" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, url: event.target.value } : item) })} /><CaseStudyFields project={project} onChange={(projectUpdate) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, ...projectUpdate } : item) })} /><label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><Input type="checkbox" checked={project.visibility !== "private"} onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, visibility: event.target.checked ? "public" : "private" } : item) })} /> Visible on public portfolio</label></div></div>)}</div></section>

          <section className="rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-foreground dark:text-white">Services</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Turn your capabilities into clear client outcomes.</p></div><Button onClick={() => updateContent({ services: [...content.services, { id: id("service"), title: "new service", description: "" }] })} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> Add</Button></div><div className="grid gap-3 sm:grid-cols-2">{content.services.map((service) => <div key={service.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="mb-3 flex justify-end"><Button onClick={() => updateContent({ services: content.services.filter((item) => item.id !== service.id) })} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button></div><Input className={`${inputClass} mb-3`} value={service.title} onChange={(event) => updateContent({ services: content.services.map((item) => item.id === service.id ? { ...item, title: event.target.value } : item) })} /><Textarea className={inputClass} rows={3} value={service.description} onChange={(event) => updateContent({ services: content.services.map((item) => item.id === service.id ? { ...item, description: event.target.value } : item) })} /></div>)}</div></section>

          <section className="rounded-2xl border border-border bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-5 font-bold text-foreground dark:text-white">Appearance & visibility</h2><div className="grid gap-4 sm:grid-cols-3"><label className="flex flex-col gap-2"><span className={labelClass}>Accent</span><Input type="color" className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-transparent dark:border-slate-700" value={theme.accent} onChange={(event) => { setTheme({ ...theme, accent: event.target.value }); setDirty(true); }} /></label><label className="flex flex-col gap-2"><span className={labelClass}>Site mode</span><Select className={inputClass} value={theme.mode} onChange={(event) => { setTheme({ ...theme, mode: event.target.value as PortfolioTheme["mode"] }); setDirty(true); }}><option value="light">Light</option><option value="dark">Dark</option></Select></label><label className="flex flex-col gap-2"><span className={labelClass}>Corners</span><Select className={inputClass} value={theme.radius} onChange={(event) => { setTheme({ ...theme, radius: event.target.value as PortfolioTheme["radius"] }); setDirty(true); }}><option value="soft">Soft</option><option value="sharp">Sharp</option></Select></label></div><div className="mt-5 flex items-center gap-3"><Input id="about-visible" type="checkbox" checked={content.sections.find((section) => section.key === "about")?.visible ?? true} onChange={(event) => updateContent({ sections: content.sections.map((section) => section.key === "about" ? { ...section, visible: event.target.checked } : section) })} /><label htmlFor="about-visible" className="text-sm text-slate-600 dark:text-slate-300">Show about section publicly</label></div><div className="mt-3 flex items-center gap-3"><Input id="indexable" type="checkbox" checked={seo.indexable} onChange={(event) => { setSeo({ ...seo, indexable: event.target.checked }); setDirty(true); }} /><label htmlFor="indexable" className="text-sm text-slate-600 dark:text-slate-300">Allow search engines to index my portfolio</label></div></section>
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
