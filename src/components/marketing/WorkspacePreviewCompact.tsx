import { CircleHelp, Menu, Search } from "lucide-react";
import { RiveLogo } from "@/components/RiveLogo";
import { WorkspaceView, type WorkspacePreviewView } from "./WorkspacePreview";

/* The mobile workspace shell — the real `md:hidden` header (logo, search,
   help, menu) over the same view in its reduced form. */

export function WorkspacePreviewCompact({ view, className = "" }: { view: WorkspacePreviewView; className?: string }) {
  return (
    <div className={`workspace-preview ${className}`} data-workspace-preview={view} role="img" aria-label="Rive product preview">
      <div className="flex h-full flex-col bg-background text-foreground">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4">
          <RiveLogo height={24} />
          <div className="flex items-center gap-4 text-muted-foreground">
            <Search className="h-5 w-5" />
            <CircleHelp className="h-5 w-5" />
            <Menu className="h-5 w-5" />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden p-4">
          <WorkspaceView view={view} compact />
        </main>
      </div>
    </div>
  );
}
