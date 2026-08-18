"use client";

import { Button, Input, Select, Textarea } from "@/components/ui";
import { Plus, Trash2 } from "lucide-react";
import { inputClass, labelClass, sectionClass } from "@/components/portfolio/studio/studioStyles";
import type { PortfolioContent } from "@/utils/portfolio";
import { createStudioTestimonial } from "@/utils/portfolioDraft";

type Props = {
  content: PortfolioContent;
  onUpdateContent: (update: Partial<PortfolioContent>) => void;
};

export default function StudioTestimonialsSection({ content, onUpdateContent }: Props) {
  return (
    <section className={sectionClass}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-bold text-foreground dark:text-white">Testimonials</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">Add historical client quotes you have permission to share. These are imported testimonials, not Rive-verified reviews.</p>
        </div>
        <Button type="button" onClick={() => onUpdateContent({ testimonials: [...content.testimonials, createStudioTestimonial()] })} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> Add testimonial</Button>
      </div>
      {content.testimonials.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">No testimonials yet. Add one when you have a past client quote ready.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {content.testimonials.map((testimonial) => (
            <div key={testimonial.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Historical testimonial</span>
                <Button type="button" title="Remove testimonial" onClick={() => onUpdateContent({ testimonials: content.testimonials.filter((item) => item.id !== testimonial.id) })} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 sm:col-span-2"><span className={labelClass}>Quote <span className="text-blue-600">Required</span></span><Textarea className={inputClass} rows={4} value={testimonial.quote} placeholder="What did the client say about working with you?" onChange={(event) => onUpdateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, quote: event.target.value } : item) })} /></label>
                <label className="flex flex-col gap-2"><span className={labelClass}>Client name <span className="text-blue-600">Required</span></span><Input className={inputClass} value={testimonial.name} placeholder="Jordan Lee" onChange={(event) => onUpdateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, name: event.target.value } : item) })} /></label>
                <label className="flex flex-col gap-2"><span className={labelClass}>Role or company</span><Input className={inputClass} value={testimonial.role || testimonial.company || ""} placeholder="Founder, Acme" onChange={(event) => onUpdateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, role: event.target.value, company: event.target.value } : item) })} /></label>
                <label className="flex flex-col gap-2"><span className={labelClass}>Source or reference</span><Input className={inputClass} value={testimonial.source || ""} placeholder="Email, LinkedIn, project archive" onChange={(event) => onUpdateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, source: event.target.value } : item) })} /></label>
                <label className="flex flex-col gap-2">
                  <span className={labelClass}>Associated project</span>
                  <Select className={inputClass} value={testimonial.projectId || ""} onChange={(event) => onUpdateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, projectId: event.target.value } : item) })}>
                    <option value="">Not associated</option>
                    {content.projects.map((project) => <option key={project.id} value={project.id}>{project.title || "Untitled project"}</option>)}
                  </Select>
                </label>
                {content.practices.length > 0 && (
                  <label className="flex flex-col gap-2">
                    <span className={labelClass}>Practice</span>
                    <Select className={inputClass} value={testimonial.practiceId || ""} onChange={(event) => onUpdateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, practiceId: event.target.value || undefined } : item) })}>
                      <option value="">Shown in every practice</option>
                      {content.practices.map((practice) => <option key={practice.id} value={practice.id}>{practice.name || "Untitled practice"}</option>)}
                    </Select>
                  </label>
                )}
              </div>
              <label className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <Input type="checkbox" checked={testimonial.visibility !== "private"} onChange={(event) => onUpdateContent({ testimonials: content.testimonials.map((item) => item.id === testimonial.id ? { ...item, visibility: event.target.checked ? "public" : "private" } : item) })} /> Show on public portfolio
              </label>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
