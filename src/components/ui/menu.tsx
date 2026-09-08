"use client";

import * as React from "react";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const menuItemClassName =
  "flex min-h-9 w-full cursor-pointer select-none items-center gap-2 rounded-none px-3 py-2 text-left text-sm font-medium text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-55";

export interface AnchoredMenuProps {
  /** The button or other interactive element that owns the menu. */
  trigger: React.ReactElement;
  /** Whether the menu is currently open. */
  open: boolean;
  /** Called when Base UI opens or dismisses the menu. */
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** Accessible name for the menu popup. */
  "aria-label": string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number;
}

/**
 * A compact, anchored action menu for workspace surfaces.
 *
 * Base UI owns the interaction details here: trigger relationships, focus
 * roving, Escape/outside dismissal, and collision-aware positioning. Keeping
 * the trigger in the same root as the popup also means the menu remains
 * correctly anchored when a table or card scrolls.
 */
export function AnchoredMenu({
  trigger,
  open,
  onOpenChange,
  children,
  "aria-label": ariaLabel,
  className,
  side = "bottom",
  align = "end",
  sideOffset = 4,
  alignOffset = 0,
  collisionPadding = 8,
}: AnchoredMenuProps) {
  return (
    <BaseMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner
          side={side}
          align={align}
          sideOffset={sideOffset}
          alignOffset={alignOffset}
          collisionPadding={collisionPadding}
          className="z-50 outline-none"
        >
          <BaseMenu.Popup
            aria-label={ariaLabel}
            className={cn(
              "min-w-36 overflow-hidden rounded-none border border-border bg-popover p-1 text-popover-foreground shadow-overlay animate-panel-in",
              className,
            )}
          >
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

export interface AnchoredMenuItemProps
  extends Omit<React.ComponentPropsWithoutRef<typeof BaseMenu.Item>, "className"> {
  className?: string;
}

export const AnchoredMenuItem = React.forwardRef<HTMLElement, AnchoredMenuItemProps>(
  ({ className, ...props }, ref) => (
    <BaseMenu.Item ref={ref} className={cn(menuItemClassName, className)} {...props} />
  ),
);
AnchoredMenuItem.displayName = "AnchoredMenuItem";

// Keep the short names available for future workspace surfaces while the
// descriptive names make call sites self-documenting during this migration.
export const Menu = AnchoredMenu;
export const MenuItem = AnchoredMenuItem;

export interface AnchoredMenuSelectOption {
  value: string;
  label: string;
}

export interface AnchoredMenuSelectProps {
  id?: string;
  label: string;
  value: string;
  options: readonly AnchoredMenuSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

/** A compact, trigger-aligned toolbar filter. Native Select remains available for forms. */
export function AnchoredMenuSelect({ id, label, value, options, onChange, className }: AnchoredMenuSelectProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <AnchoredMenu
      open={open}
      onOpenChange={setOpen}
      aria-label={label}
      className={cn("min-w-48", className)}
      trigger={
        <Button
          id={id}
          type="button"
          variant="outline"
          size="default"
          aria-label={`${label}: ${selected?.label || value}`}
          className="min-h-11 w-full justify-between gap-3 border-border bg-card text-left text-sm font-medium hover:border-border hover:bg-card hover:text-foreground hover:translate-y-0 sm:w-auto"
        >
          <span className="min-w-0 truncate">
            <span className="mr-2 text-xs font-semibold text-muted-foreground">{label}</span>
            <span className="font-semibold text-foreground">{selected?.label || value}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      }
    >
      {options.map((option) => (
        <AnchoredMenuItem
          key={option.value}
          aria-current={option.value === value ? "true" : undefined}
          onClick={() => {
            onChange(option.value);
            setOpen(false);
          }}
        >
          <span className="min-w-0 flex-1 truncate">{option.label}</span>
          {option.value === value ? <span aria-hidden="true" className="text-primary">✓</span> : null}
        </AnchoredMenuItem>
      ))}
    </AnchoredMenu>
  );
}
