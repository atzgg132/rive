import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export interface ContextualEmptyStateProps extends EmptyStateProps {
  why?: string;
  next?: string;
  after?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-44 flex-col items-center justify-center rounded-none border border-border bg-muted/40 px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-none border border-border bg-card text-muted-foreground">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-extrabold tracking-[-0.02em] text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ContextualEmptyState({ why, next, after, description, ...props }: ContextualEmptyStateProps) {
  const context = [why, next && `Next: ${next}`, after && `Then: ${after}`].filter(Boolean).join(" ");
  return <EmptyState {...props} description={[description, context].filter(Boolean).join(" ")} />;
}
