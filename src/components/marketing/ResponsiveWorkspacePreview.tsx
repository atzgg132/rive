import { WorkspacePreview, type WorkspacePreviewView } from "@/components/marketing/WorkspacePreview";
import { WorkspacePreviewCompact } from "@/components/marketing/WorkspacePreviewCompact";

export function ResponsiveWorkspacePreview({ view, className = "" }: { view: WorkspacePreviewView; className?: string }) {
  return (
    <>
      <WorkspacePreview view={view} className={className} />
      <WorkspacePreviewCompact view={view} className={className} />
    </>
  );
}
