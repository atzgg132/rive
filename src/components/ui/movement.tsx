import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

export interface MovementProps {
  /** Movement against the comparison window; null when there is nothing honest to compare. */
  change: number | null;
  /** Unit tail for plain numbers — "%" by default, "pts" for percentage-point moves. */
  suffix?: string;
  /** Set when an increase is the bad direction (e.g. costs). */
  inverse?: boolean;
  /** Render without a good/bad colour — information, not a verdict. */
  neutral?: boolean;
  /** The "vs X" tail — "vs previous" unless the window has a better name. */
  comparison?: string;
  /** Render the signed delta through this formatter (e.g. money) instead of `change + suffix`. */
  formatValue?: (value: number) => string;
}

/**
 * A metric's movement against the previous window, or nothing when there is
 * nothing honest to show. Growth from zero is not a percentage — the caller
 * passes null for it.
 */
export function Movement({ change, suffix = "%", inverse = false, neutral = false, comparison = "vs previous", formatValue }: MovementProps) {
  if (change === null) return <span className="text-xs text-muted-foreground">No comparison</span>;
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <ArrowRight className="h-3 w-3" /> No change <span className="font-medium">{comparison}</span>
      </span>
    );
  }
  const positive = inverse ? change < 0 : change > 0;
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = neutral ? "text-muted-foreground" : positive ? "text-success" : "text-destructive";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${tone}`}>
      <Icon className="h-3 w-3" />
      {change > 0 ? "+" : ""}
      {formatValue ? formatValue(change) : `${change}${suffix}`}
      <span className="font-medium text-muted-foreground">{comparison}</span>
    </span>
  );
}
