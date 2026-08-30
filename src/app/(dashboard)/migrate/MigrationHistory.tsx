"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";

import { Badge, Button, Card, CardContent, EmptyState } from "@/components/ui";
import type { MigrationHistoryEntry } from "./types";

/**
 * Migration history.
 *
 * Imported records and migration history are retained. Unfinished migrations
 * can be abandoned from the wizard without deleting database rows.
 */
export default function MigrationHistory({ onResume }: { onResume: (id: string) => void }) {
  const [migrations, setMigrations] = useState<MigrationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

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
              Pick up an unfinished import. Imported records and migration history are retained.
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

                {isResumable(migration.status) ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => onResume(migration.id)}>
                    Continue
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function isResumable(status: string): boolean {
  // A commit in flight is safe to reopen: the wizard only observes it and
  // polls until the server reaches a terminal state. It never starts a second
  // commit from this button.
  return ["created", "uploading", "queued_analysis", "profiling", "mapping", "review_required", "ready", "queued_commit", "failed", "committing"].includes(status);
}

function statusLabel(status: string): string {
  switch (status) {
    case "completed": return "Imported";
    case "completed_with_issues": return "Imported with notes";
    case "abandoned": return "Abandoned";
    case "review_required": return "Needs review";
    case "ready": return "Ready to import";
    case "committing": return "Importing";
    case "queued_commit": return "Queued to import";
    case "queued_analysis": return "Queued to analyze";
    case "failed": return "Stopped";
    case "rolled_back": return "Previously undone";
    default: return "In progress";
  }
}

function statusVariant(status: string): "default" | "secondary" | "success" | "warning" | "destructive" {
  if (status === "completed") return "success";
  if (status === "completed_with_issues" || status === "review_required") return "warning";
  if (status === "failed") return "destructive";
  if (status === "abandoned" || status === "rolled_back") return "secondary";
  return "default";
}
