"use client";

import * as React from "react";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<React.ComponentPropsWithoutRef<typeof BaseSwitch.Root>, "className"> & {
  className?: string;
  thumbClassName?: string;
};

export const Switch = React.forwardRef<HTMLElement, SwitchProps>(
  ({ className, thumbClassName, ...props }, ref) => (
    <BaseSwitch.Root
      ref={ref}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-muted p-0.5 transition-colors duration-150 ease-out data-[checked]:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out data-[checked]:translate-x-5 dark:bg-slate-100",
          thumbClassName,
        )}
      />
    </BaseSwitch.Root>
  ),
);
Switch.displayName = "Switch";
