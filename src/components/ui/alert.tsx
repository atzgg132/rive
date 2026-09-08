import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-none border-l-[3px] border-r-0 border-y-0 px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg+div]:pl-7",
  {
    variants: {
      variant: {
        default: "border-l-border bg-muted/40 text-foreground",
        info: "border-l-primary bg-primary/[0.08] text-foreground",
        success: "border-l-success bg-success/[0.08] text-foreground",
        warning: "border-l-warning bg-warning/[0.08] text-foreground",
        destructive: "border-l-destructive bg-destructive/[0.08] text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  ),
);
Alert.displayName = "Alert";
