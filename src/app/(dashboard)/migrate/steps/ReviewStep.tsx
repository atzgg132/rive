"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Eye, Link2, Loader2, Users } from "lucide-react";

import { Alert, Badge, Button, Card, CardContent, Select } from "@/components/ui";
import { DISPLAY_CURRENCIES } from "@/lib/currency";
import { ENTITY_LABELS, type MigrationDetail, type MigrationRecordView, type MigrationSource } from "../types";

/**
 * Step 4 — resolve what Rive would not decide.
 *
 * Every item here is phrased as a question with concrete options, not as an
 * error code. Where an answer applies to more than one row, it is offered once
 * and applied to all of them.
 */
export default function ReviewStep({
  detail,
  busy,
  onPatch,
  onRefresh,
  onContinue,
  onBack,
}: {
  detail: MigrationDetail;
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onRefresh: (filter?: string, page?: number) => Promise<MigrationDetail | null>;
  onContinue: () => void;
  onBack: () => void;
}) {
  const plan = detail.plan;
  const unclassified = detail.sources.filter((source) => source.entity === "unknown" || source.entity === "mixed");
  const blocked = plan?.blocked || [];

  // The API returns one page of records that need attention. Large migrations
  // load the rest on request rather than shipping every row up front.
  const [extraRecords, setExtraRecords] = useState<MigrationRecordView[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPage, setNextPage] = useState(1);

  const records = useMemo(() => [...detail.records, ...extraRecords], [detail.records, extraRecords]);
  const loadedCount = records.length;
  const hasMore = loadedCount < detail.pagination.total;

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await onRefresh("issues", nextPage);
      if (data?.records?.length) {
        setExtraRecords((current) => [...current, ...data.records]);
        setNextPage((page) => page + 1);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const bulkIssues = useBulkIssues(records);
  const relationshipRecords = records.filter(
    (record) => record.relationshipCandidates.length > 0 && record.status !== "error",
  );
  const duplicateRecords = records.filter(
    (record) => record.action === "review" && record.duplicateCandidates.length > 0,
  );

  const nothingToDo =
    !unclassified.length && !bulkIssues.length && !relationshipRecords.length && !duplicateRecords.length && !blocked.length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card px-4 py-3" role="status" aria-live="polite">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-foreground">Decision progress</span>
          <span className="text-muted-foreground">{detail.unresolved.total} remaining</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {detail.unresolved.review} uncertain matches · {detail.unresolved.invalid} invalid rows
        </p>
      </div>
      {nothingToDo ? (
        <Alert variant="success">
          Everything matched. There is nothing here that needs a decision from you.
        </Alert>
      ) : null}

      {unclassified.length ? (
        <Card>
          <CardContent className="space-y-4">
            <SectionHeading
              icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
              title={`${unclassified.length} ${unclassified.length === 1 ? "file needs" : "files need"} a record type`}
              description="Rive could not tell what these hold. Choose one and it will map the columns straight away."
            />
            {unclassified.map((source) => (
              <div key={source.sourceId} className="rounded-xl border border-border bg-background p-4">
                <p className="text-sm font-semibold text-foreground">
                  {source.name}
                  {source.sheetName ? <span className="text-muted-foreground"> · {source.sheetName}</span> : null}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{source.reason}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Columns: {source.headers.slice(0, 6).join(", ")}
                  {source.headers.length > 6 ? ` and ${source.headers.length - 6} more` : ""}
                </p>
                <div className="mt-3 max-w-xs">
                  <label htmlFor={`classify-${source.sourceId}`} className="sr-only">
                    Record type for {source.name}
                  </label>
                  <Select
                    id={`classify-${source.sourceId}`}
                    defaultValue=""
                    disabled={busy}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      onPatch({ sources: { [source.sourceId!]: { classification: event.target.value } } });
                    }}
                  >
                    <option value="">Choose what this file holds…</option>
                    {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {bulkIssues.length ? (
        <Card>
          <CardContent className="space-y-4">
            <SectionHeading
              icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
              title="Values Rive did not recognise"
              description="Answer once and Rive applies it to every row that used the same value."
            />
            {bulkIssues.map((issue) => (
              <BulkIssueRow key={issue.key} issue={issue} sources={detail.sources} busy={busy} onPatch={onPatch} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {relationshipRecords.length ? (
        <Card>
          <CardContent className="space-y-4">
            <SectionHeading
              icon={<Link2 className="h-4 w-4" aria-hidden="true" />}
              title={`${relationshipRecords.length} ${relationshipRecords.length === 1 ? "record is" : "records are"} not linked yet`}
              description="Rive found a close match but will not connect records on a resemblance alone."
            />
            {relationshipRecords.slice(0, 25).map((record) => (
              <div key={record.sourceKey} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{labelOf(record)}</p>
                  <span className="text-xs text-muted-foreground">
                    {record.importFile?.name} · row {record.sourceRow}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Named <span className="font-medium text-foreground">{referenceOf(record)}</span>, which Rive could not
                  match with certainty.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {record.relationshipCandidates.slice(0, 3).map((candidate) => (
                    <Button
                      key={`${candidate.existingId || candidate.groupKey}`}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        onPatch({
                          resolutions: {
                            [record.sourceKey]: {
                              decision: "link",
                              existingId: candidate.existingId || undefined,
                              groupKey: candidate.groupKey || undefined,
                            },
                          },
                        })
                      }
                    >
                      Link to {candidate.label}
                      <span className="text-muted-foreground">{Math.round(candidate.confidence * 100)}%</span>
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => onPatch({ resolutions: { [record.sourceKey]: { decision: "create" } } })}
                  >
                    Keep separate
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => onPatch({ resolutions: { [record.sourceKey]: { decision: "skip" } } })}
                  >
                    Skip this row
                  </Button>
                </div>
                {record.relationshipCandidates[0]?.evidence?.length ? (
                  <p className="mt-2 text-[0.7rem] text-muted-foreground">
                    Closest match because {record.relationshipCandidates[0].evidence.join(", and ")}.
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {duplicateRecords.length ? (
        <Card>
          <CardContent className="space-y-4">
            <SectionHeading
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              title={`${duplicateRecords.length} possible ${duplicateRecords.length === 1 ? "duplicate" : "duplicates"}`}
              description="Rive will keep these separate unless you say otherwise. Nothing you already have will be overwritten."
            />
            {duplicateRecords.slice(0, 25).map((record) => {
              const candidate = record.duplicateCandidates[0];
              return (
                <div key={record.sourceKey} className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold text-foreground">We think these are the same</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-border px-3 py-2">
                      <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                        {candidate.scope === "workspace" ? "Already in Rive" : "Earlier in your files"}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-foreground">{candidate.label}</p>
                    </div>
                    <div className="rounded-lg border border-border px-3 py-2">
                      <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Being imported</p>
                      <p className="mt-0.5 truncate text-sm text-foreground">{labelOf(record)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {Math.round(candidate.confidence * 100)}% confident — {candidate.evidence.join(", ")}.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => onPatch({ resolutions: { [record.sourceKey]: { decision: "merge" } } })}
                    >
                      {candidate.scope === "workspace" ? "Use the existing record" : "Merge them"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => onPatch({ resolutions: { [record.sourceKey]: { decision: "create" } } })}
                    >
                      Keep both
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => onPatch({ resolutions: { [record.sourceKey]: { decision: "skip" } } })}
                    >
                      Skip this row
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" size="sm" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
            Show more ({detail.pagination.total - loadedCount} left)
          </Button>
        </div>
      ) : null}

      <ColumnMapping sources={detail.sources} busy={busy} onPatch={onPatch} />

      <RecordPreview migrationId={detail.migration.id} />

      {blocked.length ? (
        <Card>
          <CardContent className="space-y-3">
            <SectionHeading
              icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
              title={`${blocked.length} ${blocked.length === 1 ? "row cannot" : "rows cannot"} be imported`}
              description="These need fixing in your source file. Everything else will still import."
            />
            <ul className="space-y-2">
              {blocked.slice(0, 25).map((item) => (
                <li key={item.sourceKey} className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs text-destructive">{item.message}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    disabled={busy}
                    onClick={() => onPatch({ resolutions: { [item.sourceKey]: { decision: "skip" } } })}
                  >
                    Skip for now
                  </Button>
                </li>
              ))}
            </ul>
            {blocked.length > 25 ? (
              <p className="text-xs text-muted-foreground">and {blocked.length - 25} more.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>
          Back to what Rive found
        </Button>
        <div className="flex items-center gap-2">
          {busy ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Rechecking
            </span>
          ) : null}
          <Button type="button" data-guide-target="migration-review" onClick={onContinue} disabled={busy || detail.unresolved.total > 0 || unclassified.length > 0}>
            See what will be imported
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecordPreview({ migrationId }: { migrationId: string }) {
  const [filter, setFilter] = useState("clients");
  const [records, setRecords] = useState<MigrationRecordView[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function open(nextFilter: string, nextPage = 0) {
    setLoading(true);
    try {
      const response = await fetch(`/api/migrations/${migrationId}?filter=${nextFilter}&page=${nextPage}`);
      const data = await response.json();
      if (!response.ok) return;
      setFilter(nextFilter);
      setPage(nextPage);
      setRecords(data.records || []);
      setTotal(data.pagination?.total || 0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <SectionHeading icon={<Eye className="h-4 w-4" aria-hidden="true" />} title="Record preview" description="Inspect source provenance, raw and normalized values, warnings, proposed action, and relationships before commit." />
        <div className="flex flex-wrap gap-2">
          {Object.entries(ENTITY_LABELS).map(([value, label]) => (
            <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "secondary"} disabled={loading} onClick={() => void open(value)}>{label}</Button>
          ))}
        </div>
        {!records.length && !loading ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => void open(filter)}>Load {ENTITY_LABELS[filter]?.toLowerCase()} preview</Button>
        ) : null}
        {loading ? <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading preview</p> : null}
        <div className="space-y-3">
          {records.map((record) => (
            <article key={record.sourceKey} className="rounded-xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{labelOf(record)}</p>
                <Badge variant={record.action === "skip" ? "warning" : record.action === "link" ? "secondary" : "success"}>{record.action}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{record.importFile?.name}{record.importFile?.sheetName ? ` · ${record.importFile.sheetName}` : ""} · row {record.sourceRow}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ValueBlock label="Source values" value={record.raw} />
                <ValueBlock label="Rive values" value={record.normalized} />
              </div>
              {record.relationshipCandidates.length ? <p className="mt-3 text-xs text-muted-foreground">Relationships: {record.relationshipCandidates.map((candidate) => `${candidate.label} (${Math.round(candidate.confidence * 100)}%)`).join(", ")}</p> : null}
              {record.warnings.length ? <p className="mt-2 text-xs text-warning-foreground">Warnings: {record.warnings.map((warning) => warning.message).join(" · ")}</p> : null}
            </article>
          ))}
        </div>
        {total > 50 ? (
          <div className="flex items-center justify-between gap-3">
            <Button type="button" size="sm" variant="ghost" disabled={loading || page === 0} onClick={() => void open(filter, page - 1)}>Previous</Button>
            <span className="text-xs text-muted-foreground">{page * 50 + 1}–{Math.min(total, (page + 1) * 50)} of {total}</span>
            <Button type="button" size="sm" variant="ghost" disabled={loading || (page + 1) * 50 >= total} onClick={() => void open(filter, page + 1)}>Next</Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ValueBlock({ label, value }: { label: string; value: Record<string, unknown> }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <dl className="mt-2 space-y-1 text-xs">
        {Object.entries(value).slice(0, 10).map(([key, entry]) => (
          <div key={key} className="grid grid-cols-[minmax(5rem,0.4fr)_1fr] gap-2"><dt className="truncate text-muted-foreground">{key}</dt><dd className="truncate text-foreground">{String(entry ?? "—")}</dd></div>
        ))}
      </dl>
    </div>
  );
}

function SectionHeading({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

type BulkIssue = {
  key: string;
  kind: "currency" | "status" | "category" | "priority";
  sourceValue: string;
  message: string;
  count: number;
  suggestions: Array<{ label: string; value: string }>;
};

/**
 * Collapse row-level warnings into one question per distinct source value.
 *
 * This is what turns "23 rows have an unknown currency" into a single choice
 * the user makes once.
 */
function useBulkIssues(records: MigrationRecordView[]): BulkIssue[] {
  return useMemo(() => {
    const grouped = new Map<string, BulkIssue>();
    for (const record of records) {
      for (const warning of record.warnings) {
        const kind =
          warning.code === "CURRENCY_AMBIGUOUS"
            ? "currency"
            : warning.code === "STATUS_UNKNOWN"
              ? statusKindFor(record.entity, warning.field)
              : null;
        if (!kind || !warning.sourceValue) continue;
        const key = `${kind}:${warning.sourceValue}`;
        const existing = grouped.get(key);
        if (existing) {
          existing.count += 1;
          continue;
        }
        grouped.set(key, {
          key,
          kind,
          sourceValue: warning.sourceValue,
          message: warning.message,
          count: 1,
          suggestions: warning.suggestions || [],
        });
      }
    }
    return [...grouped.values()].sort((a, b) => b.count - a.count);
  }, [records]);
}

function statusKindFor(entity: string, field?: string): "status" | "category" | "priority" {
  if (field === "category") return "category";
  if (field === "priority") return "priority";
  return entity === "expenses" ? "category" : "status";
}

function BulkIssueRow({
  issue,
  sources,
  busy,
  onPatch,
}: {
  issue: BulkIssue;
  sources: MigrationSource[];
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const options =
    issue.kind === "currency" && !issue.suggestions.length
      ? DISPLAY_CURRENCIES.map((currency) => ({ label: `${currency.code} — ${currency.label}`, value: currency.code }))
      : issue.suggestions;

  function apply(value: string) {
    // The correction is stored against the raw value on every source, so one
    // answer covers the same value wherever it appears.
    const payload: Record<string, unknown> = {};
    for (const source of sources) {
      if (!source.sourceId) continue;
      payload[source.sourceId] = { valueMappings: { [issue.kind]: { [issue.sourceValue]: value } } };
    }
    onPatch({ sources: payload });
  }

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-foreground">{issue.message}</p>
        <Badge variant="secondary">
          {issue.count} {issue.count === 1 ? "row" : "rows"}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {options.slice(0, 4).map((option) => (
          <Button key={option.value} type="button" variant="secondary" size="sm" disabled={busy} onClick={() => apply(option.value)}>
            Use {option.label}
          </Button>
        ))}
        {options.length > 4 ? (
          <div className="max-w-[14rem]">
            <label className="sr-only" htmlFor={`bulk-${issue.key}`}>
              Choose a value for {issue.sourceValue}
            </label>
            <Select
              id={`bulk-${issue.key}`}
              defaultValue=""
              disabled={busy}
              onChange={(event) => event.target.value && apply(event.target.value)}
            >
              <option value="">Choose another…</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>
      {issue.count > 1 ? (
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          Your answer is applied to all {issue.count} rows that use “{issue.sourceValue}”.
        </p>
      ) : null}
    </div>
  );
}

/** Manual column mapping, collapsed by default so clean sources stay quiet. */
function ColumnMapping({
  sources,
  busy,
  onPatch,
}: {
  sources: MigrationSource[];
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const mappable = sources.filter((source) => source.options.length > 0 && source.mapping);
  if (!mappable.length) return null;

  return (
    <Card>
      <CardContent className="space-y-3">
        <SectionHeading
          icon={<ChevronDown className="h-4 w-4" aria-hidden="true" />}
          title="Column mapping"
          description="Rive matched these itself. Open a file to check or change anything."
        />
        {mappable.map((source) => {
          if (!source.sourceId) return null;
          const sourceId = source.sourceId;
          const unresolved = (source.mapping || []).filter((mapping) => mapping.status === "UNRESOLVED").length;
          const isOpen = open === source.sourceId;
          return (
            <div key={source.sourceId} className="rounded-xl border border-border bg-background">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : source.sourceId)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {source.name}
                    {source.sheetName ? <span className="text-muted-foreground"> · {source.sheetName}</span> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {ENTITY_LABELS[source.entity] || source.entity} ·{" "}
                    {unresolved ? `${unresolved} unmapped` : "all columns mapped"}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {isOpen ? (
                <div className="space-y-2 border-t border-border px-4 py-3">
                  {(source.mapping || []).map((mapping) => (
                    <div key={mapping.sourceColumn} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <div className="min-w-0 sm:w-1/3">
                        <p className="truncate text-sm font-medium text-foreground">{mapping.sourceColumn}</p>
                        <p className="truncate text-[0.7rem] text-muted-foreground">{mapping.reason}</p>
                      </div>
                      <div className="flex flex-1 items-center gap-2">
                        <label className="sr-only" htmlFor={`map-${source.sourceId}-${mapping.sourceColumn}`}>
                          Map {mapping.sourceColumn}
                        </label>
                        <Select
                          id={`map-${source.sourceId}-${mapping.sourceColumn}`}
                          className="flex-1"
                          value={mapping.target || ""}
                          disabled={busy}
                          onChange={(event) =>
                            onPatch({
                              sources: {
                                [sourceId]: { mappings: { [mapping.sourceColumn]: event.target.value || null } },
                              },
                            })
                          }
                        >
                          {source.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                        <Badge variant={confidenceVariant(mapping.status)}>
                          {mapping.status === "UNRESOLVED"
                            ? "Not mapped"
                            : mapping.status === "MANUAL"
                              ? "Yours"
                              : `${Math.round(mapping.confidence * 100)}%`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function confidenceVariant(status: string): "default" | "secondary" | "success" | "warning" {
  if (status === "AUTO") return "success";
  if (status === "MANUAL") return "default";
  if (status === "UNRESOLVED") return "warning";
  return "secondary";
}

function labelOf(record: MigrationRecordView): string {
  const values = record.normalized;
  return (
    (typeof values.name === "string" && values.name) ||
    (typeof values.title === "string" && values.title) ||
    (typeof values.invoiceNumber === "string" && `Invoice ${values.invoiceNumber}`) ||
    (typeof values.description === "string" && values.description) ||
    `Row ${record.sourceRow}`
  );
}

function referenceOf(record: MigrationRecordView): string {
  const values = record.normalized;
  return (
    (typeof values.clientRef === "string" && values.clientRef) ||
    (typeof values.clientEmailRef === "string" && values.clientEmailRef) ||
    (typeof values.projectRef === "string" && values.projectRef) ||
    "an unknown record"
  );
}
