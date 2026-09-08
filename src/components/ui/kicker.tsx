import * as React from "react";
import { cn } from "@/lib/utils";

export interface KickerProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "primary" | "muted";
  dot?: boolean;
}

export function Kicker({ tone = "primary", dot = true, className, children, ...props }: KickerProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[.55rem] text-[.72rem] font-extrabold uppercase leading-[1.25] tracking-[.14em]",
        tone === "muted" ? "text-muted-foreground" : "text-primary-strong",
        dot && "before:h-2 before:w-2 before:rounded-full before:bg-current before:content-['']",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
