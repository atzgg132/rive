"use client";

import { Tabs } from "@/components/ui";
import { cn } from "@/lib/utils";
import { tabs, type Tab } from "./shared";

/**
 * Desktop section switcher. The horizontal Tabs primitive only works as a top
 * strip — inside a sidebar its auto-scroll clips labels — so at lg+ the admin
 * renders the same rows as a vertical nav using the workspace sidebar recipe:
 * full-width rows, accent fill and a 2px left rail on the active item.
 */
export function AdminNav({ value, onChange, className }: { value: Tab; onChange: (id: Tab) => void; className?: string }) {
  return (
    <nav aria-label="Admin sections" className={cn("flex flex-col gap-1", className)}>
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(id)}
            className={cn(
              "relative flex min-h-11 w-full items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-accent text-primary before:absolute before:bottom-[30%] before:left-0 before:top-[30%] before:w-[2px] before:bg-primary"
                : "text-muted-foreground hover:bg-foreground/[.05] hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Small screens keep the horizontal tab strip, where scrolling is acceptable. */
export function AdminTabStrip({ value, onChange }: { value: Tab; onChange: (id: Tab) => void }) {
  return (
    <Tabs
      options={tabs.map(({ id, label, icon: Icon }) => ({ id, label: (<span className="inline-flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span>) }))}
      value={value}
      onChange={(id) => onChange(id as Tab)}
      aria-label="Admin sections"
      className="overflow-x-auto"
    />
  );
}
