import { cn } from "@/lib/utils";
import { InstMark, type RecordMark } from "@/components/marketing/primitives";

export const RECORD_FIELDS = [
  { key: "client", mark: "circle" as RecordMark, label: "Client", value: "Aster House — asterhouse.co" },
  { key: "project", mark: "square" as RecordMark, label: "Project", value: "Website launch · 4/6 milestones" },
  { key: "agreement", mark: "triangle" as RecordMark, label: "Agreement", value: "Terms accepted" },
  { key: "invoice", mark: "diamond" as RecordMark, label: "Invoice", value: "INV-024 · ₹90,000 due Aug 28" },
  { key: "proof", mark: "semi" as RecordMark, label: "Proof", value: "Published to portfolio" },
] as const;

export type RecordPhase = 0 | 1 | 2 | 3 | 4;

/** The Record — a registry card that accumulates one field per department.
 * `phase` is how many departments it has passed (0 = empty file). The
 * agreement field lands as a red stamp; everything else registers in ink. */
export function RecordArtifact({ phase, inline = false, className }: { phase: number; inline?: boolean; className?: string }) {
  return (
    <div className={cn("inst-record", inline && "inst-record--inline", className)} data-phase={phase} aria-label="Sample client record, accumulating fields as the page progresses" role="img">
      <div className="inst-record__head">
        <span className="inst-mono">Rive — Client record</span>
        <span className="inst-record__seal" aria-hidden="true" />
      </div>
      <div className="inst-record__rows">
        {RECORD_FIELDS.map((field, index) => {
          const filled = index <= phase;
          const stamped = filled && field.key === "agreement";
          return (
            <div key={field.key} className="inst-record__field" data-state={filled ? (stamped ? "stamped" : "filled") : "pending"}>
              <span className="inst-mono"><InstMark mark={field.mark} red={stamped} />{field.label}</span>
              <span className="inst-record__value">{filled ? field.value : "—"}</span>
            </div>
          );
        })}
      </div>
      <div className="inst-record__foot">
        <span className="inst-mono">Field no. 001</span>
        <span className="inst-mono">{phase >= RECORD_FIELDS.length - 1 ? "Complete" : `Registering ${phase + 1} of ${RECORD_FIELDS.length}`}</span>
      </div>
    </div>
  );
}
