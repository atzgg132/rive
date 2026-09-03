"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Plus } from "lucide-react";
import PortfolioProjectEditor from "@/components/portfolio/PortfolioProjectEditor";
import { sectionClass } from "@/components/portfolio/studio/studioStyles";
import { isBlankPortfolioProject, type PortfolioContent, type PortfolioProject } from "@/utils/portfolio";
import { createStudioProject, moveItem } from "@/utils/portfolioDraft";

type Props = {
  content: PortfolioContent;
  onUpdateContent: (update: Partial<PortfolioContent>) => void;
  onUploadCover: (projectId: string, file: File | undefined) => void;
  onVisibilityChange?: (projectId: string, visibility: "public" | "private") => void;
};

export default function StudioWorkSection({ content, onUpdateContent, onUploadCover, onVisibilityChange }: Props) {
  /* Drag state lives here because the list owns the order. The editor cards only
     report where a drag started and where it was dropped. */
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<{ project: PortfolioProject; index: number } | null>(null);

  const move = (from: number, to: number) => {
    const projects = moveItem(content.projects, from, to);
    if (projects !== content.projects) onUpdateContent({ projects });
  };

  /* Removing is instant and silent, which is wrong for the one control that can
     destroy a case study. An untouched blank row goes at once; anything with
     content asks first, and every removal can be undone until the next one. */
  const deleteNow = (projectId: string) => {
    const index = content.projects.findIndex((item) => item.id === projectId);
    if (index < 0) return;
    const project = content.projects[index];
    onUpdateContent({ projects: content.projects.filter((item) => item.id !== projectId) });
    setLastDeleted({ project, index });
    setConfirmId(null);
  };

  const requestDelete = (project: PortfolioProject) => {
    if (isBlankPortfolioProject(project)) {
      deleteNow(project.id);
      return;
    }
    setConfirmId(project.id);
  };

  const undoDelete = () => {
    if (!lastDeleted) return;
    /* Matches the 30-project cap in validatePortfolioContent: restoring past
       it would fail every save with a message that names no section. */
    if (content.projects.length >= 30) {
      setLastDeleted(null);
      return;
    }
    const index = Math.max(0, Math.min(lastDeleted.index, content.projects.length));
    onUpdateContent({ projects: [...content.projects.slice(0, index), lastDeleted.project, ...content.projects.slice(index)] });
    setLastDeleted(null);
  };

  /* The strip is a momentary safety net, not a persistent state: after a few
     seconds the removal stands and the control goes away on its own. */
  useEffect(() => {
    if (!lastDeleted) return;
    const timer = window.setTimeout(() => setLastDeleted(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [lastDeleted]);

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <section className={sectionClass}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-bold text-foreground dark:text-white">Selected work</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
            Show the work you want clients to remember. A title, role, short description, and cover image are enough to start.
            {content.projects.length > 1 && " Visitors read these in the order below — drag a project, or use the arrows, to change it."}
          </p>
        </div>
        <Button type="button" onClick={() => onUpdateContent({ projects: [...content.projects, createStudioProject()] })} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Plus className="h-3.5 w-3.5" /> Add project</Button>
      </div>
      <div className="flex flex-col gap-4">
        {content.projects.map((project, index) => {
          const isDropTarget = dragIndex !== null && overIndex === index && dragIndex !== index;
          return (
            <div
              key={project.id}
              onDragOver={(event) => {
                if (dragIndex === null) return;
                // Without preventDefault the drop never fires: the default is to reject it.
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setOverIndex(index);
              }}
              onDrop={(event) => {
                if (dragIndex === null) return;
                event.preventDefault();
                move(dragIndex, index);
                endDrag();
              }}
              className={`rounded-2xl transition ${isDropTarget ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""} ${dragIndex === index ? "opacity-50" : ""}`}
            >
              <PortfolioProjectEditor
                project={project}
                index={index}
                total={content.projects.length}
                practices={content.practices}
                onChange={(projectUpdate) => onUpdateContent({ projects: content.projects.map((item) => item.id === project.id ? { ...item, ...projectUpdate } : item) })}
                onDelete={() => deleteNow(project.id)}
                onDeleteRequest={() => requestDelete(project)}
                onCancelDelete={() => setConfirmId(null)}
                deleteConfirmArmed={confirmId === project.id}
                onUploadCover={(file) => { void onUploadCover(project.id, file); }}
                onVisibilityChange={(visibility) => onVisibilityChange?.(project.id, visibility)}
                onMove={(to) => move(index, to)}
                dragHandleProps={{
                  draggable: true,
                  onDragStart: (event) => {
                    setDragIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                    // Firefox ignores a drag that carries no data at all.
                    event.dataTransfer.setData("text/plain", String(index));
                  },
                  onDragEnd: endDrag,
                }}
              />
            </div>
          );
        })}
      </div>
      {lastDeleted && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm">
          <span className="font-semibold text-foreground">Removed {lastDeleted.project.title.trim() || "untitled project"}.</span>
          <Button type="button" onClick={undoDelete} className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-accent">Undo</Button>
        </div>
      )}
    </section>
  );
}
