import * as React from "react";
import { cn } from "@/lib/utils";
import { inputClassName } from "@/components/ui/input";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(inputClassName, "cursor-pointer", className)}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
