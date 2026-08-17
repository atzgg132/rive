"use client";

import { Button } from "@/components/ui";
import { Plus } from "lucide-react";
import PortfolioProjectEditor from "@/components/portfolio/PortfolioProjectEditor";
import { sectionClass } from "@/components/portfolio/studio/studioStyles";
import type { PortfolioContent } from "@/utils/portfolio";
import { createStudioProject } from "@/utils/portfolioDraft";

type Props = {
  content: PortfolioContent;
  onUpdateContent: (update: Partial<PortfolioContent>) => void;
  onUploadCover: (projectId: string, file: File | undefined) => void;
};

export default function StudioWorkSection({ content, onUpdateContent, onUploadCover }: Props) {
  return (
    <section className={sectionClass}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-bold text-foreground dark:text-white">Selected work</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">Show the work you want clients to remember. A title, role, short description, and cover image are enough to start.</p>
        </div>
        <Button type="button" onClick={() => onUpdateContent({ projects: [...content.projects, createStudioProject()] })} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> Add project</Button>
      </div>
      <div className="flex flex-col gap-4">
        {content.projects.map((project, index) => (
          <PortfolioProjectEditor
            key={project.id}
            project={project}
            index={index}
            practices={content.practices}
            onChange={(projectUpdate) => onUpdateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, ...projectUpdate } : item) })}
            onDelete={() => onUpdateContent({ projects: content.projects.filter((item) => item.id !== project.id) })}
            onUploadCover={(file) => { void onUploadCover(project.id, file); }}
          />
        ))}
      </div>
    </section>
  );
}
