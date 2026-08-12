"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { History, Loader2, Undo2 } from "lucide-react";

import { Badge, Button, Card, CardContent, EmptyState } from "@/components/ui";
import type { MigrationHistoryEntry } from "./types";

type RollbackPreview = {
  deleted: Record<string, number>;
  conflicts: Array<{ label: string; reason: string }>;
};

/**
 * Migration history.
 *
 * Lives on the migration screen rather than in global navigation, because it is
 * only meaningful next to the thing it describes and Rive's information
 * architecture does not justify a new top-level entry for it.
 */
export default function MigrationHistory({ onResume }: { onResume: (id: string) => void }) {
  const [migrations, setMigrations] = useState<MigrationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; data: RollbackPreview } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/migrations");
      if (!response.ok) return;
      const data = await response.json();
      setMigrations(data.migrations || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPreview(id: string) {
    setPendingId(id);
    try {
      const response = await fetch(`/api/migrations/${id}/rollback`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "This import cannot be undone.");
      setPreview({ id, data: { deleted: data.deleted || {}, conflicts: data.conflicts || [] } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This import cannot be undone.");
    } finally {
      setPendingId(null);
    }
  }

  async function confirmRollback(id: string) {
    setPendingId(id);
    try {
      const response = await fetch(`/api/migrations/${id}/rollback`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "This import could not be undone.");
      const removed = Object.values(data.deleted as Record<string, number>).reduce((sum, count) => sum + count, 0);
      toast.success(
        data.conflicts?.length
          ? `${removed} records removed. ${data.conflicts.length} were kept because you had changed them.`
          : `${removed} records removed.`,
      );
      setPreview(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This import could not be undone.");
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading your imports
        </CardContent>
      </Card>
    );
  }

  if (!migrations.length) return null;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2.5">
          <History className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-foreground">Your imports</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pick up an unfinished import, or undo one you have changed your mind about.
            </p>
          </div>
        </div>

        {migrations.length === 0 ? (
          <EmptyState title="No imports yet" description="Files you bring across will be listed here." />
        ) : null}

        <ul className="space-y-2">
          {migrations.map((migration) => (
            <li key={migration.id} className="rounded-xl border border-border bg-background px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {new Date(migration.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <Badge variant={statusVariant(migration.status)}>{statusLabel(migration.status)}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {migration.files.length} {migration.files.length === 1 ? "source" : "sources"} ·{" "}
                    {migration.files
                      .map((file) => (file.sheetName ? `${file.name} (${file.sheetName})` : file.name))
                      .slice(0, 3)
                      .join(", ")}
                    {migration.files.length > 3 ? "…" : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {migration.created} created
                    {migration.linked > 0 ? ` · ${migration.linked} linked` : ""}
                    {migration.skipped > 0 ? ` · ${migration.skipped} skipped` : ""}
                    {migration.warnings > 0 ? ` · ${migration.warnings} needing a look` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {isResumable(migration.status) ? (
                    <Button type="button" variant="secondary" size="sm" onClick={() => onResume(migration.id)}>
                      Continue
                    </Button>
                  ) : null}
                  {migration.canRollback ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pendingId === migration.id}
                      onClick={() => openPreview(migration.id)}
                    >
                      {pendingId === migration.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Undo
                    </Button>
                  ) : null}
                </div>
              </div>

              {preview?.id === migration.id ? (
                <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-sm font-semibold text-foreground">
                    {totalOf(preview.data.deleted)} {totalOf(preview.data.deleted) === 1 ? "record" : "records"} will be
                    removed
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {describeDeleted(preview.data.deleted) || "Nothing is left to remove from this import."}
                  </p>
                  {preview.data.conflicts.length ? (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-foreground">
                        {preview.data.conflicts.length} will be kept
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {preview.data.conflicts.slice(0, 5).map((conflict) => (
                          <li key={`${conflict.label}-${conflict.reason}`} className="text-[0.7rem] text-muted-foreground">
                            {conflict.label} — {conflict.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={pendingId === migration.id || totalOf(preview.data.deleted) === 0}
                      onClick={() => confirmRollback(migration.id)}
                    >
                      {pendingId === migration.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                      Remove them
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setPreview(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function totalOf(deleted: Record<string, number>): number {
  return Object.values(deleted).reduce((sum, count) => sum + count, 0);
}

function describeDeleted(deleted: Record<string, number>): string {
  return Object.entries(deleted)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");
}

function isResumable(status: string): boolean {
  return ["created", "uploading", "profiling", "mapping", "review_required", "ready", "failed"].includes(status);
}

function statusLabel(status: string): string {
  switch (status) {
    case "completed": return "Imported";
    case "completed_with_issues": return "Imported with notes";
    case "review_required": return "Needs review";
    case "ready": return "Ready to import";
    case "committing": return "Importing";
    case "failed": return "Stopped";
    case "rolled_back": return "Undone";
    default: return "In progress";
  }
}

function statusVariant(status: string): "default" | "secondary" | "success" | "warning" | "destructive" {
  if (status === "completed") return "success";
  if (status === "completed_with_issues" || status === "review_required") return "warning";
  if (status === "failed") return "destructive";
  if (status === "rolled_back") return "secondary";
  return "default";
}
