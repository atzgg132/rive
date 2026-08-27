"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Dialog = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;
export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;

export function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentPropsWithoutRef<typeof BaseDialog.Popup> & {
  showClose?: boolean;
}) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:bg-slate-950/75" />
      <BaseDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
        <BaseDialog.Popup
          className={cn(
            "relative w-full max-w-lg rounded-2xl border border-border bg-popover p-5 text-popover-foreground shadow-overlay transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-2 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 sm:p-6",
            className,
          )}
          {...props}
        >
          {children}
          {showClose && (
            <BaseDialog.Close
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close dialog"
                  className="absolute right-3 top-3"
                />
              }
            >
              <X className="h-4 w-4" />
            </BaseDialog.Close>
          )}
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}
