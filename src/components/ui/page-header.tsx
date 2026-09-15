import * as React from "react";
import { cn } from "@/lib/utils";
import { Kicker } from "@/components/ui/kicker";

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  kicker?: string;
  /** Heading element for the title — defaults to h1. Inert reproductions
   * (marketing previews) pass a non-heading element so the page keeps one h1. */
  titleAs?: "h1" | "h2" | "h3" | "div";
}

export function PageHeader({
  title,
  description,
  actions,
  kicker,
  className,
  titleAs: TitleTag = "h1",
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
        <TitleTag className="text-[1.75rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-[2rem]">
          {title}
        </TitleTag>
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
