"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * Styled replacement for `window.confirm`. Returns `[confirm, dialog]`: render
 * `dialog` once, then `if (!(await confirm({ title }))) return;` at the call site.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const dialog = (
    <Dialog open={options !== null} onOpenChange={(open) => { if (!open) settle(false); }}>
      <DialogContent className="max-w-md" data-confirm-dialog="">
        {options ? (
          <>
            <DialogTitle className="pr-8 text-lg font-extrabold tracking-[-0.03em]">{options.title}</DialogTitle>
            {options.description ? (
              <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">{options.description}</DialogDescription>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => settle(false)}>{options.cancelLabel || "Cancel"}</Button>
              <Button type="button" variant={options.destructive ? "destructive" : "default"} onClick={() => settle(true)}>
                {options.confirmLabel || "Confirm"}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );

  return [confirm, dialog];
}
