import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Kicker } from "@/components/ui/kicker";
import { cn } from "@/lib/utils";

const metricTones = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  violet: "bg-violet/10 text-violet",
  muted: "bg-muted text-muted-foreground",
} as const;

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof metricTones;
  className?: string;
}

export function MetricCard({ label, value, sub, icon, tone = "primary", className }: MetricCardProps) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <Kicker tone="muted" dot={false}>
          {label}
        </Kicker>
        {icon ? <span className={cn("grid h-8 w-8 place-items-center", metricTones[tone])}>{icon}</span> : null}
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </Card>
  );
}
