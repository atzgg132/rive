import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabsOption {
  id: string;
  label: React.ReactNode;
  count?: number;
}

// `HTMLAttributes` includes the DOM form `onChange` event. Tabs expose a
// value-oriented callback instead, so omit that key before adding our API.
export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: TabsOption[];
  value: string;
  onChange: (id: string) => void;
}

export function Tabs({ options, value, onChange, className, ...props }: TabsProps) {
  return (
    <div className={cn("flex gap-6 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)} {...props}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            data-state={active ? "active" : "inactive"}
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className="relative -mb-px min-h-11 shrink-0 whitespace-nowrap pb-3 text-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground"
          >
            {option.label}
            {option.count !== undefined ? (
              <span className="ml-2 rounded-full bg-muted px-1.5 text-[.7rem] font-mono">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
