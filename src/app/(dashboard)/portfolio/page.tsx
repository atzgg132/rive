"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Eye, ExternalLink, Globe2, LayoutTemplate, Plus, Save, Trash2, BarChart3, Upload, Monitor, Smartphone, Tablet, Sparkles } from "lucide-react";
import { toast } from "sonner";
import PortfolioRenderer from "@/components/portfolio/PortfolioRenderer";
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

const inputClass = "w-full rounded-xl border border-[#E2EAF4] bg-white px-3.5 py-2.5 text-sm text-[#0C1E36] outline-none transition focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200";
const labelClass = "text-[11px] font-bold uppercase tracking-[0.14em] text-[#4A5E78] dark:text-slate-400";

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
    <div className="sm:col-span-2 rounded-xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
      <div className="mb-4"><p className="text-xs font-bold text-[#0C1E36] dark:text-white">case study details</p><p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">These fields power the dedicated public case-study page.</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={inputClass} value={project.client || ""} placeholder="client or independent project" onChange={(event) => onChange({ client: event.target.value })} />
        <input className={inputClass} value={project.timeline || ""} placeholder="timeline, e.g. 8 weeks" onChange={(event) => onChange({ timeline: event.target.value })} />
        <input className={`${inputClass} sm:col-span-2`} value={(project.deliverables || []).join(", ")} placeholder="deliverables (comma separated)" onChange={(event) => onChange({ deliverables: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[11px] font-bold text-[#0C1E36] dark:text-white">project gallery</p><p className="mt-0.5 text-[10px] text-slate-500">up to 12 images · upload or paste an HTTPS URL</p></div>
        <div className="flex gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-[10px] font-bold text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"><Upload className="h-3.5 w-3.5" /> upload images<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="sr-only" onChange={(event) => { uploadGalleryImages(event.target.files); event.currentTarget.value = ""; }} /></label>
          <button type="button" onClick={addGalleryUrl} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-2 text-[10px] font-bold text-white"><Plus className="h-3.5 w-3.5" /> image URL</button>
        </div>
      </div>
      {(project.gallery || []).length > 0 && <div className="mt-4 space-y-3">{(project.gallery || []).map((image, imageIndex) => <div key={image.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-[56px_1fr_auto]">
        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg bg-slate-100 text-[10px] font-bold text-slate-400 dark:bg-slate-800">{image.url ? <img src={image.url} alt="" className="h-full w-full object-cover" /> : imageIndex + 1}</div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2"><input className={`${inputClass} sm:col-span-2`} value={image.url.startsWith("data:") ? "uploaded image" : image.url} readOnly={image.url.startsWith("data:")} placeholder="https://example.com/image.jpg" onChange={(event) => updateGalleryImage(image.id, { url: event.target.value })} /><input className={inputClass} value={image.alt} placeholder="accessible description" onChange={(event) => updateGalleryImage(image.id, { alt: event.target.value })} /><input className={inputClass} value={image.caption} placeholder="caption (optional)" onChange={(event) => updateGalleryImage(image.id, { caption: event.target.value })} /></div>
        <button type="button" title="remove gallery image" onClick={() => onChange({ gallery: (project.gallery || []).filter((item) => item.id !== image.id) })} className="self-start rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></button>
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

  const save = async (nextStatus?: "draft" | "published") => {
    if (!portfolio) return;
    setSaving(true);
    try {
      const response = await fetch("/api/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: portfolio.revision, content, theme, templateKey, slug, seo, status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "could not save portfolio");
      setPortfolio(data.portfolio);
      setSlug(data.portfolio.slug);
      setDirty(false);
      toast.success(nextStatus === "published" ? "portfolio published" : "portfolio saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "could not save portfolio");
    } finally {
      setSaving(false);
    }
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (loading) return <div className="flex min-h-80 items-center justify-center text-sm text-[#4A5E78] dark:text-slate-400">loading portfolio studio...</div>;

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-[#E2EAF4] pb-6 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400"><Globe2 className="h-4 w-4" /> portfolio studio</div><h1 className="text-3xl font-black tracking-tight text-[#0C1E36] dark:text-white">your public presence.</h1><p className="mt-1 text-sm text-[#4A5E78] dark:text-slate-400">one polished portfolio for the work you want to be hired for.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          {portfolio?.status === "published" && <a href={`/p/${slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2EAF4] px-3 py-2 text-xs font-semibold text-[#4A5E78] hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><ExternalLink className="h-3.5 w-3.5" /> open public</a>}
          <button onClick={() => save()} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2EAF4] px-3 py-2 text-xs font-semibold text-[#4A5E78] disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><Save className="h-3.5 w-3.5" /> {saving ? "saving..." : "save draft"}</button>
          <button onClick={() => save("published")} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-60"><Check className="h-3.5 w-3.5" /> {portfolio?.status === "published" ? "update live site" : "publish portfolio"}</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2EAF4] bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-1"><button onClick={() => setTab("edit")} className={`rounded-xl px-3 py-2 text-xs font-bold ${tab === "edit" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "text-slate-500"}`}><LayoutTemplate className="mr-1 inline h-3.5 w-3.5" /> edit</button><button onClick={() => setTab("preview")} className={`rounded-xl px-3 py-2 text-xs font-bold ${tab === "preview" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "text-slate-500"}`}><Eye className="mr-1 inline h-3.5 w-3.5" /> preview</button><button onClick={() => setTab("analytics")} className={`rounded-xl px-3 py-2 text-xs font-bold ${tab === "analytics" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" : "text-slate-500"}`}><BarChart3 className="mr-1 inline h-3.5 w-3.5" /> analytics</button></div>
        <div className="flex max-w-full items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span className={`h-2 w-2 rounded-full ${portfolio?.status === "published" ? "bg-emerald-500" : "bg-amber-500"}`} /> {portfolio?.status === "published" ? "live" : "draft"} · <span className="truncate">{publicUrl}</span><button onClick={copyUrl} className="shrink-0 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" title="copy public URL">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</button></div>
      </div>

      {tab === "edit" && <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <div className="flex flex-col gap-6">
          <section className="overflow-hidden rounded-2xl border border-[#E2EAF4] bg-[#0C1E36] text-white shadow-sm dark:border-slate-700">
            <div className="grid gap-6 p-6 sm:grid-cols-[160px_1fr] sm:items-center">
              <div className="relative mx-auto grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(#60A5FA ${readiness.score}%, rgba(255,255,255,.12) 0)` }}>
                <div className="grid h-24 w-24 place-items-center rounded-full bg-[#0C1E36]">
                  <div className="text-center"><div className="text-3xl font-black">{readiness.score}%</div><div className="text-[9px] font-bold uppercase tracking-[0.16em] text-blue-200">ready</div></div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-300"><Sparkles className="h-4 w-4" /> portfolio readiness</div>
                <h2 className="mt-2 text-xl font-black text-white">{readiness.score === 100 ? "your portfolio has the essentials." : "a few focused changes will make it stronger."}</h2>
                <p className="mt-1 text-xs text-slate-300">{readiness.completed} of {readiness.checks.length} quality signals complete. This is guidance, not a publishing gate.</p>
                <div className="mt-4 flex flex-wrap gap-2">{readiness.checks.map((item) => <span key={item.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${item.complete ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/5 text-slate-300"}`}><Check className={`h-3 w-3 ${item.complete ? "" : "opacity-30"}`} /> {item.label}</span>)}</div>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-[#E2EAF4] bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="mb-5"><h2 className="font-bold text-[#0C1E36] dark:text-white">choose your starting point</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Changing templates keeps your content and is always reversible.</p></div><div className="grid gap-3 sm:grid-cols-2">{PORTFOLIO_TEMPLATES.map((template) => <button key={template.key} onClick={() => { setTemplateKey(template.key); setTheme((current) => ({ ...current, accent: template.accent })); setDirty(true); }} className={`rounded-xl border p-4 text-left transition ${templateKey === template.key ? "border-blue-500 bg-blue-50/60 dark:border-blue-400 dark:bg-blue-950/30" : "border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-700"}`}><div className="mb-3 h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${template.accent}, #0C1E36)` }} /><div className="text-sm font-bold text-[#0C1E36] dark:text-slate-100">{template.name}</div><div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{template.description}</div></button>)}</div></section>

          <section className="rounded-2xl border border-[#E2EAF4] bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-5 font-bold text-[#0C1E36] dark:text-white">identity</h2><div className="grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2"><span className={labelClass}>display name</span><input className={inputClass} value={content.name} onChange={(event) => updateContent({ name: event.target.value })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>public URL</span><div className="flex items-center"><span className="rounded-l-xl border border-r-0 border-[#E2EAF4] bg-slate-50 px-3 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">/p/</span><input className={`${inputClass} rounded-l-none`} value={slug} onChange={(event) => { setSlug(normalizeSlug(event.target.value)); setDirty(true); }} /></div></label><label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>headline</span><input className={inputClass} value={content.headline} onChange={(event) => updateContent({ headline: event.target.value })} /></label><label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>about</span><textarea rows={4} className={inputClass} value={content.bio} onChange={(event) => updateContent({ bio: event.target.value })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>location</span><input className={inputClass} value={content.location} onChange={(event) => updateContent({ location: event.target.value })} /></label><label className="flex flex-col gap-2"><span className={labelClass}>availability</span><input className={inputClass} value={content.availability} onChange={(event) => updateContent({ availability: event.target.value })} /></label><label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>contact email</span><input type="email" className={inputClass} value={content.contactEmail} onChange={(event) => updateContent({ contactEmail: event.target.value })} placeholder="you@example.com" /></label></div></section>

          <section className="rounded-2xl border border-[#E2EAF4] bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-[#0C1E36] dark:text-white">selected work</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Show proof of work with context, craft, and outcomes. Private projects stay in your editor.</p></div><button onClick={() => updateContent({ projects: [...content.projects, { id: id("project"), title: "new project", description: "", role: "", year: "2026", url: "", imageUrl: "", client: "", timeline: "", deliverables: [], gallery: [], visibility: "public", challenge: "", solution: "", outcome: "", tools: [] }] })} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> add</button></div><div className="flex flex-col gap-4">{content.projects.map((project, index) => <div key={project.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold text-slate-400">project {index + 1}</span><button onClick={() => updateContent({ projects: content.projects.filter((item) => item.id !== project.id) })} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><input className={inputClass} value={project.title} placeholder="title" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, title: event.target.value } : item) })} /><input className={inputClass} value={project.role} placeholder="your role" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, role: event.target.value } : item) })} /><textarea className={`${inputClass} sm:col-span-2`} rows={2} value={project.description} placeholder="what did you make and what changed?" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, description: event.target.value } : item) })} /><div className="sm:col-span-2 grid gap-3 sm:grid-cols-3"><textarea className={inputClass} rows={3} value={project.challenge || ""} placeholder="challenge / brief" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, challenge: event.target.value } : item) })} /><textarea className={inputClass} rows={3} value={project.solution || ""} placeholder="solution / approach" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, solution: event.target.value } : item) })} /><textarea className={inputClass} rows={3} value={project.outcome || ""} placeholder="outcome / result" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, outcome: event.target.value } : item) })} /></div><input className={inputClass} value={(project.tools || []).join(", ")} placeholder="tools / skills (comma separated)" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, tools: event.target.value.split(",").map((tool) => tool.trim()).filter(Boolean) } : item) })} /><div className="flex items-center gap-2"><label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><Upload className="h-3.5 w-3.5" /> upload<input type="file" accept="image/*" className="sr-only" onChange={(event) => { handleImageUpload(project.id, event.target.files?.[0]); event.currentTarget.value = ""; }} /></label><input className={inputClass} value={project.imageUrl.startsWith("data:") ? "uploaded image" : project.imageUrl} placeholder="or paste image URL" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, imageUrl: event.target.value } : item) })} /></div><input className={inputClass} value={project.url} placeholder="project URL (optional)" onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, url: event.target.value } : item) })} /><CaseStudyFields project={project} onChange={(projectUpdate) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, ...projectUpdate } : item) })} /><label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400"><input type="checkbox" checked={project.visibility !== "private"} onChange={(event) => updateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, visibility: event.target.checked ? "public" : "private" } : item) })} /> visible on public portfolio</label></div></div>)}</div></section>

          <section className="rounded-2xl border border-[#E2EAF4] bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-bold text-[#0C1E36] dark:text-white">services</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Turn your capabilities into clear client outcomes.</p></div><button onClick={() => updateContent({ services: [...content.services, { id: id("service"), title: "new service", description: "" }] })} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> add</button></div><div className="grid gap-3 sm:grid-cols-2">{content.services.map((service) => <div key={service.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div className="mb-3 flex justify-end"><button onClick={() => updateContent({ services: content.services.filter((item) => item.id !== service.id) })} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button></div><input className={`${inputClass} mb-3`} value={service.title} onChange={(event) => updateContent({ services: content.services.map((item) => item.id === service.id ? { ...item, title: event.target.value } : item) })} /><textarea className={inputClass} rows={3} value={service.description} onChange={(event) => updateContent({ services: content.services.map((item) => item.id === service.id ? { ...item, description: event.target.value } : item) })} /></div>)}</div></section>

          <section className="rounded-2xl border border-[#E2EAF4] bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><h2 className="mb-5 font-bold text-[#0C1E36] dark:text-white">appearance & visibility</h2><div className="grid gap-4 sm:grid-cols-3"><label className="flex flex-col gap-2"><span className={labelClass}>accent</span><input type="color" className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-transparent dark:border-slate-700" value={theme.accent} onChange={(event) => { setTheme({ ...theme, accent: event.target.value }); setDirty(true); }} /></label><label className="flex flex-col gap-2"><span className={labelClass}>site mode</span><select className={inputClass} value={theme.mode} onChange={(event) => { setTheme({ ...theme, mode: event.target.value as PortfolioTheme["mode"] }); setDirty(true); }}><option value="light">light</option><option value="dark">dark</option></select></label><label className="flex flex-col gap-2"><span className={labelClass}>corners</span><select className={inputClass} value={theme.radius} onChange={(event) => { setTheme({ ...theme, radius: event.target.value as PortfolioTheme["radius"] }); setDirty(true); }}><option value="soft">soft</option><option value="sharp">sharp</option></select></label></div><div className="mt-5 flex items-center gap-3"><input id="about-visible" type="checkbox" checked={content.sections.find((section) => section.key === "about")?.visible ?? true} onChange={(event) => updateContent({ sections: content.sections.map((section) => section.key === "about" ? { ...section, visible: event.target.checked } : section) })} /><label htmlFor="about-visible" className="text-sm text-slate-600 dark:text-slate-300">show about section publicly</label></div><div className="mt-3 flex items-center gap-3"><input id="indexable" type="checkbox" checked={seo.indexable} onChange={(event) => { setSeo({ ...seo, indexable: event.target.checked }); setDirty(true); }} /><label htmlFor="indexable" className="text-sm text-slate-600 dark:text-slate-300">allow search engines to index my portfolio</label></div></section>
        </div>
        <div className="hidden xl:block"><div className="sticky top-6 overflow-hidden rounded-2xl border border-[#E2EAF4] bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="border-b border-[#E2EAF4] px-5 py-3 text-xs font-bold text-slate-500 dark:border-slate-800">live preview</div><div className="max-h-[calc(100vh-170px)] overflow-y-auto"><PortfolioRenderer content={content} theme={theme} templateKey={templateKey} /></div></div></div>
      </div>}

      {tab === "preview" && <div className="rounded-2xl border border-[#E2EAF4] bg-slate-100 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold text-[#0C1E36] dark:text-white">responsive preview</p><p className="mt-0.5 text-[10px] text-slate-500">check the experience at each common viewport before publishing.</p></div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {([{ key: "desktop", label: "desktop", icon: Monitor }, { key: "tablet", label: "tablet", icon: Tablet }, { key: "mobile", label: "mobile", icon: Smartphone }] as const).map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => setPreviewDevice(key)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold ${previewDevice === key ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}><Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{label}</span></button>)}
          </div>
        </div>
        <div className={`mx-auto overflow-hidden bg-white shadow-2xl transition-[max-width] duration-300 dark:bg-slate-900 ${previewDevice === "mobile" ? "max-w-[390px] rounded-[2rem]" : previewDevice === "tablet" ? "max-w-[820px] rounded-2xl" : "max-w-full rounded-xl"}`}>
          <PortfolioRenderer content={content} theme={theme} templateKey={templateKey} preview />
        </div>
      </div>}

      {tab === "analytics" && <AnalyticsPanel analytics={analytics} />}
    </div>
  );
}

function AnalyticsPanel({ analytics }: { analytics: Analytics | null }) {
  if (!analytics) return <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">loading portfolio analytics...</div>;
  const max = Math.max(...analytics.timeline.map((day) => day.count), 1);
  return <div className="flex flex-col gap-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["total views", analytics.totalViews, "last 30 days"], ["unique visitors", analytics.uniqueVisitors, "privacy-preserving estimate"], ["avg. daily views", analytics.averageViewsPerDay, "last 30 days"], ["peak day", analytics.peakDay ? new Date(analytics.peakDay).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—", "highest traffic day"]].map(([label, value, sub]) => <div key={String(label)} className="rounded-2xl border border-[#E2EAF4] bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</div><div className="mt-3 text-3xl font-black text-[#0C1E36] dark:text-white">{value}</div><div className="mt-1 text-xs text-slate-500 dark:text-slate-500">{sub}</div></div>)}</div><div className="rounded-2xl border border-[#E2EAF4] bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><div className="mb-6"><h2 className="font-bold text-[#0C1E36] dark:text-white">portfolio reach</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">daily public visits over the last 30 days.</p></div><div className="flex h-48 items-end gap-1">{analytics.timeline.map((day) => <div key={day.day} className="group relative flex h-full flex-1 items-end"><div className="w-full rounded-t-md bg-blue-500/80 transition group-hover:bg-blue-400" style={{ height: `${Math.max((day.count / max) * 100, day.count ? 5 : 1)}%` }} title={`${day.day}: ${day.count} views`} /></div>)}</div><div className="mt-3 flex justify-between text-[10px] text-slate-500"><span>{analytics.timeline[0]?.day}</span><span>{analytics.timeline.at(-1)?.day}</span></div></div><div className="grid gap-6 lg:grid-cols-2"><Breakdown title="top sources" rows={analytics.referrers.map((item) => [item.source, item.count])} /><Breakdown title="devices" rows={analytics.devices.map((item) => [item.device, item.count])} /></div></div>;
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return <section className="rounded-2xl border border-[#E2EAF4] bg-white p-6 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold text-[#0C1E36] dark:text-white">{title}</h2><div className="mt-5 flex flex-col gap-3">{rows.length ? rows.map(([label, count]) => <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-800"><span className="truncate text-slate-600 dark:text-slate-300">{label}</span><span className="font-bold text-[#0C1E36] dark:text-white">{count}</span></div>) : <p className="text-sm text-slate-500">no data yet</p>}</div></section>;
}
