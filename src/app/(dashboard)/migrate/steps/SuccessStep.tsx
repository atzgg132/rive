"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button, buttonVariants, Card, CardContent } from "@/components/ui";
import { ENTITY_LABELS } from "../types";

/**
 * Step 6 — done.
 *
 * Shows what actually landed, taken from the commit result rather than the
 * plan, and points at the workspace it built. Undo stays visible: a migration
 * the user cannot reverse is a migration they will hesitate to run.
 */
export default function SuccessStep({
  result,
  migrationId,
  onStartAnother,
}: {
  result: { created: Record<string, number>; linked: number; skipped: number; total: number };
  migrationId: string | null;
  onStartAnother: () => void;
}) {
  const entries = Object.entries(result.created).filter(([, count]) => count > 0);

  return (
    <Card>
      <CardContent className="space-y-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-success/25 bg-success/10 text-success">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-bold text-foreground">Your workspace is ready</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.total.toLocaleString()} {result.total === 1 ? "record" : "records"} imported
              {result.linked > 0 ? `, ${result.linked} linked to what you already had` : ""}
              {result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.
            </p>
          </div>
        </div>

        {entries.length ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {entries.map(([entity, count]) => (
              <div key={entity} className="rounded-xl border border-border bg-background p-4">
                <dt className="text-xs font-medium text-muted-foreground">{ENTITY_LABELS[entity] || entity}</dt>
                <dd className="mt-1 text-2xl font-extrabold leading-none tracking-tight text-foreground">{count}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Changed your mind? You can undo this import from your migration history for anything you have not edited
            since.
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={onStartAnother}>
              Import more files
            </Button>
            {migrationId ? (
              <Link href="/migrate" className={buttonVariants({ variant: "secondary" })}>
                Migration history
              </Link>
            ) : null}
            <Link href="/dashboard" className={buttonVariants({ variant: "default" })}>
              Go to Overview
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
