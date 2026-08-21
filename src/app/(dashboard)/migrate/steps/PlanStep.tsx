"use client";

import { Loader2 } from "lucide-react";

import { Alert, Button, Card, CardContent } from "@/components/ui";
import { ENTITY_LABELS, type MigrationDetail } from "../types";

/**
 * Step 5 — the import summary.
 *
 * This is the last screen before anything is written, and it states the exact
 * operations that will run. The commit request carries this plan's hash, so
 * what is shown here is provably what executes.
 */
export default function PlanStep({
  detail,
  committing,
  onCommit,
  onBack,
}: {
  detail: MigrationDetail;
  committing: boolean;
  onCommit: () => void;
  onBack: () => void;
}) {
  const plan = detail.plan;
  if (!plan) return null;

  const rows = Object.entries(plan.counts).filter(
    ([, counts]) => counts.create + counts.link + counts.skip + counts.review > 0,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5">
          <div>
            <h2 className="text-base font-bold text-foreground">What will happen</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Rive will create {plan.totals.create.toLocaleString()}{" "}
              {plan.totals.create === 1 ? "record" : "records"}
              {plan.totals.link > 0 ? `, link ${plan.totals.link} to records you already have` : ""}
              {plan.totals.skip > 0 ? `, and skip ${plan.totals.skip}` : ""}.
            </p>
          </div>

          <div className="table-scroll-region">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <caption className="sr-only">Records to be created, linked, and skipped by record type</caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-semibold">Record type</th>
                  <th scope="col" className="py-2 px-3 text-right font-semibold">Create</th>
                  <th scope="col" className="py-2 px-3 text-right font-semibold">Link</th>
                  <th scope="col" className="py-2 px-3 text-right font-semibold">Skip</th>
                  <th scope="col" className="py-2 pl-3 text-right font-semibold">Needs a look</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([entity, counts]) => (
                  <tr key={entity} className="border-b border-border/60 last:border-none">
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium text-foreground">
                      {ENTITY_LABELS[entity] || entity}
                    </th>
                    <td className="py-2.5 px-3 text-right tabular-nums text-foreground">{counts.create}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{counts.link || "—"}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{counts.skip || "—"}</td>
                    <td className="py-2.5 pl-3 text-right tabular-nums text-muted-foreground">{counts.review || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {plan.blocked.length ? (
            <Alert variant="warning">
              {plan.blocked.length} {plan.blocked.length === 1 ? "row" : "rows"} will not be imported because
              {plan.blocked.length === 1 ? " it is" : " they are"} missing something Rive needs. Everything else still imports.
            </Alert>
          ) : null}

          {plan.metrics.warningCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {plan.metrics.warningCount} {plan.metrics.warningCount === 1 ? "note" : "notes"} were recorded against
              imported records — things like a shortened field or an assumed payment date. You can see them on each
              record after importing.
            </p>
          ) : null}

          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Rive matched {Math.round(plan.metrics.autoMappingRate * 100)}% of columns and{" "}
              {Math.round(plan.metrics.relationshipResolutionRate * 100)}% of relationships without asking. You can undo
              this import afterwards for anything you have not changed.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={committing}>
          Back to review
        </Button>
        <Button type="button" data-guide-target="migration-upload" onClick={onCommit} disabled={committing || plan.totals.create + plan.totals.link === 0}>
          {committing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {committing ? "Importing" : "Import workspace"}
        </Button>
      </div>
    </div>
  );
}
