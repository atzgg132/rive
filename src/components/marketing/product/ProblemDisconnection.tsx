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
      className="overflow-hidden rounded-[1.45rem] border border-white/10 bg-[#0a0e16] shadow-[0_35px_100px_rgba(0,0,0,0.42)]"
    >
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-amber-200/90">{kicker}</p>
        <p className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-slate-500">5 records, 0 links</p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <p className="text-xl font-black tracking-[-0.035em] text-white">{title}</p>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{note}</p>
        <ol className="mt-6 divide-y divide-white/[0.06] border-y border-white/[0.06]">
          {records.map((record, index) => (
            <li key={record.label} className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-3 py-3.5 sm:grid-cols-[5.5rem_1fr_9.5rem]">
              <span className="font-mono text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-slate-500">{String(index + 1).padStart(2, "0")} {record.label}</span>
              <span>
                <span className="block text-sm font-bold tracking-[-0.02em] text-slate-100">{record.name}</span>
                <span className="mt-1 block text-[0.7rem] text-slate-500">{record.place}</span>
              </span>
              <span className="text-right font-mono text-[0.62rem] leading-5 text-amber-200/80">{record.status}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">Copied by hand. Again.</p>
      </div>
    </div>
  );
}
