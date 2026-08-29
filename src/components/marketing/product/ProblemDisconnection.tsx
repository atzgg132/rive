export type ProblemDisconnectionProps = {
  kicker: string;
  title: string;
  note: string;
  records: { label: string; name: string; place: string; status: string }[];
};

export function ProblemDisconnection({ kicker, title, note, records }: ProblemDisconnectionProps) {
  return (
    <div
      data-testid="problem-disconnection"
      className="overflow-hidden rounded-[1.45rem] border border-[var(--stroke-hairline)] bg-[var(--surface-raised)] shadow-overlay"
    >
      <div className="hidden items-center justify-between border-b border-[var(--stroke-hairline)] px-5 py-3.5 lg:flex">
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-warning">{kicker}</p>
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">5 records, 0 links</p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <p className="text-xl font-black tracking-[-0.035em] text-foreground">{title}</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{note}</p>
        <ol className="mt-6 divide-y divide-[color:var(--stroke-hairline)] border-y border-[var(--stroke-hairline)]">
          {records.map((record, index) => (
            <li key={record.label} className="grid grid-cols-[auto_1fr] items-baseline gap-3 py-2.5 lg:grid-cols-[5.5rem_1fr_9.5rem] lg:py-3.5">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:text-[0.58rem]">{String(index + 1).padStart(2, "0")} {record.label}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold tracking-[-0.02em] text-foreground">{record.name}</span>
                <span className="mt-1 hidden text-[0.7rem] text-muted-foreground lg:block">{record.place}</span>
              </span>
              <span className="hidden font-mono text-[0.62rem] leading-5 text-warning lg:block lg:text-right">{record.status}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 hidden font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground lg:block">Copied by hand. Again.</p>
      </div>
    </div>
  );
}
