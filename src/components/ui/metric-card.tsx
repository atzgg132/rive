import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Kicker } from "@/components/ui/kicker";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}

export function MetricCard({ label, value, sub, className }: MetricCardProps) {
  return (
    <Card className={cn("p-5", className)}>
      <Kicker tone="muted" dot={false}>
        {label}
      </Kicker>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}
