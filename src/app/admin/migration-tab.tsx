"use client";

import { Empty, FunnelUnavailable, LoadError, Metric, Panel, rate, type Funnel } from "./shared";

export function MigrationReliability({ funnel, retry, loading, error }: { funnel: Funnel | null; retry: () => void; loading: boolean; error: string }) {
  if (!funnel) return <FunnelUnavailable message={error} retry={retry} loading={loading} section="Reliability · Migration" />;
  const migration = funnel.reliability.migration;
  const duration = (value: number | null) => value === null ? "Not available" : `${value}m`;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-primary">Reliability · Migration</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">Can imports finish without uncertainty</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Completion, recovery, stale work, DLQ state, duration, and assistance demand. Counts never include filenames or customer cell values.</p>
      </div>
      {error ? <LoadError message={error} onRetry={retry} loading={loading} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Completion / 24h" value={rate(migration.completionRate24h)} detail={`${migration.sessions24h} sessions`} tone={migration.failed24h > 0 ? "amber" : "green"} />
        <Metric label="Completion / 7d" value={rate(migration.completionRate7d)} detail={`${migration.sessions7d} sessions`} tone="blue" />
        <Metric label="Recovered retries / 7d" value={migration.recoveredRetries7d} detail="Completed after more than one worker attempt" tone="green" />
        <Metric label="Assistance backlog" value={migration.assistanceBacklog} detail="New or reviewing support requests" tone={migration.assistanceBacklog > 0 ? "amber" : "blue"} />
        <Metric label="Stale jobs" value={migration.staleJobs} detail="No heartbeat for 15 minutes" tone={migration.staleJobs > 0 ? "red" : "green"} />
        <Metric label="DLQ messages" value={migration.dlqMessages === null ? "Unavailable" : migration.dlqMessages} detail="Any message pauses the acquisition CTA" tone={(migration.dlqMessages || 0) > 0 ? "red" : "green"} />
        <Metric label="Analysis p50 / p95" value={<span className="whitespace-nowrap text-2xl">{duration(migration.p50AnalysisMinutes)} / {duration(migration.p95AnalysisMinutes)}</span>} detail="Started to hashed preview" tone="blue" />
        <Metric label="Commit p50 / p95" value={<span className="whitespace-nowrap text-2xl">{duration(migration.p50CommitMinutes)} / {duration(migration.p95CommitMinutes)}</span>} detail="Commit claim to completed ledger" tone="blue" />
      </div>
      <Panel title="Failures by phase and code" eyebrow={`${migration.failed24h} failed in rolling 24h`}>
        {migration.failures.length ? (
          <div className="divide-y divide-border">
            {migration.failures.map((failure) => (
              <div key={`${failure.phase}:${failure.code}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div><p className="text-sm font-semibold text-card-foreground">{failure.phase}</p><p className="text-xs text-muted-foreground">{failure.code}</p></div>
                <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive">{failure.count}</span>
              </div>
            ))}
          </div>
        ) : <Empty text="No migration failures in the last 7 days." />}
      </Panel>
    </div>
  );
}
