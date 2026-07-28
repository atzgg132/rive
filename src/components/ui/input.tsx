"use client";

import * as React from "react";
import { Input as BaseInput } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

export const fieldControlClassName =
  "flex w-full rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm text-foreground shadow-sm transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/70 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50";

export const inputClassName = cn(fieldControlClassName, "h-11");

const choiceInputClassName =
  "h-4 w-4 shrink-0 cursor-pointer border-input bg-background text-primary accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export type InputProps = React.ComponentPropsWithoutRef<typeof BaseInput>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const isChoice = type === "checkbox" || type === "radio";
    const isFile = type === "file";

    return (
      <BaseInput
        ref={ref}
        type={type}
        className={cn(
          isChoice ? choiceInputClassName : isFile ? undefined : inputClassName,
          type === "radio" && "rounded-full",
          type === "checkbox" && "rounded",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
