import * as React from "react";
import { cn } from "@/lib/utils";
import { Kicker } from "@/components/ui/kicker";

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  kicker?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  kicker,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        {kicker ? <Kicker className="mb-2">{kicker}</Kicker> : null}
        <h1 className="text-[1.75rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-[2rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-0.5">{actions}</div> : null}
    </div>
  );
}
