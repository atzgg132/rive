import * as React from "react";
import { cn } from "@/lib/utils";
import { inputClassName } from "@/components/ui/input";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Use the denser treatment used by workspace filter toolbars. */
  density?: "default" | "compact";
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, density = "default", ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        inputClassName,
        "cursor-pointer",
        density === "compact" && "h-10 px-3 py-2",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
