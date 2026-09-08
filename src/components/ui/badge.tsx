import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[.72rem] font-bold leading-5 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/10 text-primary-strong dark:border-primary/30 dark:bg-primary/[0.16]",
        primary: "border-primary/25 bg-primary/10 text-primary-strong dark:border-primary/30 dark:bg-primary/[0.16]",
        secondary: "border-border bg-muted text-muted-foreground",
        success: "border-success/25 bg-success/10 text-success dark:border-success/30 dark:bg-success/[0.16]",
        warning: "border-warning/25 bg-warning/10 text-warning dark:border-warning/30 dark:bg-warning/[0.16]",
        destructive: "border-destructive/25 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/[0.16]",
        info: "border-info/25 bg-info/10 text-info dark:border-info/30 dark:bg-info/[0.16]",
        violet: "border-violet/25 bg-violet/10 text-violet dark:border-violet/30 dark:bg-violet/[0.16]",
        muted: "border-border bg-muted text-muted-foreground",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
