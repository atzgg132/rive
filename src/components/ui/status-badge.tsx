import { Badge, type BadgeProps } from "@/components/ui/badge";
import { statusLabel, statusTone, type StatusKind } from "@/lib/status-tone";

export interface StatusBadgeProps extends Omit<BadgeProps, "variant" | "children" | "dot"> {
  kind: StatusKind;
  value: string;
}

export function StatusBadge({ kind, value, ...props }: StatusBadgeProps) {
  const tone = statusTone(kind, value);
  return (
    <Badge {...props} variant={tone} dot>
      {statusLabel(kind, value)}
    </Badge>
  );
}
