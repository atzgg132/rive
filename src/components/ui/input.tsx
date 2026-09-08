"use client";

import * as React from "react";
import { Input as BaseInput } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

export const fieldControlClassName =
  "w-full rounded-none border border-input bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-55 disabled:bg-muted";

export const inputClassName = cn(fieldControlClassName, "h-11");

const choiceInputClassName =
  "h-4 w-4 shrink-0 cursor-pointer rounded-none border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export type InputProps = React.ComponentPropsWithoutRef<typeof BaseInput>;

const colorInputClassName =
  "h-10 w-10 cursor-pointer border border-input bg-transparent p-0";

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const isChoice = type === "checkbox" || type === "radio";
    const isFile = type === "file";
    const isColor = type === "color";

    return (
      <BaseInput
        ref={ref}
        type={type}
        className={cn(
          isChoice ? choiceInputClassName : isFile ? undefined : isColor ? colorInputClassName : inputClassName,
          type === "radio" && "rounded-full",
          type === "checkbox" && "rounded-none",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
