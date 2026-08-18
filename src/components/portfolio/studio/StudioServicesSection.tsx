"use client";

import { Button, Input, Select, Textarea } from "@/components/ui";
import { Plus, Trash2 } from "lucide-react";
import { inputClass, labelClass, sectionClass } from "@/components/portfolio/studio/studioStyles";
import type { PortfolioContent } from "@/utils/portfolio";
import { createStudioService } from "@/utils/portfolioDraft";

type Props = {
  content: PortfolioContent;
  onUpdateContent: (update: Partial<PortfolioContent>) => void;
};

export default function StudioServicesSection({ content, onUpdateContent }: Props) {
  return (
    <section className={sectionClass}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-foreground dark:text-white">Services</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Turn your capabilities into clear client outcomes.</p>
        </div>
        <Button type="button" onClick={() => onUpdateContent({ services: [...content.services, createStudioService()] })} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> Add service</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {content.services.map((service) => (
          <div key={service.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="mb-3 flex justify-end">
              <Button type="button" onClick={() => onUpdateContent({ services: content.services.filter((item) => item.id !== service.id) })} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></Button>
            </div>
            <Input className={`${inputClass} mb-3`} value={service.title || ""} placeholder="Service name" onChange={(event) => onUpdateContent({ services: content.services.map((item) => item.id === service.id ? { ...item, title: event.target.value } : item) })} />
            <Textarea className={inputClass} rows={3} value={service.description || ""} placeholder="Describe the outcome clients can expect" onChange={(event) => onUpdateContent({ services: content.services.map((item) => item.id === service.id ? { ...item, description: event.target.value } : item) })} />
            {content.practices.length > 0 && (
              <label className="mt-3 flex flex-col gap-2">
                <span className={labelClass}>Practice</span>
                <Select className={inputClass} value={service.practiceId || ""} onChange={(event) => onUpdateContent({ services: content.services.map((item) => item.id === service.id ? { ...item, practiceId: event.target.value || undefined } : item) })}>
                  <option value="">Shown in every practice</option>
                  {content.practices.map((practice) => <option key={practice.id} value={practice.id}>{practice.name || "Untitled practice"}</option>)}
                </Select>
              </label>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
