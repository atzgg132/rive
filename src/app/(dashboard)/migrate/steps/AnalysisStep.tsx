"use client";

import { Briefcase, CheckCircle2, DollarSign, FileSpreadsheet, Receipt, Users } from "lucide-react";

import { Alert, Badge, Button, Card, CardContent } from "@/components/ui";
import { ENTITY_LABELS, type MigrationDetail } from "../types";

const ENTITY_ICONS: Record<string, typeof Users> = {
  clients: Users,
  projects: Briefcase,
  invoices: DollarSign,
  expenses: Receipt,
};

/**
 * Step 3 — what Rive found.
 *
 * Leads with the result, then states how many things need a person, in that
 * order. "7 things need your attention" is more useful than a percentage, and
 * an honest number here is what earns the right to automate the rest.
 */
export default function AnalysisStep({
  detail,
  onReview,
  onContinue,
}: {
  detail: MigrationDetail;
  onReview: () => void;
  onContinue: () => void;
}) {
  const plan = detail.plan;
  if (!plan) return null;

  const attention = plan.reviewItems.length + plan.blocked.length + unclassifiedCount(detail);
  const entities = Object.entries(plan.counts).filter(([, counts]) => counts.create + counts.link > 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-foreground">What Rive found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              From {detail.sources.length} {detail.sources.length === 1 ? "source" : "sources"} across your files.
            </p>
          </div>

          {entities.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {entities.map(([entity, counts]) => {
                const Icon = ENTITY_ICONS[entity] || FileSpreadsheet;
                return (
                  <div key={entity} className="rounded-xl border border-border bg-background p-4">
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-2.5 text-2xl font-extrabold leading-none tracking-tight text-foreground">
                      {counts.create}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">{ENTITY_LABELS[entity] || entity}</p>
                    {counts.link > 0 ? (
                      <p className="mt-1 text-[0.7rem] text-muted-foreground">
                        {counts.link} linked to records you already have
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <Alert variant="warning">
              Rive did not find any records it could import from these files. Check the sources below and tell Rive what
              each one holds.
            </Alert>
          )}

          <ul className="space-y-2" aria-label="Files Rive read">
            {detail.sources.map((source) => (
              <li
                key={source.sourceId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {source.entity === "unknown" || source.entity === "mixed" ? (
                    <FileSpreadsheet className="h-4 w-4 shrink-0 text-warning-foreground" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {source.name}
                      {source.sheetName ? <span className="text-muted-foreground"> · {source.sheetName}</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{source.reason}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">{source.rowCount.toLocaleString()} rows</span>
                  <Badge variant={badgeVariant(source.entity, source.confidence)}>
                    {source.entity === "unknown"
                      ? "Needs your input"
                      : source.entity === "mixed"
                        ? "Ambiguous"
                        : ENTITY_LABELS[source.entity] || source.entity}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {attention > 0 ? (
              <>
                <p className="text-sm font-bold text-foreground">
                  {attention} {attention === 1 ? "thing needs" : "things need"} your attention
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rive will not guess where it is not sure. Everything else is ready to import.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-foreground">Nothing needs your attention</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rive matched every file, field, and relationship on its own.
                </p>
              </>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onReview}>
              {attention > 0 ? "Review these" : "Check the details"}
            </Button>
            <Button type="button" data-guide-target="migration-review" onClick={onContinue} disabled={plan.totals.create + plan.totals.link === 0}>
              See what will be imported
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function badgeVariant(entity: string, confidence: number | null): "default" | "secondary" | "success" | "warning" {
  if (entity === "unknown" || entity === "mixed") return "warning";
  return (confidence ?? 0) >= 0.7 ? "success" : "secondary";
}

function unclassifiedCount(detail: MigrationDetail): number {
  return detail.sources.filter((source) => source.entity === "unknown" || source.entity === "mixed").length;
}
