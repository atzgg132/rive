"use client";

import { Button, Input, Select, Textarea } from "@/components/ui";
import { ChevronDown, ChevronUp, GripVertical, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import PortfolioMediaEditor from "@/components/portfolio/PortfolioMediaEditor";
import type { PortfolioPractice, PortfolioProject } from "@/utils/portfolio";

const inputClass = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:ring-blue-950";
const labelClass = "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-slate-400";

function isUploadedImage(value: string) {
  return value.startsWith("/api/public/assets/portfolio/") || value.startsWith("data:image/");
}

/* Portfolio image URLs are validated before they become public, but the editor
   also previews safe pasted URLs and inline fallback uploads. */
/* eslint-disable @next/next/no-img-element */

type Props = {
  project: PortfolioProject;
  index: number;
  total: number;
  practices?: PortfolioPractice[];
  onChange: (update: Partial<PortfolioProject>) => void;
  onDelete: () => void;
  onUploadCover: (file: File | undefined) => void;
  /** Move this project to a new position. Order is the order visitors read in. */
  onMove: (to: number) => void;
  onVisibilityChange?: (visibility: "public" | "private") => void;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement> & { draggable?: boolean };
};

export default function PortfolioProjectEditor({ project, index, total, practices = [], onChange, onDelete, onUploadCover, onMove, onVisibilityChange, dragHandleProps }: Props) {
  const media = project.media || [];
  const first = index === 0;
  const last = index === total - 1;

  return (
    <article data-portfolio-entry={project.id} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          {/* Only the handle is draggable. Making the whole card draggable takes
              text selection away from every input inside it. */}
          {total > 1 && (
            <span
              {...dragHandleProps}
              aria-hidden
              title="Drag to reorder"
              className="mt-0.5 cursor-grab rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing dark:text-slate-600 dark:hover:bg-slate-800"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
              Project {index + 1}{first && total > 1 ? " · shown first" : ""}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {first && total > 1
                ? "This is the first work a visitor sees. Start with the essentials; add a case study only if it helps explain the work."
                : "Start with the essentials. Add a full case study only if it helps explain the work."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* The keyboard path, and the reliable one. Dragging is the shortcut,
              not the only way to change the order visitors read the work in. */}
          {total > 1 && (
            <>
              <Button type="button" disabled={first} title="Move earlier" aria-label={`Move ${project.title.trim() || `project ${index + 1}`} earlier`} onClick={() => onMove(index - 1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronUp className="h-4 w-4" /></Button>
              <Button type="button" disabled={last} title="Move later" aria-label={`Move ${project.title.trim() || `project ${index + 1}`} later`} onClick={() => onMove(index + 1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:hover:bg-slate-800"><ChevronDown className="h-4 w-4" /></Button>
            </>
          )}
          <Button type="button" title="Remove project" onClick={onDelete} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2"><span className={labelClass}>Project title <span className="text-blue-600">Required</span></span><Input className={inputClass} value={project.title || ""} placeholder="e.g. A calmer checkout for Acme" onChange={(event) => onChange({ title: event.target.value })} /></label>
        <label className="flex flex-col gap-2"><span className={labelClass}>Your role <span className="text-blue-600">Required</span></span><Input className={inputClass} value={project.role || ""} placeholder="e.g. Product designer" onChange={(event) => onChange({ role: event.target.value })} /></label>
        <label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>What you did <span className="text-blue-600">Required</span></span><Textarea className={inputClass} rows={3} value={project.description || ""} placeholder="In one or two sentences, explain the work and the result." onChange={(event) => onChange({ description: event.target.value })} /></label>
        {practices.length > 0 && (
          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className={labelClass}>Practice</span>
            <Select className={inputClass} value={project.practiceId || ""} onChange={(event) => onChange({ practiceId: event.target.value || undefined })}>
              <option value="">Shown in every practice</option>
              {practices.map((practice) => <option key={practice.id} value={practice.id}>{practice.name || "Untitled practice"}</option>)}
            </Select>
          </label>
        )}
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
        <div className="mb-3"><p className="text-sm font-bold text-foreground dark:text-white">Cover image</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">This is the main image shown on your selected-work card. The gallery below is for additional screenshots.</p></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"><Upload className="h-3.5 w-3.5" /> {project.imageUrl ? "Replace cover" : "Upload cover"}<Input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(event) => { onUploadCover(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
          {!isUploadedImage(project.imageUrl || "") && <Input className={inputClass} value={project.imageUrl || ""} placeholder="Or paste an image URL" onChange={(event) => onChange({ imageUrl: event.target.value })} />}
          {project.imageUrl && <Button type="button" onClick={() => onChange({ imageUrl: "" })} className="shrink-0 rounded-xl border border-border px-3 py-2.5 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Remove</Button>}
        </div>
        {project.imageUrl && (
          <div data-project-cover-preview className="mt-3 flex max-w-sm items-center gap-3 rounded-xl border border-border bg-background p-2 dark:border-slate-700">
            <div className="grid h-12 w-16 min-h-0 min-w-0 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
              <img src={project.imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-foreground dark:text-white">Cover image ready</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><ImageIcon className="h-3 w-3 shrink-0" /> Small preview · shown on the project card</p>
            </div>
          </div>
        )}
      </div>

      <details className="mt-5 rounded-xl border border-slate-200 dark:border-slate-700">
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-foreground dark:text-white">Optional case study <span className="ml-1 text-xs font-normal text-slate-500">challenge, approach, outcome, and context</span></summary>
        <div className="grid gap-4 border-t border-slate-200 p-4 dark:border-slate-700 sm:grid-cols-2">
          <label className="flex flex-col gap-2"><span className={labelClass}>Client or project type</span><Input className={inputClass} value={project.client || ""} placeholder="Acme or independent project" onChange={(event) => onChange({ client: event.target.value })} /></label>
          <label className="flex flex-col gap-2"><span className={labelClass}>Timeline</span><Input className={inputClass} value={project.timeline || ""} placeholder="e.g. 8 weeks" onChange={(event) => onChange({ timeline: event.target.value })} /></label>
          <label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>Deliverables</span><Input className={inputClass} value={(project.deliverables || []).join(", ")} placeholder="e.g. Research, UX, launch" onChange={(event) => onChange({ deliverables: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
          <label className="flex flex-col gap-2"><span className={labelClass}>Challenge</span><Textarea className={inputClass} rows={3} value={project.challenge || ""} placeholder="What needed to change?" onChange={(event) => onChange({ challenge: event.target.value })} /></label>
          <label className="flex flex-col gap-2"><span className={labelClass}>Approach</span><Textarea className={inputClass} rows={3} value={project.solution || ""} placeholder="How did you approach it?" onChange={(event) => onChange({ solution: event.target.value })} /></label>
          <label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>Outcome</span><Textarea className={inputClass} rows={3} value={project.outcome || ""} placeholder="What improved or became possible?" onChange={(event) => onChange({ outcome: event.target.value })} /></label>
          <label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>Tools or skills</span><Input className={inputClass} value={(project.tools || []).join(", ")} placeholder="e.g. Figma, React, facilitation" onChange={(event) => onChange({ tools: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
        </div>
      </details>

      <details className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700" open={media.length > 0}>
        <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-foreground dark:text-white">
          Media <span className="ml-1 text-xs font-normal text-slate-500">images, video, audio, and documents{media.length > 0 ? ` · ${media.length} added` : ""}</span>
        </summary>
        <PortfolioMediaEditor media={media} onChange={(next) => onChange({ media: next })} />
      </details>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700"><label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><Input type="checkbox" checked={project.visibility !== "private"} onChange={(event) => { const visibility = event.target.checked ? "public" : "private"; if (visibility === "public" && project.visibility === "private" && onVisibilityChange) onVisibilityChange(visibility); else onChange({ visibility }); }} /> Show on public portfolio</label><label className="flex min-w-56 flex-1 flex-col gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:max-w-xs"><span className={labelClass}>Project link <span className="font-normal normal-case tracking-normal text-slate-400">optional</span></span><Input type="url" value={project.url || ""} placeholder="https://example.com" onChange={(event) => onChange({ url: event.target.value })} /></label></div>
    </article>
  );
}
