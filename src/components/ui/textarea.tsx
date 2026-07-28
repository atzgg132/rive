import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldControlClassName } from "@/components/ui/input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(fieldControlClassName, "min-h-24 resize-y", className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
